from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import pandas as pd

from models.cf_recommendation import CollaborativeFiltering

REQUIRED_COLUMNS = [
    "InvoiceNo",
    "CustomerID",
    "ProductID",
    "Category",
    "UnitPrice",
    "Quantity",
    "InvoiceDate",
]


def sample_transactions() -> pd.DataFrame:
    return pd.DataFrame(
        [
            ("I1", "U1", "P1", "A", 10, 1, "2026-01-01"),
            ("I2", "U1", "P2", "B", 20, 1, "2026-01-02"),
            ("I3", "U1", "P3", "C", 30, 1, "2026-01-03"),
            ("I4", "U2", "P2", "B", 20, 1, "2026-01-01"),
            ("I5", "U2", "P3", "C", 30, 1, "2026-01-02"),
            ("I6", "U2", "P1", "A", 10, 1, "2026-01-03"),
            ("I7", "U3", "P3", "C", 30, 1, "2026-01-01"),
            ("I8", "U3", "P1", "A", 10, 1, "2026-01-02"),
            ("I9", "U3", "P2", "B", 20, 1, "2026-01-03"),
        ],
        columns=REQUIRED_COLUMNS,
    )


class RecommendationPipelineTests(unittest.TestCase):
    def test_fit_and_recommend(self) -> None:
        df = sample_transactions()
        model = CollaborativeFiltering().fit(df)
        recs = model.recommend("U1", top_k=2)
        self.assertIsInstance(recs, list)
        self.assertLessEqual(len(recs), 2)

    def test_saved_model_can_recommend_after_reload(self) -> None:
        df = sample_transactions()
        with TemporaryDirectory() as directory:
            path = Path(directory) / "model.joblib"
            model = CollaborativeFiltering(path).fit(df)
            before = model.recommend("U1", top_k=2)
            model.save_model()
            after = CollaborativeFiltering(path).load_model().recommend("U1", top_k=2)

        self.assertEqual(before, after)

    def test_order_lookup_and_recommendation(self) -> None:
        df = sample_transactions()
        model = CollaborativeFiltering().fit(df)
        order_info, recs = model.recommend_by_invoice("I1", top_k=2)

        self.assertIsNotNone(order_info)
        assert order_info is not None
        self.assertEqual(order_info["invoice_id"], "I1")
        self.assertEqual(order_info["customer_id"], "U1")
        self.assertEqual(len(order_info["items"]), 1)
        self.assertIsInstance(recs, list)


if __name__ == "__main__":
    unittest.main()

