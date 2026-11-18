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
 *
 * 18/11/2026 (cân bằng tải, compose chạy N bản server): khoá đổi sang pg_try_advisory_xact_lock
 * trong MỘT transaction. Bản cũ lấy khoá cấp phiên (pg_try_advisory_lock) và nhả bằng một
 * $queryRaw khác — Prisma có pool kết nối, hai câu không chắc chạy trên cùng một kết nối.
 * Nhả trên kết nối khác thì pg_advisory_unlock trả false và khoá Ở LẠI trên kết nối cũ tới khi
 * kết nối đó đóng (https://www.postgresql.org/docs/16/explicit-locking.html#ADVISORY-LOCKS):
 * mọi bản khác bỏ lượt mãi, và chính bản giữ khoá chỉ chạy được khi pool tình cờ đưa lại đúng
 * kết nối đó. Khoá cấp transaction tự nhả khi transaction kết thúc — không rò được.
 * Transaction chỉ để GIỮ khoá; việc đóng đơn vẫn chạy trên `prisma` (transaction riêng từng
 * đơn, kết nối khác của pool) như trước — nên pool cần >= 2 kết nối.
 */

const { expireOverdueOrders } = require('./orderLifecycle');

// Khoá tuỳ ý, chỉ cần cố định và không đụng khoá khác trong hệ thống.
const ADVISORY_LOCK_KEY = 728311;
// Trần thời gian giữ khoá của một lượt (Prisma mặc định 5 s cho interactive transaction — quá
// ngắn khi 200 đơn quá hạn dồn lại). Hết trần thì transaction rollback = nhả khoá; phần việc
// đang chạy vẫn chạy tiếp và vẫn an toàn (UPDATE có điều kiện).
const LOCK_TX_TIMEOUT_MS = 5 * 60 * 1000;

let timer = null;
let running = null;

async function runOnce(prisma) {
  let result = { skipped: true, expired: [] };
  await prisma.$transaction(async (tx) => {
    // _xact_ trả về ngay, không chờ — bản khác đang chạy thì bỏ lượt.
    const [{ locked }] = await tx.$queryRaw`
      SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}) AS locked
    `;
    if (!locked) return;
    const expired = await expireOverdueOrders(prisma);
    if (expired.length > 0) {
      console.log(`[expire-job] đã tự động chuyển ${expired.length} đơn quá hạn QR sang COD:`, expired.join(', '));
    }
    result = { skipped: false, expired };
  }, { maxWait: 10_000, timeout: LOCK_TX_TIMEOUT_MS });
  return result;
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
    // Lượt trước của chính bản này chưa xong thì bỏ lượt (khoá DB cũng sẽ từ chối).
    if (running) return;
    running = (async () => {
      try {
        await runOnce(prisma);
      } catch (err) {
        // Không để job chết: một lần lỗi (mất kết nối DB) không được làm
        // dừng vòng lặp, nếu không kho sẽ kẹt vĩnh viễn mà không ai biết.
        console.error('[expire-job] lỗi:', err.message);
      }
    })();
    try { await running; } finally { running = null; }
  };

  timer = setInterval(tick, seconds * 1000);
  console.log(`[expire-job] quét đơn quá hạn mỗi ${seconds}s`);
  tick();   // chạy ngay một lần lúc khởi động, dọn đơn tồn từ lần chạy trước
  return timer;
}

/** Dừng lịch. Trả Promise chờ lượt đang chạy (nếu có) xong — dùng khi tắt server êm. */
function stop() {
  if (timer) { clearInterval(timer); timer = null; }
  return running || Promise.resolve();
}

module.exports = { start, stop, runOnce, ADVISORY_LOCK_KEY, LOCK_TX_TIMEOUT_MS };
