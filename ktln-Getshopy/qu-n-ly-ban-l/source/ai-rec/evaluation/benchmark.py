"""
Benchmark AI-Rec — giao thức đánh giá trung thực.

Chạy
────
  bash evaluation/export_data.sh                 # xuất dữ liệu từ ClickHouse
  python -m evaluation.benchmark                 # trong image ai-rec (xem README)

Giao thức
─────────
1. CẮT THEO THỜI GIAN TOÀN CỤC (Campos et al., 2014): xếp mọi đơn theo thời gian,
   70% đầu = train, 15% kế = validation, 15% cuối = test. Không "để lại đơn cuối
   của từng khách": cách đó cho model học cả đơn của người khác diễn ra SAU thời
   điểm cần dự đoán.
2. CẤU HÌNH PRODUCTION: dựng tập train y như serving.processed_data_for_AI_rec
   (cộng dồn theo cặp khách–món, lọc món có < MIN_BUYERS người mua, DaysSince tính
   tới mốc cắt) rồi đưa qua ĐÚNG code model đang phục vụ (models/*). Tập ứng viên
   content-based dựng lại bằng build_candidates() với doanh số CHỈ trong cửa sổ
   train — dùng product_features của dbt là rò rỉ doanh số giai đoạn test.
3. TINH CHỈNH TRÊN VALIDATION, BÁO CÁO TRÊN TEST: k và γ của hybrid chọn trên
   validation (train 70%), rồi train lại trên 85% và đo một lần trên test.
4. TÁCH HAI BÀI TOÁN: phần lớn món khách mua ở giai đoạn test là món đã mua trước
   đó. Gộp chung thì một model "gợi ý lại đồ cũ" trông rất giỏi mà không khám phá
   được gì. Báo riêng:
     - discovery : ground truth = món CHƯA từng mua trong cửa sổ train
     - repurchase: ground truth = món ĐÃ từng mua
5. LUÔN CÓ BASELINE (Cremonesi et al., 2010): Random, Most-Popular (có/không gợi
   ý lại), Repeat-only. Model không thắng được Most-Popular thì chưa học được gì.
6. KHOẢNG TIN CẬY: bootstrap 95% theo khách (Efron & Tibshirani, 1993), và chênh
   lệch GHÉP CẶP so với CF trên cùng mẫu bootstrap.
7. PHÂN KHÚC theo số món khác nhau khách có trong train (0 = khách mới).
8. KHÁCH MỚI (cold-start) MÔ PHỎNG: dữ liệu tổng hợp không có khách mới ở giai
   đoạn test, nên chia khách test thành 5 phần; mỗi lượt XOÁ lịch sử của một
   phần khỏi tập train (fit lại model không có họ), coi họ là khách mới, rồi so
   Most-Popular với content-based dựng từ câu trả lời onboarding GIẢ LẬP. Câu trả
   lời giả lập lấy từ chính lịch sử TRAIN đã xoá của họ (2 danh mục, 3 hãng, 1
   tầm giá nhiều nhất) — tức giả định khách khai đúng gu thật của mình. Đây là
   GIẢ ĐỊNH lạc quan; không có dữ liệu onboarding thật để thay.
9. ĐỘ NHẠY γ trên test (KHÔNG dùng để chọn tham số): đường đánh đổi giữa gợi ý
   lại đồ cũ và khám phá món mới — lựa chọn điểm trên đường này là quyết định
   sản phẩm, không phải của benchmark.

Chỉ số: Precision@K, Recall@K, HitRate@K, MAP@K, NDCG@K (Järvelin & Kekäläinen,
2002) — relevance nhị phân, trung bình trên khách có ground truth. Coverage@K =
số món khác nhau xuất hiện trong top-K của mọi khách / kích thước tập ứng viên
(báo cả mẫu số là catalog CF — số món CF biết).

HẠN CHẾ PHẢI NÊU KHI DÙNG KẾT QUẢ: xem evaluation/README.md §Hạn chế. Tóm tắt:
dữ liệu mua là DỮ LIỆU TỔNG HỢP từ data-platform-poc/pos_simulator.py — "gu" của
khách là các lát id sản phẩm liên tiếp, không phụ thuộc danh mục/hãng/giá; và
đánh giá offline trên log chỉ thưởng món nằm trong log (Marlin & Zemel, 2009).

Tài liệu:
  Campos, P. G., Díez, F., & Cantador, I. (2014). Time-aware recommender systems:
    a comprehensive survey and analysis of existing evaluation protocols.
    User Modeling and User-Adapted Interaction, 24(1–2), 67–119.
  Cremonesi, P., Koren, Y., & Turrin, R. (2010). Performance of recommender
    algorithms on top-N recommendation tasks. RecSys '10, 39–46.
  Efron, B., & Tibshirani, R. J. (1993). An Introduction to the Bootstrap. Chapman & Hall.
  Järvelin, K., & Kekäläinen, J. (2002). Cumulated gain-based evaluation of IR
    techniques. ACM TOIS, 20(4), 422–446.
  Marlin, B. M., & Zemel, R. S. (2009). Collaborative prediction and ranking with
    non-random missing data. RecSys '09, 5–12.
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import sys
import time
import zlib
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from config import (  # noqa: E402
    CB_ONBOARDING_PSEUDO_COUNT, HYBRID_ALLOW_REPEAT, HYBRID_CF_SHRINK_K,
    HYBRID_REPEAT_WEIGHT, RECENCY_HALF_LIFE_DAYS,
)
from models.cf_recommendation import CollaborativeFiltering  # noqa: E402
from models.content_based import ContentBasedModel, build_candidates  # noqa: E402
from models.hybrid import HybridParams, HybridRecommender, cf_interactions  # noqa: E402

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "data"
RESULTS_DIR = SCRIPT_DIR / "results"

K_VALUES = (5, 10, 20)
MAIN_K = 10
# PHẢI khớp var trong local-infra-sandbox/dbt_warehouse/dbt_project.yml
MIN_BUYERS = 3              # min_buyers_per_product
CANDIDATES_PER_CELL = 20    # cb_candidates_per_cell

K_GRID = (0.0, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, math.inf)
GAMMA_GRID = (0.0, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0)
SEGMENTS = ((0, 0, "0 (khách mới)"), (1, 2, "1–2"), (3, 5, "3–5"), (6, math.inf, "6+"))
BOOTSTRAP_SAMPLES = 1000
DEPLOYED_PARAMS = HybridParams(cf_shrink_k=HYBRID_CF_SHRINK_K, repeat_weight=HYBRID_REPEAT_WEIGHT,
                               allow_repeat=HYBRID_ALLOW_REPEAT)
DEPLOYED = "Hybrid — cấu hình đang chạy"
SEED = 20260929

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("benchmark")


# ═════════════════════════════════════════════════════════════════════════════
# Chỉ số trên MỘT khách
# ═════════════════════════════════════════════════════════════════════════════

def average_precision(relevant: set[str], ranked: list[str], k: int) -> float:
    """AP@K = Σ P@i·rel_i / min(|R|, K)."""
    if not relevant:
        return 0.0
    hits, total = 0, 0.0
    for i, item in enumerate(ranked[:k], start=1):
        if item in relevant:
            hits += 1
            total += hits / i
    return total / min(len(relevant), k)


def ndcg(relevant: set[str], ranked: list[str], k: int) -> float:
    """NDCG@K, relevance nhị phân: DCG = Σ rel_i / log2(i + 1), i đếm từ 1."""
    dcg = sum(1.0 / math.log2(i + 2) for i, item in enumerate(ranked[:k]) if item in relevant)
    idcg = sum(1.0 / math.log2(i + 2) for i in range(min(len(relevant), k)))
    return dcg / idcg if idcg else 0.0


def user_metrics(relevant: set[str], ranked: list[str], k: int) -> dict[str, float]:
    hits = len(relevant & set(ranked[:k]))
    return {
        "Precision": hits / k,
        "Recall": hits / len(relevant),
        "HitRate": float(hits > 0),
        "MAP": average_precision(relevant, ranked, k),
        "NDCG": ndcg(relevant, ranked, k),
    }


METRICS = ("Precision", "Recall", "HitRate", "MAP", "NDCG")


# ═════════════════════════════════════════════════════════════════════════════
# Dữ liệu
# ═════════════════════════════════════════════════════════════════════════════

def load_inputs(data_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    lines = pd.read_csv(
        data_dir / "order_lines.csv",
        dtype={"CustomerID": str, "ProductID": str, "OrderID": str, "Quantity": "int64"},
        parse_dates=["OrderDate"],
    )
    catalog = pd.read_csv(
        data_dir / "catalog_features.csv",
        dtype={"ProductID": str, "ParentCategory": str, "Brand": str, "PriceBand": str},
    )
    sig_path = data_dir / "preference_signals.csv"
    signals = (
        pd.read_csv(sig_path, dtype={"CustomerID": str, "Dimension": str, "Value": str})
        if sig_path.exists() else pd.DataFrame(columns=["CustomerID", "Dimension", "Value", "Polarity"])
    )
    return lines, catalog, signals


def temporal_cuts(lines: pd.DataFrame, val_frac: float, test_frac: float) -> tuple[pd.Timestamp, pd.Timestamp]:
    """Hai mốc cắt theo SỐ ĐƠN (không theo số ngày): dữ liệu dồn cục ở cuối."""
    orders = lines.groupby("OrderID")["OrderDate"].min().sort_values(kind="stable")
    n = len(orders)
    t_val = orders.iloc[int(round(n * (1 - val_frac - test_frac)))]
    t_test = orders.iloc[int(round(n * (1 - test_frac)))]
    return t_val, t_test


def training_frame(lines: pd.DataFrame, cut: pd.Timestamp, min_buyers: int) -> pd.DataFrame:
    """Tái hiện serving.processed_data_for_AI_rec + TRAINING_QUERY tại thời điểm `cut`."""
    pairs = (
        lines.groupby(["CustomerID", "ProductID"], as_index=False)
        .agg(Quantity=("Quantity", "sum"), LastPurchasedAt=("OrderDate", "max"))
    )
    pairs = pairs[pairs["Quantity"] > 0]
    buyers = pairs.groupby("ProductID")["CustomerID"].nunique()
    pairs = pairs[pairs["ProductID"].isin(buyers[buyers >= min_buyers].index)]
    # = dateDiff('day', LastPurchasedAt, now()) của ClickHouse: số ranh giới ngày
    pairs["DaysSince"] = (cut.normalize() - pairs["LastPurchasedAt"].dt.normalize()).dt.days
    return pairs[["CustomerID", "ProductID", "Quantity", "DaysSince"]].reset_index(drop=True)


def ground_truth(lines: pd.DataFrame) -> dict[str, set[str]]:
    return lines.groupby("CustomerID")["ProductID"].agg(lambda s: set(s)).to_dict()


# ═════════════════════════════════════════════════════════════════════════════
# Dựng model cho một mốc cắt
# ═════════════════════════════════════════════════════════════════════════════

@dataclass
class SplitState:
    cut: pd.Timestamp
    cf: CollaborativeFiltering
    hybrid: HybridRecommender
    history: dict[str, set[str]]      # món khách ĐÃ mua trong cửa sổ train (dữ liệu thô)
    n_candidates: int
    n_cf_items: int
    train_rows: int


def build_split(lines_train: pd.DataFrame, cut: pd.Timestamp, catalog: pd.DataFrame,
                signals: pd.DataFrame, min_buyers: int, per_cell: int) -> SplitState:
    frame = training_frame(lines_train, cut, min_buyers)
    cf = CollaborativeFiltering().fit(frame)
    units = lines_train.groupby("ProductID")["Quantity"].sum()
    candidates = build_candidates(catalog, units, per_cell)
    cb = ContentBasedModel(onboarding_pseudo_count=CB_ONBOARDING_PSEUDO_COUNT).fit(
        candidates, interactions=cf_interactions(cf), signals=signals,
    )
    hybrid = HybridRecommender(cf, cb, HybridParams())
    return SplitState(
        cut=cut, cf=cf, hybrid=hybrid, history=ground_truth(lines_train),
        n_candidates=len(hybrid.item_ids), n_cf_items=len(cf.user_item_matrix.columns),
        train_rows=len(frame),
    )


def n_train_items(state: SplitState, customer_id: str) -> int:
    """Số món khác nhau MODEL thấy ở khách (sau lọc MIN_BUYERS) — cơ sở của α(n)."""
    uim = state.cf.user_item_matrix
    idx = uim._user_map.get(customer_id)
    return 0 if idx is None else int(uim.mat[idx].nnz)


# ═════════════════════════════════════════════════════════════════════════════
# Các bộ gợi ý so sánh
# ═════════════════════════════════════════════════════════════════════════════

Recommender = Callable[[str, int], list[str]]


def baselines(state: SplitState) -> dict[str, Recommender]:
    cf = state.cf
    uim = cf.user_item_matrix
    popular = [str(p) for p in cf.popular_items.index]
    catalog = np.array(sorted(map(str, uim.columns)))

    def purchased(cid: str) -> list[str]:
        return [str(p) for p in uim.get_purchased_products(cid)]

    def random_rec(cid: str, n: int) -> list[str]:
        rng = np.random.default_rng(zlib.crc32(f"{SEED}:{cid}".encode()))
        return list(rng.choice(catalog, size=min(n, len(catalog)), replace=False))

    def popular_new(cid: str, n: int) -> list[str]:
        seen = set(purchased(cid))
        return [p for p in popular if p not in seen][:n]

    def popular_all(cid: str, n: int) -> list[str]:
        return popular[:n]

    def repeat_only(cid: str, n: int) -> list[str]:
        own = purchased(cid)
        weights = uim.get_weights(cid, own) if own else pd.Series(dtype=float)
        rank_pop = {p: i for i, p in enumerate(popular)}
        own = sorted(own, key=lambda p: (-float(weights.get(p, 0.0)), rank_pop.get(p, 1 << 30), p))
        seen = set(own)
        return (own + [p for p in popular if p not in seen])[:n]

    def cf_prod(cid: str, n: int) -> list[str]:
        return [str(p) for p, _ in cf.recommend(cid, top_k=n)]

    return {
        "Random (catalog CF)": random_rec,
        "Most-Popular (bỏ món đã mua)": popular_new,
        "Most-Popular (cả món đã mua)": popular_all,
        "Repeat-only": repeat_only,
        "Item-CF (production cũ)": cf_prod,
    }


def hybrid_recommender(state: SplitState, params: HybridParams,
                       cache: dict[str, dict]) -> Recommender:
    def rec(cid: str, n: int) -> list[str]:
        comp = cache.get(cid)
        if comp is None:
            comp = cache[cid] = state.hybrid.components(cid)
        return [p for p, _, _ in state.hybrid.rank(comp, params, n)]
    return rec


# ═════════════════════════════════════════════════════════════════════════════
# Đánh giá
# ═════════════════════════════════════════════════════════════════════════════

def evaluate(rec: Recommender, truth: dict[str, set[str]], state: SplitState,
             k_values: tuple[int, ...] = K_VALUES) -> dict:
    """Chỉ số theo K cho ba bài toán + phân khúc + coverage; giữ vector theo khách
    để bootstrap."""
    top_n = max(k_values)
    users = sorted(truth)
    ranked = {u: rec(u, top_n) for u in users}

    out: dict = {"per_k": {}, "segments": {}, "coverage": {}, "per_user": {}}
    for task in ("overall", "discovery", "repurchase"):
        for k in k_values:
            rows = []
            for u in users:
                hist = state.history.get(u, set())
                rel = truth[u] if task == "overall" else (
                    truth[u] - hist if task == "discovery" else truth[u] & hist)
                if rel:
                    rows.append((u, user_metrics(rel, ranked[u], k)))
            df = pd.DataFrame([m for _, m in rows], index=[u for u, _ in rows], columns=METRICS)
            out["per_k"].setdefault(task, {})[k] = {
                **{m: float(df[m].mean()) if len(df) else 0.0 for m in METRICS},
                "n_users": int(len(df)),
            }
            if k == MAIN_K:
                out["per_user"][task] = df

    overall = out["per_user"]["overall"]
    for lo, hi, label in SEGMENTS:
        members = [u for u in overall.index if lo <= n_train_items(state, u) <= hi]
        seg = overall.loc[members]
        out["segments"][label] = {
            "n_users": len(members),
            **{m: float(seg[m].mean()) if len(seg) else float("nan") for m in ("Recall", "HitRate", "NDCG")},
        }

    for k in k_values:
        shown = {p for u in users for p in ranked[u][:k]}
        out["coverage"][k] = {
            "distinct_items": len(shown),
            "of_candidates": len(shown) / state.n_candidates,
            "of_cf_catalog": len(shown & set(map(str, state.cf.user_item_matrix.columns))) / state.n_cf_items,
        }
    return out


def bootstrap(per_user: dict[str, pd.DataFrame], reference: str, metric: str,
              samples: int = BOOTSTRAP_SAMPLES) -> dict[str, dict]:
    """CI 95% theo phân vị của trung bình, và chênh lệch GHÉP CẶP với `reference`
    trên cùng chỉ số khách của mỗi lần lấy mẫu."""
    users = per_user[reference].index
    rng = np.random.default_rng(SEED)
    idx = rng.integers(0, len(users), size=(samples, len(users)))
    ref = per_user[reference].reindex(users)[metric].to_numpy()
    out = {}
    for name, df in per_user.items():
        v = df.reindex(users)[metric].to_numpy()
        means = v[idx].mean(axis=1)
        diffs = (v - ref)[idx].mean(axis=1)
        out[name] = {
            "mean": float(v.mean()),
            "ci95": [float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))],
            "diff_vs_ref": float((v - ref).mean()),
            "diff_ci95": [float(np.percentile(diffs, 2.5)), float(np.percentile(diffs, 97.5))],
        }
    return out


# ═════════════════════════════════════════════════════════════════════════════
# Tinh chỉnh trên validation
# ═════════════════════════════════════════════════════════════════════════════

def tune(state: SplitState, truth: dict[str, set[str]]) -> dict:
    cache: dict[str, dict] = {}
    rows = []
    for allow_repeat in (True, False):
        gammas = GAMMA_GRID if allow_repeat else (0.0,)
        task = "overall" if allow_repeat else "discovery"
        for k in K_GRID:
            for g in gammas:
                params = HybridParams(cf_shrink_k=k, repeat_weight=g, allow_repeat=allow_repeat)
                res = evaluate(hybrid_recommender(state, params, cache), truth, state, (MAIN_K,))
                m = res["per_k"][task][MAIN_K]
                rows.append({"allow_repeat": allow_repeat, "k": k, "gamma": g, "task": task,
                             "NDCG": m["NDCG"], "Recall": m["Recall"], "HitRate": m["HitRate"]})
    grid = pd.DataFrame(rows)

    def best(allow_repeat: bool) -> HybridParams:
        g = grid[grid["allow_repeat"] == allow_repeat]
        # Hoà điểm thì ưu tiên mô hình đơn giản hơn: γ nhỏ hơn, rồi k lớn hơn
        # (dựa vào nội dung nhiều hơn chỉ khi nó thực sự tốt hơn thì mới chọn).
        g = g.sort_values(["NDCG", "Recall", "gamma", "k"], ascending=[False, False, True, False], kind="stable")
        r = g.iloc[0]
        return HybridParams(cf_shrink_k=float(r["k"]), repeat_weight=float(r["gamma"]), allow_repeat=allow_repeat)

    return {"grid": grid, "production": best(True), "discovery": best(False)}


# ═════════════════════════════════════════════════════════════════════════════
# Khách mới mô phỏng + độ nhạy γ
# ═════════════════════════════════════════════════════════════════════════════

ONBOARD_TOP = {"category": ("ParentCategory", 2), "brand": ("Brand", 3), "price_band": ("PriceBand", 1)}


def simulate_onboarding(history: pd.DataFrame, catalog: pd.DataFrame) -> pd.DataFrame:
    """Câu trả lời onboarding giả lập = đặc trưng nhiều nhất trong lịch sử TRAIN."""
    feats = catalog.set_index("ProductID")[["ParentCategory", "Brand", "PriceBand"]]
    h = history.join(feats, on="ProductID", how="inner")
    rows = []
    for cid, g in h.groupby("CustomerID"):
        for dim, (col, top) in ONBOARD_TOP.items():
            w = g.groupby(col)["Quantity"].sum().sort_values(ascending=False, kind="stable")
            rows += [(cid, dim, v, 1) for v in w.index[:top]]
    return pd.DataFrame(rows, columns=["CustomerID", "Dimension", "Value", "Polarity"])


def cold_start(lines_train: pd.DataFrame, cut: pd.Timestamp, truth: dict[str, set[str]],
               catalog: pd.DataFrame, folds: int = 5) -> dict:
    users = np.array(sorted(truth))
    perm = np.random.default_rng(SEED).permutation(users)
    per_user: dict[str, list[tuple[str, dict]]] = {}
    for f in range(folds):
        held = set(perm[f::folds])
        rest = lines_train[~lines_train["CustomerID"].isin(held)]
        stated = simulate_onboarding(lines_train[lines_train["CustomerID"].isin(held)], catalog)
        state = build_split(rest, cut, catalog, stated, MIN_BUYERS, CANDIDATES_PER_CELL)
        popular = [str(p) for p in state.cf.popular_items.index]
        params = HybridParams(cf_shrink_k=5.0, repeat_weight=0.0, allow_repeat=True)  # n=0 -> α=0
        for u in sorted(held):
            recs = {
                "Most-Popular": popular[:MAIN_K],
                "Content-based từ onboarding giả lập": [
                    p for p, _, _ in state.hybrid.rank(state.hybrid.components(u), params, MAIN_K)],
            }
            for name, ranked in recs.items():
                per_user.setdefault(name, []).append((u, user_metrics(truth[u], ranked, MAIN_K)))
    frames = {n: pd.DataFrame([m for _, m in rows], index=[u for u, _ in rows], columns=METRICS)
              for n, rows in per_user.items()}
    return {
        "folds": folds,
        "n_users": len(users),
        "metrics": {n: {m: float(df[m].mean()) for m in METRICS} for n, df in frames.items()},
        "confidence": {m: bootstrap(frames, "Most-Popular", m) for m in ("NDCG", "Recall")},
    }


def gamma_sensitivity(state: SplitState, truth: dict[str, set[str]], k: float) -> list[dict]:
    cache: dict[str, dict] = {}
    rows = []
    for g in GAMMA_GRID:
        params = HybridParams(cf_shrink_k=k, repeat_weight=g, allow_repeat=True)
        rec = hybrid_recommender(state, params, cache)
        res = evaluate(rec, truth, state, (MAIN_K,))
        repeats = np.mean([len(set(rec(u, MAIN_K)) & state.history.get(u, set())) for u in truth])
        rows.append({"gamma": g,
                     "overall_NDCG": res["per_k"]["overall"][MAIN_K]["NDCG"],
                     "discovery_NDCG": res["per_k"]["discovery"][MAIN_K]["NDCG"],
                     "repurchase_NDCG": res["per_k"]["repurchase"][MAIN_K]["NDCG"],
                     "repeat_items_in_top10": float(repeats)})
    return rows


SLOT_GRID = (1, 2, 3, 5)


def slot_sensitivity(state: SplitState, truth: dict[str, set[str]], discovery: HybridParams) -> list[dict]:
    """Chính sách thay thế cho γ: tối đa R ô đầu là món khách đã mua (trọng số mua
    giảm theo thời gian), phần còn lại lấy từ bộ khám phá. Không dùng để chọn tham số."""
    uim = state.cf.user_item_matrix
    cache: dict[str, dict] = {}
    disc = hybrid_recommender(state, discovery, cache)
    rows = []
    for r in SLOT_GRID:
        def rec(cid: str, n: int, r: int = r) -> list[str]:
            own = [str(p) for p in uim.get_purchased_products(cid)]
            w = uim.get_weights(cid, own) if own else pd.Series(dtype=float)
            own = sorted(own, key=lambda p: (-float(w.get(p, 0.0)), p))[:r]
            return (own + [p for p in disc(cid, n) if p not in own])[:n]
        res = evaluate(rec, truth, state, (MAIN_K,))
        rows.append({"repeat_slots": r,
                     "overall_NDCG": res["per_k"]["overall"][MAIN_K]["NDCG"],
                     "discovery_NDCG": res["per_k"]["discovery"][MAIN_K]["NDCG"],
                     "repurchase_NDCG": res["per_k"]["repurchase"][MAIN_K]["NDCG"]})
    return rows


# ═════════════════════════════════════════════════════════════════════════════
# Chạy toàn bộ
# ═════════════════════════════════════════════════════════════════════════════

def run(data_dir: Path, val_frac: float, test_frac: float) -> dict:
    started = time.monotonic()
    lines, catalog, signals = load_inputs(data_dir)
    t_val, t_test = temporal_cuts(lines, val_frac, test_frac)
    train = lines[lines["OrderDate"] < t_val]
    val = lines[(lines["OrderDate"] >= t_val) & (lines["OrderDate"] < t_test)]
    train_val = lines[lines["OrderDate"] < t_test]
    test = lines[lines["OrderDate"] >= t_test]
    logger.info("Mốc cắt: validation từ %s, test từ %s", t_val, t_test)

    # ── Tinh chỉnh: train 70% -> validation ──────────────────────────────
    s_val = build_split(train, t_val, catalog, signals, MIN_BUYERS, CANDIDATES_PER_CELL)
    tuned = tune(s_val, ground_truth(val))
    logger.info("Chọn trên validation: production=%s | discovery=%s", tuned["production"], tuned["discovery"])

    # ── Đo một lần: train 85% -> test ────────────────────────────────────
    s_test = build_split(train_val, t_test, catalog, signals, MIN_BUYERS, CANDIDATES_PER_CELL)
    truth = ground_truth(test)
    cache: dict[str, dict] = {}
    models: dict[str, Recommender] = {
        **baselines(s_test),
        "Content-based": hybrid_recommender(
            s_test, HybridParams(cf_shrink_k=math.inf, repeat_weight=0.0, allow_repeat=False), cache),
        "Hybrid discovery (tinh chỉnh)": hybrid_recommender(s_test, tuned["discovery"], cache),
        "Hybrid + mua lại (γ tối ưu validation)": hybrid_recommender(s_test, tuned["production"], cache),
        # Đúng cấu hình service đang chạy (config.py / biến môi trường) — con số
        # này mới là "năng lực của bản đang phục vụ".
        DEPLOYED: hybrid_recommender(s_test, DEPLOYED_PARAMS, cache),
    }
    results = {name: evaluate(rec, truth, s_test) for name, rec in models.items()}

    ref = "Item-CF (production cũ)"
    confidence = {
        task: {metric: bootstrap({n: r["per_user"][task] for n, r in results.items()}, ref, metric)
               for metric in ("NDCG", "Recall")}
        for task in ("overall", "discovery")
    }

    cold = cold_start(train_val, t_test, truth, catalog)
    sensitivity = gamma_sensitivity(s_test, truth, tuned["production"].cf_shrink_k)
    slots = slot_sensitivity(s_test, truth, tuned["discovery"])

    test_hist = s_test.history
    repeat_share = np.mean([len(truth[u] & test_hist.get(u, set())) / len(truth[u]) for u in truth])
    meta = {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "duration_sec": round(time.monotonic() - started, 1),
        "data_dir": str(data_dir),
        "cuts": {"validation_from": str(t_val), "test_from": str(t_test),
                 "first_order": str(lines["OrderDate"].min()), "last_order": str(lines["OrderDate"].max())},
        "orders": {"train": int(train["OrderID"].nunique()), "validation": int(val["OrderID"].nunique()),
                   "test": int(test["OrderID"].nunique())},
        "test_users": len(truth),
        "test_users_cold": sum(1 for u in truth if n_train_items(s_test, u) == 0),
        "test_repeat_share": float(repeat_share),
        "cf_catalog": s_test.n_cf_items,
        "candidates": s_test.n_candidates,
        "catalog": len(catalog),
        "onboarded_customers": int(signals["CustomerID"].nunique()) if len(signals) else 0,
        "config": {"RECENCY_HALF_LIFE_DAYS": RECENCY_HALF_LIFE_DAYS, "MIN_BUYERS": MIN_BUYERS,
                   "CANDIDATES_PER_CELL": CANDIDATES_PER_CELL,
                   "CB_ONBOARDING_PSEUDO_COUNT": CB_ONBOARDING_PSEUDO_COUNT,
                   "K_GRID": [str(k) for k in K_GRID], "GAMMA_GRID": list(GAMMA_GRID),
                   "bootstrap_samples": BOOTSTRAP_SAMPLES, "seed": SEED},
    }
    return {"meta": meta, "tuned": tuned, "results": results, "confidence": confidence,
            "cold_start": cold, "gamma_sensitivity": sensitivity, "slot_sensitivity": slots}


# ═════════════════════════════════════════════════════════════════════════════
# Báo cáo
# ═════════════════════════════════════════════════════════════════════════════

def _fmt_params(p: HybridParams) -> str:
    return f"k={p.cf_shrink_k:g}, γ={p.repeat_weight:g}, allow_repeat={p.allow_repeat}"


def render_markdown(out: dict) -> str:
    meta, res, conf = out["meta"], out["results"], out["confidence"]
    L = []
    L.append("# Benchmark AI-Rec\n")
    L.append(f"Chạy lúc {meta['run_at']} ({meta['duration_sec']} s). Dữ liệu: `{meta['data_dir']}`.\n")
    L.append("## Dữ liệu và giao thức\n")
    c, o = meta["cuts"], meta["orders"]
    L.append(f"- Đơn từ {c['first_order']} tới {c['last_order']}; cắt theo thời gian toàn cục: "
             f"train {o['train']} đơn · validation {o['validation']} đơn (từ {c['validation_from']}) · "
             f"test {o['test']} đơn (từ {c['test_from']}).")
    L.append(f"- Khách được đánh giá ở test: {meta['test_users']} (khách mới hoàn toàn: {meta['test_users_cold']}).")
    L.append(f"- **{meta['test_repeat_share']:.1%}** món khách mua ở test là món họ ĐÃ mua trước đó.")
    L.append(f"- Catalog {meta['catalog']:,} món · ứng viên content-based {meta['candidates']:,} · "
             f"catalog CF (≥{meta['config']['MIN_BUYERS']} người mua) {meta['cf_catalog']}.")
    L.append(f"- Khách có onboarding: {meta['onboarded_customers']}.")
    L.append(f"- Tham số chọn trên validation — có mua lại: `{_fmt_params(out['tuned']['production'])}`; "
             f"chỉ khám phá: `{_fmt_params(out['tuned']['discovery'])}`.")
    L.append(f"- Cấu hình đang chạy (config.py): `{_fmt_params(DEPLOYED_PARAMS)}`.\n")

    def table(task: str, title: str) -> None:
        L.append(f"## {title} — K={MAIN_K}\n")
        n = next(iter(res.values()))["per_k"][task][MAIN_K]["n_users"]
        L.append(f"{n} khách có ground truth cho bài toán này.\n")
        L.append("| Model | P@10 | R@10 | Hit@10 | MAP@10 | NDCG@10 | NDCG@10 CI95 | ΔNDCG vs CF (CI95) |")
        L.append("|---|---|---|---|---|---|---|---|")
        for name, r in res.items():
            m = r["per_k"][task][MAIN_K]
            cf_ = conf.get(task, {}).get("NDCG", {}).get(name)
            ci = f"[{cf_['ci95'][0]:.3f}, {cf_['ci95'][1]:.3f}]" if cf_ else "—"
            d = (f"{cf_['diff_vs_ref']:+.3f} [{cf_['diff_ci95'][0]:+.3f}, {cf_['diff_ci95'][1]:+.3f}]"
                 if cf_ else "—")
            L.append(f"| {name} | {m['Precision']:.4f} | {m['Recall']:.4f} | {m['HitRate']:.4f} | "
                     f"{m['MAP']:.4f} | {m['NDCG']:.4f} | {ci} | {d} |")
        L.append("")

    table("overall", "Tổng thể (mọi món mua ở test)")
    table("discovery", "Discovery (chỉ món CHƯA từng mua)")
    L.append(f"## Repurchase (chỉ món ĐÃ từng mua) — K={MAIN_K}\n")
    L.append("| Model | R@10 | Hit@10 | NDCG@10 | n |")
    L.append("|---|---|---|---|---|")
    for name, r in res.items():
        m = r["per_k"]["repurchase"][MAIN_K]
        L.append(f"| {name} | {m['Recall']:.4f} | {m['HitRate']:.4f} | {m['NDCG']:.4f} | {m['n_users']} |")
    L.append("")

    L.append(f"## Theo phân khúc (số món khách có trong train) — NDCG@{MAIN_K} tổng thể\n")
    seg_names = list(next(iter(res.values()))["segments"])
    filled = [s_ for s_ in seg_names if next(iter(res.values()))["segments"][s_]["n_users"]]
    if len(filled) == 1:
        L.append(f"Mọi khách ở test đều thuộc phân khúc {filled[0]} — dữ liệu không có khách mới hay "
                 "khách ít lịch sử ở giai đoạn test. Khách mới: xem mục mô phỏng bên dưới.\n")
    L.append("| Model | " + " | ".join(f"{s} (n={next(iter(res.values()))['segments'][s]['n_users']})" for s in seg_names) + " |")
    L.append("|---|" + "---|" * len(seg_names))
    for name, r in res.items():
        L.append(f"| {name} | " + " | ".join(
            "—" if math.isnan(r["segments"][s]["NDCG"]) else f"{r['segments'][s]['NDCG']:.4f}" for s in seg_names) + " |")
    L.append("")

    L.append(f"## Coverage@{MAIN_K}\n")
    L.append("| Model | Số món khác nhau | / ứng viên | / catalog CF |")
    L.append("|---|---|---|---|")
    for name, r in res.items():
        cv = r["coverage"][MAIN_K]
        L.append(f"| {name} | {cv['distinct_items']} | {cv['of_candidates']:.4f} | {cv['of_cf_catalog']:.4f} |")
    L.append("")

    cs = out["cold_start"]
    L.append(f"## Khách mới mô phỏng ({cs['folds']}-fold, {cs['n_users']} khách) — K={MAIN_K}\n")
    L.append("Lịch sử của khách bị xoá khỏi tập train; onboarding giả lập từ chính lịch sử đó (giả định lạc quan).\n")
    L.append("| Model | R@10 | Hit@10 | NDCG@10 | NDCG@10 CI95 | ΔNDCG vs Most-Popular (CI95) |")
    L.append("|---|---|---|---|---|---|")
    for name, m in cs["metrics"].items():
        c_ = cs["confidence"]["NDCG"][name]
        L.append(f"| {name} | {m['Recall']:.4f} | {m['HitRate']:.4f} | {m['NDCG']:.4f} | "
                 f"[{c_['ci95'][0]:.3f}, {c_['ci95'][1]:.3f}] | "
                 f"{c_['diff_vs_ref']:+.3f} [{c_['diff_ci95'][0]:+.3f}, {c_['diff_ci95'][1]:+.3f}] |")
    L.append("")

    L.append(f"## Độ nhạy γ trên test (k={out['tuned']['production'].cf_shrink_k:g}, allow_repeat=True) — KHÔNG dùng để chọn tham số\n")
    L.append("| γ | NDCG@10 tổng thể | NDCG@10 discovery | NDCG@10 repurchase | Số món đã mua trong top-10 |")
    L.append("|---|---|---|---|---|")
    for r in out["gamma_sensitivity"]:
        L.append(f"| {r['gamma']:g} | {r['overall_NDCG']:.4f} | {r['discovery_NDCG']:.4f} | "
                 f"{r['repurchase_NDCG']:.4f} | {r['repeat_items_in_top10']:.1f} |")
    L.append("")

    L.append(f"## Chính sách chia ô trên test (R ô mua lại + phần còn lại từ bộ khám phá) — KHÔNG dùng để chọn tham số\n")
    L.append("| R | NDCG@10 tổng thể | NDCG@10 discovery | NDCG@10 repurchase |")
    L.append("|---|---|---|---|")
    for r in out["slot_sensitivity"]:
        L.append(f"| {r['repeat_slots']} | {r['overall_NDCG']:.4f} | {r['discovery_NDCG']:.4f} | {r['repurchase_NDCG']:.4f} |")
    L.append("")

    g = out["tuned"]["grid"]
    L.append("## Lưới tinh chỉnh trên validation (5 dòng tốt nhất mỗi chế độ)\n")
    for allow in (True, False):
        sub = g[g["allow_repeat"] == allow].sort_values("NDCG", ascending=False).head(5)
        L.append(f"allow_repeat={allow} (mục tiêu: NDCG@10 {sub['task'].iloc[0]})\n")
        L.append("| k | γ | NDCG@10 | R@10 | Hit@10 |")
        L.append("|---|---|---|---|---|")
        for _, r in sub.iterrows():
            L.append(f"| {r['k']:g} | {r['gamma']:g} | {r['NDCG']:.4f} | {r['Recall']:.4f} | {r['HitRate']:.4f} |")
        L.append("")
    L.append("Hạn chế và cách đọc kết quả: xem `evaluation/README.md`.\n")
    return "\n".join(L)


def to_json(out: dict) -> dict:
    return {
        "meta": out["meta"],
        "tuned": {k: asdict(v) for k, v in out["tuned"].items() if isinstance(v, HybridParams)},
        "grid": out["tuned"]["grid"].replace({math.inf: "inf"}).to_dict(orient="records"),
        "results": {name: {"per_k": r["per_k"], "segments": r["segments"], "coverage": r["coverage"]}
                    for name, r in out["results"].items()},
        "confidence": out["confidence"],
        "cold_start": out["cold_start"],
        "gamma_sensitivity": out["gamma_sensitivity"],
        "slot_sensitivity": out["slot_sensitivity"],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Benchmark AI-Rec (giao thức: xem docstring)")
    ap.add_argument("--data-dir", type=Path, default=DATA_DIR)
    ap.add_argument("--output", type=Path, default=RESULTS_DIR)
    ap.add_argument("--val-frac", type=float, default=0.15)
    ap.add_argument("--test-frac", type=float, default=0.15)
    args = ap.parse_args()

    out = run(args.data_dir, args.val_frac, args.test_frac)
    args.output.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    md = render_markdown(out)
    (args.output / f"benchmark_{ts}.md").write_text(md, encoding="utf-8")
    (args.output / f"benchmark_{ts}.json").write_text(
        json.dumps(to_json(out), ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(md)
    logger.info("Đã ghi %s", args.output / f"benchmark_{ts}.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
