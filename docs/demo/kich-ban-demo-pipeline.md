# Kịch bản demo pipeline: từ một đơn POS tới gợi ý của AI-Rec

Bắn đơn tại quầy vào PostgreSQL, rồi lần theo đúng đơn đó qua từng tầng: Kafka → MinIO → ClickHouse (hồ, kho, đối soát) → AI-Rec (train lại, cache, response). Phần trình chiếu mất khoảng 12 phút. Phần chuẩn bị khoảng 15 phút, làm trước khi hội đồng vào.

> **Chưa diễn tập.** Thời gian chờ trong bảng lấy từ thực nghiệm tải ngày 23/10/2026 trên bộ 3 triệu đơn ([benchmark](../implement-phase/results/benchmark-tai-3tr-don-Oct23.md)). Chạy thử trọn kịch bản một lần trên máy demo, ghi lại thời gian thật và quay màn hình làm phương án dự phòng.

| # | Bước | Màn hình | Chờ |
|---|---|---|---|
| 1 | Bắn đơn | Terminal | 1–2 phút bắn |
| 2 | Đơn vào Kafka | Kafka UI — http://localhost:8085 | vài giây |
| 3 | Đơn xuống hồ | MinIO — http://localhost:9001 | ~15–20 s |
| 4 | Đọc đơn từ hồ | ClickHouse Play — http://localhost:8123/play | vài giây mỗi truy vấn |
| 5 | Dựng kho + đối soát | Terminal (dbt), ClickHouse | ~2–2,5 phút |
| 6 | AI-Rec train lại | Terminal (log) | ~2 phút |
| 7 | Response gợi ý | Swagger — http://localhost:8000/docs | tức thì |

Lệnh viết cho **Git Bash**, chạy từ thư mục gốc repo. Không lệnh nào in mật khẩu: mọi bí mật được đọc từ biến môi trường bên trong container.

---

## 0. Chuẩn bị (trước giờ demo)

### 0.1 Bật stack kèm lớp phủ demo

```bash
DC="docker compose -f docker-compose.yml -f docker-compose.demo.yml"
$DC up -d
$DC ps          # chờ các service "healthy"; bootstrap "Exited (0)" là đúng
```

[`docker-compose.demo.yml`](../../docker-compose.demo.yml) thêm Kafka UI và mở cổng 8000 của AI-Rec. File gốc không bị sửa.

Nếu trình chiếu qua link public: kiểm tra tunnel cloudflared sau khi bật lại môi trường, xem URL có đổi không.

### 0.2 Giảm tải RAM

Ở 3 triệu đơn, mỗi lượt dbt kéo RAM khả dụng của máy ảo xuống còn 0,2–1,5 GiB. Ngày 23/10, khoảng 50 phút sau khi nạp xong (swap đã đầy), ClickHouse chết đột ngột giữa `checksum_orders` ([log](../implement-phase/results/benchmark-tai-3tr-don-Oct23/clickhouse-sap-16h32.log)). Trước buổi demo:

- khởi động lại Docker Desktop rồi mới bật stack, để demo chạy trên máy ảo có swap còn trống; không để stack chạy sẵn nhiều giờ trước đó;
- đóng bớt ứng dụng nặng trên máy (trình duyệt nhiều tab, IDE);
- nếu không trình chiếu Metabase hay chatbot thì dừng chúng: `$DC stop metabase ai-bot`.

### 0.3 Dừng lịch dbt

Bước 5 chạy dbt bằng tay. ofelia mặc định **cho chạy chồng lượt**. Hai lượt `checksum_orders` cùng lúc, mỗi lượt khoảng 3,2 GiB, rất dễ làm máy ảo OOM. Dừng lịch trước:

```bash
$DC stop dbt-scheduler
```

### 0.4 Hàm tắt cho truy vấn

```bash
pg() { $DC exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off'; }
ch() { $DC exec -T clickhouse sh -c 'clickhouse-client -n --user "${CLICKHOUSE_USER:-default}" --password "$CLICKHOUSE_PASSWORD"'; }
```

Truyền SQL qua heredoc, ví dụ `ch <<'SQL' … SQL`.

### 0.5 Chọn khách demo và chụp trạng thái "trước"

Ở bước 1, máy POS được chạy với `--customers 1`, nên mọi đơn đều thuộc về khách có `id` nhỏ nhất:

```bash
pg <<'SQL'
SELECT id, email, full_name FROM "B2CCustomer" WHERE email IS NOT NULL ORDER BY id LIMIT 1;
SQL
KH=<id vừa in>
```

Lưu trạng thái trước khi bắn đơn, để so sánh ở bước 5 và 7:

```bash
ch <<SQL
SELECT count() AS so_dong_mua, max(OrderedAt) AS lan_mua_cuoi
FROM serving.purchase_events_for_AI_rec WHERE CustomerID = '$KH'
FORMAT PrettyCompactMonoBlock
SQL

curl -s "localhost:8000/api/v1/recommend/customer/$KH?top_k=10" > truoc.json
curl -s localhost:8000/health
```

### 0.6 Mở sẵn các tab

| Tab | Đăng nhập |
|---|---|
| Kafka UI http://localhost:8085 | không cần; ở chế độ chỉ đọc |
| MinIO http://localhost:9001 | `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` trong `.env` |
| ClickHouse http://localhost:8123/play | `CLICKHOUSE_USER` / `CLICKHOUSE_PASSWORD` trong `.env` |
| Swagger AI-Rec http://localhost:8000/docs | không cần |

Kiểm tra trước trên Kafka UI, tab **Kafka Connect**: `postgres-source-connector` và `minio-sink-connector` phải ở trạng thái **RUNNING**.

---

## 1. Bắn đơn — máy POS giả lập

```bash
$DC --profile seed run --rm --entrypoint sh seed-data -c \
  'POS_DB_HOST=$PGHOST POS_DB_USER=$PGUSER POS_DB_PASSWORD=$PGPASSWORD POS_DB_NAME=$PGDATABASE exec python pos_simulator.py --stream --rate 30 --customers 1'
```

- Script ghi 30 đơn/phút thẳng vào PostgreSQL, như một hệ thống POS khác ghi chung database.
- Mỗi dòng in ra một mã đơn, ví dụ `đơn POS-1761…-000000 · 12.490.000đ · 2 dòng`. Chép một mã: `DON=POS-…`.
- Để chạy khoảng 1–2 phút (30–60 đơn), rồi bấm **Ctrl-C**.
- Cảnh báo "chỉ có 1 khách" là bình thường: kịch bản cố ý dồn đơn vào một khách để thấy rõ thay đổi ở AI-Rec.

**Nói:** Hệ thống bán hàng không biết gì về pipeline. Đơn được ghi như mọi giao dịch khác; Debezium đọc WAL của PostgreSQL để bắt thay đổi.

> Lệnh dùng `--entrypoint sh` vì `pos_simulator.py` mặc định kết nối `localhost` và không đọc biến `PG*` mà service `seed-data` đặt sẵn. Mẹo này chuyển biến ngay trong container nên mật khẩu không hiện trên màn hình.
>
> Giờ trong mã đơn và cột `order_date` là **giờ ngẫu nhiên trong ngày** do bộ sinh rải ra, nên đơn có thể mang giờ ở tương lai. Tra đơn bằng mã. Muốn đo độ trễ thì dùng `event_ts` (lúc Debezium xử lý), không dùng `order_date`.

## 2. Đơn vào Kafka — vài giây

Trên Kafka UI:

1. **Topics → `cdc_prod.public.Order` → Messages.** Dán mã đơn vào ô tìm kiếm.
   - Mở message, phần `payload` có: `op: "c"` (tạo mới), `after.id` = mã đơn, `after.payment_status: "PAID"`, `source.ts_ms` = lúc PostgreSQL commit.
2. **Topic `cdc_prod.public.OrderItem`:** các dòng hàng của cùng đơn.
3. **Consumers → `connect-minio-sink-connector`:** lag tăng khi đang bắn đơn, rồi về 0 trong khoảng 15 s.

**Nói:** Mỗi thay đổi là một sự kiện có cả trạng thái trước và sau (`before` / `after`). Kafka giữ sự kiện để phía sau đọc lại được.

## 3. Đơn xuống hồ — khoảng 15–20 s

Trên MinIO: **Object Browser → `data-lake` → `topics/cdc_prod.public.Order/year=…/month=…/day=…`**. Thư mục ngày tính theo giờ UTC. Sắp theo **Last Modified**: file `.parquet` mới nhất vừa xuất hiện.

**Nói:** Sink đóng file mỗi 15 s, hoặc khi đủ 10.000 bản ghi. Hồ lưu toàn bộ lịch sử thay đổi dạng Parquet, không chỉ trạng thái cuối.

## 4. Đọc đơn ngay trên hồ, trước khi dựng kho

Chạy trên ClickHouse Play (hoặc `ch <<SQL … SQL`):

```sql
SELECT order_id, customer_id, total, status, payment_status, event_ts
FROM staging.stg_orders
WHERE order_id = 'POS-…'
FORMAT Vertical
```

`staging.stg_orders` là view đọc thẳng file Parquet trên MinIO qua hàm `s3()`. Truy vấn mất vài giây vì quét toàn bộ hồ (hơn 3 triệu sự kiện đơn).

**Nói:** Dữ liệu đã truy vấn được bằng SQL ngay khi xuống hồ, chưa cần ETL.

## 5. Dựng kho và đối soát — khoảng 2–2,5 phút

Đã bấm Ctrl-C ở bước 1 chưa? Chờ thêm khoảng 20 s cho sink ghi nốt file cuối, rồi chạy:

```bash
$DC --profile dbt run --rm dbt build
```

Kết quả mong đợi ở dòng cuối: `Done. PASS=68 WARN=0 ERROR=0 SKIP=0 TOTAL=68` (20 model + 48 test). Trong lúc chờ, giới thiệu sơ đồ model dbt: staging → warehouse → serving → audit.

Sau khi dbt xong:

```sql
-- Đơn trong kho: mỗi dòng hàng một bản ghi, đã khử trùng phiên bản CDC
SELECT order_id, item_id, product_name, quantity, net_amount, payment_status, _loaded_at
FROM warehouse.fact_orders_detail FINAL
WHERE order_id = 'POS-…'
FORMAT PrettyCompactMonoBlock;

-- Đối soát ba tầng: nguồn PostgreSQL = hồ = kho
SELECT checked_at, src_rows, stg_rows, wh_rows, ket_qua
FROM audit.checksum_orders ORDER BY checked_at DESC LIMIT 1
FORMAT Vertical;

-- Bảng phục vụ AI-Rec: số dòng mua của khách demo tăng so với bước 0.5
SELECT count() AS so_dong_mua, max(OrderedAt) AS lan_mua_cuoi
FROM serving.purchase_events_for_AI_rec WHERE CustomerID = '<KH>'
FORMAT PrettyCompactMonoBlock;
```

**Nói:** `ket_qua = KHỚP` nghĩa là số dòng hàng và tổng tiền ở PostgreSQL, ở hồ và ở kho bằng nhau. Kiểm tra này chạy trong mọi lượt dbt.

## 6. AI-Rec train lại — khoảng 2 phút

Từ 11/11/2026 AI-Rec chỉ train lại mỗi ngày lúc 22:00 (`TRAIN_DAILY_AT`). Khởi động lại thường KHÔNG train ngay: model trên đĩa vẫn mới hơn mốc 22:00 gần nhất. Lúc demo, chuyển tạm về chế độ train theo chu kỳ (lần đầu sau 20 s, rồi mỗi 300 s) bằng cách để trống biến lịch. Model cũ vẫn phục vụ trong lúc train vì đã được lưu xuống đĩa:

```bash
AI_REC_TRAIN_DAILY_AT= $DC up -d ai-rec
$DC logs -f --since 30s ai-rec | grep --line-buffered -E "train #|tính sẵn"
```

Demo xong, trả về lịch 22:00: `$DC up -d ai-rec`.

Chờ hai dòng:

```text
Đã tính sẵn gợi ý cho ~10.000/39.697 khách trong 60.0s.
Bản train #1 sẵn sàng sau ~90–130s — 39576 khách, 15027 sản phẩm CF, … tương tác, … cache ~10000 khách
```

Sau khi restart, số thứ tự bản train đếm lại từ #1. Bấm Ctrl-C để thoát log.

**Nói:**
- Mỗi chu kỳ gồm hai bước: train model, rồi tính sẵn top-20 cho từng khách vào cache trong tối đa 60 s.
- Ở 40.000 khách, 60 s chỉ đủ cho khoảng một phần tư số khách. Khách còn lại vẫn nhận gợi ý từ cùng bản model, nhưng được tính khi có request, mất khoảng 5–6 ms.
- Khách demo có `id` nhỏ, đứng đầu danh sách, nên nằm trong cache.

## 7. Response gợi ý

```bash
curl -s localhost:8000/health        # trained_at mới, cached_customers ~10.000
```

Trên Swagger, gọi `GET /api/v1/recommend/customer/{customer_id}`: bấm **Try it out**, nhập `KH`, rồi **Execute**. Mỗi món có `product_id` và `reason`:

| `reason` | Ý nghĩa |
|---|---|
| `repeat` | khách từng mua món này |
| `cf` | khách giống bạn cũng mua |
| `content` | hợp danh mục / hãng / tầm giá khách hay mua |
| `popular` | không có tín hiệu riêng, trả món bán chạy |

Mở `truoc.json` (lưu ở bước 0.5) để so sánh. Kỳ vọng là các món khách vừa mua dồn dập ở bước 1 sẽ lên đầu với lý do `repeat`, vì kênh mua lại tính theo tần suất đơn gần đây. Phải xác nhận điều này ở lần diễn tập.

**Nói:** Từ lúc ghi đơn tới lúc gợi ý thay đổi, đơn đi qua 6 hệ khác nhau, không có đường tắt nào ghi thẳng vào model.

---

## Sau demo

```bash
$DC start dbt-scheduler          # BẮT BUỘC: bật lại lịch dbt
$DC stop kafka-ui
docker compose up -d             # tạo lại ai-rec theo file gốc (đóng cổng 8000)
```

Các đơn demo ở lại trong database với tiền tố `POS-` và thuộc về khách `KH`. Số liệu trong báo cáo đo trước khi có các đơn này.

## Khi có sự cố

| Triệu chứng | Nguyên nhân thường gặp | Xử lý |
|---|---|---|
| Bước 1 báo `không kết nối được` | Chạy lệnh thiếu `--entrypoint sh`, nên script kết nối `localhost` | Chép đúng lệnh ở bước 1 |
| Bước 1 báo `Không có mặt hàng nào còn tồn` | Chưa seed catalog và tồn kho | `$DC --profile seed run --rm seed-catalog` (10–20 phút; làm trước, không làm lúc demo) |
| Kafka UI không thấy message mới | Connector không ở trạng thái RUNNING | Tab Kafka Connect → xem lỗi; `$DC restart kafka-connect` |
| `ket_qua = LỆCH` | Sink chưa ghi nốt file cuối, hoặc máy POS chưa dừng | Chờ 20 s rồi chạy lại `dbt build`. Lệch kéo dài mới là mất dữ liệu |
| dbt hoặc ClickHouse báo `MEMORY_LIMIT_EXCEEDED`, container bị kill | Hết RAM: dbt chạy chồng lượt, hoặc ứng dụng khác chiếm RAM | Kiểm tra `dbt-scheduler` đã dừng (0.3); dừng Metabase và ai-bot (0.2) |
| Log AI-Rec không có "Bản train" sau 3 phút | ClickHouse đang bận (dbt) hoặc lỗi đọc dữ liệu | `$DC logs --since 5m ai-rec`; model cũ vẫn phục vụ trong lúc chờ |
