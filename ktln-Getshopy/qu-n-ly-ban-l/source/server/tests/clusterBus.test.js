// Kiểm thử bus Redis Pub/Sub giữa các bản server (cluster/bus.js, 18/11/2026) và hai chỗ dùng:
// xoá bộ đệm trạng thái khách trên mọi bản, phát WebSocket cho client của mọi bản.
// Redis giả (tests/helpers/fakeRedisBroker.js) — không cần Redis thật:
//   node --test tests/clusterBus.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBus } = require('../src/cluster/bus');
const { createWsFanout } = require('../src/cluster/wsFanout');
const { createCustomerStatusCache } = require('../src/services/customerStatusCache');
const { createBroker, flush, silentLogger } = require('./helpers/fakeRedisBroker');

/** Một "bản server": bus nối vào broker chung. */
async function makeInstance(broker, id) {
  const publisher = broker.client();
  let subscriber;
  const bus = createBus({
    publisher,
    createSubscriber: () => { subscriber = publisher.duplicate(); return subscriber; },
    instanceId: id,
    logger: silentLogger,
  });
  assert.equal(await bus.start(), true);
  return { bus, publisher, subscriber: () => subscriber };
}

test('emit: handler của bản phát chạy NGAY một lần, mỗi bản khác chạy đúng một lần', async () => {
  const broker = createBroker();
  const a = await makeInstance(broker, 'A');
  const b = await makeInstance(broker, 'B');
  const c = await makeInstance(broker, 'C');
  const seen = { A: [], B: [], C: [] };
  a.bus.on('t', (p, meta) => seen.A.push([p.n, meta.remote]));
  b.bus.on('t', (p, meta) => seen.B.push([p.n, meta.remote]));
  c.bus.on('t', (p, meta) => seen.C.push([p.n, meta.remote]));

  const sent = a.bus.emit('t', { n: 1 });
  assert.deepEqual(seen.A, [[1, false]], 'bản phát xử lý đồng bộ, trước khi publish xong');
  assert.equal(await sent, true);
  await flush();
  assert.deepEqual(seen.A, [[1, false]], 'tin vọng lại của chính A bị bỏ qua — không xử lý hai lần');
  assert.deepEqual(seen.B, [[1, true]]);
  assert.deepEqual(seen.C, [[1, true]]);
});

test('publish: chỉ gửi cho bản khác; Redis chưa sẵn sàng thì trả false ngay, không ném, không treo', async () => {
  const broker = createBroker();
  const a = await makeInstance(broker, 'A');
  const b = await makeInstance(broker, 'B');
  const gotA = []; const gotB = [];
  a.bus.on('x', (p) => gotA.push(p));
  b.bus.on('x', (p) => gotB.push(p));

  assert.equal(await a.bus.publish('x', { k: 1 }), true);
  await flush();
  assert.deepEqual(gotA, []);
  assert.deepEqual(gotB, [{ k: 1 }]);

  a.publisher.drop();
  const before = broker.published.length;
  assert.equal(await a.bus.publish('x', { k: 2 }), false);
  assert.equal(broker.published.length, before, 'không gửi lệnh khi client chưa sẵn sàng');
  // emit vẫn áp dụng cục bộ dù Redis rớt (xuống cấp: chỉ bản này biết)
  a.bus.emit('x', { k: 3 });
  assert.deepEqual(gotA, [{ k: 3 }]);
});

test('không có Redis (publisher null): bus chạy cục bộ, start() trả false', async () => {
  const bus = createBus({ publisher: null, createSubscriber: null, instanceId: 'solo', logger: silentLogger });
  const got = [];
  bus.on('y', (p) => got.push(p));
  assert.equal(await bus.start(), false);
  assert.equal(await bus.emit('y', 1), false);
  assert.deepEqual(got, [1]);
});

test('tin hỏng / thiếu chủ đề bị bỏ qua; handler ném lỗi không chặn handler khác', async () => {
  const errors = [];
  const bus = createBus({ instanceId: 'A', logger: { ...silentLogger, error: (...a) => errors.push(a.join(' ')) } });
  const got = [];
  bus.on('t', () => { throw new Error('hỏng'); });
  bus.on('t', (p) => got.push(p));
  assert.equal(bus._handleMessage('không phải json'), false);
  assert.equal(bus._handleMessage(JSON.stringify({ o: 'B' })), false);
  assert.equal(bus._handleMessage(JSON.stringify({ o: 'A', t: 't', p: 1 })), false, 'tin của chính mình');
  assert.equal(bus._handleMessage(JSON.stringify({ o: 'B', t: 't', p: 2 })), true);
  assert.deepEqual(got, [2]);
  assert.equal(errors.length, 1);
});

test('subscriber nối lại -> onResync chạy (bù tin lỡ khi mất kết nối); lần nối đầu thì không', async () => {
  const broker = createBroker();
  const a = await makeInstance(broker, 'A');
  const b = await makeInstance(broker, 'B');
  let resyncs = 0;
  b.bus.onResync(() => { resyncs += 1; });
  assert.equal(resyncs, 0);

  const gotB = [];
  b.bus.on('t', (p) => gotB.push(p));
  b.subscriber().drop();
  await a.bus.emit('t', 'lỡ');
  await flush();
  assert.deepEqual(gotB, [], 'B đang mất kết nối nên lỡ tin');
  b.subscriber().reconnect();
  assert.equal(resyncs, 1);
});

test('trạng thái khách: quản trị vô hiệu hoá ở bản A -> bộ đệm của bản B đọc lại DB ngay', async () => {
  const broker = createBroker();
  const db = { 42: { is_active: true } };
  let loads = 0;
  const load = async (id) => { loads += 1; return db[id] || null; };

  // Nối giống middleware/authB2C.js
  async function replica(id) {
    const inst = await makeInstance(broker, id);
    const cache = createCustomerStatusCache({ load });
    inst.bus.on('customer-status', (p) => { if (p && p.id != null) cache.invalidate(p.id); });
    inst.bus.onResync(() => cache.clear());
    return { ...inst, cache };
  }
  const A = await replica('A');
  const B = await replica('B');

  assert.equal(await A.cache.getStatus(42), 'active');
  assert.equal(await B.cache.getStatus(42), 'active');
  assert.equal(loads, 2);

  db[42].is_active = false;                                  // route PATCH /customers/:id/status
  await A.bus.emit('customer-status', { id: String(42n) });   // invalidateCustomerStatus(42n)
  await flush();

  assert.equal(await A.cache.getStatus(42), 'inactive');
  assert.equal(await B.cache.getStatus(42), 'inactive', 'không có bus thì B trả "active" tới 30 s');
  assert.equal(loads, 4);
});

test('WebSocket: STOCK_UPDATE từ bản A tới client của MỌI bản, mỗi client đúng một lần', async () => {
  const broker = createBroker();
  const OPEN = 1; const CLOSED = 3;
  const mkClient = (state = OPEN) => ({ readyState: state, got: [], send(d) { this.got.push(d); } });
  const clientsA = [mkClient(), mkClient(CLOSED)];
  const clientsB = [mkClient(), mkClient()];
  const clientsC = [];
  const A = await makeInstance(broker, 'A');
  const B = await makeInstance(broker, 'B');
  const C = await makeInstance(broker, 'C');
  const fanA = createWsFanout({ bus: A.bus, getClients: () => clientsA, openState: OPEN, logger: silentLogger });
  createWsFanout({ bus: B.bus, getClients: () => clientsB, openState: OPEN, logger: silentLogger });
  createWsFanout({ bus: C.bus, getClients: () => clientsC, openState: OPEN, logger: silentLogger });

  await fanA.broadcast('{"type":"STOCK_UPDATE"}');
  await flush();
  assert.deepEqual(clientsA[0].got, ['{"type":"STOCK_UPDATE"}']);
  assert.deepEqual(clientsA[1].got, [], 'client đã đóng không được gửi');
  assert.deepEqual(clientsB[0].got, ['{"type":"STOCK_UPDATE"}']);
  assert.deepEqual(clientsB[1].got, ['{"type":"STOCK_UPDATE"}']);

  // KPI 5 s/lần: chỉ gửi cho client của chính bản đó, không qua bus
  const before = broker.published.length;
  assert.equal(fanA.sendLocal('{"type":"KPI_UPDATE"}'), 1);
  await flush();
  assert.equal(broker.published.length, before);
  assert.equal(clientsB[0].got.length, 1);
});

test('stop(): ngắt subscriber, publish sau đó trả false', async () => {
  const broker = createBroker();
  const A = await makeInstance(broker, 'A');
  await A.bus.stop();
  assert.equal(A.subscriber().isOpen, false);
  assert.equal(await A.bus.publish('t', 1), false);
});
