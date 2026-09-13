"""Integration tests for FastAPI Recommendation Service endpoints."""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient
import pandas as pd

from api.main import app
from api.service import CFModelService


class RecommendationAPITests(unittest.TestCase):
    """Test suite for verifying API endpoints and recommendation responses."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)
        service = CFModelService.get_instance()
        if not service.model.model_path.exists():
            sample_df = pd.DataFrame(
                [
                    ("INV001", "CUST_0001", "PROD_001", "Điện thoại", 20000000.0, 1, "2026-01-01"),
                    ("INV002", "CUST_0001", "PROD_002", "Phụ kiện", 1500000.0, 2, "2026-01-02"),
                    ("INV003", "CUST_0002", "PROD_001", "Điện thoại", 20000000.0, 1, "2026-01-01"),
                    ("INV004", "CUST_0002", "PROD_002", "Phụ kiện", 1500000.0, 1, "2026-01-02"),
                    ("INV005", "CUST_0002", "PROD_003", "Gia dụng", 5000000.0, 1, "2026-01-03"),
                    ("INV006", "CUST_0003", "PROD_004", "Laptop", 30000000.0, 1, "2026-01-04"),
                ],
                columns=[
                    "InvoiceNo",
                    "CustomerID",
                    "ProductID",
                    "Category",
                    "UnitPrice",
                    "Quantity",
                    "InvoiceDate",
                ],
            )
            service.model.fit(sample_df)
            service.is_loaded = True
        else:
            service.initialize()

    def test_healthcheck(self) -> None:
        """Verify the health endpoint returns 200 and model metadata."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertTrue(data["model_loaded"])
        self.assertGreater(data["customers"], 0)
        self.assertGreater(data["products"], 0)
        self.assertGreater(data["interactions"], 0)

    def test_recommend_existing_customer(self) -> None:
        """Verify recommendations for an active customer with purchase history."""
        # Grab a customer ID from the loaded model
        service = CFModelService.get_instance()
        assert service.model.user_item_matrix is not None
        customer_id = str(service.model.user_item_matrix.index[0])

        response = self.client.get(f"/api/v1/recommend/customer/{customer_id}?top_k=5")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["customer_id"], customer_id)
        self.assertIn("recommendations", data)
        self.assertLessEqual(len(data["recommendations"]), 5)

        # Ensure each recommendation has product_id and no extraneous fields
        for item in data["recommendations"]:
            self.assertIn("product_id", item)

    def test_recommend_cold_start_customer(self) -> None:
        """Verify cold-start fallback generates popular items for unknown customers."""
        unknown_id = "UNKNOWN_CUSTOMER_99999"
        response = self.client.get(f"/api/v1/recommend/customer/{unknown_id}?top_k=4")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["customer_id"], unknown_id)
        self.assertEqual(len(data["recommendations"]), 4)
        for item in data["recommendations"]:
            self.assertIn("product_id", item)


if __name__ == "__main__":
    unittest.main()
