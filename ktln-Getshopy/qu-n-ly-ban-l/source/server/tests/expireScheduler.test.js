// Kiểm thử khoá của job đóng đơn quá hạn khi chạy N bản server (services/payment/expireScheduler.js,
// 18/11/2026) và helper khoá khởi động (scripts/with-startup-lock.js). Prisma giả, không cần DB:
//   node --test tests/expireScheduler.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Thay orderLifecycle bằng bản giả TRƯỚC khi nạp expireScheduler.
const lifecyclePath = require.resolve('../src/services/payment/orderLifecycle');
const lifecycleCalls = [];
require.cache[lifecyclePath] = {
  id: lifecyclePath, filename: lifecyclePath, loaded: true,
  exports: { expireOverdueOrders: async (client) => { lifecycleCalls.push(client); return ['ORD-1']; } },
};
const scheduler = require('../src/services/payment/expireScheduler');

/** Prisma giả: ghi lại câu SQL theo "kết nối"; transaction chạy trên kết nối riêng. */
function fakePrisma({ lockFree = true } = {}) {
  const log = [];
  const prisma = {
    log,
    async $queryRaw(strings, ...vals) { log.push({ conn: 'pool', sql: strings.join('?'), vals }); return [{ locked: lockFree }]; },
    async $transaction(fn, opts) {
      log.push({ conn: 'tx', sql: 'BEGIN', opts });
      const tx = {
        async $queryRaw(strings, ...vals) { log.push({ conn: 'tx', sql: strings.join('?'), vals }); return [{ locked: lockFree }]; },
      };
      try { return await fn(tx); } finally { log.push({ conn: 'tx', sql: 'COMMIT' }); }
    },
  };
  return prisma;
}

test('khoá cấp TRANSACTION (tự nhả khi commit) — không dùng cặp lock/unlock cấp phiên qua pool', async () => {
  lifecycleCalls.length = 0;
  const prisma = fakePrisma();
  const r = await scheduler.runOnce(prisma);
  assert.deepEqual(r, { skipped: false, expired: ['ORD-1'] });
  const sqls = prisma.log.map((l) => `${l.conn}:${l.sql.replace(/\s+/g, ' ').trim()}`);
  assert.ok(sqls.some((s) => s.startsWith('tx:SELECT pg_try_advisory_xact_lock(')), sqls.join('\n'));
  assert.ok(!sqls.some((s) => /pg_advisory_unlock|pg_try_advisory_lock\(/.test(s)), 'không còn khoá cấp phiên');
  assert.ok(!prisma.log.some((l) => l.conn === 'pool'), 'không truy vấn khoá nào ngoài transaction');
  assert.equal(prisma.log.find((l) => l.sql === 'BEGIN').opts.timeout, scheduler.LOCK_TX_TIMEOUT_MS, 'trần 5 s mặc định của Prisma quá ngắn');
  assert.equal(lifecycleCalls[0], prisma, 'việc đóng đơn chạy trên prisma (kết nối khác), không trong transaction giữ khoá');
});

test('bản khác đang giữ khoá -> bỏ lượt, không đóng đơn', async () => {
  lifecycleCalls.length = 0;
  const r = await scheduler.runOnce(fakePrisma({ lockFree: false }));
  assert.deepEqual(r, { skipped: true, expired: [] });
  assert.equal(lifecycleCalls.length, 0);
});

test('stop() trả Promise chờ lượt đang chạy — tắt êm không cắt ngang job', async () => {
  let release;
  const prisma = fakePrisma();
  prisma.$transaction = async (fn) => { await new Promise((r) => { release = r; }); return fn({ $queryRaw: async () => [{ locked: false }] }); };
  const origLog = console.log;
  console.log = () => {};
  try {
    scheduler.start(prisma, 3600);
    await new Promise((r) => setImmediate(r));
    let stopped = false;
    const p = scheduler.stop().then(() => { stopped = true; });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(stopped, false, 'còn lượt đang chạy');
    release();
    await p;
    assert.equal(stopped, true);
    assert.equal(await Promise.race([scheduler.stop().then(() => 'ok'), new Promise((r) => setTimeout(() => r('treo'), 100))]), 'ok');
  } finally {
    console.log = origLog;
  }
});

test('with-startup-lock: URL luôn ép connection_limit=1 (khoá cấp phiên phải nằm trên MỘT kết nối)', () => {
  const { singleConnectionUrl, LOCK_KEY } = require(path.join(__dirname, '..', 'scripts', 'with-startup-lock.js'));
  assert.notEqual(LOCK_KEY, scheduler.ADVISORY_LOCK_KEY);
  const cases = {
    'postgresql://u:p@h:5432/db': 'postgresql://u:p@h:5432/db?connection_limit=1',
    'postgresql://u:p@h:5432/db?schema=public': 'postgresql://u:p@h:5432/db?schema=public&connection_limit=1',
    'postgresql://u:p@h:5432/db?connection_limit=10': 'postgresql://u:p@h:5432/db?connection_limit=1',
    'postgresql://u:p@h:5432/db?connection_limit=10&schema=public': 'postgresql://u:p@h:5432/db?schema=public&connection_limit=1',
    'postgresql://u:p@h:5432/db?schema=public&connection_limit=7': 'postgresql://u:p@h:5432/db?schema=public&connection_limit=1',
  };
  for (const [input, expected] of Object.entries(cases)) assert.equal(singleConnectionUrl(input), expected, input);
  assert.equal(singleConnectionUrl(undefined), undefined);
});
