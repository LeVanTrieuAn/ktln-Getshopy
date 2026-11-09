/**
 * Endpoint thanh toán.
 *
 *   POST /api/payment/webhook/:provider   — nhận biến động số dư từ SePay
 *   GET  /api/b2c/orders/:id/payment-status — client polling trạng thái
 *
 * Nguyên tắc cho webhook:
 *   1. Xác thực TRƯỚC khi làm bất cứ gì khác.
 *   2. Trả 200 nhanh. Provider nào cũng retry khi timeout, mà retry thì nhân
 *      đôi tải. Idempotency tầng 1 (provider_txn_id unique) lo phần không xử
 *      lý lại, nên trả 200 sớm là an toàn.
 *   3. Không bao giờ im lặng bỏ qua tiền — mọi giao dịch không gán được đều
 *      nằm lại trong PaymentTransaction để người thật xử lý.
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { getProvider } = require('../services/payment/providers');
const webhookService = require('../services/payment/webhookService');
const lifecycle = require('../services/payment/orderLifecycle');
const { authB2C } = require('../middleware/authB2C');

/** Log có cấu trúc — webhook hỏng mà không có log thì không truy được gì. */
function logWebhook(stage, detail) {
  console.log(`[payment-webhook] ${stage}`, JSON.stringify(detail));
}

// ─── POST /api/payment/webhook/:provider ────────────────────────────────
router.post('/payment/webhook/:provider', async (req, res) => {
  const providerName = String(req.params.provider || '').toLowerCase();
  const provider = getProvider(providerName);

  if (!provider) {
    logWebhook('unknown-provider', { providerName });
    return res.status(404).json({ success: false, message: 'Provider không tồn tại' });
  }

  // ── 1. Xác thực ───────────────────────────────────────────────────────
  const auth = provider.verify(req);
  if (!auth.ok) {
    // Ghi lại cả lần từ chối: dò key sai lặp lại là dấu hiệu bị tấn công.
    logWebhook('auth-failed', {
      provider: providerName,
      reason: auth.reason,
      ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
    });
    return res.status(401).json({ success: false, message: 'Xác thực thất bại' });
  }

  // ── 2. Chuẩn hoá payload ──────────────────────────────────────────────
  let txn;
  try {
    txn = provider.parse(req.body);
  } catch (err) {
    logWebhook('parse-failed', { provider: providerName, error: err.message });
    return res.status(400).json({ success: false, message: 'Payload không đọc được' });
  }

  if (!txn.providerTxnId) {
    logWebhook('missing-txn-id', { provider: providerName, body: req.body });
    return res.status(400).json({ success: false, message: 'Thiếu mã giao dịch' });
  }

  // ── 3. Đối soát ───────────────────────────────────────────────────────
  try {
    const result = await webhookService.processTransaction(
      prisma, providerName, txn, req.body
    );

    logWebhook('processed', {
      provider: providerName,
      txnId: txn.providerTxnId,
      amount: txn.amount,
      status: result.status,
      orderId: result.orderId ?? null,
      reason: result.reason ?? null,
    });

    // Luôn 200 khi đã ghi nhận được giao dịch — kể cả UNMATCHED hay
    // REFUND_REQUIRED. Đó là kết quả hợp lệ của việc đối soát, không phải lỗi
    // của provider; trả lỗi chỉ khiến họ retry vô ích.
    return res.json(
      provider.successResponse ? provider.successResponse() : { success: true }
    );
  } catch (err) {
    // Lỗi thật (mất kết nối DB...) -> trả lỗi để provider retry.
    logWebhook('error', { provider: providerName, txnId: txn.providerTxnId, error: err.message });
    return res.status(500).json(
      provider.errorResponse ? provider.errorResponse(err.message)
                             : { success: false, message: err.message }
    );
  }
});

// ─── GET /api/b2c/orders/:id/payment-status ─────────────────────────────
// Màn chờ thanh toán poll endpoint này.
//
// PHẢI xác thực chủ đơn. Bản đầu để public vì "chỉ trả trạng thái", nhưng
// order_id có dạng ORD-{timestamp} nên ĐOÁN ĐƯỢC — quét vài nghìn timestamp là
// dò ra đơn thật và đọc được tổng tiền, mã đối soát của người khác.
router.get('/b2c/orders/:id/payment-status', authB2C, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: String(req.params.id) },
      select: {
        id: true, status: true, payment_status: true, customer_id: true,
        paid_at: true, expires_at: true, total: true,
      },
    });

    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

    // Trả 404 chứ không 403: 403 xác nhận đơn đó tồn tại, đủ để dò danh sách id.
    if (!order.customer_id || Number(order.customer_id) !== req.b2cUser.id) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    const now = Date.now();
    const expiresAt = order.expires_at ? order.expires_at.getTime() : null;

    // Thời gian còn lại của phần GIỮ CHỖ trong kho (mặc định 480s)
    const reservationRemaining = expiresAt
      ? Math.max(0, Math.floor((expiresAt - now) / 1000))
      : null;

    // Thời gian còn lại của ĐỒNG HỒ HIỂN THỊ cho khách (mặc định 300s).
    //
    // Hai mốc này khác nhau có chủ ý: server giữ kho lâu hơn đồng hồ khách thấy,
    // để hấp thụ độ trễ ngân hàng (khách quét ở phút 4:50, tiền tới lúc 5:15).
    //
    // Phải tính ở SERVER. Client tự suy ra bằng min(display, reservation) là sai:
    // khi reservation còn 478s thì min(300, 478) luôn = 300, nên mỗi lần polling
    // lại đặt đồng hồ về 5:00 và nó không bao giờ chạy quá 4:57.
    const displayTtl = Number(process.env.PAYMENT_DISPLAY_TTL_SECONDS || 300);
    const reservationTtl = Number(process.env.PAYMENT_RESERVATION_TTL_SECONDS || 480);
    const elapsed = reservationRemaining === null ? null : reservationTtl - reservationRemaining;
    const displayRemaining = elapsed === null ? null : Math.max(0, displayTtl - elapsed);

    return res.json({
      order_id: order.id,
      status: order.status,
      payment_status: order.payment_status,
      paid_at: order.paid_at,
      total: order.total,
      seconds_remaining: reservationRemaining,
      // Client vẽ đồng hồ bằng số này, không tự tính.
      display_seconds_remaining: displayRemaining,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/b2c/orders/:id/cancel ────────────────────────────────────
// Khách tự huỷ đơn của mình.
//
// Cần thiết vì đơn COD trừ kho NGAY khi đặt và expires_at = null — không job
// nào đụng tới. Không có đường huỷ thì khách bom hàng là món đó biến mất khỏi
// tồn kho vĩnh viễn cho tới khi ai đó sửa tay trong DB.
router.post('/b2c/orders/:id/cancel', authB2C, async (req, res) => {
  const orderId = String(req.params.id);
  const reason = String(req.body?.reason || '').slice(0, 500) || null;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customer_id: true, status: true, payment_status: true },
    });
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

    // Chỉ chủ đơn được huỷ. customer_id lấy từ token, không từ body.
    if (!order.customer_id || Number(order.customer_id) !== req.b2cUser.id) {
      return res.status(403).json({ error: 'Đơn hàng này không thuộc về bạn' });
    }

    if (order.status === 'CANCELLED') {
      return res.json({ success: true, already: true, message: 'Đơn đã được huỷ trước đó' });
    }
    // Đơn đang giao hoặc đã giao thì không phải việc của khách nữa.
    if (['SHIPPING', 'DELIVERED'].includes(order.status)) {
      return res.status(400).json({
        error: 'Đơn đang giao hoặc đã giao, vui lòng liên hệ hỗ trợ',
        code: 'ORDER_IN_TRANSIT',
      });
    }

    const result = await prisma.$transaction(tx =>
      lifecycle.cancelOrder(tx, orderId, { reason, cancelledBy: null })
    );

    console.log('[cancel-order]', JSON.stringify({ orderId, by: req.b2cUser.id, reason, ...result }));

    return res.json({
      success: true,
      order_id: orderId,
      restocked_lines: result.restocked,
      points_adjusted: result.pointsAdjusted,
      // Đơn đã trả tiền mà huỷ thì còn nợ khách — nói thẳng ra.
      refund_required: result.refundRequired,
      message: result.refundRequired
        ? 'Đã huỷ đơn. Khoản tiền đã thanh toán sẽ được hoàn lại, bộ phận hỗ trợ sẽ liên hệ với bạn.'
        : 'Đã huỷ đơn hàng.',
    });
  } catch (err) {
    console.error('[cancel-order] lỗi:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ADMIN — hoàn tiền và xác nhận giao hàng
// ═══════════════════════════════════════════════════════════════════════

/** Xác thực admin. Dùng authMiddleware chung của index.js qua req.user. */
function requireAdmin(req, res, next) {
  const jwt = require('jsonwebtoken');
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role === 'customer') {
      return res.status(403).json({ error: 'Cần quyền quản trị' });
    }
    req.adminUser = { id: Number(payload.id), role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
}

// ─── GET /api/b2b/payments/queue ────────────────────────────────────────
// Hàng đợi đối soát: giao dịch cần người thật xử lý.
router.get('/b2b/payments/queue', requireAdmin, async (req, res) => {
  try {
    const status = req.query.status
      ? String(req.query.status).split(',')
      : ['REFUND_REQUIRED', 'UNMATCHED', 'DUPLICATE'];

    const rows = await prisma.paymentTransaction.findMany({
      where: { match_status: { in: status } },
      orderBy: { received_at: 'desc' },
      take: Math.min(Number(req.query.limit) || 50, 200),
    });

    res.json(rows.map(t => ({
      id: Number(t.id),
      order_id: t.order_id,
      provider: t.provider,
      provider_txn_id: t.provider_txn_id,
      amount: t.amount,
      bank_account: t.bank_account,
      content: t.content,
      content_norm: t.content_norm,
      match_status: t.match_status,
      received_at: t.received_at,
      refunded_at: t.refunded_at,
      refunded_amount: t.refunded_amount,
      refund_ref: t.refund_ref,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/b2b/payments/:id/refund ──────────────────────────────────
// Admin đã chuyển tiền trả khách, ghi nhận lại.
//
// REFUND_REQUIRED chỉ nói "cần hoàn"; không có bước này thì không ai biết
// khoản nào đã xử lý, và cùng một giao dịch có thể bị hoàn hai lần.
router.post('/b2b/payments/:id/refund', requireAdmin, async (req, res) => {
  const id = BigInt(req.params.id);
  const { amount, refund_ref, note } = req.body || {};

  try {
    const txn = await prisma.paymentTransaction.findUnique({ where: { id } });
    if (!txn) return res.status(404).json({ error: 'Không tìm thấy giao dịch' });

    if (txn.match_status === 'REFUNDED') {
      return res.status(400).json({
        error: 'Giao dịch này đã được hoàn tiền',
        refunded_at: txn.refunded_at,
        refunded_by: txn.refunded_by,
      });
    }

    const refundAmount = Number.isInteger(amount) ? amount : txn.amount;
    if (refundAmount <= 0 || refundAmount > txn.amount) {
      return res.status(400).json({
        error: `Số tiền hoàn phải trong khoảng 1..${txn.amount}`,
      });
    }

    const updated = await prisma.$transaction(async tx => {
      const t = await tx.paymentTransaction.update({
        where: { id },
        data: {
          match_status: 'REFUNDED',
          refunded_at: new Date(),
          refunded_amount: refundAmount,
          refunded_by: req.adminUser.id,
          refund_ref: refund_ref ? String(refund_ref).slice(0, 100) : null,
          refund_note: note ? String(note).slice(0, 500) : null,
        },
      });
      // Đơn liên quan cũng phải khép lại, nếu không nó kẹt REFUND_REQUIRED mãi.
      if (t.order_id) {
        await tx.order.updateMany({
          where: { id: t.order_id, payment_status: 'REFUND_REQUIRED' },
          data: { payment_status: 'REFUNDED' },
        });
      }
      return t;
    });

    console.log('[refund]', JSON.stringify({
      txnId: String(id), orderId: updated.order_id,
      amount: refundAmount, by: req.adminUser.id, ref: refund_ref,
    }));

    res.json({
      success: true,
      transaction_id: Number(id),
      order_id: updated.order_id,
      refunded_amount: refundAmount,
      refunded_at: updated.refunded_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/b2b/orders/:id/delivered ─────────────────────────────────
// Đánh dấu đã giao tới tay khách. ĐÂY mới là lúc tích điểm thưởng.
router.post('/b2b/orders/:id/delivered', requireAdmin, async (req, res) => {
  try {
    const result = await prisma.$transaction(tx =>
      lifecycle.markDelivered(tx, String(req.params.id))
    );
    console.log('[delivered]', JSON.stringify({
      orderId: req.params.id, by: req.adminUser.id, ...result,
    }));
    res.json({ success: true, order_id: req.params.id, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
