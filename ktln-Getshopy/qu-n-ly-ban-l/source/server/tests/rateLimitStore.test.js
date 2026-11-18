// Kiểm thử store rate limit Redis-có-dự-phòng (middleware/rateLimitStore.js, 18/11/2026).
// Store "Redis" ở đây là store giả dùng chung giữa hai limiter — mô phỏng hai bản server cùng
// đếm vào một Redis. Bản Redis thật: tests/redis-integration.test.js (cần REDIS_TEST_URL).
//   node --test tests/rateLimitStore.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { FailoverStore, createRateLimitStore } = require('../src/middleware/rateLimitStore');
const { silentLogger } = require('./helpers/fakeRedisBroker');

/** "Redis" giả: một Map dùng chung cho mọi store tạo từ nó — cửa sổ cố định như rate-limit-redis. */
function sharedCounter() {
  const data = new Map();
  let windowMs = 60_000;
  const calls = { increment: 0 };
  return {
    data, calls,
    makeStore: () => ({
      init(o) { windowMs = o.windowMs; },
      async increment(key) {
        calls.increment += 1;
        const now = Date.now();
        let e = data.get(key);
        if (!e || e.reset <= now) { e = { hits: 0, reset: now + windowMs }; data.set(key, e); }
        e.hits += 1;
        return { totalHits: e.hits, resetTime: new Date(e.reset) };
      },
      async decrement(key) { const e = data.get(key); if (e && e.hits > 0) e.hits -= 1; },
      async resetKey(key) { data.delete(key); },
      async get(key) { const e = data.get(key); return e && { totalHits: e.hits, resetTime: new Date(e.reset) }; },
    }),
  };
}

const opts = { windowMs: 60_000 };

test('Redis sẵn sàng: đếm ở store chính', async () => {
  const shared = sharedCounter();
  const s = new FailoverStore({ createPrimary: shared.makeStore, isPrimaryReady: () => true, prefix: 'rl:t:', logger: silentLogger });
  s.init(opts);
  assert.equal((await s.increment('ip')).totalHits, 1);
  assert.equal((await s.increment('ip')).totalHits, 2);
  assert.equal(shared.calls.increment, 2);
  assert.equal(s.mode, 'redis');
});

test('Redis chưa sẵn sàng: đếm trong bộ nhớ, KHÔNG gửi lệnh nào tới Redis (node-redis sẽ xếp hàng = treo)', async () => {
  let created = 0;
  const s = new FailoverStore({ createPrimary: () => { created += 1; return sharedCounter().makeStore(); }, isPrimaryReady: () => false, logger: silentLogger });
  s.init(opts);
  assert.equal((await s.increment('ip')).totalHits, 1);
  assert.equal((await s.increment('ip')).totalHits, 2);
  assert.equal(created, 0);
  assert.equal(s.mode, 'memory');
  s.shutdown();
});

test('Redis lỗi giữa chừng -> rơi về bộ nhớ, log MỘT lần; Redis về -> log trở lại', async () => {
  const logs = [];
  const logger = { log: (m) => logs.push(['log', m]), warn: (m) => logs.push(['warn', m]), error() {} };
  let broken = false;
  const primary = { init() {}, async increment() { if (broken) throw new Error('ECONNRESET'); return { totalHits: 7, resetTime: new Date() }; } };
  const s = new FailoverStore({ createPrimary: () => primary, isPrimaryReady: () => true, prefix: 'rl:x:', logger });
  s.init(opts);
  assert.equal((await s.increment('k')).totalHits, 7);
  broken = true;
  assert.equal((await s.increment('k')).totalHits, 1, 'bộ nhớ bắt đầu đếm từ 1');
  assert.equal((await s.increment('k')).totalHits, 2);
  broken = false;
  assert.equal((await s.increment('k')).totalHits, 7);
  assert.equal(logs.filter(([l]) => l === 'warn').length, 1);
  assert.match(logs.find(([l]) => l === 'warn')[1], /ECONNRESET/);
  assert.equal(logs.filter(([l]) => l === 'log').length, 1);
  s.shutdown();
});

test('Redis treo -> hết timeoutMs thì rơi về bộ nhớ, request không bị giữ', async () => {
  const primary = { init() {}, increment: () => new Promise(() => {}) };   // không bao giờ trả lời
  const s = new FailoverStore({ createPrimary: () => primary, isPrimaryReady: () => true, timeoutMs: 50, logger: silentLogger });
  s.init(opts);
  const t = Date.now();
  const r = await s.increment('k');
  assert.equal(r.totalHits, 1);
  assert.ok(Date.now() - t < 1000, `mất ${Date.now() - t} ms`);
  s.shutdown();
});

test('createRateLimitStore: không có client (không đặt REDIS_URL) -> chỉ bộ nhớ', async () => {
  const s = createRateLimitStore({ client: null, prefix: 'rl:none:', logger: silentLogger });
  s.init(opts);
  assert.equal((await s.increment('a')).totalHits, 1);
  assert.equal(s.createPrimary, null);
  s.shutdown();
});

// ── Tích hợp với express-rate-limit: hai "bản server" sau cân bằng tải ───────────────
async function startReplica(store, max) {
  const app = express();
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');   // như src/index.js
  app.use(rateLimit({ windowMs: 60_000, max, standardHeaders: true, legacyHeaders: false, store, passOnStoreError: true }));
  app.get('/', (_req, res) => res.json({ ok: true }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

test('hai bản cùng đếm vào "Redis": hạn mức là của CẢ CỤM, không phải mỗi bản', async (t) => {
  const shared = sharedCounter();
  const mk = () => new FailoverStore({ createPrimary: shared.makeStore, isPrimaryReady: () => true, prefix: 'rl:api:', logger: silentLogger });
  const A = await startReplica(mk(), 3);
  const B = await startReplica(mk(), 3);
  t.after(() => { A.server.close(); B.server.close(); });

  const hit = (u) => fetch(u, { headers: { 'X-Forwarded-For': '203.0.113.9' } }).then((r) => r.status);
  // nginx least_conn xen kẽ hai bản
  const statuses = [await hit(A.url), await hit(B.url), await hit(A.url), await hit(B.url)];
  assert.deepEqual(statuses, [200, 200, 200, 429], 'lượt thứ 4 bị chặn dù mỗi bản mới thấy 2 lượt');
  // khách khác không bị ảnh hưởng
  assert.equal(await fetch(A.url, { headers: { 'X-Forwarded-For': '203.0.113.10' } }).then((r) => r.status), 200);
});

test('Redis rớt: mỗi bản tự đếm (xuống cấp có chủ đích), không 500, không treo', async (t) => {
  const mk = () => new FailoverStore({ createPrimary: sharedCounter().makeStore, isPrimaryReady: () => false, prefix: 'rl:api:', logger: silentLogger });
  const A = await startReplica(mk(), 2);
  const B = await startReplica(mk(), 2);
  t.after(() => { A.server.close(); B.server.close(); });
  const hit = (u) => fetch(u, { headers: { 'X-Forwarded-For': '203.0.113.11' } }).then((r) => r.status);
  assert.deepEqual([await hit(A.url), await hit(B.url), await hit(A.url), await hit(B.url), await hit(A.url)], [200, 200, 200, 200, 429]);
});
