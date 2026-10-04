"""Vòng đời model gợi ý (hybrid CF + content-based): train định kỳ, cache, phục vụ."""

from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

import pandas as pd

from api.schemas import (
    CustomerRecommendationResponse,
    HealthResponse,
    RecommendationItem,
)
from config import (
    CB_ONBOARDING_PSEUDO_COUNT,
    HYBRID_ALLOW_REPEAT,
    HYBRID_CF_SHRINK_K,
    HYBRID_MODEL_PATH,
    HYBRID_REPEAT_WEIGHT,
    MODEL_PATH,
    PRECOMPUTE_BUDGET_SECONDS,
    PRECOMPUTE_ENABLED,
    PRECOMPUTE_TOP_K,
    REPEAT_SCORE,
    TRAIN_INITIAL_DELAY_SECONDS,
    TRAIN_INTERVAL_SECONDS,
)
from data_source import clickhouse
from models.cf_recommendation import CollaborativeFiltering
from models.hybrid import HybridParams, HybridRecommender, build_recommender

logger = logging.getLogger(__name__)

MODEL_NAME = "Hybrid: Item-based CF + Content-based + Repeat"
API_VERSION = "0.4.0"


def current_params() -> HybridParams:
    return HybridParams(
        cf_shrink_k=HYBRID_CF_SHRINK_K,
        repeat_weight=HYBRID_REPEAT_WEIGHT,
        allow_repeat=HYBRID_ALLOW_REPEAT,
    )


@dataclass
class ModelBundle:
    """Một bản train hoàn chỉnh: model + cache gợi ý + số liệu kèm theo.

    Gói chung vào một đối tượng bất biến là điều kiện để đổi bản an toàn. Nếu
    model và cache là hai thuộc tính rời của service, sẽ có khoảnh khắc model
    đã là v2 còn cache vẫn của v1 — request rơi đúng lúc đó nhận gợi ý trỏ tới
    sản phẩm không còn trong catalog của model. Đổi cả gói bằng MỘT phép gán
    thì không tồn tại trạng thái lai đó.
    """

    model: HybridRecommender
    # khách -> [(product_id, lý do)]
    cache: dict[str, list[tuple[str, str]]] = field(default_factory=dict)
    trained_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    source: str = "unknown"
    version: int = 0
    stats: dict[str, int] = field(default_factory=dict)


def _precompute(model: HybridRecommender, top_k: int, budget_s: float) -> dict[str, list[tuple[str, str]]]:
    """Tính sẵn top-K cho mọi khách có tín hiệu riêng (đã mua hoặc đã làm onboarding).

    Vì sao lặp từng khách chứ không nhân ma trận một lần: ma trận điểm đầy đủ
    có kích thước (số khách x số sản phẩm). Với 600.000 sản phẩm thì chỉ 1.000
    khách đã là 600 triệu ô — không chứa nổi trong bộ nhớ. Mỗi khách chỉ cần
    hai phép nhân thưa rồi lấy top-K, nên lặp lại rẻ hơn nhiều so với dựng ra
    cả ma trận rồi vứt đi gần hết.

    Có trần thời gian: quá hạn thì dừng, phần khách còn lại rơi về tính tại
    chỗ. Thà cache một phần còn hơn để một chu kỳ train tràn sang chu kỳ sau.
    """
    cache: dict[str, list[tuple[str, str]]] = {}
    started = time.monotonic()
    customers = model.known_customers()
    for i, customer_id in enumerate(customers):
        if time.monotonic() - started > budget_s:
            logger.warning(
                "Tính sẵn dừng ở %d/%d khách sau %.1fs (quá trần). "
                "Số còn lại sẽ được tính tại chỗ khi có request.",
                i, len(customers), budget_s,
            )
            break
        try:
            cache[str(customer_id)] = [
                (pid, reason) for pid, _, reason in model.recommend(str(customer_id), top_k=top_k)
            ]
        except Exception as exc:                      # noqa: BLE001
            # Một khách lỗi không được làm hỏng cả bản train.
            logger.debug("Bỏ qua khách %s khi tính sẵn: %s", customer_id, exc)

    logger.info("Đã tính sẵn gợi ý cho %d/%d khách trong %.1fs.",
                len(cache), len(customers), time.monotonic() - started)
    return cache


class CFModelService:
    """Singleton giữ bản model đang phục vụ và chạy vòng train nền."""

    _instance: CFModelService | None = None

    def __init__(self) -> None:
        self._bundle: ModelBundle | None = None
        self._version = 0
        self._last_error: str | None = None
        self._task: asyncio.Task | None = None
        # Chặn hai lần train chạy chồng nhau. Một chu kỳ train lâu hơn 5 phút
        # thì lần kế tiếp phải bỏ qua, không phải xếp hàng chờ — xếp hàng chỉ
        # làm tình trạng chậm tệ thêm.
        self._training = asyncio.Lock()

    @classmethod
    def get_instance(cls) -> CFModelService:
        if cls._instance is None:
            cls._instance = CFModelService()
        return cls._instance

    # ── Khởi động ────────────────────────────────────────────────────────

    def initialize(self) -> None:
        """Nạp nhanh model đã lưu trên đĩa để phục vụ được ngay.

        Không train ở đây: train đồng bộ lúc khởi động sẽ chặn cả quá trình,
        healthcheck của Docker hết giờ và container bị khai tử giữa chừng. Vòng
        train nền lo phần làm mới.
        """
        if self._bundle is not None:
            return

        loaded = self._load_from_disk()
        if loaded is not None:
            self._version += 1
            self._bundle = ModelBundle(
                model=loaded,
                cache={},               # cache dựng lại ở lần train đầu tiên
                source="disk",
                version=self._version,
                stats=loaded.summary(),
            )
            logger.info("Nạp model từ đĩa: %s", loaded.summary())
            return

        logger.info("Chưa có model. Phục vụ rỗng cho tới lần train nền đầu tiên.")

    @staticmethod
    def _load_from_disk() -> HybridRecommender | None:
        """Bản hybrid nếu có; không thì bản thuần CF cũ (lúc vừa nâng cấp).

        Tham số trộn lấy theo config HIỆN TẠI chứ không theo file: đổi k/γ qua
        biến môi trường rồi khởi động lại là có hiệu lực ngay, không cần train.
        """
        for path in (HYBRID_MODEL_PATH, MODEL_PATH):
            if not path.exists():
                continue
            try:
                if path == HYBRID_MODEL_PATH:
                    old = HybridRecommender.load(path)
                    return HybridRecommender(old.cf, old.cb, current_params(),
                                             getattr(old, "repeat", None))
                cf = CollaborativeFiltering(model_path=path).load_model()
                return HybridRecommender(cf, None, current_params())
            except Exception as exc:                  # noqa: BLE001
                # File hỏng (tiến trình chết giữa lúc ghi) không được chặn khởi động.
                logger.warning("Không đọc được model %s (%s), thử nguồn khác.", path, exc)
        return None

    # ── Vòng train nền ───────────────────────────────────────────────────

    async def start_background_training(self) -> None:
        self._task = asyncio.create_task(self._training_loop())

    async def stop_background_training(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass

    async def _training_loop(self) -> None:
        await asyncio.sleep(TRAIN_INITIAL_DELAY_SECONDS)
        while True:
            try:
                await self.train_once()
            except asyncio.CancelledError:
                raise
            except Exception as exc:                  # noqa: BLE001
                # Vòng lặp KHÔNG được chết. Warehouse sập một lúc thì model cũ
                # vẫn phục vụ, và chu kỳ sau thử lại.
                self._last_error = str(exc)
                logger.exception("Chu kỳ train thất bại, giữ nguyên model đang chạy.")
            await asyncio.sleep(TRAIN_INTERVAL_SECONDS)

    async def train_once(self) -> ModelBundle | None:
        """Một chu kỳ: lấy dữ liệu -> train -> tính sẵn -> đổi bản."""
        if self._training.locked():
            logger.warning("Chu kỳ trước còn đang chạy, bỏ qua lượt này.")
            return None

        async with self._training:
            # to_thread là bắt buộc: train và tính sẵn đều là việc nặng CPU.
            # Chạy thẳng trong vòng lặp sự kiện sẽ treo toàn bộ API — mọi
            # request đứng im cho tới khi train xong.
            return await asyncio.to_thread(self._train_sync)

    def _train_sync(self) -> ModelBundle | None:
        started = time.monotonic()

        df, source = self._load_frame()
        if df is None or df.empty:
            logger.warning("Không có dữ liệu train ở chu kỳ này, giữ nguyên model cũ.")
            return None

        cf = CollaborativeFiltering(model_path=MODEL_PATH)
        cf.fit(df)

        errors: list[str] = []
        features, signals = self._load_content(errors)
        events = self._load_purchase_events(errors)
        model = build_recommender(
            cf, features, signals, current_params(),
            onboarding_pseudo_count=CB_ONBOARDING_PSEUDO_COUNT,
            purchase_events=events,
        )

        cache = (
            _precompute(model, PRECOMPUTE_TOP_K, PRECOMPUTE_BUDGET_SECONDS)
            if PRECOMPUTE_ENABLED else {}
        )

        self._version += 1
        new_bundle = ModelBundle(
            model=model,
            cache=cache,
            source=source,
            version=self._version,
            stats=model.summary(),
        )

        # ── ĐỔI BẢN ──────────────────────────────────────────────────────
        # Tới đây bản mới đã sẵn sàng hoàn chỉnh. Phép gán dưới đây là điểm
        # duy nhất bản cũ ngừng phục vụ, và nó atomic nhờ GIL của Python:
        # không có nửa bước nào để một request rơi vào.
        #
        # Suốt thời gian train ở trên, bản cũ vẫn trả lời bình thường — đó là
        # lý do phải dựng xong hẳn rồi mới gán, thay vì sửa dần model đang chạy.
        previous = self._bundle
        self._bundle = new_bundle
        # Lượt này thiếu nguồn nào (bảng đặc trưng, lịch sử theo đơn) thì giữ lỗi
        # đó cho /health; chỉ lượt đủ mọi nguồn mới xoá lỗi cũ.
        if errors:
            self._last_error = " | ".join(errors)
        elif new_bundle.stats.get("content_based"):
            self._last_error = None

        # Bản cũ được giải phóng khi request cuối cùng đang cầm nó kết thúc.
        # Không xoá tay bằng gc: tham chiếu do Python đếm, ép thu gom sớm chỉ
        # rước nguy cơ kéo đổ một request đang dở.
        del previous

        self._persist(model)

        logger.info(
            "Bản train #%d sẵn sàng sau %.1fs — %d khách, %d sản phẩm CF, %d tương tác, "
            "%d ứng viên, %d khách onboarding, cache %d khách (nguồn: %s).",
            new_bundle.version, time.monotonic() - started,
            new_bundle.stats["customers"], new_bundle.stats["products"],
            new_bundle.stats["interactions"], new_bundle.stats["candidates"],
            new_bundle.stats["onboarded_customers"], len(cache), source,
        )
        return new_bundle

    def _load_frame(self) -> tuple[pd.DataFrame | None, str]:
        """Ưu tiên warehouse, rơi về CSV cục bộ nếu chưa cấu hình ClickHouse."""
        if clickhouse.is_configured():
            try:
                return clickhouse.fetch_training_data(), "clickhouse"
            except clickhouse.ClickHouseUnavailable as exc:
                # Ghi rõ rồi thử CSV: warehouse hỏng không nên làm chết hẳn dịch vụ.
                self._last_error = str(exc)
                logger.warning("Warehouse không sẵn sàng: %s", exc)

        try:
            model = CollaborativeFiltering(model_path=MODEL_PATH)
            return model.load_dataset(), "csv"
        except FileNotFoundError:
            return None, "none"

    def _load_content(self, errors: list[str]) -> tuple[pd.DataFrame | None, pd.DataFrame | None]:
        """Đặc trưng sản phẩm + sở thích onboarding. Lỗi thì chạy thuần CF.

        Hai nguồn độc lập: thiếu sở thích (chưa ai làm onboarding, bảng chưa
        dựng) vẫn dùng được đặc trưng cho hồ sơ từ lịch sử mua. Thiếu đặc trưng
        thì mất cả content-based lẫn bộ lọc "không quan tâm" — ghi vào
        last_error để /health báo ra, không im lặng.
        """
        if not clickhouse.is_configured():
            return None, None
        features = signals = None
        try:
            features = clickhouse.fetch_product_features()
        except clickhouse.ClickHouseUnavailable as exc:
            errors.append(f"Không lấy được đặc trưng sản phẩm: {exc}")
            logger.warning("%s — chạy thuần CF, KHÔNG lọc được 'không quan tâm'.", errors[-1])
        try:
            signals = clickhouse.fetch_preference_signals()
        except clickhouse.ClickHouseUnavailable as exc:
            logger.warning("Không lấy được sở thích onboarding: %s", exc)
        return features, signals

    def _load_purchase_events(self, errors: list[str]) -> pd.DataFrame | None:
        """Lịch sử mua theo đơn cho kênh mua lại. Lỗi thì rơi về kênh cũ.

        Rơi về chứ không dừng train: kênh cũ (trọng số ma trận CF) vẫn gợi ý
        mua lại được, chỉ kém hơn. Nhưng phải hiện ở /health — đang chạy khác
        cấu hình đã chọn trên validation là điều bên vận hành cần biết.
        """
        if REPEAT_SCORE != "order_freq" or not clickhouse.is_configured():
            return None
        try:
            return clickhouse.fetch_purchase_events()
        except clickhouse.ClickHouseUnavailable as exc:
            errors.append(f"Không lấy được lịch sử mua theo đơn, kênh mua lại dùng cách cũ: {exc}")
            logger.warning("%s", errors[-1])
            return None

    def _persist(self, model: HybridRecommender) -> None:
        """Ghi model ra đĩa để lần khởi động sau phục vụ được ngay.

        Ghi ra file tạm rồi os.replace: đổi tên là thao tác nguyên tử trên cùng
        một hệ thống tệp. Ghi thẳng đè lên file đang dùng mà tiến trình chết
        giữa chừng sẽ để lại một file .joblib cụt, và lần khởi động sau nạp
        phải nó — hỏng im lặng.
        """
        try:
            model.save(HYBRID_MODEL_PATH)
        except Exception as exc:                      # noqa: BLE001
            # Không ghi được đĩa thì bản trong bộ nhớ vẫn dùng tốt.
            logger.warning("Không lưu được model ra đĩa: %s", exc)

    # ── Phục vụ ──────────────────────────────────────────────────────────

    @property
    def is_loaded(self) -> bool:
        return self._bundle is not None

    def get_health(self) -> HealthResponse:
        bundle = self._bundle
        if bundle is None:
            return HealthResponse(
                status="initializing", model_name=MODEL_NAME, model_loaded=False,
                customers=0, products=0, interactions=0, version=API_VERSION,
                last_error=self._last_error,
            )
        return HealthResponse(
            status="ok", model_name=MODEL_NAME, model_loaded=True,
            customers=bundle.stats.get("customers", 0),
            products=bundle.stats.get("products", 0),
            interactions=bundle.stats.get("interactions", 0),
            version=API_VERSION,
            model_version=bundle.version,
            trained_at=bundle.trained_at.isoformat(),
            data_source=bundle.source,
            cached_customers=len(bundle.cache),
            candidates=bundle.stats.get("candidates", 0),
            onboarded_customers=bundle.stats.get("onboarded_customers", 0),
            content_based=bool(bundle.stats.get("content_based", 0)),
            repeat_model=bool(bundle.stats.get("repeat_model", 0)),
            last_error=self._last_error,
        )

    def recommend_for_customer(
        self, customer_id: str, top_k: int = 10
    ) -> CustomerRecommendationResponse:
        # Chụp tham chiếu MỘT lần. Đọc self._bundle nhiều lần trong cùng một
        # request có thể rơi vào hai bản khác nhau nếu vòng train đổi bản ở
        # giữa — lúc đó cache của bản này ghép với model của bản kia.
        bundle = self._bundle
        if bundle is None:
            return CustomerRecommendationResponse(customer_id=customer_id, recommendations=[])

        cid = str(customer_id)
        cached = bundle.cache.get(cid)
        if cached is not None and len(cached) >= top_k:
            items = cached[:top_k]
        else:
            # Không có trong cache (khách mới mua lần đầu, hoặc xin nhiều hơn
            # số đã tính sẵn) thì tính tại chỗ từ CHÍNH bản model này.
            items = [(pid, reason) for pid, _, reason in bundle.model.recommend(cid, top_k=top_k)]

        return CustomerRecommendationResponse(
            customer_id=cid,
            recommendations=[RecommendationItem(product_id=p, reason=r) for p, r in items],
        )
