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
   tới mốc cắt) và lịch sử mua theo đơn y như serving.purchase_events_for_AI_rec,
   rồi đưa qua ĐÚNG code model đang phục vụ (models/*). Tập ứng viên content-based
   dựng lại bằng build_candidates() với doanh số CHỈ trong cửa sổ train — dùng
   product_features của dbt là rò rỉ doanh số giai đoạn test.
3. TINH CHỈNH TRÊN VALIDATION, BÁO CÁO TRÊN TEST. Lưới KHAI BÁO TRƯỚC khi đo
   (01/10/2026):
     half-life ∈ HL_GRID — CẬN DƯỚI 7 ngày, quyết định miền (xem HL_GRID)
     thang ma trận CF ∈ {linear, log}
     kênh mua lại ∈ {cf_weight (cũ), order_freq (tần suất đơn)}
     k ∈ K_GRID, γ ∈ GAMMA_GRID
   Luật chọn cấu hình production — QUYẾT ĐỊNH SẢN PHẨM, chốt trước khi đo: tối đa
   NDCG@10 tổng thể với RÀNG BUỘC trung bình số món đã mua trong top-10 nằm trong
   REPEAT_BAND. Chế độ chỉ khám phá: tối đa NDCG@10 discovery. Chọn xong thì train
   lại trên 85% và đo MỘT lần trên test.
4. TÁCH HAI BÀI TOÁN: phần lớn món khách mua ở giai đoạn test là món đã mua trước
   đó. Gộp chung thì một model "gợi ý lại đồ cũ" trông rất giỏi mà không khám phá
   được gì. Báo riêng:
     - discovery : ground truth = món CHƯA từng mua trong cửa sổ train
     - repurchase: ground truth = món ĐÃ từng mua
5. LUÔN CÓ BASELINE (Cremonesi et al., 2010): Random, Most-Popular (có/không gợi
   ý lại), Repeat-only. Model không thắng được Most-Popular thì chưa học được gì.
   Thêm ĐỐI CHỨNG MẠNH cho Item-CF: EASE^R (Steck, 2019) và iALS (Hu et al., 2008),
   tinh chỉnh trên validation y như CF — so với đối chứng không tinh chỉnh là so
   lệch (Dacrema et al., 2019). Baseline dùng cùng half-life đã chọn.
6. KHOẢNG TIN CẬY: bootstrap 95% theo khách (Efron & Tibshirani, 1993), và chênh
   lệch GHÉP CẶP trên cùng mẫu bootstrap — so với Item-CF cấu hình cũ, và riêng
   cấu hình đang chạy so với cấu hình cũ.
7. PHÂN KHÚC theo số món khác nhau khách có trong train (0 = khách mới).
8. KHÁCH MỚI (cold-start) MÔ PHỎNG: dữ liệu tổng hợp không có khách mới ở giai
   đoạn test, nên chia khách test thành 5 phần; mỗi lượt XOÁ lịch sử của một
   phần khỏi tập train (fit lại model không có họ), coi họ là khách mới, rồi so
   Most-Popular với content-based dựng từ câu trả lời onboarding GIẢ LẬP. Câu trả
   lời giả lập lấy từ chính lịch sử TRAIN đã xoá của họ (2 danh mục, 3 hãng, 1
   tầm giá nhiều nhất) — tức giả định khách khai đúng gu thật của mình. Đây là
   GIẢ ĐỊNH lạc quan; không có dữ liệu onboarding thật để thay.
9. ĐỘ NHẠY γ trên test (KHÔNG dùng để chọn tham số): đường đánh đổi giữa gợi ý
   lại đồ cũ và khám phá món mới.
10. ĐỘ BỀN: so cấu hình đang chạy với cấu hình cũ trên HAI cửa sổ nằm TRƯỚC
   validation (ROBUST_WINDOWS, mỗi cửa sổ train lại trên dữ liệu trước nó). Không
   đụng test, và không trùng dữ liệu đã dùng để chọn tham số.

Chỉ số: Precision@K, Recall@K, HitRate@K, MAP@K, NDCG@K (Järvelin & Kekäläinen,
2002) — relevance nhị phân, trung bình trên khách có ground truth. Coverage@K =
số món khác nhau xuất hiện trong top-K của mọi khách / kích thước tập ứng viên
(báo cả mẫu số là catalog CF — số món CF biết).

HẠN CHẾ PHẢI NÊU KHI DÙNG KẾT QUẢ: xem evaluation/README.md §Hạn chế. Tóm tắt:
dữ liệu mua là DỮ LIỆU TỔNG HỢP từ data-platform-poc/pos_simulator.py — "gu" của
khách là các lát id sản phẩm liên tiếp, không phụ thuộc danh mục/hãng/giá, và bị
đổi đột ngột một lần đầu tháng 9; đánh giá offline trên log chỉ thưởng món nằm
trong log (Marlin & Zemel, 2009).

Tài liệu:
  Campos, P. G., Díez, F., & Cantador, I. (2014). Time-aware recommender systems:
    a comprehensive survey and analysis of existing evaluation protocols.
    User Modeling and User-Adapted Interaction, 24(1–2), 67–119.
  Cremonesi, P., Koren, Y., & Turrin, R. (2010). Performance of recommender
    algorithms on top-N recommendation tasks. RecSys '10, 39–46.
  Dacrema, M. F., Cremonesi, P., & Jannach, D. (2019). Are we really making much
    progress? A worrying analysis of recent neural recommendation approaches. RecSys '19.
  Efron, B., & Tibshirani, R. J. (1993). An Introduction to the Bootstrap. Chapman & Hall.
  Hu, Y., Koren, Y., & Volinsky, C. (2008). Collaborative filtering for implicit
    feedback datasets. ICDM '08.
  Järvelin, K., & Kekäläinen, J. (2002). Cumulated gain-based evaluation of IR
    techniques. ACM TOIS, 20(4), 422–446.
  Marlin, B. M., & Zemel, R. S. (2009). Collaborative prediction and ranking with
    non-random missing data. RecSys '09, 5–12.
  Steck, H. (2019). Embarrassingly shallow autoencoders for sparse data. WWW '19.
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
    CB_ONBOARDING_PSEUDO_COUNT, CF_INPUT_SCALE, HYBRID_ALLOW_REPEAT, HYBRID_CF_SHRINK_K,
    HYBRID_REPEAT_WEIGHT, RECENCY_HALF_LIFE_DAYS, REPEAT_SCORE,
)
from evaluation.strong_baselines import EASE, IALS  # noqa: E402
from models.cf_recommendation import CollaborativeFiltering  # noqa: E402
from models.content_based import ContentBasedModel, build_candidates  # noqa: E402
from models.hybrid import HybridParams, HybridRecommender, cf_interactions  # noqa: E402
from models.repeat import RepeatModel  # noqa: E402

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "data"
RESULTS_DIR = SCRIPT_DIR / "results"

K_VALUES = (5, 10, 20)
MAIN_K = 10
# PHẢI khớp var trong local-infra-sandbox/dbt_warehouse/dbt_project.yml
MIN_BUYERS = 3              # min_buyers_per_product
CANDIDATES_PER_CELL = 20    # cb_candidates_per_cell

# ── Lưới khai báo trước (01/10/2026) ─────────────────────────────────────────
# Half-life có CẬN DƯỚI 7 ngày. Dữ liệu có một lần đổi gu đột ngột đầu tháng 9
# (README §Dữ liệu), nên half-life 1–3 ngày thắng trên validation chỉ vì "quên"
# thật nhanh gu cũ của bộ sinh. Đồ điện tử không đổi gu theo ngày; chốt cận dưới
# trước khi đo test để con số báo cáo không dựa vào một hiện tượng của bộ sinh.
HL_GRID = (7.0, 10.0, 14.0, 30.0, 60.0)
SCALE_GRID = ("linear", "log")
REPEAT_GRID = ("cf_weight", "order_freq")
K_GRID = (0.0, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, math.inf)
GAMMA_GRID = (0.0, 0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 5.0, 10.0)
# Quyết định sản phẩm (01/10/2026): 2–3 món khách đã mua trong 10 gợi ý.
REPEAT_BAND = (2.0, 3.0)
EASE_GRID = (1.0, 5.0, 20.0, 50.0, 100.0, 250.0, 500.0)
IALS_GRID = tuple((f, a, r) for f in (8, 16, 32) for a in (1.0, 10.0, 40.0) for r in (0.1, 1.0, 10.0))
# Hai cửa sổ trước validation (theo tỉ lệ số đơn) để kiểm độ bền.
ROBUST_WINDOWS = ((0.55, 0.625), (0.625, 0.70))

SEGMENTS = ((0, 0, "0 (khách mới)"), (1, 2, "1–2"), (3, 5, "3–5"), (6, math.inf, "6+"))
BOOTSTRAP_SAMPLES = 1000
SEED = 20260929

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("benchmark")


@dataclass(frozen=True)
class DataConfig:
    """Những gì làm ĐỔI dữ liệu vào model — mỗi bộ cần fit lại."""
    half_life: float
    scale: str       # "linear" | "log"
    repeat: str      # "cf_weight" | "order_freq"

    def label(self) -> str:
        return f"half-life {self.half_life:g} ngày, thang {self.scale}, mua lại {self.repeat}"


@dataclass(frozen=True)
class Tuned:
    data: DataConfig
    params: HybridParams

    def label(self) -> str:
        p = self.params
        return f"{self.data.label()}, k={p.cf_shrink_k:g}, γ={p.repeat_weight:g}, allow_repeat={p.allow_repeat}"


# Cấu hình đã phục vụ tới 30/09/2026 — mốc so sánh "trước/sau".
OLD = Tuned(DataConfig(30.0, "linear", "cf_weight"), HybridParams(cf_shrink_k=0.0, repeat_weight=1.0, allow_repeat=True))
DEPLOYED = Tuned(
    DataConfig(RECENCY_HALF_LIFE_DAYS, CF_INPUT_SCALE, REPEAT_SCORE),
    HybridParams(cf_shrink_k=HYBRID_CF_SHRINK_K, repeat_weight=HYBRID_REPEAT_WEIGHT, allow_repeat=HYBRID_ALLOW_REPEAT),
)
DEPLOYED_NAME = "Hybrid — cấu hình đang chạy"
OLD_NAME = "Hybrid — cấu hình cũ (tới 30/09)"
CF_OLD = "Item-CF — cấu hình cũ"
CF_TUNED = "Item-CF (tinh chỉnh)"
UNCONSTRAINED = "Hybrid + mua lại (tối đa tổng thể, không ràng buộc)"


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


def cut_at(lines: pd.DataFrame, frac: float) -> pd.Timestamp:
    """Mốc cắt theo SỐ ĐƠN (không theo số ngày): dữ liệu dồn cục ở cuối."""
    orders = lines.groupby("OrderID")["OrderDate"].min().sort_values(kind="stable")
    return orders.iloc[int(round(len(orders) * frac))]


def temporal_cuts(lines: pd.DataFrame, val_frac: float, test_frac: float) -> tuple[pd.Timestamp, pd.Timestamp]:
    return cut_at(lines, 1 - val_frac - test_frac), cut_at(lines, 1 - test_frac)


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


def purchase_events_frame(lines: pd.DataFrame, cut: pd.Timestamp) -> pd.DataFrame:
    """Tái hiện serving.purchase_events_for_AI_rec + PURCHASE_EVENTS_QUERY tại `cut`:
    một dòng cho mỗi (khách, món, đơn), không lọc ngưỡng số người mua."""
    ev = (
        lines.groupby(["CustomerID", "ProductID", "OrderID"], as_index=False)
        .agg(Quantity=("Quantity", "sum"), OrderedAt=("OrderDate", "min"))
    )
    ev = ev[ev["Quantity"] > 0]
    ev["DaysSince"] = (cut.normalize() - ev["OrderedAt"].dt.normalize()).dt.days
    return ev[["CustomerID", "ProductID", "DaysSince"]].reset_index(drop=True)


def ground_truth(lines: pd.DataFrame) -> dict[str, set[str]]:
    return lines.groupby("CustomerID")["ProductID"].agg(lambda s: set(s)).to_dict()


# ═════════════════════════════════════════════════════════════════════════════
# Dựng model cho một mốc cắt
# ═════════════════════════════════════════════════════════════════════════════

@dataclass
class SplitState:
    cut: pd.Timestamp
    data: DataConfig
    cf: CollaborativeFiltering
    hybrid: HybridRecommender
    history: dict[str, set[str]]      # món khách ĐÃ mua trong cửa sổ train (dữ liệu thô)
    n_candidates: int
    n_cf_items: int
    train_rows: int


def build_split(lines_train: pd.DataFrame, cut: pd.Timestamp, catalog: pd.DataFrame,
                signals: pd.DataFrame, data: DataConfig,
                min_buyers: int = MIN_BUYERS, per_cell: int = CANDIDATES_PER_CELL) -> SplitState:
    frame = training_frame(lines_train, cut, min_buyers)
    cf = CollaborativeFiltering(half_life_days=data.half_life, input_scale=data.scale).fit(frame)
    units = lines_train.groupby("ProductID")["Quantity"].sum()
    candidates = build_candidates(catalog, units, per_cell)
    cb = ContentBasedModel(onboarding_pseudo_count=CB_ONBOARDING_PSEUDO_COUNT).fit(
        candidates, interactions=cf_interactions(cf), signals=signals,
    )
    repeat = (RepeatModel(data.half_life).fit(purchase_events_frame(lines_train, cut))
              if data.repeat == "order_freq" else None)
    hybrid = HybridRecommender(cf, cb, HybridParams(), repeat)
    return SplitState(
        cut=cut, data=data, cf=cf, hybrid=hybrid, history=ground_truth(lines_train),
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
    hyb = state.hybrid
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
        # Theo đúng kênh mua lại của cấu hình này (cf_weight hoặc order_freq)
        rep = hyb.components(cid)["repeat"]
        own = np.flatnonzero(rep > 0)
        own = own[np.lexsort((hyb._tiebreak[own], -rep[own]))]
        items = [str(hyb.item_ids[i]) for i in own]
        seen = set(items)
        return (items + [p for p in popular if p not in seen])[:n]

    return {
        "Random (catalog CF)": random_rec,
        "Most-Popular (bỏ món đã mua)": popular_new,
        "Most-Popular (cả món đã mua)": popular_all,
        "Repeat-only": repeat_only,
    }


def cf_recommender(state: SplitState) -> Recommender:
    def rec(cid: str, n: int) -> list[str]:
        return [str(p) for p, _ in state.cf.recommend(cid, top_k=n)]
    return rec


def hybrid_recommender(state: SplitState, params: HybridParams,
                       cache: dict[str, dict]) -> Recommender:
    def rec(cid: str, n: int) -> list[str]:
        comp = cache.get(cid)
        if comp is None:
            comp = cache[cid] = state.hybrid.components(cid)
        return [p for p, _, _ in state.hybrid.rank(comp, params, n)]
    return rec


STRONG_FAMILIES = ("Item-CF", "EASE^R", "iALS")


def make_strong(family: str, state: SplitState, hp: dict) -> Recommender:
    if family == "Item-CF":
        return cf_recommender(state)
    if family == "EASE^R":
        return EASE(state.cf, hp["lam"]).recommend
    return IALS(state.cf, hp["factors"], hp["alpha"], hp["reg"]).recommend


# ═════════════════════════════════════════════════════════════════════════════
# Đánh giá
# ═════════════════════════════════════════════════════════════════════════════

def evaluate(rec: Recommender, truth: dict[str, set[str]], state: SplitState,
             k_values: tuple[int, ...] = K_VALUES, light: bool = False) -> dict:
    """Chỉ số theo K cho ba bài toán + phân khúc + coverage; giữ vector theo khách
    để bootstrap. light=True bỏ phân khúc/coverage (dùng khi quét lưới)."""
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

    # Số món khách ĐÃ mua trong top-10 — đại lượng của ràng buộc REPEAT_BAND
    out["repeat_items"] = float(np.mean(
        [len(set(ranked[u][:MAIN_K]) & state.history.get(u, set())) for u in users])) if users else 0.0
    if light:
        return out

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

_SCALE_ORDER = {s: i for i, s in enumerate(SCALE_GRID)}
_REPEAT_ORDER = {s: i for i, s in enumerate(REPEAT_GRID)}


def _pick(sub: pd.DataFrame) -> Tuned:
    # Hoà điểm thì ưu tiên cấu hình đơn giản / thận trọng hơn: γ nhỏ, k lớn,
    # half-life dài, thang tuyến tính, kênh mua lại cũ.
    sub = sub.assign(_scale=sub["scale"].map(_SCALE_ORDER), _rep=sub["repeat"].map(_REPEAT_ORDER))
    sub = sub.sort_values(
        ["NDCG", "Recall", "gamma", "k", "half_life", "_scale", "_rep"],
        ascending=[False, False, True, False, False, True, True], kind="stable",
    )
    r = sub.iloc[0]
    return Tuned(
        DataConfig(float(r["half_life"]), str(r["scale"]), str(r["repeat"])),
        HybridParams(cf_shrink_k=float(r["k"]), repeat_weight=float(r["gamma"]), allow_repeat=bool(r["allow_repeat"])),
    )


def tune(train: pd.DataFrame, cut: pd.Timestamp, truth: dict[str, set[str]],
         catalog: pd.DataFrame, signals: pd.DataFrame) -> dict:
    rows, states = [], {}
    for hl in HL_GRID:
        for scale in SCALE_GRID:
            for rep in REPEAT_GRID:
                data = DataConfig(hl, scale, rep)
                st = states[data] = build_split(train, cut, catalog, signals, data)
                cache: dict[str, dict] = {}
                for allow_repeat in (True, False):
                    gammas = GAMMA_GRID if allow_repeat else (0.0,)
                    task = "overall" if allow_repeat else "discovery"
                    for k in K_GRID:
                        for g in gammas:
                            params = HybridParams(cf_shrink_k=k, repeat_weight=g, allow_repeat=allow_repeat)
                            res = evaluate(hybrid_recommender(st, params, cache), truth, st, (MAIN_K,), light=True)
                            m = res["per_k"][task][MAIN_K]
                            rows.append({
                                "half_life": hl, "scale": scale, "repeat": rep,
                                "allow_repeat": allow_repeat, "k": k, "gamma": g, "task": task,
                                "NDCG": m["NDCG"], "Recall": m["Recall"], "HitRate": m["HitRate"],
                                "discovery_NDCG": res["per_k"]["discovery"][MAIN_K]["NDCG"],
                                "repeat_items": res["repeat_items"],
                            })
                logger.info("Lưới validation: xong %s", data.label())
    grid = pd.DataFrame(rows)
    prod_all = grid[grid["allow_repeat"]]
    return {
        "grid": grid,
        "production": select_in_band(prod_all),
        "unconstrained": _pick(prod_all),
        "discovery": _pick(grid[~grid["allow_repeat"]]),
        "states": states,
    }


def select_in_band(prod_rows: pd.DataFrame, band: tuple[float, float] = REPEAT_BAND) -> Tuned:
    """Luật chọn production: tối đa NDCG tổng thể trong số cấu hình có trung bình
    số món đã mua trong top-10 nằm trong `band`."""
    lo, hi = band
    in_band = prod_rows[(prod_rows["repeat_items"] >= lo) & (prod_rows["repeat_items"] <= hi)]
    if in_band.empty:
        # Không cấu hình nào rơi vào dải: lấy những cấu hình gần dải nhất rồi mới xét NDCG
        gap = (prod_rows["repeat_items"] - prod_rows["repeat_items"].clip(lo, hi)).abs()
        in_band = prod_rows[gap == gap.min()]
        logger.warning("Không cấu hình nào có %g–%g món cũ/10 trên validation — lấy cấu hình gần nhất.", lo, hi)
    return _pick(in_band)


def tune_strong(states: dict[DataConfig, SplitState], truth: dict[str, set[str]]) -> dict:
    """Item-CF / EASE^R / iALS thuần khám phá, mỗi họ chọn (half-life, thang, siêu
    tham số) trên validation theo NDCG@10 discovery."""
    rows = []
    for data, st in states.items():
        if data.repeat != REPEAT_GRID[0]:
            continue  # ba mô hình này không dùng kênh mua lại
        trials = [("Item-CF", {})]
        trials += [("EASE^R", {"lam": lam}) for lam in EASE_GRID]
        trials += [("iALS", {"factors": f, "alpha": a, "reg": r}) for f, a, r in IALS_GRID]
        for family, hp in trials:
            res = evaluate(make_strong(family, st, hp), truth, st, (MAIN_K,), light=True)
            m = res["per_k"]["discovery"][MAIN_K]
            rows.append({"family": family, "half_life": data.half_life, "scale": data.scale,
                         "hp": json.dumps(hp), "NDCG": m["NDCG"], "Recall": m["Recall"], "HitRate": m["HitRate"]})
        logger.info("Đối chứng mạnh trên validation: xong %s", data.label())
    grid = pd.DataFrame(rows)
    best = {}
    for family in STRONG_FAMILIES:
        g = grid[grid["family"] == family].sort_values(
            ["NDCG", "Recall", "half_life"], ascending=[False, False, False], kind="stable")
        r = g.iloc[0]
        best[family] = {"data": DataConfig(float(r["half_life"]), str(r["scale"]), REPEAT_GRID[0]),
                        "hp": json.loads(r["hp"]), "val_NDCG": float(r["NDCG"]), "val_Recall": float(r["Recall"])}
    return {"grid": grid, "best": best}


# ═════════════════════════════════════════════════════════════════════════════
# Khách mới mô phỏng + độ nhạy γ + độ bền
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
               catalog: pd.DataFrame, data: DataConfig, folds: int = 5) -> dict:
    users = np.array(sorted(truth))
    perm = np.random.default_rng(SEED).permutation(users)
    per_user: dict[str, list[tuple[str, dict]]] = {}
    for f in range(folds):
        held = set(perm[f::folds])
        rest = lines_train[~lines_train["CustomerID"].isin(held)]
        stated = simulate_onboarding(lines_train[lines_train["CustomerID"].isin(held)], catalog)
        state = build_split(rest, cut, catalog, stated, data)
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
        res = evaluate(hybrid_recommender(state, params, cache), truth, state, (MAIN_K,), light=True)
        rows.append({"gamma": g,
                     "overall_NDCG": res["per_k"]["overall"][MAIN_K]["NDCG"],
                     "discovery_NDCG": res["per_k"]["discovery"][MAIN_K]["NDCG"],
                     "repurchase_NDCG": res["per_k"]["repurchase"][MAIN_K]["NDCG"],
                     "repeat_items_in_top10": res["repeat_items"]})
    return rows


SLOT_GRID = (1, 2, 3, 5)


def slot_sensitivity(state: SplitState, truth: dict[str, set[str]], discovery: HybridParams) -> list[dict]:
    """Chính sách thay thế cho γ: tối đa R ô đầu là món khách đã mua (xếp theo kênh
    mua lại của cấu hình này), phần còn lại lấy từ bộ khám phá. Không dùng để chọn tham số."""
    hyb = state.hybrid
    cache: dict[str, dict] = {}
    disc = hybrid_recommender(state, discovery, cache)
    rows = []
    for r in SLOT_GRID:
        def rec(cid: str, n: int, r: int = r) -> list[str]:
            comp = cache.get(cid)
            if comp is None:
                comp = cache[cid] = hyb.components(cid)
            rep = comp["repeat"]
            own = np.flatnonzero(rep > 0)
            own = own[np.lexsort((hyb._tiebreak[own], -rep[own]))][:r]
            own_ids = [str(hyb.item_ids[i]) for i in own]
            return (own_ids + [p for p in disc(cid, n) if p not in own_ids])[:n]
        res = evaluate(rec, truth, state, (MAIN_K,), light=True)
        rows.append({"repeat_slots": r,
                     "overall_NDCG": res["per_k"]["overall"][MAIN_K]["NDCG"],
                     "discovery_NDCG": res["per_k"]["discovery"][MAIN_K]["NDCG"],
                     "repurchase_NDCG": res["per_k"]["repurchase"][MAIN_K]["NDCG"]})
    return rows


def robustness(lines: pd.DataFrame, before: pd.Timestamp, catalog: pd.DataFrame, signals: pd.DataFrame,
               specs: dict[str, tuple[str, DataConfig, HybridParams | None]],
               pairs: dict[str, str]) -> dict:
    """specs: tên -> ("hybrid" | "cf", DataConfig, params). pairs: tên -> tên mốc so sánh.
    Mốc cửa sổ tính trên TOÀN BỘ đơn (cùng thang tỉ lệ với mốc validation/test), và
    mọi cửa sổ phải kết thúc trước `before` (= mốc validation). Gộp khách của các cửa
    sổ (tiền tố theo cửa sổ) rồi bootstrap ghép cặp."""
    per_task: dict[str, dict[str, list[pd.DataFrame]]] = {
        t: {name: [] for name in specs} for t in ("overall", "discovery")}
    windows = []
    for lo, hi in ROBUST_WINDOWS:
        t0, t1 = cut_at(lines, lo), cut_at(lines, hi)
        if t1 > before:
            raise ValueError(f"Cửa sổ độ bền {lo}–{hi} tràn qua mốc validation {before}.")
        train = lines[lines["OrderDate"] < t0]
        ev = lines[(lines["OrderDate"] >= t0) & (lines["OrderDate"] < t1)]
        truth = ground_truth(ev)
        states: dict[DataConfig, SplitState] = {}
        caches: dict[DataConfig, dict] = {}
        for name, (kind, data, params) in specs.items():
            if data not in states:
                states[data] = build_split(train, t0, catalog, signals, data)
                caches[data] = {}
            st = states[data]
            rec = hybrid_recommender(st, params, caches[data]) if kind == "hybrid" else cf_recommender(st)
            res = evaluate(rec, truth, st, (MAIN_K,), light=True)
            for task in per_task:
                df = res["per_user"][task].copy()
                df.index = [f"{lo:g}:{u}" for u in df.index]
                per_task[task][name].append(df)
        windows.append({"from": str(t0), "to": str(t1), "users": len(truth)})
        logger.info("Độ bền: xong cửa sổ %s -> %s", t0, t1)
    pooled = {t: {n: pd.concat(d) for n, d in per.items()} for t, per in per_task.items()}
    comparisons = {
        name: {t: bootstrap({ref: pooled[t][ref], name: pooled[t][name]}, ref, "NDCG") for t in pooled}
        for name, ref in pairs.items()
    }
    return {
        "windows": windows,
        "n_users": {t: int(len(next(iter(p.values())))) for t, p in pooled.items()},
        "pairs": pairs,
        "comparisons": comparisons,
    }


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
    val_truth = ground_truth(val)
    tuned = tune(train, t_val, val_truth, catalog, signals)
    strong = tune_strong(tuned.pop("states"), val_truth)
    logger.info("Chọn trên validation — production: %s", tuned["production"].label())
    logger.info("Chọn trên validation — discovery : %s", tuned["discovery"].label())

    # ── Đo một lần: train 85% -> test ────────────────────────────────────
    truth = ground_truth(test)
    states: dict[DataConfig, SplitState] = {}
    caches: dict[DataConfig, dict] = {}

    def state_for(data: DataConfig) -> SplitState:
        if data not in states:
            states[data] = build_split(train_val, t_test, catalog, signals, data)
            caches[data] = {}
        return states[data]

    def hyb(t: Tuned) -> tuple[Recommender, SplitState]:
        st = state_for(t.data)
        return hybrid_recommender(st, t.params, caches[t.data]), st

    prod, disc, unc = tuned["production"], tuned["discovery"], tuned["unconstrained"]
    s_prod = state_for(prod.data)
    models: dict[str, tuple[Recommender, SplitState]] = {
        name: (rec, s_prod) for name, rec in baselines(s_prod).items()}
    models[CF_OLD] = (cf_recommender(state_for(OLD.data)), state_for(OLD.data))
    for family in STRONG_FAMILIES:
        b = strong["best"][family]
        st = state_for(b["data"])
        models[f"{family} (tinh chỉnh)"] = (make_strong(family, st, b["hp"]), st)
    models["Content-based"] = hyb(Tuned(prod.data, HybridParams(cf_shrink_k=math.inf, repeat_weight=0.0,
                                                                  allow_repeat=False)))
    models["Hybrid discovery (tinh chỉnh)"] = hyb(disc)
    models[UNCONSTRAINED] = hyb(unc)
    models[OLD_NAME] = hyb(OLD)
    # Đúng cấu hình service đang chạy (config.py / biến môi trường) — con số này
    # mới là "năng lực của bản đang phục vụ".
    models[DEPLOYED_NAME] = hyb(DEPLOYED)
    results = {name: evaluate(rec, truth, st) for name, (rec, st) in models.items()}

    confidence = {
        task: {metric: bootstrap({n: r["per_user"][task] for n, r in results.items()}, CF_OLD, metric)
               for metric in ("NDCG", "Recall")}
        for task in ("overall", "discovery")
    }
    vs_old = {
        task: bootstrap({OLD_NAME: results[OLD_NAME]["per_user"][task],
                         DEPLOYED_NAME: results[DEPLOYED_NAME]["per_user"][task]}, OLD_NAME, "NDCG")
        for task in ("overall", "discovery", "repurchase")
    }

    robust = robustness(
        lines, t_val, catalog, signals,
        specs={
            OLD_NAME: ("hybrid", OLD.data, OLD.params),
            DEPLOYED_NAME: ("hybrid", DEPLOYED.data, DEPLOYED.params),
            CF_OLD: ("cf", OLD.data, None),
            CF_TUNED: ("cf", strong["best"]["Item-CF"]["data"], None),
        },
        pairs={DEPLOYED_NAME: OLD_NAME, CF_TUNED: CF_OLD},
    )

    cold = cold_start(train_val, t_test, truth, catalog, prod.data)
    sensitivity = gamma_sensitivity(s_prod, truth, prod.params.cf_shrink_k)
    slots = slot_sensitivity(s_prod, truth, disc.params)

    test_hist = s_prod.history
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
        "test_users_cold": sum(1 for u in truth if n_train_items(s_prod, u) == 0),
        "test_repeat_share": float(repeat_share),
        "cf_catalog": s_prod.n_cf_items,
        "candidates": s_prod.n_candidates,
        "catalog": len(catalog),
        "onboarded_customers": int(signals["CustomerID"].nunique()) if len(signals) else 0,
        "deployed_is_tuned": DEPLOYED == prod,
        "config": {"MIN_BUYERS": MIN_BUYERS, "CANDIDATES_PER_CELL": CANDIDATES_PER_CELL,
                   "CB_ONBOARDING_PSEUDO_COUNT": CB_ONBOARDING_PSEUDO_COUNT,
                   "HL_GRID": list(HL_GRID), "SCALE_GRID": list(SCALE_GRID), "REPEAT_GRID": list(REPEAT_GRID),
                   "K_GRID": [str(k) for k in K_GRID], "GAMMA_GRID": list(GAMMA_GRID),
                   "REPEAT_BAND": list(REPEAT_BAND), "EASE_GRID": list(EASE_GRID),
                   "IALS_GRID": [list(x) for x in IALS_GRID], "ROBUST_WINDOWS": [list(w) for w in ROBUST_WINDOWS],
                   "bootstrap_samples": BOOTSTRAP_SAMPLES, "seed": SEED},
    }
    return {"meta": meta, "tuned": tuned, "strong": strong, "results": results, "confidence": confidence,
            "vs_old": vs_old, "robustness": robust, "cold_start": cold,
            "gamma_sensitivity": sensitivity, "slot_sensitivity": slots}


# ═════════════════════════════════════════════════════════════════════════════
# Báo cáo
# ═════════════════════════════════════════════════════════════════════════════

def _ci(b: dict) -> str:
    return f"{b['diff_vs_ref']:+.3f} [{b['diff_ci95'][0]:+.3f}; {b['diff_ci95'][1]:+.3f}]"


def render_markdown(out: dict) -> str:
    meta, res, conf = out["meta"], out["results"], out["confidence"]
    tuned, strong = out["tuned"], out["strong"]
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
    lo, hi = meta["config"]["REPEAT_BAND"]
    L.append(f"- Luật chọn production (chốt trước khi đo): tối đa NDCG@10 tổng thể với {lo:g}–{hi:g} "
             f"món đã mua trong top-10 (trung bình trên validation).")
    L.append(f"- Chọn trên validation — production: `{tuned['production'].label()}`.")
    L.append(f"- Chọn trên validation — chỉ khám phá: `{tuned['discovery'].label()}`.")
    L.append(f"- Không ràng buộc (tối đa NDCG tổng thể): `{tuned['unconstrained'].label()}`.")
    L.append(f"- Cấu hình đang chạy (config.py): `{DEPLOYED.label()}` — "
             f"{'TRÙNG' if meta['deployed_is_tuned'] else 'KHÁC'} cấu hình chọn trên validation.")
    L.append(f"- Cấu hình cũ (tới 30/09): `{OLD.label()}`.\n")

    def table(task: str, title: str) -> None:
        L.append(f"## {title} — K={MAIN_K}\n")
        n = next(iter(res.values()))["per_k"][task][MAIN_K]["n_users"]
        L.append(f"{n} khách có ground truth cho bài toán này. Δ so với `{CF_OLD}`, ghép cặp.\n")
        L.append("| Model | P@10 | R@10 | Hit@10 | MAP@10 | NDCG@10 | NDCG@10 CI95 | ΔNDCG vs CF cũ (CI95) |")
        L.append("|---|---|---|---|---|---|---|---|")
        for name, r in res.items():
            m = r["per_k"][task][MAIN_K]
            cf_ = conf.get(task, {}).get("NDCG", {}).get(name)
            ci = f"[{cf_['ci95'][0]:.3f}, {cf_['ci95'][1]:.3f}]" if cf_ else "—"
            d = _ci(cf_) if cf_ else "—"
            L.append(f"| {name} | {m['Precision']:.4f} | {m['Recall']:.4f} | {m['HitRate']:.4f} | "
                     f"{m['MAP']:.4f} | {m['NDCG']:.4f} | {ci} | {d} |")
        L.append("")

    L.append(f"## Cấu hình đang chạy so với cấu hình cũ — test, NDCG@{MAIN_K}, ghép cặp\n")
    L.append("| Bài toán | Cũ | Đang chạy | Δ (CI95) | n |")
    L.append("|---|---|---|---|---|")
    for task, label in (("overall", "Tổng thể"), ("discovery", "Khám phá"), ("repurchase", "Mua lại")):
        b = out["vs_old"][task]
        n = res[DEPLOYED_NAME]["per_k"][task][MAIN_K]["n_users"]
        L.append(f"| {label} | {b[OLD_NAME]['mean']:.4f} | {b[DEPLOYED_NAME]['mean']:.4f} | {_ci(b[DEPLOYED_NAME])} | {n} |")
    L.append(f"\nSố món đã mua trong top-10: cũ {res[OLD_NAME]['repeat_items']:.1f} · "
             f"đang chạy {res[DEPLOYED_NAME]['repeat_items']:.1f}.\n")

    table("overall", "Tổng thể (mọi món mua ở test)")
    table("discovery", "Discovery (chỉ món CHƯA từng mua)")
    L.append(f"## Repurchase (chỉ món ĐÃ từng mua) — K={MAIN_K}\n")
    L.append("| Model | R@10 | Hit@10 | NDCG@10 | n | Món đã mua trong top-10 |")
    L.append("|---|---|---|---|---|---|")
    for name, r in res.items():
        m = r["per_k"]["repurchase"][MAIN_K]
        L.append(f"| {name} | {m['Recall']:.4f} | {m['HitRate']:.4f} | {m['NDCG']:.4f} | {m['n_users']} | "
                 f"{r['repeat_items']:.1f} |")
    L.append("")

    rb = out["robustness"]
    L.append("## Độ bền — hai cửa sổ TRƯỚC validation (không đụng test, không trùng dữ liệu chọn tham số)\n")
    for w in rb["windows"]:
        L.append(f"- Cửa sổ {w['from']} → {w['to']}: {w['users']} khách.")
    L.append(f"\nGộp khách hai cửa sổ: tổng thể n={rb['n_users']['overall']}, khám phá n={rb['n_users']['discovery']}.\n")
    L.append("| So sánh | Bài toán | Mốc | Mới | Δ NDCG@10 (CI95) |")
    L.append("|---|---|---|---|---|")
    for name, ref in rb["pairs"].items():
        for task, label in (("overall", "Tổng thể"), ("discovery", "Khám phá")):
            b = rb["comparisons"][name][task]
            L.append(f"| {name} vs {ref} | {label} | {b[ref]['mean']:.4f} | {b[name]['mean']:.4f} | {_ci(b[name])} |")
    L.append("")

    L.append("## Đối chứng mạnh — chọn trên validation (NDCG@10 discovery)\n")
    L.append("| Họ | half-life | Thang | Siêu tham số | NDCG@10 val | R@10 val |")
    L.append("|---|---|---|---|---|---|")
    for family, b in strong["best"].items():
        hp = ", ".join(f"{k}={v:g}" for k, v in b["hp"].items()) or "—"
        L.append(f"| {family} | {b['data'].half_life:g} | {b['data'].scale} | {hp} | {b['val_NDCG']:.4f} | {b['val_Recall']:.4f} |")
    L.append("\nKết quả trên test của ba họ nằm trong hai bảng Tổng thể / Discovery ở trên.\n")

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
                 f"[{c_['ci95'][0]:.3f}, {c_['ci95'][1]:.3f}] | {_ci(c_)} |")
    L.append("")

    L.append(f"## Độ nhạy γ trên test (cấu hình production đã chọn, k={tuned['production'].params.cf_shrink_k:g}) "
             "— KHÔNG dùng để chọn tham số\n")
    L.append("| γ | NDCG@10 tổng thể | NDCG@10 discovery | NDCG@10 repurchase | Số món đã mua trong top-10 |")
    L.append("|---|---|---|---|---|")
    for r in out["gamma_sensitivity"]:
        L.append(f"| {r['gamma']:g} | {r['overall_NDCG']:.4f} | {r['discovery_NDCG']:.4f} | "
                 f"{r['repurchase_NDCG']:.4f} | {r['repeat_items_in_top10']:.1f} |")
    L.append("")

    L.append("## Chính sách chia ô trên test (R ô mua lại + phần còn lại từ bộ khám phá) — KHÔNG dùng để chọn tham số\n")
    L.append("| R | NDCG@10 tổng thể | NDCG@10 discovery | NDCG@10 repurchase |")
    L.append("|---|---|---|---|")
    for r in out["slot_sensitivity"]:
        L.append(f"| {r['repeat_slots']} | {r['overall_NDCG']:.4f} | {r['discovery_NDCG']:.4f} | {r['repurchase_NDCG']:.4f} |")
    L.append("")

    g = tuned["grid"]
    L.append("## Lưới tinh chỉnh trên validation\n")
    band = g[g["allow_repeat"] & g["repeat_items"].between(lo, hi)]
    for title, sub in (
        (f"Production — trong dải {lo:g}–{hi:g} món cũ (mục tiêu: NDCG@10 tổng thể), 8 dòng tốt nhất", band),
        ("Không ràng buộc (mục tiêu: NDCG@10 tổng thể), 5 dòng tốt nhất", g[g["allow_repeat"]]),
        ("Chỉ khám phá (mục tiêu: NDCG@10 discovery), 5 dòng tốt nhất", g[~g["allow_repeat"]]),
    ):
        top = sub.sort_values("NDCG", ascending=False).head(8 if "Production" in title else 5)
        L.append(f"{title}\n")
        L.append("| half-life | Thang | Mua lại | k | γ | NDCG@10 | NDCG discovery | Món cũ/10 |")
        L.append("|---|---|---|---|---|---|---|---|")
        for _, r in top.iterrows():
            L.append(f"| {r['half_life']:g} | {r['scale']} | {r['repeat']} | {r['k']:g} | {r['gamma']:g} | "
                     f"{r['NDCG']:.4f} | {r['discovery_NDCG']:.4f} | {r['repeat_items']:.1f} |")
        L.append("")
    L.append("Hạn chế và cách đọc kết quả: xem `evaluation/README.md`.\n")
    return "\n".join(L)


def _tuned_json(t: Tuned) -> dict:
    return {"data": asdict(t.data), "params": asdict(t.params)}


def to_json(out: dict) -> dict:
    tuned, strong = out["tuned"], out["strong"]
    return {
        "meta": out["meta"],
        "tuned": {k: _tuned_json(v) for k, v in tuned.items() if isinstance(v, Tuned)},
        "deployed": _tuned_json(DEPLOYED),
        "old": _tuned_json(OLD),
        "grid": tuned["grid"].replace({math.inf: "inf"}).to_dict(orient="records"),
        "strong": {
            "best": {f: {"data": asdict(b["data"]), "hp": b["hp"], "val_NDCG": b["val_NDCG"],
                         "val_Recall": b["val_Recall"]} for f, b in strong["best"].items()},
            "grid": strong["grid"].to_dict(orient="records"),
        },
        "results": {name: {"per_k": r["per_k"], "segments": r["segments"], "coverage": r["coverage"],
                           "repeat_items": r["repeat_items"]}
                    for name, r in out["results"].items()},
        "confidence": out["confidence"],
        "vs_old": out["vs_old"],
        "robustness": out["robustness"],
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
