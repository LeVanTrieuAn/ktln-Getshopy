/**
 * Tính lại toàn bộ số tiền của một đơn hàng TỪ DATABASE.
 *
 * Lý do tồn tại: /api/b2c/checkout trước đây nhận total, subTotal, discount,
 * shippingFee thẳng từ req.body và ghi vào DB. Fallback items.reduce() cũng
 * dùng item.price DO CLIENT GỬI LÊN.
 *
 * Khi gắn thanh toán, lỗ hổng đó trở thành: QR sinh theo số tiền client tự khai.
 * Sửa total = 1000 trong DevTools -> QR 1.000đ cho iPhone -> chuyển khoản ->
 * webhook thấy khớp -> PAID.
 *
 * Nguyên tắc ở đây: mọi con số đều lấy từ DB. Số client gửi lên CHỈ dùng để
 * đối chiếu và cảnh báo, không bao giờ để ghi.
 *
 * Đơn vị tiền: ĐỒNG, số nguyên (xem §A.1 implement plan).
 */

// ── Quy tắc nghiệp vụ (giữ nguyên hành vi đang có ở Checkout.jsx) ──────
const SHIPPING_FEE = {
  HCM: 20000,
  HN: 20000,
  DEFAULT: 40000,
};
const POINT_VALUE_VND   = 1000;    // 1 điểm = 1.000đ khi tiêu
const POINT_EARN_PER_VND = 100000; // tích 1 điểm mỗi 100.000đ đã trả

class PricingError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = 'PricingError';
  }
}

/** Phí vận chuyển — tính ở server, không nhận từ client. */
function calcShippingFee(province) {
  if (!province) throw new PricingError('Chưa chọn Tỉnh/Thành phố giao hàng', 'NO_PROVINCE');
  return SHIPPING_FEE[province] ?? SHIPPING_FEE.DEFAULT;
}

/**
 * Tìm một biến thể trong Product.variants theo id.
 * variants là Json: [{ id, color, storage, price, stock }]
 */
function findVariant(product, variantId) {
  if (!variantId) return null;
  const list = Array.isArray(product.variants) ? product.variants : [];
  return list.find(v => String(v?.id) === String(variantId)) || null;
}

/**
 * Giá hiệu lực của một sản phẩm tại thời điểm này.
 *
 * Thứ tự ưu tiên: flash sale > giá biến thể > giá sản phẩm.
 *
 * GIÁ BIẾN THỂ BẮT BUỘC PHẢI TÍNH. Trước đây hàm này chỉ trả product.price,
 * nên khách chọn biến thể đắt hơn vẫn trả giá gốc — ví dụ sản phẩm #4 có biến
 * thể 32.990.000 trong khi Product.price là 27.990.000, chênh 5 triệu mỗi đơn.
 * Lỗi nằm ở SERVER nên mọi lớp chống gian lận phía client đều vô dụng: QR sinh
 * đúng số tiền sai đó, webhook khớp, đơn thành PAID.
 *
 * Flash sale vẫn thắng vì đó là giá khuyến mãi có chủ đích, và chỉ áp dụng khi
 * ĐANG trong khoảng thời gian chạy.
 */
function resolveUnitPrice(product, flashSaleItem, variantId) {
  if (flashSaleItem && Number.isInteger(flashSaleItem.discount_price)) {
    return flashSaleItem.discount_price;
  }
  const variant = findVariant(product, variantId);
  if (variant && Number.isFinite(Number(variant.price))) {
    return Math.round(Number(variant.price));
  }
  return product.price;
}

/**
 * Tính lại giá trị đơn hàng.
 *
 * @param {object} prisma            Prisma client (hoặc transaction client)
 * @param {object} input
 * @param {Array}  input.items       [{ id, quantity, variant_id?, branch_id? }] — giá bị BỎ QUA nếu client có gửi
 * @param {string} input.province    HCM | HN | DN | OTHER
 * @param {string} [input.voucherCode]
 * @param {number} [input.pointsToUse]
 * @param {number} [input.customerId]
 * @returns {Promise<object>} breakdown đầy đủ, mọi giá trị là Int đồng
 */
async function priceOrder(prisma, { items, province, voucherCode, pointsToUse = 0, customerId }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new PricingError('Đơn hàng không có sản phẩm nào', 'EMPTY_CART');
  }

  // ── 1. Nạp sản phẩm từ DB ────────────────────────────────────────────
  const productIds = [...new Set(items.map(i => BigInt(i.id)))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, is_deleted: false },
  });
  const byId = new Map(products.map(p => [p.id.toString(), p]));

  const missing = items.filter(i => !byId.has(String(i.id)));
  if (missing.length > 0) {
    throw new PricingError(
      `Sản phẩm không còn tồn tại: ${missing.map(m => m.id).join(', ')}`,
      'PRODUCT_NOT_FOUND'
    );
  }

  // ── 2. Flash sale đang chạy ──────────────────────────────────────────
  const now = new Date();
  const activeSales = await prisma.flashSale.findMany({
    where: { is_deleted: false, start_time: { lte: now }, end_time: { gte: now } },
  });
  const saleItems = activeSales.length > 0
    ? await prisma.flashSaleItem.findMany({
        where: {
          flash_sale_id: { in: activeSales.map(s => s.id) },
          product_id: { in: productIds },
        },
      })
    : [];
  const saleByProduct = new Map(saleItems.map(si => [si.product_id.toString(), si]));

  // ── 3. Dòng đơn hàng ─────────────────────────────────────────────────
  const lines = [];
  let subTotal = 0;

  for (const item of items) {
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new PricingError(`Số lượng không hợp lệ cho sản phẩm ${item.id}`, 'BAD_QUANTITY');
    }

    const product = byId.get(String(item.id));

    // Client có thể gửi variant_id hoặc cả object selectedVariant — chấp nhận
    // cả hai để không phải sửa đồng loạt mọi nơi gọi, nhưng chỉ tin cái ID.
    const variantId = item.variant_id ?? item.selectedVariant?.id ?? null;

    // Biến thể không tồn tại thì từ chối, KHÔNG lặng lẽ rơi về giá sản phẩm:
    // im lặng bỏ qua nghĩa là client gửi variant_id bịa cũng mua được giá gốc.
    if (variantId && !findVariant(product, variantId)) {
      throw new PricingError(
        `Phiên bản "${variantId}" của sản phẩm ${item.id} không còn tồn tại`,
        'VARIANT_NOT_FOUND'
      );
    }

    const unitPrice = resolveUnitPrice(product, saleByProduct.get(String(item.id)), variantId);
    const lineTotal = unitPrice * qty;
    subTotal += lineTotal;

    lines.push({
      product_id: product.id,
      product_name: product.name,          // snapshot
      category_id: product.category_id,
      brand_id: product.brand_id,
      branch_id: item.branch_id || null,
      variant_id: variantId,
      quantity: qty,
      unit_price: unitPrice,               // snapshot
      line_total: lineTotal,
    });
  }

  // ── 4. Phí vận chuyển ────────────────────────────────────────────────
  const shippingFee = calcShippingFee(province);

  // ── 5. Voucher — tính lại, không tin cart_total của client ───────────
  let voucherDiscount = 0;
  let voucher = null;

  if (voucherCode) {
    voucher = await prisma.voucher.findUnique({
      where: { code: String(voucherCode).toUpperCase() },
    });

    if (!voucher || voucher.is_deleted) {
      throw new PricingError('Mã giảm giá không hợp lệ', 'VOUCHER_INVALID');
    }
    if (voucher.valid_from && now < voucher.valid_from) {
      throw new PricingError('Mã giảm giá chưa đến thời gian sử dụng', 'VOUCHER_NOT_YET');
    }
    if (voucher.valid_until && now > voucher.valid_until) {
      throw new PricingError('Mã giảm giá đã hết hạn', 'VOUCHER_EXPIRED');
    }
    // subTotal tính từ DB, không phải cart_total client gửi
    if (subTotal < voucher.min_order_value) {
      throw new PricingError(
        `Đơn hàng tối thiểu ${voucher.min_order_value.toLocaleString('vi-VN')}đ để dùng mã này`,
        'VOUCHER_MIN_ORDER'
      );
    }
    if (voucher.max_uses !== null && voucher.used_count >= voucher.max_uses) {
      throw new PricingError('Mã giảm giá đã hết lượt sử dụng', 'VOUCHER_EXHAUSTED');
    }
    if (customerId && voucher.max_uses_per_customer !== null) {
      const usedByCustomer = await prisma.voucherUsage.count({
        where: {
          voucher_id: voucher.id,
          customer_id: BigInt(customerId),
          status: { in: ['HELD', 'COMMITTED'] },
        },
      });
      if (usedByCustomer >= voucher.max_uses_per_customer) {
        throw new PricingError('Bạn đã sử dụng mã này rồi', 'VOUCHER_USED_BY_CUSTOMER');
      }
    }

    voucherDiscount = voucher.type === 'percent'
      ? Math.min(Math.floor((subTotal * voucher.value) / 100), voucher.max_discount)
      : voucher.value;
    voucherDiscount = Math.min(voucherDiscount, subTotal);  // không giảm quá giá trị hàng
  }

  // ── 6. Điểm thưởng — đọc từ DB, KHÔNG từ localStorage của client ─────
  let pointsUsed = 0;
  let pointsDiscount = 0;
  let availablePoints = 0;

  if (customerId && pointsToUse > 0) {
    const customer = await prisma.b2CCustomer.findUnique({
      where: { id: BigInt(customerId) },
      select: { loyalty_points: true },
    });
    if (!customer) throw new PricingError('Không tìm thấy tài khoản khách hàng', 'CUSTOMER_NOT_FOUND');

    availablePoints = customer.loyalty_points;
    const maxByCart = Math.floor(subTotal / POINT_VALUE_VND);
    pointsUsed = Math.min(Number(pointsToUse), availablePoints, maxByCart);
    if (pointsUsed < 0) pointsUsed = 0;
    pointsDiscount = pointsUsed * POINT_VALUE_VND;
  }

  // ── 7. Tổng ──────────────────────────────────────────────────────────
  const discount = voucherDiscount + pointsDiscount;
  // Không để tổng âm dù giảm giá vượt giá trị hàng
  const total = Math.max(0, subTotal + shippingFee - discount);
  const pointsEarned = Math.floor(total / POINT_EARN_PER_VND);

  return {
    lines,
    subTotal,
    shippingFee,
    voucherDiscount,
    pointsUsed,
    pointsDiscount,
    discount,
    total,
    pointsEarned,
    availablePoints,
    voucher,
  };
}

/**
 * Đối chiếu số client gửi lên với số server tính ra.
 * KHÔNG ném lỗi — chỉ trả về danh sách lệch để ghi log. Client cũ hoặc tỉ giá
 * hiển thị chậm một nhịp là chuyện bình thường; điều quan trọng là số ghi vào
 * DB luôn là số của server.
 */
function diffClientClaim(serverPricing, claimed = {}) {
  const fields = ['subTotal', 'shippingFee', 'discount', 'total'];
  const diffs = [];
  for (const f of fields) {
    if (claimed[f] === undefined || claimed[f] === null) continue;
    const claimedInt = Math.round(Number(claimed[f]));
    if (claimedInt !== serverPricing[f]) {
      diffs.push({ field: f, client: claimedInt, server: serverPricing[f] });
    }
  }
  return diffs;
}

module.exports = {
  priceOrder,
  findVariant,
  diffClientClaim,
  calcShippingFee,
  PricingError,
  SHIPPING_FEE,
  POINT_VALUE_VND,
  POINT_EARN_PER_VND,
};
