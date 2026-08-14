![1786684492983](image/PERF-PRODUCTS/1786684492983.png)![1786684489026](image/PERF-PRODUCTS/1786684489026.png)

# Hiệu năng API Products — nguyên nhân 9s load 50k sản phẩm

## 1. Hiện trạng đo được

| Endpoint                       | File                                                                | Vấn đề                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /b2b/products`          | [server/src/routes/b2b.js:156-160](../server/src/routes/b2b.js#L156) | `findMany({ where: { is_deleted: false }, orderBy: { id: 'desc' } })` — **không phân trang**, trả toàn bộ ~50k dòng mỗi lần gọi. Đây là endpoint trang quản trị (`GeneralManagement.jsx`) gọi khi mount, khớp với triệu chứng "9s load 50k product".                                                                     |
| `GET /api/products` (legacy) | [server/src/index.js:528-535](../server/src/index.js#L528)           | Tương tự —`findMany()` không điều kiện, không phân trang.                                                                                                                                                                                                                                                                                  |
| `GET /b2c/products`          | [server/src/routes/b2c.js:50-97](../server/src/routes/b2c.js#L50)    | Có tham số`page`/`limit` nhưng **phân trang sai chỗ**: `findMany({ where, orderBy })` kéo *toàn bộ* tập kết quả phù hợp filter về Node rồi mới `.slice(skip, skip+limit)` ở dòng 68 và 82. Với filter lỏng (vd không chọn category), vẫn kéo hàng chục nghìn dòng về chỉ để lấy 12 dòng hiển thị. |

## 2. Vì sao chậm — chuỗi nguyên nhân

1. **Phân trang ở tầng ứng dụng thay vì tầng DB.** Thay vì `LIMIT/OFFSET` trong SQL, code fetch toàn bộ rồi cắt mảng trong JS → Postgres phải trả toàn bộ 50k dòng qua mạng bất kể client chỉ cần 12–50 dòng.
2. **Không giới hạn cột trả về (`select`).** Prisma mặc định lấy tất cả cột kể cả `images`, `variants`, `description`, `branch_ids` (JSON) — những cột không cần cho danh sách/dropdown nhưng vẫn được serialize và truyền đi cho từng dòng.
3. **DB ở xa (Supabase) qua pgbouncer.** `DATABASE_URL` trỏ qua pooler port 6543 — mỗi query vẫn phải đi round-trip qua internet đến Supabase, cộng thêm thời gian Postgres quét bảng không có index phù hợp cho filter (`category_id`, `brand_id`, `is_deleted`) lẫn `ILIKE` search (`mode: 'insensitive'` ở dòng 60 b2c.js dùng `contains` — không tận dụng được index B-tree thường, cần trigram/GIN).
4. **Không có cache.** Redis đã kết nối sẵn trong `index.js` nhưng không được dùng cho danh sách sản phẩm — mỗi lần load lại admin page / trang shop đều đánh thẳng DB dù danh mục sản phẩm ít thay đổi trong vài giây/phút.
5. **BigInt → Number mapping trên từng dòng** (`products.map(p => ({...p, id: Number(p.id)}))`) — chi phí nhỏ nhưng cộng dồn trên 50k dòng, chạy trên Node đơn luồng, chặn event loop trong lúc serialize response.
6. **Schema không có index phụ trợ** — `prisma/schema.prisma` model `Product` chỉ có PK trên `id`, không có `@@index` cho `category_id`, `brand_id`, `is_deleted`, `price` dù các cột này được dùng để filter/sort thường xuyên.

→ Nút thắt lớn nhất là **(1) fetch-all-then-slice**, không phải bản thân network RTT tới Supabase. Sửa riêng mục (1) và (2) đã cắt phần lớn thời gian vì lượng dữ liệu truyền giảm từ ~50.000 dòng xuống đúng số dòng 1 trang (12–50 dòng).

## 3. Đề xuất giải pháp (ưu tiên theo tác động / công sức)

### 3.1. Phân trang thật ở tầng DB (bắt buộc, tác động lớn nhất)

- `b2c.js` GET `/products`: chuyển `skip`/`take` vào query Prisma, không fetch-all-then-slice. `total` lấy bằng `prisma.product.count({ where })` riêng (1 query nhẹ, không kéo dữ liệu).
- `b2b.js` GET `/products`: thêm `page`/`limit` bắt buộc (mặc định vd 50), FE (`GeneralManagement.jsx`) chuyển sang phân trang thay vì load hết vào 1 bảng.
- Xoá hoặc giới hạn `GET /api/products` legacy (deprecated) — nếu còn nơi dùng, thêm `take` mặc định (vd 100) để tránh full-scan vô tình.

### 3.2. Giới hạn cột trả về cho danh sách

- Thêm `select` chỉ lấy field cần cho card/dropdown (`id, name, price, original_price, image, stock, rating, sold, category_id, brand_id`), bỏ `images/variants/description/branch_ids` khỏi list — các field này chỉ cần ở `GET /products/:id` (trang chi tiết).

### 3.3. Index cho các cột filter/sort

```prisma
model Product {
  ...
  @@index([category_id])
  @@index([brand_id])
  @@index([is_deleted, id])
  @@index([price])
}
```

Với search theo tên (`contains`, insensitive), cân nhắc `CREATE EXTENSION pg_trgm` + `CREATE INDEX ... USING GIN (name gin_trgm_ops)` nếu tập dữ liệu tiếp tục tăng — B-tree thường không tăng tốc `ILIKE '%...%'`.

### 3.4. Cache tầng Redis cho danh sách hay lặp lại

- Cache kết quả trang phổ biến (vd trang 1, không filter, sort mặc định) theo key `products:list:{hash(query)}`, TTL ngắn (15–30s) — đủ giảm tải cho các lượt refresh liên tiếp mà vẫn coi là "gần real-time" vì hệ đã có CDC/audit riêng cho tầng phân tích.
- Cache `categories`, `brands` (ít đổi) với TTL dài hơn (vd 5 phút), invalidate khi có thay đổi qua API admin.

### 3.5. Giảm chi phí serialize

- Nếu vẫn cần trả nhiều dòng (vd export), dùng streaming JSON response thay vì `res.json()` dựng toàn bộ mảng trong memory trước khi gửi.
- Xem xét đổi `BigInt` id sang cách map ít tốn hơn hoặc đổi kiểu cột `id` sang `Int`/`BigInt` xử lý ở tầng Prisma (không bắt buộc, tác động nhỏ so với 3.1/3.2).

## 4. SLA kỳ vọng sau tối ưu

| Kịch bản                                                   | Hiện tại (đo được)                                | Mục tiêu sau tối ưu                       | Cách đo                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| `GET /b2c/products?page=1&limit=12` (không filter)        | — (đi qua đường fetch-all, tỉ lệ với 9s ở b2b) | **p95 < 300ms**                         | thời gian phản hồi API, đo từ server (Express middleware timing) |
| `GET /b2b/products?page=1&limit=50` (admin)                | ~9s (fetch toàn bộ 50k dòng)                         | **p95 < 300ms**                         | như trên                                                            |
| `GET /products/:id` (chi tiết)                            | chưa đo, không bị ảnh hưởng bởi fix này        | **p95 < 150ms**                         | như trên                                                            |
| `GET /categories`, `GET /brands` (cache hit)             | chưa đo                                               | **p95 < 50ms**                          | Redis cache hit                                                       |
| Tải trang danh sách sản phẩm trên FE (network + render) | chưa đo, phụ thuộc API trên                        | **< 1s** cảm nhận người dùng (TTI) | Chrome DevTools / Web Vitals                                          |

**Ghi chú về "RTT":** với kiến trúc hiện tại (1 API call trả 1 trang dữ liệu), không có nhiều round-trip cần giảm — đây thực chất là bài toán **giảm khối lượng dữ liệu truyền + số dòng DB phải quét/serialize** mỗi request, không phải giảm số lần round-trip. Sau khi áp dụng 3.1–3.2, mỗi request chỉ còn tương đương 1 round-trip DB truy vấn ≤ 50 dòng thay vì 50.000 dòng.

## 5. Việc cần làm (theo thứ tự)

1. Sửa `b2c.js` `/products`: `skip/take` trong Prisma + `count()` riêng cho `total`. *(tác động lớn nhất, làm trước)*
2. Sửa `b2b.js` `/products`: thêm phân trang, cập nhật `GeneralManagement.jsx` gọi kèm `page/limit`.
3. Thêm `select` giới hạn cột cho cả hai endpoint danh sách.
4. Thêm index vào `schema.prisma`, chạy `prisma migrate` (hoặc `db push` nếu chưa dùng migration history).
5. Thêm cache Redis cho `categories`/`brands` và (tuỳ chọn) trang sản phẩm phổ biến.
6. Đo lại p95 bằng cách gọi API thật (vd `autocannon`/`k6`) trước/sau để có số liệu so sánh cho phần thực nghiệm.
