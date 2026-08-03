

---

# TÀI LIỆU GỐC: 05_Ke_Hoach_Phat_Trien_Va_Demo.md

# TÀI LIỆU 05: KẾ HOẠCH PHÁT TRIỂN & KỊCH BẢN DEMO
**Lộ Trình Cài Đặt và Kịch Bản Bảo Vệ Khóa Luận Trước Hội Đồng**

Tài liệu này xác định các công việc cần làm ở mức code (Implementation Plan) và định hướng cách thức thuyết trình (Demo Scripts) để gây ấn tượng mạnh nhất với Hội đồng Bảo vệ.

---

## 1. KẾ HOẠCH PHÁT TRIỂN (IMPLEMENTATION TIMELINE)
Với lợi thế Pipeline CDC PostgreSQL -> Kafka đã có sẵn dữ liệu, tập trung phát triển các thành phần sau:

### Tuần 1: Data Integration & ClickHouse Setup
- Cài đặt ClickHouse Database và tạo schema (`sale_orders`, `input_vouchers`, Materialized Views).
- Viết Node.js Kafka Consumer đọc dữ liệu từ Topic và Insert liên tục vào ClickHouse.
- Test connection và đảm bảo dòng chảy dữ liệu (Data Lineage) chính xác.

### Tuần 2: Backend APIs & Fraud Detection Stream
- Xây dựng hệ thống REST API trên Express.js.
- Cài đặt các câu truy vấn OLAP (Time-Series) từ ClickHouse cho biểu đồ.
- Chạy Kafka Streams Service (Microservice độc lập) cho Fraud Detection.

### Tuần 3: Frontend Dashboard & Refactoring
- Tích hợp **React.js + Ant Design 5**.
- Cài đặt đa ngôn ngữ (i18n) với Tiếng Anh/Tiếng Việt và chế độ Light/Dark Mode.
- Xây dựng giao diện: KPI Cards, Revenue Chart (Apache ECharts), Table báo cáo.

### Tuần 4: Testing & Demo Preparation
- Tích hợp dữ liệu thật (Integration Test).
- Build hệ thống bằng Docker Compose (PostgreSQL + Kafka + ClickHouse + Node.js).
- Viết các script tự động tạo dữ liệu lớn (Chaos Engineering Scripts).

---

## 2. KỊCH BẢN DEMO TRƯỚC HỘI ĐỒNG (THE "WOW" FACTOR)
Để chứng minh hệ thống đạt chuẩn "Enterprise Big Data", sử dụng 3 kịch bản Demo trực tiếp (Live Demo) sau:

### Demo 1: Low Latency CDC (Độ Trễ Thấp)
**Mục tiêu**: Chứng minh hệ thống OLAP có thể cung cấp dữ liệu tức thời (Real-time).
- **Chuẩn bị**: Mở 2 màn hình cạnh nhau. Trái: POS App. Phải: CFO Dashboard (Auto-refresh 3s).
- **Thực hiện**: Bấm tạo một đơn hàng trị giá `33.990.000 VNĐ` trên POS.
- **Kết quả**: Chỉ trong < 3 giây, Dashboard bên phải nhảy số Doanh Thu Hôm Nay cộng thêm chính xác `33.990.000 VNĐ`, biểu đồ đường nhích lên ngay lập tức.
- **Lời bình**: *"Với ERP truyền thống, Giám đốc phải đợi báo cáo cuối ngày hoặc ETL chạy qua đêm. Với kiến trúc CDC của chúng em, Giám đốc nhìn thấy tiền vào túi trong chưa đầy 3 giây."*

### Demo 2: Real-time Fraud Detection (Bắt Gian Lận Tức Thời)
**Mục tiêu**: Trình diễn sức mạnh của Kafka Streams Rule Engine.
- **Chuẩn bị**: Chạy Script "Nhân viên cố tình tạo và hủy (Void) liên tục 20 đơn hàng trong 1 phút".
- **Thực hiện**: Chạy script, 20 đơn hàng nhảy vào Kafka.
- **Kết quả**: Ngay khi đến đơn thứ 15, Hệ thống Dashboard bật đỏ chót: `🚨 CRITICAL ALERT: Tỷ lệ hủy đơn > 15% tại Chi nhánh HN001 (Nhân viên: EMP001)`.
- **Lời bình**: *"Hệ thống kế toán cũ chỉ phát hiện gian lận khi đối soát cuối tháng. Hệ thống của chúng em bắt quả tang nhân viên gian lận ngay tại thời điểm họ đang thao tác."*

### Demo 3: Fault Tolerance & Self-Healing (Khả Năng Chịu Lỗi)
**Mục tiêu**: Chứng minh tính năng "Zero Data Loss" (Không bao giờ mất dữ liệu) bằng Chaos Engineering.
- **Chuẩn bị**: Dashboard đang chạy, tool sinh đơn hàng tự động đang insert 10 đơn/giây.
- **Thực hiện**: Mở Terminal, gõ lệnh `docker stop kafka-broker-1` (Mô phỏng 1 máy chủ bị cháy/sập nguồn).
- **Kết quả**: POS vẫn bán hàng bình thường. Dashboard có thể khựng lại 5 giây (Do quá trình bầu Leader mới - Raft Consensus). Sau 5 giây, số liệu tiếp tục nhảy, KHÔNG mất bất kỳ một đơn hàng nào đã bán trong lúc sập.
- **Lời bình**: *"Nếu máy chủ kế toán sập, doanh nghiệp dừng hoạt động. Với kiến trúc Quorum của chúng em, máy chủ chết, hệ thống tự phục hồi trong 5 giây mà người dùng không hề hay biết."*


---

# TÀI LIỆU GỐC: 06_Khung_Bao_Cao_Khoa_Hoc.md

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
