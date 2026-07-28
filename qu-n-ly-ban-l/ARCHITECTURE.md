# Tài liệu Kiến trúc Hệ thống Phân tích & Quản lý Bán lẻ (Retail Management System)

Tài liệu này cung cấp cái nhìn chuyên sâu về kiến trúc phần mềm, luồng dữ liệu (Data Flow), mô hình triển khai và các quyết định thiết kế kỹ thuật (Technical Decisions) của hệ thống.

---

## 1. Mô hình Kiến trúc Tổng thể (Overall Architecture)
Hệ thống được thiết kế theo mô hình **Client-Server** kết hợp **Micro-services / Data platform phụ trợ**. 
- **Frontend (Client):** Ứng dụng Single Page Application (SPA) xây dựng bằng React.
- **Backend (Server):** Stateless API Server xây dựng bằng Node.js.
- **Data Layer:** Sử dụng Polyglot Persistence (PostgreSQL cho giao dịch cốt lõi, ClickHouse cho phân tích OLAP, Redis cho Caching).
- **AI Layer:** Giao tiếp qua API với nền tảng OpenRouter (LLM Models).

Toàn bộ hệ thống được container hóa bằng **Docker**, quản lý qua `docker-compose.yml`, giúp việc scale up/down hoặc deploy lên AWS/GCP/Azure trở nên đồng nhất và dễ dàng.

---

## 2. Lớp Trình diễn (Frontend Layer)
Nằm trong thư mục `source/client`, đóng vai trò là giao diện tương tác với người dùng.
- **Công nghệ cốt lõi:** React.js 18, Vite (giúp tốc độ build/HMR cực nhanh), React Router DOM (client-side routing).
- **Thành phần giao diện (UI Framework):** Ant Design (antd) kết hợp với CSS/Inline Styles. Ant Design cung cấp hệ thống Component khổng lồ (Table, Form, Modal) giúp việc xây dựng trang quản trị B2B tiết kiệm 80% thời gian.
- **Quản lý trạng thái (State Management):** Sử dụng React Context API (`AppContext.jsx`) thay vì Redux để giảm thiểu boilerplate. Quản lý các state toàn cục như: 
  - Trạng thái đăng nhập (B2B/B2C User).
  - Giỏ hàng (Cart).
  - i18n (Đa ngôn ngữ Anh/Việt).
  - Giao diện Sáng/Tối (Dark/Light mode).
- **Luồng hoạt động (Modules):**
  - **Phân hệ B2C:** Khách hàng lướt web, xem sản phẩm (`Home.jsx`), xem chi tiết (`ProductDetail.jsx`), thêm vào giỏ hàng và thanh toán.
  - **Phân hệ B2B:** Quản trị viên quản lý danh mục, chi nhánh, xem báo cáo doanh thu (`GeneralManagement.jsx`, `Dashboard.jsx`).

---

## 3. Lớp Xử lý Nghiệp vụ (Backend / API Layer)
Nằm trong thư mục `source/server`, chịu trách nhiệm xử lý logic nghiệp vụ và bảo mật.
- **Công nghệ:** Node.js, Express.js.
- **Cấu trúc Middleware & Bảo mật:**
  - **express-rate-limit:** Giới hạn số lượng request (Ví dụ: 100 request/phút) để chống tấn công DDoS hoặc Spam API.
  - **jsonwebtoken (JWT):** Quản lý phiên đăng nhập (Session) một cách phi trạng thái (Stateless). Token được cấp sau khi login và gửi kèm trong header `Authorization` của mỗi request.
  - **bcryptjs:** Hash mật khẩu trước khi lưu vào Database, đảm bảo an toàn kể cả khi lộ lọt dữ liệu.
  - **Opossum (Circuit Breaker):** Một pattern quan trọng trong Microservices. Nếu một service (ví dụ ClickHouse hoặc AI API) phản hồi chậm hoặc lỗi liên tục, Circuit Breaker sẽ "ngắt mạch", trả về lỗi ngay lập tức thay vì bắt server phải chờ đợi, giúp ngăn chặn hiệu ứng sụp đổ dây chuyền (Cascading Failure).
- **Phân luồng Controller (Routes):**
  - `routes/b2c.js`: Các API public/semi-public (Lấy danh sách sản phẩm có phân trang, lấy chi tiết, flash sale...).
  - `routes/b2b.js`: Các API private yêu cầu quyền Admin (Thêm/Sửa/Xóa dữ liệu, thống kê).
  - `routes/ai.js`: Tách biệt logic xử lý Prompt và gọi API LLM.

---

## 4. Lớp Dữ liệu (Data Layer - Polyglot Persistence)
Hệ thống sử dụng nhiều loại Database khác nhau để phục vụ các mục đích chuyên biệt:
- **PostgreSQL (Thông qua Supabase):** 
  - Đóng vai trò là Cơ sở dữ liệu chính (Primary OLTP Database).
  - Quản lý các dữ liệu giao dịch: `User`, `B2CCustomer`, `Branch`, `Product`, `Order`, `Voucher`, `FlashSale`.
  - Tích hợp PgBouncer (từ Supabase) để quản lý Connection Pooling hiệu quả.
- **Prisma ORM:** 
  - Thay vì viết SQL thô, Backend sử dụng Prisma. Lợi ích là Schema được định nghĩa rõ ràng (`schema.prisma`), hỗ trợ Auto-completion (Type-safe) khi code, và dễ dàng sinh ra các lệnh Migration khi cập nhật cấu trúc bảng.
  - Ví dụ: Tính năng phân trang, lọc sản phẩm theo tên/chi nhánh được xử lý gọn gàng bằng hàm `prisma.product.findMany({ skip, take, where })`.
- **ClickHouse:**
  - Đóng vai trò là Cơ sở dữ liệu phân tích (OLAP Database). Được tối ưu hóa cho các câu lệnh dạng `GROUP BY`, `SUM()` trên hàng triệu dòng dữ liệu.
  - Xử lý các biểu đồ doanh thu theo giờ, theo chi nhánh, tỷ lệ giao hàng hoàn thành, phân tích KPI ở trang Dashboard B2B.
- **Redis:**
  - Lưu trữ bộ nhớ đệm (In-memory Cache).
  - Dữ liệu trả về từ ClickHouse (biểu đồ doanh thu) thường mất thời gian tính toán. Redis sẽ lưu trữ kết quả này trong vài phút. Lần truy cập sau của Admin sẽ lấy thẳng từ Redis, giúp API phản hồi trong <10ms.

---

## 5. Luồng xử lý Trí tuệ Nhân tạo (AI Data Flow)
Hệ thống không tự train model mà sử dụng API từ **OpenRouter** (gọi các model LLM mạnh mẽ như `google/gemini-2.5-flash`). Các luồng xử lý chính:

### A. Gợi ý cá nhân hóa (B2C Recommendation)
1. **Trigger:** Người dùng vào trang chủ, `Home.jsx` gọi API `GET /api/b2c/recommendations?email=...`
2. **Context Gathering:** Backend dùng Prisma tìm 10 đơn hàng gần nhất của User này để trích xuất ra danh sách tên sản phẩm họ đã mua. Đồng thời fetch 50 sản phẩm mới nhất đang có trong kho (`orderBy: { id: 'desc' }`).
3. **Prompt Engineering:** Backend ghép chuỗi lịch sử mua hàng + danh sách hàng trong kho thành một Prompt cụ thể yêu cầu AI đóng vai chuyên gia bán hàng.
4. **AI Processing:** OpenRouter phân tích sự tương quan (Ví dụ: khách từng mua Ốp lưng iPhone -> AI gợi ý mua Cáp sạc iPhone hoặc Kính cường lực có trong kho).
5. **Response:** AI trả về mảng ID sản phẩm (dạng JSON). Backend map các ID này với dữ liệu thật và trả về cho Frontend.

### B. Gợi ý Chiến dịch Khuyến mãi (B2B Campaign Suggestion)
1. **Trigger:** Quản trị viên ấn nút "AI Gợi ý" tại tab Khuyến mãi.
2. **Context Gathering:** Backend thống kê hàng tồn kho (sản phẩm nào ế, sản phẩm nào bán chạy) và giá bán.
3. **Prompt Engineering:** Yêu cầu AI đóng vai giám đốc Marketing, xây dựng một chiến dịch xả hàng (Flash Sale).
4. **Response:** AI tính toán độ giảm giá hợp lý (Ví dụ: giảm 15% cho SP ế để thu hồi vốn) và trả về tên chiến dịch, mô tả, danh sách sản phẩm được chọn cùng mức giá giảm. Frontend điền tự động dữ liệu này vào Form tạo Flash Sale.
