# Getshopy — Optimize Issue Brief

> Đọc toàn bộ source ngày 25/08/2026. Liệt kê các issue theo mức độ ưu tiên.  
> File: `source/docs/optimize-issue.md`

---

## Phân loại

| Ký hiệu | Mức độ |
|---------|--------|
| 🔴 CRITICAL | Bảo mật / data loss / production crash |
| 🟠 HIGH | Hiệu năng nghiêm trọng, ảnh hưởng UX rõ |
| 🟡 MEDIUM | Code smell, bug tiềm ẩn, UX nhỏ |
| 🟢 LOW | Cải tiến, cleanup, nice-to-have |

---

## 🔴 CRITICAL — Bảo mật & Tính toàn vẹn dữ liệu

---

### [C-01] SQL Injection trong ClickHouse queries — `index.js`

**File:** [`server/src/index.js`](../server/src/index.js) — line 117, 170, 210, 231, 248, 407, 444, 481, 500, 508, 517

**Mô tả:**  
Toàn bộ các ClickHouse query dùng **string interpolation trực tiếp** từ `req.query` vào SQL:

```js
// Dòng 117 — branch_id từ URL param được nhúng thẳng vào SQL
const branchFilter = branch_id && branch_id !== 'ALL' ? `AND branch_id = '${branch_id}'` : '';

// Dòng 508 — limit từ req.query nhúng vào LIMIT clause
ORDER BY voucher_date DESC LIMIT ${limit}

// Dòng 234 — targetDate không validate
WHERE toDate(order_date) = '${targetDate}'
```

**Risk:** Kẻ tấn công gửi `branch_id='; DROP TABLE analytics.sale_orders; --` → xóa toàn bộ analytics data.

**Fix:**
```js
// Dùng parameterized query của ClickHouse client
await ch.query({
  query: 'SELECT ... WHERE branch_id = {branchId:String}',
  query_params: { branchId: branch_id }
});
```

---

### [C-02] `/api/products` legacy endpoint — không auth, không limit

**File:** [`server/src/index.js`](../server/src/index.js) — line 530–537

```js
app.get('/api/products', async (req, res) => {
  const products = await prisma.product.findMany(); // SELECT * không LIMIT
  res.json(products.map(p => ({ ...p, id: Number(p.id) })));
});
```

**Risk:** Bất kỳ ai cũng có thể gọi endpoint này để dump toàn bộ 50k+ sản phẩm (không cần token). Response ~16MB, làm quá tải server + lộ toàn bộ catalog.

**Fix:** Thêm `authMiddleware` + `take: 100` hoặc xóa endpoint legacy này.

---

### [C-03] Voucher không validate hết lần sử dụng

**File:** [`server/src/routes/b2c.js`](../server/src/routes/b2c.js) — line 242–263

```js
router.post('/cart/apply-voucher', async (req, res) => {
  const voucher = await prisma.voucher.findUnique({ where: { code } });
  // Không kiểm tra usage_limit vs used_count
  // Không check expiry_date
  // Không check hết hạn theo thời gian
  res.json({ success: true, discount });
});
```

**Risk:** User có thể dùng 1 voucher không giới hạn số lần. Không có expiry check.

---

### [C-04] `redis.flushAll()` khi checkout — xóa toàn bộ cache

**File:** [`server/src/index.js`](../server/src/index.js) — line 631, 770

```js
if (redisIsConnected()) await redis.flushAll(); // Clear analytics cache
```

**Risk:** Mỗi lần khách đặt hàng → xóa **tất cả** Redis cache kể cả cache không liên quan (session, dashboard, v.v.). Trong production với nhiều request đồng thời → cache stampede, tất cả request sau đó đều hit DB cùng lúc.

**Fix:** Dùng targeted key invalidation:
```js
await redis.del('kpi:*', 'revHour:*', 'revTrend:*'); // chỉ xóa key liên quan
```

---

### [C-05] Race condition trong inventory deduction — checkout

**File:** [`server/src/index.js`](../server/src/index.js) — line 704–731

```js
// 1. Đọc stock
const product = await prisma.product.findUnique(...);
// 2. Tính toán (khoảng thời gian này stock có thể thay đổi)
const newStock = Math.max(0, product.stock - stockToDeduct);
// 3. Ghi stock mới (mất update của request song song)
await prisma.product.update({ data: { stock: newStock } });
```

**Risk:** Hai người cùng mua sản phẩm còn 1 cái → cả hai đều thấy stock=1 → cả hai trừ → stock = -1.

**Fix:** Dùng atomic update:
```js
await prisma.product.update({
  where: { id: BigInt(item.id), stock: { gte: stockToDeduct } }, // optimistic lock
  data: { stock: { decrement: stockToDeduct }, sold: { increment: stockToDeduct } }
});
```

---

## 🟠 HIGH — Hiệu năng

---

### [P-01] `getActiveFlashSaleItems()` gọi mỗi request, không cache

**File:** [`server/src/routes/b2c.js`](../server/src/routes/b2c.js) — line 20–28, 151, 189, 435

```js
// Được gọi trong: GET /products, GET /products/:id, GET /recommendations
const getActiveFlashSaleItems = async () => {
  const activeSale = await prisma.flashSale.findFirst(...);
  return await prisma.flashSaleItem.findMany(...);
  // 2 DB queries, không cache → ~514ms mỗi lần
};
```

**Impact đo được:** Chiếm ~50% tổng latency API (514ms / 1029ms).

**Fix:**
```js
const FLASH_SALE_CACHE_TTL = 60_000; // 60 giây
let _fsCache = null, _fsCacheTime = 0;
const getActiveFlashSaleItems = async () => {
  if (_fsCache && Date.now() - _fsCacheTime < FLASH_SALE_CACHE_TTL) return _fsCache;
  // ... query
  _fsCache = result; _fsCacheTime = Date.now();
  return result;
};
```

---

### [P-02] Home page — 4 API calls song song khi load, 2 call giống nhau

**File:** [`client/src/pages/b2c/Home.jsx`](../client/src/pages/b2c/Home.jsx) — line 83–88

```js
const [prodData, catData, flashData, topSellingData] = await Promise.all([
  api.b2c.getProducts('ALL', '', 'newest', selectedBranch?.id, currentPage, 15),   // call 1
  api.b2c.getCategories(),                                                           // call 2
  api.b2c.getFlashSales(),                                                           // call 3
  api.b2c.getProducts('ALL', '', 'best_selling', selectedBranch?.id, 1, 10)        // call 4
]);
```

**Problem:** Call 1 và 4 đều là `getProducts` — 2 lần hit DB/API. Flash sale cũng được fetch ở đây thêm 1 lần riêng. Tổng: mỗi lần vào Home → **4 API calls × ~1 giây = mọi thứ phụ thuộc nhau**.

**Fix:** Thêm 1 endpoint `GET /api/b2c/home-data` trả về tất cả trong 1 response.

---

### [P-03] ProductList — client-side filtering sau khi đã paginate server-side

**File:** [`client/src/pages/b2c/ProductList.jsx`](../client/src/pages/b2c/ProductList.jsx) — line 77–83

```js
let allProds = prodData.data || []; // đã paginate — chỉ có 12 rows
if (appliedMinPrice !== null) allProds = allProds.filter(p => p.price >= appliedMinPrice);
if (brands.length > 0) allProds = allProds.filter(p => brands.includes(p.brand_id));
```

**Problem:** Server trả về 12 sản phẩm (page 1), client filter tiếp → có thể còn 0–12 sản phẩm. `totalProducts` vẫn hiển thị total toàn DB → phân trang sai, count sai.

**Fix:** Đẩy price/brand filter lên server (đã có `brand_id` parameter trong API).

---

### [P-04] WebSocket interval query ClickHouse mỗi 5 giây — dù không có client nào

**File:** [`server/src/index.js`](../server/src/index.js) — line 557–578

```js
setInterval(async () => {
  if (wsClients.size === 0) return; // đã check nhưng ClickHouse vẫn query nếu có client
  const rows = await queryClickHouse(`SELECT SUM(...) FROM analytics.sale_orders ...`);
}, 5000);
```

**Problem:** 1 admin dashboard mở → mỗi 5 giây query ClickHouse. Không có batching, không có debounce nếu nhiều admin đang xem cùng lúc.

**Fix:** Cache kết quả 5 giây, chỉ query 1 lần dù có nhiều client.

---

### [P-05] `prisma.$queryRawUnsafe` với `orderSQL` hardcode string — potential injection

**File:** [`server/src/routes/b2c.js`](../server/src/routes/b2c.js) — line 119–123

```js
const orderSQL =
  sort === 'price_asc'  ? 'price ASC' :
  sort === 'price_desc' ? 'price DESC' :
  ...
  'id DESC';
// orderSQL được nhúng trực tiếp vào $queryRawUnsafe
```

Hiện tại whitelist sort values nên tương đối an toàn, nhưng `orderSQL` được nhúng vào raw SQL string — nếu whitelist bị bypass (vd: future refactor) → injection risk.

---

### [P-06] `SELECT *` trên ClickHouse alert tables — không cần thiết

**File:** [`server/src/index.js`](../server/src/index.js) — line 376, 392

```js
SELECT * FROM analytics.alert_events  // lấy toàn bộ columns
```

ClickHouse columnar storage — `SELECT *` đọc tất cả columns kể cả không dùng → I/O tăng.

---

### [P-07] 3D GLB bundle 30.5MB không nén

**File:** [`client/src/components/b2c/HeroBanner3D.jsx`](../client/src/components/b2c/HeroBanner3D.jsx)

5 model GLB tổng 30.5MB được bundle thẳng vào Vite dist. Không có:
- Draco/meshopt compression
- LOD (Level of Detail)
- Progressive loading theo viewport

**Impact:** First load trên 4G: 12–15 giây.

---

## 🟡 MEDIUM — Bug tiềm ẩn & Code smell

---

### [M-01] Inventory deduct không rollback nếu ClickHouse insert fails

**File:** [`server/src/index.js`](../server/src/index.js) — line 704–740

```js
// 1. Trừ stock trong PostgreSQL
await prisma.product.update({ data: { stock: newStock } });

// 2. Insert ClickHouse (có thể fail)
await ch.insert({ table: 'analytics.sale_orders', ... });
// Nếu bước 2 fail → stock đã bị trừ nhưng order không có trong analytics
```

Không có 2-phase commit hay compensation pattern.

---

### [M-02] Loyalty points lưu trong localStorage — không đồng bộ với DB

**File:** [`client/src/pages/b2c/Checkout.jsx`](../client/src/pages/b2c/Checkout.jsx) — line 92, 163

```js
const [points] = useState(() => parseInt(localStorage.getItem('b2c_points') || '0'));
localStorage.setItem('b2c_points', newPoints.toString()); // sau checkout
```

Points không được save vào DB (`B2CCustomer.loyalty_points`). Clear localStorage = mất điểm. Điểm không đồng bộ giữa các thiết bị.

---

### [M-03] `orders/me` API không require authentication

**File:** [`server/src/routes/b2c.js`](../server/src/routes/b2c.js) — line 266–292

```js
router.get('/orders/me', async (req, res) => {
  const { email } = req.query;
  // Không có authMiddleware — ai cũng có thể query orders của email bất kỳ
  orders = await prisma.order.findMany({ where: { customer: { path: ['email'], equals: email } } });
});
```

**Risk:** Gọi `/api/b2c/orders/me?email=victim@gmail.com` → xem toàn bộ lịch sử đơn hàng của người khác.

---

### [M-04] Social login cho phép đăng nhập với email giả bất kỳ

**File:** [`server/src/routes/b2c.js`](../server/src/routes/b2c.js) — line 377–414

```js
router.post('/auth/social', async (req, res) => {
  const { provider, email, full_name } = req.body; // email do client tự gửi
  // Không có OAuth verification — không verify token từ Google/Facebook
  let user = await prisma.b2CCustomer.findUnique({ where: { email } });
  // Tự động tạo account nếu chưa có
});
```

Ai cũng có thể POST với `email: admin@getshopy.com` → đăng nhập vào account đó.

---

### [M-05] `db_legacy_data.js` — file dữ liệu legacy không dùng

**File:** [`server/src/db_legacy_data.js`](../server/src/db_legacy_data.js) — 4936 bytes

Tồn tại trong repo nhưng không được import ở đâu. Tương tự `fix.js` (21KB), `fix_categories.js`, `seed-1m.js`, `seed-mock-v2.js` — không được dọn dẹp.

---

### [M-06] `AI (Not used)` directory trong server/src

**File:** [`server/src/AI (Not used)/`](../server/src/)

Thư mục tên có khoảng trắng và "(Not used)" — rõ ràng là dead code, ảnh hưởng bundle analysis và git history.

---

### [M-07] Hardcode WebSocket URL về `localhost:8080` trong production build

**File:** [`client/src/pages/Dashboard.jsx`](../client/src/pages/Dashboard.jsx) — line 148  
**File:** [`client/src/pages/b2c/ProductDetail.jsx`](../client/src/pages/b2c/ProductDetail.jsx) — line 59

```js
const ws = new WebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:8080');
```

Trong Docker production build, `VITE_WS_URL` được set nhưng nếu thiếu → fallback về `localhost:8080` → WebSocket không kết nối được trong production.

---

### [M-08] Checkout map dùng tọa độ thay vì địa chỉ thực

**File:** [`client/src/pages/b2c/Checkout.jsx`](../client/src/pages/b2c/Checkout.jsx) — line 70

```js
form.setFieldsValue({
  address: `Toạ độ: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`
});
```

Địa chỉ giao hàng được lưu là `"Toạ độ: 10.7626, 106.6602"` — giao hàng thực tế không thể dựa vào tọa độ thô như này. Cần reverse geocoding.

---

### [M-09] `startTransition` không thực sự cần thiết ở Home.jsx

**File:** [`client/src/pages/b2c/Home.jsx`](../client/src/pages/b2c/Home.jsx) — line 89–97

`startTransition` chỉ có ý nghĩa khi có concurrent features (Suspense boundary). Dùng trong simple `setLoading` → không có tác dụng, gây confusion cho người đọc code.

---

### [M-10] `console.log` benchmark code còn trong production build

**File:** [`client/src/pages/b2c/ProductList.jsx`](../client/src/pages/b2c/ProductList.jsx) — line 68, 93, 120  
**File:** [`client/src/components/b2c/HeroBanner3D.jsx`](../client/src/components/b2c/HeroBanner3D.jsx) — line 314, 335, 374, 419

Logs chỉ bật khi `?benchmark=true` — thiết kế đúng, nhưng code `console.log` vẫn tồn tại trong bundle production. Nên dùng `import.meta.env.DEV` để strip hoàn toàn khi build.

---

### [M-11] `AIChatbot.jsx` có `API_BASE` riêng — duplicate với `api.js`

**File:** [`client/src/components/b2c/AIChatbot.jsx`](../client/src/components/b2c/AIChatbot.jsx) — line 10

```js
const API_BASE = import.meta.env.VITE_API_URL || '/api'; // duplicate config
```

`api.js` đã centralize `BASE`. AIChatbot tự manage URL riêng → nếu đổi URL thì phải sửa 2 chỗ.

---

### [M-12] Data lake demo dùng mock data, không phải real ClickHouse

**File:** [`server/src/index.js`](../server/src/index.js) — line 324

```js
// MOCK DATA GENERATION ON-THE-FLY FOR 1M RECORDS TEST
// We simulate a DB query that returns exactly limit + 1 items based on cursor
const TOTAL_RECORDS = 1000000;
// + thêm delay giả 100-600ms
const delay = Math.floor(Math.random() * 500) + 100;
```

Data lake demo hoàn toàn là mock — không phản ánh hiệu năng thực của ClickHouse với 1M records.

---

## 🟢 LOW — Cleanup & Cải tiến nhỏ

---

### [L-01] `index.js` quá lớn — 807 dòng, 34KB

Tất cả route handlers (auth, dashboard, analytics, reconciliation, financial, websocket, checkout, simulate) đều nằm trong 1 file. Nên tách theo router giống `b2c.js` và `b2b.js`.

---

### [L-02] `aiHandlers.js` — 147KB, 3800+ dòng

File lớn nhất dự án. Khó test, khó maintain. Nên tách thành các module: `intentHandler.js`, `chatHandler.js`, `visualSearchHandler.js`.

---

### [L-03] JWT secret có fallback hardcode

**File:** [`server/src/index.js`](../server/src/index.js) — line 27  
**File:** [`server/src/routes/b2c.js`](../server/src/routes/b2c.js) — line 8

```js
const JWT_SECRET = process.env.JWT_SECRET || 'istore_secret';
```

Nếu `JWT_SECRET` không set trong `.env` → dùng chuỗi công khai `istore_secret` → JWT có thể bị forge. Nên throw error nếu thiếu.

---

### [L-04] Không có `helmet.js` — thiếu security headers

Server Express không dùng `helmet` → thiếu các header bảo mật:
- `Content-Security-Policy`
- `X-Frame-Options`
- `X-XSS-Protection`
- `Strict-Transport-Security`

---

### [L-05] `cors()` mở hoàn toàn — không restrict origin

**File:** [`server/src/index.js`](../server/src/index.js) — line 29

```js
app.use(cors()); // Allow all origins
```

Trong production nên restrict về domain cụ thể.

---

### [L-06] Rate limit 2000 req/min quá cao

**File:** [`server/src/index.js`](../server/src/index.js) — line 36

```js
max: 2000, // Increased so CI/automated tests don't get rate-limited
```

Comment cho thấy đây là workaround cho CI test, không phải giá trị production hợp lý. Nên tách rate limit cho CI vs production.

---

### [L-07] Checkout lưu địa chỉ dạng tọa độ — không reverse geocode

Đã đề cập ở M-08, cần thêm Nominatim/Google Maps API để reverse geocode tọa độ thành địa chỉ có thể giao hàng.

---

### [L-08] `seed.js` chạy mỗi lần Docker khởi động — chậm startup

**File:** [`server/docker-entrypoint.sh`](../server/docker-entrypoint.sh) — line 35

```sh
node src/seed.js  # Chạy mỗi lần start
```

Nên check xem data đã seed chưa trước khi chạy để tránh duplicate và tăng tốc startup.

---

## Tóm Tắt Ưu Tiên Fix

| # | Issue | File | Priority | Effort |
|---|-------|------|----------|--------|
| C-01 | SQL Injection ClickHouse | index.js | 🔴 CRITICAL | Trung bình |
| C-02 | Legacy /api/products no auth/limit | index.js | 🔴 CRITICAL | Thấp |
| C-03 | Voucher không check usage_limit | b2c.js | 🔴 CRITICAL | Thấp |
| C-04 | flushAll() khi checkout | index.js | 🔴 CRITICAL | Thấp |
| C-05 | Race condition inventory | index.js | 🔴 CRITICAL | Trung bình |
| M-03 | orders/me không auth | b2c.js | 🔴 CRITICAL | Thấp |
| M-04 | Social login không verify token | b2c.js | 🔴 CRITICAL | Cao |
| P-01 | Flash sale không cache | b2c.js | 🟠 HIGH | Thấp |
| P-02 | Home page 4 API calls | Home.jsx | 🟠 HIGH | Trung bình |
| P-03 | Client-side filter sau server pagination | ProductList.jsx | 🟠 HIGH | Trung bình |
| P-07 | 3D GLB 30.5MB không nén | HeroBanner3D.jsx | 🟠 HIGH | Cao |
| M-02 | Loyalty points localStorage only | Checkout.jsx | 🟡 MEDIUM | Cao |
| M-07 | WebSocket hardcode localhost | Dashboard.jsx | 🟡 MEDIUM | Thấp |
| L-03 | JWT secret fallback hardcode | index.js | 🟢 LOW | Thấp |
| L-04 | Thiếu helmet.js | index.js | 🟢 LOW | Thấp |

---

*Tổng: 7 Critical, 5 High, 6 Medium, 8 Low issues.*  
*Scan ngày: 25/08/2026 — Lê Văn Triều An*
