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

## 🚀 Khởi chạy

Repo này là **private**. Toàn bộ hệ thống lên bằng **một lệnh** — không cần
cài Node, không cần chạy migration, không cần seed tay.

### 1. Xin file `.env`

`.env` chứa mật khẩu và khoá thật nên **không nằm trong repo**. Xin từ chủ
repo rồi đặt ở thư mục gốc (ngang hàng với `docker-compose.yml`).

Quên bước này thì compose dừng ngay với thông báo
`required variable POSTGRES_PASSWORD is missing a value` — nó cố tình dừng
thay vì chạy tiếp với mật khẩu rỗng rồi hỏng ở chỗ không liên quan.

`.env.example` liệt kê đủ biến kèm giải thích, dùng để đối chiếu.

### 2. Chạy

```bash
docker compose up -d --build
```

Thế thôi. Lần đầu mất **10–20 phút**: build image, rồi seed 600.000 sản phẩm
và 1,2 triệu dòng tồn kho. Theo dõi bằng:

```bash
docker compose logs -f server      # tiến độ seed
docker compose logs -f bootstrap   # khởi tạo phần big-data
```

Những việc sau **tự chạy**, không cần gõ gì thêm:

| Việc | Ai làm |
|---|---|
| Tạo schema Postgres, seed 600k sản phẩm, tồn kho, voucher, flash sale | `server` lúc khởi động |
| Tạo bucket MinIO, user ClickHouse, kéo masterdata, đăng ký connector CDC | `bootstrap` (chạy một lần rồi thoát) |
| Dựng model dbt mỗi 5 phút | `dbt-scheduler` |
| Train lại mô hình gợi ý mỗi 5 phút | `ai-rec` |
| Sao lưu Postgres mỗi 24h vào `./backups/` | `dbt-scheduler` |

Seed chỉ chạy khi database còn rỗng. Lần `up` sau bỏ qua, dữ liệu giữ nguyên.

### 3. Truy cập

| Địa chỉ | Là gì |
|---|---|
| http://localhost:3000 | **Cửa hàng + trang quản trị** (`/admin/dashboard`) |
| http://localhost:3001 | Metabase |
| http://localhost:8123 | ClickHouse HTTP |
| http://localhost:8083 | Kafka Connect REST |
| http://localhost:9001 | MinIO Console |
| localhost:5432 | Postgres |

Backend Node và AI-Rec **không mở cổng ra ngoài** — gọi qua `localhost:3000/api`,
nginx của `client` chuyển tiếp vào.

Tài khoản có sẵn:

| Vai | Tài khoản |
|---|---|
| Quản trị | `admin@gmail.com` / `admin` |
| Khách hàng | `test@getshopy.vn` / `123456` |

### 4. Lệnh hay dùng

```bash
docker compose ps                                  # trạng thái 14 service
docker compose logs -f <service>                   # xem log
docker compose --profile dbt run --rm dbt build    # chạy dbt ngay, không chờ lịch
python3 data-platform-poc/pos_simulator.py --orders 200   # bắn đơn giả lập
```

### ⚠️ Lệnh KHÔNG được chạy

```bash
docker compose down -v    # -v XOÁ SẠCH volume: 600k sản phẩm, warehouse, data lake
```

`down` không kèm `-v` thì an toàn — dữ liệu nằm trong named volume, `build` và
`up` không đụng tới. Bản sao lưu tự động nằm ở `./backups/`, khôi phục bằng
`sh scripts/import-data.sh <thư-mục>`.

---

## 📁 Cấu trúc

```
.
├── docker-compose.yml          # toàn bộ 14 service
├── .env                        # KHÔNG trong repo — xin riêng
├── ktln-Getshopy/
│   └── qu-n-ly-ban-l/source/   # client (React) · server (Node) · ai-bot · ai-rec (Python)
├── local-infra-sandbox/        # dbt, cấu hình Kafka Connect
├── data-platform-poc/          # POS giả lập bắn đơn vào DB
├── scripts/                    # bootstrap, dbt runner, export/import dữ liệu
├── docs/                       # kế hoạch và kết quả từng giai đoạn
└── backups/                    # bản sao lưu Postgres tự động
```

---
**Đồ án Khóa Luận Tốt Nghiệp — Hệ thống GetShopy**
