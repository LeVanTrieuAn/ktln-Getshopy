/**
 * Mã đối soát (payment_ref) — chuỗi in vào nội dung chuyển khoản của VietQR,
 * là khoá duy nhất để gán một giao dịch ngân hàng vào một đơn hàng.
 *
 * Bốn ràng buộc thiết kế (xem docs/implement-phase/implement-plan §A.4.1):
 *
 *   1. ĐỘ DÀI CỐ ĐỊNH — chống prefix collision. Nếu ref có độ dài thay đổi thì
 *      "GS123" là substring của "GS1234", và match bằng String.includes() sẽ
 *      gán tiền của đơn này cho đơn kia.
 *
 *   2. NGẪU NHIÊN, KHÔNG TUẦN TỰ — ref tuần tự làm lộ số lượng đơn hàng ra
 *      ngoài, và cho phép đoán ref của người khác để dò trạng thái đơn.
 *
 *   3. CHỈ [A-Z0-9] — nội dung chuyển khoản bị mỗi ngân hàng xử lý một kiểu:
 *      strip dấu, đổi hoa/thường, cắt độ dài, chèn tiền tố riêng, thay ký tự
 *      đặc biệt bằng khoảng trắng. Chỉ chữ hoa + số mới sống sót qua tất cả.
 *
 *   4. CÓ CHECKSUM — loại bỏ chuỗi trùng ngẫu nhiên xuất hiện trong nội dung
 *      chuyển khoản (ví dụ khách gõ thêm ghi chú của riêng họ).
 */

const crypto = require('crypto');

// Crockford Base32 — bỏ I, L, O, U để không nhầm với 1, 0 khi đọc/gõ tay.
// Khách phải đọc được mã này khi chuyển khoản thủ công (không quét QR).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PREFIX = 'GS';
const BODY_LEN = 8;              // 32^8 ≈ 1.1 x 10^12 tổ hợp
const REF_LEN = PREFIX.length + BODY_LEN + 1;   // 11 ký tự

/** Ký tự kiểm tra: tổng vị trí các ký tự thân mã, lấy dư 32. */
function checksumChar(body) {
  let sum = 0;
  for (const ch of body) sum += ALPHABET.indexOf(ch);
  return ALPHABET[sum % ALPHABET.length];
}

/**
 * Sinh mã đối soát mới. Dùng crypto.randomBytes chứ không Math.random —
 * ref đoán được là lộ trạng thái đơn của khách khác.
 */
function generatePaymentRef() {
  const bytes = crypto.randomBytes(BODY_LEN);
  let body = '';
  // Lấy 5 bit thấp của mỗi byte -> index 0..31, phân phối đều trên alphabet
  for (const b of bytes) body += ALPHABET[b % ALPHABET.length];
  return PREFIX + body + checksumChar(body);
}

/** Kiểm tra một chuỗi có phải ref hợp lệ (đúng độ dài + đúng checksum). */
function isValidPaymentRef(ref) {
  if (typeof ref !== 'string' || ref.length !== REF_LEN) return false;
  if (!ref.startsWith(PREFIX)) return false;
  const body = ref.slice(PREFIX.length, PREFIX.length + BODY_LEN);
  const check = ref[ref.length - 1];
  for (const ch of body + check) if (ALPHABET.indexOf(ch) === -1) return false;
  return checksumChar(body) === check;
}

/**
 * Chuẩn hoá nội dung chuyển khoản trước khi dò mã.
 *
 * Thứ tự xử lý quan trọng: bỏ dấu TRƯỚC khi lọc ký tự, nếu không "Đ" sẽ bị
 * loại bỏ thay vì thành "D".
 *
 * Ví dụ thực tế nội dung ngân hàng trả về:
 *   "CHUYEN TIEN TU 0123456789 ND: Thanh toan don hang gs4k7m2p9x8"
 *   -> "CHUYENTIENTU0123456789NDTHANHTOANDONHANGGS4K7M2P9X8"
 */
function normalizeContent(raw) {
  if (!raw) return '';
  return String(raw)
    .normalize('NFD')                      // tách dấu khỏi ký tự gốc
    .replace(/[̀-ͯ]/g, '')       // bỏ dấu thanh + dấu mũ
    .replace(/đ/g, 'd').replace(/Đ/g, 'D') // đ/Đ không tách được bằng NFD
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');            // bỏ khoảng trắng và mọi ký tự khác
}

/**
 * Dò mã đối soát trong nội dung chuyển khoản.
 *
 * KHÔNG dùng String.includes() — xem ràng buộc 1 ở đầu file.
 * Quét mọi vị trí khớp mẫu rồi lọc bằng checksum, nên chuỗi ngẫu nhiên trong
 * ghi chú của khách bị loại.
 *
 * Trả về mảng vì một nội dung có thể chứa nhiều mã (khách paste nhầm).
 * Caller phải tự quyết định: >1 mã nghĩa là không xác định được đơn nào,
 * nên đưa vào hàng đợi admin thay vì đoán bừa.
 */
function extractPaymentRefs(rawContent) {
  const norm = normalizeContent(rawContent);
  const pattern = new RegExp(`${PREFIX}[${ALPHABET}]{${BODY_LEN + 1}}`, 'g');
  const found = new Set();
  for (const m of norm.matchAll(pattern)) {
    if (isValidPaymentRef(m[0])) found.add(m[0]);
  }
  return [...found];
}

module.exports = {
  generatePaymentRef,
  isValidPaymentRef,
  normalizeContent,
  extractPaymentRefs,
  REF_LEN,
  PREFIX,
};
