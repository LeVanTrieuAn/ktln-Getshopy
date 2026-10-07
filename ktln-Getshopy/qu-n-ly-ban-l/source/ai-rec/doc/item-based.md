# Item-based Collaborative Filtering — Mô hình lọc cộng tác dựa trên sản phẩm

> **Phiên bản:** 2.0 (bổ sung ví dụ tính toán chi tiết)
> **Ngày:** 2026-10-07
> **File gốc:** `models/cf_recommendation.py`
> **Phạm vi:** Mô tả kiến trúc, thuật toán, **ví dụ tính từng bước**, cách xử lý cold-start, các biến thể (ma trận mua vs. ma trận hồ sơ, thang tuyến tính vs. thang log), và cách lưu/nạp model.

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Dữ liệu mẫu sẽ dùng xuyên suốt](#2-dữ-liệu-mẫu-sẽ-dùng-xuyên-suốt)
3. [Ma trận User-Item — Bước 1](#3-ma-trận-user-item--bước-1)
4. [Time Decay — Bước 2](#4-time-decay--bước-2)
5. [Input Scale — Bước 3](#5-input-scale--bước-3)
6. [Tính độ tương đồng giữa các sản phẩm — Bước 4](#6-tính-độ-tương-đồng-giữa-các-sản-phẩm--bước-4)
7. [Tính điểm gợi ý — Bước 5](#7-tính-điểm-gợi-ý--bước-5)
8. [Quy trình gợi ý đầy đủ](#8-quy-trình-gợi-ý-đầyđủ)
9. [Ma trận hồ sơ (Profile Matrix)](#9-ma-trận-hồ-sơ-profile-matrix)
10. [Xử lý Cold-Start](#10-xử-lý-cold-start)
11. [Lưu và nạp mô hình](#11-lưu-và-nạp-mô-hình)
12. [Tóm tắt các thông số quan trọng](#12-tóm-tắt-các-thông-số-quan-trọng)
13. [Tài liệu tham khảo](#13-tài-liệu-tham-khảo)

---

## 1. Tổng quan

**Mục đích:** Gợi ý món khách **chưa từng mua**, dựa trên độ **tương đồng giữa các sản phẩm**.

### 1.1 Ý tưởng cốt lõi — HIỂU ĐÚNG

> **Hai cách tiếp cận CF phổ biến:**

| Loại | Hỏi | Trả lời |
|---|---|---|
| **User-based CF** | Ai giống khách này? | Tìm khách có lịch sử mua giống → gợi ý thứ họ mua |
| **Item-based CF** (hệ này) | Sản phẩm nào tương tự sản phẩm khách đã mua? | Tìm sản phẩm được mua bởi cùng nhóm khách → gợi ý |

**Ý tưởng Item-based CF (Sarwar et al., 2001):**

> "Nếu nhiều khách mua **cùng lúc** sản phẩm A và sản phẩm B, thì A và B là hai sản phẩm **tương tự nhau**."
> "Nếu khách u đã mua sản phẩm A, và sản phẩm B tương tự A, thì khách u có thể cũng thích B."

**Ví dụ trực quan:**

```
Giả sử trong lịch sử mua:
  - Khách U1 mua: [Áo thun Nike, Quần jeans Adidas]
  - Khách U2 mua: [Áo thun Nike, Giày Nike, Tất Nike]
  - Khách U3 mua: [Áo thun Nike, Quần jeans Adidas, Giày Nike]
  - Khách U4 mua: [Quần jeans Adidas, Giày Nike]
  - Khách U5 mua: [Quần jeans Adidas]
```

**Nhận xét:**
- U1 và U3 đều mua `[Áo thun Nike, Quần jeans Adidas]` → họ giống nhau (User-based)
- NHƯNG quan trọng hơn: cả 5 khách đều mua **Áo thun Nike** → các sản phẩm "họ mua cùng với Áo thun Nike" tương tự Áo thun Nike
- Cụ thể: Quần jeans Adidas có 3/5 khách cùng mua → tương tự cao với Áo thun Nike

→ Khi khách mới mua **Áo thun Nike**, ta gợi ý **Quần jeans Adidas** (vì chúng tương tự nhau).

### 1.2 Phân biệt User-based vs. Item-based

**User-based CF (ý tưởng bạn mô tả):**
```
Ý tưởng: A mua {X, Y} → B mua {X, Y, Z} → A có thể mua Z
```

Đây là logic: "A và B là **người giống nhau** (cùng mua X, Y), nên B mua Z thì A cũng có thể mua Z."

**Item-based CF (hệ này dùng):**
```
Ý tưởng: Nhiều người mua X → họ cũng mua Y → X và Y tương tự nhau
```

Đây là logic: "X và Y được mua bởi **cùng nhóm người**, nên ai mua X cũng có thể thích Y."

### 1.3 Tại sao hệ này chọn Item-based CF?

| Tiêu chí | User-based CF | Item-based CF (hệ này) |
|---|---|---|
| Số lần tính similarity | Thay đổi theo số khách mới | Ổn định (sản phẩm ít thay đổi) |
| Dimensionality | Thay đổi | Cố định |
| Interpretabiliy | "Người giống bạn cũng mua" | "Sản phẩm tương tự sản phẩm bạn đã mua" |
| Performance | Chậm với nhiều users | Nhanh với sparse matrix |

### 1.4 Công thức cốt lõi

$$\hat{r}_{ui} = \sum_{p \in \mathcal{P}_u} w_{up} \cdot \text{sim}(p, i)$$

| Ký hiệu | Ý nghĩa |
|---|---|
| $\hat{r}_{ui}$ | Điểm gợi ý sản phẩm $i$ cho khách $u$ |
| $\mathcal{P}_u = \{p : R_{up} > 0\}$ | Tập sản phẩm khách $u$ đã mua |
| $w_{up}$ | Trọng số mua của khách $u$ với sản phẩm $p$ |
| $\text{sim}(p, i) \in [0, 1]$ | Độ tương đồng cosine giữa sản phẩm $p$ và $i$ |

**Diễn giải từng bước:**
1. Với mỗi sản phẩm $p$ khách đã mua, tính $\text{sim}(p, i)$ — sản phẩm $i$ tương tự $p$ bao nhiêu?
2. Nhân với $w_{up}$ — khách $u$ mua $p$ "mạnh" bao nhiêu?
3. Cộng tổng cho mọi $p$ khách đã mua.

### 1.5 Ví dụ trực quan hoàn chỉnh

```
Bước 1: Xem lịch sử mua
─────────────────────────────────────────────────────────────────
Khách      │ Sản phẩm đã mua
───────────┼─────────────────────────────────────────────────────
U1         │ [Laptop Dell XPS, Chuột Logitech]
U2         │ [Laptop Dell XPS, Tai nghe Sony, Chuột Logitech]
U3         │ [Laptop Dell XPS, Tai nghe Sony]
U4         │ [Bàn phím Dell]
─────────────────────────────────────────────────────────────────

Bước 2: Tính similarity giữa các sản phẩm
─────────────────────────────────────────────────────────────────
Câu hỏi: "Tai nghe Sony" tương tự sản phẩm nào?

  - Tai nghe Sony & Laptop Dell XPS:
    → Cùng mua bởi: U2, U3 (2 khách)
    → Cả hai được nhiều khách mua chung → similarity CAO

  - Tai nghe Sony & Chuột Logitech:
    → Cùng mua bởi: U2 (1 khách)
    → Chỉ 1 khách mua chung → similarity THẤP

  - Tai nghe Sony & Bàn phím Dell:
    → Không có khách nào mua chung → similarity = 0

→ sim(Tai nghe Sony, Laptop Dell XPS) > sim(Tai nghe Sony, Chuột Logitech)

Bước 3: Gợi ý cho khách U4 (chỉ mua Bàn phím Dell)
─────────────────────────────────────────────────────────────────
U4 đã mua: [Bàn phím Dell]

Với i = "Tai nghe Sony":
  sim(Bàn phím Dell, Tai nghe Sony) = 0 → điểm = 0

Với i = "Laptop Dell XPS":
  sim(Bàn phím Dell, Laptop Dell XPS) = 0 → điểm = 0

→ U4 nhận được: Most-Popular (cold-start)

Bước 3 (giả sử U4 mua thêm Laptop Dell XPS):
─────────────────────────────────────────────────────────────────
U4 đã mua: [Bàn phím Dell, Laptop Dell XPS]

Với i = "Tai nghe Sony":
  sim(Laptop Dell XPS, Tai nghe Sony) = CAO → điểm cao
  sim(Bàn phím Dell, Tai nghe Sony) = 0
  → Gợi ý: Tai nghe Sony cho U4
─────────────────────────────────────────────────────────────────
```

### 1.6 Vai trò trong hệ thống
```
final(u, i) = α · ĉf(u,i) + (1−α) · ĉb(u,i) + γ · rêp(u,i)
                                                      ↑
                                            Kênh CF — khám phá (ĉf)
```

**Điểm khác biệt với User-based CF:**
- Item-based ổn định hơn vì đặc tính sản phẩm ít thay đổi
- Ma trận item × user nhỏ hơn user × user (số sản phẩm < số khách trong thương mại điện tử)
- Tính toán cosine similarity trên vector sản phẩm (mỗi vector = 1 cột của ma trận user-item)

### 1.7 So sánh User-based vs. Item-based CF

**User-based CF (ý tưởng bạn mô tả ban đầu):**

> "A mua X, Y; B mua X, Y, Z → A có thể mua Z"

Logic: Tìm **người giống bạn** → Gợi ý thứ họ mua mà bạn chưa mua.

```
Bước 1: Tìm người giống U1
  U1: [P1, P2]
  U2: [P1, P2, P3]  ← giống U1 nhất (cùng mua P1, P2)
  U3: [P1, P4]      ← ít giống hơn
  U4: [P2, P3]      ← ít giống hơn

Bước 2: Gợi ý cho U1 dựa trên U2
  U2 mua P3 mà U1 chưa mua
  → Gợi ý P3 cho U1
```

**Item-based CF (hệ này dùng):**

> "Nhiều người mua X → họ cũng mua Y → X và Y tương tự nhau."

Logic: Tìm **sản phẩm tương tự** sản phẩm bạn đã mua → Gợi ý sản phẩm đó.

```
Bước 1: Tính similarity giữa các sản phẩm
  P1 được mua bởi: U1, U2, U3
  P2 được mua bởi: U1, U3, U4
  P3 được mua bởi: U2, U4
  P4 được mua bởi: U3

  Cùng mua bởi bao nhiêu người?
  sim(P1, P2) = 2 (U1, U3) → CAO
  sim(P1, P3) = 1 (U2)     → THẤP
  sim(P2, P3) = 1 (U4)     → THẤP
  sim(P2, P4) = 1 (U3)     → THẤP

Bước 2: Gợi ý cho U1 (đã mua P1, P2)
  U1 đã mua P1, P2

  Với sản phẩm i = P3:
    P1 tương tự P3? → sim(P1, P3) = THẤP → điểm thấp
    P2 tương tự P3? → sim(P2, P3) = THẤP → điểm thấp
    → P3 có thể không được gợi ý

  Với sản phẩm i = P4:
    P1 tương tự P4? → sim(P1, P4) = 0 (không cùng khách)
    P2 tương tự P4? → sim(P2, P4) = THẤP
    → P4 không được gợi ý mạnh

  → Kết quả: U1 có thể được gợi ý Most-Popular (cold-start cho cặp này)
```

**Điểm khác biệt then chốt:**

| | User-based CF | Item-based CF (hệ này) |
|---|---|---|
| **Tính similarity** | Giữa 2 khách | Giữa 2 sản phẩm |
| **Câu hỏi** | "Ai giống bạn?" | "Sản phẩm nào tương tự sản phẩm bạn đã mua?" |
| **Góc nhìn** | Tìm người giống bạn | Tìm sản phẩm tương tự |
| **Ma trận similarity** | user × user | item × item |

**Vì sao hệ này chọn Item-based?**
- Sản phẩm ít thay đổi → similarity ổn định theo thời gian
- Interpretabiliy tốt: "sản phẩm này được nhiều người mua cùng với sản phẩm bạn đã mua" → dễ giải thích cho người dùng
- Hiệu năng: cosine similarity trên vector sản phẩm (cột) tính bằng 1 phép nhân ma trận

---

## 2. Dữ liệu mẫu sẽ dùng xuyên suốt

Để bạn cụ thể hoá được từng phép tính, tôi sẽ dùng **một bộ dữ liệu mẫu nhỏ** chạy xuyên suốt tài liệu.

### 2.1 Bảng đơn hàng gốc (4 khách, 4 sản phẩm)

| OrderID | CustomerID | ProductID | Quantity | DaysSince |
|---|---|---|---|---|
| O001 | U1 | P1 | 2 | 1 |
| O002 | U1 | P2 | 1 | 3 |
| O003 | U2 | P1 | 1 | 2 |
| O004 | U2 | P3 | 3 | 10 |
| O005 | U3 | P1 | 2 | 0 |
| O006 | U3 | P3 | 1 | 5 |
| O007 | U3 | P4 | 2 | 14 |
| O008 | U4 | P2 | 1 | 7 |
| O009 | U4 | P4 | 1 | 21 |

Giải thích:
- 4 khách: U1, U2, U3, U4
- 4 sản phẩm: P1, P2, P3, P4
- `DaysSince` = số ngày kể từ lần mua đến thời điểm train (để tính time decay)

### 2.2 Quan sát nhanh bằng mắt

| | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| **U1** | 2 (1d) | 1 (3d) | — | — |
| **U2** | 1 (2d) | — | 3 (10d) | — |
| **U3** | 2 (0d) | — | 1 (5d) | 2 (14d) |
| **U4** | — | 1 (7d) | — | 1 (21d) |

**Dự đoán trước khi tính:**
- P1 và P3 được mua bởi cùng tập khách {U1, U2, U3} → `sim(P1, P3)` cao
- P2 chỉ có U1, U4 → ít tương đồng
- P4 chỉ có U3, U4 → ít tương đồng

---

## 3. Ma trận User-Item — Bước 1

### 3.1 Khái niệm

Ma trận User-Item ký hiệu $R \in \mathbb{R}^{|U| \times |I|}$ với:

$$R_{ui} = \begin{cases} w_{ui} & \text{nếu khách } u \text{ đã tương tác sản phẩm } i \\ 0 & \text{ngược lại} \end{cases}$$

Trong đó $w_{ui}$ là trọng số (sẽ được tính ở Bước 2 và 3).

### 3.2 Cách tạo

```
(CustomerID, ProductID, Quantity) gốc
         │
         ▼
    groupby + sum    → (CustomerID, ProductID, Weight) đã cộng dồn
         │
         ▼
    sort by (CustomerID, ProductID)   ← thứ tự tất định
         │
         ▼
    map ID → index (int)
         │
         ▼
    build csr_matrix((values, (row, col)), shape=(n_users, n_items))
```

### 3.3 Ví dụ — Khung ma trận (chưa có trọng số)

Với dữ liệu mẫu, ta có khung ma trận (chưa tính decay + log):

|  | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| **U1** | 2 | 1 | 0 | 0 |
| **U2** | 1 | 0 | 3 | 0 |
| **U3** | 2 | 0 | 1 | 2 |
| **U4** | 0 | 1 | 0 | 1 |

Dạng `csr_matrix` lưu trữ 9 phần tử khác 0 + 7 phần tử 0 (= 16 ô). Sparsity = 7/16 ≈ 44%. Với dữ liệu thật (600k sản phẩm, vài triệu khách), sparsity ≈ 99.99%.

### 3.4 Hai loại ma trận

| Tên | Mục đích | Nguồn |
|---|---|---|
| **Ma trận MUA** ($R^{buy}$) | Loại món khỏi gợi ý, ground truth, popular items | Chỉ `fact_orders_detail` (đơn PAID) |
| **Ma trận HỒ SƠ** ($R^{prof}$) | Tính điểm CF | Mua + hành vi phụ |

Khi hành vi phụ **tắt** (mặc định), hai ma trận bằng nhau: $R^{prof} = R^{buy}$.

---

## 4. Time Decay — Bước 2

### 4.1 Công thức toán học

Mỗi tương tác được giảm trọng số theo công thức **hàm mũ suy giảm (exponential decay)**:

$$w = q \cdot \left(\frac{1}{2}\right)^{d / h}$$

Trong đó:

| Ký hiệu | Tên | Giá trị mặc định |
|---|---|---|
| $q$ | `Quantity` — số lượng mua gốc | Từ `fact_orders_detail` |
| $d$ | `DaysSince` — số ngày kể từ lần mua | Tính đến thời điểm train |
| $h$ | `half_life_days` — chu kỳ bán rã | **7** ngày (chọn trên validation) |
| $w$ | trọng số sau decay | Dùng cho ma trận |

### 4.2 Cách hiểu "chu kỳ bán rã" (half-life)

> Sau $h$ ngày, trọng số giảm còn một nửa.

Tính $2^{-d/h}$ cho một số giá trị:

| $d$ (ngày) | $2^{-d/7}$ | Nghĩa |
|---|---|---|
| 0 | $2^0 = 1.000$ | Mua hôm nay — giữ nguyên |
| 7 | $2^{-1} = 0.500$ | Sau 1 chu kỳ — giảm một nửa |
| 14 | $2^{-2} = 0.250$ | Sau 2 chu kỳ — còn 1/4 |
| 21 | $2^{-3} = 0.125$ | Sau 3 chu kỳ — còn 1/8 |
| 28 | $2^{-4} = 0.0625$ | Sau 4 chu kỳ — còn ~6% |

### 4.3 Ví dụ — Tính decay cho từng dòng

Áp dụng $w = q \cdot 2^{-d/7}$ cho bảng đơn hàng gốc:

| OrderID | CustomerID | ProductID | $q$ | $d$ | $2^{-d/7}$ | $w = q \cdot 2^{-d/7}$ |
|---|---|---|---|---|---|---|
| O001 | U1 | P1 | 2 | 1 | $2^{-1/7} = 0.907$ | $2 \times 0.907 = 1.814$ |
| O002 | U1 | P2 | 1 | 3 | $2^{-3/7} = 0.741$ | $1 \times 0.741 = 0.741$ |
| O003 | U2 | P1 | 1 | 2 | $2^{-2/7} = 0.820$ | $1 \times 0.820 = 0.820$ |
| O004 | U2 | P3 | 3 | 10 | $2^{-10/7} = 0.374$ | $3 \times 0.374 = 1.122$ |
| O005 | U3 | P1 | 2 | 0 | $2^0 = 1.000$ | $2 \times 1.000 = 2.000$ |
| O006 | U3 | P3 | 1 | 5 | $2^{-5/7} = 0.609$ | $1 \times 0.609 = 0.609$ |
| O007 | U3 | P4 | 2 | 14 | $2^{-2} = 0.250$ | $2 \times 0.250 = 0.500$ |
| O008 | U4 | P2 | 1 | 7 | $2^{-1} = 0.500$ | $1 \times 0.500 = 0.500$ |
| O009 | U4 | P4 | 1 | 21 | $2^{-3} = 0.125$ | $1 \times 0.125 = 0.125$ |

### 4.4 Ma trận sau decay (chưa log)

|  | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| **U1** | 1.814 | 0.741 | 0 | 0 |
| **U2** | 0.820 | 0 | 1.122 | 0 |
| **U3** | 2.000 | 0 | 0.609 | 0.500 |
| **U4** | 0 | 0.500 | 0 | 0.125 |

**Quan sát:**
- U3 mua P4 cách 14 ngày, q=2 → w=0.500
- U4 mua P4 cách 21 ngày, q=1 → w=0.125 → **nhẹ hơn 4 lần** dù cùng món

### 4.5 Tại sao cần Time Decay?

1. **Sở thích thay đổi theo thời gian:** Mua laptop 2 năm trước không còn là tín hiệu cho nhu cầu hiện tại.
2. **Recency là tín hiệu mạnh nhất trong implicit feedback** (theo Anderson et al., 2014).
3. **Ngăn cold-start ngược:** Nếu không giảm, món mua 3 năm trước vẫn nặng ngang món mua tuần trước → bias về sản phẩm cũ.

### 4.6 Tắt Time Decay

Đặt $h \le 0$: trả nguyên $w = q$. Không cần sửa code.

---

## 5. Input Scale — Bước 3

### 5.1 Công thức

Sau khi có $w_{mâu}$ (sau decay), áp dụng **hàm lượng giác log** để chống bias món sỉ:

$$v = \ln(1 + w)$$

| Mode | Công thức | Ký hiệu trong code |
|---|---|---|
| `linear` | $v = q \cdot 2^{-d/h}$ | Giữ nguyên |
| `log` **(đã chọn)** | $v = \ln(1 + q \cdot 2^{-d/h})$ | `np.log1p(w)` |

### 5.2 Ví dụ — Áp dụng log cho từng ô

Lấy ma trận sau decay ở §4.4, áp $v = \ln(1 + w)$:

| | P1 ($w$) | P1 ($v$) | P2 ($w$) | P2 ($v$) | P3 ($w$) | P3 ($v$) | P4 ($w$) | P4 ($v$) |
|---|---|---|---|---|---|---|---|---|
| **U1** | 1.814 | $\ln 2.815 = 1.035$ | 0.741 | $\ln 1.741 = 0.555$ | 0 | 0 | 0 | 0 |
| **U2** | 0.820 | $\ln 1.820 = 0.599$ | 0 | 0 | 1.122 | $\ln 2.122 = 0.752$ | 0 | 0 |
| **U3** | 2.000 | $\ln 3.000 = 1.099$ | 0 | 0 | 0.609 | $\ln 1.609 = 0.476$ | 0.500 | $\ln 1.500 = 0.405$ |
| **U4** | 0 | 0 | 0.500 | $\ln 1.500 = 0.405$ | 0 | 0 | 0.125 | $\ln 1.125 = 0.118$ |

### 5.3 Ma trận cuối cùng $R$ (sau decay + log)

$$R = \begin{pmatrix}
1.035 & 0.555 & 0 & 0 \\
0.599 & 0 & 0.752 & 0 \\
1.099 & 0 & 0.476 & 0.405 \\
0 & 0.405 & 0 & 0.118
\end{pmatrix}$$

Đây chính là $R^{prof}$ khi hành vi phụ tắt. Khi hành vi phụ bật, sẽ cộng thêm tín hiệu xem/giỏ/wishlist.

### 5.4 So sánh tuyến tính vs. log

| Tình huống | Linear | Log |
|---|---|---|
| Mua 1 cái ($w=1$) | $v = 1$ | $v = \ln 2 = 0.693$ |
| Mua 10 cái ($w=10$) | $v = 10$ | $v = \ln 11 = 2.398$ |
| Tỉ số 10/1 | $10$ | $2.398 / 0.693 \approx 3.46$ |

→ Mua 10 cái ở thang log chỉ "nặng" 3.46 lần mua 1 cái, không phải 10 lần. Vector cột của món đó bớt lệch về khách mua sỉ.

### 5.5 Tại sao chọn `log`?

- **Bài toán implicit feedback** (Hu et al., 2008): số lượng mua là tín hiệu về *sở thích*, không phải *sản lượng*.
- Mua 1 cái 3 lần (gần đây) nên nặng tương đương mua 5 cái 1 lần (xa) — thang log phản ánh đúng hơn.

---

## 6. Tính độ tương đồng giữa các sản phẩm — Bước 4

### 6.1 Cosine similarity — Công thức

Mỗi sản phẩm $i$ là vector cột $R_{\cdot i} \in \mathbb{R}^{|U|}$. Cosine similarity:

$$\text{sim}(p, i) = \cos(\theta_{p,i}) = \frac{R_{\cdot p} \cdot R_{\cdot i}}{\|R_{\cdot p}\| \cdot \|R_{\cdot i}\|} = \frac{\sum_{u} R_{up} \cdot R_{ui}}{\sqrt{\sum_u R_{up,u}^2} \cdot \sqrt{\sum_u R_{ui,u}^2}}$$

Trong đó:
- $R_{\cdot p} \cdot R_{\cdot i}$: tích vô hướng hai vector cột
- $\|R_{\cdot p}\| = \sqrt{\sum_u R_{up}^2}$: chuẩn L2 của vector

### 6.2 Ví dụ — Tính sim(P1, P3) bằng tay

Lấy 2 cột P1 và P3 từ ma trận $R$ ở §5.3:

$$R_{\cdot P1} = \begin{pmatrix} 1.035 \\ 0.599 \\ 1.099 \\ 0 \end{pmatrix} \qquad R_{\cdot P3} = \begin{pmatrix} 0 \\ 0.752 \\ 0.476 \\ 0 \end{pmatrix}$$

**Bước 1: Tích vô hướng**

$$R_{\cdot P1} \cdot R_{\cdot P3} = 1.035 \cdot 0 + 0.599 \cdot 0.752 + 1.099 \cdot 0.476 + 0 \cdot 0$$

$$= 0 + 0.450 + 0.523 + 0 = 0.973$$

**Bước 2: Chuẩn L2**

$$\|R_{\cdot P1}\| = \sqrt{1.035^2 + 0.599^2 + 1.099^2 + 0^2} = \sqrt{1.071 + 0.359 + 1.208 + 0} = \sqrt{2.638} = 1.624$$

$$\|R_{\cdot P3}\| = \sqrt{0^2 + 0.752^2 + 0.476^2 + 0^2} = \sqrt{0 + 0.566 + 0.227 + 0} = \sqrt{0.793} = 0.890$$

**Bước 3: Cosine**

$$\text{sim}(P1, P3) = \frac{0.973}{1.624 \times 0.890} = \frac{0.973}{1.445} = 0.673$$

### 6.3 Tối ưu bằng L2-normalize

Nếu ta chuẩn hoá vector để có chuẩn L2 = 1:

$$\tilde{R}_{\cdot i} = \frac{R_{\cdot i}}{\|R_{\cdot i}\|} \quad \Rightarrow \quad \|\tilde{R}_{\cdot i}\| = 1$$

Thì cosine trở thành **tích vô hướng đơn giản**:

$$\text{sim}(p, i) = \tilde{R}_{\cdot p} \cdot \tilde{R}_{\cdot i} = \sum_u \tilde{R}_{up} \cdot \tilde{R}_{ui}$$

**Áp dụng cho dữ liệu mẫu:**

$$\tilde{R}_{\cdot P1} = \frac{1}{1.624}\begin{pmatrix} 1.035 \\ 0.599 \\ 1.099 \\ 0 \end{pmatrix} = \begin{pmatrix} 0.637 \\ 0.369 \\ 0.677 \\ 0 \end{pmatrix}$$

$$\tilde{R}_{\cdot P3} = \frac{1}{0.890}\begin{pmatrix} 0 \\ 0.752 \\ 0.476 \\ 0 \end{pmatrix} = \begin{pmatrix} 0 \\ 0.845 \\ 0.535 \\ 0 \end{pmatrix}$$

**Kiểm tra:**

$$\tilde{R}_{\cdot P1} \cdot \tilde{R}_{\cdot P3} = 0.637 \cdot 0 + 0.369 \cdot 0.845 + 0.677 \cdot 0.535 + 0 \cdot 0$$

$$= 0 + 0.312 + 0.362 + 0 = 0.674 \approx 0.673 \quad \checkmark$$

(Chênh lệch 0.001 do làm tròn).

### 6.4 Code trong `cf_recommendation.py`

```python
item_user = self.profile_matrix.mat.T.tocsr()             # (n_items, n_users)
item_user_norm = normalize(item_user, norm="l2", axis=1)  # mỗi hàng = 1 item, ‖row‖=1
self.item_similarity = ItemSimilarityMatrix(item_user_norm, self.profile_matrix.columns)
```

`normalize(item_user, norm="l2", axis=1)` chia mỗi hàng (1 item) cho $L_2$ norm của nó.

### 6.5 Ma trận similarity đầy đủ cho dữ liệu mẫu

Tính tất cả cặp:

| Cặp | Tích vô hướng $\tilde{R}_p \cdot \tilde{R}_i$ | $\text{sim}(p, i)$ |
|---|---|---|
| sim(P1, P2) | $0.637 \cdot 0 + 0.369 \cdot 0.725 + 0.677 \cdot 0 + 0 \cdot 0.725 = 0.267$ | **0.267** |
| sim(P1, P3) | $0 + 0.312 + 0.362 + 0 = 0.674$ | **0.674** |
| sim(P1, P4) | $0 + 0 + 0.677 \cdot 0.892 + 0 = 0.604$ | **0.604** |
| sim(P2, P3) | $0 + 0 + 0 + 0 = 0$ | **0.000** |
| sim(P2, P4) | $0 + 0.725 \cdot 0.892 + 0 + 0 = 0.647$ | **0.647** |
| sim(P3, P4) | $0 + 0 + 0.535 \cdot 0.892 + 0 = 0.477$ | **0.477** |

(Các vector chuẩn hoá: $\tilde{R}_{\cdot P2} = (0, 0.725, 0, 0.725)^T$; $\tilde{R}_{\cdot P4} = (0, 0, 0.892, 0.453)^T$.)

### 6.6 Ma trận similarity đối xứng

$$\text{Sim} = \begin{pmatrix}
1.000 & 0.267 & 0.674 & 0.604 \\
0.267 & 1.000 & 0.000 & 0.647 \\
0.674 & 0.000 & 1.000 & 0.477 \\
0.604 & 0.647 & 0.477 & 1.000
\end{pmatrix}$$

**Quan sát:**
- P1 ↔ P3 cao nhất (0.674) — cùng được mua bởi U2, U3
- P2 ↔ P3 = 0 — không có khách chung
- P2 ↔ P4 cao (0.647) — cùng được mua bởi U4

---

## 7. Tính điểm gợi ý — Bước 5

### 7.1 Công thức chính

Cho khách $u$ với tập món đã mua $\mathcal{P}_u$ và trọng số $\{w_{up}\}_{p \in \mathcal{P}_u}$:

$$\hat{r}_{ui} = \sum_{p \in \mathcal{P}_u} w_{up} \cdot \text{sim}(p, i)$$

### 7.2 Ví dụ — Gợi ý cho khách U1

**Bước 1: Lấy tập món đã mua của U1**

Từ ma trận $R$ ở §5.3:
- $\mathcal{P}_{U1} = \{P1, P2\}$ (vì $R_{U1,P3} = R_{U1,P4} = 0$)
- Trọng số: $w_{U1,P1} = 1.035$, $w_{U1,P2} = 0.555$

**Bước 2: Tính điểm cho từng món ứng viên $i \notin \mathcal{P}_{U1}$**

Ứng viên: $i \in \{P3, P4\}$.

**Với $i = P3$:**

$$\hat{r}_{U1,P3} = w_{U1,P1} \cdot \text{sim}(P1, P3) + w_{U1,P2} \cdot \text{sim}(P2, P3)$$

$$= 1.035 \cdot 0.674 + 0.555 \cdot 0.000$$

$$= 0.698 + 0 = 0.698$$

**Với $i = P4$:**

$$\hat{r}_{U1,P4} = w_{U1,P1} \cdot \text{sim}(P1, P4) + w_{U1,P2} \cdot \text{sim}(P2, P4)$$

$$= 1.035 \cdot 0.604 + 0.555 \cdot 0.647$$

$$= 0.625 + 0.359 = 0.984$$

**Bước 3: Xếp hạng**

| Xếp hạng | Sản phẩm | Điểm |
|---|---|---|
| 1 | **P4** | **0.984** |
| 2 | P3 | 0.698 |

→ Gợi ý cho U1: **P4** (cao nhất).

### 7.3 Ý nghĩa trực quan

- U1 đã mua **P1** và **P2**.
- P4 tương đồng với **cả P1 và P2** (cùng được mua bởi U3/U4) → điểm cao.
- P3 chỉ tương đồng với **P1** (cùng U2/U3) nhưng **không** tương đồng P2 → điểm thấp hơn.

### 7.4 Tối ưu bằng nhân ma trận (production)

Trong code production, thay vì vòng lặp trên $\mathcal{P}_u$, ta nhân ma trận một lần:

```python
def compute_scores(self, purchased, weights):
    # q vector tổng hợp các vector item đã mua, trọng theo weights
    q = self.item_user_norm[valid_indices].T.dot(w_arr)   # shape (n_users,)
    # scores cho mọi item = (vector item đã chuẩn hoá) · q
    scores = self.item_user_norm.dot(q)                   # shape (n_items,)
    return pd.Series(scores, index=self.index)
```

Toán học tương đương:

$$\hat{r}_u = \tilde{R}_{\cdot \mathcal{P}_u}^T \cdot w_u = (\tilde{R}^T)_{\mathcal{P}_u, \cdot} \cdot w_u \in \mathbb{R}^{|I|}$$

Trong đó:
- $\tilde{R}^T \in \mathbb{R}^{|I| \times |U|}$: ma trận đã chuẩn hoá L2 (mỗi hàng = 1 sản phẩm, đã normalize)
- Lấy các hàng tương ứng với $\mathcal{P}_u$ → $\tilde{R}^T_{\mathcal{P}_u, \cdot}$
- Nhân với vector trọng số $w_u \in \mathbb{R}^{|\mathcal{P}_u|}$

Vì $\tilde{R}$ đã chuẩn hoá (mỗi hàng có norm = 1), tích vô hướng giữa hai hàng = cosine similarity. Do đó phép nhân này tính **đồng thời** tất cả $\hat{r}_{ui}$ cho mọi $i$.

---

## 8. Quy trình gợi ý đầy đủ

### 8.1 Pipeline

```
recommend(customer_id, top_k=10)
    │
    ├─► 1. Lấy purchased = tập món đã mua (từ R^buy)
    │
    ├─► 2. Lấy profile_items = tập món có tín hiệu trong R^prof
    │         Nếu rỗng → return Most-Popular (cold-start)
    │
    ├─► 3. Tính scores[i] = Σ_{p ∈ profile_items} w_{up} · sim(p, i)
    │
    ├─► 4. Loại purchased khỏi scores (đã mua = điểm = 0 hoặc drop)
    │
    ├─► 5. Sắp xếp scores giảm dần, lấy top_K
    │
    └─► 6. Nếu chưa đủ top_K → bù bằng Most-Popular
```

### 8.2 Chi tiết từng bước (ví dụ U1, top_k=2)

| Bước | Hoạt động | Kết quả |
|---|---|---|
| 1 | `purchased = {P1, P2}` | — |
| 2 | `profile_items = {P1, P2}` | có tín hiệu |
| 3 | Tính scores | `scores = [_, _, 0.698, 0.984]` (vị trí P1, P2, P3, P4) |
| 4 | Loại purchased | `scores_filtered = [_, _, 0.698, 0.984]` (P3, P4) |
| 5 | Top-2 | `[(P4, 0.984), (P3, 0.698)]` |
| 6 | Bù nếu thiếu | Không thiếu |

→ Kết quả cuối: **gợi ý P4, P3 cho U1**.

### 8.3 Phân biệt "mua" vs. "hồ sơ" — Tại sao quan trọng?

| | Ma trận MUA $R^{buy}$ | Ma trận HỒ SƠ $R^{prof}$ |
|---|---|---|
| Công dụng | Loại món đã mua, ground truth, popular | Tính điểm CF |
| Nguồn | Đơn PAID | Đơn + hành vi phụ |
| Khách chưa mua có tín hiệu? | $R^{buy}_u = 0$ | $R^{prof}_u$ có thể có (đã xem/giỏ) |

**Ví dụ:** Khách U0 mới đăng ký, đã xem P1 và P2 (chưa mua).
- $R^{buy}_{U0} = 0$ → cold-start nếu chỉ dùng $R^{buy}$
- $R^{prof}_{U0}$ có tín hiệu từ hành vi → đi đường CF được (gợi ý món tương tự P1, P2)

---

## 9. Ma trận hồ sơ (Profile Matrix)

### 9.1 Khi nào $R^{prof} \neq R^{buy}$?

Khi tính năng hành vi phụ **BẬT** (mặc định đang tắt):

$$R^{prof} = R^{buy} + S^{behavior}$$

Trong đó $S^{behavior}$ là tín hiệu phụ:

$$S^{behavior}_{ui} = \left[ w_v \cdot \text{View} + w_v \cdot \text{Dwell} + w_c \cdot \text{Cart} + w_w \cdot \text{Wish} \right] \cdot 2^{-d/h}$$

### 9.2 Bảng trọng số hành vi phụ

| Tín hiệu | Trọng số | Ý nghĩa |
|---|---|---|
| `ViewsFromRec` | 0.1 | Lượt xem từ ô gợi ý (thường không dùng — vòng tự củng cố) |
| `Views` | 0.2 | Lượt xem thật |
| `DwellSec` | 0.01 | Thời gian xem (giây, mỗi lượt ≤ 10 phút) |
| `Carts` | 0.5 | Thêm vào giỏ |
| `Wishlists` | 1.0 | Thêm vào yêu thích |

### 9.3 Ví dụ — Tín hiệu phụ

Khách U0 đã xem P3 ba lần (cách 2, 5, 8 ngày), thêm P3 vào giỏ 1 lần (cách 4 ngày). Với $h = 7$:

- Tín hiệu xem: $0.2 \cdot 3 \cdot 2^{-2/7} \approx 0.2 \cdot 3 \cdot 0.820 = 0.492$
- Tín hiệu giỏ: $0.5 \cdot 1 \cdot 2^{-4/7} \approx 0.5 \cdot 1 \cdot 0.667 = 0.334$

Tổng $S^{behavior}_{U0,P3} \approx 0.826$.

→ Trong $R^{prof}$, ô $(U0, P3)$ có giá trị $0.826$ dù $R^{buy}$ tại đây = 0.

### 9.5 Tính năng đang TẮT (mặc định)

Lý do tắt:
- Dữ liệu seed hiện tại không phản ánh gu mua thật
- Bật chỉ thêm nhiễu
- Cần dữ liệu hành vi thật từ client mới bật

---

## 10. Xử lý Cold-Start

### 10.1 Ba cấp độ

| Cấp độ | Định nghĩa | Xử lý trong CF |
|---|---|---|
| Khách mới hoàn toàn | Không mua, không hành vi | Most-Popular |
| Khách có hành vi phụ | Đã xem/giỏ nhưng chưa mua | Dùng $R^{prof}$ (hành vi) tính CF |
| Khách ít lịch sử | 1–2 món trong train | Hybrid với $\alpha$ nhỏ |

### 10.2 Most-Popular

```python
popular_items = interactions.groupby("ProductID")["Quantity"].sum().sort_values(ascending=False)
```

Công thức:

$$\text{pop}_i = \sum_{u: i \in \mathcal{P}_u} w_{ui} = \sum_{u} R^{buy}_{ui}$$

Với dữ liệu mẫu (dùng $w$ sau decay, **không log** để giữ sản lượng):

| ProductID | $\sum_u w_{ui}$ (sau decay, linear) | Xếp hạng |
|---|---|---|
| P1 | $1.814 + 0.820 + 2.000 + 0 = 4.634$ | 🥇 1 |
| P3 | $0 + 1.122 + 0.609 + 0 = 1.731$ | 🥈 2 |
| P2 | $0.741 + 0 + 0 + 0.500 = 1.241$ | 🥉 3 |
| P4 | $0 + 0 + 0.500 + 0.125 = 0.625$ | 4 |

**Lưu ý quan trọng:** Most-Popular dùng $w$ sau decay (linear, không log), vì nó đo **sản lượng** chứ không phải sở thích.

---

## 11. Lưu và nạp mô hình

### 11.1 Các thành phần cần serialize

```python
payload = {
    "format_version": 2,
    "user_item_matrix": self.user_item_matrix,    # R^buy dạng sparse
    "item_similarity": self.item_similarity,      # R~ đã normalize L2
    "product_metadata": self.product_metadata,
    "customer_metadata": self.customer_metadata,
    "popular_items": self.popular_items,          # pd.Series
    "half_life_days": self.half_life_days,        # h
    "input_scale": self.input_scale,              # "log" hoặc "linear"
    "profile_matrix": ...,                         # R^prof (None nếu bằng R^buy)
    "behavior": asdict(self.behavior),
}
```

### 11.2 Lý do lưu từng thành phần

| Thành phần | Lý do |
|---|---|
| `user_item_matrix` ($R^{buy}$) | Để xác định purchased và ground truth |
| `item_similarity` ($\tilde{R}$) | Để tính cosine không cần re-train |
| `popular_items` | Cold-start không cần re-compute |
| `half_life_days`, `input_scale` | Để reproducibility — biết model được train với config nào |

### 11.3 Nạp model cũ — Backward compatibility

```python
self.half_life_days = payload.get("half_life_days", self.half_life_days)  # fallback
self.input_scale = payload.get("input_scale", "linear")                   # fallback
self.profile_matrix = payload.get("profile_matrix")                        # None = cũ
```

Nếu thiếu key, dùng giá trị mặc định để tương thích với model cũ.

---

## 12. Tóm tắt các thông số quan trọng

| Thông số | Ký hiệu | Giá trị | Công thức |
|---|---|---|---|
| Half-life | $h$ | **7 ngày** | $w = q \cdot 2^{-d/h}$ |
| Input scale | — | **`log`** | $v = \ln(1 + w)$ |
| Similarity | $\text{sim}(p,i)$ | Cosine trên $\tilde{R}$ | $\tilde{R}_{\cdot p} \cdot \tilde{R}_{\cdot i}$ |
| Điểm CF | $\hat{r}_{ui}$ | Tổng $w \cdot$ sim | $\sum_{p \in \mathcal{P}_u} w_{up} \cdot \text{sim}(p,i)$ |
| Ma trận | $R^{buy}, R^{prof}$ | `scipy.sparse.csr_matrix` | — |
| Cold-start | — | Most-Popular (decay, linear) | $\text{pop}_i = \sum_u w_{ui}$ |

### 12.1 Toàn bộ pipeline dưới dạng toán học

```
Input: R_raw = {(u, i, q, d)}       từ fact_orders_detail
         │
         ▼
Bước 2: w_i = q · 2^{-d/7}         time decay (h=7)
         │
         ▼
Bước 3: v = ln(1 + w)              log scale
         │
         ▼
Bước 1: R_buy[u,i] = v  (chỉ PAID)
         │
         ▼ (nếu bật behavior)
Bước 9: R_prof = R_buy + S_behavior
         │
         ▼
Bước 6: R~_prof = R_prof / ‖R_prof‖_2  (mỗi cột)  L2-normalize
         │
         ▼
Bước 7: sim(p, i) = R~_prof[:,p] · R~_prof[:,i]
         │
         ▼
Bước 8: r̂_ui = Σ_{p ∈ P_u} w_up · sim(p,i)
         │
         ▼
Output: Top-K sản phẩm chưa mua có r̂_ui cao nhất
```

---

## 13. Tài liệu tham khảo

1. **Sarwar, B., Karypis, G., Konstan, J., & Riedl, J. (2001).** Item-based collaborative filtering recommendation algorithms. *WWW '01*, 285–295. — Thuật toán Item-CF gốc, công thức cosine similarity.

2. **Hu, Y., Koren, Y., & Volinsky, C. (2008).** Collaborative filtering for implicit feedback datasets. *ICDM '08*. — Thang log cho implicit feedback, tránh bias món sỉ.

3. **Koren, Y. (2009).** Collaborative Filtering with Implicit Feedback. *Recommender Systems Handbook*, 2nd ed. — Tổng quan phương pháp.

4. **Anderson, A., Kumar, R., Tomkins, A., & Vassilvitskii, S. (2014).** The dynamics of repeat consumption. *WWW '14*, 419–430. — Tầm quan trọng của recency trong dữ liệu mua.

5. **Burke, R. (2002).** Hybrid recommender systems: Survey and experiments. *User Modeling and User-Adapted Interaction*, 12(4), 331–370. — Kết hợp CF + CB trong hybrid.

6. **Campos, P. G., et al. (2014).** Time-aware recommender systems: A comprehensive survey. *UMUAI*. — Phương pháp cắt train/test theo thời gian.

7. **Järvelin, K., & Kekäläinen, J. (2002).** Cumulated gain-based evaluation of IR techniques. *ACM TOIS*, 20(4), 422–446. — NDCG trong đánh giá.