/**
 * Xác thực QUẢN TRỊ — chiều ngược lại của authB2C.
 *
 * Token admin (/api/auth/login) và token khách (/api/b2c/auth/*) ký bằng CÙNG
 * một JWT_SECRET, chỉ khác trường `role`. Vì vậy chỉ jwt.verify là CHƯA ĐỦ:
 * token khách cũng có chữ ký hợp lệ. Trước 11/11/2026:
 *   - /api/b2b/* (sản phẩm, hãng, chi nhánh, flash sale, khách hàng, log chatbot,
 *     phân tích hành vi) KHÔNG có middleware nào — ai gọi tới cũng đọc được họ
 *     tên, email, số điện thoại khách và sửa / xoá được catalog.
 *   - authMiddleware của dashboard nhận MỌI token hợp lệ, nên khách đăng ký ở
 *     cửa hàng cũng gọi được API doanh thu, tài chính, cảnh báo.
 *
 * Quy tắc: token phải có `role` và role đó KHÔNG phải 'customer'.
 * Gắn req.user (payload) và req.adminUser = { id, role }.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    'Thiếu biến môi trường JWT_SECRET. Đặt một chuỗi ngẫu nhiên đủ dài trong .env ' +
    '(ví dụ: openssl rand -base64 48) trước khi khởi động server.'
  );
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: 'Chưa đăng nhập' });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      error: expired ? 'Phiên đăng nhập đã hết hạn' : 'Token không hợp lệ',
      code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
    });
  }

  if (!payload || !payload.role || payload.role === 'customer') {
    return res.status(403).json({ error: 'Cần quyền quản trị' });
  }

  req.user = payload;
  req.adminUser = { id: Number(payload.id), role: payload.role };
  next();
}

module.exports = { requireAdmin };
