/**
 * Sinh chuỗi VietQR theo chuẩn EMVCo Merchant-Presented QR.
 *
 * Vì sao tự sinh thay vì gọi img.vietqr.io (xem §A.7 của implement plan):
 *   - Không phụ thuộc dịch vụ ngoài — họ down thì khách không có QR
 *   - Không gửi số tiền + nội dung đơn hàng sang bên thứ ba
 *   - Sinh được ngay trong transaction tạo đơn, đúng nghĩa "động theo giao dịch"
 *
 * Cấu trúc dữ liệu là TLV (Tag-Length-Value): mỗi trường gồm tag 2 chữ số,
 * độ dài 2 chữ số, rồi tới giá trị. Trường lồng nhau thì value lại là TLV.
 *
 * LƯU Ý VỀ HẠN DÙNG: chuẩn EMVCo KHÔNG có trường expiry. Chuỗi QR sinh ra
 * sống vĩnh viễn — khách chụp màn hình rồi quét lại sau nhiều giờ thì ngân
 * hàng vẫn chấp nhận. "5 phút" là ràng buộc phía server, không phải của QR.
 * Hệ quả và cách xử lý: xem §A.3 của implement plan.
 *
 * Nguồn chuẩn: VietQR Format Specification — Napas
 * https://vietqr.net/portal-service/download/documents/QR_Format_T&C_ver1.4_EN.pdf
 */

// ── Tag theo chuẩn EMVCo / VietQR ──────────────────────────────────────
const TAG_PAYLOAD_FORMAT   = '00';
const TAG_INIT_METHOD      = '01';
const TAG_MERCHANT_INFO    = '38';
const TAG_CURRENCY         = '53';
const TAG_AMOUNT           = '54';
const TAG_COUNTRY          = '58';
const TAG_ADDITIONAL_DATA  = '62';
const TAG_CRC              = '63';

const GUID_VIETQR          = 'A000000727';  // định danh dịch vụ VietQR của Napas
const CURRENCY_VND         = '704';          // ISO 4217
const COUNTRY_VN           = 'VN';
const SERVICE_TRANSFER     = 'QRIBFTTA';     // chuyển khoản tới số tài khoản

// Point of Initiation Method theo EMVCo:
//   "11" = QR TĨNH  — không mang số tiền, quét nhiều lần, khách tự nhập tiền
//   "12" = QR ĐỘNG  — mang sẵn số tiền, dùng một lần
// QR của ta luôn có tag 54 (số tiền) nên PHẢI là "12". Khai "11" mà vẫn kèm số
// tiền là mâu thuẫn, và một số app ngân hàng (VietinBank) từ chối không quét.
const INIT_DYNAMIC         = '12';

const SUBTAG_PURPOSE       = '08';           // nội dung chuyển khoản, trong tag 62

/** Đóng gói một trường TLV. Độ dài luôn 2 chữ số, pad 0 ở đầu. */
function tlv(tag, value) {
  const len = String(value.length).padStart(2, '0');
  if (value.length > 99) {
    throw new Error(`Trường ${tag} dài ${value.length} ký tự, vượt giới hạn 99 của EMVCo`);
  }
  return `${tag}${len}${value}`;
}

/**
 * CRC-16/CCITT-FALSE: đa thức 0x1021, khởi tạo 0xFFFF, không đảo bit, không XOR đầu ra.
 * Tính trên toàn bộ chuỗi ĐÃ BAO GỒM "6304" của chính trường CRC.
 */
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Sinh chuỗi VietQR động.
 *
 * @param {object}  p
 * @param {string}  p.bankBin      Mã BIN ngân hàng thụ hưởng, 6 chữ số (vd MB = "970422")
 * @param {string}  p.accountNo    Số tài khoản thụ hưởng
 * @param {number}  p.amount       Số tiền, ĐƠN VỊ ĐỒNG, số nguyên
 * @param {string}  p.content      Nội dung chuyển khoản — phải chứa payment_ref
 * @returns {string} chuỗi để render thành ảnh QR
 */
function buildVietQRPayload({ bankBin, accountNo, amount, content }) {
  if (!/^\d{6}$/.test(String(bankBin || ''))) {
    throw new Error('bankBin phải là 6 chữ số');
  }
  if (!accountNo) throw new Error('Thiếu accountNo');
  if (!Number.isInteger(amount) || amount <= 0) {
    // Tiền là Int đơn vị đồng — số thực ở đây là dấu hiệu có chỗ tính sai
    throw new Error('amount phải là số nguyên dương (đơn vị đồng)');
  }

  // Tag 38 — thông tin đơn vị thụ hưởng, lồng ba tầng
  const beneficiary = tlv('00', String(bankBin)) + tlv('01', String(accountNo));
  const merchantInfo =
    tlv('00', GUID_VIETQR) +
    tlv('01', beneficiary) +
    tlv('02', SERVICE_TRANSFER);

  // Tag 62 — nội dung chuyển khoản.
  // Chỉ giữ [A-Z0-9 ] vì ngân hàng sẽ lọc phần còn lại; giữ sẵn ở đây để
  // chuỗi ta sinh ra khớp với chuỗi ngân hàng trả về trong webhook.
  const safeContent = String(content)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
    .slice(0, 99 - 4);   // chừa chỗ cho tag + length của subtag

  let payload =
    tlv(TAG_PAYLOAD_FORMAT, '01') +
    tlv(TAG_INIT_METHOD, INIT_DYNAMIC) +
    tlv(TAG_MERCHANT_INFO, merchantInfo) +
    tlv(TAG_CURRENCY, CURRENCY_VND) +
    tlv(TAG_AMOUNT, String(amount)) +
    tlv(TAG_COUNTRY, COUNTRY_VN) +
    tlv(TAG_ADDITIONAL_DATA, tlv(SUBTAG_PURPOSE, safeContent));

  // CRC tính trên chuỗi đã nối sẵn "6304"
  payload += TAG_CRC + '04';
  return payload + crc16(payload);
}

/** Tách ngược chuỗi TLV — dùng để test và để soi lỗi khi QR không quét được. */
function parseTLV(str) {
  const out = {};
  let i = 0;
  while (i + 4 <= str.length) {
    const tag = str.slice(i, i + 2);
    const len = parseInt(str.slice(i + 2, i + 4), 10);
    if (Number.isNaN(len)) break;
    out[tag] = str.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

/** Xác minh CRC của một chuỗi VietQR bất kỳ. */
function verifyPayload(payload) {
  if (payload.length < 8) return false;
  const body = payload.slice(0, -4);
  const given = payload.slice(-4);
  return crc16(body) === given.toUpperCase();
}

module.exports = { buildVietQRPayload, crc16, tlv, parseTLV, verifyPayload };
