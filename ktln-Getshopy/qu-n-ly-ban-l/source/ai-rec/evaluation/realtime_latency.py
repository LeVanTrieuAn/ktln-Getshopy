"""Đo độ trễ đường suy luận realtime (POST /api/v1/recommend/realtime) trên model tổng hợp.

12/11/2026. Kích thước lấy theo /health của bản production cùng ngày: 39.577 khách,
15.027 món trong không gian CF, 3.962.716 tương tác, 15.197 ứng viên. Số món khác nhau
mỗi khách theo log-normal khớp mẫu Postgres (1.975 khách: trung vị 83, p90 207, p99 321,
max 527): median 83, σ = ln(207/83)/1,2816. Độ phổ biến món theo luật luỹ thừa (đuôi dài).

Dữ liệu là NGẪU NHIÊN: số đo chỉ nói về THỜI GIAN tính (một phép nhân ma trận thưa x
vector trên ~4 triệu phần tử khác 0, độc lập với nội dung), KHÔNG nói gì về chất lượng gợi ý.

Dựng thẳng ma trận thưa thay vì CollaborativeFiltering.fit(): fit() đi qua DataFrame
4 triệu dòng mã dạng chuỗi — vài trăm MB RAM cho một con số chỉ phụ thuộc kích thước ma
trận. Mọi bước suy luận vẫn là code production (HybridRecommender).

Chạy (từ thư mục ai-rec/, máy host không cần cài gì):
  docker run --rm --network none --memory 1500m -v "$PWD":/src:ro -w /src \
    -e PYTHONPATH=/src -e CLICKHOUSE_URL= --entrypoint python kltn-ai-rec \
    evaluation/realtime_latency.py
"""

from __future__ import annotations

import resource
import statistics
import time

import numpy as np
import pandas as pd
import scipy.sparse as sp
from sklearn.preprocessing import normalize

from models.cf_recommendation import CollaborativeFiltering, ItemSimilarityMatrix, SparseUserItemMatrix
from models.content_based import ContentBasedModel
from models.hybrid import HybridParams, HybridRecommender
from models.repeat import RepeatModel

N_USERS, N_ITEMS, N_CAND = 39_577, 15_027, 15_197
MEDIAN_ITEMS, P90_ITEMS, MAX_ITEMS = 83, 207, 527
SAMPLE, TOP_K, LIVE_LIMIT, NEW_TODAY = 300, 8, 200, 3
PROD = HybridParams(cf_shrink_k=0.0, repeat_weight=1.0, allow_repeat=True)   # config.py hiện tại


def build(rng: np.random.Generator) -> tuple[HybridRecommender, np.ndarray]:
    sigma = np.log(P90_ITEMS / MEDIAN_ITEMS) / 1.2816
    per_user = np.clip(rng.lognormal(np.log(MEDIAN_ITEMS), sigma, N_USERS).astype(int), 1, MAX_ITEMS)
    pop = 1.0 / np.arange(1, N_ITEMS + 1) ** 0.8
    pop /= pop.sum()
    rows = np.repeat(np.arange(N_USERS), per_user)
    cols = rng.choice(N_ITEMS, size=rows.size, p=pop)
    days = rng.integers(0, 365, rows.size)
    vals = np.log1p(0.5 ** (days / 37.0)).astype(np.float32)          # thang log, half-life 37
    mat = sp.csr_matrix((vals, (rows, cols)), shape=(N_USERS, N_ITEMS), dtype=np.float32)
    mat.sum_duplicates()                                               # mua trùng món -> một ô

    users = pd.Index([str(100_000 + u) for u in range(N_USERS)], dtype="string")
    items = pd.Index([str(1_000_000 + i) for i in range(N_ITEMS)], dtype="string")
    cf = CollaborativeFiltering(half_life_days=37.0, input_scale="log")
    cf.user_item_matrix = SparseUserItemMatrix(mat, users, items)
    cf.item_similarity = ItemSimilarityMatrix(normalize(mat.T.tocsr(), norm="l2", axis=1), items)
    cf.popular_items = pd.Series(np.asarray(mat.sum(axis=0)).ravel(), index=items).sort_values(ascending=False)

    sample = rng.choice(N_USERS, SAMPLE, replace=False)
    cand = [str(1_000_000 + i) for i in range(N_CAND)]            # 170 ứng viên ngoài không gian CF
    features = pd.DataFrame({
        "ProductID": cand,
        "ParentCategory": rng.choice([f"cat-{c}" for c in range(8)], N_CAND),
        "Brand": rng.choice([f"br-{b}" for b in range(91)], N_CAND),
        "PriceBand": rng.choice(["lt5", "5to15", "15to30", "gt30"], N_CAND),
        "CatalogSold": rng.integers(0, 1000, N_CAND),
    })
    # Hồ sơ content-based + lịch sử theo đơn: chỉ cần cho khách được đo (chi phí suy luận
    # không phụ thuộc số khách khác có hồ sơ).
    coo = mat[sample].tocoo()
    inter = pd.DataFrame({"CustomerID": users[sample[coo.row]].astype(str),
                          "ProductID": items[coo.col].astype(str), "Weight": coo.data})
    cb = ContentBasedModel().fit(features, interactions=inter)
    events = inter.assign(DaysSince=rng.integers(0, 365, len(inter)))[["CustomerID", "ProductID", "DaysSince"]]
    repeat = RepeatModel(37.0).fit(events)
    return HybridRecommender(cf, cb, PROD, repeat), sample


def pct(xs: list[float], q: float) -> float:
    return float(np.percentile(xs, q))


def report(name: str, ms: list[float]) -> None:
    print(f"  {name:<58} p50 {statistics.median(ms):6.2f}  p95 {pct(ms, 95):6.2f}  max {max(ms):6.2f} ms")


def main() -> None:
    rng = np.random.default_rng(20261112)
    t0 = time.perf_counter()
    model, sample = build(rng)
    uim = model.cf.user_item_matrix
    print(f"Model tổng hợp: {uim.shape[0]:,} khách x {uim.shape[1]:,} món CF, {uim.mat.nnz:,} tương tác, "
          f"{len(model.item_ids):,} ứng viên — dựng trong {time.perf_counter() - t0:.1f}s")

    get_ms, live_ms, same_ms, delta_ms = [], [], [], []
    for u in sample:
        cid = str(uim.index[u])
        trained = list(uim.columns[uim.mat[u].indices])
        rng.shuffle(trained)
        fresh = [str(x) for x in rng.choice(uim.columns, NEW_TODAY, replace=False) if x not in set(trained)]
        sent_new = (fresh + trained)[:LIVE_LIMIT]          # server gửi tối đa 200 món gần nhất
        sent_same = trained[:LIVE_LIMIT]

        t = time.perf_counter(); model.recommend(cid, TOP_K); get_ms.append((time.perf_counter() - t) * 1e3)

        t = time.perf_counter()
        live = model.live_purchases(cid, sent_new)
        model.recommend(cid, TOP_K, live)
        live_ms.append((time.perf_counter() - t) * 1e3)

        t = time.perf_counter(); same = model.live_purchases(cid, sent_same); delta_ms.append((time.perf_counter() - t) * 1e3)
        assert same.empty, "danh sách chỉ gồm món đã train phải ra rỗng (đi đường cache)"
        same_ms.append(delta_ms[-1])

    print(f"\nĐộ trễ trên {SAMPLE} khách có lịch sử (top-{TOP_K}, tham số production k=0, γ=1):")
    report("GET, không có cache (tính tại chỗ)", get_ms)
    report(f"POST có {NEW_TODAY} món mới (tách phần mới + tính tại chỗ)", live_ms)
    report("POST không có gì mới: chỉ phần tách (sau đó trả cache)", same_ms)

    cold = []
    for _ in range(100):
        sent = [str(x) for x in rng.choice(uim.columns, NEW_TODAY, replace=False)]
        t = time.perf_counter(); model.recommend_live("khach-moi", sent, TOP_K); cold.append((time.perf_counter() - t) * 1e3)
    report(f"POST khách chưa có trong bản train, {NEW_TODAY} món", cold)

    # Đường HTTP đầy đủ trong tiến trình (FastAPI + kiểm tra body 200 mã + JSON), không có mạng
    from fastapi.testclient import TestClient

    from api.main import app
    from api.service import CFModelService, ModelBundle
    CFModelService.get_instance()._bundle = ModelBundle(model=model, cache={}, source="bench", version=1,
                                                        stats=model.summary())
    client, http_ms = TestClient(app), []
    for u in sample[:100]:
        cid = str(uim.index[u])
        trained = list(uim.columns[uim.mat[u].indices])[:LIVE_LIMIT - NEW_TODAY]
        body = {"customer_id": cid, "purchased_product_ids": [str(x) for x in rng.choice(uim.columns, NEW_TODAY)] + trained,
                "top_k": TOP_K}
        t = time.perf_counter()
        r = client.post("/api/v1/recommend/realtime", json=body)
        http_ms.append((time.perf_counter() - t) * 1e3)
        assert r.status_code == 200 and len(r.json()["recommendations"]) == TOP_K
    report("POST qua FastAPI TestClient (body tới 200 mã)", http_ms)

    rss_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    print(f"\nRSS đỉnh của tiến trình đo: {rss_mb:.0f} MB")


if __name__ == "__main__":
    import logging
    logging.disable(logging.INFO)   # TestClient log mỗi request — tắt cho gọn
    main()
