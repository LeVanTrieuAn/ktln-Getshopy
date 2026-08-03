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
