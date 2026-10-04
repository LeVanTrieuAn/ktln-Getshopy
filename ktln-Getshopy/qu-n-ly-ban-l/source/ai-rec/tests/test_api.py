"""Integration tests for FastAPI Recommendation Service endpoints."""

from __future__ import annotations

import unittest

from fastapi.testclient import TestClient
import pandas as pd

from api.main import app
from api.service import CFModelService, ModelBundle, current_params
from models.cf_recommendation import CollaborativeFiltering
from models.hybrid import build_recommender

TRAIN = pd.DataFrame(
    [
        ("CUST_0001", "PROD_001", 1), ("CUST_0001", "PROD_002", 2),
        ("CUST_0002", "PROD_001", 1), ("CUST_0002", "PROD_002", 1), ("CUST_0002", "PROD_003", 1),
        ("CUST_0003", "PROD_004", 1),
    ],
    columns=["CustomerID", "ProductID", "Quantity"],
)
FEATURES = pd.DataFrame(
    [
        ("PROD_001", "cat-phone", "br-apple", "15to30", 10),
        ("PROD_002", "cat-mobile-acc", "br-anker", "lt5", 9),
        ("PROD_003", "cat-av", "br-jbl", "lt5", 8),
        ("PROD_004", "cat-laptop", "br-dell", "15to30", 7),
        ("PROD_005", "cat-laptop", "br-dell", "gt30", 6),
    ],
    columns=["ProductID", "ParentCategory", "Brand", "PriceBand", "CatalogSold"],
)


class RecommendationAPITests(unittest.TestCase):
    """Dựng một bản model nhỏ trong bộ nhớ rồi gọi API thật qua TestClient.

    Không đọc model trên đĩa và không gọi ClickHouse: TestClient không mở
    lifespan khi không dùng `with`, nên vòng train nền không chạy.
    """

    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)
        cf = CollaborativeFiltering().fit(TRAIN)
        recommender = build_recommender(cf, FEATURES, None, current_params())
        CFModelService.get_instance()._bundle = ModelBundle(
            model=recommender, cache={}, source="test", version=1, stats=recommender.summary(),
        )

    def test_healthcheck(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertTrue(data["model_loaded"])
        self.assertTrue(data["content_based"])
        self.assertEqual(data["candidates"], len(FEATURES))
        self.assertGreater(data["interactions"], 0)

    def test_recommend_existing_customer(self) -> None:
        response = self.client.get("/api/v1/recommend/customer/CUST_0001?top_k=3")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["customer_id"], "CUST_0001")
        self.assertEqual(len(data["recommendations"]), 3)
        for item in data["recommendations"]:
            self.assertIn(item["reason"], {"cf", "content", "repeat", "popular"})

    def test_recommend_cold_start_customer(self) -> None:
        response = self.client.get("/api/v1/recommend/customer/UNKNOWN_CUSTOMER_99999?top_k=4")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["recommendations"]), 4)
        self.assertTrue(all(i["reason"] == "popular" for i in data["recommendations"]))


if __name__ == "__main__":
    unittest.main()
