# Evaluation — Đánh giá AI Recommendation System

## Mục tiêu

Pipeline tự động đánh giá chất lượng hệ gợi ý bằng **6 metrics chuẩn** trong học thuật:

| Metric | Ý nghĩa | Tại sao quan trọng |
|--------|---------|-------------------|
| **Precision@K** | Trong K món gợi ý, bao nhiêu món khách mua thật? | Đo độ chính xác — tránh gợi lung tung |
| **Recall@K** | Trong số món khách sẽ mua, bắt được bao nhiêu? | Đo độ phủ — tránh bỏ sót món khách thích |
| **HitRate@K** | % khách có ít nhất 1 món trúng | **Dễ giải thích nhất khi bảo vệ** — "50 khách thì 23 người thấy món đúng ý" |
| **MAP@K** | Món trúng nằm ở đầu hay cuối danh sách? | Đánh giá xếp hạng — món đúng phải ở đầu mới hữu ích |
| **NDCG@K** | Như MAP nhưng phạt nặng hơn khi xếp thấp | Metrics chuẩn trong IR (Information Retrieval) |
| **Coverage** | % catalog từng được gợi ý | Chống model chỉ quanh quẩn vài món bán chạy |

---

## Cấu trúc thư mục

```
evaluation/
├── benchmark.py              # Pipeline chính
├── README.md                 # File này
├── data/
│   ├── train.csv             # Dữ liệu train (đơn KHÔNG phải cuối)
│   └── new_orders.csv        # Dữ liệu test (đơn cuối cùng)
└── results/                  # Kết quả sau khi chạy benchmark
    ├── benchmark_<timestamp>.json
    └── benchmark_<timestamp>.csv
```

---

## Quy trình chạy benchmark

### Bước 1: Chuẩn bị dữ liệu

Đặt 2 file CSV vào `evaluation/data/`:

- **`train.csv`** — dữ liệu lịch sử (đơn hàng **KHÔNG phải đơn cuối**) để train model
- **`new_orders.csv`** — đơn hàng **cuối cùng** (ground truth) để đánh giá

**Cách export từ ClickHouse:**

```bash
# Script 1 -> train.csv (KHÔNG phải đơn cuối)
cat > /tmp/train_query.sql <<'EOF'
SELECT
    customer_id AS CustomerID,
    product_id  AS ProductID,
    SUM(quantity) AS Quantity
FROM warehouse.fact_orders_detail
ANY LEFT JOIN
(
    SELECT customer_id, MAX(order_date) AS last_order_date
    FROM warehouse.fact_orders_detail
    WHERE _is_deleted = 0
    GROUP BY customer_id
) AS l ON customer_id = l.customer_id
WHERE _is_deleted = 0
  AND order_date < l.last_order_date
GROUP BY customer_id, product_id
ORDER BY CustomerID ASC, Quantity DESC
FORMAT CSVWithNames
EOF

curl -sS "http://localhost:8123/" --data-binary @/tmp/train_query.sql \
  > /Users/thanhtu/it-project/ktln-Getshopy/ktln-Getshopy/qu-n-ly-ban-l/source/ai-rec/evaluation/data/train.csv

# Script 2 -> new_orders.csv (LÀ đơn cuối)
cat > /tmp/test_query.sql <<'EOF'
SELECT
    customer_id AS CustomerID,
    product_id  AS ProductID,
    SUM(quantity) AS Quantity
FROM warehouse.fact_orders_detail
ANY LEFT JOIN
(
    SELECT customer_id, MAX(order_date) AS last_order_date
    FROM warehouse.fact_orders_detail
    WHERE _is_deleted = 0
    GROUP BY customer_id
) AS l ON customer_id = l.customer_id
WHERE _is_deleted = 0
  AND order_date = l.last_order_date
GROUP BY customer_id, product_id
ORDER BY CustomerID ASC, Quantity DESC
FORMAT CSVWithNames
EOF

curl -sS "http://localhost:8123/" --data-binary @/tmp/test_query.sql \
  > /Users/thanhtu/it-project/ktln-Getshopy/ktln-Getshopy/qu-n-ly-ban-l/source/ai-rec/evaluation/data/test.csv

# Verify
ls -lh /Users/thanhtu/it-project/ktln-Getshopy/ktln-Getshopy/qu-n-ly-ban-l/source/ai-rec/evaluation/data/
head -3 /Users/thanhtu/it-project/ktln-Getshopy/ktln-Getshopy/qu-n-ly-ban-l/source/ai-rec/evaluation/data/train.csv
head -3 /Users/thanhtu/it-project/ktln-Getshopy/ktln-Getshopy/qu-n-ly-ban-l/source/ai-rec/evaluation/data/new_orders.csv
```

**Format bắt buộc:**

```csv
CustomerID,ProductID,Quantity
1,617,5
1,385,4
1,213,4
```

> ⚠️ File phải có header `CustomerID,ProductID,Quantity`. Kiểm tra bằng:
> ```bash
> head -1 evaluation/data/train.csv
> # Phải thấy: CustomerID,ProductID,Quantity
> ```

### Bước 2: Cài đặt môi trường

#### Cách A — Tạo virtual environment mới (Khuyến nghị ✅)

```bash
cd /Users/thanhtu/it-project/ktln-Getshopy/ktln-Getshopy/qu-n-ly-ban-l/source/ai-rec

# Tạo virtual environment
python3 -m venv .venv

# Kích hoạt
source .venv/bin/activate

# Cài dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

#### Cách B — Dùng system Python (không khuyến khích)

```bash
cd /Users/thanhtu/it-project/ktln-Getshopy/ktln-Getshopy/qu-n-ly-ban-l/source/ai-rec

# Cài trực tiếp (không tạo venv)
pip install --user -r requirements.txt

# Chạy trực tiếp
python3 evaluation/benchmark.py ...
```

> ⚠️ **Lưu ý:** Nếu gặp lỗi `source: no such file or directory: .venv/bin/activate` → nghĩa là virtual environment chưa được tạo. Chạy lại từ bước tạo venv.

### Bước 3: Chạy benchmark

```bash
cd /Users/thanhtu/it-project/ktln-Getshopy/ktln-Getshopy/qu-n-ly-ban-l/source/ai-rec

# Kích hoạt môi trường
source .venv/bin/activate

# Chạy benchmark
python evaluation/benchmark.py \
  --train evaluation/data/train.csv \
  --new-order evaluation/data/test.csv \
  --k 5 10 20
```

> 📌 **Lệnh đầy đủ (copy-paste 1 lần):**
> ```bash
> cd /Users/thanhtu/it-project/ktln-Getshopy/ktln-Getshopy/qu-n-ly-ban-l/source/ai-rec && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && python evaluation/benchmark.py --train evaluation/data/train.csv --new-order evaluation/data/new_orders.csv --k 5 10 20
> ```

- ⏱️ **Thời gian:** ~7-8 phút (5000 khách × top-20 recommendations)
- 📊 **Output:** Bảng metrics hiện ngay trên terminal + 2 file trong `results/`

### Bước 3: Xem kết quả

**Output trên terminal:**
```
   K |  Precision@K |   Recall@K |   HitRate@K |    MAP@K |   NDCG@K |  Coverage
---------------------------------------------------------------------------
   5 |       0.0522 |     0.1449 |      0.2400 |   0.0751 |   0.1056 |    1.0000
  10 |       0.0467 |     0.2570 |      0.3966 |   0.0921 |   0.1478 |    1.0000
  20 |       0.0409 |     0.4508 |      0.6140 |   0.1089 |   0.2044 |    1.0000
```

**Files kết quả:**
```bash
ls -la evaluation/results/
```

- `benchmark_<timestamp>.json` — chi tiết metadata + metrics
- `benchmark_<timestamp>.csv` — bảng metrics để import Excel/Sheets

**Xem nhanh kết quả:**
```bash
cat evaluation/results/benchmark_*.json | python -m json.tool | tail -30
```

---

## Diễn giải từng metric (để trả lời hội đồng)

### 1. Precision@K

**Định nghĩa:**
```
Precision@K = (số món trùng trong top-K) / K
```

**Ví dụ:**
- Model gợi top-10: `[A, B, C, D, E, F, G, H, I, J]`
- Khách thật sự mua: `{A, D, Z}`
- Trùng: A, D → 2 món
- **Precision@10 = 2/10 = 0.20**

**Giải thích khi bảo vệ:**
> "Trong 10 món gợi ý, trung bình có 2 món khách mua thật. Precision cao → ít gợi món sai, người dùng không bị spam."

**Trade-off:**
- Precision cao nhưng Recall thấp → gợi ít nhưng đúng, bỏ sót nhiều món khách thích

---

### 2. Recall@K

**Định nghĩa:**
```
Recall@K = (số món trùng trong top-K) / (tổng số món khách mua thật)
```

**Ví dụ:**
- Model gợi top-10: `[A, B, C, D, E, F, G, H, I, J]`
- Khách thật sự mua: `{A, D, Z, W, X}` (5 món)
- Trùng: A, D → 2 món
- **Recall@10 = 2/5 = 0.40**

**Giải thích khi bảo vệ:**
> "Trong 5 món khách định mua, model bắt được 2 món = 40%. Recall cao → bắt được nhiều món khách thích, tăng doanh thu."

**Trade-off:**
- K lớn → Recall cao nhưng Precision giảm (gợi nhiều → bắt nhiều nhưng độ chính xác giảm)

---

### 3. HitRate@K

**Định nghĩa:**
```
HitRate@K = (số khách có ≥ 1 món trúng) / (tổng số khách đánh giá)
```

**Ví dụ:**
- Đánh giá 100 khách
- 45 khách thấy ít nhất 1 món đúng ý trong top-10
- **HitRate@10 = 45/100 = 0.45**

**Giải thích khi bảo vệ (DỄ NHẤT):**
> "Cứ 10 khách vào xem gợi ý, có 4-5 khách thấy ít nhất 1 món đúng ý. Chỉ số này dễ so sánh với CTR (click-through rate) trong thực tế."

**Tại sao quan trọng:**
- Dễ diễn giải cho người không chuyên
- Gắn trực tiếp với trải nghiệm người dùng (có món đúng ý hay không)

---

### 4. MAP@K (Mean Average Precision)

**Định nghĩa:**
```
AP@K = Σ (precision@i tại mỗi vị trí i có hit) / min(|relevant|, K)
MAP@K = trung bình AP@K của tất cả khách
```

**Ví dụ:**
- Model gợi top-5: `[A, X, B, Y, C]`
- Ground truth: `{A, B, C}`
- Vị trí 1 (A hit) → precision@1 = 1/1 = 1.00
- Vị trí 3 (B hit) → precision@3 = 2/3 = 0.67
- Vị trí 5 (C hit) → precision@5 = 3/5 = 0.60
- **AP@5 = (1.00 + 0.67 + 0.60) / 3 = 0.76**

**Giải thích khi bảo vệ:**
> "MAP đánh giá thứ hạng. Món đúng ở vị trí 1 được điểm cao, món đúng ở vị trí 10 được điểm thấp. MAP cao → model xếp hạng tốt."

**So sánh với Precision:**
- Precision chỉ đếm số lượng trúng
- MAP còn xét vị trí trúng → món đúng ở đầu mới có giá trị

---

### 5. NDCG@K (Normalized Discounted Cumulative Gain)

**Định nghĩa:**
```
DCG@K = Σ (1 / log₂(position + 1)) cho mỗi món trúng
IDCG@K = DCG ideal (tất cả relevant xếp lên đầu)
NDCG@K = DCG@K / IDCG@K
```

**Ví dụ:**
- Model gợi top-5: `[A, X, B, Y, Z]`
- Ground truth: `{A, B}`
- DCG:
  - A ở vị trí 1 → 1/log₂(2) = 1.00
  - B ở vị trí 3 → 1/log₂(4) = 0.50
  - DCG = 1.50
- IDCG (ideal: A, B ở vị trí 1, 2):
  - 1/log₂(2) + 1/log₂(3) = 1.00 + 0.63 = 1.63
- **NDCG@5 = 1.50 / 1.63 = 0.92**

**Giải thích khi bảo vệ:**
> "NDCG là chuẩn trong Information Retrieval. Giống MAP nhưng phạt nặng hơn khi món đúng bị xếp thấp. NDCG = 1.0 → xếp hạng hoàn hảo."

**So sánh với MAP:**
- MAP phạt tuyến tính (vị trí 1 vs 10)
- NDCG phạt logarithmic (vị trí 1 vs 2 quan trọng hơn vị trí 9 vs 10)
- NDCG được dùng nhiều trong paper học thuật

---

### 6. Coverage

**Định nghĩa:**
```
Coverage = (số sản phẩm DUY NHẤT từng được gợi ý) / (tổng sản phẩm trong catalog)
```

**Ví dụ:**
- Catalog có 1000 sản phẩm
- Model gợi cho 500 khách
- Chỉ có 150 sản phẩm duy nhất xuất hiện trong recommendations
- **Coverage = 150/1000 = 0.15**

**Giải thích khi bảo vệ:**
> "Coverage thấp → model chỉ quanh quẩn vài món bán chạy, không khai thác được long-tail catalog. Coverage cao → đa dạng gợi ý, tạo cơ hội cho sản phẩm ít người biết."

**Tại sao quan trọng:**
- Coverage thấp + Precision cao → model chỉ gợi top sellers (dễ train nhưng kém giá trị)
- Coverage cao → tăng serendipity (khách phát hiện món mới), giảm inventory chết

**Trade-off:**
- Coverage cao quá → gợi món hiếm vô nghĩa → Precision giảm
- Coverage thấp quá → tất cả khách thấy cùng 10 món → tạo bottleneck bán hàng

---

## Kết quả thực nghiệm

**Setup:**
- Train: 5.000 khách, 401 sản phẩm, 189.032 tương tác
- Test: 5.000 khách (100% warm users — đều có trong train)
- Model: Item-based Collaborative Filtering (Cosine Similarity)

**Metrics:**

| K | Precision@K | Recall@K | HitRate@K | MAP@K | NDCG@K | Coverage |
|---|-------------|----------|-----------|-------|--------|----------|
| 5 | 0.0522 | 0.1449 | 0.2400 | 0.0751 | 0.1056 | 1.0000 |
| 10 | 0.0467 | 0.2570 | 0.3966 | 0.0921 | 0.1478 | 1.0000 |
| 20 | 0.0409 | 0.4508 | 0.6140 | 0.1089 | 0.2044 | 1.0000 |

**Diễn giải cho hội đồng:**
> "Trong 10 món gợi ý, trung bình 0.47 món đúng (Precision 4.67%). Model bắt được 25.7% món khách định mua (Recall). 39.66% khách thấy ít nhất 1 món đúng ý (HitRate). Model phủ 100% catalog → không chỉ gợi món bán chạy, khai thác được toàn bộ long-tail."

---

## Trade-offs quan trọng (để trả lời hội đồng)

| Trade-off | Giải thích |
|-----------|-----------|
| **Precision vs Recall** | K nhỏ → Precision cao, Recall thấp (gợi ít nhưng chuẩn). K lớn → ngược lại. |
| **Accuracy vs Coverage** | Gợi toàn món bán chạy → Precision cao nhưng Coverage thấp → không tạo giá trị. |
| **Personalization vs Cold-start** | CF tốt cho warm users, tệ cho cold-start. Cần hybrid approach. |
| **Exploration vs Exploitation** | Gợi toàn món user thích (exploit) → không discover món mới. Cần balance. |

---

## References (nguồn học thuật)

Pipeline này implement các metrics chuẩn trong Recommender Systems research:

1. **Precision, Recall, HitRate**
   - Herlocker et al. (2004). "Evaluating Collaborative Filtering Recommender Systems". ACM TOIS.
   - https://dl.acm.org/doi/10.1145/963770.963772

2. **MAP (Mean Average Precision)**
   - Manning et al. (2008). "Introduction to Information Retrieval". Cambridge University Press.
   - Metrics từ Information Retrieval, áp dụng cho RecSys.

3. **NDCG (Normalized Discounted Cumulative Gain)**
   - Järvelin & Kekäläinen (2002). "Cumulated gain-based evaluation of IR techniques". ACM TOIS.
   - https://dl.acm.org/doi/10.1145/582415.582418

4. **Coverage**
   - Adomavicius & Kwon (2012). "Improving Aggregate Recommendation Diversity Using Ranking-Based Techniques". IEEE TKDE.
   - https://ieeexplore.ieee.org/document/5928582

5. **Collaborative Filtering**
   - Koren et al. (2009). "Matrix Factorization Techniques for Recommender Systems". IEEE Computer.
   - https://ieeexplore.ieee.org/document/5197422

---

## Troubleshooting

### Lỗi: "source: no such file or directory: .venv/bin/activate"

**Nguyên nhân:** Virtual environment `.venv` chưa được tạo.

**Giải pháp:** Tạo venv trước khi activate:

```bash
cd /Users/thanhtu/it-project/ktln-Getshopy/ktln-Getshopy/qu-n-ly-ban-l/source/ai-rec

# Tạo virtual environment
python3 -m venv .venv

# Kích hoạt
source .venv/bin/activate

# Cài dependencies
pip install -r requirements.txt
```

---

### Lỗi: "Không tìm thấy train.csv"

**Nguyên nhân:** File chưa được đặt đúng vị trí.

**Giải pháp:** Đặt `train.csv` và `new_orders.csv` vào `evaluation/data/`.

---

### Metrics = 0 hoặc quá thấp

**Nguyên nhân:**
1. Train data quá ít (< 10 customers)
2. Quá nhiều cold-start users (> 90%)
3. Test data không overlap với train data

**Giải pháp:**
- Kiểm tra metadata output: xem `cold_start_customers` và `warm_customers`
- Đảm bảo `train.csv` chứa lịch sử của users trong `new_orders.csv`
- Train data cần ≥ 1000 tương tác/user để CF học được pattern

---

### Coverage = 0

**Nguyên nhân:** Model không sinh được recommendation nào.

**Giải pháp:**
- Kiểm tra log: "Đã sinh X/Y recommendations"
- Kiểm tra model CF có train thành công không
- Kiểm tra `user_item_matrix` có dữ liệu không

---

## Câu hỏi thường gặp (FAQ)

### Q1: K bao nhiêu là hợp lý?

**A:** Phụ thuộc UI:
- Mobile app (list view) → K=5-10
- Desktop (grid 4 cột) → K=8-20
- "You may also like" section → K=5
- Full recommendation page → K=20-50

Benchmark nhiều K để so sánh trade-off.

---

### Q2: Metrics nào quan trọng nhất khi bảo vệ?

**A:** Ưu tiên:
1. **HitRate@K** — dễ giải thích, gắn với UX
2. **Coverage** — chứng minh không chỉ gợi món bán chạy
3. **Precision@K** — đo chất lượng gợi ý
4. MAP/NDCG — nâng cao, dùng khi hội đồng hỏi sâu

---

### Q3: Metrics thấp hơn paper khác?

**A:** Bình thường vì:
- Papers dùng public datasets (MovieLens, Amazon) có nhiều interaction
- E-commerce thực tế: data sparse, cold-start nhiều
- Benchmark offline khác với online A/B test (user behavior thay đổi khi thấy recommendation)

**So sánh đúng cách:** Benchmark trên cùng dataset với baseline (random, popular, content-based).

---

### Q4: Làm sao cải thiện metrics?

**Cải thiện Precision/Recall:**
- Thêm features: collaborative + content-based (hybrid)
- Tuning hyperparameters: similarity threshold, min support
- Ensemble models

**Cải thiện Coverage:**
- Thêm exploration (epsilon-greedy, Thompson Sampling)
- Re-rank để đa dạng hóa (MMR - Maximal Marginal Relevance)
- Penalize popular items

**Cải thiện cold-start:**
- Content-based filtering cho new users
- Demographic-based recommendations
- Ask user preferences onboarding
