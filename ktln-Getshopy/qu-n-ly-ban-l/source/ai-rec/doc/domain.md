# Domain Document — AI Recommendation System (AI-Rec)

> **Phiên bản:** 1.0
> **Ngày:** 2026-10-07
> **Phạm vi:** Mô tả toàn diện hệ thống gợi ý sản phẩm — từ dữ liệu nguồn, mô hình AI, cách phân chia tập train/test, đến các bảng trong schema `serving` và chức năng của chúng.

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Mô hình AI đang sử dụng](#2-mô-hình-ai-đang-sử-dụng)
   - 2.1 [Item-based Collaborative Filtering (Item-CF)](#21-item-based-collaborative-filtering-item-cf)
   - 2.2 [Content-Based Filtering](#22-content-based-filtering)
   - 2.3 [Kênh mua lại (Repeat Model)](#23-kênh-mua-lại-repeat-model)
   - 2.4 [Hybrid Recommender](#24-hybrid-recommender)
3. [Dữ liệu đầu vào](#3-dữ-liệu-đầu-vào)
   - 3.1 [Nguồn dữ liệu từ hệ BigData](#31-nguồn-dữ-liệu-từ-hệ-bigdata)
   - 3.2 [Tín hiệu hành vi phụ](#32-tín-hiệu-hành-vi-phụ)
4. [Phân chia Train / Validation / Test](#4-phân-chia-train--validation--test)
5. [Phân khúc khách hàng được gợi ý](#5-phân-khúc-khách-hàng-được-gợi-ý)
6. [Các case AI xử lý đặc biệt](#6-các-case-ai-xử-lý-đặc-biệt)
   - 6.1 [Item cold-start](#61-item-cold-start)
   - 6.2 [User cold-start](#62-user-cold-start)
   - 6.3 [User có đơn hàng thông thường](#63-user-có-đơn-hàng-thông-thường)
   - 6.4 [Xử lý sản phẩm đã mua](#64-xử-lý-sản-phẩm-đã-mua)
7. [Các bảng trong schema `serving` (ClickHouse)](#7-các-bảng-trong-schema-serving-clickhouse)
   - 7.1 [pairs_customer_product](#71-pairs_customer_product)
   - 7.2 [processed_data_for_AI_rec](#72-processed_data_for_ai_rec)
   - 7.3 [catalog_features](#73-catalog_features)
   - 7.4 [product_features](#74-product_features)
   - 7.5 [purchase_events_for_AI_rec](#75-purchase_events_for_ai_rec)
   - 7.6 [customer_preference_signals](#76-customer_preference_signals)
   - 7.7 [customer_product_events](#77-customer_product_events)
   - 7.8 [mart_revenue](#78-mart_revenue)
8. [Luồng dữ liệu từ BigData → AI-Rec](#8-luồng-dữ-liệu-từ-bigdata--ai-rec)

---

## 1. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HỆ BIGDATA / LAKEHOUSE                             │
│  Postgres (Ecommerce) ──► CDC/Kafka ──► MinIO (Parquet) ──► ClickHouse       │
│                                                           └──► dbt transform  │
│                                                                             │
│  Database:                                                              │
│    masterdata: dim_products, dim_categories, dim_brands,                  │
│                dim_customer_preferences                                      │
│    warehouse: fact_orders_detail, user_events_stitched                       │
│    serving: [8 bảng phục vụ AI-Rec & Dashboard]                          │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ SELECT (HTTP)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI-REC SERVICE (Python)                               │
│                                                                             │
│  Train cycle (định kỳ 5 phút):                                            │
│    ┌──────────────────────────────────────────────────────────────┐         │
│    │  1. fetch_training_data()    → processed_data_for_AI_rec    │         │
│    │  2. fetch_product_features()→ product_features             │         │
│    │  3. fetch_purchase_events() → purchase_events_for_AI_rec    │         │
│    │  4. fetch_preference_signals()→ customer_preference_signals│         │
│    │  5. fetch_behavior()        → customer_product_events       │         │
│    │  6. fit() → HybridRecommender (CF + CB + Repeat)          │         │
│    │  7. precompute cache (top-K cho tất cả khách đã biết)      │         │
│    └──────────────────────────────────────────────────────────────┘         │
│                                                                             │
│  Serving:                                                                 │
│    /recommend/{customer_id}  → Top-K sản phẩm + lý do                      │
│    /health                   → Trạng thái model + các bảng nguồn            │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ REST API
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ECOMMERCE WEB (Next.js / Node.js)                       │
│    - Hiển thị ô gợi ý "Có thể bạn thích" trên trang sản phẩm            │
│    - Lấy gợi ý cho từng khách đã đăng nhập                                │
│    - Onboarding: thu thập sở thích (danh mục, hãng, tầm giá)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Mô hình AI đang sử dụng

Hệ thống sử dụng **Hybrid Recommender** — kết hợp 3 kênh gợi ý:

```
final(u, i) = α · ĉf(u,i) + (1−α) · ĉb(u,i) + γ · rêp(u,i)
```

| Ký hiệu | Tên | Vai trò |
|---|---|---|
| `ĉf` | Item-CF | Gợi ý món "khách giống bạn cũng mua" — kênh khám phá |
| `ĉb` | Content-Based | Gợi ý món phù hợp danh mục/hãng/tầm giá của khách — kênh nội dung |
| `rêp` | Repeat Model | Gợi ý món khách đã mua trước đó — kênh mua lại |
| `α` | Trọng số CF | `n/(n+k)` — khách càng nhiều lịch sử càng tin CF |
| `γ` | Trọng số mua lại | Mặc định 1.0 |

---

### 2.1 Item-based Collaborative Filtering (Item-CF)

**Mục đích:** Gợi ý món mà khách hàng chưa mua, dựa trên độ tương đồng giữa các sản phẩm.

**Cách hoạt động:**
1. Xây dựng ma trận User-Item từ lịch sử mua (dạng sparse CSR)
2. Áp dụng time decay: `w = Quantity × 0.5^(days/half_life)` với half-life = **7 ngày**
3. Chuẩn hóa vector sản phẩm (L2 normalization)
4. Tính cosine similarity giữa các sản phẩm
5. Gợi ý: với mỗi khách, lấy các món đã mua, tìm món tương tự, xếp hạng

**Đặc điểm:**
- **Ma trận hồ sơ (profile matrix):** = ma trận mua + tín hiệu hành vi phụ (nếu bật)
- **Input scale:** `log` (log(1 + x)) — mua 10 cái không nặng gấp 10 lần mua 1 cái
- **Cold-start:** Khách mới → gợi ý Most-Popular

**Tham số đã chọn trên validation (01/10/2026):**
- `half_life_days = 7`
- `input_scale = "log"`
- `cf_shrink_k = 0` (dùng thuần CF cho phần khám phá)

**Tài liệu tham khảo:**
- Sarwar, B., et al. (2001). Item-based collaborative filtering recommendation algorithms. WWW '01.

---

### 2.2 Content-Based Filtering

**Mục đích:** Gợi ý sản phẩm dựa trên đặc trưng nội dung, phù hợp với sở thích của khách (từ lịch sử mua + onboarding).

**Đặc trưng sản phẩm (3 nhóm):**
| Nhóm | Giá trị | Nguồn |
|---|---|---|
| `ParentCategory` | Danh mục gốc (lấy từ `parent_id`) | `dim_categories` |
| `Brand` | Mã hãng | `dim_brands` |
| `PriceBand` | Tầm giá: `lt5`, `5to15`, `15to30`, `gt30` | `dim_products.price` |

**Cách hoạt động:**
1. Mỗi sản phẩm là vector one-hot trên 3 nhóm đặc trưng
2. Hồ sơ khách: phân phối xác suất trên mỗi nhóm, cộng thêm tín hiệu onboarding
   ```
   p_u^g(v) = (H_u(v) + c·O_u(v)) / Σ(H_u(v') + c·O_u(v'))
   ```
   - `H_u(v)`: tổng trọng số mua (đã decay) của món có giá trị v
   - `O_u(v)`: 1 nếu khách "thích" giá trị v ở onboarding
   - `c`: trọng số onboarding (mặc định 1.0)
3. Điểm nội dung: tích vô hướng giữa hồ sơ khách và vector sản phẩm

**Xử lý "không quan tâm":**
- Danh mục/hãng khách chọn "không thích" → **LỌC CỨNG** (blocked), không trừ điểm
- Lý do: món bị ghét vẫn có thể lọt top nếu các kênh khác đẩy đủ cao

**Bộ ứng viên:**
- Không duyệt toàn bộ 600k sản phẩm
- Chỉ duyệt đại diện mỗi ô (ParentCategory × Brand × PriceBand): tối đa **20 sản phẩm/ô**
- Món đã bán thực tế luôn được đưa vào ứng viên

**Tài liệu tham khảo:**
- Pazzani, M. J., & Billsus, D. (2007). Content-based recommendation systems. The Adaptive Web.
- Lops, P., et al. (2011). Content-based recommender systems: State of the art. Recommender Systems Handbook.

---

### 2.3 Kênh mua lại (Repeat Model)

**Mục đích:** Gợi ý món khách đã mua trước đó — phục vụ nhu cầu mua lại (rìu, mực, thức ăn cho thú cưng...).

**Cách hoạt động:**
```
rep(u, i) = Σ 0.5^(days_since_order / half_life)
```
- Mỗi lần mua được đếm riêng (khác với cách cũ: tổng số lượng nhân độ gần đây)
- Half-life dùng chung với CF (7 ngày)

**Ưu điểm so với cách cũ:**
- Đơn sỉ 5 cái không còn nặng hơn 3 lần mua lẻ gần đây
- Tần suất và độ gần đây là hai tín hiệu mạnh nhất của việc mua lặp

**Cấu hình:**
- Không lọc ngưỡng số người mua (khác CF) vì điểm mua lại chỉ phụ thuộc lịch sử của chính khách

**Tài liệu tham khảo:**
- Anderson, A., et al. (2014). The dynamics of repeat consumption. WWW '14.
- Bhagat, R., et al. (2018). Buy It Again: Modeling repeat purchase recommendations. KDD '18.

---

### 2.4 Hybrid Recommender

**Công thức trộn:**
```
final(u, i) = α·ĉf(u,i) + (1−α)·ĉb(u,i) + γ·rêp(u,i)
```

**Trọng số α (co rút CF):**
```python
alpha = n_items / (n_items + k)  # n_items = số món khách đã mua
```
- `k = 0`: khách có lịch sử dùng thuần CF, khách mới dùng thuần content-based
- `k = ∞`: thuần content-based

**Chuẩn hóa:**
- Mỗi kênh chuẩn hóa về [0,1] theo giá trị lớn nhất CỦA KHÁCH ĐÓ
- α và γ so sánh "món tốt nhất của kênh này" với "món tốt nhất của kênh kia"

**Tham số đã chọn (01/10/2026):**
| Tham số | Giá trị | Ý nghĩa |
|---|---|---|
| `cf_shrink_k` | 0 | Dùng thuần CF cho phần khám phá |
| `repeat_weight (γ)` | 1.0 | Trọng số kênh mua lại |
| `allow_repeat` | True | Cho phép gợi ý món đã mua |

**Lý do gợi ý (reason):**
| Reason | Giải thích |
|---|---|
| `cf` | Khách giống bạn cũng mua |
| `content` | Hợp danh mục/hãng/tầm giá bạn hay mua hoặc đã chọn |
| `repeat` | Bạn từng mua món này |
| `popular` | Không có tín hiệu riêng — món bán chạy |

**Tài liệu tham khảo:**
- Burke, R. (2002). Hybrid recommender systems: Survey and experiments. User Modeling and User-Adapted Interaction.

---

## 3. Dữ liệu đầu vào

### 3.1 Nguồn dữ liệu từ hệ BigData

AI-Rec đọc **5 bảng** từ schema `serving` trong ClickHouse:

| Bảng | Mục đích | Tần suất cập nhật |
|---|---|---|
| `processed_data_for_AI_rec` | Tập train cho Item-CF | Dbt run (incremental) |
| `product_features` | Đặc trưng nội dung của ứng viên | Dbt run |
| `purchase_events_for_AI_rec` | Lịch sử mua theo đơn cho kênh mua lại | Dbt run |
| `customer_preference_signals` | Sở thích onboarding | Dbt run |
| `customer_product_events` | Tín hiệu hành vi phụ (xem/giỏ/yêu thích) | Dbt run |

**Lưu ý:** AI-Rec chỉ có quyền SELECT trên `serving.*`, không đọc được `masterdata.*`, `warehouse.*`, `analytics.*`. Do đó các bảng serving phải là **TABLE** (không phải VIEW) vì ClickHouse VIEW kiểm quyền trên bảng gốc theo người gọi.

---

### 3.2 Tín hiệu hành vi phụ

**Đang TẮT** (mặc định). Bật qua biến môi trường `CF_BEHAVIOR_MODE`.

**Nguồn:** `serving.customer_product_events`

**Tín hiệu:**
- `Views`: Số lượt xem (không tính lượt xem từ ô gợi ý — tránh vòng tự củng cố)
- `DwellSec`: Tổng thời gian xem (mỗi lượt ≤ 10 phút)
- `Carts`: Số lần thêm vào giỏ
- `Wishlists`: Số lần thêm vào yêu thích

**Công thức:**
```
s_ui = [w_view·f(xem) + w_cart·giỏ + w_wish·yêu_thích] × 0.5^(days/half_life)
```

**Trạng thái:** Chỉ bật khi có dữ liệu hành vi thật từ client. Dữ liệu seed hiện tại không liên quan đến gu mua, bật lên chỉ thêm nhiễu.

**Tài liệu tham khảo:**
- Chaney, A. J. B., et al. (2018). How algorithmic confounding in recommendation systems increases homogeneity. RecSys '18.
- Hu, Y., et al. (2008). Collaborative filtering for implicit feedback datasets. ICDM '08.

---

## 4. Phân chia Train / Validation / Test

**Phương pháp:** Cắt theo thời gian toàn cục (Campos et al., 2014)

```
Tất cả đơn hàng (theo thứ tự thời gian)
│
├─── Train (70%) ──────────────────────── Validation (15%) ─────── Test (15%)
│
Mốc cắt validation              Mốc cắt test              Hiện tại
```

**Nguyên tắc:**
- **Không "để lại đơn cuối của từng khách"**: vì model học cả đơn của người khác diễn ra SAU thời điểm cần dự đoán
- **Cắt theo SỐ ĐƠN** (không theo số ngày): dữ liệu dồn cục ở cuối

**Tái hiện production:**
- Train: cộng dồn theo cặp (CustomerID, ProductID), lọc món có < 3 người mua
- Test: ground truth = món khách mua trong giai đoạn test

**Bài toán đánh giá (tách 2 bài toán):**
| Bài toán | Ground truth | Mục đích |
|---|---|---|
| `overall` | Mọi món mua ở test | Đánh giá tổng thể |
| `discovery` | Chỉ món CHƯA từng mua trong train | Đánh giá khả năng khám phá |
| `repurchase` | Chỉ món ĐÃ từng mua | Đánh giá kênh mua lại |

**Chỉ số đánh giá:**
- **Precision@K**: số món trúng / K
- **Recall@K**: số món trúng / tổng món khách mua
- **HitRate@K**: tỉ lệ khách có ít nhất 1 món trúng
- **NDCG@K**: đánh giá xếp hạng có trọng số vị trí
- **MAP@K**: trung bình precision có trọng số

**Luật chọn cấu hình (QUYẾT ĐỊNH SẢN PHẨM):**
- Tối đa NDCG@10 tổng thể với **2–3 món đã mua trong top-10** (trung bình trên validation)
- Lý do: không ràng buộc thì γ = 10, phần lớn ô là món đã mua, khám phá ≈ 0

**Tài liệu tham khảo:**
- Campos, P. G., et al. (2014). Time-aware recommender systems: A comprehensive survey. UMUAI.
- Järvelin, K., & Kekäläinen, J. (2002). Cumulated gain-based evaluation of IR techniques. ACM TOIS.

---

## 5. Phân khúc khách hàng được gợi ý

| Phân khúc | Định nghĩa | Xử lý |
|---|---|---|
| **Khách mới hoàn toàn** | n = 0 (chưa mua, chưa onboarding) | Most-Popular (sản phẩm bán chạy nhất) |
| **Khách mới đã duyệt** | Có tín hiệu hành vi (xem/giỏ/yêu thích) | Content-based từ hành vi duyệt |
| **Khách mới đã onboarding** | Đã chọn sở thích | Content-based từ onboarding |
| **Khách ít lịch sử** | 1–2 món trong train | Hybrid (α nhỏ → dùng nhiều content-based) |
| **Khách nhiều lịch sử** | 6+ món trong train | Hybrid (α lớn → dùng nhiều CF) |

**Cold-start mô phỏng:** Khách test được chia 5 phần; mỗi lượt xoá lịch sử của 1 phần, coi họ là khách mới, rồi so với Most-Popular và content-based từ onboarding giả lập.

---

## 6. Các case AI xử lý đặc biệt

Mục này mô tả **cách AI-Rec phản ứng với từng tình huống biên** — nơi dữ liệu thưa hoặc trống, hoặc nơi sản phẩm đã xuất hiện trong lịch sử mua. Mỗi case đều có file mã nguồn và (nếu đã đo) số liệu benchmark đính kèm.

### 6.1 Item cold-start

**Định nghĩa:** Sản phẩm có trong catalog (có ở `serving.catalog_features`) nhưng **chưa ai mua** trong tập train — vector cột trong ma trận User-Item toàn 0, nên cosine similarity không có "neo" để gợi ý.

**Vì sao xảy ra:**
- Sản phẩm mới nhập kho, chưa bán được đơn nào (hoặc < 3 người mua — đã bị lọc ở dbt).
- Sản phẩm đã bán rồi nhưng khách huỷ đơn (`order_status = CANCELLED`), không lọt vào `processed_data_for_AI_rec`.

**Cách AI-Rec xử lý:**

| Kênh | Xử lý | Mã nguồn |
|---|---|---|
| Item-CF | Loại khỏi tập ứng viên — ma trận CF đã lọc ở dbt theo ngưỡng `uniqExact(CustomerID) >= 3`, nên item mới (0 người mua) không xuất hiện trong `profile.columns`. | `cf_recommendation.py:_create_user_item_matrix` |
| Content-Based | Vẫn được chấm điểm — đặc trưng `(ParentCategory, PriceBand)` có sẵn ở `serving.product_features` và là đầu vào content-based. | `content_based.py:score` |
| Repeat | Không áp dụng — khách chưa mua thì không thể có tín hiệu mua lại. | `repeat.py:scores` |

**Trong danh sách ứng viên (`item_ids`):**
- Có CB → chỉ những item có trong `product_features` (khoảng 6.152 dòng theo thiết kế) được đưa vào tập ứng viên. Item mới hoàn toàn (chưa có ở `product_features`) bị loại.
- Không có CB (dbt lỗi) → dùng `cf.profile.columns` làm tập ứng viên — item mới không thể xuất hiện ở đây.

**Hệ quả:** Item cold-start **chỉ được gợi ý khi**:
1. Có trong `product_features` (tức admin đã chạy `dbt run` đủ để đưa vào ứng viên), và
2. Khớp ít nhất một chiều onboarding/khách đã chọn (danh mục, hãng hoặc tầm giá).

**Giải pháp bổ sung (chưa implement):** Khi item mới được nhập, có thể thêm tín hiệu giả (pseudo-count) dựa trên đặc trưng nội dung — đã có tham số `CB_ONBOARDING_PSEUDO_COUNT` cho khách, có thể áp dụng chiều ngược lại. Cần confirm trước khi implement.

---

### 6.2 User cold-start

**Định nghĩa:** Khách **chưa có trong ma trận train** của CF — không mua lần nào, hoặc chỉ vừa đăng ký.

**Phân loại chuyên sâu hơn Mục 5** (vì Mục 5 mới chỉ chia theo "đã mua / đã onboarding / đã duyệt"):

| Tiểu-case | ĐK nhận biết | Cách xử lý | Lý do gợi ý |
|---|---|---|---|
| **6.2.1 Khách vãng lai** | Chưa đăng nhập, không có `customer_id` | API trả rỗng — frontend hiển thị "Sản phẩm bán chạy" (gọi thẳng `popular_items` từ server) | `popular` |
| **6.2.2 Khách mới chưa làm gì** | Có `customer_id` nhưng `n_items = 0` trong CF, không có onboarding, không có behavior | Trộn hybrid: `α=0` nên `final = cb + γ·repeat = 0 + γ·0 = 0`. Tất cả `final ≤ 0` → bật sang `REASON_POPULAR` (xem `hybrid.py:230-233`) | `popular` |
| **6.2.3 Khách mới đã onboarding** | Có trong `customer_preference_signals` | Content-Based dùng tín hiệu onboarding; `α=0` vẫn; `cb > 0` nên vào top | `content` (hoặc `popular` nếu không match món nào) |
| **6.2.4 Khách mới đã duyệt hàng** | Có trong `customer_product_events` (chỉ khi `CF_BEHAVIOR_MODE != "none"`) | Behavior weights đi vào **ma trận HỒ SƠ** của CF; kênh khám phá dùng được. Content-based cũng có thêm tín hiệu từ hành vi (xem `content_based.py`). | `cf` hoặc `content` tuỳ kênh thắng |

**Quy tắc chung cho user cold-start (Mục 5 + 6.2 gộp lại):**
1. Không bao giờ trả danh sách rỗng.
2. Nếu `final ≤ 0` cho mọi ứng viên → trả `popular_items` với reason = `popular`.
3. Sản phẩm "không quan tâm" (blocked) bị loại ở bước `exclude` **trước** khi tính top-K.

**Tham số `cb_shrink_k`:** Hiện tại `HYBRID_CF_SHRINK_K = 5`. Công thức `α = n/(n+k)` → user mới (`n=0`) có `α=0` (tin content thuần), user có 5 món khác nhau đã mua có `α=0.5` (tin CF và CB ngang nhau), user 30 món đã mua có `α≈0.86` (gần như thuần CF). Có thể chỉnh nếu validation cho thấy user mới cần tin content nhiều hơn.

**Số liệu benchmark:** Xem `evaluation/results/benchmark_20260930_203039.md` (cấu hình production hiện tại).

---

### 6.3 User có đơn hàng thông thường

**Định nghĩa:** Khách có trong ma trận train, số món khác nhau đã mua `n ≥ 1`.

**Cách xử lý (đường đi của một request):**

```
Request GET /recommend/{customer_id}?top_k=10
  │
  ▼
CFModelService.recommend_for_customer(cid, top_k=10)        [api/service.py:419]
  │
  ├─── cache hit (cid ∈ bundle.cache, len ≥ top_k)
  │      → trả cache[cid][:top_k]                            (~0.1ms, dict lookup)
  │
  └─── cache miss → HybridRecommender.recommend(cid, top_k)
         │
         ▼
       HybridRecommender.components(cid)                      [models/hybrid.py:194]
         │
         ├─ _cf_and_repeat(cid)                                [hybrid.py:147]
         │   ├─ Lấy hàng của cid từ ma trận HỒ SƠ (CF)
         │   ├─ Tính cf_hat = norm · (norm[prow.indices]^T · prow.data)
         │   ├─ Lấy purchased[] từ ma trận MUA
         │   ├─ Nếu có RepeatModel → repeat.scores(cid)
         │   └─ Zero-out cf_hat tại purchased[]               [hybrid.py:186]
         │
         ├─ cb.score(cid)                                     [content_based.py]
         │   ├─ Tính điểm theo đặc trưng + onboarding
         │   └─ Trả về blocked[] (không quan tâm)
         │
         └─ HybridRecommender.rank (comp, params, k)
                ├─ α = n_u / (n_u + k)
                ├─ final = α·cf + (1−α)·cb + γ·repeat
                ├─ exclude = blocked ∪ (purchased nếu allow_repeat=False)
                ├─ order = lexsort(tiebreak, -final)
                ├─ order = order[~exclude[order]][:top_k]
                └─ reason = argmax(cf, cb, repeat) hoặc 'popular' nếu final ≤ 0
```

**Đặc điểm:**
- **Không có request lỗi**: nếu cache miss, code rơi về tính tại chỗ từ cùng bản model đang phục vụ (atomic swap đảm bảo).
- **Tập ứng viên** luôn là `item_ids` (~6k nếu CB có, hoặc `profile.columns` nếu CB lỗi) — KHÔNG phải toàn bộ 600k sản phẩm.
- **`allow_repeat=True`** (mặc định): món đã mua có thể xuất hiện trong top nếu `repeat` thắng.
- **`allow_repeat=False`**: chỉ `exclude` thêm `purchased` — đảm bảo không bao giờ gợi ý lại món đã mua.

**Tham số hiện tại (production):**

| Tham số | Giá trị | Ý nghĩa |
|---|---|---|
| `half_life_days` | 7 | Time decay cho cả CF và repeat (chọn trên validation 01/10) |
| `cf_input_scale` | `log` | log(1+x) — chống skew bởi mua sỉ |
| `cf_shrink_k` | 5 | Co rút hybrid α = n/(n+5) |
| `repeat_weight (γ)` | 0.5 | Trọng số kênh mua lại |
| `allow_repeat` | True | Cho phép món đã mua trong top |
| `repeat_score` | `order_freq` | Dùng bảng `purchase_events_for_AI_rec` (RepeatModel) |
| `top_k` | 10 (mặc định API) | Số món trả về |

---

### 6.4 Xử lý sản phẩm đã mua

Đây là phần chi tiết nhất — vì cách model phân biệt "đã mua" ảnh hưởng trực tiếp đến UX (có nên gợi ý lại món đã mua hay không) và đến số liệu benchmark (2–3 món đã mua trong top-10 là ràng buộc sản phẩm).

#### 6.4.1 Định nghĩa "đã mua" trong code

| Nguồn dữ liệu | Phạm vi | Vai trò |
|---|---|---|
| **Ma trận MUA** (`cf.user_item_matrix`) | Từ `serving.processed_data_for_AI_rec` — chỉ đơn `PAID`, lọc `Quantity > 0` | **DUY NHẤT** cái gọi là "đã mua" trong logic rank |
| Ma trận HỒ SƠ (`cf.profile_matrix`) | Mua + behavior (nếu bật) | Dùng để **tính điểm CF**, KHÔNG dùng để xác định đã mua |
| `serving.purchase_events_for_AI_rec` | Từng dòng = mỗi đơn (OrderID) | Chỉ đi vào **RepeatModel** |

**Quan trọng:** Hành vi (view/cart/wish) trong `customer_product_events` KHÔNG tính là "đã mua". Xem sản phẩm nhiều lần nhưng chưa mua → sản phẩm đó vẫn được chấm điểm CF bình thường (`cf_recommendation.py:498-503`).

#### 6.4.2 Ba nơi "đã mua" được xử lý khác nhau

**a) Item-CF — kênh KHÁM PHÁ (hybrid.py:186-188)**
```python
cf_hat[purchased] = 0.0   # tắt điểm CF cho món đã mua
```
- Lý do: comment dòng 187 — "CF là kênh khám phá, món đã mua để kênh mua lại lo".
- Hệ quả: Kênh CF **không bao giờ** gợi ý lại món đã mua. Mọi điểm CF ở `purchased` bị zero-out.

**b) Repeat Model — kênh MUA LẠI (models/repeat.py:38-65)**
```python
rep(u, i) = Σ_{đơn o của u có i} 0.5^(ngày_o / half_life)
```
- **Half-life = 7 ngày** (chia sẻ từ `cf.resolved_half_life()`).
- Mỗi đơn có `w` riêng; món mua nhiều đơn gần đây → điểm cao.
- Sau đó chuẩn hoá về `[0, 1]` theo giá trị cao nhất của khách đó (`_unit_max`).
- Kênh này **CHỈ chấm điểm cho món đã mua** — nếu khách chưa từng mua món i thì `rep(u, i) = 0`.

**c) Content-Based (models/content_based.py)**
- Không phân biệt đã mua / chưa mua — chỉ dựa trên đặc trưng và tín hiệu onboarding.
- Hệ quả: một món có thể có `cb > 0` dù khách đã mua, nhưng nếu `final` ở món đó vẫn thắng (chủ yếu nhờ `cb`) thì món đó có thể lọt vào top nếu `allow_repeat=True`.

#### 6.4.3 Quyết định cuối — `rank()` (hybrid.py:211-235)

```python
exclude = comp["blocked"].copy()               # "không quan tâm"
if not params.allow_repeat:
    exclude |= comp["purchased"]               # loại món đã mua nếu allow_repeat=False

order = np.lexsort((self._tiebreak, -final))   # xếp theo điểm, phá hoà
order = order[~exclude[order]][:top_k]

parts = np.vstack([w_cf, w_cb, w_rep])
labels = (REASON_CF, REASON_CONTENT, REASON_REPEAT)
reason = labels[int(parts[:, col].argmax())] if final > 0 else REASON_POPULAR
```

**Ma trận quyết định:**

| Trạng thái khách | Tín hiệu | `final` món đã mua | `allow_repeat` | Kết quả |
|---|---|---|---|---|
| Đã mua, có tín hiệu gần đây | `rep > 0`, `cf = 0`, `cb` ≥ 0 | = `γ·rep + (1−α)·cb` | True | **Có thể vào top** với reason `repeat` (nếu `rep` thắng) hoặc `content` |
| Đã mua, không có tín hiệu gần | `rep ≈ 0`, `cf = 0`, `cb` ≥ 0 | = `(1−α)·cb` | True | **Có thể vào top** với reason `content` |
| Đã mua, không quan tâm (blocked) | `rep` ≥ 0, `cb < 0` hoặc blocked_mask=True | bất kỳ | True | **LOẠI** ở bước `exclude` |
| Đã mua | bất kỳ | bất kỳ | False | **LOẠI** ở bước `exclude` |

#### 6.4.4 Số liệu benchmark

Yêu cầu sản phẩm (Mục 4): **2–3 món đã mua trong top-10** (trung bình validation).
- Đạt được nhờ `γ = 0.5` (không quá cao — không ràng buộc thì validation chọn `γ = 5`, lúc đó phần lớn top-10 là món đã mua, khám phá ≈ 0).
- File tham chiếu: `evaluation/results/benchmark_20260930_203039.md`.

#### 6.4.5 Lý do gợi ý `repeat`

Trong `rank()`:
```python
reason = labels[int(parts[:, col].argmax())] if final > 0 else REASON_POPULAR
```
- `parts[:, col]` = 3 giá trị `[α·cf, (1−α)·cb, γ·rep]` của **món đang xét**.
- `argmax` chọn kênh thắng.
- Nếu `γ·rep` thắng → reason = `repeat` → frontend hiển thị "Bạn từng mua món này".

**Lưu ý UX — cần confirm với frontend:**
- Lý do `repeat` đang được gán khi kênh `rep` thắng — nghĩa là **món đã mua từ lâu nhưng CF/CB cũng cao** sẽ hiển thị "repeat". Có thể gây hiểu nhầm ("món này tôi đã mua rồi mà sao lại gợi ý"). Xem `models/hybrid.py:228-233`.

---

## 7. Các bảng trong schema `serving` (ClickHouse)

### 7.1 `pairs_customer_product`

**Trạng thái:** Chưa tồn tại (cần `dbt run`)

**Mục đích:** Bảng cơ sở — mọi cặp (khách, sản phẩm) đã mua, lưu trữ dạng incremental.

**Schema:**
| Cột | Kiểu | Mô tả |
|---|---|---|
| `CustomerID` | String | Khách hàng |
| `ProductID` | String | Sản phẩm |
| `Quantity` | Int32 | Tổng số lượng đã mua |
| `LastPurchasedAt` | DateTime64(3, 'UTC') | Lần mua gần nhất — dùng tính time decay |
| `updated_at` | DateTime | Mốc dbt ghi dòng — dùng cho incremental watermark |

**Engine:** `ReplacingMergeTree(updated_at)` — append-only, giữ bản có `updated_at` lớn nhất

**Lưu ý:** 
- BẮT BUỘC đọc kèm `FINAL` nếu truy vấn trực tiếp
- AI-Rec **KHÔNG đọc** bảng này — chỉ đọc `processed_data_for_AI_rec`

---

### 7.2 `processed_data_for_AI_rec`

**Trạng thái:** Đang tồn tại (4.033.015 dòng) — nhưng **thiếu cột `LastPurchasedAt`**

**Mục đích:** **Tập train chính** cho Item-CF. Đã `FINAL` sẵn và đã lọc sản phẩm quá ít người mua.

**Schema (theo mã dbt mới nhất):**
| Cột | Kiểu | Mô tả |
|---|---|---|
| `CustomerID` | String | Khách hàng |
| `ProductID` | String | Sản phẩm |
| `Quantity` | Int32 | Tổng số lượng đã mua |
| `LastPurchasedAt` | DateTime64(3, 'UTC') | Lần mua gần nhất — **thiếu trong bảng thực tế** |

**Logic tạo (từ file dbt):**
```sql
WITH popular_enough AS (
    SELECT ProductID
    FROM pairs_customer_product FINAL
    WHERE Quantity > 0
    GROUP BY ProductID
    HAVING uniqExact(CustomerID) >= 3  -- min_buyers_per_product
)
SELECT p.CustomerID, p.ProductID, p.Quantity, p.LastPurchasedAt
FROM pairs_customer_product AS p FINAL
INNER JOIN popular_enough AS pe ON pe.ProductID = p.ProductID
WHERE p.Quantity > 0
```

**Lưu ý:**
- Đang thiếu `LastPurchasedAt` → time decay bị tắt trong model đang chạy
- Cần `dbt run --full-refresh` để thêm cột này

---

### 7.3 `catalog_features`

**Trạng thái:** Đang tồn tại (600.000 dòng)

**Mục đích:** Đặc trưng nội dung của **MỌI sản phẩm** đang bán.

**Schema:**
| Cột | Kiểu | Mô tả |
|---|---|---|
| `ProductID` | String | Mã sản phẩm |
| `ParentCategory` | String | Danh mục gốc |
| `Brand` | String | Mã hãng |
| `PriceBand` | String | Tầm giá: `lt5`, `5to15`, `15to30`, `gt30` |
| `CatalogSold` | Int32 | Số "đã bán" trên cửa hàng (sinh ngẫu nhiên) |

**Logic tạo:**
```sql
SELECT
    p.product_id AS ProductID,
    if(c.parent_id = '', c.category_id, c.parent_id) AS ParentCategory,
    p.brand_id AS Brand,
    price_band('p.price') AS PriceBand,  -- macro multiIf
    toInt32(p.sold) AS CatalogSold
FROM dim_products p
INNER JOIN dim_categories c ON c.category_id = p.category_id
INNER JOIN dim_brands b ON b.brand_id = p.brand_id
WHERE p.is_deleted = 0 AND b.is_deleted = 0
```

**PriceBand logic:**
```sql
multiIf(
    price < 5,000,000,  'lt5',
    price < 15,000,000, '5to15',
    price < 30,000,000, '15to30',
    'gt30'
)
```

**Lưu ý:**
- AI-Rec **KHÔNG đọc** bảng này trực tiếp — chỉ đọc `product_features`
- `CatalogSold` không phải tín hiệu thật, chỉ dùng phá hoà
- **PHẢI khớp** `PRICE_BANDS` trong `server/src/routes/onboarding.js`

---

### 7.4 `product_features`

**Trạng thái:** Chưa tồn tại (cần `dbt run`)

**Mục đích:** Đặc trưng content-based cho AI-Rec — chỉ **vài nghìn ứng viên** (đại diện mỗi ô + mọi món đã bán), không phải 600k sản phẩm.

**Schema:**
| Cột | Kiểu | Mô tả |
|---|---|---|
| `ProductID` | String | Mã sản phẩm |
| `ParentCategory` | String | Danh mục gốc |
| `Brand` | String | Mã hãng |
| `PriceBand` | String | Tầm giá |
| `UnitsSold` | Int64 | Tổng số lượng đã bán (từ `fact_orders_detail`) |
| `Buyers` | Int64 | Số khách khác nhau đã mua |
| `CatalogSold` | Int32 | Số "đã bán" trên cửa hàng (sinh ngẫu nhiên) |
| `CellRank` | UInt32 | Thứ hạng trong ô — dùng chọn ứng viên |

**Logic tạo:**
- Ba đặc trưng (nhóm × hãng × tầm giá) tạo ra vài trăm ô
- `CellRank <= 20` HOẶC `units > 0` → đưa vào ứng viên
- Xếp theo: `units DESC` → `catalog_sold DESC` → `product_id ASC`
- **Kích thước ước tính:** ~6.152 dòng

**Lưu ý:**
- Thứ tự xếp hạng **PHẢI khớp** `build_candidates()` trong `content_based.py`
- AI-Rec **ĐỌC** bảng này để xây dựng content-based model

---

### 7.5 `purchase_events_for_AI_rec`

**Trạng thại:** Chưa tồn tại (cần `dbt run`)

**Mục đích:** Lịch sử mua theo **TỪNG ĐƠN** cho kênh mua lại. Khác với `processed_data_for_AI_rec` (gộp theo cặp), bảng này giữ **một dòng cho mỗi (khách, món, đơn)**.

**Schema:**
| Cột | Kiểu | Mô tả |
|---|---|---|
| `CustomerID` | String | Khách hàng |
| `ProductID` | String | Sản phẩm |
| `OrderID` | String | Mã đơn hàng |
| `OrderedAt` | DateTime | Ngày đặt đơn (`min(order_date)`) |
| `Quantity` | Int32 | Số lượng trong đơn đó |

**Logic tạo:**
```sql
SELECT
    toString(f.customer_id) AS CustomerID,
    toString(f.product_id) AS ProductID,
    toString(f.order_id) AS OrderID,
    min(f.order_date) AS OrderedAt,
    sum(f.quantity) AS Quantity
FROM fact_orders_detail f FINAL
INNER JOIN dim_products p ON p.product_id = toString(f.product_id) AND p.is_deleted = 0
WHERE f._is_deleted = 0
  AND f.customer_id != 0
  AND f.product_id != 0
  AND f.order_status != 'CANCELLED'
  AND f.payment_status = 'PAID'
GROUP BY CustomerID, ProductID, OrderID
HAVING Quantity > 0
```

**Lưu ý:**
- **KHÔNG lọc ngưỡng** số người mua (khác `processed_data_for_AI_rec`)
- AI-Rec **ĐỌC** bảng này để tính điểm mua lại theo tần suất đơn

---

### 7.6 `customer_preference_signals`

**Trạng thái:** Chưa tồn tại (cần `dbt run`)

**Mục đích:** Sở thích onboarding dạng **dài** (long format) — một dòng là một tín hiệu `(khách, dimension, value, polarity)`.

**Schema:**
| Cột | Kiểu | Mô tả |
|---|---|---|
| `CustomerID` | String | Khách hàng |
| `Dimension` | String | `category` \| `brand` \| `price_band` |
| `Value` | String | Mã danh mục gốc / mã hãng / mã tầm giá |
| `Polarity` | Int8 | `1` = thích, `-1` = không quan tâm |

**Logic tạo:**
```sql
-- 5 nguồn UNION ALL:
-- liked_categories, disliked_categories,
-- liked_brands, disliked_brands,
-- price_band (chỉ 1 giá trị, luôn Polarity = 1)

SELECT CustomerID, Dimension, Value, Polarity
FROM signals
WHERE (dimension = 'category' AND value IN (SELECT category_id FROM dim_categories WHERE parent_id = ''))
   OR (dimension = 'brand' AND value IN (SELECT brand_id FROM dim_brands WHERE is_deleted = 0))
   OR (dimension = 'price_band' AND value IN ('lt5','5to15','15to30','gt30'))
```

**Lưu ý:**
- Bảng **chứa không phải view** — tài khoản `ai_rec` chỉ SELECT `serving`
- Xử lý xung đột: nếu vừa thích vừa không thích → bỏ khỏi THÍCH, giữ ở KHÔNG QUAN TÂM
- AI-Rec **ĐỌC** bảng này để xây dựng hồ sơ content-based từ onboarding

---

### 7.7 `customer_product_events`

**Trạng thái:** Đang tồn tại (0 dòng — `analytics.user_events` chưa có dữ liệu thật)

**Mục đích:** Tín hiệu hành vi phụ theo cặp (khách, món) — **hiện đang không sử dụng** (behavior mode = "none").

**Schema:**
| Cột | Kiểu | Mô tả |
|---|---|---|
| `CustomerID` | String | Khách hàng |
| `ProductID` | String | Sản phẩm |
| `Views` | UInt32 | Số lượt xem (không từ ô gợi ý) |
| `ViewsFromRec` | UInt32 | Số lượt xem từ ô gợi ý — tách riêng |
| `DwellSec` | Float64 | Tổng thời gian xem (giây, mỗi lượt ≤ 10 phút) |
| `Carts` | UInt32 | Số lần thêm vào giỏ |
| `Wishlists` | UInt32 | Số lần thêm vào yêu thích |
| `LastEventAt` | DateTime64(3, 'Asia/Ho_Chi_Minh') | Lần sự kiện cuối |

**Lưu ý:**
- Lượt xem từ `referrer = 'recommendation'` **tách riêng** — train lại trên chúng là vòng tự củng cố
- AI-Rec **ĐỌC** bảng này khi `CF_BEHAVIOR_MODE != "none"`

---

### 7.8 `mart_revenue`

**Trạng thái:** Đang tồn tại (167.974 dòng)

**Mục đích:** Doanh thu tổng hợp cho **dashboard admin** — không dùng cho AI-Rec.

**Schema:**
| Cột | Kiểu | Mô tả |
|---|---|---|
| `revenue_date` | Date | Ngày đặt đơn |
| `category_id` | String | Mã danh mục (giữ nguyên, không ép parent) |
| `brand_id` | String | Mã hãng |
| `payment_method` | String | Phương thức thanh toán |
| `orders` | UInt64 | Số đơn khác nhau |
| `units` | Int64 | Tổng số lượng |
| `gross_revenue` | Int64 | Tổng doanh thu (gồm PENDING_PAYMENT, CANCELLED) |
| `paid_revenue` | Int64 | Doanh thu thật — chỉ đơn `PAID` |
| `cancelled_value` | Int64 | Giá trị đơn bị huỷ |

**Lưu ý:**
- **Dashboard phải đọc `paid_revenue`**, không phải `gross_revenue`
- Giữ nguyên `category_id` (không ép parent) để dashboard drill-down theo danh mục con

---

## 8. Luồng dữ liệu từ BigData → AI-Rec

```
Postgres (Ecommerce)
    │
    │ CDC (Kafka Connect)
    ▼
MinIO (Parquet files)
    │
    │ ClickHouse (staging)
    ▼
fact_orders_detail, dim_products, dim_categories, dim_brands
    │
    │ dbt transform
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  DATABASE: serving                                               │
│                                                                  │
│  pairs_customer_product ──────┐                                  │
│                                ▼                                  │
│  processed_data_for_AI_rec ───┼──► [AI-Rec: Tập train CF]      │
│                                │                                  │
│  purchase_events_for_AI_rec ───┤                                  │
│                                │                                  │
│  product_features ──────────────┼──► [AI-Rec: Content-Based]     │
│  catalog_features ─────────────┘                                  │
│                                                                  │
│  customer_preference_signals ─────────► [AI-Rec: Onboarding]     │
│                                                                  │
│  customer_product_events ─────────────► [AI-Rec: Behavior]       │
│                                                                  │
│  mart_revenue ─────────────────────────────────► [Dashboard]     │
└─────────────────────────────────────────────────────────────────┘
```

**Chu kỳ cập nhật:**
1. CDC Kafka kéo thay đổi từ Postgres → Parquet → ClickHouse (real-time)
2. Dbt chạy transform định kỳ (thường mỗi giờ hoặc theo cron)
3. AI-Rec train lại mỗi **5 phút** (configurable qua `TRAIN_INTERVAL_SECONDS`)

---

## Phụ lục

### A. Quyền truy cập

| Bảng | Tài khoản `ai_rec` đọc? | Mục đích |
|---|---|---|
| `pairs_customer_product` | ❌ | Chỉ dbt ghi |
| `processed_data_for_AI_rec` | ✓ | Tập train CF |
| `catalog_features` | ✓ (benchmark dùng) | Benchmark export |
| `product_features` | ✓ | Content-Based |
| `purchase_events_for_AI_rec` | ✓ | Kênh mua lại |
| `customer_preference_signals` | ✓ | Onboarding |
| `customer_product_events` | ✓ | Hành vi phụ (hiện tắt) |
| `mart_revenue` | ✓ | Dashboard |

### B. So sánh cùng cặp "cơ sở ↔ dẫn xuất"

| | Cơ sở | Dẫn xuất |
|---|---|---|
| **pairs** ↔ **processed** | Bảng gốc (incremental) | View đã FINAL + lọc ≥3 người mua |
| **catalog** ↔ **product** | Mọi 600k sản phẩm | Chỉ ~6k ứng viên (đại diện ô) |
| **processed** ↔ **purchase_events** | 1 dòng / cặp (khách, món) | 1 dòng / (khách, món, đơn) |

### C. Việc cần làm (theo AGENTS.md)

| # | Việc | Hệ | Ghi chú |
|---|---|---|---|
| 1 | Chạy `dbt run --select serving+` để tạo 4 bảng còn thiếu | BigData | Bảng: pairs, product_features, purchase_events, preference_signals |
| 2 | Thêm cột `LastPurchasedAt` vào `processed_data_for_AI_rec` | BigData | Cần `dbt run --full-refresh` |
| 3 | Build lại image `kltn-ai-rec` sau khi (1)+(2) | AI-Rec | Code v0.4.0 đã sẵn sàng |

> **Lưu ý:** Theo AGENTS.md, mọi thay đổi kiến trúc / luồng dữ liệu phải được user duyệt trước khi implement.

### D. Tài liệu tham khảo

1. Sarwar, B., et al. (2001). Item-based collaborative filtering recommendation algorithms. WWW '01.
2. Pazzani, M. J., & Billsus, D. (2007). Content-based recommendation systems. The Adaptive Web.
3. Lops, P., et al. (2011). Content-based recommender systems: State of the art. Recommender Systems Handbook.
4. Burke, R. (2002). Hybrid recommender systems: Survey and experiments. UMUAI.
5. Anderson, A., et al. (2014). The dynamics of repeat consumption. WWW '14.
6. Bhagat, R., et al. (2018). Buy It Again: Modeling repeat purchase recommendations. KDD '18.
7. Campos, P. G., et al. (2014). Time-aware recommender systems: A comprehensive survey. UMUAI.
8. Hu, Y., et al. (2008). Collaborative filtering for implicit feedback datasets. ICDM '08.
9. Järvelin, K., & Kekäläinen, J. (2002). Cumulated gain-based evaluation of IR techniques. ACM TOIS.
10. Chaney, A. J. B., et al. (2018). How algorithmic confounding in recommendation systems. RecSys '18.
