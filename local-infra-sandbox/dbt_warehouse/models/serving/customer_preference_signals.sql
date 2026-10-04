{{ config(materialized='table', schema='serving', engine='MergeTree()',
          order_by='(CustomerID, Dimension, Value)') }}

-- BẢNG chứ không phải view: view thường của ClickHouse kiểm quyền trên BẢNG
-- GỐC theo người gọi. Để view thì tài khoản ai_rec (chỉ có SELECT trên serving)
-- bị từ chối vì view đọc masterdata.* — đã thử: Code 497 Not enough privileges.
-- Cấp thêm quyền masterdata cho ai_rec là mở cả dim_customers (dữ liệu cá nhân)
-- cho một dịch vụ không cần tới. Bảng nhỏ, dựng lại mỗi lượt dbt.

-- Sở thích onboarding ở dạng DÀI — một dòng là một tín hiệu:
--   Dimension : 'category' | 'brand' | 'price_band'
--   Value     : mã danh mục gốc / mã hãng / mã tầm giá
--   Polarity  : 1 = thích, -1 = không quan tâm (AI-Rec LỌC CỨNG, kể cả kết quả CF)
-- Dạng dài thay vì mảng: AI-Rec đọc TSV không phải tự tách mảng, và mỗi luật
-- làm sạch dưới đây là một điều kiện kiểm chứng được.
--
-- Làm sạch — API đã kiểm lúc ghi, đây là lớp thứ hai vì dữ liệu có thể bị sửa
-- tay trong Postgres, hoặc danh mục/hãng bị xoá SAU khi khách đã chọn:
--   1. bỏ khách status = 'skipped': bỏ qua onboarding nghĩa là không có tín hiệu
--   2. bỏ trùng trong từng mảng (arrayDistinct)
--   3. một giá trị vừa thích vừa không quan tâm -> bỏ khỏi THÍCH, giữ lại ở
--      không quan tâm: gợi ý món khách đã nói không muốn tệ hơn bỏ lỡ một món
--   4. bỏ mã mồ côi: danh mục không phải danh mục gốc, hãng không còn / đã xoá,
--      tầm giá không thuộc var price_bands
WITH
    p AS (
        SELECT * FROM {{ ref('dim_customer_preferences') }} WHERE status = 'completed'
    ),
    signals AS (
        SELECT customer_id, 'category' AS dimension, v AS value, 1 AS polarity
        FROM p ARRAY JOIN arrayDistinct(arrayFilter(x -> NOT has(disliked_categories, x), liked_categories)) AS v
        UNION ALL
        SELECT customer_id, 'category', v, -1
        FROM p ARRAY JOIN arrayDistinct(disliked_categories) AS v
        UNION ALL
        SELECT customer_id, 'brand', v, 1
        FROM p ARRAY JOIN arrayDistinct(arrayFilter(x -> NOT has(disliked_brands, x), liked_brands)) AS v
        UNION ALL
        SELECT customer_id, 'brand', v, -1
        FROM p ARRAY JOIN arrayDistinct(disliked_brands) AS v
        UNION ALL
        SELECT customer_id, 'price_band', price_band, 1
        FROM p WHERE price_band != ''
    )

SELECT
    toString(customer_id) AS CustomerID,
    dimension             AS Dimension,
    value                 AS Value,
    toInt8(polarity)      AS Polarity
FROM signals
WHERE (dimension = 'category'   AND value IN (SELECT category_id FROM {{ ref('dim_categories') }} WHERE parent_id = ''))
   OR (dimension = 'brand'      AND value IN (SELECT brand_id FROM {{ ref('dim_brands') }} WHERE is_deleted = 0))
   OR (dimension = 'price_band' AND value IN ({{ price_band_ids() }}))
