# Getshopy Analytics

Getshopy gồm một cửa hàng B2C, trang quản trị B2B và API phân tích. Toàn bộ stack chạy bằng Docker Compose gồm React/Nginx, Node.js/Express, PostgreSQL, ClickHouse và Redis.

## Khởi động nhanh

Yêu cầu duy nhất là Docker Desktop (Docker Compose v2) đang chạy.

```bash
docker compose up --build
```

Lệnh này tự build frontend/backend, tạo schema PostgreSQL bằng Prisma, seed dữ liệu mẫu từ `server/db.json`, và khởi động năm container. Lần đầu cần lâu hơn vì Docker phải tải image và cài dependency.

- Ứng dụng: http://localhost:3000
- API/health: http://localhost:8081/api/health
- Quản trị: http://localhost:3000/admin/login
- Tài khoản mẫu B2B: `admin@gmail.com` / `admin`

Để chạy nền, thêm `-d`: `docker compose up --build -d`. Kiểm tra trạng thái bằng `docker compose ps` và xem log bằng `docker compose logs -f`.

## Cấu hình môi trường

Stack có giá trị phát triển mặc định nên có thể chạy ngay bằng một lệnh. Khi cần đổi cổng, secret hoặc kết nối dữ liệu, tạo file `.env` ở thư mục gốc từ mẫu rồi chỉnh giá trị:

```bash
cp .env.example .env
docker compose up --build -d
```

Không commit `.env`. File `server/.env` và `client/.env` chỉ dành cho cách chạy trực tiếp ngoài Docker; Docker Compose dùng file `.env` ở thư mục gốc và cố ý không đưa các file môi trường con vào image.

### Biến Docker Compose

| Biến | Mặc định | Mục đích |
| --- | --- | --- |
| `CLIENT_PORT` | `3000` | Cổng máy chủ ánh xạ tới frontend Nginx (container port 80). |
| `SERVER_PORT` | `8081` | Cổng máy chủ ánh xạ tới API/WebSocket (container port 8080). |
| `NODE_ENV` | `development` | Môi trường Node.js của API. |
| `JWT_SECRET` | `development-only-change-me` | Khoá ký JWT cho cả đăng nhập B2B và B2C. Bắt buộc thay bằng chuỗi ngẫu nhiên mạnh khi triển khai thật. |
| `VITE_API_URL` | `http://localhost:8081/api` | Base URL API dùng trong **trình duyệt**. Được nhúng vào bundle khi build frontend; cần khớp với `SERVER_PORT` nếu đổi cổng. |
| `VITE_WS_URL` | `ws://localhost:8081` | Base URL WebSocket dùng trong **trình duyệt**; cần khớp với `SERVER_PORT` nếu đổi cổng và cũng được nhúng lúc build. |
| `POSTGRES_DB` | `getshopy` | Tên database PostgreSQL cục bộ. |
| `POSTGRES_USER` | `getshopy` | User PostgreSQL cục bộ. |
| `POSTGRES_PASSWORD` | `getshopy_dev_password` | Mật khẩu PostgreSQL cục bộ. Dùng giá trị không chứa ký tự cần URL-encode, hoặc tự khai báo hai URL bên dưới. |
| `DATABASE_URL` | rỗng | Chuỗi Prisma qua pooler. Nếu để rỗng, backend tự tạo URL đến container `postgres` từ các biến `POSTGRES_*`. |
| `DIRECT_URL` | rỗng | Chuỗi Prisma kết nối trực tiếp. Nếu để rỗng, backend dùng cùng giá trị `DATABASE_URL`. |
| `CLICKHOUSE_DB` | `analytics` | Database analytics được tạo khi ClickHouse khởi tạo. |
| `CLICKHOUSE_USER` | `default` | User do image ClickHouse tạo. Compose hiện cố định user này vì backend chưa truyền thông tin xác thực ClickHouse. |
| `CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT` | `1` | Cờ của image ClickHouse để bật cơ chế quản lý access cho user mặc định. |
| `OPENROUTER_API_KEY` | rỗng | Dự phòng cho tích hợp OpenRouter; mã nguồn hiện tại chưa đọc biến này. Không đưa API key thật vào README hoặc Git. |
| `OPENROUTER_URL` | `https://openrouter.ai/api/v1` | Endpoint OpenRouter dự phòng, hiện chưa được mã nguồn sử dụng. |
| `OPENROUTER_MODEL` | `google/gemini-2.5-flash` | Model OpenRouter dự phòng, hiện chưa được mã nguồn sử dụng. |

### Biến backend hỗ trợ khi chạy ngoài Compose

Các biến này được backend đọc trực tiếp. Compose đã cấp các giá trị nội bộ đúng cho chúng, nên thông thường không cần thêm vào `.env` gốc.

| Biến | Mặc định trong mã nguồn | Ghi chú |
| --- | --- | --- |
| `PORT` | `8080` | Cổng Express khi chạy trực tiếp. Compose cố định cổng trong container là 8080 và dùng `SERVER_PORT` để đổi cổng máy chủ. |
| `CLICKHOUSE_HOST` | `http://localhost:8123` | URL ClickHouse mà `server/src/index.js` dùng. Trong Docker là `http://clickhouse:8123`. |
| `CLICKHOUSE_URL` | `http://localhost:8123` | URL ClickHouse mà module `server/src/clickhouse.js` dùng. Trong Docker cũng là `http://clickhouse:8123`. |
| `CLICKHOUSE_DB` | `analytics` | Database ClickHouse (dùng bởi cả Compose và backend). |
| `REDIS_URL` | `redis://localhost:6379` | URL Redis; trong Docker là `redis://redis:6379`. |
| `POSTGRES_HOST` | `postgres` trong entrypoint Docker | Host được dùng để tự tạo `DATABASE_URL` khi hai URL Prisma để rỗng. |
| `POSTGRES_PORT` | `5432` | Port được dùng để tự tạo URL Prisma. |

Chỉ các biến có tiền tố `VITE_` mới được lộ sang frontend. Chúng không được chứa secret. Sau khi đổi `VITE_API_URL` hoặc `VITE_WS_URL`, chạy lại `docker compose up --build` để tạo bundle mới.

## Thành phần và dữ liệu

| Service | Vai trò | Truy cập từ máy chủ |
| --- | --- | --- |
| `client` | React được phục vụ bởi Nginx; Nginx có fallback cho các route SPA. | `CLIENT_PORT` (mặc định 5173) |
| `server` | Express API, WebSocket, Prisma và xử lý AI. | `SERVER_PORT` (mặc định 8080) |
| `postgres` | Dữ liệu nghiệp vụ: khách hàng, sản phẩm, đơn hàng, voucher… | Chỉ trong mạng Docker |
| `clickhouse` | Dữ liệu và truy vấn analytics. Schema ở `clickhouse-init/01_schema.sql`. | Chỉ trong mạng Docker |
| `redis` | Cache API. | Chỉ trong mạng Docker |

PostgreSQL, ClickHouse và Redis lưu dữ liệu vào named volumes nên dữ liệu không mất khi `docker compose down` hoặc restart. Các dịch vụ dữ liệu không mở cổng ra máy chủ; dùng `docker compose exec` nếu cần kiểm tra chúng.

## Vận hành thường dùng

```bash
# Dừng stack, vẫn giữ dữ liệu
docker compose down

# Theo dõi log backend
docker compose logs -f server

# Mở psql trong container PostgreSQL
docker compose exec postgres psql -U getshopy -d getshopy

# Xây lại frontend sau khi đổi VITE_* hoặc mã nguồn
docker compose up --build -d
```

Để xoá toàn bộ dữ liệu Docker cục bộ và seed lại từ đầu:

```bash
docker compose down -v
docker compose up --build
```

`down -v` xoá vĩnh viễn volumes PostgreSQL, ClickHouse và Redis của dự án. Không dùng lệnh này nếu cần giữ dữ liệu local.

## Chạy trực tiếp không qua Docker (tuỳ chọn)

Docker là cách khuyến nghị vì API cần PostgreSQL, ClickHouse và Redis. Nếu chạy trực tiếp, hãy tự cung cấp ba dịch vụ này, sao chép từng file ví dụ môi trường và chạy:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
(cd server && npm ci && npx prisma db push && npm run seed && npm run dev)
(cd client && npm ci && npm run dev)
```

Khi chạy trực tiếp, đặt `DATABASE_URL`, `DIRECT_URL`, `CLICKHOUSE_HOST`/`CLICKHOUSE_URL` và `REDIS_URL` tới các dịch vụ của bạn trước khi chạy Prisma.

## Lưu ý bảo mật

Không dùng mật khẩu, JWT secret hay API key mẫu trong môi trường thật. Nếu một API key hoặc thông tin kết nối từng xuất hiện trong file môi trường, log, Git hay tài liệu chia sẻ, hãy thu hồi/rotate nó ngay.
