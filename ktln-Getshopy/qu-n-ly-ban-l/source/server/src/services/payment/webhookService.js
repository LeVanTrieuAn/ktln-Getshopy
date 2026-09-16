/**
 * Đối soát giao dịch ngân hàng với đơn hàng.
 *
 * Nguyên tắc xuyên suốt: KHÔNG BAO GIỜ im lặng bỏ qua tiền. Mọi giao dịch
 * không gán được vào đơn còn hiệu lực đều phải nằm trong một hàng đợi để người
 * thật xử lý.
 *
 * Các trạng thái của PaymentTransaction.match_status:
 *   MATCHED         khớp đơn còn hiệu lực
 *   LATE_MATCHED    đơn đã hết hạn nhưng giữ chỗ lại được -> vẫn cho PAID
 *   UNMATCHED       chưa tìm ra đơn — KHÔNG phải trạng thái cuối, job re-match quét lại
 *   REFUND_REQUIRED tiền đã vào nhưng không gán được vào đơn nào còn hiệu lực
 *   DUPLICATE       đơn đã PAID rồi, đây là tiền thừa
 */

const { extractPaymentRefs, normalizeContent } = require('./paymentRef');
const inventory = require('./inventoryService');
const lifecycle = require('./orderLifecycle');

const S = {
  MATCHED: 'MATCHED',
  LATE_MATCHED: 'LATE_MATCHED',
  UNMATCHED: 'UNMATCHED',
  REFUND_REQUIRED: 'REFUND_REQUIRED',
  DUPLICATE: 'DUPLICATE',
};

/**
 * Xử lý một giao dịch đã được adapter chuẩn hoá.
 *
 * @param {object} prisma
 * @param {string} providerName
 * @param {object} txn       kết quả của adapter.parse()
 * @param {object} rawBody   payload gốc, luôn được lưu để còn điều tra
 */
async function processTransaction(prisma, providerName, txn, rawBody) {
  const contentNorm = normalizeContent(txn.content);

  // ── Idempotency tầng 1: chặn webhook bắn trùng cùng một giao dịch ────
  // provider_txn_id là @unique, nên chỉ cần thử ghi. Nếu đã tồn tại thì đây là
  // bản retry của provider, không phải tiền mới.
  const existing = await prisma.paymentTransaction.findUnique({
    where: { provider_txn_id: txn.providerTxnId },
  });
  if (existing) {
    return { status: existing.match_status, duplicate: true, transactionId: existing.id };
  }

  // Ghi TRƯỚC khi xử lý — nếu bước sau lỗi thì vẫn còn dấu vết để truy.
  const record = await prisma.paymentTransaction.create({
    data: {
      provider: providerName,
      provider_txn_id: txn.providerTxnId,
      amount: txn.amount,
      bank_account: txn.bankAccount || null,
      content: txn.content || null,
      content_norm: contentNorm || null,
      raw_payload: rawBody,
      match_status: S.UNMATCHED,
    },
  });

  // Tiền ra không liên quan tới thanh toán đơn hàng
  if (!txn.isIncoming) {
    return { status: S.UNMATCHED, reason: 'Giao dịch tiền ra', transactionId: record.id };
  }

  // Tiền phải vào ĐÚNG tài khoản in trên QR.
  // SePay có thể theo dõi nhiều tài khoản; không kiểm thì tiền vào tài khoản
  // khác vẫn làm đơn chuyển PAID, trong khi tài khoản nhận hàng thật không có
  // đồng nào. Bỏ qua kiểm tra nếu chưa cấu hình, để môi trường dev không vỡ.
  const expectedAccount = (process.env.VIETQR_ACCOUNT_NO || '').trim();
  if (expectedAccount && txn.bankAccount) {
    const got = String(txn.bankAccount).replace(/\s/g, '');
    if (got !== expectedAccount) {
      await prisma.paymentTransaction.update({
        where: { id: record.id },
        data: { match_status: S.REFUND_REQUIRED },
      });
      return {
        status: S.REFUND_REQUIRED,
        reason: `Tiền vào tài khoản ${got}, không phải tài khoản nhận ${expectedAccount}`,
        transactionId: record.id,
      };
    }
  }

  // ── Dò mã đối soát ───────────────────────────────────────────────────
  const refs = extractPaymentRefs(txn.content);

  if (refs.length === 0) {
    // Có thể webhook đến TRƯỚC khi đơn kịp commit, hoặc khách không ghi nội dung.
    // Để UNMATCHED cho job re-match quét lại, chưa kết luận.
    return { status: S.UNMATCHED, reason: 'Không tìm thấy mã đối soát', transactionId: record.id };
  }
  if (refs.length > 1) {
    // Không đoán bừa đơn nào — đưa người thật xử lý.
    await prisma.paymentTransaction.update({
      where: { id: record.id },
      data: { match_status: S.REFUND_REQUIRED },
    });
    return {
      status: S.REFUND_REQUIRED,
      reason: `Nội dung chứa ${refs.length} mã đối soát: ${refs.join(', ')}`,
      transactionId: record.id,
    };
  }

  return applyPayment(prisma, record.id, refs[0], txn.amount);
}

/**
 * Gán một giao dịch vào đơn hàng và chuyển đơn sang PAID.
 * Tách riêng để job re-match gọi lại được.
 */
async function applyPayment(prisma, transactionId, ref, amount) {
  const order = await prisma.order.findUnique({ where: { payment_ref: ref } });

  if (!order) {
    return { status: S.UNMATCHED, reason: `Không có đơn nào mang mã ${ref}`, transactionId };
  }

  // Số tiền phải khớp chính xác — QR động đã khoá sẵn số tiền, nên lệch nghĩa là
  // khách chuyển tay và gõ sai, hoặc có gì đó không ổn. Không tự động quyết định.
  if (amount !== order.total) {
    await prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: { order_id: order.id, match_status: S.REFUND_REQUIRED },
    });
    return {
      status: S.REFUND_REQUIRED,
      reason: `Số tiền lệch: nhận ${amount}đ, đơn ${order.total}đ`,
      orderId: order.id,
      transactionId,
    };
  }

  // ── Idempotency tầng 2 ───────────────────────────────────────────────
  // Chặn kịch bản khách chuyển 2 lần vì tưởng lần đầu thất bại: hai giao dịch
  // hợp lệ, khác provider_txn_id nên tầng 1 không chặn được.
  // Cập nhật có điều kiện: chỉ đơn đang PENDING mới chuyển được sang PAID.
  const updated = await prisma.$executeRaw`
    UPDATE "Order"
    SET    payment_status = 'PAID', paid_at = NOW(), paid_amount = ${amount},
           status = 'CONFIRMED'
    WHERE  id = ${order.id} AND payment_status = 'PENDING'
  `;

  if (updated === 1) {
    // Chốt cả ba thứ đang giữ: tồn kho, voucher, điểm — và tích điểm cho đơn.
    // Commit mỗi tồn kho mà quên voucher là mã giảm giá của khách biến mất.
    await prisma.$transaction(async tx => {
      await lifecycle.commitOrder(tx, order.id);
    });
    await prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: { order_id: order.id, match_status: S.MATCHED },
    });
    return { status: S.MATCHED, orderId: order.id, transactionId };
  }

  // rowCount = 0 -> đơn không còn ở PENDING. Hai khả năng:
  const fresh = await prisma.order.findUnique({ where: { id: order.id } });

  if (fresh.payment_status === 'PAID') {
    // Đã thanh toán rồi -> đây là tiền thừa, phải hoàn
    await prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: { order_id: order.id, match_status: S.DUPLICATE },
    });
    return {
      status: S.DUPLICATE,
      reason: 'Đơn đã được thanh toán trước đó — giao dịch này là tiền thừa',
      orderId: order.id, transactionId,
    };
  }

  // Đơn đã EXPIRED: webhook đến muộn. Thử giữ chỗ lại — còn hàng thì vẫn cho
  // khách, không bắt họ chờ hoàn tiền.
  return retryExpiredOrder(prisma, fresh, transactionId, amount);
}

/**
 * Đơn đã hết hạn mà tiền mới tới. Thử giành lại chỗ trong kho.
 *
 * Kịch bản này xảy ra thường xuyên chứ không hiếm: khách quét QR ở phút 4:50,
 * ngân hàng xử lý xong thì đã quá hạn. Cũng xảy ra khi khách chụp màn hình QR
 * rồi quét lại sau — chuẩn EMVCo không có trường hết hạn.
 */
async function retryExpiredOrder(prisma, order, transactionId, amount) {
  const items = await prisma.orderItem.findMany({ where: { order_id: order.id } });

  try {
    await prisma.$transaction(async tx => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await inventory.reserveStock(
        tx, order.id,
        items.map(i => ({
          product_id: i.product_id, variant_id: i.variant_id,
          branch_id: i.branch_id, quantity: i.quantity,
        })),
        expiresAt
      );
      await tx.order.update({
        where: { id: order.id },
        data: {
          payment_status: 'PAID', paid_at: new Date(), paid_amount: amount,
          status: 'CONFIRMED',
        },
      });
      await lifecycle.commitOrder(tx, order.id);
    });

    await prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: { order_id: order.id, match_status: S.LATE_MATCHED },
    });
    return {
      status: S.LATE_MATCHED,
      reason: 'Đơn đã hết hạn nhưng giữ chỗ lại được — vẫn xác nhận thanh toán',
      orderId: order.id, transactionId,
    };
  } catch (err) {
    // Hết hàng thật -> phải hoàn tiền, không im lặng bỏ qua
    await prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: { order_id: order.id, match_status: S.REFUND_REQUIRED },
    });
    return {
      status: S.REFUND_REQUIRED,
      reason: `Đơn đã hết hạn và không còn hàng để giữ lại (${err.message})`,
      orderId: order.id, transactionId,
    };
  }
}

/**
 * Quét lại các giao dịch UNMATCHED.
 * Cần thiết vì webhook có thể đến trước khi transaction tạo đơn kịp commit.
 */
async function rematchPending(prisma, { olderThanMs = 0, limit = 100 } = {}) {
  const pending = await prisma.paymentTransaction.findMany({
    where: {
      match_status: S.UNMATCHED,
      received_at: { lte: new Date(Date.now() - olderThanMs) },
    },
    take: limit,
    orderBy: { received_at: 'asc' },
  });

  const results = [];
  for (const t of pending) {
    const refs = extractPaymentRefs(t.content || '');
    if (refs.length !== 1) continue;
    results.push(await applyPayment(prisma, t.id, refs[0], t.amount));
  }
  return results;
}

module.exports = { processTransaction, applyPayment, rematchPending, MATCH_STATUS: S };
