// Kiểm thử cân bằng tải với Redis THẬT (18/11/2026): rate-limit-redis đếm chung giữa hai "bản
// server", bus Pub/Sub giữa hai kết nối, rơi về bộ nhớ khi Redis rớt. Bỏ qua nếu không đặt
// REDIS_TEST_URL. KHÔNG trỏ vào Redis production — dựng một Redis tạm:
//   docker run -d --rm --name redis-test-tam -p 127.0.0.1:26379:6379 redis:7-alpine
//   REDIS_TEST_URL=redis://127.0.0.1:26379 node --test tests/redis-integration.test.js
//   docker rm -f redis-test-tam
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');

const URL_ = process.env.REDIS_TEST_URL;
const skip = URL_ ? false : 'đặt REDIS_TEST_URL (Redis tạm, không phải production) để chạy';

let createClient, express, rateLimit, createRateLimitStore, createBus;
if (!skip) {
  ({ createClient } = require('redis'));
  express = require('express');
  rateLimit = require('express-rate-limit');
  ({ createRateLimitStore } = require('../src/middleware/rateLimitStore'));
  ({ createBus } = require('../src/cluster/bus'));
}
const silent = { log() {}, warn() {}, error() {} };
const run = crypto.randomBytes(4).toString('hex');   // khoá riêng cho lượt chạy này

async function client() {
  const c = createClient({ url: URL_ });
  c.on('error', () => {});
  await c.connect();
  return c;
}

async function replica(redisClient, max) {
  const app = express();
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use(rateLimit({
    windowMs: 60_000, max, standardHeaders: true, legacyHeaders: false, passOnStoreError: true,
    store: createRateLimitStore({ client: redisClient, prefix: `rltest:${run}:`, logger: silent }),
  }));
  app.get('/', (_req, res) => res.json({ ok: true }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

test('rate-limit-redis: hai bản, hai kết nối Redis, MỘT bộ đếm cho cả cụm', { skip }, async (t) => {
  const ca = await client(); const cb = await client();
  const A = await replica(ca, 3); const B = await replica(cb, 3);
  t.after(async () => { A.server.close(); B.server.close(); for (const c of [ca, cb]) if (c.isOpen) await c.quit(); });
  const hit = (u, ip) => fetch(u, { headers: { 'X-Forwarded-For': ip } }).then((r) => r.status);
  const ip = '198.51.100.7';
  assert.deepEqual([await hit(A.url, ip), await hit(B.url, ip), await hit(A.url, ip), await hit(B.url, ip)], [200, 200, 200, 429]);
  const keys = await ca.keys(`rltest:${run}:*`);
  assert.equal(keys.length, 1);
  assert.equal(await ca.get(keys[0]), '4');
  assert.ok((await ca.pTTL(keys[0])) > 0, 'khoá có hạn — Redis tự dọn');

  // Bản B mất Redis: B đếm trong bộ nhớ, A vẫn đếm chung. Không 500, không treo.
  await cb.disconnect();
  const ip2 = '198.51.100.8';
  const t0 = Date.now();
  assert.deepEqual([await hit(B.url, ip2), await hit(B.url, ip2), await hit(B.url, ip2), await hit(B.url, ip2)], [200, 200, 200, 429]);
  assert.ok(Date.now() - t0 < 2000);
  assert.equal(await hit(A.url, ip2), 200, 'A không thấy các lượt B đếm trong bộ nhớ');
});

test('bus qua Redis thật: tin tới bản khác đúng một lần, bản phát không nhận lại', { skip }, async (t) => {
  const channel = `bustest:${run}`;
  const pa = await client(); const pb = await client();
  const A = createBus({ publisher: pa, createSubscriber: () => pa.duplicate(), instanceId: 'A', channel, logger: silent });
  const B = createBus({ publisher: pb, createSubscriber: () => pb.duplicate(), instanceId: 'B', channel, logger: silent });
  t.after(async () => { await A.stop(); await B.stop(); await pa.quit(); await pb.quit(); });
  assert.equal(await A.start(), true);
  assert.equal(await B.start(), true);
  const got = { A: [], B: [] };
  A.on('customer-status', (p) => got.A.push(p.id));
  B.on('customer-status', (p) => got.B.push(p.id));
  assert.equal(await A.emit('customer-status', { id: '42' }), true);
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(got, { A: ['42'], B: ['42'] });
});
