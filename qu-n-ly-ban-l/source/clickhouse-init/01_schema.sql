-- ============================================================
-- iStore Analytics — ClickHouse Schema
-- Chạy tự động khi ClickHouse container khởi động
-- ============================================================

CREATE DATABASE IF NOT EXISTS analytics;

-- Sale Orders (từ CDC erp.pm_saleorder)
CREATE TABLE IF NOT EXISTS analytics.sale_orders
(
    order_id        String,
    branch_id       String,
    branch_name     String,
    region          String,
    salesperson_id  String,
    customer_id     String,
    product_id      String,
    product_name    String,
    product_category String,
    quantity        Int32 DEFAULT 1,
    unit_price      Decimal(18, 2),
    total_amount    Decimal(18, 2),
    discount        Decimal(18, 2) DEFAULT 0,
    net_amount      Decimal(18, 2),
    status          String,           -- CONFIRMED, VOIDED, PENDING, REFUNDED
    payment_method  String,           -- CASH, CARD, TRANSFER, MOMO, VNPAY
    order_date      DateTime64(3, 'Asia/Ho_Chi_Minh'),
    created_at      DateTime64(3, 'Asia/Ho_Chi_Minh') DEFAULT now(),
    _cdc_op         String DEFAULT 'c'
)
ENGINE = ReplacingMergeTree(created_at)
PARTITION BY toYYYYMM(order_date)
ORDER BY (order_id, branch_id)
SETTINGS index_granularity = 8192;

-- Input Vouchers / Phiếu thu (từ CDC erp.pm_inputvoucher)
CREATE TABLE IF NOT EXISTS analytics.input_vouchers
(
    voucher_id      String,
    order_id        String,
    branch_id       String,
    amount          Decimal(18, 2),
    voucher_date    DateTime64(3, 'Asia/Ho_Chi_Minh'),
    payment_type    String,
    note            String DEFAULT '',
    created_at      DateTime64(3, 'Asia/Ho_Chi_Minh') DEFAULT now()
)
ENGINE = ReplacingMergeTree(created_at)
PARTITION BY toYYYYMM(voucher_date)
ORDER BY (voucher_id, order_id)
SETTINGS index_granularity = 8192;

-- Output Vouchers / Phiếu chi (từ CDC erp.pm_outputvoucher)
CREATE TABLE IF NOT EXISTS analytics.output_vouchers
(
    voucher_id      String,
    order_id        String DEFAULT '',
    branch_id       String,
    amount          Decimal(18, 2),
    voucher_date    DateTime64(3, 'Asia/Ho_Chi_Minh'),
    category        String,           -- REFUND, COGS, EXPENSE, SALARY
    note            String DEFAULT '',
    created_at      DateTime64(3, 'Asia/Ho_Chi_Minh') DEFAULT now()
)
ENGINE = ReplacingMergeTree(created_at)
PARTITION BY toYYYYMM(voucher_date)
ORDER BY (voucher_id)
SETTINGS index_granularity = 8192;

-- Alert Events (sinh ra bởi Fraud Detection engine)
CREATE TABLE IF NOT EXISTS analytics.alert_events
(
    alert_id        String,
    rule_name       String,
    branch_id       String,
    severity        String,           -- LOW, MEDIUM, HIGH, CRITICAL
    message         String,
    details         String DEFAULT '{}',  -- JSON
    triggered_at    DateTime64(3, 'Asia/Ho_Chi_Minh') DEFAULT now(),
    acknowledged    UInt8 DEFAULT 0,
    acknowledged_by String DEFAULT '',
    acknowledged_at Nullable(DateTime64(3))
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(triggered_at)
ORDER BY (triggered_at, severity, branch_id)
SETTINGS index_granularity = 8192;

-- ══════════════════════════════════════════════════════════════════
-- User Behavior Events — Implicit Feedback cho AI Recommendation
-- Thu thập hành vi duyệt web: views, clicks, cart, wishlist, search, purchase
-- Phục vụ: Collaborative Filtering, User Profiling, Trending Analysis
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS analytics.user_events
(
    event_id         String DEFAULT generateUUIDv4(),
    event_type       LowCardinality(String),  -- product_view, add_to_cart, remove_from_cart, purchase,
                                              -- add_to_wishlist, search_query, category_view,
                                              -- compare_view, review_submit, checkout_abandon
    session_id       String,                  -- Browser fingerprint / UUID (nhận diện phiên ẩn danh)
    customer_id      Nullable(Int64),         -- B2CCustomer.id nếu đã đăng nhập

    -- ── Product context ──────────────────────────────────────────
    product_id       Nullable(Int64),
    category_id      Nullable(String),
    brand_id         Nullable(String),
    price_at_event   Nullable(Decimal(18, 2)),

    -- ── Engagement metrics ───────────────────────────────────────
    dwell_time_ms    Nullable(Int32),         -- Thời gian ở trang sản phẩm (ms)
    scroll_depth_pct Nullable(Float32),       -- % cuộn trang (0.0 → 100.0)
    quantity         Nullable(Int32),         -- Số lượng (add_to_cart, purchase)
    rating           Nullable(Int32),         -- 1-5 (review_submit)

    -- ── Search context ───────────────────────────────────────────
    search_query     Nullable(String),
    result_count     Nullable(Int32),

    -- ── Multi-product events (compare, checkout_abandon) ─────────
    product_ids      Array(Int64) DEFAULT [],

    -- ── Hidden attributes (context-aware recommendation) ─────────
    device_type      LowCardinality(String) DEFAULT 'desktop',  -- mobile, desktop, tablet
    referrer         LowCardinality(String) DEFAULT 'direct',   -- direct, search, chatbot, recommendation, category
    page_source      LowCardinality(String) DEFAULT '',         -- home, category, search, detail, cart, checkout

    -- ── Timestamps ───────────────────────────────────────────────
    event_time       DateTime64(3, 'Asia/Ho_Chi_Minh') DEFAULT now(),
    created_at       DateTime64(3, 'Asia/Ho_Chi_Minh') DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_type, session_id, event_time)
-- toDateTime() là bắt buộc: ClickHouse chỉ nhận DateTime hoặc Date trong biểu
-- thức TTL, còn event_time là DateTime64(3). Thiếu ép kiểu thì CREATE TABLE
-- ném BAD_TTL_EXPRESSION và BẢNG KHÔNG BAO GIỜ ĐƯỢC TẠO — mọi endpoint
-- Behavior Analytics trả 500 "Unknown table expression identifier".
-- Lỗi nằm im vì file này chạy qua /docker-entrypoint-initdb.d, nơi không ai
-- đọc log trừ khi đi tìm.
TTL toDateTime(event_time) + INTERVAL 90 DAY   -- tự dọn dữ liệu cũ hơn 90 ngày
SETTINGS index_granularity = 8192;
