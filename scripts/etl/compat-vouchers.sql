-- ═════════════════════════════════════════════════════════════════════════
-- View tương thích cho phiếu thu / phiếu xuất.
--
-- Dashboard và trang Fulfillment đọc analytics.input_vouchers và
-- analytics.output_vouchers — hai bảng của thế hệ POC cũ, rỗng từ lúc gỡ
-- dual-write. Hậu quả nhìn thấy được:
--
--   cash_collected, net_cash  = 0          (không có phiếu thu nào)
--   pending_recon             = MỌI đơn    (không đơn nào có phiếu thu)
--   Fulfillment               = MỌI đơn PENDING
--
-- Trang Fulfillment phân loại bằng:
--     multiIf(ov.voucher_id = '', 'PENDING', …)
-- nên thiếu output_vouchers là tất cả rơi vào PENDING, kể cả đơn POS đã
-- COMPLETED và PAID từ lâu.
--
-- GRAIN: fact_orders_detail là MỘT DÒNG MỖI MẶT HÀNG, còn phiếu là MỘT PHIẾU
-- MỖI ĐƠN. Phải gom theo order_id, nếu không một đơn 3 món thành 3 phiếu thu
-- và tiền bị nhân ba.
-- ═════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS analytics.input_vouchers;
DROP VIEW  IF EXISTS analytics.input_vouchers;

-- Phiếu thu: đã thật sự nhận được tiền.
CREATE VIEW analytics.input_vouchers AS
SELECT
    concat('PT-', f.order_id)                              AS voucher_id,
    f.order_id                                             AS order_id,
    any(f.branch_id)                                       AS branch_id,
    toDecimal64(sum(f.net_amount), 2)                      AS amount,
    max(ifNull(f.paid_at, f.order_date))                   AS voucher_date,
    any(f.payment_method)                                  AS payment_type,
    ''                                                     AS note,
    max(f._loaded_at)                                      AS created_at
FROM warehouse.fact_orders_detail AS f FINAL
WHERE f._is_deleted = 0
  AND f.payment_status = 'PAID'
GROUP BY f.order_id;

DROP TABLE IF EXISTS analytics.output_vouchers;
DROP VIEW  IF EXISTS analytics.output_vouchers;

-- Phiếu xuất: hàng đã giao tới khách. Chỉ đơn COMPLETED.
-- Đơn CONFIRMED là đã nhận nhưng CHƯA giao — đúng nghĩa đang chờ xử lý, và
-- phải để nguyên như vậy trên trang Fulfillment.
CREATE VIEW analytics.output_vouchers AS
SELECT
    concat('PX-', f.order_id)                              AS voucher_id,
    f.order_id                                             AS order_id,
    any(f.branch_id)                                       AS branch_id,
    toDecimal64(sum(f.net_amount), 2)                      AS amount,
    -- Chưa có cột thời điểm giao riêng. paid_at là mốc gần nhất: bán tại quầy
    -- thì trả tiền và cầm hàng cùng lúc, nên SLA ra gần 0 giờ — đúng thực tế.
    max(ifNull(f.paid_at, f.order_date))                   AS voucher_date,
    -- 'COGS' chứ không phải 'DELIVERY': truy vấn Fulfillment lọc
    -- WHERE category = 'COGS'. Đặt giá trị khác thì LEFT JOIN không khớp dòng
    -- nào, và multiIf(ov.voucher_id='', 'PENDING', …) cho ra PENDING sạch
    -- trơn — không lỗi, chỉ là mọi đơn nhìn như đang chờ xử lý.
    'COGS'                                                 AS category,
    ''                                                     AS note,
    max(f._loaded_at)                                      AS created_at
FROM warehouse.fact_orders_detail AS f FINAL
WHERE f._is_deleted = 0
  AND f.order_status = 'COMPLETED'
GROUP BY f.order_id;
