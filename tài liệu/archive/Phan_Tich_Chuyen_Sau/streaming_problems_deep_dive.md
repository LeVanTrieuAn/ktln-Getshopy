# BRAINSTORM — Các Vấn Đề "Bẫy" Trong Distributed Streaming
## The Dark Side of Real-time Data Pipelines

> **Bối cảnh:** Bạn đang vận hành CDC Kafka pipeline cho hệ thống Apple Reseller. Dữ liệu chảy từ PostgreSQL → Kafka → ClickHouse. Nghe đơn giản. Nhưng thực tế, có hàng chục "bẫy" (traps) cực kỳ nguy hiểm mà chỉ các công ty như Google, Uber, Stripe đã từng đốt tiền để học được.

---

## VẤN ĐỀ 1: SPLIT EVENT / PARTIAL UPDATE PROBLEM
### ❌ Bài toán bạn đặt ra: 5 fields gửi lên 2 lần khác nhau

```
Đơn hàng #1001 được tạo trên POS:
  10:59:58 → UPDATE orders SET customer_id=5, product_id=12  (2 fields)
  11:00:01 → UPDATE orders SET price=25990000, discount=500000, status='CONFIRMED' (3 fields)
```

**Vấn đề:** CDC bắt được 2 Events riêng biệt với 2 timestamp khác nhau. ClickHouse nhận 2 sự kiện, không biết đây là 1 đơn hàng hoàn chỉnh hay 2 transaction độc lập.

**Hậu quả thực tế:**
- Báo cáo doanh thu 10h59 tính đơn hàng chưa có giá → sai số liệu
- Rule "Phát hiện đơn hàng trên 20 triệu" không trigger vì lúc 10h59 chưa có `price`

**Giải pháp — Transaction Boundary Aggregation:**
```
Kỹ thuật 1 (Debezium): Cấu hình "transaction.topic" để Debezium đóng gói
toàn bộ thay đổi trong 1 PostgreSQL Transaction thành 1 Kafka Message duy nhất.
Chỉ khi COMMIT xảy ra, Event mới được phát đi.

Kỹ thuật 2 (Event Collector): Kafka Stream mở 1 "Session Window" (ví dụ 5 giây)
Trong 5 giây, collect tất cả updates của cùng 1 order_id → Gom lại thành 1 Event hoàn chỉnh
→ Chỉ emit khi window đóng hoặc khi nhận được "complete signal"

Kỹ thuật 3 (Saga Completion Check): Định nghĩa "Order Complete Schema" (cần đủ 5 fields)
Kafka Stream kiểm tra: Nếu chưa đủ fields → giữ trong State Store → Đợi
Khi đủ fields → Emit ra downstream
```

**Giá trị học thuật:** Đây là bài toán **Event Aggregation & Stateful Stream Processing** — một trong những chapter khó nhất của Apache Flink documentation.

---

## VẤN ĐỀ 2: CLOCK SKEW — Đồng hồ lệch giữa các server

**Bài toán thực tế:**
```
Server POS Hà Nội (đồng hồ chạy nhanh 3 giây):
  → Event: ORDER_CREATED timestamp=11:00:03

Server Database TP.HCM (đồng hồ chuẩn):
  → CDC Capture timestamp=11:00:00

Kafka nhận 2 events:
  11:00:00 (từ DB HCM) → xuất hiện TRƯỚC
  11:00:03 (từ POS HN) → xuất hiện SAU

→ ClickHouse tưởng Order được tạo TRƯỚC khi Customer đặt hàng!
→ Kết quả query theo thời gian bị SAI HOÀN TOÀN
```

**Giải pháp — Event Time vs Processing Time:**
- **Event Time:** Thời điểm sự kiện THỰC SỰ xảy ra (Ghi trong dữ liệu, do thiết bị client tạo)
- **Processing Time:** Thời điểm Kafka/ClickHouse nhận được Event
- **Ingestion Time:** Thời điểm Event được ghi vào Kafka

**Google Dataflow giải quyết thế nào:** Dùng **Watermark** — một cột mốc thời gian di chuyển từ từ theo Event Time, không theo Processing Time. Kafka Streams và Apache Flink đều implement Watermark.

**Giải pháp thực tế:**
```
1. NTP Sync: Bắt buộc tất cả server đồng bộ thời gian với NTP Server chung.
2. Logical Clock (Lamport Timestamp): Mỗi Event có 1 số nguyên tăng dần (monotonic)
   thay vì dùng wall clock. Cho phép sắp xếp thứ tự CHÍNH XÁC dù đồng hồ lệch.
3. Hybrid Logical Clock (HLC) — CockroachDB, YugabyteDB dùng:
   Kết hợp Physical time + Logical counter → Vừa human-readable vừa monotonic
```

---

## VẤN ĐỀ 3: OUT-OF-ORDER EVENTS — Sự kiện đến không đúng thứ tự

**Bài toán:**
```
Thực tế xảy ra theo thứ tự:
  1. ORDER_CREATED   (11:00:00)
  2. PAYMENT_DONE    (11:00:30)
  3. ORDER_SHIPPED   (11:01:00)

Kafka nhận theo thứ tự:
  3. ORDER_SHIPPED   (đến trước vì partition khác, network nhanh hơn)
  1. ORDER_CREATED   (đến sau)
  2. PAYMENT_DONE    (đến sau cùng)

→ ClickHouse lưu: Đơn hàng được SHIP trước khi được TẠO RA → Vô lý hoàn toàn
→ Báo cáo "thời gian xử lý đơn hàng" tính ra số âm!
```

**Giải pháp — Reordering Buffer:**
```
Apache Flink / Kafka Streams: Cấu hình "allowed lateness" = 30 giây
Hệ thống GIỮ dữ liệu trong bộ nhớ (State Store) tối đa 30 giây
Sắp xếp lại theo Event Time trước khi đẩy xuống ClickHouse
Sau 30 giây → Bất kỳ Event nào đến muộn hơn → Bị coi là "Late Event" (xử lý riêng)
```

**Giá trị học thuật:** Window Operations với Out-of-Order Data — Chapter 4 của "Streaming Systems" (O'Reilly), cuốn sách kinh điển của Google Dataflow team.

---

## VẤN ĐỀ 4: LATE-ARRIVING DATA — Dữ liệu đến muộn sau khi Window đã đóng

**Bài toán thực tế:**
```
Bạn tính "Tổng doanh thu giờ 10h–11h" → Window đóng lúc 11h
Nhưng lúc 11h30, mạng internet cửa hàng mới khôi phục
→ 5 đơn hàng từ 10h45–10h59 mới được đẩy lên Kafka
→ Window giờ 10h–11h đã đóng → Những đơn này bị MẤT khỏi báo cáo
→ Báo cáo doanh thu giờ 10h bị thiếu 5 đơn!
```

**Hậu quả kinh doanh:** Doanh thu báo cáo < Doanh thu thực tế → Kế toán sai → Thuế sai.

**Giải pháp — Late Event Handling Strategies:**
```
Strategy 1 (Recompute): Khi Late Event đến, trigger recompute Window đó
  → Đơn giản nhưng tốn CPU, ClickHouse MergeTree engine hỗ trợ điều này

Strategy 2 (Side Output): Apache Flink gom tất cả Late Events vào 1 Kafka Topic riêng "late_events"
  → Batch job chạy hàng đêm đọc Topic này và patch lại ClickHouse

Strategy 3 (Watermark Tuning): Nới rộng Watermark delay từ 30 giây lên 5 phút
  → Chấp nhận tăng latency của báo cáo để đổi lại độ chính xác cao hơn
```

---

## VẤN ĐỀ 5: EXACTLY-ONCE vs AT-LEAST-ONCE — Bài toán gửi trùng

**Bài toán:**
```
Nhân viên bấm "Thanh toán" → API gửi request → Server xử lý thành công
→ Nhưng mạng bị ngắt → Client timeout → Nhân viên bấm "Thanh toán" lại
→ Server nhận 2 request → Tạo 2 đơn hàng → Thu tiền 2 lần!
```

**3 cấp độ đảm bảo:**
```
AT-MOST-ONCE: Gửi 1 lần, không retry → Có thể MẤT dữ liệu (Không dùng trong tài chính)
AT-LEAST-ONCE: Retry cho đến khi thành công → Có thể TRÙNG dữ liệu (Phổ biến nhất)
EXACTLY-ONCE: Đảm bảo xử lý đúng 1 lần → Khó nhất, chi phí cao nhất
```

**Giải pháp Exactly-Once cho Apple Reseller:**
```
1. Idempotency Key: Mỗi request có 1 unique key (UUID) do client tạo
   Server lưu key đã xử lý vào Redis (TTL 24h)
   Nếu key đã có trong Redis → Trả về kết quả cũ, KHÔNG xử lý lại

2. Kafka Idempotent Producer: Cấu hình enable.idempotence=true
   Kafka tự động dedup messages trong 1 session

3. ClickHouse ReplacingMergeTree: Engine này tự động dedup bản ghi trùng
   dựa trên PRIMARY KEY → Dù Kafka gửi 2 lần, ClickHouse chỉ lưu 1 bản
```

**Giá trị học thuật:** Exactly-Once Semantics (EOS) trong Distributed Systems — đây là bài toán CAP Theorem ứng dụng thực tế.

---

## VẤN ĐỀ 6: SCHEMA EVOLUTION — Khi cấu trúc dữ liệu thay đổi

**Bài toán:**
```
Tháng 1/2023: Orders table có 10 columns
Tháng 6/2023: Thêm cột "installment_months" (trả góp)
Tháng 1/2024: Đổi tên cột "customer_name" → "full_name"
Tháng 6/2024: Xóa cột "old_price" (không dùng nữa)

→ ClickHouse consumer tháng 6/2024 không đọc được Events từ tháng 1/2023
  vì schema khác nhau hoàn toàn
→ Mọi Time-Travel Query vào năm 2023 đều bị lỗi!
```

**Giải pháp — Schema Registry:**
```
Confluent Schema Registry + Apache Avro:
  - Mỗi schema có 1 version ID (v1, v2, v3...)
  - Mỗi Event trong Kafka đều mang schema version ID
  - Consumer tự động biết phải dùng schema nào để deserialize

Compatibility Rules:
  BACKWARD: Consumer mới đọc được data cũ (Recommended)
  FORWARD: Consumer cũ đọc được data mới
  FULL: Cả hai chiều đều tương thích (Khó nhất, an toàn nhất)
```

---

## VẤN ĐỀ 7: TOMBSTONE EVENT — Sự kiện xóa trong CDC

**Bài toán:**
```
Nhân viên hủy đơn hàng → Database DELETE record
→ Debezium CDC phát Event: {key: "order_1001", value: NULL} (Kafka Tombstone)
→ ClickHouse không có khái niệm "xóa" theo kiểu này
→ Đơn hàng vẫn còn trong ClickHouse dù đã bị xóa ở source!
```

**Hậu quả:** Báo cáo ClickHouse hiển thị đơn hàng đã hủy như đơn đang hoạt động → Tính doanh thu sai.

**Giải pháp:**
```
1. Soft Delete Pattern: Không bao giờ DELETE thật. Thêm cột "is_deleted=1" và "deleted_at"
   → CDC bắt UPDATE event thay vì Tombstone → ClickHouse nhận được đầy đủ thông tin

2. ClickHouse CollapsingMergeTree: Dùng "sign" column (+1 cho insert, -1 cho delete)
   SELECT SUM(sign * price) → Tự động cancel out dữ liệu đã xóa

3. Compaction Policy: Kafka Log Compaction giữ lại Tombstone 24h trước khi xóa
   → Đủ thời gian cho tất cả consumers xử lý
```

---

## VẤN ĐỀ 8: MULTI-TABLE TRANSACTION — Giao dịch trải rộng nhiều bảng

**Bài toán:**
```
Một đơn hàng khi được xác nhận, PostgreSQL thực hiện 1 Transaction:
  INSERT INTO orders VALUES (...)            ← Bảng 1
  UPDATE inventory SET stock = stock - 1 ... ← Bảng 2
  INSERT INTO voucher_usage VALUES (...)     ← Bảng 3
  INSERT INTO loyalty_points VALUES (...)    ← Bảng 4

→ Debezium bắt được 4 CDC Events RIÊNG BIỆT từ 4 bảng khác nhau
→ Kafka đẩy vào 4 Topics khác nhau
→ ClickHouse nhận 4 Events không biết chúng thuộc về cùng 1 Transaction

Vấn đề: Nếu server crash sau Event thứ 2 → inventory đã trừ nhưng loyalty_points chưa cộng
→ Inconsistency!
```

**Giải pháp — Outbox Pattern (Hầu hết các hệ thống tài chính dùng):**
```
Thay vì CDC từ 4 bảng, tạo thêm 1 bảng "outbox":
  INSERT INTO outbox (aggregate_id, event_type, payload, created_at)
  VALUES ('order_1001', 'ORDER_CONFIRMED', '{toàn bộ JSON}', NOW())

CDC chỉ đọc từ 1 bảng "outbox" duy nhất
→ Đảm bảo Atomicity: Hoặc toàn bộ transaction commit (bao gồm outbox row) hoặc không gì cả
→ Downstream consumers xử lý 1 Event hoàn chỉnh thay vì 4 Event rời rạc
```

---

## VẤN ĐỀ 9: CONSUMER GROUP REBALANCING — Mất dữ liệu khi scale

**Bài toán:**
```
Ngày launch iPhone, traffic tăng 10x
→ Bạn scale từ 3 Kafka Consumer lên 10 Consumer
→ Kafka bắt đầu "Rebalancing" — gán lại Partitions cho Consumers mới
→ Trong thời gian Rebalancing (5–30 giây): TẤT CẢ consumers bị tạm dừng
→ Messages tiếp tục đến → Tích lũy trong Queue → Consumer Lag tăng vọt
→ Khi Resume → Tất cả consumers cố gắng xử lý backlog cùng lúc → Quá tải
```

**Giải pháp — Cooperative Incremental Rebalancing:**
```
Kafka 2.4+: Cấu hình partition.assignment.strategy=CooperativeStickyAssignor
→ Chỉ Reassign những Partitions thực sự cần thiết, giữ nguyên phần còn lại
→ Không dừng toàn bộ Consumer Group
→ Downtime gần như = 0 khi scale
```

---

## VẤN ĐỀ 10: BACKPRESSURE — Khi Consumer chậm hơn Producer

**Bài toán:**
```
Flash sale 11h11: 50.000 đơn hàng/phút
ClickHouse Consumer: Chỉ xử lý được 10.000 records/phút
→ Consumer Lag: 40.000 messages/phút × tăng dần
→ Sau 1 giờ: 2.4 triệu messages tồn đọng
→ Dashboard bị lag 1 tiếng → CEO nhìn vào thấy doanh thu 0
→ Tăng resources lên? → Nhưng ClickHouse đang INSERT nhiều → Query chậm đi
```

**Giải pháp — Adaptive Batching + Rate Limiting:**
```
1. Dynamic Batch Size: Consumer tự động điều chỉnh batch size
   Khi lag thấp → Batch 100 records → Latency thấp
   Khi lag cao → Batch 10.000 records → Throughput cao

2. Separate Cluster: 1 ClickHouse cluster cho Real-time INSERT
                      1 ClickHouse cluster (replica) cho Dashboard Query
   → Không tranh chấp resources

3. Kafka Consumer Lag Alert: Khi lag vượt 100.000 messages → Auto-scale Consumer
```

---

## VẤN ĐỀ 11: DATA SKEW — Phân bổ dữ liệu không đều

**Bài toán:**
```
Kafka Topic "sale_orders" có 10 Partitions, phân chia theo store_id
Store TopZone Hà Nội (store_id=1): 80% traffic → Partition 1 quá tải
9 cửa hàng còn lại: 20% traffic → 9 Partitions nhàn rỗi

→ Consumer xử lý Partition 1 bị overload → Lag tăng chỉ ở 1 partition
→ 9 Consumers còn lại idle 80% thời gian → Lãng phí tài nguyên
```

**Giải pháp:**
```
1. Random Partitioning + Deduplication: Phân phối random vào tất cả partitions
   Consumer đọc từ tất cả partitions, dedup bằng idempotency key

2. Consistent Hashing với Virtual Nodes: Mỗi store_id được map vào nhiều virtual nodes
   Phân bổ đều hơn dù traffic không đều

3. Repartition Stream: Kafka Stream thêm 1 bước "repartition by time_bucket" 
   → Data được phân phối lại đều theo giờ, không theo store
```

---

## VẤN ĐỀ 12: POISON PILL MESSAGE — Tin nhắn "độc"

**Bài toán:**
```
1 message bị corrupt (JSON malformed, thiếu required field, giá trị NULL bất hợp lệ)
→ Consumer cố đọc → Exception → Retry 3 lần → Vẫn fail
→ Consumer bị "stuck" tại offset này → DỪNG XỬ LÝ toàn bộ partition!
→ Tất cả messages sau đó bị block → Pipeline tắt nghẽn
```

**Giải pháp — Dead Letter Queue (DLQ):**
```
Pattern chuẩn của AWS, Stripe, Uber:

1. Consumer thử xử lý message
2. Fail sau 3 lần retry → Không retry nữa
3. Push message "độc" vào Kafka Topic riêng: "sale_orders_DLQ"
4. Consumer tiếp tục xử lý message tiếp theo → Pipeline không bị block

5. Alert team: "Có 5 messages trong DLQ cần xử lý thủ công"
6. Engineer debug, fix message → Re-push vào Topic chính
```

---

## TỔNG HỢP — Ma trận 12 vấn đề & mức độ nguy hiểm

| # | Vấn đề | Mức nguy hiểm | Hậu quả nếu không xử lý | Giải pháp chính |
|:--|:---|:---:|:---|:---|
| 1 | Split Event | 🔴 CRITICAL | Số liệu báo cáo sai | Transaction Boundary + Session Window |
| 2 | Clock Skew | 🔴 CRITICAL | Thứ tự sự kiện sai | NTP + Logical Clock / HLC |
| 3 | Out-of-Order | 🟠 HIGH | Doanh thu tính sai giờ | Watermark + Reordering Buffer |
| 4 | Late-Arriving Data | 🟠 HIGH | Báo cáo thiếu dữ liệu | Late Event Side Output + Recompute |
| 5 | Duplicate Events | 🔴 CRITICAL | Thu tiền 2 lần! | Idempotency Key + ReplacingMergeTree |
| 6 | Schema Evolution | 🟠 HIGH | Time-Travel bị lỗi | Schema Registry + Avro |
| 7 | Tombstone Event | 🟡 MEDIUM | Dữ liệu đã xóa vẫn tính | Soft Delete + CollapsingMergeTree |
| 8 | Multi-Table Tx | 🔴 CRITICAL | Inconsistency tài chính | Outbox Pattern |
| 9 | Rebalancing | 🟡 MEDIUM | Downtime khi scale | Cooperative Sticky Assignor |
| 10 | Backpressure | 🟠 HIGH | Dashboard lag hàng tiếng | Adaptive Batching + Separate Cluster |
| 11 | Data Skew | 🟡 MEDIUM | Lãng phí tài nguyên | Consistent Hashing + Repartition |
| 12 | Poison Pill | 🔴 CRITICAL | Pipeline tắt hoàn toàn | Dead Letter Queue |

> [!IMPORTANT]
> **Đây chính là nội dung của Chapter "Challenges & Solutions" trong khóa luận** — Các hệ thống tập đoàn không chỉ build CDC Kafka pipeline rồi xong. Họ phải giải quyết TẤT CẢ 12 vấn đề trên mới gọi là "Production-Ready". Trình bày được tất cả các bẫy này và giải pháp tương ứng → GVHD sẽ đánh giá đây là nghiên cứu có chiều sâu kỹ thuật thực sự.

---
---

# PHẦN 2 — TIẾP TỤC BRAINSTORM: Các "Bẫy" Ẩn Sâu Hơn
## Lớp thứ hai — Những vấn đề mà chỉ hệ thống chạy > 1 năm mới gặp phải

---

## VẤN ĐỀ 13: DUAL WRITE PROBLEM — Bài toán ghi đồng thời hai nơi

**Bài toán (cực kỳ phổ biến và nguy hiểm):**
```
Nhiều developer khi mới làm CDC nghĩ ra cách "đơn giản":
  Step 1: INSERT vào PostgreSQL
  Step 2: PUBLISH message lên Kafka

Vấn đề: Nếu server crash SAU Step 1, TRƯỚC Step 2:
  → PostgreSQL đã có đơn hàng
  → Kafka KHÔNG có event
  → ClickHouse không bao giờ biết đơn này tồn tại
  → Tồn kho không bao giờ được trừ trên analytical layer
  → CEO dashboard thiếu đơn hàng mãi mãi

Ngược lại: Crash SAU Step 2, TRƯỚC Step 1:
  → Kafka có event nhưng DB không có order
  → Consumer xử lý → Trừ tồn kho một đơn hàng "ma"
```

**Tại sao đây là bài toán bất khả thi (Impossibility):**
PostgreSQL và Kafka là 2 hệ thống độc lập — không có distributed transaction bao trùm cả hai.

**Giải pháp hoàn hảo — Transactional Outbox Pattern:**
```
Thay vì write thẳng vào Kafka, write vào bảng "outbox" TRONG CÙNG DB Transaction:

BEGIN TRANSACTION;
  INSERT INTO orders VALUES (...);
  INSERT INTO outbox (event_type, payload) VALUES ('ORDER_CREATED', '{...}');
COMMIT;

→ Outbox row và Order row cùng commit hoặc cùng rollback → 100% atomic

Sau đó, Debezium CDC đọc từ bảng "outbox" → Push lên Kafka
→ Không bao giờ mất event, không bao giờ có event không có order tương ứng
```

**Giá trị học thuật:** Dual Write Problem là lý do tại sao Outbox Pattern được xem là "Silver Bullet" của Microservices architecture. Đây là chủ đề hot tại các hội nghị GOTO, QCon 2022-2024.

---

## VẤN ĐỀ 14: TIMEZONE HELL — Địa ngục múi giờ

**Bài toán thực tế (cực kỳ phổ biến, hay bị bỏ qua):**
```
Hệ thống Apple Reseller có chi nhánh ở Hà Nội (UTC+7) và Singapore (UTC+8)

Nhân viên Singapore tạo đơn lúc 23:30 (local time) ngày 31/12
→ UTC: 15:30 ngày 31/12
→ PostgreSQL lưu: 2024-12-31T15:30:00Z (UTC)

Kafka Consumer → ClickHouse lưu UTC

Dashboard báo cáo "Doanh thu tháng 12" của Singapore:
→ Lọc theo UTC: Đơn 23:30 ngày 31/12 local → UTC = 15:30 ✓ (Đúng)
→ Nhưng: Đơn 23:00 ngày 31/12 local → UTC = 15:00 ✓

Vấn đề nghiêm trọng hơn với Daylight Saving Time (DST):
→ Mỹ thay đổi giờ 2 lần/năm → 1 giờ "phantom" xuất hiện hoặc biến mất
→ Báo cáo ngày chuyển đổi DST: 23 hoặc 25 tiếng thay vì 24 tiếng
→ Aggregation theo ngày bị sai!
```

**Giải pháp:**
```
Nguyên tắc vàng: LƯU TẤT CẢ TIMESTAMP DƯỚI DẠNG UTC trong toàn bộ pipeline
  → PostgreSQL: timezone = 'UTC' trong config
  → Kafka Events: Tất cả timestamp là epoch milliseconds (UTC)
  → ClickHouse: DateTime64 với timezone='UTC'

Chuyển đổi sang local time CHỈ khi hiển thị (Presentation Layer):
  → Frontend React: moment.tz(timestamp, 'Asia/Ho_Chi_Minh')
  → ClickHouse Query: toTimeZone(event_time, 'Asia/Ho_Chi_Minh')
```

---

## VẤN ĐỀ 15: FLOATING POINT PRECISION — Sai số tiền tệ

**Bài toán (Stripe đã viết hẳn 1 blog post về vấn đề này):**
```
Tính chiết khấu 15% cho đơn hàng MacBook Pro 49.990.000 VND:
  Python/JavaScript: 49990000 * 0.15 = 7498500.0000000001
  
Tích lũy 1 triệu đơn hàng:
  Sai số mỗi đơn: 0.0000000001 VND
  Tổng sai số: 0.0000000001 * 1,000,000 = 0.0001 VND → Vẫn nhỏ

Nhưng nếu là USD với tỷ giá:
  49990000 VND / 25450 (tỷ giá) = 1964.6365... USD
  Làm tròn ở đâu? Frontend? Backend? Kafka? ClickHouse?
  → Mỗi điểm làm tròn khác nhau → Khi reconcile: Không khớp!
```

**Giải pháp (Chuẩn tài chính quốc tế):**
```
Nguyên tắc 1: KHÔNG BAO GIỜ dùng float/double cho tiền tệ
  → Lưu dưới dạng INTEGER (VND không có xu, nên lưu nguyên)
  → Với USD: Lưu dưới dạng cents (1 USD = 100 cents → Integer)

Nguyên tắc 2: Dùng DECIMAL(19, 4) trong PostgreSQL, không dùng FLOAT
  → ClickHouse: Decimal128(4) cho số tiền lớn

Nguyên tắc 3: Quy tắc làm tròn thống nhất toàn hệ thống
  → Chỉ làm tròn tại điểm cuối cùng (Display/Invoice)
  → Kafka Events luôn truyền số nguyên hoặc Decimal chính xác
```

---

## VẤN ĐỀ 16: DATA LINEAGE — Truy vết nguồn gốc dữ liệu

**Bài toán:**
```
CEO nhìn vào ClickHouse dashboard: "Doanh thu tháng 3 là 15 tỷ"
CFO nhìn vào báo cáo kế toán: "Doanh thu tháng 3 là 14.8 tỷ"

Ai đúng? Sai ở đâu? 
→ Không ai biết vì không có cách trace xem dữ liệu đi từ đâu đến đâu
→ Engineer mất 3 ngày debug không tìm ra nguyên nhân
```

**Giải pháp — Apache Atlas / OpenLineage:**
```
Mỗi Kafka Event được đánh dấu metadata:
  {
    "order_id": "1001",
    "lineage": {
      "source": "postgres.erp.orders",
      "cdc_timestamp": "2024-03-15T10:30:00Z",
      "debezium_version": "2.3.1",
      "kafka_topic": "erp.orders",
      "kafka_partition": 3,
      "kafka_offset": 12847,
      "clickhouse_table": "analytics.orders",
      "pipeline_version": "v1.2.3"
    }
  }

→ Bất kỳ bất đồng nào về số liệu → Trace ngay được: "Sai ở bước nào, lúc nào"
```

**Giá trị học thuật:** Data Lineage là nền tảng của Data Governance — xu hướng bắt buộc của mọi doanh nghiệp sau GDPR/PDPA.

---

## VẤN ĐỀ 17: OFFSET MANAGEMENT — Quản lý vị trí đọc

**Bài toán:**
```
Tình huống 1: Consumer đọc message, commit offset, NHƯNG xử lý thất bại
  → Offset đã commit → Message bị BỎ QUA mãi mãi (At-Most-Once)

Tình huống 2: Consumer đọc, xử lý xong, NHƯNG crash TRƯỚC khi commit offset
  → Khi restart → Đọc lại từ offset cũ → Xử lý LẠI (At-Least-Once)

Tình huống 3: Sau khi fix bug, muốn reprocess lại toàn bộ data từ đầu
  → Reset offset về 0 → NHƯNG ClickHouse đã có data → Duplicate records
```

**Giải pháp:**
```
1. Manual Offset Commit: Chỉ commit offset SAU KHI xử lý và persist thành công
   enable.auto.commit = false
   consumer.commitSync() → Gọi sau khi ClickHouse INSERT thành công

2. Idempotent Reprocessing: Cấu hình ClickHouse ReplacingMergeTree
   → Dù reprocess bao nhiêu lần → Kết quả vẫn đúng (Idempotent)

3. Consumer Group Management: Dùng kafka-consumer-groups.sh để reset offset
   theo timestamp → "Tôi muốn reprocess data từ ngày 1/3/2024"
```

---

## VẤN ĐỀ 18: HOT PARTITION — Phân vùng quá nóng do Celebrity Effect

**Bài toán (Amazon, Twitter gặp với users nổi tiếng):**
```
Apple ra mắt iPhone 16 → Tim Cook tweet → Viral
→ Toàn bộ traffic tập trung vào search "iPhone 16"
→ Partition chứa key "iPhone 16" nhận 90% load
→ 1 Consumer xử lý partition đó bị overwhelmed

Trong Apple Reseller context:
→ Ngày mở bán: 95% orders là iPhone 15 Pro Max Titan
→ Partition chứa product_id=1 nhận gần toàn bộ traffic
→ Partition khác rảnh rang
```

**Giải pháp — Salting:**
```
Thêm suffix ngẫu nhiên vào partition key:
  Thay vì: key = "iphone_15_pro_max"
  Dùng:    key = "iphone_15_pro_max_" + random(0, 9)
  
→ 10 partitions thay vì 1 partition nhận traffic
→ Consumer phía sau: Group By product_id (không có suffix) để aggregate đúng
```

---

## VẤN ĐỀ 19: STATE STORE RECOVERY — Khôi phục trạng thái sau crash

**Bài toán:**
```
Kafka Stream đang maintain State Store (RocksDB in-memory):
  "Đơn hàng #1001: Đã nhận 2/5 fields, đang chờ 3 fields còn lại"
  "Đơn hàng #1002: Đã nhận 4/5 fields, đang chờ 1 field còn lại"
  ... (100.000 đơn hàng đang chờ)

Server crash → Toàn bộ State Store MẤT
→ Khi restart: Không biết đơn nào đã xử lý đến đâu
→ Reprocess lại? → Nhưng không có Starting Point chính xác
```

**Giải pháp — Kafka Changelog Topics:**
```
Kafka Streams tự động tạo Changelog Topic cho mỗi State Store
→ Mỗi thay đổi trong State Store được ghi vào Changelog Topic (durable)
→ Khi crash và restart → Kafka Streams đọc Changelog Topic → Rebuild State Store
→ Thời gian phục hồi: Tỷ lệ thuận với kích thước State, thường vài giây đến vài phút
```

---

## VẤN ĐỀ 20: SILENT DATA CORRUPTION — Dữ liệu lỗi không có tiếng kêu

**Bài toán (Nguy hiểm nhất vì không ai biết đang xảy ra):**
```
Lỗi logic trong Kafka Consumer:
  Bug: price được lưu bằng đơn vị NGHÌN đồng thay vì ĐỒNG
  → ORDER tổng 24.990.000 VND → Lưu vào ClickHouse: 24.990 VND

Hậu quả: 
  → Không có error, không có exception, pipeline vẫn chạy bình thường
  → CEO dashboard: Doanh thu tháng 3 = 14.8 tỷ → THỰC RA LÀ 14.800 tỷ
  → Phát hiện sau 6 tháng khi đối chiếu với kế toán
  → Toàn bộ 6 tháng báo cáo BI SAIHOÀN TOÀN
```

**Giải pháp — Data Quality Validation Layer:**
```
Thêm một Consumer chuyên biệt: "Data Quality Guard"

Sau mỗi batch INSERT vào ClickHouse, chạy ngay các assertion:
  Assert 1: SUM(revenue_clickhouse) ≈ SUM(revenue_postgres) ± 0.01%
  Assert 2: COUNT(orders_clickhouse) == COUNT(orders_postgres)
  Assert 3: MAX(price) < 200,000,000 (Không có sản phẩm nào > 200 triệu VND)
  Assert 4: MIN(price) > 0 (Giá không âm)
  Assert 5: COUNT(DISTINCT serial_imei) == COUNT(*) (IMEI không được trùng)

Nếu bất kỳ assertion nào fail → Alert NGAY → Pipeline tạm dừng để debug
```

**Giá trị học thuật:** Data Quality trong Data Pipelines — Framework Great Expectations, Deequ (Amazon), soda-core đều được xây dựng để giải quyết vấn đề này.

---

## VẤN ĐỀ 21: KAFKA PARTITION COUNT IMMUTABILITY — Không thể co rút Partitions

**Bài toán:**
```
Ban đầu bạn tạo Topic "sale_orders" với 10 Partitions (cho 10 cửa hàng)
6 tháng sau, mở thêm 90 cửa hàng → Cần 100 Partitions
→ Tăng từ 10 lên 100 Partitions: Được phép ✓

Nhưng: Partition Key đã được hash mod 10
→ Sau khi tăng lên 100 → Key hash mod 100
→ Message cùng order_id có thể vào PARTITION KHÁC so với trước
→ Ordering guarantee bị phá vỡ hoàn toàn!

Và: Sau khi mở rộng, muốn co lại từ 100 về 50 Partitions?
→ KHÔNG THỂ! Kafka không cho phép giảm số Partitions
```

**Giải pháp — Partition Planning từ đầu:**
```
Nguyên tắc: Estimate capacity cho 3–5 năm tới ngay từ đầu
  → 50 cửa hàng hiện tại → Plan cho 500 cửa hàng → Tạo 500 Partitions ngay

Giải pháp khi đã lỡ: Tạo Topic mới với Partition count đúng
  → Chạy song song Topic cũ và mới trong thời gian migration
  → Dùng Kafka MirrorMaker để copy data từ Topic cũ sang mới
```

---

## VẤN ĐỀ 22: DISTRIBUTED TRACING — Theo dõi một đơn hàng qua toàn bộ hệ thống

**Bài toán:**
```
Đơn hàng #1001 đi qua:
  POS App → Backend API → PostgreSQL → Debezium → Kafka → 
  ClickHouse Consumer → ClickHouse → Grafana Dashboard

Khách hàng gọi điện: "Tôi đặt hàng lúc 10h nhưng dashboard không thấy"

Engineer cần kiểm tra: Đơn này đang bị stuck ở bước nào?
→ Phải log vào từng hệ thống riêng lẻ → Mất 30 phút
→ Không có cách nào trace end-to-end trong 1 request
```

**Giải pháp — OpenTelemetry Distributed Tracing:**
```
Mỗi Event trong Kafka mang header đặc biệt:
  {
    "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
  }

traceparent = trace_id + span_id → Định danh duy nhất cho toàn bộ "hành trình" của đơn hàng

Tool: Jaeger hoặc Zipkin
→ Dashboard hiển thị timeline đầy đủ:
  10:00:00.000 → POS tạo order (span: 5ms)
  10:00:00.005 → Backend ghi DB (span: 12ms)
  10:00:00.017 → Debezium capture (span: 2ms)
  10:00:00.019 → Kafka publish (span: 3ms)
  10:00:00.022 → ClickHouse insert (span: 8ms)
  TOTAL: 22ms end-to-end latency
```

---

## VẤN ĐỀ 23: WINDOWING EDGE CASES — Bài toán ranh giới cửa sổ thời gian

**Bài toán (Bug phổ biến nhất trong Stream Processing):**
```
Bạn tính "Doanh thu theo ngày" với Tumbling Window 24 giờ
Window 1: 00:00:00 → 23:59:59 ngày 31/12
Window 2: 00:00:00 → 23:59:59 ngày 01/01

Đơn hàng tạo lúc 23:59:59.999 ngày 31/12:
→ Thuộc Window 1 hay Window 2?
→ Nếu Event Time = 23:59:59.999 → Window 1 ✓
→ NHƯNG: Processing Time (Kafka nhận) = 00:00:00.001 ngày 01/01 → Window 2!

→ Đơn hàng bị tính sai ngày
→ Báo cáo ngày 31/12 thiếu 1 đơn, ngày 01/01 thừa 1 đơn
→ Sai số tuy nhỏ nhưng KHÔNG BAO GIỜ reconcile được với kế toán
```

**Giải pháp:**
```
1. Luôn dùng Event Time, không bao giờ dùng Processing Time cho Business Windows
2. Định nghĩa rõ: Window [inclusive, exclusive) hay [inclusive, inclusive]
3. Xử lý đặc biệt cho events ở ranh giới: timestamp.milliseconds == 0 → Gán về Window cũ
4. ClickHouse: toStartOfDay(event_time, 'Asia/Ho_Chi_Minh') thay vì toStartOfDay(now())
```

---

## VẤN ĐỀ 24: REGULATORY DATA RESIDENCY — Dữ liệu phải ở đúng quốc gia

**Bài toán (Vấn đề pháp lý, thường bị bỏ qua khi thiết kế):**
```
Apple Reseller mở rộng ra Campuchia, Lào, Singapore
→ Dữ liệu cá nhân của khách Campuchia phải ở server tại Campuchia (Data Residency)
→ Dữ liệu Singapore phải tuân thủ PDPA Singapore
→ Vietnam: Nghị định 13/2023 yêu cầu dữ liệu cá nhân người VN phải có bản copy tại VN

Nếu dùng 1 Kafka Cluster chung → Vi phạm luật → Phạt nặng
```

**Giải pháp — Multi-Region Kafka với Data Classification:**
```
Kafka Multi-Cluster:
  Cluster VN (Hà Nội/HCM): Dữ liệu cá nhân khách VN
  Cluster SG (Singapore): Dữ liệu cá nhân khách SG
  Cluster Global (Neutral): Dữ liệu tổng hợp đã anonymized

Data Classification Tags trong Event:
  "pii_classification": "PERSONAL" | "ANONYMOUS" | "AGGREGATE"
  "data_residency": "VN" | "SG" | "KH"

Router: Tự động route Event vào đúng Cluster dựa trên classification
```

---

## MA TRẬN TỔNG HỢP — TOÀN BỘ 24 VẤN ĐỀ

| # | Vấn đề | Tầng xảy ra | Kẻ thù | Vũ khí |
|:--|:---|:---|:---|:---|
| 1 | Split Event | Application → Kafka | Partial Update | Transaction Boundary + Session Window |
| 2 | Clock Skew | Distributed Nodes | Đồng hồ lệch | HLC + NTP |
| 3 | Out-of-Order | Kafka → Consumer | Network không đều | Watermark + Buffer |
| 4 | Late Data | Consumer → Window | Mạng chậm | Side Output + DLQ |
| 5 | Duplicate | Producer → Broker | Retry | Idempotency + ReplacingMergeTree |
| 6 | Schema Change | Avro Schema | Phát triển hệ thống | Schema Registry |
| 7 | Tombstone | CDC → Consumer | DELETE operation | Soft Delete |
| 8 | Multi-Table Tx | DB Transaction | Distributed atomicity | Outbox Pattern |
| 9 | Rebalancing | Consumer Group | Scale event | CooperativeStickyAssignor |
| 10 | Backpressure | Consumer → Sink | Traffic spike | Adaptive Batch |
| 11 | Data Skew | Partition Layer | Hot key | Salting + Virtual Nodes |
| 12 | Poison Pill | Message Processing | Bad data | Dead Letter Queue |
| 13 | **Dual Write** | App → DB + Kafka | Atomic impossibility | **Outbox Pattern** |
| 14 | **Timezone** | Timestamp parsing | DST + Multi-region | **UTC everywhere** |
| 15 | **Float Precision** | Calculation | IEEE 754 limitation | **Decimal Integer** |
| 16 | **Data Lineage** | All layers | Debugging blindspot | **OpenLineage** |
| 17 | **Offset Management** | Consumer | Commit timing | **Manual Commit** |
| 18 | **Hot Partition** | Kafka Partition | Celebrity effect | **Salting** |
| 19 | **State Recovery** | Kafka Streams | Crash | **Changelog Topics** |
| 20 | **Silent Corruption** | Data Quality | Logic bug | **Assertion Layer** |
| 21 | **Partition Immutability** | Kafka Admin | Scaling mistake | **Early planning** |
| 22 | **Tracing** | End-to-End | Observability gap | **OpenTelemetry** |
| 23 | **Window Edge Case** | Stream Processing | Boundary condition | **Event Time + Clear semantics** |
| 24 | **Data Residency** | Infrastructure | Regulatory | **Multi-Cluster + Classification** |

> [!NOTE]
> **Lời khuyên xây dựng Thesis Chapter:**
> Bạn không cần giải quyết hết 24 vấn đề trong code. Chỉ cần:
> 1. **Implement trong prototype:** Vấn đề #1, #5, #8, #13, #20 (5 vấn đề CRITICAL nhất, liên quan trực tiếp đến nghiệp vụ Apple Reseller)
> 2. **Thảo luận lý thuyết trong paper:** Toàn bộ 24 vấn đề — chứng tỏ bạn hiểu rõ không gian vấn đề
> 3. **Demo trong bảo vệ:** Inject một "poison pill" hoặc "split event" vào hệ thống và show cách hệ thống phát hiện + tự phục hồi → Ấn tượng cực mạnh với Hội đồng

