'use strict';
/**
 * Log mỗi request HTTP — 19/11/2026, log tập trung (docs/monitoring.md, mục "Log tập trung").
 *
 * LOG_FORMAT=json (docker-compose.yml đặt mặc định): MỖI request đúng MỘT dòng JSON trên stdout.
 * Grafana Alloy đọc stdout của container, giữ đúng các dòng có "type":"request", đẩy về Loki.
 * Không đặt / giá trị khác: morgan('dev') như trước (chạy tay, npm run dev).
 *
 * Một dòng: {"ts","type":"request","method","route","status","ms","bytes","hostname"}
 *   route     MẪU route Express (cùng logic với nhãn route của số đo, src/metrics) — không có id,
 *             query. Không khớp route nào -> "unmatched" kèm "path" = đường dẫn KHÔNG query string.
 *   hostname  POD_NAME || os.hostname() = header X-Served-By = id container.
 *   probe     "docker" (healthcheck của Docker: /api/health từ chính container) hoặc "blackbox"
 *             (blackbox exporter của Prometheus) — lọc được: `| json | probe=""` là bỏ probe.
 *   aborted   true khi client đóng kết nối trước khi response gửi xong.
 *
 * KHÔNG BAO GIỜ ghi query string, header, body, cookie hay token. User-Agent chỉ được ĐỌC để phân
 * loại probe, không ghi ra.
 *
 * Không phụ thuộc gì ngoài src/metrics (env, hostname, write truyền vào được) để kiểm thử bằng node --test.
 */
const os = require('os');
const { captureRoute, routeLabel } = require('../metrics');

const MAX_PATH = 200;
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Đường dẫn gốc của request, bỏ query string, cắt ngắn (request rác có thể dài tuỳ ý). */
function pathOnly(req) {
  return String(req.originalUrl || req.url || '').split('?')[0].slice(0, MAX_PATH);
}

function probeKind(req, route) {
  const ua = String((req.headers && req.headers['user-agent']) || '');
  // blackbox exporter gửi "Blackbox-Exporter/<phiên bản>" (đo 19/11/2026 với 0.29.1).
  if (/^Blackbox[- ]Exporter[/]/i.test(ua)) return 'blackbox';
  const ip = req.socket && req.socket.remoteAddress;
  if (route === '/api/health' && LOOPBACK.has(ip)) return 'docker';
  return undefined;
}

/**
 * @returns middleware Express: dòng JSON khi env.LOG_FORMAT === 'json', không thì morgan('dev').
 */
function createRequestLogger({
  env = process.env,
  hostname = os.hostname,
  write = (line) => process.stdout.write(line),
  morgan = () => require('morgan')('dev'),
  now = () => new Date(),
} = {}) {
  if (env.LOG_FORMAT !== 'json') return morgan();
  const name = env.POD_NAME || hostname();

  return function requestLog(req, res, next) {
    const started = process.hrtime.bigint();
    captureRoute(req);
    let logged = false;
    const log = (aborted) => {
      if (logged) return;
      logged = true;
      const route = routeLabel(req);
      const entry = {
        ts: now().toISOString(),
        type: 'request',
        method: req.method,
        route,
        status: res.statusCode,
        ms: Math.round(Number(process.hrtime.bigint() - started) / 1e5) / 10,
      };
      const len = Number(res.getHeader('content-length'));
      if (Number.isFinite(len)) entry.bytes = len;
      entry.hostname = name;
      if (route === 'unmatched') entry.path = pathOnly(req);
      const probe = probeKind(req, route);
      if (probe) entry.probe = probe;
      if (aborted) entry.aborted = true;
      try { write(JSON.stringify(entry) + '\n'); } catch { /* log hỏng không được làm hỏng request */ }
    };
    res.once('finish', () => log(false));
    res.once('close', () => log(!res.writableFinished));
    next();
  };
}

module.exports = { createRequestLogger, pathOnly, probeKind };
