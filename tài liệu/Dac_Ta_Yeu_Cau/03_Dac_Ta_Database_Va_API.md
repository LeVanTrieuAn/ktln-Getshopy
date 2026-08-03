# TÀI LIỆU 03: ĐẶC TẢ DATABASE VÀ API (API & DATABASE SPECIFICATION)

Tài liệu này cung cấp chi tiết về cấu trúc lưu trữ và các endpoint API cho ứng dụng phân tích tài chính.

---

## 1. CƠ SỞ DỮ LIỆU OLTP (POSTGRESQL)
Sử dụng cho Authentication, Cấu hình và Dữ liệu Master.

### 1.1. Bảng `users`
- `id` (SERIAL PRIMARY KEY)
- `email` (VARCHAR(255) UNIQUE NOT NULL)
- `password_hash` (VARCHAR(255) NOT NULL)
- `full_name` (VARCHAR(255) NOT NULL)
- `role` (VARCHAR(50)): 'CEO', 'CFO', 'MANAGER', 'STAFF'
- `branch_id` (VARCHAR(50)): NULL có nghĩa là áp dụng cho toàn chuỗi
- `created_at` (TIMESTAMP)

### 1.2. Bảng `branches`
- `id` (VARCHAR(50) PRIMARY KEY): VD: 'HN001'
- `name` (VARCHAR(255) NOT NULL)
- `region` (VARCHAR(50) NOT NULL): 'NORTH', 'SOUTH', 'CENTRAL'
- `address` (TEXT)
- `is_active` (BOOLEAN DEFAULT TRUE)

### 1.3. Bảng `alert_rules`
- `id` (SERIAL PRIMARY KEY)
- `rule_name` (VARCHAR(255) NOT NULL)
- `condition` (JSONB NOT NULL): VD: `{"metric": "void_rate", "operator": ">", "threshold": 0.15}`
- `severity` (VARCHAR(20)): 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
- `is_active` (BOOLEAN DEFAULT TRUE)

---

## 2. KAFKA TOPICS VÀ CDC (CHANGE DATA CAPTURE)

### 2.1. Nguồn Dữ Liệu
Các Kafka Topic chính được tạo tự động bởi Debezium (CDC) từ ERP hệ thống:
- `erp.pm_saleorder`: Đơn hàng bán lẻ.
- `erp.pm_inputvoucher`: Phiếu thu (tiền vào).
- `erp.pm_outputvoucher`: Phiếu chi (tiền ra).

### 2.2. Outbox Pattern
Để giải quyết bài toán giao dịch nhiều bảng (Multi-Table Transaction) hoặc ghi đồng thời (Dual Write), hệ thống sử dụng bảng `outbox` trung gian ở PostgreSQL:
- Bất kỳ khi nào có giao dịch quan trọng (ví dụ chốt đơn và thanh toán cùng lúc), ứng dụng ghi vào bảng `outbox` trong cùng 1 Database Transaction.
- Debezium chỉ cần đọc từ bảng `outbox` để phát Event hoàn chỉnh, đảm bảo tính nguyên tử (Atomicity).

---

## 3. CƠ SỞ DỮ LIỆU OLAP (CLICKHOUSE)
Sử dụng cho truy vấn phân tích (Analytics). Các dữ liệu được đẩy thẳng từ Kafka Consumer.

### 3.1. Bảng `sale_orders` (ReplacingMergeTree)
```sql
CREATE TABLE sale_orders (
  order_id       String,
  branch_id      String,
  branch_name    String,
  region         String,
  salesperson_id String,
  total_amount   Decimal(18, 2),
  discount       Decimal(18, 2) DEFAULT 0,
  net_amount     Decimal(18, 2),
  status         String,          -- 'CONFIRMED','VOIDED','PENDING'
  payment_method String,          -- 'CASH','CARD','TRANSFER'
  order_date     DateTime,
  created_at     DateTime DEFAULT now(),
  -- Kafka metadata để tracing và schema evolution
  _kafka_offset  Int64,
  _kafka_topic   String,
  _cdc_op        String           -- 'c'=create, 'u'=update, 'd'=delete
) ENGINE = ReplacingMergeTree(created_at)
  PARTITION BY toYYYYMM(order_date)
  ORDER BY (order_id, branch_id, order_date);
```

### 3.2. Bảng `input_vouchers` (ReplacingMergeTree)
Chứa dữ liệu dòng tiền thu vào (Tiền mặt, thẻ, VNPay). Giống cấu trúc trên với `voucher_id`, `order_id` (Khóa ngoại logic), `amount`, `voucher_date`.

### 3.3. Materialized View `reconciliation_mv` (AggregatingMergeTree)
Tự động đối soát đơn hàng và phiếu thu tại thời điểm có dữ liệu mới.
```sql
CREATE MATERIALIZED VIEW reconciliation_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(order_date)
ORDER BY (order_id, branch_id) AS
SELECT
  s.order_id,
  s.branch_id,
  s.net_amount       as sale_amount,
  SUM(iv.amount)     as received_amount,
  s.net_amount - SUM(iv.amount) as gap,
  CASE
    WHEN ABS(s.net_amount - SUM(iv.amount)) < 1000 THEN 'MATCHED'
    WHEN SUM(iv.amount) = 0 THEN 'PENDING'
    ELSE 'MISMATCH'
  END as recon_status,
  s.order_date
FROM sale_orders s
LEFT JOIN input_vouchers iv ON s.order_id = iv.order_id
GROUP BY s.order_id, s.branch_id, s.net_amount, s.order_date;
```

---

## 4. API SPECIFICATION (REST)

### 4.1. Auth API
- `POST /api/auth/login`: Nhận `{email, password}`, Trả về `{token, user}`.
- `GET /api/auth/me`: Kiểm tra Authorization Token.

### 4.2. Dashboard KPIs API
- `GET /api/dashboard/kpis?branch_id=HN001&date_from=2024-03-01`
  - Trả về: `{ revenue_today, revenue_vs_yesterday_pct, orders_today, net_cash, void_rate }`
- `GET /api/analytics/revenue/by-hour?date=2024-03-15&branch_id=ALL`
  - Trả về: `[{ hour: "09:00", revenue: 125000000, orders: 5 }, ...]`
- `GET /api/analytics/revenue/by-branch`
  - Trả về xếp hạng doanh thu giữa các chi nhánh.

### 4.3. Financial & Reconciliation API
- `GET /api/reconciliation/status?branch_id=&status=MISMATCH`
  - Trả về các đơn hàng bị lệch tiền giữa giá trị xuất kho và giá trị thu thực tế.
  - Phục vụ việc theo dõi Cash Float (Tiền đang luân chuyển) từ các ví điện tử.

### 4.4. Alerts & Fraud Detection API
- `GET /api/alerts/active`: Trả về danh sách cảnh báo theo thời gian thực (Triggered by Kafka Streams).
- `PUT /api/alerts/:id/acknowledge`: Cập nhật trạng thái đã tiếp nhận cảnh báo.
