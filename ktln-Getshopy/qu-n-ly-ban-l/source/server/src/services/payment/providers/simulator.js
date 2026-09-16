/**
 * Adapter mô phỏng — để test end-to-end khi chưa có tài khoản SePay thật.
 *
 * Payload mô phỏng đúng cấu trúc của webhook thật, nên khi cắm adapter thật vào
 * thì phần đối soát không phải sửa gì.
 *
 * ⚠️ CHỈ hoạt động khi NODE_ENV !== 'production'. Trên môi trường thật, adapter
 * này từ chối mọi request — nếu không nó chính là cửa hậu tạo đơn PAID miễn phí.
 */
const crypto = require('crypto');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

module.exports = {
  name: 'simulator',

  verify(req) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, reason: 'Adapter mô phỏng bị tắt trên production' };
    }
    const expected = process.env.PAYMENT_SIMULATOR_KEY;
    if (!expected) return { ok: false, reason: 'Chưa cấu hình PAYMENT_SIMULATOR_KEY' };

    const token = (req.headers['authorization'] || '').replace(/^(Apikey|Bearer)\s+/i, '').trim();
    return safeEqual(token, expected) ? { ok: true } : { ok: false, reason: 'Sai key mô phỏng' };
  },

  parse(body) {
    return {
      providerTxnId: String(body.id ?? `SIM-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`),
      amount: Math.round(Number(body.amount ?? 0)),
      content: String(body.content ?? ''),
      bankAccount: String(body.accountNumber ?? 'SIMULATOR'),
      isIncoming: body.transferType ? body.transferType === 'in' : true,
      occurredAt: body.transactionDate ?? new Date().toISOString(),
    };
  },
};
