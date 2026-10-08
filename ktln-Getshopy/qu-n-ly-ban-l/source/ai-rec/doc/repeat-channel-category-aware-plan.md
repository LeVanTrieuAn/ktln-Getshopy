# Plan: Category-Aware Repeat Channel — Điều chỉnh half-life theo danh mục

> **Ngày:** 2026-10-08
> **Trạng thái:** ĐỀ XUẤT — chờ user duyệt trước khi implement
> **Tác giả:** AI Agent
> **Ước lượng effort:** 2–3 ngày (phân tích + implement + benchmark)

---

## 1. Tóm tắt đề xuất

Thêm **điều chỉnh half-life theo danh mục sản phẩm** vào kênh mua lại. Hiện tại mọi món dùng cùng half-life $h = 7$ ngày, nhưng chu kỳ mua lại thực tế phụ thuộc bản chất danh mục:

- **Tiêu hao nhanh** (mỹ phẩm, thực phẩm chức năng): mua lại theo tuần/tháng → $h$ ngắn
- **Lâu bền** (laptop, tivi, điều hoà): mua lại theo năm hoặc không bao giờ → $h$ dài
- **Phụ kiện** (tai nghe, sạc dự phòng, ốp lưng): mua lại theo quý

→ **Điều chỉnh $h$ riêng cho từng danh mục gốc (ParentCategory)** để gợi ý đúng thời điểm.

---

## 2. Cơ sở lý thuyết

### 2.1 Tài liệu tham khảo

> **Anderson et al. (2014):** "The dynamics of repeat consumption."
> → Chu kỳ mua lại phụ thuộc vào bản chất sản phẩm (consumable vs. durable).

> **Bhagat et al. (2018):** "Buy It Again: Modeling repeat purchase recommendations."
> → Amazon sử dụng mô hình riêng cho từng category family.

### 2.2 Công thức hiện tại

$$
r(u, i) = \sum_{o \in \mathcal{O}_u} 2^{-\frac{\Delta t_o}{h}} \cdot \mathbf{1}(i \in o)
$$

với $h = 7$ ngày **cho mọi món**.

### 2.3 Công thức đề xuất

$$
r(u, i) = \sum_{o \in \mathcal{O}_u} 2^{-\frac{\Delta t_o}{h_c}} \cdot \mathbf{1}(i \in o)
$$

với $h_c$ là half-life của danh mục $c$ mà món $i$ thuộc về.

---

## 3. Phân tích danh mục e-commerce điện tử

### 3.1 Giả định danh mục (cần xác nhận từ data thật)

Dựa trên kinh nghiệm e-commerce điện tử, phân loại sơ bộ:

| ParentCategory | Chu kỳ mua lại ước lượng | Half-life đề xuất | Ví dụ sản phẩm |
|---|---|---:|---|
| `cosmetics` | 1–3 tháng | **30** ngày | Kem dưỡng, serum, son môi |
| `health_supplement` | 1–2 tháng | **30** ngày | Vitamin, collagen, whey protein |
| `phone_accessories` | 3–6 tháng | **90** ngày | Ốp lưng, kính cường lực, sạc dự phòng |
| `headphones` | 6–12 tháng | **180** ngày | Tai nghe bluetooth, gaming headset |
| `phone` | 18–36 tháng | **365** ngày | Smartphone, máy tính bảng |
| `laptop` | 3–5 năm | **730** ngày | Laptop, Macbook |
| `tv` | 5–10 năm | **1825** ngày | Smart TV, tivi OLED |
| `air_conditioner` | 7–15 năm | **2555** ngày | Điều hoà, máy lạnh |
| `default` | 7 ngày | **7** ngày | Fallback cho danh mục chưa cấu hình |

**Lưu ý:** Đây là ước lượng cần **XÁC NHẬN TỪ DỮ LIỆU THẬT** (phân tích inter-purchase interval).

### 3.2 Cách xác định danh mục thực tế

**Bước 1:** Phân tích dữ liệu có sẵn:
```sql
-- Truy vấn inter-purchase interval theo ParentCategory
WITH repeat_purchases AS (
    SELECT
        p.ParentCategory,
        pe.CustomerID,
        pe.ProductID,
        pe.OrderedAt,
        LAG(pe.OrderedAt) OVER (
            PARTITION BY pe.CustomerID, pe.ProductID 
            ORDER BY pe.OrderedAt
        ) AS PrevOrderedAt
    FROM serving.purchase_events_for_AI_rec pe
    INNER JOIN serving.catalog_features p ON p.ProductID = pe.ProductID
)
SELECT
    ParentCategory,
    count() AS RepeatCount,
    quantile(0.5)(dateDiff('day', PrevOrderedAt, OrderedAt)) AS MedianDays,
    quantile(0.25)(dateDiff('day', PrevOrderedAt, OrderedAt)) AS Q1Days,
    quantile(0.75)(dateDiff('day', PrevOrderedAt, OrderedAt)) AS Q3Days
FROM repeat_purchases
WHERE PrevOrderedAt IS NOT NULL
GROUP BY ParentCategory
ORDER BY RepeatCount DESC
```

**Bước 2:** Chọn $h_c$ theo quy tắc:
$$
h_c = \text{median inter-purchase interval} / 2
$$

Chia 2 vì half-life là thời điểm trọng số = 0.5, thường nằm giữa "vừa mới mua" và "đến lúc mua lại".

---

## 4. Thiết kế kỹ thuật

### 4.1 Thay đổi schema

**Bảng mới:** `serving.category_repeat_params` (hoặc nhúng vào `catalog_features`)

| Cột | Kiểu | Mô tả |
|---|---|---|
| `ParentCategory` | `String` | Danh mục gốc |
| `HalfLifeDays` | `Float64` | Half-life tính bằng ngày |
| `UpdatedAt` | `DateTime` | Lần cập nhật cuối |

**Khởi tạo mặc định:**
```sql
INSERT INTO serving.category_repeat_params VALUES
    ('cosmetics', 30, now()),
    ('health_supplement', 30, now()),
    ('phone_accessories', 90, now()),
    ('headphones', 180, now()),
    ('phone', 365, now()),
    ('laptop', 730, now()),
    ('tv', 1825, now()),
    ('air_conditioner', 2555, now()),
    ('default', 7, now());  -- fallback
```

### 4.2 Thay đổi code

**File:** `models/repeat.py`

**Trước:**
```python
class RepeatModel:
    def __init__(self, half_life_days: float) -> None:
        self.half_life_days = float(half_life_days)
```

**Sau:**
```python
class RepeatModel:
    def __init__(
        self,
        half_life_days: float,
        category_half_lives: dict[str, float] | None = None,
    ) -> None:
        self.half_life_days = float(half_life_days)  # default/fallback
        self.category_half_lives = category_half_lives or {}
    
    def fit(self, events: pd.DataFrame) -> "RepeatModel":
        # events cần thêm cột ParentCategory
        if "ParentCategory" in events.columns:
            # Map category → half-life cho từng dòng
            events["hl"] = events["ParentCategory"].map(
                self.category_half_lives
            ).fillna(self.half_life_days)
            # Tính trọng số theo half-life riêng
            events["w"] = 2 ** (-events["DaysSince"] / events["hl"])
        else:
            # Fallback: dùng half-life chung như cũ
            events["w"] = 2 ** (-events["DaysSince"] / self.half_life_days)
        
        # Phần còn lại giống cũ
        scores = events.groupby(["CustomerID", "ProductID"])["w"].sum()
        ...
```

**Query mới từ ClickHouse:**
```python
# config.py
PURCHASE_EVENTS_QUERY = (
    f"SELECT pe.CustomerID, pe.ProductID, "
    f"dateDiff('day', pe.OrderedAt, now()) AS DaysSince, "
    f"cf.ParentCategory "
    f"FROM {PURCHASE_EVENTS_TABLE} pe "
    f"INNER JOIN serving.catalog_features cf ON cf.ProductID = pe.ProductID "
    f"FORMAT TabSeparatedWithNames"
)
```

**Khởi tạo RepeatModel:**
```python
# hybrid.py — build_recommender()
category_half_lives = fetch_category_half_lives()  # đọc từ bảng mới
repeat = RepeatModel(
    half_life_days=cf.resolved_half_life(),  # fallback
    category_half_lives=category_half_lives,
).fit(purchase_events)
```

### 4.3 Thay đổi benchmark

**File:** `evaluation/benchmark.py`

Grid search cần thêm trục category-aware on/off:

```python
CATEGORY_AWARE_MODES = (False, True)  # False = hiện tại, True = category-aware

for cat_aware in CATEGORY_AWARE_MODES:
    if cat_aware:
        repeat = RepeatModel(hl, category_half_lives).fit(...)
    else:
        repeat = RepeatModel(hl).fit(...)
```

---

## 5. Trade-offs

### 5.1 Ưu điểm

| # | Ưu điểm | Ảnh hưởng |
|---|---|---|
| 1 | **Gợi ý đúng thời điểm** | Laptop mua 3 năm trước vẫn có điểm cao (đúng chu kỳ nâng cấp), mỹ phẩm mua 3 tháng trước điểm thấp (hết hạn sử dụng) |
| 2 | **Giảm noise cho món lâu bền** | Tivi/điều hoà không xuất hiện ở top-10 ngay sau 7 ngày → nhường slot cho món thực sự cần mua lại |
| 3 | **Tận dụng domain knowledge** | E-commerce điện tử có chu kỳ rõ ràng, mô hình hoá được bằng danh mục |

### 5.2 Nhược điểm

| # | Nhược điểm | Biện pháp giảm thiểu |
|---|---|---|
| 1 | **Phức tạp hơn** | Thêm 1 bảng config, 1 tham số, khó debug hơn | Logs rõ ràng, health endpoint báo số danh mục đã config |
| 2 | **Cần maintain mapping** | Khi thêm danh mục mới phải cấu hình $h_c$ | Script tự động phân tích inter-purchase interval |
| 3 | **Có thể không thắng trên validation** | Dữ liệu tổng hợp không phản ánh chu kỳ thực tế | Phải benchmark trên dữ liệu THẬT, không phải synthetic |
| 4 | **Cold-start cho danh mục mới** | Danh mục không có trong bảng config rơi về $h = 7$ | Chấp nhận được — fallback an toàn |

### 5.3 Rủi ro học thuật

**Rủi ro 1:** Dữ liệu hiện tại là **tổng hợp (synthetic)** — chu kỳ mua lại KHÔNG PHẢN ÁNH thực tế.
- **Hệ quả:** Category-aware có thể **không thắng** trên benchmark hiện tại.
- **Biện pháp:** Chỉ deploy sau khi có dữ liệu thật từ production (ít nhất 3 tháng).

**Rủi ro 2:** Half-life theo danh mục là giả định mạnh — thực tế chu kỳ còn phụ thuộc **giá trị đơn**, **phân khúc khách**.
- **Ví dụ:** Laptop gaming (30 triệu) chu kỳ dài hơn laptop văn phòng (10 triệu).
- **Biện pháp:** Phase 1 chỉ làm category-level, phase 2 có thể làm (category × price_band).

---

## 6. Kế hoạch thực hiện (3 phases)

### Phase 1: Phân tích dữ liệu (1 ngày)

**Mục tiêu:** Xác định $h_c$ cho từng danh mục từ dữ liệu thật.

**Nhiệm vụ:**
1. Chạy query phân tích inter-purchase interval (§3.2 bước 1).
2. Vẽ biểu đồ phân phối theo danh mục.
3. Xác định $h_c$ theo quy tắc median/2.
4. **Checkpoint:** Trình kết quả cho user duyệt trước khi code.

**Output:** File `repeat-channel-category-halflife-analysis.csv` + biểu đồ.

### Phase 2: Implement + unit test (1 ngày)

**Nhiệm vụ:**
1. Thêm bảng `serving.category_repeat_params` vào dbt.
2. Sửa `models/repeat.py` — thêm `category_half_lives` parameter.
3. Sửa `PURCHASE_EVENTS_QUERY` — JOIN `catalog_features` lấy `ParentCategory`.
4. Sửa `build_recommender()` — đọc bảng config và truyền vào `RepeatModel`.
5. Unit test: `test_repeat_category_aware.py` — đảm bảo fallback đúng.

**Output:** PR với code + test pass.

### Phase 3: Benchmark + đánh giá (1 ngày)

**Nhiệm vụ:**
1. Thêm `CATEGORY_AWARE_MODES` vào `benchmark.py`.
2. Chạy benchmark so sánh:
   - Baseline: $h = 7$ cho mọi món (hiện tại)
   - Category-aware: $h_c$ riêng cho từng danh mục
3. So sánh trên 3 metric: overall NDCG@10, discovery NDCG@10, repurchase NDCG@10.
4. **Checkpoint:** Nếu category-aware **KHÔNG THẮNG** → DỪNG, không deploy.

**Output:** Báo cáo benchmark + quyết định deploy hay không.

---

## 7. Metric thành công

Category-aware được coi là **thành công** nếu:

| Metric | Baseline (hiện tại) | Target (category-aware) |
|---|---|---|
| Overall NDCG@10 | 0.357 | **≥ 0.370** (+3.6%) |
| Repurchase NDCG@10 | 0.466 | **≥ 0.480** (+3%) |
| Discovery NDCG@10 | 0.356 | **≥ 0.350** (không giảm quá 2%) |
| Số món đã mua trong top-10 | 2.1 | **[2.0, 3.0]** (giữ ràng buộc) |

**Nếu không đạt → KHÔNG deploy**, giữ nguyên $h = 7$ chung.

---

## 8. Câu hỏi cần user trả lời trước khi implement

### 8.1 Về dữ liệu

**Q1:** Bảng `serving.catalog_features` đã có đầy đủ `ParentCategory` chưa?
- ☐ Có, mọi sản phẩm đều có `ParentCategory` không NULL
- ☐ Không, cần join từ `dim_categories` hoặc nguồn khác
- ☐ Chưa biết, cần kiểm tra

**Q2:** Dữ liệu hiện tại (4M dòng tương tác) là synthetic hay thật?
- ☐ **Synthetic** → category-aware có thể không thắng benchmark, chỉ deploy sau khi có data thật
- ☐ **Thật** → OK để benchmark ngay
- ☐ **Hỗn hợp** → cần tách riêng để benchmark

### 8.2 Về scope

**Q3:** Có muốn làm phase 1 (phân tích) trước, rồi quyết định tiếp hay dừng?
- ☐ **Có** (khuyến nghị) → chạy query phân tích, xem kết quả, rồi quyết định
- ☐ **Không** → implement thẳng theo bảng ước lượng ở §3.1

**Q4:** Nếu category-aware không thắng trên validation, có chấp nhận dừng lại không?
- ☐ **Có** → dừng, không deploy
- ☐ **Không** → deploy anyway vì tin vào lý thuyết

### 8.3 Về effort

**Q5:** 3 ngày effort (phân tích + code + benchmark) có chấp nhận được không?
- ☐ **Có** → bắt đầu sau khi Q1–Q4 trả lời xong
- ☐ **Không** → đề xuất bị từ chối

---

## 9. Tài liệu tham khảo

> **Anderson, A., Kumar, R., Tomkins, A., & Vassilvitskii, S. (2014).**
> The dynamics of repeat consumption. *WWW '14*, 419–430.
> — Nghiên cứu về chu kỳ mua lại phụ thuộc vào bản chất sản phẩm.

> **Bhagat, R., Muralidharan, S., Lobzhanidze, A., & Vishwanath, S. (2018).**
> Buy It Again: Modeling repeat purchase recommendations. *KDD '18*, 62–70.
> — Mô hình mua lại production của Amazon, có category-specific logic.

> **Hu, Y., Koren, Y., & Volinsky, C. (2008).**
> Collaborative Filtering for Implicit Feedback Datasets. *ICDM '08*, 263–272.
> — Log-scaling và time decay trong recommender systems.

---

## 10. Phụ lục: Mock query phân tích

```sql
-- A. Tính inter-purchase interval theo danh mục
WITH purchases AS (
    SELECT
        cf.ParentCategory,
        pe.CustomerID,
        pe.ProductID,
        pe.OrderedAt,
        LAG(pe.OrderedAt) OVER (
            PARTITION BY pe.CustomerID, pe.ProductID 
            ORDER BY pe.OrderedAt
        ) AS PrevOrderedAt
    FROM serving.purchase_events_for_AI_rec pe
    INNER JOIN serving.catalog_features cf ON cf.ProductID = pe.ProductID
),
intervals AS (
    SELECT
        ParentCategory,
        dateDiff('day', PrevOrderedAt, OrderedAt) AS IntervalDays
    FROM purchases
    WHERE PrevOrderedAt IS NOT NULL
      AND dateDiff('day', PrevOrderedAt, OrderedAt) BETWEEN 1 AND 3650  -- 1 ngày đến 10 năm
)
SELECT
    ParentCategory,
    count() AS RepeatPurchases,
    round(quantile(0.25)(IntervalDays), 1) AS Q1_Days,
    round(quantile(0.5)(IntervalDays), 1)  AS Median_Days,
    round(quantile(0.75)(IntervalDays), 1) AS Q3_Days,
    round(avg(IntervalDays), 1)            AS Mean_Days,
    round(Median_Days / 2, 0)              AS SuggestedHalfLife
FROM intervals
GROUP BY ParentCategory
HAVING RepeatPurchases >= 10  -- ít nhất 10 lần mua lại mới đáng tin
ORDER BY RepeatPurchases DESC;

-- B. Phân phối interval của một danh mục cụ thể
SELECT
    floor(IntervalDays / 30) * 30 AS Bucket,  -- gộp theo tháng
    count() AS Frequency
FROM intervals
WHERE ParentCategory = 'laptop'
GROUP BY Bucket
ORDER BY Bucket;
```

---

**Tóm tắt:** Đề xuất thêm category-aware half-life cho kênh mua lại. Cần **3 ngày effort** (phân tích + code + benchmark), **chỉ deploy nếu thắng validation**, và **cần user trả lời 5 câu hỏi** trước khi bắt đầu.

**Quyết định tiếp theo:** User chọn một trong:
1. **Chấp nhận plan** → bắt đầu Phase 1 (phân tích dữ liệu)
2. **Từ chối** → giữ nguyên $h = 7$ chung
3. **Yêu cầu chỉnh sửa plan** → agents sửa theo feedback
