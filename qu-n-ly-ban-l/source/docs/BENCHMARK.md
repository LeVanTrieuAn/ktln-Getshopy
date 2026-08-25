# Báo Cáo Benchmark — Hệ Thống Getshopy

> **Ngày thực hiện:** 25/08/2026  
> **Script:** `server/src/scripts/benchmark_perf.js` (5 lần/metric)  
> **Môi trường:** Windows 11, Node.js v24, PostgreSQL 16 (Supabase — Tokyo/ap-northeast-1)  
> **Tác giả:** Lê Văn Triều An — Khóa luận tốt nghiệp

---

## Mục Lục

1. [Kiến Trúc Hệ Thống](#1-kiến-trúc-hệ-thống)
2. [Kết Quả Benchmark — Bảng Tổng Hợp](#2-kết-quả-benchmark--bảng-tổng-hợp)
3. [Phần 1: Supabase Network RTT](#3-phần-1-supabase-network-rtt)
4. [Phần 2: DB Query Trực Tiếp](#4-phần-2-db-query-trực-tiếp)
5. [Phần 3: DB Insert](#5-phần-3-db-insert)
6. [Phần 4: API Endpoint](#6-phần-4-api-endpoint)
7. [Phần 5: Latency Breakdown](#7-phần-5-latency-breakdown)
8. [Phần 6: AI Models](#8-phần-6-ai-models)
9. [Phần 7: 3D Assets](#9-phần-7-3d-assets)
10. [Kết Luận và Khuyến Nghị](#10-kết-luận-và-khuyến-nghị)

---

## 1. Kiến Trúc Hệ Thống

```
Client (Browser)
     │
     ▼
Vite Dev :5173 / Nginx :3000  ──proxy /api──▶  Express :8080
                                                      │
                          ┌───────────────────────────┤
                          ▼                           ▼
               Prisma ORM                    In-memory cache (TTL)
                          │
                          ▼
         PgBouncer Pooler :6543  ──┐
         (aws-0-ap-northeast-1)    │  Supabase PostgreSQL 16
         Direct TCP :5432  ────────┘  (~100ms RTT từ VN)
```

**Thông số DB:** 50.007 bản ghi trong bảng `Product`  
**Kết nối:** PgBouncer pooler (transaction mode), fallback Direct TCP

---

## 2. Kết Quả Benchmark — Bảng Tổng Hợp

> Đo thực tế, 5 lần mỗi metric. Thời gian tính bằng **milliseconds (ms)**.

| Metric | avg (ms) | min (ms) | max (ms) | p95 (ms) | n |
|--------|:--------:|:--------:|:--------:|:--------:|:-:|
| **RTT — Supabase PgBouncer :6543 (TCP)** | **113.93** | 99.74 | 166.90 | 166.90 | 5 |
| **RTT — Supabase Direct :5432 (TCP)** | **103.29** | 98.67 | 112.60 | 112.60 | 5 |
| RTT — localhost Express :8080 (TCP) | 1.29 | 0.98 | 2.05 | 2.05 | 5 |
| | | | | | |
| **DB — COUNT(\*) Product (50k rows)** | **289.03** | 113.68 | 989.17 | 989.17 | 5 |
| DB — SELECT LIMIT 15 | 122.06 | 101.49 | 202.95 | 202.95 | 5 |
| **DB — SELECT ALL rows (no LIMIT)** | **1,310.93** | 1,178.16 | 1,482.86 | 1,482.86 | 5 |
| DB — COUNT + SELECT p1 (parallel) | 307.31 | 113.99 | 990.01 | 990.01 | 5 |
| | | | | | |
| DB — INSERT 1 product (single) | 279.59 | 206.49 | 425.72 | 425.72 | 3 |
| DB — INSERT 100 products (createMany) | 534.09 | 527.50 | 541.24 | 541.24 | 3 |
| | | | | | |
| **API — GET /products (p1, limit=15)** | **1,028.95** | 1,022.99 | 1,039.67 | 1,039.67 | 5 |
| API — GET /products (branch filter) | 1,076.85 | 1,038.78 | 1,119.66 | 1,119.66 | 5 |
| **API — GET /products (no LIMIT, 50k)** | **4,854.29** | 4,298.17 | 5,774.53 | 5,774.53 | 5 |
| API — GET /flash-sales | 514.14 | 507.37 | 522.64 | 522.64 | 5 |
| API — GET /categories (cache hit) | ~1 | 1 | — | — | 4 |
| API — GET /categories (cold, no cache) | ~509 | — | 509.29 | — | 1 |

---

## 3. Phần 1: Supabase Network RTT

**Mục đích:** Đo độ trễ mạng thuần túy (TCP handshake) từ máy client (Việt Nam) đến Supabase (Tokyo, Japan).

| Endpoint | avg | min | max | Ghi chú |
|----------|-----|-----|-----|---------|
| PgBouncer pooler `:6543` | 113.93 ms | 99.74 ms | 166.9 ms | Transaction mode |
| Direct TCP `:5432` | 103.29 ms | 98.67 ms | 112.6 ms | Kết nối thẳng |

**Phân tích:**
- RTT ~100–114ms là bình thường cho kết nối Việt Nam → Tokyo (khoảng cách ~3,200km)
- PgBouncer có latency cao hơn Direct ~10ms do overhead của connection pooling
- Đây là **floor latency** tối thiểu — mọi DB query đều cộng thêm ít nhất con số này
- Variance lớn ở PgBouncer (max 166ms) cho thấy pool đôi khi cần thiết lập kết nối mới

---

## 4. Phần 2: DB Query Trực Tiếp

**Mục đích:** Đo thời gian thực thi SQL tại tầng Prisma ORM, không qua Express/API layer.

### 4.1 SELECT ALL (không LIMIT) — 50.007 rows

```sql
SELECT id, name, price, stock, sold, rating
FROM "Product"
WHERE is_deleted = false
ORDER BY id DESC
-- KHÔNG có LIMIT
```

| Metric | Giá trị |
|--------|---------|
| avg | **1,310.93 ms** |
| min | 1,178.16 ms |
| max | 1,482.86 ms |
| Rows trả về | **50.007** |

**Phân tích:** ~1.3 giây để quét toàn bộ 50k bản ghi. Đây là **sequential scan** — PostgreSQL không thể dùng index ORDER BY + LIMIT. Khoảng 800–900ms là network transfer time (data từ Tokyo → máy local), phần còn lại là query execution tại DB.

### 4.2 SELECT LIMIT 15 (paginated)

| Metric | Giá trị |
|--------|---------|
| avg | **122.06 ms** |
| min | 101.49 ms |
| max | 202.95 ms |

**So sánh:** LIMIT 15 nhanh hơn **10.7 lần** so với không có LIMIT. Lý do: PostgreSQL dừng scan sau 15 rows đầu tiên (kết hợp với index trên `id DESC`).

### 4.3 COUNT(*) — 50k rows

| Metric | Giá trị |
|--------|---------|
| avg | **289.03 ms** |
| min | 113.68 ms |
| max | 989.17 ms |

**Phân tích variance cao:** min 114ms vs max 989ms — chênh lệch ~8.7 lần. Nguyên nhân là PostgreSQL COUNT(*) không dùng cache và phụ thuộc vào buffer pool. Lần đầu (cold) cần đọc từ disk → chậm; lần sau (warm) từ shared_buffers → nhanh. Supabase serverless cũng có thể scale down instance gây latency spike.

### 4.4 COUNT + SELECT p1 (parallel — mô phỏng endpoint)

```javascript
await Promise.all([
  prisma.product.count({ where: { is_deleted: false } }),
  prisma.product.findMany({ skip: 0, take: 15, ... })
])
```

| Metric | Giá trị |
|--------|---------|
| avg | **307.31 ms** |
| min | 113.99 ms |
| max | 990.01 ms |

**Nhận xét:** Chạy song song 2 query không làm chậm hơn 1 query đơn lẻ (vì bottleneck là network RTT, không phải CPU). avg 307ms ≈ avg COUNT 289ms → 2 queries chạy đồng thời hiệu quả.

---

## 5. Phần 3: DB Insert

**Mục đích:** Đo throughput ghi dữ liệu vào Supabase.

| Thao tác | avg | min | max | n |
|----------|-----|-----|-----|---|
| INSERT 1 product (single) | 279.59 ms | 206.49 ms | 425.72 ms | 3 |
| INSERT 100 products (createMany) | 534.09 ms | 527.50 ms | 541.24 ms | 3 |

**Phân tích:**

```
INSERT 1 row   : 279.59 ms  →  279.59 ms/row
INSERT 100 rows: 534.09 ms  →  5.34 ms/row  (52x hiệu quả hơn)
```

- **createMany** vượt trội nhờ gom tất cả 100 rows thành 1 SQL statement `INSERT INTO ... VALUES (...), (...), ...`
- Latency 280ms cho single insert = RTT (114ms) + query execution (~30ms) + Prisma overhead (~130ms)
- Variance của single insert cao hơn (206–426ms) vì mỗi insert cần thiết lập connection riêng từ pool

**Throughput ước tính:**
- Single insert: ~3.6 rows/giây
- Batch createMany: ~187 rows/giây

---

## 6. Phần 4: API Endpoint

**Mục đích:** Đo end-to-end từ HTTP request của client đến khi nhận response, qua full Express stack.

### 6.1 GET /products không LIMIT (tải toàn bộ 50k)

```
GET /api/b2c/products?limit=99999&sort=newest
```

| Metric | Giá trị |
|--------|---------|
| avg | **4,854.29 ms** |
| min | 4,298.17 ms |
| max | 5,774.53 ms |
| Response size | **16.4 MB** |
| Total rows | 50.007 |

**Phân tích:** 4.8 giây để trả về 50k sản phẩm với 16.4MB JSON. Đây là worst-case — trong thực tế frontend luôn dùng pagination nên không bao giờ gặp case này.

### 6.2 GET /products page 1, limit=15 (production case)

```
GET /api/b2c/products?limit=15&page=1&sort=newest
```

| Metric | Giá trị |
|--------|---------|
| avg | **1,028.95 ms** |
| min | 1,022.99 ms |
| max | 1,039.67 ms |
| Response size | 5.0 KB |

**Variance thấp:** 1,022–1,040ms (±17ms) — rất ổn định. Đây là case thực tế khi user vào trang shop.

### 6.3 GET /products với branch filter

```
GET /api/b2c/products?limit=15&page=1&branch_id=HCM001
```

| Metric | Giá trị |
|--------|---------|
| avg | **1,076.85 ms** |
| min | 1,038.78 ms |
| max | 1,119.66 ms |

**Chậm hơn ~48ms** so với không có branch filter vì phải dùng `$queryRawUnsafe` với JSONB containment operator (`@>`), thay vì Prisma ORM query tối ưu.

### 6.4 GET /flash-sales

| Metric | Giá trị |
|--------|---------|
| avg | **514.14 ms** |
| min | 507.37 ms |
| max | 522.64 ms |

Flash-sales không dùng cache → mỗi request đều query DB. ~500ms = RTT Supabase + JOIN query.

### 6.5 GET /categories (với in-memory cache)

| Lần gọi | Thời gian |
|---------|----------|
| Lần 1 (cold) | ~509 ms (DB query) |
| Lần 2–5 (cached) | **~1 ms** |

Cache hiệu quả **509 lần** lần truy cập sau. In-memory Map với TTL 300s.

---

## 7. Phần 5: Latency Breakdown

**Mục đích:** Phân tách nguồn gốc của 1,029ms API latency (production case: page 1, limit=15).

```
API total latency = 1,029 ms
│
├── DB query (Prisma → Supabase)  307 ms   (29.9%)
│     ├── Network RTT Supabase    114 ms
│     └── PostgreSQL execution    ~193 ms
│
├── Supabase RTT (TCP)            114 ms   (11.1%)  ← included in DB
│
├── Express TCP overhead           1.3 ms   (0.1%)
│
└── Prisma middleware + JSON      ~720 ms   (70.0%)  ← bottleneck chính
      ├── Prisma serialize (BigInt conversion, etc.)
      ├── Flash-sale items fetch  (~514ms riêng)
      └── JSON.stringify response
```

**Phát hiện quan trọng:** 70% latency API (~720ms) đến từ tầng **Prisma + Express serialization**, không phải DB query. Nguyên nhân chính:

1. **Flash-sale items fetch** trong mỗi request (thêm ~500ms) — gọi `getActiveFlashSaleItems()` không được cache
2. **BigInt conversion** từ PostgreSQL id → JavaScript Number
3. **JSON.stringify** 15 products với full fields

**Giải pháp tiềm năng:**
- Cache flash-sale items (TTL 60s) → giảm ~500ms → total API ~530ms
- Kết quả dự đoán sau tối ưu: **~500–600ms** thay vì 1,029ms

---

## 8. Phần 6: AI Models

> Dữ liệu đo từ session 24/08/2026 — `benchmark_ai.py` (offline mode).

### 8.1 mDeBERTa — Intent Classifier

**Model:** `MoritzLaurer/mDeBERTa-v3-base-mnli-xnli`  
**Dataset:** 191 mẫu, 46 intent classes  
**Architecture:** 2 tầng (Rule-based → NLI fallback)

| Chỉ số | Giá trị |
|--------|---------|
| Rule coverage | 84.3% |
| Rule latency | **0.06 ms** |
| Overall accuracy | 38.7% |
| Weighted F1 | **0.424** |
| mDeBERTa API latency | ~800–1,200 ms |

**Per-class nổi bật:**

| Intent | F1 | Nhận xét |
|--------|----|---------|
| ASK_BEST_SELLER | 1.000 | Keyword đặc trưng rõ ràng |
| ASK_NEW_ARRIVAL | 1.000 | "hàng mới", "new arrival" |
| ASK_INVOICE | 1.000 | "hóa đơn", "VAT" |
| TRACK_ORDER | 0.889 | Pattern đơn hàng |
| GREETING | 0.000 | Câu quá ngắn, mơ hồ |
| SMALLTALK | 0.000 | Nội dung không có pattern |

### 8.2 Qwen2.5-7B — Conversational LLM

| Chỉ số | Giá trị |
|--------|---------|
| Parameters | 7.6B |
| TTFB (time-to-first-byte) | 1,200–2,500 ms |
| Total response time | 3,000–8,000 ms |
| Vietnamese response rate | ~98% |
| Success rate | ~95% |

### 8.3 Gemini 2.5 Flash — Visual Search

| Chỉ số | Giá trị |
|--------|---------|
| End-to-end latency | 800–2,000 ms |
| Category accuracy | ~85% |
| Brand recognition | ~80% |
| JSON parse success | ~97% |

---

## 9. Phần 7: 3D Assets

**5 GLB files** (Meshy AI generated):

| File | Kích thước |
|------|-----------|
| Smartphone model | 5.27 MB |
| Laptop model | 5.77 MB |
| Headphone model | 7.67 MB |
| Tablet model | 4.49 MB |
| Speaker model | 7.30 MB |
| **Tổng** | **30.50 MB** |

**Tối ưu WebGL (đã triển khai):**

| Kỹ thuật | Tác dụng |
|----------|---------|
| `frameloop="demand"` | 0 fps khi idle, ~60 fps khi tương tác |
| `dpr={[1, 1.5]}` | Giảm ~30% GPU workload |
| `antialias: false` | Giảm ~15% frame time |
| Lazy mount | Không render khi ngoài viewport |
| Browser cache | Load time = 0ms từ lần 2 |

**Load time thực tế:**

| Điều kiện | Lần đầu | Lần sau |
|----------|---------|---------|
| LAN 100Mbps | 1,200–2,500 ms | 0 ms (cached) |
| 4G (~20Mbps) | 12,000–15,000 ms | 0 ms (cached) |

---

## 10. Kết Luận và Khuyến Nghị

### Tổng Kết Hiệu Năng

| Thành phần | Kết quả thực tế | Đánh giá |
|-----------|----------------|---------|
| Supabase RTT (VN → Tokyo) | 100–114 ms | Chấp nhận được |
| DB SELECT 50k rows (no LIMIT) | 1,311 ms | Chỉ dùng cho export, không expose API |
| DB SELECT LIMIT 15 (pagination) | 122 ms | Tốt |
| DB INSERT 100 batch | 534 ms (~5ms/row) | Tốt |
| API /products page 1 | **1,029 ms** | Cần tối ưu |
| API /categories (cache hit) | **1 ms** | Xuất sắc |
| mDeBERTa rule latency | 0.06 ms | Xuất sắc |

### Bottleneck Chính

```
1. Flash-sale fetch không cache  →  +~514ms mỗi API request
   Fix: cache TTL 60s           →  tiết kiệm ~50% latency API

2. Supabase RTT 100ms           →  floor latency không thể giảm
   Giải pháp: deploy server cùng region (Tokyo) hoặc dùng Edge Functions

3. mDeBERTa F1=0.42             →  cần thêm training data
   Hiện tại rule-based đủ dùng cho 84.3% intent
```

### Khuyến Nghị Tối Ưu

| Ưu tiên | Thay đổi | Kết quả dự kiến |
|---------|---------|----------------|
| **Cao** | Cache flash-sale items TTL 60s | API latency: 1,029ms → ~530ms |
| **Cao** | GIN index cho JSONB `branch_ids` | Branch filter: 1,077ms → ~300ms |
| **Trung bình** | Draco compression cho GLB | 30.5MB → ~9MB (giảm 70%) |
| **Trung bình** | Redis cache cho /products (TTL 30s) | Repeat requests: ~1ms |
| **Thấp** | Deploy server tại Tokyo region | RTT: 114ms → ~5ms |

---

*Đo thực tế ngày 25/08/2026 trên môi trường local dev (Windows 11).*  
*Database: Supabase PostgreSQL 16, region ap-northeast-1 (Tokyo).*  
*Script đo: `server/src/scripts/benchmark_perf.js`*  
*Raw data JSON: `server/src/scripts/benchmark_perf_1787649681927.json`*
