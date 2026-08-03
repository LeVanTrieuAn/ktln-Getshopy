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
