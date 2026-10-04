{{ config(materialized='table', schema='serving', engine='MergeTree()',
          order_by='(CustomerID, ProductID)') }}

-- =====================================================================
-- Tín hiệu hành vi phụ theo cặp (khách, món) cho ma trận hồ sơ CF của AI-Rec
-- (ai-rec/models/behavior.py — trọng số và half-life nằm phía AI-Rec, chọn trên
-- validation; ở đây chỉ đếm).
--
-- BẢNG chứ không phải view: cùng lý do quyền với customer_preference_signals —
-- ai_rec chỉ có SELECT trên `serving`, view trỏ vào `analytics` bị Code 497.
--
-- Làm sạch:
--   - chỉ sự kiện có khách: đã đăng nhập (customer_id từ token) HOẶC được ghép phiên
--     (warehouse.user_events_stitched — duyệt ẩn danh rồi mới đăng nhập trong cùng phiên)
--   - chỉ món còn bán
--   - dwell mỗi lượt ≤ 10 phút (khớp trần phía server)
--   - lượt xem do CHÍNH ô gợi ý dẫn tới (referrer = recommendation) tách sang
--     ViewsFromRec và KHÔNG tính vào Views/DwellSec: train lại trên chúng là vòng
--     tự củng cố (Chaney et al., 2018)
-- Benchmark dựng lại đúng các cột này từ sự kiện thô: behavior.aggregate_events().
-- =====================================================================

WITH ev AS (
    SELECT
        -- Nullable trong bảng nguồn; dòng NULL đã lọc ở WHERE. Không bỏ Nullable thì
        -- không dùng được làm khoá sắp xếp (allow_nullable_key tắt mặc định).
        assumeNotNull(e.customer_id) AS customer_id,
        assumeNotNull(e.product_id)  AS product_id,
        e.event_type,
        e.event_time,
        e.dwell_time_ms,
        (e.event_type = 'product_view' AND e.referrer = 'recommendation') AS from_rec
    FROM {{ ref('user_events_stitched') }} AS e
    WHERE e.customer_id IS NOT NULL
      AND e.product_id  IS NOT NULL
      AND e.event_type IN ('product_view', 'add_to_cart', 'add_to_wishlist')
)

SELECT
    toString(ev.customer_id)                                                   AS CustomerID,
    toString(ev.product_id)                                                    AS ProductID,
    toUInt32(countIf(ev.event_type = 'product_view' AND NOT ev.from_rec))      AS Views,
    toUInt32(countIf(ev.from_rec))                                             AS ViewsFromRec,
    toFloat64(sumIf(least(ifNull(ev.dwell_time_ms, 0), 600000),
                    ev.event_type = 'product_view' AND NOT ev.from_rec) / 1000) AS DwellSec,
    toUInt32(countIf(ev.event_type = 'add_to_cart'))                           AS Carts,
    toUInt32(countIf(ev.event_type = 'add_to_wishlist'))                       AS Wishlists,
    maxIf(ev.event_time, NOT ev.from_rec)                                      AS LastEventAt
FROM ev
INNER JOIN {{ ref('dim_products') }} AS p
        ON p.product_id = toString(ev.product_id) AND p.is_deleted = 0
GROUP BY CustomerID, ProductID
HAVING Views + Carts + Wishlists > 0
