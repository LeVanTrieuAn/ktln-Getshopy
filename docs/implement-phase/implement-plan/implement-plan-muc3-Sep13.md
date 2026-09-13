# Implement Plan — Mục 3: Thông luồng Ecommerce → BigData

> Ngày: 13/09/2026 · Nguồn: [checklist](../checklists/checklists-phase1-Sep13.md) mục 3
> Tiền đề: mục 2 đã xong ([results.md](../results/results.md))

---

## 0. Hiện trạng — cái gì đã có, cái gì chưa

### Đã có sẵn trong `local-infra-sandbox`

| | |
|---|---|
| Compose | zookeeper, kafka, kafka-connect, minio, clickhouse-local, metabase, postgres-mock-source |
| Connector | Debezium source + S3 sink (JSON đã sửa trỏ `public.Order,public.OrderItem`) |
| dbt | **13 models** theo kiến trúc medallion: staging → transformation → warehouse → serving, kèm audit checksum |

Kiến trúc dbt hiện tại:
```
staging/        stg_orders, stg_order_details, stg_outputvoucher_detail   (view, đọc s3())
transformation/ orders_dedup, orders_detail_dedup                          (view)
warehouse/      dim_orders, fact_order_details                             (incremental)
serving/        daily_orders_summary, order_details_summary                (table)
audit/          checksum_all / hourly / escalation / watermark_preflight   (table)
```

### Bốn thứ chặn đường

| # | Vấn đề | Ảnh hưởng |
|---|---|---|
| **1** | `wal_level = replica` trên Postgres Getshopy | Debezium **không tạo được** replication slot → không có gì chảy |
| **2** | Hai stack khác network | Getshopy ở `getshopy_default` (postgres = 172.20.0.2), sandbox ở `data-net` → kafka-connect **không resolve** được hostname `postgres` |
| **3** | dbt models viết cho schema **MOCK** | `tupleElement(after, N)` theo **vị trí cột** của `app_sales.orders`; schema `"Order"` mới khác hoàn toàn → mọi cột sai |
| **4** | Path glob sai | staging tìm `year=*/month=*/day=*/**hour=***/*.parquet` nhưng sink config `path.format` chỉ tạo `year/month/day` → **không khớp file nào** |

---

## 1. `wal_level = logical`

**Ai làm: agent làm được**, nhưng phải **restart Postgres** (dữ liệu giữ nguyên,
nằm trong volume; chỉ mất kết nối vài giây).

Thêm vào service `postgres` của Getshopy:
```yaml
command:
  - postgres
  - -c
  - wal_level=logical
  - -c
  - max_replication_slots=4
  - -c
  - max_wal_senders=4
```

Kiểm tra sau khi restart:
```sql
SHOW wal_level;                          -- phải ra 'logical'
SELECT * FROM pg_replication_slots;      -- Debezium sẽ tự tạo getshopy_cdc_slot
```

⚠️ Thiếu bước này thì Debezium báo lỗi khi đăng ký connector, **không phải lúc
chạy** — nên dễ tưởng connector đã OK.

---

## 2. Nối network giữa hai stack

Ba cách, chọn theo thời điểm:

| Cách | Khi nào | Đánh đổi |
|---|---|---|
| **A. Gộp một compose** | Khi revamp (đã định làm) | Sạch nhất, một network, một `.env`. Phải giải quyết trùng cổng và trùng vai (2 Postgres, 2 ClickHouse) |
| **B. External network** | Muốn thử ngay, giữ 2 compose | Sandbox khai `getshopy_default` là `external: true`; kafka-connect resolve được `postgres`. Ít thay đổi nhất |
| **C. `host.docker.internal:5432`** | Chỉ để thử nhanh | Postgres đã expose `5432:5432`. Chạy được ngay nhưng đi vòng qua host, không dùng cho thật |

Khuyến nghị: **B để thử luồng trước**, rồi **A khi gộp**.

Với cách A, các quyết định đã chốt 13/09:
- **Một** Postgres — bỏ `postgres-mock-source`, CDC trỏ thẳng `getshopy`
- **Một** ClickHouse — giữ `clickhouse-local`, version lấy `24.8` (Getshopy đang dùng, sandbox `23.8`)
- Metabase `3000 → 3001` (đã sửa), ClickHouse TCP `9000 → 9010` (đụng MinIO)

---

## 3. Mapping schema: mock → thật

Đây là phần nặng nhất. Schema khác hoàn toàn.

### `orders` (mock) → `"Order"` (thật)

| Mock | Thật | Ghi chú |
|---|---|---|
| `id` | `id` (String `ORD-...`) | mock dùng số, thật dùng chuỗi |
| `customer_id` | `customer_id` (BigInt, **nullable**) | |
| `total_amount` (numeric) | `total` (**Int, đơn vị đồng**) | mock có phần lẻ, thật không |
| `status` | `status` | giá trị khác: PENDING_PAYMENT/CONFIRMED/SHIPPING/DELIVERED/CANCELLED |
| `created_at` | `date` | |
| `updated_at` | — | **không có** — cần cho watermark của checksum |
| — | `payment_method`, `payment_status`, `paid_at`, `paid_amount` | **mới**, mart_revenue cần |
| — | `discount`, `shippingFee`, `subTotal` | **mới** |

### `orders_detail` (mock) → `"OrderItem"` (thật)

| Mock | Thật |
|---|---|
| `detail_id` | `id` |
| `order_id` | `order_id` |
| `product_id` | `product_id` |
| `quantity` | `quantity` |
| `price` | `unit_price` |
| — | `product_name`, `category_id`, `brand_id`, `branch_id`, `variant_id`, `discount`, `net_amount` |

⚠️ **Thiếu `updated_at`.** Checksum hiện dùng `max(updated_at)` làm watermark.
Hai lựa chọn: thêm cột `updated_at` vào `Order` (khuyến nghị — CDC cũng cần để
biết bản ghi nào mới), hoặc đổi watermark sang `date`.

---

## 4. ClickHouse staging — view đọc thẳng MinIO

Giữ đúng cách hiện tại: **không** tạo bảng vật lý, dùng `s3()` table function
trong một `view`. Dữ liệu nằm ở MinIO, ClickHouse chỉ đọc khi query.

### 4.1 Sửa path glob

```sql
-- SAI (hiện tại): sink không tạo thư mục hour
'.../topics/cdc_prod.public.orders/year=*/month=*/day=*/hour=*/*.parquet'

-- ĐÚNG: khớp path.format của sink
'.../topics/cdc_prod.public.Order/year=*/month=*/day=*/*.parquet'
```

Tên topic đổi theo bảng: `cdc_prod.public.Order`, `cdc_prod.public.OrderItem`
— **có chữ hoa**, vì Prisma tạo bảng PascalCase có quote.

### 4.2 Bỏ `tupleElement` theo vị trí

Hiện tại:
```sql
ifNull(tupleElement(after, 1), tupleElement(before, 1)) AS order_id
```

Truy cập theo **vị trí** rất giòn: thêm/bớt/đổi thứ tự một cột trong Postgres là
mọi model lệch hết, và **không có lỗi nào báo ra** — chỉ là số liệu sai.

Đổi sang **tên trường**:
```sql
ifNull(tupleElement(after, 'id'), tupleElement(before, 'id')) AS order_id
```

Parquet do Debezium sinh có named struct nên ClickHouse đọc thành named tuple,
truy cập bằng tên được.

### 4.3 Cấu trúc envelope Debezium

Mỗi bản ghi parquet có: `before`, `after`, `op`, `ts_ms`, `source`.

| `op` | Nghĩa |
|---|---|
| `c` | create — `after` có dữ liệu |
| `u` | update — cả `before` và `after` |
| `d` | delete — chỉ `before` |
| `r` | read (snapshot ban đầu) |

Nên `ifNull(after, before)` và cờ `is_deleted = if(op='d', 1, 0)` như model hiện
tại là đúng, chỉ cần đổi cách lấy trường.

### 4.4 Model staging mới

```
stg_orders.sql       <- cdc_prod.public.Order
stg_order_items.sql  <- cdc_prod.public.OrderItem   (đổi tên từ stg_order_details)
```

Cột cần lấy ở `stg_orders`: `order_id, customer_id, total, subTotal, discount,
shippingFee, status, payment_method, payment_status, paid_at, date, event_ts,
is_deleted`.

---

## 5. dbt models

### 5.1 Tầng transformation — khử trùng lặp

Giữ nguyên ý tưởng `orders_dedup` / `orders_detail_dedup`: CDC sinh nhiều bản
ghi cho cùng một hàng (mỗi lần UPDATE một dòng), phải lấy bản mới nhất theo
`event_ts` và loại bản đã xoá.

```sql
SELECT * FROM (
  SELECT *, row_number() OVER (PARTITION BY order_id ORDER BY event_ts DESC) AS rn
  FROM {{ ref('stg_orders') }}
) WHERE rn = 1 AND is_deleted = 0
```

### 5.2 Ba bảng đích (checklist mục 3.4)

#### `fact_orders_detail` — grain: một dòng / một `OrderItem`

Sửa từ `fact_order_details` hiện có. Đổi `od.price → od.unit_price`,
`o.total_amount → o.total`, bổ sung các cột mới:

```sql
SELECT
    oi.item_id, oi.order_id, o.customer_id,
    oi.product_id, oi.product_name,          -- snapshot, KHÔNG join Product
    oi.category_id, oi.brand_id, oi.branch_id,
    oi.quantity, oi.unit_price, oi.discount, oi.net_amount,
    o.total AS order_total, o.status AS order_status,
    o.payment_method, o.payment_status,       -- MỚI, mart_revenue cần
    o.date AS order_date, o.paid_at,
    oi._ingested_at
FROM {{ ref('order_items_dedup') }} oi
LEFT JOIN {{ ref('orders_dedup') }} o ON oi.order_id = o.order_id
```

**Không join sang `Product` để lấy tên/giá** — `OrderItem` đã snapshot sẵn. Join
bảng hiện tại làm doanh thu lịch sử đổi theo giá hôm nay.

#### `mart_revenue` — doanh thu tổng hợp

Grain đề xuất: ngày × danh mục × thương hiệu × phương thức thanh toán.

```sql
SELECT
    toDate(order_date)                AS revenue_date,
    category_id, brand_id, payment_method,
    count(DISTINCT order_id)          AS orders,
    sum(quantity)                     AS units,
    sum(net_amount)                   AS gross_revenue,
    sumIf(net_amount, payment_status = 'PAID')     AS paid_revenue,
    sumIf(net_amount, order_status = 'CANCELLED')  AS cancelled_value
FROM {{ ref('fact_orders_detail') }}
GROUP BY revenue_date, category_id, brand_id, payment_method
```

Phân biệt **gross** và **paid** quan trọng: đơn `PENDING_PAYMENT` và `CANCELLED`
không phải doanh thu thật. Dashboard admin nên đọc `paid_revenue`.

#### `processed_data_for_AI_rec` — viết riêng cho AI-rec

Đã đọc code AI-rec ([cf_recommendation.py](../../../ktln-Getshopy/qu-n-ly-ban-l/source/ai-rec/models/cf_recommendation.py)):
nó đọc CSV và gom `df.groupby(["CustomerID","ProductID"])["Quantity"].sum()` để
dựng ma trận user-item cho collaborative filtering item-based.

**Cột bắt buộc: `CustomerID`, `ProductID`, `Quantity`** (đúng tên, phân biệt hoa
thường). Metadata tuỳ chọn: `products.csv` (`ProductID`…), `customers.csv`
(`CustomerID`…).

```sql
SELECT
    toString(customer_id) AS CustomerID,
    toString(product_id)  AS ProductID,
    sum(quantity)         AS Quantity
FROM {{ ref('fact_orders_detail') }}
WHERE customer_id IS NOT NULL           -- khách vãng lai không dùng cho CF
  AND order_status NOT IN ('CANCELLED')
  AND payment_status IN ('PAID')        -- chỉ tính giao dịch thật
GROUP BY CustomerID, ProductID
HAVING Quantity > 0
```

Quy tắc tiền xử lý phải nêu trong báo cáo:
- **Loại đơn huỷ và chưa thanh toán** — nhiễu, không phản ánh sở thích thật
- **Loại khách vãng lai** (`customer_id IS NULL`) — không có định danh để học
- **Gộp theo cặp (khách, sản phẩm)** — mua nhiều lần = tín hiệu mạnh hơn
- Cân nhắc **lọc khách/sản phẩm quá ít tương tác** (cold start) trước khi train

⚠️ AI-rec hiện đọc **CSV từ file**, không đọc ClickHouse. Cần một bước xuất:
`clickhouse-client --query "SELECT ... FORMAT CSVWithNames" > data/raw/sales.csv`
chạy theo lịch, hoặc sửa AI-rec đọc thẳng ClickHouse. **Cần chốt.**

### 5.3 Checksum (mục 3.5)

Models `checksum_*` đã có, sửa lại cho schema mới:

| Tầng | Nguồn | Đo gì |
|---|---|---|
| `src` | `postgresql()` table function → `"Order"` | `count()`, `sum(total)`, watermark |
| `stg` | `stg_orders` (s3 parquet) | như trên |
| `wh` | `fact_orders_detail` | như trên |

Ba con số phải khớp. Lệch nghĩa là mất bản ghi ở đâu đó giữa CDC → MinIO → dbt.

Thêm các kiểm tra dbt test chuẩn:
- `unique` + `not_null` trên khoá
- `relationships`: mọi `OrderItem.order_id` phải tồn tại trong `Order`
- `accepted_values` cho `payment_status`, `status`
- Tổng `sum(net_amount)` theo đơn phải bằng `subTotal` của đơn đó

---

## 6. Secrets — phải xử lý trước khi push

| File | Vấn đề |
|---|---|
| `dbt_warehouse/config/vars.yml` | Password ClickHouse + MinIO **plaintext** |
| `dbt_warehouse/profiles.yml` | Password mặc định trong template, prod hardcode IP `10.1.24.241` |
| `local-infra-sandbox/.env` | Password Postgres/ClickHouse/MinIO plaintext, **thư mục chưa có `.gitignore`** |

Chuyển hết sang `env_var()` — dbt hỗ trợ sẵn, `dbt_project.yml` đã dùng cho MinIO.

---

## 7. Thứ tự thực hiện

| Bước | Việc | Phụ thuộc |
|---|---|---|
| **3.1** | `wal_level=logical` + restart Postgres | — |
| **3.2** | Nối network (cách B: external network) | — |
| **3.3** | Dựng sandbox, đăng ký 2 connector | 3.1, 3.2 |
| **3.4** | Kiểm parquet đã lên MinIO chưa | 3.3 |
| **3.5** | Sửa staging views: path glob + tên trường + tên topic | 3.4 |
| **3.6** | Sửa transformation dedup | 3.5 |
| **3.7** | `fact_orders_detail` | 3.6 |
| **3.8** | `mart_revenue` + `processed_data_for_AI_rec` | 3.7 |
| **3.9** | Checksum 3 tầng + dbt test | 3.7 |
| **3.10** | Trỏ dashboard admin sang `mart_revenue` | 3.8 |
| **3.11** | Kéo masterdata (users, products, brands, category) lên ClickHouse — checklist mục 3.3 | 3.3 |

Bước **3.4 là điểm kiểm tra quan trọng nhất**: nếu parquet không lên MinIO thì
mọi thứ phía sau vô nghĩa, và lỗi thường nằm ở `wal_level` hoặc network chứ
không phải ở dbt.

---

## 8. Rủi ro đã biết

| Rủi ro | Ghi chú |
|---|---|
| Tên bảng PascalCase | `public.Order` — viết sai hoa/thường thì Debezium **im lặng** không bắt bảng nào |
| `Order.customer` là `Json` | Debezium đẩy nguyên chuỗi JSON; nếu cần tách thì dùng `JSONExtractString` ở staging |
| Tiền là `Int` đồng | ClickHouse `analytics.sale_orders` cũ khai `Decimal(18,2)` → phải cast tường minh khi so sánh hai nguồn |
| Múi giờ | Postgres lưu UTC, ClickHouse khai `Asia/Ho_Chi_Minh` → báo cáo theo ngày lệch ở ranh giới nửa đêm |
| `flush.size: 1000` / `rotate.interval.ms: 20000` | Dev ít đơn thì file parquet lâu mới đóng — giảm xuống để test cho nhanh |
| Bảng `analytics.sale_orders` cũ | Dashboard admin đang đọc nó và nó **rỗng** từ lúc gỡ dual-write. Sau 3.10 thì bỏ hẳn |
