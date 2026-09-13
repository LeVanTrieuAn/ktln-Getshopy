/**
 * Xác thực khách hàng B2C.
 *
 * Trước đây /api/b2c/checkout KHÔNG có middleware nào: việc kiểm tra đăng nhập
 * nằm ở client (Checkout.jsx chỉ đọc localStorage). Ai cũng curl thẳng vào tạo
 * đơn được, và customer_info là do người gọi tự khai.
 *
 * Khi gắn thanh toán vào thì hệ quả nặng hơn: không xác định được đơn thuộc về
 * ai -> không biết hoàn tiền cho ai, và ai cũng xem được trạng thái thanh toán
 * của đơn người khác.
 *
 * Quy tắc: customer_id LUÔN lấy từ token, KHÔNG BAO GIỜ từ request body.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // Không dùng giá trị mặc định. Secret hardcode trong source nghĩa là bất kỳ
  // ai đọc được repo đều ký được token giả cho mọi tài khoản.
  throw new Error(
    'Thiếu biến môi trường JWT_SECRET. Đặt một chuỗi ngẫu nhiên đủ dài trong .env ' +
    '(ví dụ: openssl rand -base64 48) trước khi khởi động server.'
  );
}

/** Bắt buộc đăng nhập. Gắn req.b2cUser = { id, role }. */
function authB2C(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'customer') {
      // Token admin không được dùng thay token khách — hai không gian id khác nhau
      // (User.id vs B2CCustomer.id), nhầm lẫn sẽ gán đơn cho sai người.
      return res.status(403).json({ error: 'Token không hợp lệ cho khu vực khách hàng' });
    }
    req.b2cUser = { id: Number(payload.id), role: payload.role };
    next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      error: expired ? 'Phiên đăng nhập đã hết hạn' : 'Token không hợp lệ',
      code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
    });
  }
}

/** Không bắt buộc đăng nhập, nhưng nhận diện nếu có token hợp lệ. */
function optionalAuthB2C(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.role === 'customer') {
        req.b2cUser = { id: Number(payload.id), role: payload.role };
      }
    } catch { /* token hỏng thì coi như khách vãng lai */ }
  }
  next();
}

module.exports = { authB2C, optionalAuthB2C };
