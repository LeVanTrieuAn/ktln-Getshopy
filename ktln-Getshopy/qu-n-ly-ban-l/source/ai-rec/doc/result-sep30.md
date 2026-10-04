# AI-Rec — Báo cáo hiện trạng ngày 30/09/2026

Phạm vi: thư mục `ai-rec/` cùng các phần của hai hệ mà AI-Rec phụ thuộc (dbt `serving`,
tracking hành vi phía Ecommerce).

Nguồn số liệu: bản xuất dữ liệu ngày 29/09 (`evaluation/data/`) và benchmark
`evaluation/results/benchmark_20260929_031327.*`. **Ngày 30/09 đã chạy lại** benchmark
trong image `kltn-ai-rec` trên cùng dữ liệu: kết quả **trùng khớp từng chữ số** (hạt giống
cố định). Bộ test `python -m unittest discover tests`: **16/16 pass**.

> **Đính chính 01/10/2026.** Bản đầu của báo cáo này (và `evaluation/README.md` §Hạn chế 3)
> nói thời gian đặt đơn "ngẫu nhiên, không mang thông tin", nên time-decay không tinh chỉnh
> được. **Nhận định đó sai.** Dữ liệu có một lần **đổi gu đột ngột vào đầu tháng 9**:
> - tập món của cùng một khách trước và sau 10/09 gần như không trùng nhau (Jaccard trung
>   vị 0,07, trên 216 khách);
> - tỉ lệ dòng đơn là món khách đã mua trước đó tăng đều từ 10% (tháng 3) lên 62% (tháng 8),
>   rồi rơi xuống khoảng 30% trong 05–14/09.
>
> Validation và test đều nằm trong đợt dữ liệu 15–17/09. Thăm dò trên validation (không đụng
> test): half-life 7 ngày cho NDCG@10 khám phá 0,402, so với 0,347 ở half-life 30 ngày
> (+0,055, CI 95% [+0,029; +0,081]). Các mục §0, §2, §5.3, §5.4 dưới đây đã sửa theo phát hiện
> này.
>
> **Cơ chế — đã xác minh 01/10.** 3.490 đơn POS đến từ 5 lần chạy `pos_simulator.py` bằng tay
> (16–17/09), mỗi lần một `--seed` (gu mọi khách bị rút lại) và một khoảng ngày riêng. Chạy
> lại `build_orders` với đúng tham số từng lần tái tạo 3.490/3.490 đơn.
>
> **Đính chính thêm:** "gu khách không liên quan tới đặc trưng" cũng chưa đúng. Id sản phẩm
> được sinh theo từng hãng nên mỗi lát gu gần như thuần một hãng: tỉ trọng hãng mua nhiều
> nhất của mỗi khách có trung vị 0,57, so với khoảng 0,36 nếu mua ngẫu nhiên.
>
> **Kết quả sau cải tiến 01/10:** `evaluation/README.md` §Kết quả gần nhất.

---

## 0. Tóm tắt

| Câu hỏi | Trả lời ngắn |
|---|---|
| Tài liệu trong `ai-rec` đã cập nhật chưa? | **Mới một nửa.** Phần đánh giá (`evaluation/README.md`, docstring của các model) đã cập nhật đến 29/09. `README.md` và `doc/Chi_tiet_Toan_hoc_va_Co_che_Model_CF.md` vẫn là bản 13/09: chỉ mô tả CF thuần đọc CSV, không có hybrid, ClickHouse, giảm trọng số theo thời gian hay phần đánh giá. |
| Làm tới đâu? | Model hybrid (Item-CF + content-based + kênh mua lại) đã chạy production: đọc warehouse, tự train lại mỗi 5 phút, có benchmark offline với baseline và khoảng tin cậy. Còn chờ chốt tham số γ/k, và **chưa dùng dữ liệu hành vi duyệt web**. |
| Đã đo Precision và các chỉ số khác chưa? | **Đã đo:** Precision, Recall, HitRate, MAP, NDCG, Coverage ở K = 5/10/20, có CI 95%. Cấu hình đang chạy đạt P@10 = 0,130, NDCG@10 = 0,309. Item-CF gấp 2,5 lần Most-Popular ở bài toán khám phá. |
| Thuật toán? | Weighted hybrid (Burke, 2002): Item-based CF cosine (Sarwar et al., 2001) + content-based one-hot (Pazzani & Billsus, 2007) + kênh mua lại, lọc cứng "không quan tâm". |
| Mấy chiều dữ liệu? | **1 loại tương tác** (mua đã thanh toán) với 2 thuộc tính (số lượng, độ gần đây), **3 đặc trưng sản phẩm** (danh mục gốc, hãng, tầm giá) và **3 chiều sở thích onboarding**. Ma trận CF: 234 khách × 73 món. |
| Dữ liệu có đáp ứng không? | **Đủ để chứng minh pipeline và giao thức đánh giá, chưa đủ để kết luận về hành vi khách thật.** Đây là dữ liệu tổng hợp: chỉ 78/600.000 món từng được mua, "gu" khách không liên quan tới đặc trưng, gu bị đổi đột ngột đầu tháng 9 (xem đính chính), và chỉ 1 khách thật làm onboarding. |
| Thêm view/click/dwell thì sao? | Hạ tầng thu thập **đã có sẵn** (`analytics.user_events`) nhưng AI-Rec chưa đọc, và dữ liệu hiện có **toàn bộ là dữ liệu seed**. Nghiên cứu cho thấy tín hiệu đa hành vi giúp gợi ý tốt hơn, nhất là cho khách mới và món chưa ai mua. Trước khi dùng phải vá 3 lỗ hổng (§7.2). Phương án tích hợp chờ bạn chốt (§8). |

---

## 1. Tài liệu trong `ai-rec` đã cập nhật chưa

| File | Sửa lần cuối | Khớp code hiện tại? | Ghi chú |
|---|---|---|---|
| `README.md` | 13/09 | **Không** | Mô tả CF thuần đọc `data/raw/*.csv` (thư mục nay rỗng); cold-start chỉ bằng món phổ biến; nhắc `docker-compose.yml` trong `ai-rec/` mà file này không tồn tại (compose nằm ở gốc repo); response ghi thiếu trường `reason`. Các con số 600.000 × 50.000, 1.999.846 tương tác, "~18 MB RAM", "~7 ms" thuộc bộ CSV cũ, **không phải dữ liệu warehouse hiện tại** — không dùng trong luận văn nếu chưa đo lại. |
| `doc/Chi_tiet_Toan_hoc_va_Co_che_Model_CF.md` | 13/09 | **Một phần** | Toán cosine vẫn đúng, nhưng thiếu giảm trọng số theo thời gian, ngưỡng `min_buyers`, hybrid và kênh mua lại. |
| `doc/Nghien_cuu_chi_tiet_cac_mo_hinh_AI_Recommendation.md` | 13/09 | Không cần khớp | Khảo sát tổng quan các họ mô hình (CF, MF, content-based…). |
| `doc/Tong_hop_Recommendation_System.md` | 13/09 | Không cần khớp | Kiến thức chung về chỉ số. |
| `doc/Project_Brief_Ecommerce_DataLake.md` | 13/09 | Không cần khớp | Brief dự án. |
| `evaluation/README.md` | 29/09 | **Có** | Giao thức, kết quả, hạn chế. |
| Docstring `models/hybrid.py`, `models/content_based.py`, `evaluation/benchmark.py`, `config.py` | 29/09 | **Có** | Có công thức và trích nguồn. |
| `docs/implement-phase/results/results.md` §12, §14 (ngoài `ai-rec`) | 29/09 | **Có** | Nhật ký triển khai và tóm tắt benchmark. |

**Việc cần làm:** viết lại `README.md` và bổ sung vào file toán CF các phần: time-decay, ngưỡng
số người mua, hybrid, nguồn ClickHouse, endpoint `/health` và trường `reason`. Việc này chưa làm
vì bạn chỉ yêu cầu báo cáo (xem câu hỏi Q5 ở §8).

---

## 2. Tiến độ

| Hạng mục | Trạng thái | Chỗ trong code |
|---|---|---|
| Item-CF trên ma trận thưa CSR, cosine tính lúc suy luận | Xong | `models/cf_recommendation.py` |
| Giảm trọng số theo thời gian, half-life 30 ngày | Xong — half-life **chưa được tinh chỉnh**; thăm dò 01/10 cho thấy tinh chỉnh được và tác động lớn (xem đính chính) | `config.py` `RECENCY_HALF_LIFE_DAYS` |
| Content-based theo danh mục gốc / hãng / tầm giá + onboarding | Xong | `models/content_based.py` |
| Hybrid có trọng số + kênh mua lại + lọc cứng "không quan tâm" | Xong | `models/hybrid.py` |
| Đọc dữ liệu từ ClickHouse `serving` (tài khoản `ai_rec` chỉ có quyền SELECT) | Xong | `data_source/clickhouse.py` |
| Train nền 5 phút, tính sẵn top-20, đổi bản nguyên tử, `/health` | Xong | `api/service.py` |
| Server Node gọi AI-Rec bằng danh tính lấy từ token; trang chủ hiện 8 ô | Xong | `server/src/routes/recommendation.js`, `RecommendationService.js` |
| Benchmark offline: cắt theo thời gian, có baseline, bootstrap CI, tách discovery/repurchase, mô phỏng khách mới | Xong, đã tái lập ngày 30/09 | `evaluation/` |
| Test tự động | 16/16 pass (30/09) | `tests/` |
| Chốt γ (mức gợi ý lại món đã mua) và k | **Chờ quyết định sản phẩm** — γ = 1 là giá trị tạm | `config.py` |
| `CB_ONBOARDING_PSEUDO_COUNT` | **Chưa tinh chỉnh được**: mới có 1 khách thật làm onboarding | `config.py` |
| Dùng hành vi duyệt web (view, dwell, giỏ hàng, wishlist…) | **Chưa làm** — chi tiết ở §7 | — |
| Đánh giá online (CTR của ô gợi ý) | **Chưa làm** — chưa ghi log impression/click | — |
| Cập nhật `README.md` và tài liệu CF | **Chưa làm** | §1 |

---

## 3. Đo lường độ chính xác — đã đo

### 3.1 Giao thức (tóm tắt, bản đầy đủ ở docstring `benchmark.py`)

- **Cắt theo thời gian toàn cục** 70/15/15 (Campos et al., 2014): train 2.449 đơn,
  validation 524 đơn (từ 16/09 14:36), test 525 đơn (từ 17/09 12:17 tới 17/09 21:58).
- Tham số k, γ **chọn trên validation**, báo cáo **một lần trên test**.
- **Tách hai bài toán:** *discovery* (món khách chưa từng mua) và *repurchase* (món đã mua).
  Lý do: 63,5% món khách mua ở test là món họ đã từng mua.
- **Baseline** (Cremonesi et al., 2010): Random, Most-Popular (có và không gợi ý lại), Repeat-only.
- **Bootstrap 95%** theo khách, 1.000 mẫu (Efron & Tibshirani, 1993); chênh lệch được ghép cặp
  với CF trên cùng mẫu.
- Relevance nhị phân. NDCG theo Järvelin & Kekäläinen (2002).
- 176 khách có ground truth ở test (126 khách ở bài toán discovery).

### 3.2 Kết quả chính, K = 10

**Tổng thể** (ground truth = mọi món mua ở test):

| Model | P@10 | R@10 | Hit@10 | MAP@10 | NDCG@10 [CI 95%] |
|---|---|---|---|---|---|
| Random (catalog CF) | 0,055 | 0,141 | 0,420 | 0,039 | 0,090 [0,072; 0,109] |
| Most-Popular (cả món đã mua) | 0,082 | 0,225 | 0,563 | 0,075 | 0,149 [0,126; 0,176] |
| Repeat-only | 0,198 | 0,562 | 0,841 | 0,297 | 0,427 [0,386; 0,469] |
| Item-CF thuần | 0,065 | 0,181 | 0,483 | 0,093 | 0,156 [0,128; 0,188] |
| Content-based | 0,032 | 0,086 | 0,256 | 0,026 | 0,057 [0,042; 0,075] |
| Hybrid, γ = 10 (tối ưu theo validation) | 0,205 | 0,581 | 0,864 | 0,302 | 0,436 [0,392; 0,477] |
| **Hybrid — cấu hình đang chạy (k = 0, γ = 1)** | **0,130** | **0,383** | **0,767** | **0,199** | **0,309** [0,275; 0,348] |

**Discovery** (ground truth = món khách CHƯA từng mua):

| Model | P@10 | R@10 | Hit@10 | MAP@10 | NDCG@10 [CI 95%] |
|---|---|---|---|---|---|
| Random (catalog CF) | 0,033 | 0,151 | 0,294 | 0,039 | 0,079 [0,055; 0,104] |
| Most-Popular (bỏ món đã mua) | 0,050 | 0,267 | 0,413 | 0,081 | 0,141 [0,106; 0,178] |
| Content-based | 0,044 | 0,232 | 0,357 | 0,068 | 0,123 [0,091; 0,155] |
| **Item-CF thuần** | **0,091** | **0,505** | **0,675** | **0,261** | **0,350** [0,296; 0,405] |
| Hybrid — cấu hình đang chạy | 0,079 | 0,448 | 0,627 | 0,165 | 0,258 [0,214; 0,302] |

### 3.3 K = 5 và K = 20 (trang chủ hiện 8 ô, nằm giữa hai mức này)

| Model | Bài toán | P@5 | NDCG@5 | P@20 | R@20 | NDCG@20 |
|---|---|---|---|---|---|---|
| Hybrid đang chạy | Tổng thể | 0,180 | 0,267 | 0,090 | 0,496 | 0,353 |
| Item-CF thuần | Tổng thể | 0,084 | 0,134 | 0,044 | 0,228 | 0,175 |
| Most-Popular (cả món đã mua) | Tổng thể | 0,091 | 0,106 | 0,078 | 0,449 | 0,227 |
| Item-CF thuần | Discovery | 0,118 | 0,287 | 0,062 | 0,641 | 0,395 |
| Hybrid đang chạy | Discovery | 0,103 | 0,204 | 0,057 | 0,600 | 0,307 |
| Most-Popular (bỏ món đã mua) | Discovery | 0,044 | 0,083 | 0,046 | 0,467 | 0,201 |

Bảng đủ mọi K và mọi model: `evaluation/results/benchmark_20260929_031327.json`.

### 3.4 Vì sao Precision tuyệt đối trông thấp

Precision@K có trần là `min(|R_u|, K) / K`. Ở test, trung bình mỗi khách chỉ mua
**3,72 món khác nhau** (trung vị 3); ở bài toán discovery con số này là **1,9 món**. Trần
Precision tính từ dữ liệu test:

| | P@5 | P@10 | P@20 |
|---|---|---|---|
| Trần — tổng thể | 0,643 | 0,359 | 0,186 |
| Hybrid đang chạy (tỉ lệ so với trần) | 0,180 (28%) | 0,130 (36%) | 0,090 (48%) |
| Trần — discovery | 0,371 | 0,190 | 0,095 |
| Item-CF (tỉ lệ so với trần) | 0,118 (32%) | 0,091 (48%) | 0,062 (65%) |

Khi viết luận văn nên đọc NDCG/Recall/HitRate cùng với trần này, không nên đọc P@10 = 0,13
như "đúng 13%".

### 3.5 Khách mới, đánh đổi mua lại ↔ khám phá, độ phủ

**Khách mới mô phỏng** (5-fold, xoá lịch sử khỏi tập train; câu trả lời onboarding giả lập
từ chính lịch sử thật của khách → **cận trên**, giả định khách khai đúng gu):

| Model | R@10 | Hit@10 | NDCG@10 [CI 95%] |
|---|---|---|---|
| Most-Popular | 0,216 | 0,557 | 0,139 [0,116; 0,164] |
| Content-based từ onboarding | 0,265 | 0,648 | 0,186 [0,160; 0,212] |

Chênh lệch ghép cặp là +0,046 [+0,016; +0,075], tức onboarding có ích cho khách mới.

**Độ nhạy γ** (đo trên test, **không dùng để chọn tham số**):

| γ | Số món đã mua trong top-10 | NDCG tổng thể | NDCG discovery |
|---|---|---|---|
| 0 | 0 | 0,156 | 0,350 |
| 0,5 | 0,5 | 0,177 | 0,349 |
| **1 (đang chạy)** | 2,5 | 0,309 | 0,258 |
| 2 | 4,9 | 0,390 | 0,163 |
| 10 | 9,2 | 0,436 | 0,031 |

**Coverage@10:** cả CF lẫn hybrid phủ 73/73 món trong catalog CF, nhưng chỉ phủ **1,2% tập
6.152 ứng viên**. Content-based phủ 167 món (2,7%).

### 3.6 Cách đọc kết quả

1. **Item-CF có học được** cấu trúc đồng mua: NDCG discovery 0,350 so với 0,141 của
   Most-Popular, hai khoảng tin cậy không chồng nhau.
2. **Hybrid đang chạy thắng CF ở chỉ số tổng thể** (+0,153 [+0,118; +0,192]) nhờ gợi ý lại món
   đã mua, nhưng **thua CF ở bài toán khám phá** (−0,092 [−0,113; −0,072]). Chọn γ là quyết
   định sản phẩm.
3. **Repeat-only đạt 0,427** ở chỉ số tổng thể, cao hơn mọi model trừ γ = 10. Nghĩa là chỉ số
   tổng thể trên bộ dữ liệu này chủ yếu thưởng việc gợi ý lại đồ cũ.
4. **Content-based thua Most-Popular với khách đã có lịch sử.** Nguyên nhân là **bộ sinh dữ
   liệu**, không phải thuật toán (§5.3). Content-based chỉ có ích với khách mới.

---

## 4. Model hiện tại dùng thuật toán gì

### 4.1 Luồng dữ liệu đầu–cuối

```
Postgres (Ecom) ──Debezium/Kafka CDC──▶ MinIO (parquet) ──▶ ClickHouse staging
   │                                                           │ dbt
   │ CustomerPreference (onboarding) ──postgresql()──▶ masterdata.dim_customer_preferences
   ▼                                                           ▼
                        serving.processed_data_for_AI_rec  (VIEW: FINAL + ≥3 người mua)
                        serving.product_features           (6.152 ứng viên)
                        serving.customer_preference_signals (BẢNG)
                                         │  HTTP, tài khoản ai_rec (chỉ SELECT serving)
                                         ▼  kéo toàn bộ mỗi 300 s
                    AI-Rec: fit CF → fit CB → HybridRecommender → tính sẵn top-20
                                         │  GET /api/v1/recommend/customer/{id}
                                         ▼
      Server Node (RecommendationService, id lấy từ token) ──▶ trang chủ "Dành riêng cho bạn" (8 ô)
```

### 4.2 Kênh 1 — Item-based Collaborative Filtering (Sarwar et al., 2001)

- Trọng số tương tác, có giảm theo thời gian:
  `r_ui = Quantity_ui · 0,5^(DaysSince_ui / 30)`.
  `Quantity` là tổng số lượng của cặp (khách, món); `DaysSince` tính từ lần mua gần nhất.
- Mỗi món là một vector theo khách, được chuẩn hoá L2: `n_i = r_·i / ‖r_·i‖₂`.
- Điểm của khách u với món i: `cf(u,i) = Σ_{p ∈ P_u} r_up · cos(i, p)`. Biểu thức này tương
  đương hai phép nhân ma trận thưa `N · (N_Pᵀ · w)`, nên không cần lưu ma trận item × item.
- Chỉ đưa vào train những món có **≥ 3 người mua khác nhau** (`min_buyers_per_product`),
  để tránh cosine bị thổi lên ở món chỉ một người mua.
- **Chưa có:** cắt láng giềng top-N, co rút độ tương đồng, trọng số IUF. Cosine hiện dùng
  trên tất cả láng giềng (§6).

### 4.3 Kênh 2 — Content-based (Pazzani & Billsus, 2007; Lops et al., 2011)

- Mỗi món là vector one-hot trên 3 nhóm G = {ParentCategory, Brand, PriceBand}.
- Hồ sơ khách, tính riêng cho từng nhóm g, là một phân phối:
  `p_u^g(v) = (H_u(v) + c·O_u(v)) / Σ_v' (…)`. Trong đó H là trọng số mua đã giảm theo thời
  gian, O là lựa chọn "thích" ở onboarding, và `c = CB_ONBOARDING_PSEUDO_COUNT = 1`.
- Điểm: `cb(u,i) = Σ_g w_g · p_u^g(value_g(i)) / Σ_g w_g`, với w_g = 1.
- **Hệ quả:** mọi món cùng ô (nhóm × hãng × tầm giá) có cùng điểm. Catalog có 324 ô; mỗi ô
  lấy 20 đại diện, cộng thêm mọi món đã bán, được 6.152 ứng viên. Thứ tự các món trong một
  ô do độ phổ biến quyết định.
- "Không quan tâm" được **lọc cứng** ở mọi kênh, không phải trừ điểm.

### 4.4 Trộn — weighted hybrid (Burke, 2002)

```
final(u,i) = α_u · ĉf(u,i) + (1 − α_u) · ĉb(u,i) + γ · rêp(u,i)
α_u = n_u / (n_u + k)        n_u = số món khác nhau khách đã mua
```

- Mỗi kênh được chuẩn hoá về [0, 1] theo giá trị lớn nhất của chính khách đó.
- `ĉf` chỉ tính cho món chưa mua (kênh khám phá). `rêp` là trọng số mua đã giảm theo thời
  gian (kênh mua lại, theo Anderson et al., 2014).
- Đang chạy **k = 0** (chọn trên validation): khách đã mua dùng thuần CF cho phần khám phá,
  còn khách mới (n = 0) dùng thuần content-based. **γ = 1** là giá trị tạm; khi đó khoảng
  2,5/10 ô là món đã mua.
- Điểm bằng nhau được phá hoà theo: độ phổ biến đã giảm theo thời gian → CatalogSold →
  ProductID. Mỗi gợi ý kèm `reason ∈ {cf, content, repeat, popular}`.

### 4.5 Vận hành

- Mỗi 300 s train lại **toàn bộ**, vì Item-CF không train tăng dần được. `fit()` chỉ dựng ma
  trận thưa và chuẩn hoá, nên chạy nhanh.
- Tính sẵn top-20 cho mọi khách có tín hiệu, trần 60 s. Khách không có trong cache được tính
  tại chỗ.
- Model và cache được đóng gói trong một đối tượng bất biến và đổi bằng một phép gán, nên
  không có lúc model mới đi với cache cũ. File model ghi ra file tạm rồi `os.replace`.
- Benchmark toàn bộ (lưới 8 giá trị k × 8 giá trị γ, 5-fold khách mới, 1.000 mẫu bootstrap)
  chạy hết 12–15 s.

---

## 5. Dữ liệu: đang dùng mấy chiều, tính chất ra sao, có đáp ứng không

### 5.1 Các chiều tín hiệu AI-Rec đang dùng

| Nhóm | Thuộc tính | Bảng nguồn | Dùng ở |
|---|---|---|---|
| Tương tác (1 loại: **mua**, đơn đã PAID, không huỷ) | `Quantity` (tổng theo cặp) | `serving.processed_data_for_AI_rec` | CF, kênh mua lại, hồ sơ CB |
| | `DaysSince` (từ `LastPurchasedAt`) | như trên | Giảm trọng số theo thời gian |
| Đặc trưng sản phẩm | `ParentCategory` (8 giá trị) | `serving.product_features` | CB |
| | `Brand` (91 giá trị) | như trên | CB, lọc "không quan tâm" |
| | `PriceBand` (4 giá trị: <5, 5–15, 15–30, >30 triệu) | như trên | CB |
| | `UnitsSold`, `CatalogSold`, `CellRank` | như trên | Chọn ứng viên, phá hoà (**CatalogSold sinh ngẫu nhiên**) |
| Sở thích tường minh (onboarding) | category / brand / price_band × Polarity (+1 thích, −1 không quan tâm) | `serving.customer_preference_signals` | Hồ sơ CB, lọc cứng |

Tóm lại: **2 thuộc tính của 1 loại hành vi + 3 đặc trưng nội dung + 3 chiều sở thích tường minh.**
Không dùng thuộc tính nhân khẩu học, ngữ cảnh (thiết bị, giờ), văn bản mô tả, hay bất kỳ hành vi
nào ngoài mua.

### 5.2 Kích thước không gian (theo bản xuất ngày 29/09)

| Không gian | Kích thước |
|---|---|
| Ma trận user–item của CF | 234 khách × 73 món (78 món có người mua, 5 món dưới ngưỡng 3 người mua) |
| Không gian đặc trưng CB | tối đa 8 + 91 + 4 = 103 cột one-hot; 324 ô |
| Tập ứng viên hybrid | 6.152 món, trên catalog 600.000 món |

### 5.3 Tính chất thống kê của dữ liệu mua

| Chỉ số | Giá trị | Nhận xét |
|---|---|---|
| Dòng đơn / đơn / khách | 6.251 / 3.498 / 234 | Nhỏ |
| Món từng được mua / catalog | 78 / 600.000 (0,013%) | CF chỉ biết một góc rất nhỏ của catalog |
| Mật độ ma trận | **17,7%** | Rất dày. Để so sánh, MovieLens-100K có mật độ 6,3% (Harper & Konstan, 2015). Dữ liệu dày thì CF dễ học, nên kết quả CF ở đây **lạc quan** |
| Số món khác nhau mỗi khách | trung vị 14, trung bình 13,8, tối đa 34 | |
| Số người mua mỗi món | trung vị 39,5, tối thiểu 1, tối đa 88 | |
| Số đơn mỗi khách | trung vị 15,5 | |
| Cặp (khách, món) mua > 1 lần | 52,6% | Mua lặp chiếm ưu thế: 63,5% món ở test là món đã mua |
| Top-10 món chiếm | 26% sản lượng | Độ phổ biến phân bố khá đều, không có đuôi dài rõ rệt |
| Danh mục của 78 món đã mua | 56 phụ kiện di động, 15 nghe nhìn, 3 điện thoại, 2 laptop, 1 tablet, 1 phụ kiện laptop | Lệch mạnh về phụ kiện |
| Khoảng thời gian | 22/03 → 17/09/2026; **57,1% số đơn nằm trong 7 ngày cuối** | Validation chỉ dài khoảng 22 giờ, test khoảng 9,7 giờ |
| Onboarding thật | 1 khách | |
| Nguồn sinh | `data-platform-poc/pos_simulator.py` | "Gu" khách là 1–2 lát `product_id` liên tiếp; 85% món rút từ gu, 15% ngẫu nhiên |
| Trôi theo thời gian (đính chính 01/10) | Jaccard trung vị 0,07 giữa tập món trước/sau 10/09 của cùng khách; tỉ lệ mua lại 62% (tháng 8) → ~30% (05–14/09) | Có **một lần đổi gu đột ngột** — thời gian CÓ mang thông tin |

### 5.4 Dữ liệu có đáp ứng không

| Mục đích | Đáp ứng? | Lý do |
|---|---|---|
| Chứng minh pipeline CDC → warehouse → AI-Rec → web chạy đầu–cuối | **Có** | Đã kiểm chứng qua API thật (`results.md` §14.3) |
| Chứng minh Item-CF học được đồng mua | **Có, nhưng lạc quan** | CF gấp 2,5 lần Most-Popular. Tuy nhiên mật độ 17,7% và chỉ 73 món dễ hơn nhiều so với thương mại điện tử thật |
| Đánh giá content-based với khách có lịch sử | **Không** | (Đính chính 01/10) Lát gu có tương quan với hãng, nhưng danh mục bị phụ kiện áp đảo, tầm giá trộn lẫn, và tập ứng viên 6.152 món chỉ có 78 món từng được mua — log không thưởng gợi ý nội dung ngoài 78 món đó |
| Tinh chỉnh time-decay / kiểm tra khả năng theo kịp sở thích thay đổi | **Một phần** (đính chính 01/10) | Có một lần đổi gu đột ngột, nên tinh chỉnh được half-life. Nhưng đó là kiểu đổi do bộ sinh gây ra, không phải sở thích trôi dần; cửa sổ test dưới 1 ngày |
| Đánh giá cold-start thật | **Không** | Không có khách mới ở test; chỉ mô phỏng được với giả định lạc quan |
| Đánh giá gợi ý món ngoài 78 món đã bán | **Không** | Đánh giá trên log chỉ thưởng món có trong log (Marlin & Zemel, 2009); 6.074/6.152 ứng viên chưa ai mua |

**Kết luận cho luận văn:** số liệu dùng được để chứng minh **giao thức đánh giá đúng** và **hệ
chạy được**. Không dùng được để khẳng định mức chính xác trên khách thật. Phần hạn chế của
`evaluation/README.md` cần được đưa nguyên vào luận văn.

### 5.5 Dữ liệu đã có trong hệ nhưng AI-Rec chưa dùng

| Dữ liệu | Nơi lưu | Tình trạng |
|---|---|---|
| Hành vi duyệt web: `product_view` (+ `dwell_time_ms`, `scroll_depth_pct`), `category_view`, `search_query`, `add_to_cart`, `remove_from_cart`, `add_to_wishlist`, `compare_view`, `review_submit`, `purchase`, `checkout_abandon`; ngữ cảnh `device_type`, `referrer`, `page_source` | ClickHouse `analytics.user_events` (TTL 90 ngày) | **100% là dữ liệu seed** (`seed-behavior-data.js`, seed lại ngày 29/09). AI-Rec không đọc |
| Wishlist | Postgres `Wishlist` | Có bảng; chưa có trong dbt `serving` |
| Review (rating 1–5) | Postgres `Review` | `reviewer` là chuỗi, **không nối được với `customer_id`**, nên chưa dùng cho cá nhân hoá được |
| Danh mục lá, thông số kỹ thuật, mô tả | `dim_products` / specs | CB mới dùng danh mục gốc |

---

## 6. Cần tối ưu gì

Các mục dưới đây là **đề xuất**. Chưa mục nào được triển khai; mục nào đổi kiến trúc hoặc
luồng xử lý đều cần bạn xác nhận (§8).

### 6.1 Thuật toán (chỉ ảnh hưởng AI-Rec)

| # | Đề xuất | Lý do | Công sức |
|---|---|---|---|
| A1 | **Chốt γ** theo mục tiêu sản phẩm (khám phá hay mua lại) | Đây là điểm đánh đổi lớn nhất đã đo được (§3.5) | Thấp — chỉ là quyết định |
| A2 | Thêm **co rút độ tương đồng** `s'_ij = n_ij/(n_ij+λ) · s_ij` và **cắt láng giềng top-N** | Giảm nhiễu cosine ở cặp có ít người đồng mua (Koren, 2008); Sarwar et al. (2001) có dùng kích thước láng giềng | Thấp |
| A3 | Thử thang **log hoặc nhị phân** cho `Quantity` thay vì số lượng thô | Món mua số lượng lớn hiện chi phối vector; Hu et al. (2008) đề xuất độ tin cậy dạng log `c = 1 + α·log(1 + r/ε)` | Thấp |
| A4 | Đưa **EASE^R** (Steck, 2019) và **iALS** (Hu et al., 2008) vào benchmark làm đối chứng | EASE có nghiệm đóng; với 73 món, phép nghịch đảo 73 × 73 gần như tức thì. Đây là baseline mạnh cho implicit feedback | Trung bình |
| A5 | Thêm đặc trưng CB: danh mục lá, thông số kỹ thuật, embedding tên/mô tả | 3 nhóm đặc trưng quá thô: mọi món cùng ô có cùng điểm | Trung bình — **chỉ có ích khi dữ liệu có tương quan với đặc trưng** (B1) |
| A6 | Thêm chỉ số ngoài độ chính xác: độ mới, độ đa dạng trong danh sách | Coverage 1,2% ứng viên cho thấy gợi ý bị dồn vào một nhóm nhỏ (Kaminskas & Bridge, 2016) | Thấp |

### 6.2 Dữ liệu (ảnh hưởng hệ BigData / bộ sinh)

| # | Đề xuất | Lý do |
|---|---|---|
| B1 | Sửa `pos_simulator.py` để khách mua theo sở thích danh mục/hãng/giá, và có xu hướng thời gian (sở thích thay đổi) | Không có thì không đo được content-based lẫn time-decay (§5.4) |
| B2 | Thu onboarding thật (dù chỉ vài chục khách thử) | Để tinh chỉnh `CB_ONBOARDING_PSEUDO_COUNT` và thay giả định lạc quan ở mục khách mới |
| B3 | Kéo dài cửa sổ test (dữ liệu dàn đều theo thời gian) | Hiện test chỉ khoảng 9,7 giờ |

### 6.3 Tài liệu

| # | Đề xuất |
|---|---|
| D1 | Viết lại `ai-rec/README.md` và bổ sung `doc/Chi_tiet_Toan_hoc_va_Co_che_Model_CF.md` (§1) |

---

## 7. Bổ sung hành vi duyệt web (view, click, dwell…) — có cải tiến gì

### 7.1 Hiện trạng thu thập: hạ tầng đã có, chưa có dữ liệu thật và chưa nối vào AI-Rec

```
client/src/hooks/useTracking.js     buffer 5 s / 20 event, sendBeacon khi rời trang
  ├─ ProductDetail: product_view (+dwell, +scroll, gửi lúc unmount, bỏ view < 1 s),
  │                 add_to_cart, add_to_wishlist, review_submit
  ├─ ProductList:   category_view, search_query
  └─ Checkout:      purchase
        │ POST /api/b2c/track
        ▼
server/src/services/BehaviorService.js   kiểm tra hợp lệ, dwell tối đa 10 phút, async_insert
        │ ghi THẲNG vào ClickHouse (không qua Kafka/MinIO)
        ▼
analytics.user_events   (MergeTree, TTL 90 ngày)
        │
        ├─▶ Node: recently-viewed, trending, dashboard hành vi B2B   (đang dùng)
        └─▶ AI-Rec: KHÔNG đọc   (ai_rec chỉ có quyền schema serving; chưa có model dbt nào)
```

### 7.2 Ba lỗ hổng phải vá trước khi dùng event để train

1. **`customer_id` lấy từ body request do client tự khai** (localStorage), không lấy từ token
   (`BehaviorService._sanitizeEvent`). Ai cũng có thể gửi event dưới tên khách khác, dẫn tới
   **đầu độc dữ liệu train** và làm lệch gợi ý của người khác. Endpoint `/recommendations` đã
   sửa đúng hướng (chỉ tin token); `/track` thì chưa.
2. **Không ghi impression/click của ô gợi ý.** `referrer='recommendation'` có trong danh sách
   hợp lệ nhưng client không dùng tới. Hệ quả: không đo được CTR online, và không tách được
   lượt xem *do chính hệ gợi ý gây ra*. Nếu train lại trên các lượt xem đó, hệ sẽ tự củng cố
   (feedback loop — Chaney et al., 2018).
3. **Dwell time đo chưa sạch.** Không xử lý `visibilitychange`, nên để tab mở ở nền cũng được
   tính là đang xem (chỉ bị cắt ở 10 phút). Ngoài ra event `product_view` chỉ được tạo khi
   component unmount, mà React không unmount khi đóng hoặc tải lại tab, nên **view của trang
   cuối cùng trong phiên có thể bị mất**. Nên phát thêm ở `pagehide`.

Ngoài ra: dữ liệu hành vi seed dùng bộ sinh khác bộ sinh đơn mua. Seed hành vi thiên về một
danh mục/hãng; seed đơn mua thiên về lát id. Chỉ 20/100 user ảo có `customer_id` (1–20) — và (xác minh 01/10) chỉ id 1–5 thực sự tồn tại trong `B2CCustomer`; tập món của bộ sinh hành vi (2.000 món bán chạy nhất theo `sold`) chỉ chứa 2 trong 78 món từng được mua. Trộn
hai bộ sinh không liên quan rồi đo trên ground truth là đơn mua sẽ cho kết quả **không có ý
nghĩa**.

### 7.3 Cải tiến kỳ vọng — hướng nghiên cứu hiện nay

| Cải tiến | Cơ chế | Nguồn |
|---|---|---|
| **Dữ liệu dày hơn**: view xảy ra nhiều hơn mua rất nhiều | Implicit feedback coi mỗi hành vi là *sở thích + độ tin cậy*; hành vi mạnh (giỏ hàng, mua) có độ tin cậy cao hơn view | Hu et al. (2008) |
| **Dự đoán mua tốt hơn nhờ hành vi phụ** (view, giỏ hàng) | Học đa hành vi (multi-behavior): các hành vi nối tiếp nhau view → cart → purchase; mô hình khai thác cả chuỗi thì dự đoán mua tốt hơn mô hình chỉ dùng mua | Gao et al. (2019) — NMTR; Jin et al. (2020) — MBGCN |
| **Dwell time tốt hơn click** làm tín hiệu hài lòng | Click ngắn thường là click nhầm hoặc bị thất vọng; dwell (đã chuẩn hoá theo loại trang) tương quan tốt hơn với mức hài lòng | Yi et al. (2014) |
| **Mở rộng catalog CF**: hiện CF chỉ biết 73 món có ≥3 người mua | Đồng xem (co-view) phủ nhiều món hơn đồng mua, nên CF gợi ý được cả món chưa ai mua | Hệ quả trực tiếp của A = catalog × tương tác; mức cải thiện **phải đo** |
| **Khách vãng lai / khách mới**: gợi ý ngay trong phiên, không cần đăng nhập | Session-based kNN trên chuỗi view của phiên; các phương pháp kNN đơn giản cạnh tranh được với mạng nơ-ron | Ludewig & Jannach (2018); Hidasi et al. (2016) — GRU4Rec |
| **Theo kịp ý định hiện tại** | View phản ánh ý định trước khi mua; mô hình tuần tự khai thác thứ tự các hành vi | Kang & McAuley (2018) — SASRec |
| **Tín hiệu tiêu cực mềm** | `remove_from_cart`, view rất ngắn, `checkout_abandon` | — (trọng số phải tinh chỉnh; `BehaviorService.EVENT_WEIGHTS` hiện đặt tay, không có nguồn) |

**Cần nói rõ trong luận văn:** các nguồn trên báo cáo cải thiện trên dữ liệu thật của họ.
Trên dữ liệu tổng hợp của đồ án, mức cải thiện **phụ thuộc hoàn toàn vào bộ sinh**. Muốn có kết
luận có giá trị thì phải có dữ liệu hành vi thật, hoặc bộ sinh hành vi và bộ sinh mua **dùng
chung một "gu" ẩn** của khách.

### 7.4 Rủi ro và đánh đổi

| Rủi ro | Ảnh hưởng | Cách giảm |
|---|---|---|
| View ≠ thích (lướt, click nhầm) | Nhiễu | Ngưỡng dwell tối thiểu, trọng số view nhỏ hơn mua, tinh chỉnh trên validation (Yi et al., 2014) |
| Thiên lệch phơi bày / feedback loop | Món đã được gợi ý nhận thêm view, rồi được gợi ý nhiều hơn nữa, làm danh sách đồng nhất dần | Ghi impression; giảm trọng số view đến từ ô gợi ý, hoặc dùng IPS (Schnabel et al., 2016; Chaney et al., 2018) |
| Giả mạo `customer_id` | Đầu độc dữ liệu train | Vá lỗ hổng 1 ở §7.2 trước |
| Rò rỉ thời gian trong benchmark | Số liệu đẹp giả | Chỉ dùng event trước mốc cắt; ground truth vẫn là đơn mua |
| TTL 90 ngày | Mất lịch sử hành vi dài hạn | Tổng hợp theo cặp (khách, món) vào `serving` trước khi hết hạn, hoặc đưa event qua lakehouse |
| Ma trận lớn hơn (món được xem nhiều hơn món được mua rất nhiều) | Train/tính sẵn lâu hơn, có thể vượt trần 60 s | Giữ ngưỡng số người tương tác tối thiểu; theo dõi thời gian train trong `/health` |
| Dữ liệu cá nhân | Theo dõi hành vi của khách đã định danh là xử lý dữ liệu cá nhân | Cần thông báo và xin đồng ý; đối chiếu Nghị định 13/2023/NĐ-CP và văn bản hiện hành |

### 7.5 Phương án tích hợp đề xuất (CHƯA triển khai, chờ bạn chốt)

**Phương án A — khuyến nghị: gộp đa hành vi vào cùng ma trận của CF hiện tại**

```
r_ui = Σ_e  w_type(e) · f(e) · 0,5^(days_e / half_life)
  w_type : trọng số theo loại (view, cart, wishlist, purchase…) — TINH CHỈNH TRÊN VALIDATION, không đặt tay
  f(e)   : với view thì là hàm của dwell (vd. 0 nếu < ngưỡng, bão hoà ở mức trần); các loại khác = 1
```

Ưu điểm: giữ nguyên Item-CF/hybrid và toàn bộ benchmark; so sánh loại bỏ (ablation) dễ viết
thành chương thực nghiệm. Nhược điểm: không khai thác thứ tự hành vi.

**Phương án B:** iALS với độ tin cậy từ đa hành vi (Hu et al., 2008). Mạnh hơn A nhưng phải
thêm model mới và tinh chỉnh thêm hệ số.

**Phương án C:** kênh thứ 4 cho hybrid: session-kNN theo đồng xem, dành cho khách vãng lai
và khách mới. Có thể làm **sau** A.

**Các pha nếu chọn A:**

| Pha | Việc | Hệ bị ảnh hưởng | Yêu cầu ngoài phạm vi agent |
|---|---|---|---|
| P0 | Vá 3 lỗ hổng §7.2: `customer_id` lấy từ token trong `/track`; ghi impression + click của ô gợi ý; dwell dùng `visibilitychange` và `pagehide` | Ecommerce (client + server) | — |
| P1 | Model dbt `serving.customer_product_events` (BẢNG, vì quyền của `ai_rec`) tổng hợp theo cặp: số view, dwell đã lọc, cart, wishlist, lần cuối; cập nhật `data-contract-warehouse.md` | BigData | Quyết định Q4 (§8): đọc thẳng `analytics` hay đi qua lakehouse |
| P2 | Dữ liệu: bộ sinh hành vi dùng chung "gu" với bộ sinh đơn mua, **hoặc** thu dữ liệu thật | BigData / script seed | Quyết định Q2; nếu dùng dữ liệu thật thì cần người dùng thử và thông báo quyền riêng tư |
| P3 | AI-Rec: thêm truy vấn, công thức r_ui, xuất thêm event trong `export_data.sh`; benchmark ablation (chỉ mua / + view / + view·dwell / + cart·wishlist), tinh chỉnh w_type trên validation | AI-Rec | — |
| P4 | Đo CTR online trên ô "Dành riêng cho bạn" | Ecommerce + AI-Rec | Cần lưu lượng người dùng thật; A/B test chỉ khả thi khi đủ lưu lượng |

**Đánh đổi giữa hai hệ:**

- **Hệ BigData:** `user_events` hiện đi **ngoài** kiến trúc lakehouse (Node ghi thẳng
  ClickHouse, không có parquet trên MinIO, hết hạn sau 90 ngày). Cho dbt đọc thẳng
  `analytics` thì nhanh, nhưng lệch khỏi luồng CDC → MinIO → ClickHouse mà luận văn mô tả.
  Đưa event qua Kafka → MinIO thì đúng kiến trúc và có lưu trữ lâu dài, nhưng tốn công hơn
  và thêm độ trễ.
- **Hệ Ecommerce:** đổi `/track` sang dùng token không ảnh hưởng khách vãng lai (vẫn có
  `session_id`). Thêm impression làm tăng lưu lượng event.
- **AI-Rec:** hợp đồng dữ liệu đổi, ma trận lớn hơn. Chu kỳ train 5 phút và trần tính sẵn
  60 s cần được đo lại.

---

## 8. Cần bạn quyết định

> **Đã chốt 01/10/2026:**
> - Q1: 2–3 món đã mua trong 10 gợi ý, γ chọn trên validation theo ràng buộc đó.
> - Q2: sửa bộ sinh — `data-platform-poc/taste_simulator.py`, chạy offline trước; reset dữ
>   liệu live để sau.
> - Q3: phương án A — hành vi phụ vào ma trận hồ sơ CF.
> - Q4: dbt đọc thẳng `analytics`.
> - Q5: `README.md` đã viết lại.
>
> Kết quả: `evaluation/README.md`.

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| Q1 | Mức gợi ý lại món đã mua (γ)? | Giữ **γ = 1** (khoảng 2,5/10 ô là món cũ) trong luận văn và trình bày cả đường đánh đổi §3.5. Nếu ưu tiên khám phá thì dùng γ = 0,5 (NDCG discovery gần như bằng CF) |
| Q2 | Sửa bộ sinh dữ liệu (`pos_simulator.py`, `seed-behavior-data.js`) để có tương quan với đặc trưng và dùng chung "gu" ẩn? | **Có**. Không sửa thì content-based, time-decay và mọi tín hiệu hành vi đều không đo được |
| Q3 | Tích hợp hành vi theo phương án nào? | **A** trước (ablation rõ ràng), C làm sau nếu còn thời gian |
| Q4 | `user_events` đọc thẳng từ `analytics` hay đưa qua Kafka → MinIO? | Cho khoá luận: **đọc thẳng qua dbt** (ít rủi ro tiến độ), ghi rõ trong phần hạn chế kiến trúc. Nếu muốn nhất quán lakehouse thì chọn Kafka |
| Q5 | Có cập nhật `README.md` và tài liệu toán CF của `ai-rec` ngay không? | **Có** — việc nhỏ, và README hiện chứa số liệu cũ dễ bị trích nhầm |

---

## 9. Tái lập số liệu

```bash
cd ktln-Getshopy/qu-n-ly-ban-l/source/ai-rec
bash evaluation/export_data.sh        # cần stack đang chạy; dữ liệu ngày 29/09 đã có sẵn trong evaluation/data/
docker run --rm -v "$PWD":/app -w /app -e PYTHONPATH=/app -e CLICKHOUSE_URL= \
  kltn-ai-rec python -m evaluation.benchmark
docker run --rm -v "$PWD":/app -w /app -e PYTHONPATH=/app -e CLICKHOUSE_URL= \
  kltn-ai-rec python -m unittest discover tests
```

Các thống kê dữ liệu ở §3.4 và §5.3 tính trực tiếp từ `evaluation/data/order_lines.csv` và
`catalog_features.csv`, dùng cùng mốc cắt test với benchmark (17/09/2026 12:17:52).

---

## Tài liệu tham khảo

- Anderson, A., Kumar, R., Tomkins, A., & Vassilvitskii, S. (2014). The dynamics of repeat consumption. *WWW '14*.
- Burke, R. (2002). Hybrid recommender systems: Survey and experiments. *UMUAI*, 12(4).
- Campos, P. G., Díez, F., & Cantador, I. (2014). Time-aware recommender systems: a comprehensive survey and analysis of existing evaluation protocols. *UMUAI*, 24(1–2).
- Chaney, A. J. B., Stewart, B. M., & Engelhardt, B. E. (2018). How algorithmic confounding in recommendation systems increases homogeneity and decreases utility. *RecSys '18*.
- Cremonesi, P., Koren, Y., & Turrin, R. (2010). Performance of recommender algorithms on top-N recommendation tasks. *RecSys '10*.
- Efron, B., & Tibshirani, R. J. (1993). *An Introduction to the Bootstrap*. Chapman & Hall.
- Gao, C., He, X., Gan, D., Chen, X., Feng, F., Li, Y., Chua, T.-S., & Jin, D. (2019). Neural multi-task recommendation from multi-behavior data. *ICDE 2019*.
- Harper, F. M., & Konstan, J. A. (2015). The MovieLens datasets: History and context. *ACM TiiS*, 5(4).
- Hidasi, B., Karatzoglou, A., Baltrunas, L., & Tikk, D. (2016). Session-based recommendations with recurrent neural networks. *ICLR 2016*.
- Hu, Y., Koren, Y., & Volinsky, C. (2008). Collaborative filtering for implicit feedback datasets. *ICDM 2008*.
- Järvelin, K., & Kekäläinen, J. (2002). Cumulated gain-based evaluation of IR techniques. *ACM TOIS*, 20(4).
- Jin, B., Gao, C., He, X., Jin, D., & Li, Y. (2020). Multi-behavior recommendation with graph convolutional networks. *SIGIR 2020*.
- Kaminskas, M., & Bridge, D. (2016). Diversity, serendipity, novelty, and coverage: A survey and empirical analysis of beyond-accuracy objectives in recommender systems. *ACM TiiS*, 7(1).
- Kang, W.-C., & McAuley, J. (2018). Self-attentive sequential recommendation. *ICDM 2018*.
- Koren, Y. (2008). Factorization meets the neighborhood: a multifaceted collaborative filtering model. *KDD 2008*.
- Lops, P., de Gemmis, M., & Semeraro, G. (2011). Content-based recommender systems: State of the art and trends. *Recommender Systems Handbook*.
- Ludewig, M., & Jannach, D. (2018). Evaluation of session-based recommendation algorithms. *UMUAI*, 28(4–5).
- Marlin, B. M., & Zemel, R. S. (2009). Collaborative prediction and ranking with non-random missing data. *RecSys '09*.
- Pazzani, M. J., & Billsus, D. (2007). Content-based recommendation systems. *The Adaptive Web*, LNCS 4321.
- Sarwar, B., Karypis, G., Konstan, J., & Riedl, J. (2001). Item-based collaborative filtering recommendation algorithms. *WWW '01*.
- Schnabel, T., Swaminathan, A., Singh, A., Chandak, N., & Joachims, T. (2016). Recommendations as treatments: Debiasing learning and evaluation. *ICML 2016*.
- Steck, H. (2019). Embarrassingly shallow autoencoders for sparse data. *WWW '19*.
- Yi, X., Hong, L., Zhong, E., Liu, N. N., & Rajan, S. (2014). Beyond clicks: Dwell time for personalization. *RecSys '14*.
- Chính phủ Việt Nam (2023). Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.
