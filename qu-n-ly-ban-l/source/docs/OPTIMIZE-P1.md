![1786603588146](image/OPTIMIZE-P1/1786603588146.png)

# Optimize P1 — Product listing performance

Triển khai thực tế cho các giải pháp đề xuất ở [PERF-PRODUCTS.md](PERF-PRODUCTS.md). Toàn bộ số liệu bên dưới đo trên môi trường local (Postgres 16 chạy trong docker-compose, seed đúng 50.000 sản phẩm bằng `server/src/seed-mock-v2.js`) — không phải trên Supabase production, vì lý do tái lập được (không phụ thuộc độ trễ mạng biến thiên) và vì repo hiện chưa có credential Supabase thật để đo.

## 1. Giải pháp đã triển khai

| # | Giải pháp                                                                                          | File                                                                                                                                                             | Trạng thái                                                                 |
| - | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1 | Phân trang thật ở tầng DB (`skip`/`take` + `count()` riêng) thay vì fetch-all-rồi-slice | [server/src/routes/b2c.js](../server/src/routes/b2c.js#L50) (`GET /b2c/products`)                                                                               | ✅ Xong cho nhánh không lọc`branch_id` (đường phổ biến nhất)      |
| 2 | Giới hạn cột trả về (`select`) — bỏ `description`/`variants` khỏi list view            | [b2c.js](../server/src/routes/b2c.js#L50), [b2b.js](../server/src/routes/b2b.js#L156)                                                                              | ✅                                                                           |
| 3 | Index cho cột filter/sort (`category_id`, `brand_id`, `is_deleted+id`, `price`)             | [server/prisma/schema.prisma](../server/prisma/schema.prisma#L75)                                                                                                 | ✅ (đã push bằng`prisma db push`)                                       |
| 4 | Cache Redis cho`categories`/`brands` (TTL 300s) + invalidate khi admin sửa brand                | [server/src/redis.js](../server/src/redis.js), dùng ở [b2c.js](../server/src/routes/b2c.js#L10), invalidate ở [b2b.js](../server/src/routes/b2b.js) (brand CRUD) | ✅                                                                           |
| 5 | Streaming JSON / giảm chi phí serialize BigInt                                                     | —                                                                                                                                                               | ⛔ Chưa làm — tác động nhỏ so với 1–4, để ở hướng phát triển |

**Ngoài phạm vi PERF-PRODUCTS.md nhưng phải sửa trước khi đo được gì cả:** container `server` chạy trên Apple Silicon (arm64) nhưng image `node:20-alpine` không có sẵn `openssl`, khiến Prisma không nạp được query engine (`libssl.so.1.1: No such file`) — mọi query đều lỗi 500 trước khi chạm tới vấn đề hiệu năng. Đã fix bằng cách thêm `apk add --no-cache openssl` vào `command` của service `server` trong [docker-compose.yml](../docker-compose.yml#L33) và thêm target `linux-musl-arm64-openssl-3.0.x` vào `binaryTargets` trong `schema.prisma`.

### 1.1. Giới hạn đã biết (được chấp nhận có chủ đích, không phải bug bỏ sót)

- **`b2c.js` nhánh có `branch_id`**: `branch_ids` là cột JSON nên không lọc được thẳng bằng SQL `LIMIT/OFFSET` mà vẫn đúng số đếm. Giải pháp tạm: lấy tối đa `BRANCH_FILTER_CAP = 5000` bản ghi mới nhất rồi lọc/phân trang trong app — **nếu tập kết quả khớp filter lớn hơn 5000, `total` sẽ bị đếm thiếu**. Với dữ liệu mock hiện tại (mọi sản phẩm đều thuộc cả 3 chi nhánh) test cho thấy con số này bị cắt ở đúng 5000 thay vì 50.000 thật. Cách sửa đúng: đổi `branch_ids` sang bảng quan hệ `product_branch` hoặc dùng jsonb containment (`branch_ids @> '["HCM001"]'::jsonb`) qua raw query — chưa làm ở P1 này.
- **`b2b.js` `GET /products`** (trang quản trị): vẫn trả **toàn bộ** catalog (không phân trang) vì `GeneralManagement.jsx` dùng mảng này cho 3 việc cùng lúc — bảng dữ liệu, tra tên sản phẩm theo id, dropdown chọn sản phẩm cho flash sale. Phân trang thật đòi hỏi tách FE thành: bảng phân trang server-side + 1 endpoint tra cứu nhẹ (`id, name`) riêng cho dropdown/lookup — chưa làm ở P1 vì cần sửa FE, để ở mục 5. Vì vậy **endpoint này chưa đạt SLA** (xem bảng §3), chỉ giảm được payload nhờ bỏ `description`/`variants`.

## 2. Test tự động

File: [server/tests/products.perf.test.js](../server/tests/products.perf.test.js), chạy bằng Node test runner có sẵn (không thêm dependency): `npm run test:perf` (cần seed trước bằng `npm run seed:mock`).

| Test                       | Kiểm tra gì                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------- |
| phân trang DB-level       | `limit=12` → đúng 12 phần tử, `total`/`totalPages` khớp                     |
| không trùng trang        | id ở trang 1 và trang 2 không giao nhau                                              |
| filter category            | mọi sản phẩm trả về đúng`category_id` đã lọc, `total` nhỏ hơn toàn bộ |
| list không lộ cột nặng | `description`/`variants` không xuất hiện trong response list (cả b2c lẫn b2b)  |
| cache nhất quán          | 2 lần gọi`/categories` liên tiếp trả cùng dữ liệu (cache không làm lệch)   |
| SLA`GET /products`       | p95 của 20 request liên tiếp phải dưới ngưỡng                                   |
| SLA`GET /products/:id`   | tương tự, ngưỡng riêng cho trang chi tiết                                        |

**Kết quả chạy thật (2026-08-12, local):**

```
# tests 8
# pass 8
# fail 0
b2c /products p95 over 20 requests: 6.9ms (SLA: 300ms)
b2c /products/:id p95 over 20 requests: 2.9ms (SLA: 150ms)
```

## 3. Benchmark trước/sau và đối chiếu SLA

### 3.1. Benchmark tầng query (tách khỏi HTTP/network) — `server/scripts/benchmark-products.js`

So sánh trực tiếp 2 cách viết query qua Prisma trên cùng DB đã seed 50.000 dòng, `page=3, limit=12`, 15 lần lặp:

```
BEFORE (fetch-all + slice)   avg=1084.1ms  p50=1079.8ms  p95=1146.0ms
AFTER  (skip/take + count)   avg=4.4ms    p50=3.8ms    p95=13.9ms
Speedup (avg): 243.6x
Correctness check — total matches: true (before=50000, after=50000)
```

Chạy lại: `docker exec source-server-1 node scripts/benchmark-products.js 15`

### 3.2. Benchmark end-to-end (HTTP thật, đo bằng `curl`, cùng máy → độ trễ mạng ≈ 0)

| Endpoint                                              | Trước                                            | Sau             | Cải thiện                                                            |
| ----------------------------------------------------- | -------------------------------------------------- | --------------- | ---------------------------------------------------------------------- |
| `GET /b2c/products?page=1&limit=12` (không filter) | 1.250s                                             | 0.028s          | ~44x                                                                   |
| `GET /b2c/products?category_id=c1&page=2&limit=12`  | (chưa đo riêng, cùng đường code với trên) | 0.010s          | —                                                                     |
| `GET /b2b/products` (admin, full dump)              | 1.592s / 34.1MB                                    | 1.233s / 23.1MB | ~23% thời gian, ~32% payload                                          |
| `GET /categories` (cache)                           | 0.0047s (đã nhanh vì local)                     | 0.0025s         | nhỏ tại local; ý nghĩa thật ở Supabase (mạng chậm hơn nhiều) |

**Lưu ý quan trọng:** các số "trước" ở local đã là 1–1.6s dù Postgres chạy cùng máy, tức là 0 độ trễ mạng — nghĩa là phần lớn 9s bạn thấy trên Supabase thật là do lượng dữ liệu quét/serialize (fetch-all), *cộng thêm* độ trễ mạng tới Supabase qua pgbouncer. Sau khi sửa, phần fetch-all đã biến mất nên trên Supabase thật, thời gian còn lại sẽ gần với 1 round-trip cho ≤ 50 dòng — dự kiến vẫn nhanh hơn nhiều so với 9s, nhưng **con số tuyệt đối trên Supabase cần đo lại riêng khi có credential thật** (số trong bảng trên là cận dưới, đo trên local).

### 3.3. Đối chiếu với SLA đề ra ở PERF-PRODUCTS.md

| Kịch bản                                       | Mục tiêu SLA  | Thực đo (local)               | Đạt?                                            |
| ------------------------------------------------ | --------------- | ------------------------------- | ------------------------------------------------- |
| `GET /b2c/products?page=1&limit=12`            | p95 < 300ms     | p95 = 6.9ms (20 request)        | ✅ Đạt, dư nhiều margin                       |
| `GET /products/:id`                            | p95 < 150ms     | p95 = 2.9ms (20 request)        | ✅ Đạt                                          |
| `GET /categories`, `GET /brands` (cache hit) | p95 < 50ms      | 2.5ms                           | ✅ Đạt                                          |
| `GET /b2b/products` (admin)                    | p95 < 300ms     | ~1233ms                         | ❌ Chưa đạt — full-dump vẫn còn, xem §1.1  |
| Branch-filtered list, tổng > 5000               | đúng`total` | Sai lệch khi tổng thật > cap | ⚠️ Giới hạn đã biết, không phải hồi quy |

## 4. Việc còn lại (không thuộc P1)

1. Phân trang thật cho `b2b.js` `/products` + tách endpoint lookup nhẹ `{id, name}` cho dropdown/tra cứu, cập nhật `GeneralManagement.jsx`.
2. Đổi `branch_ids` sang jsonb containment query hoặc bảng quan hệ để filter theo chi nhánh chính xác ở mọi quy mô.
3. Đo lại toàn bộ bảng benchmark trên Supabase thật (cần `DATABASE_URL`/`DIRECT_URL` production) để có số liệu RTT thật cho phần thực nghiệm khoá luận.
4. (Tuỳ chọn) GIN/trigram index cho tìm kiếm `name` (`ILIKE`) nếu tập dữ liệu lớn hơn.

## 5. Cách tái lập

> Cập nhật sau khi merge nhánh `main` (đã đổi sang docker-compose kiểu production — build bằng Dockerfile, healthcheck, tên project `getshopy`, DB `getshopy` thay vì `istore`). Entrypoint container tự suy ra `DATABASE_URL` từ `POSTGRES_*` khi chạy `node src/index.js`, nhưng biến này **không** tự có khi `docker exec` một lệnh khác vào container — phải truyền tay như dưới.

```bash
cd qu-n-ly-ban-l/source
cp .env.example .env   # nếu chưa có
docker compose up -d --build

DB_URL="postgresql://getshopy:getshopy_dev_password@postgres:5432/getshopy?schema=public"
docker exec -e DATABASE_URL="$DB_URL" -e DIRECT_URL="$DB_URL" getshopy-server-1 npm run seed:mock   # seed 50.000 sản phẩm
docker exec getshopy-server-1 npm run test:perf                                                      # 8 test tự động
docker exec -e DATABASE_URL="$DB_URL" -e DIRECT_URL="$DB_URL" getshopy-server-1 node scripts/benchmark-products.js 15
```

**Đã re-run toàn bộ trên hạ tầng mới (2026-08-13):** 8/8 test vẫn pass (p95 `/products` = 11.2ms, p95 `/products/:id` = 3.6ms), benchmark before/after = 1315ms → 8.2ms (159.6x) — cùng cỡ với số đo trên hạ tầng cũ, xác nhận merge không làm hỏng các tối ưu.
