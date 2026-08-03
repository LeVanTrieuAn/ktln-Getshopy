

---

# TÀI LIỆU GỐC: 02_PRD_Va_Dac_Ta_Ung_Dung.md

# TÀI LIỆU 02: PRODUCT REQUIREMENTS DOCUMENT (PRD) VÀ ĐẶC TẢ ỨNG DỤNG
**Các Ứng Dụng Khai Thác Sức Mạnh Big Data Pipeline**

Tài liệu này đặc tả các ứng dụng (Applications) được xây dựng trên nền tảng luồng dữ liệu CDC Kafka. Bằng cách tiêu thụ (consume) dữ liệu từ các Topic `erp.pm_saleorder`, `erp.pm_inputvoucher`, `erp.pm_outputvoucher`, hệ thống có thể cung cấp các phân tích kinh doanh cực kỳ mạnh mẽ.

---

## 1. ỨNG DỤNG 1: FINANCIAL ANALYTICS DASHBOARD (Bảng Điều Khiển Tài Chính)
**Đối tượng sử dụng**: CEO, CFO, Store Manager.
**Mục tiêu**: Cung cấp cái nhìn toàn cảnh về tình hình tài chính, doanh thu, dòng tiền theo thời gian thực (Độ trễ < 3 giây).

### 1.1. Các Chỉ Số Cốt Lõi (Real-time KPIs)
- **Doanh thu hôm nay (Revenue Today)**: Tổng hợp theo giờ, so sánh với ngày hôm qua.
- **Tiền thu (Cash Collected)**: Dòng tiền thực tế đã thu vào.
- **Biên lợi nhuận (Gross Margin)**: Tính toán chênh lệch giữa giá bán và giá vốn. Cảnh báo tự động nếu biên lợi nhuận < 8% (Margin Erosion Detector).
- **Trạng thái Đối soát (Reconciliation Status)**: So khớp tự động giữa Đơn hàng (Sale Order) và Phiếu thu (Input Voucher). Phân loại: Khớp (Matched), Chờ thu (Pending), Lệch (Mismatch).

### 1.2. Phân Quyền (RBAC)
- **CEO / CFO**: Xem dữ liệu toàn chuỗi, xem tất cả các chi nhánh.
- **Store Manager**: Chỉ được xem dữ liệu của chi nhánh mình quản lý.

---

## 2. ỨNG DỤNG 2: FRAUD DETECTION ENGINE (Hệ Thống Chống Gian Lận)
**Đối tượng sử dụng**: Risk Management Team (Quản trị rủi ro), Quản lý khu vực.
**Mục tiêu**: Áp dụng Stream Processing (Kafka Streams) để phát hiện hành vi bất thường ngay tại thời điểm xảy ra, thay vì đợi kiểm toán cuối tháng.

### 2.1. Các Quy Tắc Cảnh Báo (Rules)
- **Tỷ lệ hủy đơn cao (High Void Rate)**: Sử dụng Tumbling Window (ví dụ: 1 giờ). Nếu 1 nhân viên/chi nhánh có tỷ lệ hủy đơn > 15% tổng đơn → Kích hoạt Alert Cấp độ Cao (HIGH).
- **Thanh toán tiền mặt sau giờ làm (After-hours Cash)**: Nếu đơn hàng thanh toán bằng tiền mặt được tạo ra sau 22:00 → Kích hoạt Alert Cấp độ Vừa (MEDIUM).
- **Sai lệch giá (Price Deviation)**: Giá bán thực tế thấp hơn 10% hoặc cao hơn 5% so với giá niêm yết (Không áp dụng chương trình khuyến mãi hợp lệ).

---

## 3. ỨNG DỤNG 3: SUPPLY CHAIN & FULFILLMENT TRACKER
**Đối tượng sử dụng**: Operations Team (Vận hành).
**Mục tiêu**: Giám sát SLA giao hàng, ngăn ngừa tồn kho "ma".

### 3.1. Tính Năng Giám Sát SLA (Proactive SLA Engine)
- Tính toán thời gian từ lúc khách chốt đơn đến khi xuất kho giao hàng (`pm_outputvoucher.output_date - pm_saleorder.order_date`).
- Nếu sắp chạm mốc cam kết SLA (ví dụ: giao trong 4 giờ) mà chưa xuất kho → Tự động gửi Alert cho kho và SMS xin lỗi khách hàng (Cơ chế Self-healing).

### 3.2. Cập Nhật Tồn Kho (One Second Inventory)
- Áp dụng nguyên lý CQRS và Optimistic Inventory Locking.
- Khi chốt đơn, chỉ đẩy sự kiện vào Kafka. ClickHouse tính tổng `SUM(nhập) - SUM(xuất)` để ra tồn kho thực tế, không lock Database OLTP.

---

## 4. ỨNG DỤNG 4: AI & CUSTOMER INTELLIGENCE (Hệ Thống Trí Tuệ Khách Hàng)
**Đối tượng sử dụng**: Marketing Team, Chăm sóc Khách hàng (CRM).

### 4.1. "Customer DNA" (Vector Embedding)
- Mỗi hành động của khách hàng (click, add to cart, buy) được mã hóa thành vector 128 chiều.
- Lưu trong Vector Database để tìm kiếm "Lookalike Audience" (Khách hàng tương tự) bằng Cosine Similarity, phục vụ cho các chiến dịch Upsell (ví dụ: Gợi ý mua AirPods cho khách vừa mua iPhone 15).

### 4.2. Giải Quyết Tranh Chấp Bằng AI (Dispute Resolution)
- Hợp nhất lịch sử bảo hành, lịch sử mua hàng, lần mở máy đầu tiên (First Boot) thành một "Customer Golden Record".
- Khi khách claim bảo hành, hệ thống AI tự động viết một bản tóm tắt tình trạng vòng đời của thiết bị, giúp nhân viên có cơ sở chính xác để phản hồi khách.

---

## 5. UI/UX & FRONTEND REQUIREMENT
- **Framework**: React.js 19 + Ant Design 5.
- **Biểu đồ**: Apache ECharts để vẽ biểu đồ Line Chart (Doanh thu theo giờ, cập nhật real-time không cần reload trang).
- **Đa Ngôn Ngữ (i18n)**: Hỗ trợ tiếng Việt (VI) và tiếng Anh (EN).
- **Giao Diện**: Hỗ trợ Light / Dark Mode chuẩn Enterprise. Layout bao gồm Sidebar chứa các tab: Dashboard, Financial, Alerts, Fulfillment. Trang Dashboard phải hiển thị được KPI Cards (Revenue, Orders, Net Cash) cùng với Ranking các chi nhánh tốt nhất.


---

# TÀI LIỆU GỐC: 03_Dac_Ta_Database_Va_API.md

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


---

# TÀI LIỆU GỐC: db_schema.md

# Toàn bộ Schema Database — iStore Analytics

Hệ thống sử dụng **2 lớp lưu trữ song song**. Cần hiểu rõ cả hai khi mock data.

---

## 🗺️ Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────────┐
│                    iStore Analytics Backend                     │
├───────────────────────────┬─────────────────────────────────────┤
│  📦 LowDB (data/db.json)  │  🏭 ClickHouse (analytics DB)       │
│  Master data & B2C ops    │  Time-series analytics & events     │
│  ─ users                  │  ─ analytics.sale_orders            │
│  ─ b2c_customers          │  ─ analytics.input_vouchers         │
│  ─ branches               │  ─ analytics.output_vouchers        │
│  ─ brands                 │  ─ analytics.alert_events           │
│  ─ categories             │                                     │
│  ─ products               │  Dữ liệu được SYNC từ B2C checkout  │
│  ─ reviews                │  sang ClickHouse để analytics       │
│  ─ orders                 │                                     │
│  ─ flash_sales            │                                     │
│  ─ flash_sale_items       │                                     │
│  ─ voucher_tiers          │                                     │
│  ─ customer_vouchers      │                                     │
└───────────────────────────┴─────────────────────────────────────┘
```

---

# PHẦN 1 — LowDB (data/db.json)

File JSON dùng làm database cho **master data** và **nghiệp vụ B2C**.
Khi mock data cho phần này, hãy chỉnh sửa trực tiếp file `data/db.json`.

---

## 1.1 `users` — Tài khoản B2B (Admin/Staff)

| Trường          | Kiểu      | Ghi chú                                                 |
| :---------------- | :--------- | :------------------------------------------------------- |
| `id`            | `Number` | ID tự tăng (VD:`1`, `2`)                           |
| `full_name`     | `String` | Họ tên đầy đủ                                      |
| `email`         | `String` | Email đăng nhập,**phải unique**                |
| `password_hash` | `String` | Mật khẩu đã bcrypt (`'admin'` → hash mặc định) |
| `role`          | `String` | `'admin'` hoặc `'staff'`                            |
| `status`        | `String` | `'active'` hoặc `'inactive'`                        |

**Ví dụ:**

```json
{ "id": 1, "full_name": "Nguyễn Văn A", "email": "admin@istore.vn", "password_hash": "$2b$10$...", "role": "admin", "status": "active" }
```

---

## 1.2 `b2c_customers` — Tài khoản B2C (Khách hàng cuối)

| Trường           | Kiểu      | Ghi chú                                  |
| :----------------- | :--------- | :---------------------------------------- |
| `id`             | `Number` | Dùng`Date.now()` khi tạo mới         |
| `full_name`      | `String` | Họ tên                                  |
| `email`          | `String` | Email,**phải unique**              |
| `phone`          | `String` | Số điện thoại (có thể rỗng)        |
| `password_hash`  | `String` | Rỗng nếu đăng nhập bằng Social      |
| `loyalty_points` | `Number` | Điểm tích lũy (VD:`1500`)           |
| `avatar`         | `String` | URL ảnh đại diện                      |
| `provider`       | `String` | `'local'`, `'google'`, `'facebook'` |

---

## 1.3 `branches` — Chi nhánh cửa hàng

> [!IMPORTANT]
> `branch_id` phải **khớp hoàn toàn** với `branch_id` trong ClickHouse. Nếu mock ClickHouse có `'HN001'` thì db.json cũng phải có `{ "id": "HN001" }`.

| Trường       | Kiểu       | Ghi chú                                      |
| :------------- | :---------- | :-------------------------------------------- |
| `id`         | `String`  | Mã chi nhánh (VD:`'HN001'`, `'HCM001'`) |
| `name`       | `String`  | Tên hiển thị (VD:`'HN - Hoàn Kiếm'`)   |
| `address`    | `String`  | Địa chỉ đầy đủ                         |
| `is_deleted` | `Boolean` | Soft-delete, mặc định`undefined/false`   |

**Danh sách chuẩn (dùng để khớp với ClickHouse):**

```json
[
  { "id": "HN001", "name": "Hà Nội - Hoàn Kiếm", "address": "Hà Nội" },
  { "id": "HN002", "name": "Hà Nội - Cầu Giấy", "address": "Hà Nội" },
  { "id": "HN003", "name": "Hà Nội - Đống Đa", "address": "Hà Nội" },
  { "id": "HCM001", "name": "HCM - Quận 1", "address": "Hồ Chí Minh" },
  { "id": "HCM002", "name": "HCM - Bình Thạnh", "address": "Hồ Chí Minh" },
  { "id": "HCM003", "name": "HCM - Gò Vấp", "address": "Hồ Chí Minh" },
  { "id": "DN001", "name": "Đà Nẵng - Hải Châu", "address": "Đà Nẵng" }
]
```

---

## 1.4 `brands` — Thương hiệu sản phẩm

| Trường       | Kiểu       | Ghi chú                                    |
| :------------- | :---------- | :------------------------------------------ |
| `id`         | `String`  | VD:`'b1'`, `'b2'`, hoặc `'BRD-1234'` |
| `name`       | `String`  | Tên thương hiệu (VD:`'Apple'`)        |
| `is_deleted` | `Boolean` | Soft-delete                                 |

---

## 1.5 `categories` — Danh mục sản phẩm

| Trường | Kiểu      | Ghi chú                                            |
| :------- | :--------- | :-------------------------------------------------- |
| `id`   | `String` | VD:`'c1'`, `'c2'`, `'c3'`, `'c4'`           |
| `name` | `String` | Tên danh mục (VD:`'Điện thoại thông minh'`) |
| `icon` | `String` | Tên icon Ant Design (VD:`'MobileOutlined'`)      |

**4 danh mục mặc định:** `c1` (Smartphone), `c2` (Laptop), `c3` (Tablet), `c4` (Phụ kiện)

---

## 1.6 `products` — Sản phẩm

| Trường           | Kiểu         | Ghi chú                                                         |
| :----------------- | :------------ | :--------------------------------------------------------------- |
| `id`             | `Number`    | Dùng`Date.now()` hoặc số nguyên (`1`, `2`, ...)        |
| `name`           | `String`    | Tên sản phẩm                                                  |
| `price`          | `Number`    | Giá bán hiện tại (VNĐ)                                      |
| `original_price` | `Number`    | Giá gốc (dùng để tính % giảm giá)                        |
| `category_id`    | `String`    | Khóa ngoại →`categories.id`                                 |
| `brand_id`       | `String`    | Khóa ngoại →`brands.id`                                     |
| `stock`          | `Number`    | Số lượng tồn kho                                             |
| `rating`         | `Number`    | Điểm đánh giá trung bình (0–5)                            |
| `sold`           | `Number`    | Số lượng đã bán                                            |
| `image`          | `String`    | URL ảnh chính                                                  |
| `images`         | `String[]`  | Danh sách ảnh phụ                                             |
| `description`    | `String`    | Mô tả chi tiết                                                |
| `variants`       | `Variant[]` | Các biến thể màu/dung lượng (xem bên dưới)              |
| `branch_ids`     | `String[]`  | Danh sách chi nhánh có sản phẩm (khớp với`branches.id`) |
| `is_banner`      | `Boolean`   | Hiển thị trên banner trang chủ                               |
| `is_deleted`     | `Boolean`   | Soft-delete                                                      |

**Cấu trúc `Variant`:**

```json
{ "id": "v1", "color": "Titan Tự Nhiên", "storage": "256GB", "price": 34990000, "stock": 5 }
```

---

## 1.7 `reviews` — Đánh giá sản phẩm

| Trường        | Kiểu             | Ghi chú                              |
| :-------------- | :---------------- | :------------------------------------ |
| `id`          | `String/Number` | VD:`'REV-1234'` hoặc `1`         |
| `product_id`  | `Number`        | Khóa ngoại →`products.id`        |
| `customer_id` | `Number`        | Khóa ngoại →`b2c_customers.id`   |
| `reviewer`    | `String`        | Tên người đánh giá (hiển thị) |
| `rating`      | `Number`        | Số sao (1–5)                        |
| `comment`     | `String`        | Nội dung đánh giá                 |
| `date`        | `String`        | ISO date string                       |
| `reply`       | `String`        | Phản hồi của shop (có thể rỗng) |
| `reply_date`  | `String`        | Ngày phản hồi                      |

---

## 1.8 `orders` — Đơn hàng B2C (Online)

Được tạo khi khách hàng checkout trên website. Dữ liệu đồng thời được sync sang ClickHouse.

| Trường        | Kiểu        | Ghi chú                                             |
| :-------------- | :----------- | :--------------------------------------------------- |
| `id`          | `String`   | VD:`'ORD-1784705186576'`                           |
| `customer`    | `Object`   | Thông tin giao hàng (xem bên dưới)              |
| `items`       | `Object[]` | Snapshot sản phẩm tại thời điểm mua            |
| `total`       | `Number`   | Tổng tiền cuối cùng (gồm ship, trừ giảm giá) |
| `discount`    | `Number`   | Số tiền giảm giá                                 |
| `shippingFee` | `Number`   | Phí vận chuyển                                    |
| `subTotal`    | `Number`   | Tổng tiền hàng (trước ship)                     |
| `status`      | `String`   | `'CONFIRMED'`, `'PENDING'`, `'CANCELLED'`      |
| `date`        | `String`   | ISO date string                                      |

**Cấu trúc `customer`:**

```json
{ "full_name": "Nguyễn Văn A", "phone": "0901234567", "address": "123 Lê Lợi", "province": "HCM", "email": "abc@gmail.com" }
```

---

## 1.9 `flash_sales` — Chương trình Flash Sale

| Trường             | Kiểu       | Ghi chú                            |
| :------------------- | :---------- | :---------------------------------- |
| `id`               | `Number`  | `Date.now()`                      |
| `title`            | `String`  | Tên chương trình khuyến mãi   |
| `start_time`       | `String`  | ISO date — thời gian bắt đầu   |
| `end_time`         | `String`  | ISO date — thời gian kết thúc   |
| `product_id`       | `Number?` | Áp dụng cho 1 sản phẩm cụ thể |
| `category_id`      | `String?` | Áp dụng cho toàn bộ danh mục   |
| `discount_percent` | `Number`  | % giảm giá (VD:`20`)            |
| `is_deleted`       | `Boolean` | Soft-delete                         |

---

## 1.10 `flash_sale_items` — Sản phẩm trong Flash Sale

| Trường           | Kiểu      | Ghi chú                          |
| :----------------- | :--------- | :-------------------------------- |
| `flash_sale_id`  | `Number` | Khóa ngoại →`flash_sales.id` |
| `product_id`     | `Number` | Khóa ngoại →`products.id`    |
| `discount_price` | `Number` | Giá sau giảm (VNĐ)             |
| `limit`          | `Number` | Số lượng tối đa trong sale   |
| `sold`           | `Number` | Số lượng đã bán trong sale  |

---

## 1.11 `voucher_tiers` — Bậc voucher khách hàng thân thiết

| Trường                   | Kiểu      | Ghi chú                                 |
| :------------------------- | :--------- | :--------------------------------------- |
| `id`                     | `Number` | ID bậc                                  |
| `name`                   | `String` | Tên bậc (VD:`'Khách Hạng Vàng'`)  |
| `min_points_required`    | `Number` | Điểm tối thiểu                       |
| `min_lifetime_spend_vnd` | `Number` | Tổng chi tiêu tối thiểu (VNĐ)       |
| `discount_amount_vnd`    | `Number` | Số tiền giảm khi dùng voucher (VNĐ) |
| `active`                 | `Number` | `1` (hoạt động) hoặc `0`         |

---

## 1.12 `customer_vouchers` — Voucher đã cấp cho khách

Hiện tại là mảng rỗng `[]`, phục vụ tính năng voucher cá nhân hóa trong tương lai.

| Trường            | Kiểu       | Ghi chú                            |
| :------------------ | :---------- | :---------------------------------- |
| `customer_id`     | `Number`  | Khóa ngoại →`b2c_customers.id` |
| `voucher_tier_id` | `Number`  | Khóa ngoại →`voucher_tiers.id` |
| `issued_at`       | `String`  | Ngày cấp                          |
| `used_at`         | `String?` | Ngày sử dụng                     |

---

# PHẦN 2 — ClickHouse (`analytics` database)

Dữ liệu phân tích lớn, time-series. Đây là nơi cần mock **hàng triệu dòng**.

---

## 2.1 `analytics.sale_orders` — Đơn hàng (chi tiết theo sản phẩm)

> [!TIP]
> Engine `ReplacingMergeTree(created_at)`, Partition theo `toYYYYMM(order_date)`.
> Mỗi **đơn hàng** có thể có nhiều dòng (1 dòng = 1 sản phẩm trong đơn).

| Trường             | Kiểu             | Mặc định | Ghi chú / Giá trị hợp lệ                                                                                                            |
| :------------------- | :---------------- | :---------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `order_id`         | `String`        |             | VD:`'ORD0000001'`. Nhiều dòng cùng `order_id` = nhiều sản phẩm cùng đơn                                                     |
| `branch_id`        | `String`        |             | **Phải khớp** với `branches.id` trong db.json: `HN001`, `HN002`, `HN003`, `HCM001`, `HCM002`, `HCM003`, `DN001` |
| `branch_name`      | `String`        |             | Tên chi nhánh tương ứng                                                                                                             |
| `region`           | `String`        |             | `'NORTH'`, `'SOUTH'`, `'CENTRAL'`                                                                                                  |
| `salesperson_id`   | `String`        |             | VD:`'EMP001'` đến `'EMP020'`                                                                                                       |
| `customer_id`      | `String`        |             | VD:`'CUS00001'` đến `'CUS00500'`                                                                                                   |
| `product_id`       | `String`        |             | VD:`'IP15PM'`, `'MBA13M3'`, ... (xem danh sách bên dưới)                                                                         |
| `product_name`     | `String`        |             | Tên sản phẩm tương ứng                                                                                                             |
| `product_category` | `String`        |             | `'iPhone'`, `'Mac'`, `'iPad'`, `'Accessories'`, `'Watch'`                                                                      |
| `quantity`         | `Int32`         | `1`       | Thường là 1 cho sản phẩm công nghệ cao cấp                                                                                       |
| `unit_price`       | `Decimal(18,2)` |             | Đơn giá                                                                                                                               |
| `total_amount`     | `Decimal(18,2)` |             | `quantity × unit_price`                                                                                                               |
| `discount`         | `Decimal(18,2)` | `0`       | Số tiền giảm giá                                                                                                                     |
| `net_amount`       | `Decimal(18,2)` |             | `total_amount - discount`                                                                                                              |
| `status`           | `String`        |             | `'CONFIRMED'` (80%), `'VOIDED'` (15%), `'PENDING'` (3%), `'REFUNDED'` (2%)                                                       |
| `payment_method`   | `String`        |             | `'CASH'`, `'CARD'`, `'TRANSFER'`, `'MOMO'`, `'VNPAY'`                                                                          |
| `order_date`       | `DateTime64(3)` |             | Định dạng:`'YYYY-MM-DD HH:mm:ss.mmm'` (Timezone VN)                                                                                 |
| `created_at`       | `DateTime64(3)` | `now()`   | Thường bằng`order_date` khi mock                                                                                                    |
| `_cdc_op`          | `String`        | `'c'`     | `'c'` (create), `'u'` (update), `'d'` (delete)                                                                                     |

**Danh sách sản phẩm chuẩn để mock:**

| `product_id` | `product_name`        | `product_category` | Giá gợi ý |
| :------------- | :---------------------- | :------------------- | :----------- |
| `IP15PM`     | iPhone 15 Pro Max 256GB | iPhone               | 33,990,000   |
| `IP15P`      | iPhone 15 Pro 128GB     | iPhone               | 27,990,000   |
| `IP15`       | iPhone 15 128GB         | iPhone               | 22,990,000   |
| `MBA13M3`    | MacBook Air M3 13"      | Mac                  | 27,990,000   |
| `MBP14M3`    | MacBook Pro M3 Pro 14"  | Mac                  | 49,990,000   |
| `IPADPRO11`  | iPad Pro 11" M4         | iPad                 | 28,990,000   |
| `APPRO`      | AirPods Pro 2nd Gen     | Accessories          | 6,190,000    |
| `AW9PRO`     | Apple Watch Series 9    | Watch                | 11,990,000   |

---

## 2.2 `analytics.input_vouchers` — Phiếu thu

| Trường         | Kiểu             | Mặc định | Ghi chú                                                                        |
| :--------------- | :---------------- | :---------- | :------------------------------------------------------------------------------ |
| `voucher_id`   | `String`        |             | VD:`'IV0000001'`                                                              |
| `order_id`     | `String`        |             | Khóa ngoại →`sale_orders.order_id`. 88% đơn CONFIRMED có phiếu thu     |
| `branch_id`    | `String`        |             | Phải khớp với`sale_orders.branch_id`                                       |
| `amount`       | `Decimal(18,2)` |             | Thường ≈`net_amount` của đơn hàng                                      |
| `voucher_date` | `DateTime64(3)` |             | Thường trong vòng 1h sau`order_date`                                       |
| `payment_type` | `String`        |             | Giống`payment_method`: `CASH`, `CARD`, `TRANSFER`, `MOMO`, `VNPAY` |
| `note`         | `String`        | `''`      | Ghi chú tùy ý                                                                |
| `created_at`   | `DateTime64(3)` | `now()`   |                                                                                 |

---

## 2.3 `analytics.output_vouchers` — Phiếu chi

| Trường         | Kiểu             | Mặc định | Ghi chú                                                                                                        |
| :--------------- | :---------------- | :---------- | :-------------------------------------------------------------------------------------------------------------- |
| `voucher_id`   | `String`        |             | VD:`'OV0000001'`                                                                                              |
| `order_id`     | `String`        | `''`      | Chỉ có khi`category = 'REFUND'` hoặc `'COGS'`. Ngược lại để rỗng                                   |
| `branch_id`    | `String`        |             | Chi nhánh phát sinh chi phí                                                                                  |
| `amount`       | `Decimal(18,2)` |             | Số tiền chi (VNĐ)                                                                                            |
| `voucher_date` | `DateTime64(3)` |             | Ngày lập phiếu                                                                                               |
| `category`     | `String`        |             | `'COGS'` (giá vốn), `'EXPENSE'` (chi phí vận hành), `'SALARY'` (lương), `'REFUND'` (hoàn tiền) |
| `note`         | `String`        | `''`      | Ghi chú                                                                                                        |
| `created_at`   | `DateTime64(3)` | `now()`   |                                                                                                                 |

> [!TIP]
> Hệ thống dùng bảng này để tính **SLA Fulfillment**: đơn hàng nào có `output_voucher.category = 'COGS'` được coi là đã xuất kho/giao hàng.

---

## 2.4 `analytics.alert_events` — Sự kiện cảnh báo gian lận

| Trường            | Kiểu                    | Mặc định | Ghi chú                                                                                    |
| :------------------ | :----------------------- | :---------- | :------------------------------------------------------------------------------------------ |
| `alert_id`        | `String`               |             | VD:`'ALT001'`                                                                             |
| `rule_name`       | `String`               |             | `'HIGH_VOID_RATE'`, `'REVENUE_ANOMALY'`, `'RECON_OVERDUE'`, `'HIGH_DISCOUNT_RATIO'` |
| `branch_id`       | `String`               |             | Chi nhánh hoặc`'ALL'`                                                                   |
| `severity`        | `String`               |             | `'LOW'`, `'MEDIUM'`, `'HIGH'`, `'CRITICAL'`                                         |
| `message`         | `String`               |             | Mô tả cảnh báo bằng tiếng Việt                                                       |
| `details`         | `String`               | `'{}'`    | JSON string chứa thông tin chi tiết                                                      |
| `triggered_at`    | `DateTime64(3)`        | `now()`   | Thời điểm kích hoạt                                                                    |
| `acknowledged`    | `UInt8`                | `0`       | `0` (chưa xử lý), `1` (đã xử lý)                                                 |
| `acknowledged_by` | `String`               | `''`      | Email/tên người xử lý                                                                  |
| `acknowledged_at` | `Nullable(DateTime64)` | `NULL`    | Thời điểm xử lý                                                                        |

---

# PHẦN 3 — Hướng dẫn Mock Data

## Thứ tự thực hiện (quan trọng!)

```
1. db.json (LowDB) trước:  branches → brands → categories → products
2. ClickHouse sau:          sale_orders → input_vouchers → output_vouchers → alert_events
```

> [!IMPORTANT]
> Giá trị `branch_id` **phải nhất quán** giữa db.json và ClickHouse.
> Danh sách 7 chi nhánh sau đây dùng trong cả 2 hệ thống:
> `HN001`, `HN002`, `HN003`, `HCM001`, `HCM002`, `HCM003`, `DN001`

## Tỷ lệ phân bố dữ liệu gợi ý

```
sale_orders:
  - status: CONFIRMED 80% | VOIDED 15% | PENDING 3% | REFUNDED 2%
  - payment_method: CASH 30% | CARD 25% | MOMO 20% | VNPAY 15% | TRANSFER 10%
  - order_date: trải đều 2 năm gần nhất (để có đủ partition)
  
input_vouchers:
  - Tạo cho 88% đơn CONFIRMED (để có một số đơn "PENDING" reconciliation)
  
output_vouchers:
  - COGS: ~60% (mỗi đơn CONFIRMED nên có 1 COGS để SLA hoạt động đúng)
  - EXPENSE: ~20%
  - SALARY: ~15%
  - REFUND: ~5% (kèm order_id tương ứng)

alert_events:
  - Khoảng 100–500 bản ghi, rải trong 30 ngày gần nhất
  - ~70% acknowledged = 0 (chưa xử lý)
```

## Lệnh import CSV nhanh vào ClickHouse

```bash
# Import sale_orders từ file CSV
cat mock_sale_orders.csv | docker exec -i istore_clickhouse \
  clickhouse-client --query="INSERT INTO analytics.sale_orders FORMAT CSV"

# Import với JSON (linh hoạt hơn)
cat mock_sale_orders.jsonl | docker exec -i istore_clickhouse \
  clickhouse-client --query="INSERT INTO analytics.sale_orders FORMAT JSONEachRow"
```

## Kiểm tra sau khi import

```sql
-- Kiểm tra số lượng
SELECT count() FROM analytics.sale_orders;
SELECT count() FROM analytics.input_vouchers;

-- Kiểm tra phân bố theo tháng
SELECT toYYYYMM(order_date) as month, count() as cnt
FROM analytics.sale_orders
GROUP BY month ORDER BY month;

-- Kiểm tra theo chi nhánh
SELECT branch_id, count(), sum(net_amount)
FROM analytics.sale_orders
WHERE status = 'CONFIRMED'
GROUP BY branch_id;
```
