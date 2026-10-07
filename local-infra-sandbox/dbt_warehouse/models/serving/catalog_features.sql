{{ config(materialized='table', schema='serving', engine='MergeTree()', order_by='ProductID') }}

-- Đặc trưng nội dung của MỌI sản phẩm đang bán — nơi DUY NHẤT định nghĩa cách
-- tính ParentCategory và PriceBand.
--   - product_features dựng từ bảng này (thêm doanh số, lọc đại diện mỗi ô).
--   - Benchmark AI-Rec đọc bảng này để dựng lại tập ứng viên theo TỪNG mốc cắt
--     thời gian. Không dùng product_features cho benchmark: CellRank ở đó xếp
--     theo doanh số TOÀN BỘ lịch sử, gồm cả giai đoạn test — rò rỉ tương lai.
SELECT
    p.product_id                                                  AS ProductID,
    if(c.parent_id = '', c.category_id, c.parent_id)              AS ParentCategory,
    p.brand_id                                                    AS Brand,
    {{ price_band('p.price') }}                                   AS PriceBand,
    -- Số "đã bán" hiện trên cửa hàng. SINH NGẪU NHIÊN lúc seed catalog — chỉ
    -- dùng để phá hoà giữa các món chưa ai mua, không phải tín hiệu thật.
    toInt32(p.sold)                                               AS CatalogSold
FROM {{ ref('dim_products') }} AS p
INNER JOIN {{ ref('dim_categories') }} AS c ON c.category_id = p.category_id
INNER JOIN {{ ref('dim_brands') }}     AS b ON b.brand_id    = p.brand_id
WHERE p.is_deleted = 0 AND b.is_deleted = 0
