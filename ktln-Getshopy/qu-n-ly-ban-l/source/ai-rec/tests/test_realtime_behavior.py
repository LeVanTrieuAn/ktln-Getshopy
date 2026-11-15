"""POST /api/v1/recommend/realtime-behavior — ghép đơn mua và hành vi trong phiên vào hồ sơ lúc suy luận (15/11/2026).

Kiểm tra các bất biến then chốt:
1. Tín hiệu xem/bỏ giỏ/thả tim kích hoạt gợi ý CF các món tương đồng tương ứng.
2. Món chỉ xem/bỏ giỏ KHÔNG bị đánh dấu đã mua -> vẫn được phép gợi ý lại (khác với mua).
3. Đơn mua (trong purchased_product_ids hoặc interactions event_type='purchase') được đánh dấu đã mua.
4. Payload rỗng hoặc toàn mã lạ rơi về kết quả gốc.
5. Hợp đồng API FastAPI /api/v1/recommend/realtime-behavior.
"""

from __future__ import annotations

import unittest

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from api.main import app
from api.schemas import BehaviorInteractionItem, RealtimeBehaviorRecommendationRequest
from api.service import CFModelService, ModelBundle
from config import DEFAULT_TOP_K
from models.cf_recommendation import CollaborativeFiltering
from models.hybrid import HybridParams, HybridRecommender, build_recommender

FEATURES = pd.DataFrame(
    [
        ("A1", "cat-phone", "br-apple", "15to30", 9),
        ("A2", "cat-phone", "br-apple", "15to30", 8),
        ("A3", "cat-phone", "br-apple", "15to30", 7),
        ("B1", "cat-laptop", "br-dell", "gt30", 6),
        ("B2", "cat-laptop", "br-dell", "gt30", 5),
        ("B3", "cat-laptop", "br-dell", "gt30", 4),
        ("R1", "cat-av", "br-sony-audio", "lt5", 3),
    ],
    columns=["ProductID", "ParentCategory", "Brand", "PriceBand", "CatalogSold"],
)

TRAIN = pd.DataFrame(
    [
        ("U1", "A1", 1, 10), ("U1", "A2", 1, 10),
        ("U2", "A1", 1, 10), ("U2", "A3", 1, 10),
        ("U3", "A2", 1, 10), ("U3", "A3", 1, 10),
        ("U4", "B1", 1, 10), ("U4", "B2", 1, 10),
        ("U5", "B1", 1, 10), ("U5", "B3", 1, 10),
        ("U6", "B2", 1, 10), ("U6", "B3", 1, 10),
        ("T", "B1", 1, 10),
    ],
    columns=["CustomerID", "ProductID", "Quantity", "DaysSince"],
)

PROD = HybridParams(cf_shrink_k=0.0, repeat_weight=1.0, allow_repeat=True)
DISCOVERY = HybridParams(cf_shrink_k=0.0, repeat_weight=0.0, allow_repeat=False)


def make(params: HybridParams = PROD) -> HybridRecommender:
    cf = CollaborativeFiltering(half_life_days=30.0, input_scale="log").fit(TRAIN)
    return build_recommender(cf, FEATURES, None, params, purchase_events=TRAIN[["CustomerID", "ProductID", "DaysSince"]])


def ids(recs) -> list[str]:
    return [pid for pid, _, _ in recs]


def by_reason(recs, reason: str) -> set[str]:
    return {pid for pid, _, r in recs if r == reason}


class LiveInteractionsLogicTests(unittest.TestCase):
    def test_view_interaction_activates_cf_cluster(self) -> None:
        rec = make(DISCOVERY)
        # Ban đầu T chỉ mua B1 (laptop) -> chỉ gợi ý B2, B3
        before = rec.recommend("T", top_k=7)
        self.assertEqual(by_reason(before, "cf"), {"B2", "B3"})

        # T vừa xem A1 (điện thoại) 120s trong phiên
        live = rec.live_interactions(
            "T",
            interactions=[{"product_id": "A1", "event_type": "view", "dwell_seconds": 120}],
        )
        self.assertFalse(live.empty)
        after = rec.recommend("T", top_k=7, live=live)

        # Món cụm điện thoại (A2, A3) lập tức xuất hiện trong CF
        self.assertIn("A2", by_reason(after, "cf"))
        self.assertIn("A3", by_reason(after, "cf"))

    def test_viewed_item_remains_recommendable(self) -> None:
        rec = make(DISCOVERY)  # allow_repeat = False loại bỏ món đã mua
        # 1. Khách mua A1 -> A1 bị loại khỏi gợi ý
        live_buy = rec.live_interactions("T", purchased_product_ids=["A1"])
        recs_buy = [p for p, _, _ in rec.recommend("T", top_k=7, live=live_buy)]
        self.assertNotIn("A1", recs_buy)

        # 2. Khách chỉ xem A1 -> A1 KHÔNG bị loại, vẫn được gợi ý
        live_view = rec.live_interactions(
            "T", interactions=[{"product_id": "A1", "event_type": "view", "dwell_seconds": 60}]
        )
        recs_view = [p for p, _, _ in rec.recommend("T", top_k=7, live=live_view)]
        self.assertIn("A1", recs_view)

    def test_cart_and_wish_weights(self) -> None:
        rec = make(DISCOVERY)
        live = rec.live_interactions(
            "T",
            interactions=[
                {"product_id": "A1", "event_type": "cart"},
                {"product_id": "A2", "event_type": "wish"},
            ],
        )
        self.assertEqual(len(live.cf_cols), 2)
        self.assertIsNotNone(live.cf_weights)
        # cart_weight (1.0) > wish_weight (0.5) ở thang log
        self.assertGreater(live.cf_weights[0], live.cf_weights[1])

    def test_empty_inputs_return_empty_live(self) -> None:
        rec = make(PROD)
        live = rec.live_interactions("T", purchased_product_ids=[], interactions=[])
        self.assertTrue(live.empty)


class RealtimeBehaviorApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = CFModelService.get_instance()
        self.model = make(PROD)
        self.bundle = ModelBundle(model=self.model, cache={}, source="test", version=1)
        self.service._bundle = self.bundle
        self.client = TestClient(app)

    def test_api_realtime_behavior_success(self) -> None:
        resp = self.client.post(
            "/api/v1/recommend/realtime-behavior",
            json={
                "customer_id": "T",
                "purchased_product_ids": [],
                "interactions": [
                    {"product_id": "A1", "event_type": "product_view", "dwell_seconds": 180},
                    {"product_id": "A2", "event_type": "add_to_cart"},
                ],
                "top_k": 4,
            },
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["customer_id"], "T")
        self.assertLessEqual(len(data["recommendations"]), 4)
        rec_ids = [r["product_id"] for r in data["recommendations"]]
        self.assertTrue(any(p in ("A1", "A2", "A3") for p in rec_ids))

    def test_api_validation_error_on_invalid_dwell(self) -> None:
        resp = self.client.post(
            "/api/v1/recommend/realtime-behavior",
            json={
                "customer_id": "T",
                "interactions": [
                    {"product_id": "A1", "event_type": "view", "dwell_seconds": 9999},  # vượt trần 600s
                ],
            },
        )
        self.assertEqual(resp.status_code, 422)

    def test_api_handles_empty_interactions(self) -> None:
        resp = self.client.post(
            "/api/v1/recommend/realtime-behavior",
            json={"customer_id": "T", "purchased_product_ids": [], "interactions": []},
        )
        self.assertEqual(resp.status_code, 200)


if __name__ == "__main__":
    unittest.main()

