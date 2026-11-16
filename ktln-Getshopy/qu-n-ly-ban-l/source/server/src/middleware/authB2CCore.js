'use strict';
/**
 * Lõi của authB2C / optionalAuthB2C, tách khỏi jsonwebtoken và Prisma (16/11/2026) để kiểm
 * thử bằng `node --test` mà không cần node_modules — xem tests/customer-admin.test.js.
 * middleware/authB2C.js gắn thư viện thật vào và là nơi mọi route require.
 *
 * Thêm so với bản trước: sau khi chữ ký hợp lệ, hỏi trạng thái tài khoản (statusCache).
 * JWT sống 7 ngày; không hỏi thì khách đã bị quản trị vô hiệu hoá vẫn đặt hàng, xem đơn,
 * sửa wishlist bằng token cũ tới khi token hết hạn.
 */

const MSG_ACCOUNT_DISABLED = 'Tài khoản đã bị vô hiệu hoá, vui lòng liên hệ cửa hàng';
const MSG_ACCOUNT_MISSING = 'Tài khoản không còn tồn tại, vui lòng đăng nhập lại';
const MSG_BUSY = 'Hệ thống đang bận, vui lòng thử lại sau.';

function bearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

/**
 * @param {object} deps
 * @param {(token: string) => object} deps.verifyToken  ném lỗi nếu token sai / hết hạn (jwt.verify)
 * @param {{ getStatus: (id: number) => Promise<'active'|'inactive'|'missing'> }} deps.statusCache
 * @param {{ error: Function }} [deps.logger]
 */
function createAuthB2C({ verifyToken, statusCache, logger = console }) {
  /** Bắt buộc đăng nhập. Gắn req.b2cUser = { id, role }. */
  async function authB2C(req, res, next) {
    const token = bearer(req);
    if (!token) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục' });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      const expired = err && err.name === 'TokenExpiredError';
      return res.status(401).json({
        error: expired ? 'Phiên đăng nhập đã hết hạn' : 'Token không hợp lệ',
        code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      });
    }
    if (!payload || payload.role !== 'customer') {
      // Token admin không được dùng thay token khách — hai không gian id khác nhau
      // (User.id vs B2CCustomer.id), nhầm lẫn sẽ gán đơn cho sai người.
      return res.status(403).json({ error: 'Token không hợp lệ cho khu vực khách hàng' });
    }
    const id = Number(payload.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(401).json({ error: 'Token không hợp lệ', code: 'TOKEN_INVALID' });
    }

    let status;
    try {
      status = await statusCache.getStatus(id);
    } catch (err) {
      // Không biết trạng thái thì KHÔNG cho qua: route phía sau cũng cần DB, và cho qua
      // nghĩa là khách đã bị khoá vẫn đặt được hàng đúng lúc DB chập chờn.
      logger.error('[authB2C] Không đọc được trạng thái tài khoản:', err && err.message);
      return res.status(503).json({ error: MSG_BUSY });
    }
    // 401 (không phải 403): token không còn dùng được nữa. Client (services/api.js) gặp 401
    // thì xoá phiên và về trang chủ; mã ACCOUNT_DISABLED để client báo đúng lý do.
    if (status === 'inactive') {
      return res.status(401).json({ error: MSG_ACCOUNT_DISABLED, code: 'ACCOUNT_DISABLED' });
    }
    if (status !== 'active') {
      return res.status(401).json({ error: MSG_ACCOUNT_MISSING, code: 'ACCOUNT_NOT_FOUND' });
    }

    req.b2cUser = { id, role: payload.role };
    return next();
  }

  /**
   * Không bắt buộc đăng nhập, nhưng nhận diện nếu có token hợp lệ CỦA TÀI KHOẢN ĐANG HOẠT
   * ĐỘNG. Tài khoản bị vô hiệu hoá / không đọc được trạng thái = khách vãng lai (như token
   * hỏng) — endpoint công khai không bao giờ chặn vì chuyện này.
   */
  async function optionalAuthB2C(req, res, next) {
    const token = bearer(req);
    if (token) {
      try {
        const payload = verifyToken(token);
        const id = Number(payload && payload.id);
        if (payload && payload.role === 'customer' && Number.isSafeInteger(id) && id > 0
            && await statusCache.getStatus(id) === 'active') {
          req.b2cUser = { id, role: payload.role };
        }
      } catch { /* token hỏng / DB lỗi thì coi như khách vãng lai */ }
    }
    return next();
  }

  return { authB2C, optionalAuthB2C };
}

module.exports = { createAuthB2C, MSG_ACCOUNT_DISABLED };
