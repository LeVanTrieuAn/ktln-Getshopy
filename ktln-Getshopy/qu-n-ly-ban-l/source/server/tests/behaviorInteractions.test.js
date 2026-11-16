// Kiểm tra hàm thuần gom hành vi cho AI-Rec /realtime-behavior (giai đoạn 2, 16/11/2026).
// Không cần DB/mạng:  node --test tests/behaviorInteractions.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildBehaviorInteractions: build,
  mergeBufferedEvents,
  readBehaviorConfig,
  normalizeProductId,
} = require('../src/services/behaviorInteractions');

const view = (pid, dwellMs, ts, extra = {}) => ({ product_id: pid, event_type: 'product_view', dwell_time_ms: dwellMs, ts, ...extra });
const cart = (pid, ts, extra = {}) => ({ product_id: pid, event_type: 'add_to_cart', dwell_time_ms: null, ts, ...extra });
const wish = (pid, ts) => ({ product_id: pid, event_type: 'add_to_wishlist', ts });

test('ánh xạ đúng tên sự kiện; chỉ lượt xem mới có dwell_seconds', () => {
  const out = build([view('11', 30000, 3), cart('22', 2), wish('33', 1)]);
  assert.deepEqual(out, [
    { product_id: '11', event_type: 'product_view', dwell_seconds: 30 },
    { product_id: '22', event_type: 'add_to_cart' },
    { product_id: '33', event_type: 'add_to_wishlist' },
  ]);
});

test('không gửi purchase và các loại sự kiện khác', () => {
  const rows = [
    { product_id: '1', event_type: 'purchase', ts: 9 },
    { product_id: '2', event_type: 'remove_from_cart', ts: 8 },
    { product_id: '3', event_type: 'rec_click', ts: 7 },
    { product_id: '4', event_type: 'category_view', ts: 6 },
    { product_id: '5', event_type: 'view', dwell_time_ms: 60000, ts: 5 }, // tên ngắn không phải tên bảng tracking
    cart('6', 4),
  ];
  assert.deepEqual(build(rows), [{ product_id: '6', event_type: 'add_to_cart' }]);
});

test('bỏ mọi tương tác trên món đã mua (mã số hay chuỗi đều khớp)', () => {
  const rows = [view('10', 60000, 5), cart('10', 4), wish(20, 3), view('30', 60000, 2)];
  const out = build(rows, { purchasedIds: [10, '20'] });
  assert.deepEqual(out, [{ product_id: '30', event_type: 'product_view', dwell_seconds: 60 }]);
});

test('gộp lượt xem cùng món: cộng dwell, một mục duy nhất', () => {
  const out = build([view('7', 10000, 1), view('7', 20000, 2), view('7', 30500, 3)]);
  assert.deepEqual(out, [{ product_id: '7', event_type: 'product_view', dwell_seconds: 61 }]);
});

test('kẹp dwell vào [0, 600] giây — AI-Rec trả 422 cả request nếu > 600', () => {
  const out = build([
    view('1', 400000, 6), view('1', 400000, 5),   // tổng 800 s
    view('2', 900000, 4),                          // một lượt vượt trần
    view('3', -50000, 3), view('3', 20000, 2),     // âm coi như 0
    view('4', 'rác', 1), view('4', 8000, 0),
  ]);
  const byId = Object.fromEntries(out.map(o => [o.product_id, o.dwell_seconds]));
  assert.deepEqual(byId, { 1: 600, 2: 600, 3: 20, 4: 8 });
  for (const o of out) assert.ok(o.dwell_seconds >= 0 && o.dwell_seconds <= 600);
});

test('bỏ lượt xem quá ngắn và lượt xem không có dwell (AI-Rec coi 0/trống như 60 s)', () => {
  const rows = [
    view('1', null, 9),
    view('2', 0, 8),
    view('3', undefined, 7),
    view('4', 4999, 6),          // dưới 5 s mặc định
    view('5', 5000, 5),          // đúng ngưỡng: giữ
    view('6', 2000, 4), view('6', 3500, 3), // từng lượt ngắn nhưng tổng 5,5 s: giữ
  ];
  const out = build(rows);
  assert.deepEqual(out.map(o => o.product_id), ['5', '6']);
  assert.equal(out.find(o => o.product_id === '6').dwell_seconds, 6);
});

test('ngưỡng dwell chỉnh được, sàn 1 giây để không bao giờ gửi dwell 0', () => {
  const rows = [view('1', 3000, 3), view('2', 400, 2), view('3', 0, 1)];
  assert.deepEqual(build(rows, { minDwellSeconds: 2 }).map(o => o.product_id), ['1']);
  // minDwellSeconds = 0 vẫn bị nâng lên 1: dwell 0,4 s làm tròn thành 0 sẽ thành "60 s"
  const out = build(rows, { minDwellSeconds: 0 });
  assert.deepEqual(out, [{ product_id: '1', event_type: 'product_view', dwell_seconds: 3 }]);
  assert.deepEqual(build(rows, { minDwellSeconds: 10 }), []);
});

test('thêm giỏ / yêu thích bấm nhiều lần (trang chi tiết ghi hai lần) chỉ còn một mục', () => {
  const out = build([cart('5', 4), cart('5', 3), cart('5', 2), wish('6', 1), wish('6', 0)]);
  assert.deepEqual(out, [
    { product_id: '5', event_type: 'add_to_cart' },
    { product_id: '6', event_type: 'add_to_wishlist' },
  ]);
});

test('vừa xem vừa thêm giỏ cùng món: hai mục (AI-Rec tự cộng trọng số)', () => {
  const out = build([view('8', 120000, 2), cart('8', 3)]);
  assert.deepEqual(out, [
    { product_id: '8', event_type: 'add_to_cart' },
    { product_id: '8', event_type: 'product_view', dwell_seconds: 120 },
  ]);
});

test('bỏ mã sản phẩm không hợp lệ, chuẩn hoá mã hợp lệ', () => {
  const bad = [null, undefined, '', '  ', 'abc', -5, 0, '0', '000', '1.5', 1.5, '12345678901234567890', '1e3', {}];
  const rows = bad.map((pid, i) => cart(pid, i));
  assert.deepEqual(build(rows), []);
  assert.equal(normalizeProductId('007'), '7');
  assert.equal(normalizeProductId(BigInt(42)), '42');
  assert.equal(normalizeProductId(' 15 '), '15');
  assert.equal(normalizeProductId('9223372036854775807'), '9223372036854775807');
});

test('bỏ lượt xem do ô gợi ý dẫn tới (như lúc train), nhưng giữ thêm giỏ từ ô gợi ý', () => {
  const out = build([
    view('1', 60000, 3, { referrer: 'recommendation' }),
    view('2', 60000, 2, { referrer: 'search' }),
    cart('3', 1, { referrer: 'recommendation' }),
  ]);
  assert.deepEqual(out.map(o => o.product_id), ['2', '3']);
});

test('chỉ xét maxEvents sự kiện MỚI NHẤT (theo ts, không theo thứ tự đầu vào)', () => {
  const rows = [cart('1', 100), cart('2', 500), cart('3', 300), cart('4', 400), cart('5', 200)];
  assert.deepEqual(build(rows, { maxEvents: 2 }).map(o => o.product_id), ['2', '4']);
  // giới hạn đếm sự kiện THÔ trước khi gộp: 3 lượt xem cùng món chiếm 3 chỗ
  const views = [view('9', 10000, 10), view('9', 10000, 9), view('9', 10000, 8), cart('1', 7)];
  assert.deepEqual(build(views, { maxEvents: 3 }), [
    { product_id: '9', event_type: 'product_view', dwell_seconds: 30 },
  ]);
});

test('món đã mua không chiếm chỗ trong maxEvents', () => {
  const rows = [cart('1', 9), cart('2', 8), cart('3', 7)];
  const out = build(rows, { maxEvents: 2, purchasedIds: ['1'] });
  assert.deepEqual(out.map(o => o.product_id), ['2', '3']);
});

test('maxEvents = 0 tắt hẳn; đầu vào rỗng/sai kiểu trả []', () => {
  assert.deepEqual(build([cart('1', 1)], { maxEvents: 0 }), []);
  assert.deepEqual(build([]), []);
  assert.deepEqual(build(null), []);
  assert.deepEqual(build([null, undefined, 42, 'x']), []);
});

test('xếp món có sự kiện mới nhất lên trước; thiếu ts thì giữ thứ tự đầu vào', () => {
  const out = build([cart('1', 10), view('2', 60000, 5), view('2', 60000, 50), wish('3', 20)]);
  assert.deepEqual(out.map(o => o.product_id), ['2', '3', '1']);
  assert.deepEqual(build([cart('1'), cart('2'), cart('3')]).map(o => o.product_id), ['1', '2', '3']);
});

test('không bao giờ vượt 500 mục (REALTIME_MAX_INTERACTIONS), kể cả maxEvents quá lớn', () => {
  const rows = Array.from({ length: 1200 }, (_, i) => cart(String(i + 1), i));
  const out = build(rows, { maxEvents: 100000 });
  assert.equal(out.length, 500);
  assert.equal(out[0].product_id, '1200');
});

test('ngẫu nhiên: mọi mục luôn hợp lệ với schema AI-Rec', () => {
  let seed = 20261116;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const types = ['product_view', 'add_to_cart', 'add_to_wishlist', 'purchase', 'identify'];
  const rows = Array.from({ length: 2000 }, (_, i) => ({
    product_id: rnd() < 0.05 ? 'x' : String(1 + Math.floor(rnd() * 300)),
    event_type: types[Math.floor(rnd() * types.length)],
    dwell_time_ms: rnd() < 0.2 ? null : Math.floor(rnd() * 900000) - 1000,
    ts: i,
  }));
  const out = build(rows, { maxEvents: 500, purchasedIds: ['1', '2', '3'] });
  const keys = new Set();
  for (const o of out) {
    assert.match(o.product_id, /^[1-9][0-9]*$/);
    assert.ok(!['1', '2', '3'].includes(o.product_id));
    assert.ok(['product_view', 'add_to_cart', 'add_to_wishlist'].includes(o.event_type));
    if (o.event_type === 'product_view') {
      assert.ok(Number.isInteger(o.dwell_seconds) && o.dwell_seconds >= 5 && o.dwell_seconds <= 600);
    } else {
      assert.equal(o.dwell_seconds, undefined);
    }
    const k = `${o.event_type}|${o.product_id}`;
    assert.ok(!keys.has(k), `trùng ${k}`);
    keys.add(k);
  }
  assert.ok(out.length > 0 && out.length <= 500);
});

test('mergeBufferedEvents: sự kiện chưa flush đứng trước, lọc trùng với bảng, cắt theo limit', () => {
  const pending = [cart('1', 100), view('2', 9000, 200), cart('3', 300)];   // thứ tự ghi: cũ trước
  const stored = [cart('3', 300), view('4', 7000, 50), cart('5', 40)];       // '3' đã flush xong
  assert.deepEqual(mergeBufferedEvents(pending, stored, 10).map(e => `${e.product_id}@${e.ts}`),
    ['2@200', '1@100', '3@300', '4@50', '5@40']);
  assert.equal(mergeBufferedEvents(pending, stored, 2).length, 2);
  // cùng món cùng loại nhưng KHÁC mốc là hai lượt khác nhau: không được gộp mất
  assert.equal(mergeBufferedEvents([cart('3', 301)], stored, 10).length, 4);
  assert.deepEqual(mergeBufferedEvents([], [], 5), []);
  assert.equal(pending.length, 3, 'không sửa mảng đầu vào');
  assert.equal(pending[0].product_id, '1');
});

test('readBehaviorConfig: mặc định, đọc số, kẹp biên, giá trị rác', () => {
  assert.deepEqual(readBehaviorConfig({}), { windowHours: 72, maxEvents: 100, minDwellSeconds: 5 });
  assert.deepEqual(readBehaviorConfig({
    AI_REC_BEHAVIOR_WINDOW_HOURS: '48', AI_REC_BEHAVIOR_MAX_EVENTS: '0', AI_REC_BEHAVIOR_MIN_DWELL_SECONDS: '10',
  }), { windowHours: 48, maxEvents: 0, minDwellSeconds: 10 });
  assert.deepEqual(readBehaviorConfig({
    AI_REC_BEHAVIOR_WINDOW_HOURS: '99999', AI_REC_BEHAVIOR_MAX_EVENTS: '9999', AI_REC_BEHAVIOR_MIN_DWELL_SECONDS: '0',
  }), { windowHours: 2160, maxEvents: 500, minDwellSeconds: 1 });
  assert.deepEqual(readBehaviorConfig({
    AI_REC_BEHAVIOR_WINDOW_HOURS: 'abc', AI_REC_BEHAVIOR_MAX_EVENTS: ' ', AI_REC_BEHAVIOR_MIN_DWELL_SECONDS: '-3',
  }), { windowHours: 72, maxEvents: 100, minDwellSeconds: 1 });
});
