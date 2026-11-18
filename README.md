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
cài Node, không cần chạy migration. Dữ liệu lớn (600k sản phẩm, bộ demo 3 triệu
đơn) là **lệnh riêng**, chạy khi cần — xem [2b. Seed dữ liệu](#2b-seed-dữ-liệu-chạy-riêng).

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

Lần đầu chủ yếu là build image. Riêng MinIO build từ mã nguồn mất **~20 phút**
mỗi máy một lần (MinIO ngừng phát image dựng sẵn — xem
`local-infra-sandbox/minio/Dockerfile`). Seed lúc `up` chỉ còn phần nền, vài giây.
Theo dõi bằng:

```bash
docker compose logs -f server      # migrate + seed nền
docker compose logs -f bootstrap   # khởi tạo phần big-data
```

Những việc sau **tự chạy**, không cần gõ gì thêm:

| Việc | Ai làm |
|---|---|
| Tạo schema Postgres, seed NỀN: tài khoản, chi nhánh, danh mục, hãng, voucher, tài khoản test, flash sale | `server` lúc khởi động |
| Tạo bucket MinIO, user ClickHouse, kéo masterdata, đăng ký connector CDC | `bootstrap` (chạy một lần rồi thoát) |
| Dựng model dbt mỗi 5 phút | `dbt-scheduler` |
| Train lại mô hình gợi ý mỗi 5 phút | `ai-rec` |
| Sao lưu Postgres mỗi 24h vào `./backups/` | `dbt-scheduler` |

Seed nền chỉ chạy khi database còn rỗng. Lần `up` sau bỏ qua, dữ liệu giữ nguyên.
Catalog còn trống thì log `server` in nhắc chạy `seed-catalog`.

### 2b. Seed dữ liệu (chạy riêng)

Tách khỏi `up` từ 04/10/2026 — trước đó lần `up` đầu chặn cả stack 10–20 phút để
seed catalog. Profile `seed` nên `up -d` (kể cả `--build`) không đụng tới.

| Lệnh | Tạo ra | Thời gian | Chạy ở |
|---|---|---|---|
| `docker compose --profile seed run --rm seed-catalog` | 600.000 sản phẩm, ~1,2 triệu dòng tồn kho | 10–20 phút | mọi máy cần cửa hàng đủ hàng |
| `docker compose --profile seed run --rm seed-data` | bộ demo: 40.000 khách, 3.000.000 đơn, onboarding | ước tính 20–60 phút ghi, **chưa đo** | **chỉ máy demo** |

Cả hai idempotent: `seed-catalog` chỉ thêm tới đủ 600k; `seed-data` từ chối chạy
khi đã có dữ liệu demo — thêm `--reset` để xoá đúng phần nó đã sinh rồi sinh lại.
Bộ demo là **dữ liệu giả lập** có cấu trúc (gu khách, mua kèm, mua lặp) — giả định
và nguồn ghi ở đầu `data-platform-poc/demo_dataset.py`; trình bày kết quả trên bộ
này phải nói rõ là giả lập.

#### Máy demo (Windows) — làm theo đúng thứ tự

Ước lượng dưới đây **chưa đo** — máy demo chạy lần đầu xong thì ghi số thật vào đây.

1. **Đĩa trống ≥ 50 GB, RAM cấp cho Docker ≥ 8 GB.** Ước lượng: Postgres +4–6 GB,
   Kafka ~20–30 GB (message CDC dạng JSON kèm schema, giữ 7 ngày mặc định), MinIO và
   ClickHouse mỗi bên vài GB.
2. Clone repo **sau** khi đã có `.gitattributes` (04/10/2026): script `.sh` phải giữ
   LF, CRLF làm container chết ngay dòng đầu. Đã clone từ trước thì **clone lại** là
   chắc nhất (lệnh checkout lại tại chỗ `git rm --cached -r . && git reset --hard`
   XOÁ mọi thay đổi chưa commit — chỉ dùng trên bản clone sạch).
3. Đặt `.env` ở gốc repo như mọi máy.
4. Seed **trước** khi bật cả stack — Debezium chụp một lần (snapshot) nhẹ hơn đẩy
   ~9,5 triệu thay đổi qua replication slot:
   ```bash
   docker compose up -d postgres
   docker compose --profile seed run --rm seed-catalog
   docker compose --profile seed run --rm seed-data demo_dataset.py --dry-run   # xem số liệu thử, không ghi
   docker compose --profile seed run --rm seed-data
   docker compose up -d --build
   ```
5. Chờ dữ liệu chảy hết đường CDC → Kafka → MinIO → dbt → AI-Rec (ước tính 30–120
   phút). Kiểm:
   ```bash
   docker compose exec clickhouse clickhouse-client -q "SELECT count(), uniqExact(order_id) FROM warehouse.fact_orders_detail FINAL WHERE _is_deleted = 0"
   docker compose exec ai-rec python -c "import json,urllib.request as u; print(json.load(u.urlopen('http://localhost:8000/health')))"
   ```

Lưu ý khi giữ máy demo chạy lâu dài:
- **Không `docker compose down`** (dùng `stop`/`start`). Kafka không có volume, tạo
  lại container là Debezium chụp lại TOÀN BỘ bảng — ~9,5 triệu bản ghi trùng vào
  lake mỗi lần (dbt khử trùng được, nhưng lake phình và mỗi lượt dbt quét lâu hơn).
- dbt quét toàn bộ parquet mỗi lượt; `flush.size = 10000` nên lake có khoảng 950 file
  nhỏ. Máy chậm thì đặt `DBT_SCHEDULE=30m` trong `.env`.
- Tài khoản demo: `test@getshopy.vn` có gu cố định (Apple, điện thoại + phụ kiện) để
  người xem thấy ngay gợi ý khớp lịch sử; 40k khách `kh00001@demo.getshopy.vn` …
  chung mật khẩu `DEMO_PASSWORD` (mặc định `123456` — đổi nếu máy demo mở ra ngoài).

### 3. Truy cập

| Địa chỉ | Là gì |
|---|---|
| http://localhost:3000 | **Cửa hàng + trang quản trị** (`/admin/dashboard`) |
| http://localhost:8123 | ClickHouse HTTP |
| http://localhost:8083 | Kafka Connect REST |
| http://localhost:9001 | MinIO Console |
| http://localhost:3001 | Grafana — dashboard cân bằng tải (chỉ loopback; tài khoản `admin`, mật khẩu `GRAFANA_ADMIN_PASSWORD` trong `.env`) — [docs/monitoring.md](docs/monitoring.md) |
| localhost:5432 | Postgres |

Backend Node và AI-Rec **không mở cổng ra ngoài** — gọi qua `localhost:3000/api`,
nginx của `client` chuyển tiếp vào.

Tài khoản có sẵn:

| Vai | Tài khoản |
|---|---|
| Quản trị | `admin@gmail.com` / `admin` |
| Khách hàng | `test@getshopy.vn` / `123456` |

### 3b. Webhook SePay và mở web cho người khác

Máy production ra Internet bằng **Tailscale Funnel** — cả web lẫn webhook SePay, URL cố định.
(Trước đây webhook đi qua ngrok và web đi qua `cloudflared`; ngrok không còn dùng.)

| Việc | Công cụ | URL |
|---|---|---|
| SePay báo "tiền đã về" (webhook) | Tailscale Funnel, **cổng 8443**, chỉ mở đúng path webhook | cố định — khai SePay MỘT lần |
| Web production (khách hàng, trang quản trị) | Tailscale Funnel, cổng 443 | cố định — `https://msi.taild22ef7.ts.net` |
| Cho người khác xem web chạy trên **máy dev** | `cloudflared` quick tunnel | ngẫu nhiên, đổi mỗi lần chạy — chỉ để xem |

Funnel dẫn vào **ĐÚNG MÁY production**, không dẫn vào code ai vừa pull.
Nguồn: [Tailscale Funnel](https://tailscale.com/kb/1223/funnel).

#### Webhook SePay — Tailscale Funnel cổng 8443

Cấu hình trên máy production (`tailscale funnel status`):

```
https://msi.taild22ef7.ts.net:8443 (Funnel on)
|-- /api/payment/webhook/sepay proxy http://127.0.0.1:18000/api/payment/webhook/sepay
```

`127.0.0.1:18000` là cổng 80 của gateway publish ra loopback (`GATEWAY_SERVE_PORT`); gateway
chia request cho các bản server ([docs/load-balancing.md](docs/load-balancing.md)). Cổng 8443
chỉ mở đúng path này; trên cổng 443 path webhook cũng chỉ nhận POST (`gateway/nginx.conf`).
Server xác thực bằng chữ ký HMAC / API key của SePay.

Khai vào dashboard SePay một lần: `https://msi.taild22ef7.ts.net:8443/api/payment/webhook/sepay`.

Mở lại nếu cấu hình Funnel bị xoá (vd. sau `tailscale serve reset`); cấu hình chạy `--bg`
được lưu qua các lần khởi động máy:

```powershell
tailscale funnel --bg --https=8443 --set-path=/api/payment/webhook/sepay http://127.0.0.1:18000/api/payment/webhook/sepay
```

- Tailscale tắt / đăng xuất, máy ngủ hay mất mạng thì webhook KHÔNG về: đơn chuyển khoản nằm
  PENDING rồi hết hạn dù tiền đã vào tài khoản, và không có lỗi nào hiện ra. URL không đổi —
  bật lại Tailscale là chạy, không phải sửa SePay.
- Đổi `GATEWAY_SERVE_PORT` mà không sửa Funnel thì webhook lỗi 502 và SePay thử lại trong im lặng.
- Đổi tên máy / tailnet thì tên miền `*.ts.net` đổi — PHẢI khai lại URL bên SePay.
- Kiểm (Windows: `& "C:\Program Files\Tailscale\tailscale.exe" funnel status`): phải còn dòng
  `:8443` ở trên. GET `https://msi.taild22ef7.ts.net:8443/api/payment/webhook/sepay` trả
  **404 do server** (route chỉ nhận POST) là đường thông; 502/503 là gateway/server không trả
  lời; không kết nối được là Funnel/Tailscale tắt. Không POST giả lập lên production.

**Dev test luồng thanh toán ở máy mình** — không cần tunnel: dùng adapter mô phỏng. Nó đi
qua đúng code đối soát của webhook thật, chỉ bỏ đoạn mạng từ SePay về và bước kiểm chữ ký
HMAC của SePay. Chạy khi `NODE_ENV` khác `production` và `.env` có `PAYMENT_SIMULATOR_KEY`:

```bash
# đặt một đơn chuyển khoản trên web, ghi lại số tiền và nội dung CK ở màn hình QR, rồi:
curl -X POST http://localhost:3000/api/payment/webhook/simulator \
  -H "Authorization: Apikey <PAYMENT_SIMULATOR_KEY>" -H "Content-Type: application/json" \
  -d '{"amount": <tổng tiền đơn>, "content": "<nội dung CK trên màn hình QR>"}'
```

Muốn test luồng THẬT (chuyển tiền thật, SePay báo về) thì test trên máy production (đường
Funnel ở trên).

#### Mở web trên máy dev cho người khác xem — `cloudflared` quick tunnel

Web production đã có URL Funnel cố định ở trên; mục này cho máy dev không chạy Tailscale.

```bash
cloudflared tunnel --url http://localhost:3000
```

In ra `https://<ngẫu nhiên>.trycloudflare.com` — gửi link đó. Người mở dùng web **và dữ
liệu** của máy chạy tunnel, không cần pull code. URL đổi mỗi lần `cloudflared` chạy lại,
máy ngủ hoặc mất mạng — gửi lại link mới là được, không dính tới SePay.

**Mạng phải cho ra cổng 7844.** `cloudflared` nối tới Cloudflare qua cổng 7844 (UDP cho
QUIC, TCP cho HTTP/2) — không có tuỳ chọn dùng 443. Mạng công ty thường chặn cổng này
(gặp ngày 07/10/2026). Triệu chứng: vẫn in ra URL, nhưng mở URL bị lỗi 530 hoặc không
kết nối được, log không có `Registered tunnel connection`, có `QUIC connection failed`.
- Chỉ chặn UDP: chạy thêm `--protocol http2`.
- Chặn cả TCP 7844 (kiểm: `curl -sv --connect-timeout 5 https://region1.v2.argotunnel.com:7844/`
  không in `Connected to`): đổi mạng (hotspot điện thoại, mạng nhà) hoặc nhờ IT mở cổng.

#### Chung

- Giữ máy production / máy chạy tunnel không ngủ: macOS `caffeinate -dims`, Windows tắt Sleep
  trong Power settings.
- `docker compose up -d --build`, `down`/`up`, `restart`, sửa `.env` KHÔNG ảnh hưởng Funnel hay
  `cloudflared` — cả hai chạy ngoài Docker; chỉ hụt vài giây lúc gateway/server được tạo lại.
- **⚠️ Bảo mật:** Funnel / tunnel đưa CẢ trang quản trị ra Internet — URL Funnel lại cố định nên
  càng dễ bị dò — mà tài khoản mặc định ở bảng trên ghi công khai trong README này.
  **Đổi mật khẩu admin và `DEMO_PASSWORD` trên máy production trước khi mở.**

### 4. Lệnh hay dùng

```bash
docker compose ps                                  # trạng thái 16 service
docker compose logs -f <service>                   # xem log
docker compose --profile dbt run --rm dbt build    # chạy dbt ngay, không chờ lịch
docker compose --profile seed run --rm seed-catalog       # seed 600k sản phẩm (một lần)
python3 data-platform-poc/pos_simulator.py --orders 200   # bắn đơn giả lập
```

### 4b. Cân bằng tải — nhiều bản `server`

`server` chạy **N bản** sau gateway nginx (mặc định 3, đặt `SERVER_REPLICAS` trong `.env`).
Trạng thái dùng chung giữa các bản, tắt êm, số kết nối Postgres và demo k6:
[docs/load-balancing.md](docs/load-balancing.md).

```powershell
docker compose up -d --no-deps --scale server=2 server   # đổi số bản tạm thời
docker compose exec server node scripts/...              # lệnh tay: chạy ở bản số 1
.\scripts\lb-demo.ps1                                    # demo phân bố + k6 với 1/2/3 bản
```

Xem trực tiếp gateway chia tải (request/s, độ trễ, lỗi, CPU/RAM từng bản) trên Grafana —
Prometheus + Grafana, số đo của server, cách đọc dashboard, bảo mật:
[docs/monitoring.md](docs/monitoring.md).

```powershell
docker compose up -d prometheus grafana     # bật giám sát (lần đầu: đặt GRAFANA_ADMIN_PASSWORD trong .env TRƯỚC)
.\scripts\grafana-demo.ps1                   # demo trực tiếp: tải ổn định -> scale 1..4 -> 1 server chết
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
