/**
 * Vòng đời đơn hàng sau khi tạo: xác nhận thanh toán, hoặc hết hạn.
 *
 * Tách riêng vì ba thứ phải đi cùng nhau và dễ bị bỏ sót một cái:
 *   - tồn kho   (StockReservation)
 *   - voucher   (VoucherUsage + Voucher.used_count)
 *   - điểm      (LoyaltyTransaction + B2CCustomer.loyalty_points)
 *
 * Cả ba đều được "giữ" (HELD) lúc tạo đơn, và phải cùng chuyển sang COMMITTED
 * khi thanh toán, hoặc cùng RELEASED khi hết hạn. Commit tồn kho mà quên trả
 * voucher là mã giảm giá biến mất vĩnh viễn của khách.
 */

const inventory = require('./inventoryService');
const { syncProductStock } = require('./inventoryService');

const POINT_EARN_PER_VND = 100000;

/**
 * Cộng/trừ lượt bán (Product.sold và FlashSaleItem.sold) cho các dòng của đơn hàng.
 * direction = 1 khi đơn được xác nhận (commit), direction = -1 khi đơn đã xác nhận bị huỷ.
 */
async function adjustOrderSold(tx, orderId, direction = 1) {
  const sign = direction >= 0 ? 1 : -1;
  const items = await tx.orderItem.findMany({
    where: { order_id: orderId },
    select: { product_id: true, quantity: true, unit_price: true },
  });

  for (const item of items) {
    const delta = Number(item.quantity || 0) * sign;
    if (!delta) continue;

    await tx.$executeRaw`
      UPDATE "Product"
      SET    sold = GREATEST(0, COALESCE(sold, 0) + ${delta})
      WHERE  id = ${BigInt(item.product_id)}
    `;

    await tx.$executeRaw`
      UPDATE "FlashSaleItem" fsi
      SET    sold = GREATEST(0, COALESCE(fsi.sold, 0) + ${delta})
      FROM   "FlashSale" fs
      WHERE  fsi.flash_sale_id = fs.id
        AND  fsi.product_id = ${BigInt(item.product_id)}
        AND  fsi.discount_price = ${Number(item.unit_price)}
        AND  fs.is_deleted = false
    `;
  }
}

/**
 * Đơn đã thanh toán (hoặc chốt sang COD): chốt mọi thứ đang giữ.
 * Phải gọi bên trong một transaction.
 */
async function commitOrder(tx, orderId) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`Không tìm thấy đơn ${orderId}`);

  // 1. Tồn kho: giữ chỗ -> trừ thật
  const committedCount = await inventory.commitReservations(tx, orderId);
  if (committedCount > 0) {
    await adjustOrderSold(tx, orderId, 1);
  }

  // 2. Voucher: chốt lượt đã dùng
  await tx.voucherUsage.updateMany({
    where: { order_id: orderId, status: 'HELD' },
    data: { status: 'COMMITTED' },
  });

  // 3. Điểm đã tiêu: chốt
  await tx.loyaltyTransaction.updateMany({
    where: { order_id: orderId, status: 'HELD' },
    data: { status: 'COMMITTED' },
  });

  // KHÔNG tích điểm ở đây. Thanh toán xong không có nghĩa là đơn đã hoàn tất —
  // hàng chưa tới tay khách, đơn vẫn có thể bị huỷ. Điểm chỉ tích khi
  // GIAO THÀNH CÔNG, xem markDelivered().
}

/**
 * Chuyển đơn chuyển khoản (BANK_TRANSFER đang chờ thanh toán) sang COD:
 * - Chốt giữ chỗ tồn kho từ HELD -> COMMITTED (giữ nguyên mức tồn đã trừ lúc đặt hàng: 601 -> 600)
 * - Chốt voucher & điểm thưởng đã dùng
 * - Đổi payment_method = 'COD', payment_status = 'UNPAID', status = 'CONFIRMED', expires_at = null
 */
async function convertTransferToCod(tx, orderId) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`Không tìm thấy đơn ${orderId}`);

  if (order.payment_status === 'PAID') {
    return { changed: false, alreadyPaid: true, order };
  }
  if (order.payment_method === 'COD' && order.status === 'CONFIRMED') {
    return { changed: false, alreadyCod: true, order };
  }
  if (order.payment_status !== 'PENDING' || order.status === 'CANCELLED') {
    return { changed: false, reason: 'Đơn không ở trạng thái chờ thanh toán', order };
  }

  await commitOrder(tx, orderId);

  const updated = await tx.order.update({
    where: { id: orderId },
    data: {
      payment_method: 'COD',
      payment_status: 'UNPAID',
      status: 'CONFIRMED',
      expires_at: null,
    },
  });

  return { changed: true, order: updated };
}

/**
 * Đơn đã giao tới tay khách. Đây mới là lúc tích điểm.
 *
 * Tách khỏi commitOrder vì hai sự kiện khác nhau: "đã trả tiền" không đồng
 * nghĩa "đã nhận hàng". Tích điểm sớm tạo ra lỗ hổng đặt-tích-tiêu-huỷ:
 * khách tiêu sạch điểm vừa tích rồi huỷ đơn, thu hồi gặp số dư 0 nên không
 * trừ được, lời đúng số điểm đó và lặp vô hạn.
 */
async function markDelivered(tx, orderId) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`Không tìm thấy đơn ${orderId}`);
  if (order.status === 'DELIVERED') return { changed: false, earned: 0 };
  if (order.status === 'CANCELLED') {
    throw new Error('Không đánh dấu giao thành công cho đơn đã huỷ');
  }

  // COD: tiền thu lúc giao, nên đây cũng là lúc ghi nhận đã thanh toán.
  const codPaid = order.payment_method === 'COD' && order.payment_status === 'UNPAID';

  await tx.order.update({
    where: { id: orderId },
    data: {
      status: 'DELIVERED',
      ...(codPaid ? { payment_status: 'PAID', paid_at: new Date(), paid_amount: order.total } : {}),
    },
  });

  let earned = 0;
  if (order.customer_id) {
    // Chỉ tích một lần, kể cả khi hàm này bị gọi lại.
    const already = await tx.loyaltyTransaction.count({
      where: { order_id: orderId, reason: 'EARN_ORDER' },
    });
    if (already === 0) {
      earned = Math.floor(order.total / POINT_EARN_PER_VND);
      if (earned > 0) {
        await tx.loyaltyTransaction.create({
          data: {
            customer_id: order.customer_id, order_id: orderId,
            points: earned, reason: 'EARN_ORDER', status: 'COMMITTED',
          },
        });
        await tx.b2CCustomer.update({
          where: { id: order.customer_id },
          data: { loyalty_points: { increment: earned } },
        });
      }
    }
  }
  return { changed: true, earned, codPaid };
}

/**
 * Đơn hết hạn chưa thanh toán: trả lại mọi thứ đang giữ.
 *
 * Nếu hàm này không chạy, ba thứ rò rỉ cùng lúc: reserved chỉ tăng không giảm
 * (tồn khả dụng về 0 dù kho đầy), voucher của khách mất, điểm của khách mất.
 */
async function expireOrder(tx, orderId) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) return false;

  // Chỉ hết hạn đơn còn đang chờ. Đơn đã PAID thì không đụng vào.
  if (order.payment_status !== 'PENDING') return false;

  // 1. Nhả chỗ trong kho
  await inventory.releaseReservations(tx, orderId);

  // 2. Trả lại voucher
  const usages = await tx.voucherUsage.findMany({
    where: { order_id: orderId, status: 'HELD' },
  });
  for (const u of usages) {
    await tx.voucher.update({
      where: { id: u.voucher_id },
      // GREATEST qua raw không cần thiết ở đây vì used_count chỉ giảm đúng
      // số lần đã tăng, nhưng vẫn chặn âm cho chắc.
      data: { used_count: { decrement: 1 } },
    });
  }
  await tx.voucherUsage.updateMany({
    where: { order_id: orderId, status: 'HELD' },
    data: { status: 'RELEASED' },
  });

  // 3. Hoàn điểm đã tiêu
  const held = await tx.loyaltyTransaction.findMany({
    where: { order_id: orderId, status: 'HELD' },
  });
  for (const t of held) {
    if (t.points < 0) {
      await tx.b2CCustomer.update({
        where: { id: t.customer_id },
        data: { loyalty_points: { increment: -t.points } },
      });
    }
  }
  await tx.loyaltyTransaction.updateMany({
    where: { order_id: orderId, status: 'HELD' },
    data: { status: 'RELEASED' },
  });

  // 4. Đóng đơn
  await tx.order.update({
    where: { id: orderId },
    data: { payment_status: 'EXPIRED', status: 'CANCELLED' },
  });

  return true;
}

/**
 * Quét các đơn chuyển khoản quá hạn chờ QR và tự động chuyển sang COD
 * (giữ nguyên tồn kho đã trừ khi đặt hàng và xác nhận đơn).
 * Mỗi đơn một transaction riêng: một đơn lỗi không kéo cả lô chết theo.
 */
async function expireOverdueOrders(prisma, { limit = 200 } = {}) {
  const overdue = await prisma.order.findMany({
    where: {
      payment_status: 'PENDING',
      expires_at: { lt: new Date() },
    },
    select: { id: true },
    take: limit,
  });

  const converted = [];
  for (const o of overdue) {
    try {
      const res = await prisma.$transaction(tx => convertTransferToCod(tx, o.id));
      if (res.changed) converted.push(o.id);
    } catch (err) {
      console.error(`[expire->cod] đơn ${o.id} lỗi:`, err.message);
    }
  }
  return converted;
}

/**
 * Huỷ đơn đã xác nhận (chủ yếu là COD bị bom hàng, hoặc khách đổi ý).
 *
 * Khác expireOrder ở chỗ: đơn này đã CONFIRMED nên kho đã bị TRỪ THẬT
 * (reservation ở trạng thái COMMITTED), không phải chỉ đang giữ chỗ. Phải cộng
 * lại on_hand chứ không chỉ nhả reserved.
 *
 * Nếu không có hàm này thì đơn COD bị bom hàng làm hàng biến mất khỏi tồn kho
 * vĩnh viễn — không job nào đụng tới đơn COD vì expires_at = null.
 *
 * Idempotent: gọi lại trên đơn đã CANCELLED không làm gì thêm.
 */
async function cancelOrder(tx, orderId, { reason = null, cancelledBy = null } = {}) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`Không tìm thấy đơn ${orderId}`);

  if (order.status === 'CANCELLED') return { changed: false, reason: 'Đơn đã huỷ trước đó' };
  if (order.status === 'DELIVERED') {
    throw new Error('Không huỷ được đơn đã giao — dùng luồng trả hàng/hoàn tiền');
  }

  // ── 1. Kho ───────────────────────────────────────────────────────────
  // COMMITTED: đã trừ thật -> cộng lại on_hand
  // HELD     : mới giữ chỗ  -> chỉ nhả reserved
  const committed = await tx.stockReservation.findMany({
    where: { order_id: orderId, status: 'COMMITTED' },
  });
  for (const r of committed) {
    await tx.$executeRaw`
      UPDATE "Inventory"
      SET    on_hand = on_hand + ${r.quantity}, updated_at = NOW()
      WHERE  id = ${r.inventory_id}
    `;
  }
  if (committed.length > 0) {
    await tx.stockReservation.updateMany({
      where: { order_id: orderId, status: 'COMMITTED' },
      data: { status: 'RELEASED' },
    });
    await syncProductStock(tx, committed.map(r => r.inventory_id));
    await adjustOrderSold(tx, orderId, -1);
  }
  await inventory.releaseReservations(tx, orderId);   // phần còn HELD (nếu có)

  // ── 2. Voucher: trả lại lượt dùng ────────────────────────────────────
  const usages = await tx.voucherUsage.findMany({
    where: { order_id: orderId, status: { in: ['HELD', 'COMMITTED'] } },
  });
  for (const u of usages) {
    await tx.voucher.update({
      where: { id: u.voucher_id },
      data: { used_count: { decrement: 1 } },
    });
  }
  await tx.voucherUsage.updateMany({
    where: { order_id: orderId, status: { in: ['HELD', 'COMMITTED'] } },
    data: { status: 'RELEASED' },
  });

  // ── 3. Điểm thưởng ───────────────────────────────────────────────────
  // Đảo ngược cả hai chiều: hoàn lại điểm đã tiêu, thu hồi điểm đã tích.
  const ledger = await tx.loyaltyTransaction.findMany({
    where: { order_id: orderId, status: { in: ['HELD', 'COMMITTED'] } },
  });
  let delta = 0;
  for (const t of ledger) delta -= t.points;   // đảo dấu
  if (order.customer_id && delta !== 0) {
    if (delta > 0) {
      await tx.b2CCustomer.update({
        where: { id: order.customer_id },
        data: { loyalty_points: { increment: delta } },
      });
    } else {
      // Thu hồi điểm đã tích. GREATEST(0,...) vì khách có thể đã tiêu mất rồi —
      // để điểm âm thì lần mua sau tính toán sẽ sai.
      await tx.$executeRaw`
        UPDATE "B2CCustomer"
        SET    loyalty_points = GREATEST(0, loyalty_points + ${delta})
        WHERE  id = ${order.customer_id}
      `;
    }
  }
  await tx.loyaltyTransaction.updateMany({
    where: { order_id: orderId, status: { in: ['HELD', 'COMMITTED'] } },
    data: { status: 'RELEASED' },
  });

  // ── 4. Đơn ───────────────────────────────────────────────────────────
  const wasPaid = order.payment_status === 'PAID';
  await tx.order.update({
    where: { id: orderId },
    data: {
      status: 'CANCELLED',
      // Đơn đã trả tiền mà huỷ thì còn nợ khách — KHÔNG đánh dấu là xong.
      payment_status: wasPaid ? 'REFUND_REQUIRED' : 'CANCELLED',
    },
  });

  // Ghi vết vào giao dịch thanh toán để admin biết phải hoàn tiền
  if (wasPaid) {
    await tx.paymentTransaction.updateMany({
      where: { order_id: orderId, match_status: { in: ['MATCHED', 'LATE_MATCHED'] } },
      data: {
        match_status: 'REFUND_REQUIRED',
        confirm_reason: reason ? `Huỷ đơn: ${reason}` : 'Huỷ đơn đã thanh toán',
        confirmed_by: cancelledBy,
        confirmed_at: new Date(),
      },
    });
  }

  return {
    changed: true,
    restocked: committed.length,
    pointsAdjusted: delta,
    refundRequired: wasPaid,
  };
}

module.exports = {
  commitOrder, convertTransferToCod, adjustOrderSold,
  expireOrder, expireOverdueOrders, cancelOrder, markDelivered,
  POINT_EARN_PER_VND,
};
