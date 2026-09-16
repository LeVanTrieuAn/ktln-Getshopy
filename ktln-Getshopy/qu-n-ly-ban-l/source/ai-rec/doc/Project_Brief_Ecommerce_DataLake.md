# BẢN TÓM TẮT DỰ ÁN (PROJECT BRIEF)
**Dự án:** Phát triển Hệ thống Thương mại Điện tử Tích hợp Xử lý Dữ liệu lớn và AI Recommendation

---

## 1. Tổng quan dự án (Project Overview)
Dự án tập trung phát triển một ứng dụng thương mại điện tử (E-commerce) B2C có khả năng xử lý, phân tích và tận dụng khối lượng dữ liệu khổng lồ từ hệ thống Data Lake của doanh nghiệp. Mục tiêu trọng tâm là xây dựng một nền tảng mua sắm thông minh, cá nhân hóa trải nghiệm người dùng thông qua các thuật toán AI (Recommendation) và giải quyết bài toán về hiệu năng (performance) khi thao tác với cơ sở dữ liệu lên tới hàng triệu bản ghi.

## 2. Nguồn dữ liệu & Kiến trúc hệ thống (Data & Architecture)
- **Nguồn dữ liệu gốc:** Hệ thống quản lý dữ liệu tập trung (Data Lake) của doanh nghiệp, nơi gom dữ liệu từ nhiều hệ thống OLTP (Online Transaction Processing) khác nhau. Dữ liệu thô (raw data) được lưu trữ trên MinIO dưới định dạng Parquet.
- **Dữ liệu dự án (Mock Data):** Để phục vụ phát triển, nhóm sẽ sử dụng bản sao dữ liệu (mock data) được trích xuất và cung cấp bởi doanh nghiệp. Dữ liệu này sẽ được lưu trữ và quản lý trên Development Database Server (Data Server riêng của nhóm).
- **Quy mô dữ liệu:** Hệ thống phải được thiết kế để chịu tải và xử lý khoảng **1 triệu bản ghi (records)** sản phẩm/giao dịch.
- **Kiến trúc tích hợp:** Ứng dụng Web E-commerce (đã có sẵn nền tảng) sẽ được kết nối trực tiếp với Data Server chứa 1 triệu bản ghi để thực hiện truy vấn, tìm kiếm và phân tích.

## 3. Yêu cầu chức năng chính (Key Features)
### 3.1. Chức năng E-commerce Cốt lõi
- Hiển thị, duyệt danh sách sản phẩm.
- Cơ chế tìm kiếm, lọc (filtering) và phân loại sản phẩm tốc độ cao.
- Xử lý các quy trình mua hàng cơ bản.

### 3.2. Hệ thống Gợi ý Thông minh (Recommendation System - AI)
- Thu thập và phân tích dữ liệu hành vi, lịch sử mua hàng của người dùng.
- Áp dụng các mô hình Học máy (Machine Learning) để đưa ra các đề xuất sản phẩm cá nhân hóa.
- **Thuật toán dự kiến:** 
  - Lọc cộng tác (Collaborative Filtering - CF).
  - Lọc theo nội dung (Content-Based Filtering - CBF).

### 3.3. Phân tích dữ liệu & Báo cáo (Analytics - Tuỳ chọn)
- Phân tích dữ liệu bán lẻ, doanh thu, chiến dịch bán hàng.
- Tổng hợp dữ liệu thành các báo cáo/dashboard hỗ trợ quyết định kinh doanh.

## 4. Thách thức & Yêu cầu kỹ thuật (Technical Challenges)
- **Bài toán Hiệu năng (Performance Tuning):** Đây là yêu cầu quan trọng nhất từ phía giảng viên hướng dẫn. Nhóm phải giải quyết câu hỏi: *Làm thế nào để ứng dụng chạy mượt mà, truy vấn và tìm kiếm nhanh chóng khi Database có 1 triệu bản ghi?*
- **Thiết kế Cơ sở dữ liệu (Database Design):** Cần tối ưu hóa cấu trúc DB, đánh index, và tổ chức dữ liệu hợp lý để tránh thắt cổ chai (bottleneck).
- **Tích hợp AI Pipeline:** Xây dựng luồng dữ liệu (data pipeline) để các mô hình AI có thể đọc, huấn luyện dựa trên tập dữ liệu lớn và trả về kết quả gợi ý realtime hoặc near-realtime lên giao diện.

## 5. Kế hoạch hành động & Bước tiếp theo (Next Steps)
- **Mục tiêu Ngắn hạn (Trong 2 tuần tới - MVP):**
  - Hoàn thiện kết nối giữa Web App E-commerce hiện tại và cơ sở dữ liệu chứa 1 triệu bản ghi.
  - Chứng minh được hệ thống cơ bản có thể vận hành và hiển thị dữ liệu thành công với quy mô này.
- **Nghiên cứu Kỹ thuật:** Tìm hiểu sâu về các phương pháp xử lý dữ liệu lớn, tối ưu hóa truy vấn và kiến trúc phân tán (nếu cần).
- **Cập nhật Tiến độ:** Hoàn thiện bản đề cương (proposal) chi tiết, cập nhật kế hoạch thực hiện và phương án thiết kế hệ thống lên cổng quản lý dự án của trường.
