# Khung Bài Báo Cáo Khoa Học Quốc Tế (Thesis Academic Paper Outline)

> Dưới đây là kết quả của quá trình Brainstorming chuyên sâu, định hình hệ thống hiện tại thành một bài báo cáo khoa học/luận văn thạc sĩ/cử nhân đạt chuẩn quốc tế (IEEE/ACM format).

---

## Tiêu đề dự kiến (Proposed Titles)
1. **Tiếng Anh:** Integrating Real-Time Big Data Analytics via CDC Kafka Pipeline in an Omnichannel Retail Ecosystem.
2. **Tiếng Việt:** Kiến trúc Tích hợp Phân tích Dữ liệu lớn Thời gian thực qua Pipeline CDC Kafka trong Hệ sinh thái Bán lẻ Đa kênh.

---

## Abstract (Tóm tắt nghiên cứu)
Trong kỷ nguyên bán lẻ đa kênh (Omnichannel), các hệ thống Quản lý Điểm bán (POS) và Thương mại điện tử truyền thống đang gặp giới hạn về khả năng đồng bộ và phân tích dữ liệu thời gian thực (Real-time Analytics) do sự chậm trễ của các quá trình ETL truyền thống. Nghiên cứu này đề xuất một kiến trúc hệ thống hiện đại, trong đó hệ thống E-commerce/POS đóng vai trò là Nguồn phát dữ liệu (Data Producer), sử dụng cơ chế **Change Data Capture (CDC)** để thu thập mọi thay đổi từ cơ sở dữ liệu quan hệ (PostgreSQL) và đẩy qua nền tảng truyền phát sự kiện **Apache Kafka**, trước khi lưu trữ tại cơ sở dữ liệu OLAP **ClickHouse**. Nghiên cứu sẽ tiến hành đánh giá hiệu năng (Throughput, Latency, Fault Tolerance) và chứng minh tính khả thi của kiến trúc thông qua các ứng dụng thực tiễn như Phân tích tồn kho thời gian thực, Đối soát tài chính và Phát hiện gian lận.

---

## 1. Introduction (Giới thiệu)
- **Bối cảnh (Background):** Sự chuyển dịch từ bán lẻ truyền thống sang đa kênh (Online-to-Offline). Đặc thù khắt khe của hệ thống đại lý Apple (Cần tracking IMEI/Serial real-time).
- **Vấn đề nghiên cứu (Problem Statement):**
  - Giao dịch đồng thời cao (High concurrency) trong các đợt mở bán (Flash sale iPhone mới) gây nghẽn cơ sở dữ liệu giao dịch (OLTP).
  - Độ trễ của báo cáo (Data Latency) khiến Ban Giám đốc ra quyết định sai lầm.
- **Mục tiêu & Đóng góp (Objectives & Contributions):** Xây dựng hệ thống mẫu (Prototype) và cung cấp bộ dữ liệu benchmark thực tế về độ trễ của luồng CDC Kafka so với Batch Processing truyền thống.

---

## 2. System Architecture (Kiến trúc Hệ thống Đề xuất)
*Trình bày mô hình Event-Driven Architecture (Kiến trúc hướng sự kiện).*

- **Operational Layer (Tầng Vận hành - Ứng dụng của bạn):** Frontend React.js (Ant Design) + Backend Node.js + DB (PostgreSQL). Đảm nhiệm việc tạo ra dữ liệu chất lượng cao (Sale Orders, Input/Output Vouchers).
- **Data Integration Layer (Tầng Tích hợp):** Sử dụng **Debezium** làm CDC Connector để đọc Transaction Log (WAL) từ Database mà không làm giảm hiệu năng của DB.
- **Streaming Layer (Tầng Truyền phát):** **Apache Kafka** đóng vai trò Message Broker, đảm bảo tính High Throughput và Fault Tolerance.
- **Analytical Layer (Tầng Phân tích):** **ClickHouse** (Column-oriented DB) để lưu trữ và tối ưu hóa các câu truy vấn Big Data.

---

## 3. Khai thác Chiều sâu Học thuật (Deep Research Exploitations)
*Đây là phần brainstorming các "Chất xám khoa học" có thể viết thành các chương phân tích sâu trong khóa luận:*

### 3.1. Bài toán Tính nhất quán Dữ liệu (Data Consistency in Distributed Systems)
- **Khai thác:** Khi một đơn hàng (Sale Order) được tạo trên POS, làm sao đảm bảo số lượng tồn kho (Inventory) trên ClickHouse phản ánh chính xác 100% trong môi trường phân tán?
- **Giải pháp:** Bàn luận về cơ chế Exactly-Once Semantics (EOS) của Kafka và Idempotency.

### 3.2. Real-time Fraud Detection (Phát hiện gian lận thời gian thực)
- **Khai thác:** Ứng dụng Stream Processing (Kafka Streams hoặc ksqlDB).
- **Giải pháp:** Thiết lập các Windowing Functions (ví dụ: Tumbling Window 5 phút). Nếu phát hiện 1 nhân viên tạo > 50 đơn hàng hủy (Void) trong 5 phút -> Kích hoạt cảnh báo Alert ngay lập tức. Đây là một Use-case Big Data cực mạnh.

### 3.3. Đối soát Tài chính Tự động (Automated Invoice Reconciliation)
- **Khai thác:** Xử lý luồng sự kiện đa nguồn (Multi-source Event Joins).
- **Giải pháp:** Stream 1 là `pm_saleorder` (Đơn hàng), Stream 2 là `pm_inputvoucher` (Dòng tiền về). Dùng cơ chế Stream-Table Join để phát hiện các đơn hàng đã xuất kho nhưng tiền chưa vào tài khoản (Unreconciled transactions).

### 3.4. Cold-Start Problem trong E-commerce Recommendation
- **Khai thác:** Khi khách hàng mới lần đầu vào Web (chưa có lịch sử), làm sao gợi ý?
- **Giải pháp:** Sử dụng Real-time Clickstream. Khách vừa click vào "MacBook", luồng Kafka bắt ngay sự kiện click, đẩy vào Rule-engine và trang web tự động đổi Banner sang "Phụ kiện Hub Type-C". Mọi thứ diễn ra dưới 200ms.

---

## 4. Experimental Setup & Evaluation (Thiết kế Thực nghiệm & Đánh giá)
*Cách thiết kế các bài test để chứng minh với Hội đồng khoa học.*

- **Metric 1: End-to-End Latency (Độ trễ toàn trình):**
  - *Cách làm:* Viết script đo Timestamp(T1) lúc `INSERT` vào PostgreSQL và Timestamp(T2) lúc bản ghi xuất hiện trong ClickHouse. Vẽ biểu đồ phân phối Latency (P95, P99). Mục tiêu: Latency < 1 giây.
- **Metric 2: High Throughput Stress Testing (Sức chịu tải):**
  - *Cách làm:* Sử dụng Apache JMeter tạo 10.000 requests/giây (Tương đương traffic ngày mở bán iPhone). Đo đếm số lượng Messages/sec mà Kafka và ClickHouse xử lý được.
- **Metric 3: Fault Tolerance (Tính chịu lỗi):**
  - *Cách làm:* Đang stream dữ liệu, giả lập sự cố Crash Kafka Node (Chaos Engineering). Đo lường Recovery Time (Thời gian phục hồi) và kiểm chứng Data Loss (Không mất bản ghi nào).
- **Metric 4: OLAP vs OLTP Query Performance:**
  - *Cách làm:* Chạy cùng 1 câu lệnh SQL "Tính tổng doanh thu theo giờ trong 5 năm (10 triệu bản ghi)". So sánh thời gian phản hồi: PostgreSQL (mất vài phút) vs ClickHouse (vài chục mili-giây). Vẽ biểu đồ cột so sánh.

---

## 5. Conclusion & Future Works (Kết luận)
- **Kết luận:** Khẳng định sự ưu việt của kiến trúc CDC Kafka so với Batch ETL truyền thống trong bán lẻ hiện đại.
- **Hướng phát triển:** Tích hợp Machine Learning model trực tiếp vào Kafka Stream (Real-time Inference) để dự báo nhu cầu (Demand Forecasting).

---

> [!NOTE]
> **Lời khuyên cho việc lập trình:** 
> Để khóa luận thuyết phục, Ứng dụng E-commerce & POS của bạn (Frontend + Backend) phải chạy thật mượt mà, cấu trúc code sạch sẽ, UI chuẩn doanh nghiệp (Ant Design). Khi phần "Vỏ" và "Lõi tạo dữ liệu" hoàn hảo, thì phần "Đường ống Big Data" (Kafka) ở phía sau mới có ý nghĩa để trình diễn.
