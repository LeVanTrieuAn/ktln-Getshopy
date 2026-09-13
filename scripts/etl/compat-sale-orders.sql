-- ═════════════════════════════════════════════════════════════════════════
-- View tương thích ngược cho dashboard admin.
--
-- 16 câu query của dashboard đọc analytics.sale_orders. Bảng gốc rỗng từ lúc
-- gỡ dual-write, nên view này ánh xạ từ fact_orders_detail.
--
-- Cột `status` cố ý map từ payment_status chứ KHÔNG phải order_status:
--   Dashboard lọc status='CONFIRMED' để tính doanh thu. Nhưng đơn COD vừa đặt
--   cũng mang order_status='CONFIRMED' trong khi chưa thu đồng nào — gộp vào
--   là báo cáo thổi phồng.
--   Đổi sang payment_status='PAID' thì thống nhất: cứ thu được tiền là tính,
--   bất kể COD hay chuyển khoản. COD chuyển sang PAID khi admin bấm đã giao.
--   Giữ tên giá trị 'CONFIRMED' để 16 câu query không phải sửa.
-- ═════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS analytics.sale_orders;
DROP VIEW IF EXISTS analytics.sale_orders;

CREATE VIEW analytics.sale_orders AS
SELECT
    f.order_id                                   AS order_id,
    f.branch_id                                  AS branch_id,
    ifNull(b.branch_name, '')                    AS branch_name,
    f.province                                   AS region,
    'ONLINE'                                     AS salesperson_id,
    toString(f.customer_id)                      AS customer_id,
    toString(f.product_id)                       AS product_id,
    f.product_name                               AS product_name,
    f.category_id                                AS product_category,
    f.quantity                                   AS quantity,
    f.unit_price                                 AS unit_price,
    f.quantity * f.unit_price                    AS total_amount,
    f.discount                                   AS discount,
    f.net_amount                                 AS net_amount,
    -- 'CONFIRMED' ở đây nghĩa là ĐÃ THU TIỀN, không phải đã xác nhận đơn
    if(f.payment_status = 'PAID', 'CONFIRMED', f.order_status) AS status,
    f.payment_status                             AS payment_status,
    f.order_status                               AS order_status,
    f.payment_method                             AS payment_method,
    f.order_date                                 AS order_date,
    f._loaded_at                                 AS created_at
FROM warehouse.fact_orders_detail AS f FINAL
LEFT JOIN masterdata.dim_branches AS b ON b.branch_id = f.branch_id
WHERE f._is_deleted = 0;
