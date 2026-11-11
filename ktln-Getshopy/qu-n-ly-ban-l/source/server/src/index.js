const express = require('express');
const { createClient } = require('@clickhouse/client');
const CircuitBreaker = require('opossum');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const WebSocket = require('ws');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('./db');
const { authB2C } = require('./middleware/authB2C');
const { requireAdmin } = require('./middleware/requireAdmin');
const { validateCustomerInfo } = require('./utils/validators');
const { redis, isConnected: redisIsConnected, cached: redisCached } = require('./redis');

// ─── GLOBAL BIGINT SERIALIZER ────────────────────────────────────────────
BigInt.prototype.toJSON = function() {
  return Number(this);
};

// ─── GLOBAL ERROR HANDLERS (prevent nodemon/process crash from unhandled rejections) ───
process.on('unhandledRejection', (reason) => {
  console.error('🔥 [UnhandledRejection] Server caught unhandled promise rejection — keeping alive:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('🔥 [UncaughtException] Server caught uncaught exception — keeping alive:', err.message);
});

const app = express();
// Request tới đây luôn qua Tailscale (serve / Funnel) rồi nginx gateway, nên địa
// chỉ kết nối là IP mạng Docker (172.x), không phải IP khách. Tailscale ghi IP thật
// vào X-Forwarded-For (tailnet: 100.x; Funnel: IP công cộng — đo 11/11/2026 trên log
// gateway). Chỉ tin X-Forwarded-For từ các hop mạng riêng: req.ip là địa chỉ đầu tiên
// tính từ phải KHÔNG thuộc loopback / link-local / 10.x / 172.16-31.x / 192.168.x —
// tức IP thật của khách. Nhờ đó rate limit tính theo từng khách, không phải một hạn
// mức chung cho cả Internet. Khách tự chèn X-Forwarded-For giả cũng vô ích: IP thật
// do Tailscale ghi nằm bên phải và không thuộc dải tin cậy, nên vẫn là req.ip.
app.set('trust proxy', 'loopback, linklocal, uniquelocal');
// Không quảng cáo "X-Powered-By: Express" ra Internet (gian hàng đang public qua Funnel).
app.disable('x-powered-by');
const server = http.createServer(app);

// Lỗi 5xx trên API của gian hàng (/api/b2c, /api/ai — hai nhánh duy nhất gateway
// public cho ra Internet) không trả nguyên err.message cho khách: đo 11/11/2026,
// GET /api/b2c/products/abc trả "Cannot convert abc to a BigInt"; lỗi Prisma còn kèm
// tên bảng / cột / câu truy vấn. Thông điệp gốc vẫn ghi vào log server. Lỗi 4xx (sai
// dữ liệu nhập, chưa đăng nhập...) giữ nguyên vì đó là thông báo dành cho khách.
app.use(['/api/b2c', '/api/ai'], (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500 && body && typeof body.error === 'string') {
      console.error(`[5xx ${req.method} ${req.originalUrl}]`, body.error);
      body = { ...body, error: 'Hệ thống đang bận, vui lòng thử lại sau.' };
    }
    return json(body);
  };
  next();
});
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;
// KHÔNG có giá trị mặc định: secret hardcode trong source nghĩa là bất kỳ ai
// đọc được repo cũng ký được token giả cho mọi tài khoản.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Thiếu JWT_SECRET. Sinh bằng: openssl rand -base64 48');
}

app.use(cors());
app.use(morgan('dev'));
// Giữ lại body thô để xác thực chữ ký HMAC của webhook thanh toán.
// JSON.stringify(req.body) KHÔNG dùng thay được: nó có thể đổi thứ tự khoá và
// cách escape, làm chữ ký sai dù payload hợp lệ.
app.use(express.json({
  verify: (req, _res, buf) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/payment/webhook')) {
      req.rawBody = buf.toString('utf8');
    }
  },
}));

// ─── RATE LIMITING ────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 2000,     // Increased so CI/automated tests (495+ req) don't get rate-limited
  message: { error: 'Quá nhiều request, vui lòng thử lại sau.' },
  standardHeaders: true,
  legacyHeaders: false,
});
// Webhook thanh toán KHÔNG đi qua rate limiter: provider bắn dồn khi có nhiều
// giao dịch cùng lúc, bị chặn là mất tín hiệu tiền vào. Bảo vệ của endpoint này
// là chữ ký HMAC / API key + IP allowlist, không phải giới hạn tần suất.
app.use('/api/', (req, res, next) =>
  req.path.startsWith('/payment/webhook') ? next() : limiter(req, res, next)
);

// ─── CLICKHOUSE CLIENT ──────────────────────────────────────────
const ch = createClient({
  url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  database: 'analytics',
});

// ─── MÚI GIỜ NGHIỆP VỤ ──────────────────────────────────────────
// Cột order_date / voucher_date trong analytics.* có kiểu DateTime64(3, 'UTC'):
// toDate() không kèm múi giờ cắt ngày theo UTC, và múi giờ NẰM TRONG KIỂU CỘT nên đổi
// timezone của server hay session ClickHouse cũng không ăn. Dashboard chọn ngày theo
// giờ VN -> từ 00:00 đến 07:00 sáng mỗi ngày, "hôm nay" ra 0 đơn, biểu đồ theo giờ
// lệch 7 tiếng, % so với hôm qua thành -100% (thấy 11/11/2026: đơn 00:09 giờ VN nằm
// ở ngày 10/11 theo UTC). Mọi toDate/toHour bên dưới truyền BUSINESS_TZ, và "hôm nay"
// mặc định cũng tính theo BUSINESS_TZ thay vì new Date().toISOString() (= ngày UTC).
const BUSINESS_TZ = process.env.BUSINESS_TZ || 'Asia/Ho_Chi_Minh';
const _bizDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
/** 'YYYY-MM-DD' theo giờ nghiệp vụ; offsetDays âm = lùi về trước. */
function bizToday(offsetDays = 0) {
  return _bizDateFmt.format(new Date(Date.now() + offsetDays * 86400000));
}

// Các route analytics ghép thẳng date / branch_id / days vào câu SQL ClickHouse.
// Chỉ admin gọi được (requireAdmin) nhưng vẫn chặn giá trị lạ để không ai chèn SQL.
const _DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const _ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
app.use(['/api/dashboard', '/api/analytics', '/api/reconciliation', '/api/alerts', '/api/financial'], (req, res, next) => {
  const q = req.query;
  for (const k of ['date', 'date_from', 'date_to']) {
    if (q[k] !== undefined && q[k] !== '' && !_DATE_RE.test(String(q[k]))) return res.status(400).json({ error: `${k} phải có dạng YYYY-MM-DD` });
  }
  for (const k of ['branch_id', 'status']) {
    if (q[k] !== undefined && q[k] !== '' && !_ID_RE.test(String(q[k]))) return res.status(400).json({ error: `${k} không hợp lệ` });
  }
  for (const k of ['days', 'page', 'page_size', 'limit']) {
    if (q[k] !== undefined && q[k] !== '' && !/^\d{1,5}$/.test(String(q[k]))) return res.status(400).json({ error: `${k} phải là số nguyên dương` });
  }
  next();
});

// ─── CIRCUIT BREAKER ────────────────────────────────────────────
// timeout 5000 cũ thấp hơn thời gian truy vấn KPI lúc cache Redis còn trống: đo
// 11/11/2026 ngay sau khi khởi động lại server, /api/dashboard/kpis bị cắt ở 5,1–6,1 s
// (503) còn /analytics/revenue/by-branch lần sau chạy hết 3,5 s. Lần cắt đầu tiên lại
// mở mạch (opossum mặc định volumeThreshold 0 — một lỗi cũng đủ mở), nên mọi biểu đồ
// khác cũng 503 trong 10 s kế tiếp: đó là cảm giác "API dashboard chập chờn".
// Sau lần chạy đầu, kết quả nằm trong Redis nên các lượt sau không chạm ClickHouse.
const clickhouseOptions = {
  timeout: Number(process.env.CH_QUERY_TIMEOUT_MS) || 12000,
  errorThresholdPercentage: 50,
  volumeThreshold: 5,      // cần ít nhất 5 lượt trong cửa sổ thống kê mới xét mở mạch
  resetTimeout: 10000
};

const queryClickHouse = async (queryStr) => {
  const result = await ch.query({ query: queryStr, format: 'JSONEachRow' });
  return await result.json();
};

const chBreaker = new CircuitBreaker(queryClickHouse, clickhouseOptions);
chBreaker.fallback((queryStr, err) => {
  console.error('🔥 Circuit Breaker Fallback triggered for query');
  throw new Error('Hệ thống dữ liệu đang quá tải, vui lòng xem dữ liệu cũ (cached) hoặc thử lại sau.');
});

async function fetchWithCache(cacheKey, ttl, queryStr) {
  if (redisIsConnected()) {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }
  const data = await chBreaker.fire(queryStr);
  if (redisIsConnected()) {
    await redis.setEx(cacheKey, ttl, JSON.stringify(data));
  }
  return data;
}

// ─── TARGETED CACHE INVALIDATION (C-04) ──────────────────────────
// Thay redis.flushAll() bằng xóa đúng nhóm key analytics
const ANALYTICS_CACHE_PATTERNS = [
  'kpi:*', 'revHour:*', 'revTrend:*', 'revBranch:*', 'revCat:*',
  'dashboard:*', 'topSelling:*', 'flashSale:*'
];
async function invalidateAnalyticsCache() {
  if (!redisIsConnected()) return;
  for (const pattern of ANALYTICS_CACHE_PATTERNS) {
    let cursor = 0;
    do {
      const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;
      if (result.keys && result.keys.length > 0) {
        await redis.del(result.keys);
      }
    } while (cursor !== 0);
  }
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────
// Dashboard, analytics, tài chính, cảnh báo, simulate-sale: CHỈ dành cho quản trị.
// Bản cũ chỉ jwt.verify nên nhận cả token khách (cùng JWT_SECRET, role 'customer')
// — khách đăng ký ở cửa hàng gọi được API doanh thu. Xem middleware/requireAdmin.js.
function authMiddleware(req, res, next) {
  return requireAdmin(req, res, next);
}

// ─── AUTH ROUTES ──────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: Number(user.id), role: user.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: Number(user.id), full_name: user.full_name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: Number(user.id), full_name: user.full_name, email: user.email, role: user.role });
});

// ─── DASHBOARD KPIs ───────────────────────────────────────────
app.get('/api/dashboard/kpis', authMiddleware, async (req, res) => {
  try {
    const { branch_id, date } = req.query;
    const targetDate = date || bizToday();
    const branchFilter = branch_id && branch_id !== 'ALL' ? `AND branch_id = '${branch_id}'` : '';
    const cacheKey = `kpi:${branch_id || 'ALL'}:${targetDate}`;

    if (redisIsConnected()) {
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    }

    const [revToday, revYest, orders, cash, pending, voidOrders, allOrders] = await Promise.all([
      chBreaker.fire(`SELECT SUM(net_amount) as val FROM analytics.sale_orders WHERE toDate(order_date, '${BUSINESS_TZ}') = '${targetDate}' AND status = 'CONFIRMED' ${branchFilter}`),
      chBreaker.fire(`SELECT SUM(net_amount) as val FROM analytics.sale_orders WHERE toDate(order_date, '${BUSINESS_TZ}') = subtractDays(toDate('${targetDate}'), 1) AND status = 'CONFIRMED' ${branchFilter}`),
      chBreaker.fire(`SELECT COUNT(*) as val FROM analytics.sale_orders WHERE toDate(order_date, '${BUSINESS_TZ}') = '${targetDate}' AND status = 'CONFIRMED' ${branchFilter}`),
      chBreaker.fire(`SELECT SUM(amount) as val FROM analytics.input_vouchers WHERE toDate(voucher_date, '${BUSINESS_TZ}') = '${targetDate}' ${branchFilter}`),
      // Đếm trên TOÀN BỘ lịch sử (6,8 triệu dòng, ~1,3 s một mình — đo 11/11/2026) nên
      // không chạy lại theo nhịp 30 s của cache KPI: cache riêng 5 phút.
      fetchWithCache(`kpi:pending:${branch_id || 'ALL'}`, 300, `SELECT COUNT(*) as val FROM analytics.sale_orders WHERE status = 'CONFIRMED' ${branchFilter} AND order_id NOT IN (SELECT order_id FROM analytics.input_vouchers)`),
      chBreaker.fire(`SELECT COUNT(*) as val FROM analytics.sale_orders WHERE toDate(order_date, '${BUSINESS_TZ}') = '${targetDate}' AND status = 'VOIDED' ${branchFilter}`),
      chBreaker.fire(`SELECT COUNT(*) as val FROM analytics.sale_orders WHERE toDate(order_date, '${BUSINESS_TZ}') = '${targetDate}' ${branchFilter}`)
    ]);

    const rt = parseFloat(revToday[0]?.val || 0);
    const ry = parseFloat(revYest[0]?.val || 0);
    const ot = parseInt(orders[0]?.val || 0);
    const ct = parseFloat(cash[0]?.val || 0);
    const pr = parseInt(pending[0]?.val || 0);
    const vo = parseInt(voidOrders[0]?.val || 0);
    const ao = parseInt(allOrders[0]?.val || 0);

    const changePct = ry > 0 ? ((rt - ry) / ry * 100).toFixed(1) : 0;
    const voidRate = ao > 0 ? (vo / ao * 100).toFixed(1) : 0;

    const result = {
      revenue_today: rt,
      revenue_vs_yesterday_pct: parseFloat(changePct),
      orders_today: ot,
      avg_order_value: ot > 0 ? Math.round(rt / ot) : 0,
      cash_collected: ct,
      net_cash: ct,
      pending_recon: pr,
      void_rate: parseFloat(voidRate),
    };

    if (redisIsConnected()) await redis.setEx(cacheKey, 30, JSON.stringify(result));
    res.json(result);
  } catch (err) {
    if (err.message.includes('Hệ thống dữ liệu đang quá tải')) return res.status(503).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── REVENUE ANALYTICS ────────────────────────────────────────
app.get('/api/analytics/revenue/by-hour', authMiddleware, async (req, res) => {
  try {
    const { date, branch_id } = req.query;
    const targetDate = date || bizToday();
    const branchFilter = branch_id && branch_id !== 'ALL' ? `AND branch_id = '${branch_id}'` : '';
    const cacheKey = `revHour:${branch_id || 'ALL'}:${targetDate}`;

    const query = `SELECT toHour(order_date, '${BUSINESS_TZ}') as hour, SUM(net_amount) as revenue, COUNT(*) as orders FROM analytics.sale_orders WHERE toDate(order_date, '${BUSINESS_TZ}') = '${targetDate}' AND status = 'CONFIRMED' ${branchFilter} GROUP BY hour ORDER BY hour`;
    const rows = await fetchWithCache(cacheKey, 300, query);

    const map = {};
    rows.forEach(r => { map[parseInt(r.hour)] = r; });
    const result = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      revenue: parseFloat(map[h]?.revenue || 0),
      orders: parseInt(map[h]?.orders || 0),
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/revenue/by-branch', authMiddleware, async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || bizToday(-30);
    const to = date_to || bizToday();
    const cacheKey = `revBranch:${from}:${to}`;

    const query = `SELECT branch_id, branch_name, region, SUM(net_amount) as revenue, COUNT(*) as orders, countIf(status='VOIDED') * 100.0 / count() as void_rate FROM analytics.sale_orders WHERE toDate(order_date, '${BUSINESS_TZ}') BETWEEN '${from}' AND '${to}' AND status = 'CONFIRMED' GROUP BY branch_id, branch_name, region ORDER BY revenue DESC`;
    const rows = await fetchWithCache(cacheKey, 600, query);

    res.json(rows.map((r, i) => ({ ...r, rank: i + 1, revenue: parseFloat(r.revenue), orders: parseInt(r.orders), void_rate: parseFloat(parseFloat(r.void_rate).toFixed(1)) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/revenue/by-category', authMiddleware, async (req, res) => {
  try {
    const { date_from, date_to, branch_id } = req.query;
    const from = date_from || bizToday(-30);
    const to = date_to || bizToday();
    const branchFilter = branch_id && branch_id !== 'ALL' ? `AND branch_id = '${branch_id}'` : '';
    const cacheKey = `revCat:${branch_id || 'ALL'}:${from}:${to}`;

    const query = `SELECT product_category as category, SUM(net_amount) as revenue, COUNT(*) as orders FROM analytics.sale_orders WHERE toDate(order_date, '${BUSINESS_TZ}') BETWEEN '${from}' AND '${to}' AND status = 'CONFIRMED' ${branchFilter} GROUP BY category ORDER BY revenue DESC`;
    const rows = await fetchWithCache(cacheKey, 600, query);

    const total = rows.reduce((s, r) => s + parseFloat(r.revenue), 0);
    res.json(rows.map(r => ({
      category: r.category,
      revenue: parseFloat(r.revenue),
      orders: parseInt(r.orders),
      pct_of_total: total > 0 ? parseFloat((parseFloat(r.revenue) / total * 100).toFixed(1)) : 0,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/revenue/trend', authMiddleware, async (req, res) => {
  try {
    const { days = 30, branch_id } = req.query;
    const branchFilter = branch_id && branch_id !== 'ALL' ? `AND branch_id = '${branch_id}'` : '';
    const cacheKey = `revTrend:${branch_id || 'ALL'}:${days}`;

    const query = `SELECT toDate(order_date, '${BUSINESS_TZ}') as date, SUM(net_amount) as revenue, COUNT(*) as orders FROM analytics.sale_orders WHERE order_date >= subtractDays(now(), ${days}) AND status = 'CONFIRMED' ${branchFilter} GROUP BY date ORDER BY date`;
    const data = await fetchWithCache(cacheKey, 300, query);
    res.json(data.map(r => ({ date: r.date, revenue: parseFloat(r.revenue), orders: parseInt(r.orders) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RECONCILIATION ───────────────────────────────────────────
app.get('/api/reconciliation/status', authMiddleware, async (req, res) => {
  try {
    const { branch_id, status, date_from, date_to, page = 1, page_size = 20 } = req.query;
    const from = date_from || bizToday(-30);
    const to = date_to || bizToday();
    const branchFilter = branch_id && branch_id !== 'ALL' ? `AND s.branch_id = '${branch_id}'` : '';
    const offset = (parseInt(page) - 1) * parseInt(page_size);

    const items = await queryClickHouse(`
      SELECT
        s.order_id,
        s.branch_id,
        s.branch_name,
        s.product_name,
        s.net_amount as sale_amount,
        s.order_date,
        s.payment_method,
        COALESCE(iv.received_amount, 0) as received_amount,
        s.net_amount - COALESCE(iv.received_amount, 0) as gap,
        multiIf(
          COALESCE(iv.received_amount, 0) = 0, 'PENDING',
          ABS(s.net_amount - COALESCE(iv.received_amount, 0)) < 1000, 'MATCHED',
          'MISMATCH'
        ) as recon_status
      FROM analytics.sale_orders s
      LEFT JOIN (
        SELECT order_id, SUM(amount) as received_amount
        FROM analytics.input_vouchers GROUP BY order_id
      ) iv ON s.order_id = iv.order_id
      WHERE s.status = 'CONFIRMED'
        AND toDate(s.order_date, '${BUSINESS_TZ}') BETWEEN '${from}' AND '${to}'
        ${branchFilter}
        ${status ? `HAVING recon_status = '${status}'` : ''}
      ORDER BY gap DESC
      LIMIT ${page_size} OFFSET ${offset}
    `);

    const summary = await queryClickHouse(`
      SELECT
        countIf(recon_status='MATCHED') as matched,
        countIf(recon_status='PENDING') as pending,
        countIf(recon_status='MISMATCH') as mismatch
      FROM (
        SELECT
          multiIf(
            COALESCE(iv.received_amount, 0) = 0, 'PENDING',
            ABS(s.net_amount - COALESCE(iv.received_amount, 0)) < 1000, 'MATCHED',
            'MISMATCH'
          ) as recon_status
        FROM analytics.sale_orders s
        LEFT JOIN (SELECT order_id, SUM(amount) as received_amount FROM analytics.input_vouchers GROUP BY order_id) iv
        ON s.order_id = iv.order_id
        WHERE s.status = 'CONFIRMED' AND toDate(s.order_date, '${BUSINESS_TZ}') BETWEEN '${from}' AND '${to}' ${branchFilter}
      )
    `);

    res.json({
      summary: { MATCHED: parseInt(summary[0]?.matched || 0), PENDING: parseInt(summary[0]?.pending || 0), MISMATCH: parseInt(summary[0]?.mismatch || 0) },
      items: items.map(r => ({ ...r, sale_amount: parseFloat(r.sale_amount), received_amount: parseFloat(r.received_amount), gap: parseFloat(r.gap) })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DATA LAKE DEMO (1M RECORDS) ──────────────────────────────
const encodeCursor = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64');
const decodeCursor = (cursor) => {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  } catch (e) {
    return null;
  }
};

// Danh sách đơn kèm tên khách — trước đây KHÔNG cần đăng nhập. Người gọi duy nhất
// là trang /data-lake (DataLakeDemo), trang trình diễn nội bộ.
app.get('/api/analytics/orders', authMiddleware, async (req, res) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const parsedLimit = parseInt(limit, 10);
    const decoded = cursor ? decodeCursor(cursor) : null;
    
    // MOCK DATA GENERATION ON-THE-FLY FOR 1M RECORDS TEST
    // We simulate a DB query that returns exactly limit + 1 items based on cursor
    let startIndex = decoded && decoded.index !== undefined ? decoded.index : 0;
    
    // Circuit Breaker / Load Simulation (1-3s delay)
    const delay = Math.floor(Math.random() * 500) + 100;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const TOTAL_RECORDS = 1000000;
    const rows = [];
    
    // Generate exactly parsedLimit + 1 items to determine hasNextPage
    const fetchCount = Math.min(parsedLimit + 1, TOTAL_RECORDS - startIndex);
    
    for (let i = 0; i < fetchCount; i++) {
      const currentIndex = startIndex + i;
      rows.push({
        id: `ORD-${1000000 + currentIndex}`,
        order_date: new Date(Date.now() - currentIndex * 10000).toISOString(),
        customer_name: `Khách hàng ${currentIndex}`,
        total_amount: Math.floor(Math.random() * 4900000) + 100000,
        status: currentIndex % 5 === 0 ? 'PENDING' : 'DELIVERED',
        index: currentIndex // Used for tie-breaker in this mock
      });
    }

    let nextCursor = null;
    let hasNextPage = false;
    
    if (rows.length > parsedLimit) {
      hasNextPage = true;
      rows.pop(); // Remove the extra record
      const lastRecord = rows[rows.length - 1];
      nextCursor = encodeCursor({
        index: lastRecord.index + 1 // Start from next item
      });
    }

    res.json({
      data: rows,
      nextCursor,
      hasNextPage
    });
  } catch (err) {
    res.status(503).json({ error: 'Hệ thống dữ liệu đang quá tải, vui lòng sử dụng cache', isCircuitOpen: true });
  }
});

// ─── ALERTS ───────────────────────────────────────────────────
app.get('/api/alerts/active', authMiddleware, async (req, res) => {
  try {
    // P-06: Column projection — ClickHouse columnar DB, SELECT * đọc thừa I/O
    //
    // Bảng dùng alert_id / rule_name, nhưng client đọc event_id / event_type.
    // Đổi tên bằng AS ở đây thay vì sửa client: cột trong ClickHouse là tên do
    // pipeline đặt, còn event_id/event_type là hợp đồng với giao diện. Trước đó
    // query chọn thẳng event_id nên mọi request trả 500 — và AppLayout gọi
    // /alerts/active trên MỌI trang admin, chỉ là lỗi bị nuốt trong .catch().
    const rows = await queryClickHouse(`
      SELECT alert_id AS event_id, rule_name AS event_type, severity, message, branch_id, triggered_at, acknowledged
      FROM analytics.alert_events
      WHERE acknowledged = 0
      ORDER BY
        CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        triggered_at DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/alerts/history', authMiddleware, async (req, res) => {
  try {
    // P-06: Column projection
    const rows = await queryClickHouse(`
      SELECT alert_id AS event_id, rule_name AS event_type, severity, message, branch_id, triggered_at, acknowledged
      FROM analytics.alert_events
      ORDER BY triggered_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SUPPLY CHAIN / FULFILLMENT ───────────────────────────────
app.get('/api/supply-chain/fulfillment', authMiddleware, async (req, res) => {
  try {
    const { branch_id, date_from, date_to } = req.query;
    const from = date_from || bizToday(-7);
    const to = date_to || bizToday();
    const branchFilter = branch_id && branch_id !== 'ALL' ? `AND s.branch_id = '${branch_id}'` : '';

    const rows = await queryClickHouse(`
      SELECT
        s.order_id,
        s.branch_id,
        s.branch_name,
        s.product_name,
        s.net_amount,
        s.order_date,
        ov.voucher_date as shipped_date,
        dateDiff('hour', s.order_date, COALESCE(ov.voucher_date, now())) as hours_elapsed,
        multiIf(
          ov.voucher_id = '', 'PENDING',
          dateDiff('hour', s.order_date, ov.voucher_date) <= 24, 'ON_TIME',
          'BREACHED'
        ) as sla_status
      FROM analytics.sale_orders s
      LEFT JOIN (
        SELECT order_id, min(voucher_date) as voucher_date, any(voucher_id) as voucher_id
        FROM analytics.output_vouchers WHERE category = 'COGS' GROUP BY order_id
      ) ov ON s.order_id = ov.order_id
      WHERE s.status = 'CONFIRMED'
        AND toDate(s.order_date, '${BUSINESS_TZ}') BETWEEN '${from}' AND '${to}'
        ${branchFilter}
      ORDER BY s.order_date DESC
      LIMIT 100
    `);
    res.json(rows.map(r => ({ ...r, net_amount: parseFloat(r.net_amount), hours_elapsed: parseInt(r.hours_elapsed) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/supply-chain/sla-summary', authMiddleware, async (req, res) => {
  try {
    const { branch_id } = req.query;
    const branchFilter = branch_id && branch_id !== 'ALL' ? `AND s.branch_id = '${branch_id}'` : '';

    const rows = await queryClickHouse(`
      SELECT
        countIf(sla = 'ON_TIME') as on_time,
        countIf(sla = 'BREACHED') as breached,
        countIf(sla = 'PENDING') as pending,
        avgIf(hours_elapsed, sla != 'PENDING') as avg_hours
      FROM (
        SELECT
          dateDiff('hour', s.order_date, ov.voucher_date) as hours_elapsed,
          multiIf(ov.voucher_id = '', 'PENDING', dateDiff('hour', s.order_date, ov.voucher_date) <= 24, 'ON_TIME', 'BREACHED') as sla
        FROM analytics.sale_orders s
        LEFT JOIN (SELECT order_id, min(voucher_date) as voucher_date, any(voucher_id) as voucher_id FROM analytics.output_vouchers WHERE category = 'COGS' GROUP BY order_id) ov ON s.order_id = ov.order_id
        WHERE s.status = 'CONFIRMED' AND s.order_date >= subtractDays(now(), 30) ${branchFilter}
          AND ov.voucher_id != ''
      )
    `);
    const r = rows[0] || {};
    const total = parseInt(r.on_time || 0) + parseInt(r.breached || 0) + parseInt(r.pending || 0);
    res.json({
      on_time_rate: total > 0 ? parseFloat((parseInt(r.on_time || 0) / total * 100).toFixed(1)) : 0,
      breach_count: parseInt(r.breached || 0),
      pending_count: parseInt(r.pending || 0),
      avg_fulfillment_hours: parseFloat(parseFloat(r.avg_hours || 0).toFixed(1)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── FINANCIAL / VOUCHERS ─────────────────────────────────────
app.get('/api/financial/summary', authMiddleware, async (req, res) => {
  try {
    const { branch_id, date_from, date_to } = req.query;
    const from = date_from || bizToday(-30);
    const to = date_to || bizToday();
    const branchFilter = branch_id && branch_id !== 'ALL' ? `AND branch_id = '${branch_id}'` : '';

    const inputs = await queryClickHouse(`SELECT SUM(amount) as val FROM analytics.input_vouchers WHERE toDate(voucher_date, '${BUSINESS_TZ}') BETWEEN '${from}' AND '${to}' ${branchFilter}`);
    const outputs = await queryClickHouse(`SELECT SUM(amount) as val FROM analytics.output_vouchers WHERE toDate(voucher_date, '${BUSINESS_TZ}') BETWEEN '${from}' AND '${to}' ${branchFilter}`);

    const totalIn = parseFloat(inputs[0]?.val || 0);
    const totalOut = parseFloat(outputs[0]?.val || 0);

    res.json({ total_in: totalIn, total_out: totalOut, net_cash: totalIn - totalOut });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/financial/vouchers', authMiddleware, async (req, res) => {
  try {
    const { branch_id, type, date_from, date_to, limit = 50 } = req.query;
    const from = date_from || bizToday(-30);
    const to = date_to || bizToday();
    const branchFilter = branch_id && branch_id !== 'ALL' ? `AND branch_id = '${branch_id}'` : '';

    let rows = [];
    if (!type || type === 'IN') {
      const inV = await queryClickHouse(`
        SELECT voucher_id, order_id, branch_id, amount, voucher_date, 'IN' as type, payment_type as category
        FROM analytics.input_vouchers
        WHERE toDate(voucher_date, '${BUSINESS_TZ}') BETWEEN '${from}' AND '${to}' ${branchFilter}
        ORDER BY voucher_date DESC LIMIT ${limit}
      `);
      rows = rows.concat(inV);
    }
    if (!type || type === 'OUT') {
      const outV = await queryClickHouse(`
        SELECT voucher_id, order_id, branch_id, amount, voucher_date, 'OUT' as type, category
        FROM analytics.output_vouchers
        WHERE toDate(voucher_date, '${BUSINESS_TZ}') BETWEEN '${from}' AND '${to}' ${branchFilter}
        ORDER BY voucher_date DESC LIMIT ${limit}
      `);
      rows = rows.concat(outV);
    }

    rows.sort((a, b) => new Date(b.voucher_date) - new Date(a.voucher_date));
    res.json(rows.slice(0, limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PRODUCTS (Legacy) ────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany();
    res.json(products.map(p => ({ ...p, id: Number(p.id) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── HEALTH CHECK ─────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const chPing = await ch.ping();
    res.json({ status: 'ok', clickhouse: chPing.success ? 'connected' : 'error', timestamp: new Date() });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

// ─── WEBSOCKET — Real-time updates ────────────────────────────
const wsClients = new Set();
wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
});

function broadcastStockUpdate() {
  const payload = JSON.stringify({ type: 'STOCK_UPDATE', timestamp: new Date().toISOString() });
  wsClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  });
}
app.locals.broadcastStockUpdate = broadcastStockUpdate;

// P-04: Shared KPI cache — 1 query duy nhất mỗi 5s, broadcast cho TẤT CẢ clients
// Tránh N×query khi có N admin dashboard mở đồng thời
let _wsKpiCache = null;
let _wsKpiLastFetch = 0;
const WS_KPI_TTL_MS = 5000;

async function fetchAndBroadcastKpi() {
  if (wsClients.size === 0) return;
  try {
    const now = Date.now();
    // Chỉ query khi cache hết hạn
    if (!_wsKpiCache || now - _wsKpiLastFetch >= WS_KPI_TTL_MS) {
      const today = bizToday();
      const rows = await queryClickHouse(
        `SELECT SUM(net_amount) as revenue, COUNT(*) as orders
         FROM analytics.sale_orders
         WHERE toDate(order_date, '${BUSINESS_TZ}') = '${today}' AND status = 'CONFIRMED'`
      );
      _wsKpiCache = {
        type: 'KPI_UPDATE',
        data: {
          revenue_today: parseFloat(rows[0]?.revenue || 0),
          orders_today:  parseInt(rows[0]?.orders  || 0),
          timestamp:     new Date().toISOString(),
        },
      };
      _wsKpiLastFetch = now;
    }
    // Broadcast cache đến tất cả clients — không query thêm
    const payload = JSON.stringify(_wsKpiCache);
    wsClients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(payload); });
  } catch {
    // ClickHouse not ready yet, skip
  }
}

setInterval(fetchAndBroadcastKpi, 5000);

// ─── SIMULATE MANUAL DATA ENTRY ────────────────────────────────
app.post('/api/admin/simulate-sale', authMiddleware, async (req, res) => {
  try {
    const { branch_name, category, amount, date } = req.body;
    if (!branch_name || !category || amount === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const branch_id = 'BR_' + Math.floor(Math.random() * 10000);
    const order_id = 'ORD' + Date.now();
    // use targetDate formatted for ClickHouse DateTime64 (YYYY-MM-DD HH:mm:ss)
    const targetDate = date ? new Date(date).toISOString().replace('T', ' ').substring(0, 19) : new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    await ch.insert({
      table: 'analytics.sale_orders',
      values: [{
        order_id,
        branch_id,
        branch_name,
        region: 'VN',
        salesperson_id: 'MANUAL',
        customer_id: 'MANUAL',
        product_id: 'P_MANUAL',
        product_name: 'Simulated Data',
        product_category: category,
        quantity: 1,
        unit_price: Number(amount),
        total_amount: Number(amount),
        discount: 0,
        net_amount: Number(amount),
        status: 'CONFIRMED',
        payment_method: 'BANK',
        order_date: targetDate
      }],
      format: 'JSONEachRow'
    });

    await ch.insert({
      table: 'analytics.input_vouchers',
      values: [{
        voucher_id: 'VOU' + Date.now(),
        order_id,
        branch_id,
        amount: Number(amount),
        voucher_date: targetDate,
        payment_type: 'BANK',
        note: 'Auto reconciled'
      }],
      format: 'JSONEachRow'
    });
    
    await invalidateAnalyticsCache(); // C-04: chỉ xóa analytics keys, không xóa session/auth cache
    res.json({ success: true, order_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── B2C STOREFRONT ROUTES ──────────────────────────────────────
/**
 * Tạo đơn hàng B2C.
 *
 * Thay cho phiên bản cũ (xem scratchpad/old-checkout.js.bak). Bốn thay đổi:
 *
 *   1. CÓ XÁC THỰC. Trước đây endpoint này không có middleware nào — việc kiểm
 *      tra đăng nhập nằm ở client, ai cũng curl thẳng vào tạo đơn được.
 *      customer_id giờ lấy từ token, không từ body.
 *
 *   2. SERVER TỰ TÍNH TIỀN. Trước đây total/subTotal/discount/shippingFee lấy
 *      thẳng từ req.body, và fallback items.reduce() cũng dùng item.price do
 *      client gửi. Khi gắn thanh toán, lỗ hổng đó thành: QR sinh theo số tiền
 *      client tự khai.
 *
 *   3. GIỮ CHỖ TỒN KHO ATOMIC thay cho vòng lặp check-then-act.
 *
 *   4. KHÔNG GHI CLICKHOUSE trong request path. ClickHouse không chịu được
 *      insert nhỏ tần suất cao (mỗi insert tạo một data part; merge không kịp
 *      là lỗi TOO_MANY_PARTS), và analytics không được đứng chắn đường giao
 *      dịch. Dữ liệu sang ClickHouse qua CDC Debezium đọc WAL.
 */
app.post('/api/b2c/checkout', authB2C, async (req, res) => {
  try {
    const { items, customer_info, payment_method, voucher, pointsUsed } = req.body;

    // Kiểm tra TRƯỚC khi tạo đơn / giữ kho: trước 11/11/2026 customer_info được lưu
    // nguyên vào Order.customer, "0163789557vhvbj" vẫn đặt được. Xem utils/validators.js.
    const checked = validateCustomerInfo(customer_info);
    if (!checked.ok) {
      return res.status(400).json({ error: checked.errors[0], errors: checked.errors, code: 'INVALID_CUSTOMER_INFO' });
    }

    const result = await checkoutService.createOrder(prisma, {
      items,
      customerInfo: checked.value,
      paymentMethod: payment_method,
      customerId: req.b2cUser.id,        // TỪ TOKEN, không từ body
      voucherCode: voucher || null,
      pointsToUse: Number(pointsUsed || 0),
      claimed: {
        subTotal: req.body.subTotal,
        shippingFee: req.body.shippingFee,
        discount: req.body.discount,
        total: req.body.total,
      },
    });

    // Báo client cập nhật tồn kho hiển thị
    wsClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'STOCK_UPDATE', timestamp: new Date().toISOString() }));
      }
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    // Lỗi nghiệp vụ (hết hàng, voucher sai, thiếu tỉnh thành) trả 400 kèm mã
    // để client hiển thị đúng thông báo, thay vì 500 chung chung.
    if (err.code === 'OUT_OF_STOCK' || err.name === 'PricingError') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    console.error('Checkout Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PAYMENT ─────────────────────────────────────────────────────────────
const checkoutService      = require('./services/payment/checkoutService');
const expireScheduler      = require('./services/payment/expireScheduler');
const { checkPaymentConfig } = require('./services/payment/configCheck');
const paymentRouter        = require('./routes/payment');
app.use('/api', paymentRouter);

// ─── AI SERVICES (tách thành container riêng: ai-bot) ────────────────────────
// Dùng direct fetch thay vì http-proxy-middleware để tránh các vấn đề
// về path stripping và response piping của http-proxy-middleware v3.
//
// Mỗi endpoint gọi thẳng ai-bot và pipe JSON response về client.
const AI_BOT_URL = process.env.AI_BOT_URL || 'http://localhost:3001';
const AI_BOT_TIMEOUT_MS = 30_000; // 30s hard cap

async function forwardToAiBot(req, res, botPath) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_BOT_TIMEOUT_MS);

    const botRes = await fetch(`${AI_BOT_URL}${botPath}`, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await botRes.json();
    res.status(botRes.status).json(data);
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    console.error(`[AI Forward] ${botPath} ${isTimeout ? 'timeout' : err.message}`);
    if (!res.headersSent) {
      res.status(isTimeout ? 504 : 502).json({
        error: isTimeout ? 'AI timeout' : 'AI Bot service unavailable',
        text: isTimeout
          ? 'Dạ AI đang hơi chậm, anh/chị thử lại sau vài giây nhé! Hoặc tìm trực tiếp trên Shop 🛍️'
          : 'Dạ hệ thống AI đang bảo trì, anh/chị vui lòng thử lại sau ít phút nhé ạ!',
        link: '/shop',
        products: [],
      });
    }
  }
}

// Các path AI gọi LLM tính tiền theo lượt (OpenRouter / Gemini / HuggingFace) qua
// ai-bot. Hạn mức riêng THEO IP (xem trust proxy ở đầu file), chặt hơn limiter chung
// 2000/phút: không có nó, một người spam là đốt ngân sách LLM của cả hệ thống.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_PER_MIN) || 20,
  message: { error: 'Bạn dùng tính năng AI quá nhanh, vui lòng thử lại sau ít phút.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(['/api/b2c/chat', '/api/b2c/visual-search', '/api/ai'], aiLimiter);

// Forward các path AI sang container ai-bot
app.post('/api/b2c/chat',             (req, res) => forwardToAiBot(req, res, '/api/b2c/chat'));
app.post('/api/ai/smart-search',       (req, res) => forwardToAiBot(req, res, '/api/ai/smart-search'));
app.post('/api/b2c/visual-search',     (req, res) => forwardToAiBot(req, res, '/api/b2c/visual-search'));
app.post('/api/ai/smart-search-image', (req, res) => forwardToAiBot(req, res, '/api/ai/smart-search-image'));
// Giọng nói → chữ (voice input). Âm thanh base64 tối đa ~60 KB nên nằm gọn trong
// giới hạn mặc định của express.json(); client ghi tối đa 15 giây.
app.post('/api/ai/transcribe',         (req, res) => forwardToAiBot(req, res, '/api/ai/transcribe'));

// Recommendation vẫn ở server (gọi ai-rec container qua HTTP trong RecommendationService)
const recommendationRouter = require('./routes/recommendation');
app.use('/api', recommendationRouter);


const b2cRouter = require('./routes/b2c');
app.use('/api/b2c', b2cRouter);

// Onboarding — thu sở thích tường minh cho AI-Rec (cold-start phía khách)
const onboardingRouter = require('./routes/onboarding');
app.use('/api/b2c', onboardingRouter);

// ─── B2C Behavior Tracking (Implicit Feedback cho AI Recommendation) ──
const trackingRouter = require('./routes/tracking');
app.use('/api/b2c', trackingRouter);

// ─── B2B ADMIN ROUTES ─────────────────────────────────────────
// Một cổng chặn cho MỌI /api/b2b/* (b2b, aiAdmin, behavior-analytics bên dưới).
// Trước 11/11/2026 ba router này không có middleware nào: không cần token vẫn đọc
// được danh sách khách (họ tên, email, SĐT) và sửa / xoá catalog. Cửa hàng không
// gọi /api/b2b nữa — danh sách chi nhánh đã chuyển sang GET /api/b2c/branches.
// /api/b2b/payments/* và /api/b2b/orders/:id/delivered nằm ở payment.js (mount
// sớm hơn ở '/api') và đã có requireAdmin riêng.
app.use('/api/b2b', requireAdmin);
const b2bRouter = require('./routes/b2b');
app.use('/api/b2b', b2bRouter);

// ─── AI ADMIN ROUTES (MLOps — ChatLog quản lý & trigger train) ──
const aiAdminRouter = require('./routes/aiAdmin');
app.use('/api/b2b', aiAdminRouter);

// ─── B2B BEHAVIOR ANALYTICS (Admin Dashboard) ──────────────────
const behaviorAnalyticsRouter = require('./routes/behavior-analytics');
app.use('/api/b2b/analytics/behavior', behaviorAnalyticsRouter);

// ─── START ────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  // Lỗi cấu hình thanh toán không tự báo ra — chỉ lộ khi có tiền thật chạy qua.
  checkPaymentConfig();

  // Job đóng đơn quá hạn — không chạy thì kho giữ chỗ mãi không nhả.
  expireScheduler.start(prisma);
  console.log(`🚀 iStore Analytics Server on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server ready`);
});
