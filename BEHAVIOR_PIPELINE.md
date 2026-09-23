# Behavior Data Pipeline — Kiểm tra & Tài liệu đầy đủ

> **Ngày kiểm tra:** 2026-09-23  
> **Môi trường:** Docker Compose local (kltn)  
> **Mục đích:** Xác minh luồng dữ liệu hành vi người dùng từ FE đến AI Rec

---

## 1. Kết quả kiểm tra thực tế (Snapshot)

### 1.1 PostgreSQL — Bảng liên quan đến Behavior

| Bảng | Số dòng | Dữ liệu mới nhất | Trạng thái |
|---|---|---|---|
| **Wishlist** | 2 | 2026-09-21 03:32:47 | ✅ Đang nhận dữ liệu |
| **Review** | 1 | 2026-09-21 07:38:52 | ✅ Đang nhận dữ liệu |
| **Order** | 3 | 2026-09-21 07:54:54 | ✅ Đang nhận dữ liệu |
| **OrderItem** | 4 | — | ✅ Đang nhận dữ liệu |
| **ChatLog** | 3 | 2026-09-20 13:49:01 | ✅ Đang nhận dữ liệu |
| **LoyaltyTransaction** | 0 | — | ⚠️ Chưa có dữ liệu |
| **StockReservation** | 4 | 2026-09-21 07:54:54 | ✅ Đang nhận dữ liệu |

### 1.2 ClickHouse `analytics.user_events` — Events tracking trực tiếp

| Event Type | Số events | Event mới nhất |
|---|---|---|
| `category_view` | 59 | 2026-09-23 05:44:26 |
| `product_view` | 37 | 2026-09-23 05:41:29 |
| `add_to_cart` | 16 | 2026-09-21 07:40:59 |
| `search_query` | 11 | 2026-09-21 07:39:13 |
| `purchase` | 4 | 2026-09-21 07:54:54 |
| `review_submit` | 1 | 2026-09-21 07:38:52 |
| `add_to_wishlist` | 0 | — |
| **TOTAL** | **128** | **2026-09-23** |

> [!NOTE]
> `add_to_wishlist` = 0 vì handler chỉ mới được thêm `trackAddToWishlist()` — sẽ có dữ liệu sau khi user thao tác lại.

### 1.3 ClickHouse — Các bảng còn lại

| Bảng | Engine | Số dòng | Trạng thái |
|---|---|---|---|
| `analytics.user_events` | MergeTree | 128 | ✅ Đang nhận |
| `analytics.sale_orders` | ReplacingMergeTree | 0 | ❌ CDC chưa chạy |
| `analytics.input_vouchers` | ReplacingMergeTree | 0 | ❌ CDC chưa chạy |
| `analytics.output_vouchers` | ReplacingMergeTree | 0 | ❌ CDC chưa chạy |
| `analytics.alert_events` | MergeTree | 0 | ❌ Chưa có dữ liệu |

### 1.4 Trạng thái toàn bộ pipeline

| Thành phần | Trạng thái | Ghi chú |
|---|---|---|
| Kafka Connect (Debezium CDC) | ❌ **0 connector** | Không có connector nào đăng ký |
| dbt scheduler | ❌ **Lỗi liên tục** | `kltn-dbt:latest` image không tồn tại |
| `serving` database (ClickHouse) | ❌ **Chưa tồn tại** | dbt chưa chạy thành công lần nào |
| `analytics.user_events` | ✅ **Đang nhận** | Direct write từ BehaviorService |
| Postgres → Kafka → ClickHouse | ❌ **Đứt đoạn** | Kafka Connect không có connector |

---

## 2. Chi tiết dữ liệu Behavior trong PostgreSQL

### 2.1 Wishlist (2 records)

```
id=3 | customer_id=7 | product_id=3 | Điện thoại Xiaomi Redmi Note 17 | brand: br-xiaomi | cat: cat-phone | 2026-09-21
id=1 | customer_id=7 | product_id=600000 | Micro thu âm RAZER Seiren V3 Mini | brand: br-razer | cat: cat-av-mic | 2026-09-21
```

**Cơ chế:** User click nút ♥ trong `ProductDetail` → `POST /api/b2c/wishlist` → toggle vào `Wishlist` table.  
**Đặc biệt:** Wishlist lưu trong Postgres; đồng thời fire event `add_to_wishlist` vào ClickHouse qua hook FE `trackAddToWishlist()`.

### 2.2 Review (1 record)

```
id=REV-1789976332456 | product_id=300013 | reviewer=Khách hàng | rating=3 | comment=hay
product: Chân đế máy chiếu Wanbo Small - Màu Đen | product.rating=3 (đã tự động cập nhật)
```

**Cơ chế:**
1. User submit form review → `POST /api/b2c/products/:id/reviews`
2. BE tạo `Review` record
3. **[Mới fix]** BE tính `AVG(Review.rating)` → cập nhật `Product.rating` ngay lập tức
4. FE fire event `review_submit` vào ClickHouse (rating=3)

### 2.3 Order + OrderItem (3 orders, 4 items)

```
ORD-1789977294405 | customer=8 | 30,041,000₫ | CONFIRMED | COD | UNPAID
  └── Audio-Technica Tai Plus - 599993 | qty=1 | 30,021,000₫ | cat: cat-av-wire-earphone | brand: br-audio-technica

ORD-1789976399188 | customer=8 | 40,606,000₫ | CANCELLED | BANK_TRANSFER | EXPIRED
  ├── iPhone 15 128GB | qty=1 | 16,093,000₫ | cat: cat-phone
  └── iPhone 15 Pro Max 256GB | qty=1 | 24,493,000₫ | cat: cat-phone

ORD-1789912986943 | customer=7 | 8,686,000₫ | CANCELLED | BANK_TRANSFER | EXPIRED
  └── AirPods Pro (2nd gen) | qty=2 | 4,333,000₫/cái | cat: cat-laptop-acc-bag
```

> [!WARNING]
> `ORD-1789912986943` có `category_id=cat-laptop-acc-bag` cho AirPods — đây là dữ liệu **giả/test**, không phản ánh phân loại đúng. Category của OrderItem là snapshot tại thời điểm mua.

### 2.4 ChatLog (3 records — tất cả anonymous)

```
session=172.22.0.11 | "tôi muốn mua điện thoại" | intent=SEARCH_PRODUCT | score=0.92 | source=rule
session=172.22.0.11 | "tôi muốn mua màn hình" | intent=ASK_DISPLAY | score=0.9 | source=rule
session=172.22.0.11 | "màn hình máy tính" | intent=ASK_DISPLAY | score=0.9 | source=rule
```

**Cơ chế:** Chatbot ghi log → `ChatLog` table. Phục vụ 2 mục đích:
- Admin analytics (theo dõi intent phổ biến)
- Fine-tune dataset (cột `is_annotated`, `corrected_intent`, `is_trained`)

### 2.5 LoyaltyTransaction (0 records)

**Lý do chưa có:** 2 trong 3 đơn hàng bị CANCELLED/EXPIRED — loyalty points chỉ được ghi khi đơn DELIVERED. Đơn CONFIRMED (COD) chưa được giao → chưa trigger loyalty.

---

## 3. Luồng Behavior đầy đủ: FE → BE → DB → ClickHouse → AI Rec

### 3.1 Sơ đồ tổng thể

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                              │
│                                                                      │
│  useTracking.js (hook)          useProductViewTracker               │
│  ┌─────────────────────────┐    ┌───────────────────────────────┐  │
│  │ buffer[] max 20 events  │    │ track dwell_time + scroll_pct │  │
│  │ flush every 5s          │    │ fire product_view on unmount  │  │
│  │ beforeunload → sendBeacon│   └───────────────────────────────┘  │
│  └────────────┬────────────┘                                        │
│               │ POST /api/b2c/track                                  │
└───────────────┼─────────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────────────┐
│                      BACKEND (Node.js)                               │
│                                                                      │
│  routes/tracking.js                services/BehaviorService.js      │
│  POST /api/b2c/track          →    trackEvents(events)              │
│                                    └─ validate & sanitize           │
│                                    └─ _eventBuffer[] max 50         │
│                                    └─ flush to ClickHouse every 5s  │
│                                                                      │
│  POST /api/b2c/wishlist       →    Wishlist (Postgres)              │
│                                    ← toggle add/remove              │
│                                                                      │
│  POST /products/:id/reviews   →    Review (Postgres)                │
│                                    └─ UPDATE Product.rating = AVG   │
│                                                                      │
│  POST /api/b2c/checkout       →    Order + OrderItem (Postgres)     │
│                                    StockReservation (Postgres)      │
│                                                                      │
│  Chatbot routes               →    ChatLog (Postgres)               │
│                                                                      │
│  Order DELIVERED              →    LoyaltyTransaction (Postgres)    │
└──────────────┬───────────────────────────────────────────────────────┘
               │
   ┌───────────┴────────────────────────────────────────────┐
   │                                                        │
   ▼ Direct write (async_insert)                           ▼ CDC via Debezium (❌ chưa hoạt động)
┌────────────────────────┐                       ┌─────────────────────────────────┐
│  ClickHouse            │                       │  Kafka / Kafka Connect          │
│  analytics.user_events │                       │  (Debezium PostgreSQL Connector)│
│  128 rows ✅           │                       │  ❌ 0 connectors registered     │
└────────────┬───────────┘                       └────────────────┬────────────────┘
             │                                                    │ (chưa chảy)
             │                                                    ▼
             │                                   ┌───────────────────────────────┐
             │                                   │  ClickHouse                   │
             │                                   │  analytics.sale_orders (0)    │
             │                                   │  analytics.input_vouchers (0) │
             │                                   │  analytics.output_vouchers (0)│
             │                                   └───────────────────────────────┘
             │
             ▼ dbt-core transform (mỗi 5 phút — ❌ lỗi image)
┌───────────────────────────────────────────────────────┐
│  serving.processed_data_for_AI_rec (❌ chưa tồn tại)  │
│  serving.fact_order_detail (❌ chưa tồn tại)          │
│  serving.mart_revenue (❌ chưa tồn tại)               │
└──────────────────────────────────────────────────────┘
             │
             ▼ (AI Rec đọc qua HTTP)
┌──────────────────────────┐
│  ai-rec service          │
│  GET /recommend/:user_id │
│  ✅ Container running    │
└──────────────────────────┘
```

### 3.2 Luồng từng loại Event

#### 🔵 Tầng 1 — Browse (Implicit, nhẹ)

| Action của User | FE | BE | Storage |
|---|---|---|---|
| Mở trang danh mục | `trackCategoryView(categoryId)` | `POST /track` | `user_events` (weight=0.5) |
| Gõ tìm kiếm | `trackSearchQuery(query, count)` | `POST /track` | `user_events` (weight=1.5) |
| Xem chi tiết SP (≥1 giây) | `useProductViewTracker` auto | `POST /track` | `user_events` (weight=1) + dwell_time + scroll |

#### 🟡 Tầng 2 — Engage (Explicit, trung bình)

| Action của User | FE | BE | Storage |
|---|---|---|---|
| Click ♥ (add wishlist) | `trackAddToWishlist(product)` | `POST /track` + `POST /wishlist` | `user_events` (weight=2) + **Wishlist (Postgres)** |
| Click ♥ (remove wishlist) | *(không track)* | `POST /wishlist` | **Wishlist** xóa record |
| Thêm vào giỏ | `trackAddToCart(product, qty)` | `POST /track` | `user_events` (weight=3) |
| Xóa khỏi giỏ | `trackRemoveFromCart(product)` | `POST /track` | `user_events` (weight=-1) |
| So sánh sản phẩm | `trackCompareView(ids)` | `POST /track` | `user_events` (weight=1.5) |
| Gửi chatbot | *(tự động)* | Chatbot route | **ChatLog (Postgres)** |

#### 🔴 Tầng 3 — Convert (Strongest signal)

| Action của User | FE | BE | Storage |
|---|---|---|---|
| Đặt hàng thành công | `trackPurchase(items)` | `POST /track` | `user_events` (weight=5) |
| | | `POST /checkout` | **Order + OrderItem + StockReservation (Postgres)** |
| Submit đánh giá | `trackReviewSubmit(id, rating)` | `POST /track` | `user_events` (weight=4) |
| | | `POST /products/:id/reviews` | **Review (Postgres)** + cập nhật `Product.rating` |
| Đơn được giao (DELIVERED) | *(server-side)* | Order status update | **LoyaltyTransaction (Postgres)** |

---

## 4. Schema chi tiết các bảng Behavior

### 4.1 `Wishlist` (PostgreSQL)

```sql
CREATE TABLE "Wishlist" (
  id          BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL,   -- FK → B2CCustomer.id (phải đăng nhập)
  product_id  BIGINT NOT NULL,   -- FK → Product.id
  created_at  TIMESTAMP DEFAULT now(),
  UNIQUE (customer_id, product_id)  -- không thể wishlist 2 lần
);
-- Signals cho AI Rec: user interested nhưng chưa mua → deferred purchase intent
```

**Ý nghĩa cho AI Rec:** Implicit feedback mạnh — user đã chủ động lưu sản phẩm. Trọng số = 2 trong event_weights.

### 4.2 `Review` (PostgreSQL)

```sql
CREATE TABLE "Review" (
  id         VARCHAR PRIMARY KEY,  -- 'REV-{timestamp}'
  product_id BIGINT NOT NULL,      -- FK → Product.id
  reviewer   VARCHAR NOT NULL,     -- tên hiển thị (anonymous hoặc tên thật)
  rating     INT NOT NULL,         -- 1–5 sao
  comment    VARCHAR NOT NULL,
  date       TIMESTAMP DEFAULT now(),
  reply      VARCHAR,              -- phản hồi của shop
  reply_date TIMESTAMP
);
-- Sau mỗi insert: Product.rating = AVG(rating) cho product đó
```

**Ý nghĩa cho AI Rec:** Explicit feedback mạnh nhất. Trọng số = 4. Rating 1–5 phản ánh chất lượng sản phẩm thực tế.

### 4.3 `Order` + `OrderItem` (PostgreSQL)

```sql
CREATE TABLE "Order" (
  id             VARCHAR PRIMARY KEY,  -- 'ORD-{timestamp}'
  customer_id    BIGINT,               -- NULL nếu guest checkout
  province       VARCHAR,              -- HCM | HN | DN | OTHER (phục vụ BigData group by)
  total          INT,                  -- VNĐ, server tính, không từ client
  status         VARCHAR,              -- PENDING_PAYMENT → CONFIRMED → SHIPPING → DELIVERED → CANCELLED
  payment_method VARCHAR,              -- COD | BANK_TRANSFER
  payment_status VARCHAR,              -- UNPAID | PENDING | PAID | EXPIRED | FAILED | REFUND_REQUIRED | REFUNDED
  ...
);

CREATE TABLE "OrderItem" (
  id           BIGSERIAL PRIMARY KEY,
  order_id     VARCHAR,        -- FK → Order.id
  product_id   BIGINT,         -- FK → Product.id (tham chiếu)
  product_name VARCHAR,        -- snapshot tên tại thời điểm mua
  category_id  VARCHAR,        -- snapshot category
  brand_id     VARCHAR,        -- snapshot brand
  quantity     INT,
  unit_price   INT,            -- snapshot giá VNĐ tại thời điểm mua
  discount     INT DEFAULT 0,
  net_amount   INT
);
```

**Lý do snapshot:** Giá + tên thay đổi theo thời gian, fact table phải giữ giá trị tại thời điểm giao dịch.  
**Ý nghĩa cho AI Rec:** Purchase = signal mạnh nhất (weight=5). Phục vụ collaborative filtering (người mua SP này cũng mua...).

### 4.4 `ChatLog` (PostgreSQL)

```sql
CREATE TABLE "ChatLog" (
  id              BIGSERIAL PRIMARY KEY,
  session_id      VARCHAR,    -- IP hoặc fingerprint (phiên ẩn danh)
  customer_id     BIGINT,     -- NULL nếu chưa đăng nhập
  message         VARCHAR,    -- câu hỏi của user
  response        VARCHAR,    -- câu trả lời của AI
  intent          VARCHAR,    -- SEARCH_PRODUCT | ASK_DISPLAY | ASK_CAMERA | ...
  score           FLOAT,      -- độ tự tin (0.0–1.0)
  source          VARCHAR,    -- rule | cache | huggingface | api_error
  -- MLOps annotations
  corrected_intent VARCHAR,   -- admin sửa lại nếu sai
  is_annotated    BOOLEAN,    -- đã được review chưa
  is_trained      BOOLEAN,    -- đã đưa vào train set chưa
  created_at      TIMESTAMP DEFAULT now()
);
```

**Ý nghĩa cho AI Rec:** Intent từ chatbot tiết lộ nhu cầu mua hàng ngay lúc đó. `SEARCH_PRODUCT` + keyword → personalized recommendation trigger.

### 4.5 `LoyaltyTransaction` (PostgreSQL)

```sql
CREATE TABLE "LoyaltyTransaction" (
  id          BIGSERIAL PRIMARY KEY,
  customer_id BIGINT,
  order_id    VARCHAR,
  points      INT,      -- dương = tích, âm = tiêu
  reason      VARCHAR,  -- EARN_ORDER | REDEEM_ORDER | REFUND_EXPIRED | ADMIN_ADJUST
  status      VARCHAR,  -- HELD | COMMITTED | RELEASED
  created_at  TIMESTAMP DEFAULT now()
);
```

**Trạng thái hiện tại:** 0 records — chưa có đơn hàng nào DELIVERED để trigger EARN_ORDER.

### 4.6 `analytics.user_events` (ClickHouse)

```sql
CREATE TABLE analytics.user_events (
  event_id         String DEFAULT generateUUIDv4(),
  event_type       LowCardinality(String),   -- 10 types, xem bảng bên dưới
  session_id       String,                   -- 'ses_' + UUID (per browser tab)
  customer_id      Nullable(Int64),          -- NULL nếu chưa đăng nhập
  product_id       Nullable(Int64),
  category_id      Nullable(String),
  brand_id         Nullable(String),
  price_at_event   Nullable(Decimal(18,2)),
  dwell_time_ms    Nullable(Int32),          -- cap 600.000ms (10 phút)
  scroll_depth_pct Nullable(Float32),        -- 0–100
  quantity         Nullable(Int32),          -- cap 100
  rating           Nullable(Int32),          -- 1–5, chỉ cho review_submit
  search_query     Nullable(String),         -- cap 200 ký tự
  result_count     Nullable(Int32),
  product_ids      Array(Int64) DEFAULT [],  -- compare_view, checkout_abandon
  device_type      LowCardinality(String),   -- mobile | desktop | tablet
  referrer         LowCardinality(String),   -- direct | search | chatbot | recommendation | category | flash_sale
  page_source      LowCardinality(String),   -- home | category | search | detail | cart | checkout | wishlist
  event_time       DateTime64(3, 'Asia/Ho_Chi_Minh') DEFAULT now(),
  created_at       DateTime64(3, 'Asia/Ho_Chi_Minh') DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (event_time, session_id, event_type);
```

---

## 5. Event Weights — Trọng số cho AI Rec

| Event Type | Weight | Ý nghĩa |
|---|---|---|
| `purchase` | **+5** | Mạnh nhất — đã chi tiền thật |
| `review_submit` | **+4** | Explicit feedback với rating |
| `add_to_cart` | **+3** | Ý định mua cao |
| `add_to_wishlist` | **+2** | Interested, deferred |
| `compare_view` | **+1.5** | Đang cân nhắc |
| `search_query` | **+1.5** | Nhu cầu rõ ràng |
| `product_view` | **+1** | Passive interest |
| `category_view` | **+0.5** | Browse signal yếu nhất |
| `checkout_abandon` | **-0.5** | Chần chừ |
| `remove_from_cart` | **-1** | Từ chối |

Weights này được dùng trong `BehaviorService.getUserProfile()` để tổng hợp **preference vector** cho mỗi user, sau đó AI Rec dùng để rank sản phẩm gợi ý.

---

## 6. Vấn đề hiện tại và cách khắc phục

### 6.1 ❌ Kafka CDC — 0 connector đăng ký

**Biểu hiện:** `curl http://kafka-connect:8083/connectors` trả về `[]`

**Hậu quả:** Postgres → Kafka → ClickHouse pipeline bị đứt hoàn toàn:
- `analytics.sale_orders` = 0 rows
- `analytics.input_vouchers` = 0 rows
- `analytics.output_vouchers` = 0 rows
- Các bảng Order, Wishlist, Review trong Postgres KHÔNG được mirror sang ClickHouse để làm warehouse

**Cách khắc phục:** Đăng ký Debezium connector thủ công:
```bash
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "getshopy-pg-connector",
    "config": {
      "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
      "database.hostname": "postgres",
      "database.port": "5432",
      "database.user": "getshopy",
      "database.password": "<POSTGRES_PASSWORD>",
      "database.dbname": "getshopy",
      "plugin.name": "pgoutput",
      "table.include.list": "public.Order,public.OrderItem,public.Wishlist,public.Review",
      "topic.prefix": "kltn"
    }
  }'
```

### 6.2 ❌ dbt — Image `kltn-dbt:latest` không tồn tại

**Biểu hiện:** Log dbt-scheduler liên tục:
```
error pulling image "kltn-dbt:latest": API error (404): pull access denied
```

**Hậu quả:**
- `serving.processed_data_for_AI_rec` chưa được tạo
- `serving.fact_order_detail` chưa được tạo
- AI Rec service đang hoạt động nhưng không có dữ liệu warehouse để đọc

**Cách khắc phục:** Build dbt image trước khi chạy:
```bash
docker compose --profile dbt build
# hoặc:
docker compose run --rm dbt build
```

### 6.3 ✅ analytics.user_events — Đang hoạt động tốt

**128 events** từ thực tế người dùng (customer_id=14 là session mới nhất).  
Pipeline này **độc lập** với Kafka CDC — BE ghi thẳng vào ClickHouse qua `@clickhouse/client`.

---

## 7. Sample event thực tế trong ClickHouse

```
event_type=product_view | session=ses_4eb... | customer=14 | product=579232
  category=cat-phone | brand=br-vivo | dwell_time=9855ms | scroll=17% | device=desktop

event_type=category_view | session=ses_4eb... | customer=14 | category=cat-phone
event_type=category_view | session=ses_4eb... | customer=14 | category=cat-cam-doorbell
event_type=category_view | session=ses_4eb... | customer=14 | category=cat-av-bt-earphone
```

**Nhận xét:** Customer 14 (user abc12@gmail.com) đang duyệt nhiều danh mục — AI Rec chưa personalize được vì `serving` DB chưa tồn tại.

---

## 8. Verify Pipeline nhanh

```bash
# ── Postgres: kiểm tra tất cả behavior tables ──────────────────────────
docker exec kltn-postgres-1 psql -U getshopy -d getshopy -c "
  SELECT 'Wishlist' as tbl, COUNT(*) FROM \"Wishlist\"
  UNION ALL SELECT 'Review', COUNT(*) FROM \"Review\"
  UNION ALL SELECT 'Order', COUNT(*) FROM \"Order\"
  UNION ALL SELECT 'ChatLog', COUNT(*) FROM \"ChatLog\"
  UNION ALL SELECT 'LoyaltyTransaction', COUNT(*) FROM \"LoyaltyTransaction\";"

# ── ClickHouse: breakdown theo event type ─────────────────────────────
docker exec kltn-clickhouse-1 clickhouse-client \
  --query "SELECT event_type, COUNT() as cnt, MAX(event_time) as latest
           FROM analytics.user_events
           GROUP BY event_type ORDER BY cnt DESC;"

# ── Kafka Connect: kiểm tra connectors ────────────────────────────────
curl -s http://localhost:8083/connectors

# ── dbt: thử build thủ công ───────────────────────────────────────────
docker compose --profile dbt run --rm dbt build

# ── AI Rec: health check ──────────────────────────────────────────────
curl http://localhost:8000/health
```

---

## 9. Tóm tắt: Thứ gì đang chảy, thứ gì chưa

```
✅ FE → BE (POST /track)                     → ClickHouse user_events    [128 events]
✅ FE → BE (POST /wishlist)                  → Postgres Wishlist         [2 rows]
✅ FE → BE (POST /products/:id/reviews)      → Postgres Review           [1 row]
✅ FE → BE (POST /checkout)                  → Postgres Order+OrderItem  [3+4 rows]
✅ Chatbot                                   → Postgres ChatLog           [3 rows]

❌ Postgres Order → Kafka CDC → ClickHouse sale_orders         [0 rows — no connector]
❌ ClickHouse user_events → dbt → serving.processed_data       [chưa tồn tại — image lỗi]
❌ serving.processed_data → AI Rec personalization             [không có data]

⚠️  Postgres LoyaltyTransaction                                [0 rows — chưa có DELIVERED]
⚠️  ClickHouse add_to_wishlist events                          [0 — fix vừa deploy, cần thao tác mới]
```
