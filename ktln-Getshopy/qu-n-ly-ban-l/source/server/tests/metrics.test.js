// Kiểm thử src/metrics (19/11/2026, giám sát cân bằng tải — docs/monitoring.md).
//   node --test tests/metrics.test.js
// Dùng express + prom-client thật trong node_modules; mọi cổng nghe trên 127.0.0.1, cổng ngẫu nhiên.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { createMetrics, routeLabel, joinRoute } = require('../src/metrics');
const { createServedBy } = require('../src/middleware/servedBy');

const quiet = { log() {}, warn() {}, error() {} };
const ENV = { METRICS_ENABLED: '1' };

/** GET/POST không keep-alive (để tiến trình test thoát sạch). */
function request(port, path, { method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, agent: false, headers: { Connection: 'close' } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

/** App Express giống cách index.js gắn: middleware số đo ĐẦU TIÊN, router mount bằng chuỗi cố định. */
async function makeApp(t, metrics) {
  const app = express();
  app.set('env', 'test'); // trình xử lý lỗi mặc định của Express không in stack trace
  app.use(metrics.middleware);
  // Middleware trả lời trước khi tới route (như rate limiter trả 429)
  app.use('/api/limited', (_req, res) => res.status(429).json({ error: 'quá nhiều' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  const b2c = express.Router();
  b2c.get('/', (_req, res) => res.json({ root: true }));
  b2c.get('/products/:id', (req, res) => res.json({ id: req.params.id }));
  b2c.post('/products/:id/reviews', (_req, res) => res.status(201).json({ ok: true }));
  // Handler async ném lỗi: Express 5 chuyển cho trình xử lý lỗi mặc định (500) SAU khi rời router con.
  b2c.get('/boom/:id', async () => { throw new Error('hỏng'); });
  app.use('/api/b2c', b2c);
  const server = http.createServer(app);
  const port = await listen(server);
  t.after(() => new Promise((r) => server.close(r)));
  return port;
}

async function counterSeries(metrics) {
  const m = await metrics.register.getSingleMetric('http_requests_total').get();
  return m.values.map((v) => ({ ...v.labels, value: v.value }));
}

/** 'finish' có thể bắn sau khi client đã nhận xong — chờ tới khi đếm đủ. */
async function waitForCount(metrics, n) {
  for (let i = 0; i < 100; i += 1) {
    const total = (await counterSeries(metrics)).reduce((s, v) => s + v.value, 0);
    if (total >= n) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`chưa đếm đủ ${n} request`);
}

test('mặc định tắt: không đặt METRICS_ENABLED, hoặc khác đúng "1" -> null (không mở cổng)', () => {
  assert.equal(createMetrics({ env: {}, logger: quiet }), null);
  for (const v of ['0', 'true', 'yes', ' 1', '']) {
    assert.equal(createMetrics({ env: { METRICS_ENABLED: v }, logger: quiet }), null, `METRICS_ENABLED=${JSON.stringify(v)}`);
  }
});

test('METRICS_PORT: mặc định 9464, giá trị sai -> 9464', () => {
  assert.equal(createMetrics({ env: ENV, logger: quiet }).port, 9464);
  assert.equal(createMetrics({ env: { ...ENV, METRICS_PORT: '9500' }, logger: quiet }).port, 9500);
  for (const v of ['abc', '-1', '70000', '', '1.5']) {
    assert.equal(createMetrics({ env: { ...ENV, METRICS_PORT: v }, logger: quiet }).port, 9464, `METRICS_PORT=${v}`);
  }
});

test('nhãn route = MẪU route Express, không phải URL thật (id, query không lọt vào nhãn)', async (t) => {
  const metrics = createMetrics({ env: ENV, hostname: () => 'h1', logger: quiet });
  const port = await makeApp(t, metrics);

  assert.equal((await request(port, '/api/b2c/products/123456789?email=khach%40mail.vn&q=bi-mat')).status, 200);
  assert.equal((await request(port, '/api/b2c/products/987654321')).status, 200);
  assert.equal((await request(port, '/api/b2c/products/555/reviews', { method: 'POST' })).status, 201);
  assert.equal((await request(port, '/api/b2c')).status, 200);
  assert.equal((await request(port, '/api/health')).status, 200);
  await waitForCount(metrics, 5);

  const series = await counterSeries(metrics);
  const find = (method, route, code) => series.find((s) => s.method === method && s.route === route && s.status_code === code);
  assert.equal(find('GET', '/api/b2c/products/:id', '200').value, 2, 'hai id khác nhau gộp vào MỘT chuỗi');
  assert.equal(find('POST', '/api/b2c/products/:id/reviews', '201').value, 1);
  assert.equal(find('GET', '/api/b2c', '200').value, 1, "route '/' của router -> tiền tố mount");
  assert.equal(find('GET', '/api/health', '200').value, 1);

  // Chỉ xét phần nhãn {...} — phần giá trị (vd. _sum 0.00555) có thể tình cờ chứa chữ số.
  const labelSets = (await metrics.register.metrics()).split('\n')
    .filter((l) => l.startsWith('http_') && l.includes('{'))
    .map((l) => l.slice(l.indexOf('{'), l.lastIndexOf('}') + 1));
  assert.ok(labelSets.length > 0);
  for (const raw of ['123456789', '987654321', '555', 'khach', 'bi-mat', 'email', '?']) {
    assert.ok(!labelSets.some((l) => l.includes(raw)), `nhãn không được chứa "${raw}"`);
  }
});

test("không khớp route nào -> 'unmatched' (404, hoặc middleware trả lời trước như 429)", async (t) => {
  const metrics = createMetrics({ env: ENV, hostname: () => 'h1', logger: quiet });
  const port = await makeApp(t, metrics);

  assert.equal((await request(port, '/khong-co/abc-123?x=1')).status, 404);
  assert.equal((await request(port, '/api/b2c/khong-co')).status, 404);
  assert.equal((await request(port, '/api/limited/xyz')).status, 429);
  await waitForCount(metrics, 3);

  const series = await counterSeries(metrics);
  assert.deepEqual(
    series.map((s) => `${s.route} ${s.status_code}`).sort(),
    ['unmatched 404', 'unmatched 429'],
  );
  assert.equal(series.find((s) => s.status_code === '404').value, 2);
});

test('handler async ném lỗi (500 sau khi rời router con) vẫn mang mẫu route đầy đủ', async (t) => {
  const metrics = createMetrics({ env: ENV, hostname: () => 'h1', logger: quiet });
  const port = await makeApp(t, metrics);

  assert.equal((await request(port, '/api/b2c/boom/42')).status, 500);
  await waitForCount(metrics, 1);
  const [s] = await counterSeries(metrics);
  assert.equal(s.route, '/api/b2c/boom/:id');
  assert.equal(s.status_code, '500');
});

test('histogram độ trễ: cùng nhãn với bộ đếm, _count khớp số request', async (t) => {
  const metrics = createMetrics({ env: ENV, hostname: () => 'h1', logger: quiet });
  const port = await makeApp(t, metrics);
  for (let i = 0; i < 3; i += 1) await request(port, `/api/b2c/products/${i}`);
  await waitForCount(metrics, 3);

  const text = await metrics.register.metrics();
  assert.match(text, /^http_request_duration_seconds_count\{method="GET",route="\/api\/b2c\/products\/:id",status_code="200"\} 3$/m);
  assert.match(text, /^http_request_duration_seconds_bucket\{le="0\.25",method="GET",route="\/api\/b2c\/products\/:id",status_code="200"\} \d+$/m);
  assert.match(text, /^http_request_duration_seconds_bucket\{le="\+Inf",method="GET",route="\/api\/b2c\/products\/:id",status_code="200"\} 3$/m);
});

test('trần số nhãn route: vượt maxRouteLabels thì gộp vào "other"', async (t) => {
  const metrics = createMetrics({ env: ENV, hostname: () => 'h1', logger: quiet, maxRouteLabels: 2 });
  const port = await makeApp(t, metrics);
  await request(port, '/api/health');
  await request(port, '/api/b2c/products/1');
  await request(port, '/api/b2c');
  await request(port, '/api/health');
  await waitForCount(metrics, 4);
  const routes = (await counterSeries(metrics)).map((s) => s.route).sort();
  assert.deepEqual(routes, ['/api/b2c/products/:id', '/api/health', 'other']);
});

test('cổng số đo riêng: /metrics có số đo HTTP, Node mặc định và getshopy_server_info{hostname}', async (t) => {
  const metrics = createMetrics({ env: ENV, hostname: () => 'abc123def456', logger: quiet });
  const appPort = await makeApp(t, metrics);
  await request(appPort, '/api/health');
  await waitForCount(metrics, 1);

  const addr = await metrics.start({ host: '127.0.0.1', port: 0 });
  t.after(() => metrics.stop());
  assert.ok(addr && addr.port > 0);

  const res = await request(addr.port, '/metrics');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^text\/plain; version=0\.0\.4/);
  assert.match(res.body, /^getshopy_server_info\{hostname="abc123def456"\} 1$/m);
  assert.match(res.body, /^http_requests_total\{method="GET",route="\/api\/health",status_code="200"\} 1$/m);
  for (const name of ['process_cpu_seconds_total', 'process_resident_memory_bytes', 'nodejs_heap_size_used_bytes',
    'nodejs_eventloop_lag_p99_seconds', 'nodejs_gc_duration_seconds', 'http_request_duration_seconds']) {
    assert.match(res.body, new RegExp(`^# TYPE ${name} `, 'm'), `thiếu ${name}`);
  }
  // Có query string vẫn là /metrics; path khác hoặc phương thức khác -> 404
  assert.equal((await request(addr.port, '/metrics?x=1')).status, 200);
  assert.equal((await request(addr.port, '/')).status, 404);
  assert.equal((await request(addr.port, '/api/health')).status, 404);
  assert.equal((await request(addr.port, '/metrics', { method: 'POST' })).status, 404);
});

test('app chính KHÔNG phục vụ /metrics (gateway, Funnel chỉ tới được cổng này)', async (t) => {
  const metrics = createMetrics({ env: ENV, hostname: () => 'h1', logger: quiet });
  const port = await makeApp(t, metrics);
  for (const path of ['/metrics', '/api/metrics', '/api/b2c/metrics']) {
    const res = await request(port, path);
    assert.equal(res.status, 404, path);
    assert.ok(!res.body.includes('# HELP') && !res.body.includes('getshopy_server_info'), path);
  }
});

test('hostname trùng X-Served-By: POD_NAME nếu có, không thì os.hostname()', async () => {
  for (const env of [{ POD_NAME: 'getshopy-demo-7d9f-abcde' }, {}]) {
    const host = () => 'f00dbabe1234';
    const m = createMetrics({ env: { ...ENV, ...env }, hostname: host, logger: quiet });
    const headers = {};
    createServedBy({ SERVED_BY_HEADER: '1', ...env }, host)({}, { setHeader: (k, v) => { headers[k] = v; } }, () => {});
    assert.equal(m.hostname, headers['X-Served-By']);
    const text = await m.register.metrics();
    assert.ok(text.includes(`getshopy_server_info{hostname="${headers['X-Served-By']}"} 1`));
  }
});

test('stop() đóng cổng số đo kể cả khi Prometheus đang giữ kết nối keep-alive', async () => {
  const metrics = createMetrics({ env: ENV, hostname: () => 'h1', logger: quiet });
  const { port } = await metrics.start({ host: '127.0.0.1', port: 0 });
  // Kết nối keep-alive như HTTP client của Prometheus
  const agent = new http.Agent({ keepAlive: true });
  await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: '/metrics', agent }, (res) => { res.resume(); res.on('end', resolve); }).on('error', reject);
  });
  const started = Date.now();
  await metrics.stop();
  assert.ok(Date.now() - started < 1000, 'không chờ keepAliveTimeout');
  agent.destroy();
  await assert.rejects(request(port, '/metrics'), { code: 'ECONNREFUSED' });
  await metrics.stop(); // gọi lần hai không lỗi
});

test('cổng bận: start() trả null, ghi log, không ném lỗi (server chính vẫn chạy)', async (t) => {
  const blocker = http.createServer();
  const port = await listen(blocker);
  t.after(() => new Promise((r) => blocker.close(r)));
  const errors = [];
  const metrics = createMetrics({ env: ENV, hostname: () => 'h1', logger: { ...quiet, error: (...a) => errors.push(a.join(' ')) } });
  assert.equal(await metrics.start({ host: '127.0.0.1', port }), null);
  assert.equal(errors.length, 1);
  await metrics.stop();
});

test('routeLabel / joinRoute: các dạng mẫu route', () => {
  assert.equal(joinRoute('', '/api/health'), '/api/health');
  assert.equal(joinRoute('/api/b2c', '/'), '/api/b2c');
  assert.equal(joinRoute('/api/b2c', '/products/:id'), '/api/b2c/products/:id');
  assert.equal(joinRoute('/api', ['/a', '/b']), '/api/a|/b');
  assert.equal(joinRoute('', /^\/re$/), '/^\\/re$/');
  assert.equal(routeLabel({}), 'unmatched');
  assert.equal(routeLabel({ baseUrl: '/api/b2b', route: { path: '/orders/:id' } }), '/api/b2b/orders/:id');
});
