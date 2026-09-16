"""Vòng đời model Collaborative Filtering: train định kỳ, cache, phục vụ."""

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
    MODEL_PATH,
    PRECOMPUTE_BUDGET_SECONDS,
    PRECOMPUTE_ENABLED,
    PRECOMPUTE_TOP_K,
    TRAIN_INITIAL_DELAY_SECONDS,
    TRAIN_INTERVAL_SECONDS,
)
from data_source import clickhouse
from models.cf_recommendation import CollaborativeFiltering

logger = logging.getLogger(__name__)

MODEL_NAME = "Item-based Collaborative Filtering"
API_VERSION = "0.2.0"


@dataclass
class ModelBundle:
    """Một bản train hoàn chỉnh: model + cache gợi ý + số liệu kèm theo.

    Gói chung vào một đối tượng bất biến là điều kiện để đổi bản an toàn. Nếu
    model và cache là hai thuộc tính rời của service, sẽ có khoảnh khắc model
    đã là v2 còn cache vẫn của v1 — request rơi đúng lúc đó nhận gợi ý trỏ tới
    sản phẩm không còn trong catalog của model. Đổi cả gói bằng MỘT phép gán
    thì không tồn tại trạng thái lai đó.
    """

    model: CollaborativeFiltering
    cache: dict[str, list[str]] = field(default_factory=dict)
    trained_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    source: str = "unknown"
    version: int = 0
    stats: dict[str, int] = field(default_factory=dict)


def _precompute(model: CollaborativeFiltering, top_k: int, budget_s: float) -> dict[str, list[str]]:
    """Tính sẵn top-K cho mọi khách đã có lịch sử mua.

    Vì sao lặp từng khách chứ không nhân ma trận một lần: ma trận điểm đầy đủ
    có kích thước (số khách x số sản phẩm). Với 600.000 sản phẩm thì chỉ 1.000
    khách đã là 600 triệu ô — không chứa nổi trong bộ nhớ. Mỗi khách chỉ cần
    hai phép nhân thưa rồi lấy top-K, nên lặp lại rẻ hơn nhiều so với dựng ra
    cả ma trận rồi vứt đi gần hết.

    Có trần thời gian: quá hạn thì dừng, phần khách còn lại rơi về tính tại
    chỗ. Thà cache một phần còn hơn để một chu kỳ train tràn sang chu kỳ sau.
    """
    cache: dict[str, list[str]] = {}
    if model.user_item_matrix is None:
        return cache

    started = time.monotonic()
    customers = list(model.user_item_matrix.index)
    for i, customer_id in enumerate(customers):
        if time.monotonic() - started > budget_s:
            logger.warning(
                "Tính sẵn dừng ở %d/%d khách sau %.1fs (quá trần). "
                "Số còn lại sẽ được tính tại chỗ khi có request.",
                i, len(customers), budget_s,
            )
            break
        try:
            cache[str(customer_id)] = [pid for pid, _ in model.recommend(str(customer_id), top_k=top_k)]
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

        if MODEL_PATH.exists():
            try:
                model = CollaborativeFiltering(model_path=MODEL_PATH)
                model.load_model()
                self._version += 1
                self._bundle = ModelBundle(
                    model=model,
                    cache={},               # cache dựng lại ở lần train đầu tiên
                    source="disk",
                    version=self._version,
                    stats=model.summary(),
                )
                logger.info("Nạp model từ đĩa: %s", model.summary())
                return
            except Exception as exc:                  # noqa: BLE001
                # File hỏng (tiến trình chết giữa lúc ghi) không được chặn khởi động.
                logger.warning("Không đọc được model trên đĩa (%s), sẽ train lại.", exc)

        logger.info("Chưa có model. Phục vụ rỗng cho tới lần train nền đầu tiên.")

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

        model = CollaborativeFiltering(model_path=MODEL_PATH)
        model.fit(df)

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
        self._last_error = None

        # Bản cũ được giải phóng khi request cuối cùng đang cầm nó kết thúc.
        # Không xoá tay bằng gc: tham chiếu do Python đếm, ép thu gom sớm chỉ
        # rước nguy cơ kéo đổ một request đang dở.
        del previous

        self._persist(model)

        logger.info(
            "Bản train #%d sẵn sàng sau %.1fs — %d khách, %d sản phẩm, %d tương tác, cache %d khách (nguồn: %s).",
            new_bundle.version, time.monotonic() - started,
            new_bundle.stats["customers"], new_bundle.stats["products"],
            new_bundle.stats["interactions"], len(cache), source,
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

    def _persist(self, model: CollaborativeFiltering) -> None:
        """Ghi model ra đĩa để lần khởi động sau phục vụ được ngay.

        Ghi ra file tạm rồi os.replace: đổi tên là thao tác nguyên tử trên cùng
        một hệ thống tệp. Ghi thẳng đè lên file đang dùng mà tiến trình chết
        giữa chừng sẽ để lại một file .joblib cụt, và lần khởi động sau nạp
        phải nó — hỏng im lặng.
        """
        try:
            model.model_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = model.model_path.with_suffix(".joblib.tmp")
            original = model.model_path
            model.model_path = tmp
            model.save_model()
            model.model_path = original
            os.replace(tmp, original)
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
            product_ids = cached[:top_k]
        else:
            # Không có trong cache (khách mới mua lần đầu, hoặc xin nhiều hơn
            # số đã tính sẵn) thì tính tại chỗ từ CHÍNH bản model này.
            product_ids = [pid for pid, _ in bundle.model.recommend(cid, top_k=top_k)]

        return CustomerRecommendationResponse(
            customer_id=cid,
            recommendations=[RecommendationItem(product_id=p) for p in product_ids],
        )
