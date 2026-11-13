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
--
-- 14/11/2026 — file này do scripts/bootstrap-bigdata.sh (bước 0b) chạy TỰ ĐỘNG
-- mỗi lần `docker compose up`, không còn chạy tay. Lý do: trước đây chỉ chạy
-- tay, nên khi volume kltn_clickhouse_data bị tạo lại (23/10/2026, ngày
-- benchmark) cả nhánh nóng biến mất mà không có lỗi nào; phát hiện 13/11/2026
-- khi soát system.tables. Vì chạy lặp lại nên mọi câu lệnh phải IDEMPOTENT:
--   - bảng giữ dữ liệu / giữ consumer: CREATE ... IF NOT EXISTS, KHÔNG DROP;
--   - cột mới cho bảng đã có từ trước: ALTER ... ADD COLUMN IF NOT EXISTS;
--   - riêng Materialized View thì DROP + CREATE (xem mục 3 — view có TO không
--     chứa dữ liệu, nên tạo lại không mất gì).
-- Nạp bù 7 ngày từ Postgres cho bảng đích rỗng nằm trong bootstrap, không nằm
-- ở đây: câu đó cần mật khẩu Postgres lấy từ biến môi trường lúc chạy.
--
-- Lưu ý cho script chạy file (run_sql_file): nó cắt câu theo dấu chấm phẩy và
-- bỏ mọi thứ sau hai gạch ngang trên từng dòng — nên trong chuỗi '...' của file
-- này không được có hai ký tự đó.
-- ═════════════════════════════════════════════════════════════════════════
CREATE DATABASE IF NOT EXISTS realtime;

-- ── 1. Bảng Kafka engine: hàng đợi, KHÔNG lưu trữ ───────────────────────
-- Đọc một lần rồi thôi. Mỗi lần SELECT là consume, nên không query trực tiếp —
-- chỉ dùng làm nguồn cho Materialized View.
--
-- IF NOT EXISTS (14/11/2026): bảng không chứa dữ liệu — offset đã đọc nằm ở
-- Kafka, theo group bên dưới — nhưng DROP mỗi lần bootstrap là bỏ consumer rồi
-- tạo lại vô cớ. Hệ quả: đổi SETTINGS dưới đây thì PHẢI tự
-- `DROP TABLE realtime.kafka_orders` rồi chạy lại bootstrap; offset vẫn còn
-- trong Kafka nên không mất, không lặp.
--
-- Chính sách offset khi group CHƯA có offset (lần đầu, hoặc offset đã hết hạn):
-- ClickHouse 24.8 tự đặt auto.offset.reset = earliest, tức đọc lại TOÀN BỘ
-- phần topic Kafka còn giữ (nguồn: src/Storages/Kafka/KafkaConfigLoader.cpp,
-- nhánh 24.8). Sau đợt seed 3 triệu đơn topic này từng giữ hơn 3 triệu bản
-- ghi CDC — đọc lại chừng đó là quá nặng cho máy 16 GB đang chạy cả hệ.
-- Muốn bắt đầu từ cuối topic (latest) thì KHÔNG đặt được ở đây: 24.8 không có
-- setting `kafka_auto_offset_reset` cấp bảng (thử 14/11/2026 trên đúng image
-- 24.8.14.39: "Unknown setting 'kafka_auto_offset_reset': for storage Kafka").
-- Chỗ đặt được là cấu hình server, khối <kafka><auto_offset_reset>latest
-- trong config.d — cần mount thêm vào service clickhouse của compose. Bỏ qua
-- phần cũ của topic không làm mất đơn: bootstrap nạp bù 7 ngày từ Postgres.
CREATE TABLE IF NOT EXISTS realtime.kafka_orders
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
    kafka_skip_broken_messages = 100,
    -- Trần số message mỗi khối (14/11/2026). Không đặt thì bằng
    -- max_insert_block_size / kafka_num_consumers (StorageKafka.cpp nhánh 24.8,
    -- getMaxBlockSize) = 1 048 449 (đo trên 24.8), mà một message CDC Order nặng ~4,7 KB
    -- (đo 3 message thật: 14 190 byte, phần lớn là khối "schema"). Khi phải đọc
    -- dồn — lần đầu với earliest, hoặc ClickHouse tắt lâu rồi bật lại — một khối
    -- về lý thuyết có thể tới cỡ GB, vượt mem_limit 3g của container. 10 000
    -- message ~ 47 MB một khối. Lúc bình thường không đổi gì: khối vẫn được đẩy
    -- đi theo chu kỳ stream_flush_interval_ms = 7 500 ms.
    kafka_max_block_size    = 10000;

-- ── 2. Bảng đích: lưu thật ──────────────────────────────────────────────
-- IF NOT EXISTS (14/11/2026): đây là bảng duy nhất giữ dữ liệu của nhánh nóng;
-- bản cũ DROP + CREATE nên mỗi lần chạy lại là xoá sạch.
--
-- Bốn cột tiền/thời điểm thêm 14/11/2026 (sub_total, shipping_fee, discount,
-- paid_at), đặt tên snake_case như staging.stg_orders của nhánh lạnh:
-- doanh thu nhánh lạnh = SUM(net_amount) theo dòng hàng, và trên toàn bộ lịch
-- sử Σ net_amount = Σ Order.subTotal (0 đơn lệch — main session đo 14/11/2026),
-- nên có sub_total thì nhánh nóng khớp nhánh lạnh từng đồng mà không phải
-- stream OrderItem. shipping_fee/discount để đối soát, paid_at cho số "tiền đã
-- thu" theo thời điểm thanh toán.
--
-- _arrived_at đổi DateTime -> DateTime64(3) (14/11/2026): độ trễ nhánh này
-- cỡ giây, đo bằng _arrived_at - _event_ts với _arrived_at làm tròn xuống giây
-- thì sai số tới 1 giây — bằng chính đại lượng cần đo.
CREATE TABLE IF NOT EXISTS realtime.orders_live
(
    order_id        String,
    customer_id     Int64,
    total           Int64,
    sub_total       Int64,
    shipping_fee    Int64,
    discount        Int64,
    status          String,
    payment_method  String,
    payment_status  String,
    province        String,
    order_date      DateTime64(3, 'UTC'),
    paid_at         Nullable(DateTime64(3, 'UTC')),
    _event_ts       DateTime64(3, 'UTC'),
    _is_deleted     UInt8,
    _arrived_at     DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(_event_ts, _is_deleted)
PARTITION BY toYYYYMM(order_date)
ORDER BY (order_id)
-- Dữ liệu nóng chỉ cần cho dashboard hôm nay; lịch sử để nhánh lạnh giữ.
TTL toDateTime(order_date) + INTERVAL 7 DAY;

-- Máy nào đã có bảng từ bản cũ (chưa có 4 cột trên) thì CREATE ở trên bỏ qua;
-- thêm cột tại chỗ, không đụng dữ liệu đang có. Bảng mới tạo thì các câu này
-- không làm gì. Dòng cũ nhận giá trị mặc định (0 / NULL) cho cột mới.
-- (_arrived_at của bảng cũ giữ kiểu DateTime — chỉ ảnh hưởng độ chính xác đo.)
ALTER TABLE realtime.orders_live ADD COLUMN IF NOT EXISTS sub_total    Int64 AFTER total;
ALTER TABLE realtime.orders_live ADD COLUMN IF NOT EXISTS shipping_fee Int64 AFTER sub_total;
ALTER TABLE realtime.orders_live ADD COLUMN IF NOT EXISTS discount     Int64 AFTER shipping_fee;
ALTER TABLE realtime.orders_live ADD COLUMN IF NOT EXISTS paid_at      Nullable(DateTime64(3, 'UTC')) AFTER order_date;

-- ── 3. Materialized View: cầu nối, tự chạy khi có message mới ───────────
-- DROP + CREATE mỗi lần chạy (14/11/2026), khác hai bảng trên, vì:
--   - view có mệnh đề TO không chứa dữ liệu — dữ liệu nằm ở orders_live;
--   - IF NOT EXISTS sẽ giữ nguyên định nghĩa CŨ trên máy đã có view, nên
--     thêm cột vào SELECT dưới đây không bao giờ có hiệu lực ở đó;
--   - giữa DROP và CREATE không có view nào gắn vào bảng Kafka nên ClickHouse
--     ngừng đọc và không commit offset; message tới trong lúc đó vẫn nằm ở
--     Kafka và được đọc tiếp từ offset đã commit khi view mới gắn vào (group
--     chưa từng commit thì áp chính sách offset ở mục 1). Message đã đọc mà
--     chưa commit có thể bị đọc lại (at-least-once) — trùng phiên bản
--     _event_ts nên ReplacingMergeTree gộp lại còn một dòng.
DROP VIEW IF EXISTS realtime.mv_orders_live;
CREATE MATERIALIZED VIEW realtime.mv_orders_live TO realtime.orders_live AS
SELECT
    JSONExtractString(coalesce(after_raw, before_raw), 'id')             AS order_id,
    JSONExtractInt(coalesce(after_raw, before_raw), 'customer_id')       AS customer_id,
    JSONExtractInt(coalesce(after_raw, before_raw), 'total')             AS total,
    -- Tên trường giữ nguyên tên cột Postgres do Prisma đặt (camelCase), đối
    -- chiếu message thật offset 3000024..3000026 ngày 14/11/2026: int32.
    JSONExtractInt(coalesce(after_raw, before_raw), 'subTotal')          AS sub_total,
    JSONExtractInt(coalesce(after_raw, before_raw), 'shippingFee')       AS shipping_fee,
    JSONExtractInt(coalesce(after_raw, before_raw), 'discount')          AS discount,
    JSONExtractString(coalesce(after_raw, before_raw), 'status')         AS status,
    JSONExtractString(coalesce(after_raw, before_raw), 'payment_method') AS payment_method,
    JSONExtractString(coalesce(after_raw, before_raw), 'payment_status') AS payment_status,
    JSONExtractString(coalesce(after_raw, before_raw), 'province')       AS province,
    toDateTime64(JSONExtractInt(coalesce(after_raw, before_raw), 'date') / 1000, 3, 'UTC') AS order_date,
    -- paid_at: kiểu org.apache.kafka.connect.data.Timestamp (mili-giây), optional
    -- — đơn chưa trả là JSON null. Đọc dạng Nullable để null giữ là NULL thay vì
    -- thành 1970-01-01.
    toDateTime64(JSONExtract(coalesce(after_raw, before_raw), 'paid_at', 'Nullable(Int64)') / 1000, 3, 'UTC') AS paid_at,
    toDateTime64(JSONExtractInt(envelope, 'ts_ms') / 1000, 3, 'UTC')     AS _event_ts,
    if(JSONExtractString(envelope, 'op') = 'd', 1, 0)                    AS _is_deleted,
    now64(3)                                                             AS _arrived_at
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
