# Enterprise Apple Authorized Reseller (AAR) System Specification
*Tài liệu Đặc tả Hệ thống Quản trị & Bán lẻ chuẩn Thương mại tích hợp Big Data Pipeline*

Tài liệu này phác thảo kiến trúc và đặc tả tính năng cho một hệ sinh thái phần mềm cấp doanh nghiệp (Enterprise-grade) dành cho đại lý ủy quyền của Apple, đảm bảo khả năng vận hành thực tế, mở rộng chuỗi và đáp ứng các tiêu chuẩn khắt khe nhất của ngành bán lẻ.

Đặc biệt, hệ thống được thiết kế để trở thành nguồn cung cấp dữ liệu (Source System) cho nền tảng **Big Data Data Platform** thông qua luồng **CDC Kafka**, nhằm phô diễn toàn bộ sức mạnh xử lý dữ liệu thời gian thực.

---

## 1. Kiến trúc Hệ sinh thái (System Architecture)
Hệ thống không chỉ là một ứng dụng đơn lẻ mà là một hệ sinh thái Omnichannel (Bán lẻ đa kênh), bao gồm:

1. **POS (Point of Sale) App**: Ứng dụng tại quầy dành cho nhân viên bán hàng (tối ưu cho iPad và Màn hình cảm ứng).
2. **E-Commerce Web App**: Trang mua sắm trực tuyến cho khách hàng cuối (B2C) tích hợp trả góp.
3. **ERP / Backoffice System**: Hệ thống quản trị trung tâm dành cho Ban giám đốc, Kế toán, và Quản lý kho.
4. **CRM & Loyalty App**: Hệ thống quản lý quan hệ khách hàng và hạng thẻ thành viên.

---

## 2. Tích hợp Luồng Dữ liệu Lớn (Big Data CDC Kafka Pipeline)

Để làm nổi bật sức mạnh xử lý dữ liệu (Big Data Features) của nền tảng, ứng dụng E-commerce / POS này sẽ đóng vai trò là "Data Producer" hoàn hảo. Mọi thay đổi dữ liệu (Insert, Update, Delete) dưới Database của hệ thống (PostgreSQL/MySQL) sẽ được bắt tự động qua cơ chế **CDC (Change Data Capture)**, đẩy vào **Apache Kafka**, và stream thẳng sang **ClickHouse** để phân tích thời gian thực.

Dưới đây là 4 Ứng dụng (Applications) phân tích dữ liệu chuyên sâu được xây dựng trên nền tảng này:

### 2.1. Real-time ERP/POS Analytics (Ứng dụng phân tích Bán lẻ thời gian thực)
*Sử dụng luồng dữ liệu đơn hàng (Ví dụ: `erp.pm_saleorder`)*
- **Data Flow**: Khách hàng đặt mua iPhone/MacBook → CDC bắt thay đổi → Kafka → ClickHouse.
- **Tính năng nổi bật**:
  - **Real-time Inventory Tracking**: Dashboard tồn kho nhảy số ngay lập tức khi có máy được xuất kho, độ trễ tính bằng mili-giây.
  - **Revenue Dashboard (Theo giờ)**: Lãnh đạo xem doanh thu nhảy real-time trong ngày mở bán iPhone mới (Launch Day).
  - **Fraud Detection (Chống gian lận)**: Phát hiện ngay lập tức nhân viên tạo đơn hàng bất thường (giá bán sai lệch, chiết khấu quá mức) và gửi Alert.

### 2.2. E-commerce Behavior Analytics (Nền tảng phân tích hành vi mua sắm)
*Sử dụng luồng dữ liệu clickstream và giỏ hàng.*
- **Data Flow**: Hành vi lướt web của user / Thêm vào giỏ hàng → CDC / Event Tracker → Kafka → ClickHouse.
- **Tính năng nổi bật**:
  - **Cart Abandonment Detection**: Tự động phát hiện khách hàng bỏ quên giỏ hàng chứa MacBook Pro trong 30 phút và kích hoạt kịch bản gửi Email Voucher giảm 5%.
  - **Real-time Recommendation**: Hệ thống AI gợi ý mua phụ kiện (Magic Mouse, AirPods) thay đổi tức thời dựa trên sản phẩm khách vừa click vào.
  - **Dynamic Pricing**: Điều chỉnh giá tự động nếu phát hiện lượng truy cập vào một sản phẩm tăng đột biến nhưng lượng mua thấp.

### 2.3. Financial/Accounting Intelligence (Hệ thống Kế toán Tài chính)
*Sử dụng luồng dữ liệu chứng từ thu/chi (Ví dụ: `pm_inputvoucher`, `pm_outputvoucher`)*
- **Data Flow**: Phát sinh chứng từ thu/chi → CDC → Kafka → ClickHouse.
- **Tính năng nổi bật**:
  - **Real-time P&L Tracking**: Báo cáo Lợi nhuận và Lỗ (Profit & Loss) được cập nhật theo thời gian thực thay vì chờ kế toán chốt sổ cuối tháng.
  - **Invoice Reconciliation (Đối soát tự động)**: Tự động so khớp dữ liệu đơn hàng (Sale Order) với chứng từ thu (Input Voucher) xem dòng tiền đã thực sự về tài khoản chưa.
  - **Cash Flow Monitoring**: Giám sát dòng tiền của chuỗi cửa hàng.

### 2.4. Supply Chain & Fulfillment Monitoring (Giám sát Chuỗi cung ứng)
*Sử dụng luồng dữ liệu vận chuyển và đơn đặt hàng*
- **Data Flow**: `pm_saleorder` → `pm_outputvoucher` → `delivery_status` → CDC → Kafka.
- **Tính năng nổi bật**:
  - **Track Fulfillment Steps**: Theo dõi từng bước đơn hàng từ lúc chốt đơn đến khi giao cho đơn vị vận chuyển.
  - **SLA Breach Detection**: Cảnh báo thời gian thực nếu đơn hàng giao trễ hơn cam kết (Ví dụ: Giao hỏa tốc 2H nhưng qua 1H30p kho chưa xuất hàng).
  - **Supplier Performance**: Đánh giá hiệu suất của các nhà cung cấp phụ kiện.

---

## 3. Các Tiêu Chí Kỹ Thuật Chứng Minh Sức Mạnh Big Data (GVHD Demo Guidelines)

Hệ thống POS/E-commerce này sẽ được dùng để demo trực tiếp các đặc tính (Features) của kiến trúc Big Data trước Hội đồng Bảo vệ Khóa luận:

| Feature Đặc trưng | Kịch bản Demo trên hệ thống E-commerce / POS |
| :--- | :--- |
| **High Throughput (Lưu lượng cao)** | Chạy script tự động tạo 1.000.000 đơn hàng (Insert 1M records) vào E-commerce DB. Mở Grafana/ClickHouse dashboard để đo thời gian dữ liệu cập nhật. |
| **Low Latency (Độ trễ thấp)** | Nhân viên POS bấm "Thanh toán" đơn hàng 1 chiếc iPhone. Quay sang màn hình Financial Dashboard của CFO xem doanh thu nhảy ngay lập tức trong vòng vài giây. |
| **Fault Tolerance (Khả năng chịu lỗi)** | Giả lập sự cố: Tắt đột ngột (Kill) Kafka Broker trong khi POS vẫn tiếp tục bán hàng. Sau đó Restart Kafka và chứng minh dữ liệu đơn hàng không hề bị mất mát (No data loss). |
| **Scalability (Mở rộng linh hoạt)** | Tăng đột ngột khối lượng dữ liệu lịch sử bán hàng lên gấp 10 lần. Thực hiện các câu query phức tạp trên ClickHouse (Ví dụ: Tìm top sản phẩm bán chạy nhất trong 5 năm) và đo lường thời gian query (Query time) vẫn duy trì ở mức tối ưu. |
| **Data Quality & Auto-heal** | Cố tình tiêm lỗi (Inject lỗi) vào dữ liệu đơn hàng. Trình diễn cách Checksum Worker phát hiện bất thường và hệ thống tự động cảnh báo/sửa chữa (Auto-heal). |

---

## 4. Tóm tắt Giá trị Đề tài
Với sự kết hợp giữa hệ thống **E-commerce/POS chuẩn Apple Authorized Seller** (Tạo ra dữ liệu thật, nghiệp vụ thật) và nền tảng **Kafka CDC & ClickHouse** (Xử lý dữ liệu lớn), đề tài khóa luận này giải quyết trọn vẹn 2 bài toán:
1. Xây dựng ứng dụng kinh doanh có tính thực tiễn và tính thẩm mỹ cao (Ant Design, i18n, Dark Mode).
2. Trình diễn được năng lực xử lý Big Data cấp doanh nghiệp, có giá trị ứng dụng cao cho Ban Giám đốc (CFO, Store Manager) để ra quyết định dựa trên dữ liệu (Data-driven decision making).
