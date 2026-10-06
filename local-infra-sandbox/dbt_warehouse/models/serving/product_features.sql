{{ config(materialized='table', schema='serving', engine='MergeTree()',
          order_by='(ParentCategory, Brand, PriceBand, CellRank)') }}

-- Đặc trưng nội dung của sản phẩm cho content-based trong AI-Rec:
--   ParentCategory : danh mục gốc — đúng 8 nhóm mà onboarding hỏi khách
--   Brand          : mã hãng
--   PriceBand      : tầm giá theo giá bán hiện tại, cùng bộ mã với onboarding
--
-- KHÔNG xuất đủ 600k sản phẩm. Ba đặc trưng trên chỉ tạo ra vài trăm ô
-- (nhóm × hãng × tầm giá), mọi món cùng ô có điểm nội dung BẰNG NHAU, nên mỗi ô
-- chỉ cần vài đại diện: CellRank <= var('cb_candidates_per_cell'), xếp theo
--   1. số lượng bán thật — fact, đơn đã thanh toán và không huỷ (cùng điều kiện
--      với pairs_customer_product, tức cùng định nghĩa "mua" với CF)
--   2. CatalogSold — số "đã bán" hiện trên cửa hàng. LƯU Ý: số này SINH NGẪU
--      NHIÊN lúc seed catalog, chỉ dùng để phá hoà giữa các món chưa ai mua
--   3. product_id — để thứ tự tất định
-- Thứ tự này PHẢI khớp build_candidates() trong ai-rec/models/content_based.py
-- (benchmark dựng lại ứng viên bằng hàm đó, theo doanh số trong cửa sổ train).
-- Đặc trưng lấy từ catalog_features — không tính lại ParentCategory/PriceBand ở đây.
-- Cộng thêm MỌI món đã có người mua dù nằm ngoài top của ô: AI-Rec cần đặc
-- trưng của chúng để dựng hồ sơ khách từ lịch sử mua.
WITH
    sales AS (
        SELECT
            toString(product_id)    AS product_id,
            sum(quantity)           AS units,
            uniqExact(customer_id)  AS buyers
        FROM {{ ref('fact_orders_detail') }} FINAL
        WHERE _is_deleted = 0
          AND order_status  != 'CANCELLED'
          AND payment_status = 'PAID'
        GROUP BY product_id
    ),
    products AS (
        SELECT
            ProductID       AS product_id,
            ParentCategory  AS parent_category,
            Brand           AS brand_id,
            PriceBand       AS price_band,
            CatalogSold     AS catalog_sold
        FROM {{ ref('catalog_features') }}
    ),
    ranked AS (
        SELECT
            pr.*,
            ifNull(s.units, 0)  AS units,
            ifNull(s.buyers, 0) AS buyers,
            row_number() OVER (
                PARTITION BY pr.parent_category, pr.brand_id, pr.price_band
                ORDER BY units DESC, pr.catalog_sold DESC, toInt64(pr.product_id)
            ) AS cell_rank
        FROM products AS pr
        LEFT JOIN sales AS s ON s.product_id = pr.product_id
    )

SELECT
    product_id              AS ProductID,
    parent_category         AS ParentCategory,
    brand_id                AS Brand,
    price_band              AS PriceBand,
    toInt64(units)          AS UnitsSold,
    toInt64(buyers)         AS Buyers,
    toInt32(catalog_sold)   AS CatalogSold,
    toUInt32(cell_rank)     AS CellRank
FROM ranked
WHERE cell_rank <= {{ var('cb_candidates_per_cell') }} OR units > 0
