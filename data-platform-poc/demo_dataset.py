#!/usr/bin/env python3
"""demo_dataset.py — bộ dữ liệu demo cả hệ: 40.000 khách · 3.000.000 đơn trên catalog 600k.

Chạy (máy demo — xem README gốc §Seed dữ liệu; KHÔNG dành cho máy dev yếu):
    docker compose --profile seed run --rm seed-catalog                          # 600k sản phẩm, làm TRƯỚC
    docker compose --profile seed run --rm seed-data                             # bộ demo này
    docker compose --profile seed run --rm seed-data demo_dataset.py --dry-run   # thử nhanh, không ghi
    docker compose --profile seed run --rm seed-data -m unittest discover -s tests -v

Vì sao có file này
──────────────────
taste_simulator.py (bộ sinh v2) mới có chế độ OFFLINE ghi CSV cho benchmark. File này là chế độ
GHI VÀO HỆ THẬT của cùng mô hình, ở quy mô demo: đơn vào Postgres như đơn thật rồi đi đúng đường
CDC → Kafka → MinIO → dbt → serving → AI-Rec. Không có đường tắt ghi thẳng vào ClickHouse hay model,
nên mọi con số trên dashboard và mọi gợi ý đều dựng lại được từ chính dữ liệu trong Postgres.

Mô hình sinh — GIỮ NGUYÊN v2 (giả định và nguồn: docstring taste_simulator.py), thêm ba thứ
──────────────────────────────────────────────────────────────────────────────────────────
  v2  gu khách θ_cat, θ_brand, θ_price ~ Dirichlet; ái lực ẩn x_iᵀy_j (phần chỉ CF học được);
      độ phổ biến nền LogNormal; trôi gu tuyến tính; tốc độ mua Gamma; mua lặp theo loại hàng
      (Bhagat et al., 2018); onboarding có nhiễu. Tham số mặc định lấy đúng giá trị của v2.
  +1  Tổng số đơn ĐÚNG bằng --orders: chia cho khách theo đa thức với xác suất ∝ λ_i × thời gian
      hoạt động — cùng tỉ lệ kỳ vọng với Poisson của v2, nhưng tổng cố định theo yêu cầu demo.
  +2  Mua kèm: dòng thiết bị (điện thoại, tablet, đồng hồ, laptop, camera) kéo theo một dòng phụ
      kiện của nhóm liên quan với xác suất --bundle-prob, ưu tiên cùng hãng (×--bundle-brand-boost).
      GIẢ ĐỊNH của bộ sinh, dựa trên quan hệ sản phẩm bổ trợ (McAuley et al., 2015).
  +3  Kênh và vòng đời đơn đi đúng các bước của server: online (checkoutService → webhookService →
      orderLifecycle) hoặc tại quầy (như pos_simulator.py); phí ship đúng pricingService.

HỆ QUẢ PHẢI NÊU KHI DÙNG KẾT QUẢ (khoá luận)
  - Đây là DỮ LIỆU GIẢ LẬP. Model học tốt vì dữ liệu được sinh CÓ cấu trúc (gu, mua kèm, mua lặp);
    con số đo trên bộ này là mức hệ khai thác được cấu trúc đó, không phải hiệu năng trên khách thật
    (Ie et al., 2019 bàn về giới hạn của đánh giá bằng mô phỏng).
  - Mặc định ~75 đơn/khách/năm là tải demo, cao hơn nhiều hành vi mua đồ công nghệ thật.

Ghi gì — mọi thứ do script sinh ra đều tháo được bằng --reset
  "B2CCustomer"         --customers khách kh00001@<--email-domain> …, chung một mật khẩu (DEMO_PASSWORD)
  "CustomerPreference"  --onboard-share số khách có onboarding (status = completed)
  "Order" / "OrderItem" --orders đơn, đánh dấu Order.customer->>'_seed' = 'demo_dataset'
  "Product".sold        = số lượng bán THẬT từ đơn đã thanh toán (--sold-mode sync; 'keep' để giữ số cũ)
  Không đụng: "Inventory" (tồn kho coi là ảnh chụp hiện tại), voucher, điểm thành viên,
  analytics.user_events (hành vi web — chưa sinh ở bản này).

Tài liệu
  Bhagat, R., Muralidharan, S., Lobzhanidze, A., & Vishwanath, S. (2018). Buy It Again: Modeling
    repeat purchase recommendations. KDD '18.
  Ie, E., Hsu, C., Mladenov, M., Jain, V., Narvekar, S., Wang, J., Wu, R., & Boutilier, C. (2019).
    RecSim: A configurable simulation platform for recommender systems. arXiv:1909.04847.
  McAuley, J., Pandey, R., & Leskovec, J. (2015). Inferring networks of substitutable and
    complementary products. KDD '15.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import os
import sys
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable, Optional

import numpy as np

# Hằng số giả định của bộ sinh v2 — import để hai bộ sinh không lệch nhau
from taste_simulator import LINES_PER_ORDER, QUANTITY, REPEAT_BY_CATEGORY, _rng, _softmax

SEED_TAG = "demo_dataset"   # dấu trên Order.customer->>'_seed'; --reset xoá đúng các đơn mang dấu này

# Tầm giá — PHẢI khớp dbt_project.yml (vars.price_bands) và server/src/routes/onboarding.js
PRICE_BANDS = (("lt5", 0), ("5to15", 5_000_000), ("15to30", 15_000_000), ("gt30", 30_000_000))

# Thiết bị → nhóm phụ kiện mua kèm (GIẢ ĐỊNH, xem +2 ở docstring). Mã danh mục cha theo
# server/scripts/seed-categories.js.
DEVICE_ACCESSORY = {
    "cat-phone": "cat-mobile-acc", "cat-tablet": "cat-mobile-acc", "cat-watch": "cat-mobile-acc",
    "cat-laptop": "cat-laptop-acc", "cat-camera": "cat-av",
}

# Phí ship — PHẢI khớp server/src/services/payment/pricingService.js (SHIPPING_FEE)
SHIPPING_FEE = {"HCM": 20_000, "HN": 20_000}
SHIPPING_FEE_DEFAULT = 40_000

# GIẢ ĐỊNH của bộ sinh (không có số liệu thật để hiệu chỉnh)
PROVINCES = (("HCM", 0.40), ("HN", 0.35), ("DN", 0.10), ("OTHER", 0.15))
POS_PROVINCES = ("HCM", "HN", "DN")            # như pos_simulator.py — quầy chỉ ở ba thành phố
POS_METHODS = (("CASH", 0.7), ("CARD", 0.3))   # như pos_simulator.py
RECENT_DAYS = 3                                # đơn trong 3 ngày cuối còn đang xử lý

# Tập giá trị hợp lệ — lấy từ comment schema.prisma và các service thanh toán
ORDER_STATUSES = {"PENDING_PAYMENT", "CONFIRMED", "SHIPPING", "DELIVERED", "CANCELLED", "COMPLETED"}
PAYMENT_STATUSES = {"UNPAID", "PENDING", "PAID", "EXPIRED", "FAILED", "CANCELLED",
                    "REFUND_REQUIRED", "REFUNDED"}

# Họ tên tất định (như pos_simulator.py, thêm tên đệm để 40k khách đỡ trùng tên)
HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng",
      "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Đinh", "Tô", "Mai", "Trịnh"]
DEM = ["Văn", "Thị", "Minh", "Ngọc", "Gia", "Hữu", "Thanh", "Đức", "Quốc", "Thu", "Bảo", "Khánh"]
TEN = ["An", "Bình", "Cường", "Dũng", "Giang", "Hà", "Hải", "Hạnh", "Hùng", "Khanh",
       "Lan", "Linh", "Long", "Mai", "Minh", "Nam", "Ngọc", "Nhung", "Phúc", "Quân",
       "Quỳnh", "Sơn", "Thảo", "Thành", "Thu", "Trang", "Trung", "Tuấn", "Vy", "Yến"]
STREETS = ["Lê Lợi", "Nguyễn Huệ", "Trần Hưng Đạo", "Hai Bà Trưng", "Lý Thường Kiệt",
           "Điện Biên Phủ", "Cách Mạng Tháng 8", "Nguyễn Trãi", "Võ Văn Tần", "Phan Đình Phùng"]
CITY_NAME = {"HCM": "TP. Hồ Chí Minh", "HN": "Hà Nội", "DN": "Đà Nẵng", "OTHER": "Cần Thơ"}

ORDER_COLUMNS = ("id", "customer", "customer_id", "province", "total", "discount", "shippingFee",
                 "subTotal", "status", "date", "payment_method", "payment_status", "payment_ref",
                 "paid_at", "paid_amount", "expires_at")
ITEM_COLUMNS = ("order_id", "product_id", "product_name", "category_id", "brand_id", "branch_id",
                "variant_id", "quantity", "unit_price", "discount", "net_amount")
# "" là giá trị có nghĩa ở hai cột này (kho tổng / không biến thể — như "Inventory"), không phải NULL
ITEM_FORCE_NOT_NULL = ("branch_id", "variant_id")
CUSTOMER_COLUMNS = ("full_name", "email", "phone", "password_hash", "loyalty_points", "avatar",
                    "provider", "created_at")
PREFERENCE_COLUMNS = ("customer_id", "status", "liked_categories", "liked_brands",
                      "disliked_categories", "disliked_brands", "price_band", "created_at", "updated_at")

DAY = 86400.0


# ── Tiện ích thuần ────────────────────────────────────────────────────────────

def price_band(price: int) -> str:
    """Mã tầm giá của một mức giá — cùng quy tắc với macro price_band của dbt."""
    band = PRICE_BANDS[0][0]
    for band_id, lower in PRICE_BANDS:
        if price >= lower:
            band = band_id
    return band


def ts(t: float) -> str:
    """Epoch giây → 'YYYY-MM-DD HH:MM:SS.mmm' (UTC) cho cột timestamp(3) của Prisma."""
    return datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]


def pg_array(values: Iterable[str]) -> str:
    """Mảng text của Postgres. Mã danh mục/hãng chỉ gồm chữ thường, số, '-' nên không cần escape."""
    return "{" + ",".join(f'"{v}"' for v in values) + "}"


def _pick(r: np.random.Generator, cdf: np.ndarray) -> int:
    """Rút một chỉ số theo hàm phân phối tích luỹ (an toàn với sai số làm tròn ở đuôi)."""
    return min(int(np.searchsorted(cdf, r.random(), side="right")), len(cdf) - 1)


def _weighted(r: np.random.Generator, options) -> str:
    values = [v for v, _ in options]
    weights = np.array([w for _, w in options], dtype=float)
    return values[_pick(r, np.cumsum(weights / weights.sum()))]


def allocate_orders(weights: np.ndarray, total: int, seed: int) -> np.ndarray:
    """Chia ĐÚNG `total` đơn cho các khách theo đa thức, xác suất ∝ weights (= λ_i × thời gian)."""
    w = np.asarray(weights, dtype=float)
    if total <= 0 or w.sum() <= 0:
        return np.zeros(len(w), dtype=np.int64)
    return _rng(seed, "allocation").multinomial(total, w / w.sum())


def customer_identity(i: int, domain: str) -> dict:
    """Danh tính tất định của khách thứ i (0-based): cùng i ra cùng người ở mọi máy."""
    pad = max(5, len(str(i + 1)))
    code = f"kh{str(i + 1).zfill(pad)}"
    email = f"{code}@{domain}"
    return {
        "key": code,
        "email": email,
        "name": f"{HO[i % len(HO)]} {DEM[(i // len(HO)) % len(DEM)]} {TEN[(i * 7 + i // 240) % len(TEN)]}",
        "phone": f"03{(10_000_000 + i * 37) % 100_000_000:08d}",
        "street": f"{(i * 13) % 500 + 1} {STREETS[i % len(STREETS)]}",
        "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={email}",
    }


# ── Tập hàng ─────────────────────────────────────────────────────────────────

@dataclass
class Universe:
    pid: np.ndarray            # mã sản phẩm (int)
    c_of: np.ndarray           # chỉ số danh mục CHA
    b_of: np.ndarray           # chỉ số hãng
    p_of: np.ndarray           # chỉ số tầm giá
    child: list                # mã danh mục lá — snapshot OrderItem.category_id
    brand_id: list
    name: list
    stock_rows: list           # mỗi món: [(variant_id, branch_id, unit_price), ...] lấy từ "Inventory"
    cats: list                 # mã danh mục cha (đã sắp)
    brands: list               # mã hãng (đã sắp)
    bands: list                # mã tầm giá có mặt (theo thứ tự PRICE_BANDS)
    items_in_cat: dict         # chỉ số danh mục cha -> mảng chỉ số món
    Y: np.ndarray              # vector ẩn của món (n × d)
    log_pop: np.ndarray        # độ phổ biến nền (log)

    def __len__(self) -> int:
        return len(self.pid)


def sample_universe(meta: list, per_cell: int, seed: int) -> list:
    """Lấy mẫu phân tầng `per_cell` món mỗi ô (danh mục cha × hãng × tầm giá) — như v2.

    `meta`: [(product_id, parent_category, brand_id, band), ...] ĐÃ sắp theo product_id. Trả về
    chỉ số trong `meta`. Ô và thứ tự trong ô chỉ phụ thuộc catalog, nên trên hai máy seed catalog
    giống nhau sẽ chọn ra cùng những sản phẩm (dù mã sản phẩm có thể khác).
    """
    cells = defaultdict(list)
    for idx, (_, parent, brand, band) in enumerate(meta):
        cells[(parent, brand, band)].append(idx)
    rng = _rng(seed, "universe")
    chosen = []
    for key in sorted(cells):
        members = cells[key]
        take = rng.choice(len(members), size=min(per_cell, len(members)), replace=False)
        chosen += [members[k] for k in sorted(take)]
    return chosen


def build_universe(items: list, seed: int, latent_dim: int, pop_sigma: float) -> Universe:
    """`items`: dict mỗi món {pid, parent, child, brand_id, band, name, stock_rows} theo thứ tự universe."""
    cats = sorted({it["parent"] for it in items})
    brands = sorted({it["brand_id"] for it in items})
    present = {it["band"] for it in items}
    bands = [b for b, _ in PRICE_BANDS if b in present]
    c_index = {c: k for k, c in enumerate(cats)}
    b_index = {b: k for k, b in enumerate(brands)}
    p_index = {p: k for k, p in enumerate(bands)}
    c_of = np.array([c_index[it["parent"]] for it in items], dtype=np.int64)
    ir = _rng(seed, "items")
    return Universe(
        pid=np.array([it["pid"] for it in items], dtype=np.int64),
        c_of=c_of,
        b_of=np.array([b_index[it["brand_id"]] for it in items], dtype=np.int64),
        p_of=np.array([p_index[it["band"]] for it in items], dtype=np.int64),
        child=[it["child"] for it in items],
        brand_id=[it["brand_id"] for it in items],
        name=[it["name"] for it in items],
        stock_rows=[it["stock_rows"] for it in items],
        cats=cats, brands=brands, bands=bands,
        items_in_cat={c: np.flatnonzero(c_of == c) for c in range(len(cats))},
        # Hai lệnh rút này giữ đúng thứ tự của v2 (Y rồi log_pop)
        Y=ir.normal(size=(len(items), latent_dim)),
        log_pop=ir.normal(0.0, pop_sigma, size=len(items)),
    )


# ── Gu khách ─────────────────────────────────────────────────────────────────

@dataclass
class Profile:
    key: str
    email: str
    name: str
    phone: str
    address: str
    avatar: Optional[str]
    province: str
    th_cat0: np.ndarray
    th_cat1: np.ndarray
    th_brand: np.ndarray
    th_price: np.ndarray
    x: np.ndarray
    lam: float                 # tốc độ mua TƯƠNG ĐỐI (kỳ vọng 1); quy mô tuyệt đối do allocate_orders đặt
    signup: float              # bắt đầu mua (epoch giây)
    created_at: float          # lúc tạo tài khoản (≤ signup)
    drifter: bool
    onboarding: Optional[dict] = None
    customer_id: Optional[int] = None   # mã trong "B2CCustomer" — gán sau khi ghi khách

    def theta_cat(self, t: float, start: float, end: float) -> np.ndarray:
        w = min(max((t - start) / (end - start), 0.0), 1.0)
        th = (1 - w) * self.th_cat0 + w * self.th_cat1
        return th / th.sum()


def draw_profile(i: int, uni: Universe, a, start: float, end: float) -> Profile:
    """Gu của khách thứ i — rút từ dòng ngẫu nhiên RIÊNG theo mã khách (không theo thứ tự xử lý)."""
    ident = customer_identity(i, a.email_domain)
    r = _rng(a.seed, "profile", ident["key"])
    nc, nb, npb = len(uni.cats), len(uni.brands), len(uni.bands)
    th_cat0 = r.dirichlet(np.full(nc, a.alpha_cat))
    drifter = bool(r.random() < a.drift_share)
    th_cat1 = r.dirichlet(np.full(nc, a.alpha_cat)) if drifter else th_cat0
    th_brand = r.dirichlet(np.full(nb, a.alpha_brand))
    th_price = r.dirichlet(np.full(npb, a.alpha_price))
    x = r.normal(size=uni.Y.shape[1])
    lam = float(r.gamma(a.rate_shape, 1.0 / a.rate_shape))
    if r.random() >= a.new_customer_share:
        signup = start
        created_at = start - r.random() * 365 * DAY        # tài khoản có từ trước cửa sổ
    else:
        signup = start + r.random() * (end - start)
        created_at = signup
    province = _weighted(r, PROVINCES)
    prof = Profile(
        key=ident["key"], email=ident["email"], name=ident["name"], phone=ident["phone"],
        address=f"{ident['street']}, {CITY_NAME[province]}", avatar=ident["avatar"],
        province=province, th_cat0=th_cat0, th_cat1=th_cat1, th_brand=th_brand, th_price=th_price,
        x=x, lam=lam, signup=signup, created_at=created_at, drifter=drifter,
    )
    if r.random() < a.onboard_share:
        prof.onboarding = draw_onboarding(r, prof, uni, a, start, end)
    return prof


def draw_onboarding(r: np.random.Generator, prof: Profile, uni: Universe, a,
                    start: float, end: float) -> dict:
    """Câu trả lời onboarding lúc đăng ký — đúng gu với xác suất --onboard-accuracy (như v2)."""
    th0 = prof.theta_cat(prof.signup, start, end)

    def noisy(vocab: list, true_idx: list) -> list:
        chosen = []
        for k in true_idx:
            pick = int(k) if r.random() < a.onboard_accuracy else int(r.integers(len(vocab)))
            if vocab[pick] not in chosen:
                chosen.append(vocab[pick])
        return chosen

    liked_cats = noisy(uni.cats, list(np.argsort(-th0)[:2]))
    disliked = []
    if r.random() < 0.5:
        worst = uni.cats[int(np.argmin(th0))]
        if worst not in liked_cats:
            disliked = [worst]
    return {
        "liked_categories": liked_cats,
        "liked_brands": noisy(uni.brands, list(np.argsort(-prof.th_brand)[:3])),
        "disliked_categories": disliked,
        "disliked_brands": [],
        "price_band": noisy(uni.bands, [int(np.argmax(prof.th_price))])[0],
    }


def persona_profile(uni: Universe, brand_by_name: dict, start: float, end: float,
                    customer: dict) -> Profile:
    """Gu CỐ ĐỊNH cho tài khoản demo (test@getshopy.vn): người dùng hệ sinh thái Apple, mua thiết bị
    cao cấp và phụ kiện di động — để người xem demo nhận ra ngay gợi ý có ăn khớp lịch sử hay không.
    Đây là lựa chọn trình diễn, không phải giả định thống kê; ghi rõ khi trình bày."""
    cat_w = {"cat-phone": 0.32, "cat-mobile-acc": 0.30, "cat-tablet": 0.12, "cat-watch": 0.10,
             "cat-av": 0.10, "cat-laptop": 0.04, "cat-laptop-acc": 0.01, "cat-camera": 0.01}
    th_cat = np.array([cat_w.get(c, 0.01) for c in uni.cats], dtype=float)
    th_brand = np.full(len(uni.brands), 0.25 / max(1, len(uni.brands)))
    for name, weight in (("apple", 0.55), ("anker", 0.15), ("samsung", 0.05)):
        bid = brand_by_name.get(name)
        if bid in uni.brands:
            th_brand[uni.brands.index(bid)] += weight
    band_w = {"lt5": 0.10, "5to15": 0.15, "15to30": 0.30, "gt30": 0.45}
    th_price = np.array([band_w[b] for b in uni.bands], dtype=float)
    return Profile(
        key="persona-test", email=customer["email"], name=customer["name"],
        phone=customer.get("phone") or "0900000000",
        address=f"1 Lê Lợi, {CITY_NAME['HCM']}", avatar=None, province="HCM",
        th_cat0=th_cat / th_cat.sum(), th_cat1=th_cat / th_cat.sum(),
        th_brand=th_brand / th_brand.sum(), th_price=th_price / th_price.sum(),
        x=np.zeros(uni.Y.shape[1]), lam=1.0, signup=start, created_at=start, drifter=False,
        customer_id=customer["id"],
    )


# ── Đơn hàng ─────────────────────────────────────────────────────────────────

@dataclass
class Stats:
    orders: int = 0
    lines: int = 0
    repeat_lines: int = 0
    bundle_lines: int = 0
    revenue_paid: int = 0
    status: Counter = field(default_factory=Counter)
    channel: Counter = field(default_factory=Counter)

    def merge(self, other: "Stats") -> None:
        self.orders += other.orders
        self.lines += other.lines
        self.repeat_lines += other.repeat_lines
        self.bundle_lines += other.bundle_lines
        self.revenue_paid += other.revenue_paid
        self.status.update(other.status)
        self.channel.update(other.channel)


def order_times(r: np.random.Generator, n: int, signup: float, end: float) -> list:
    """n thời điểm đều trong [signup, end], giờ 9–22h như v2 (Poisson có điều kiện theo số đơn)."""
    out = []
    for _ in range(n):
        d0 = signup + r.random() * (end - signup)
        t = d0 - (d0 % DAY) + (9 + r.random() * 13) * 3600
        if t > end:
            t = end - r.random() * 3600
        if t < signup:
            t = signup + r.random() * min(3600.0, max(1.0, end - signup))
        out.append(min(t, end))
    out.sort()
    return out


def lifecycle(r: np.random.Generator, channel: str, t: float, end: float, a) -> dict:
    """Trạng thái cuối của đơn — đi đúng các bước của server.

    Tại quầy  : COMPLETED + PAID ngay (pos_simulator.py).
    Online    : tạo đơn PENDING_PAYMENT (chuyển khoản) / CONFIRMED (COD) — checkoutService;
                tiền về → CONFIRMED + PAID — webhookService; giao xong → DELIVERED, COD thu tiền
                lúc giao — orderLifecycle; quá hạn chuyển khoản → CANCELLED + EXPIRED.
    Đơn trong RECENT_DAYS ngày cuối còn đang xử lý (CONFIRMED / SHIPPING).
    """
    if channel == "pos":
        return {"status": "COMPLETED", "method": _weighted(r, POS_METHODS),
                "payment": "PAID", "paid_at": t}
    transfer = r.random() < a.transfer_share
    method = "BANK_TRANSFER" if transfer else "COD"
    paid_transfer = t + 60 * (1 + r.random() * 9)                       # tiền về sau 1–10 phút
    delivered_at = t + DAY * (1 + r.random() * 3)                       # giao sau 1–4 ngày
    if t <= end - RECENT_DAYS * DAY:
        if r.random() < a.cancel_rate:
            if transfer:
                payment = "EXPIRED" if r.random() < 0.6 else "CANCELLED"
            else:
                payment = "UNPAID"
            return {"status": "CANCELLED", "method": method, "payment": payment, "paid_at": None}
        return {"status": "DELIVERED", "method": method, "payment": "PAID",
                "paid_at": paid_transfer if transfer else min(delivered_at, end)}
    u = r.random()
    status = "CONFIRMED" if u < 0.4 else ("SHIPPING" if u < 0.8 or delivered_at > end else "DELIVERED")
    if transfer:
        return {"status": status, "method": method, "payment": "PAID", "paid_at": min(paid_transfer, end)}
    if status == "DELIVERED":
        return {"status": status, "method": method, "payment": "PAID", "paid_at": delivered_at}
    return {"status": status, "method": method, "payment": "UNPAID", "paid_at": None}


class OrderIds:
    """Mã đơn duy nhất. Online 'ORD-' + 13 số ms + 7 số thứ tự (đơn thật của server chỉ có 13 số,
    nên không bao giờ trùng); tại quầy 'POS-<giây>-<7 số>' (pos_simulator.py dùng 6 số)."""

    def __init__(self, start: int = 0):
        self.k = start

    def next(self, channel: str, t: float) -> str:
        self.k += 1
        if channel == "pos":
            return f"POS-{int(t)}-{self.k:07d}"
        return f"ORD-{int(t * 1000):013d}{self.k:07d}"


def customer_orders(prof: Profile, n_orders: int, uni: Universe, a, start: float, end: float,
                    ids: OrderIds) -> tuple:
    """Sinh n_orders đơn của một khách. Trả (dòng "Order", dòng "OrderItem", Stats)."""
    r = _rng(a.seed, "orders", prof.key)
    stats = Stats()
    if n_orders <= 0:
        return [], [], stats

    # Tiện ích trong danh mục — đúng công thức v2
    v = (a.w_brand * np.log(prof.th_brand[uni.b_of] + 1e-12)
         + a.w_price * np.log(prof.th_price[uni.p_of] + 1e-12)
         + a.beta * (uni.Y @ prof.x) / math.sqrt(uni.Y.shape[1]) + uni.log_pop)
    cdf = {c: np.cumsum(_softmax(v[pool], a.tau)) for c, pool in uni.items_in_cat.items() if len(pool)}
    acc_of = {}
    for dev, acc in DEVICE_ACCESSORY.items():
        if dev in uni.cats and acc in uni.cats:
            acc_of[uni.cats.index(dev)] = uni.cats.index(acc)
    log_boost = math.log(max(a.bundle_brand_boost, 1e-9))
    lines_cdf = np.cumsum(np.array(LINES_PER_ORDER[1], dtype=float) / sum(LINES_PER_ORDER[1]))
    qty_cdf = np.cumsum(np.array(QUANTITY[1], dtype=float) / sum(QUANTITY[1]))
    customer_json_cache = {}

    def product_line(j: int) -> tuple:
        rows = uni.stock_rows[j]
        variant_id, branch_id, unit_price = rows[int(r.integers(len(rows)))]
        qty = int(QUANTITY[0][_pick(r, qty_cdf)])
        return (int(uni.pid[j]), uni.name[j], uni.child[j], uni.brand_id[j], branch_id, variant_id,
                qty, int(unit_price), 0, int(unit_price) * qty)

    bought = defaultdict(lambda: defaultdict(int))     # danh mục cha -> món -> số lần đã mua
    orders, items = [], []
    for t in order_times(r, n_orders, prof.signup, end):
        channel = "online" if r.random() < a.online_share else "pos"
        th_cdf = np.cumsum(prof.theta_cat(t, start, end))
        chosen = {}                                    # món -> (dòng, có phải mua kèm)
        for _ in range(int(LINES_PER_ORDER[0][_pick(r, lines_cdf)])):
            c = _pick(r, th_cdf)
            if c not in cdf:
                continue
            prev = bought[c]
            repeat = False
            if prev and r.random() < REPEAT_BY_CATEGORY.get(uni.cats[c], 0.05):
                its = np.array(list(prev))
                w = np.array([prev[i] for i in its], dtype=float)
                j = int(its[_pick(r, np.cumsum(w / w.sum()))])
                repeat = True
            else:
                pool = uni.items_in_cat[c]
                j = int(pool[_pick(r, cdf[c])])
                repeat = j in prev
            if j in chosen:
                continue
            chosen[j] = (product_line(j), False)
            if repeat:
                stats.repeat_lines += 1
            # Mua kèm phụ kiện cùng nhóm, ưu tiên cùng hãng với thiết bị
            if c in acc_of and r.random() < a.bundle_prob:
                pool = uni.items_in_cat[acc_of[c]]
                logits = v[pool] + log_boost * (uni.b_of[pool] == uni.b_of[j])
                k = int(pool[_pick(r, np.cumsum(_softmax(logits, a.tau)))])
                if k not in chosen:
                    chosen[k] = (product_line(k), True)
                    stats.bundle_lines += 1
        if not chosen:
            continue

        state = lifecycle(r, channel, t, end, a)
        if channel == "pos":
            province = prof.province if prof.province in POS_PROVINCES else \
                POS_PROVINCES[int(r.integers(len(POS_PROVINCES)))]
            ship = 0
        else:
            province = prof.province if r.random() < 0.9 else _weighted(r, PROVINCES)
            ship = SHIPPING_FEE.get(province, SHIPPING_FEE_DEFAULT)
        sub = sum(line[-1] for line, _ in chosen.values())
        total = sub + ship                              # không sinh voucher/điểm: discount = 0
        oid = ids.next(channel, t)

        snap_key = (channel, province)
        if snap_key not in customer_json_cache:
            if channel == "pos":
                snap = {"name": prof.name, "email": prof.email, "phone": prof.phone}
            else:   # đúng các trường form checkout gửi lên (Checkout.jsx) + province
                snap = {"full_name": prof.name, "phone": prof.phone, "email": prof.email,
                        "address": prof.address, "province": province}
            snap["_seed"] = SEED_TAG
            customer_json_cache[snap_key] = json.dumps(snap, ensure_ascii=False)
        paid = state["payment"] == "PAID"
        orders.append((oid, customer_json_cache[snap_key], prof.customer_id, province, total, 0,
                       ship, sub, state["status"], ts(t), state["method"], state["payment"], None,
                       ts(state["paid_at"]) if paid else None, total if paid else None, None))
        for j, (line, _) in chosen.items():
            items.append((oid,) + line)
            bought[int(uni.c_of[j])][j] += 1
        stats.orders += 1
        stats.lines += len(chosen)
        stats.status[state["status"] + "/" + state["payment"]] += 1
        stats.channel[channel] += 1
        if paid and state["status"] != "CANCELLED":
            stats.revenue_paid += total
    return orders, items, stats


# ── Postgres ─────────────────────────────────────────────────────────────────

def copy_sql(table: str, columns: tuple, force_not_null: tuple = ()) -> str:
    opts = "FORMAT csv"
    if force_not_null:
        opts += ", FORCE_NOT_NULL (" + ", ".join(f'"{c}"' for c in force_not_null) + ")"
    return f'COPY "{table}" (' + ", ".join(f'"{c}"' for c in columns) + f") FROM STDIN WITH ({opts})"


def copy_rows(cur, table: str, columns: tuple, rows: list, force_not_null: tuple = ()) -> int:
    """Nạp bằng COPY — nhanh hơn INSERT nhiều bậc ở quy mô triệu dòng. None → NULL."""
    if not rows:
        return 0
    buf = io.StringIO()
    csv.writer(buf, lineterminator="\n").writerows(rows)
    buf.seek(0)
    cur.copy_expert(copy_sql(table, columns, force_not_null), buf)
    return len(rows)


def connect():
    import psycopg2   # import muộn: --help và test không cần thư viện CSDL
    # DSN rỗng = libpq tự đọc PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE (compose đặt sẵn)
    conn = psycopg2.connect(os.getenv("DEMO_DSN", ""))
    conn.set_client_encoding("UTF8")
    conn.autocommit = False
    return conn


def preflight(cur, a) -> dict:
    cur.execute('SELECT count(*) FROM "Product" WHERE NOT is_deleted AND price > 0')
    products = cur.fetchone()[0]
    cur.execute('SELECT count(*) FROM "Inventory"')
    inventory = cur.fetchone()[0]
    cur.execute('SELECT count(*) FROM "B2CCustomer" WHERE email LIKE %s', (f"%@{a.email_domain}",))
    demo_customers = cur.fetchone()[0]
    cur.execute("""SELECT count(*) FROM "Order" WHERE customer->>'_seed' = %s""", (SEED_TAG,))
    demo_orders = cur.fetchone()[0]
    return {"products": products, "inventory": inventory,
            "demo_customers": demo_customers, "demo_orders": demo_orders}


def reset(conn, cur, a) -> None:
    """Tháo TOÀN BỘ dữ liệu do script này sinh. Đơn tạo tay trên tài khoản demo (không mang dấu)
    được giữ nguyên. Lưu ý: xoá hàng triệu đơn cũng sinh hàng triệu sự kiện xoá qua CDC."""
    like = f"%@{a.email_domain}"
    print("reset: xoá đơn mang dấu _seed (dòng đơn xoá theo ON DELETE CASCADE)…", flush=True)
    cur.execute("""DELETE FROM "Order" WHERE customer->>'_seed' = %s""", (SEED_TAG,))
    print(f"  {cur.rowcount:,} đơn", flush=True)
    cur.execute('DELETE FROM "Wishlist" WHERE customer_id IN '
                '(SELECT id FROM "B2CCustomer" WHERE email LIKE %s)', (like,))
    cur.execute('DELETE FROM "B2CCustomer" WHERE email LIKE %s', (like,))   # onboarding xoá theo CASCADE
    print(f"  {cur.rowcount:,} khách", flush=True)
    conn.commit()


def load_catalog(cur, a) -> tuple:
    """Toàn bộ catalog (meta để lấy mẫu) rồi chi tiết + tồn kho của riêng tập hàng U."""
    cur.execute('SELECT id, COALESCE(parent_id, id) FROM "Category"')
    parent_of = dict(cur.fetchall())
    cur.execute('SELECT id, name FROM "Brand"')
    brand_by_name = {name.strip().lower(): bid for bid, name in cur.fetchall()}
    cur.execute('SELECT id, category_id, brand_id, price FROM "Product" '
                'WHERE NOT is_deleted AND price > 0 ORDER BY id')
    meta = [(pid, parent_of.get(cat, cat), brand, price_band(int(price)))
            for pid, cat, brand, price in cur.fetchall()]
    # Chỉ giữ meta của món được chọn — không giữ cả 600k dòng trong RAM suốt lượt chạy
    parent_by_pid = {meta[i][0]: meta[i] for i in sample_universe(meta, a.per_cell, a.seed)}
    picked = list(parent_by_pid)
    del meta

    cur.execute('SELECT id, name, category_id, brand_id, price, variants FROM "Product" WHERE id = ANY(%s)',
                (picked,))
    detail = {row[0]: row for row in cur.fetchall()}
    cur.execute('SELECT product_id, variant_id, branch_id FROM "Inventory" WHERE product_id = ANY(%s) '
                'ORDER BY product_id, variant_id, branch_id', (picked,))
    inv = defaultdict(list)
    for pid, vid, bid in cur.fetchall():
        inv[pid].append((vid or "", bid or ""))

    items = []
    for pid in picked:
        _, name, child, brand, price, variants = detail[pid]
        vprice = {}
        for var in variants or []:
            if isinstance(var, dict) and var.get("id"):
                vprice[str(var["id"])] = int(var.get("price") or price)
        rows = [(vid, bid, vprice.get(vid, int(price))) for vid, bid in inv.get(pid, [])]
        if not rows:       # thiếu bản ghi tồn kho (đáng ra ensure-inventory đã tạo) — vẫn bán được
            rows = [("", "", int(price))]
        items.append({"pid": pid, "parent": parent_by_pid[pid][1], "child": child, "brand_id": brand,
                      "band": parent_by_pid[pid][3], "name": name, "stock_rows": rows})
    return items, brand_by_name


def insert_customers(conn, cur, profiles: list, password: str, domain: str) -> None:
    import bcrypt
    # Một hash cho mọi khách demo (bcrypt cố tình chậm ~100 ms/lần — 40k lần là hơn một giờ).
    # Tiền tố $2a$ để chắc chắn khớp bcryptjs của server.
    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(10, prefix=b"2a")).decode()
    rows = [(p.name, p.email, p.phone, pw_hash, 0, p.avatar, "local", ts(p.created_at)) for p in profiles]
    for k in range(0, len(rows), 20_000):
        copy_rows(cur, "B2CCustomer", CUSTOMER_COLUMNS, rows[k:k + 20_000])
    conn.commit()
    cur.execute('SELECT email, id FROM "B2CCustomer" WHERE email LIKE %s', (f"%@{domain}",))
    id_of = dict(cur.fetchall())
    for p in profiles:
        p.customer_id = id_of[p.email]


def insert_preferences(conn, cur, profiles: list) -> int:
    rows = []
    for p in profiles:
        if p.onboarding is None:
            continue
        o = p.onboarding
        at = ts(p.created_at)
        rows.append((p.customer_id, "completed", pg_array(o["liked_categories"]), pg_array(o["liked_brands"]),
                     pg_array(o["disliked_categories"]), pg_array(o["disliked_brands"]), o["price_band"], at, at))
    n = copy_rows(cur, "CustomerPreference", PREFERENCE_COLUMNS, rows)
    conn.commit()
    return n


def sync_sold(conn, cur) -> None:
    """Product.sold = tổng số lượng của đơn ĐÃ THANH TOÁN, KHÔNG HUỶ (cùng điều kiện dbt dùng cho
    AI-Rec), mọi nguồn đơn — để "bán chạy" trên web, CatalogSold và dashboard nói cùng một chuyện."""
    cur.execute("""
        CREATE TEMP TABLE _sold ON COMMIT DROP AS
        SELECT oi.product_id, SUM(oi.quantity)::int AS qty
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi.order_id
        WHERE o.payment_status = 'PAID' AND o.status <> 'CANCELLED'
        GROUP BY oi.product_id""")
    cur.execute('UPDATE "Product" p SET sold = s.qty FROM _sold s WHERE p.id = s.product_id AND p.sold <> s.qty')
    changed = cur.rowcount
    cur.execute('UPDATE "Product" p SET sold = 0 WHERE p.sold <> 0 '
                'AND NOT EXISTS (SELECT 1 FROM _sold s WHERE s.product_id = p.id)')
    changed += cur.rowcount
    conn.commit()
    print(f"Product.sold: cập nhật {changed:,} sản phẩm theo đơn đã thanh toán", flush=True)


def find_test_account(cur, email: str) -> Optional[dict]:
    cur.execute('SELECT id, full_name, email, phone FROM "B2CCustomer" WHERE email = %s', (email,))
    row = cur.fetchone()
    return None if row is None else {"id": row[0], "name": row[1], "email": row[2], "phone": row[3]}


# ── Chạy ─────────────────────────────────────────────────────────────────────

def parse_args(argv=None):
    ap = argparse.ArgumentParser(description="Sinh bộ dữ liệu demo cả hệ vào Postgres (xem docstring).")
    g = ap.add_argument_group("quy mô")
    g.add_argument("--customers", type=int, default=40_000)
    g.add_argument("--orders", type=int, default=3_000_000, help="tổng số đơn, đúng bằng con số này")
    g.add_argument("--days", type=int, default=365, help="độ dài cửa sổ thời gian của đơn")
    g.add_argument("--end", default=None,
                   help="mốc cuối (ISO, UTC); mặc định = giờ hiện tại làm tròn xuống — ghi trong manifest")
    g.add_argument("--per-cell", type=int, default=50,
                   help="số món mỗi ô (danh mục cha × hãng × tầm giá) đưa vào tập hàng bán")
    g.add_argument("--seed", type=int, default=20261004)
    g.add_argument("--chunk-customers", type=int, default=1_000, help="số khách mỗi mẻ COPY")
    g = ap.add_argument_group("tài khoản")
    g.add_argument("--email-domain", default="demo.getshopy.vn")
    g.add_argument("--test-account", default="test@getshopy.vn",
                   help="tài khoản demo được gán gu cố định; '' để bỏ")
    g.add_argument("--test-orders", type=int, default=120)
    g = ap.add_argument_group("đơn hàng (GIẢ ĐỊNH của bộ sinh)")
    g.add_argument("--online-share", type=float, default=0.75)
    g.add_argument("--transfer-share", type=float, default=0.55, help="tỉ lệ chuyển khoản trong đơn online")
    g.add_argument("--cancel-rate", type=float, default=0.08, help="tỉ lệ huỷ của đơn online đã quá hạn xử lý")
    g.add_argument("--bundle-prob", type=float, default=0.35)
    g.add_argument("--bundle-brand-boost", type=float, default=4.0)
    g = ap.add_argument_group("mô hình gu (mặc định = taste_simulator.py v2)")
    g.add_argument("--rate-shape", type=float, default=1.5)
    g.add_argument("--new-customer-share", type=float, default=0.25)
    g.add_argument("--alpha-cat", type=float, default=0.6)
    g.add_argument("--alpha-brand", type=float, default=0.15)
    g.add_argument("--alpha-price", type=float, default=1.0)
    g.add_argument("--w-brand", type=float, default=0.5)
    g.add_argument("--w-price", type=float, default=0.5)
    g.add_argument("--latent-dim", type=int, default=8)
    g.add_argument("--beta", type=float, default=1.0)
    g.add_argument("--pop-sigma", type=float, default=1.0)
    g.add_argument("--tau", type=float, default=0.7)
    g.add_argument("--drift-share", type=float, default=0.4)
    g.add_argument("--onboard-share", type=float, default=0.3)
    g.add_argument("--onboard-accuracy", type=float, default=0.8)
    g = ap.add_argument_group("vận hành")
    g.add_argument("--sold-mode", choices=("sync", "keep"), default="sync")
    g.add_argument("--min-products", type=int, default=500_000,
                   help="chặn chạy khi catalog chưa seed (seed-catalog phải chạy trước)")
    g.add_argument("--reset", action="store_true", help="xoá dữ liệu demo cũ rồi sinh lại")
    g.add_argument("--dry-run", action="store_true", help="chỉ sinh thử cho vài trăm khách, KHÔNG ghi")
    g.add_argument("--dry-run-customers", type=int, default=300)
    g.add_argument("--manifest", default=None, help="ghi tóm tắt JSON ra đường dẫn này")
    return ap.parse_args(argv)


def window(a) -> tuple:
    if a.end:
        end_dt = datetime.fromisoformat(a.end)
        end_dt = end_dt.replace(tzinfo=timezone.utc) if end_dt.tzinfo is None else end_dt
    else:
        end_dt = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    end = end_dt.timestamp()
    return end - a.days * DAY, end


def main(argv=None) -> int:
    a = parse_args(argv)
    started = time.monotonic()
    start, end = window(a)
    print(f"cửa sổ {ts(start)} → {ts(end)} UTC · {a.customers:,} khách · {a.orders:,} đơn · seed {a.seed}",
          flush=True)

    conn = connect()
    cur = conn.cursor()
    pre = preflight(cur, a)
    print(f"hiện có: {pre['products']:,} sản phẩm, {pre['inventory']:,} dòng tồn kho, "
          f"{pre['demo_customers']:,} khách demo, {pre['demo_orders']:,} đơn demo", flush=True)
    if pre["products"] < a.min_products:
        print(f"Catalog mới có {pre['products']:,} sản phẩm (< {a.min_products:,}). Chạy trước:\n"
              "  docker compose --profile seed run --rm seed-catalog", file=sys.stderr)
        return 2
    if (pre["demo_customers"] or pre["demo_orders"]) and not a.dry_run:
        if not a.reset:
            print("Đã có dữ liệu demo. Chạy lại với --reset để xoá rồi sinh lại.", file=sys.stderr)
            return 2
        reset(conn, cur, a)

    items, brand_by_name = load_catalog(cur, a)
    uni = build_universe(items, a.seed, a.latent_dim, a.pop_sigma)
    print(f"tập hàng bán: {len(uni):,} món / {len(uni.cats)} danh mục cha / {len(uni.brands)} hãng "
          f"(lấy mẫu {a.per_cell} món mỗi ô)", flush=True)

    n_customers = min(a.customers, a.dry_run_customers) if a.dry_run else a.customers
    profiles = [draw_profile(i, uni, a, start, end) for i in range(n_customers)]
    test = None
    if a.test_account:
        account = find_test_account(cur, a.test_account)
        if account is None:
            print(f"  ! không thấy {a.test_account} — bỏ phần gu cố định (seed-demo.js tạo tài khoản này)")
        else:
            test = persona_profile(uni, brand_by_name, start, end, account)
    total = a.orders if not a.dry_run else round(a.orders * n_customers / max(1, a.customers))
    test_orders = min(a.test_orders, total) if test else 0
    alloc = allocate_orders(np.array([p.lam * (end - p.signup) for p in profiles]), total - test_orders, a.seed)
    print(f"phân bổ: {int(alloc.sum()) + test_orders:,} đơn · trung vị {int(np.median(alloc))} · "
          f"p95 {int(np.percentile(alloc, 95))} · lớn nhất {int(alloc.max())} đơn/khách", flush=True)

    if not a.dry_run:
        insert_customers(conn, cur, profiles, os.getenv("DEMO_PASSWORD") or "123456", a.email_domain)
        n_pref = insert_preferences(conn, cur, profiles)
        print(f"đã ghi {len(profiles):,} khách, {n_pref:,} câu trả lời onboarding", flush=True)

    ids = OrderIds()
    stats = Stats()
    jobs = [(p, int(n)) for p, n in zip(profiles, alloc)]
    if test is not None:
        jobs.append((test, test_orders))
    for k in range(0, len(jobs), a.chunk_customers):
        batch_orders, batch_items = [], []
        for prof, n in jobs[k:k + a.chunk_customers]:
            o, i, s = customer_orders(prof, n, uni, a, start, end, ids)
            batch_orders += o
            batch_items += i
            stats.merge(s)
        if not a.dry_run:
            copy_rows(cur, "Order", ORDER_COLUMNS, batch_orders)
            copy_rows(cur, "OrderItem", ITEM_COLUMNS, batch_items, ITEM_FORCE_NOT_NULL)
            conn.commit()
        done = min(k + a.chunk_customers, len(jobs))
        elapsed = time.monotonic() - started
        print(f"  {done:,}/{len(jobs):,} khách · {stats.orders:,} đơn · {stats.lines:,} dòng · "
              f"{elapsed / 60:.1f} phút", flush=True)

    if not a.dry_run:
        if a.sold_mode == "sync":
            sync_sold(conn, cur)
        conn.autocommit = True
        cur.execute('ANALYZE "Order"; ANALYZE "OrderItem"; ANALYZE "B2CCustomer"; ANALYZE "Product"')

    manifest = {
        "generator": "data-platform-poc/demo_dataset.py",
        "dry_run": a.dry_run,
        "window_utc": [ts(start), ts(end)],
        "customers": len(profiles) + (1 if test else 0),
        "orders": stats.orders, "order_lines": stats.lines,
        "lines_per_order": round(stats.lines / max(1, stats.orders), 3),
        "repeat_line_share": round(stats.repeat_lines / max(1, stats.lines), 4),
        "bundle_line_share": round(stats.bundle_lines / max(1, stats.lines), 4),
        "paid_revenue_vnd": stats.revenue_paid,
        "channels": dict(stats.channel), "status_payment": dict(stats.status.most_common()),
        "universe_items": len(uni), "onboarded": sum(p.onboarding is not None for p in profiles),
        "test_account": a.test_account if test else None,
        "params": {k: v for k, v in vars(a).items() if k not in ("manifest",)},
        "minutes": round((time.monotonic() - started) / 60, 1),
    }
    text = json.dumps(manifest, ensure_ascii=False, indent=2)
    print(text)
    if a.manifest:
        os.makedirs(os.path.dirname(a.manifest) or ".", exist_ok=True)
        with open(a.manifest, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    if not a.dry_run:
        print("\nXong phần Postgres. Phần còn lại tự chạy: CDC → Kafka → MinIO → dbt (theo DBT_SCHEDULE) "
              "→ AI-Rec (mỗi TRAIN_INTERVAL_SECONDS). Ở quy mô này mất từ vài chục phút tới hơn một giờ — "
              "xem README gốc §Seed dữ liệu.")
    cur.close()
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
