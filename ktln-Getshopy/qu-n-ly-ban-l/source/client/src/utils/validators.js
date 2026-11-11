/**
 * Luật kiểm tra ô nhập ở form khách hàng (antd Form rules).
 *
 * Chỉ để báo lỗi SỚM cho người dùng — chốt chặn thật là server/src/utils/validators.js
 * (gọi thẳng API thì bỏ qua được form). Sửa luật ở đây thì sửa cả bên server.
 *
 * Trước 11/11/2026 các ô chỉ có `required`: "0163789557vhvbj" vẫn tạo được đơn và
 * tài khoản.
 */

// Di động 10 số: 03x/05x/07x/08x/09x. Cố định 11 số: 02x + 8 số.
const VN_PHONE = /^0(?:[35789]\d{8}|2\d{9})$/;
const HAS_LETTER = /\p{L}/u;

export function normalizePhoneVN(raw) {
  if (raw === undefined || raw === null) return '';
  let s = String(raw).trim().replace(/[\s.\-()]/g, '');
  if (s.startsWith('+84')) s = '0' + s.slice(3);
  else if (/^84\d{9,10}$/.test(s)) s = '0' + s.slice(2);
  return s;
}

export const isValidPhoneVN = (raw) => VN_PHONE.test(normalizePhoneVN(raw));

/** required = false: để trống thì qua, có nhập thì phải đúng (ô SĐT ở form đăng ký). */
export const phoneRules = (required = true) => [
  ...(required ? [{ required: true, message: 'Vui lòng nhập số điện thoại' }] : []),
  {
    validator: (_, v) => (!v || isValidPhoneVN(v)
      ? Promise.resolve()
      : Promise.reject(new Error('Số điện thoại không hợp lệ (ví dụ: 0912345678)'))),
  },
];

export const fullNameRules = [
  { required: true, whitespace: true, message: 'Vui lòng nhập họ và tên' },
  { max: 100, message: 'Họ tên tối đa 100 ký tự' },
  {
    validator: (_, v) => {
      const s = String(v || '').trim();
      if (!s) return Promise.resolve(); // để luật required báo
      return s.length >= 2 && HAS_LETTER.test(s)
        ? Promise.resolve()
        : Promise.reject(new Error('Họ tên phải có ít nhất 2 ký tự và có chữ cái'));
    },
  },
];

export const addressRules = [
  { required: true, whitespace: true, message: 'Vui lòng nhập địa chỉ cụ thể' },
  { min: 5, message: 'Địa chỉ quá ngắn' },
  { max: 255, message: 'Địa chỉ tối đa 255 ký tự' },
];

export const shortTextRules = (msg) => [
  { required: true, whitespace: true, message: msg },
  { max: 100, message: 'Tối đa 100 ký tự' },
];
