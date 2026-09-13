{{ config(materialized='table', schema='serving', engine='MergeTree()',
          order_by='(revenue_date, category_id, brand_id, payment_method)') }}

-- =====================================================================
-- Doanh thu tổng hợp cho dashboard admin.
--
-- Tách GROSS và PAID: đơn PENDING_PAYMENT và CANCELLED chưa phải tiền thật,
-- gộp vào là báo cáo thổi phồng. Dashboard phải đọc paid_revenue.
--
-- FINAL bắt buộc — ReplacingMergeTree chỉ khử trùng lúc merge, mà merge chạy
-- ngầm không đảm bảo thời điểm. Thiếu FINAL là đếm cả bản cũ lẫn bản mới.
--
-- Mọi cột trong ORDER BY phải NOT NULL (MergeTree từ chối Nullable key), mà dữ
-- liệu CDC ra Nullable hết -> ifNull tường minh.
-- =====================================================================
SELECT
    ifNull(toDate(order_date), toDate('1970-01-01')) AS revenue_date,
    ifNull(category_id, '')                          AS category_id,
    ifNull(brand_id, '')                             AS brand_id,
    ifNull(payment_method, '')                       AS payment_method,
    uniqExact(order_id)                              AS orders,
    sum(quantity)                                    AS units,
    sum(net_amount)                                  AS gross_revenue,
    sumIf(net_amount, payment_status = 'PAID')       AS paid_revenue,
    sumIf(net_amount, order_status = 'CANCELLED')    AS cancelled_value
FROM {{ ref('fact_orders_detail') }} FINAL
WHERE _is_deleted = 0
GROUP BY revenue_date, category_id, brand_id, payment_method
