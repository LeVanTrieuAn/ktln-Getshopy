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
- dbt quét toàn bộ parquet mỗi lượt, mà `flush.size = 1000` nên lake có ~9.500 file
  nhỏ. Máy chậm thì đặt `DBT_SCHEDULE=30m` trong `.env`.
- Tài khoản demo: `test@getshopy.vn` có gu cố định (Apple, điện thoại + phụ kiện) để
  người xem thấy ngay gợi ý khớp lịch sử; 40k khách `kh00001@demo.getshopy.vn` …
  chung mật khẩu `DEMO_PASSWORD` (mặc định `123456` — đổi nếu máy demo mở ra ngoài).

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

### 3b. Webhook SePay và mở web cho người khác

Hai việc khác nhau, hai công cụ khác nhau (chốt 07/10/2026):

| Việc | Công cụ | URL |
|---|---|---|
| SePay báo "tiền đã về" (webhook) | **ngrok**, domain cố định miễn phí | cố định — khai SePay MỘT lần |
| Cho người khác mở web đang chạy | `cloudflared` quick tunnel | ngẫu nhiên, đổi mỗi lần chạy — chỉ để xem, gửi lại link là xong |

Cả hai dẫn vào **ĐÚNG MÁY đang chạy tunnel**, không dẫn vào code ai vừa pull.

#### Webhook SePay — ngrok, domain cố định

Vì sao ngrok: gói miễn phí cho mỗi tài khoản một domain cố định nên khai SePay một lần là
xong; chạy qua cổng 443 nên không vướng cổng 7844 như `cloudflared`; trang cảnh báo của
gói miễn phí chỉ hiện với trình duyệt, không chặn webhook; giới hạn 20.000 request và
1 GB mỗi tháng thừa cho webhook nhưng KHÔNG đủ để cả nhóm mở web — nên web đi đường
`cloudflared` bên dưới. Nguồn: [giới hạn gói miễn phí](https://ngrok.com/docs/pricing-limits/free-plan-limits),
[CLI](https://ngrok.com/docs/agent/cli/).

Dựng một lần, trên máy nhận webhook (nên là máy demo chạy lâu dài):

```bash
ngrok config add-authtoken <TOKEN>        # token lấy ở dashboard ngrok — BÍ MẬT, không commit, không gửi chat nhóm
# Dashboard ngrok → Domains: lấy domain cố định, dạng <tên>.ngrok-free.app
ngrok http 3000 --url https://<tên>.ngrok-free.app    # chạy bằng docker compose
ngrok http 8080 --url https://<tên>.ngrok-free.app    # chạy server native để dev
```

Khai vào dashboard SePay một lần: `https://<tên>.ngrok-free.app/api/payment/webhook/sepay`.

- Mỗi lúc **chỉ một máy** chạy agent với domain đó, nên chỉ máy đó nhận xác nhận thanh toán.
- ngrok tắt, máy ngủ hay mất mạng thì webhook KHÔNG về: đơn chuyển khoản nằm PENDING rồi
  hết hạn dù tiền đã vào tài khoản, và không có lỗi nào hiện ra. Nhưng URL không đổi —
  bật lại `ngrok http …` là chạy, không phải sửa SePay.
- Trỏ sai cổng (3000 khi chạy compose, 8080 khi chạy native) thì webhook lỗi 502 và SePay
  thử lại trong im lặng.
- Kiểm: `pgrep -f 'ngrok http'` chỉ biết tiến trình còn chạy. Chắc chắn thì mở
  `https://<tên>.ngrok-free.app/` — thấy trang cảnh báo của ngrok rồi vào được web là thông
  — hoặc xem mục Endpoints trên dashboard ngrok.

**Dev test luồng thanh toán ở máy mình** — không cần tunnel: dùng adapter mô phỏng. Nó đi
qua đúng code đối soát của webhook thật, chỉ bỏ đoạn mạng từ SePay về và bước kiểm chữ ký
HMAC của SePay. Chạy khi `NODE_ENV` khác `production` và `.env` có `PAYMENT_SIMULATOR_KEY`:

```bash
# đặt một đơn chuyển khoản trên web, ghi lại số tiền và nội dung CK ở màn hình QR, rồi:
curl -X POST http://localhost:3000/api/payment/webhook/simulator \
  -H "Authorization: Apikey <PAYMENT_SIMULATOR_KEY>" -H "Content-Type: application/json" \
  -d '{"amount": <tổng tiền đơn>, "content": "<nội dung CK trên màn hình QR>"}'
```

Muốn test luồng THẬT (chuyển tiền thật, SePay báo về) thì test trên máy đang chạy ngrok.

#### Mở web cho người khác xem — `cloudflared` quick tunnel

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

#### Chung cho cả hai

- Giữ máy chạy tunnel không ngủ: macOS `caffeinate -dims`, Windows tắt Sleep trong Power settings.
- `docker compose up -d --build`, `down`/`up`, `restart`, sửa `.env` KHÔNG ảnh hưởng tunnel —
  `ngrok` và `cloudflared` chạy ngoài Docker.
- **⚠️ Bảo mật:** tunnel đưa CẢ trang quản trị ra Internet — domain ngrok lại cố định nên
  càng dễ bị dò — mà tài khoản mặc định ở bảng trên ghi công khai trong README này.
  **Đổi mật khẩu admin và `DEMO_PASSWORD` trên máy chạy tunnel trước khi mở.**

### 4. Lệnh hay dùng

```bash
docker compose ps                                  # trạng thái 14 service
docker compose logs -f <service>                   # xem log
docker compose --profile dbt run --rm dbt build    # chạy dbt ngay, không chờ lịch
docker compose --profile seed run --rm seed-catalog       # seed 600k sản phẩm (một lần)
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
