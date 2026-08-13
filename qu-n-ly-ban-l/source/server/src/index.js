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
const { redis } = require('./redis');

// ─── GLOBAL ERROR HANDLERS (prevent nodemon/process crash from unhandled rejections) ───
process.on('unhandledRejection', (reason) => {
  console.error('🔥 [UnhandledRejection] Server caught unhandled promise rejection — keeping alive:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('🔥 [UncaughtException] Server caught uncaught exception — keeping alive:', err.message);
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'istore_secret';

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ─── RATE LIMITING ────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 2000,     // Increased so CI/automated tests (495+ req) don't get rate-limited
  message: { error: 'Quá nhiều request, vui lòng thử lại sau.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ─── CLICKHOUSE CLIENT ──────────────────────────────────────────
const ch = createClient({
  url: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  database: 'analytics',
});

// ─── CIRCUIT BREAKER ────────────────────────────────────────────
const clickhouseOptions = {
  timeout: 5000,
  errorThresholdPercentage: 50,
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
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  const data = await chBreaker.fire(queryStr);
  await redis.setEx(cacheKey, ttl, JSON.stringify(data));
  return data;
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
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
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const branchFilter = branch_id && branch_id !== 'ALL' ? `AND branch_id = '${branch_id}'` : '';
    const cacheKey = `kpi:${branch_id || 'ALL'}:${targetDate}`;

    const cached = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const [revToday, revYest, orders, cash, pending, voidOrders, allOrders] = await Promise.all([
      chBreaker.fire(`SELECT SUM(net_amount) as val FROM analytics.sale_orders WHERE toDate(order_date) = '${targetDate}' AND status = 'CONFIRMED' ${branchFilter}`),
      chBreaker.fire(`SELECT SUM(net_amount) as val FROM analytics.sale_orders WHERE toDate(order_date) = subtractDays(toDate('${targetDate}'), 1) AND status = 'CONFIRMED' ${branchFilter}`),
      chBreaker.fire(`SELECT COUNT(*) as val FROM analytics.sale_orders WHERE toDate(order_date) = '${targetDate}' AND status = 'CONFIRMED' ${branchFilter}`),
      chBreaker.fire(`SELECT SUM(amount) as val FROM analytics.input_vouchers WHERE toDate(voucher_date) = '${targetDate}' ${branchFilter}`),
      chBreaker.fire(`SELECT COUNT(*) as val FROM analytics.sale_orders WHERE status = 'CONFIRMED' ${branchFilter} AND order_id NOT IN (SELECT order_id FROM analytics.input_vouchers)`),
      chBreaker.fire(`SELECT COUNT(*) as val FROM analytics.sale_orders WHERE toDate(order_date) = '${targetDate}' AND status = 'VOIDED' ${branchFilter}`),
      chBreaker.fire(`SELECT COUNT(*) as val FROM analytics.sale_orders WHERE toDate(order_date) = '${targetDate}' ${branchFilter}`)
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

    await redis.setEx(cacheKey, 30, JSON.stringify(result));
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
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const branchFilter = branch_id && branch_id !== 'ALL' ? `AND branch_id = '${branch_id}'` : '';
    const cacheKey = `revHour:${branch_id || 'ALL'}:${targetDate}`;

    const query = `SELECT toHour(order_date) as hour, SUM(net_amount) as revenue, COUNT(*) as orders FROM analytics.sale_orders WHERE toDate(order_date) = '${targetDate}' AND status = 'CONFIRMED' ${branchFilter} GROUP BY hour ORDER BY hour`;
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
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = date_to || new Date().toISOString().slice(0, 10);
    const cacheKey = `revBranch:${from}:${to}`;

    const query = `SELECT branch_id, branch_name, region, SUM(net_amount) as revenue, COUNT(*) as orders, countIf(status='VOIDED') * 100.0 / count() as void_rate FROM analytics.sale_orders WHERE toDate(order_date) BETWEEN '${from}' AND '${to}' AND status = 'CONFIRMED' GROUP BY branch_id, branch_name, region ORDER BY revenue DESC`;
    const rows = await fetchWithCache(cacheKey, 600, query);

    res.json(rows.map((r, i) => ({ ...r, rank: i + 1, revenue: parseFloat(r.revenue), orders: parseInt(r.orders), void_rate: parseFloat(parseFloat(r.void_rate).toFixed(1)) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/revenue/by-category', authMiddleware, async (req, res) => {
  try {
    const { date_from, date_to, branch_id } = req.query;
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = date_to || new Date().toISOString().slice(0, 10);
    const branchFilter = branch_id && branch_id !== 'ALL' ? `AND branch_id = '${branch_id}'` : '';
    const cacheKey = `revCat:${branch_id || 'ALL'}:${from}:${to}`;

    const query = `SELECT product_category as category, SUM(net_amount) as revenue, COUNT(*) as orders FROM analytics.sale_orders WHERE toDate(order_date) BETWEEN '${from}' AND '${to}' AND status = 'CONFIRMED' ${branchFilter} GROUP BY category ORDER BY revenue DESC`;
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

    const query = `SELECT toDate(order_date) as date, SUM(net_amount) as revenue, COUNT(*) as orders FROM analytics.sale_orders WHERE order_date >= subtractDays(now(), ${days}) AND status = 'CONFIRMED' ${branchFilter} GROUP BY date ORDER BY date`;
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
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = date_to || new Date().toISOString().slice(0, 10);
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
        AND toDate(s.order_date) BETWEEN '${from}' AND '${to}'
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
        WHERE s.status = 'CONFIRMED' AND toDate(s.order_date) BETWEEN '${from}' AND '${to}' ${branchFilter}
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

app.get('/api/analytics/orders', async (req, res) => {
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
    const rows = await queryClickHouse(`
      SELECT * FROM analytics.alert_events
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
    const rows = await queryClickHouse(`
      SELECT * FROM analytics.alert_events
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
    const from = date_from || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const to = date_to || new Date().toISOString().slice(0, 10);
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
        AND toDate(s.order_date) BETWEEN '${from}' AND '${to}'
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
        avg(hours_elapsed) as avg_hours
      FROM (
        SELECT
          dateDiff('hour', s.order_date, COALESCE(ov.voucher_date, now())) as hours_elapsed,
          multiIf(ov.voucher_id = '', 'PENDING', dateDiff('hour', s.order_date, ov.voucher_date) <= 24, 'ON_TIME', 'BREACHED') as sla
        FROM analytics.sale_orders s
        LEFT JOIN (SELECT order_id, min(voucher_date) as voucher_date, any(voucher_id) as voucher_id FROM analytics.output_vouchers WHERE category = 'COGS' GROUP BY order_id) ov ON s.order_id = ov.order_id
        WHERE s.status = 'CONFIRMED' AND s.order_date >= subtractDays(now(), 30) ${branchFilter}
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
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = date_to || new Date().toISOString().slice(0, 10);
    const branchFilter = branch_id && branch_id !== 'ALL' ? `AND branch_id = '${branch_id}'` : '';

    const inputs = await queryClickHouse(`SELECT SUM(amount) as val FROM analytics.input_vouchers WHERE toDate(voucher_date) BETWEEN '${from}' AND '${to}' ${branchFilter}`);
    const outputs = await queryClickHouse(`SELECT SUM(amount) as val FROM analytics.output_vouchers WHERE toDate(voucher_date) BETWEEN '${from}' AND '${to}' ${branchFilter}`);

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
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = date_to || new Date().toISOString().slice(0, 10);
    const branchFilter = branch_id && branch_id !== 'ALL' ? `AND branch_id = '${branch_id}'` : '';

    let rows = [];
    if (!type || type === 'IN') {
      const inV = await queryClickHouse(`
        SELECT voucher_id, order_id, branch_id, amount, voucher_date, 'IN' as type, payment_type as category
        FROM analytics.input_vouchers
        WHERE toDate(voucher_date) BETWEEN '${from}' AND '${to}' ${branchFilter}
        ORDER BY voucher_date DESC LIMIT ${limit}
      `);
      rows = rows.concat(inV);
    }
    if (!type || type === 'OUT') {
      const outV = await queryClickHouse(`
        SELECT voucher_id, order_id, branch_id, amount, voucher_date, 'OUT' as type, category
        FROM analytics.output_vouchers
        WHERE toDate(voucher_date) BETWEEN '${from}' AND '${to}' ${branchFilter}
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

// Broadcast latest KPI every 5 seconds
setInterval(async () => {
  if (wsClients.size === 0) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await queryClickHouse(`
      SELECT SUM(net_amount) as revenue, COUNT(*) as orders
      FROM analytics.sale_orders
      WHERE toDate(order_date) = '${today}' AND status = 'CONFIRMED'
    `);
    const payload = JSON.stringify({
      type: 'KPI_UPDATE',
      data: {
        revenue_today: parseFloat(rows[0]?.revenue || 0),
        orders_today: parseInt(rows[0]?.orders || 0),
        timestamp: new Date().toISOString(),
      },
    });
    wsClients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(payload); });
  } catch {
    // ClickHouse not ready yet, skip
  }
}, 5000);

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
    
    await redis.flushAll(); // clear cache
    res.json({ success: true, order_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── B2C STOREFRONT ROUTES ──────────────────────────────────────
app.post('/api/b2c/checkout', async (req, res) => {
  try {
    const { items, customer_info, payment_method, discount, shippingFee, subTotal, total } = req.body;
    
    const orderId = 'ORD-' + Date.now();
    const orderDate = new Date();
    const chDate = orderDate.toISOString().replace('T', ' ').substring(0, 19);
    
    // Create order record in PostgreSQL for B2C history
    await prisma.order.create({
      data: {
        id: orderId,
        customer: customer_info,
        items: items,
        total: total || items.reduce((acc, item) => acc + (item.price * item.quantity), 0),
        discount: discount || 0,
        shippingFee: shippingFee || 0,
        subTotal: subTotal || 0,
        status: 'CONFIRMED',
        date: orderDate
      }
    });

    // Sync order to ClickHouse for B2B Analytics and Fulfillment
    const chValues = [];
    const chVouchers = [];
    
    const branchIds = [...new Set(items.flatMap(i => i.branch_ids || []))];
    const branches = branchIds.length > 0 ? await prisma.branch.findMany({ where: { id: { in: branchIds } } }) : [];
    
    for (const item of items) {
      // Find branch_id or assign default
      let branch_id = 'BR_1'; // Default
      let branch_name = 'Chi nhánh 1';
      if (item.branch_ids && item.branch_ids.length > 0) {
        branch_id = item.branch_ids[0];
        const br = branches.find(b => b.id === branch_id);
        if (br) branch_name = br.name;
      }
      
      const itemTotal = item.price * item.quantity;
      const proportion = itemTotal / (subTotal || itemTotal || 1);
      const itemDiscount = (discount || 0) * proportion;
      const itemNet = itemTotal - itemDiscount;

      chValues.push({
        order_id: orderId,
        branch_id: branch_id,
        branch_name: branch_name,
        region: customer_info.province || 'VN',
        salesperson_id: 'ONLINE',
        customer_id: customer_info.email || customer_info.phone || 'GUEST',
        product_id: item.id.toString(),
        product_name: item.name,
        product_category: item.category_id || 'OTHER',
        quantity: Number(item.quantity),
        unit_price: Number(item.price),
        total_amount: Number(itemTotal),
        discount: Number(itemDiscount),
        net_amount: Number(itemNet),
        status: 'CONFIRMED',
        payment_method: payment_method || 'COD',
        order_date: chDate
      });

      // --- Deduct Realtime Inventory ---
      try {
        const product = await prisma.product.findUnique({ where: { id: BigInt(item.id) } });
        if (product) {
          let updatedVariants = product.variants;
          let stockToDeduct = Number(item.quantity);
          if (item.selectedVariant) {
            if (Array.isArray(updatedVariants)) {
              updatedVariants = updatedVariants.map(v => {
                if (v.id === item.selectedVariant.id) {
                  return { ...v, stock: Math.max(0, (v.stock || 0) - stockToDeduct) };
                }
                return v;
              });
            }
          }
          await prisma.product.update({
            where: { id: BigInt(item.id) },
            data: {
              stock: Math.max(0, product.stock - stockToDeduct),
              variants: updatedVariants,
              sold: { increment: stockToDeduct }
            }
          });
        }
      } catch (err) {
        console.error('Failed to deduct inventory:', err);
      }
    }

    if (chValues.length > 0) {
      await ch.insert({
        table: 'analytics.sale_orders',
        values: chValues,
        format: 'JSONEachRow'
      });
      
      // If paid by bank/VNPAY, auto generate input voucher
      if (payment_method && payment_method !== 'COD') {
        // Group by branch
        const branchTotals = {};
        for (const val of chValues) {
          branchTotals[val.branch_id] = (branchTotals[val.branch_id] || 0) + val.net_amount;
        }
        
        for (const [brId, amt] of Object.entries(branchTotals)) {
          chVouchers.push({
            voucher_id: 'VOU' + Date.now() + Math.floor(Math.random()*1000),
            order_id: orderId,
            branch_id: brId,
            amount: Number(amt),
            voucher_date: chDate,
            payment_type: payment_method,
            note: 'Auto reconciled from Online Payment'
          });
        }
        
        if (chVouchers.length > 0) {
          await ch.insert({
            table: 'analytics.input_vouchers',
            values: chVouchers,
            format: 'JSONEachRow'
          });
        }
      }
      
      await redis.flushAll(); // Clear analytics cache
    }

    // Broadcast STOCK_UPDATE via WebSocket
    wsClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'STOCK_UPDATE', timestamp: new Date().toISOString() }));
      }
    });

    res.json({ success: true, order_id: orderId });
  } catch (err) {
    console.error("Checkout Error:", err);
    res.status(500).json({ error: err.message });
  }
});

const b2cRouter = require('./routes/b2c');
app.use('/api/b2c', b2cRouter);

// ─── B2B ADMIN ROUTES ─────────────────────────────────────────
const b2bRouter = require('./routes/b2b');
app.use('/api/b2b', b2bRouter);

// ─── AI ROUTES ────────────────────────────────────────────────
const aiRouter = require('./routes/ai');
app.use('/api', aiRouter);

// ─── START ────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 iStore Analytics Server on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server ready`);
});
