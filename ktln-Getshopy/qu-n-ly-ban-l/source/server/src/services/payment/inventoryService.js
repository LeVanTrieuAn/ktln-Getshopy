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
  // Đồng bộ ngay Product.stock và Product.variants[].stock theo tồn khả dụng
  // (on_hand - reserved) để khi khách nhấn Đặt hàng (cả COD lẫn QR), tồn kho
  // hiển thị trên giao diện giảm ngay (VD: 601 -> 600).
  await syncProductStock(tx, reservations.map(r => r.inventory_id));
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
  await syncProductStock(tx, held.map(r => r.inventory_id));
  return held.length;
}

/**
 * Đồng bộ Product.stock và từng biến thể trong Product.variants (JSONB) từ
 * tồn khả dụng (on_hand - reserved) của toàn bộ các dòng Inventory thuộc sản phẩm đó.
 */
async function syncProductStock(tx, inventoryIds) {
  if (!inventoryIds || inventoryIds.length === 0) return;

  const ids = [...new Set(inventoryIds.map(id => BigInt(id)))];
  const touched = await tx.inventory.findMany({
    where: { id: { in: ids } },
    select: { product_id: true },
    distinct: ['product_id'],
  });
  const productIds = touched.map(r => r.product_id);
  if (productIds.length === 0) return;

  // Phải lấy TOÀN BỘ dòng Inventory của product_id (mọi biến thể, mọi chi nhánh)
  // thay vì chỉ lọc WHERE id = ANY(inventoryIds), nếu không sản phẩm có nhiều
  // biến thể sẽ bị ghi đè Product.stock bằng tồn của riêng 1 biến thể vừa mua.
  const allInv = await tx.inventory.findMany({
    where: { product_id: { in: productIds } },
    select: { product_id: true, variant_id: true, on_hand: true, reserved: true },
  });

  for (const productId of productIds) {
    const rows = allInv.filter(r => r.product_id === productId);
    const byVariant = new Map();
    let totalAvailable = 0;

    for (const r of rows) {
      const avail = Math.max(0, Number(r.on_hand || 0) - Number(r.reserved || 0));
      totalAvailable += avail;
      const vid = r.variant_id || '';
      byVariant.set(vid, (byVariant.get(vid) || 0) + avail);
    }

    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { variants: true },
    });

    let rawVariants = product?.variants;
    const wasString = typeof rawVariants === 'string';
    if (wasString) {
      try { rawVariants = JSON.parse(rawVariants); } catch { rawVariants = null; }
    }

    let updatedVariants = undefined;
    if (Array.isArray(rawVariants) && rawVariants.length > 0) {
      const nextArr = rawVariants.map((v, idx) => {
        if (!v || typeof v !== 'object') return v;
        const vid = String(v.id || `var-${idx}`);
        if (byVariant.has(vid)) {
          return { ...v, stock: byVariant.get(vid) };
        }
        return v;
      });
      updatedVariants = wasString ? JSON.stringify(nextArr) : nextArr;
    }

    await tx.product.update({
      where: { id: productId },
      data: {
        stock: totalAvailable,
        ...(updatedVariants !== undefined ? { variants: updatedVariants } : {}),
      },
    });
  }
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
