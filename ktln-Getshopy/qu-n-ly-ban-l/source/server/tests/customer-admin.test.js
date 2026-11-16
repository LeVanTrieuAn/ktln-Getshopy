// Kiểm thử đơn vị cho quản lý khách hàng ở trang quản trị (16/11/2026):
//   services/customerAdmin.js      kiểm dữ liệu nhập, payload Prisma, JSON trả ra, mật khẩu ban đầu,
//                                  thư hướng dẫn (mail giả)
//   services/customerStatusCache.js bộ đệm trạng thái tài khoản cho authB2C
//   middleware/authB2CCore.js      authB2C / optionalAuthB2C từ chối tài khoản bị vô hiệu hoá
// Không cần Postgres, Redis hay node_modules:
//   node --test tests/customer-admin.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const ca = require('../src/services/customerAdmin');
const { createCustomerStatusCache } = require('../src/services/customerStatusCache');
const { createAuthB2C, MSG_ACCOUNT_DISABLED } = require('../src/middleware/authB2CCore');

// ─── Mã khách trên URL ──────────────────────────────────────────────────────

test('parseCustomerId: chỉ nhận chữ số, > 0, tối đa 18 chữ số', () => {
  assert.equal(ca.parseCustomerId('3822'), 3822n);
  assert.equal(ca.parseCustomerId('000123'), 123n);
  for (const bad of ['0', '-1', '1e3', '12a', ' 12', '', undefined, null, '1234567890123456789', '1.5']) {
    assert.equal(ca.parseCustomerId(bad), null, `phải từ chối ${JSON.stringify(bad)}`);
  }
});

// ─── Tạo khách ──────────────────────────────────────────────────────────────

test('validateCreateCustomer: dữ liệu đúng -> chuẩn hoá email chữ thường, SĐT 0xxx, điểm mặc định 0, gửi thư mặc định bật', () => {
  const r = ca.validateCreateCustomer({ full_name: '  Nguyễn Văn An ', email: ' An.Nguyen@Gmail.COM ', phone: '+84 912 345 678' });
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.deepEqual(r.value, {
    full_name: 'Nguyễn Văn An',
    email: 'an.nguyen@gmail.com',
    phone: '0912345678',
    loyalty_points: 0,
    send_welcome_email: true,
  });
});

test('validateCreateCustomer: SĐT để trống được, điểm nhận chuỗi chữ số, tắt gửi thư', () => {
  const r = ca.validateCreateCustomer({ full_name: 'Bé Na', email: 'na@example.com', phone: '', loyalty_points: '250', send_welcome_email: false });
  assert.equal(r.ok, true);
  assert.equal(r.value.phone, '');
  assert.equal(r.value.loyalty_points, 250);
  assert.equal(r.value.send_welcome_email, false);
});

test('validateCreateCustomer: báo đủ lỗi bằng tiếng Việt', () => {
  const r = ca.validateCreateCustomer({ full_name: 'A', email: 'khong-phai-email', phone: '0163789557vhvbj', loyalty_points: -5, send_welcome_email: 'yes' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, [ca.MSG.SEND_FLAG, ca.MSG.NAME, ca.MSG.EMAIL, ca.MSG.PHONE, ca.MSG.POINTS]);
});

test('validateCreateCustomer: điểm phải là số nguyên trong [0, LOYALTY_POINTS_MAX]', () => {
  const base = { full_name: 'Trần Bình', email: 'b@example.com' };
  for (const ok of [0, 1, ca.LOYALTY_POINTS_MAX, '42']) {
    assert.equal(ca.validateCreateCustomer({ ...base, loyalty_points: ok }).ok, true, `phải nhận ${ok}`);
  }
  for (const bad of [1.5, ca.LOYALTY_POINTS_MAX + 1, '1e3', '12abc', true, [], {}, NaN, Infinity]) {
    assert.equal(ca.validateCreateCustomer({ ...base, loyalty_points: bad }).ok, false, `phải từ chối ${String(bad)}`);
  }
});

test('validateCreateCustomer: body không phải object -> lỗi chung', () => {
  for (const b of [null, undefined, 'x', [1]]) {
    const r = ca.validateCreateCustomer(b);
    assert.equal(r.ok, false);
    assert.deepEqual(r.errors, [ca.MSG.BODY]);
  }
});

test('buildCreateData: provider local, đang hoạt động, KHÔNG có password_hash (route tự băm)', () => {
  const v = ca.validateCreateCustomer({ full_name: 'Lê Chi', email: 'chi+shop@example.com', loyalty_points: 10 }).value;
  const d = ca.buildCreateData(v);
  assert.equal(d.provider, 'local');
  assert.equal(d.is_active, true);
  assert.equal(d.loyalty_points, 10);
  assert.equal(d.phone, '');
  assert.equal('password_hash' in d, false);
  assert.match(d.avatar, /seed=chi%2Bshop%40example\.com$/);
});

test('generateInitialPassword: 32 ký tự base64url từ 24 byte CSPRNG, mỗi lần một khác', () => {
  const a = ca.generateInitialPassword();
  const b = ca.generateInitialPassword();
  assert.match(a, /^[A-Za-z0-9_-]{32}$/);
  assert.notEqual(a, b);
  // Dùng đúng nguồn ngẫu nhiên được truyền vào (đủ 24 byte).
  let asked = 0;
  const fixed = ca.generateInitialPassword((n) => { asked = n; return Buffer.alloc(n, 0xff); });
  assert.equal(asked, 24);
  assert.equal(fixed, '_'.repeat(32));
});

test('buildLoyaltyAdjustment: điểm quản trị đặt đi qua sổ cái ADMIN_ADJUST, 0 thì không ghi', () => {
  assert.equal(ca.buildLoyaltyAdjustment(5n, 0), null);
  assert.deepEqual(ca.buildLoyaltyAdjustment(5n, -30), {
    customer_id: 5n, order_id: null, points: -30, reason: 'ADMIN_ADJUST', status: 'COMMITTED',
  });
});

// ─── Sửa khách ──────────────────────────────────────────────────────────────

const LOCAL = { email: 'An.Hoa@Example.com', provider: 'local', loyalty_points: 100 };
const GOOGLE = { email: 'g1@gmail.com', provider: 'local,google', loyalty_points: 0 };

test('isEmailEditable: chỉ tài khoản thuần local', () => {
  assert.equal(ca.isEmailEditable('local'), true);
  assert.equal(ca.isEmailEditable(''), true); // cột mặc định 'local'
  for (const p of ['google', 'local,google', 'google,local', 'facebook']) assert.equal(ca.isEmailEditable(p), false, p);
});

test('validateUpdateCustomer: chỉ trường có gửi mới đổi; điểm bằng số cũ thì bỏ qua', () => {
  const r = ca.validateUpdateCustomer({ full_name: ' Hoa Lê ', loyalty_points: 100 }, LOCAL);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { full_name: 'Hoa Lê' });
});

test('validateUpdateCustomer: xoá SĐT lưu chuỗi rỗng, SĐT sai báo lỗi', () => {
  assert.deepEqual(ca.validateUpdateCustomer({ phone: null }, LOCAL).data, { phone: '' });
  assert.deepEqual(ca.validateUpdateCustomer({ phone: '0283 812 3456' }, LOCAL).data, { phone: '02838123456' });
  assert.deepEqual(ca.validateUpdateCustomer({ phone: '0123' }, LOCAL).errors, [ca.MSG.PHONE]);
});

test('validateUpdateCustomer: gửi lại email hiện tại (khác hoa thường) KHÔNG hạ chữ thường email cũ', () => {
  const r = ca.validateUpdateCustomer({ email: 'an.hoa@example.com', phone: '0912345678' }, LOCAL);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { phone: '0912345678' });
});

test('validateUpdateCustomer: đổi email tài khoản local -> chữ thường; email sai -> lỗi', () => {
  assert.deepEqual(ca.validateUpdateCustomer({ email: ' Moi@Example.com ' }, LOCAL).data, { email: 'moi@example.com' });
  assert.deepEqual(ca.validateUpdateCustomer({ email: 'moi@' }, LOCAL).errors, [ca.MSG.EMAIL]);
});

test('validateUpdateCustomer: tài khoản có Google không đổi được email, nhưng gửi lại đúng email cũ thì qua', () => {
  const r = ca.validateUpdateCustomer({ email: 'khac@gmail.com', full_name: 'Gia Bảo' }, GOOGLE);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, [ca.MSG.EMAIL_LOCKED]);
  const same = ca.validateUpdateCustomer({ email: 'G1@gmail.com', full_name: 'Gia Bảo' }, GOOGLE);
  assert.equal(same.ok, true);
  assert.deepEqual(same.data, { full_name: 'Gia Bảo' });
});

test('validateUpdateCustomer: điểm sai kiểu / âm / quá trần -> lỗi; body rỗng -> data rỗng', () => {
  for (const bad of [-1, 2.5, 'abc', null, ca.LOYALTY_POINTS_MAX + 1]) {
    assert.deepEqual(ca.validateUpdateCustomer({ loyalty_points: bad }, LOCAL).errors, [ca.MSG.POINTS], String(bad));
  }
  assert.deepEqual(ca.validateUpdateCustomer({}, LOCAL), { ok: true, errors: [], data: {} });
});

test('parseStatusBody: chỉ boolean thật', () => {
  assert.equal(ca.parseStatusBody({ active: false }), false);
  assert.equal(ca.parseStatusBody({ active: true }), true);
  for (const b of [{ active: 'false' }, { active: 0 }, {}, null, []]) assert.equal(ca.parseStatusBody(b), null);
});

// ─── Danh sách ──────────────────────────────────────────────────────────────

test('buildCustomerListWhere: lọc trạng thái + tìm kiếm', () => {
  assert.deepEqual(ca.buildCustomerListWhere({}).where, {});
  assert.deepEqual(ca.buildCustomerListWhere({ status: 'active' }).where, { is_active: true });
  assert.deepEqual(ca.buildCustomerListWhere({ status: 'inactive' }).where, { is_active: false });
  assert.deepEqual(ca.buildCustomerListWhere({ status: 'deactivated' }).where, { is_active: false });
  const w = ca.buildCustomerListWhere({ search: ' 3822 ', status: 'inactive' }).where;
  assert.equal(w.is_active, false);
  assert.equal(w.OR.length, 4);
  assert.deepEqual(w.OR[3], { id: 3822n });
  assert.equal(ca.buildCustomerListWhere({ search: 'an' }).where.OR.length, 3);
  const bad = ca.buildCustomerListWhere({ status: 'deleted' });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, ca.MSG.STATUS_FILTER);
});

test('toCustomerDto: id số thường, không bao giờ có password_hash, có email_editable', () => {
  const dto = ca.toCustomerDto({
    id: 7n, full_name: 'X Y', email: 'x@y.vn', phone: null, loyalty_points: 3, avatar: null,
    provider: 'google', created_at: new Date(0), is_active: false, deactivated_at: new Date(1), password_hash: 'h',
  });
  assert.equal(dto.id, 7);
  assert.equal(dto.phone, '');
  assert.equal(dto.is_active, false);
  assert.equal(dto.email_editable, false);
  assert.equal('password_hash' in dto, false);
  assert.equal(JSON.parse(JSON.stringify(dto)).id, 7);
  assert.equal('password_hash' in ca.CUSTOMER_SELECT, false);
});

test('toOrderStats: BigInt / null từ $queryRaw -> số thường', () => {
  assert.deepEqual(ca.toOrderStats({ order_count: 624, paid_order_count: 600, total_spent: 123456789n, last_order_date: null }),
    { order_count: 624, paid_order_count: 600, total_spent: 123456789, last_order_date: null });
  assert.deepEqual(ca.toOrderStats(undefined), { order_count: 0, paid_order_count: 0, total_spent: 0, last_order_date: null });
});

// ─── Thư hướng dẫn đặt mật khẩu (mail giả) ─────────────────────────────────

const quiet = { warn() {}, error() {} };
const CUSTOMER = { id: 1, full_name: 'Nguyễn An', email: 'an@example.com' };

test('sendWelcomeEmail: bỏ chọn -> không gọi mail', async () => {
  let called = 0;
  const mail = { configError: () => null, sendAccountCreated: async () => { called += 1; } };
  const r = await ca.sendWelcomeEmail({ mail, customer: CUSTOMER, requested: false, logger: quiet });
  assert.equal(r.code, 'NOT_REQUESTED');
  assert.equal(r.sent, false);
  assert.equal(called, 0);
});

test('sendWelcomeEmail: chưa cấu hình SMTP -> báo quản trị, không gửi, không ném lỗi', async () => {
  let called = 0;
  const mail = { configError: () => 'thiếu SMTP_HOST, MAIL_FROM', sendAccountCreated: async () => { called += 1; } };
  const r = await ca.sendWelcomeEmail({ mail, customer: CUSTOMER, requested: true, logger: quiet });
  assert.equal(r.code, 'MAIL_NOT_CONFIGURED');
  assert.equal(r.sent, false);
  assert.match(r.message, /Quên mật khẩu/);
  assert.doesNotMatch(r.message, /SMTP_HOST/); // lý do kỹ thuật chỉ ghi log
  assert.equal(called, 0);
});

test('sendWelcomeEmail: SMTP lỗi -> sent=false, KHÔNG ném lỗi (tạo khách vẫn thành công)', async () => {
  const mail = { configError: () => null, sendAccountCreated: async () => { throw Object.assign(new Error('535 auth'), { code: 'EAUTH' }); } };
  const r = await ca.sendWelcomeEmail({ mail, customer: CUSTOMER, requested: true, logger: quiet });
  assert.equal(r.code, 'MAIL_FAILED');
  assert.equal(r.sent, false);
});

test('sendWelcomeEmail: gửi được -> đúng người nhận, chỉ email + họ tên (không có mật khẩu)', async () => {
  const calls = [];
  const mail = { configError: () => null, sendAccountCreated: async (args) => { calls.push(args); } };
  const r = await ca.sendWelcomeEmail({ mail, customer: CUSTOMER, requested: true, logger: quiet });
  assert.equal(r.code, 'SENT');
  assert.equal(r.sent, true);
  assert.deepEqual(calls, [{ to: 'an@example.com', fullName: 'Nguyễn An' }]);
});

// ─── Bộ đệm trạng thái ──────────────────────────────────────────────────────

function fakeLoader(rows) {
  const calls = [];
  const load = async (id) => { calls.push(id); return id in rows ? rows[id] : null; };
  return { load, calls };
}

test('customerStatusCache: đệm theo TTL, hết TTL thì đọc lại', async () => {
  const clock = { t: 0 };
  const db = fakeLoader({ 1: { is_active: true } });
  const cache = createCustomerStatusCache({ load: db.load, ttlMs: 30_000, now: () => clock.t });
  assert.equal(await cache.getStatus(1), 'active');
  assert.equal(await cache.getStatus(1), 'active');
  assert.equal(db.calls.length, 1);
  clock.t = 30_001;
  assert.equal(await cache.getStatus(1), 'active');
  assert.equal(db.calls.length, 2);
});

test('customerStatusCache: inactive / missing', async () => {
  const db = fakeLoader({ 2: { is_active: false } });
  const cache = createCustomerStatusCache({ load: db.load });
  assert.equal(await cache.getStatus(2), 'inactive');
  assert.equal(await cache.getStatus(99), 'missing');
});

test('customerStatusCache: invalidate -> lần sau đọc DB ngay (vô hiệu hoá có hiệu lực tức thì)', async () => {
  const rows = { 3: { is_active: true } };
  const db = fakeLoader(rows);
  const cache = createCustomerStatusCache({ load: db.load });
  assert.equal(await cache.getStatus(3), 'active');
  rows[3] = { is_active: false };
  assert.equal(await cache.getStatus(3), 'active'); // còn trong bộ đệm
  cache.invalidate(3n); // route quản trị truyền BigInt
  assert.equal(await cache.getStatus(3), 'inactive');
});

test('customerStatusCache: nhiều request cùng lúc chỉ tốn một truy vấn', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  let calls = 0;
  const cache = createCustomerStatusCache({ load: async () => { calls += 1; await gate; return { is_active: true }; } });
  const all = Promise.all(Array.from({ length: 20 }, () => cache.getStatus(4)));
  release();
  assert.deepEqual(new Set(await all), new Set(['active']));
  assert.equal(calls, 1);
});

test('customerStatusCache: truy vấn bắt đầu TRƯỚC invalidate không ghi đè trạng thái mới', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const rows = { 5: { is_active: false } };
  let first = true;
  const cache = createCustomerStatusCache({
    // Lần đọc đầu trả ảnh chụp CŨ ("active") sau khi treo ở gate — mô phỏng truy vấn chạy
    // trước lệnh vô hiệu hoá nhưng trả về sau.
    load: async (id) => { if (first) { first = false; await gate; return { is_active: true }; } return rows[id]; },
  });
  const stale = cache.getStatus(5);
  cache.invalidate(5); // quản trị vô hiệu hoá trong lúc đó
  release();
  assert.equal(await stale, 'active');
  assert.equal(await cache.getStatus(5), 'inactive');
});

test('customerStatusCache: lỗi DB ném ra cho người gọi và không bị đệm; load ném đồng bộ cũng dọn sạch', async () => {
  let fail = true;
  const cache = createCustomerStatusCache({ load: (id) => { if (fail) throw new Error('db down'); return { is_active: true }; } });
  await assert.rejects(cache.getStatus(6), /db down/);
  fail = false;
  assert.equal(await cache.getStatus(6), 'active');
});

test('customerStatusCache: trần số mục, bỏ mục cũ nhất', async () => {
  const db = fakeLoader({ 1: { is_active: true }, 2: { is_active: true }, 3: { is_active: true } });
  const cache = createCustomerStatusCache({ load: db.load, maxEntries: 2 });
  await cache.getStatus(1); await cache.getStatus(2); await cache.getStatus(3);
  assert.equal(cache.size(), 2);
  await cache.getStatus(1);
  assert.equal(db.calls.filter((x) => x === 1).length, 2);
});

// ─── authB2C / optionalAuthB2C ──────────────────────────────────────────────

function fakeRes() {
  return {
    statusCode: 200, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

function makeAuth(statusById, { failLoad = false } = {}) {
  const tokens = {
    'tok-active': { id: 1, role: 'customer' },
    'tok-inactive': { id: 2, role: 'customer' },
    'tok-missing': { id: 99, role: 'customer' },
    'tok-admin': { id: 1, role: 'admin' },
    'tok-badid': { id: 'abc', role: 'customer' },
  };
  const verifyToken = (t) => {
    if (t === 'tok-expired') throw Object.assign(new Error('jwt expired'), { name: 'TokenExpiredError' });
    if (!tokens[t]) throw Object.assign(new Error('invalid'), { name: 'JsonWebTokenError' });
    return tokens[t];
  };
  const loads = [];
  const statusCache = createCustomerStatusCache({
    load: async (id) => { loads.push(id); if (failLoad) throw new Error('db down'); return statusById[id] ?? null; },
  });
  return { ...createAuthB2C({ verifyToken, statusCache, logger: quiet }), statusCache, loads };
}

async function run(mw, token) {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = fakeRes();
  let nexted = false;
  await mw(req, res, () => { nexted = true; });
  return { req, res, nexted };
}

const STATUS = { 1: { is_active: true }, 2: { is_active: false } };

test('authB2C: tài khoản đang hoạt động -> qua, gắn req.b2cUser', async () => {
  const { authB2C } = makeAuth(STATUS);
  const { req, nexted } = await run(authB2C, 'tok-active');
  assert.equal(nexted, true);
  assert.deepEqual(req.b2cUser, { id: 1, role: 'customer' });
});

test('authB2C: tài khoản bị vô hiệu hoá -> 401 ACCOUNT_DISABLED, câu báo tiếng Việt', async () => {
  const { authB2C } = makeAuth(STATUS);
  const { res, nexted, req } = await run(authB2C, 'tok-inactive');
  assert.equal(nexted, false);
  assert.equal(req.b2cUser, undefined);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: MSG_ACCOUNT_DISABLED, code: 'ACCOUNT_DISABLED' });
  assert.equal(MSG_ACCOUNT_DISABLED, 'Tài khoản đã bị vô hiệu hoá, vui lòng liên hệ cửa hàng');
});

test('authB2C: token của khách không còn trong DB -> 401 ACCOUNT_NOT_FOUND', async () => {
  const { authB2C } = makeAuth(STATUS);
  const { res, nexted } = await run(authB2C, 'tok-missing');
  assert.equal(nexted, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'ACCOUNT_NOT_FOUND');
});

test('authB2C: hành vi cũ giữ nguyên (thiếu token, hết hạn, sai, token admin, id lạ) và KHÔNG hỏi DB', async () => {
  const { authB2C, loads } = makeAuth(STATUS);
  assert.equal((await run(authB2C, null)).res.statusCode, 401);
  const exp = await run(authB2C, 'tok-expired');
  assert.equal(exp.res.statusCode, 401);
  assert.equal(exp.res.body.code, 'TOKEN_EXPIRED');
  assert.equal((await run(authB2C, 'tok-garbage')).res.body.code, 'TOKEN_INVALID');
  assert.equal((await run(authB2C, 'tok-admin')).res.statusCode, 403);
  assert.equal((await run(authB2C, 'tok-badid')).res.body.code, 'TOKEN_INVALID');
  assert.equal(loads.length, 0);
});

test('authB2C: DB lỗi -> 503, không cho qua', async () => {
  const { authB2C } = makeAuth(STATUS, { failLoad: true });
  const { res, nexted } = await run(authB2C, 'tok-active');
  assert.equal(nexted, false);
  assert.equal(res.statusCode, 503);
});

test('authB2C: vô hiệu hoá rồi invalidate -> request kế tiếp bị chặn ngay', async () => {
  const rows = { 1: { is_active: true } };
  const { authB2C, statusCache } = makeAuth(rows);
  assert.equal((await run(authB2C, 'tok-active')).nexted, true);
  rows[1] = { is_active: false };
  statusCache.invalidate(1n);
  const after = await run(authB2C, 'tok-active');
  assert.equal(after.nexted, false);
  assert.equal(after.res.body.code, 'ACCOUNT_DISABLED');
});

test('optionalAuthB2C: luôn cho qua; chỉ tài khoản đang hoạt động mới được nhận diện', async () => {
  const { optionalAuthB2C } = makeAuth(STATUS);
  const a = await run(optionalAuthB2C, 'tok-active');
  assert.equal(a.nexted, true);
  assert.deepEqual(a.req.b2cUser, { id: 1, role: 'customer' });
  for (const t of ['tok-inactive', 'tok-missing', 'tok-admin', 'tok-expired', null]) {
    const r = await run(optionalAuthB2C, t);
    assert.equal(r.nexted, true, String(t));
    assert.equal(r.req.b2cUser, undefined, String(t));
  }
  const failing = makeAuth(STATUS, { failLoad: true });
  const f = await run(failing.optionalAuthB2C, 'tok-active');
  assert.equal(f.nexted, true);
  assert.equal(f.req.b2cUser, undefined);
});
