"""Kênh mua lại: tần suất đơn đã giảm theo thời gian.

    rep(u, i) = Σ_{đơn o của u có món i}  0,5^(ngày_o / half_life)

Mỗi LẦN MUA được đếm và già đi riêng. Kênh cũ lấy tổng số lượng nhân độ gần đây
của lần mua CUỐI, nên một đơn sỉ 5 cái nặng hơn ba lần mua lẻ gần đây — ngược với
thứ tự một khách thực sự hay mua lại. Tần suất và độ gần đây là hai tín hiệu mạnh
nhất của việc mua lặp lại (Anderson et al., 2014; Bhagat et al., 2018). Có
chọn kênh này hay kênh cũ là do benchmark quyết trên validation — kết quả ở
evaluation/README.md.

Không lọc ngưỡng số người mua như CF: ngưỡng đó chống cosine bị thổi lên ở món ít
người mua, còn điểm mua lại chỉ phụ thuộc lịch sử của chính khách.

Tài liệu:
  Anderson, A., Kumar, R., Tomkins, A., & Vassilvitskii, S. (2014). The dynamics
    of repeat consumption. WWW '14, 419–430.
  Bhagat, R., Muralidharan, S., Lobzhanidze, A., & Vishwanath, S. (2018). Buy It
    Again: Modeling repeat purchase recommendations. KDD '18, 62–70.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

REQUIRED_COLUMNS = ("CustomerID", "ProductID", "DaysSince")


class RepeatModel:
    """Điểm mua lại theo khách, dựng từ lịch sử mua ở mức ĐƠN."""

    def __init__(self, half_life_days: float) -> None:
        self.half_life_days = float(half_life_days)
        self._items: dict[str, np.ndarray] = {}
        self._scores: dict[str, np.ndarray] = {}

    def fit(self, events: pd.DataFrame) -> "RepeatModel":
        """events: một dòng cho mỗi (khách, món, đơn) — CustomerID, ProductID, DaysSince.

        Một đơn có hai dòng cùng món (tách dòng khi nhập) vẫn chỉ là một lần mua,
        nên nguồn phải gom theo đơn trước; ở đây không có OrderID để gom lại.
        """
        missing = [c for c in REQUIRED_COLUMNS if c not in events.columns]
        if missing:
            raise ValueError(f"Lịch sử mua thiếu cột: {missing}")
        df = events.dropna(subset=list(REQUIRED_COLUMNS)).assign(
            CustomerID=lambda d: d["CustomerID"].astype(str),
            ProductID=lambda d: d["ProductID"].astype(str),
            DaysSince=lambda d: pd.to_numeric(d["DaysSince"], errors="coerce").fillna(0).clip(lower=0),
        )
        hl = self.half_life_days
        # half-life <= 0: tắt giảm theo thời gian -> đếm số đơn
        df["w"] = 0.5 ** (df["DaysSince"] / hl) if hl > 0 else 1.0
        scores = df.groupby(["CustomerID", "ProductID"], sort=True)["w"].sum()

        self._items, self._scores = {}, {}
        for cid, group in scores.groupby(level=0, sort=False):
            self._items[cid] = group.index.get_level_values(1).to_numpy(dtype=object)
            self._scores[cid] = group.to_numpy(dtype=np.float64)
        return self

    def scores(self, customer_id: str) -> tuple[np.ndarray, np.ndarray]:
        """(mã món, điểm) của các món khách đã mua. Khách lạ -> hai mảng rỗng."""
        cid = str(customer_id)
        if cid not in self._items:
            return np.empty(0, dtype=object), np.empty(0, dtype=np.float64)
        return self._items[cid], self._scores[cid]

    def customers(self) -> set[str]:
        return set(self._items)

    def summary(self) -> dict[str, int]:
        return {
            "repeat_customers": len(self._items),
            "repeat_pairs": int(sum(len(v) for v in self._items.values())),
        }
