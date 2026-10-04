"""Tín hiệu hành vi phụ: tổng hợp sự kiện, trọng số, và hai bất biến của ma trận hồ sơ —
món đã xem mà chưa mua vẫn được gợi ý; tắt hành vi thì mọi thứ như cũ."""

from __future__ import annotations

import unittest

import numpy as np
import pandas as pd

from models.behavior import BehaviorConfig, aggregate_events, signal_weights
from models.cf_recommendation import CollaborativeFiltering
from models.hybrid import HybridParams, build_recommender

CUT = pd.Timestamp("2026-09-10 00:00:00")

EVENTS = pd.DataFrame(
    [
        ("U1", "C", "product_view", "2026-09-05 10:00:00", 120_000, "direct"),
        ("U1", "C", "product_view", "2026-09-06 10:00:00", 900_000, "search"),     # dwell > trần 10'
        ("U1", "C", "add_to_cart", "2026-09-06 10:05:00", None, "search"),
        ("U1", "D", "product_view", "2026-09-06 11:00:00", 60_000, "recommendation"),  # do ô gợi ý dẫn tới
        ("U1", "C", "product_view", "2026-09-12 10:00:00", 60_000, "direct"),      # SAU mốc cắt
        ("U1", "C", "purchase", "2026-09-06 10:10:00", None, "direct"),            # không tính
    ],
    columns=["CustomerID", "ProductID", "EventType", "EventTime", "DwellMs", "Referrer"],
).assign(EventTime=lambda d: pd.to_datetime(d["EventTime"]))

# Mua: A–B–C nối nhau qua khách. U4 chưa mua gì.
PAIRS = pd.DataFrame(
    [
        ("U1", "A", 1, 0), ("U2", "A", 1, 0), ("U2", "B", 1, 0), ("U3", "B", 1, 0), ("U3", "C", 1, 0),
        ("U5", "A", 1, 0), ("U5", "C", 1, 0), ("U6", "D", 1, 0), ("U6", "B", 1, 0),
    ],
    columns=["CustomerID", "ProductID", "Quantity", "DaysSince"],
)
BEHAVIOR = pd.DataFrame(
    [
        ("U1", "C", 3, 600.0, 1, 0, 1),     # U1 xem C rất lâu nhưng chưa mua
        ("U4", "B", 2, 240.0, 0, 0, 1),     # U4 chưa có đơn nào, chỉ xem
        ("U4", "C", 1, 60.0, 0, 1, 1),
        ("U7", "E", 1, 30.0, 0, 0, 1),      # E: chỉ 1 khách có hành vi -> dưới ngưỡng
    ],
    columns=["CustomerID", "ProductID", "Views", "DwellSec", "Carts", "Wishlists", "DaysSince"],
)
ON = BehaviorConfig("dwell+cart", view_weight=1.0)


def fit(cfg: BehaviorConfig | None) -> CollaborativeFiltering:
    return CollaborativeFiltering(half_life_days=30.0, input_scale="linear").fit(
        PAIRS, behavior=BEHAVIOR if cfg else None, behavior_cfg=cfg)


class AggregateTests(unittest.TestCase):
    def test_counts_before_cut_excluding_rec_views_and_capping_dwell(self) -> None:
        agg = aggregate_events(EVENTS, CUT).set_index(["CustomerID", "ProductID"])
        c = agg.loc[("U1", "C")]
        self.assertEqual(int(c["Views"]), 2)                       # lượt xem sau mốc cắt bị bỏ
        self.assertAlmostEqual(float(c["DwellSec"]), 120 + 600)   # 900 s bị kẹp về 600 s
        self.assertEqual(int(c["Carts"]), 1)
        self.assertEqual(int(c["DaysSince"]), 4)                  # lần cuối 06/09 -> 10/09
        self.assertNotIn(("U1", "D"), agg.index)                   # chỉ có lượt xem từ ô gợi ý


class SignalWeightTests(unittest.TestCase):
    def test_modes(self) -> None:
        row = BEHAVIOR.iloc[[0]]
        count = signal_weights(row, BehaviorConfig("count", view_weight=0.5), 0.0, {"C"})
        dwell = signal_weights(row, BehaviorConfig("dwell", view_weight=0.5), 0.0, {"C"})
        full = signal_weights(row, BehaviorConfig("dwell+cart", view_weight=0.5, cart_weight=1.0), 0.0, {"C"})
        self.assertAlmostEqual(count["Weight"].iloc[0], 0.5 * 3)
        self.assertAlmostEqual(dwell["Weight"].iloc[0], 0.5 * 10)      # 600 s = 10 phút
        self.assertAlmostEqual(full["Weight"].iloc[0], 0.5 * 10 + 1)

    def test_decay_and_min_users(self) -> None:
        w = signal_weights(BEHAVIOR, BehaviorConfig("count", view_weight=1.0), 1.0, {"A", "B", "C", "D"})
        self.assertAlmostEqual(w.set_index(["CustomerID", "ProductID"]).loc[("U1", "C"), "Weight"], 3 * 0.5)
        self.assertNotIn("E", set(w["ProductID"]))                  # 1 khách < ngưỡng 3

    def test_disabled_is_empty(self) -> None:
        self.assertTrue(signal_weights(BEHAVIOR, BehaviorConfig(), 30.0, {"A"}).empty)


class ProfileMatrixTests(unittest.TestCase):
    def test_disabled_keeps_old_behaviour(self) -> None:
        m = fit(None)
        self.assertIs(m.profile, m.user_item_matrix)
        self.assertEqual(m.recommend("U4", top_k=2), [(p, float(s)) for p, s in m.popular_items.head(2).items()])

    def test_viewed_not_bought_stays_recommendable(self) -> None:
        m = fit(ON)
        self.assertEqual(m.get_purchased_products("U1"), ["A"])   # tập đã mua KHÔNG gồm món chỉ xem
        recs = [p for p, _ in m.recommend("U1", top_k=3)]
        self.assertEqual(recs[0], "C")                             # xem lâu + bỏ giỏ -> đứng đầu
        self.assertNotIn("A", recs)

    def test_behavior_only_customer_gets_cf(self) -> None:
        m = fit(ON)
        recs = m.recommend("U4", top_k=2)
        self.assertNotEqual(recs, [(p, float(s)) for p, s in m.popular_items.head(2).items()])
        self.assertIn("B", [p for p, _ in recs])

    def test_hybrid_uses_profile_but_purchases_for_exclusion(self) -> None:
        cf = fit(ON)
        feats = pd.DataFrame([(p, "cat-x", "br-x", "lt5", 1) for p in "ABCDE"],
                             columns=["ProductID", "ParentCategory", "Brand", "PriceBand", "CatalogSold"])
        rec = build_recommender(cf, feats, None, HybridParams(cf_shrink_k=0.0, repeat_weight=0.0, allow_repeat=False))
        comp = rec.components("U1")
        idx = {p: i for i, p in enumerate(rec.item_ids)}
        self.assertTrue(comp["purchased"][idx["A"]])
        self.assertFalse(comp["purchased"][idx["C"]])
        self.assertGreater(comp["cf"][idx["C"]], 0.0)
        self.assertEqual(rec.recommend("U1", top_k=1)[0][0], "C")
        self.assertEqual(rec.summary()["behavior"], 1)
        # Khách chỉ có hành vi: α dựa trên số món trong HỒ SƠ -> vẫn đi đường CF
        self.assertGreater(int(rec.components("U4")["n_items"]), 0)
        self.assertTrue(np.isfinite(comp["cf"]).all())


if __name__ == "__main__":
    unittest.main()
