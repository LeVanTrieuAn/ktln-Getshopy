"""Tín hiệu hành vi phụ (xem, thời gian xem, giỏ, yêu thích) cho ma trận hồ sơ của CF.

    s_ui = [ w_view · f(xem) + w_cart · giỏ + w_wish · yêu_thích ] · 0,5^(ngày / half_life)
    f(xem) = số lượt xem                    (mode "count")
           = tổng phút xem, mỗi lượt ≤ 10'   (mode "dwell", "dwell+cart")

Ý tưởng — học đa hành vi: lượt xem nhiều hơn lượt mua cả bậc độ lớn, nên thêm chúng làm
ma trận CF dày hơn và phủ cả món chưa ai mua (Hu et al., 2008 — tín hiệu ngầm có độ tin
cậy; Gao et al., 2019 — dùng hành vi phụ để dự đoán mua). Dwell thay cho số lượt vì lượt
xem ngắn thường là bấm nhầm (Yi et al., 2014).

Tín hiệu hành vi CHỈ đi vào ma trận HỒ SƠ (độ tương đồng + hồ sơ khách). Tập "đã mua" vẫn
lấy từ đơn: món khách đã xem mà chưa mua phải còn được gợi ý — đó chính là ứng viên tốt.

Lượt xem do CHÍNH ô gợi ý dẫn tới (referrer = recommendation) không được cộng: train lại
trên chúng là vòng tự củng cố (Chaney et al., 2018). Cột ViewsFromRec tách riêng ở nguồn.

Trọng số là siêu tham số — chọn trên validation (evaluation/benchmark.py), không đặt tay.

Tài liệu:
  Chaney, A. J. B., Stewart, B. M., & Engelhardt, B. E. (2018). How algorithmic confounding
    in recommendation systems increases homogeneity and decreases utility. RecSys '18.
  Gao, C., He, X., Gan, D., Chen, X., Feng, F., Li, Y., Chua, T.-S., & Jin, D. (2019).
    Neural multi-task recommendation from multi-behavior data. ICDE '19.
  Hu, Y., Koren, Y., & Volinsky, C. (2008). Collaborative filtering for implicit feedback
    datasets. ICDM '08.
  Yi, X., Hong, L., Zhong, E., Liu, N. N., & Rajan, S. (2014). Beyond clicks: Dwell time for
    personalization. RecSys '14.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

MODES = ("none", "count", "dwell", "dwell+cart")
# Cột nguồn — serving.customer_product_events và benchmark phải ra đúng các cột này
COLUMNS = ("CustomerID", "ProductID", "Views", "DwellSec", "Carts", "Wishlists", "DaysSince")
DWELL_CAP_SEC = 600          # khớp trần 10 phút phía server (BehaviorService)
COUNTED_EVENTS = ("product_view", "add_to_cart", "add_to_wishlist")


@dataclass(frozen=True)
class BehaviorConfig:
    mode: str = "none"
    view_weight: float = 0.5
    cart_weight: float = 1.0
    wish_weight: float = 0.5
    min_users: int = 3        # món CHỈ có hành vi phải có ≥ bấy nhiêu khách, như ngưỡng của CF

    def __post_init__(self) -> None:
        if self.mode not in MODES:
            raise ValueError(f"mode phải thuộc {MODES}, nhận: {self.mode!r}")

    @property
    def enabled(self) -> bool:
        return self.mode != "none"

    def label(self) -> str:
        if not self.enabled:
            return "không"
        extra = f", giỏ {self.cart_weight:g}, yêu thích {self.wish_weight:g}" if self.mode == "dwell+cart" else ""
        return f"{self.mode} × {self.view_weight:g}{extra}"


def aggregate_events(events: pd.DataFrame, cut: pd.Timestamp) -> pd.DataFrame:
    """Sự kiện thô (benchmark) -> đúng các cột của serving.customer_product_events tại `cut`.

    events: CustomerID, ProductID, EventType, EventTime, DwellMs, Referrer
    Chỉ sự kiện TRƯỚC `cut`; bỏ lượt xem do ô gợi ý dẫn tới; dwell mỗi lượt ≤ 10 phút.
    """
    ev = events[(events["EventTime"] < cut) & events["EventType"].isin(COUNTED_EVENTS)]
    ev = ev[ev["CustomerID"].notna() & ev["ProductID"].notna()]
    from_rec = (ev["EventType"] == "product_view") & (ev["Referrer"] == "recommendation")
    ev = ev[~from_rec]
    if ev.empty:
        return pd.DataFrame(columns=list(COLUMNS))
    view = ev["EventType"] == "product_view"
    dwell = pd.to_numeric(ev["DwellMs"], errors="coerce").fillna(0).clip(0, DWELL_CAP_SEC * 1000) / 1000
    g = ev.assign(
        _view=view.astype(int),
        _dwell=np.where(view, dwell, 0.0),
        _cart=(ev["EventType"] == "add_to_cart").astype(int),
        _wish=(ev["EventType"] == "add_to_wishlist").astype(int),
    ).groupby(["CustomerID", "ProductID"], as_index=False).agg(
        Views=("_view", "sum"), DwellSec=("_dwell", "sum"), Carts=("_cart", "sum"),
        Wishlists=("_wish", "sum"), LastEventAt=("EventTime", "max"),
    )
    # = dateDiff('day', LastEventAt, now()) của ClickHouse: số ranh giới ngày
    g["DaysSince"] = (cut.normalize() - g["LastEventAt"].dt.normalize()).dt.days
    return g[list(COLUMNS)]


def signal_weights(frame: pd.DataFrame, cfg: BehaviorConfig, half_life: float,
                   purchase_items: set[str]) -> pd.DataFrame:
    """Hàng (khách, món) -> trọng số tín hiệu đã giảm theo thời gian: CustomerID, ProductID, Weight."""
    if not cfg.enabled or frame is None or frame.empty:
        return pd.DataFrame(columns=["CustomerID", "ProductID", "Weight"])
    df = frame.assign(CustomerID=frame["CustomerID"].astype(str), ProductID=frame["ProductID"].astype(str))
    num = {c: pd.to_numeric(df[c], errors="coerce").fillna(0) for c in ("Views", "DwellSec", "Carts", "Wishlists")}
    if cfg.mode == "count":
        w = cfg.view_weight * num["Views"]
    else:
        w = cfg.view_weight * num["DwellSec"] / 60.0
        if cfg.mode == "dwell+cart":
            w = w + cfg.cart_weight * num["Carts"] + cfg.wish_weight * num["Wishlists"]
    days = pd.to_numeric(df["DaysSince"], errors="coerce").fillna(0).clip(lower=0)
    if half_life > 0:
        w = w * 0.5 ** (days / half_life)
    out = df.assign(Weight=w.astype("float64"))[["CustomerID", "ProductID", "Weight"]]
    out = out[out["Weight"] > 0]
    # Món CHƯA có trong ma trận mua chỉ vào nếu đủ số khách có hành vi (cùng lý do với
    # ngưỡng min_buyers của CF: cosine của món chỉ vài khách bị thổi lên).
    users = out.groupby("ProductID")["CustomerID"].nunique()
    ok = set(users[users >= cfg.min_users].index) | set(purchase_items)
    return out[out["ProductID"].isin(ok)].reset_index(drop=True)
