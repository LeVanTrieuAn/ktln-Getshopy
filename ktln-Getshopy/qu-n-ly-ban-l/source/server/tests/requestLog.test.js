// Kiểm thử middleware/requestLog.js (19/11/2026, log tập trung — docs/monitoring.md).
//   node --test tests/requestLog.test.js
// express thật trong node_modules; mọi cổng nghe trên 127.0.0.1, cổng ngẫu nhiên.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { createRequestLogger, pathOnly } = require('../src/middleware/requestLog');
const { createMetrics } = require('../src/metrics');

const ENV = { LOG_FORMAT: 'json' };

function request(port, path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, agent: false, headers: { Connection: 'close', ...headers } }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** App giống index.js: (tuỳ chọn) số đo trước, log request, rồi router mount bằng chuỗi cố định. */
async function makeApp(t, { env = ENV, withMetrics = false } = {}) {
  const lines = [];
  const app = express();
  app.set('env', 'test');
  if (withMetrics) app.use(createMetrics({ env: { METRICS_ENABLED: '1' }, hostname: () => 'h', logger: { log() {}, error() {} } }).middleware);
  app.use(createRequestLogger({ env, hostname: () => 'abc123def456', write: (l) => lines.push(l), morgan: () => 'MORGAN' }));
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  const b2c = express.Router();
  b2c.get('/products/:id', (req, res) => res.json({ id: req.params.id }));
  b2c.post('/orders', (_req, res) => res.status(201).json({ ok: true }));
  b2c.get('/slow', (_req, res) => { setTimeout(() => { if (!res.writableEnded) res.json({ late: true }); }, 300); });
  b2c.get('/boom/:id', async () => { throw new Error('hỏng'); });
  app.use('/api/b2c', b2c);
  const server = http.createServer(app);
  const port = await new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
  t.after(() => new Promise((r) => server.close(r)));
  return { port, lines };
}

async function waitLines(lines, n) {
  for (let i = 0; i < 100 && lines.length < n; i += 1) await new Promise((r) => setTimeout(r, 10));
  assert.ok(lines.length >= n, `chờ ${n} dòng log, có ${lines.length}`);
  return lines.map((l) => {
    assert.ok(l.endsWith('\n') && !l.slice(0, -1).includes('\n'), 'mỗi request đúng một dòng');
    return JSON.parse(l);
  });
}

test('LOG_FORMAT không phải "json" -> morgan("dev") như cũ', () => {
  for (const env of [{}, { LOG_FORMAT: 'dev' }, { LOG_FORMAT: 'JSON' }, { LOG_FORMAT: '' }]) {
    assert.equal(createRequestLogger({ env, morgan: () => 'MORGAN' }), 'MORGAN', JSON.stringify(env));
  }
});

test('một dòng JSON / request: mẫu route, không query string, đủ trường', async (t) => {
  const { port, lines } = await makeApp(t);
  assert.equal((await request(port, '/api/b2c/products/123456789?email=khach%40mail.vn&token=bi-mat')).status, 200);
  const [e] = await waitLines(lines, 1);
  assert.equal(e.type, 'request');
  assert.equal(e.method, 'GET');
  assert.equal(e.route, '/api/b2c/products/:id');
  assert.equal(e.status, 200);
  assert.equal(e.hostname, 'abc123def456');
  assert.equal(typeof e.ms, 'number');
  assert.ok(e.ms >= 0);
  assert.equal(typeof e.bytes, 'number');
  assert.ok(!Number.isNaN(Date.parse(e.ts)));
  assert.equal(e.path, undefined, 'route khớp thì không ghi path');
  const raw = lines[0];
  for (const s of ['123456789', 'email', 'khach', 'token', 'bi-mat', '?']) assert.ok(!raw.includes(s), `log không được chứa "${s}"`);
});

test('KHÔNG ghi header, cookie, token, body', async (t) => {
  const { port, lines } = await makeApp(t);
  const res = await request(port, '/api/b2c/orders', {
    method: 'POST',
    headers: { Cookie: 'session=cookie-bi-mat', Authorization: 'Bearer token-bi-mat', 'Content-Type': 'application/json', 'User-Agent': 'trinh-duyet-x' },
    body: JSON.stringify({ password: 'mat-khau-bi-mat', phone: '0909000111' }),
  });
  assert.equal(res.status, 201);
  const [e] = await waitLines(lines, 1);
  assert.equal(e.route, '/api/b2c/orders');
  assert.equal(e.status, 201);
  for (const s of ['cookie-bi-mat', 'token-bi-mat', 'Bearer', 'mat-khau-bi-mat', '0909000111', 'trinh-duyet-x', 'session']) {
    assert.ok(!lines[0].includes(s), `log không được chứa "${s}"`);
  }
});

test('không khớp route -> "unmatched" + path KHÔNG query, cắt ngắn', async (t) => {
  const { port, lines } = await makeApp(t);
  await request(port, '/api/khong-co/abc?x=bi-mat');
  await request(port, `/${'a'.repeat(500)}?q=1`);
  const [a, b] = await waitLines(lines, 2);
  assert.equal(a.route, 'unmatched');
  assert.equal(a.status, 404);
  assert.equal(a.path, '/api/khong-co/abc');
  assert.ok(!lines[0].includes('bi-mat'));
  assert.equal(b.path.length, 200);
});

test('probe: healthcheck của Docker (/api/health từ loopback) và blackbox exporter được đánh dấu', async (t) => {
  const { port, lines } = await makeApp(t);
  await request(port, '/api/health');                                                  // như healthcheck trong container
  await request(port, '/api/health', { headers: { 'User-Agent': 'Blackbox-Exporter/0.29.1' } }); // đúng chuỗi blackbox 0.29.1 gửi
  await request(port, '/api/b2c/products/1');                                         // request thường
  const [docker, bb, normal] = await waitLines(lines, 3);
  assert.equal(docker.probe, 'docker');
  assert.equal(bb.probe, 'blackbox');
  assert.equal(normal.probe, undefined);
  assert.ok(!lines[1].includes('Blackbox-Exporter/0.29.1'), 'User-Agent không được ghi ra');
});

test('handler async ném lỗi (500 sau khi rời router con) vẫn ghi mẫu route đầy đủ', async (t) => {
  const { port, lines } = await makeApp(t);
  assert.equal((await request(port, '/api/b2c/boom/42')).status, 500);
  const [e] = await waitLines(lines, 1);
  assert.equal(e.route, '/api/b2c/boom/:id');
  assert.equal(e.status, 500);
});

test('client đóng kết nối trước khi xong -> một dòng với aborted: true', async (t) => {
  const { port, lines } = await makeApp(t);
  await new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/b2c/slow?x=1', agent: false });
    req.on('error', () => resolve());
    setTimeout(() => { req.destroy(); resolve(); }, 80);
  });
  const [e] = await waitLines(lines, 1);
  assert.equal(e.route, '/api/b2c/slow');
  assert.equal(e.aborted, true);
  await new Promise((r) => setTimeout(r, 350)); // handler trả lời muộn: không được ghi dòng thứ hai
  assert.equal(lines.length, 1);
});

test('chạy chung với middleware số đo: mỗi request vẫn một dòng, route đúng', async (t) => {
  const { port, lines } = await makeApp(t, { withMetrics: true });
  await request(port, '/api/b2c/products/7');
  await request(port, '/api/b2c/boom/1');
  const [a, b] = await waitLines(lines, 2);
  assert.equal(a.route, '/api/b2c/products/:id');
  assert.equal(b.route, '/api/b2c/boom/:id');
});

test('hostname = POD_NAME nếu có (giống X-Served-By)', async (t) => {
  const { port, lines } = await makeApp(t, { env: { LOG_FORMAT: 'json', POD_NAME: 'getshopy-demo-7d9f' } });
  await request(port, '/api/health');
  const [e] = await waitLines(lines, 1);
  assert.equal(e.hostname, 'getshopy-demo-7d9f');
});

test('pathOnly: bỏ query, giữ nguyên đường dẫn', () => {
  assert.equal(pathOnly({ originalUrl: '/a/b?c=d' }), '/a/b');
  assert.equal(pathOnly({ url: '/x' }), '/x');
  assert.equal(pathOnly({}), '');
});
