# TÀI LIỆU 06: KHUNG BÁO CÁO KHOA HỌC (THESIS ACADEMIC PAPER OUTLINE)

Dưới đây là cấu trúc chuẩn quốc tế (IEEE/ACM Format) dành cho báo cáo Khóa luận/Luận văn, map trực tiếp kiến thức từ các tài liệu 01 đến 05 vào từng chương.

---

## TIÊU ĐỀ DỰ KIẾN (PROPOSED TITLES)
1. **Tiếng Việt**: Kiến trúc Tích hợp Phân tích Dữ liệu Lớn Thời gian thực qua Pipeline CDC Kafka trong Hệ sinh thái Bán lẻ Đa kênh.
2. **Tiếng Anh**: Integrating Real-Time Big Data Analytics via CDC Kafka Pipeline in an Omnichannel Retail Ecosystem.

---

## ABSTRACT (TÓM TẮT NGHIÊN CỨU)
- **Vấn đề**: Các hệ thống POS và Thương mại điện tử truyền thống bị giới hạn khả năng phân tích dữ liệu thời gian thực do sự nghẽn cổ chai của các quá trình ETL truyền thống (Data Silos, OLTP Contention).
- **Giải pháp**: Đề xuất kiến trúc Event-Driven, sử dụng cơ chế Change Data Capture (Debezium CDC) để đẩy mọi giao dịch từ PostgreSQL qua Apache Kafka, biến Kafka thành Sổ cái bất biến (Immutable Ledger).
- **Kết quả/Đóng góp**: Dữ liệu được tiêu thụ bởi ClickHouse (OLAP), phục vụ các bài toán Business Intelligence và Fraud Detection (Kafka Streams). Nghiên cứu đánh giá hiệu năng (Throughput, Latency, Fault Tolerance) và chứng minh tính khả thi qua các kịch bản thực tế của Apple Authorized Reseller.

---

## 1. INTRODUCTION (GIỚI THIỆU)
- Bối cảnh bán lẻ Omnichannel: Nhu cầu nhất quán dữ liệu giữa Online và Offline.
- Khó khăn của hệ thống Legacy: Báo cáo chậm trễ, dữ liệu bị kẹt (Data Silo Syndrome), hệ thống sập khi tải cao.
- Mục tiêu nghiên cứu: Xây dựng một Prototype cấp doanh nghiệp áp dụng triết lý "The Log is the Database" và HTAP (Hybrid Transactional/Analytical Processing).

---

## 2. SYSTEM ARCHITECTURE (KIẾN TRÚC HỆ THỐNG ĐỀ XUẤT)
*(Lấy dữ liệu từ Tài liệu 01: Tổng Quan và Kiến Trúc)*
- Tầng Vận hành (Operational Layer - PostgreSQL): Đảm bảo giao dịch ACID.
- Tầng Tích hợp (Integration Layer - CDC Debezium): Bắt thay đổi không độ trễ.
- Tầng Truyền phát (Streaming Layer - Apache Kafka): High Availability, Data Retention, Quorum.
- Tầng Phân tích (Analytical Layer - ClickHouse): Truy vấn phân tán, tối ưu hóa I/O bằng Column-oriented.

---

## 3. TECHNICAL CHALLENGES & SOLUTIONS (GIẢI QUYẾT BÀI TOÁN PHÂN TÁN)
*(Lấy dữ liệu từ Tài liệu 04: Giải quyết vấn đề phân tán)*
Trình bày chiều sâu học thuật với các bài toán:
- **Distributed Transactions & Outbox Pattern**: Giải quyết Dual-Write problem.
- **Exactly-Once Semantics**: Đảm bảo không trùng lặp dòng tiền.
- **Event Time vs Processing Time**: Xử lý Out-of-Order Events và Late-Arriving Data.
- **Time-Travel & Audit Trail**: Giải pháp Kế toán đối soát qua Event Sourcing.

---

## 4. SYSTEM IMPLEMENTATION & APPLICATIONS (CÀI ĐẶT HỆ THỐNG)
*(Lấy dữ liệu từ Tài liệu 02 và 03: PRD và Database)*
- Trình bày Schema (ERD) và cơ sở thiết kế.
- Bảng điều khiển Tài chính (Financial Analytics Dashboard).
- Động cơ phát hiện gian lận (Fraud Detection Engine).
- Tự động hóa Đối soát (Invoice Reconciliation).

---

## 5. EXPERIMENTAL SETUP & EVALUATION (THỰC NGHIỆM VÀ ĐÁNH GIÁ)
*(Lấy dữ liệu từ Tài liệu 05: Kịch bản Demo)*
- **Metric 1 - End-to-End Latency**: Đo thời gian (ms) từ khi Insert DB PostgreSQL đến khi có mặt trên ClickHouse.
- **Metric 2 - High Throughput Stress Testing**: Bắn 10,000 requests/s bằng Apache JMeter vào PostgreSQL và đo Lag của Kafka.
- **Metric 3 - Fault Tolerance (Chaos Engineering)**: Tắt đột ngột 1 Kafka Broker, đo thời gian bầu chọn (Election Time) và tính toàn vẹn dữ liệu (Data Loss).
- **Metric 4 - OLAP vs OLTP Performance**: So sánh thời gian chạy truy vấn `SUM(Doanh thu) GROUP BY tháng` trên 10 triệu bản ghi giữa PostgreSQL và ClickHouse.

---

## 6. CONCLUSION & FUTURE WORKS (KẾT LUẬN)
- **Kết luận**: Khẳng định sự ưu việt của kiến trúc CDC Kafka + ClickHouse.
- **Hướng phát triển**: Tích hợp Machine Learning trực tiếp vào luồng Stream (AI Inference) để tự động hóa định tuyến chuỗi cung ứng hoặc gợi ý giá động (Dynamic Pricing).
