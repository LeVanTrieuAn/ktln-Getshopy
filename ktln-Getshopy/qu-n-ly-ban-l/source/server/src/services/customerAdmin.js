'use strict';
/**
 * Quản lý khách hàng ở trang quản trị (Quản lý chung → Khách hàng) — 16/11/2026.
 *
 * Phần THUẦN của tính năng: kiểm dữ liệu nhập, dựng payload cho Prisma, chuyển bản ghi sang
 * JSON trả về, sinh mật khẩu ban đầu và báo kết quả gửi thư chào mừng. Không require thư
 * viện nào ngoài node (crypto) và utils/validators.js, để kiểm thử bằng `node --test` không
 * cần node_modules — xem tests/customer-admin.test.js. Route nằm ở routes/b2b.js.
 *
 * Quyết định của chủ dự án:
 *  - "Xoá" = VÔ HIỆU HOÁ (is_active = false), không bao giờ xoá dòng: Order.customer_id là
 *    BigInt trần không có FK + bản chụp Json; xoá dòng là để lại đơn, điểm, wishlist mồ côi.
 *  - Quản trị KHÔNG đặt mật khẩu cho khách: server sinh mật khẩu ngẫu nhiên, chỉ lưu hash, vứt
 *    bản rõ ngay. Khách tự đặt mật khẩu bằng "Quên mật khẩu?" (OTP qua email, đã có từ
 *    12/11/2026). Như vậy không ai — kể cả quản trị viên — từng biết mật khẩu của khách.
 *  - Email chỉ sửa được ở tài khoản thuần mật khẩu ("local"). Tài khoản có Google thì đăng
 *    nhập Google tìm khách THEO EMAIL (routes/b2c.js /auth/social): đổi email ở đây thì lần
 *    đăng nhập Google sau tạo ra một tài khoản mới, tách khỏi đơn và điểm cũ.
 */

const crypto = require('crypto');
const { normalizePhoneVN, isValidPhoneVN, isValidEmail, isValidFullName } = require('../utils/validators');

// 1 điểm = 1.000đ khi tiêu (services/payment/pricingService.js) -> 1.000.000 điểm = 1 tỷ đồng.
// Đo trên production 16/11/2026: điểm cao nhất của 40.010 khách là 5.000. Trần này chặn gõ
// nhầm thêm vài số 0, và nằm xa giới hạn cột Int (2^31 - 1).
const LOYALTY_POINTS_MAX = 1_000_000;

const MSG = {
  NAME: 'Họ tên phải từ 2 đến 100 ký tự và có chữ cái',
  EMAIL: 'Email không hợp lệ',
  PHONE: 'Số điện thoại không hợp lệ (ví dụ: 0912345678)',
  POINTS: `Điểm tích luỹ phải là số nguyên từ 0 đến ${LOYALTY_POINTS_MAX.toLocaleString('vi-VN')}`,
  SEND_FLAG: 'Lựa chọn gửi email hướng dẫn không hợp lệ',
  BODY: 'Dữ liệu gửi lên không hợp lệ',
  EMAIL_LOCKED: 'Tài khoản đăng nhập bằng Google không đổi được email (email gắn với tài khoản Google)',
  NOTHING: 'Không có thông tin nào để cập nhật',
  ID: 'Mã khách hàng không hợp lệ',
  STATUS_BODY: 'Trường "active" phải là true (kích hoạt) hoặc false (vô hiệu hoá)',
  STATUS_FILTER: 'Bộ lọc trạng thái chỉ nhận all, active hoặc inactive',
  NOT_FOUND: 'Không tìm thấy khách hàng',
  DUPLICATE_EMAIL: 'Email này đã được dùng cho một tài khoản khác',
};

/** Mã khách trên URL: chỉ chữ số, tối đa 18 chữ số (vừa BIGINT), > 0. Trả BigInt hoặc null. */
function parseCustomerId(raw) {
  const s = String(raw ?? '');
  if (!/^\d{1,18}$/.test(s)) return null;
  const id = BigInt(s);
  return id > 0n ? id : null;
}

/**
 * Email do QUẢN TRỊ nhập: trim + chữ thường. /auth/register chỉ trim (đăng nhập so khớp
 * nguyên văn, đổi chữ thường ở đó làm tài khoản cũ có chữ hoa không vào được); với tài khoản
 * mới tạo ở đây thì chưa có ai đăng nhập, nên chọn dạng chữ thường — cùng dạng với đường
 * Google (/auth/social hạ chữ thường) và dạng người dùng hay gõ nhất.
 */
const normalizeEmail = (raw) => String(raw ?? '').trim().toLowerCase();

const sameEmail = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/** provider có thể là 'local', 'google', 'local,google', 'google,local'. Chỉ 'local' thuần mới sửa email. */
function isEmailEditable(provider) {
  const parts = String(provider || 'local').split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => p === 'local');
}

/** undefined -> fallback; số nguyên trong [0, MAX] (nhận cả chuỗi chữ số) -> số; còn lại -> NaN. */
function parsePoints(raw, fallback) {
  if (raw === undefined || raw === '' || raw === null) return fallback;
  let n;
  if (typeof raw === 'number') n = raw;
  else if (typeof raw === 'string' && /^\d{1,9}$/.test(raw.trim())) n = Number(raw.trim());
  else return NaN; // true, [], {}: Number() sẽ ra 1 / 0 — không nhận
  return Number.isInteger(n) && n >= 0 && n <= LOYALTY_POINTS_MAX ? n : NaN;
}

const isPlainObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/**
 * POST /customers. Trả { ok, errors[], value } — value đã chuẩn hoá:
 * { full_name, email, phone, loyalty_points, send_welcome_email }.
 */
function validateCreateCustomer(body) {
  if (!isPlainObject(body)) return { ok: false, errors: [MSG.BODY], value: null };
  const errors = [];
  const full_name = String(body.full_name ?? '').trim();
  const email = normalizeEmail(body.email);
  const phone = normalizePhoneVN(body.phone);
  const loyalty_points = parsePoints(body.loyalty_points, 0);
  let send_welcome_email = true;
  if (body.send_welcome_email !== undefined) {
    if (typeof body.send_welcome_email === 'boolean') send_welcome_email = body.send_welcome_email;
    else errors.push(MSG.SEND_FLAG);
  }

  if (!isValidFullName(full_name)) errors.push(MSG.NAME);
  if (!isValidEmail(email)) errors.push(MSG.EMAIL);
  if (phone && !isValidPhoneVN(phone)) errors.push(MSG.PHONE);
  if (Number.isNaN(loyalty_points)) errors.push(MSG.POINTS);

  return {
    ok: errors.length === 0,
    errors,
    value: { full_name, email, phone, loyalty_points, send_welcome_email },
  };
}

/**
 * PUT /customers/:id. Chỉ các trường CÓ gửi mới được xét và đổi.
 * existing = { email, provider, loyalty_points } đọc từ DB.
 * Trả { ok, errors[], data } — data chỉ gồm trường thực sự đổi (có thể rỗng).
 */
function validateUpdateCustomer(body, existing) {
  if (!isPlainObject(body)) return { ok: false, errors: [MSG.BODY], data: null };
  const errors = [];
  const data = {};

  if (body.full_name !== undefined) {
    const full_name = String(body.full_name ?? '').trim();
    if (!isValidFullName(full_name)) errors.push(MSG.NAME);
    else data.full_name = full_name;
  }

  if (body.phone !== undefined) {
    // null / '' = xoá số. Lưu '' như /auth/register và đăng nhập Google vẫn làm.
    const phone = normalizePhoneVN(body.phone);
    if (phone && !isValidPhoneVN(phone)) errors.push(MSG.PHONE);
    else data.phone = phone;
  }

  if (body.loyalty_points !== undefined) {
    const pts = parsePoints(body.loyalty_points, NaN);
    if (Number.isNaN(pts)) errors.push(MSG.POINTS);
    else if (pts !== existing.loyalty_points) data.loyalty_points = pts;
  }

  // Gửi lại đúng email hiện tại (khác hoa thường cũng tính là giống) = không đổi gì. Quan
  // trọng: KHÔNG tự hạ chữ thường email cũ — đăng nhập so khớp nguyên văn, khách có email
  // chữ hoa sẽ không vào được nữa chỉ vì quản trị sửa số điện thoại.
  if (body.email !== undefined && !sameEmail(body.email, existing.email)) {
    if (!isEmailEditable(existing.provider)) {
      errors.push(MSG.EMAIL_LOCKED);
    } else {
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) errors.push(MSG.EMAIL);
      else data.email = email;
    }
  }

  return { ok: errors.length === 0, errors, data };
}

/** Body của PATCH /customers/:id/status. Trả boolean hoặc null nếu sai. */
function parseStatusBody(body) {
  return isPlainObject(body) && typeof body.active === 'boolean' ? body.active : null;
}

/** where của GET /customers. status: all | active | inactive (nhận cả 'deactivated'). */
function buildCustomerListWhere({ search = '', status = 'all' } = {}) {
  const filters = { all: undefined, '': undefined, active: true, inactive: false, deactivated: false };
  const key = String(status ?? 'all').trim().toLowerCase();
  if (!(key in filters)) return { ok: false, error: MSG.STATUS_FILTER, where: null };

  const where = {};
  const q = String(search ?? '').trim().slice(0, 100);
  if (q) {
    const or = [
      { full_name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
    ];
    if (/^\d+$/.test(q) && q.length <= 18) or.push({ id: BigInt(q) });
    where.OR = or;
  }
  if (filters[key] !== undefined) where.is_active = filters[key];
  return { ok: true, error: null, where };
}

/** Cột được phép trả ra. KHÔNG BAO GIỜ có password_hash. */
const CUSTOMER_SELECT = Object.freeze({
  id: true,
  full_name: true,
  email: true,
  phone: true,
  loyalty_points: true,
  avatar: true,
  provider: true,
  created_at: true,
  is_active: true,
  deactivated_at: true,
});

function toCustomerDto(c) {
  if (!c) return null;
  return {
    id: Number(c.id),
    full_name: c.full_name,
    email: c.email,
    phone: c.phone || '',
    loyalty_points: Number(c.loyalty_points || 0),
    avatar: c.avatar ?? null,
    provider: c.provider,
    created_at: c.created_at,
    is_active: c.is_active !== false,
    deactivated_at: c.deactivated_at ?? null,
    // UI dùng để khoá ô email, cùng luật với validateUpdateCustomer.
    email_editable: isEmailEditable(c.provider),
  };
}

/** Thống kê đơn (một dòng từ truy vấn gộp trên "Order") -> số thường cho JSON. */
function toOrderStats(row) {
  const r = row || {};
  return {
    order_count: Number(r.order_count || 0),
    paid_order_count: Number(r.paid_order_count || 0),
    total_spent: Number(r.total_spent || 0),
    last_order_date: r.last_order_date || null,
  };
}

/**
 * Mật khẩu ban đầu: 24 byte CSPRNG -> 32 ký tự base64url (192 bit). Không ai biết, không
 * trả ra, không ghi log — chỉ để cột password_hash có giá trị thật: luồng "Quên mật khẩu?"
 * chỉ gửi mã OTP cho tài khoản CÓ mật khẩu (passwordReset.js, hasPassword), và bcrypt so
 * với chuỗi rỗng thì luôn sai nên '' không dùng được ở đây. 32 ký tự < 72 byte bcrypt cắt.
 */
function generateInitialPassword(randomBytes = crypto.randomBytes) {
  return randomBytes(24).toString('base64url');
}

/** data cho prisma.b2CCustomer.create (thiếu password_hash — route tự băm rồi thêm vào). */
function buildCreateData(value) {
  return {
    full_name: value.full_name,
    email: value.email,
    phone: value.phone || '',
    loyalty_points: value.loyalty_points,
    // Cùng ảnh đại diện mặc định với /auth/register.
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(value.email),
    provider: 'local',
    is_active: true,
  };
}

/**
 * Điểm do quản trị đặt / sửa cũng đi qua sổ cái LoyaltyTransaction (reason ADMIN_ADJUST đã
 * có sẵn trong schema), như mọi thay đổi điểm khác — không có dòng này thì tổng sổ cái lệch
 * với số dư mà không ai biết vì sao. Trả null nếu không đổi.
 */
function buildLoyaltyAdjustment(customerId, delta) {
  if (!delta) return null;
  return { customer_id: customerId, order_id: null, points: delta, reason: 'ADMIN_ADJUST', status: 'COMMITTED' };
}

/**
 * Gửi thư hướng dẫn đặt mật khẩu sau khi tạo khách. KHÔNG BAO GIỜ ném lỗi: tạo khách đã
 * thành công thì lỗi SMTP không được làm hỏng nó. Trả object để route trả cho trang quản trị.
 */
async function sendWelcomeEmail({ mail, customer, requested, logger = console }) {
  if (!requested) {
    return { requested: false, sent: false, code: 'NOT_REQUESTED', message: 'Không gửi email hướng dẫn (đã bỏ chọn).' };
  }
  const reason = mail.configError();
  if (reason) {
    logger.warn(`[customers] Chưa gửi email hướng dẫn: SMTP chưa cấu hình (${reason}).`);
    return {
      requested: true, sent: false, code: 'MAIL_NOT_CONFIGURED',
      message: 'Máy chủ chưa cấu hình gửi email nên chưa gửi được thư hướng dẫn. Hãy báo khách vào cửa hàng, bấm "Quên mật khẩu?" để tự đặt mật khẩu.',
    };
  }
  try {
    await mail.sendAccountCreated({ to: customer.email, fullName: customer.full_name });
    return { requested: true, sent: true, code: 'SENT', message: `Đã gửi email hướng dẫn đặt mật khẩu tới ${customer.email}.` };
  } catch (err) {
    logger.error('[customers] Gửi email hướng dẫn thất bại:', (err && (err.code || err.message)) || err);
    return {
      requested: true, sent: false, code: 'MAIL_FAILED',
      message: 'Đã tạo khách nhưng gửi email hướng dẫn thất bại. Hãy báo khách dùng "Quên mật khẩu?" ở cửa hàng để tự đặt mật khẩu.',
    };
  }
}

module.exports = {
  LOYALTY_POINTS_MAX,
  MSG,
  CUSTOMER_SELECT,
  parseCustomerId,
  normalizeEmail,
  sameEmail,
  isEmailEditable,
  validateCreateCustomer,
  validateUpdateCustomer,
  parseStatusBody,
  buildCustomerListWhere,
  toCustomerDto,
  toOrderStats,
  generateInitialPassword,
  buildCreateData,
  buildLoyaltyAdjustment,
  sendWelcomeEmail,
};
