# Hybrid Recommender — Mô hình kết hợp nhiều kênh gợi ý

> **Phiên bản:** 1.0
> **Ngày:** 2026-10-07
> **File gốc:** `models/hybrid.py`
> **Phạm vi:** Mô tả kiến trúc hybrid, cách trộn kênh, quyết định thiết kế, các tham số, và luồng inference đầy đủ.

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Ba kênh gợi ý](#2-ba-kênh-gợi-ý)
3. [Công thức trộn hybrid](#3-công-thức-trộn-hybrid)
4. [Chuẩn hoá từng kênh về [0, 1](#4-chuẩn-hoá-từng-kênh-về-01)
5. [Trọng số CF α — co rút theo lịch sử](#5-trọng-số-cf-α--co-rút-theo-lịch-sử)
6. [Trọng số mua lại γ và tham số allow_repeat](#6-trọng-số-mua-lại-γ-và-tham-số-allow_repeat)
7. [Bộ lọc "không quan tâm" (blocked)](#7-bộ-lọc-không-quan-tâm-blocked)
8. [Phá hoà (Tie-breaking)](#8-phá-hoà-tie-breaking)
9. [Lý do gợi ý (Reason)](#9-lý-do-gợi-ý-reason)
10. [Pipeline suy luận đầy đủ](#10-pipeline-suy-luận-đầy-đủ)
11. [Bảng tham số đã chọn](#11-bảng-tham-số-đã-chọn)
12. [Đặc điểm quan trọng cần nhớ](#12-đặc-điểm-quan-trọng-cần-nhớ)
13. [So sánh với các cách tiếp cận hybrid khác](#13-so-sánh-với-các-cách-tiếp-cận-hybrid-khác)
14. [Tài liệu tham khảo](#14-tài-liệu-tham-khảo)

---

## 1. Tổng quan kiến trúc

Hybrid Recommender là **điểm đến cuối cùng** của mọi yêu cầu gợi ý trong hệ AI-Rec. Nó kết hợp 3 kênh gợi ý:

```
┌──────────────────────────────────────────────────────────────┐
│                  Hybrid Recommender                           │
│                                                              │
│   ┌──────────────────┐                                      │
│   │  Kênh CF (ĉf)    │ Item-based Collaborative Filtering  │
│   │  "Khách giống bạn │ → gợi ý món tương tự món đã mua   │
│   │   cũng mua"       │   (khám phá)                       │
│   └────────┬──────────┘                                      │
│            │                                                 │
│   ┌────────▼──────────┐                                      │
│   │  Kênh CB (ĉb)    │ Content-Based Filtering             │
│   │  "Phù hợp danh   │ → gợi ý món hợp danh mục/hãng/   │
│   │   mục bạn hay mua"│   tầng giá của bạn                 │
│   └────────┬──────────┘                                      │
│            │                                                 │
│   ┌────────▼──────────┐                                      │
│   │  Kênh mua lại    │ Repeat Model                        │
│   │  "Bạn từng mua  │ → gợi ý món bạn đã mua trước đó   │
│   │   món này"        │   (mua lại)                         │
│   └────────┬──────────┘                                      │
│            │                                                 │
│            ▼                                                 │
│   final(u,i) = α·ĉf + (1−α)·ĉb + γ·rêp                     │
│            │                                                 │
│            ▼                                                 │
│   Top-K sản phẩm + Lý do gợi ý                             │
└──────────────────────────────────────────────────────────────┘
```

**Loại hybrid:** Weighted Hybrid theo phân loại của Burke (2002) — mỗi kênh được gán trọng số, điểm tổng hợp = tổng có trọng số.

---

## 2. Ba kênh gợi ý

### 2.1 Kênh CF — Collaborative Filtering

**Mục đích:** Gợi ý món **khách chưa từng mua**, dựa trên độ tương đồng với món đã mua.

**Đặc điểm:**
- **Kênh khám phá** — phát hiện sản phẩm mới, ngách
- Phụ thuộc lịch sử mua → yếu với khách mới
- Chi tiết: xem [item-based.md](./item-based.md)

**Trong hybrid:**
```python
# Món đã mua bị ZERO out — kênh CF chỉ scoring món CHƯA mua
cf_hat[purchased] = 0.0
```

### 2.2 Kênh CB — Content-Based

**Mục đích:** Gợi ý món phù hợp **đặc trưng nội dung** (danh mục/hãng/tầng giá) của khách.

**Đặc điểm:**
- **Kênh nội dung** — dựa trên sở thích khai báo và lịch sử mua
- Mạnh với khách mới (nhờ onboarding)
- Chi tiết: xem [content-based.md](./content-based.md)

**Trong hybrid:**
- Điểm CB được tính từ hồ sơ `p_u^g(v)` (phân phối xác suất trên 3 nhóm đặc trưng)
- Không bị zero-out: món đã mua vẫn giữ nguyên điểm CB (kênh mua lại xử lý)

### 2.3 Kênh mua lại — Repeat Model

**Mục đích:** Gợi ý món khách **đã từng mua** — phục vụ nhu cầu mua lại (rìu, mực, thức ăn cho thú cưng...).

**Công thức:**
```
rep(u, i) = Σ_{đơn o của u chứa món i}  0.5^(days_since_o / half_life)
```

**Đặc điểm:**
- Mỗi **lần mua** (mỗi đơn riêng) được đếm và già đi riêng
- Khác với cách cũ: tổng số lượng nhân độ gần đây của lần mua cuối
- Không lọc ngưỡng số người mua như CF
- Chi tiết: xem [repeat-model.md](./repeat-model.md) (models/repeat.py)

**Trong hybrid:**
```python
# purchased = set món đã mua từ ma trận CF
# repeat scores có thể phủ cả món dưới ngưỡng CF
```

---

## 3. Công thức trộn hybrid

```
final(u, i) = α · ĉf(u, i) + (1 − α) · ĉb(u, i) + γ · rêp(u, i)
```

| Thành phần | Kênh | Phạm vi |
|---|---|---|
| `ĉf(u, i)` | CF | [0, 1] — đã chuẩn hoá theo khách |
| `ĉb(u, i)` | CB | [0, 1] — đã chuẩn hoá theo khách |
| `rêp(u, i)` | Repeat | [0, 1] — đã chuẩn hoá theo khách |
| `α` | Trọng số CF | [0, 1] |
| `γ` | Trọng số mua lại | Mặc định: 1.0 |

**Ý nghĩa:**
- `α·ĉf`: điểm từ kênh CF, nhân với trọng số CF
- `(1−α)·ĉb`: điểm từ kênh CB, nhân với trọng số CB
- `γ·rêp`: điểm từ kênh mua lại

**Chuẩn hoá trước khi trộn:** Mỗi kênh được chuẩn hoá về `[0, 1]` theo giá trị lớn nhất CỦA KHÁCH ĐÓ, nhờ vậy `α` và `γ` so sánh được "món tốt nhất của kênh này" với "món tốt nhất của kênh kia".

---

## 4. Chuẩn hoá từng kênh về [0, 1]

```python
def _unit_max(x: np.ndarray) -> np.ndarray:
    m = float(x.max()) if x.size else 0.0
    return x / m if m > 0 else x
```

Ví dụ:

```
Kênh CF: cf_hat = [0.3, 0.1, 0.8, 0.5]
→ max = 0.8
→ ĉf = [0.375, 0.125, 1.0, 0.625]
```

→ Món có điểm cao nhất luôn về 1.0, món khác theo tỉ lệ.

**Tại sao theo khách, không phải toàn cục?**

Vì mỗi khách có mức độ tín hiệu khác nhau:
- Khách ít lịch sử: CF scores nhỏ → ĉf ≈ scores (vì max nhỏ)
- Khách nhiều lịch sử: CF scores lớn → ĉf phân biệt rõ

Nếu chuẩn hoá toàn cục (theo max của mọi khách), α không so sánh được giữa các kênh.

---

## 5. Trọng số CF α — co rút theo lịch sử

```python
@dataclass(frozen=True)
class HybridParams:
    cf_shrink_k: float = 5.0   # tham số co rút

    def alpha(self, n_items: int) -> float:
        if n_items <= 0:
            return 0.0
        if math.isinf(self.cf_shrink_k):
            return 0.0
        return n_items / (n_items + self.cf_shrink_k)
```

```
α = n_u / (n_u + k)
```

| Biến | Ý nghĩa |
|---|---|
| `n_u` | Số món **khác nhau** khách đã mua |
| `k` | Tham số co rút (mặc định 0) |

**Hành vi với k = 0:**

| `n_u` (số món đã mua) | `α` | Ý nghĩa |
|---|---|---|
| 0 | 0 | Thuần content-based |
| 1 | 1/6 ≈ 0.17 | CF chiếm 17% |
| 2 | 2/7 ≈ 0.29 | CF chiếm 29% |
| 5 | 5/10 = 0.5 | CF = CB |
| 10 | 10/15 ≈ 0.67 | CF chiếm 67% |
| ∞ | 1 | Thuần CF |

→ **Khách càng nhiều lịch sử → càng tin kênh CF** (vì tín hiệu CF đáng tin cậy hơn).

**Tại sao dùng co rút?**

- Khách ít lịch sử: CF scores có thể bị nhiễu (cosine similarity thổi lên với ít dữ liệu)
- Co rút kéo α về 0, tăng trọng số CB → giảm overfitting
- `k = 0` có nghĩa không co rút (thuần CF cho người có lịch sử)

---

## 6. Trọng số mua lại γ và tham số allow_repeat

```python
@dataclass(frozen=True)
class HybridParams:
    repeat_weight: float = 0.5   # γ
    allow_repeat: bool = True
```

### 6.1 `repeat_weight` (γ)

**Tại sao γ ≠ 1?**

Nếu γ quá cao, top-10 sẽ chủ yếu là món đã mua → khám phá = 0.

**Luật chọn γ (quyết định sản phẩm, 01/10/2026):**
- Tối đa hoá NDCG@10 tổng thể
- **VỚI ràng buộc:** trung bình 2–3 món đã mua trong top-10 trên validation
- Lý do: không ràng buộc thì γ = 10, phần lớn ô là món đã mua, khám phá ≈ 0

**Tác dụng của γ:**

| γ | Hành vi |
|---|---|
| 0 | Món đã mua chỉ lên top nhờ điểm CB |
| 1.0 | Kênh mua lại cạnh tranh ngang CF |
| Cao | Top-10 bị món đã mua chiếm |

### 6.2 `allow_repeat`

**`allow_repeat = True`** (mặc định):
- Món đã mua vẫn nằm trong ứng viên
- Điểm CF bị zero-out cho món đã mua (CF là kênh khám phá)
- Kênh mua lại quyết định điểm cho món đã mua

**`allow_repeat = False`:**
- Món đã mua bị loại hoàn toàn khỏi kết quả
- Giống hành vi CF cũ — không gợi ý món đã mua

```python
exclude = comp["blocked"].copy()
if not params.allow_repeat:
    exclude |= comp["purchased"]
```

---

## 7. Bộ lọc "không quan tâm" (blocked)

```python
def components(self, customer_id):
    # ...
    blocked = self.cb.blocked_mask(customer_id)  # True ở món bị loại
    return {
        "cf": cf_hat, "cb": cb_hat, "repeat": rep_hat,
        "purchased": purchased, "blocked": blocked, "n_items": n_u,
    }
```

`blocked_mask` trả về `True` ở món thuộc **danhh mục hoặc hãng** mà khách đã chọn "không quan tâm" ở onboarding.

**Loại khỏi kết quả:**
```python
exclude = comp["blocked"].copy()
order = order[~exclude[order]][:top_k]
```

**Đặc điểm:**
- Không trừ điểm — món bị ghét bị loại **tuyệt đối**
- Các kênh khác (CF, repeat) không thể "cứu" món bị blocked
- Chi tiết: xem [content-based.md](./content-based.md) §5

---

## 8. Phá hoà (Tie-breaking)

### 8.1 Khi nào cần phá hoà?

Khi hai món có **cùng điểm cuối cùng** — thường gặp với:
- Khách lạ (không có tín hiệu nào → mọi kênh đều = 0)
- Món cùng ô CB (điểm CB bằng nhau)

### 8.2 Thứ tự phá hoà

```python
# Trong HybridRecommender.__init__:
order = np.lexsort((np.arange(n), -catalog_sold, -popularity))
self._tiebreak = np.empty(n, dtype=np.int64)
self._tiebreak[order] = np.arange(n)
```

```
lexsort((ProductID ASC, CatalogSold DESC, Popularity DESC))
```

| Bậc | Tiêu chí | Nguồn |
|---|---|---|
| 1 | `popularity DESC` | Doanh số thật đã giảm theo thời gian |
| 2 | `catalog_sold DESC` | Số "đã bán" trên cửa hàng (sinh ngẫu nhiên) |
| 3 | `ProductID ASC` | Thứ tự tất định |

**Lưu ý:** Trong hybrid, `popularity` dùng doanh số đã giảm theo thời gian — đúng với CF. Trong `build_candidates()` của CB, `popularity` là `UnitsSold` (doanh số trong cửa sổ train) — vì vậy hai nơi dùng chung `tiebreak` không ảnh hưởng benchmark.

---

## 9. Lý do gợi ý (Reason)

Mỗi sản phẩm trong kết quả được gán một lý do, cho biết **kênh nào đã quyết định** đưa nó vào top:

```python
REASON_CF = "cf"            # "Khách giống bạn cũng mua"
REASON_CONTENT = "content"  # "Hợp danh mục/hãng/tầng giá bạn hay mua hoặc đã chọn"
REASON_REPEAT = "repeat"    # "Bạn từng mua món này"
REASON_POPULAR = "popular" # "Không có tín hiệu riêng — món bán chạy"

# Gán reason:
parts = np.vstack([w_cf[order], w_cb[order], w_rep[order]])
labels = (REASON_CF, REASON_CONTENT, REASON_REPEAT)
return [
    (product_id, score,
     labels[int(parts[:, col].argmax())] if score > 0 else REASON_POPULAR)
    for col, i in enumerate(order)
]
```

**Quy tắc gán:**
1. Lấy 3 thành phần điểm: `w_cf`, `w_cb`, `w_rep` cho món đó
2. Tìm kênh có điểm **cao nhất** → đó là lý do
3. Nếu `score = 0` (mọi kênh đều 0) → gán `REASON_POPULAR`

**Ví dụ:**

```
recommendation = [
    ("P001", 0.82, "cf"),       # kênh CF đẩy mạnh nhất
    ("P002", 0.65, "repeat"),  # kênh mua lại đẩy mạnh nhất
    ("P003", 0.41, "content"), # kênh CB đẩy mạnh nhất
    ("P004", 0.00, "popular"), # món bán chạy nhất (khách lạ)
]
```

---

## 10. Pipeline suy luận đầy đủ

Dưới đây là toàn bộ các bước khi gọi `hybrid.recommend(customer_id, top_k)`:

```
recommend(customer_id, top_k)
    │
    ├─► components(customer_id)
    │       │
    │       ├─► _cf_and_repeat(customer_id)
    │       │       │
    │       │       ├─► Lấy vector hồ sơ (mua + hành vi phụ) của khách
    │       │       ├─► Tính ĉf = cosine scores đã chuẩn hoá (món đã mua → 0)
    │       │       ├─► Lấy tập purchased từ ma trận mua
    │       │       ├─► Tính rêp = scores từ RepeatModel (hoặc ma trận CF cũ)
    │       │       └─► trả về (ĉf, rêp, purchased, n_u)
    │       │
    │       ├─► Tính ĉb = CB scores đã chuẩn hoá
    │       ├─► Tính blocked_mask từ CB
    │       └─► trả về dict: {ĉf, ĉb, rêp, purchased, blocked, n_u}
    │
    ├─► rank(components, params, top_k)
    │       │
    │       ├─► alpha = n_u / (n_u + cf_shrink_k)
    │       ├─► w_cf = alpha × ĉf
    │       ├─► w_cb = (1 − alpha) × ĉb
    │       ├─► w_rep = repeat_weight × rêp
    │       ├─► final = w_cf + w_cb + w_rep
    │       │
    │       ├─► exclude = blocked
    │       ├─► if not allow_repeat: exclude |= purchased
    │       │
    │       ├─► order = lexsort((tiebreak, -final))  ← xếp giảm theo final
    │       ├─► order = order[~exclude[order]][:top_k]
    │       │
    │       ├─► Gán reason cho từng món
    │       └─► trả về [(product_id, score, reason), ...]
    │
    └─► return list of top_k tuples
```

---

## 11. Bảng tham số đã chọn

| Tham số | Giá trị | Ý nghĩa | Ghi chú |
|---|---|---|---|
| `cf_shrink_k` | **0** | Không co rút | Thuần CF cho người có lịch sử |
| `repeat_weight (γ)` | **1.0** | Kênh mua lại = kênh CF | Cân bằng khám phá / mua lại |
| `allow_repeat` | **True** | Cho gợi ý món đã mua | Người dùng chủ động xem lại |
| Half-life | **7 ngày** | Giảm trọng số theo thời gian | Dùng chung cho cả 3 kênh |
| Input scale | **`log`** | log(1 + x) | Chống bias món sỉ |
| Onboarding pseudo-count | **1.0** | 1 lựa chọn = 1 lần mua | Đủ mạnh cho khách mới |
| `cb_candidates_per_cell` | **20** | Ứng viên CB / ô | ~6k ứng viên thay vì 600k |

**Cách chọn tham số:**
- `cf_shrink_k`, `repeat_weight`, `allow_repeat`: chọn trên **validation** bằng grid search, tối đa NDCG@10 với ràng buộc 2–3 món đã mua trong top-10
- Half-life, input scale: chọn riêng trong benchmark Item-CF
- Onboarding pseudo-count: chọn bằng thử nghiệm

---

## 12. Đặc điểm quan trọng cần nhớ

### ✅ Ưu điểm của hybrid

| Đặc điểm | Giải thích |
|---|---|
| **Giảm cold-start** | CB mạnh với khách mới (onboarding), CF mạnh với khách cũ |
| **Cân bằng khám phá / khai thác** | CF khám phá món mới, repeat khai thác món quen |
| **Giải thích được** | Mỗi gợi ý có lý do rõ ràng |
| **Bền vững** | Một kênh sai, các kênh khác bù đắp |

### ⚠️ Hạn chế

| Hạn chế | Giải thích |
|---|---|
| **Tuning phức tạp** | 3 tham số trộn (α, γ, allow_repeat) cần đánh giá kỹ |
| **Chuẩn hoá khó** | Phải đảm bảo mọi kênh về cùng thang đo trước khi trộn |
| **Không tận dụng hành vi thật** | Tín hiệu hành vi phụ đang tắt |

### 🔑 Các con số quan trọng

| Thông số | Giá trị |
|---|---|
| Số kênh | 3 (CF, CB, Repeat) |
| Tham số cần tune | 3 (cf_shrink_k, repeat_weight, allow_repeat) |
| Half-life dùng chung | 7 ngày |
| Lý do gợi ý | 4 loại |
| Điểm hoà | Phá bằng popularity → catalog_sold → product_id |

---

## 13. So sánh với các cách tiếp cận hybrid khác

Theo phân loại của Burke (2002):

| Loại | Mô tả | Hệ này có dùng? |
|---|---|---|
| **Weighted** | Cộng điểm có trọng số | ✅ Dùng (α, 1−α, γ) |
| Switching | Chuyển kênh theo ngữ cảnh | ❌ Không |
| Cascade | Lọc từng tầng | ❌ Không |
| Feature combination | Ghép đặc trưng từ nhiều nguồn | ❌ Không |
| Meta-level | Dùng output của model này làm input của model kia | ❌ Không |
| Feature augmentation | Thêm đặc trưng từ kênh này vào kênh kia | ❌ Không |

**Tại sao chọn Weighted?**

- Đơn giản, dễ hiểu, dễ tune
- Mỗi kênh giữ nguyên ý nghĩa — không bị biến dạng
- Hiệu quả trong thực nghiệm với 3 kênh

---

## 14. Tài liệu tham khảo

1. **Burke, R. (2002).** Hybrid recommender systems: Survey and experiments. *User Modeling and User-Adapted Interaction*, 12(4), 331–370. — Phân loại các cách kết hợp hybrid.

2. **Sarwar, B., Karypis, G., Konstan, J., & Riedl, J. (2001).** Item-based collaborative filtering recommendation algorithms. *WWW '01*, 285–295. — Kênh CF.

3. **Pazzani, M. J., & Billsus, D. (2007).** Content-based recommendation systems. In *The Adaptive Web* (LNCS 4321), 325–341. — Kênh CB.

4. **Anderson, A., Kumar, R., Tomkins, A., & Vassilvitskii, S. (2014).** The dynamics of repeat consumption. *WWW '14*, 419–430. — Kênh mua lại.

5. **Bhagat, R., Muralidharan, S., Lobzhanidze, A., & Vishwanath, S. (2018).** Buy It Again: Modeling repeat purchase recommendations. *KDD '18*, 62–70. — Mô hình mua lại.

6. **Hu, Y., Koren, Y., & Volinsky, C. (2008).** Collaborative filtering for implicit feedback datasets. *ICDM '08*. — Thang log cho implicit feedback.

7. **Järvelin, K., & Kekäläinen, J. (2002).** Cumulated gain-based evaluation of IR techniques. *ACM TOIS*, 20(4), 422–446. — NDCG@K trong đánh giá.
