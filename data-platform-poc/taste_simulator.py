"""
taste_simulator.py — bộ sinh dữ liệu v2: gu ẩn theo đặc trưng, trôi dần, hành vi cùng gu.

Vì sao có bản v2 (chi tiết: ai-rec/evaluation/README.md §Hạn chế)
──────────────────────────────────────────────────────────────────
pos_simulator.py gán "gu" = lát tồn kho theo VỊ TRÍ của khách trong dòng RNG và rút lại ở
mỗi lần chạy (5 lần chạy = 5 bộ gu chồng lên nhau), rải ngày đều và có đơn ở tương lai;
seed-behavior-data.js sinh hành vi không liên quan tới gu mua. Trên dữ liệu đó không đo
được content-based, time-decay hay giá trị của tín hiệu hành vi.

Mô hình sinh — MỌI tham số là GIẢ ĐỊNH của bộ sinh, ghi kèm dữ liệu trong sim_params.json
──────────────────────────────────────────────────────────────────────────────────────────
1. Tập hàng U: lấy mẫu phân tầng --per-cell món mỗi ô (danh mục gốc × hãng × tầm giá) từ
   catalog thật, nên mọi tổ hợp đặc trưng đều có mặt.
2. Gu khách i — cố định theo (seed, mã khách), KHÔNG theo vị trí trong danh sách:
     θ_cat ~ Dir(α_cat), θ_brand ~ Dir(α_brand), θ_price ~ Dir(α_price), x_i ~ N(0, I_d)
   Món j: y_j ~ N(0, I_d), độ phổ biến nền π_j ~ LogNormal(0, σ_pop).
   Tiện ích trong một danh mục:
     v_ij = w_b·log θ_brand[b_j] + w_p·log θ_price[p_j] + β·x_iᵀy_j/√d + log π_j
   x_iᵀy_j là ái lực không giải thích được bằng đặc trưng — phần tín hiệu chỉ CF học được.
3. Trôi gu: tỉ lệ --drift-share khách có θ_cat đích khác; θ_cat(t) nội suy TUYẾN TÍNH từ
   θ_start tới θ_end trên cả cửa sổ — trôi dần, không nhảy bậc như bản cũ.
4. Đơn: tốc độ λ_i ~ Gamma; một phần khách đăng ký giữa cửa sổ (có khách mới ở giai đoạn
   test); số đơn theo quá trình Poisson; giờ 9–22h; không có ngày ở tương lai.
   Mỗi dòng: danh mục ~ θ_cat(t); với xác suất ρ_c (mua lặp phụ thuộc loại hàng — Bhagat et
   al., 2018) mua lại món đã mua trong danh mục (theo tần suất), ngược lại chọn món theo
   softmax(v/τ) trong danh mục.
5. Hành vi, chỉ trong --behavior-days ngày cuối (TTL của analytics.user_events là 90 ngày):
   - pha tìm hiểu: trước lần mua món MỚI, với xác suất q_research khách xem món đó 1–3 lần
     trong 14 ngày trước (giả định "xem trước khi mua"), và luôn bỏ giỏ ngay trước khi mua;
   - phiên duyệt: tốc độ κ·λ_i, mỗi phiên xem vài món theo softmax(v/τ_browse) — rộng hơn lúc mua;
   - dwell: log-normal, trung vị tăng theo tiện ích chuẩn hoá của món với khách (giả định;
     Yi et al., 2014 cho thấy dwell tương quan với mức hài lòng hơn click);
   - giỏ / yêu thích: xác suất logistic theo tiện ích.
6. Onboarding: tỉ lệ --onboard-share khách khai gu lúc đăng ký, mỗi lựa chọn đúng gu thật
   với xác suất --onboard-accuracy; một nửa khai thêm 1 danh mục "không quan tâm" (θ nhỏ nhất).

HỆ QUẢ PHẢI NÊU KHI DÙNG KẾT QUẢ: vì giả định 5, tín hiệu xem/dwell có giá trị dự báo mua
THEO THIẾT KẾ. Benchmark trên dữ liệu này đo mức hệ TẬN DỤNG được tín hiệu đó, không chứng
minh tín hiệu có giá trị trên khách thật (Ie et al., 2019 bàn về giới hạn của đánh giá
bằng mô phỏng).

Chạy (chế độ offline — chỉ ghi CSV, KHÔNG đụng DB; cần numpy):
  docker run --rm -v "$PWD/data-platform-poc":/sim:ro \\
    -v "$PWD/ktln-Getshopy/qu-n-ly-ban-l/source/ai-rec/evaluation/data":/data \\
    kltn-ai-rec python /sim/taste_simulator.py --catalog /data/catalog_features.csv --out /data/sim

Đầu ra (--out), cùng định dạng evaluation/export_data.sh:
  order_lines.csv       CustomerID, ProductID, Quantity, OrderID, OrderDate
  catalog_features.csv  ProductID, ParentCategory, Brand, PriceBand, CatalogSold   (chỉ tập U)
  preference_signals.csv CustomerID, Dimension, Value, Polarity
  behavior_events.csv   CustomerID, ProductID, EventType, EventTime, DwellMs, Referrer
  sim_params.json       tham số + đáp án gu (để đối chiếu)

Chế độ ghi vào Postgres (demo cả hệ, quy mô lớn): demo_dataset.py — dùng lại hằng số ở file này.

Tài liệu:
  Bhagat, R., Muralidharan, S., Lobzhanidze, A., & Vishwanath, S. (2018). Buy It Again:
    Modeling repeat purchase recommendations. KDD '18.
  Ie, E., Hsu, C., Mladenov, M., Jain, V., Narvekar, S., Wang, J., Wu, R., & Boutilier, C.
    (2019). RecSim: A configurable simulation platform for recommender systems. arXiv:1909.04847.
  Yi, X., Hong, L., Zhong, E., Liu, N. N., & Rajan, S. (2014). Beyond clicks: Dwell time for
    personalization. RecSys '14.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import zlib
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

# Mua lặp theo loại hàng — GIẢ ĐỊNH: hàng tiêu hao/phụ kiện mua lại nhiều, thiết bị hầu như không.
REPEAT_BY_CATEGORY = {
    "cat-mobile-acc": 0.30, "cat-laptop-acc": 0.25, "cat-av": 0.15, "cat-camera": 0.10,
    "cat-watch": 0.05, "cat-phone": 0.03, "cat-laptop": 0.02, "cat-tablet": 0.02,
}
LINES_PER_ORDER = ([1, 2, 3, 4], [45, 30, 17, 8])     # giữ như pos_simulator.py
QUANTITY = ([1, 2, 3], [85, 12, 3])                   # giữ như pos_simulator.py
REFERRERS = (["direct", "search", "category"], [0.4, 0.35, 0.25])


def _rng(seed: int, *keys) -> np.random.Generator:
    """Dòng ngẫu nhiên riêng theo khoá (vd. mã khách) — không phụ thuộc thứ tự duyệt."""
    return np.random.default_rng([seed] + [zlib.crc32(str(k).encode()) for k in keys])


def _softmax(v: np.ndarray, tau: float) -> np.ndarray:
    z = (v - v.max()) / tau
    p = np.exp(z)
    return p / p.sum()


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _fmt(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def load_catalog(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def sample_universe(catalog: list[dict], per_cell: int, seed: int) -> list[dict]:
    cells: dict[tuple, list[dict]] = defaultdict(list)
    for r in catalog:
        cells[(r["ParentCategory"], r["Brand"], r["PriceBand"])].append(r)
    rng = _rng(seed, "universe")
    out = []
    for key in sorted(cells):
        rows = cells[key]
        idx = rng.choice(len(rows), size=min(per_cell, len(rows)), replace=False)
        out += [rows[i] for i in sorted(idx)]
    return out


def simulate(catalog: list[dict], a: argparse.Namespace) -> dict:
    U = sample_universe(catalog, a.per_cell, a.seed)
    n_items = len(U)
    cats = sorted({r["ParentCategory"] for r in U})
    brands = sorted({r["Brand"] for r in U})
    bands = sorted({r["PriceBand"] for r in U})
    c_of = np.array([cats.index(r["ParentCategory"]) for r in U])
    b_of = np.array([brands.index(r["Brand"]) for r in U])
    p_of = np.array([bands.index(r["PriceBand"]) for r in U])
    items_in_cat = {c: np.flatnonzero(c_of == c) for c in range(len(cats))}
    pid = [r["ProductID"] for r in U]

    ir = _rng(a.seed, "items")
    Y = ir.normal(size=(n_items, a.latent_dim))
    log_pop = ir.normal(0.0, a.pop_sigma, size=n_items)

    end = datetime.fromisoformat(a.end).replace(tzinfo=timezone.utc).timestamp()
    start = end - a.days * 86400
    beh_start = end - a.behavior_days * 86400
    day = 86400.0

    order_lines, events, signals, truth = [], [], [], {}
    order_no = 0
    mean_rate = a.orders_per_customer / a.days

    for n in range(a.customers):
        cid = str(900001 + n)
        r = _rng(a.seed, "customer", cid)
        th_cat0 = r.dirichlet(np.full(len(cats), a.alpha_cat))
        drifter = r.random() < a.drift_share
        th_cat1 = r.dirichlet(np.full(len(cats), a.alpha_cat)) if drifter else th_cat0
        th_brand = r.dirichlet(np.full(len(brands), a.alpha_brand))
        th_price = r.dirichlet(np.full(len(bands), a.alpha_price))
        x = r.normal(size=a.latent_dim)
        lam = r.gamma(a.rate_shape, mean_rate / a.rate_shape)
        signup = start if r.random() >= a.new_customer_share else start + r.random() * (end - start)

        # Tiện ích trong danh mục (không đổi theo thời gian — chỉ θ_cat trôi)
        v = (a.w_brand * np.log(th_brand[b_of] + 1e-12) + a.w_price * np.log(th_price[p_of] + 1e-12)
             + a.beta * (Y @ x) / math.sqrt(a.latent_dim) + log_pop)

        def theta_cat(t: float) -> np.ndarray:
            w = (t - start) / (end - start)
            th = (1 - w) * th_cat0 + w * th_cat1
            return th / th.sum()

        # Tiện ích chuẩn hoá (dùng cho dwell/giỏ): cộng phần danh mục ở giữa cửa sổ
        full = v + a.w_cat_z * np.log(theta_cat((start + end) / 2)[c_of] + 1e-12)
        z_all = (full - full.mean()) / (full.std() + 1e-9)

        truth[cid] = {
            "theta_cat_start": dict(zip(cats, np.round(th_cat0, 4).tolist())),
            "theta_cat_end": dict(zip(cats, np.round(th_cat1, 4).tolist())),
            "drifter": bool(drifter),
            "top_brands": [brands[i] for i in np.argsort(-th_brand)[:5]],
            "theta_price": dict(zip(bands, np.round(th_price, 4).tolist())),
            "rate_per_day": round(float(lam), 5), "signup": _fmt(signup),
        }

        # ── Onboarding (lúc đăng ký, có nhiễu) ───────────────────────────
        if r.random() < a.onboard_share:
            th0 = theta_cat(signup)
            picks = [("category", cats, list(np.argsort(-th0)[:2])),
                     ("brand", brands, list(np.argsort(-th_brand)[:3])),
                     ("price_band", bands, [int(np.argmax(th_price))])]
            for dim, vocab, true_idx in picks:
                chosen = set()
                for ti in true_idx:
                    k = ti if r.random() < a.onboard_accuracy else int(r.integers(len(vocab)))
                    chosen.add(k)
                signals += [(cid, dim, vocab[k], 1) for k in sorted(chosen)]
            if r.random() < 0.5:
                worst = int(np.argmin(th0))
                if not any(s[0] == cid and s[1] == "category" and s[2] == cats[worst] for s in signals):
                    signals.append((cid, "category", cats[worst], -1))

        # ── Đơn hàng ─────────────────────────────────────────────────────
        n_orders = r.poisson(lam * (end - signup) / day)
        times = []
        for _ in range(n_orders):
            d0 = signup + r.random() * (end - signup)
            midnight = d0 - (d0 % day)
            t = midnight + (9 + r.random() * 13) * 3600
            if t > end:
                t = end - r.random() * 3600
            if t < signup:
                t = signup + r.random() * 3600
            times.append(t)
        times.sort()
        bought: dict[int, dict[int, int]] = defaultdict(lambda: defaultdict(int))  # cat -> item -> lần
        for t in times:
            order_no += 1
            oid = f"SIM-{a.seed}-{order_no:07d}"
            k_lines = int(r.choice(LINES_PER_ORDER[0], p=np.array(LINES_PER_ORDER[1]) / 100))
            chosen: dict[int, int] = {}
            for _ in range(k_lines):
                c = int(r.choice(len(cats), p=theta_cat(t)))
                prev = bought[c]
                if prev and r.random() < REPEAT_BY_CATEGORY.get(cats[c], 0.05):
                    its = np.array(list(prev))
                    w = np.array([prev[i] for i in its], dtype=float)
                    j = int(its[r.choice(len(its), p=w / w.sum())])
                    repeat = True
                else:
                    pool = items_in_cat[c]
                    j = int(pool[r.choice(len(pool), p=_softmax(v[pool], a.tau))])
                    repeat = j in prev
                if j in chosen:
                    continue
                chosen[j] = int(r.choice(QUANTITY[0], p=np.array(QUANTITY[1]) / 100))
                # Hành vi dẫn tới lần mua (chỉ trong cửa sổ hành vi)
                if t >= beh_start:
                    if not repeat and r.random() < a.q_research:
                        for _ in range(int(r.integers(1, 4))):
                            tv = t - r.random() * 14 * day
                            if tv >= max(beh_start, signup):
                                events.append(_view(cid, pid[j], tv, z_all[j] + 0.5, r, a))
                    elif repeat and r.random() < 0.3:
                        events.append(_view(cid, pid[j], t - r.random() * 3 * day, z_all[j], r, a))
                    events.append((cid, pid[j], "add_to_cart", t - (60 + r.random() * 1800), "", "direct"))
                    events.append((cid, pid[j], "purchase", t, "", "direct"))
            for j, q in chosen.items():
                bought[int(c_of[j])][j] += 1
                order_lines.append((cid, pid[j], q, oid, t))

        # ── Phiên duyệt (không mua) ───────────────────────────────────────
        s0 = max(beh_start, signup)
        n_sessions = r.poisson(a.browse_rate * lam * max(0.0, end - s0) / day)
        for _ in range(n_sessions):
            ts = s0 + r.random() * (end - s0)
            for _ in range(1 + r.poisson(a.views_per_session)):
                th = (1 - a.browse_explore) * theta_cat(ts) + a.browse_explore / len(cats)
                c = int(r.choice(len(cats), p=th / th.sum()))
                pool = items_in_cat[c]
                j = int(pool[r.choice(len(pool), p=_softmax(v[pool], a.tau_browse))])
                ev = _view(cid, pid[j], ts, z_all[j], r, a)
                events.append(ev)
                if r.random() < _sigmoid(a.cart_bias + a.cart_slope * z_all[j]):
                    events.append((cid, pid[j], "add_to_cart", ts + 30, "", ev[5]))
                if r.random() < _sigmoid(a.wish_bias + a.cart_slope * z_all[j]):
                    events.append((cid, pid[j], "add_to_wishlist", ts + 40, "", ev[5]))
                ts += 30 + r.random() * 240

    events = [e for e in events if beh_start <= e[3] <= end]
    events.sort(key=lambda e: (e[3], e[0]))
    order_lines.sort(key=lambda o: (o[4], o[3]))
    return {"universe": U, "order_lines": order_lines, "events": events, "signals": signals,
            "truth": truth, "window": {"start": _fmt(start), "end": _fmt(end), "behavior_from": _fmt(beh_start)}}


def _view(cid: str, product: str, t: float, z: float, r: np.random.Generator, a) -> tuple:
    dwell = math.exp(math.log(a.dwell_median_s) + a.dwell_slope * z + a.dwell_sigma * r.normal())
    dwell_ms = int(min(max(dwell, 2.0), 600.0) * 1000)
    ref = str(r.choice(REFERRERS[0], p=REFERRERS[1]))
    return (cid, product, "product_view", t, dwell_ms, ref)


def write(out: dict, a: argparse.Namespace) -> None:
    d = Path(a.out)
    d.mkdir(parents=True, exist_ok=True)
    with open(d / "order_lines.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["CustomerID", "ProductID", "Quantity", "OrderID", "OrderDate"])
        w.writerows((c, p, q, o, _fmt(t)) for c, p, q, o, t in out["order_lines"])
    with open(d / "catalog_features.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["ProductID", "ParentCategory", "Brand", "PriceBand", "CatalogSold"])
        w.writerows((r["ProductID"], r["ParentCategory"], r["Brand"], r["PriceBand"], r["CatalogSold"])
                    for r in out["universe"])
    with open(d / "preference_signals.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["CustomerID", "Dimension", "Value", "Polarity"])
        w.writerows(out["signals"])
    with open(d / "behavior_events.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["CustomerID", "ProductID", "EventType", "EventTime", "DwellMs", "Referrer"])
        w.writerows((c, p, e, _fmt(t), dw, ref) for c, p, e, t, dw, ref in out["events"])
    params = {k: v for k, v in vars(a).items() if k not in ("catalog", "out")}
    meta = {
        "generator": "data-platform-poc/taste_simulator.py", "params": params,
        "repeat_by_category": REPEAT_BY_CATEGORY, "window": out["window"],
        "counts": {"customers": len(out["truth"]), "universe": len(out["universe"]),
                   "orders": len({o[3] for o in out["order_lines"]}), "order_lines": len(out["order_lines"]),
                   "events": len(out["events"]), "signals": len(out["signals"])},
        "truth": out["truth"],
    }
    (d / "sim_params.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(meta["counts"], ensure_ascii=False), "->", d)


def main() -> int:
    ap = argparse.ArgumentParser(description="Bộ sinh v2: gu ẩn theo đặc trưng, trôi dần, hành vi cùng gu")
    ap.add_argument("--catalog", required=True, help="catalog_features.csv (export_data.sh)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--seed", type=int, default=20261001)
    ap.add_argument("--customers", type=int, default=500)
    ap.add_argument("--per-cell", type=int, default=2)
    ap.add_argument("--days", type=int, default=180)
    ap.add_argument("--end", default="2026-09-30T23:59:59")
    ap.add_argument("--behavior-days", type=int, default=90)
    ap.add_argument("--orders-per-customer", type=float, default=14.0, help="trung bình trên cả cửa sổ")
    ap.add_argument("--rate-shape", type=float, default=1.5, help="Gamma shape của tốc độ mua")
    ap.add_argument("--new-customer-share", type=float, default=0.25)
    ap.add_argument("--alpha-cat", type=float, default=0.6)
    ap.add_argument("--alpha-brand", type=float, default=0.15)
    ap.add_argument("--alpha-price", type=float, default=1.0)
    ap.add_argument("--w-brand", type=float, default=0.5)
    ap.add_argument("--w-price", type=float, default=0.5)
    ap.add_argument("--w-cat-z", type=float, default=0.5)
    ap.add_argument("--latent-dim", type=int, default=8)
    ap.add_argument("--beta", type=float, default=1.0, help="độ mạnh ái lực ẩn (phần chỉ CF học được)")
    ap.add_argument("--pop-sigma", type=float, default=1.0)
    ap.add_argument("--tau", type=float, default=0.7, help="nhiệt độ lúc mua")
    ap.add_argument("--tau-browse", type=float, default=1.2, help="nhiệt độ lúc duyệt (rộng hơn)")
    ap.add_argument("--drift-share", type=float, default=0.4)
    ap.add_argument("--q-research", type=float, default=0.7)
    ap.add_argument("--browse-rate", type=float, default=4.0, help="số phiên duyệt / số đơn")
    ap.add_argument("--views-per-session", type=float, default=2.5)
    ap.add_argument("--browse-explore", type=float, default=0.2)
    ap.add_argument("--dwell-median-s", type=float, default=20.0)
    ap.add_argument("--dwell-slope", type=float, default=0.5)
    ap.add_argument("--dwell-sigma", type=float, default=0.6)
    ap.add_argument("--cart-bias", type=float, default=-2.8)
    ap.add_argument("--wish-bias", type=float, default=-3.8)
    ap.add_argument("--cart-slope", type=float, default=1.0)
    ap.add_argument("--onboard-share", type=float, default=0.3)
    ap.add_argument("--onboard-accuracy", type=float, default=0.8)
    a = ap.parse_args()
    write(simulate(load_catalog(Path(a.catalog)), a), a)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
