/**
 * Tạo đơn hàng.
 *
 * Thay cho khối code cũ ở index.js:682-820, sửa bốn vấn đề:
 *
 *   1. Tiền lấy từ req.body  -> server tính lại toàn bộ từ DB (pricingService)
 *   2. Trừ kho check-then-act -> giữ chỗ atomic (inventoryService)
 *   3. Ghi thẳng ClickHouse trong request path -> bỏ, để CDC lo
 *   4. Không có thông tin thanh toán -> payment_ref + QR động
 *
 * Toàn bộ nằm trong MỘT transaction: hoặc có đơn đầy đủ kèm chỗ trong kho,
 * hoặc không có gì. Không để đơn tồn tại mà chưa giữ được hàng.
 */

const { priceOrder, diffClientClaim } = require('./pricingService');
const inventory = require('./inventoryService');
const { generatePaymentRef } = require('./paymentRef');
const { buildVietQRPayload } = require('./vietqr');
const QRCode = require('qrcode');
const { bankNameByBin } = require('./banks');

const PAYMENT_METHOD = { COD: 'COD', BANK_TRANSFER: 'BANK_TRANSFER' };

/** Đọc TTL từ env, có mặc định an toàn. */
function getTTLs() {
  const display = Number(process.env.PAYMENT_DISPLAY_TTL_SECONDS || 300);
  const reservation = Number(process.env.PAYMENT_RESERVATION_TTL_SECONDS || 480);
  return { display, reservation };
}

/**
 * Nội dung chuyển khoản.
 *
 * Ngắn gọn vì ngân hàng giới hạn độ dài và khách có thể phải gõ tay.
 *
 * ⚠️ TIỀN TỐ BẮT BUỘC VỚI MỘT SỐ NGÂN HÀNG.
 * VietinBank: SePay chỉ nhận được thông báo biến động số dư khi nội dung
 * chuyển khoản BẮT ĐẦU bằng "SEVQR". Thiếu tiền tố này thì tiền vào tài khoản
 * bình thường nhưng SePay không thấy giao dịch nào -> không có webhook -> đơn
 * nằm PENDING tới khi hết hạn, và KHÔNG có lỗi nào báo ra ở đâu cả.
 * https://docs.sepay.vn/ket-noi-vietinbank.html
 *
 * Đặt qua PAYMENT_CONTENT_PREFIX. Ngân hàng khác để trống nếu không yêu cầu —
 * kiểm tra tài liệu kết nối của từng ngân hàng bên SePay.
 */
const buildTransferContent = ref => {
  const prefix = (process.env.PAYMENT_CONTENT_PREFIX || '').trim().toUpperCase();
  return prefix ? `${prefix} ${ref}` : `TT ${ref}`;
};

/**
 * Sinh QR động cho một đơn.
 * Trả null nếu chưa cấu hình tài khoản nhận — để đơn vẫn tạo được và admin
 * biết mà đi cấu hình, thay vì làm hỏng cả luồng đặt hàng.
 */
async function buildQR(order) {
  const bankBin = process.env.VIETQR_BANK_BIN;
  const accountNo = process.env.VIETQR_ACCOUNT_NO;
  const accountName = process.env.VIETQR_ACCOUNT_NAME;

  if (!bankBin || !accountNo) {
    console.warn('[checkout] Chưa cấu hình VIETQR_BANK_BIN / VIETQR_ACCOUNT_NO — không sinh được QR');
    return null;
  }

  const payload = buildVietQRPayload({
    bankBin, accountNo,
    amount: order.total,
    content: buildTransferContent(order.payment_ref),
  });

  // Render ảnh ngay ở server: client không phải thêm thư viện QR nào, và ảnh
  // sinh ra nhất quán giữa web/mobile. Vẫn trả kèm payload thô để client render
  // lại ở độ phân giải khác nếu cần.
  let dataUrl = null;
  try {
    dataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',   // đủ chịu lỗi khi chụp màn hình/in ra
      margin: 2,
      width: 512,
    });
  } catch (err) {
    console.error('[checkout] không render được ảnh QR:', err.message);
  }

  return {
    payload,                                   // chuỗi EMVCo thô
    data_url: dataUrl,                         // ảnh PNG base64, gắn thẳng vào <img src>
    bank_bin: bankBin,
    // Khách cần biết chuyển vào ngân hàng nào; mã BIN không nói lên điều gì.
    bank_name: bankNameByBin(bankBin),
    account_no: accountNo,
    account_name: accountName || '',
    amount: order.total,
    content: buildTransferContent(order.payment_ref),
    payment_ref: order.payment_ref,
  };
}

/**
 * @param {object} prisma
 * @param {object} input
 * @param {Array}  input.items          [{ id, quantity, variant_id?, branch_id? }]
 * @param {object} input.customerInfo   thông tin nhận hàng
 * @param {string} input.paymentMethod  COD | BANK_TRANSFER
 * @param {number} input.customerId     LẤY TỪ TOKEN, không từ body
 * @param {object} [input.claimed]      số tiền client tự tính — chỉ để đối chiếu
 */
async function createOrder(prisma, {
  items, customerInfo, paymentMethod, customerId,
  voucherCode, pointsToUse = 0, claimed = {},
}) {
  const method = paymentMethod === PAYMENT_METHOD.BANK_TRANSFER
    ? PAYMENT_METHOD.BANK_TRANSFER
    : PAYMENT_METHOD.COD;

  // ── 1. Tính tiền từ DB ────────────────────────────────────────────────
  const pricing = await priceOrder(prisma, {
    items,
    province: customerInfo?.province,
    voucherCode, pointsToUse, customerId,
  });

  // Client tính lệch không phải lỗi chặn — có thể do giá vừa đổi hoặc client cũ.
  // Nhưng phải ghi lại: lệch bất thường và lặp lại là dấu hiệu bị dò.
  const diffs = diffClientClaim(pricing, claimed);
  if (diffs.length > 0) {
    console.warn('[checkout] client gửi số tiền khác server tính:', JSON.stringify(diffs));
  }

  const { display, reservation } = getTTLs();
  const now = Date.now();
  const orderId = 'ORD-' + now;

  const isTransfer = method === PAYMENT_METHOD.BANK_TRANSFER;
  // Server giữ chỗ LÂU HƠN đồng hồ hiển thị cho khách. Chuẩn EMVCo không có
  // trường hết hạn, nên khách quét ở phút 4:50 mà ngân hàng xử lý xong lúc
  // 5:15 là chuyện thường — khoảng chênh này hấp thụ độ trễ đó.
  const reservationExpiresAt = new Date(now + reservation * 1000);

  // ── 2. Ghi đơn + giữ chỗ trong MỘT transaction ────────────────────────
  const order = await prisma.$transaction(async tx => {
    // ── Chặn spam giữ chỗ ───────────────────────────────────────────────
    // Không giới hạn thì một khách tạo hàng chục đơn chưa thanh toán trong
    // nháy mắt, giữ sạch kho 8 phút rồi lặp lại — hàng hot không ai mua được.
    //
    // Phải làm TRONG transaction và có advisory lock. Đếm ở ngoài rồi mới tạo
    // là check-then-act: các request đồng thời cùng đọc count=0, cùng thấy
    // chưa tới giới hạn, cùng tạo đơn (đã đo: giới hạn 3 nhưng lọt 10 đơn).
    //
    // pg_advisory_xact_lock serialize các lần checkout của CÙNG một khách;
    // khách khác nhau không chờ nhau. Lock tự nhả khi transaction kết thúc.
    if (customerId && isTransfer) {
      const max = Number(process.env.MAX_PENDING_ORDERS_PER_CUSTOMER || 3);
      // Bản 2 tham số của pg_advisory_xact_lock nhận (int4, int4), nhưng Prisma
      // bind số JS thành bigint -> phải cast tường minh, nếu không Postgres báo
      // "function does not exist" và MỌI checkout đều fail.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(42::int, ${Number(customerId)}::int)`;

      const pending = await tx.order.count({
        where: {
          customer_id: BigInt(customerId),
          payment_status: 'PENDING',
          expires_at: { gt: new Date() },
        },
      });
      if (pending >= max) {
        const err = new Error(
          `Bạn đang có ${pending} đơn chờ thanh toán. Vui lòng hoàn tất hoặc huỷ bớt trước khi đặt thêm.`
        );
        err.code = 'TOO_MANY_PENDING_ORDERS';
        err.name = 'PricingError';   // để route trả 400 thay vì 500
        throw err;
      }
    }

    const created = await tx.order.create({
      data: {
        id: orderId,
        customer: customerInfo,
        customer_id: customerId ? BigInt(customerId) : null,
        province: customerInfo?.province ?? null,
        total: pricing.total,
        subTotal: pricing.subTotal,
        discount: pricing.discount,
        shippingFee: pricing.shippingFee,
        status: isTransfer ? 'PENDING_PAYMENT' : 'CONFIRMED',
        payment_method: method,
        payment_status: isTransfer ? 'PENDING' : 'UNPAID',
        payment_ref: isTransfer ? generatePaymentRef() : null,
        expires_at: isTransfer ? reservationExpiresAt : null,
        items: {
          create: pricing.lines.map(l => ({
            product_id: l.product_id,
            product_name: l.product_name,
            category_id: l.category_id,
            brand_id: l.brand_id,
            branch_id: l.branch_id,
            variant_id: l.variant_id,
            quantity: l.quantity,
            unit_price: l.unit_price,
            discount: 0,
            net_amount: l.line_total,
          })),
        },
      },
    });

    // Giữ chỗ cho cả COD lẫn chuyển khoản — COD cũng phải chắc có hàng.
    await inventory.reserveStock(
      tx, orderId,
      pricing.lines.map(l => ({
        product_id: l.product_id, variant_id: l.variant_id,
        branch_id: l.branch_id, quantity: l.quantity,
      })),
      reservationExpiresAt
    );

    // COD: không chờ thanh toán nên trừ kho luôn.
    if (!isTransfer) {
      await inventory.commitReservations(tx, orderId);
    }

    // ── Voucher: ghi nhận đã dùng ───────────────────────────────────────
    // Trước đây model Voucher không có cách nào biết mã đã dùng chưa, nên một
    // mã dùng được mãi mãi bởi mọi khách.
    if (pricing.voucher && pricing.voucherDiscount > 0) {
      await tx.voucherUsage.create({
        data: {
          voucher_id: pricing.voucher.id,
          order_id: orderId,
          customer_id: customerId ? BigInt(customerId) : null,
          amount: pricing.voucherDiscount,
          status: isTransfer ? 'HELD' : 'COMMITTED',
        },
      });
      await tx.voucher.update({
        where: { id: pricing.voucher.id },
        data: { used_count: { increment: 1 } },
      });
    }

    // ── Điểm thưởng: mọi thay đổi đi qua sổ cái, không qua localStorage ──
    if (customerId && pricing.pointsUsed > 0) {
      await tx.loyaltyTransaction.create({
        data: {
          customer_id: BigInt(customerId), order_id: orderId,
          points: -pricing.pointsUsed, reason: 'REDEEM_ORDER',
          status: isTransfer ? 'HELD' : 'COMMITTED',
        },
      });
      await tx.b2CCustomer.update({
        where: { id: BigInt(customerId) },
        data: { loyalty_points: { decrement: pricing.pointsUsed } },
      });
    }

    // KHÔNG tích điểm lúc đặt đơn — kể cả COD.
    //
    // Trước đây COD tích ngay, tạo ra lỗ hổng: đặt đơn lớn -> tích điểm ->
    // tiêu sạch điểm vào đơn khác -> huỷ đơn đầu. Thu hồi điểm gặp số dư đã về
    // 0 nên GREATEST(0,...) chặn lại, khách lời đúng số điểm vừa tích, lặp vô
    // hạn. (đã đo: điểm thật 100, tiêu được 235, lời 135.000đ mỗi vòng)
    //
    // Điểm giờ chỉ được tích khi đơn GIAO THÀNH CÔNG — xem
    // orderLifecycle.markDelivered(). Điểm chưa tồn tại thì không tiêu được.

    return created;
  });

  // ── 3. QR động ────────────────────────────────────────────────────────
  // Ngoài transaction: sinh QR là tính toán thuần, không đụng DB, không nên
  // giữ transaction mở lâu hơn cần thiết.
  const qr = isTransfer ? await buildQR(order) : null;

  return {
    order_id: order.id,
    status: order.status,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    payment_ref: order.payment_ref,
    // Đồng hồ hiển thị cho khách ngắn hơn thời gian server thực giữ.
    display_ttl_seconds: isTransfer ? display : null,
    expires_at: order.expires_at,
    pricing: {
      subTotal: pricing.subTotal,
      shippingFee: pricing.shippingFee,
      voucherDiscount: pricing.voucherDiscount,
      pointsUsed: pricing.pointsUsed,
      pointsDiscount: pricing.pointsDiscount,
      discount: pricing.discount,
      total: pricing.total,
      pointsEarned: pricing.pointsEarned,
    },
    qr,
    price_mismatch: diffs.length > 0 ? diffs : undefined,
  };
}

module.exports = { createOrder, buildQR, buildTransferContent, PAYMENT_METHOD };
