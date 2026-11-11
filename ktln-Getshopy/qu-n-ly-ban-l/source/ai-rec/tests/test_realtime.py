"""POST /api/v1/recommend/realtime — ghép đơn mua SAU lần train vào hồ sơ lúc suy luận (12/11/2026).

Model tổng hợp nhỏ dựng trong bộ nhớ: KHÔNG đọc model trên đĩa, KHÔNG gọi ClickHouse.
Bất biến quan trọng nhất (FoldInMatchesRetrainTests): phần phía KHÁCH mà realtime dựng ra
— hồ sơ CF, tập đã mua, kênh mua lại — trùng đúng thứ lượt train tối nay sẽ dựng khi đơn
đó đã vào warehouse. Chỉ độ tương đồng món–món là của hôm qua.
"""

from __future__ import annotations

import unittest

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from api.main import app
from api.schemas import RealtimeRecommendationRequest
from api.service import CFModelService, ModelBundle
from config import DEFAULT_TOP_K, REALTIME_MAX_PURCHASES
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
        # Ứng viên (đang bán, có đặc trưng) nhưng chưa ai mua -> KHÔNG thuộc không gian món của CF
        ("R1", "cat-av", "br-sony-audio", "lt5", 3),
    ],
    columns=["ProductID", "ParentCategory", "Brand", "PriceBand", "CatalogSold"],
)

# Cụm A (điện thoại) và cụm B (laptop) không chung khách nào -> CF tách bạch hai cụm.
# T là khách cần gợi ý: tới lần train chỉ mới mua B1.
TRAIN = pd.DataFrame(
    [
        ("U1", "A1", 1, 10), ("U1", "A2", 1, 10),
        ("U2", "A1", 1, 10), ("U2", "A3", 1, 10),
        ("U3", "A2", 1, 10), ("U3", "A3", 1, 10),
        ("U4", "B1", 1, 10), ("U4", "B2", 1, 10),
        ("U5", "B1", 1, 10), ("U5", "B3", 1, 10),
        ("U6", "B2", 1, 10), ("U6", "B3", 1, 10),
        ("U7", "B1", 2, 3), ("U7", "B2", 1, 3), ("U7", "B3", 1, 3),
        ("T", "B1", 1, 10),
    ],
    columns=["CustomerID", "ProductID", "Quantity", "DaysSince"],
)
# Lịch sử theo đơn cho kênh mua lại: mỗi cặp ở trên là một đơn.
EVENTS = TRAIN[["CustomerID", "ProductID", "DaysSince"]]

# Tham số production (config.py: k = 0, γ = 1, cho gợi ý lại món đã mua)
PROD = HybridParams(cf_shrink_k=0.0, repeat_weight=1.0, allow_repeat=True)
# Thuần khám phá: chỉ CF, loại hẳn món đã mua
DISCOVERY = HybridParams(cf_shrink_k=0.0, repeat_weight=0.0, allow_repeat=False)


def make(params: HybridParams, train: pd.DataFrame = TRAIN, events: pd.DataFrame | None = EVENTS,
         signals: pd.DataFrame | None = None) -> HybridRecommender:
    # Half-life và thang ghi tường minh: test không phụ thuộc biến môi trường.
    cf = CollaborativeFiltering(half_life_days=37.0, input_scale="log").fit(train)
    return build_recommender(cf, FEATURES, signals, params, purchase_events=events)


def ids(recs) -> list[str]:
    return [pid for pid, _, _ in recs]


def by_reason(recs, reason: str) -> set[str]:
    return {pid for pid, _, r in recs if r == reason}


def with_order(train: pd.DataFrame, *rows) -> pd.DataFrame:
    return pd.concat([train, pd.DataFrame(list(rows), columns=train.columns)], ignore_index=True)


class LivePurchaseEffectTests(unittest.TestCase):
    def test_live_purchase_changes_results(self) -> None:
        rec = make(DISCOVERY)
        before = rec.recommend("T", top_k=7)
        after = rec.recommend_live("T", ["A1"], top_k=7)
        # Bản train chỉ biết B1 -> CF chỉ chấm được cụm laptop
        self.assertEqual(by_reason(before, "cf"), {"B2", "B3"})
        # Vừa mua A1 -> hồ sơ có thêm A1 -> cụm điện thoại lên bằng CF
        self.assertEqual(by_reason(after, "cf"), {"A2", "A3", "B2", "B3"})

    def test_cold_customer_first_purchase_switches_to_cf(self) -> None:
        rec = make(PROD)
        before = rec.recommend("NEWCUST", top_k=3)
        self.assertTrue(all(r == "popular" for _, _, r in before))
        after = rec.recommend_live("NEWCUST", ["A1"], top_k=3)
        self.assertEqual(set(ids(after)), {"A1", "A2", "A3"})
        self.assertEqual(by_reason(after, "cf"), {"A2", "A3"})
        # Món vừa mua quay lại qua kênh mua lại — đúng như bản train tối nay sẽ làm
        self.assertEqual(by_reason(after, "repeat"), {"A1"})


class PurchasedSemanticsTests(unittest.TestCase):
    def test_discovery_mode_excludes_every_live_purchase(self) -> None:
        rec = make(DISCOVERY)
        got = ids(rec.recommend_live("T", ["A1", "R1"], top_k=7))
        # R1 không thuộc không gian CF nhưng vẫn là món ĐÃ MUA -> cũng bị loại
        self.assertFalse({"A1", "R1", "B1"} & set(got))
        self.assertEqual(set(got), {"A2", "A3", "B2", "B3"})

    def test_cf_never_scores_live_purchase_but_repeat_channel_does(self) -> None:
        rec = make(PROD)
        live = rec.live_purchases("T", ["A1"])
        comp = rec.components("T", live)
        a1 = rec._pos["A1"]
        self.assertTrue(comp["purchased"][a1])
        self.assertEqual(comp["cf"][a1], 0.0)        # CF là kênh khám phá
        self.assertEqual(comp["repeat"][a1], 1.0)    # 1 đơn hôm nay = điểm cao nhất của khách này
        out = rec.recommend("T", top_k=7, live=live)
        self.assertIn(("A1", "repeat"), [(p, r) for p, _, r in out])

    def test_trained_weights_are_kept(self) -> None:
        rec = make(PROD)
        pidx = rec.cf.profile._user_map["T"]
        live = rec.live_purchases("T", ["B1", "A1"])
        cols, vals = rec._profile_vector(rec.cf.profile, pidx, live)
        got = dict(zip(rec.cf.profile.columns[cols], vals))
        b1 = rec.cf.profile._item_map["B1"]
        self.assertEqual(got["B1"], rec.cf.profile.mat[pidx, b1])   # B1 giữ trọng số đã giảm theo thời gian
        self.assertAlmostEqual(got["A1"], np.log1p(1.0), places=6)  # món mới: 1 cái, cách 0 ngày, thang log
        self.assertEqual(live.cand.size, 1)                         # chỉ A1 là món mua MỚI


class UnknownIdTests(unittest.TestCase):
    def test_unknown_and_blank_ids_are_ignored(self) -> None:
        rec = make(PROD)
        noisy = ["NEW-1", "", "  ", "A1", "A1", "ZZZ"]
        live = rec.live_purchases("T", noisy)
        self.assertEqual(live.unknown, 2)
        self.assertEqual(rec.recommend_live("T", noisy, top_k=7), rec.recommend_live("T", ["A1"], top_k=7))

    def test_nothing_new_equals_get(self) -> None:
        rec = make(PROD)
        for sent in ([], ["NEW-1", "NEW-2"], ["B1"], ["B1", "NEW-1"]):
            live = rec.live_purchases("T", sent)
            self.assertTrue(live.empty, sent)
            self.assertEqual(rec.recommend("T", top_k=7, live=live), rec.recommend("T", top_k=7))

    def test_unknown_only_keeps_popular_and_content_fallback(self) -> None:
        rec = make(PROD)
        self.assertEqual(rec.recommend_live("NEWCUST", ["NEW-1"], top_k=3), rec.recommend("NEWCUST", top_k=3))

        signals = pd.DataFrame([("ONB", "category", "cat-laptop", 1)],
                               columns=["CustomerID", "Dimension", "Value", "Polarity"])
        onb = make(PROD, signals=signals)
        out = onb.recommend_live("ONB", ["NEW-1"], top_k=3)
        self.assertEqual(out, onb.recommend("ONB", top_k=3))
        self.assertEqual(by_reason(out, "content"), {"B1", "B2", "B3"})


class FoldInMatchesRetrainTests(unittest.TestCase):
    """Realtime phải dựng ĐÚNG phần phía khách mà lượt train kế tiếp sẽ dựng.

    a: bản train hôm qua + danh sách mua gửi lúc gọi.  b: bản train tối nay, khi đơn
    (T, A1, 1 cái, 0 ngày) đã vào warehouse. Hồ sơ CF, tập đã mua, kênh mua lại phải
    trùng nhau; điểm CF thì không — độ tương đồng của b có thêm một lượt đồng mua.
    """

    def check(self, events_a: pd.DataFrame | None, events_b: pd.DataFrame | None) -> None:
        train_b = with_order(TRAIN, ("T", "A1", 1, 0))
        a = make(PROD, TRAIN, events_a)
        b = make(PROD, train_b, events_b)
        live = a.live_purchases("T", ["A1", "B1"])

        cols, vals = a._profile_vector(a.cf.profile, a.cf.profile._user_map["T"], live)
        got = dict(zip(a.cf.profile.columns[cols], vals))
        row = b.cf.profile.mat[b.cf.profile._user_map["T"]]
        want = dict(zip(b.cf.profile.columns[row.indices], row.data))
        self.assertEqual(set(got), set(want))
        for pid in want:
            self.assertAlmostEqual(float(got[pid]), float(want[pid]), places=6, msg=pid)

        ca, cb = a.components("T", live), b.components("T")
        np.testing.assert_array_equal(ca["purchased"], cb["purchased"])
        np.testing.assert_allclose(ca["repeat"], cb["repeat"], rtol=1e-6)
        self.assertEqual(ca["n_items"], cb["n_items"])

    def test_order_frequency_repeat_channel(self) -> None:
        self.check(EVENTS, with_order(EVENTS, ("T", "A1", 0)))

    def test_cf_weight_repeat_channel(self) -> None:
        # Không có lịch sử theo đơn -> kênh mua lại dùng trọng số ma trận mua (cách cũ)
        self.check(None, None)

    def test_fresh_weight_equals_trained_weight_of_todays_purchase(self) -> None:
        train_b = with_order(TRAIN, ("T", "A1", 1, 0))
        for scale in ("log", "linear"):
            cf = CollaborativeFiltering(half_life_days=37.0, input_scale=scale).fit(train_b)
            trained = cf.user_item_matrix.mat[cf.user_item_matrix._user_map["T"],
                                              cf.user_item_matrix._item_map["A1"]]
            self.assertEqual(np.float32(cf.fresh_purchase_weight()), trained, scale)


class RealtimeServiceCacheTests(unittest.TestCase):
    CACHED = [(f"CACHED-{i}", "cf") for i in range(20)]

    def setUp(self) -> None:
        self.model = make(PROD)
        self.svc = CFModelService()
        self.svc._bundle = ModelBundle(model=self.model, cache={"T": list(self.CACHED)},
                                       source="test", version=1, stats=self.model.summary())

    @staticmethod
    def pids(resp) -> list[str]:
        return [r.product_id for r in resp.recommendations]

    def test_nothing_new_reuses_precomputed_cache(self) -> None:
        for sent in ([], ["B1"], ["B1", "NEW-1"]):
            got = self.pids(self.svc.recommend_realtime("T", sent, top_k=5))
            self.assertEqual(got, [p for p, _ in self.CACHED[:5]], sent)
        self.assertEqual(self.svc.recommend_realtime("T", ["B1"], top_k=5),
                         self.svc.recommend_for_customer("T", top_k=5))

    def test_new_purchase_is_computed_not_served_from_stale_cache(self) -> None:
        got = self.pids(self.svc.recommend_realtime("T", ["B1", "A1"], top_k=5))
        self.assertFalse(any(p.startswith("CACHED-") for p in got))
        self.assertEqual(got, ids(self.model.recommend_live("T", ["B1", "A1"], top_k=5)))

    def test_cache_shorter_than_top_k_falls_back_to_model(self) -> None:
        got = self.pids(self.svc.recommend_realtime("T", ["B1"], top_k=30))
        self.assertEqual(got, ids(self.model.recommend("T", top_k=30)))

    def test_no_model_yet_returns_empty(self) -> None:
        resp = CFModelService().recommend_realtime("T", ["A1"], top_k=5)
        self.assertEqual(resp.recommendations, [])


class RealtimeAPITests(unittest.TestCase):
    """Gọi API thật qua TestClient (không `with` -> không chạy lifespan, không train nền)."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)
        cls.model = make(PROD)
        CFModelService.get_instance()._bundle = ModelBundle(
            model=cls.model, cache={}, source="test", version=1, stats=cls.model.summary(),
        )

    def post(self, body: dict):
        return self.client.post("/api/v1/recommend/realtime", json=body)

    def test_same_contract_as_get(self) -> None:
        post = self.post({"customer_id": "T", "purchased_product_ids": ["B1"], "top_k": 5})
        get = self.client.get("/api/v1/recommend/customer/T?top_k=5")
        self.assertEqual(post.status_code, 200)
        self.assertEqual(get.status_code, 200)
        self.assertEqual(post.json(), get.json())

    def test_live_purchase_through_api(self) -> None:
        resp = self.post({"customer_id": "T", "purchased_product_ids": ["A1", "NEW-1"], "top_k": 7})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(set(data), {"customer_id", "recommendations"})
        self.assertEqual(data["customer_id"], "T")
        got = [(r["product_id"], r["reason"]) for r in data["recommendations"]]
        self.assertEqual(got, [(p, r) for p, _, r in self.model.recommend_live("T", ["A1"], top_k=7)])
        self.assertIn(("A2", "cf"), got)

    def test_numeric_ids_are_coerced_and_top_k_defaults(self) -> None:
        req = RealtimeRecommendationRequest.model_validate({"customer_id": 42, "purchased_product_ids": [101, "102"]})
        self.assertEqual(req.customer_id, "42")
        self.assertEqual(req.purchased_product_ids, ["101", "102"])
        self.assertEqual(req.top_k, DEFAULT_TOP_K)

    def test_invalid_bodies_are_rejected(self) -> None:
        self.assertEqual(self.post({"purchased_product_ids": []}).status_code, 422)
        self.assertEqual(self.post({"customer_id": "", "purchased_product_ids": []}).status_code, 422)
        self.assertEqual(self.post({"customer_id": "T", "top_k": 0}).status_code, 422)
        too_many = ["x"] * (REALTIME_MAX_PURCHASES + 1)
        self.assertEqual(self.post({"customer_id": "T", "purchased_product_ids": too_many}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
