# TÀI LIỆU 02: PRODUCT REQUIREMENTS DOCUMENT (PRD) VÀ ĐẶC TẢ ỨNG DỤNG
**Các Ứng Dụng Khai Thác Sức Mạnh Big Data Pipeline**

Tài liệu này đặc tả các ứng dụng (Applications) được xây dựng trên nền tảng luồng dữ liệu CDC Kafka. Bằng cách tiêu thụ (consume) dữ liệu từ các Topic `erp.pm_saleorder`, `erp.pm_inputvoucher`, `erp.pm_outputvoucher`, hệ thống có thể cung cấp các phân tích kinh doanh cực kỳ mạnh mẽ.

---

## 1. ỨNG DỤNG 1: FINANCIAL ANALYTICS DASHBOARD (Bảng Điều Khiển Tài Chính)
**Đối tượng sử dụng**: CEO, CFO, Store Manager.
**Mục tiêu**: Cung cấp cái nhìn toàn cảnh về tình hình tài chính, doanh thu, dòng tiền theo thời gian thực (Độ trễ < 3 giây).

### 1.1. Các Chỉ Số Cốt Lõi (Real-time KPIs)
- **Doanh thu hôm nay (Revenue Today)**: Tổng hợp theo giờ, so sánh với ngày hôm qua.
- **Tiền thu (Cash Collected)**: Dòng tiền thực tế đã thu vào.
- **Biên lợi nhuận (Gross Margin)**: Tính toán chênh lệch giữa giá bán và giá vốn. Cảnh báo tự động nếu biên lợi nhuận < 8% (Margin Erosion Detector).
- **Trạng thái Đối soát (Reconciliation Status)**: So khớp tự động giữa Đơn hàng (Sale Order) và Phiếu thu (Input Voucher). Phân loại: Khớp (Matched), Chờ thu (Pending), Lệch (Mismatch).

### 1.2. Phân Quyền (RBAC)
- **CEO / CFO**: Xem dữ liệu toàn chuỗi, xem tất cả các chi nhánh.
- **Store Manager**: Chỉ được xem dữ liệu của chi nhánh mình quản lý.

---

## 2. ỨNG DỤNG 2: FRAUD DETECTION ENGINE (Hệ Thống Chống Gian Lận)
**Đối tượng sử dụng**: Risk Management Team (Quản trị rủi ro), Quản lý khu vực.
**Mục tiêu**: Áp dụng Stream Processing (Kafka Streams) để phát hiện hành vi bất thường ngay tại thời điểm xảy ra, thay vì đợi kiểm toán cuối tháng.

### 2.1. Các Quy Tắc Cảnh Báo (Rules)
- **Tỷ lệ hủy đơn cao (High Void Rate)**: Sử dụng Tumbling Window (ví dụ: 1 giờ). Nếu 1 nhân viên/chi nhánh có tỷ lệ hủy đơn > 15% tổng đơn → Kích hoạt Alert Cấp độ Cao (HIGH).
- **Thanh toán tiền mặt sau giờ làm (After-hours Cash)**: Nếu đơn hàng thanh toán bằng tiền mặt được tạo ra sau 22:00 → Kích hoạt Alert Cấp độ Vừa (MEDIUM).
- **Sai lệch giá (Price Deviation)**: Giá bán thực tế thấp hơn 10% hoặc cao hơn 5% so với giá niêm yết (Không áp dụng chương trình khuyến mãi hợp lệ).

---

## 3. ỨNG DỤNG 3: SUPPLY CHAIN & FULFILLMENT TRACKER
**Đối tượng sử dụng**: Operations Team (Vận hành).
**Mục tiêu**: Giám sát SLA giao hàng, ngăn ngừa tồn kho "ma".

### 3.1. Tính Năng Giám Sát SLA (Proactive SLA Engine)
- Tính toán thời gian từ lúc khách chốt đơn đến khi xuất kho giao hàng (`pm_outputvoucher.output_date - pm_saleorder.order_date`).
- Nếu sắp chạm mốc cam kết SLA (ví dụ: giao trong 4 giờ) mà chưa xuất kho → Tự động gửi Alert cho kho và SMS xin lỗi khách hàng (Cơ chế Self-healing).

### 3.2. Cập Nhật Tồn Kho (One Second Inventory)
- Áp dụng nguyên lý CQRS và Optimistic Inventory Locking.
- Khi chốt đơn, chỉ đẩy sự kiện vào Kafka. ClickHouse tính tổng `SUM(nhập) - SUM(xuất)` để ra tồn kho thực tế, không lock Database OLTP.

---

## 4. ỨNG DỤNG 4: AI & CUSTOMER INTELLIGENCE (Hệ Thống Trí Tuệ Khách Hàng)
**Đối tượng sử dụng**: Marketing Team, Chăm sóc Khách hàng (CRM).

### 4.1. "Customer DNA" (Vector Embedding)
- Mỗi hành động của khách hàng (click, add to cart, buy) được mã hóa thành vector 128 chiều.
- Lưu trong Vector Database để tìm kiếm "Lookalike Audience" (Khách hàng tương tự) bằng Cosine Similarity, phục vụ cho các chiến dịch Upsell (ví dụ: Gợi ý mua AirPods cho khách vừa mua iPhone 15).

### 4.2. Giải Quyết Tranh Chấp Bằng AI (Dispute Resolution)
- Hợp nhất lịch sử bảo hành, lịch sử mua hàng, lần mở máy đầu tiên (First Boot) thành một "Customer Golden Record".
- Khi khách claim bảo hành, hệ thống AI tự động viết một bản tóm tắt tình trạng vòng đời của thiết bị, giúp nhân viên có cơ sở chính xác để phản hồi khách.

---

## 5. UI/UX & FRONTEND REQUIREMENT
- **Framework**: React.js 19 + Ant Design 5.
- **Biểu đồ**: Apache ECharts để vẽ biểu đồ Line Chart (Doanh thu theo giờ, cập nhật real-time không cần reload trang).
- **Đa Ngôn Ngữ (i18n)**: Hỗ trợ tiếng Việt (VI) và tiếng Anh (EN).
- **Giao Diện**: Hỗ trợ Light / Dark Mode chuẩn Enterprise. Layout bao gồm Sidebar chứa các tab: Dashboard, Financial, Alerts, Fulfillment. Trang Dashboard phải hiển thị được KPI Cards (Revenue, Orders, Net Cash) cùng với Ranking các chi nhánh tốt nhất.
