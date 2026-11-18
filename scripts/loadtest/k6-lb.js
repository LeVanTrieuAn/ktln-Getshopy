// =============================================================================
// k6 — tải thử CÂN BẰNG TẢI cho N bản server sau nginx gateway (18/11/2026)
//
// CHỈ endpoint ĐỌC công khai của cửa hàng: danh sách sản phẩm, chi tiết sản phẩm, danh mục,
// health. Không đăng nhập, không ghi, không đặt hàng — chạy được trên dữ liệu thật mà không
// để lại gì trong DB (trừ bộ đếm rate limit trong Redis, tự hết hạn sau 1 phút).
//
// Chạy (scripts/lb-demo.ps1 làm sẵn): k6 chạy TRONG network của compose, gọi thẳng gateway:
//   docker run --rm --network kltn_default -v "${PWD}/scripts/loadtest:/scripts" \
//     -e BASE_URL=http://gateway -e RATE=200 grafana/k6:1.8.2 run /scripts/k6-lb.js
//
// Biến môi trường:
//   BASE_URL    mặc định http://gateway (cổng 80 của gateway trong network compose)
//   RATE        request/giây CỐ ĐỊNH (constant-arrival-rate, mô hình "mở": khách tới đều
//               đặn bất kể server nhanh hay chậm — đo được độ trễ thật khi quá tải, khác mô hình
//               "đóng" số VU cố định). Muốn thấy khác biệt 1/2/3 bản thì RATE phải VƯỢT sức một bản.
//   WARMUP      khởi động (mặc định 15s) — không tính vào số liệu: làm nóng cache, pool kết nối
//   DURATION    pha đo (mặc định 60s)
//   MAX_VUS     trần VU mỗi pha (mặc định 300). Hết VU thì k6 bỏ lượt -> dropped_iterations > 0 = quá tải.
//   SPOOF_XFF   1 (mặc định): mỗi VU mang một IP giả trong 198.18.0.0/15 (RFC 2544 — dải dành
//               cho đo kiểm) qua X-Forwarded-For, mô phỏng nhiều khách. Rate limit của server
//               tính theo IP (2000/phút/IP, đếm CHUNG trong Redis cho cả cụm từ 18/11/2026); một
//               IP duy nhất thì phần lớn request là 429 và bài đo thành đo rate limiter. Chỉ có
//               tác dụng từ TRONG network compose (server tin X-Forwarded-For từ IP mạng riêng);
//               khách thật qua Tailscale không giả được — IP thật nằm bên phải chuỗi.
//               0: một IP — dùng để minh hoạ rate limit chung cả cụm.
//   REPLICAS    danh sách hostname các bản (id container 12 ký tự), ngăn bởi dấu phẩy — có thì
//               bản tóm tắt đếm số request mỗi bản trả lời (header X-Served-By).
//   P95_MS      ngưỡng p95 (ms) cho threshold, mặc định 1000 — NGƯỠNG MỤC TIÊU để k6 báo đạt/
//               không đạt, KHÔNG phải kết quả đo.
//   SUMMARY_PATH  nơi ghi tóm tắt JSON (mặc định /out/summary.json)
// =============================================================================
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || 'http://gateway').replace(/\/+$/, '');
const RATE = Number(__ENV.RATE || 200);
const WARMUP = __ENV.WARMUP || '15s';
const DURATION = __ENV.DURATION || '60s';
const MAX_VUS = Number(__ENV.MAX_VUS || 300);
const SPOOF = (__ENV.SPOOF_XFF || '1') !== '0';
const P95_MS = Number(__ENV.P95_MS || 1000);
const REPLICAS = (__ENV.REPLICAS || '').split(',').map((s) => s.trim()).filter(Boolean);
const SUMMARY_PATH = __ENV.SUMMARY_PATH || '/out/summary.json';

const servedBy = new Counter('served_by');

// Tỷ trọng xấp xỉ một lượt duyệt cửa hàng: xem danh mục, lướt danh sách, mở chi tiết.
const MIX = [
  { endpoint: 'categories', weight: 35 },
  { endpoint: 'listing', weight: 35 },
  { endpoint: 'detail', weight: 25 },
  { endpoint: 'health', weight: 5 },
];
const TOTAL_WEIGHT = MIX.reduce((s, m) => s + m.weight, 0);

const steady = { scenario: 'steady' };
const thresholds = {
  // Lỗi = mã >= 400 hoặc lỗi kết nối. 429 cũng là lỗi: nếu có thì RATE / SPOOF_XFF đặt sai.
  'http_req_failed{scenario:steady}': ['rate<0.01'],
  'http_req_duration{scenario:steady}': [`p(95)<${P95_MS}`],
  'checks{scenario:steady}': ['rate>0.99'],
  // Không có ngưỡng thật — khai để bản tóm tắt có số riêng cho pha đo.
  'http_reqs{scenario:steady}': ['count>=0'],
  'dropped_iterations{scenario:steady}': ['count>=0'],
};
for (const m of MIX) thresholds[`http_req_duration{scenario:steady,endpoint:${m.endpoint}}`] = [`p(95)<${P95_MS}`];
for (const r of REPLICAS) thresholds[`served_by{replica:${r}}`] = ['count>=0'];

export const options = {
  discardResponseBodies: true,
  scenarios: {
    warmup: {
      executor: 'constant-arrival-rate', rate: RATE, timeUnit: '1s', duration: WARMUP,
      preAllocatedVUs: Math.min(MAX_VUS, Math.max(10, Math.ceil(RATE / 4))), maxVUs: MAX_VUS,
      tags: { scenario: 'warmup' },
    },
    steady: {
      executor: 'constant-arrival-rate', rate: RATE, timeUnit: '1s', duration: DURATION, startTime: WARMUP,
      preAllocatedVUs: Math.min(MAX_VUS, Math.max(10, Math.ceil(RATE / 4))), maxVUs: MAX_VUS,
      tags: steady,
    },
  },
  thresholds,
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

/** Lấy sẵn danh sách id sản phẩm thật cho request chi tiết (một lần, trước khi đo). */
export function setup() {
  const res = http.get(`${BASE}/api/b2c/products?page=1&limit=60`, { responseType: 'text', tags: { endpoint: 'setup' } });
  let ids = [];
  try { ids = (JSON.parse(res.body).data || []).map((p) => p.id).filter(Boolean); } catch (_) { /* rỗng */ }
  if (res.status !== 200 || ids.length === 0) {
    console.warn(`setup: không lấy được danh sách sản phẩm (HTTP ${res.status}) — bỏ request chi tiết`);
  }
  return { ids };
}

function pick() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const m of MIX) { r -= m.weight; if (r < 0) return m.endpoint; }
  return MIX[0].endpoint;
}

export default function (data) {
  const headers = {};
  if (SPOOF) headers['X-Forwarded-For'] = `198.18.${Math.floor(__VU / 250) % 256}.${(__VU % 250) + 1}`;

  let endpoint = pick();
  if (endpoint === 'detail' && data.ids.length === 0) endpoint = 'listing';
  let url; let name;
  switch (endpoint) {
    case 'categories':
      url = `${BASE}/api/b2c/categories`; name = '/api/b2c/categories'; break;
    case 'listing': {
      const page = 1 + Math.floor(Math.random() * 5);   // trang đầu — như khách lướt thật
      url = `${BASE}/api/b2c/products?page=${page}&limit=24`; name = '/api/b2c/products?page=N&limit=24'; break;
    }
    case 'detail':
      url = `${BASE}/api/b2c/products/${data.ids[Math.floor(Math.random() * data.ids.length)]}`; name = '/api/b2c/products/:id'; break;
    default:
      url = `${BASE}/api/health`; name = '/api/health';
  }

  const res = http.get(url, { headers, tags: { endpoint, name } });
  check(res, { 'status 200': (r) => r.status === 200 }, { endpoint });
  const replica = res.headers['X-Served-By'] || 'none';
  servedBy.add(1, { replica });
}

function num(m, key) {
  return m && m.values && typeof m.values[key] === 'number' ? m.values[key] : null;
}

/** Tóm tắt gọn ra màn hình + JSON đầy đủ cho lb-demo.ps1 đọc lại. */
export function handleSummary(data) {
  const M = data.metrics;
  const reqs = num(M['http_reqs{scenario:steady}'], 'count');
  const durS = parseFloat(DURATION) * (DURATION.endsWith('m') ? 60 : 1);
  const lines = [
    `RATE mục tiêu ${RATE} req/s, pha đo ${DURATION} (sau ${WARMUP} khởi động)`,
    `  request pha đo   : ${reqs}  (~${reqs !== null ? (reqs / durS).toFixed(1) : '?'} req/s)`,
    `  p95 / p99 (ms)   : ${num(M['http_req_duration{scenario:steady}'], 'p(95)')?.toFixed(1)} / ${num(M['http_req_duration{scenario:steady}'], 'p(99)')?.toFixed(1)}`,
    `  tỷ lệ lỗi        : ${((num(M['http_req_failed{scenario:steady}'], 'rate') || 0) * 100).toFixed(2)} %`,
    `  dropped iterations: ${num(M['dropped_iterations{scenario:steady}'], 'count') || 0}`,
  ];
  for (const m of MIX) {
    const p95 = num(M[`http_req_duration{scenario:steady,endpoint:${m.endpoint}}`], 'p(95)');
    if (p95 !== null) lines.push(`  p95 ${m.endpoint.padEnd(11)}: ${p95.toFixed(1)} ms`);
  }
  for (const r of REPLICAS) lines.push(`  bản ${r}: ${num(M[`served_by{replica:${r}}`], 'count') || 0} request`);
  return {
    stdout: lines.join('\n') + '\n',
    [SUMMARY_PATH]: JSON.stringify(data, null, 2),
  };
}
