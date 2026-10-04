"""Kênh mua lại theo đơn, thang/half-life của CF, và luật chọn của benchmark."""

from __future__ import annotations

import math
import unittest

import numpy as np
import pandas as pd

from models.cf_recommendation import CollaborativeFiltering
from models.hybrid import HybridParams, build_recommender
from models.repeat import RepeatModel

FEATURES = pd.DataFrame(
    [
        ("A", "cat-phone", "br-apple", "15to30", 5),
        ("B", "cat-phone", "br-apple", "15to30", 4),
        ("C", "cat-av", "br-sony-audio", "lt5", 3),
        ("D", "cat-av", "br-sony-audio", "lt5", 2),
        ("E", "cat-laptop", "br-dell", "gt30", 1),
    ],
    columns=["ProductID", "ParentCategory", "Brand", "PriceBand", "CatalogSold"],
)

# U1 mua A một lần 5 cái, mua B ba lần mỗi lần 1 cái. U2, U3 cho CF có cấu trúc.
PAIRS = pd.DataFrame(
    [
        ("U1", "A", 5, 0), ("U1", "B", 3, 0),
        ("U2", "A", 1, 0), ("U2", "C", 1, 0),
        ("U3", "B", 1, 0), ("U3", "C", 1, 0), ("U3", "D", 1, 0),
    ],
    columns=["CustomerID", "ProductID", "Quantity", "DaysSince"],
)
# Một dòng cho mỗi (khách, món, đơn). E: U1 mua nhưng KHÔNG có trong tập train CF
# (dưới ngưỡng số người mua) — kênh mua lại vẫn phải thấy.
EVENTS = pd.DataFrame(
    [
        ("U1", "A", 0),
        ("U1", "B", 0), ("U1", "B", 0), ("U1", "B", 0),
        ("U1", "E", 0),
        ("U2", "A", 0), ("U2", "C", 0),
        ("U3", "B", 0), ("U3", "C", 0), ("U3", "D", 0),
    ],
    columns=["CustomerID", "ProductID", "DaysSince"],
)


def cf(**kw) -> CollaborativeFiltering:
    return CollaborativeFiltering(half_life_days=kw.pop("half_life_days", 30.0),
                                  input_scale=kw.pop("input_scale", "linear")).fit(PAIRS)


class CFConfigTests(unittest.TestCase):
    def weight(self, model: CollaborativeFiltering, cid: str, pid: str) -> float:
        return float(model.user_item_matrix.loc[cid, pid])

    def test_log_scale_compresses_quantity(self) -> None:
        lin = cf(input_scale="linear")
        log = cf(input_scale="log")
        self.assertAlmostEqual(self.weight(lin, "U1", "A"), 5.0, places=5)
        self.assertAlmostEqual(self.weight(log, "U1", "A"), math.log1p(5.0), places=5)
        # Tập món đã mua không đổi theo thang
        self.assertEqual(sorted(lin.get_purchased_products("U1")), sorted(log.get_purchased_products("U1")))

    def test_half_life_parameter_overrides_config(self) -> None:
        pairs = PAIRS.assign(DaysSince=[14, 0, 0, 0, 0, 0, 0])
        m7 = CollaborativeFiltering(half_life_days=7.0, input_scale="linear").fit(pairs)
        m14 = CollaborativeFiltering(half_life_days=14.0, input_scale="linear").fit(pairs)
        self.assertAlmostEqual(self.weight(m7, "U1", "A"), 5.0 * 0.25, places=5)
        self.assertAlmostEqual(self.weight(m14, "U1", "A"), 5.0 * 0.5, places=5)
        self.assertEqual(m7.half_life_days, 7.0)

    def test_invalid_scale_rejected(self) -> None:
        with self.assertRaises(ValueError):
            CollaborativeFiltering(input_scale="sqrt")


class RepeatModelTests(unittest.TestCase):
    def test_counts_orders_not_units(self) -> None:
        rm = RepeatModel(half_life_days=30.0).fit(EVENTS)
        items, scores = rm.scores("U1")
        got = dict(zip(items, scores))
        self.assertAlmostEqual(got["B"], 3.0)   # ba đơn
        self.assertAlmostEqual(got["A"], 1.0)   # một đơn, dù 5 cái
        self.assertIn("E", got)

    def test_each_order_decays_separately(self) -> None:
        ev = pd.DataFrame([("U", "X", 0), ("U", "X", 7), ("U", "Y", 14)],
                          columns=["CustomerID", "ProductID", "DaysSince"])
        items, scores = RepeatModel(half_life_days=7.0).fit(ev).scores("U")
        got = dict(zip(items, scores))
        self.assertAlmostEqual(got["X"], 1.0 + 0.5)
        self.assertAlmostEqual(got["Y"], 0.25)

    def test_zero_half_life_counts_orders(self) -> None:
        ev = pd.DataFrame([("U", "X", 100), ("U", "X", 0)], columns=["CustomerID", "ProductID", "DaysSince"])
        _, scores = RepeatModel(half_life_days=0.0).fit(ev).scores("U")
        self.assertEqual(scores.tolist(), [2.0])

    def test_unknown_customer_is_empty(self) -> None:
        items, scores = RepeatModel(30.0).fit(EVENTS).scores("nobody")
        self.assertEqual(len(items), 0)
        self.assertEqual(len(scores), 0)


class HybridRepeatChannelTests(unittest.TestCase):
    REPEAT_ONLY = HybridParams(cf_shrink_k=0.0, repeat_weight=100.0, allow_repeat=True)

    def test_order_frequency_beats_bulk_quantity(self) -> None:
        old = build_recommender(cf(), FEATURES, None, self.REPEAT_ONLY)
        new = build_recommender(cf(), FEATURES, None, self.REPEAT_ONLY, purchase_events=EVENTS)
        # Kênh cũ: A (5 cái) > B (3 cái). Kênh mới: B (3 đơn) > A (1 đơn).
        self.assertEqual([p for p, _, _ in old.recommend("U1", top_k=2)], ["A", "B"])
        self.assertEqual([p for p, _, _ in new.recommend("U1", top_k=2)], ["B", "A"])
        self.assertEqual(new.summary()["repeat_model"], 1)
        self.assertEqual(old.summary()["repeat_model"], 0)

    def test_repeat_covers_items_outside_cf_catalog(self) -> None:
        new = build_recommender(cf(), FEATURES, None, self.REPEAT_ONLY, purchase_events=EVENTS)
        top = new.recommend("U1", top_k=3)
        self.assertIn("E", [p for p, _, _ in top])
        self.assertTrue(all(reason == "repeat" for _, _, reason in top))

    def test_discovery_mode_excludes_every_purchased_item(self) -> None:
        params = HybridParams(cf_shrink_k=0.0, repeat_weight=0.0, allow_repeat=False)
        new = build_recommender(cf(), FEATURES, None, params, purchase_events=EVENTS)
        got = {p for p, _, _ in new.recommend("U1", top_k=5)}
        self.assertFalse({"A", "B", "E"} & got)

    def test_repeat_half_life_follows_cf(self) -> None:
        model = cf(half_life_days=7.0)
        rec = build_recommender(model, FEATURES, None, self.REPEAT_ONLY, purchase_events=EVENTS)
        self.assertEqual(rec.repeat.half_life_days, 7.0)


class BenchmarkSelectionTests(unittest.TestCase):
    def setUp(self) -> None:
        from evaluation import benchmark
        self.bm = benchmark

    def grid(self, rows):
        return pd.DataFrame(rows, columns=["half_life", "scale", "repeat", "allow_repeat", "k", "gamma",
                                           "NDCG", "Recall", "repeat_items"])

    def test_band_rule_ignores_better_configs_outside_band(self) -> None:
        g = self.grid([
            (30.0, "linear", "cf_weight", True, 0.0, 10.0, 0.50, 0.6, 9.0),   # tốt nhất nhưng 9 món cũ
            (7.0, "log", "order_freq", True, 0.0, 1.0, 0.40, 0.5, 2.6),        # trong dải
            (14.0, "log", "order_freq", True, 0.0, 0.5, 0.30, 0.5, 1.0),       # dưới dải
        ])
        picked = self.bm.select_in_band(g, band=(2.0, 3.0))
        self.assertEqual(picked.data, self.bm.DataConfig(7.0, "log", "order_freq"))
        self.assertEqual(picked.params.repeat_weight, 1.0)
        self.assertEqual(self.bm._pick(g).params.repeat_weight, 10.0)   # không ràng buộc

    def test_band_rule_falls_back_to_closest(self) -> None:
        g = self.grid([
            (30.0, "linear", "cf_weight", True, 0.0, 10.0, 0.50, 0.6, 9.0),
            (7.0, "log", "order_freq", True, 0.0, 0.5, 0.30, 0.5, 1.5),
        ])
        picked = self.bm.select_in_band(g, band=(2.0, 3.0))
        self.assertEqual(picked.params.repeat_weight, 0.5)

    def test_purchase_events_frame_one_row_per_order(self) -> None:
        lines = pd.DataFrame(
            [("U", "X", 1, "O1", "2026-09-10 10:00:00"), ("U", "X", 2, "O1", "2026-09-10 10:00:00"),
             ("U", "X", 1, "O2", "2026-09-12 09:00:00")],
            columns=["CustomerID", "ProductID", "Quantity", "OrderID", "OrderDate"],
        ).assign(OrderDate=lambda d: pd.to_datetime(d["OrderDate"]))
        ev = self.bm.purchase_events_frame(lines, pd.Timestamp("2026-09-13 08:00:00"))
        self.assertEqual(sorted(ev["DaysSince"].tolist()), [1, 3])

    def test_strong_baselines_recommend_unseen_items(self) -> None:
        from evaluation.strong_baselines import EASE, IALS
        model = cf()
        for rec in (EASE(model, lam=1.0), IALS(model, factors=2, alpha=1.0, reg=0.1, iterations=3)):
            out = rec.recommend("U2", 2)
            self.assertEqual(len(out), 2)
            self.assertFalse({"A", "C"} & set(out))
        self.assertTrue(np.isfinite(EASE(model, lam=1.0).S).all())


if __name__ == "__main__":
    unittest.main()
