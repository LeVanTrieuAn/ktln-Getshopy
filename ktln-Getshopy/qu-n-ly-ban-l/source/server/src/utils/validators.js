/**
 * Kiểm tra dữ liệu khách nhập — chốt chặn THẬT nằm ở server.
 *
 * Trước 11/11/2026 không có lớp này: /api/b2c/checkout lưu nguyên customer_info
 * do client gửi vào Order.customer, /api/b2c/auth/register lưu phone || '' mà
 * không xem là gì. Bạn của chủ dự án nhập "0163789557vhvbj" vẫn tạo được. Luật ở
 * form (antd rules) chỉ để báo lỗi sớm: ai gọi thẳng API là bỏ qua được form.
 *
 * Client có bản sao các luật cho số điện thoại / họ tên ở
 * client/src/utils/validators.js — sửa luật ở đây thì sửa cả bên đó.
 */

// Di động 10 số: 03x, 05x, 07x, 08x, 09x. Cố định 11 số: 02x + 8 số (02838xxxxxx).
// Đầu 01x (11 số) đã chuyển sang đầu mới từ 2018 nên không nhận.
const VN_PHONE = /^0(?:[35789]\d{8}|2\d{9})$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const HAS_LETTER = /\p{L}/u;

/** Bỏ khoảng trắng, dấu chấm, gạch, ngoặc; +84 / 84 đầu số -> 0. */
function normalizePhoneVN(raw) {
  if (raw === undefined || raw === null) return '';
  let s = String(raw).trim().replace(/[\s.\-()]/g, '');
  if (s.startsWith('+84')) s = '0' + s.slice(3);
  else if (/^84\d{9,10}$/.test(s)) s = '0' + s.slice(2);
  return s;
}

function isValidPhoneVN(raw) {
  return VN_PHONE.test(normalizePhoneVN(raw));
}

function isValidEmail(raw) {
  const s = String(raw || '').trim();
  return s.length <= 254 && EMAIL.test(s);
}

/** Họ tên: 2–100 ký tự sau khi trim, có ít nhất một chữ cái (mọi bảng chữ). */
function isValidFullName(raw) {
  const s = String(raw || '').trim();
  return s.length >= 2 && s.length <= 100 && HAS_LETTER.test(s);
}

const str = (v) => (v === undefined || v === null ? '' : String(v).trim());

/**
 * Thông tin nhận hàng gửi lên khi đặt đơn.
 * Trả { ok, errors[], value } — value là bản đã chuẩn hoá (phone dạng 0xxxxxxxxx,
 * chuỗi đã trim). Giữ nguyên các khoá khác client gửi (ví dụ toạ độ chọn trên bản
 * đồ) nhưng chặn object quá lớn: nó được lưu nguyên vào cột JSON của Order.
 */
function validateCustomerInfo(ci) {
  const errors = [];
  if (!ci || typeof ci !== 'object' || Array.isArray(ci)) {
    return { ok: false, errors: ['Thiếu thông tin nhận hàng'], value: null };
  }
  if (JSON.stringify(ci).length > 4000) {
    return { ok: false, errors: ['Thông tin nhận hàng quá dài'], value: null };
  }

  const value = { ...ci };
  value.full_name = str(ci.full_name);
  value.phone = normalizePhoneVN(ci.phone);
  value.province = str(ci.province);
  value.district = str(ci.district);
  value.ward = str(ci.ward);
  value.address = str(ci.address);
  if (ci.email !== undefined) value.email = str(ci.email);

  if (!isValidFullName(value.full_name)) errors.push('Họ tên phải từ 2 đến 100 ký tự và có chữ cái');
  if (!VN_PHONE.test(value.phone)) errors.push('Số điện thoại không hợp lệ (ví dụ: 0912345678)');
  if (!value.province) errors.push('Vui lòng chọn Tỉnh / Thành phố');
  if (value.province.length > 100 || value.district.length > 100 || value.ward.length > 100) {
    errors.push('Tỉnh / Quận / Phường quá dài');
  }
  if (value.address.length < 5 || value.address.length > 255) errors.push('Địa chỉ phải từ 5 đến 255 ký tự');
  if (value.email && !isValidEmail(value.email)) errors.push('Email nhận thông báo không hợp lệ');

  return { ok: errors.length === 0, errors, value };
}

module.exports = { normalizePhoneVN, isValidPhoneVN, isValidEmail, isValidFullName, validateCustomerInfo };
