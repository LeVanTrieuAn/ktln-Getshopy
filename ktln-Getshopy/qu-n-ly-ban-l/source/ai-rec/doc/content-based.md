# Content-Based Filtering — Mô hình gợi ý dựa trên nội dung

> **Phiên bản:** 1.0
> **Ngày:** 2026-10-07
> **File gốc:** `models/content_based.py`
> **Phạm vi:** Mô tả kiến trúc, thuật toán, cách xử lý ứng viên, và các quyết định thiết kế của mô hình Content-Based trong hệ AI-Rec.

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Biểu diễn sản phẩm](#2-biểu-diễn-sản-phẩm)
3. [Hồ sơ khách hàng](#3-hồ-sơ-khách-hàng)
4. [Cách tính điểm nội dung](#4-cách-tính-điểm-nội-dung)
5. [Xử lý tín hiệu "không quan tâm"](#5-xử-lý-tín-hiệu-không-quan-tâm)
6. [Bộ ứng viên (Candidate Selection)](#6-bộ-ứng-viên-candidate-selection)
7. [Chuẩn hoá và trọng số nhóm đặc trưng](#7-chuẩn-hoá-và-trọng-số-nhóm-đặc-trưng)
8. [Đặc điểm quan trọng cần nhớ](#8-đặc-điểm-quan-trọng-cần-nhớ)
9. [Tài liệu tham khảo](#9-tài-liệu-tham-khảo)

---

## 1. Tổng quan

**Mục đích:** Gợi ý sản phẩm phù hợp với **đặc trưng nội dung** mà khách hàng đã thể hiện qua lịch sử mua hoặc qua onboarding.

**Ý tưởng cốt lõi:** Mỗi sản phẩm được mô tả bởi 3 nhóm đặc trưng: `ParentCategory` (danh mục gốc), `Brand` (hãng), `PriceBand` (tầm giá) — đúng 3 thứ onboarding hỏi khách. Khách hàng có hồ sơ là phân phối xác suất trên mỗi nhóm. Điểm gợi ý = mức độ hồ sơ khách "phù hợp" với đặc trưng của sản phẩm.

**Vai trò trong hệ thống:**
```
final(u, i) = α · ĉf(u,i) + (1−α) · ĉb(u,i) + γ · rêp(u,i)
                                                                  ↑
                                                        Kênh Content-Based (ĉb)
```

Content-Based là kênh **nội dung** trong hybrid recommender, phục vụ:
- Khách mới (chưa có lịch sử mua → kênh CF yếu)
- Khách đã chọn sở thích onboarding (tín hiệu mạnh từ đầu)
- Kết hợp với CF để giảm cold-start cho mọi khách

---

## 2. Biểu diễn sản phẩm

Mỗi sản phẩm `i` được biểu diễn bằng **vector one-hot** trên 3 nhóm đặc trưng `G`:

```
G = { ParentCategory, Brand, PriceBand }
```

| Nhóm đặc trưng | Mô tả | Ví dụ giá trị |
|---|---|---|
| `ParentCategory` | Danh mục gốc (lấy từ `parent_id` của danh mục) | `ThucPham`, `DienTu`, `NhaCua` |
| `Brand` | Mã hãng sản xuất | `Samsung`, `Vinamilk`, `Aqua` |
| `PriceBand` | Tầm giá theo giá bán hiện tại | `lt5`, `5to15`, `15to30`, `gt30` |

**Logic `PriceBand`:**
```sql
multiIf(
    price < 5,000,000,  'lt5',       -- dưới 5 triệu
    price < 15,000,000, '5to15',     -- 5 - dưới 15 triệu
    price < 30,000,000, '15to30',    -- 15 - dưới 30 triệu
    'gt30'                          -- từ 30 triệu trở lên
)
```

Một sản phẩm chỉ mang **đúng 1 giá trị** ở mỗi nhóm. Ví dụ sản phẩm có:
- `ParentCategory = "ThucPham"`
- `Brand = "Vinamilk"`
- `PriceBand = "lt5"`

→ Vector one-hot có 1 ở vị trí tương ứng với 3 giá trị đó, 0 ở tất cả các vị trí khác.

**Ma trận đặc trưng `X`** (sản phẩm × đặc trưng):
- Dạng `scipy.sparse.csr_matrix`
- Mỗi hàng = 1 sản phẩm, mỗi cột = 1 giá trị của 1 nhóm
- Mỗi sản phẩm có đúng `len(G) = 3` phần tử khác 0 (= 1)

```python
# minh hoạ: 3 sản phẩm, 2 danh mục × 2 hãng × 2 tầng giá = 12 đặc trưng
X = [
  [1, 0,  1, 0,  1, 0],   # ThucPham / Vinamilk / lt5
  [0, 1,  0, 1,  0, 1],   # DienTu / Samsung / gt30
  [1, 0,  0, 1,  1, 0],   # ThucPham / Samsung / lt5
]
```

---

## 3. Hồ sơ khách hàng

Hồ sơ của khách `u` với nhóm đặc trưng `g` là một **phân phối xác suất** trên các giá trị có thể của `g`:

```
                    H_u(v) + c · O_u(v)
p_u^g(v) = ───────────────────────────────────
            Σ_v' ( H_u(v') + c · O_u(v') )
```

Trong đó:

| Ký hiệu | Tên | Giải thích |
|---|---|---|
| `H_u(v)` | Tổng trọng số mua | Tổng trọng số (đã giảm theo thời gian) của các món khách đã mua có giá trị `v` ở nhóm `g`. Trọng số lấy từ ma trận CF — đã nhân `0.5^(days/half_life)` với `half_life = 7 ngày`. |
| `O_u(v)` | Tín hiệu onboarding | `1` nếu khách chọn **"thích"** giá trị `v` ở onboarding, `0` nếu không chọn hoặc chọn "không quan tâm". |
| `c` | Trọng số onboarding | `ONBOARDING_PSEUDO_COUNT`, mặc định = `1.0`. Một lựa chọn onboarding có trọng số bằng 1 lần mua — đủ để hồ sơ khách mới có hướng ngay từ đầu, không quá nặng để át tín hiệu mua. |

**Ý nghĩa:** `p_u^g(v)` là xác suất khách `u` "thuộc về" giá trị `v` của nhóm `g`, cân nhắc cả lịch sử mua thật lẫn sở thích khai báo.

**Ví dụ:**

Khách `u` đã mua:
- 3 lần sữa Vinamilk (cùng hãng)
- 2 lần thịt (cùng danh mục Thực phẩm)
- 5 lần đồ dưới 5 triệu

+ Đã chọn onboarding "Thích: Thực Phẩm, Thích: Vinamilk"

→ Hồ sơ nhóm `Brand` sẽ có xác suất cao cho `Vinamilk` (3 lần mua + 1 onboarding = 4), có thể thấp cho các hãng khác.

---

## 4. Cách tính điểm nội dung

**Công thức điểm:**

```
cb(u, i) = Σ_g w_g · p_u^g(value_g(i)) / Σ_g w_g       ∈ [0, 1]
```

Hay viết gọn: điểm = **tích vô hướng** giữa vector one-hot của sản phẩm `i` và hồ sơ khách `u` (đã nhân trọng số nhóm).

**Hệ quả toán học quan trọng:**

> Mọi món cùng `(ParentCategory, Brand, PriceBand)` — tức cùng một **ô** — có **CÙNG điểm CB**.

Lý do: vector one-hot của chúng giống hệt nhau. Vì vậy:

- Không cần xếp hạng bên trong một ô theo điểm CB (vô nghĩa)
- Thứ tự trong ô là **độ phổ biến** (để benchmark/serve chọn đại diện)
- Chỉ cần vài đại diện mỗi ô làm ứng viên (xem §6)

**Ví dụ tính điểm:**

```
Hồ sơ khách u (Brand):
  Vinamilk: 0.7,  Samsung: 0.1,  Aqua: 0.2

Sản phẩm i có Brand = "Vinamilk" → vector one-hot [1, 0, 0] (giả định thứ tự)
→ cb(u, i) = 1 × 0.7 + 0 × 0.1 + 0 × 0.2 = 0.7
```

**Chuẩn hoá kênh CB trong Hybrid:**
- Trước khi trộn, `ĉb` được chuẩn hoá về `[0, 1]` theo giá trị lớn nhất CỦA KHÁCH ĐÓ (`_unit_max`)
- Nhờ vậy `α·ĉf` và `(1-α)·ĉb` so sánh được "món tốt nhất của kênh CF" với "món tốt nhất của kênh CB"

---

## 5. Xử lý tín hiệu "không quan tâm"

Khách chọn "không quan tâm" ở onboarding cho **danhh mục** và **hãng** (`BLOCKABLE_GROUPS = ("ParentCategory", "Brand")`). Tầm giá không có tuỳ chọn "không quan tâm".

**Quyết định thiết kế: LỌC CỨNG, không trừ điểm**

```python
def blocked_mask(self, customer_id: str) -> np.ndarray:
    """True ở món thuộc danh mục/hãng khách đã chọn "không quan tâm"."""
    mask = np.zeros(len(self.item_ids), dtype=bool)
    for group, values in self._blocked.get(str(customer_id), {}).items():
        mask |= np.isin(self.item_values[group], list(values))
    return mask
```

Sau đó trong `hybrid.py`, `blocked_mask` được dùng để **loại bỏ** chứ không trừ điểm:

```python
exclude = comp["blocked"].copy()
if not params.allow_repeat:
    exclude |= comp["purchased"]
order = order[~exclude[order]][:top_k]
```

**Tại sao lọc cứng thay vì trừ điểm?**

Vì hybrid trộn 3 kênh. Nếu trừ điểm CB, một món bị ghét vẫn có thể lọt top nếu kênh CF hoặc kênh mua lại đẩy đủ cao. Lọc cứng đảm bảo khách **không bao giờ thấy** món thuộc danh mục/hãng mình đã ghét, bất kể các kênh khác.

**Lưu ý:** Tín hiệu "không quan tâm" **không** cộng vào hồ sơ `p_u^g(v)` — nó chỉ nằm ở `blocked_mask`. Khách ghét một hãng không bị phạt tổng thể mà chỉ bị loại các món thuộc hãng đó.

---

## 6. Bộ ứng viên (Candidate Selection)

### Vấn đề

Toàn bộ catalog có **600.000 sản phẩm**. Duyệt hết cho mỗi khách là lãng phí, đặc biệt khi **mọi món cùng ô có điểm CB bằng nhau** — không cần hết 600k để tìm top-K.

### Giải pháp: chỉ giữ đại diện mỗi ô

Ba đặc trưng `(ParentCategory, Brand, PriceBand)` tạo ra:
- `8 nhóm × 91 hãng × 4 tầng giá ≈ 2.912 ô`
- Mỗi ô chỉ giữ tối đa **20 sản phẩm** (config: `cb_candidates_per_cell = 20`)
- **Cộng thêm:** mọi món đã có người mua (`units > 0`) — vì CF cần đặc trưng của chúng để dựng hồ sơ khách từ lịch sử mua

→ Kết quả: **~6.152 sản phẩm** thay vì 600.000

### Thứ tự xếp hạng trong mỗi ô

Thứ tự này **PHẢI khớp** với `dbt serving.product_features` (để benchmark = production):

```python
def build_candidates(catalog, units, per_cell):
    df = df.sort_values(
        CELL + ["UnitsSold", "CatalogSold", "_pid"],
        ascending=[True, True, True, False, False, True],
    )
    df["CellRank"] = df.groupby(CELL).cumcount() + 1
    return df[(df["CellRank"] <= per_cell) | (df["UnitsSold"] > 0)]
```

| Bậc ưu tiên | Tiêu chí | Lý do |
|---|---|---|
| 1 | `units DESC` | Doanh số thật — tín hiệu fact, đơn PAID, không huỷ |
| 2 | `catalog_sold DESC` | Số "đã bán" trên cửa hàng — **sinh ngẫu nhiên lúc seed**, chỉ phá hoà giữa món chưa ai mua |
| 3 | `product_id ASC` | Thứ tự tất định (deterministic) |

**Cảnh báo rò rỉ tương lai:**
- `product_features` (production) xếp theo doanh số **toàn bộ lịch sử**
- `build_candidates()` trong benchmark xếp theo doanh số **trong cửa sổ train**
- Vì vậy benchmark **KHÔNG** dùng bảng `product_features` mà gọi `build_candidates()` để tái tạo ứng viên

### Tại sao 20?

- 20 đại diện mỗi ô đủ để phủ sản phẩm đang bán + đa dạng về giá/thương hiệu
- 20 × 2.912 ô = 58.240, cộng món đã bán ≈ 6.152 (thực tế ít hơn vì nhiều ô không đủ 20 món)

---

## 7. Chuẩn hoá và trọng số nhóm đặc trưng

### Chuẩn hoá từng nhóm

Sau khi tính `mass[g, v] = H_u(v) + c·O_u(v)`, mỗi nhóm được chuẩn hoá riêng thành phân phối xác suất:

```python
for g, sl in self._group_slices.items():
    block = mass[:, sl]                    # vector con của nhóm g
    s = block.sum(axis=1, keepdims=True)
    np.divide(block, s, where=s > 0)       # p_u^g = mass / Σ mass
    self._profiles[:, sl] *= self.group_weights[g] / total_w
```

### Trọng số nhóm

Mặc định: `w_g = 1.0` cho mọi nhóm, tức 3 nhóm có trọng số bằng nhau.

Có thể tuỳ chỉnh qua `group_weights`:

```python
cb = ContentBasedModel(
    group_weights={"ParentCategory": 2.0, "Brand": 1.0, "PriceBand": 0.5}
)
```

Khi đó:
```
total_w = 2.0 + 1.0 + 0.5 = 3.5
cb(u,i) = (2.0·p_u^Cat + 1.0·p_u^Brand + 0.5·p_u^Price) / 3.5
```

Trọng số nhóm cho phép điều chỉnh mô hình ưu tiên danh mục hay giá cả hơn.

---

## 8. Đặc điểm quan trọng cần nhớ

### ✅ Ưu điểm

| Đặc điểm | Giải thích |
|---|---|
| **Không cold-start về sản phẩm** | Gợi ý được bất kỳ sản phẩm nào có đặc trưng, kể cả sản phẩm mới chưa ai mua |
| **Giải thích được** | Lý do gợi ý rõ ràng: "phù hợp với danh mục bạn hay mua" |
| **Không cần dữ liệu người khác** | Chỉ cần hồ sơ của chính khách đó |
| **Tín hiệu onboarding mạnh** | Sở thích khai báo + lịch sử mua → hồ sơ có hướng ngay từ khách mới |

### ⚠️ Hạn chế

| Hạn chế | Giải thích |
|---|---|
| **Serendipity thấp** | Chỉ gợi ý trong ô khách đã biết — không phát hiện sở thích mới |
| **Phụ thuộc đặc trưng** | Nếu 3 nhóm đặc trưng không đủ mô tả sản phẩm → hồ sơ nghèo |
| **Món cùng ô bằng điểm** | Không phân biệt được 2 sản phẩm cùng danh mục/hãng/tầm giá |
| **"Không quan tâm" cứng** | Khách có thể thay đổi sở thích nhưng không thể xem lại món đã bị loại |

### 🔑 Các con số quan trọng

| Thông số | Giá trị |
|---|---|
| Số nhóm đặc trưng | 3 |
| Số ứng viên mặc định / ô | 20 (`cb_candidates_per_cell`) |
| Trọng số onboarding mặc định | 1.0 |
| Half-life cho trọng số mua | 7 ngày (dùng chung với CF) |
| Số ô (ước tính) | ~2.912 |
| Tổng ứng viên (ước tính) | ~6.152 |

---

## 9. Tài liệu tham khảo

1. **Pazzani, M. J., & Billsus, D. (2007).** Content-based recommendation systems. In *The Adaptive Web* (LNCS 4321), 325–341. Springer. — Mô hình hồ sơ phân phối xác suất.

2. **Lops, P., de Gemmis, M., & Semeraro, G. (2011).** Content-based recommender systems: State of the art and trends. In *Recommender Systems Handbook*, 73–105. Springer. — Tổng quan phương pháp.

3. **Sarwar, B., Karypis, G., Konstan, J., & Riedl, J. (2001).** Item-based collaborative filtering recommendation algorithms. *WWW '01*, 285–295. — Kênh CF bổ trợ cho CB trong hybrid.

4. **Anderson, A. et al. (2014).** The dynamics of repeat consumption. *WWW '14*, 419–430. — Tín hiệu mua lại mà CB/CF kết hợp xử lý.

5. **Burke, R. (2002).** Hybrid recommender systems: Survey and experiments. *User Modeling and User-Adapted Interaction*, 12(4), 331–370. — Phân loại weighted hybrid.
