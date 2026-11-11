'use strict';
/**
 * Quên mật khẩu bằng mã OTP gửi qua email — khách của cửa hàng (B2CCustomer).
 *
 *   POST /api/b2c/auth/forgot-password  { email }
 *   POST /api/b2c/auth/reset-password   { email, otp, new_password }
 *
 * (12/11/2026) Trước ngày này nút "Quên mật khẩu?" chỉ hiện "liên hệ bộ phận hỗ trợ":
 * khách quên mật khẩu là mất luôn tài khoản (điểm thưởng, lịch sử đơn). Chủ dự án chọn
 * kênh EMAIL, chưa làm SMS. Nằm dưới /api/b2c vì gateway chỉ cho Internet gọi /api/b2c/*,
 * /api/ai/*, webhook thanh toán và health (gateway/nginx.conf).
 *
 * Thiết kế theo OWASP Forgot Password Cheat Sheet
 * (https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html):
 *
 *  1. KHÔNG LỘ EMAIL NÀO ĐÃ ĐĂNG KÝ. forgot-password trả CÙNG một câu, cùng mã 200 dù email
 *     có tài khoản hay không, và thư gửi NGẦM sau khi đã trả lời: chờ SMTP (1–2 s) ngay
 *     trong request thì email có thật trả chậm hơn hẳn — đo thời gian là dò ra. Email
 *     không có tài khoản vẫn được ghi một bản ghi "mồi" (hash ngẫu nhiên, không khớp mã
 *     nào), để reset-password cũng trả lời y hệt: thiếu nó thì "sai mã, còn 4 lần" khác
 *     "mã không đúng hoặc đã hết hạn" — chính là câu trả lời "email này có tài khoản".
 *  2. Mã 6 số sinh bằng crypto.randomInt (CSPRNG), không dùng Math.random (đoán được).
 *  3. REDIS CHỈ GIỮ HMAC-SHA256 CỦA MÃ, khoá HMAC nằm ở server. Lộ bản dump Redis cũng không
 *     ra mã: chỉ 10^6 khả năng nên sha256 trần (kể cả có salt nằm cạnh) dò hết trong tích
 *     tắc; HMAC thì phải có khoá. So khớp bằng crypto.timingSafeEqual.
 *  4. Mã sống 10 phút, sai 5 lần là huỷ, dùng xong là xoá (một lần). Xin mã mới thì mã cũ
 *     hết hiệu lực.
 *  5. Hạn mức gửi: 1 lần / 60 s, 5 lần / giờ, 10 lần / ngày cho mỗi email; 20 lần / giờ cho
 *     mỗi IP; reset-password 30 lần thử / giờ cho mỗi IP. Kẻ dò một tài khoản có tối đa 10
 *     mã × 5 lần = 50 lượt đoán / ngày trên 10^6 khả năng, và mỗi mã là một thư báo tới chủ
 *     hộp thư. Mọi hạn mức áp dụng y hệt cho email không tồn tại (không lộ gì).
 *
 * Tài khoản Google chưa có mật khẩu (password_hash = ''): API vẫn trả câu chung, nhưng thư
 * gửi đi là HƯỚNG DẪN đăng nhập bằng Google, không có mã. Luồng này không tự thêm cách
 * đăng nhập bằng mật khẩu cho tài khoản mạng xã hội; muốn có mật khẩu thì đăng nhập bằng
 * Google rồi vào Tài khoản > Thiết lập mật khẩu (/auth/set-password, có xác thực).
 *
 * Giới hạn còn lại: JWT không có trạng thái, nên token đã cấp TRƯỚC khi đặt lại mật khẩu
 * vẫn dùng được tới khi hết hạn (7 ngày). Thu hồi được thì cần thêm cột phiên bản token
 * vào B2CCustomer — thay đổi schema, ngoài phạm vi tính năng này.
 */
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { prisma } = require('../db');
const { redis } = require('../redis');
const { isValidEmail } = require('../utils/validators');
const mail = require('../services/mailService');

const router = express.Router();

const OTP_TTL_SECONDS = 10 * 60;
const OTP_MAX_ATTEMPTS = 5;
const SEND_COOLDOWN_SECONDS = 60;
const LIMIT_SEND_EMAIL_HOUR = { max: 5, window: 3600 };
const LIMIT_SEND_EMAIL_DAY = { max: 10, window: 86400 };
const LIMIT_SEND_IP_HOUR = { max: 20, window: 3600 };
const LIMIT_VERIFY_IP_HOUR = { max: 30, window: 3600 };
// Cùng cost với /auth/register trong routes/b2c.js.
const BCRYPT_COST = 10;

const GENERIC_SENT_MESSAGE =
  'Nếu email này đã đăng ký tài khoản, mã xác nhận gồm 6 chữ số đã được gửi tới hộp thư. Mã có hiệu lực trong 10 phút.';
const MSG_OTP_EXPIRED = 'Mã xác nhận không đúng hoặc đã hết hạn. Vui lòng yêu cầu mã mới.';
const MSG_OTP_LOCKED = `Bạn đã nhập sai mã ${OTP_MAX_ATTEMPTS} lần nên mã đã bị huỷ. Vui lòng yêu cầu mã mới.`;
const MSG_BUSY = 'Hệ thống đang bận, vui lòng thử lại sau.';

// Khoá HMAC dẫn xuất từ JWT_SECRET bằng HKDF (RFC 5869,
// https://www.rfc-editor.org/rfc/rfc5869) với nhãn riêng: không thêm biến bí mật nào vào
// .env mà khoá này vẫn khác khoá ký JWT. Ai đã có JWT_SECRET thì vốn giả được token đăng
// nhập của mọi khách, nên tách thành biến riêng cũng không thêm lớp bảo vệ nào.
if (!process.env.JWT_SECRET) {
  throw new Error('Thiếu JWT_SECRET. Sinh bằng: openssl rand -base64 48');
}
const HMAC_KEY = Buffer.from(crypto.hkdfSync(
  'sha256', process.env.JWT_SECRET, Buffer.alloc(0), 'getshopy/password-reset-otp/v1', 32,
));

const hmacHex = (input) => crypto.createHmac('sha256', HMAC_KEY).update(input).digest('hex');

// Khoá Redis theo email đã hạ chữ thường rồi băm: "An@x.com" và "an@x.com" dùng chung một
// mã và một hạn mức, và tên khoá không chứa email trần.
const emailKey = (email) => hmacHex(`email|${email.toLowerCase()}`).slice(0, 32);
const otpKey = (ek) => `pwreset:otp:${ek}`;
// Băm kèm khoá email và id tài khoản: bản ghi không bê sang tài khoản khác được.
const otpHash = (ek, cid, otp) => hmacHex(`otp|${ek}|${cid}|${otp}`);

function sameHash(aHex, bHex) {
  const a = Buffer.from(String(aHex || ''), 'hex');
  const b = Buffer.from(String(bHex || ''), 'hex');
  return a.length === 32 && b.length === 32 && crypto.timingSafeEqual(a, b);
}

// Cờ isConnected() của ../redis chỉ bật một lần lúc kết nối đầu và không tắt khi Redis
// rớt; isReady của node-redis phản ánh trạng thái hiện tại.
const redisReady = () => Boolean(redis && redis.isReady);

function formatWait(seconds) {
  if (seconds < 60) return `${seconds} giây`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} phút`;
  return `${Math.ceil(seconds / 3600)} giờ`;
}

function tooMany(res, retryAfter, error, code) {
  res.set('Retry-After', String(retryAfter));
  return res.status(429).json({ error, code, retry_after: retryAfter });
}

// 503 CÓ CHỦ ĐÍCH, câu báo dành cho khách. Lớp che lỗi 5xx ở index.js (đổi mọi body.error
// của 5xx thành "Hệ thống đang bận") chỉ bọc res.json — nó chặn lộ err.message nội bộ.
// Câu ở đây là hằng số, nên gửi bằng res.send để khách đọc được lý do thật.
function unavailable(res, error, code) {
  return res.status(503).type('application/json').send(JSON.stringify({ error, code }));
}

/**
 * Đếm theo cửa sổ cố định. INCR + EXPIRE ... NX trong cùng MULTI: TTL chỉ đặt lúc khoá
 * mới sinh, và không thể có khoá đếm thiếu TTL (khoá như vậy sẽ khoá email đó vĩnh viễn).
 * EXPIRE NX cần Redis >= 7.0 (compose dùng redis:7-alpine).
 * Trả null nếu còn hạn mức, hoặc { retryAfter } nếu đã vượt.
 */
async function hitLimits(limits) {
  const tx = redis.multi();
  for (const { key, window } of limits) tx.incr(key).expire(key, window, 'NX').ttl(key);
  const replies = await tx.exec();
  for (let i = 0; i < limits.length; i += 1) {
    const count = Number(replies[i * 3]);
    const ttl = Number(replies[i * 3 + 2]);
    if (count > limits[i].max) return { retryAfter: ttl > 0 ? ttl : limits[i].window };
  }
  return null;
}

/**
 * Hạn mức theo email: xem trước, CHỈ ĐẾM lượt gửi thật (hitLimits sau khi qua). Đếm cả lượt
 * bị từ chối thì một lượt vượt hạn mức giờ cũng ăn mất hạn mức ngày. Xem-rồi-đếm không bị
 * tranh chấp vì cooldown SET NX phía trước chỉ cho một request mỗi 60 s của cùng email
 * đi tới đây.
 */
async function overQuota(limits) {
  const tx = redis.multi();
  for (const { key } of limits) tx.get(key).ttl(key);
  const replies = await tx.exec();
  for (let i = 0; i < limits.length; i += 1) {
    const count = Number(replies[i * 2] || 0);
    const ttl = Number(replies[i * 2 + 1]);
    if (count >= limits[i].max) return { retryAfter: ttl > 0 ? ttl : limits[i].window };
  }
  return null;
}

/**
 * MỘT truy vấn cho mọi trường hợp. Tách "khớp nguyên văn trước, không phân biệt hoa thường
 * sau" thì email có thật trả nhanh hơn email không có — lại dò được bằng thời gian.
 * So khớp không phân biệt hoa thường vì /auth/register lưu email nguyên văn (không hạ chữ
 * thường) và bàn phím điện thoại hay tự viết hoa chữ đầu: khách gõ "An@gmail.com" cho tài
 * khoản "an@gmail.com" vẫn nhận được mã. lower(email) = lower($1) là phép so sánh bằng,
 * không có ký tự đại diện. Bảng B2CCustomer nhỏ (seed 8 dòng) nên quét tuần tự không đáng kể.
 */
async function findAccountByEmail(email) {
  const rows = await prisma.$queryRaw`
    SELECT id, email, full_name, password_hash, provider
    FROM "B2CCustomer"
    WHERE lower(email) = lower(${email})
    ORDER BY id
    LIMIT 5`;
  // Hai tài khoản chỉ khác hoa thường (đăng ký không chặn): ưu tiên đúng nguyên văn; không
  // có mà lại nhiều hơn một thì không đoán.
  return rows.find((r) => r.email === email) || (rows.length === 1 ? rows[0] : null);
}

// Gửi thư SAU khi đã trả lời request (xem mục 1 ở đầu file). Lỗi SMTP chỉ ghi log.
function sendLater(job) {
  setImmediate(() => {
    Promise.resolve().then(job).catch(() => { /* mailService đã ghi log lỗi SMTP */ });
  });
}

let lastConfigWarnAt = 0;
function warnMailNotConfigured(reason) {
  // Ghi tối đa 10 phút một lần: bot gọi liên tục không làm ngập log.
  if (Date.now() - lastConfigWarnAt < 10 * 60 * 1000) return;
  lastConfigWarnAt = Date.now();
  console.warn(`⚠️  [password-reset] Chưa cấu hình gửi email (${reason}) — /api/b2c/auth/forgot-password trả 503. Xem mục SMTP trong .env.example.`);
}

{
  const reason = mail.configError();
  if (reason) warnMailNotConfigured(reason);
}

router.post('/auth/forgot-password', async (req, res) => {
  try {
    const configReason = mail.configError();
    if (configReason) {
      warnMailNotConfigured(configReason);
      return unavailable(res,
        'Chức năng gửi email chưa được cấu hình nên chưa đặt lại mật khẩu được. Vui lòng liên hệ cửa hàng để được hỗ trợ.',
        'MAIL_NOT_CONFIGURED');
    }
    if (!redisReady()) {
      return unavailable(res,
        'Chức năng đặt lại mật khẩu đang tạm gián đoạn, vui lòng thử lại sau ít phút.',
        'RESET_UNAVAILABLE');
    }

    const email = String(req.body?.email ?? '').trim();
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Email không hợp lệ' });
    const ek = emailKey(email);

    const ipLimited = await hitLimits([{ key: `pwreset:ip:${req.ip || 'unknown'}`, ...LIMIT_SEND_IP_HOUR }]);
    if (ipLimited) {
      return tooMany(res, ipLimited.retryAfter,
        `Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau ${formatWait(ipLimited.retryAfter)}.`,
        'RATE_LIMITED');
    }

    const cooldownKey = `pwreset:cd:${ek}`;
    const firstInWindow = await redis.set(cooldownKey, '1', { NX: true, EX: SEND_COOLDOWN_SECONDS });
    if (firstInWindow === null) {
      const ttl = await redis.ttl(cooldownKey);
      const wait = ttl > 0 ? ttl : SEND_COOLDOWN_SECONDS;
      return tooMany(res, wait, `Vui lòng đợi ${wait} giây trước khi yêu cầu mã mới.`, 'OTP_COOLDOWN');
    }

    const emailLimits = [
      { key: `pwreset:eh:${ek}`, ...LIMIT_SEND_EMAIL_HOUR },
      { key: `pwreset:ed:${ek}`, ...LIMIT_SEND_EMAIL_DAY },
    ];
    const emailLimited = await overQuota(emailLimits);
    if (emailLimited) {
      return tooMany(res, emailLimited.retryAfter,
        `Email này đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau ${formatWait(emailLimited.retryAfter)}.`,
        'OTP_EMAIL_LIMIT');
    }
    await hitLimits(emailLimits);

    const account = await findAccountByEmail(email);
    const hasPassword = Boolean(account && account.password_hash);

    // Mọi nhánh đều sinh mã, băm và ghi Redis như nhau (cùng thời gian xử lý); chỉ tài
    // khoản có mật khẩu mới được bản ghi khớp với mã thật.
    const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const cid = hasPassword ? String(account.id) : '';
    const realHash = otpHash(ek, cid, otp);
    const storedHash = hasPassword ? realHash : crypto.randomBytes(32).toString('hex');
    const key = otpKey(ek);
    await redis.multi()
      .del(key)
      .hSet(key, { cid, h: storedHash, a: '0' })
      .expire(key, OTP_TTL_SECONDS)
      .exec();

    if (hasPassword) {
      sendLater(() => mail.sendPasswordResetOtp({
        to: account.email, fullName: account.full_name, otp, ttlMinutes: OTP_TTL_SECONDS / 60,
      }));
    } else if (account && String(account.provider || '').includes('google')) {
      sendLater(() => mail.sendSocialLoginNotice({ to: account.email, fullName: account.full_name }));
    }

    return res.json({
      success: true,
      message: GENERIC_SENT_MESSAGE,
      expires_in: OTP_TTL_SECONDS,
      resend_after: SEND_COOLDOWN_SECONDS,
    });
  } catch (err) {
    console.error('[password-reset] forgot-password:', err.message);
    return res.status(500).json({ error: MSG_BUSY });
  }
});

router.post('/auth/reset-password', async (req, res) => {
  try {
    if (!redisReady()) {
      return unavailable(res,
        'Chức năng đặt lại mật khẩu đang tạm gián đoạn, vui lòng thử lại sau ít phút.',
        'RESET_UNAVAILABLE');
    }

    const email = String(req.body?.email ?? '').trim();
    const otp = String(req.body?.otp ?? '').replace(/\s+/g, '');
    const newPassword = req.body?.new_password;
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Email không hợp lệ' });
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Mã xác nhận phải gồm đúng 6 chữ số' });
    // Cùng luật với /auth/register (routes/b2c.js).
    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({ error: 'Mật khẩu mới phải từ 6 đến 128 ký tự' });
    }

    const ipLimited = await hitLimits([{ key: `pwreset:vip:${req.ip || 'unknown'}`, ...LIMIT_VERIFY_IP_HOUR }]);
    if (ipLimited) {
      return tooMany(res, ipLimited.retryAfter,
        `Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ${formatWait(ipLimited.retryAfter)}.`,
        'RATE_LIMITED');
    }

    const ek = emailKey(email);
    const key = otpKey(ek);
    // Đếm lượt thử TRƯỚC khi so khớp, trong một MULTI: gửi song song 100 request cũng chỉ
    // có 5 lượt được so. HINCRBY trên khoá vừa hết hạn sẽ tạo khoá mới không có TTL —
    // EXPIRE ... NX gắn TTL cho đúng trường hợp đó, không kéo dài TTL của mã đang sống.
    const [attempt, record] = await redis.multi()
      .hIncrBy(key, 'a', 1)
      .hGetAll(key)
      .expire(key, OTP_TTL_SECONDS, 'NX')
      .exec();

    if (!record || !record.h) {
      return res.status(400).json({ error: MSG_OTP_EXPIRED, code: 'OTP_EXPIRED' });
    }
    if (Number(attempt) > OTP_MAX_ATTEMPTS) {
      await redis.del(key);
      return res.status(400).json({ error: MSG_OTP_LOCKED, code: 'OTP_LOCKED' });
    }

    // Luôn tính HMAC rồi mới xét cid: bản ghi mồi (cid rỗng) tốn đúng chừng ấy thời gian.
    const matches = sameHash(otpHash(ek, record.cid || '', otp), record.h) && Boolean(record.cid);
    if (!matches) {
      const left = OTP_MAX_ATTEMPTS - Number(attempt);
      if (left <= 0) {
        await redis.del(key);
        return res.status(400).json({ error: MSG_OTP_LOCKED, code: 'OTP_LOCKED' });
      }
      return res.status(400).json({
        error: `Mã xác nhận không đúng. Bạn còn ${left} lần thử.`,
        code: 'OTP_INVALID',
        attempts_left: left,
      });
    }

    // Dùng một lần: hai request cùng mã đúng tới song song thì chỉ request xoá được bản
    // ghi (DEL trả 1) mới được đổi mật khẩu.
    if (await redis.del(key) !== 1) {
      return res.status(400).json({ error: MSG_OTP_EXPIRED, code: 'OTP_EXPIRED' });
    }

    const password_hash = await bcrypt.hash(newPassword, BCRYPT_COST);
    let customer;
    try {
      customer = await prisma.b2CCustomer.update({
        where: { id: BigInt(record.cid) },
        data: { password_hash },
        select: { email: true, full_name: true },
      });
    } catch (err) {
      if (err.code === 'P2025') {
        return res.status(400).json({ error: MSG_OTP_EXPIRED, code: 'OTP_EXPIRED' });
      }
      throw err;
    }

    sendLater(() => mail.sendPasswordChanged({ to: customer.email, fullName: customer.full_name, changedAt: new Date() }));

    return res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
      // Email đúng như lưu trong DB (đăng nhập so khớp nguyên văn) để form đăng nhập điền
      // sẵn. Trả được vì người gọi vừa chứng minh đọc được hộp thư này.
      email: customer.email,
    });
  } catch (err) {
    console.error('[password-reset] reset-password:', err.message);
    return res.status(500).json({ error: MSG_BUSY });
  }
});

module.exports = router;
