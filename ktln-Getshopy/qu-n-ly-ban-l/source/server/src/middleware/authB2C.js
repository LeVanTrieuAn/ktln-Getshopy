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
 *
 * (16/11/2026) Thêm kiểm tra TRẠNG THÁI tài khoản sau chữ ký: quản trị vô hiệu hoá khách
 * thì token cũ (sống 7 ngày) bị từ chối ngay, không phải chờ hết hạn. Logic nằm ở
 * authB2CCore.js (kiểm thử được không cần node_modules); file này chỉ gắn jsonwebtoken và
 * Prisma vào. Chi phí và cách đệm: services/customerStatusCache.js.
 */

const jwt = require('jsonwebtoken');
const { prisma } = require('../db');
const { createAuthB2C } = require('./authB2CCore');
const { createCustomerStatusCache } = require('../services/customerStatusCache');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // Không dùng giá trị mặc định. Secret hardcode trong source nghĩa là bất kỳ
  // ai đọc được repo đều ký được token giả cho mọi tài khoản.
  throw new Error(
    'Thiếu biến môi trường JWT_SECRET. Đặt một chuỗi ngẫu nhiên đủ dài trong .env ' +
    '(ví dụ: openssl rand -base64 48) trước khi khởi động server.'
  );
}

// Một bộ đệm cho cả tiến trình. routes/b2b.js gọi customerStatus.invalidate(id) khi quản trị
// đổi trạng thái để lần gọi kế tiếp đọc lại DB ngay.
const customerStatus = createCustomerStatusCache({
  // Chỉ một cột, tra theo khoá chính.
  load: (id) => prisma.b2CCustomer.findUnique({
    where: { id: BigInt(id) },
    select: { is_active: true },
  }),
});

const { authB2C, optionalAuthB2C } = createAuthB2C({
  verifyToken: (token) => jwt.verify(token, JWT_SECRET),
  statusCache: customerStatus,
});

module.exports = { authB2C, optionalAuthB2C, customerStatus };
