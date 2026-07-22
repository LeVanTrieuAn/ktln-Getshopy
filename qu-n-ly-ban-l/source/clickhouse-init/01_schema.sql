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
