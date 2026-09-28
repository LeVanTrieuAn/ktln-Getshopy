"""
Benchmark Pipeline — Đánh giá AI Recommendation System bằng 6 metrics.

Mục tiêu
─────────
Dùng train.csv để train model CF, rồi so sánh sản phẩm gợi ý (top-K)
với new_orders.csv (đơn hàng mới — ground truth thật của khách).

Tất cả users trong new_orders.csv đều được đánh giá:
  - Users có trong train → dùng model CF
  - Users cold-start    → dùng popular items fallback

Metrics được tính
────────────────
• Precision@K      — Trong K món gợi ý, bao nhiêu món khách mua thật?
• Recall@K          — Trong số món khách sẽ mua, bắt được bao nhiêu?
• HitRate@K         — % khách có ít nhất 1 món trúng (dễ giải thích khi bảo vệ)
• MAP@K             — Món trúng nằm ở đầu hay cuối danh sách
• NDCG@K            — Như MAP nhưng phạt nặng hơn khi món đúng bị xếp thấp
• Coverage          — % catalog từng được gợi ý (chống chỉ quanh quẩn vài món bán chạy)

Input
─────
  data/train.csv     — dữ liệu train: CustomerID, ProductID, Quantity
  data/new_orders.csv — dữ liệu test:  CustomerID, ProductID, Quantity

Output
──────
  results/benchmark_<timestamp>.json
  results/benchmark_<timestamp>.csv   (dạng bảng metrics theo K)
"""

from __future__ import annotations

import json
import logging
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from models.cf_recommendation import CollaborativeFiltering

# =============================================================================
# CẤU HÌNH
# =============================================================================

# Đường dẫn tuyệt đối — thư mục chứa script này
SCRIPT_DIR = Path(__file__).resolve().parent
EVAL_DATA_DIR = SCRIPT_DIR / "data"
EVAL_OUTPUT_DIR = SCRIPT_DIR / "results"

# Các K cần đánh giá
K_VALUES = [5, 10, 20]

# Cột bắt buộc trong CSV
REQUIRED_TRAIN_COLS = {"CustomerID", "ProductID", "Quantity"}
REQUIRED_TEST_COLS  = {"CustomerID", "ProductID"}

# =============================================================================
# LOGGING
# =============================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# =============================================================================
# HELPER — các hàm tính metrics
# =============================================================================

def _average_precision_at_k(relevant_items: set[str], recommended_list: list[str], k: int) -> float:
    """
    Average Precision @ K cho MỘT khách.

    AP@K = Σ (precision@k tại mỗi vị trí có hit) / min(|relevant|, k)

    Ví dụ: relevant={A,B,C}, rec=[A, X, B, Y, C], k=5
      pos1 hit  → precision@1 = 1/1
      pos3 hit  → precision@3 = 2/3
      pos5 hit  → precision@5 = 3/5
      AP@5 = (1 + 2/3 + 3/5) / 3
    """
    if not relevant_items:
        return 0.0

    hits = 0
    sum_precisions = 0.0
    rec_k = recommended_list[:k]

    for i, item in enumerate(rec_k, start=1):
        if item in relevant_items:
            hits += 1
            sum_precisions += hits / i

    return sum_precisions / min(len(relevant_items), k)


def _ndcg_at_k(relevant_items: set[str], recommended_list: list[str], k: int) -> float:
    """
    Normalized Discounted Cumulative Gain @ K.

    DCG@K  = Σ (1 / log2(pos+1))  cho mỗi món trúng ở vị trí pos
    IDCG@K = DCG tính trên ideal ranking (tất cả relevant xếp lên đầu)
    NDCG   = DCG / IDCG

    Công thức chuẩn cho binary relevance (1 = trúng, 0 = trượt):
      DCG = Σ (rel_i / log2(i+2))   [i đếm từ 0]
    """
    rec_k = recommended_list[:k]

    # DCG
    dcg = 0.0
    for i, item in enumerate(rec_k):
        if item in relevant_items:
            dcg += 1.0 / np.log2(i + 2)   # i=0 → pos1 → log2(2) = 1

    # IDCG — ideal: tất cả relevant xếp lên đầu
    ideal_k = min(len(relevant_items), k)
    idcg = sum(1.0 / np.log2(i + 2) for i in range(ideal_k))

    if idcg == 0:
        return 0.0
    return dcg / idcg


def _compute_coverage(
    recommended_items_per_customer: dict[str, list[str]],
    all_products: set[str],
) -> float:
    """
    Coverage = số sản phẩm DUY NHẤT từng xuất hiện trong bất kỳ recommendation nào
               / tổng số sản phẩm trong catalog (từ tập train)

    Coverage = 1.0 → mọi sản phẩm đều từng được gợi ý cho ai đó.
    Coverage thấp → model chỉ quanh quẩn vài món bán chạy, không khai thác được
                    phần dài của catalog.
    """
    if not all_products:
        return 0.0
    unique_recommended = set()
    for recs in recommended_items_per_customer.values():
        unique_recommended.update(recs)
    return len(unique_recommended) / len(all_products)


# =============================================================================
# CORE — chạy benchmark
# =============================================================================

def run_benchmark(
    train_path: Path,
    new_order_path: Path,
    k_values: list[int] | None = None,
    model_path: Path | None = None,
) -> dict:
    """
    Train model trên train.csv, đánh giá trên new_order.csv.

    Trả về dict chứa:
      - metadata (thời gian, số lượng data...)
      - metrics_per_k: dict[K → dict of metrics]
    """
    if k_values is None:
        k_values = K_VALUES

    started_at = datetime.now(timezone.utc)
    logger.info("=" * 60)
    logger.info("BENCHMARK PIPELINE — AI RECOMMENDATION EVALUATION")
    logger.info("=" * 60)

    # ── 1. Load & validate train.csv ────────────────────────────────────
    logger.info("[1/5] ▶ BẮT ĐẦU — Đọc train.csv: %s", train_path)
    if not train_path.exists():
        raise FileNotFoundError(f"Không tìm thấy train.csv: {train_path}")

    t0 = time.monotonic()
    train_df = pd.read_csv(train_path, dtype={"CustomerID": str, "ProductID": str})
    missing = REQUIRED_TRAIN_COLS - set(train_df.columns)
    if missing:
        raise ValueError(f"train.csv thiếu cột bắt buộc: {', '.join(missing)}")

    train_df = train_df.dropna(subset=["CustomerID", "ProductID", "Quantity"])
    train_df = train_df[train_df["Quantity"] > 0]
    train_df["CustomerID"] = train_df["CustomerID"].astype(str)
    train_df["ProductID"] = train_df["ProductID"].astype(str)

    n_train_customers = train_df["CustomerID"].nunique()
    n_train_products  = train_df["ProductID"].nunique()
    logger.info(
        "[1/5] ✓ XONG trong %.3fs — %d khách, %d sản phẩm, %d dòng tương tác",
        time.monotonic() - t0, n_train_customers, n_train_products, len(train_df),
    )

    # ── 2. Load & validate new_orders.csv ──────────────────────────────
    logger.info("[2/5] ▶ BẮT ĐẦU — Đọc test.csv: %s", new_order_path)
    if not new_order_path.exists():
        raise FileNotFoundError(f"Không tìm thấy test.csv: {new_order_path}")

    t0 = time.monotonic()
    test_df = pd.read_csv(new_order_path, dtype={"CustomerID": str, "ProductID": str})
    missing = REQUIRED_TEST_COLS - set(test_df.columns)
    if missing:
        raise ValueError(f"test.csv thiếu cột bắt buộc: {', '.join(missing)}")

    test_df = test_df.dropna(subset=["CustomerID", "ProductID"])
    test_df["CustomerID"] = test_df["CustomerID"].astype(str)
    test_df["ProductID"] = test_df["ProductID"].astype(str)

    # Ground truth: với mỗi khách, tập sản phẩm họ mua trong đơn mới
    ground_truth: dict[str, set[str]] = (
        test_df.groupby("CustomerID")["ProductID"]
        .apply(set)
        .to_dict()
    )

    # Đánh giá TẤT CẢ users trong test file
    eval_customers = sorted(ground_truth.keys())

    if not eval_customers:
        raise ValueError("Không có khách nào trong file test.")

    logger.info(
        "[2/5] ✓ XONG trong %.3fs — %d khách sẽ được đánh giá (cold-start sẽ xác định ở bước 3)",
        time.monotonic() - t0, len(eval_customers),
    )

    # ── 3. Train model ──────────────────────────────────────────────────
    logger.info(
        "[3/5] ▶ BẮT ĐẦU — Train Collaborative Filtering "
        "(%d tương tác, %d sản phẩm, %d khách) ...",
        len(train_df), n_train_products, n_train_customers,
    )
    train_customer_set = set(train_df["CustomerID"])   # ← tạo set 1 lần, dùng cho cả cold-start detection
    cold_start_customers = [c for c in eval_customers if c not in train_customer_set]
    logger.info(
        "    · Phát hiện %d warm + %d cold-start customers",
        len(eval_customers) - len(cold_start_customers), len(cold_start_customers),
    )

    model = CollaborativeFiltering(model_path=model_path or (SCRIPT_DIR / "output" / "cf" / "item_cf.joblib"))
    t0 = time.monotonic()
    model.fit(train_df)
    train_duration = time.monotonic() - t0
    summary = model.summary()
    logger.info(
        "[3/5] ✓ XONG trong %.1fs — %d khách, %d sản phẩm, %d tương tác",
        train_duration, summary["customers"], summary["products"], summary["interactions"],
    )

    # Catalog đầy đủ từ model (dùng cho Coverage)
    all_products_in_model: set[str] = set(model.user_item_matrix.columns)

    # ── 4. Generate recommendations ────────────────────────────────────
    n_total = len(eval_customers)
    logger.info(
        "[4/5] ▶ BẮT ĐẦU — Sinh top-%d recommendations cho %d khách "
        "(%d warm + %d cold-start) ...",
        max(k_values), n_total,
        n_total - len(cold_start_customers), len(cold_start_customers),
    )
    t0 = time.monotonic()
    recs_per_customer: dict[str, list[str]] = {}
    cold_start_generated = 0
    train_customer_set = set(train_df["CustomerID"])

    for i, cid in enumerate(eval_customers):
        top_k = max(k_values)   # lấy đủ 1 lần, slice sau

        # Cold-start user: không có trong train → dùng popular items
        is_cold = cid not in train_customer_set
        if is_cold:
            popular = [pid for pid, _ in model.recommend(cid, top_k=top_k)]
            recs_per_customer[cid] = popular
            cold_start_generated += 1
        else:
            recs_per_customer[cid] = [pid for pid, _ in model.recommend(cid, top_k=top_k)]

        if (i + 1) % 500 == 0 or (i + 1) == n_total:
            elapsed = time.monotonic() - t0
            avg_per_cust = elapsed / (i + 1)
            remaining = (n_total - (i + 1)) * avg_per_cust
            logger.info(
                "    · Tiến độ: %d/%d (%.1f%%) | đã %.1fs | ETA %.0fs",
                i + 1, n_total, 100 * (i + 1) / n_total,
                elapsed, remaining,
            )

    rec_duration = time.monotonic() - t0
    logger.info(
        "[4/5] ✓ XONG trong %.1fs — %d cold-start users dùng popular fallback, "
        "trung bình %.3fs/khách",
        rec_duration, cold_start_generated,
        rec_duration / n_total if n_total else 0.0,
    )

    # ── 5. Tính metrics cho từng K ─────────────────────────────────────
    logger.info("[5/5] ▶ BẮT ĐẦU — Tính metrics cho K = %s", k_values)
    t0 = time.monotonic()

    metrics_per_k: dict[str, dict] = {}
    for ki, k in enumerate(k_values, start=1):
        logger.info("    · Tính K=%d (%d/%d) ...", k, ki, len(k_values))

    metrics_per_k: dict[str, dict] = {}
    for k in k_values:
        # Accumulators
        n_hits = 0
        sum_precision = 0.0
        sum_recall = 0.0
        sum_ap = 0.0
        sum_ndcg = 0.0
        valid_customers = 0

        for cid in eval_customers:
            relevant = ground_truth.get(cid, set())
            # Nếu khách trong test không mua gì → không đánh giá được recall
            if not relevant:
                continue

            rec_k = recs_per_customer[cid][:k]
            hits_in_rec = relevant & set(rec_k)

            # Precision@K
            precision = len(hits_in_rec) / k
            sum_precision += precision

            # Recall@K
            recall = len(hits_in_rec) / len(relevant)
            sum_recall += recall

            # HitRate@K
            if hits_in_rec:
                n_hits += 1

            # MAP@K
            ap = _average_precision_at_k(relevant, recs_per_customer[cid], k)
            sum_ap += ap

            # NDCG@K
            ndcg = _ndcg_at_k(relevant, recs_per_customer[cid], k)
            sum_ndcg += ndcg

            valid_customers += 1

        n_valid = valid_customers
        metrics_per_k[str(k)] = {
            "Precision@K":    round(sum_precision / n_valid, 6) if n_valid else 0.0,
            "Recall@K":       round(sum_recall    / n_valid, 6) if n_valid else 0.0,
            "HitRate@K":      round(n_hits        / n_valid, 6) if n_valid else 0.0,
            "MAP@K":          round(sum_ap        / n_valid, 6) if n_valid else 0.0,
            "NDCG@K":         round(sum_ndcg      / n_valid, 6) if n_valid else 0.0,
            "n_valid_customers": n_valid,
        }

    metrics_duration = time.monotonic() - t0
    logger.info(
        "[5/5] ✓ XONG trong %.3fs — đã tính %d giá trị K",
        metrics_duration, len(k_values),
    )

    # Coverage
    coverage = _compute_coverage(recs_per_customer, all_products_in_model)
    for k_metrics in metrics_per_k.values():
        k_metrics["Coverage"] = round(coverage, 6)
    logger.info("  · Coverage (catalog): %.4f", coverage)

    finished_at = datetime.now(timezone.utc)

    # ── Build result ───────────────────────────────────────────────────
    result = {
        "metadata": {
            "train_path":          str(train_path),
            "new_order_path":     str(new_order_path),
            "run_at":             started_at.isoformat(),
            "finished_at":        finished_at.isoformat(),
            "total_duration_sec": round((finished_at - started_at).total_seconds(), 2),
            "train_customers":    n_train_customers,
            "train_products":     n_train_products,
            "train_rows":         len(train_df),
            "eval_customers":     len(eval_customers),
            "cold_start_customers": len(cold_start_customers),
            "warm_customers":     len(eval_customers) - len(cold_start_customers),
            "k_values":           k_values,
            "model_type":         "Item-based Collaborative Filtering",
            "train_duration_sec": round(train_duration, 2),
            "rec_duration_sec":   round(rec_duration, 2),
        },
        "metrics_per_k": metrics_per_k,
    }

    return result


def _print_report(result: dict) -> None:
    """In bảng metrics ra console."""
    print()
    print("=" * 80)
    print("  BENCHMARK REPORT — AI Recommendation System")
    print("=" * 80)

    meta = result["metadata"]
    print(f"  Model          : {meta['model_type']}")
    print(f"  Train data     : {meta['train_path']}")
    print(f"  Test data      : {meta['new_order_path']}")
    print(f"  Train customers: {meta['train_customers']:,}   Train products: {meta['train_products']:,}")
    print(f"  Eval customers : {meta['eval_customers']:,}  (warm: {meta.get('warm_customers', 0):,}, cold-start: {meta['cold_start_customers']:,})")
    print(f"  Thời gian      : train {meta['train_duration_sec']}s | rec {meta['rec_duration_sec']}s | tổng {meta['total_duration_sec']}s")
    print()
    print("  ── Metrics ──────────────────────────────────────────────────────────")
    print(f"  {'K':>4} | {'Precision@K':>12} | {'Recall@K':>10} | {'HitRate@K':>11} | "
          f"{'MAP@K':>8} | {'NDCG@K':>8} | {'Coverage':>9}")
    print("  " + "-" * 75)

    for k_str, m in result["metrics_per_k"].items():
        k = k_str
        print(
            f"  {k:>4} | "
            f"{m['Precision@K']:>12.4f} | "
            f"{m['Recall@K']:>10.4f} | "
            f"{m['HitRate@K']:>11.4f} | "
            f"{m['MAP@K']:>8.4f} | "
            f"{m['NDCG@K']:>8.4f} | "
            f"{m['Coverage']:>9.4f}"
        )

    print()
    print("  ── Diễn giải ───────────────────────────────────────────────────────")
    print("  Precision@K  : Trong K món gợi ý, bao nhiêu món khách mua thật?")
    print("  Recall@K      : Trong số món khách sẽ mua, bắt được bao nhiêu?")
    print("  HitRate@K     : % khách có ít nhất 1 món trúng — dễ giải thích khi bảo vệ")
    print("  MAP@K         : Món trúng nằm ở đầu hay cuối danh sách? (cao = đúng đầu)")
    print("  NDCG@K        : Như MAP nhưng phạt nặng hơn khi món đúng bị xếp thấp")
    print("  Coverage      : % catalog từng được gợi ý (chống chỉ quanh quẩn vài món)")
    print("=" * 80)
    print()


def _save_outputs(result: dict, output_dir: Path) -> None:
    """Lưu JSON và CSV."""
    output_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    json_path = output_dir / f"benchmark_{ts}.json"
    csv_path  = output_dir / f"benchmark_{ts}.csv"

    # JSON
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    logger.info("✓ JSON  : %s", json_path)

    # CSV: mỗi dòng 1 K
    rows = []
    for k_str, m in result["metrics_per_k"].items():
        rows.append({"K": int(k_str), **m})
    df = pd.DataFrame(rows).set_index("K")
    df.to_csv(csv_path)
    logger.info("✓ CSV   : %s", csv_path)


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Benchmark AI Recommendation System")
    parser.add_argument(
        "--train", "-t",
        type=Path,
        default=EVAL_DATA_DIR / "train.csv",
        help="Đường dẫn train.csv (mặc định: ./data/train.csv)",
    )
    parser.add_argument(
        "--new-order", "-n",
        type=Path,
        default=None,
        help="Đường dẫn test file (mặc định: tự tìm test.csv hoặc new_orders.csv trong ./data/)",
    )
    parser.add_argument(
        "--k", "-k",
        type=int,
        nargs="+",
        default=K_VALUES,
        help=f"Các K cần đánh giá (mặc định: {' '.join(map(str, K_VALUES))})",
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=EVAL_OUTPUT_DIR,
        help="Thư mục lưu kết quả (mặc định: ./results)",
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Chỉ in kết quả, không in log từng bước",
    )
    args = parser.parse_args()

    if args.quiet:
        logging.getLogger().setLevel(logging.WARNING)

    # Auto-resolve test file path nếu user không truyền
    if args.new_order is None:
        for candidate in ("test.csv", "new_orders.csv"):
            p = EVAL_DATA_DIR / candidate
            if p.exists():
                args.new_order = p
                logger.info("Auto-detected test file: %s", p)
                break
        if args.new_order is None:
            logger.error(
                "Không tìm thấy test file nào trong %s "
                "(đã thử: test.csv, new_orders.csv). "
                "Hãy truyền --new-order <path>",
                EVAL_DATA_DIR,
            )
            sys.exit(1)

    try:
        result = run_benchmark(
            train_path=args.train,
            new_order_path=args.new_order,
            k_values=sorted(set(args.k)),
        )
    except FileNotFoundError as e:
        logger.error("❌ File không tồn tại: %s", e)
        logger.error("Tip: kiểm tra đường dẫn --train / --new-order có đúng không")
        sys.exit(2)
    except ValueError as e:
        logger.error("❌ Dữ liệu không hợp lệ: %s", e)
        sys.exit(3)
    except KeyboardInterrupt:
        logger.warning("⚠️  Pipeline bị ngắt bởi người dùng (Ctrl+C)")
        sys.exit(130)
    except Exception as e:
        logger.error("❌ Pipeline CRASH: %s: %s", type(e).__name__, e)
        logger.error("Traceback:\n%s", traceback.format_exc())
        sys.exit(99)

    _print_report(result)
    _save_outputs(result, args.output)

    total = result["metadata"]["total_duration_sec"]
    logger.info("=" * 60)
    logger.info("TỔNG KẾT — pipeline hoàn tất trong %.2fs (%.1f phút)", total, total / 60)
    logger.info("=" * 60)
    print(f"Kết quả đã lưu tại: {args.output}")
