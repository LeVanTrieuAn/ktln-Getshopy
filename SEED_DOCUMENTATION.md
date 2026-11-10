# Tài liệu Seed Dữ Liệu Sản Phẩm — Getshopy

> **Mục đích:** Mô tả toàn bộ cơ chế tạo 600.000 sản phẩm trong hệ thống e-commerce Getshopy phục vụ demo và kiểm thử. Tài liệu này đủ để co-partner tái tạo hoàn toàn bộ dữ liệu mà không cần hỏi thêm.

---

## 1. Tổng quan số liệu

| Chỉ số | Giá trị |
|---|---|
| **Tổng sản phẩm** | 600.000 |
| **Số trang** (24 SP/trang) | 25.000 trang |
| **Sản phẩm gốc** (crawl từ TGDD) | 26.262 |
| **Thương hiệu** | 33 brands |
| **Danh mục lá** (có sản phẩm) | 30 sub-categories |
| **Thời gian seed** | ~103 giây |
| **Dung lượng DB sau seed** | ~566 MB (Product 396 MB) |

---

## 2. Hạ tầng PostgreSQL

### 2.1 Cấu hình Docker

PostgreSQL chạy trong Docker Compose, **KHÔNG expose ra ngoài theo mặc định** (trừ khi .env đặt `POSTGRES_PORT`).

```yaml
# docker-compose.yml
postgres:
  image: postgres:16-alpine
  command:
    - postgres
    - -c
    - wal_level=logical        # bắt buộc cho Debezium CDC
    - -c
    - max_replication_slots=4
    - -c
    - max_wal_senders=4
  environment:
    POSTGRES_DB:       getshopy
    POSTGRES_USER:     getshopy
    POSTGRES_PASSWORD: <lấy từ .env>
  ports: ["5432:5432"]        # expose ra host để scripts chạy ngoài Docker
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./backups:/backups       # pg_dump tự động mỗi 24h
```

### 2.2 Thông tin kết nối

| Thông số | Giá trị |
|---|---|
| **Host** (từ host machine) | `localhost` |
| **Host** (từ container khác) | `postgres` |
| **Port** | `5432` |
| **Database** | `getshopy` |
| **User** | `getshopy` |
| **Password** | Xem file `.env` → `POSTGRES_PASSWORD` |
| **Version** | PostgreSQL 16.15 (Alpine) |
| **Encoding** | UTF-8 |

**Connection string (DATABASE_URL):**
```
postgresql://getshopy:<PASSWORD>@localhost:5432/getshopy
```

### 2.3 ORM — Prisma

Hệ thống dùng **Prisma v5.22.0** làm ORM. Schema nằm tại:
```
ktln-Getshopy/qu-n-ly-ban-l/source/server/prisma/schema.prisma
```

Khi sửa schema, cần chạy:
```bash
npx prisma migrate dev   # tạo migration
npx prisma generate      # regenerate Prisma Client
```

---

## 3. Cơ sở dữ liệu — 20 bảng

### 3.1 Toàn bộ bảng và dung lượng

| Bảng | Dung lượng | Số dòng | Ghi chú |
|---|---|---|---|
| **Product** | **396 MB** | **600.000** | Bảng trọng tâm |
| **Inventory** | 161 MB | 1.199.267 | Tồn kho mỗi SP |
| Order | 112 kB | 3 | Đơn hàng demo |
| OrderItem | 96 kB | 4 | Dòng đơn hàng |
| Brand | 64 kB | 33 | Thương hiệu |
| Category | 48 kB | 34 | Danh mục |
| B2CCustomer | 48 kB | 8 | Khách hàng demo |
| User | 48 kB | 1 | Admin |
| Voucher | 48 kB | 3 | Mã giảm giá demo |
| FlashSale | 32 kB | 3 | Flash sale demo |
| Branch | 32 kB | 3 | Chi nhánh |
| Review | 32 kB | 1 | Đánh giá demo |
| ChatLog | 112 kB | 3 | Log chatbot |
| PaymentTransaction | 48 kB | 0 | Giao dịch thanh toán |
| VoucherUsage | 48 kB | 0 | Lịch sử dùng voucher |
| LoyaltyTransaction | 40 kB | 0 | Điểm tích lũy |
| StockReservation | 64 kB | 4 | Giữ chỗ tồn kho |
| Wishlist | 56 kB | 2 | Danh sách yêu thích |
| VoucherTier | 32 kB | 3 | Hạng voucher |
| FlashSaleItem | 24 kB | 8 | Sản phẩm flash sale |
| **Tổng DB** | **~566 MB** | | |

### 3.2 Schema bảng liên quan đến seed

#### Bảng `Brand`
```sql
CREATE TABLE "Brand" (
  id         VARCHAR PRIMARY KEY,    -- e.g. 'br-apple'
  name       VARCHAR NOT NULL,       -- e.g. 'Apple'
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);
```

#### Bảng `Category`
```sql
CREATE TABLE "Category" (
  id         VARCHAR PRIMARY KEY,    -- e.g. 'cat-phone'
  name       VARCHAR NOT NULL,       -- e.g. 'Điện thoại'
  icon       VARCHAR,
  parent_id  VARCHAR,               -- NULL = root; có giá trị = sub-category
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX ON "Category" (parent_id);
```

#### Bảng `Product` (bảng chính)
```sql
CREATE TABLE "Product" (
  id             BIGSERIAL PRIMARY KEY,
  name           VARCHAR NOT NULL,
  price          INT NOT NULL,          -- VNĐ, không có phần lẻ
  original_price INT NOT NULL,          -- VNĐ, luôn >= price
  category_id    VARCHAR NOT NULL,      -- FK → Category.id
  brand_id       VARCHAR NOT NULL,      -- FK → Brand.id
  stock          INT DEFAULT 0,
  rating         FLOAT DEFAULT 5,
  sold           INT DEFAULT 0,
  image          VARCHAR,               -- URL ảnh chính
  images         JSONB DEFAULT '[]',    -- Array URLs ảnh
  description    VARCHAR,
  specs          JSONB DEFAULT '{}',    -- {screen, chip, ram, ...}
  variants       JSONB DEFAULT '[]',    -- [{color, ram, storage}]
  branch_ids     JSONB DEFAULT '[]',   -- [] = toàn quốc
  is_banner      BOOLEAN DEFAULT false,
  is_deleted     BOOLEAN DEFAULT false,
  created_at     TIMESTAMP DEFAULT now()
);

-- Indexes (5 index):
CREATE UNIQUE INDEX ON "Product" (id);
CREATE INDEX ON "Product" (category_id);
CREATE INDEX ON "Product" (brand_id);
CREATE INDEX ON "Product" (is_deleted, id);  -- phân trang
CREATE INDEX ON "Product" (price);            -- lọc giá
```

#### Bảng `Inventory` (được tạo tự động sau khi seed)
```sql
CREATE TABLE "Inventory" (
  id         BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL,
  variant_id VARCHAR DEFAULT '',    -- '' = không có biến thể
  branch_id  VARCHAR DEFAULT '',    -- '' = kho tổng
  on_hand    INT DEFAULT 0,
  reserved   INT DEFAULT 0,
  updated_at TIMESTAMP,
  UNIQUE (product_id, variant_id, branch_id)
);
```
> **Lưu ý:** Bảng Inventory có 1.199.267 dòng (nhiều hơn Product vì mỗi sản phẩm có thể có nhiều dòng inventory theo variant/branch). Script `ensure-inventory.js` tạo inventory tự động sau khi seed.

### 3.3 Quan hệ giữa các bảng liên quan seed

```
Category (34 dòng)
  │ parent_id (self-referencing)
  └──► Category

Brand (33 dòng)
  └──► Product.brand_id

Category
  └──► Product.category_id

Product (600.000 dòng)
  └──► Inventory.product_id (1.199.267 dòng)
  └──► OrderItem.product_id
  └──► FlashSaleItem.product_id
  └──► Wishlist.product_id
  └──► Review.product_id
```

### 3.4 Branches (Chi nhánh)

Hệ thống có **3 chi nhánh** demo:

| Branch ID | Tên | Địa chỉ |
|---|---|---|
| HCM001 | Chi nhánh HCM 1 | Hồ Chí Minh |
| HCM002 | Chi nhánh HCM 2 | Hồ Chí Minh |
| HN001 | Chi nhánh Hà Nội | Hà Nội |

Toàn bộ 600.000 sản phẩm seed có `branch_ids = []` → hiển thị ở tất cả chi nhánh.

---

## 4. Pipeline Seed — 3 bước

```
[Bước 1] crawl-tgdd.js          → scripts/data/tgdd-products.json  (26.262 SP thật)
[Bước 2] replace-products.js    → PostgreSQL DB                     (600.000 SP)
[Bước 3] Xóa brand/cat rỗng    → cleanup_empty.sql                 (cleanup)
```

### Bước 1 — Crawl dữ liệu từ Thế Giới Di Động

**Script:** `scripts/crawl-tgdd.js`  
**Output:** `scripts/data/tgdd-products.json` (24MB, 26.262 records)  
**Kỹ thuật:** Puppeteer-core (headless Chrome) duyệt qua 30 URL danh mục TGDD, scrape tên, giá, ảnh, brand từ `ul.listproduct li.item`.

**Lệnh chạy:**
```bash
node scripts/crawl-tgdd.js
# Hoặc tiếp tục từ checkpoint:
node scripts/crawl-tgdd.js --resume
```

**Kết quả crawled theo danh mục:**

| Danh mục TGDD (slug) | Category ID trong DB | SP crawled |
|---|---|---|
| dtdd | cat-phone | 1.000 |
| laptop | cat-laptop | 1.000 |
| may-tinh-bang | cat-tablet | 1.000 |
| dong-ho-thong-minh | cat-watch | 1.000 |
| sac-cap-dien-thoai | cat-mobile-acc-charger | 1.000 |
| op-lung-may-tinh-bang | cat-mobile-acc-case-tablet | 1.000 |
| mieng-dan-man-hinh-dien-thoai | cat-mobile-acc-screen | 1.000 |
| mieng-dan-camera | cat-mobile-acc-cam-cover | 1.000 |
| tui-dung-airpods | cat-mobile-acc-airpods-case | 1.000 |
| quat-mini | cat-mobile-acc-fan | 800 |
| gia-do-dien-thoai | cat-mobile-acc-stand | 1.000 |
| chuot-may-tinh | cat-laptop-acc-mouse | 1.000 |
| ban-phim | cat-laptop-acc-keyboard | 1.000 |
| balo-tui-chong-soc | cat-laptop-acc-bag | 1.000 |
| tui-dung-phu-kien | cat-laptop-acc-pouch | 1.000 |
| mieng-lot-chuot | cat-laptop-acc-mousepad | 1.004 |
| bang-ve-dien-tu | cat-laptop-acc-drawing | 450 |
| tai-nghe-bluetooth | cat-av-bt-earphone | 1.000 |
| tai-nghe-day | cat-av-wire-earphone | 1.000 |
| tai-nghe-chup-tai | cat-av-headphone | 1.000 |
| tai-nghe-the-thao | cat-av-sport-earphone | 1.000 |
| loa-bluetooth | cat-av-speaker | 1.000 |
| micro-thu-am | cat-av-mic | 1.000 |
| may-chieu-mini | cat-av-projector | 900 |
| o-cung-di-dong | cat-av-hdd | 1.000 |
| the-nho | cat-av-sdcard | 1.000 |
| usb-o-nhap | cat-av-usb | 980 |
| camera-giam-sat | cat-cam-security | 80 |
| camera-ip-wifi | cat-cam-indoor | 36 |
| chuong-cua-camera | cat-cam-doorbell | 12 |

> **Lưu ý:** Camera có ít sản phẩm (36–80) do TGDD phân trang ít cho danh mục này.

---

### Bước 2 — Augment & Import vào DB

**Script:** `scripts/replace-products.js`  
**Lệnh chạy:**
```bash
DATABASE_URL="postgresql://getshopy:getshopy_dev_password@localhost:5432/getshopy" \
node scripts/replace-products.js --target=600000
```

**Cơ chế đạt 600.000 từ 26.262 sản phẩm gốc:**

```
Phase 1: Mỗi sản phẩm gốc → sinh TẤT CẢ biến thể
  - Điện thoại / Tablet: 4 màu × 4 RAM × 4 Storage = 64 biến thể / SP gốc
  - Laptop:              3 màu × 4 RAM × 4 Storage = 48 biến thể / SP gốc
  - Smartwatch:          10 biến thể màu dây
  - Tai nghe, loa, phụ kiện: 6 biến thể màu
  - HDD, Thẻ nhớ, USB:  4–5 biến thể dung lượng
  Tổng Phase 1: ~315.612 records

Phase 2: Lặp lại validProducts (round-robin) cho đến khi đủ 600.000
  Mỗi lượt lặp: tên giữ nguyên, giá/stock/sold thay đổi nhỏ
  Tổng Phase 2: 600.000 - 315.612 = 284.388 records
```

---

## 5. Tên sản phẩm

### Cấu trúc tên — Phase 1 (biến thể đầy đủ)

**Điện thoại / Tablet:**
```
{Tên gốc từ TGDD} {RAM}/{Storage} - {Màu}

Ví dụ:
  "Điện thoại iPhone 17 Pro Max 256GB 6GB/128GB - Đen"
  "Điện thoại iPhone 17 Pro Max 256GB 6GB/256GB - Trắng"
  "Điện thoại Samsung Galaxy S25 Ultra 12GB/512GB - Titan Đen"
  "Điện thoại Xiaomi 15 Ultra 12GB/512GB - Xanh dương"
```

**Laptop:**
```
{Tên gốc từ TGDD} RAM {RAM} {Storage} - {Màu}

Ví dụ:
  "Laptop Asus Vivobook S14 S3407VA - LY146W (Core 5 210H, 16GB, 512GB, WUXGA, Win11) RAM 8GB 256GB SSD - Bạc"
  "Laptop Asus Vivobook S14 S3407VA - LY146W (Core 5 210H, 16GB, 512GB, WUXGA, Win11) RAM 16GB 1TB SSD - Xám Không Gian"
  "Laptop Dell XPS 13 9340 (...) RAM 16GB 512GB SSD - Xám Không Gian"
```

**Tai nghe / Loa / Phụ kiện màu:**
```
{Tên gốc từ TGDD} - Màu {Màu}

Ví dụ:
  "Tai nghe Bluetooth Chụp Tai JBL Live 780NC - Màu Trắng"
  "Tai nghe Bluetooth Chụp Tai JBL Tune 530BT - Màu Đen"
  "Loa Bluetooth Sony SRS-XB100 - Màu Đen"
```

**Smartwatch:**
```
{Tên gốc từ TGDD} - Dây {Màu}

Ví dụ:
  "Đồng hồ thông minh Apple Watch Series 10 - Dây Đen"
  "Đồng hồ thông minh Samsung Galaxy Watch7 - Dây Vàng Hồng"
```

**HDD / SSD / Thẻ nhớ / USB:**
```
{Tên gốc từ TGDD} {Dung lượng}

Ví dụ:
  "Ổ cứng di động Seagate One Touch 500GB"
  "Thẻ nhớ MicroSD SanDisk Extreme 64GB"
```

### Cấu trúc tên — Phase 2 (round-robin)
Giữ nguyên tên gốc từ TGDD, chỉ thay đổi giá/stock/sold.

---

## 6. Hình ảnh sản phẩm

### Nguồn ảnh: cdn.tgdd.vn

Toàn bộ ảnh được lấy trực tiếp từ CDN Thế Giới Di Động trong quá trình crawl:

```
https://cdn.tgdd.vn/Products/Images/{cat-id}/{product-id}/{slug}-thumb-600x600.jpg
https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/{cat-id}/{product-id}/{slug}-600x600.jpg
```

**Ví dụ URL ảnh thực tế:**
```
iPhone 17 Pro Max:
  https://cdn.tgdd.vn/Products/Images/42/342679/iphone-17-pro-max-cam-thumb-600x600.jpg

JBL Live 780NC:
  https://cdn.tgdd.vn/Products/Images/54/368034/tai-nghe-bluetooth-chup-tai-jbl-live-780nc-xanh-thumb-600x600.jpg

Samsung Galaxy Buds4 Pro:
  https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/54/363188/tai-nghe-bluetooth-true-wireless-samsung-galaxy-buds4-pro-r640n-thumb-639076639855476853-600x600.jpg

Apple AirPods Pro 3:
  https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/54/344776/tai-nghe-bluetooth-apple-airpods-pro-3-trang-mfhp4-thumb-639177367044323389-600x600.jpg
```

### Cột `image` và `images` trong DB

| Cột | Kiểu | Giá trị |
|---|---|---|
| `image` | `String?` | URL ảnh thumbnail chính (600×600px) từ cdn.tgdd.vn |
| `images` | `String` (JSON) | JSON array, thường `["url"]` — 1 ảnh gốc từ TGDD |

Các sản phẩm Phase 2 (round-robin) dùng **cùng ảnh với sản phẩm gốc** — ảnh tái sử dụng từ `base.image` và `base.images`.

---

## 7. Thương hiệu (33 brands)

Sau khi cleanup, DB còn đúng **33 thương hiệu** được ánh xạ tự động từ `data-brand` attribute / tên sản phẩm của TGDD:

| Brand ID | Tên hiển thị | Số sản phẩm | Danh mục chính |
|---|---|---|---|
| br-apple | Apple | 276.822 | Điện thoại, Tablet, Laptop, Smartwatch, Tai nghe |
| br-samsung | Samsung | 54.350 | Điện thoại, Tablet, Smartwatch, Tai nghe |
| br-xiaomi | Xiaomi | 42.050 | Điện thoại, Tablet, Smartwatch |
| br-jbl | JBL | 30.551 | Tai nghe BT, Tai nghe dây, Loa |
| br-oppo | OPPO | 30.150 | Điện thoại, Tablet |
| br-razer | Razer | 19.501 | Chuột, Bàn phím, Miếng lót chuột |
| br-sandisk | SanDisk | 18.174 | Thẻ nhớ, USB |
| br-asus | Asus | 11.400 | Laptop |
| br-logitech | Logitech | 10.264 | Chuột, Bàn phím, Miếng lót chuột |
| br-lenovo | Lenovo | 9.650 | Laptop, Tablet |
| br-huawei | Huawei | 9.450 | Smartwatch |
| br-hp | HP | 8.850 | Laptop |
| br-dell | Dell | 8.850 | Laptop |
| br-acer | Acer | 8.850 | Laptop |
| br-honor | HONOR | 7.500 | Điện thoại |
| br-vivo | Vivo | 7.500 | Điện thoại |
| br-realme | realme | 6.000 | Điện thoại |
| br-motorola | Motorola | 4.500 | Điện thoại |
| br-kingston | Kingston | 4.174 | Thẻ nhớ, USB |
| br-sony | Sony (Audio) | 3.400 | Tai nghe, Loa |
| br-ugreen | Ugreen | 2.550 | Sạc, cáp |
| br-marshall | Marshall | 2.550 | Loa, Tai nghe |
| br-totolink | TOTOLINK | 2.550 | Router |
| br-amazfit | Amazfit | 2.100 | Smartwatch |
| br-baseus | Baseus | 1.700 | Phụ kiện |
| br-seagate | Seagate | 1.500 | Ổ cứng |
| br-esr | ESR | 850 | Miếng dán màn hình |
| br-imou | Imou | 576 | Camera trong nhà |
| br-ezviz | EZVIZ | 384 | Camera |
| br-tp-link | TP-Link | 320 | Camera, Router |
| br-dahua | Dahua | 128 | Camera giám sát |
| br-infinix | Infinix | < 100 | Điện thoại |
| br-tecno | TECNO | < 100 | Điện thoại |

> **Lưu ý:** Apple chiếm ~46% do nhiều phụ kiện trên TGDD (túi AirPods, giá đỡ, miếng dán,...) được gán brand Apple từ TGDD hoặc fallback về Apple trong `mapBrand()`. Đây là dữ liệu thực tế từ TGDD.

---

## 8. Danh mục sản phẩm (Category Hierarchy)

Hệ thống có **2 cấp danh mục**: Root (8 mục) → Sub-category (26 có sản phẩm).

### Root categories với sản phẩm trực tiếp
| Category ID | Tên | Số sản phẩm |
|---|---|---|
| cat-phone | Điện thoại | 75.000 |
| cat-tablet | Tablet | 75.000 |
| cat-laptop | Laptop | 59.000 |
| cat-watch | Smartwatch | 21.000 |

### Root categories nhóm (chỉ chứa sub-categories)
| Category ID | Tên |
|---|---|
| cat-mobile-acc | Phụ kiện di động |
| cat-av | Thiết bị nghe nhìn, lưu trữ, thu âm |
| cat-laptop-acc | Phụ kiện laptop, PC |
| cat-camera | Camera |

### Sub-categories — Phụ kiện di động (cat-mobile-acc)
| Category ID | Tên | Số sản phẩm |
|---|---|---|
| cat-mobile-acc-case-tablet | Ốp lưng máy tính bảng | 17.000 |
| cat-mobile-acc-screen | Miếng dán màn hình | 17.000 |
| cat-mobile-acc-airpods-case | Túi đựng AirPods | 17.000 |
| cat-mobile-acc-cam-cover | Miếng dán Camera | 17.000 |
| cat-mobile-acc-stand | Giá đỡ điện thoại/laptop | 17.000 |
| cat-mobile-acc-charger | Sạc, cáp | 17.000 |
| cat-mobile-acc-fan | Quạt mini | 13.600 |

### Sub-categories — Thiết bị nghe nhìn (cat-av)
| Category ID | Tên | Số sản phẩm |
|---|---|---|
| cat-av-wire-earphone | Tai nghe dây | 17.000 |
| cat-av-headphone | Tai nghe chụp tai | 17.000 |
| cat-av-sport-earphone | Tai nghe thể thao | 17.000 |
| cat-av-bt-earphone | Tai nghe Bluetooth | 17.000 |
| cat-av-speaker | Loa | 17.000 |
| cat-av-mic | Micro | 16.518 |
| cat-av-hdd | Ổ cứng | 15.000 |
| cat-av-sdcard | Thẻ nhớ | 15.000 |
| cat-av-projector | Máy chiếu | 14.400 |
| cat-av-usb | USB | 13.720 |

### Sub-categories — Phụ kiện laptop, PC (cat-laptop-acc)
| Category ID | Tên | Số sản phẩm |
|---|---|---|
| cat-laptop-acc-mousepad | Miếng lót chuột | 17.064 |
| cat-laptop-acc-bag | Balo, túi chống sốc | 17.000 |
| cat-laptop-acc-keyboard | Bàn phím | 17.000 |
| cat-laptop-acc-mouse | Chuột máy tính | 17.000 |
| cat-laptop-acc-pouch | Túi đựng phụ kiện | 17.000 |
| cat-laptop-acc-drawing | Bảng vẽ điện tử | 7.650 |

### Sub-categories — Camera (cat-camera)
| Category ID | Tên | Số sản phẩm |
|---|---|---|
| cat-cam-security | Camera Giám Sát | 1.280 |
| cat-cam-indoor | Camera trong nhà | 576 |
| cat-cam-doorbell | Chuông cửa Camera | 192 |

---

## 9. Cấu trúc bản ghi Product trong DB

| Cột | Kiểu | Giá trị mẫu |
|---|---|---|
| `id` | `String (CUID)` | `cm1a2b3c4d...` (auto-generated) |
| `name` | `String` | `"Điện thoại iPhone 17 Pro 256GB 6GB/256GB - Đen"` |
| `price` | `Int` | `31.997.000` (VNĐ, làm tròn 1.000đ) |
| `original_price` | `Int` | `34.990.000` (giá gốc, luôn ≥ price) |
| `category_id` | `String` | `"cat-phone"` |
| `brand_id` | `String` | `"br-apple"` |
| `image` | `String?` | `"https://cdn.tgdd.vn/..."` |
| `images` | `String` (JSON array) | `["https://cdn.tgdd.vn/..."]` |
| `description` | `String` | `"iPhone 17 Pro — Chính hãng tại Thế Giới Di Động."` |
| `variants` | `String` (JSON array) | `[]` hoặc `[{"color":"Đen","ram":"8GB","storage":"256GB"}]` |
| `stock` | `Int` | 5 → 999 (random uniform) |
| `sold` | `Int` | 0 → 2.000 (random uniform) |
| `rating` | `Float` | 4.0 → 5.0 (random, 1 chữ số thập phân) |
| `branch_ids` | `JSON` | `[]` — hiển thị ở tất cả chi nhánh |
| `is_banner` | `Boolean` | `false` |
| `is_deleted` | `Boolean` | `false` |

### Giải thích `branch_ids = []`
Logic hệ thống: `branch_ids = []` → sản phẩm **không bị lọc theo chi nhánh** → hiển thị toàn quốc. Nếu set `["HCM001"]` thì chỉ hiện ở chi nhánh HCM001. Toàn bộ 600.000 SP được set `[]` để đảm bảo pagination đúng 25.000 trang ở mọi nơi.

---

## 10. Khoảng giá theo danh mục (dữ liệu thực từ DB)

| Danh mục | Giá thấp nhất | Giá trung bình | Giá cao nhất |
|---|---|---|---|
| Điện thoại | 6.440.000 ₫ | 25.296.674 ₫ | 58.039.000 ₫ |
| Laptop | 13.840.000 ₫ | 28.756.830 ₫ | 61.340.000 ₫ |
| Tablet | 2.940.000 ₫ | 13.437.783 ₫ | 39.040.000 ₫ |
| Smartwatch | 744.000 ₫ | 5.914.941 ₫ | 19.634.000 ₫ |
| Tai nghe Bluetooth | 540.000 ₫ | 5.057.747 ₫ | 17.040.000 ₫ |
| Tai nghe chụp tai | 540.000 ₫ | 5.057.873 ₫ | 17.040.000 ₫ |
| Tai nghe thể thao | 540.000 ₫ | 5.057.703 ₫ | 17.040.000 ₫ |
| Tai nghe dây | 540.000 ₫ | 5.058.101 ₫ | 17.040.000 ₫ |
| Loa | 740.000 ₫ | 7.697.419 ₫ | 17.950.000 ₫ |
| Micro | 600.000 ₫ | 2.432.196 ₫ | 7.415.000 ₫ |
| Máy chiếu | 120.000 ₫ | 9.772.554 ₫ | 61.055.000 ₫ |
| Ổ cứng | 2.340.000 ₫ | 8.590.906 ₫ | 36.739.000 ₫ |
| Thẻ nhớ | 280.000 ₫ | 1.331.260 ₫ | 7.435.000 ₫ |
| USB | 110.000 ₫ | 627.558 ₫ | 4.139.000 ₫ |
| Sạc, cáp | 130.000 ₫ | 588.978 ₫ | 1.440.000 ₫ |
| Chuột máy tính | 120.000 ₫ | 1.260.132 ₫ | 4.740.000 ₫ |
| Bàn phím | 290.000 ₫ | 2.233.406 ₫ | 8.240.000 ₫ |
| Miếng lót chuột | 15.000 ₫ | 604.795 ₫ | 2.545.000 ₫ |
| Bảng vẽ điện tử | 10.000 ₫ | 1.992.232 ₫ | 5.040.000 ₫ |
| Camera giám sát | 322.000 ₫ | 858.732 ₫ | 2.538.000 ₫ |
| Camera trong nhà | 401.000 ₫ | 6.804.639 ₫ | 20.540.000 ₫ |
| Chuông cửa Camera | 850.000 ₫ | 1.366.203 ₫ | 1.750.000 ₫ |

> Giá được lấy thực tế từ TGDD, sau đó cộng thêm delta biến thể (RAM/Storage cao → giá cao hơn) và nhiễu ±50.000₫ ngẫu nhiên, làm tròn đến 1.000₫.

---

## 11. Biến môi trường cần thiết

File `.env` ở thư mục gốc dự án (cùng cấp `docker-compose.yml`):

```env
# PostgreSQL
POSTGRES_DB=getshopy
POSTGRES_USER=getshopy
POSTGRES_PASSWORD=<mật khẩu — xin từ chủ repo>
POSTGRES_PORT=5432

# Dùng cho scripts seed chạy bên ngoài Docker
DATABASE_URL=postgresql://getshopy:<PASSWORD>@localhost:5432/getshopy
DIRECT_URL=postgresql://getshopy:<PASSWORD>@localhost:5432/getshopy
```

> [!CAUTION]
> Không commit file `.env` lên Git. Xin file `.env` từ chủ repo và đặt vào thư mục gốc trước khi chạy.

---

## 12. Cách tái tạo toàn bộ dữ liệu

### Điều kiện tiên quyết
- Docker Desktop đang chạy
- File `.env` đã có ở thư mục gốc
- File `scripts/data/tgdd-products.json` còn tồn tại (24MB, 26.262 records)
- Node.js 18+ đã cài trên máy
- Đang ở thư mục: `ktln-Getshopy/qu-n-ly-ban-l/source/server`

### Lệnh tái tạo nhanh (không cần crawl lại)

```bash
# 1. Truncate product table
docker exec kltn-postgres-1 psql -U getshopy -d getshopy \
  -c 'TRUNCATE TABLE "Product" RESTART IDENTITY CASCADE;'

# 2. Seed 600.000 sản phẩm từ file TGDD có sẵn
cd ktln-Getshopy/qu-n-ly-ban-l/source/server
$env:DATABASE_URL="postgresql://getshopy:getshopy_dev_password@localhost:5432/getshopy"
node scripts/replace-products.js --target=600000

# 3. Flush Redis cache
docker exec kltn-redis-1 redis-cli FLUSHDB
```

### Nếu cần crawl lại từ TGDD (file json bị mất)

```bash
# Cần Chrome cài sẵn trên máy
node scripts/crawl-tgdd.js
# Đợi ~30–60 phút (30 danh mục × ~300 trang × delay 800ms)
# → Sau đó chạy lại bước 2
```

---

## 13. Kiểm tra nhanh sau khi seed

```sql
-- Tổng sản phẩm và số trang
SELECT COUNT(*) as total, CEIL(COUNT(*)::numeric/24) as pages
FROM "Product" WHERE is_deleted=false;
-- Expected: 600000 | 25000

-- Số brands (phải = 33)
SELECT COUNT(DISTINCT brand_id) FROM "Product";

-- Không còn brand rỗng
SELECT COUNT(*) FROM "Product" WHERE brand_id='br-khac';
-- Expected: 0

-- Sample sản phẩm Apple phone
SELECT name, brand_id, image FROM "Product"
WHERE brand_id='br-apple' AND category_id='cat-phone' LIMIT 3;

-- Phân bố theo category
SELECT c.name, COUNT(p.id) as count
FROM "Category" c
LEFT JOIN "Product" p ON p.category_id=c.id AND p.is_deleted=false
GROUP BY c.name
ORDER BY COUNT(p.id) DESC;
```

---

## 14. Lưu ý quan trọng

> [!WARNING]
> **Apple chiếm ~46% sản phẩm (276.822/600.000)** — đây là dữ liệu thực từ TGDD.
> Nhiều phụ kiện (túi AirPods, giá đỡ, miếng dán) trên TGDD không gắn brand rõ ràng,
> hệ thống fallback về `br-apple` theo logic `mapBrand()` trong `crawl-tgdd.js` (line 170).

> [!NOTE]
> **Ảnh sản phẩm** phụ thuộc vào CDN của Thế Giới Di Động (`cdn.tgdd.vn`, `cdnv2.tgdd.vn`).
> Nếu TGDD thay đổi CDN hoặc xóa ảnh, ảnh sẽ broken. Để production thực sự, cần mirror ảnh về MinIO.

> [!NOTE]
> **Tên sản phẩm Phase 2** (284.388 sản phẩm) trùng tên với Phase 1 nhưng có giá/stock/sold
> khác nhau nhỏ. Đây là cơ chế cố ý để đạt mốc 600.000 sản phẩm phục vụ demo pagination
> 25.000 trang mà không cần crawl thêm dữ liệu.

---

## 15. Behavior Tracking Pipeline (Hành vi người dùng → AI Rec)

### 15.1 Tổng quan luồng

```
[FE - useTracking.js]
  ↓  buffer 5s, batch send / beforeunload sendBeacon
[BE - POST /api/b2c/track]
  ↓  BehaviorService.trackEvents()  →  validate & sanitize
[ClickHouse - analytics.user_events]
  ↓  dbt transform (mỗi 5 phút)
[ClickHouse - serving.processed_data_for_AI_rec]
  ↓  AI Rec service đọc qua HTTP
[FE - Gợi ý cá nhân hóa]
```

### 15.2 Các loại event được track

| Event Type | Trọng số | Nơi kích hoạt | Dữ liệu đính kèm |
|---|---|---|---|
| `product_view` | 1 | ProductDetail — khi unmount | product_id, dwell_time_ms, scroll_depth_pct |
| `category_view` | 0.5 | ProductList — khi load danh mục | category_id |
| `search_query` | 1.5 | ProductList — khi search | search_query, result_count |
| `add_to_cart` | 3 | ProductDetail — nút "Thêm vào giỏ" | product_id, quantity, price_at_event |
| `remove_from_cart` | -1 | Cart — nút xóa sản phẩm | product_id |
| `add_to_wishlist` | 2 | ProductDetail — nút tim (chỉ khi ADD) | product_id, category_id, brand_id |
| `compare_view` | 1.5 | So sánh sản phẩm | product_ids[] |
| `review_submit` | 4 | ProductDetail — form đánh giá | product_id, rating |
| `purchase` | 5 | Checkout — sau xác nhận đơn | product_id, quantity, price_at_event |
| `checkout_abandon` | -0.5 | Checkout — rời trang chưa thanh toán | product_ids[] |

### 15.3 Cấu trúc bảng `analytics.user_events` (ClickHouse)

```sql
CREATE TABLE analytics.user_events (
  event_id          String    DEFAULT generateUUIDv4(),
  event_type        LowCardinality(String),    -- loại event (10 types)
  session_id        String,                    -- UUID per browser tab
  customer_id       Nullable(Int64),           -- NULL nếu chưa đăng nhập
  product_id        Nullable(Int64),
  category_id       Nullable(String),
  brand_id          Nullable(String),
  price_at_event    Nullable(Decimal(18,2)),
  dwell_time_ms     Nullable(Int32),           -- thời gian xem (ms), cap 10 phút
  scroll_depth_pct  Nullable(Float32),         -- % scroll, 0–100
  quantity          Nullable(Int32),
  rating            Nullable(Int32),           -- 1–5, chỉ cho review_submit
  search_query      Nullable(String),
  result_count      Nullable(Int32),
  product_ids       Array(Int64) DEFAULT [],   -- cho compare, checkout_abandon
  device_type       LowCardinality(String) DEFAULT 'desktop',
  referrer          LowCardinality(String) DEFAULT 'direct',
  page_source       LowCardinality(String) DEFAULT '',
  event_time        DateTime64(3, 'Asia/Ho_Chi_Minh') DEFAULT now(),
  created_at        DateTime64(3, 'Asia/Ho_Chi_Minh') DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (event_time, session_id, event_type);
```

### 15.4 FE Hook chi tiết — `useTracking.js`

**Session ID:** `sessionStorage.getItem('gs_session_id')` — UUID per tab, không persist qua reload.

**Buffer & Flush:**
- Buffer max 20 events → flush ngay
- Timer 5 giây → auto flush dù chưa đủ 20
- `beforeunload` → `navigator.sendBeacon()` (fire-and-forget, không bị cancel khi tắt tab)

**Đặc biệt — `useProductViewTracker(product)`:**
- Gắn vào `ProductDetail` qua `useEffect`
- Đo `dwell_time_ms = Date.now() - startTime` khi unmount
- Đo `scroll_depth_pct` bằng scroll event listener
- Chỉ gửi nếu `dwell_time_ms > 1000ms` (lọc bot/click nhầm)

### 15.5 BE Service chi tiết — `BehaviorService.js`

**Buffer phía server:** Max 50 events, flush mỗi 5 giây vào ClickHouse.  
**Nếu ClickHouse insert thất bại:** Dồn lại buffer (tối đa 200 events) rồi retry ở lần flush sau.

**ClickHouse settings:**
```js
clickhouse_settings: {
  async_insert: 1,      // insert bất đồng bộ
  wait_for_async_insert: 0  // không block response chờ insert
}
```

### 15.6 Rating sản phẩm — Cơ chế thực

| Trạng thái | `Product.rating` |
|---|---|
| Sản phẩm mới seed, chưa có review | `0` |
| Sau khi có 1+ review | `ROUND(AVG(Review.rating), 1)` |

**Cập nhật tự động:** `POST /api/b2c/products/:id/reviews` sẽ tự tính lại AVG và cập nhật `Product.rating` ngay sau mỗi lần submit review.

**Verify nhanh:**
```bash
# Xem phân bố rating hiện tại
docker exec kltn-postgres-1 psql -U getshopy -d getshopy -c \
  'SELECT COUNT(*) FILTER (WHERE rating=0) as no_review, COUNT(*) FILTER (WHERE rating>0) as has_review FROM "Product";'
```

### 15.7 Verify toàn bộ pipeline hoạt động

```bash
# 1. Xem user_events trong ClickHouse
docker exec kltn-clickhouse-1 clickhouse-client \
  --query "SELECT event_type, COUNT() as cnt FROM analytics.user_events GROUP BY event_type ORDER BY cnt DESC;"

# 2. Kiểm tra add_to_wishlist
docker exec kltn-clickhouse-1 clickhouse-client \
  --query "SELECT COUNT() FROM analytics.user_events WHERE event_type='add_to_wishlist';"

# 3. Debug stats qua API
curl http://localhost:8080/api/b2c/behavior/stats
```

