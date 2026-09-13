{{ config(materialized='table') }}

SELECT
    -- Ép kiểu DateTime về dạng Date (YYYY-MM-DD) để gom nhóm theo ngày
    toDate(order_date) AS report_date,
    status,
    -- Đếm chính xác số lượng đơn hàng duy nhất trong ngày
    COUNT(DISTINCT order_id) AS total_orders,
    -- Tính tổng doanh thu của ngày đó
    SUM(total_amount) AS revenue
FROM {{ ref('staging_orders') }}
-- Quy tắc kinh doanh: Chỉ ghi nhận doanh thu cho các đơn hàng đã thanh toán/hoàn thành thành công
WHERE status = 'COMPLETED'
GROUP BY report_date, status
ORDER BY report_date DESC