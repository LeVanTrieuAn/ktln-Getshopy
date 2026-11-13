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

// Giao diện thư (14/11/2026): tông đen trắng giống cửa hàng. Viết theo chuẩn email —
// bảng role="presentation" + style inline, không CSS ngoài, không ảnh/SVG (Gmail chặn
// ảnh mặc định và bỏ SVG) — để hiển thị giống nhau trên Gmail web/app, Outlook, Apple Mail.
const C = {
  ink: '#09090b', body: '#3f3f46', sub: '#71717a', line: '#e4e4e7', soft: '#f4f4f5', page: '#f4f4f5',
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SF Mono',Menlo,Consolas,'Liberation Mono','Courier New',monospace";

// Nút "Truy cập cửa hàng" chỉ hiện khi STORE_URL là địa chỉ https (đặt trong .env).
const storeUrl = () => {
  const u = env('STORE_URL');
  return /^https:\/\/[^\s"'<>]+$/.test(u) ? u.replace(/\/+$/, '') : '';
};

const p = (html, extra = '') =>
  `<p style="margin:0 0 16px;font:400 15px/1.65 ${FONT};color:${C.body};${extra}">${html}</p>`;

const table = (inner, style = '') =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${style}">${inner}</table>`;

/** Khung ghi chú: 'neutral' (xám) hoặc 'warn' (vàng nhạt) cho cảnh báo bảo mật. */
function notice(html, tone = 'neutral') {
  const s = tone === 'warn'
    ? { bg: '#fffbeb', bd: '#fde68a', fg: '#78350f' }
    : { bg: C.soft, bd: C.line, fg: C.body };
  return table(`<tr><td style="background:${s.bg};border:1px solid ${s.bd};border-radius:12px;padding:14px 16px;font:400 13.5px/1.6 ${FONT};color:${s.fg}">${html}</td></tr>`, 'margin:0 0 16px');
}

function button(href, label) {
  return table(`<tr><td style="border-radius:10px;background:${C.ink}" bgcolor="${C.ink}">
<a href="${href}" style="display:inline-block;padding:13px 22px;font:600 14px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:10px">${label}</a>
</td></tr>`, 'width:auto;margin:4px 0 4px');
}

function layout({ title, preheader, icon, heading, bodyHtml }) {
  const url = storeUrl();
  // Dòng xem trước trong hộp thư (preheader). CỐ Ý không chứa mã OTP: dòng này hiện cả trên
  // màn hình khoá điện thoại. Chuỗi ký tự trắng phía sau để ứng dụng mail không kéo chữ
  // trong thân thư lên nối vào dòng xem trước.
  const filler = '&#8199;&#65279;&#847;'.repeat(60);
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${escapeHtml(preheader)}${filler}</div>
${table(`<tr><td align="center" style="padding:32px 12px">
${table(`
<tr><td style="padding:0 4px 18px">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="36" height="36" align="center" valign="middle" bgcolor="${C.ink}" style="width:36px;height:36px;border-radius:10px;background:${C.ink};font:700 17px/36px ${FONT};color:#ffffff">G</td>
    <td style="padding-left:10px;font:700 18px/1 ${FONT};color:${C.ink};letter-spacing:-0.2px">${BRAND}</td>
  </tr></table>
</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid ${C.line};border-radius:16px;padding:32px 26px">
  ${icon ? `<div style="width:48px;height:48px;margin:0 0 18px;border-radius:14px;background:${C.soft};font-size:24px;line-height:48px;text-align:center">${icon}</div>` : ''}
  <h1 style="margin:0 0 14px;font:700 22px/1.3 ${FONT};color:${C.ink};letter-spacing:-0.3px">${escapeHtml(heading)}</h1>
  ${bodyHtml}
</td></tr>
<tr><td style="padding:22px 8px 0;font:400 12px/1.7 ${FONT};color:${C.sub};text-align:center">
  ${url ? `<a href="${url}" style="color:${C.ink};font-weight:600;text-decoration:none">Truy cập cửa hàng ${BRAND} &rarr;</a><br>` : ''}
  Email tự động, vui lòng không trả lời thư này.<br>&copy; ${new Date().getFullYear()} ${BRAND}
</td></tr>`, 'max-width:560px')}
</td></tr>`, `background:${C.page}`)}
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
  const html = layout({
    title: subject,
    preheader: `Dùng mã trong thư để đặt lại mật khẩu ${BRAND}. Mã hết hạn sau ${ttlMinutes} phút.`,
    icon: '&#128272;', // 🔐
    heading: 'Đặt lại mật khẩu',
    bodyHtml: [
      p(`Xin chào <b style="color:${C.ink}">${escapeHtml(name)}</b>,`),
      p(`Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản ${BRAND} gắn với email này. Nhập mã dưới đây vào cửa sổ đặt lại mật khẩu:`),
      // letter-spacing chứ không tách từng ô: sao chép ra vẫn là 6 số liền. padding-left bù
      // khoảng trắng letter-spacing để dãy số nằm đúng giữa.
      table(`<tr><td align="center" bgcolor="${C.soft}" style="background:${C.soft};border:1px dashed #d4d4d8;border-radius:14px;padding:22px 12px">
  <div style="margin:0 0 12px;font:600 11px/1 ${FONT};color:${C.sub};letter-spacing:1.6px;text-transform:uppercase">Mã xác nhận</div>
  <div style="padding-left:10px;font:700 36px/1 ${MONO};color:${C.ink};letter-spacing:10px">${escapeHtml(otp)}</div>
</td></tr>`, 'margin:4px 0 14px'),
      p(`Hiệu lực <b style="color:${C.ink}">${ttlMinutes} phút</b> &nbsp;&middot;&nbsp; Chỉ dùng được một lần`, `text-align:center;font-size:13px;color:${C.sub};margin-bottom:22px`),
      notice(`&#128274; <b>Không chia sẻ mã này với bất kỳ ai</b>, kể cả người tự nhận là nhân viên ${BRAND}. Chúng tôi không bao giờ hỏi mã qua điện thoại hay tin nhắn.`, 'warn'),
      p('Không phải bạn yêu cầu? Hãy bỏ qua email này, mật khẩu hiện tại vẫn giữ nguyên.', `font-size:13.5px;color:${C.sub};margin:0`),
    ].join('\n'),
  });
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
  const url = storeUrl();
  const row = (k, v) => `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${C.line};font:400 13.5px/1.5 ${FONT};color:${C.sub};width:38%">${k}</td>
  <td style="padding:10px 0;border-bottom:1px solid ${C.line};font:600 13.5px/1.5 ${FONT};color:${C.ink}">${v}</td>
</tr>`;
  const html = layout({
    title: subject,
    preheader: `Mật khẩu tài khoản ${BRAND} của bạn vừa được đổi lúc ${when}.`,
    icon: '&#9989;', // ✅
    heading: 'Mật khẩu đã được đổi',
    bodyHtml: [
      p(`Xin chào <b style="color:${C.ink}">${escapeHtml(name)}</b>, mật khẩu tài khoản ${BRAND} của bạn vừa được đổi thành công.`),
      table(row('Thời gian', `${escapeHtml(when)} (giờ Việt Nam)`) + row('Cách thực hiện', 'Mã xác nhận gửi tới email này'), 'margin:0 0 20px;border-top:1px solid ' + C.line),
      p('Nếu chính bạn vừa đổi, bạn không cần làm gì thêm.'),
      notice(`<b>Không phải bạn?</b> Hãy dùng "Quên mật khẩu?" ở cửa sổ đăng nhập để đặt lại mật khẩu ngay, rồi đổi mật khẩu của hộp thư email này, vì người đổi mật khẩu đã đọc được thư gửi tới hộp thư của bạn.`, 'warn'),
      url ? button(url, 'Mở cửa hàng để đặt lại mật khẩu') : '',
    ].join('\n'),
  });
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
  const url = storeUrl();
  const step = (n, html) => `<tr>
  <td valign="top" style="width:30px;padding:0 0 12px"><div style="width:22px;height:22px;border-radius:11px;background:${C.ink};font:700 12px/22px ${FONT};color:#ffffff;text-align:center">${n}</div></td>
  <td style="padding:1px 0 12px;font:400 14.5px/1.6 ${FONT};color:${C.body}">${html}</td>
</tr>`;
  const html = layout({
    title: subject,
    preheader: `Tài khoản ${BRAND} của bạn đăng nhập bằng Google, không có mật khẩu cần đặt lại.`,
    icon: '&#128273;', // 🔑
    heading: 'Tài khoản của bạn đăng nhập bằng Google',
    bodyHtml: [
      p(`Xin chào <b style="color:${C.ink}">${escapeHtml(name)}</b>, chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản ${BRAND} gắn với email này. Tài khoản của bạn được tạo bằng <b style="color:${C.ink}">Google</b> và chưa có mật khẩu riêng, nên không có mật khẩu nào cần đặt lại.`),
      table(
        step(1, 'Mở cửa sổ đăng nhập và bấm <b>"Đăng nhập bằng Google"</b>.')
        + step(2, 'Muốn đăng nhập bằng email và mật khẩu? Sau khi vào bằng Google, mở <b>Tài khoản &rsaquo; Bảo mật &amp; Liên kết &rsaquo; Thiết lập mật khẩu</b>.'),
        'margin:4px 0 12px',
      ),
      url ? button(url, `Mở ${BRAND}`) : '',
      p('Không phải bạn yêu cầu? Hãy bỏ qua email này.', `font-size:13.5px;color:${C.sub};margin:18px 0 0`),
    ].join('\n'),
  });
  return send('huong-dan-dang-nhap-google', { to, subject, text, html });
}

module.exports = {
  configError,
  sendPasswordResetOtp,
  sendPasswordChanged,
  sendSocialLoginNotice,
  setTransportForTests,
};
