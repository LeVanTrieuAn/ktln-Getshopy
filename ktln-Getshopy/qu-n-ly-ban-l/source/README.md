# Getshopy Analytics

Getshopy gồm một cửa hàng B2C, trang quản trị B2B và API phân tích thời gian thực. Stack gồm React/Vite, Node.js/Express, PostgreSQL và ClickHouse.

---

## 🚀 Khởi động nhanh (Docker — khuyến nghị)

Yêu cầu duy nhất: **Docker Desktop** (Docker Compose v2) đang chạy.

```bash
git clone <repo-url>
cd source
docker compose up --build
```

Sau khi build xong (~2–5 phút lần đầu):

| Địa chỉ | Nội dung |
|---|---|
| http://localhost:5173 | 🛒 B2C Store (khách hàng) |
| http://localhost:5173/admin | 🔧 Admin Panel (quản trị) |
| http://localhost:8080/api/health | ✅ API Health Check |

**Tài khoản mẫu B2B:** `admin@gmail.com` / `admin`

---

## ⚙️ Chạy trực tiếp không qua Docker (dev)

### Yêu cầu hệ thống
- Node.js ≥ 20
- PostgreSQL đang chạy
- ClickHouse đang chạy (optional — chỉ cần cho admin analytics)

### 1. Clone & cài dependencies

```bash
git clone <repo-url>
cd source

# Cài server dependencies
cd server && npm install

# Cài client dependencies
cd ../client && npm install
```

### 2. Cấu hình môi trường

```bash
# Tạo file .env cho server (copy từ example rồi sửa)
cp server/.env.example server/.env

# Tạo file .env cho client
cp client/.env.example client/.env
```

Mở `server/.env` và điền `DATABASE_URL`, `CLICKHOUSE_HOST` trỏ vào database của bạn.

### 3. Setup database & seed dữ liệu

```bash
cd server
npx prisma db push        # Tạo schema PostgreSQL
npm run seed              # Seed dữ liệu mẫu (sản phẩm, branches, users)
```

### 4. Chạy

```bash
# Terminal 1 — Backend
cd server && npm run dev     # → http://localhost:8080

# Terminal 2 — Frontend (dev server với hot-reload)
cd client && npm run dev     # → http://localhost:5173

# Hoặc build production rồi preview
cd client && npm run build && npm run preview   # → http://localhost:5173
```

---

## 📦 Scripts

### Client (`client/`)

| Script | Mô tả |
|---|---|
| `npm run dev` | Dev server với hot-reload tại port 5173 |
| `npm run build` | Build production vào `dist/` |
| `npm run preview` | Serve production build tại port 5173 |
| `npm run lint` | Lint với oxlint |

### Server (`server/`)

| Script | Mô tả |
|---|---|
| `npm run dev` | Nodemon dev server (auto-restart khi đổi file) |
| `npm run seed` | Seed dữ liệu mẫu từ `db.json` vào PostgreSQL |
| `npm run seed:mock` | Seed dữ liệu mock analytics vào ClickHouse |
| `npm run test:perf` | Chạy performance tests |

---

## 🗂️ Cấu trúc thư mục

```
source/
├── client/                 # React + Vite + Ant Design
│   ├── src/
│   │   ├── components/     # UI components (HeroBanner 3D, layouts...)
│   │   ├── pages/          # B2C & B2B pages
│   │   └── api/            # Axios API client
│   ├── public/             # robots.txt, favicon, GLB models
│   └── vite.config.js
├── server/                 # Node.js + Express + Prisma
│   ├── src/
│   │   ├── index.js        # Entry point + Express routes
│   │   ├── routes/         # b2c.js, b2b.js, ai.js
│   │   ├── redis.js        # Optional Redis cache layer
│   │   └── db.js           # Prisma client singleton
│   └── prisma/
│       └── schema.prisma   # Database schema
├── clickhouse-init/        # ClickHouse schema + init SQL
├── docker-compose.yml      # Docker Compose stack
├── .env.example            # Biến môi trường mẫu
└── README.md
```

---

## 🔧 Biến môi trường

Tạo `.env` từ `.env.example` ở thư mục gốc (dành cho Docker):

```bash
cp .env.example .env
```

### Các biến quan trọng

| Biến | Mặc định | Mô tả |
|---|---|---|
| `CLIENT_PORT` | `5173` | Port frontend expose ra máy chủ |
| `SERVER_PORT` | `8080` | Port backend expose ra máy chủ |
| `JWT_SECRET` | `development-only-change-me` | **Bắt buộc đổi khi deploy production** |
| `VITE_API_URL` | `http://localhost:8080/api` | URL API dùng trong trình duyệt |
| `VITE_WS_URL` | `ws://localhost:8080` | WebSocket URL |
| `DATABASE_URL` | *(tự tạo từ POSTGRES_*)* | Prisma connection string |
| `CLICKHOUSE_HOST` | `http://localhost:8123` | ClickHouse URL |
| `REDIS_URL` | *(không bắt buộc)* | Redis cache — nếu không set, server chạy không có cache |

> ⚠️ **Không commit `.env`** — đã có trong `.gitignore`.

---

## 🐳 Vận hành Docker

```bash
# Khởi động foreground (xem log trực tiếp)
docker compose up --build

# Khởi động background
docker compose up --build -d

# Xem logs
docker compose logs -f server
docker compose logs -f client

# Dừng (giữ nguyên dữ liệu)
docker compose down

# Rebuild sau khi đổi code
docker compose up --build -d

# Xóa toàn bộ dữ liệu và seed lại từ đầu
docker compose down -v && docker compose up --build
```

---

## 🛠️ Tech Stack

| Layer | Công nghệ |
|---|---|
| Frontend | React 19 + Vite 6 + Ant Design 5 |
| 3D / Animation | Three.js + React Three Fiber + GSAP ScrollTrigger |
| Charts | ECharts + echarts-for-react |
| Maps | Leaflet + react-leaflet |
| Backend | Node.js + Express 5 + Prisma 5 |
| Database | PostgreSQL 16 + ClickHouse 24.8 |
| Cache | Redis 7 (optional — tắt nếu không set REDIS_URL) |
| Build | Docker Compose v2 |

---

## 🔒 Bảo mật

- Không dùng `JWT_SECRET` mặc định khi deploy thật
- Không commit `.env` hoặc API keys lên Git
- Nếu secret đã lộ lên Git: **rotate ngay lập tức**
