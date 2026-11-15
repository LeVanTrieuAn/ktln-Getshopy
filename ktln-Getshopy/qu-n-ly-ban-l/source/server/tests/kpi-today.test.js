// Kiểm thử đơn vị cho services/KpiTodayService.js (16/11/2026): chọn nguồn số hôm nay
// (nhánh nóng / kho) và các đường dự phòng. Không cần ClickHouse, Redis hay node_modules:
//   node --test tests/kpi-today.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createKpiToday, toKpiFields, hotTodaySql, warehouseTodaySql, REVENUE_RULES, PROBE_TTL_MS,
} = require('../src/services/KpiTodayService');

const TODAY = '2026-11-16';
const HOT_ROW = { revenue_today: '1500000', revenue_yesterday: '1000000', orders_today: '3', voided_today: '0', all_orders_today: '4' };
const WH_ROW = { revenue_today: '900000', revenue_yesterday: '1000000', orders_today: '2', voided_today: '0', all_orders_today: '2' };

// ClickHouse giả: trả lời theo nội dung câu SQL, ghi lại từng câu đã chạy.
function fakeCh({ meta = { objects: '3', assigned: '1', poll_age_s: '0' }, missing = '0', hotError = null, metaError = null } = {}) {
  const calls = [];
  const chHot = async (sql) => {
    calls.push(sql);
    if (sql.includes('system.tables')) { if (metaError) throw metaError; return [meta]; }
    if (sql.includes('missing_in_hot')) return [{ hot_orders: '4', warehouse_orders: '2', missing_in_hot: missing }];
    if (sql.includes('realtime.orders_live FINAL')) { if (hotError) throw hotError; return [HOT_ROW]; }
    throw new Error('câu lạ: ' + sql);
  };
  const whCalls = [];
  const chWarehouse = async (sql) => { whCalls.push(sql); return [WH_ROW]; };
  return { chHot, chWarehouse, calls, whCalls };
}

function make(ch, clock = { t: 1_000_000 }) {
  const logs = [];
  const logger = { log: (m) => logs.push(['log', m]), warn: (m) => logs.push(['warn', m]) };
  const svc = createKpiToday({
    chHot: ch.chHot, chWarehouse: ch.chWarehouse, tz: 'Asia/Ho_Chi_Minh',
    today: () => TODAY, logger, now: () => clock.t,
  });
  return { svc, logs, clock };
}

test('hôm nay + tất cả chi nhánh + nhánh nóng khoẻ -> realtime', async () => {
  const ch = fakeCh();
  const { svc, logs } = make(ch);
  const t = await svc.fetchToday({ date: TODAY });
  assert.equal(t.source, 'realtime');
  assert.equal(t.revenue_today, 1500000);
  assert.equal(t.orders_today, 3);
  assert.equal(ch.whCalls.length, 0);
  assert.deepEqual(logs, [['log', '[KPI] Số hôm nay: nhánh nóng realtime.orders_live']]);
});

test('lọc chi nhánh -> kho, không chạm nhánh nóng, không ghi log', async () => {
  const ch = fakeCh();
  const { svc, logs } = make(ch);
  const t = await svc.fetchToday({ date: TODAY, branchId: 'BR01' });
  assert.equal(t.source, 'warehouse');
  assert.equal(ch.calls.length, 0);
  assert.match(ch.whCalls[0], /AND branch_id = 'BR01'/);
  assert.equal(logs.length, 0);
});

test("branch_id = 'ALL' coi như không lọc", async () => {
  const ch = fakeCh();
  const { svc } = make(ch);
  assert.equal((await svc.fetchToday({ date: TODAY, branchId: 'ALL' })).source, 'realtime');
});

test('ngày khác hôm nay -> kho', async () => {
  const ch = fakeCh();
  const { svc } = make(ch);
  const t = await svc.fetchToday({ date: '2026-11-12' });
  assert.equal(t.source, 'warehouse');
  assert.equal(ch.calls.length, 0);
});

test('thiếu bảng realtime -> kho, ghi log cảnh báo đúng một lần', async () => {
  const ch = fakeCh({ meta: { objects: '1', assigned: '0', poll_age_s: '999' } });
  const { svc, logs } = make(ch);
  const a = await svc.fetchToday({ date: TODAY });
  const b = await svc.fetchToday({ date: TODAY });
  assert.equal(a.source, 'warehouse');
  assert.match(a.reason, /thiếu đối tượng nhánh nóng \(1\/3/);
  assert.equal(b.source, 'warehouse');
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], 'warn');
});

test('consumer chưa nhận partition / không poll -> kho', async () => {
  let r = await make(fakeCh({ meta: { objects: '3', assigned: '0', poll_age_s: '0' } })).svc.fetchToday({ date: TODAY });
  assert.equal(r.source, 'warehouse');
  assert.match(r.reason, /chưa nhận partition/);
  r = await make(fakeCh({ meta: { objects: '3', assigned: '1', poll_age_s: '600' } })).svc.fetchToday({ date: TODAY });
  assert.equal(r.source, 'warehouse');
  assert.match(r.reason, /không poll/);
});

test('nhánh nóng thiếu đơn mà kho đã có -> kho', async () => {
  const r = await make(fakeCh({ missing: '2' })).svc.fetchToday({ date: TODAY });
  assert.equal(r.source, 'warehouse');
  assert.match(r.reason, /thiếu 2\/2 đơn/);
});

test('ClickHouse lỗi lúc kiểm tra -> kho', async () => {
  const r = await make(fakeCh({ metaError: new Error('ECONNREFUSED') })).svc.fetchToday({ date: TODAY });
  assert.equal(r.source, 'warehouse');
  assert.match(r.reason, /ECONNREFUSED/);
});

test('truy vấn nhánh nóng lỗi -> kho ngay lượt đó, lượt sau kiểm tra lại', async () => {
  const ch = fakeCh({ hotError: new Error("Table realtime.orders_live does not exist") });
  const { svc, clock } = make(ch);
  const a = await svc.fetchToday({ date: TODAY });
  assert.equal(a.source, 'warehouse');
  assert.match(a.reason, /truy vấn nhánh nóng lỗi/);
  const metaBefore = ch.calls.filter((s) => s.includes('system.tables')).length;
  clock.t += 1000;
  const b = await svc.fetchToday({ date: TODAY });
  assert.equal(b.source, 'warehouse');
  // Kết quả kiểm tra bị đánh dấu hỏng: trong 30 s không thử câu KPI nhánh nóng nữa.
  assert.equal(ch.calls.filter((s) => s.includes('system.tables')).length, metaBefore);
  clock.t += PROBE_TTL_MS;
  ch.calls.length = 0;
  await svc.fetchToday({ date: TODAY });
  assert.ok(ch.calls.some((s) => s.includes('system.tables')), 'quá 30 s phải kiểm tra lại');
});

test('kết quả kiểm tra dùng lại trong 30 s', async () => {
  const ch = fakeCh();
  const { svc, clock } = make(ch);
  await svc.fetchToday({ date: TODAY });
  clock.t += PROBE_TTL_MS - 1;
  await svc.fetchToday({ date: TODAY });
  assert.equal(ch.calls.filter((s) => s.includes('system.tables')).length, 1);
  clock.t += 2;
  await svc.fetchToday({ date: TODAY });
  assert.equal(ch.calls.filter((s) => s.includes('system.tables')).length, 2);
});

test('warehouseQuery truyền vào (circuit breaker của REST) được dùng thay chWarehouse', async () => {
  const ch = fakeCh();
  const { svc } = make(ch);
  const seen = [];
  await svc.fetchToday({ date: '2026-11-12', warehouseQuery: async (q) => { seen.push(q); return [WH_ROW]; } });
  assert.equal(seen.length, 1);
  assert.equal(ch.whCalls.length, 0);
});

test('toKpiFields: % so với hôm qua, giá trị đơn TB theo đơn, tỷ lệ huỷ theo đơn', () => {
  const k = toKpiFields({ source: 'realtime', revenue_today: 1500000, revenue_yesterday: 1000000, orders_today: 3, voided_today: 1, all_orders_today: 4 });
  assert.deepEqual(k, { revenue_today: 1500000, revenue_vs_yesterday_pct: 50, orders_today: 3, avg_order_value: 500000, void_rate: 25, source: 'realtime' });
  const z = toKpiFields({ source: 'warehouse', revenue_today: 0, revenue_yesterday: 0, orders_today: 0, voided_today: 0, all_orders_today: 0 });
  assert.equal(z.revenue_vs_yesterday_pct, 0);
  assert.equal(z.avg_order_value, 0);
  assert.equal(z.void_rate, 0);
});

test('SQL dùng đúng một quy tắc trạng thái cho cả hai nhánh', () => {
  const h = hotTodaySql(TODAY, 'Asia/Ho_Chi_Minh');
  const w = warehouseTodaySql(TODAY, 'Asia/Ho_Chi_Minh');
  assert.ok(h.includes(REVENUE_RULES.paid_or_confirmed.hot));
  assert.ok(w.includes(REVENUE_RULES.paid_or_confirmed.warehouse));
  assert.ok(h.includes('FROM realtime.orders_live FINAL'));
  assert.ok(w.includes('uniqExactIf(order_id'), 'kho phải đếm đơn, không đếm dòng');
  assert.ok(hotTodaySql(TODAY, 'UTC', 'paid_only').includes("sumIf(sub_total, d = toDate('2026-11-16') AND payment_status = 'PAID')"));
});
