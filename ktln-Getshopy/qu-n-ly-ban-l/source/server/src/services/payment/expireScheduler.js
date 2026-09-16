/**
 * Job tự động đóng đơn quá hạn chưa thanh toán.
 *
 * Vì sao bắt buộc phải có: nếu không chạy, ba thứ rò rỉ cùng lúc —
 *   - reserved chỉ tăng không giảm -> tồn khả dụng về 0 dù kho vẫn đầy
 *   - voucher của khách kẹt ở HELD, không dùng lại được
 *   - điểm đã tiêu không được hoàn
 * Đây là failure mode âm thầm: không có lỗi nào bắn ra, hàng cứ "hết" dần.
 *
 * Chạy nhiều instance cùng lúc vẫn an toàn: expireOrder chỉ đụng đơn đang ở
 * payment_status = 'PENDING', và mọi UPDATE đều có điều kiện. Nhưng vẫn dùng
 * advisory lock để khỏi làm việc thừa.
 */

const { expireOverdueOrders } = require('./orderLifecycle');

// Khoá tuỳ ý, chỉ cần cố định và không đụng khoá khác trong hệ thống.
const ADVISORY_LOCK_KEY = 728311;

let timer = null;

async function runOnce(prisma) {
  // pg_try_advisory_lock trả về ngay, không chờ — instance khác đang chạy thì bỏ lượt.
  const [{ locked }] = await prisma.$queryRaw`
    SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS locked
  `;
  if (!locked) return { skipped: true, expired: [] };

  try {
    const expired = await expireOverdueOrders(prisma);
    if (expired.length > 0) {
      console.log(`[expire-job] đã đóng ${expired.length} đơn quá hạn:`, expired.join(', '));
    }
    return { skipped: false, expired };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`;
  }
}

/**
 * @param {object} prisma
 * @param {number} [intervalSeconds] mặc định 60s — đủ nhanh để kho không kẹt lâu,
 *                                   đủ thưa để không tạo tải vô ích.
 */
function start(prisma, intervalSeconds) {
  const seconds = Number(
    intervalSeconds ?? process.env.PAYMENT_EXPIRE_SCAN_INTERVAL_SECONDS ?? 60
  );

  if (timer) {
    console.warn('[expire-job] đã chạy rồi, bỏ qua lần start này');
    return timer;
  }

  const tick = async () => {
    try {
      await runOnce(prisma);
    } catch (err) {
      // Không để job chết: một lần lỗi (mất kết nối DB) không được làm
      // dừng vòng lặp, nếu không kho sẽ kẹt vĩnh viễn mà không ai biết.
      console.error('[expire-job] lỗi:', err.message);
    }
  };

  timer = setInterval(tick, seconds * 1000);
  console.log(`[expire-job] quét đơn quá hạn mỗi ${seconds}s`);
  tick();   // chạy ngay một lần lúc khởi động, dọn đơn tồn từ lần chạy trước
  return timer;
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { start, stop, runOnce, ADVISORY_LOCK_KEY };
