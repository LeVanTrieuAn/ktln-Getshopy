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
--
-- NẠP TĂNG DẦN THEO ĐƠN, không lọc từng nguồn riêng:
--   Một dòng fact ghép hai nguồn CDC. Giữa hai lần chạy thường chỉ MỘT phía đổi:
--   đơn chuyển PAID mà dòng hàng giữ nguyên, hoặc snapshot dòng hàng được sửa
--   mà đơn giữ nguyên. Lọc hai nguồn riêng theo mốc thì phía không đổi rơi khỏi
--   cửa sổ, JOIN hụt, và thay đổi bị bỏ IM LẶNG. Nên:
--     (1) gom tập đơn có biến động ở BẤT KỲ nguồn nào -> `changed`
--     (2) với các đơn đó, lấy bản mới nhất của đơn và của MỌI dòng hàng trên
--         TOÀN BỘ lịch sử, rồi ghi lại cả đơn.
--   Chi phí: glob s3() không cắt tỉa theo thời gian nên mỗi lần chạy vốn đã mở
--   mọi file parquet; lọc theo order_id không làm tăng số file phải đọc.
--
-- MỐC RIÊNG TỪNG NGUỒN (_order_event_ts, _item_event_ts):
--   Sink ghi parquet của Order và OrderItem thành hai file, xả ở hai thời điểm
--   khác nhau. Một mốc chung (greatest hai nguồn) sẽ bị nguồn đi trước kéo vượt
--   qua bản ghi của nguồn đi sau chưa kịp xuống MinIO -> lần chạy sau bỏ qua bản
--   ghi đó MÃI MÃI. Mỗi topic có 1 partition, 1 task sink ghi theo thứ tự offset,
--   và ts_ms (giờ connector xử lý) tăng theo offset -> bản ghi chưa xuống lake
--   luôn có ts >= mốc của CHÍNH nguồn đó. Mốc riêng vì thế không bỏ sót.
--
-- HẠN CHẾ (chi tiết: docs/implement-phase/results/results.md §13.5):
--   REPLICA IDENTITY DEFAULT -> bản ghi xoá chỉ mang khoá chính.
--   - Xoá LẺ một OrderItem: không có order_id để lần về đơn -> không lan tới fact.
--   - Xoá cả đơn: bản xoá không có date -> rơi vào partition 197001. FINAL mặc
--     định khử trùng xuyên partition nên đơn vẫn ẩn, nhưng merge nền không dọn.
-- =====================================================================

{%- if is_incremental() %}
    {%- set have = adapter.get_columns_in_relation(this) | map(attribute='name') | list %}
    {%- if '_order_event_ts' not in have or '_item_event_ts' not in have %}
        {{ exceptions.raise_compiler_error(
            "Bảng " ~ this ~ " dựng từ bản cũ, chưa có cột mốc riêng từng nguồn "
            ~ "(_order_event_ts, _item_event_ts). Dựng lại MỘT lần: "
            ~ "docker compose --profile dbt run --rm dbt run --full-refresh --select fact_orders_detail+") }}
    {%- endif %}
{%- endif %}

WITH
{%- if is_incremental() %}
    changed AS (
        -- Mốc dùng >= chứ không >: thà nạp lại vài đơn ở mốc giao rồi để
        -- ReplacingMergeTree khử, còn hơn bỏ sót bản ghi cùng millisecond.
        SELECT order_id FROM {{ ref('stg_orders') }}
        WHERE event_ts >= (SELECT ifNull(max(_order_event_ts), toDateTime64('1970-01-01 00:00:00',3,'UTC')) FROM {{ this }})
        UNION DISTINCT
        SELECT order_id FROM {{ ref('stg_order_items') }}
        WHERE event_ts >= (SELECT ifNull(max(_item_event_ts), toDateTime64('1970-01-01 00:00:00',3,'UTC')) FROM {{ this }})
    ),
{%- endif %}
    orders AS (
        -- Bản mới nhất của đơn trên toàn bộ lịch sử: một đơn có nhiều bản CDC
        -- (PENDING -> PAID -> CANCELLED), chỉ giữ bản cuối.
        SELECT * EXCEPT rn FROM (
            SELECT *, row_number() OVER (PARTITION BY order_id ORDER BY event_ts DESC) AS rn
            FROM {{ ref('stg_orders') }}
            {% if is_incremental() %}
            WHERE order_id IN (SELECT order_id FROM changed)
            {% endif %}
        ) WHERE rn = 1
    ),
    items AS (
        SELECT * EXCEPT rn FROM (
            SELECT *, row_number() OVER (PARTITION BY item_id ORDER BY event_ts DESC) AS rn
            FROM {{ ref('stg_order_items') }}
            {% if is_incremental() %}
            WHERE order_id IN (SELECT order_id FROM changed)
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

    -- Mốc riêng từng nguồn — chỉ để tính watermark cho lần chạy sau (xem đầu file).
    assumeNotNull(ifNull(o.event_ts, toDateTime64('1970-01-01 00:00:00',3,'UTC'))) AS _order_event_ts,
    assumeNotNull(ifNull(i.event_ts, toDateTime64('1970-01-01 00:00:00',3,'UTC'))) AS _item_event_ts,

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
-- Dòng hàng mà bản ghi đơn chưa xuống MinIO (parquet Order xả sau) thì bỏ qua
-- lượt này. Lần sau vẫn bắt được: bản ghi đơn đó có ts >= mốc _order_event_ts,
-- nên đơn lọt vào `changed` và kéo theo toàn bộ dòng hàng của nó.
WHERE o.order_id != ''
