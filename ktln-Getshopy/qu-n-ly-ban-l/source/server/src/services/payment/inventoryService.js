/**
 * Giữ chỗ tồn kho.
 *
 * Bug đang sửa (index.js:746-770): code cũ đọc product.stock rồi mới ghi —
 * kiểu check-then-act (TOCTOU). Hai request đồng thời cùng đọc stock = 1, cả
 * hai đều thấy đủ, cả hai đều trừ -> còn 1 món nhưng bán 2 đơn. Math.max(0,...)
 * không cứu được gì, nó chỉ che số âm.
 *
 * Cách sửa: gộp điều kiện vào TRONG câu ghi.
 *
 *   UPDATE "Inventory" SET reserved = reserved + $n
 *   WHERE ... AND on_hand - reserved >= $n
 *
 * An toàn nhờ ba tầng:
 *   1. Không còn khoảng hở — điều kiện được đánh giá bên trong thao tác ghi.
 *   2. Postgres tự lấy row-level lock khi UPDATE chạm một hàng. "Không cần
 *      lock" nghĩa là không cần lock ở TẦNG ỨNG DỤNG (không SELECT FOR UPDATE,
 *      không advisory lock, không Redis lock) — không phải là không có lock.
 *   3. Ở READ COMMITTED, khi giao dịch B bị chặn và A commit xong, Postgres
 *      đọc lại phiên bản mới nhất của hàng và ĐÁNH GIÁ LẠI mệnh đề WHERE trên
 *      đó (EvalPlanQual). Không còn thoả thì B không ghi gì, rowCount = 0.
 *      Nên không cần SERIALIZABLE, không cần retry loop.
 *      https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED
 *
 * Giới hạn: chỉ atomic trong phạm vi MỘT câu lệnh. Đơn nhiều sản phẩm phải bọc
 * transaction, và phải khoá theo thứ tự cố định để tránh deadlock (xem sortLines).
 */

class OutOfStockError extends Error {
  constructor(detail) {
    super(`Không đủ hàng: ${detail}`);
    this.code = 'OUT_OF_STOCK';
    this.name = 'OutOfStockError';
  }
}

// Sentinel thay cho NULL: Postgres coi mỗi NULL là KHÁC nhau trong unique
// index, nên @@unique([product_id, variant_id, branch_id]) với cột NULL sẽ cho
// chèn trùng vô số hàng.
const NO_VARIANT = '';
const NO_BRANCH  = '';

const key = line => ({
  product_id: BigInt(line.product_id),
  variant_id: line.variant_id || NO_VARIANT,
  branch_id:  line.branch_id  || NO_BRANCH,
});

/**
 * Sắp xếp các dòng theo thứ tự cố định trước khi khoá.
 *
 * BẮT BUỘC, không phải tối ưu: nếu transaction A khoá sản phẩm #10 rồi xin #20,
 * trong khi B khoá #20 rồi xin #10, hai bên chờ nhau vĩnh viễn. Postgres phát
 * hiện deadlock và giết một bên — đơn đó fail. Mọi transaction khoá theo cùng
 * một thứ tự thì tình huống này không xảy ra được.
 */
function sortLines(lines) {
  return [...lines].sort((a, b) => {
    const ka = key(a), kb = key(b);
    if (ka.product_id !== kb.product_id) return ka.product_id < kb.product_id ? -1 : 1;
    if (ka.variant_id !== kb.variant_id) return ka.variant_id < kb.variant_id ? -1 : 1;
    return ka.branch_id < kb.branch_id ? -1 : (ka.branch_id > kb.branch_id ? 1 : 0);
  });
}

/**
 * Giữ chỗ cho toàn bộ dòng của một đơn.
 * Phải được gọi BÊN TRONG một prisma.$transaction — hoặc giữ được hết, hoặc
 * không giữ gì. Không thể để đơn giữ được 2/3 món.
 *
 * @param {object} tx        Prisma transaction client
 * @param {string} orderId
 * @param {Array}  lines     [{ product_id, variant_id, branch_id, quantity }]
 * @param {Date}   expiresAt Thời điểm nhả chỗ nếu chưa thanh toán
 */
async function reserveStock(tx, orderId, lines, expiresAt) {
  const reservations = [];

  for (const line of sortLines(lines)) {
    const k = key(line);
    const qty = Number(line.quantity);

    // Một câu UPDATE duy nhất: vừa kiểm tra vừa ghi.
    const affected = await tx.$executeRaw`
      UPDATE "Inventory"
      SET    reserved = reserved + ${qty}, updated_at = NOW()
      WHERE  product_id = ${k.product_id}
        AND  variant_id = ${k.variant_id}
        AND  branch_id  = ${k.branch_id}
        AND  on_hand - reserved >= ${qty}
    `;

    if (affected === 0) {
      // Phân biệt hai nguyên nhân để báo lỗi cho đúng
      const inv = await tx.inventory.findUnique({
        where: {
          product_id_variant_id_branch_id: {
            product_id: k.product_id, variant_id: k.variant_id, branch_id: k.branch_id,
          },
        },
      });
      throw new OutOfStockError(
        inv
          ? `sản phẩm ${k.product_id} còn ${inv.on_hand - inv.reserved}, cần ${qty}`
          : `sản phẩm ${k.product_id} chưa có bản ghi tồn kho`
      );
    }

    const inv = await tx.inventory.findUnique({
      where: {
        product_id_variant_id_branch_id: {
          product_id: k.product_id, variant_id: k.variant_id, branch_id: k.branch_id,
        },
      },
      select: { id: true },
    });

    reservations.push({
      order_id: orderId,
      inventory_id: inv.id,
      quantity: qty,
      status: 'HELD',
      expires_at: expiresAt,
    });
  }

  await tx.stockReservation.createMany({ data: reservations });
  return reservations;
}

/**
 * Đã thanh toán: chuyển giữ chỗ thành trừ thật.
 * on_hand giảm, reserved nhả ra cùng lúc — tồn khả dụng không đổi.
 */
async function commitReservations(tx, orderId) {
  const held = await tx.stockReservation.findMany({
    where: { order_id: orderId, status: 'HELD' },
  });
  if (held.length === 0) return 0;

  for (const r of held) {
    await tx.$executeRaw`
      UPDATE "Inventory"
      SET    on_hand  = on_hand  - ${r.quantity},
             reserved = reserved - ${r.quantity},
             updated_at = NOW()
      WHERE  id = ${r.inventory_id}
    `;
  }

  await tx.stockReservation.updateMany({
    where: { order_id: orderId, status: 'HELD' },
    data: { status: 'COMMITTED' },
  });

  // Product.stock giữ vai trò cột đọc nhanh (denormalized) để 70 chỗ code cũ
  // đọc product.stock không gãy. Đồng bộ lại từ Inventory.
  await syncProductStock(tx, held.map(r => r.inventory_id));
  return held.length;
}

/**
 * Hết hạn hoặc huỷ: nhả chỗ, on_hand không đổi.
 *
 * Nếu hàm này không chạy, reserved chỉ tăng không giảm và tồn khả dụng rò rỉ
 * dần về 0 trong khi on_hand vẫn đầy — failure mode âm thầm, cần có cảnh báo.
 */
async function releaseReservations(tx, orderId) {
  const held = await tx.stockReservation.findMany({
    where: { order_id: orderId, status: 'HELD' },
  });
  if (held.length === 0) return 0;

  for (const r of held) {
    await tx.$executeRaw`
      UPDATE "Inventory"
      SET    reserved = GREATEST(0, reserved - ${r.quantity}), updated_at = NOW()
      WHERE  id = ${r.inventory_id}
    `;
  }

  await tx.stockReservation.updateMany({
    where: { order_id: orderId, status: 'HELD' },
    data: { status: 'RELEASED' },
  });
  return held.length;
}

/** Đồng bộ Product.stock từ tổng on_hand của Inventory. */
async function syncProductStock(tx, inventoryIds) {
  if (!inventoryIds || inventoryIds.length === 0) return;
  await tx.$executeRaw`
    UPDATE "Product" p
    SET    stock = sub.total
    FROM (
      SELECT product_id, SUM(on_hand)::int AS total
      FROM   "Inventory"
      WHERE  id = ANY(${inventoryIds}::bigint[])
      GROUP  BY product_id
    ) sub
    WHERE p.id = sub.product_id
  `;
}

/** Tồn khả dụng của một sản phẩm (tổng mọi biến thể, mọi chi nhánh). */
async function getAvailableStock(prisma, productId) {
  const rows = await prisma.$queryRaw`
    SELECT COALESCE(SUM(on_hand - reserved), 0)::int AS available
    FROM   "Inventory"
    WHERE  product_id = ${BigInt(productId)}
  `;
  return rows[0]?.available ?? 0;
}

module.exports = {
  reserveStock,
  commitReservations,
  releaseReservations,
  getAvailableStock,
  syncProductStock,
  sortLines,
  OutOfStockError,
  NO_VARIANT,
  NO_BRANCH,
};
