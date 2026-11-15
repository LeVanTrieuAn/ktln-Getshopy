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

Đơn mua SAU lần train (12/11/2026, xem live_purchases): bản train chạy mỗi ngày một
lần, nên đơn trong ngày chưa có trong hồ sơ khách. Item-based CF tách hai phần —
độ tương đồng món–món học offline, hồ sơ khách chỉ là vector đầu vào lúc suy luận
(Sarwar et al., 2001; Linden et al., 2003) — nên ghép món vừa mua vào hồ sơ rồi
nhân với ma trận đã train là đủ, không train lại. Phần duy nhất còn cũ là độ tương
đồng (thiếu các lượt đồng mua trong ngày) cho tới lượt train kế tiếp.

Tài liệu:
  Sarwar, B., Karypis, G., Konstan, J., & Riedl, J. (2001). Item-based
    collaborative filtering recommendation algorithms. WWW '01, 285–295.
  Linden, G., Smith, B., & York, J. (2003). Amazon.com recommendations:
    Item-to-item collaborative filtering. IEEE Internet Computing, 7(1), 76–80.
  Burke, R. (2002). Hybrid recommender systems: Survey and experiments.
    User Modeling and User-Adapted Interaction, 12(4), 331–370.
  Anderson, A., Kumar, R., Tomkins, A., & Vassilvitskii, S. (2014). The dynamics
    of repeat consumption. WWW '14, 419–430.
"""

from __future__ import annotations

import math
import os
from collections.abc import Iterable
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


@dataclass(frozen=True)
class LivePurchases:
    """Phần của danh sách "đã mua" và hành vi gửi lúc gọi mà bản train CHƯA biết (12/11/2026, 15/11/2026).

    Chỉ chứa phần MỚI: món bản train đã có thì giữ nguyên trọng số đã học. Lý do —
    server chỉ gửi mã món (không kèm ngày, số lượng), nên với món đã có trong hồ sơ
    không biết khách có mua thêm hôm nay hay không; ghi đè thì làm hỏng trọng số đã
    giảm theo thời gian. Cũng vì thế danh sách chỉ CỘNG vào hồ sơ, không bao giờ bớt:
    server gửi N món gần nhất, món cũ vắng mặt không có nghĩa là đã huỷ.
    """

    cf_cols: np.ndarray   # cột ma trận HỒ SƠ (không gian món của CF) thêm vào hồ sơ khách
    cf_weight: float      # trọng số mặc định — CollaborativeFiltering.fresh_purchase_weight
    cand: np.ndarray      # chỉ số ứng viên của món mua mới -> đánh dấu đã mua
    rep: np.ndarray       # điểm kênh mua lại của từng món trong cand
    unknown: int = 0      # số mã không thuộc CF lẫn tập ứng viên — bị bỏ qua
    cf_weights: np.ndarray | None = None  # trọng số riêng cho từng cột nếu khác nhau (hành vi)

    @property
    def empty(self) -> bool:
        """Không có gì ngoài bản train -> kết quả trùng hẳn đường GET (dùng được cache)."""
        return self.cf_cols.size == 0 and self.cand.size == 0


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

    # ── Đơn mua sau lần train ────────────────────────────────────────────

    def _trained_purchases(self, cid: str) -> set[str]:
        """Mã món bản train đã coi là ĐÃ MUA — cùng hai nguồn với mặt nạ purchased."""
        known: set[str] = set()
        uim = self.cf.user_item_matrix
        uidx = uim._user_map.get(cid)
        if uidx is not None:
            known.update(map(str, uim.columns[uim.mat[uidx].indices]))
        repeat = getattr(self, "repeat", None)
        if repeat is not None:
            known.update(map(str, repeat.scores(cid)[0]))
        return known

    def live_purchases(self, customer_id: str, product_ids: Iterable[str]) -> LivePurchases:
        """Tách danh sách món khách đã mua (gửi lúc gọi) thành phần bản train chưa biết.

        12/11/2026. Ba chỗ dùng, mỗi chỗ tái hiện đúng thứ lượt train tối nay sẽ dựng
        cho khách này (test_realtime kiểm đúng điều đó):

        1. Hồ sơ CF: món thuộc không gian món của CF mà hồ sơ chưa có, trọng số
           fresh_purchase_weight() = log1p(1) ở thang log — một cái, cách 0 ngày. Giả
           định 1 cái vì chỉ có mã món; thang log làm sai số nhỏ (2 cái: log1p(2) = 1,10
           so với 0,69). Món ngoài không gian CF (món mới tinh, món dưới ngưỡng số người
           mua) bị bỏ qua ở kênh này: không có cột nào trong ma trận tương đồng để nhân.
        2. Tập đã mua: món ứng viên chưa nằm trong tập đã mua của bản train -> đánh dấu
           đã mua, để CF (kênh khám phá) không gợi ý lại và allow_repeat = False loại hẳn.
        3. Kênh mua lại: đúng điểm lượt train sẽ cho món đó — order_freq: một đơn hôm
           nay = 0,5^(0/half_life) = 1 (mọi half-life, kể cả theo danh mục); cf_weight:
           trọng số ma trận mua, chỉ có với món thuộc ma trận mua như lúc train.

        Content-based KHÔNG ghép: hồ sơ CB lấy lịch sử từ chính ma trận CF (cf_interactions),
        nên món ngoài không gian CF cũng không vào CB khi train lại; còn món trong không
        gian CF thì n_u >= 1, và với k = 0 đang chạy (config.HYBRID_CF_SHRINK_K, chọn trên
        validation) α = 1 -> trọng số CB = 0. Với k = 0 bỏ qua CB cho ra ĐÚNG thứ hạng như
        có ghép; chỉ k > 0 mới lệch.
        """
        cid = str(customer_id)
        ids = [p for p in dict.fromkeys(str(x).strip() for x in product_ids) if p]

        profile = self.cf.profile
        pidx = profile._user_map.get(cid)
        have = set(profile.mat[pidx].indices.tolist()) if pidx is not None else set()
        cf_cols: list[int] = []
        for p in ids:
            j = profile._item_map.get(p)
            if j is not None and j not in have:
                have.add(j)
                cf_cols.append(j)

        weight = self.cf.fresh_purchase_weight()
        known = self._trained_purchases(cid)
        repeat = getattr(self, "repeat", None)
        bought_space = self.cf.user_item_matrix._item_map
        cand: list[int] = []
        rep: list[float] = []
        for p in ids:
            i = self._pos.get(p)
            if i is None or p in known:
                continue
            cand.append(i)
            if repeat is not None:
                rep.append(1.0)
            else:
                rep.append(weight if p in bought_space else 0.0)

        unknown = sum(1 for p in ids if p not in profile._item_map and p not in self._pos)
        return LivePurchases(
            cf_cols=np.asarray(cf_cols, dtype=np.int64),
            cf_weight=weight,
            cand=np.asarray(cand, dtype=np.int64),
            rep=np.asarray(rep, dtype=np.float32),
            unknown=unknown,
        )

    def live_interactions(
        self,
        customer_id: str,
        purchased_product_ids: Iterable[str] = (),
        interactions: Iterable[object] = (),
    ) -> LivePurchases:
        """Tách danh sách mua và hành vi gửi lúc gọi thành phần bản train chưa biết (15/11/2026).

        Kế thừa toàn bộ logic của live_purchases cho phần đơn mua, và bổ sung:
        1. Tín hiệu hành vi trong phiên (view, cart, wish):
           - Tính trọng số thô:
             - view (product_view): view_weight * (min(dwell, 600) / 60) nếu dwell > 0, ngược lại view_weight
             - cart (add_to_cart): cart_weight
             - wish (add_to_wishlist): wish_weight
             - purchase: 1.0 (và đánh dấu đã mua)
           - Nếu một món có nhiều tương tác: cộng dồn trọng số thô
           - Chuyển sang thang của model: log1p(w_raw) nếu log, ngược lại w_raw
           - Đưa vào hồ sơ CF (cf_cols và cf_weights) để kích hoạt gợi ý các món tương quan.
           - KHÔNG đưa vào cand loại trừ (món đã xem/bỏ giỏ vẫn được gợi ý lại).
           - KHÔNG đưa vào kênh mua lại rep (rep chỉ dành cho đơn mua thật).
        2. Đơn mua (purchased_product_ids):
           - Đưa vào cf_cols với fresh_purchase_weight
           - Đưa vào cand đánh dấu đã mua (để loại trừ nếu allow_repeat = False)
           - Đưa vào rep (kênh mua lại)
        """
        cid = str(customer_id)
        purchased_ids = [p for p in dict.fromkeys(str(x).strip() for x in purchased_product_ids) if p]

        profile = self.cf.profile
        pidx = profile._user_map.get(cid)
        have = set(profile.mat[pidx].indices.tolist()) if pidx is not None else set()

        from models.behavior import BehaviorConfig
        beh = getattr(self.cf, "behavior", None)
        beh = beh if isinstance(beh, BehaviorConfig) else BehaviorConfig()
        w_view = getattr(beh, "view_weight", 0.25)
        w_cart = getattr(beh, "cart_weight", 1.0)
        w_wish = getattr(beh, "wish_weight", 0.5)

        raw_weights: dict[str, float] = {}
        all_purchased_ids: set[str] = set(purchased_ids)

        for p in purchased_ids:
            if p:
                raw_weights[p] = raw_weights.get(p, 0.0) + 1.0

        for item in interactions:
            if isinstance(item, dict):
                pid = str(item.get("product_id", "")).strip()
                etype = str(item.get("event_type", "")).strip().lower()
                dwell = item.get("dwell_seconds")
            else:
                pid = str(getattr(item, "product_id", "")).strip()
                etype = str(getattr(item, "event_type", "")).strip().lower()
                dwell = getattr(item, "dwell_seconds", None)

            if not pid:
                continue

            if etype in ("purchase",):
                raw_weights[pid] = raw_weights.get(pid, 0.0) + 1.0
                all_purchased_ids.add(pid)
            elif etype in ("cart", "add_to_cart"):
                raw_weights[pid] = raw_weights.get(pid, 0.0) + w_cart
            elif etype in ("wish", "add_to_wishlist", "wishlist"):
                raw_weights[pid] = raw_weights.get(pid, 0.0) + w_wish
            elif etype in ("view", "product_view"):
                if dwell is not None and float(dwell) > 0:
                    d_sec = min(float(dwell), 600.0)
                    w_v = w_view * (d_sec / 60.0)
                else:
                    w_v = w_view
                raw_weights[pid] = raw_weights.get(pid, 0.0) + w_v

        scale = getattr(self.cf, "input_scale", "linear")
        if scale is None:
            scale = self.cf.resolved_input_scale()

        cf_cols: list[int] = []
        cf_weights: list[float] = []

        for p, r_w in raw_weights.items():
            j = profile._item_map.get(p)
            if j is not None and j not in have:
                scaled_w = float(np.log1p(r_w)) if scale == "log" else float(r_w)
                cf_cols.append(j)
                cf_weights.append(scaled_w)

        known = self._trained_purchases(cid)
        repeat = getattr(self, "repeat", None)
        bought_space = self.cf.user_item_matrix._item_map
        cand: list[int] = []
        rep: list[float] = []
        weight_purchase = self.cf.fresh_purchase_weight()

        for p in all_purchased_ids:
            i = self._pos.get(p)
            if i is None or p in known:
                continue
            cand.append(i)
            if repeat is not None:
                rep.append(1.0)
            else:
                rep.append(weight_purchase if p in bought_space else 0.0)

        all_seen_keys = set(raw_weights.keys())
        unknown = sum(1 for p in all_seen_keys if p not in profile._item_map and p not in self._pos)

        return LivePurchases(
            cf_cols=np.asarray(cf_cols, dtype=np.int64),
            cf_weight=weight_purchase,
            cand=np.asarray(cand, dtype=np.int64),
            rep=np.asarray(rep, dtype=np.float32),
            unknown=unknown,
            cf_weights=np.asarray(cf_weights, dtype=np.float32) if cf_weights else None,
        )

    @staticmethod
    def _profile_vector(
        profile: SparseUserItemMatrix, pidx: int | None, live: LivePurchases | None,
    ) -> tuple[np.ndarray | None, np.ndarray | None]:
        """(cột, trọng số) hồ sơ CF: hàng đã train, nối thêm món mua sau lần train.

        Không có phần mới thì trả NGUYÊN hai mảng của hàng đã train — đường GET tính
        đúng như trước, từng phép cộng.
        """
        cols = vals = None
        if pidx is not None:
            prow = profile.mat[pidx]
            cols, vals = prow.indices, prow.data
        if live is not None and live.cf_cols.size:
            if getattr(live, "cf_weights", None) is not None and live.cf_weights.size == live.cf_cols.size:
                extra = live.cf_weights.astype(np.float32)
            else:
                extra = np.full(live.cf_cols.size, live.cf_weight, dtype=np.float32)
            cols = live.cf_cols if cols is None else np.concatenate([cols, live.cf_cols])
            vals = extra if vals is None else np.concatenate([vals, extra])
        return cols, vals

    # ── Các kênh điểm ────────────────────────────────────────────────────

    def _cf_and_repeat(
        self, customer_id: str, live: LivePurchases | None = None,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, int]:
        n = len(self.item_ids)
        cf_hat = np.zeros(n, dtype=np.float32)
        rep_hat = np.zeros(n, dtype=np.float32)
        purchased = np.zeros(n, dtype=bool)

        # getattr: artifact lưu trước khi có kênh này không mang thuộc tính repeat
        repeat = getattr(self, "repeat", None)
        cid = str(customer_id)

        # Kênh CF — từ ma trận HỒ SƠ (mua + hành vi phụ nếu bật), cộng đơn sau lần train
        profile = self.cf.profile
        pidx = profile._user_map.get(cid)
        cols, vals = self._profile_vector(profile, pidx, live)
        n_u = 0
        if cols is not None:
            norm = self.cf.item_similarity.item_user_norm
            scores = np.asarray(norm.dot(norm[cols].T.dot(vals))).ravel()
            mapped = self._cf_to_cand >= 0
            cf_hat[self._cf_to_cand[mapped]] = scores[mapped]
            n_u = len(cols)

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

        if live is not None and live.cand.size:
            # Món mua sau lần train: cùng ngữ nghĩa với món đã mua của bản train — CF
            # thôi chấm, kênh mua lại nhận đúng điểm lượt train tối nay sẽ cho (xem
            # live_purchases). cand chỉ gồm món bản train CHƯA coi là đã mua, nên
            # không đè lên điểm mua lại đã học.
            purchased[live.cand] = True
            rep_hat[live.cand] = live.rep

        # CF là kênh KHÁM PHÁ: món đã mua để kênh mua lại lo. Món đã XEM mà chưa mua
        # vẫn giữ điểm — đó là ứng viên tốt nhất, không được loại.
        cf_hat[purchased] = 0.0
        return _unit_max(cf_hat), _unit_max(rep_hat), purchased, n_u

    def components(
        self, customer_id: str, live: LivePurchases | None = None,
    ) -> dict[str, np.ndarray | int]:
        """Các kênh điểm CHƯA nhân trọng số (mỗi kênh đã về [0, 1]).

        Tách khỏi rank() để benchmark tính một lần mỗi khách rồi thử nhiều bộ
        (k, γ) mà không tính lại CF — và để production với benchmark dùng CHUNG
        một đường xếp hạng.

        live: đơn mua sau lần train (live_purchases) — None là đường cũ, y nguyên.
        """
        cid = str(customer_id)
        cf_hat, rep_hat, purchased, n_u = self._cf_and_repeat(cid, live)
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

    def recommend(
        self, customer_id: str, top_k: int = 10, live: LivePurchases | None = None,
    ) -> list[tuple[str, float, str]]:
        """Top-K (product_id, điểm, lý do) cho một khách, theo tham số của bản này.

        live: đơn mua sau lần train (live_purchases); None = chỉ những gì bản train biết.
        """
        return self.rank(self.components(customer_id, live), self.params, top_k)

    def recommend_live(
        self, customer_id: str, product_ids: Iterable[str], top_k: int = 10,
    ) -> list[tuple[str, float, str]]:
        """recommend() có tính cả danh sách món khách đã mua tới lúc gọi."""
        return self.recommend(customer_id, top_k, self.live_purchases(customer_id, product_ids))

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
