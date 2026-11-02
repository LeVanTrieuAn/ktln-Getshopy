"""Hybrid có trọng số: Item-CF + Content-based + kênh mua lại, lọc cứng "không quan tâm".

    final(u, i) = α_u · ĉf(u, i) + (1 − α_u) · ĉb(u, i) + γ · rêp(u, i)
    α_u         = n_u / (n_u + k)              (n_u = số món khác nhau khách đã mua)

  ĉf  : điểm Item-CF (Sarwar et al., 2001) CHỈ trên món CHƯA mua — kênh khám phá
  ĉb  : điểm content-based (models/content_based.py)
  rêp : kênh mua lại. Có RepeatModel (lịch sử theo đơn) thì là tần suất đơn đã
        giảm theo thời gian (models/repeat.py); không có thì rơi về cách cũ —
        trọng số của món trong ma trận CF. Độ gần đây và tần suất là hai tín hiệu
        mạnh nhất của việc mua lặp lại (Anderson et al., 2014).
  Mỗi kênh chuẩn hoá về [0, 1] theo giá trị lớn nhất CỦA KHÁCH ĐÓ, để α và γ so
  "món tốt nhất của kênh này" với "món tốt nhất của kênh kia".

Cách trộn là hybrid có trọng số (weighted hybrid) theo phân loại của Burke (2002).
α_u = n/(n+k) là dạng co rút (shrinkage) quen thuộc — khách càng nhiều lịch sử
thì càng tin CF; áp nó vào trọng số hybrid là lựa chọn thiết kế của đồ án, và k
được chọn trên tập validation (evaluation/benchmark.py), không đặt tay.

  k = 0        -> khách đã mua dùng thuần CF, khách mới dùng thuần content-based
  k = inf      -> thuần content-based
  γ = 0        -> món đã mua chỉ lên top nhờ điểm nội dung
  allow_repeat -> False thì loại hẳn món đã mua (hành vi CF cũ)

Hoà điểm (thường gặp: khách lạ không có tín hiệu nào) được phá theo độ phổ biến
đã giảm theo thời gian, rồi CatalogSold, rồi ProductID — kết quả luôn tất định.

Tài liệu:
  Sarwar, B., Karypis, G., Konstan, J., & Riedl, J. (2001). Item-based
    collaborative filtering recommendation algorithms. WWW '01, 285–295.
  Burke, R. (2002). Hybrid recommender systems: Survey and experiments.
    User Modeling and User-Adapted Interaction, 12(4), 331–370.
  Anderson, A., Kumar, R., Tomkins, A., & Vassilvitskii, S. (2014). The dynamics
    of repeat consumption. WWW '14, 419–430.
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from models.cf_recommendation import CollaborativeFiltering, SparseUserItemMatrix
from models.content_based import ContentBasedModel
from models.repeat import RepeatModel

ARTIFACT_FORMAT = 1

REASON_CF = "cf"            # khách giống bạn cũng mua
REASON_CONTENT = "content"  # hợp danh mục/hãng/tầm giá bạn hay mua hoặc đã chọn
REASON_REPEAT = "repeat"    # bạn từng mua món này
REASON_POPULAR = "popular"  # không có tín hiệu riêng — món bán chạy


@dataclass(frozen=True)
class HybridParams:
    cf_shrink_k: float = 5.0
    repeat_weight: float = 0.5
    allow_repeat: bool = True

    def alpha(self, n_items: int) -> float:
        if n_items <= 0:
            return 0.0
        if math.isinf(self.cf_shrink_k):
            return 0.0
        return n_items / (n_items + self.cf_shrink_k)


def _unit_max(x: np.ndarray) -> np.ndarray:
    m = float(x.max()) if x.size else 0.0
    return x / m if m > 0 else x


def cf_interactions(cf: CollaborativeFiltering) -> pd.DataFrame:
    """Ma trận user-item của CF (đã giảm theo thời gian) ở dạng dài cho content-based."""
    uim = cf.user_item_matrix
    if not isinstance(uim, SparseUserItemMatrix):
        return pd.DataFrame(columns=["CustomerID", "ProductID", "Weight"])
    coo = uim.mat.tocoo()
    return pd.DataFrame({
        "CustomerID": uim.index[coo.row].astype(str),
        "ProductID": uim.columns[coo.col].astype(str),
        "Weight": coo.data.astype(np.float32),
    })


class HybridRecommender:
    """Gói một bản train hoàn chỉnh: CF + content-based + tham số trộn."""

    def __init__(
        self,
        cf: CollaborativeFiltering,
        cb: ContentBasedModel | None,
        params: HybridParams,
        repeat: RepeatModel | None = None,
    ) -> None:
        if not isinstance(cf.user_item_matrix, SparseUserItemMatrix):
            raise ValueError("HybridRecommender cần CF đã fit trên ma trận thưa.")
        self.cf = cf
        self.params = params
        self.repeat = repeat
        # Không có đặc trưng (dbt chưa dựng bảng, ClickHouse lỗi) thì chạy thuần
        # CF trên catalog của CF — không lọc được "không quan tâm", và health báo ra.
        self.cb = cb if cb is not None and len(cb.item_ids) else None

        if self.cb is not None:
            # Ứng viên = món đang bán có đặc trưng. Món CF biết nhưng không còn
            # trong bảng đặc trưng (đã ngừng bán) bị loại luôn.
            self.item_ids = self.cb.item_ids
            catalog_sold = self.cb.catalog_sold
        else:
            self.item_ids = pd.Index(cf.profile.columns, dtype="string")
            catalog_sold = np.zeros(len(self.item_ids), dtype=np.float32)
        pos = {pid: i for i, pid in enumerate(self.item_ids)}
        self._pos = pos
        n = len(self.item_ids)

        # Cột j của ma trận HỒ SƠ (kênh CF) / ma trận MUA -> chỉ số ứng viên (-1 nếu
        # không còn là ứng viên). Tắt hành vi phụ thì hai ma trận là một.
        self._cf_to_cand = np.array([pos.get(str(p), -1) for p in cf.profile.columns], dtype=np.int64)
        self._buy_to_cand = np.array([pos.get(str(p), -1) for p in cf.user_item_matrix.columns], dtype=np.int64)

        popularity = np.zeros(n, dtype=np.float64)
        if cf.popular_items is not None:
            for pid, value in cf.popular_items.items():
                i = pos.get(str(pid))
                if i is not None:
                    popularity[i] = float(value)

        # Thứ hạng phá hoà, tính một lần: phổ biến giảm dần, CatalogSold giảm
        # dần, rồi theo thứ tự ProductID (item_ids đã sắp sẵn).
        order = np.lexsort((np.arange(n), -catalog_sold, -popularity))
        self._tiebreak = np.empty(n, dtype=np.int64)
        self._tiebreak[order] = np.arange(n)

    # ── Các kênh điểm ────────────────────────────────────────────────────

    def _cf_and_repeat(self, customer_id: str) -> tuple[np.ndarray, np.ndarray, np.ndarray, int]:
        n = len(self.item_ids)
        cf_hat = np.zeros(n, dtype=np.float32)
        rep_hat = np.zeros(n, dtype=np.float32)
        purchased = np.zeros(n, dtype=bool)

        # getattr: artifact lưu trước khi có kênh này không mang thuộc tính repeat
        repeat = getattr(self, "repeat", None)
        cid = str(customer_id)

        # Kênh CF — từ ma trận HỒ SƠ (mua + hành vi phụ nếu bật)
        profile = self.cf.profile
        pidx = profile._user_map.get(cid)
        n_u = 0
        if pidx is not None:
            prow = profile.mat[pidx]
            norm = self.cf.item_similarity.item_user_norm
            scores = np.asarray(norm.dot(norm[prow.indices].T.dot(prow.data))).ravel()
            mapped = self._cf_to_cand >= 0
            cf_hat[self._cf_to_cand[mapped]] = scores[mapped]
            n_u = len(prow.indices)

        # Tập ĐÃ MUA — chỉ từ đơn, không bao giờ từ hành vi
        uim = self.cf.user_item_matrix
        uidx = uim._user_map.get(cid)
        if uidx is not None:
            row = uim.mat[uidx]
            cand = self._buy_to_cand[row.indices]
            keep = cand >= 0
            purchased[cand[keep]] = True
            if repeat is None:
                rep_hat[cand[keep]] = row.data[keep]

        if repeat is not None:
            # Phủ cả món dưới ngưỡng số người mua của CF (không có trong ma trận
            # CF) — ngưỡng đó là chuyện của cosine, không phải của mua lại.
            items, values = repeat.scores(cid)
            idx = np.fromiter((self._pos.get(str(p), -1) for p in items), dtype=np.int64, count=len(items))
            keep = idx >= 0
            rep_hat[idx[keep]] = values[keep]
            purchased[idx[keep]] = True

        # CF là kênh KHÁM PHÁ: món đã mua để kênh mua lại lo. Món đã XEM mà chưa mua
        # vẫn giữ điểm — đó là ứng viên tốt nhất, không được loại.
        cf_hat[purchased] = 0.0
        return _unit_max(cf_hat), _unit_max(rep_hat), purchased, n_u

    def components(self, customer_id: str) -> dict[str, np.ndarray | int]:
        """Các kênh điểm CHƯA nhân trọng số (mỗi kênh đã về [0, 1]).

        Tách khỏi rank() để benchmark tính một lần mỗi khách rồi thử nhiều bộ
        (k, γ) mà không tính lại CF — và để production với benchmark dùng CHUNG
        một đường xếp hạng.
        """
        cid = str(customer_id)
        cf_hat, rep_hat, purchased, n_u = self._cf_and_repeat(cid)
        if self.cb is not None:
            cb_hat = _unit_max(self.cb.score(cid))
            blocked = self.cb.blocked_mask(cid)
        else:
            cb_hat = np.zeros(len(self.item_ids), dtype=np.float32)
            blocked = np.zeros(len(self.item_ids), dtype=bool)
        return {
            "cf": cf_hat, "cb": cb_hat, "repeat": rep_hat,
            "purchased": purchased, "blocked": blocked, "n_items": n_u,
        }

    def rank(
        self, comp: dict[str, np.ndarray | int], params: HybridParams, top_k: int,
    ) -> list[tuple[str, float, str]]:
        """Trộn các kênh theo params, lọc, xếp hạng -> top-K (product_id, điểm, lý do)."""
        if top_k < 1:
            raise ValueError("top_k must be at least 1.")
        alpha = params.alpha(int(comp["n_items"]))
        w_cf = alpha * comp["cf"]
        w_cb = (1.0 - alpha) * comp["cb"]
        w_rep = params.repeat_weight * comp["repeat"]
        final = w_cf + w_cb + w_rep

        exclude = comp["blocked"].copy()
        if not params.allow_repeat:
            exclude |= comp["purchased"]

        order = np.lexsort((self._tiebreak, -final))
        order = order[~exclude[order]][:top_k]

        parts = np.vstack([w_cf[order], w_cb[order], w_rep[order]])
        labels = (REASON_CF, REASON_CONTENT, REASON_REPEAT)
        return [
            (str(self.item_ids[i]), float(final[i]),
             labels[int(parts[:, col].argmax())] if final[i] > 0 else REASON_POPULAR)
            for col, i in enumerate(order)
        ]

    # ── Gợi ý ────────────────────────────────────────────────────────────

    def recommend(self, customer_id: str, top_k: int = 10) -> list[tuple[str, float, str]]:
        """Top-K (product_id, điểm, lý do) cho một khách, theo tham số của bản này."""
        return self.rank(self.components(customer_id), self.params, top_k)

    def known_customers(self) -> list[str]:
        """Khách có tín hiệu riêng (đã mua hoặc đã làm onboarding) — đáng tính sẵn."""
        users = set(map(str, self.cf.user_item_matrix.index)) | set(map(str, self.cf.profile.index))
        if self.cb is not None:
            users |= self.cb.onboarded_customers
        repeat = getattr(self, "repeat", None)
        if repeat is not None:
            users |= repeat.customers()
        return sorted(users)

    def summary(self) -> dict[str, int]:
        stats = dict(self.cf.summary())
        stats["candidates"] = len(self.item_ids)
        stats["onboarded_customers"] = len(self.cb.onboarded_customers) if self.cb else 0
        stats["content_based"] = int(self.cb is not None)
        repeat = getattr(self, "repeat", None)
        stats["repeat_model"] = int(repeat is not None)
        stats["behavior"] = int(getattr(self.cf, "behavior", None) is not None and self.cf.behavior.enabled
                                and stats.get("behavior_pairs", 0) > 0)
        return stats

    # ── Lưu / nạp ────────────────────────────────────────────────────────

    def save(self, path: Path) -> Path:
        """Ghi file tạm rồi os.replace — đổi tên là nguyên tử trên cùng hệ tệp,
        tiến trình chết giữa chừng không để lại file cụt ở đường dẫn thật."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        joblib.dump({"format_version": ARTIFACT_FORMAT, "recommender": self}, tmp, compress=3)
        os.replace(tmp, path)
        return path

    @staticmethod
    def load(path: Path) -> "HybridRecommender":
        payload = joblib.load(Path(path))
        if payload.get("format_version") != ARTIFACT_FORMAT:
            raise ValueError(f"Unsupported hybrid artifact format: {payload.get('format_version')}")
        return payload["recommender"]


def build_recommender(
    cf: CollaborativeFiltering,
    features: pd.DataFrame | None,
    signals: pd.DataFrame | None,
    params: HybridParams,
    onboarding_pseudo_count: float = 1.0,
    purchase_events: pd.DataFrame | None = None,
    category_half_life: dict[str, float] | None = None,
) -> HybridRecommender:
    """CF đã fit + bảng đặc trưng + tín hiệu onboarding (+ lịch sử mua theo đơn)
    -> một bản hybrid hoàn chỉnh.

    purchase_events None/rỗng -> kênh mua lại theo cách cũ (trọng số ma trận CF).
    Half-life của kênh mua lại dùng CHUNG half-life của CF đã fit, trừ khi có
    category_half_life (dict ParentCategory -> half-life) thì dùng riêng từng danh mục.
    """
    cb = None
    if features is not None and not features.empty:
        cb = ContentBasedModel(onboarding_pseudo_count=onboarding_pseudo_count).fit(
            features, interactions=cf_interactions(cf), signals=signals
        )
    repeat = None
    if purchase_events is not None and not purchase_events.empty:
        repeat = RepeatModel(
            cf.resolved_half_life(),
            category_half_life=category_half_life,
        ).fit(purchase_events)
    return HybridRecommender(cf, cb, params, repeat)
