

---

# TÀI LIỆU GỐC: 01_Tong_Quan_Va_Kien_Truc_He_Thong.md

# TÀI LIỆU 01: TỔNG QUAN VÀ KIẾN TRÚC HỆ THỐNG
**Hệ Sinh Thái Bán Lẻ Đa Kênh (Omnichannel Retail) Tích Hợp Big Data Pipeline**

---

## 1. TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW)

Hệ thống được thiết kế để phục vụ cho các Đại lý Ủy quyền của Apple (Apple Authorized Reseller - AAR) cấp doanh nghiệp, đòi hỏi khả năng vận hành ở quy mô lớn, tính sẵn sàng cao và khả năng phân tích dữ liệu thời gian thực.

Hệ sinh thái bao gồm 4 thành phần vận hành (Operational Layer):
1. **POS (Point of Sale) App**: Ứng dụng tại quầy dành cho nhân viên bán hàng (tối ưu cho màn hình cảm ứng).
2. **E-Commerce Web App**: Nền tảng mua sắm trực tuyến cho khách hàng (B2C).
3. **ERP / Backoffice System**: Hệ thống quản trị trung tâm dành cho Ban Giám đốc, Kế toán và Quản lý kho.
4. **CRM & Loyalty App**: Hệ thống quản lý quan hệ khách hàng và hạng thẻ.

---

## 2. KIẾN TRÚC TÍCH HỢP DỮ LIỆU LỚN (BIG DATA ARCHITECTURE)

Để giải quyết bài toán Data Silos và cung cấp cái nhìn toàn cảnh (Single Source of Truth), hệ thống áp dụng kiến trúc Event-Driven kết hợp với Data Pipeline thời gian thực.

### 2.1. Kiến Trúc "Eternal Ledger" (Sổ Cái Bất Biến)
- **Cơ chế CDC (Change Data Capture)**: Debezium đọc trực tiếp Transaction Log (WAL) từ cơ sở dữ liệu OLTP (PostgreSQL) mà không gây ảnh hưởng đến hiệu năng (Zero performance impact).
- **The Log is the Database**: Mọi thay đổi dữ liệu được đẩy vào Apache Kafka. Kafka được cấu hình `retention.ms = -1` (Lưu trữ vĩnh viễn), đóng vai trò là Immutable Distributed Log (Sổ cái phân tán bất biến).
- **Time-Travel & Analytics**: Dữ liệu từ Kafka được tiêu thụ (consume) và đưa vào ClickHouse (Column-oriented OLAP). Hỗ trợ truy vấn lịch sử tại bất kỳ thời điểm nào trong quá khứ.

### 2.2. Phân Tầng Lưu Trữ (Hot-Warm-Cold Data Tiering)
Nhằm tối ưu hóa chi phí cho hệ thống quy mô lớn lưu trữ dữ liệu 10 năm:
- **HOT Tier (Truy cập thường xuyên)**: Kafka (In-Memory + SSD) lưu 7 ngày gần nhất; ClickHouse (NVMe SSD) lưu 1 năm gần nhất với tốc độ truy vấn < 100ms.
- **WARM Tier (Truy cập thỉnh thoảng)**: ClickHouse (HDD Tiered Storage) lưu từ 1-5 năm.
- **COLD Tier (Hiếm khi truy cập)**: Dữ liệu được nén thành file Parquet, mã hóa AES-256 và đưa lên Object Storage (S3 Glacier) lưu trữ trên 5 năm với chi phí cực thấp.

### 2.3. Tách Biệt OLTP và OLAP (HTAP Architecture)
- Lớp **OLTP (PostgreSQL)** chỉ phục vụ các truy vấn vận hành (Operational), độ trễ < 10ms.
- Lớp **OLAP (ClickHouse)** chuyên xử lý các truy vấn phân tích khối lượng lớn (Analytical), đáp ứng độ trễ < 100ms.
- **Kết quả**: Giao dịch tại quầy không bao giờ bị nghẽn bởi các báo cáo tổng hợp của Giám đốc.

---

## 3. KIẾN TRÚC ĐỘ SẴN SÀNG CAO (HIGH AVAILABILITY - HA)

Triết lý cốt lõi: *"Everything fails all the time"* - Hệ thống được thiết kế để không có điểm chết duy nhất (Zero Single Point of Failure) và phục hồi trong vài giây.

### 3.1. Quorum & Consensus (Thuật toán Raft)
Hệ thống sử dụng số lượng Node lẻ (3, 5, 7) ở mọi layer để tránh hiện tượng Split Brain (Chẻ não):
- `Quorum = floor(N/2) + 1`
- Đảm bảo trong trường hợp đứt kết nối mạng (Network Partition), chỉ có một nhóm (phần lớn) tiếp tục hoạt động, duy trì tính nhất quán dữ liệu (Consistency).

### 3.2. HA Ở Các Tầng (Layers)
- **Tầng Database (PostgreSQL)**: 3 Nodes với Patroni + etcd. Khi Primary node chết, hệ thống tự động bầu Leader mới trong < 30s. Cấu hình Synchronous Replication đảm bảo **Zero Data Loss**.
- **Tầng Messaging (Kafka)**: 5 Brokers cấu hình KRaft. Replication Factor = 3, `acks=all`. Chịu được lỗi tối đa 2 Brokers cùng lúc mà không mất một Message nào.
- **Tầng Analytics (ClickHouse)**: Kiến trúc 2 Shards × 3 Replicas với ClickHouse Keeper. Truy vấn phân tán tự động chịu lỗi.
- **Tầng Application / API**: Các API Servers phía sau Load Balancer (Nginx/HAProxy) được thiết lập Health Probes (Startup, Liveness, Readiness) trên Kubernetes.

### 3.3. Các Pattern Bất Tử (Resilience Patterns)
- **Circuit Breaker**: Tự động ngắt kết nối đến các Service đang bị lỗi để tránh hiệu ứng Domino.
- **Bulkhead Pattern**: Chia nhỏ Thread Pool (Vách ngăn) để lỗi ở một Service không làm sập các Service khác.
- **Load Shedding**: Phân loại mức độ ưu tiên của Request. Khi quá tải, hệ thống chủ động từ chối các Request ưu tiên thấp (như tra cứu lịch sử) để đảm bảo các Request ưu tiên cao (thanh toán) vẫn hoạt động.
- **Graceful Degradation**: Tự động "xuống cấp nhẹ nhàng". Ví dụ: Khi ClickHouse đang bảo trì, hệ thống tự động switch Dashboard sang dùng PostgreSQL với hiệu năng chậm hơn nhưng không bị "sập" hoàn toàn.

---

## 4. TÓM TẮT DÒNG CHẢY DỮ LIỆU (DATA FLOW)

```text
[ỨNG DỤNG BÁN HÀNG (POS/ECOMMERCE)]
      │
      ▼ (Ghi dữ liệu)
[POSTGRESQL (OLTP)] ──▶ [DEBEZIUM CDC] ──▶ [APACHE KAFKA (BROKER)]
                                                   │
             ┌─────────────────────────────────────┤
             ▼                                     ▼
[CLICKHOUSE (OLAP ANALYTICS)]             [KAFKA STREAMS]
      │                                            │
      ▼ (Truy vấn)                                 ▼ (Real-time Rule Engine)
[DASHBOARD/BÁO CÁO TÀI CHÍNH]             [HỆ THỐNG CẢNH BÁO/TỰ ĐỘNG HÓA]
```


---

# TÀI LIỆU GỐC: 04_Giai_Quyet_Van_De_Phan_Tan.md

# TÀI LIỆU 04: GIẢI QUYẾT CÁC BÀI TOÁN HỆ THỐNG PHÂN TÁN
**Nghiên cứu chuyên sâu (Deep Research) cho Báo Cáo Khóa Luận**

Trong quá trình xây dựng hệ thống Big Data và kiến trúc Event-Driven (Kafka + ClickHouse) cho mảng bán lẻ cấp Enterprise, nhóm đã gặp và đưa ra giải pháp cho hàng loạt các bài toán kinh điển của Distributed Systems. Dưới đây là các chủ đề có thể đưa vào chương "Phân tích và Khai thác chiều sâu" của khóa luận.

---

## 1. CÁC BÀI TOÁN VỀ ĐỒNG BỘ VÀ XỬ LÝ SỰ KIỆN (EVENT PROCESSING)

### 1.1. Bài toán Split Event (Sự Kiện Bị Cắt Xén)
- **Vấn đề**: Khi một transaction update 5 field nhưng ở 2 câu lệnh SQL liên tiếp, CDC sẽ bắt thành 2 event tại 2 thời điểm khác nhau. ClickHouse nhận được 1 event thiếu dữ liệu, dẫn đến sai lệch.
- **Giải pháp**: Áp dụng **Transaction Boundary Aggregation** (Sử dụng outbox pattern) hoặc **Session Window** trong Kafka Streams để gom đủ các thay đổi trước khi emit ra luồng Analytics.

### 1.2. Bài toán Out-of-Order Events (Sự Kiện Sai Thứ Tự)
- **Vấn đề**: Do network latency trên các partition khác nhau, sự kiện "Giao hàng" (ORDER_SHIPPED) lại đến Kafka trước sự kiện "Tạo đơn" (ORDER_CREATED).
- **Giải pháp**: 
  - Sử dụng **Watermark** (Google Dataflow concept) và phân biệt giữa **Event Time** (thời điểm xảy ra) và **Processing Time** (thời điểm nhận).
  - Sử dụng **Reordering Buffer** trên Kafka Streams, lưu trữ state trong khoảng "allowed lateness" (ví dụ 30s) trước khi xử lý.

### 1.3. Bài toán Exactly-Once Semantics (Gửi Trùng Dữ Liệu)
- **Vấn đề**: Nhân viên bấm thanh toán 2 lần do mạng chậm (At-least-once retry), dẫn đến thu tiền gấp đôi hoặc đếm doanh thu gấp đôi trên ClickHouse.
- **Giải pháp**:
  - Tích hợp **Idempotency Key** từ Frontend/Backend.
  - Sử dụng `enable.idempotence=true` trên Kafka Producer.
  - Sử dụng Engine `ReplacingMergeTree` trên ClickHouse để tự động deduplicate bản ghi dựa trên khóa ngoại (PRIMARY KEY) và thời gian `created_at`.

---

## 2. CÁC BÀI TOÁN VỀ KẾ TOÁN VÀ TÀI CHÍNH (FINANCIAL AUDIT TRAIL)

### 2.1. Double-Entry Ledger trong Kỷ Nguyên Big Data
- **Nguyên lý**: Giao dịch phải ghi cả DEBIT (Nợ) và CREDIT (Có).
- **Ứng dụng CDC**: Mỗi giao dịch sinh ra 2 event. Kafka consumer theo dõi sự thay đổi balance, ClickHouse dùng Rule Engine báo cáo lệch số dư nếu `SUM(DEBIT) != SUM(CREDIT)`.

### 2.2. Ghi Nhận Điều Chỉnh Kế Toán (Late Financial Adjustment)
- **Vấn đề**: Hoàn tiền/Khuyến mãi bổ sung sau 6 tháng. Không được quyền UPDATE/DELETE bản ghi cũ vì đã chốt số liệu tài chính nộp cơ quan thuế.
- **Giải pháp**: Áp dụng **Adjusting Journal Entry (AJE) với Event Sourcing**. 
  - Phát sinh Event mới (CREDIT_NOTE) với `amount` âm, `original_order_id` trỏ về quá khứ nhưng `accounting_period` là hiện tại. Hệ thống đảm bảo tính bất biến (Audit Trail Immutability).

### 2.3. Theo Dõi Dòng Tiền Trôi Nổi (Cash Float Tracking)
- **Vấn đề**: Khách quẹt VNPay, tiền đã trừ nhưng phải T+1 (hôm sau) mới vào tài khoản công ty. Trong thời gian đó, "tiền đang ở đâu?".
- **Giải pháp**: Tạo State Machine qua Kafka: `AUTHORIZED` (mới xác nhận) -> `SETTLED` (cổng thanh toán gửi) -> `CREDITED` (ngân hàng báo nhận) -> `RECONCILED` (Khớp sao kê). ClickHouse tổng hợp "Float Balance" real-time cho CFO.

---

## 3. CÁC BÀI TOÁN VỀ KIẾN TRÚC DOANH NGHIỆP (ENTERPRISE SCALE)

### 3.1. Schema Evolution (Tiến Hóa Cấu Trúc Dữ Liệu)
- **Vấn đề**: Mở rộng hệ thống, đổi tên field, thêm thuộc tính. Nếu consumer đọc event cũ 2 năm trước với code mới sẽ gây Exception (Deserialization Error).
- **Giải pháp**: Sử dụng **Confluent Schema Registry** và **Apache Avro**. Cho phép Backward/Forward Compatibility. Dù nâng cấp hệ thống bao nhiêu lần, code mới vẫn đọc hiểu Event của 10 năm trước.

### 3.2. Tombstone Event (Sự Kiện Bị Xóa)
- **Vấn đề**: Khi xóa bản ghi ở PostgreSQL, Debezium phát Event `{key: 1001, value: NULL}`. ClickHouse không tự động xóa dòng cũ dựa trên NULL value.
- **Giải pháp**: 
  - Chuyển sang dùng **Soft Delete** (Thêm `is_deleted=1`) để luồng dữ liệu vẫn đầy đủ payload.
  - Sử dụng `CollapsingMergeTree` với cột `sign` (+1 cho Insert, -1 cho Delete) trong ClickHouse để tự động triệt tiêu.

### 3.3. Dual Write Problem
- **Vấn đề**: Code ghi vào PostgreSQL xong rồi Push vào Kafka. Nếu sập nguồn ở giữa 2 bước, dữ liệu trên DB có mà Analytics không có (hoặc ngược lại).
- **Giải pháp**: **Transactional Outbox Pattern**. Ghi dữ liệu vào bảng nghiệp vụ VÀ bảng `outbox` trong cùng 1 Transaction của PostgreSQL. Kafka CDC chỉ cần đọc từ bảng `outbox`. Đảm bảo tính nhất quán (Consistency) 100%.

### 3.4. Floating Point Precision (Sai Số Tiền Tệ)
- **Vấn đề**: Làm tròn số Float trong tính toán chiết khấu phần trăm (15% của 49.99M) sinh ra sai số vô hạn `0.0000000001` ở tầng Big Data.
- **Giải pháp**: Không bao giờ sử dụng Float/Double cho tiền tệ. Sử dụng kiểu `DECIMAL(19,4)` hoặc quy đổi về đơn vị Integer nguyên nhất (ví dụ VND luôn lưu số nguyên). Mọi điểm tính toán phải thống nhất 1 quy tắc làm tròn duy nhất ở tầng Output.


---

# TÀI LIỆU GỐC: app_overview.md

# Tổng quan hệ thống — iStore Analytics Platform

---

## 🏪 App là gì?

**iStore Analytics** là nền tảng quản lý & phân tích cho **Đại lý Ủy quyền Apple (Apple Authorized Reseller — AAR)** hoạt động theo mô hình **bán lẻ đa kênh (Omnichannel)**: vừa có cửa hàng vật lý (offline) vừa bán hàng online.

Hệ thống phục vụ **2 nhóm người dùng chính**:

| Nhóm | Giao diện | Mục đích |
| :--- | :--- | :--- |
| **B2C** (Khách hàng cuối) | E-Commerce Web App | Mua sắm, đặt hàng, quản lý tài khoản, tích điểm |
| **B2B** (Nội bộ doanh nghiệp) | Analytics Dashboard | Giám sát doanh thu, phát hiện gian lận, quản lý sản phẩm/chi nhánh |

---

## 🗄️ Data Platform sử dụng gì?

Hệ thống tách biệt hoàn toàn **lớp vận hành (OLTP)** và **lớp phân tích (OLAP)** theo kiến trúc HTAP:

```
[B2C Checkout / POS]
        │
        ▼
[LowDB / JSON]          ← Master data (sản phẩm, khách hàng, chi nhánh)
        │  (sync realtime)
        ▼
[ClickHouse — OLAP]     ← Lưu mọi giao dịch, phân tích hàng triệu dòng
        │
        ▼
[Redis — Cache]         ← Cache kết quả query (TTL 30–600s)
        │
        ▼
[WebSocket]             ← Đẩy KPI realtime về Dashboard (mỗi 5 giây)
```

### Chi tiết từng lớp

| Thành phần | Vai trò | Lý do chọn |
| :--- | :--- | :--- |
| **LowDB (JSON file)** | Master data: sản phẩm, khách hàng, chi nhánh, voucher | Nhẹ, không cần cài đặt, đủ dùng cho data ít thay đổi |
| **ClickHouse** | OLAP: lưu toàn bộ đơn hàng, phiếu thu/chi, cảnh báo | Column-oriented → query `SUM/GROUP BY` trên 10M dòng < 100ms |
| **Redis** | Cache API response | Giảm tải ClickHouse, TTL 30s cho KPI realtime |
| **WebSocket** | Push realtime | CEO thấy doanh thu cập nhật mỗi 5 giây không cần F5 |

---

## 🎯 Data Platform phục vụ cho mục đích gì?

### 1. 📊 Financial Analytics Dashboard
> **Đối tượng**: CEO, CFO, Store Manager

- Doanh thu theo giờ/ngày/tháng, so sánh hôm nay vs hôm qua
- KPI: Revenue, Orders, Avg Order Value, Net Cash, Void Rate
- Ranking chi nhánh theo doanh thu
- Phân bổ doanh thu theo danh mục sản phẩm (iPhone, Mac, iPad...)
- **RBAC**: Manager chỉ thấy dữ liệu chi nhánh mình

### 2. 🚨 Fraud Detection Engine
> **Đối tượng**: Risk Management, Quản lý khu vực

Phát hiện bất thường **ngay thời điểm xảy ra** (không đợi cuối tháng):
- Tỷ lệ hủy đơn cao bất thường tại 1 chi nhánh (> 15%)
- Doanh thu hôm nay thấp hơn 3σ so với trung bình 90 ngày
- Hóa đơn chưa đối soát quá 30 ngày

### 3. 🔄 Invoice Reconciliation (Đối soát)
> **Đối tượng**: Kế toán

So khớp tự động từng đơn hàng với phiếu thu:
- **MATCHED**: Đơn hàng đã có phiếu thu khớp số tiền (sai lệch < 1,000đ)
- **PENDING**: Đơn hàng chưa có phiếu thu
- **MISMATCH**: Số tiền không khớp

### 4. 🚚 Supply Chain / SLA Fulfillment
> **Đối tượng**: Operations Team

Giám sát tốc độ xử lý đơn hàng:
- **ON_TIME**: Xuất kho trong vòng 24h kể từ khi đặt hàng
- **BREACHED**: Trễ SLA
- Tỷ lệ giao hàng đúng hạn, thời gian fulfillment trung bình

---

## ⚡ Kiến trúc "Full Stack" thực tế của prototype

Đây là **prototype học thuật** (cho khóa luận tốt nghiệp), đơn giản hóa stack so với production:

| Production (Mô tả trong tài liệu) | Prototype (Code hiện tại) |
| :--- | :--- |
| PostgreSQL (OLTP) | LowDB (JSON file) |
| Debezium CDC → Kafka | Direct insert từ Node.js API |
| Kafka Streams (Fraud) | Rule-based query trên ClickHouse |
| Schema Registry (Avro) | JSONEachRow insert thẳng |
| Kubernetes + HA | Docker Compose (dev) |

> [!IMPORTANT]
> Mục tiêu khóa luận là **chứng minh tính khả thi của kiến trúc CDC Kafka + ClickHouse** cho bài toán bán lẻ, không phải triển khai production đầy đủ. Prototype đủ để demo và benchmark.

---

## 📐 Luồng dữ liệu (Data Flow tóm tắt)

```
Khách đặt hàng (B2C Web)
    → Server Node.js API
        → [LowDB] Lưu đơn hàng (B2C history)
        → [ClickHouse] Sync sale_orders + input_vouchers (analytics)
        → [Redis] Flush cache
        → [WebSocket] Broadcast KPI mới cho Dashboard

Admin xem Dashboard (B2B)
    → API call → Redis (hit cache? trả về ngay)
                → miss? → ClickHouse query → cache lại → trả về
    → WebSocket nhận KPI_UPDATE mỗi 5 giây
```

---

## 🏷️ Từ khóa học thuật của đề tài

`HTAP` · `OLAP` · `CDC (Change Data Capture)` · `Event-Driven Architecture` · `Column-oriented Database` · `Omnichannel Retail` · `Real-time Analytics` · `Fraud Detection` · `Financial Reconciliation` · `Circuit Breaker` · `ReplacingMergeTree`
