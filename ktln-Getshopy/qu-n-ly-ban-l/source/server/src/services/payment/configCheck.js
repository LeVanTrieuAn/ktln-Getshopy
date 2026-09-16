/**
 * Kiểm tra cấu hình thanh toán lúc khởi động.
 *
 * Lý do tồn tại: các lỗi cấu hình ở đây KHÔNG tự báo ra. Chúng chỉ lộ khi có
 * tiền thật chạy qua, và lúc đó thì đã muộn.
 *
 *   - STK trong QR khác tài khoản đã liên kết SePay -> khách chuyển tiền thành
 *     công, tiền vào thật, nhưng webhook không bao giờ bắn. Đơn nằm PENDING
 *     tới khi hết hạn.
 *   - Còn dùng giá trị mẫu -> QR trỏ vào tài khoản không tồn tại.
 *   - Còn dùng key dev -> webhook thật bị từ chối 401.
 */

const PLACEHOLDERS = {
  VIETQR_ACCOUNT_NO: ['0123456789', '1234567890', ''],
  VIETQR_BANK_BIN: [''],
  SEPAY_WEBHOOK_API_KEY: ['dev-sepay-key-local-only', ''],
  PAYMENT_SIMULATOR_KEY: ['dev-simulator-key-local-only', ''],
  JWT_SECRET: ['istore_secret', 'dev-only-local-secret-please-replace-in-real-env', ''],
};

function checkPaymentConfig({ strict = false } = {}) {
  const problems = [];
  const warnings = [];
  const isProd = process.env.NODE_ENV === 'production';

  const bin = process.env.VIETQR_BANK_BIN;
  const acc = process.env.VIETQR_ACCOUNT_NO;
  const name = process.env.VIETQR_ACCOUNT_NAME;

  if (!bin || !acc) {
    problems.push('Chưa cấu hình VIETQR_BANK_BIN / VIETQR_ACCOUNT_NO — đơn chuyển khoản sẽ KHÔNG sinh được QR');
  } else {
    if (!/^\d{6}$/.test(bin)) problems.push(`VIETQR_BANK_BIN="${bin}" không phải 6 chữ số`);
    if (PLACEHOLDERS.VIETQR_ACCOUNT_NO.includes(acc)) {
      problems.push(`VIETQR_ACCOUNT_NO vẫn là giá trị mẫu "${acc}" — QR đang trỏ vào tài khoản không có thật`);
    }
    if (!name) warnings.push('Thiếu VIETQR_ACCOUNT_NAME — app ngân hàng sẽ không hiện tên người nhận');
    else if (name !== name.toUpperCase() || /[àáâãèéêìíòóôõùúăđĩũơưăạảấầẩẫậ]/i.test(name)) {
      warnings.push(`VIETQR_ACCOUNT_NAME="${name}" nên viết HOA không dấu — ngân hàng sẽ tự chuẩn hoá như vậy`);
    }
  }

  // Tiền tố nội dung chuyển khoản — bắt buộc với một số ngân hàng.
  // VietinBank (BIN 970415): SePay chỉ nhận được biến động số dư khi nội dung
  // bắt đầu bằng SEVQR. Thiếu thì tiền vào mà SePay không thấy giao dịch nào.
  const prefix = (process.env.PAYMENT_CONTENT_PREFIX || '').trim().toUpperCase();
  const NEEDS_SEVQR = { '970415': 'VietinBank' };
  if (NEEDS_SEVQR[bin] && prefix !== 'SEVQR') {
    problems.push(
      `${NEEDS_SEVQR[bin]} yêu cầu nội dung chuyển khoản bắt đầu bằng SEVQR — ` +
      `đặt PAYMENT_CONTENT_PREFIX=SEVQR, nếu không SePay sẽ KHÔNG thấy giao dịch nào`
    );
  }

  const hmac = process.env.SEPAY_WEBHOOK_HMAC_SECRET;
  const apiKey = process.env.SEPAY_WEBHOOK_API_KEY;
  if (!hmac && !apiKey) {
    problems.push('Chưa cấu hình SEPAY_WEBHOOK_HMAC_SECRET / SEPAY_WEBHOOK_API_KEY — mọi webhook SePay sẽ bị từ chối 401');
  } else if (!hmac && PLACEHOLDERS.SEPAY_WEBHOOK_API_KEY.includes(apiKey)) {
    problems.push('SEPAY_WEBHOOK_API_KEY vẫn là key dev — webhook thật từ SePay sẽ bị từ chối');
  }

  if (isProd && process.env.PAYMENT_SIMULATOR_KEY) {
    warnings.push('PAYMENT_SIMULATOR_KEY được đặt trên production (adapter mô phỏng tự tắt, nhưng nên gỡ biến này)');
  }

  // In ra rõ ràng: đây là thứ phải nhìn thấy mỗi lần khởi động
  console.log('─── Cấu hình thanh toán ───────────────────────────────');
  console.log(`  Tài khoản nhận : ${bin || '(thiếu)'} / ${acc || '(thiếu)'} — ${name || '(thiếu tên)'}`);
  console.log(`  Xác thực webhook: ${hmac ? 'HMAC-SHA256' : apiKey ? 'API Key' : '(chưa có)'}`);
  console.log(`  Nội dung CK    : "${prefix || 'TT'} <mã đối soát>"`);
  console.log(`  Hiển thị ${process.env.PAYMENT_DISPLAY_TTL_SECONDS || 300}s · giữ kho ${process.env.PAYMENT_RESERVATION_TTL_SECONDS || 480}s`);

  for (const w of warnings) console.warn(`  ⚠ ${w}`);
  for (const p of problems) console.error(`  ✖ ${p}`);

  if (problems.length > 0) {
    console.error('  → Số tài khoản trong QR PHẢI đúng là tài khoản đã liên kết SePay.');
    console.error('    Lệch nhau thì khách chuyển tiền thành công nhưng webhook không bao giờ bắn.');
    if (strict || isProd) {
      throw new Error('Cấu hình thanh toán chưa hợp lệ — xem các dòng ✖ ở trên');
    }
  } else {
    console.log('  ✓ hợp lệ');
  }
  console.log('───────────────────────────────────────────────────────');

  return { problems, warnings };
}

module.exports = { checkPaymentConfig };
