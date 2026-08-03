# BRAINSTORM — Vấn Đề Cấp Senior/Architect & Ứng Dụng CDC Kafka
## "Những Bài Toán Đau Đầu Nhất Mà Data Platform Có Thể Giải Quyết"

> **Kết luận ngay từ đầu:** **CÓ, hoàn toàn xử lý được.** Với data `erp.*` đang có sẵn trong CDC pipeline, bạn có thể build ngay 4 ứng dụng Production-ready. Phần I là brainstorm mở rộng, Phần II là lộ trình cụ thể.

---

# PHẦN I — BRAINSTORM: VẤN ĐỀ CẤP SENIOR/ARCHITECT

---

## VẤN ĐỀ 1: LEGACY SYSTEM BLINDNESS — "ERP đang chạy nhưng không ai nhìn được bên trong"

**Đây là vấn đề số 1 của mọi Enterprise hiện tại:**
```
Thực tế tại 90% doanh nghiệp Việt Nam:
  ERP (SAP, Oracle, MISA, Fast) đang chạy bình thường
  → Nhưng chỉ cho phép truy vấn qua giao diện có sẵn
  → Muốn báo cáo tùy chỉnh? → Phải mua thêm module (hàng trăm triệu)
  → Muốn kết nối với BI tool? → Phải export Excel thủ công hàng tuần
  → Muốn real-time dashboard? → ERP không hỗ trợ

KIẾN TRÚC SƯ ĐANG ĐAU ĐẦU:
  "Làm sao lấy data từ ERP ra mà không cần vendor support?"
  "Làm sao kết nối ERP với Data Warehouse mà không ảnh hưởng production?"
  "Làm sao có real-time insights từ data đang nằm trong ERP?"
```

**CDC Kafka giải quyết như thế nào:**
```
CDC đọc từ PostgreSQL WAL (Write-Ahead Log) — không kết nối vào ứng dụng ERP
  → Transparent: ERP không biết CDC đang đọc
  → Zero performance impact: Không query thêm vào production DB
  → Real-time: Mọi thay đổi trong ERP ngay lập tức có mặt trên Kafka

Kết quả:
  → CFO có real-time dashboard mà không cần vendor thay đổi gì
  → Data Analyst có thể query ClickHouse thoải mái mà không ảnh hưởng ERP
  → CTO tiết kiệm hàng trăm triệu tiền module báo cáo của SAP
```

---

## VẤN ĐỀ 2: DATA SILO SYNDROME — Dữ liệu bị kẹt trong các "hầm chứa" riêng biệt

```
Cấu trúc dữ liệu điển hình của một chuỗi bán lẻ 30 chi nhánh:

  Sales Team dùng:    CRM (Salesforce) → Data ở đây
  Finance Team dùng:  ERP (SAP/MISA)   → Data ở đây (khác!)
  Warehouse dùng:     WMS (D365)        → Data ở đây (khác nữa!)
  E-commerce dùng:    Shopify/Haravan   → Data ở đây (khác nữa nữa!)
  HR dùng:            HRM (Base/AMIS)   → Data ở đây

Vấn đề:
  CEO hỏi: "Tháng này chúng ta bán được bao nhiêu?"
  → Sales: "Theo CRM là 150 đơn"
  → Finance: "Theo ERP là 148 đơn (2 đơn hủy)"
  → Warehouse: "Theo WMS là 147 đơn (1 đơn chưa xuất kho)"
  → 3 con số KHÁC NHAU từ cùng 1 câu hỏi!

Senior Engineer gọi đây là "The Source of Truth Problem"
```

**CDC Kafka — "The Great Unifier":**
```
Mỗi hệ thống là 1 Kafka Topic:
  Topic: crm.sales_orders
  Topic: erp.pm_saleorder        ← Đang có sẵn!
  Topic: wms.shipments
  Topic: ecommerce.orders

ClickHouse JOIN tất cả Topics:
  SELECT 
    o.order_id,
    o.amount     as erp_amount,
    c.deal_id    as crm_deal,
    w.shipped_at as warehouse_shipped
  FROM erp_orders o
  LEFT JOIN crm_deals c ON o.order_id = c.erp_order_id
  LEFT JOIN wms_shipments w ON o.order_id = w.order_id

→ 1 Single Source of Truth — CEO hỏi 1 câu, nhận 1 câu trả lời
```

---

## VẤN ĐỀ 3: ZERO-DOWNTIME DATABASE MIGRATION — Di dân database không dừng hệ thống

**Nỗi ác mộng của mọi Senior DBA:**
```
Tình huống: Công ty quyết định migrate từ MySQL (Legacy) sang PostgreSQL
→ Database có 500GB data, 200 tables
→ Hệ thống chạy 24/7, không thể dừng

Cách cũ (Brute force):
  1. Thông báo maintenance window (Dừng hệ thống)
  2. Export 500GB sang PostgreSQL (mất 4-8 giờ)
  3. Cầu nguyện không có lỗi
  4. Test rồi mở lại
  → Downtime 8-12 tiếng → Mất doanh thu hàng tỷ

Vấn đề Senior gặp phải hàng ngày tại các tập đoàn lớn VN
```

**CDC Kafka — Zero Downtime Migration:**
```
Bước 1 (Tuần 1-2): Chạy song song
  MySQL (Đang chạy) ──CDC──▶ Kafka ──▶ PostgreSQL (Mới)
  → PostgreSQL được populate dần từ Kafka
  → Không ảnh hưởng MySQL production

Bước 2: Verify
  → So sánh row count, checksum giữa MySQL và PostgreSQL
  → Đảm bảo data đồng bộ hoàn toàn

Bước 3: Cutover (Chỉ mất 1-2 giây!)
  → Load Balancer: Switch traffic từ MySQL → PostgreSQL
  → Thời điểm switch: Không mất một transaction nào

Bước 4: Cleanup
  → Tắt MySQL sau 1-2 tuần (đề phòng rollback)

→ ZERO DOWNTIME, ZERO DATA LOSS
```

---

## VẤN ĐỀ 4: MICROSERVICES DATA CONSISTENCY — Bài toán đau đầu nhất khi "bẻ khóa monolith"

```
Xu hướng 2020-2025: Mọi công ty đang "break the monolith"
  Monolith → Microservices

Vấn đề xuất hiện ngay:
  Trước đây: 1 database, 1 transaction → Dễ đảm bảo consistency
  
  Sau khi phân tách:
    Service A (Orders): Database A
    Service B (Inventory): Database B
    Service C (Payments): Database C
  
  Khi tạo Order → Phải cập nhật CẢ 3 databases
  → Không có distributed transaction nào bao phủ cả 3!
  → Nếu Service B fail → Order tạo nhưng kho không trừ!

Senior/Architect gọi đây là "The Distributed Transaction Problem"
Không có giải pháp hoàn hảo! Chỉ có cách tiếp cận tốt nhất.
```

**CDC Kafka + Saga Pattern:**
```
Orchestration Saga qua Kafka:

1. Service A tạo Order (local transaction OK)
   → Publish: ORDER_CREATED event lên Kafka

2. Service B (Inventory) listen Kafka:
   → Nhận ORDER_CREATED → Trừ kho (local transaction)
   → Publish: INVENTORY_RESERVED event

3. Service C (Payment) listen Kafka:
   → Nhận INVENTORY_RESERVED → Charge thẻ
   → Publish: PAYMENT_COMPLETED event

Khi BƯỚC 3 fail:
   → Publish: PAYMENT_FAILED event
Service B nhận → Compensate: Hoàn lại kho (Compensating Transaction)
Service A nhận → Compensate: Cancel order

→ Eventual Consistency — Tất cả services cuối cùng đều nhất quán
→ Kafka là "Orchestrator" — Không có single point of failure
```

---

## VẤN ĐỀ 5: SEARCH INDEX SYNC — Elasticsearch luôn stale so với Database

```
Bài toán phổ biến tại mọi startup/enterprise có search:

PostgreSQL (Source of Truth) ←→ Elasticsearch (Search Index)

Cách cũ (Polling every 1 minute):
  Cron job: SELECT * FROM products WHERE updated_at > last_poll_time
  → Gửi vào Elasticsearch để index lại
  
Vấn đề:
  1. Latency 1 phút: Nhân viên sửa giá iPhone → Khách tìm kiếm vẫn thấy giá cũ 1 phút
  2. Polling load: Mỗi phút query toàn bộ bảng products → DB chịu tải
  3. Miss updates: Nếu cron job fail 1 lần → 1 phút đó mất data
  4. Không track deletes: Sản phẩm bị xóa không tự động xóa khỏi ES
```

**CDC Kafka — Real-time Search Sync:**
```
PostgreSQL ──CDC──▶ Kafka ──▶ Elasticsearch Consumer

Event: PRODUCT_PRICE_UPDATED {product_id: 1, new_price: 29990000}
  → Kafka: < 100ms
  → ES Consumer index: < 200ms
  → Nhân viên sửa giá → Khách tìm kiếm thấy ngay trong < 300ms TOTAL

Event: PRODUCT_DELETED {product_id: 2}
  → ES Consumer tự động: DELETE /products/_doc/2
  → Sản phẩm ngay lập tức biến mất khỏi kết quả tìm kiếm

Ứng dụng cho Apple Reseller:
  → Tìm kiếm "iPhone 15 Pro" → Kết quả realtime từ kho
  → Không bao giờ hiển thị sản phẩm hết hàng (vì kho CDC realtime)
  → Latency: < 500ms từ lúc cập nhật đến lúc search thấy
```

---

## VẤN ĐỀ 6: GDPR/PDPA RIGHT TO ERASURE — Xóa dữ liệu cá nhân khắp mọi nơi

```
Nghị định 13/2023/NĐ-CP (PDPA Việt Nam):
  Khách hàng có quyền yêu cầu xóa dữ liệu cá nhân của họ

Vấn đề với Microservices + CDC:
  Thông tin khách hàng "Nguyễn Văn A" nằm ở:
    PostgreSQL orders table       ← Source
    ClickHouse analytics          ← Replica từ CDC
    Elasticsearch search index    ← Replica từ CDC
    Redis session cache           ← Cache
    S3 audit logs                 ← Archive
    Data Lake (cold storage)      ← Historical

  Khi khách yêu cầu xóa:
    → Phải xóa ĐỒNG THỜI tất cả 6 nơi
    → Phải VERIFY đã xóa hoàn toàn
    → Phải LOG việc đã xóa (Ironically, vẫn phải lưu "đã xóa" nhưng không lưu gì khác)

Senior/Legal team gọi đây là "The Right-to-Erasure Propagation Problem"
```

**Giải pháp — CDC-driven Data Subject Deletion:**
```
Kafka Topic: "data_subject_deletion_requests"
  {customer_id: "C001", gdpr_request_id: "GDPR_2024_001", requested_at: "..."}

Consumers lắng nghe và tự động xử lý:
  Consumer 1 (PostgreSQL): UPDATE orders SET customer_name='[DELETED]', phone=NULL WHERE customer_id='C001'
  Consumer 2 (ClickHouse): UPDATE customer SET name='[DELETED]' WHERE id='C001'
  Consumer 3 (Elasticsearch): POST /_update/customer_C001 {script: "ctx._source.name='[DELETED]'"}
  Consumer 4 (Redis): DEL session:C001:*
  Consumer 5 (S3): Tag objects for deletion after 30 days

Kafka đảm bảo: Mọi Consumer đều nhận được event (At-least-once)
Saga tracks: Tất cả 5 consumers đã xác nhận xóa thành công

Audit log (ironically): "Customer C001 data deleted at 2024-03-15T10:30:00Z, GDPR request GDPR_2024_001"
```

---

## VẤN ĐỀ 7: SHADOW MODE TESTING — Test hệ thống mới mà không ai biết

```
Bài toán kinh điển của Architect khi cần replace 1 critical service:

Tình huống: Cần thay thế thuật toán tính giá trả góp cũ (sai) bằng cái mới
Hệ thống đang có 50.000 đơn hàng trả góp/tháng
→ Không thể test trên production
→ Staging environment không đủ data thực tế
```

**CDC Kafka — Shadow Mode:**
```
Bước 1: Route tất cả events vào CẢ 2 services:
  Kafka Topic: "installment_calculation_requests"
  Consumer A (OLD service): Xử lý → Trả kết quả cho user (Live)
  Consumer B (NEW service): Xử lý → Ghi kết quả vào shadow table (Silent)

Bước 2: Comparison job chạy real-time:
  SELECT 
    old.result as old_calc,
    new.result as new_calc,
    ABS(old.result - new.result) as diff
  FROM old_results o JOIN new_results n ON o.order_id = n.order_id
  WHERE diff > 1000  -- Chênh lệch hơn 1000 VND → Flag

Bước 3: Sau 1 tuần, nếu diff = 0 trong 99.9% cases → Switch hoàn toàn sang NEW

→ Không có user nào bị ảnh hưởng trong quá trình test
→ 100% real production data được dùng để test
→ Kỹ thuật này được Facebook, Google dùng để test mọi thay đổi thuật toán
```

---

## VẤN ĐỀ 8: OPERATIONAL ANALYTICS vs ANALYTICAL ANALYTICS — HTAP Problem

```
2 loại query hoàn toàn khác nhau:

OLTP Query (Operational): "Đơn hàng #1001 của khách nào?"
  → Cần: Nhanh (< 10ms), Single record, Point lookup
  → Best tool: PostgreSQL

OLAP Query (Analytical): "Doanh thu theo giờ của tất cả chi nhánh trong tháng 3?"
  → Cần: Complex aggregation, Full table scan, Millions of rows
  → Best tool: ClickHouse

Vấn đề: Nhiều công ty cố gắng dùng PostgreSQL cho cả 2 loại
  → OLAP query chạy trên PostgreSQL đang phục vụ OLTP
  → Query tổng hợp hàng triệu records → Lock table → POS bị treo!

Senior DBA gọi đây là "OLTP vs OLAP Contention Problem"
```

**CDC Kafka — HTAP Solution:**
```
PostgreSQL (OLTP) ──CDC──▶ Kafka ──▶ ClickHouse (OLAP)

Rule 1: OLTP queries → PostgreSQL (< 10ms, fresh data)
Rule 2: OLAP queries → ClickHouse (< 100ms, data lag 1-5 giây)

Kết quả:
  POS nhân viên tra cứu đơn hàng: PostgreSQL → 5ms ✓
  CEO xem dashboard tổng hợp: ClickHouse → 80ms ✓
  Không bao giờ ảnh hưởng lẫn nhau!

HTAP = Hybrid Transactional/Analytical Processing
→ Xu hướng database 2024-2025 (TiDB, CockroachDB, SingleStore đều marketing từ này)
```

---

## VẤN ĐỀ 9: EVENT-DRIVEN NOTIFICATION — Thông báo thời gian thực chính xác

```
Vấn đề hiện tại của mọi hệ thống bán hàng:

Cách cũ (Polling-based):
  Mobile App khách hàng: Poll server mỗi 30 giây "Đơn hàng của tôi đã giao chưa?"
  → 1 triệu app instances × poll 30s = 33.000 API calls/giây chỉ để hỏi!
  → Server chịu tải khổng lồ cho "thông tin không cần thiết"

Cách cũ 2 (Batch notification):
  Cron job mỗi 5 phút: Tìm đơn hàng vừa delivered → Gửi push notification
  → Latency 5 phút: Hàng giao xong 5 phút sau khách mới biết
```

**CDC Kafka — Event-driven Push:**
```
WMS cập nhật delivery_status = 'DELIVERED' trong DB
  ↓
Debezium CDC bắt event ngay lập tức
  ↓
Kafka Topic: "order_status_changes"
  ↓
Notification Consumer:
  → Gửi Firebase Push Notification đến mobile app
  → Gửi Zalo OA message
  → Gửi Email confirmation

Latency từ update DB đến khách nhận notification: < 2 giây!
Không có 1 API poll nào được gọi.
→ Tiết kiệm 33.000 API calls/giây → Servers nhàn rỗi
```

---

## VẤN ĐỀ 10: MULTI-REGION DATA SYNC — Đồng bộ dữ liệu xuyên quốc gia

```
Apple Reseller mở rộng ra Singapore, Thái Lan, Philippines:

Vấn đề:
  Database ở VN → Service ở Singapore query → Latency 100-200ms
  → Mỗi request chậm 100-200ms → App bị lag
  
  Option A: Replicate database sang Singapore
  → Đồng bộ thế nào? Scheduled job? → Lag 15-30 phút
  → Handle conflict khi 2 regions cùng write? → Nightmare!
```

**CDC Kafka + Kafka MirrorMaker:**
```
VN Primary Kafka ──MirrorMaker──▶ SG Kafka Cluster
                                   │
                              SG ClickHouse (Read)
                              SG PostgreSQL (Read Replica)

Latency đồng bộ: < 500ms (gần real-time)
Singapore users query local ClickHouse → < 5ms (thay vì 200ms qua WAN)

Conflict resolution: VN is always Master
  → Singapore chỉ đọc, không ghi trực tiếp → Không có conflict!
  → Singapore write → Route về VN API → CDC → Sync sang SG lại
```

---

# PHẦN II — FEASIBILITY ANALYSIS
## "Có thể xử lý được không?" — CÓ! Đây là lộ trình cụ thể với data đang có

---

## DATA ĐÃ CÓ SẴN — Đây là lợi thế cực kỳ lớn

```
Tables đang được CDC:
  erp.pm_saleorder     → Đơn hàng bán (Bao gồm: date, amount, branch, items)
  erp.pm_inputvoucher  → Phiếu thu (Dòng tiền vào)
  erp.pm_outputvoucher → Phiếu chi (Dòng tiền ra)

Với 3 tables này, bạn đã có thể build NGAY 4 applications sau:
```

---

## APP 1: REAL-TIME FINANCIAL DASHBOARD (Cho CFO/Accountant)
### Mức độ khó: ★★★☆☆ | Thời gian: 2 tuần

```
Data đầu vào:
  pm_saleorder    → Doanh thu theo giờ
  pm_inputvoucher → Tiền thu
  pm_outputvoucher → Tiền chi

Dashboard Features:
┌─────────────────────────────────────────────────────┐
│              FINANCIAL CONTROL CENTER                │
├──────────────┬──────────────┬────────────────────────┤
│ Doanh thu    │ Tiền thu     │ Tiền chi               │
│ Hôm nay:     │ Hôm nay:     │ Hôm nay:               │
│ 1.2 tỷ ↑12% │ 980 tr ↑5%  │ 450 tr ↓3%            │
├──────────────┴──────────────┴────────────────────────┤
│ Revenue by Hour (Line chart - real-time)             │
│ ████████████████░░░░░░░ 65%                         │
├─────────────────────────────────────────────────────┤
│ Invoice Reconciliation Status:                      │
│  ✅ Matched (SALE = RECEIPT): 312 invoices          │
│  ⚠️  Pending Receipt: 45 invoices (156 tr)          │
│  🔴 Overdue > 30 days: 12 invoices (87 tr)          │
├─────────────────────────────────────────────────────┤
│ ALERT: Order #PM2024-001 void rate cao bất thường   │
└─────────────────────────────────────────────────────┘

ClickHouse Queries:
-- Doanh thu theo giờ:
SELECT 
  toStartOfHour(order_date) as hour,
  SUM(total_amount) as revenue,
  COUNT(*) as order_count
FROM pm_saleorder
WHERE toDate(order_date) = today()
GROUP BY hour ORDER BY hour

-- Reconciliation status:
SELECT 
  s.order_id,
  s.total_amount as sale_amount,
  i.amount as received_amount,
  s.total_amount - COALESCE(i.amount, 0) as gap
FROM pm_saleorder s
LEFT JOIN pm_inputvoucher i ON s.order_id = i.ref_order_id
WHERE gap != 0
```

---

## APP 2: FRAUD DETECTION ENGINE (Cho Risk Management)
### Mức độ khó: ★★★★☆ | Thời gian: 3 tuần

```
Data đầu vào: pm_saleorder (void/cancel patterns)

Kafka Streams Rules (chạy real-time):

Rule 1 — Void Rate Anomaly:
  Window: Tumbling 1 giờ per branch
  Alert if: COUNT(status='VOIDED') / COUNT(*) > 15%
  Severity: HIGH (Có thể nhân viên void để lấy tiền mặt)

Rule 2 — Price Deviation:
  Alert if: sale_price > product_list_price × 1.05  (Giá cao hơn 5%)
  OR:       sale_price < product_list_price × 0.90  (Giá thấp hơn 10%)

Rule 3 — Time Anomaly:
  Alert if: Order created AFTER store closing hours (after 22:00)
  AND: payment_method = 'CASH'  (Tiền mặt sau giờ đóng cửa = rủi ro)

Rule 4 — Velocity Check:
  Window: 5 phút
  Alert if: COUNT(orders by same employee) > 20
  (Nhân viên tạo quá nhiều đơn trong thời gian ngắn)

Alert Output → Kafka Topic "fraud_alerts" → Email/Zalo/App notification
```

---

## APP 3: SUPPLY CHAIN FULFILLMENT TRACKER (Cho Operations)
### Mức độ khó: ★★★☆☆ | Thời gian: 2 tuần

```
Data đầu vào:
  pm_saleorder    → Đơn hàng (bắt đầu hành trình)
  pm_outputvoucher → Xuất kho (bước fulfillment)

Kafka Stream JOIN 2 sources:

Tính SLA theo từng đơn hàng:
  T_order   = pm_saleorder.order_date
  T_shipped = pm_outputvoucher.output_date (khi ORDER_ID match)
  Fulfillment_Time = T_shipped - T_order (giờ)
  SLA_Target = 24 giờ (ví dụ)
  SLA_Status = IF(Fulfillment_Time <= 24, 'ON_TIME', 'BREACHED')

Dashboard:
  ├── Orders pending fulfillment: 45 (đang chờ xuất kho)
  ├── Avg fulfillment time today: 18.5 giờ
  ├── SLA breach rate: 3.2% (mục tiêu < 5%)
  └── Top slow branches: HN002 (avg 32h), HCM003 (avg 28h)

Alert: "Order #PM2024-5001 đã quá SLA 6 giờ — cần xử lý ngay!"
```

---

## APP 4: EXECUTIVE REAL-TIME KPI BOARD (Cho CEO/GM)
### Mức độ khó: ★★☆☆☆ | Thời gian: 1 tuần

```
Data đầu vào: Tất cả 3 tables

KPIs real-time:
  Revenue Today:         SUM(pm_saleorder.amount) WHERE date=today
  Revenue vs Target:     revenue_today / monthly_target × (day_of_month / days_in_month)
  Cash Collected:        SUM(pm_inputvoucher.amount) WHERE date=today
  Net Cash Position:     SUM(input) - SUM(output)
  Orders Today:          COUNT(pm_saleorder) WHERE date=today
  Avg Order Value:       revenue_today / orders_today
  Top Branch Today:      GROUP BY branch ORDER BY SUM(amount) LIMIT 5
```

---

## DEMO SCRIPT — "Làm Hội Đồng Há Hốc Mồm"

### Demo 1: Low Latency CDC (5 phút demo)
```
Bước 1: Mở 2 màn hình cạnh nhau
  Màn hình trái: ERP system (tạo đơn hàng)
  Màn hình phải: Financial Dashboard (ClickHouse + Grafana)

Bước 2: Tạo 1 đơn hàng mới trị giá 33.990.000 VND trong ERP
  → Bấm Save

Bước 3: Chỉ vào đồng hồ đếm giây

Bước 4: Sau 2-3 giây → Dashboard bên phải tự cập nhật:
  "Doanh thu hôm nay: +33.990.000 VND"
  "Số đơn hôm nay: +1"
  Biểu đồ theo giờ nhảy lên

Câu nói với Hội đồng:
  "Với hệ thống ERP truyền thống, con số này sẽ chỉ xuất hiện trong báo cáo
   cuối ngày, hoặc cuối tuần. Với CDC Kafka, CEO nhìn thấy nó trong 3 giây."
```

### Demo 2: Fraud Detection (3 phút demo)
```
Bước 1: Viết script tạo 20 đơn hàng VOIDED liên tiếp từ cùng 1 nhân viên

Bước 2: Chạy script → Kafka Streams phát hiện pattern

Bước 3: Sau 5 giây → Alert hiện ra trên Dashboard:
  "🚨 FRAUD ALERT: Employee EMP001 tại Branch HN001
   Void rate: 95% (20/21 orders in last 5 minutes)
   Action required immediately"

Câu nói với Hội đồng:
  "Không có hệ thống ERP nào phát hiện được điều này trong real-time.
   Thông thường, gian lận chỉ được phát hiện khi kiểm toán — 3-6 tháng sau."
```

### Demo 3: Fault Tolerance (3 phút demo)
```
Bước 1: Đang tạo đơn hàng liên tục với script

Bước 2: Docker kill kafka-broker-1 (Tắt 1 Kafka node)
  docker stop kafka-broker-1

Bước 3: Tiếp tục tạo đơn hàng (hệ thống vẫn chạy vì còn 2 brokers)

Bước 4: docker start kafka-broker-1 (Khởi động lại)

Bước 5: Tất cả messages được replayedd và xuất hiện trong Dashboard
  "Không mất một đơn hàng nào trong thời gian Kafka broker bị tắt"
```

---

## TECHNICAL STACK RECOMMENDATION

```
Frontend:    React + Ant Design + Apache ECharts (real-time charts)
Backend:     Node.js (đang có) + ClickHouse HTTP driver
Data Layer:  
  ├── PostgreSQL (Source) → Debezium → Kafka (đã có của Cường)
  ├── ClickHouse (Serving) → Query cho dashboard
  └── Kafka Streams (Processing) → Fraud detection rules

Deployment:
  ├── Docker Compose (cho demo)
  └── Kubernetes (production-ready nếu cần)

NEW Components bạn cần thêm:
  ├── ClickHouse consumer (đọc từ Kafka, ghi vào ClickHouse)
  ├── Kafka Streams job (fraud detection rules)
  └── Frontend Dashboard (Financial + Fraud + Supply Chain)
```

---

## PHÂN CHIA CÔNG VIỆC — Ai làm gì?

```
Cường (Data Platform Team):
  ✅ Đã có: CDC pipeline PostgreSQL → Kafka
  ✅ Đã có: Data erp.pm_saleorder, pm_inputvoucher, pm_outputvoucher
  Cần thêm: ClickHouse consumer (Kafka → ClickHouse)

Bạn (Application Team):
  Cần build: 
    1. Financial Dashboard Frontend (React + Ant Design)
    2. ClickHouse query API (Node.js)
    3. Fraud Detection Kafka Streams job
    4. Alert notification system

Integration point:
  Cường expose: Kafka Topic names + Schema
  Bạn consume: Từ Kafka → ClickHouse → Dashboard
```

---

## TIMELINE THỰC TẾ

| Tuần | Công việc | Deliverable |
|:---|:---|:---|
| **1** | Setup ClickHouse + Consumer từ Kafka topics | Data chảy vào ClickHouse |
| **2** | Build Financial Dashboard (doanh thu theo giờ, reconciliation) | App 1 demo-able |
| **3** | Build Fraud Detection Kafka Streams | App 2 demo-able |
| **4** | Build Supply Chain Tracker + Executive KPI | App 3+4 demo-able |
| **5** | Polish UI, viết documentation, chuẩn bị demo scripts | Thesis-ready |

> [!IMPORTANT]
> **Trả lời câu hỏi "Có thể xử lý được không?":**
>
> **HOÀN TOÀN CÓ THỂ.** Thậm chí với data `erp.*` đang có sẵn và CDC pipeline của Cường đã chạy, bạn đã đi được 60% con đường. 40% còn lại là:
> 1. Setup ClickHouse consumer (1-2 ngày)
> 2. Build 4 applications (3-4 tuần)
> 3. Chuẩn bị 3 demo scripts (1 tuần)
>
> **Đây là đề tài hoàn toàn khả thi trong thời gian khóa luận và có giá trị thực tiễn cực cao.**
