{{ config(materialized='view', schema='warehouse') }}

-- =====================================================================
-- Sự kiện hành vi với khách ĐÃ GHÉP PHIÊN.
--
-- Khách duyệt hàng khi CHƯA đăng nhập thì sự kiện chỉ có session_id (customer_id NULL),
-- và AI-Rec bỏ qua. Đăng nhập xong, client gửi sự kiện `identify` kèm token; server ghi
-- customer_id lấy TỪ TOKEN cho session_id đó (client không tự khai được). Ở đây: phiên
-- nào có ĐÚNG MỘT khách đã đăng nhập thì mọi sự kiện ẩn danh trong phiên được gán cho
-- khách ấy — kể cả sự kiện TRƯỚC lúc đăng nhập.
--
-- Phiên có từ hai khách trở lên thì KHÔNG ghép: không biết sự kiện ẩn danh là của ai.
-- (Client đã đổi session_id khi đăng xuất; đây là lớp chặn thứ hai.)
--
-- VIEW trong `warehouse`, không phải `serving`: dữ liệu mức từng sự kiện, tài khoản ai_rec
-- không cần và không được đọc. serving.customer_product_events (bảng) tổng hợp từ đây,
-- và ai-rec/evaluation/export_data.sh xuất sự kiện cho benchmark cũng từ đây.
-- =====================================================================

WITH session_owner AS (
    SELECT
        session_id,
        any(customer_id) AS owner
    FROM {{ source('analytics', 'user_events') }}
    WHERE customer_id IS NOT NULL
    GROUP BY session_id
    HAVING uniqExact(customer_id) = 1
)

SELECT
    e.event_type                                        AS event_type,
    e.session_id                                        AS session_id,
    coalesce(e.customer_id, s.owner)                    AS customer_id,
    (e.customer_id IS NULL AND s.owner IS NOT NULL)     AS stitched,
    e.product_id                                        AS product_id,
    e.category_id                                       AS category_id,
    e.brand_id                                          AS brand_id,
    e.price_at_event                                    AS price_at_event,
    e.dwell_time_ms                                     AS dwell_time_ms,
    e.scroll_depth_pct                                  AS scroll_depth_pct,
    e.quantity                                          AS quantity,
    e.rating                                            AS rating,
    e.search_query                                      AS search_query,
    e.result_count                                      AS result_count,
    e.product_ids                                       AS product_ids,
    e.device_type                                       AS device_type,
    e.referrer                                          AS referrer,
    e.page_source                                       AS page_source,
    e.event_time                                        AS event_time
FROM {{ source('analytics', 'user_events') }} AS e
LEFT JOIN session_owner AS s ON s.session_id = e.session_id
