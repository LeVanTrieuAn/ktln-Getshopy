-- ═════════════════════════════════════════════════════════════════════════
-- NHÁNH NÓNG — Kafka -> ClickHouse trực tiếp, độ trễ giây.
--
-- Kiến trúc hai nhánh (quyết định 13/09):
--   nóng  : Kafka -> ClickHouse  (bảng này)        -> dashboard số realtime
--   lạnh  : Kafka -> MinIO -> dbt -> fact/mart     -> báo cáo, AI-rec
--
-- Cùng một nguồn Kafka, hai đích độc lập. Checkout không gánh gì thêm — đó là
-- lý do gỡ ghi thẳng ClickHouse khỏi request path ở mục 2.
--
-- Vì sao KHÔNG ghi chung vào fact_orders_detail: dbt cũng ghi vào bảng đó, hai
-- nguồn ghi cùng một nơi thì lệch lúc nào không biết, và khó giải thích trong
-- báo cáo. Bảng riêng thì mỗi nhánh có vòng đời riêng.
-- ═════════════════════════════════════════════════════════════════════════
CREATE DATABASE IF NOT EXISTS realtime;

-- ── 1. Bảng Kafka engine: hàng đợi, KHÔNG lưu trữ ───────────────────────
-- Đọc một lần rồi thôi. Mỗi lần SELECT là consume, nên không query trực tiếp —
-- chỉ dùng làm nguồn cho Materialized View.
DROP TABLE IF EXISTS realtime.kafka_orders;
CREATE TABLE realtime.kafka_orders
(
    payload String
)
ENGINE = Kafka
SETTINGS
    kafka_broker_list       = 'kafka:29092',
    kafka_topic_list        = 'cdc_prod.public.Order',
    -- Group riêng, KHÔNG dùng chung với S3 sink: dùng chung thì hai bên chia
    -- nhau partition và mỗi bên chỉ thấy một nửa dữ liệu.
    kafka_group_name        = 'clickhouse-realtime',
    kafka_format            = 'JSONAsString',
    kafka_num_consumers     = 1,
    kafka_skip_broken_messages = 100;

-- ── 2. Bảng đích: lưu thật ──────────────────────────────────────────────
DROP TABLE IF EXISTS realtime.orders_live;
CREATE TABLE realtime.orders_live
(
    order_id        String,
    customer_id     Int64,
    total           Int64,
    status          String,
    payment_method  String,
    payment_status  String,
    province        String,
    order_date      DateTime64(3, 'UTC'),
    _event_ts       DateTime64(3, 'UTC'),
    _is_deleted     UInt8,
    _arrived_at     DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(_event_ts, _is_deleted)
PARTITION BY toYYYYMM(order_date)
ORDER BY (order_id)
-- Dữ liệu nóng chỉ cần cho dashboard hôm nay; lịch sử để nhánh lạnh giữ.
TTL toDateTime(order_date) + INTERVAL 7 DAY;

-- ── 3. Materialized View: cầu nối, tự chạy khi có message mới ───────────
DROP VIEW IF EXISTS realtime.mv_orders_live;
CREATE MATERIALIZED VIEW realtime.mv_orders_live TO realtime.orders_live AS
SELECT
    JSONExtractString(coalesce(after_raw, before_raw), 'id')             AS order_id,
    JSONExtractInt(coalesce(after_raw, before_raw), 'customer_id')       AS customer_id,
    JSONExtractInt(coalesce(after_raw, before_raw), 'total')             AS total,
    JSONExtractString(coalesce(after_raw, before_raw), 'status')         AS status,
    JSONExtractString(coalesce(after_raw, before_raw), 'payment_method') AS payment_method,
    JSONExtractString(coalesce(after_raw, before_raw), 'payment_status') AS payment_status,
    JSONExtractString(coalesce(after_raw, before_raw), 'province')       AS province,
    toDateTime64(JSONExtractInt(coalesce(after_raw, before_raw), 'date') / 1000, 3, 'UTC') AS order_date,
    toDateTime64(JSONExtractInt(envelope, 'ts_ms') / 1000, 3, 'UTC')     AS _event_ts,
    if(JSONExtractString(envelope, 'op') = 'd', 1, 0)                    AS _is_deleted,
    now()                                                                AS _arrived_at
FROM (
    SELECT
        -- JsonConverter của Kafka Connect mặc định bật schemas.enable, nên mỗi
        -- message có dạng {"schema": {...}, "payload": {before, after, op, ts_ms}}.
        -- Dữ liệu thật nằm ở TẦNG HAI — đọc thẳng JSONExtract(payload,'after')
        -- trả về rỗng, MV không ghi dòng nào mà KHÔNG báo lỗi: consumer vẫn
        -- chạy, offset vẫn tiến, bảng đích vẫn trống.
        JSONExtractRaw(payload, 'payload')                       AS envelope,
        nullIf(JSONExtractRaw(JSONExtractRaw(payload,'payload'), 'after'),  'null') AS after_raw,
        nullIf(JSONExtractRaw(JSONExtractRaw(payload,'payload'), 'before'), 'null') AS before_raw
    FROM realtime.kafka_orders
)
WHERE JSONExtractString(coalesce(after_raw, before_raw), 'id') != '';
