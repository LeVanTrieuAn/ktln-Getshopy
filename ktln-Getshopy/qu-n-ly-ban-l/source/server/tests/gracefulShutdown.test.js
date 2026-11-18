// Kiểm thử tắt êm (lifecycle/gracefulShutdown.js, 18/11/2026) trên server HTTP + WebSocket thật
// (cổng ngẫu nhiên, 127.0.0.1). exit() là hàm giả — tiến trình kiểm thử không thoát.
//   node --test tests/gracefulShutdown.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const WebSocket = require('ws');
const { createGracefulShutdown } = require('../src/lifecycle/gracefulShutdown');
const { silentLogger } = require('./helpers/fakeRedisBroker');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Server giống index.js: middleware Connection: close, /health, /slow (request dài), WebSocket. */
async function startApp(opts = {}) {
  const order = [];
  const exits = [];
  let graceful;
  const server = http.createServer((req, res) => {
    graceful.middleware(req, res, () => {
      if (req.url === '/health') {
        res.statusCode = graceful.isDraining() ? 503 : 200;
        return res.end(graceful.isDraining() ? 'draining' : 'ok');
      }
      if (req.url.startsWith('/slow')) {
        const ms = Number(new URL(req.url, 'http://x').searchParams.get('ms')) || 300;
        const t = setTimeout(() => res.end('slow-done'), ms);
        res.on('close', () => clearTimeout(t));
        return;
      }
      res.end('ok');
    });
  });
  const wss = new WebSocket.Server({ server });
  graceful = createGracefulShutdown({
    server,
    wss,
    logger: silentLogger,
    exit: (code) => exits.push(code),
    stopBackground: [
      { name: 'timer', fn: () => order.push('stop-timer') },
      { name: 'scheduler', fn: async () => { await sleep(20); order.push('stop-scheduler'); } },
    ],
    cleanup: [
      { name: 'flush', fn: async () => { await sleep(10); order.push('flush'); } },
      { name: 'hỏng', fn: () => { throw new Error('bước này lỗi'); } },
      { name: 'redis', fn: () => order.push('redis') },
      { name: 'prisma', fn: () => order.push('prisma') },
    ],
    ...opts,
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, wss, graceful, order, exits, base, port: server.address().port };
}

function get(url, { agent } = {}) {
  return new Promise((resolve, reject) => {
    http.get(url, { agent }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    }).on('error', reject);
  });
}

test('SIGTERM: request dở dang chạy xong, kết nối mới bị từ chối, WebSocket nhận 1001, dọn dẹp theo thứ tự, exit(0)', async () => {
  const app = await startApp();
  const ws = new WebSocket(`ws://127.0.0.1:${app.port}`);
  await new Promise((r) => ws.on('open', r));
  const wsClosed = new Promise((r) => ws.on('close', (code, reason) => r({ code, reason: String(reason) })));

  const inflight = get(`${app.base}/slow?ms=400`);
  await sleep(50);                                   // request đã tới server
  const done = app.graceful.shutdown('SIGTERM');
  assert.equal(app.graceful.isDraining(), true);

  const r = await inflight;
  assert.equal(r.status, 200);
  assert.equal(r.body, 'slow-done', 'request dở dang không bị cắt');
  assert.equal(r.headers.connection, 'close', 'response trong lúc tắt bảo client đóng kết nối');

  await assert.rejects(get(`${app.base}/health`), /ECONNREFUSED|ECONNRESET|socket hang up/, 'cổng đã đóng — nginx sẽ chuyển sang bản khác');

  assert.deepEqual(await wsClosed, { code: 1001, reason: 'server shutting down' });
  assert.equal(await done, 0);
  assert.deepEqual(app.exits, [0]);
  assert.deepEqual(app.order, ['stop-timer', 'stop-scheduler', 'flush', 'redis', 'prisma'], 'một bước lỗi không chặn các bước sau');
});

test('đang tắt (drainDelayMs): /health trả 503 để readiness/healthcheck ngừng gửi tới', async () => {
  const app = await startApp({ drainDelayMs: 300 });
  const agent = new http.Agent({ keepAlive: true });
  assert.equal((await get(`${app.base}/health`, { agent })).status, 200);
  const done = app.graceful.shutdown('SIGTERM');
  const r = await get(`${app.base}/health`);
  assert.equal(r.status, 503);
  assert.equal(r.body, 'draining');
  assert.equal(r.headers.connection, 'close');
  assert.equal(await done, 0);
  agent.destroy();
});

test('request treo quá hạn: cắt kết nối để còn thời gian dọn dẹp, vẫn chạy cleanup, exit(1)', async () => {
  const app = await startApp({ timeoutMs: 600, cleanupBudgetMs: 300 });
  const hung = get(`${app.base}/slow?ms=60000`).catch((e) => e);
  await sleep(50);
  const t = Date.now();
  assert.equal(await app.graceful.shutdown('SIGTERM'), 1);
  assert.ok(Date.now() - t < 1500, `mất ${Date.now() - t} ms`);
  assert.deepEqual(app.exits, [1]);
  assert.deepEqual(app.order, ['stop-timer', 'stop-scheduler', 'flush', 'redis', 'prisma'], 'cleanup (đẩy buffer hành vi) vẫn chạy');
  assert.ok((await hung) instanceof Error, 'request treo bị cắt');
});

test('bước dọn dẹp treo: chạm mốc cứng thì vẫn thoát (exit 1), không chờ Docker SIGKILL', async () => {
  const app = await startApp({
    timeoutMs: 400, stepTimeoutMs: 5000,
    cleanup: [{ name: 'redis quit treo', fn: () => new Promise(() => {}) }],
  });
  const t = Date.now();
  assert.equal(await app.graceful.shutdown('SIGTERM'), 1);
  assert.ok(Date.now() - t < 1200);
  assert.deepEqual(app.exits, [1]);
});

test('gọi shutdown nhiều lần (SIGTERM lặp lại) chỉ chạy một lần', async () => {
  const app = await startApp();
  const p1 = app.graceful.shutdown('SIGTERM');
  const p2 = app.graceful.shutdown('SIGTERM');
  assert.equal(p1, p2);
  await p1;
  assert.deepEqual(app.exits, [0]);
  assert.equal(app.order.filter((s) => s === 'flush').length, 1);
});

test('install(): SIGTERM khởi động tắt êm; SIGINT lần hai thoát ngay (130)', async () => {
  const app = await startApp({ drainDelayMs: 200 });
  const { EventEmitter } = require('node:events');
  const proc = new EventEmitter();
  app.graceful.install(proc);
  proc.emit('SIGINT');
  assert.equal(app.graceful.isDraining(), true);
  proc.emit('SIGINT');
  assert.deepEqual(app.exits, [130]);
  await app.graceful.shutdown();
});
