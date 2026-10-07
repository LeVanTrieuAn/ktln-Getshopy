from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import math
import unittest

import pandas as pd

from models.cf_recommendation import CollaborativeFiltering
from models.content_based import ContentBasedModel, build_candidates
from models.hybrid import HybridParams, HybridRecommender, build_recommender

# Catalog nhỏ: P1-P3 điện thoại Apple, P4-P5 laptop Dell, P6 tai nghe Sony, P7 điện thoại Samsung
FEATURES = pd.DataFrame(
    [
        ("P1", "cat-phone", "br-apple", "15to30", 10),
        ("P2", "cat-phone", "br-apple", "15to30", 9),
        ("P3", "cat-phone", "br-apple", "gt30", 8),
        ("P4", "cat-laptop", "br-dell", "15to30", 7),
        ("P5", "cat-laptop", "br-dell", "5to15", 6),
        ("P6", "cat-av", "br-sony-audio", "lt5", 5),
        ("P7", "cat-phone", "br-samsung", "5to15", 4),
    ],
    columns=["ProductID", "ParentCategory", "Brand", "PriceBand", "CatalogSold"],
)

# U1, U2 mua điện thoại Apple + tai nghe; U3 mua laptop. CF: P1 ~ P2 ~ P6.
TRAIN = pd.DataFrame(
    [
        ("U1", "P1", 1), ("U1", "P6", 1),
        ("U2", "P1", 1), ("U2", "P2", 1), ("U2", "P6", 1),
        ("U3", "P4", 1), ("U3", "P5", 1),
        ("U4", "P2", 1), ("U4", "P6", 1),
    ],
    columns=["CustomerID", "ProductID", "Quantity"],
)


def make(params: HybridParams, signals: pd.DataFrame | None = None) -> HybridRecommender:
    cf = CollaborativeFiltering().fit(TRAIN)
    return build_recommender(cf, FEATURES, signals, params)


def ids(recs) -> list[str]:
    return [pid for pid, _, _ in recs]


class ContentBasedTests(unittest.TestCase):
    def test_history_profile_prefers_same_category_and_brand(self) -> None:
        interactions = pd.DataFrame([("U1", "P1", 1.0)], columns=["CustomerID", "ProductID", "Weight"])
        cb = ContentBasedModel().fit(FEATURES, interactions=interactions)
        s = pd.Series(cb.score("U1"), index=cb.item_ids)
        # P2 trùng cả 3 đặc trưng với P1 -> cao nhất; P7 chỉ trùng danh mục; P6 không trùng gì
        self.assertAlmostEqual(s["P2"], 1.0, places=5)
        self.assertGreater(s["P2"], s["P3"])
        self.assertGreater(s["P3"], s["P7"])
        self.assertEqual(s["P6"], 0.0)

    def test_unknown_customer_scores_zero(self) -> None:
        cb = ContentBasedModel().fit(FEATURES)
        self.assertFalse(cb.score("nobody").any())
        self.assertFalse(cb.blocked_mask("nobody").any())

    def test_build_candidates_order_and_sold_items_kept(self) -> None:
        catalog = pd.DataFrame(
            [
                ("10", "cat-phone", "br-apple", "15to30", 5),
                ("11", "cat-phone", "br-apple", "15to30", 9),
                ("12", "cat-phone", "br-apple", "15to30", 9),
                ("13", "cat-phone", "br-apple", "15to30", 1),
            ],
            columns=["ProductID", "ParentCategory", "Brand", "PriceBand", "CatalogSold"],
        )
        out = build_candidates(catalog, pd.Series({"13": 2}), per_cell=2)
        # 13 bán thật -> hạng 1; rồi CatalogSold giảm dần, hoà thì ProductID tăng dần
        self.assertEqual(out["ProductID"].tolist(), ["13", "11"])
        out = build_candidates(catalog, pd.Series({"10": 1, "13": 2}), per_cell=1)
        # Món đã bán luôn được giữ dù ngoài top của ô
        self.assertEqual(sorted(out["ProductID"]), ["10", "13"])


class HybridTests(unittest.TestCase):
    def test_cold_customer_without_signal_gets_popular_items(self) -> None:
        rec = make(HybridParams())
        out = rec.recommend("NEW", top_k=3)
        self.assertEqual(ids(out)[0], "P6")  # P6 được 3 khách mua
        self.assertTrue(all(reason == "popular" for _, _, reason in out))

    def test_onboarding_only_customer_follows_stated_brand(self) -> None:
        signals = pd.DataFrame([("NEW", "brand", "br-samsung", 1)],
                               columns=["CustomerID", "Dimension", "Value", "Polarity"])
        rec = make(HybridParams(), signals)
        out = rec.recommend("NEW", top_k=1)
        self.assertEqual(ids(out), ["P7"])
        self.assertEqual(out[0][2], "content")

    def test_not_interested_filter_applies_to_cf_results(self) -> None:
        # Thuần CF (k=0): U1 được gợi ý P2 (cùng người mua với P1, P6)
        plain = make(HybridParams(cf_shrink_k=0.0, repeat_weight=0.0, allow_repeat=False))
        self.assertEqual(ids(plain.recommend("U1", top_k=1)), ["P2"])

        signals = pd.DataFrame([("U1", "category", "cat-phone", -1)],
                               columns=["CustomerID", "Dimension", "Value", "Polarity"])
        filtered = make(HybridParams(cf_shrink_k=0.0, repeat_weight=0.0, allow_repeat=False), signals)
        got = ids(filtered.recommend("U1", top_k=7))
        self.assertTrue(got)
        self.assertFalse({"P1", "P2", "P3", "P7"} & set(got))

    def test_repeat_switch(self) -> None:
        with_repeat = make(HybridParams(cf_shrink_k=0.0, repeat_weight=1.0, allow_repeat=True))
        top = with_repeat.recommend("U3", top_k=2)
        self.assertEqual(sorted(ids(top)), ["P4", "P5"])
        self.assertTrue(all(reason == "repeat" for _, _, reason in top))

        no_repeat = make(HybridParams(cf_shrink_k=0.0, repeat_weight=1.0, allow_repeat=False))
        self.assertFalse({"P4", "P5"} & set(ids(no_repeat.recommend("U3", top_k=7))))

    def test_alpha_limits(self) -> None:
        self.assertEqual(HybridParams(cf_shrink_k=0.0).alpha(3), 1.0)
        self.assertEqual(HybridParams(cf_shrink_k=math.inf).alpha(3), 0.0)
        self.assertEqual(HybridParams(cf_shrink_k=5.0).alpha(0), 0.0)
        self.assertAlmostEqual(HybridParams(cf_shrink_k=5.0).alpha(5), 0.5)

    def test_without_features_falls_back_to_cf_catalog(self) -> None:
        cf = CollaborativeFiltering().fit(TRAIN)
        rec = build_recommender(cf, None, None, HybridParams(allow_repeat=False))
        self.assertEqual(rec.summary()["content_based"], 0)
        self.assertEqual(ids(rec.recommend("U1", top_k=1)), ["P2"])

    def test_save_load_roundtrip(self) -> None:
        rec = make(HybridParams())
        before = rec.recommend("U2", top_k=5)
        with TemporaryDirectory() as d:
            path = rec.save(Path(d) / "hybrid" / "recommender.joblib")
            after = HybridRecommender.load(path).recommend("U2", top_k=5)
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
