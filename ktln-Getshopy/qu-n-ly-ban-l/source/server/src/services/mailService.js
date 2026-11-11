'use strict';
/**
 * Gửi email giao dịch qua SMTP (Nodemailer) — hiện dùng cho "Quên mật khẩu" bằng mã OTP.
 *
 * (12/11/2026) Trước ngày này hệ thống KHÔNG gửi email nào: nút "Quên mật khẩu?" ở cửa
 * hàng chỉ hiện "liên hệ bộ phận hỗ trợ". Đây là chỗ DUY NHẤT nói chuyện với máy chủ
 * SMTP, để các luồng gửi thư sau này dùng chung cấu hình và cách xử lý lỗi.
 *
 * Cấu hình đọc từ biến môi trường (.env ở gốc repo, mẫu trong .env.example):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM
 * Thiếu SMTP_HOST hoặc MAIL_FROM = CHƯA CẤU HÌNH: configError() trả lý do, và route quên
 * mật khẩu trả 503 thay vì báo khách "đã gửi mã" trong khi không có thư nào đi.
 *
 * KHÔNG ghi nội dung thư ra log (thư OTP chứa mã) — chỉ ghi loại thư và lỗi SMTP.
 * Tài liệu Nodemailer SMTP transport: https://nodemailer.com/smtp/
 */
const nodemailer = require('nodemailer');

const BRAND = 'Getshopy';
// Cùng biến với index.js: giờ trong thư "mật khẩu đã được đổi" là giờ Việt Nam.
const BUSINESS_TZ = process.env.BUSINESS_TZ || 'Asia/Ho_Chi_Minh';

const env = (name) => String(process.env[name] ?? '').trim();

/** null = đủ cấu hình để gửi; ngược lại là lý do (để ghi log, không trả cho khách). */
function configError() {
  const missing = ['SMTP_HOST', 'MAIL_FROM'].filter((name) => !env(name));
  if (missing.length) return `thiếu ${missing.join(', ')}`;
  if (Boolean(env('SMTP_USER')) !== Boolean(env('SMTP_PASS'))) {
    return 'SMTP_USER và SMTP_PASS phải đặt cùng nhau';
  }
  if (env('SMTP_PORT') && !/^\d{1,5}$/.test(env('SMTP_PORT'))) return 'SMTP_PORT phải là số cổng';
  return null;
}

let transport = null;

function getTransport() {
  if (transport) return transport;
  const port = Number(env('SMTP_PORT')) || 587;
  const secureFlag = env('SMTP_SECURE').toLowerCase();
  // 465 = TLS ngay từ đầu kết nối; 587/25 = kết nối thường rồi nâng lên bằng STARTTLS.
  const secure = secureFlag ? ['true', '1', 'yes'].includes(secureFlag) : port === 465;
  const auth = env('SMTP_USER') ? { user: env('SMTP_USER'), pass: env('SMTP_PASS') } : undefined;
  transport = nodemailer.createTransport({
    host: env('SMTP_HOST'),
    port,
    secure,
    // Có đăng nhập mà kênh chưa mã hoá thì BẮT BUỘC STARTTLS: không bao giờ gửi SMTP_PASS
    // dạng chữ thường qua mạng. Máy SMTP không cần đăng nhập (vd. Mailpit khi dev) thì
    // không ép.
    requireTLS: !secure && Boolean(auth),
    auth,
    // Máy SMTP treo thì bỏ sau vài giây thay vì giữ socket mãi (mặc định của thư viện
    // là vài phút).
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transport;
}

/** Chỉ dùng trong kiểm thử: thay SMTP thật bằng transport giả (vd. jsonTransport). */
function setTransportForTests(fake) {
  transport = fake;
}

async function send(kind, { to, subject, text, html }) {
  try {
    return await getTransport().sendMail({ from: env('MAIL_FROM'), to, subject, text, html });
  } catch (err) {
    // err.message của Nodemailer là phản hồi của máy SMTP (vd. "535 ... Username and
    // Password not accepted"), không chứa nội dung thư.
    console.error(`[mail] Gửi thư "${kind}" thất bại:`, err.code || '', err.message);
    throw err;
  }
}

// ─── Mẫu thư ───────────────────────────────────────────────────────────────

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Họ tên do khách tự nhập lúc đăng ký: phần HTML luôn đi qua escapeHtml, nếu không ai
// đặt tên là thẻ HTML sẽ chèn được nội dung vào thư mang thương hiệu cửa hàng.
const displayName = (fullName) => String(fullName || '').trim().slice(0, 100) || 'bạn';

const p = (html) => `<p style="margin:0 0 14px">${html}</p>`;

function layout(title, bodyHtml) {
  return `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#18181b">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px">
<div style="font-size:20px;font-weight:700;margin-bottom:20px">${BRAND}</div>
${bodyHtml}
<p style="margin:24px 0 0;font-size:12px;color:#71717a">Email tự động từ ${BRAND}, vui lòng không trả lời thư này.</p>
</div>
</body>
</html>`;
}

function formatVnTime(date) {
  // "14:05 12/11/2026" — ghép tay để không phụ thuộc định dạng ngày của từng bản ICU.
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`;
}

/** Thư chứa mã OTP đặt lại mật khẩu. */
function sendPasswordResetOtp({ to, fullName, otp, ttlMinutes }) {
  const name = displayName(fullName);
  const subject = `Mã xác nhận đặt lại mật khẩu ${BRAND}`;
  const text = [
    `Xin chào ${name},`,
    '',
    `Có yêu cầu đặt lại mật khẩu cho tài khoản ${BRAND} gắn với email này. Mã xác nhận của bạn là:`,
    '',
    `    ${otp}`,
    '',
    `Mã có hiệu lực trong ${ttlMinutes} phút và chỉ dùng được một lần.`,
    `Không đưa mã này cho bất kỳ ai, kể cả người tự nhận là nhân viên ${BRAND}.`,
    'Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.',
  ].join('\n');
  const html = layout(subject, [
    p(`Xin chào ${escapeHtml(name)},`),
    p(`Có yêu cầu đặt lại mật khẩu cho tài khoản ${BRAND} gắn với email này. Mã xác nhận của bạn là:`),
    `<div style="margin:0 0 16px;padding:16px;border-radius:10px;background:#f4f4f5;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;font-family:'Courier New',monospace">${escapeHtml(otp)}</div>`,
    p(`Mã có hiệu lực trong <b>${ttlMinutes} phút</b> và chỉ dùng được một lần.`),
    p(`Không đưa mã này cho bất kỳ ai, kể cả người tự nhận là nhân viên ${BRAND}.`),
    p('Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.'),
  ].join('\n'));
  return send('otp-dat-lai-mat-khau', { to, subject, text, html });
}

/** Báo cho chủ tài khoản sau khi mật khẩu đã được đặt lại. */
function sendPasswordChanged({ to, fullName, changedAt = new Date() }) {
  const name = displayName(fullName);
  const when = formatVnTime(changedAt);
  const subject = `Mật khẩu tài khoản ${BRAND} của bạn đã được đổi`;
  const text = [
    `Xin chào ${name},`,
    '',
    `Mật khẩu tài khoản ${BRAND} của bạn đã được đổi lúc ${when} (giờ Việt Nam), bằng mã xác nhận gửi tới email này.`,
    '',
    'Nếu chính bạn vừa đổi, bạn không cần làm gì thêm.',
    'Nếu KHÔNG phải bạn: hãy dùng "Quên mật khẩu?" ở cửa sổ đăng nhập để đặt lại mật khẩu ngay, rồi đổi mật khẩu của hộp thư email này — người đổi mật khẩu đã đọc được thư gửi tới hộp thư của bạn.',
  ].join('\n');
  const html = layout(subject, [
    p(`Xin chào ${escapeHtml(name)},`),
    p(`Mật khẩu tài khoản ${BRAND} của bạn đã được đổi lúc <b>${escapeHtml(when)}</b> (giờ Việt Nam), bằng mã xác nhận gửi tới email này.`),
    p('Nếu chính bạn vừa đổi, bạn không cần làm gì thêm.'),
    p('<b>Nếu không phải bạn:</b> hãy dùng "Quên mật khẩu?" ở cửa sổ đăng nhập để đặt lại mật khẩu ngay, rồi đổi mật khẩu của hộp thư email này — người đổi mật khẩu đã đọc được thư gửi tới hộp thư của bạn.'),
  ].join('\n'));
  return send('da-doi-mat-khau', { to, subject, text, html });
}

/**
 * Tài khoản tạo bằng Google, chưa từng đặt mật khẩu: không có mật khẩu nào để "đặt lại".
 * Gửi hướng dẫn thay vì im lặng — nếu không, chủ tài khoản thật chờ mãi một mã không bao
 * giờ tới. Thư chỉ đến hộp thư của chủ tài khoản, nên không lộ gì cho người gọi API.
 */
function sendSocialLoginNotice({ to, fullName }) {
  const name = displayName(fullName);
  const subject = `Hướng dẫn đăng nhập tài khoản ${BRAND}`;
  const text = [
    `Xin chào ${name},`,
    '',
    `Có yêu cầu đặt lại mật khẩu cho tài khoản ${BRAND} gắn với email này. Tài khoản của bạn được tạo bằng Google và chưa có mật khẩu riêng, nên không có mật khẩu nào cần đặt lại.`,
    '',
    'Để đăng nhập, hãy bấm nút "Đăng nhập bằng Google" trong cửa sổ đăng nhập.',
    'Muốn đăng nhập bằng email và mật khẩu? Sau khi vào bằng Google, mở trang Tài khoản > Bảo mật & Liên kết > Thiết lập mật khẩu.',
    '',
    'Nếu bạn không yêu cầu, hãy bỏ qua email này.',
  ].join('\n');
  const html = layout(subject, [
    p(`Xin chào ${escapeHtml(name)},`),
    p(`Có yêu cầu đặt lại mật khẩu cho tài khoản ${BRAND} gắn với email này. Tài khoản của bạn được tạo bằng <b>Google</b> và chưa có mật khẩu riêng, nên không có mật khẩu nào cần đặt lại.`),
    p('Để đăng nhập, hãy bấm nút <b>"Đăng nhập bằng Google"</b> trong cửa sổ đăng nhập.'),
    p('Muốn đăng nhập bằng email và mật khẩu? Sau khi vào bằng Google, mở trang <b>Tài khoản &gt; Bảo mật &amp; Liên kết &gt; Thiết lập mật khẩu</b>.'),
    p('Nếu bạn không yêu cầu, hãy bỏ qua email này.'),
  ].join('\n'));
  return send('huong-dan-dang-nhap-google', { to, subject, text, html });
}

module.exports = {
  configError,
  sendPasswordResetOtp,
  sendPasswordChanged,
  sendSocialLoginNotice,
  setTransportForTests,
};
