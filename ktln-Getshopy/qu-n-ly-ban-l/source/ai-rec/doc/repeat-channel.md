# Kênh Mua Lại (Repeat Channel) — Chi tiết hoạt động

> **Phiên bản:** 1.0
> **Ngày:** 2026-10-08
> **File gốc:** `models/repeat.py`, `models/hybrid.py`
> **Bảng phụ thuộc:** `serving.purchase_events_for_AI_rec`
> **Phạm vi:** Toàn bộ vòng đời kênh mua lại — từ nguồn dữ liệu, cách tính điểm, cách trộn vào hybrid, cho đến cách benchmark đánh giá.

---

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Nguồn dữ liệu — purchase_events_for_AI_rec](#2-nguồn-dữ-liệu--purchase_events_for_ai_rec)
3. [Công thức tính điểm — RepeatModel](#3-công-thức-tính-điểm--repeatmodel)
4. [So sánh với cách cũ (cf_weight)](#4-so-sánh-với-cách-cũ-cf_weight)
5. [Time decay — half-life](#5-time-decay--half-life)
6. [Chuẩn hoá theo khách](#6-chuẩn-hoá-theo-khách)
7. [Tích hợp vào Hybrid Recommender](#7-tích-hợp-vào-hybrid-recommender)
8. [Trọng số γ và allow_repeat](#8-trọng-số-γ-và-allow_repeat)
9. [Fallback khi bảng không tồn tại](#9-fallback-khi-bảng-không-tồn-tại)
10. [Benchmark — cách đánh giá](#10-benchmark--cách-đánh-giá)
11. [Cấu hình đang chạy (production)](#11-cấu-hình-đang-chạy-production)
12. [Cơ sở lý thuyết](#12-cơ-sở-lý-thuyết)

---

## 1. Tổng quan

Kênh mua lại (repeat channel) gợi ý món mà **khách đã từng mua**, dựa trên giả định: khách có xu hướng mua lại những món quen thuộc. Đây là một trong 3 kênh gợi ý của Hybrid Recommender, bên cạnh kênh CF (khám phá) và kênh content-based.

```
┌─────────────────────────────────────────────────────────────────┐
│                  Hybrid Recommender                               │
│                                                                 │
│   Kênh CF (ĉf)        ──► khám phá món mới, dựa trên hành vi  │
│                          của những khách tương tự                │
│                                                                 │
│   Kênh CB (ĉb)        ──► khám phá món mới, dựa trên nội dung │
│                          (danh mục, hãng, tầm giá)              │
│                                                                 │
│   Kênh mua lại (rêp) ──► khai thác món quen, gợi ý món đã mua │
│                          trước đó                               │
└─────────────────────────────────────────────────────────────────┘
```

**Khác biệt cốt lõi:**
- CF và CB là kênh **khám phá** (exploration) — gợi ý món mới mà khách chưa từng mua.
- Kênh mua lại là kênh **khai thác** (exploitation) — gợi ý món quen thuộc.

---

## 2. Nguồn dữ liệu — `purchase_events_for_AI_rec`

### 2.1 Tại sao cần bảng riêng?

Hai bảng AI-Rec đọc từ warehouse có grain khác nhau:

| Bảng | Grain | Dùng cho |
|---|---|---|
| `processed_data_for_AI_rec` | Một dòng / cặp (khách, món) | Ma trận CF — gộp theo cặp, mất thông tin "mấy lần mua" |
| `purchase_events_for_AI_rec` | Một dòng / (khách, món, đơn) | Kênh mua lại — giữ từng lần mua riêng biệt |

### 2.2 Schema

```sql
-- Một dòng cho mỗi lần khách mua một món trong một đơn
SELECT
    toString(f.customer_id)  AS CustomerID,
    toString(f.product_id)   AS ProductID,
    toString(f.order_id)     AS OrderID,
    min(f.order_date)        AS OrderedAt,    -- ngày đặt đơn
    sum(f.quantity)           AS Quantity      -- tổng số lượng trong đơn đó
FROM fact_orders_detail f FINAL
INNER JOIN dim_products p ON p.product_id = toString(f.product_id) AND p.is_deleted = 0
WHERE f._is_deleted = 0
  AND f.customer_id != 0
  AND f.product_id  != 0
  AND f.order_status  != 'CANCELLED'
  AND f.payment_status = 'PAID'
GROUP BY CustomerID, ProductID, OrderID
HAVING Quantity > 0
```

### 2.3 Đặc điểm quan trọng

- **Không lọc ngưỡng số người mua** (`uniqExact(CustomerID) >= 3` như bảng kia). Ngưỡng đó là để chống cosine trong CF bị thổi lên ở món ít người mua. Kênh mua lại chỉ phụ thuộc lịch sử của chính khách — không bị ảnh hưởng bởi món ít người mua.
- **Cùng cặp (khách, món) có thể xuất hiện nhiều dòng** nếu khách mua món đó ở nhiều đơn khác nhau. Mỗi dòng là một "lần mua".
- **Không lọc người mua ít**: món chỉ có 1 người mua vẫn có điểm mua lại cho người đó.

---

## 3. Công thức tính điểm — RepeatModel

### 3.1 Ký hiệu

Trước khi viết công thức, ta chuẩn hoá ký hiệu:

| Ký hiệu | Ý nghĩa | Tập/miền |
|---|---|---|
| $\mathcal{U}$ | Tập khách hàng | $u \in \mathcal{U}$ |
| $\mathcal{I}$ | Tập sản phẩm (ứng viên) | $i \in \mathcal{I}$ |
| $\mathcal{O}_u$ | Tập các đơn hàng của khách $u$ | $o \in \mathcal{O}_u$ |
| $t_o$ | Ngày đặt đơn $o$ | $\mathbb{R}_{\geq 0}$ |
| $t_{\text{now}}$ | Ngày hiện tại (thời điểm suy luận) | $\mathbb{R}_{\geq 0}$ |
| $\Delta t_o$ | Số ngày từ đơn $o$ đến hiện tại | $\Delta t_o = t_{\text{now}} - t_o \in \mathbb{R}_{\geq 0}$ |
| $h$ | Half-life (chu kỳ bán rã) | $h \in \mathbb{R}_{>0}$, đơn vị: ngày |
| $\mathbf{1}(i \in o)$ | Hàm chỉ báo đơn $o$ có chứa món $i$ | $\{0, 1\}$ |
| $r(u, i)$ | Điểm mua lại thô của khách $u$ với món $i$ | $\mathbb{R}_{\geq 0}$ |
| $\hat{r}(u, i)$ | Điểm mua lại sau chuẩn hoá của khách $u$ với món $i$ | $[0, 1]$ |

### 3.2 Công thức cốt lõi

**Bước 1 — Trọng số thời gian (time decay):**

Mỗi lần mua được gán trọng số $w_o$ phụ thuộc vào độ gần đây:

$$
w_o(h) = \begin{cases}
2^{-\frac{\Delta t_o}{h}} & \text{nếu } h > 0 \\
1 & \text{nếu } h \leq 0
\end{cases}
$$

Trong đó:

$$
2^{-\frac{\Delta t_o}{h}} = e^{-\frac{\ln 2}{h} \cdot \Delta t_o}
$$

Hai cách viết tương đương — cái thứ hai thấy rõ đây là exponential decay với hằng số phân rã $\lambda = \frac{\ln 2}{h}$.

**Bước 2 — Điểm mua lại thô (raw repeat score):**

Tổng trọng số của mọi lần mua món $i$ trong lịch sử của khách $u$:

$$
r(u, i) = \sum_{o \in \mathcal{O}_u} w_o(h) \cdot \mathbf{1}(i \in o)
$$

**Bước 3 — Chuẩn hoá theo khách:**

Đưa điểm về thang $[0, 1]$ bằng cách chia cho giá trị lớn nhất của khách $u$:

$$
\hat{r}(u, i) = \begin{cases}
\dfrac{r(u, i)}{\max_{j \in \mathcal{I}} r(u, j)} & \text{nếu } \max_{j} r(u, j) > 0 \\
0 & \text{nếu } u \text{ chưa mua gì}
\end{cases}
$$

**Điểm của món $i$ trong kênh mua lại của khách $u$ là $\hat{r}(u, i)$**, mọi ký hiệu về sau trong doc viết gọn là $r(u, i)$ nhưng đều là giá trị đã chuẩn hoá.

### 3.3 Tính chất

**Bất biến 1** — *Tần suất và recency được tách rời:*

Nếu khách $u$ mua món $i$ ở $n$ đơn khác nhau, điểm thô là tổng $n$ số hạng độc lập:

$$
r(u, i) = \sum_{k=1}^{n} 2^{-\frac{\Delta t_{o_k}}{h}}
$$

Một đơn mua $q$ cái vẫn chỉ là **một số hạng** ($q$ không xuất hiện trong công thức). Ba đơn lẻ gần đây ($q = 1$ mỗi đơn) nặng hơn một đơn sỉ $q = 5$ từ xa.

**Bất biến 2** — *Bán rã theo cấp số nhân:*

Sau mỗi khoảng thời gian $h$ (half-life), trọng số giảm còn một nửa:

$$
w_o(t + h) = 2^{-\frac{\Delta t_o + h}{h}} = 2^{-1} \cdot 2^{-\frac{\Delta t_o}{h}} = \tfrac{1}{2} w_o(t)
$$

**Bất biến 3** — *Đơn điểm khi vừa mua:*

$$
\lim_{\Delta t_o \to 0^+} w_o = 2^0 = 1
$$

### 3.4 Ví dụ minh hoạ

Khách $u$ mua món $i$ ở 3 đơn với half-life $h = 7$ ngày:

| Đơn | $\Delta t_o$ (ngày) | $w_o = 2^{-\Delta t_o / 7}$ |
|---|---:|---:|
| $o_1$ | 6 | $2^{-6/7} \approx 0{,}553$ |
| $o_2$ | 4 | $2^{-4/7} \approx 0{,}683$ |
| $o_3$ | 1 | $2^{-1/7} \approx 0{,}907$ |

Điểm mua lại thô:

$$
r(u, i) = \sum_{k=1}^{3} 2^{-\frac{\Delta t_{o_k}}{7}} = 0{,}553 + 0{,}683 + 0{,}907 = 2{,}143
$$

Nếu đây là món có điểm cao nhất của khách $u$, sau chuẩn hoá: $\hat{r}(u, i) = 1{,}0$. Món có $r = 1{,}0$ khác sẽ có $\hat{r} = 0{,}683 / 2{,}143 \approx 0{,}319$.

---

## 4. So sánh với cách cũ (cf_weight)

### 4.1 Cách cũ — `cf_weight`

Trước ngày 01/10/2026, kênh mua lại dùng **trọng số của món trong ma trận CF** thay cho RepeatModel. Ma trận CF được xây từ bảng `processed_data_for_AI_rec` (grain theo cặp), với trọng số cho cặp $(u, i)$:

$$
w_{CF}(u, i) = Q(u, i) \cdot 2^{-\frac{\Delta t(u, i)}{h}}
$$

Trong đó:
- $Q(u, i) = \sum_{o \in \mathcal{O}_u \text{ có món } i} q_o$ là **tổng số lượng** khách mua món $i$ ở mọi đơn.
- $\Delta t(u, i)$ là thời điểm mua **gần nhất** (chỉ một giá trị, không phải từng đơn).

Do đó công thức cũ viết gọn là:

$$
r_{\text{cũ}}(u, i) = Q(u, i) \cdot 2^{-\frac{\Delta t_{\text{last}}(u, i)}{h}}
$$

**Vấn đề của cách cũ:**
- $Q(u, i)$ đếm **số lượng**, không đếm **số lần mua**. Một đơn sỉ $q = 5$ cho $Q = 5$ — nặng hơn ba lần mua lẻ $q = 1$ ($Q = 3$).
- $\Delta t_{\text{last}}$ chỉ phản ánh lần mua cuối. Ba lần mua cách đây 1, 5, 10 ngày có cùng điểm $\approx Q \cdot 2^{-10/h}$ — mất hoàn toàn tín hiệu "mua thường xuyên".

### 4.2 Cách mới — `order_freq`

$$
r_{\text{mới}}(u, i) = \sum_{o \in \mathcal{O}_u} 2^{-\frac{\Delta t_o}{h}} \cdot \mathbf{1}(i \in o)
$$

- **Mỗi lần mua = một số hạng riêng** → tần suất được tách khỏi độ lớn đơn.
- Một đơn $q = 5$ vẫn chỉ là 1 số hạng, ba lần mua lẻ gần đây là 3 số hạng → đúng với hành vi thực tế.

### 4.3 So sánh bằng số

Khách $u$ mua món $i$ ở ba trường hợp (cùng half-life $h = 7$):

| Trường hợp | Lịch sử mua | $r_{\text{cũ}}$ | $r_{\text{mới}}$ |
|---|---|---:|---:|
| A | 1 đơn 5 cái, 1 ngày trước | $5 \cdot 2^{-1/7} \approx 4{,}53$ | $2^{-1/7} \approx 0{,}91$ |
| B | 3 đơn × 1 cái, cách đây 1, 3, 6 ngày | $3 \cdot 2^{-1/7} \approx 2{,}72$ | $2^{-1/7} + 2^{-3/7} + 2^{-6/7} \approx 2{,}14$ |
| C | 1 đơn 1 cái, 30 ngày trước | $1 \cdot 2^{-30/7} \approx 0{,}05$ | $2^{-30/7} \approx 0{,}05$ |

Cách cũ xếp: A > B > C (mua sỉ = nặng nhất, dù mua 1 lần).
Cách mới xếp: **B > A > C** (mua thường xuyên = nặng nhất, đúng bản chất mua lại).

### 4.4 Benchmark trên validation

| Metric | Cách cũ (cf_weight) | Cách mới (order_freq) |
|---|---|---|
| NDCG@10 tổng thể | 0.336 | **0.357** |
| NDCG@10 mua lại (repurchase) | — | **+0.310** |

→ Cách mới **thắng** trên validation → production dùng `order_freq`.

---

## 5. Time decay — half-life

### 5.1 Định nghĩa

Time decay là hàm trọng số giảm theo thời gian:

$$
w(\Delta t) = 2^{-\frac{\Delta t}{h}}
$$

Với $h$ là **half-life** — khoảng thời gian để trọng số giảm còn một nửa:

$$
w(\Delta t + h) = 2^{-\frac{\Delta t + h}{h}} = 2^{-1} \cdot 2^{-\frac{\Delta t}{h}} = \tfrac{1}{2} \cdot w(\Delta t)
$$

Đây là hàm exponential decay với hằng số phân rã:

$$
\lambda = \frac{\ln 2}{h}
$$

Hai cách viết tương đương:

$$
w(\Delta t) = 2^{-\frac{\Delta t}{h}} = e^{-\frac{\ln 2}{h} \cdot \Delta t} = e^{-\lambda \Delta t}
$$

### 5.2 Bảng giá trị với $h = 7$ ngày

| $\Delta t$ (ngày) | $w = 2^{-\Delta t / 7}$ | Ghi chú |
|---:|---:|---|
| 0 | $1{,}000$ | Mua hôm nay |
| 1 | $0{,}907$ | |
| 3 | $0{,}745$ | |
| 7 | $0{,}500$ | **Half-life**: trọng số giảm còn ½ |
| 14 | $0{,}250$ | |
| 30 | $0{,}052$ | Gần như bằng 0 |
| 60 | $0{,}003$ | Bỏ qua |
| 90 | $0{,}000$ | Hết hạn |

Hàm số giảm nhanh ở 7 ngày đầu, sau đó tiệm cận 0. Mua cách đây 90 ngày về cơ bản không còn đóng góp vào điểm mua lại.

### 5.3 Tại sao cơ số 2?

Hai lý do:

1. **Quy ước trực quan** — half-life có nghĩa đen "giảm còn ½ sau $h$ ngày". Cơ số tự nhiên $e$ cho cùng kết quả với tham số khác nhưng khó giải thích hơn.

2. **So sánh trực tiếp** — nếu $w_1 = w_2 / 2$ thì rõ ràng đơn cũ chỉ bằng nửa đơn mới. Cơ số $e$ phải quy đổi qua $\ln$ mới có ý nghĩa tương đương.

### 5.4 Chọn half-life

**Half-life dùng chung** cho cả kênh CF (ma trận CF dùng cùng half-life khi tính recency decay) và kênh mua lại — đảm bảo tín hiệu nhất quán.

Grid trên validation: $h \in \{1, 3, 7, 14, 30\}$ ngày.
Chọn: **$h = 7$ ngày** (kết quả benchmark tốt nhất trên validation).

Lưu ý học thuật: bản trước 01/10/2026 dùng $h = 30$ ngày. Sau khi có dữ liệu thật (thay vì tổng hợp) và thêm kênh mua lại mới, half-life giảm từ 30 xuống 7. Lý do: half-life ngắn phản ánh đúng chu kỳ mua sắm e-commerce (tuần/lần) thay vì chu kỳ tháng.

### 5.5 Trường hợp đặc biệt: tắt time decay

$$
w(\Delta t) = \begin{cases}
2^{-\frac{\Delta t}{h}} & \text{nếu } h > 0 \\
1 & \text{nếu } h \leq 0
\end{cases}
$$

Khi $h \leq 0$: $w \equiv 1$ cho mọi lần mua — điểm mua lại trở thành **đếm số đơn thuần** (không phân biệt cũ/mới). Hiện không dùng trong production.

---

## 6. Chuẩn hoá theo khách

### 6.1 Mục đích

Sau khi tính điểm thô $r(u, i)$, kênh mua lại được chuẩn hoá về thang $[0, 1]$ **theo từng khách** để có thể so sánh với các kênh khác trong hybrid.

### 6.2 Công thức

Với mỗi khách $u$, xét tập món $u$ đã từng mua $\mathcal{I}_u = \{i \in \mathcal{I} \mid r(u, i) > 0\}$. Đặt:

$$
r_{\max}(u) = \max_{i \in \mathcal{I}_u} r(u, i)
$$

Điểm chuẩn hoá:

$$
\hat{r}(u, i) = \begin{cases}
\dfrac{r(u, i)}{r_{\max}(u)} & \text{nếu } r_{\max}(u) > 0 \\
0 & \text{nếu } \mathcal{I}_u = \emptyset
\end{cases}
$$

Khi đó $\hat{r}(u, i) \in [0, 1]$ với mọi $u, i$, và $\max_i \hat{r}(u, i) = 1$ nếu $u$ có lịch sử mua.

### 6.3 Tại sao cần chuẩn hoá?

Hybrid trộn ba kênh theo công thức:

$$
s(u, i) = \alpha_u \cdot \hat{c}_f(u, i) + (1 - \alpha_u) \cdot \hat{c}_b(u, i) + \gamma \cdot \hat{r}(u, i)
$$

Trong đó $\alpha_u, \gamma \in [0, 1]$ là trọng số tổng quát. Để $\gamma$ so sánh được "món tốt nhất của kênh này" với "món tốt nhất của kênh kia", **mỗi kênh phải ở cùng thang đo $[0, 1]$**.

**Nếu không chuẩn hoá:**
- Khách A mua 50 lần: $r_{\max}(A) = 50$ → món thường có $r = 5$
- Khách B mua 3 lần: $r_{\max}(B) = 3$ → món tốt nhất $r = 3$

→ $\gamma \cdot r(A, i)$ luôn lớn hơn $\gamma \cdot r(B, j)$ cho mọi $i, j$ tương đương. Kênh mua lại **lấn át** CF/CB ở khách mua nhiều.

**Sau chuẩn hoá:**
- Khách A: món tốt nhất $\hat{r} = 1{,}0$, món còn lại theo tỷ lệ
- Khách B: món tốt nhất $\hat{r} = 1{,}0$, món còn lại theo tỷ lệ
- $\gamma$ so sánh được cùng thang đo → hybrid trộn chính xác.

---

## 7. Tích hợp vào Hybrid Recommender

### 7.1 Công thức tổng quát của hybrid

Với mỗi khách $u$ và sản phẩm $i$, điểm cuối cùng là tổng có trọng số của ba kênh:

$$
s(u, i) = \alpha_u \cdot \hat{c}_f(u, i) + (1 - \alpha_u) \cdot \hat{c}_b(u, i) + \gamma \cdot \hat{r}(u, i)
$$

Trong đó:

| Ký hiệu | Kênh | Khoảng giá trị | Nguồn |
|---|---|---|---|
| $\hat{c}_f(u, i)$ | Item-based CF | $[0, 1]$ | `models/cf_recommendation.py` |
| $\hat{c}_b(u, i)$ | Content-based | $[0, 1]$ | `models/content_based.py` |
| $\hat{r}(u, i)$ | Mua lại | $[0, 1]$ | `models/repeat.py` |

**Trọng số $\alpha_u$** (co rút theo lịch sử):

$$
\alpha_u = \frac{n_u}{n_u + k}
$$

với $n_u$ = số món **khác nhau** khách $u$ đã mua, $k$ = `cf_shrink_k` (chọn trên validation).

**Trọng số $\gamma$** = `repeat_weight` (chọn trên validation, mặc định 1).

### 7.2 Tính $\hat{c}_f(u, i)$ và $\hat{r}(u, i)$ từ ma trận

Item-CF dùng ma trận hồ sơ (user-item matrix). Cột $j$ của ma trận là một món $i_j$ với trọng số:

$$
w_{\text{profile}}(u, i) = Q(u, i) \cdot 2^{-\frac{\Delta t_{\text{last}}(u, i)}{h}}
$$

Tương tự, ma trận mua (chỉ từ đơn) cũng có trọng số như trên, dùng để xác định tập đã mua $P_u$:

$$
P_u = \{i \in \mathcal{I} \mid \text{có đơn PAID chứa } i \text{ của } u\}
$$

**Điểm CF (trước chuẩn hoá):**

$$
c_f(u, i) = \mathbf{1}(i \notin P_u) \cdot \frac{\mathbf{s}_i^{\top} \mathbf{W} \mathbf{s}_{P_u}}{\|\mathbf{s}_i\| \cdot \|\mathbf{s}_{P_u}\|}
$$

Trong đó $\mathbf{s}_i$ là vector cột $i$ của ma trận similarity, $\mathbf{s}_{P_u}$ là tổng các cột $j \in P_u$, $\mathbf{W}$ là ma trận chéo chuẩn hoá L2. Chi tiết công thức CF xem `doc/item-based.md`.

**Tập đã mua $P_u$ được dùng cho 2 việc:**

1. **CF là kênh khám phá** → đặt $c_f(u, i) = 0$ với $i \in P_u$ (tránh gợi ý món đã mua ở kênh CF).
2. **Làm input cho kênh mua lại** khi không có `RepeatModel` (cách cũ `cf_weight`): $\hat{r}_{\text{cũ}}(u, i) = w_{\text{profile}}(u, i) / \max_j w_{\text{profile}}(u, j)$.

### 7.3 Điểm mua lại khi có `RepeatModel`

Khi có `RepeatModel` (bảng `purchase_events_for_AI_rec` tồn tại):

$$
\hat{r}(u, i) = \frac{\sum_{o \in \mathcal{O}_u} 2^{-\Delta t_o / h} \cdot \mathbf{1}(i \in o)}{\max_{j} \sum_{o \in \mathcal{O}_u} 2^{-\Delta t_o / h} \cdot \mathbf{1}(j \in o)}
$$

Khi không có `RepeatModel` (bảng lỗi/thiếu):

$$
\hat{r}(u, i) = \frac{Q(u, i) \cdot 2^{-\Delta t_{\text{last}}(u, i) / h}}{\max_{j} Q(u, j) \cdot 2^{-\Delta t_{\text{last}}(u, j) / h}}
$$

### 7.4 Tính chất: món dưới ngưỡng CF vẫn có $\hat{r}(u, i)$

CF lọc sản phẩm có ít hơn 3 người mua (để tránh cosine bị thổi). Nhưng kênh mua lại **không áp ngưỡng đó**:

- CF: cần nhiều người mua để cosine đáng tin cậy → $c_f(u, i)$ có thể bằng 0 ở món ít người mua.
- Repeat: chỉ phụ thuộc lịch sử của chính khách → $\hat{r}(u, i) > 0$ bất kể người khác.

→ Nếu khách $u$ mua một món $i$ ít người mua, món đó có $\hat{c}_f(u, i) = 0$ nhưng $\hat{r}(u, i) > 0$ — vẫn có cơ hội lên top nếu $\gamma > 0$ và $P_u$ không bị loại (`allow_repeat = True`).

---

## 8. Trọng số $\gamma$ và `allow_repeat`

### 8.1 Ý nghĩa của $\gamma$

$\gamma$ là **trọng số kênh mua lại** trong công thức tổng quát:

$$
s(u, i) = \alpha_u \cdot \hat{c}_f(u, i) + (1 - \alpha_u) \cdot \hat{c}_b(u, i) + \gamma \cdot \hat{r}(u, i)
$$

| $\gamma$ | Ý nghĩa |
|---:|---|
| $0$ | Món đã mua chỉ lên top nhờ điểm nội dung (CB); kênh mua lại bị tắt |
| $1$ | Kênh mua lại có trọng số bằng kênh CF (với $\alpha_u = 1$) — production |
| $5$ | Kênh mua lại mạnh gấp 5 lần CF |

### 8.2 Tham số `allow_repeat`

Định nghĩa tập loại trừ:

$$
\mathcal{E}_u = \mathcal{B}_u \cup \begin{cases}
\emptyset & \text{nếu } \text{allow\_repeat} = \text{True} \\
P_u & \text{nếu } \text{allow\_repeat} = \text{False}
\end{cases}
$$

Trong đó $\mathcal{B}_u$ là tập món bị content-based chặn (khách "không quan tâm"). Tập kết quả:

$$
\mathcal{R}_u = \mathcal{I} \setminus \mathcal{E}_u
$$

| `allow_repeat = True` (mặc định) | `allow_repeat = False` |
|---|---|
| $\mathcal{E}_u = \mathcal{B}_u$ | $\mathcal{E}_u = \mathcal{B}_u \cup P_u$ |
| Cho gợi ý món đã mua | Loại hẳn món đã mua — chỉ gợi ý món mới |
| Phù hợp: trang chủ, email marketing | Phù hợp: mục "Khám phá sản phẩm mới" |

**Lưu ý:** `allow_repeat = False` **không tắt kênh mua lại**. Kênh mua lại vẫn có điểm $\hat{r}(u, i)$ — chỉ là món đã mua bị loại khỏi kết quả cuối cùng. Khi $\mathcal{B}_u$ đã chặn hết món đã mua rồi (ví dụ khách onboarding dislike chính hãng của món đã mua) thì `allow_repeat = True/False` không khác biệt.

### 8.3 Xếp hạng cuối cùng

Sau khi loại trừ, xếp hạng theo điểm giảm dần, phá hoà theo ba tiêu chí theo thứ tự:

$$
i \prec j \iff \begin{cases}
s(u, i) > s(u, j) & \text{ưu tiên 1: điểm cao hơn} \\
\text{pop}(i) > \text{pop}(j) & \text{ưu tiên 2: phổ biến giảm dần} \\
\text{catalogSold}(i) > \text{catalogSold}(j) & \text{ưu tiên 3: doanh số catalog giảm dần} \\
\text{productID}(i) < \text{productID}(j) & \text{phá cuối: mã sản phẩm tăng dần}
\end{cases}
$$

Top $K$ ứng viên theo thứ tự này là kết quả.

### 8.4 Ràng buộc REPEAT_BAND trong benchmark

Để hybrid không trở thành "Repeat-only", benchmark ràng buộc:

$$
\text{REPEAT\_BAND} = [2{,}0; \ 3{,}0]
$$

nghĩa là trong top-10 kết quả phải có **2–3 món** thuộc $P_u$ (món khách đã mua).

**Tại sao cần ràng buộc?**
- Repeat-only thắng NDCG@10 tổng thể, nhưng đánh đổi khám phá hoàn toàn.
- Khách cần cân bằng: vừa được nhắc món quen, vừa được giới thiệu món mới.
- Ràng buộc 2–3 món đã mua trong top-10 giữ cân bằng này.

**Lý do chọn khoảng [2, 3]:** benchmark cho thấy 2–3 món là điểm gãy — dưới 2 thì gợi ý quá "lạ", trên 3 thì gợi ý quá "quen", cả hai đều giảm trải nghiệm.

### 8.5 Bảng tham số production

| Tham số | Giá trị | Ý nghĩa |
|---|---|---|
| $h$ (half-life) | $7$ ngày | Tín hiệu mua lại giảm còn ½ sau 7 ngày |
| `scale` | $\log$ | Thang logarithm cho trọng số trong CF matrix |
| `REPEAT_SCORE` | `order_freq` | Dùng tần suất đơn (không phải cách cũ `cf_weight`) |
| $\gamma$ (`repeat_weight`) | $1{,}0$ | Kênh mua lại = kênh CF |
| `allow_repeat` | `True` | Cho gợi ý món đã mua |

---

## 9. Fallback khi bảng không tồn tại

### 9.1 Khi nào xảy ra?

- `purchase_events_for_AI_rec` chưa được tạo (chưa chạy `dbt run --select serving+`).
- Bảng truy vấn lỗi (ClickHouse unavailable).

### 9.2 Fallback mechanism

```python
# hybrid.py — _cf_and_repeat()
if repeat is None:
    # Dùng trọng số từ ma trận CF (cách cũ)
    rep_hat[cand] = row.data
else:
    # Dùng RepeatModel (tần suất đơn đã giảm theo thời gian)
    rep_hat = self.repeat.scores(cid)
```

**Fallback:** kênh mua lại rơi về cách cũ (`cf_weight`) — trọng số từ ma trận CF.

### 9.3 Health indicator

```python
# api/service.py — /health endpoint
stats["repeat_model"] = int(repeat is not None)
```

| Health | Ý nghĩa |
|---|---|
| `repeat_model: true` | Có bảng → dùng `order_freq` (cách mới) |
| `repeat_model: false` | Không có bảng → dùng `cf_weight` (cách cũ) |

---

## 10. Benchmark — cách đánh giá

### 10.1 Hai chế độ benchmark

**Chế độ có mua lại (`allow_repeat = True`):**
- **Overall NDCG@10**: NDCG@10 trên toàn bộ tập test (gồm cả món khách đã mua trước đó và món mới).
- **Repurchase NDCG@10**: NDCG@10 chỉ tính trên món khách đã mua trước đó.
- Mục tiêu: tối đa overall NDCG@10 với ràng buộc 2–3 món đã mua trong top-10.

**Chế độ khám phá (`allow_repeat = False`):**
- **Discovery NDCG@10**: NDCG@10 chỉ tính trên món khách CHƯA từng mua.
- Không gợi ý món đã mua.

### 10.2 Grid search

```python
# evaluation/benchmark.py
REPEAT_GRID = ("cf_weight", "order_freq")   # hai cách tính điểm
REPEAT_BAND = (2.0, 3.0)                     # 2–3 món đã mua trong top-10
GAMMA_GRID  = (0.0, 0.5, 1.0, 2.0, 5.0)    # trọng số γ
```

### 10.3 Baseline: Repeat-only

```python
def repeat_only(cid: str, n: int) -> list[str]:
    rep = hyb.components(cid)["repeat"]
    top = np.argsort(-rep)[:n]
    return [self.item_ids[i] for i in top]
```

Repeat-only dùng thuần kênh mua lại (không có CF, không có CB). Baseline này cho biết kênh mua lại một mình mạnh/yếu thế nào so với hybrid.

**Kết quả benchmark 30/09/2026:**

| Model | Overall NDCG@10 | Discovery NDCG@10 | Repurchase NDCG@10 |
|---|---|---|---|
| Most-Popular | 0.2045 | 0.5832 | 0.8636 |
| **Hybrid (production)** | **0.357** | **0.356** | **0.466** |
| Repeat-only | 0.348 | — | — |

→ Hybrid thắng cả Most-Popular lẫn Repeat-only trên overall NDCG@10.

---

## 11. Cấu hình đang chạy (production)

### 11.1 Biến môi trường

```python
# config.py
RECENCY_HALF_LIFE_DAYS   = float(os.getenv("RECENCY_HALF_LIFE_DAYS", "7"))   # half-life
REPEAT_SCORE             = os.getenv("REPEAT_SCORE", "order_freq")             # cách tính
HYBRID_REPEAT_WEIGHT     = float(os.getenv("HYBRID_REPEAT_WEIGHT", "1"))       # γ
HYBRID_ALLOW_REPEAT      = os.getenv("HYBRID_ALLOW_REPEAT", "1") not in ...    # True
PURCHASE_EVENTS_TABLE    = "serving.purchase_events_for_AI_rec"
PURCHASE_EVENTS_QUERY    = f"SELECT ... FROM {PURCHASE_EVENTS_TABLE}"
```

### 11.2 Health response

```json
{
  "trained_at": "2026-10-08T00:00:00+07:00",
  "onboarded_customers": 100002,
  "content_based": true,
  "repeat_model": true,        // ← kênh mua lại đang active
  "behavior": false,
  "cached_customers": 0
}
```

`repeat_model: true` nghĩa là `purchase_events_for_AI_rec` đã được đọc thành công và `RepeatModel` đã fit.

---

## 12. Cơ sở lý thuyết

### 12.1 Tại sao kênh mua lại quan trọng?

Trong thực tế e-commerce, **một phần lớn doanh thu đến từ mua lại**:

```
Trong tập test (benchmark 30/09/2026):
  51.4% món khách mua ở test là món họ ĐÃ mua trước đó
```

→ Gần một nửa nhu cầu của khách là mua lại món quen thuộc. Bỏ qua kênh mua lại = bỏ qua ~50% cơ hội.

### 12.2 Hai tín hiệu mạnh nhất của mua lại

Theo Anderson et al. (2014) và Bhagat et al. (2018):

1. **Recency (độ gần đây):** Món mua gần đây có xác suất mua lại cao hơn món mua từ lâu.
2. **Frequency (tần suất):** Khách mua món thường xuyên (nhiều đơn) có xác suất mua lại cao hơn khách mua ít.

Kênh mua lại trong hệ này **tách hai tín hiệu này**:
- `0.5^(DaysSince / half_life)` → recency (decay theo thời gian).
- Tổng qua nhiều đơn → frequency (đếm số lần mua).

### 12.3 Tài liệu tham khảo

> **Anderson, A., Kumar, R., Tomkins, A., & Vassilvitskii, S. (2014).**
> The dynamics of repeat consumption. *WWW '14*, 419–430.
> — Nghiên cứu về động lực học mua lại: tần suất và recency là hai tín hiệu mạnh nhất.

> **Bhagat, R., Muralidharan, S., Lobzhanidze, A., & Vishwanath, S. (2018).**
> Buy It Again: Modeling repeat purchase recommendations. *KDD '18*, 62–70.
> — Mô hình mua lại trong production tại Amazon scale.

> **Burke, R. (2002).**
> Hybrid recommender systems: Survey and experiments.
> *User Modeling and User-Adapted Interaction*, 12(4), 331–370.
> — Phân loại các cách hybrid: weighted, switching, feature combination, etc.

---

## Phụ lục: Tóm tắt vòng đời kênh mua lại

```
1. Train (build_recommender)
   └─► fetch_purchase_events()  →  pull từ ClickHouse
   └─► RepeatModel.fit()         →  tính rêp(u, i) = Σ 0.5^(DaysSince / 7)
   └─► HybridRecommender(cf, cb, params, repeat)

2. Inference (recommend(customer_id, top_k))
   └─► _cf_and_repeat()          →  cf_hat, rep_hat, purchased
   └─► components()              →  chuẩn hoá từng kênh về [0, 1]
   └─► rank()                    →  final = α·cf + (1-α)·cb + γ·rep
                                   →  lọc blocked + purchased (nếu allow_repeat=False)
                                   →  top-K theo final score + tie-breaking
   └─► trả về (product_id, score, reason)
                                   reason = "repeat" nếu món lên top nhờ kênh mua lại
```

---

*Lần cập nhật cuối: 2026-10-08*
