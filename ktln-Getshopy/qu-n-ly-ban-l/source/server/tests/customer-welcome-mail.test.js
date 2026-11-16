// Kiểm thử thư hướng dẫn đặt mật khẩu khi quản trị tạo khách (16/11/2026) — mailService THẬT,
// SMTP thay bằng jsonTransport của Nodemailer qua setTransportForTests (không gửi thư nào ra
// ngoài). Cần node_modules (nodemailer) nên chạy trong image server:
//   docker run --rm --network none -v <server>/src:/app/src:ro -v <server>/tests:/app/tests:ro \
//     --entrypoint node kltn-server:latest --test tests/customer-welcome-mail.test.js
// Máy không có nodemailer thì các test tự bỏ qua (skip), không báo lỗi giả.
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SMTP_HOST = 'smtp.invalid';
process.env.MAIL_FROM = 'Getshopy <no-reply@example.com>';
process.env.STORE_URL = 'https://shop.example.com/';
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch { /* chạy trên máy không có node_modules */ }
const skip = nodemailer ? false : 'chưa cài nodemailer — chạy trong image kltn-server';

const load = () => {
  const mail = require('../src/services/mailService');
  const sent = [];
  const json = nodemailer.createTransport({ jsonTransport: true });
  mail.setTransportForTests({
    sendMail: async (msg) => {
      const info = await json.sendMail(msg);
      sent.push(JSON.parse(info.message));
      return info;
    },
  });
  return { mail, sent };
};

test('sendAccountCreated: đúng người nhận, hướng dẫn "Quên mật khẩu?", có nút STORE_URL, không có mật khẩu', { skip }, async () => {
  const { mail, sent } = load();
  assert.equal(mail.configError(), null);
  await mail.sendAccountCreated({ to: 'an@example.com', fullName: 'Nguyễn An' });
  assert.equal(sent.length, 1);
  const m = sent[0];
  assert.equal(m.to[0].address, 'an@example.com');
  assert.equal(m.from.address, 'no-reply@example.com');
  assert.match(m.subject, /Tài khoản Getshopy của bạn đã được tạo/);
  for (const body of [m.text, m.html]) {
    assert.match(body, /Quên mật khẩu\?/);
    assert.match(body, /an@example\.com/);
    assert.doesNotMatch(body, /mật khẩu (của bạn )?là|mật khẩu tạm/i);
  }
  assert.match(m.html, /href="https:\/\/shop\.example\.com"/);
  assert.match(m.text, /https:\/\/shop\.example\.com/);
});

test('sendAccountCreated: họ tên có thẻ HTML được escape', { skip }, async () => {
  const { mail, sent } = load();
  await mail.sendAccountCreated({ to: 'x@example.com', fullName: '<script>alert(1)</script>' });
  assert.doesNotMatch(sent[0].html, /<script>/);
  assert.match(sent[0].html, /&lt;script&gt;/);
});

test('customerAdmin.sendWelcomeEmail + mailService thật: SENT; SMTP lỗi -> MAIL_FAILED, không ném', { skip }, async () => {
  const ca = require('../src/services/customerAdmin');
  const { mail, sent } = load();
  const quiet = { warn() {}, error() {} };
  const ok = await ca.sendWelcomeEmail({ mail, customer: { email: 'b@example.com', full_name: 'Bình' }, requested: true, logger: quiet });
  assert.equal(ok.code, 'SENT');
  assert.equal(sent.length, 1);

  mail.setTransportForTests({ sendMail: async () => { throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ESOCKET' }); } });
  const origError = console.error;
  console.error = () => {}; // mailService ghi log lỗi SMTP — không cần hiện trong kết quả test
  try {
    const failed = await ca.sendWelcomeEmail({ mail, customer: { email: 'b@example.com', full_name: 'Bình' }, requested: true, logger: quiet });
    assert.equal(failed.code, 'MAIL_FAILED');
    assert.equal(failed.sent, false);
  } finally {
    console.error = origError;
  }
});

test('configError: thiếu SMTP_HOST -> sendWelcomeEmail báo MAIL_NOT_CONFIGURED, không gọi transport', { skip }, async () => {
  const ca = require('../src/services/customerAdmin');
  const { mail, sent } = load();
  const saved = process.env.SMTP_HOST;
  delete process.env.SMTP_HOST;
  try {
    const r = await ca.sendWelcomeEmail({ mail, customer: { email: 'c@example.com', full_name: 'Chi' }, requested: true, logger: { warn() {}, error() {} } });
    assert.equal(r.code, 'MAIL_NOT_CONFIGURED');
    assert.equal(sent.length, 0);
  } finally {
    process.env.SMTP_HOST = saved;
  }
});
