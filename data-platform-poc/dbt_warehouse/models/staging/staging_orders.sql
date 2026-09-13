{{ config(materialized='view') }}

WITH raw_orders AS (
    SELECT 
        order_id,
        customer_id,
        total_amount,
        status,
        -- ClickHouse yêu cầu chuyển đổi kiểu dữ liệu ngày tháng rõ ràng từ chuỗi String
        parseDateTimeBestEffort(created_at) AS order_date,
        -- Sắp xếp theo ngày cập nhật mới nhất để tìm bản ghi cuối cùng của order_id đó
        ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY parseDateTimeBestEffort(updated_at) DESC) as rn
    FROM {{ source('app_sales', 'orders') }} 
)

SELECT 
    order_id,
    customer_id,
    total_amount,
    status,
    order_date
FROM raw_orders
-- Chỉ lấy bản ghi có rank = 1 (trạng thái cập nhật mới nhất, loại bỏ lịch sử cũ)
WHERE rn = 1