# GetShopy - Nền Tảng Bán Lẻ & Quản Trị Chuỗi Cung Ứng (B2C & B2B)

GetShopy là một hệ thống thương mại điện tử toàn diện bao gồm trang mua sắm cho khách hàng (B2C) và hệ thống quản trị chuyên sâu (B2B Admin Dashboard) dành cho chuỗi cửa hàng bán lẻ công nghệ. Hệ thống được xây dựng trên kiến trúc phân luồng dữ liệu hiện đại, sử dụng Data Warehouse (ClickHouse) cho phân tích dữ liệu lớn và Redis để tối ưu hóa hiệu năng.

## 🌟 Chức năng nổi bật

### Trang Khách Hàng (B2C - Client)
- **Cửa hàng trực tuyến (Storefront):** Hiển thị sản phẩm, lọc theo danh mục, tính năng so sánh sản phẩm (Compare) và danh sách yêu thích (Wishlist).
- **Chi tiết sản phẩm:** Xem thông tin, đánh giá, thư viện ảnh với tính năng Zoom, và gợi ý sản phẩm liên quan.
- **Giỏ hàng & Thanh toán:** Quản lý giỏ hàng thông minh, hỗ trợ mã giảm giá (Voucher), tính phí vận chuyển và tích hợp các phương thức thanh toán.
- **Quản lý tài khoản & Đơn hàng:** 
  - Xem lịch sử mua hàng, tải hóa đơn điện tử (PDF).
  - Theo dõi quá trình xử lý đơn hàng chi tiết qua 4 mốc: *Chờ xác nhận -> Đã đóng gói -> Đang giao hàng -> Đã giao hàng*.
  - **Bản đồ Tracking Real-time (Leaflet & OpenStreetMap):** Hiển thị tuyến đường từ Cửa hàng đến nhà khách hàng và mô phỏng xe của Shipper di chuyển trực quan.

### Trang Quản Trị (B2B - Admin)
- **Dashboard Phân tích (Analytics):** Thống kê doanh thu thời gian thực, biểu đồ xu hướng, lợi nhuận đa chiều sử dụng sức mạnh xử lý của OLAP Database (ClickHouse).
- **Quản lý danh mục (General Management):** Thêm, sửa, xóa sản phẩm, quản lý kho hàng và khách hàng.
- **Xử lý đơn hàng (Fulfillment):** Hệ thống theo dõi chuỗi cung ứng, cập nhật trạng thái đóng gói, vận chuyển và tự động đồng bộ (sync) cập nhật tới trang B2C của khách hàng.
- **Đối soát tài chính (Reconciliation):** Tự động phát sinh phiếu thu, so khớp dòng tiền thanh toán qua thẻ ngân hàng/VNPay.
- **Cảnh báo thông minh & AI Chatbot:** Phát hiện bất thường trong tồn kho/doanh thu và trợ lý AI giúp người quản trị hỏi đáp số liệu nhanh chóng.

---

## 🚀 Hướng dẫn cài đặt và khởi chạy (Localhost)

Hệ thống cung cấp sẵn `docker-compose` giúp bạn dễ dàng khởi chạy toàn bộ dịch vụ (Cả Frontend, Backend, Database) chỉ bằng 1 câu lệnh.

### Yêu cầu tiên quyết
- Đã cài đặt [Docker](https://www.docker.com/) và Docker Compose.
- Đã cài đặt [Node.js](https://nodejs.org/) (Nếu muốn chạy ở môi trường ngoài Docker).

### Cách chạy với Docker (Khuyên dùng)
1. Mở Terminal (Command Prompt / PowerShell) và di chuyển vào thư mục gốc của dự án.
2. Chạy câu lệnh sau:
   ```bash
   docker-compose up -d --build
   ```
3. Docker sẽ tự động cài đặt các thành phần, kéo image của ClickHouse, Redis, Nodejs và chạy dự án.

### Thông tin các Port (Cổng) truy cập Local
Sau khi Docker khởi động xong, bạn truy cập hệ thống qua các đường dẫn sau:

- **Frontend B2C & B2B (Giao diện Web):** [http://localhost:5173](http://localhost:5173)
- **Backend API (Node.js/Express):** `http://localhost:8080` (Ví dụ: [http://localhost:8080/api/b2c/products](http://localhost:8080/api/b2c/products))
- **ClickHouse (Data Warehouse):** `http://localhost:8123` (Cổng HTTP API) và `9000` (Cổng Native TCP).
- **Redis (Cache):** `localhost:6379`

### Cách chạy thủ công không dùng Docker (Tùy chọn)

**1. Khởi động Backend:**
```bash
cd source/server
npm install
npm run dev
```
*(Backend sẽ chạy ở port `8080`)*

**2. Khởi động Frontend:**
```bash
cd source/client
npm install
npm run dev
```
*(Frontend sẽ chạy ở port `5173`)*

> **Lưu ý:** Nếu chạy thủ công, bạn vẫn cần phải có ClickHouse và Redis chạy ngầm trên máy (hoặc chạy 2 dịch vụ đó qua docker-compose riêng) thì API mới hoạt động hoàn chỉnh.

---
**Đồ án Khóa Luận Tốt Nghiệp - Hệ thống GetShopy**
