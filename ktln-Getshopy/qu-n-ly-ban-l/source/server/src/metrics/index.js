'use strict';
/**
 * Số đo Prometheus cho server — 19/11/2026, giám sát cân bằng tải (docs/monitoring.md).
 *
 * Vì sao: demo cân bằng tải (scripts/lb-demo.ps1) chỉ đếm X-Served-By trong một lượt k6. Muốn
 * THẤY gateway chia tải theo thời gian thực (request/s, độ trễ, lỗi, CPU/RAM của TỪNG bản) thì
 * mỗi bản tự xuất số đo, Prometheus kéo về (pull) từ mọi bản, Grafana vẽ.
 *
 * Thiết kế:
 *   - Cổng RIÊNG (METRICS_PORT, mặc định 9464) bằng http.createServer, KHÔNG gắn vào app Express:
 *     gateway chỉ chuyển tới server:8080, nên /metrics không bao giờ đi được qua gateway hay
 *     Tailscale Funnel. Compose chỉ `expose` cổng này trong network (không publish ra máy).
 *   - http_requests_total{method, route, status_code} + http_request_duration_seconds{...}:
 *     `route` là MẪU route của Express ('/api/b2c/products/:id'), không phải URL thật — số chuỗi
 *     nhãn (cardinality) bị chặn bởi số route trong code, không phụ thuộc id / query / dữ liệu
 *     người dùng. Không khớp route nào (404, hoặc middleware trả lời trước: 429 rate limit,
 *     preflight CORS) -> 'unmatched'.
 *   - Số đo mặc định của Node (collectDefaultMetrics): CPU, RSS/heap, độ trễ event loop, GC.
 *   - getshopy_server_info{hostname} = 1: hostname = POD_NAME || os.hostname() — CÙNG tên với
 *     header X-Served-By (middleware/servedBy.js), tức id ngắn của container. Prometheus tự gắn
 *     nhãn instance (ip:cổng); dashboard nối hai thứ để hiện cùng tên như demo cân bằng tải.
 *
 * MẶC ĐỊNH TẮT trong code: chỉ bật khi METRICS_ENABLED=1 (đúng chuỗi "1", như SERVED_BY_HEADER).
 * docker-compose.yml đặt METRICS_ENABLED=${METRICS_ENABLED:-1}. Chạy tay (npm run dev) hoặc demo
 * Kubernetes không đặt biến thì không mở thêm cổng nào.
 *
 * Thư viện: prom-client 15 (https://github.com/siimon/prom-client). npm đánh dấu gói này
 * "replaced by @prometheus-io/client", nhưng gói kế nhiệm (0.16.x) đòi Node >= 22 trong khi image
 * server chạy Node 20 — đổi khi nâng Node.
 */
const http = require('http');
const os = require('os');

const DEFAULT_PORT = 9464;
// Giây. Dày quanh 0,1–1 s — khoảng độ trễ của API khi tải tăng (ngưỡng p95 mặc định của
// k6-lb.js là 1 s). histogram_quantile nội suy tuyến tính TRONG một bucket, nên p95/p99 chỉ
// chính xác tới độ rộng bucket chứa nó (https://prometheus.io/docs/practices/histograms/).
// 30 s cho request AI dài (gateway chờ tối đa 120 s).
const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10, 30];
// Lưới an toàn cho cardinality: route trong code ~100 mẫu. Vượt mức này (ví dụ sau này ai đó
// mount router ở đường dẫn có tham số, khiến baseUrl mang giá trị thật) thì gộp vào 'other'.
const MAX_ROUTE_LABELS = 300;

function patternToString(p) {
  if (typeof p === 'string') return p;
  if (Array.isArray(p)) return p.map(patternToString).join('|');
  return String(p); // RegExp
}

/**
 * Ghép tiền tố mount (req.baseUrl tại lúc khớp route — router mount bằng chuỗi cố định,
 * vd. '/api/b2c') với mẫu của route ('/products/:id').
 */
function joinRoute(baseUrl, routePath) {
  const base = baseUrl || '';
  const p = patternToString(routePath);
  if (!base) return p || '/';
  if (p === '/' || p === '') return base;
  return base + p;
}

/** Nhãn route của một request đã xong. Ưu tiên giá trị bắt được lúc router khớp route. */
function routeLabel(req) {
  if (req._metricsRoute) return req._metricsRoute;
  if (req.route && req.route.path != null) return joinRoute(req.baseUrl, req.route.path);
  return 'unmatched';
}

/**
 * Router của Express 5 gán `req.route = route` đúng lúc khớp route, khi req.baseUrl còn là tiền
 * tố của router đó. Lúc response xong thì baseUrl có thể đã bị trả về '' (lỗi ném ra từ handler
 * async -> next(err) -> rời router con) -> chặn phép gán để ghi lại mẫu đầy đủ ngay lúc khớp.
 */
function captureRoute(req) {
  let route = req.route;
  try {
    Object.defineProperty(req, 'route', {
      configurable: true,
      enumerable: true,
      get() { return route; },
      set(v) {
        route = v;
        if (v && v.path != null) req._metricsRoute = joinRoute(req.baseUrl, v.path);
      },
    });
  } catch { /* không định nghĩa được thì routeLabel() đọc req.route lúc xong */ }
}

function parsePort(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 65535 && String(value).trim() !== '' ? n : fallback;
}

/**
 * @returns {null | {register, middleware, start, stop, port, hostname}}
 *   null khi tắt — bên gọi không gắn middleware, không mở cổng.
 */
function createMetrics({
  env = process.env,
  hostname = os.hostname,
  logger = console,
  client = require('prom-client'),
  maxRouteLabels = MAX_ROUTE_LABELS,
} = {}) {
  if (env.METRICS_ENABLED !== '1') return null;

  const port = parsePort(env.METRICS_PORT, DEFAULT_PORT);
  const name = env.POD_NAME || hostname();
  // Registry riêng (không dùng registry toàn cục): kiểm thử tạo được nhiều bản độc lập.
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });

  const info = new client.Gauge({
    name: 'getshopy_server_info',
    help: 'Luôn bằng 1. Nhãn hostname = tên bản server (trùng header X-Served-By).',
    labelNames: ['hostname'],
    registers: [register],
  });
  info.set({ hostname: name }, 1);

  const labelNames = ['method', 'route', 'status_code'];
  const requests = new client.Counter({
    name: 'http_requests_total',
    help: 'Số request HTTP đã trả lời, theo phương thức, mẫu route Express và mã trạng thái.',
    labelNames,
    registers: [register],
  });
  const duration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Thời gian từ lúc request vào server tới lúc gửi xong response (giây).',
    labelNames,
    buckets: DURATION_BUCKETS,
    registers: [register],
  });

  const seenRoutes = new Set();
  function boundedRoute(route) {
    if (seenRoutes.has(route)) return route;
    if (seenRoutes.size >= maxRouteLabels) return 'other';
    seenRoutes.add(route);
    return route;
  }

  /** Gắn ĐẦU TIÊN trong app Express: đo cả request bị middleware chặn (429, 503...). */
  function middleware(req, res, next) {
    const end = duration.startTimer();
    captureRoute(req);
    res.once('finish', () => {
      const labels = {
        method: req.method,
        route: boundedRoute(routeLabel(req)),
        status_code: String(res.statusCode),
      };
      end(labels);
      requests.inc(labels);
    });
    next();
  }

  async function handle(req, res) {
    const path = (req.url || '').split('?')[0];
    if (path !== '/metrics' || (req.method !== 'GET' && req.method !== 'HEAD')) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found\n');
      return;
    }
    try {
      const body = await register.metrics();
      res.writeHead(200, { 'Content-Type': register.contentType });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (err) {
      logger.error('[metrics] không tạo được số đo:', err.message);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('metrics error\n');
    }
  }

  let server = null;

  /** Mở cổng số đo. Lỗi (cổng bận...) chỉ ghi log — server chính vẫn chạy bình thường. */
  function start({ host = '0.0.0.0', port: listenPort = port } = {}) {
    if (server) return Promise.resolve(server.address());
    const s = http.createServer((req, res) => { handle(req, res); });
    server = s;
    return new Promise((resolve) => {
      let listening = false;
      s.on('error', (err) => {
        logger.error(`[metrics] cổng ${listenPort}:`, err.message);
        if (!listening) {
          if (server === s) server = null;
          resolve(null);
        }
      });
      s.listen(listenPort, host, () => {
        listening = true;
        const addr = s.address();
        logger.log(`📈 Metrics (Prometheus) on http://${host}:${addr.port}/metrics — bản ${name}`);
        resolve(addr);
      });
    });
  }

  /** Đóng cổng số đo (tắt êm). Cắt cả kết nối keep-alive của Prometheus để không phải chờ. */
  function stop() {
    if (!server) return Promise.resolve();
    const s = server;
    server = null;
    return new Promise((resolve) => {
      s.close(() => resolve());
      if (typeof s.closeAllConnections === 'function') s.closeAllConnections();
    });
  }

  return { register, middleware, start, stop, port, hostname: name };
}

module.exports = { createMetrics, routeLabel, joinRoute, DURATION_BUCKETS, DEFAULT_PORT };
