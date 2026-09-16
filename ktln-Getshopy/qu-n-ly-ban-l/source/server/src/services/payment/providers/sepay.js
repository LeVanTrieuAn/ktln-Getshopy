/**
 * Adapter SePay.
 *
 * Đối chiếu tài liệu: https://docs.sepay.vn/lap-trinh-webhooks.html
 *
 * SePay hỗ trợ 4 phương thức xác thực webhook: HMAC-SHA256, API Key,
 * OAuth 2.0, và không xác thực. Adapter này làm HMAC-SHA256 và API Key.
 *
 *   - Ưu tiên HMAC nếu có SEPAY_WEBHOOK_HMAC_SECRET: chữ ký ký lên cả nội dung
 *     payload, nên kẻ chặn được request cũng không sửa nổi số tiền.
 *   - API Key chỉ chứng minh "người gửi biết bí mật", không bảo vệ nội dung.
 *
 * KHÔNG BAO GIỜ chọn "không xác thực": webhook không xác thực nghĩa là bất kỳ
 * ai cũng POST được payload giả để tự tạo đơn đã thanh toán.
 */

const crypto = require('crypto');

/** So sánh bí mật không rò rỉ thời gian. */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

const pick = (obj, ...keys) => {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
};

module.exports = {
  name: 'sepay',

  /**
   * @param {object} req  cần req.rawBody (chuỗi thô) để kiểm HMAC — JSON.stringify
   *                      lại req.body có thể đổi thứ tự khoá và làm sai chữ ký.
   */
  verify(req) {
    const hmacSecret = process.env.SEPAY_WEBHOOK_HMAC_SECRET;
    const apiKey     = process.env.SEPAY_WEBHOOK_API_KEY;

    if (!hmacSecret && !apiKey) {
      return {
        ok: false,
        reason: 'Chưa cấu hình SEPAY_WEBHOOK_HMAC_SECRET hoặc SEPAY_WEBHOOK_API_KEY',
      };
    }

    // ── HMAC-SHA256 (ưu tiên) ──────────────────────────────────────────
    //
    // Theo tài liệu SePay:
    //   X-SePay-Signature : "sha256={hex}"
    //   X-SePay-Timestamp : Unix timestamp (giây)
    //   chuỗi được ký     : "{timestamp}.{raw_body}"
    //
    // Timestamp NẰM TRONG chuỗi ký — ký mỗi body là chữ ký luôn sai.
    // https://developer.sepay.vn/en/sepay-webhooks/xac-thuc
    if (hmacSecret) {
      const rawSig = String(
        req.headers['x-sepay-signature'] || req.headers['x-signature'] || ''
      ).trim();
      const signature = rawSig.replace(/^sha256=/i, '').trim();
      const timestamp = String(
        req.headers['x-sepay-timestamp'] || req.headers['x-timestamp'] || ''
      ).trim();

      if (!signature) return { ok: false, reason: 'Thiếu header X-SePay-Signature' };
      if (!timestamp) return { ok: false, reason: 'Thiếu header X-SePay-Timestamp' };

      if (typeof req.rawBody !== 'string') {
        // Không có body thô thì không kiểm HMAC đúng được. Thà từ chối còn hơn
        // kiểm trên chuỗi đã bị serialize lại rồi báo hợp lệ sai.
        return { ok: false, reason: 'Thiếu rawBody — không kiểm được HMAC' };
      }

      // Chống replay: chữ ký hợp lệ bị chặn lại vẫn bắn lại được nếu không
      // giới hạn tuổi. Nới rộng cho lệch đồng hồ hai bên.
      const skew = Number(process.env.SEPAY_MAX_TIMESTAMP_SKEW_SECONDS || 300);
      const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
      if (!Number.isFinite(age) || age > skew) {
        return { ok: false, reason: `Timestamp lệch ${age}s, quá ngưỡng ${skew}s` };
      }

      const expected = crypto
        .createHmac('sha256', hmacSecret)
        .update(`${timestamp}.${req.rawBody}`, 'utf8')
        .digest('hex');

      if (!safeEqual(signature.toLowerCase(), expected.toLowerCase())) {
        return { ok: false, reason: 'Chữ ký HMAC không khớp' };
      }
      return { ok: true, method: 'hmac' };
    }

    // ── API Key ────────────────────────────────────────────────────────
    // Tài liệu không chốt cứng scheme, nên chấp nhận cả "Apikey" lẫn "Bearer".
    const header = req.headers['authorization'] || '';
    const token = header.replace(/^(Apikey|Bearer)\s+/i, '').trim();
    if (!safeEqual(token, apiKey)) {
      return { ok: false, reason: 'Sai API key' };
    }

    // Lớp phòng thủ thứ hai — tài liệu SePay khuyến nghị whitelist IP.
    const allowList = (process.env.SEPAY_ALLOWED_IPS || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    if (allowList.length > 0) {
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;
      if (!allowList.includes(ip)) {
        return { ok: false, reason: `IP ${ip} không nằm trong allowlist` };
      }
    }

    return { ok: true, method: 'apikey' };
  },

  /**
   * Chuẩn hoá payload SePay về dạng chung.
   *
   * Các trường theo tài liệu:
   *   gateway, transactionDate, accountNumber, subAccount, transferType
   *   ("in" | "out"), transferAmount, accumulated, code, content,
   *   referenceCode, description
   */
  parse(body) {
    const transferType = String(pick(body, 'transferType') || 'in').toLowerCase();

    const rawAmount = pick(body, 'transferAmount', 'amount') ?? 0;
    // Tiền là Int đồng. Payload có thể gửi số hoặc chuỗi "25990000.00".
    const amount = Math.round(Number(rawAmount));

    return {
      // `id` là khoá của SePay, `referenceCode` là mã tham chiếu từ ngân hàng.
      // Cả hai đều duy nhất; ưu tiên `id` vì ổn định hơn giữa các lần retry.
      providerTxnId: String(pick(body, 'id', 'referenceCode', 'transactionId') ?? ''),
      amount,
      // `content` là nội dung chuyển khoản thô — nơi chứa mã đối soát.
      // `code` là mã SePay tự tách ra theo prefix cấu hình trong dashboard;
      // ta không dựa vào nó mà tự dò, để không phụ thuộc cấu hình bên ngoài.
      content: String(pick(body, 'content', 'description') ?? ''),
      bankAccount: String(pick(body, 'accountNumber', 'subAccount') ?? ''),
      isIncoming: transferType === 'in',
      occurredAt: pick(body, 'transactionDate') ?? null,
      gateway: pick(body, 'gateway') ?? null,
    };
  },

  /**
   * SePay coi webhook là đã nhận khi server trả {"success": true}.
   * Trả khác đi thì nó retry — và retry là chuyện bình thường, idempotency
   * tầng 1 (provider_txn_id unique) đã lo phần không xử lý lại.
   */
  successResponse() {
    return { success: true };
  },
  errorResponse(message) {
    return { success: false, message };
  },
};
