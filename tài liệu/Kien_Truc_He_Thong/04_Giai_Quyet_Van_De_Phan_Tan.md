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
