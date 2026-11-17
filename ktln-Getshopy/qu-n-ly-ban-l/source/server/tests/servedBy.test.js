// Kiểm thử middleware/servedBy.js (17/11/2026, demo Kubernetes). Không cần node_modules:
//   node --test tests/servedBy.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServedBy } = require('../src/middleware/servedBy');

function run(mw) {
  const headers = {};
  let nextCalls = 0;
  mw({}, { setHeader: (k, v) => { headers[k] = v; } }, () => { nextCalls += 1; });
  return { headers, nextCalls };
}

test('mặc định tắt: không đặt biến, hoặc giá trị khác "1" -> null (production không đổi)', () => {
  assert.equal(createServedBy({}), null);
  for (const v of ['0', 'true', 'yes', ' 1', '']) {
    assert.equal(createServedBy({ SERVED_BY_HEADER: v, POD_NAME: 'p' }), null, `SERVED_BY_HEADER=${JSON.stringify(v)}`);
  }
});

test('bật: header mang POD_NAME và luôn gọi next()', () => {
  const { headers, nextCalls } = run(createServedBy({ SERVED_BY_HEADER: '1', POD_NAME: 'server-abc-123' }, () => 'host-x'));
  assert.deepEqual(headers, { 'X-Served-By': 'server-abc-123' });
  assert.equal(nextCalls, 1);
});

test('bật nhưng thiếu POD_NAME: rơi về hostname', () => {
  const { headers } = run(createServedBy({ SERVED_BY_HEADER: '1' }, () => 'container-42'));
  assert.equal(headers['X-Served-By'], 'container-42');
});
