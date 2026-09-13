# Implement Plan — Mục 2: Hoàn thiện luồng Order & Payment VietQR

> Ngày lập: 13/09/2026
> Phạm vi: Hệ Ecommerce (`ktln-Getshopy`), có ràng buộc sang hệ BigData (`local-infra-sandbox`)
> Nguồn: [checklists-phase1-Sep13.md](../checklists/checklists-phase1-Sep13.md) — mục 2
> Trạng thái dự án: **development**, chưa beta, chưa production. Lên beta sau khi thông luồng end-to-end.

---

## 0. Các quyết định đã chốt

| # | Vấn đề | Quyết định |
|---|---|---|
| 1 | Cơ chế xác nhận thanh toán VietQR | Webhook dịch vụ trung gian — **SePay** làm adapter đầu tiên |
| 2 | Schema `Order` ở Postgres | **Thêm cột payment + tách `OrderItem`** khỏi `items Json` |
| 3 | Dashboard admin near-realtime | **Hai nhánh**: Kafka→ClickHouse trực tiếp (nóng) + Kafka→MinIO→dbt (lạnh) |
| 4 | Giữ chỗ tồn kho | **Lock chỗ khi đặt, trừ thật khi PAID** |
| 5 | Cấp độ tồn kho | Tách bảng `Inventory` + `StockReservation` ở **mức cơ bản** |

---

## 1. Hiện trạng

### 1.1 Luồng order đang chạy

```
Checkout.jsx  →  POST /api/b2c/checkout  →  ┬→ Postgres: Order (1 bản ghi, items là Json)
                 (server/src/index.js:682)   ├→ ClickHouse: analytics.sale_orders   ← dual-write
                                             ├→ ClickHouse: analytics.input_vouchers ← dual-write
                                             ├→ Trừ kho: loop từng item, không transaction
                                             └→ WebSocket broadcast STOCK_UPDATE
```

### 1.2 Phần VietQR đã có
- UI chọn COD / "Chuyển khoản – VNPAY" (`Checkout.jsx:490-557`)
- Sau khi đặt hàng hiện ảnh QR từ `img.vietqr.io` (`Checkout.jsx:223`)

### 1.3 Các lỗ hổng

| # | Vấn đề | Vị trí |
|---|---|---|
| 1 | QR hardcode số tài khoản `MB-0123456789`, tên `GETSHOPY STORE` ngay trong JSX | `Checkout.jsx:224` |
| 2 | **Không có bước xác nhận đã trả tiền** — đơn luôn `status: 'CONFIRMED'` kể cả chuyển khoản chưa thanh toán | `index.js:701` |
| 3 | **Model `Order` không có cột payment nào** — `payment_method` chỉ đẩy vào ClickHouse, không lưu Postgres | `schema.prisma:129-139` |
| 4 | Không có bảng `Payment`, không có mã đối soát (`addInfo` chỉ là chuỗi ghép, không lưu lại) | — |
| 5 | Tên method lẫn lộn: UI gửi `'VNPAY'` nhưng thực chất là chuyển khoản VietQR | `Checkout.jsx:527` |
| 6 | Không có endpoint xác nhận / huỷ / hết hạn đơn chờ thanh toán | — |

**Lỗ hổng #3 là thứ nối thẳng sang mục 3.** CDC Kafka đọc Postgres. Nếu `payment_method` / `payment_status` không nằm trong Postgres thì CDC sẽ không bao giờ bắt được, và `fact_orders_detail` + `mart_revenue` ở mục 3.4 sẽ không có dữ liệu thanh toán.

### 1.4 Vì sao phải gỡ dual-write ClickHouse

**a. ClickHouse không chịu được insert nhỏ tần suất cao.** Mỗi `INSERT` tạo một data part; merge nền không theo kịp thì bung lỗi `TOO_MANY_PARTS` (ngưỡng mặc định `parts_to_throw_insert = 300`). Khuyến nghị chính thức là gộp batch lớn, thưa (~1 insert/giây). Checkout hiện bắn **2 insert mỗi đơn**.
> Nguồn: [ClickHouse — Selecting an insert strategy](https://clickhouse.com/docs/best-practices/selecting-an-insert-strategy)

**b. `await ch.insert()` nằm trong request path.** ClickHouse chậm hoặc chết thì checkout chết theo, dù Postgres đã ghi đơn xong. Analytics không được đứng chắn đường giao dịch.

**c. Vòng lặp trừ kho** gọi `findUnique` + `update` tuần tự từng item, không transaction (`index.js:746-770`). N sản phẩm = 2N round-trip DB, kèm race condition (xem §4).

**Cách giải đúng chính là CDC** — Debezium đọc WAL của Postgres, không đụng request path; Kafka hấp thụ đỉnh tải; sink gom batch rồi mới đổ vào ClickHouse.

### 1.5 Tình trạng dữ liệu seed — **chưa chuẩn, không tái lập được**

| Thứ | Tình trạng |
|---|---|
| `npm run seed` → `server/src/seed.js` | Chạy được, nhưng `db.json` chỉ có **7 sản phẩm**, 4 khách, 3 chi nhánh, 3 đơn |
| `npm run seed:mock` | **Hỏng** — trỏ `src/seed-mock-v2.js`, file không tồn tại |
| 18K+ sản phẩm thật | Sinh từ **37 script one-off** trong `server/scripts/`, chạy tay, không ghi lại thứ tự |
| Nguồn dữ liệu | `server/scripts/data/tgdd-products.json` (23MB, crawl TGDĐ) |
| `db.json` | Tồn tại **2 bản trùng nhau** (`server/db.json`, `data/db.json`) — không rõ bản nào là nguồn |
| `prisma/migrations/` | **Không có** — đang dùng `db push`, không có lịch sử schema |

Ghi chú: `db.json` có sẵn key `order_details` (đang rỗng), và DB mock của CDC cũng có bảng `public.orders_detail`. Thiết kế ban đầu đã định tách, chỉ là `schema.prisma` làm rơi mất.

### 1.6 Tình trạng tồn kho — **chưa có chỗ nào để giữ chỗ**

14 model trong `schema.prisma`, không có `Inventory` / `Warehouse` / `StockReservation` / `StockMovement`. Toàn bộ tồn kho nằm trong `Product`:

| Chỗ chứa tồn | Kiểu | Vấn đề |
|---|---|---|
| `Product.stock` | `Int` | Một số tổng duy nhất, không có cột `reserved` |
| `Product.variants[].stock` | trong `Json` | **Tồn kho biến thể chôn trong JSON** — không index, update không atomic |
| `Product.branch_ids` | `Json` | Chỉ là *danh sách chi nhánh có bán*, **không phải tồn kho theo chi nhánh** |

Hệ quả: checkout gán `branch_id = 'BR_1'` / `'Chi nhánh 1'` làm mặc định (`index.js:711-712`), nên cột `branch_id` trong `analytics.sale_orders` đang là **số liệu giả**. `mart_revenue` chia theo chi nhánh ở mục 3 sẽ kế thừa đúng chỗ sai này.

Blast radius: **70 chỗ chạm `stock` ở server, 10 ở client** → đổi theo hướng *cộng thêm*, không đổi ý nghĩa `Product.stock`.

### 1.7 Blocker cho mục 3 chưa ai đụng

Postgres trong `docker-compose.yml:60` chạy `postgres:16-alpine` mặc định → `wal_level = replica`. **Debezium bắt buộc `wal_level = logical`.** Chưa có `command:` nào set. Tức là CDC ở mục 3 hiện **chưa thể chạy được** với DB thật của Getshopy.

---

## 2. Thiết kế

### 2.1 Schema Postgres

```prisma
model Order {
  // ... giữ nguyên các cột hiện có
  payment_method  String    @default("COD")     // COD | BANK_TRANSFER
  payment_status  String    @default("UNPAID")  // UNPAID | PENDING | PAID | EXPIRED | FAILED
  payment_ref     String?   @unique             // mã đối soát in trong nội dung CK
  paid_at         DateTime?
  paid_amount     Float?
  items           OrderItem[]                   // thay cho items Json
}

model OrderItem {
  id           BigInt  @id @default(autoincrement())
  order_id     String
  product_id   BigInt
  product_name String            // snapshot tên tại thời điểm mua
  category_id  String?
  brand_id     String?
  branch_id    String?
  variant_id   String?
  quantity     Int
  unit_price   Float             // snapshot giá tại thời điểm mua
  discount     Float   @default(0)
  net_amount   Float
  order        Order   @relation(fields: [order_id], references: [id])

  @@index([order_id])
  @@index([product_id])
}

model PaymentTransaction {
  id              BigInt   @id @default(autoincrement())
  order_id        String?
  provider        String            // sepay | casso | payos | manual
  provider_txn_id String   @unique  // idempotency — chống webhook bắn trùng
  amount          Float
  bank_account    String?
  content         String?           // nội dung CK thô
  raw_payload     Json
  received_at     DateTime @default(now())
  match_status    String            // MATCHED | UNMATCHED | DUPLICATE

  @@index([order_id])
  @@index([match_status])
}

model Inventory {
  id          BigInt   @id @default(autoincrement())
  product_id  BigInt
  variant_id  String   @default("")   // "" = sản phẩm không biến thể (xem §2.2)
  branch_id   String   @default("")   // "" = kho tổng; để sẵn cho tồn theo chi nhánh sau
  on_hand     Int      @default(0)    // tồn vật lý
  reserved    Int      @default(0)    // đang giữ chỗ
  updated_at  DateTime @updatedAt

  @@unique([product_id, variant_id, branch_id])
  @@index([product_id])
}

model StockReservation {
  id           BigInt   @id @default(autoincrement())
  order_id     String
  inventory_id BigInt
  quantity     Int
  status       String                 // HELD | COMMITTED | RELEASED
  expires_at   DateTime
  created_at   DateTime @default(now())

  @@index([order_id])
  @@index([status, expires_at])
}
```

**Snapshot giá/tên trong `OrderItem`**: fact table phải giữ giá trị tại thời điểm giao dịch, không join sang `Product` hiện tại. Đây là nguyên tắc transaction fact grain trong mô hình chiều — giá sản phẩm thay đổi thì doanh thu lịch sử không được đổi theo.

**Giữ nguyên `Product.stock`** như cột đọc nhanh (denormalized), đồng bộ từ `Inventory`. 70 chỗ code cũ đọc `product.stock` vẫn chạy; chỉ chỗ nào cần tồn *khả dụng* mới đọc `Inventory`.

### 2.2 Vì sao `variant_id` / `branch_id` dùng `""` chứ không dùng `NULL`

Trong Postgres, unique index mặc định coi mỗi `NULL` là **khác nhau** — `UNIQUE(product_id, variant_id, branch_id)` với `variant_id = NULL` sẽ **cho phép chèn trùng** vô số hàng. PG15 trở lên có `NULLS NOT DISTINCT` nhưng Prisma chưa expose trực tiếp.

Dùng sentinel chuỗi rỗng `""` làm ràng buộc unique hoạt động đúng như mong đợi, và phép so sánh `variant_id = $v` không phải xử lý `IS NOT DISTINCT FROM`.

> Nguồn: [PostgreSQL — CREATE INDEX, UNIQUE / NULLS NOT DISTINCT](https://www.postgresql.org/docs/current/sql-createindex.html)

### 2.3 Phạm vi tồn kho — cái gì làm, cái gì không

**Làm** (đủ cho KLTN, ~30 dòng schema):
- Tồn khả dụng = `on_hand - reserved`
- Giữ chỗ tới cấp biến thể
- Hết hạn giữ chỗ → nhả
- `branch_id` để sẵn, chưa dùng

**Cố tình không làm** (là WMS/ERP thật, vượt phạm vi đề tài, không phục vụ luận điểm nào):
- Chuyển kho giữa chi nhánh
- Lô / hạn sử dụng (batch, lot)
- Serial number
- Kiểm kê định kỳ (stock take)
- Cost layer FIFO / LIFO

---

## 3. Các phase

### Phase 2.0 — Dọn nền dữ liệu *(chèn thêm, phải làm trước)*

| # | Việc | Lý do |
|---|---|---|
| 2.0.1 | Thêm `command: postgres -c wal_level=logical -c max_replication_slots=4 -c max_wal_senders=4` vào service `postgres` | Blocker §1.7 — không có thì CDC ở mục 3 không chạy |
| 2.0.2 | Khởi tạo `prisma migrate`, bỏ `db push` | Schema phải có lịch sử để tái lập |
| 2.0.3 | Gộp 37 script one-off → **một** `seed.js` idempotent đọc `tgdd-products.json` | Hiện không ai dựng lại được DB từ đầu |
| 2.0.4 | Xoá bản `db.json` trùng, chốt một nguồn duy nhất | Nguồn sự thật mơ hồ |
| 2.0.5 | Sửa hoặc xoá script `seed:mock` hỏng | `package.json` trỏ file không tồn tại |
| 2.0.6 | Quy trình `pg_dump -Fc` + restore, viết vào README | Xem ghi chú bên dưới |

**Về ý "seed rồi export volume ra xài":** hướng đúng, nhưng **đừng lấy volume làm vật phẩm chính**. Volume Postgres là binary, khoá cứng vào `postgres:16-alpine`, không diff được, không review được trong hội đồng, và nặng. Thứ tự ưu tiên nên là: (1) `prisma migrate` cho schema, (2) một `seed.js` idempotent, (3) `pg_dump -Fc` ra file nén — restore lên máy bất kỳ trong một lệnh. Volume export chỉ là tiện ích chạy nhanh.

### Phase 2.1 — Schema & migration
Tạo **một migration duy nhất** cho toàn bộ §2.1, rồi seed lại một lần. Vì dữ liệu đằng nào cũng phải seed lại ở Phase 2.0, đây là thời điểm rẻ nhất để tách tồn kho — chi phí migrate gần như bằng 0.

### Phase 2.2 — Gỡ ClickHouse khỏi checkout
- Bỏ 2 lệnh `ch.insert` khỏi `/api/b2c/checkout`
- Bọc phần ghi Postgres vào `prisma.$transaction`
- Thay loop trừ kho bằng giữ chỗ atomic (§4)
- Đơn COD → `CONFIRMED`; đơn chuyển khoản → `PENDING_PAYMENT` + `payment_status: PENDING`

### Phase 2.3 — VietQR đúng chuẩn
- Đưa cấu hình ra env: `VIETQR_BANK_BIN`, `VIETQR_ACCOUNT_NO`, `VIETQR_ACCOUNT_NAME`
- Backend trả URL QR, frontend không tự ghép
- Sinh `payment_ref` ngắn, viết HOA, không dấu — ngân hàng giới hạn ký tự nội dung CK và strip dấu
- Đổi `'VNPAY'` → `'BANK_TRANSFER'` (VietQR là chuẩn QR của Napas, không phải cổng VNPAY)

### Phase 2.4 — Webhook đối soát (SePay)
- `POST /api/payment/webhook/:provider`, xác thực chữ ký / API key
- Parse nội dung CK → tìm `payment_ref` → so khớp số tiền → `payment_status: PAID`, `paid_at`
- **Adapter pattern**: một interface chung, mỗi provider một adapter. Đổi nhà cung cấp chỉ thay adapter.
- Không khớp → lưu `UNMATCHED` để admin xử lý tay, **không im lặng bỏ qua**
- `provider_txn_id` unique → webhook bắn trùng bị chặn ở tầng DB

### Phase 2.5 — Frontend màn chờ thanh toán
QR + đếm ngược + polling `GET /api/b2c/orders/:id/payment-status` → tự chuyển sang "Đã thanh toán"

### Phase 2.6 — Admin
Xem danh sách giao dịch, xác nhận tay cho đơn `UNMATCHED`. **Fallback bắt buộc phải có** — webhook nào cũng có lúc miss.

### Phase 2.7 — Hết hạn đơn
Job huỷ đơn `PENDING_PAYMENT` quá hạn → `RELEASED` reservation → nhả `reserved`

### Phase 2.8 — Test
COD / CK thành công / webhook trùng / sai số tiền / hết hạn / **hai request tranh nhau món cuối cùng**

---

## 4. Giữ chỗ tồn kho: vì sao không cần lock, không race

Đây là phần quan trọng nhất về mặt kỹ thuật, và cũng là chỗ bug hiện tại nằm.

### 4.1 Bug hiện tại: check-then-act (TOCTOU)

Code hiện ở `index.js:746-770`:

```js
const product = await prisma.product.findUnique({ where: { id } });  // ← CHECK
if (product) {
  await prisma.product.update({                                       // ← ACT
    where: { id },
    data: { stock: Math.max(0, product.stock - qty) }
  });
}
```

Giữa lúc **đọc** và lúc **ghi** có một khoảng hở. Hai request đồng thời:

```
Thời điểm   Request A                    Request B
--------    -------------------------    -------------------------
t1          đọc stock = 1
t2                                       đọc stock = 1
t3          thấy đủ (1 >= 1)
t4                                       thấy đủ (1 >= 1)
t5          ghi stock = 0
t6                                       ghi stock = 0
```

Kết quả: tồn kho còn 1 món nhưng **bán được 2 đơn**. Đây là lớp lỗi kinh điển gọi là TOCTOU — *time-of-check to time-of-use*. Lưu ý `Math.max(0, ...)` **không cứu được gì** — nó chỉ che số âm, việc bán thừa vẫn xảy ra.

### 4.2 Cách sửa: gộp check và act vào một câu lệnh

```sql
UPDATE "Inventory"
SET    reserved = reserved + $qty
WHERE  product_id = $pid
  AND  variant_id = $vid
  AND  branch_id  = $bid
  AND  on_hand - reserved >= $qty      -- ← điều kiện nằm TRONG câu ghi
RETURNING id;
```

Ứng dụng chỉ cần đọc số hàng bị ảnh hưởng:

```js
const rows = await prisma.$queryRaw`...`;
if (rows.length === 0) throw new OutOfStockError();
```

Không còn câu hỏi "liệu có bị oversell không" — database đã trả lời.

### 4.3 Vì sao câu lệnh đó an toàn — ba tầng lý do

**Tầng 1 — Không còn khoảng hở.**
Điều kiện `on_hand - reserved >= $qty` được đánh giá **bên trong cùng thao tác ghi**, không phải trước đó ở tầng ứng dụng. Không có điểm nào giữa check và act để request khác chen vào.

**Tầng 2 — Postgres tự khoá hàng, không cần ứng dụng làm.**
Postgres dùng MVCC. Khi một `UPDATE` chạm vào một hàng, nó lấy **row-level exclusive lock** trên hàng đó một cách tự động. Giao dịch khác muốn ghi cùng hàng sẽ phải chờ.

Nên "không cần lock" ở đây có nghĩa chính xác là: **không cần lock ở tầng ứng dụng** — không cần `SELECT ... FOR UPDATE` thủ công, không cần advisory lock, không cần distributed lock qua Redis. Không phải là "không có lock nào cả". Lock vẫn có, nhưng do Postgres quản lý, phạm vi hẹp (một hàng), và tự nhả khi câu lệnh kết thúc.

**Tầng 3 — Postgres tự đánh giá lại điều kiện sau khi chờ.**
Đây là điểm tinh tế nhất và hay bị hiểu sai. Ở mức cô lập mặc định **READ COMMITTED**:

```
Thời điểm   Request A                     Request B
--------    --------------------------    --------------------------
t1          UPDATE ... WHERE
              on_hand - reserved >= 1
t2          khoá hàng, thấy đủ, ghi
t3                                        UPDATE ... (cùng hàng)
t4                                        BỊ CHẶN — chờ A commit
t5          COMMIT
t6                                        A đã commit. B KHÔNG dùng
                                          ảnh chụp cũ — Postgres đọc lại
                                          phiên bản MỚI NHẤT của hàng và
                                          ĐÁNH GIÁ LẠI mệnh đề WHERE
t7                                        on_hand - reserved = 0, không
                                          thoả >= 1 → không ghi gì,
                                          rowCount = 0
```

Postgres gọi cơ chế này là **EvalPlanQual**. Tài liệu chính thức nói rõ: khi giao dịch thứ hai gặp một hàng đã bị giao dịch khác cập nhật và commit, nó sẽ *"re-evaluate the row's search conditions"* trên phiên bản mới; nếu không còn thoả thì hàng đó bị bỏ qua.

> Nguồn: [PostgreSQL — Transaction Isolation: Read Committed](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED)

Đó chính là lý do **không cần** nâng lên `SERIALIZABLE`, **không cần** vòng lặp retry, **không cần** optimistic locking bằng cột version. Postgres đã re-check hộ ở đúng mức cô lập mặc định.

### 4.4 Những chỗ vẫn phải cẩn thận

Nói cho trung thực — kỹ thuật này chỉ đúng trong phạm vi của nó:

**a. Toàn bộ điều kiện an toàn phải nằm trong `WHERE`.**
Nếu tính toán ở JavaScript rồi mới ghi, bug §4.1 quay lại nguyên vẹn. Đây là ràng buộc kỷ luật code, không phải thứ database tự bảo vệ.

**b. Chỉ atomic trong phạm vi một câu lệnh.**
Đơn nhiều sản phẩm = nhiều câu `UPDATE` → phải bọc trong `prisma.$transaction` để **hoặc giữ chỗ được hết, hoặc không giữ gì**. Không thể để đơn giữ được 2/3 món.

**c. Deadlock khi nhiều transaction khoá nhiều hàng theo thứ tự khác nhau.**
A giữ sản phẩm #10 rồi xin #20; B giữ #20 rồi xin #10 → hai bên chờ nhau vĩnh viễn. Postgres phát hiện và giết một bên, nhưng đơn đó fail.

**Cách tránh:** luôn `sort` danh sách item theo `product_id` tăng dần **trước khi** UPDATE, để mọi transaction khoá theo cùng một thứ tự. Đây là biện pháp bắt buộc, phải viết vào code kèm comment giải thích.

**d. Hot row contention.**
Một sản phẩm flash sale cực hot thì mọi request xếp hàng trên **cùng một hàng** → throughput bị giới hạn bởi độ dài transaction giữ lock. Ở quy mô KLTN không thành vấn đề. Ở quy mô thật thì phải tách thành nhiều hàng con (sharded counter) hoặc đẩy qua hàng đợi. Đáng nêu trong phần "hướng phát triển" của luận văn.

**e. `reserved` phải được nhả.**
Nếu Phase 2.7 (job hết hạn) không chạy, `reserved` chỉ tăng không giảm và tồn khả dụng rò rỉ dần về 0 — trong khi `on_hand` vẫn đầy. Đây là failure mode âm thầm, cần có cảnh báo hoặc ít nhất một truy vấn kiểm tra trong phần checksum của mục 3.

### 4.5 Vòng đời một reservation

```
Khách đặt đơn CK
   └→ UPDATE Inventory SET reserved += n WHERE on_hand - reserved >= n   [atomic]
      └→ INSERT StockReservation (status = HELD, expires_at = now + 15')

   ├─ Webhook báo PAID
   │     └→ UPDATE Inventory SET on_hand -= n, reserved -= n              [atomic]
   │        └→ StockReservation.status = COMMITTED
   │
   └─ Quá hạn (job Phase 2.7)
         └→ UPDATE Inventory SET reserved -= n                            [atomic]
            └→ StockReservation.status = RELEASED
```

Cả ba nhánh đều là một câu UPDATE atomic, cùng nguyên lý §4.3.

---

## 5. Trade-off và ảnh hưởng chéo hai hệ

| Quyết định | Ảnh hưởng hệ Ecommerce | Ảnh hưởng hệ BigData |
|---|---|---|
| Tách `OrderItem` | Phải sửa các chỗ đọc `Order.items` Json | Phải thêm bảng vào `table.include.list` của Debezium, thêm topic vào MinIO sink, align tên cột với `orders_detail` trong DB mock. **Đổi lại** dbt dựng `fact_orders_detail` bằng SQL thường thay vì `JSONExtract`, và test checksum ở mục 3.5 dễ hơn hẳn |
| Gỡ dual-write ClickHouse | Admin dashboard **mất số liệu** cho tới khi mục 3 thông | Loại bỏ hai nguồn ghi vào cùng một kho — chỉ còn một đường CDC duy nhất |
| Tách `Inventory` | 70 chỗ đọc `stock` giữ nguyên nhờ `Product.stock` denormalized | Sửa được `branch_id = 'BR_1'` gán bừa → `mart_revenue` theo chi nhánh mới có dữ liệu thật |
| Thêm cột payment | — | CDC bắt được `payment_method` / `payment_status` → `mart_revenue` tách được doanh thu theo phương thức thanh toán |
| `wal_level = logical` | Cần restart Postgres, tăng nhẹ dung lượng WAL | **Điều kiện bắt buộc** để Debezium chạy |

**Chấp nhận được** vì dự án đang ở giai đoạn development, chưa beta, chưa production.

---

## 6. Requirements ngoài phạm vi agents — bạn phải tự làm

1. **Tài khoản ngân hàng thật** để liên kết SePay (hỗ trợ MB, VPBank, ACB, OCB, TPBank…)
2. **Đăng ký tài khoản SePay**, lấy API key + webhook secret
3. **Public URL** để nhận webhook khi dev local — `ngrok` hoặc `cloudflared tunnel`
4. Xác nhận số tài khoản / tên tài khoản dùng cho VietQR

Trong lúc chờ (1)-(3), Phase 2.1 → 2.3 và 2.5 → 2.8 vẫn làm được; Phase 2.4 dùng adapter mô phỏng để test end-to-end, sau cắm adapter SePay thật vào.

---

## 7. ⚠️ Secrets đang lộ — xử lý trước khi đẩy repo

| File | Thứ bị lộ |
|---|---|
| `local-infra-sandbox/config-json/pg-source-connector.json` | `database.password` hardcode |
| `local-infra-sandbox/config-json/minio-sink-connector.json` | `aws.access.key.id` + `aws.secret.access.key` hardcode |
| `local-infra-sandbox/.env` | Password Postgres + ClickHouse + MinIO plaintext |

`local-infra-sandbox` hiện chưa phải git repo nên chưa leak lên remote, nhưng mục 3 sẽ đụng đúng mấy file này.

**Cần làm:** đưa `.env` vào `.gitignore`; thay hardcode trong 2 file JSON bằng Kafka Connect `ConfigProvider` (`${file:/path:key}`) hoặc biến môi trường; tạo `.env.example` không chứa giá trị thật.

Phần Getshopy sạch — không có key hardcode, `.env` không nằm trong repo. Nhưng `docker-compose.yml:35` có `DATABASE_URL` chứa password mặc định và `ports: 5432:5432` expose Postgres ra ngoài — nên đưa về `expose:` khi lên VM.

---

## 8. Ước lượng

| Phase | Tỉ trọng |
|---|---|
| 2.0 — Dọn nền dữ liệu | ~1/3 công sức của cả mục 2 |
| 2.1 — Schema & migration | nhỏ, nhưng phải làm đúng một lần |
| 2.2 – 2.4 — Payment core | ~1/3 |
| 2.5 – 2.8 — UI, admin, job, test | ~1/3 |

Bỏ qua Phase 2.0 thì mục 3 chắc chắn tắc ở bước CDC (§1.7).

---

## 9. Định nghĩa hoàn thành

- [ ] Dựng lại toàn bộ DB từ số 0 bằng `prisma migrate deploy && npm run seed` — một lệnh, không script tay
- [ ] `wal_level = logical`, Debezium tạo được replication slot trên DB Getshopy
- [ ] Đặt đơn COD → `CONFIRMED`, tồn giảm đúng
- [ ] Đặt đơn CK → `PENDING_PAYMENT`, tồn khả dụng giảm, `on_hand` chưa đổi
- [ ] Webhook SePay (hoặc mô phỏng) → `PAID`, `on_hand` giảm, `reserved` nhả
- [ ] Webhook bắn trùng → không ghi đè, ghi `DUPLICATE`
- [ ] Webhook sai số tiền → `UNMATCHED`, admin thấy được
- [ ] Đơn quá hạn → `EXPIRED`, `reserved` nhả hết
- [ ] Hai request đồng thời tranh món cuối → đúng một đơn thành công
- [ ] `/api/b2c/checkout` không còn lệnh `ch.insert` nào

---

# PHỤ LỤC A — Quyết định bổ sung 13/09 (đợt Payment)

> Sau khi rà soát lỗ hổng phần payment. Phụ lục này **ghi đè** một số nội dung ở §2-§3 phía trên.

## A.0 Thay đổi thứ tự ưu tiên

Payment được implement **trước** Phase 2.0 (dọn nền dữ liệu), để thông luồng eCom sớm.
Nhưng 5 lỗ hổng nhóm chặn (§A.2) **phải lấp trong cùng đợt này**, trước Phase 2.3 — vì không có chúng thì QR sinh ra không đúng số tiền thực và toàn bộ phần payment vô nghĩa.

## A.1 Quyết định đã chốt

| # | Vấn đề | Quyết định |
|---|---|---|
| 6 | Kiểu dữ liệu tiền | **`Int` — đơn vị đồng.** VND không có phần lẻ; so sánh số tiền chính xác tuyệt đối, không lệch làm tròn. `Number.MAX_SAFE_INTEGER` ≈ 9×10¹⁵ đồng — thừa sức |
| 7 | Lệch số tiền | **Khớp chính xác `amount === order.total`.** Không cộng dồn, không tolerance — vì QR động đã khoá sẵn số tiền |
| 8 | Phạm vi đợt payment | Lấp 5 lỗ hổng nhóm chặn **trước**, trong cùng đợt |
| 9 | Thời hạn QR | Hiển thị **5 phút** cho khách; server giữ reservation **8 phút** (xem §A.3) |

**Lưu ý cho mục 3:** ClickHouse `analytics.sale_orders` đang khai `Decimal(18,2)`. Chuyển Postgres sang `Int` đồng thì dbt phải cast tường minh khi dựng `fact_orders_detail` / `mart_revenue`. Ghi lại để không quên khi làm mục 3.

## A.2 Năm lỗ hổng nhóm chặn — phải lấp trước Phase 2.3

### A.2.1 Server không tính lại tiền *(nghiêm trọng nhất)*
`index.js:684-697` nhận `total`, `subTotal`, `discount`, `shippingFee` từ `req.body` và ghi thẳng. Fallback `items.reduce(...)` cũng dùng `item.price` **do client gửi**.

Hệ quả khi gắn payment: **QR sinh theo số tiền client tự khai.** Sửa `total: 1000` trong DevTools → QR 1.000đ cho iPhone → chuyển khoản → webhook thấy khớp → `PAID`.

**Lấp:** server tính lại 100% từ DB — giá từ `Product`, flash sale verify `start_time`/`end_time`, phí ship tính theo `province` ở server, voucher tính lại. Client gửi lên chỉ để **đối chiếu và cảnh báo lệch**, không bao giờ để ghi.

### A.2.2 `/api/b2c/checkout` không có middleware auth
Không có `authB2C` / `verifyToken` nào. Kiểm tra đăng nhập nằm ở **client** (`Checkout.jsx:153`, chỉ đọc `localStorage`). Ai cũng `curl` thẳng vào tạo đơn, và `customer_info` do người gọi tự khai.

Với payment: không xác định được đơn thuộc về ai → không biết hoàn tiền cho ai, ai được xem trạng thái thanh toán.

**Lấp:** middleware xác thực JWT B2C; `customer_id` lấy từ token, **không** từ body.

### A.2.3 Điểm thưởng do client tự quản
`loyalty_points` chỉ được set `= 0` lúc đăng ký (`b2c.js:481`), **không có logic cộng/trừ ở server**. Toàn bộ nằm ở `localStorage['b2c_points']` (`Checkout.jsx:109,186`). Sửa DevTools → điểm vô hạn → `pointsDiscount` vô hạn → tổng tiền về 0.

**Lấp:** điểm đọc/ghi hoàn toàn ở server trong cùng transaction tạo đơn; bảng `LoyaltyTransaction` ghi nhận mọi lần cộng/trừ để truy vết và hoàn khi đơn huỷ.

### A.2.4 Voucher dùng lại vô hạn
`b2c.js:388-407`: `cart_total` nhận từ client (bypass `min_order_value`), và model `Voucher` **không có `used_count`, không có bảng usage**. Một mã dùng được mãi mãi, mọi khách.

**Lấp:** bảng `VoucherUsage(voucher_id, order_id, customer_id, used_at)` + `@@unique([voucher_id, customer_id])` nếu giới hạn mỗi khách một lần; `cart_total` tính lại ở server.

### A.2.5 Tiền đang là `Float`
Xem §A.1 — chuyển sang `Int` đồng.

## A.3 Vì sao QR động "khoá số tiền" vẫn chưa đủ

QR động có tag `54` (Transaction Amount) và tag `62-08` (nội dung), và hầu hết app ngân hàng VN khoá hai ô đó khi quét. Nên **không cần** chính sách cộng dồn hay tolerance. Nhưng còn bốn đường dẫn tới "tiền vào mà không gán được vào đơn còn hiệu lực":

| # | Kịch bản | Vì sao QR không chặn được |
|---|---|---|
| 1 | Khách chụp màn hình QR, quét lại sau nhiều giờ | **Chuẩn EMVCo không có trường expiry.** "5 phút" là ràng buộc phía server, chuỗi QR sống vĩnh viễn |
| 2 | Khách quét ở phút 4:50, tiền tới lúc 5:15 | Độ trễ ngân hàng + webhook vượt qua ranh giới hết hạn. **Không phải edge case hiếm** |
| 3 | Khách chuyển tay, không quét QR | Phải hiện số tài khoản để dự phòng QR lỗi → đường này luôn mở, không gì khoá |
| 4 | Khách chuyển 2 lần vì tưởng lần đầu thất bại | Hai giao dịch hợp lệ, cùng nội dung, cùng số tiền, **khác `provider_txn_id`** → idempotency theo txn_id không chặn được |

### Biện pháp

**a. Server giữ lâu hơn đồng hồ hiển thị.**
Đếm ngược cho khách: **5 phút**. Server giữ reservation: **8 phút**. Khoảng chênh 3 phút hấp thụ độ trễ ngân hàng + webhook, xử lý kịch bản #2.

**b. Webhook đến muộn thì thử giữ chỗ lại.**
Nếu đơn đã `EXPIRED` mà webhook tới: thử `UPDATE Inventory SET reserved += n WHERE on_hand - reserved >= n`.
- Thành công → vẫn cho `PAID` (khách vui, không phải hoàn tiền)
- Thất bại → `PaymentTransaction.match_status = 'REFUND_REQUIRED'`, vào hàng đợi admin

**c. Idempotency hai tầng.**
- Tầng 1: `provider_txn_id @unique` — chặn webhook bắn trùng cùng một giao dịch
- Tầng 2: `UPDATE "Order" SET payment_status='PAID' WHERE id=$id AND payment_status='PENDING'` — chặn kịch bản #4. `rowCount = 0` nghĩa là đơn đã PAID rồi → giao dịch thứ hai là tiền thừa → `REFUND_REQUIRED`

**d. Mọi tiền không gán được đều phải vào hàng đợi, không bao giờ im lặng bỏ qua.**

## A.4 Đối soát theo nội dung — chi tiết kỹ thuật

### A.4.1 Sinh `payment_ref`

| Yêu cầu | Lý do |
|---|---|
| **Độ dài cố định** | Chống prefix collision: `GS123` là substring của `GS1234` → dùng `String.includes` sẽ gán tiền sai đơn |
| **Ngẫu nhiên, không tuần tự** | Không lộ số lượng đơn hàng; không đoán được ref người khác để dò trạng thái |
| **Chỉ `[A-Z0-9]`** | Sống sót qua mọi phép biến đổi của ngân hàng (strip dấu, uppercase, bỏ ký tự đặc biệt) |
| **Có ký tự checksum** | Loại bỏ chuỗi trùng ngẫu nhiên trong nội dung chuyển khoản |

Đề xuất: `GS` + 8 ký tự base32 ngẫu nhiên + 1 ký tự checksum = 11 ký tự.

### A.4.2 Normalize trước khi match

Mỗi ngân hàng xử lý nội dung khác nhau: strip dấu, chuyển hoa/thường, cắt độ dài, **chèn tiền tố riêng** (kiểu `CHUYEN TIEN TU ... ND:`), thay ký tự đặc biệt bằng khoảng trắng.

Thứ tự xử lý: bỏ dấu → uppercase → bỏ mọi ký tự ngoài `[A-Z0-9]` → **rồi mới** regex tìm ref. Tuyệt đối **không** dùng `String.includes`.

### A.4.3 `UNMATCHED` không phải trạng thái cuối

Webhook có thể đến **trước** khi transaction tạo đơn kịp commit → tra `payment_ref` không thấy → `UNMATCHED` oan.
Cần job re-match quét lại các `PaymentTransaction` ở trạng thái `UNMATCHED` theo chu kỳ, trước khi báo admin.

## A.5 Bảo mật webhook

| # | Rủi ro | Biện pháp |
|---|---|---|
| 1 | **Webhook không xác thực = tạo đơn PAID miễn phí.** Ai cũng `curl` payload giả | Verify credential của provider — đối chiếu doc SePay hiện hành để lấy đúng format header |
| 2 | Timing attack khi so sánh key | `crypto.timingSafeEqual`, không dùng `===` |
| 3 | Giả mạo nguồn | IP allowlist làm lớp phòng thủ thứ hai |
| 4 | Không truy được khi đối soát sai | Ghi `raw_payload` **trước** khi xử lý, kể cả khi verify thất bại |
| 5 | Provider retry khi timeout → nhân đôi tải | Ghi nhận → trả `200` ngay → xử lý tiếp |

## A.6 Còn thiếu trong thiết kế — bổ sung vào scope

| # | Thiếu | Bổ sung |
|---|---|---|
| 1 | Không có luồng hoàn tiền | Trạng thái `REFUNDED` + bảng ghi nhận. Quy mô KLTN: hoàn tay, nhưng **phải có chỗ ghi** |
| 2 | Voucher/điểm chưa gắn vòng đời thanh toán | Đơn hết hạn → trả lại voucher + hoàn điểm (cần §A.2.3, §A.2.4 trước) |
| 3 | Không có đối soát bù khi webhook chết | Job định kỳ gọi API lịch sử giao dịch của provider; tối thiểu cho admin import sao kê |
| 4 | Xác nhận tay không có audit | `confirmed_by`, `confirmed_at`, `reason` — thao tác đụng tiền bắt buộc truy được |
| 5 | Múi giờ không thống nhất | SePay giờ VN, Postgres UTC, ClickHouse `Asia/Ho_Chi_Minh` → báo cáo doanh thu theo ngày lệch ở ranh giới nửa đêm |

## A.7 QR động — tự sinh thay vì gọi img.vietqr.io

Cách hiện tại (`Checkout.jsx:224`) gọi `img.vietqr.io/image/...`:
- Phụ thuộc mạng ngoài — họ down thì khách không có QR
- Gửi số tiền + nội dung đơn hàng sang bên thứ ba
- Không kiểm soát được

**Đề xuất:** backend tự sinh chuỗi EMVCo VietQR, render QR local bằng thư viện (`qrcode` npm). Chuỗi gồm thông tin thụ hưởng, số tiền (tag `54`), nội dung chứa ref (Additional Data Field Template, tag `62`), kết thúc bằng CRC16-CCITT.

Đổi lại: không phụ thuộc dịch vụ ngoài, không rò dữ liệu đơn hàng, và **sinh được QR ngay trong transaction tạo đơn** — đúng nghĩa động theo từng giao dịch.

> Nguồn chuẩn: [VietQR Format Specification — Napas](https://vietqr.net/portal-service/download/documents/QR_Format_T&C_ver1.4_EN.pdf)

## A.8 Thứ tự thực hiện đợt Payment

| Bước | Nội dung | Phụ thuộc |
|---|---|---|
| **P1** | Schema: `OrderItem`, cột payment, `PaymentTransaction`, `Inventory`, `StockReservation`, `VoucherUsage`, `LoyaltyTransaction`; tiền → `Int` | — |
| **P2** | Middleware auth B2C cho checkout (§A.2.2) | P1 |
| **P3** | Server tính lại toàn bộ tiền từ DB (§A.2.1), voucher + điểm về server (§A.2.3, §A.2.4) | P1, P2 |
| **P4** | Gỡ `ch.insert` khỏi checkout; giữ chỗ tồn kho atomic (§4) | P1 |
| **P5** | Sinh VietQR EMVCo + `payment_ref` (§A.4.1, §A.7) | P3 |
| **P6** | Webhook SePay: verify, normalize, match, idempotency hai tầng (§A.4, §A.5) | P5 |
| **P7** | Màn chờ thanh toán: QR + đếm ngược 5' + polling | P5 |
| **P8** | Job hết hạn 8' + nhả reservation + trả voucher/điểm | P4 |
| **P9** | Admin: hàng đợi `UNMATCHED` / `REFUND_REQUIRED`, xác nhận tay có audit | P6 |
| **P10** | Test (§9) + kịch bản: QR quét lại sau hết hạn, chuyển 2 lần, webhook đến muộn | tất cả |

**P1 → P4 là điều kiện cần** để phần QR/webhook có ý nghĩa. Không được đảo thứ tự.

---

# PHỤ LỤC B — Trạng thái thực hiện, 13/09/2026

## B.1 Đã hoàn thành

| Bước | Nội dung | Kiểm chứng |
|---|---|---|
| P1 | Schema + migration | 20 bảng trong DB, có `prisma/migrations/` |
| P2 | `authB2C` — customer_id lấy từ token | không token → 401 |
| P3 | `pricingService` — server tính lại toàn bộ tiền | client khai `total: 1000` cho iPhone 25.990.000đ → server ra 26.010.000đ, QR mang số thật |
| P4 | `inventoryService` — giữ chỗ atomic | 10 request đồng thời / kho 3 → đúng 3 đơn |
| P5 | `checkoutService` — sinh `payment_ref` + QR động | QR trả kèm `data_url`, `amount` khớp `total` |
| P6 | Webhook + adapter SePay/simulator | 20/20 test; adapter khớp tài liệu SePay, 15/15 test |
| P8 | `orderLifecycle` + `expireScheduler` | job tự đóng đơn sau ~57s, kho tự nhả |
| P7 | `PaymentQRModal` — popup QR + đếm ngược + polling | — |

**Đã gỡ `ch.insert` khỏi `/api/b2c/checkout`.** Còn hai lệnh trong
`/api/admin/simulate-sale` — công cụ demo của admin, admin gọi tay chứ không
nằm trên đường giao dịch, nên để nguyên; khi CDC lên thì chuyển sang ghi Postgres.

## B.2 Lỗ hổng phát hiện qua test, đã sửa

Lần chạy end-to-end đầu tiên lộ ra: đơn đã `PAID` nhưng `VoucherUsage` và
`LoyaltyTransaction` vẫn kẹt `HELD`, và **điểm thưởng không bao giờ được tích**.

Nguyên nhân: webhook chỉ gọi `commitReservations` (tồn kho), quên hai thứ còn lại.

Đã tách [`orderLifecycle.js`](../../../ktln-Getshopy/qu-n-ly-ban-l/source/server/src/services/payment/orderLifecycle.js)
để ba thứ luôn đi cùng nhau — tồn kho, voucher, điểm. Commit tồn kho mà quên
voucher là mã giảm giá của khách biến mất vĩnh viễn.

**Rút ra:** mọi đường dẫn tới `PAID` phải đi qua `orderLifecycle.commitOrder()`,
không được tự viết UPDATE riêng. Áp dụng cả cho nhánh xác nhận tay ở P9.

## B.3 Quyết định hạ tầng (13/09)

| Vấn đề | Quyết định | Đã làm |
|---|---|---|
| Cổng 3000 trùng (client Getshopy vs Metabase) | Metabase → `3001` | ✅ |
| Hai Postgres | **Một instance** — CDC trỏ thẳng DB `getshopy`, bỏ `postgres_mock_source`/`app_sales` | ✅ config |
| Hai ClickHouse | **Một instance** — giữ `clickhouse-local` | ⏳ chờ gộp compose |
| Bảng CDC | `public.Order,public.OrderItem` | ✅ |
| Bảng dbt | 3 bảng: `fact_orders_detail`, `mart_revenue`, `processed_data_for_AI_rec` | ⏳ mục 3 |

⚠️ **Tên bảng PascalCase.** Prisma tạo `"Order"`, `"OrderItem"` có quote. Viết
sai hoa/thường trong `table.include.list` là Debezium không bắt được bảng nào,
và nó **không báo lỗi** — chỉ im lặng không có message nào chảy qua.

⚠️ Version ClickHouse đang lệch: Getshopy `24.8-alpine`, sandbox `23.8-alpine`.
Gộp một instance thì phải chọn, nên lấy 24.8.

⚠️ `wal_level=logical` **vẫn chưa có** trên Postgres của Getshopy. Đây là điều
kiện bắt buộc để Debezium tạo replication slot — làm luôn lúc gộp compose.

## B.4 Còn lại

- **P9** — admin queue đối soát. Spec đã viết: [results/admin-payment-queue-Sep13.md](../results/admin-payment-queue-Sep13.md)
- **Secrets sandbox** — `.env` và 2 file connector đã chuyển sang `${env:...}`,
  nhưng `local-infra-sandbox/.env` vẫn chứa password thật và chưa có `.gitignore`
- **`JWT_SECRET` fallback** — `b2c.js:8` và `index.js:32` vẫn là
  `process.env.JWT_SECRET || 'istore_secret'`. Middleware mới ném lỗi thay vì
  fallback, nhưng hai chỗ cũ chưa sửa
- **Seed lại dữ liệu** — Phase 2.0, gộp 37 script one-off thành một `seed.js`

---

# PHỤ LỤC C — Chạy hệ thống & các bẫy đã gặp

## C.1 Chạy bằng Docker Compose (cách chuẩn)

```bash
cd ktln-Getshopy/qu-n-ly-ban-l/source
docker compose up -d --build      # lần đầu, hoặc sau khi sửa code
docker compose up -d              # các lần sau
docker compose logs -f server     # xem log
docker compose down               # dừng
```

Truy cập: **http://localhost:3000** (Nginx phục vụ client, proxy `/api/` sang server:8080)

Server không expose cổng ra host — Nginx của client làm proxy. Đó là chủ ý:
chỉ một cổng mở ra ngoài.

### Rebuild khi nào

| Sửa gì | Cần làm |
|---|---|
| Code server | `docker compose up -d --build server` |
| Code client | `docker compose up -d --build client` — client build **production**, không có HMR |
| Chỉ `.env` | `docker compose up -d` (đọc lại `env_file` lúc khởi động) |
| `schema.prisma` | chạy `prisma migrate` trước, rồi rebuild server |

## C.2 Chạy native (dev, có HMR)

Nhanh hơn khi sửa frontend liên tục, nhưng cần thêm bước:

```bash
docker compose up -d postgres clickhouse redis    # chỉ hạ tầng
cd server && set -a && . ./.env && set +a && node src/index.js
cd client && npm run dev                          # http://localhost:5173
```

Cần [`docker-compose.override.yml`](../../../ktln-Getshopy/qu-n-ly-ban-l/source/docker-compose.override.yml)
để expose cổng ClickHouse/Redis ra host — file gốc cố ý không expose vì server
trong container nói chuyện qua network nội bộ. Compose tự nạp file này.

⚠️ **Project không dùng `dotenv`.** Env chỉ được nạp qua `env_file` của compose.
Chạy `node src/index.js` trực tiếp mà quên `set -a && . ./.env` thì
`SEPAY_WEBHOOK_API_KEY` rỗng → mọi webhook bị từ chối, và `JWT_SECRET` thiếu →
server không khởi động được (middleware ném lỗi, cố ý).

## C.3 Bốn bẫy đã gặp thật

### 1. `.env.local` lọt vào Docker image
`client/.dockerignore` loại `.env` nhưng **không loại `.env.local`**. Vite ưu
tiên `.env.local` hơn build arg `VITE_API_URL`, nên client build trong container
sẽ gọi về `http://localhost:8080` thay vì `/api` — hỏng ngay khi chạy compose,
mà lỗi chỉ lộ ra lúc runtime trong trình duyệt.
→ Đã thêm `.env.local`, `.env.*.local` vào cả hai `.dockerignore`.

### 2. `'VNPAY'` vs `'BANK_TRANSFER'`
Plan §A.3 ghi phải đổi tên (VietQR là chuẩn QR của Napas, không phải cổng VNPAY)
nhưng lần đầu chỉ đổi ở backend. Frontend vẫn gửi `'VNPAY'` → backend không nhận
giá trị đó → coi là COD → không sinh QR → popup không hiện, **và không có lỗi nào
báo ra**. Đơn cứ `CONFIRMED` như thường.
→ Bài học: giá trị enum đi qua ranh giới client/server phải đổi cả hai đầu trong
cùng một lần, hoặc backend phải từ chối giá trị lạ thay vì im lặng fallback.

### 3. QR ở màn "đặt hàng thành công" không có mã đối soát
Khối cũ gọi `img.vietqr.io` với nội dung ghép `"Thanh toan don hang ORD-..."`.
Khách đóng popup rồi quét QR ở màn đó → tiền vào tài khoản nhưng webhook không
tìm được đơn nào → `UNMATCHED`, phải xử lý tay.
Lỗi này chỉ lộ ra khi có tiền thật chạy qua.
→ Đã thay bằng QR server sinh, bỏ hẳn phụ thuộc `img.vietqr.io`.

### 4. Cổng ClickHouse TCP đụng MinIO
Cả hai mặc định `9000`. Override map ClickHouse TCP sang `9010`.

## C.4 Tài khoản & dữ liệu test

```
http://localhost:3000
test@getshopy.vn / 123456        (5.000 điểm)
voucher GIAM10                   giảm 10%, tối đa 2tr, đơn từ 500k
```

Seed lại dữ liệu:
```bash
cd server
node scripts/seed-categories.js
node scripts/seed-brands.js
node scripts/seed-products-inventory.js         # 26.262 sản phẩm thật
node scripts/seed-products-inventory.js 2000    # hoặc giới hạn cho nhanh
```

`seed-products-inventory.js` là idempotent và khởi tạo luôn bảng `Inventory` từ
`Product.stock` — thay cho chuỗi 37 script one-off (Phase 2.0.3).

## C.5 Giả lập SePay khi chưa có tài khoản thật

```bash
# lấy mã đối soát của đơn mới nhất
docker compose exec postgres psql -U getshopy -d getshopy -t -c \
 'SELECT payment_ref, total FROM "Order" ORDER BY date DESC LIMIT 1;'

# bắn webhook
curl -X POST http://localhost:3000/api/payment/webhook/sepay \
  -H "Content-Type: application/json" \
  -H "Authorization: Apikey $SEPAY_WEBHOOK_API_KEY" \
  -d '{"transferType":"in","transferAmount":<TOTAL>,"content":"CT tu 0987 ND <REF>","accountNumber":"0123456789","id":123456}'
```

Popup tự chuyển sang "Đã nhận được thanh toán" trong ~3 giây (polling), không cần F5.

### Webhook thật từ SePay cần URL công khai

```bash
cloudflared tunnel --url http://localhost:3000
```

⚠️ **Cổng phải khớp cách đang chạy** — đây là chỗ dễ vấp:

| Cách chạy | Tunnel trỏ vào | Vì sao |
|---|---|---|
| Docker Compose | `localhost:3000` | Server KHÔNG expose ra host; Nginx của client proxy `/api/` |
| Native (dev) | `localhost:8080` | Server chạy thẳng trên host |

Trỏ sai cổng thì tunnel trả **502** — và SePay coi đó là webhook thất bại rồi
retry, không báo gì cho bạn.

Sau khi đổi tunnel, **URL mới phải cập nhật lại bên SePay**: quick tunnel sinh
subdomain ngẫu nhiên mỗi lần khởi động. DNS mất vài giây tới vài chục giây mới
phân giải được — `curl` trả exit code 6 (không resolve được host) là bình thường
trong lúc đó, chờ thêm rồi thử lại.

Muốn URL cố định thì cần domain riêng trỏ qua Cloudflare (`cloudflared tunnel
create`), không dùng quick tunnel.

---

# PHỤ LỤC D — Vòng đời đơn hàng: QR vs COD

## D.1 Ba mốc thời gian của đơn chuyển khoản

```
t=0     đặt đơn      -> giữ chỗ trong kho (reserved +n), sinh QR + payment_ref
t=5'    đồng hồ khách hết -> QR mờ đi, NHƯNG đơn vẫn sống
t=8'    hết hạn giữ chỗ   -> job expireScheduler quét và đóng đơn
```

Khoảng 5→8 phút là **cố ý**: chuẩn EMVCo không có trường hết hạn, nên khách quét
ở phút 4:50 mà ngân hàng xử lý xong lúc 5:15 vẫn phải được nhận.

**Đã kiểm chứng thật** (đơn `GSD2JVETSPK`, 13/09):
```
payment_status: PENDING -> EXPIRED      status: PENDING_PAYMENT -> CANCELLED
kho: reserved 1 -> 0, khả dụng 110 -> 111
reservation: HELD -> RELEASED
log: [expire-job] đã đóng 1 đơn quá hạn: ORD-1789295677708
```

## D.2 Tiền về SAU khi đơn đã đóng

```
webhook tới, tra ref -> tìm thấy đơn nhưng đã EXPIRED
  └─ thử GIỮ CHỖ LẠI trong kho
     ├─ còn hàng  -> PAID + LATE_MATCHED    (khách vẫn được nhận hàng)
     └─ hết hàng  -> REFUND_REQUIRED        (vào hàng đợi admin)
```

Nguyên tắc: **không bao giờ nuốt tiền im lặng**.

## D.3 COD khác hoàn toàn

| | Chuyển khoản (QR) | COD |
|---|---|---|
| Kho lúc đặt | giữ chỗ (`reserved +n`) | **trừ thật ngay** (`on_hand −n`) |
| Hết hạn | 8 phút → tự huỷ | **không có** (`expires_at = null`) |
| Điểm thưởng | tích khi `PAID` | **tích ngay** |
| Trạng thái | `PENDING_PAYMENT` → `CONFIRMED` | `CONFIRMED` ngay, `payment_status: UNPAID` |

### Lỗ hổng đã đóng: COD bị bom hàng

Đơn COD trừ kho ngay và `expires_at = null` nên **không job nào đụng tới**.
Khách không nhận hàng → hàng biến mất khỏi tồn kho vĩnh viễn cho tới khi ai đó
sửa tay trong DB.

**Quyết định 13/09:** giữ nguyên trừ kho ngay, nhưng thêm đường huỷ đơn.

`POST /api/b2c/orders/:id/cancel` → `orderLifecycle.cancelOrder()`:

| | |
|---|---|
| Kho | reservation `COMMITTED` → cộng lại `on_hand`; `HELD` → chỉ nhả `reserved` |
| Voucher | `used_count--`, usage → `RELEASED` |
| Điểm | đảo ngược cả hai chiều — hoàn điểm đã tiêu, thu hồi điểm đã tích (`GREATEST(0,…)` vì khách có thể đã tiêu mất) |
| Đơn chưa trả tiền | `status=CANCELLED`, `payment_status=CANCELLED` |
| Đơn **đã trả tiền** | `payment_status=REFUND_REQUIRED` + giao dịch chuyển `REFUND_REQUIRED` kèm lý do — **không đánh dấu là xong khi còn nợ khách** |

Ràng buộc: chỉ chủ đơn huỷ được (`customer_id` lấy từ token), đơn `SHIPPING`/
`DELIVERED` từ chối, gọi lại lần hai không làm gì thêm (idempotent).

**Đã kiểm chứng:**
```
COD + voucher:  kho 110→108→110 · điểm 5006→5016→5006 · used_count 1→2→1
                đơn CANCELLED/CANCELLED, reservation RELEASED

CK đã PAID:     kho 110→109→110 · điểm −6 thu hồi
                đơn CANCELLED/REFUND_REQUIRED
                giao dịch REFUND_REQUIRED — "Huỷ đơn: Hết hàng"

Huỷ lần 2:      already=true, kho không đổi
```

## D.4 Bẫy: script giả lập phải ký giống server

`simulate-payment.sh` ban đầu chỉ gửi API Key. Khi bật `SEPAY_WEBHOOK_HMAC_SECRET`
thì server ưu tiên HMAC → script bị từ chối 401, mà triệu chứng nhìn y hệt
"SePay không bắn webhook". Đã sửa: script tự chọn HMAC hay API Key theo `.env`,
và ghép cả tiền tố `PAYMENT_CONTENT_PREFIX` vào nội dung chuyển khoản.
