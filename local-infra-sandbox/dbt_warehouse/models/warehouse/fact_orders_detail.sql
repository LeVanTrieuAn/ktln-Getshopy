{{
    config(
        materialized       = 'incremental',
        schema='warehouse',
        engine             = 'ReplacingMergeTree(_event_ts, _is_deleted)',
        order_by           = '(item_id)',
        partition_by       = 'toYYYYMM(order_date)',
        incremental_strategy = 'append',
        unique_key         = 'item_id'
    )
}}

-- =====================================================================
-- FACT — grain: MỘT dòng cho MỘT OrderItem.
--
-- Là BẢNG, không phải view. View s3() phải quét lại TOÀN BỘ parquet trên MinIO
-- mỗi lần query — vài nghìn đơn không thấy gì, nhưng dữ liệu lớn dần là mỗi lần
-- mở dashboard đọc lại cả data lake. Và view thì không partition, không index.
--
-- ReplacingMergeTree(_event_ts, _is_deleted):
--   CDC sinh một bản ghi cho MỖI thay đổi của cùng một hàng. Engine giữ bản có
--   _event_ts lớn nhất theo ORDER BY key, nên KHÔNG cần lớp dedup riêng.
--   Merge chạy ngầm, không đảm bảo thời điểm -> mọi truy vấn đọc bảng này PHẢI
--   dùng FINAL và lọc _is_deleted = 0.
--
-- KHÔNG join dim_products để lấy tên/giá: OrderItem đã snapshot sẵn giá tại
-- thời điểm mua. Join bảng hiện tại làm doanh thu lịch sử đổi theo giá hôm nay.
-- =====================================================================

WITH
    orders AS (
        -- Dedup trong lô: một đơn có thể đổi trạng thái nhiều lần giữa hai lần
        -- chạy (PENDING -> PAID -> CANCELLED), chỉ lấy bản mới nhất.
        SELECT * EXCEPT rn FROM (
            SELECT *, row_number() OVER (PARTITION BY order_id ORDER BY event_ts DESC) AS rn
            FROM {{ ref('stg_orders') }}
            {% if is_incremental() %}
            -- Mốc dùng >= chứ không >: thà nạp thừa vài dòng ở mốc giao rồi để
            -- ReplacingMergeTree khử, còn hơn bỏ sót bản ghi cùng millisecond.
            WHERE event_ts >= (SELECT ifNull(max(_event_ts), toDateTime64('1970-01-01 00:00:00',3,'UTC')) FROM {{ this }})
            {% endif %}
        ) WHERE rn = 1
    ),
    items AS (
        SELECT * EXCEPT rn FROM (
            SELECT *, row_number() OVER (PARTITION BY item_id ORDER BY event_ts DESC) AS rn
            FROM {{ ref('stg_order_items') }}
            {% if is_incremental() %}
            WHERE event_ts >= (SELECT ifNull(max(_event_ts), toDateTime64('1970-01-01 00:00:00',3,'UTC')) FROM {{ this }})
            {% endif %}
        ) WHERE rn = 1
    )

SELECT
    -- ORDER BY và PARTITION BY của MergeTree không nhận cột Nullable, mà mọi
    -- cột từ CDC đều Nullable. toInt64(Nullable) vẫn là Nullable -> phải ifNull.
    toInt64(ifNull(i.item_id, 0))                           AS item_id,
    ifNull(i.order_id, '')                                  AS order_id,
    toInt64(ifNull(o.customer_id, 0))                       AS customer_id,

    toInt64(ifNull(i.product_id, 0))                        AS product_id,
    ifNull(i.product_name, '')                              AS product_name,
    ifNull(i.category_id, '')                               AS category_id,
    ifNull(i.brand_id, '')                                  AS brand_id,
    ifNull(i.branch_id, '')                                 AS branch_id,
    ifNull(i.variant_id, '')                                AS variant_id,

    toInt32(ifNull(i.quantity, 0))                          AS quantity,
    toInt64(ifNull(i.unit_price, 0))                        AS unit_price,
    toInt64(ifNull(i.discount, 0))                          AS discount,
    toInt64(ifNull(i.net_amount, 0))                        AS net_amount,

    toInt64(ifNull(o.total, 0))                             AS order_total,
    ifNull(o.status, '')                                    AS order_status,
    ifNull(o.payment_method, '')                            AS payment_method,
    ifNull(o.payment_status, '')                            AS payment_status,
    assumeNotNull(ifNull(o.order_date, toDateTime64('1970-01-01 00:00:00',3,'UTC'))) AS order_date,
    o.paid_at                                               AS paid_at,
    ifNull(o.province, '')                                  AS province,

    -- Version: lấy mốc muộn hơn giữa đơn và dòng hàng, để đơn đổi trạng thái
    -- cũng kéo dòng hàng cập nhật theo.
    -- Cột version và cột is_deleted của ReplacingMergeTree bắt buộc NOT NULL —
    -- engine từ chối Nullable. greatest() giữ Nullable nếu đầu vào Nullable
    -- nên phải bọc assumeNotNull ở ngoài cùng, sau khi đã ifNull bên trong.
    assumeNotNull(greatest(ifNull(i.event_ts, toDateTime64('1970-01-01 00:00:00',3,'UTC')),
                           ifNull(o.event_ts, toDateTime64('1970-01-01 00:00:00',3,'UTC')))) AS _event_ts,
    toUInt8(assumeNotNull(greatest(ifNull(i.is_deleted, 0), ifNull(o.is_deleted, 0))))       AS _is_deleted,
    now()                                                   AS _loaded_at

FROM items i
LEFT JOIN orders o ON o.order_id = i.order_id
-- Dòng hàng mà đơn chưa tới (parquet Order flush sau) thì bỏ qua lượt này;
-- lần chạy sau bắt được vì watermark chưa vượt qua nó.
WHERE o.order_id != ''
