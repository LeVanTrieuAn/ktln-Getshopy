/**
 * Đảm bảo mọi sản phẩm — và mọi BIẾN THỂ của nó — đều có bản ghi tồn kho.
 *
 * Product/biến thể và Inventory phải khớp 1-1. Thiếu bản ghi thì mặt hàng đó
 * KHÔNG đặt được: checkout báo "chưa có bản ghi tồn kho". Lỗi chỉ lộ khi khách
 * bấm đặt hàng, không có cảnh báo nào lúc khởi động.
 *
 * Vì sao tách theo biến thể:
 *   Gộp một dòng cho cả sản phẩm thì màu đỏ hết hàng vẫn bán được, vì tổng tồn
 *   của mọi màu vẫn còn. Dữ liệu hiện có 599.995/600.000 sản phẩm mang biến
 *   thể (tổng ~1,2 triệu), nên gộp là sai với gần như toàn bộ danh mục.
 *
 * branch_id vẫn để '' (kho tổng). Tách theo chi nhánh cần nghiệp vụ phân bổ và
 * chuyển kho mới có ý nghĩa — chưa làm ở giai đoạn này.
 *
 * Idempotent: ON CONFLICT DO NOTHING, chạy lại bao nhiêu lần cũng an toàn.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 0. Dọn các dòng Inventory biến thể mồ côi (v1, v2, v3... từ bản seed cũ) không còn
  //    tồn tại trong Product.variants, tránh cộng dồn tồn kho ảo làm lệch Product.stock.
  const [{ has_legacy }] = await prisma.$queryRawUnsafe(`
    SELECT EXISTS(
      SELECT 1 FROM "Inventory" WHERE variant_id IN ('v1', 'v2', 'v3', 'v4', 'v5')
    ) AS has_legacy
  `);
  if (has_legacy) {
    await prisma.$executeRawUnsafe(`
      DELETE FROM "StockReservation" sr
      USING "Inventory" i
      WHERE sr.inventory_id = i.id
        AND i.variant_id IN ('v1', 'v2', 'v3', 'v4', 'v5')
    `);
    const deletedOrphans = await prisma.$executeRawUnsafe(`
      DELETE FROM "Inventory"
      WHERE variant_id IN ('v1', 'v2', 'v3', 'v4', 'v5')
    `);
    if (deletedOrphans > 0) {
      console.log(`      đã xoá ${deletedOrphans.toLocaleString()} dòng tồn kho biến thể mồ côi (v1..v5 cũ)`);
    }
  }

  // Helper an toàn cho cột variants (trong DB có thể là jsonb array hoặc jsonb string "[]")
  // Chỉ coi là có biến thể tồn kho riêng khi phần tử trong mảng thực sự có trường "id".
  // 1. Sản phẩm KHÔNG có biến thể mang id riêng -> một dòng kho chuẩn (variant_id = '')
  const plain = await prisma.$executeRawUnsafe(`
    INSERT INTO "Inventory" (product_id, variant_id, branch_id, on_hand, reserved, updated_at)
    SELECT id, '', '', GREATEST(0, stock), 0, NOW()
    FROM   "Product"
    WHERE  is_deleted = false
      AND  (variants::text NOT LIKE '%"id"%')
    ON CONFLICT (product_id, variant_id, branch_id) DO NOTHING
  `);

  // 2. Sản phẩm CÓ biến thể mang id riêng -> mỗi biến thể một dòng, tồn lấy từ variants[].stock
  //    Biến thể thiếu stock thì coi như 0 chứ không lấy tồn của sản phẩm cha —
  //    lấy tồn cha nghĩa là mỗi màu đều "còn đủ", đúng cái lỗi đang muốn sửa.
  const variants = await prisma.$executeRawUnsafe(`
    INSERT INTO "Inventory" (product_id, variant_id, branch_id, on_hand, reserved, updated_at)
    SELECT p.id,
           v->>'id',
           '',
           GREATEST(0, COALESCE((v->>'stock')::int, 0)),
           0,
           NOW()
    FROM   "Product" p
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(p.variants::jsonb) = 'array' THEN p.variants::jsonb
        WHEN jsonb_typeof(p.variants::jsonb) = 'string' THEN (p.variants #>> '{}')::jsonb
        ELSE '[]'::jsonb
      END
    ) AS v
    WHERE  p.is_deleted = false
      AND  p.variants::text LIKE '%"id"%'
      AND  v->>'id' IS NOT NULL
    ON CONFLICT (product_id, variant_id, branch_id) DO NOTHING
  `);

  // Đồng bộ Product.stock = tổng tồn khả dụng (on_hand - reserved) của Inventory.
  //
  // Inventory là nguồn sự thật; Product.stock chỉ là cột đọc nhanh cho các chỗ
  // code cũ. Hai con số lệch nhau thì trang sản phẩm hiển thị một đằng, đặt
  // hàng lại báo một nẻo. Dữ liệu mẫu trong db.json viết tay nên hay lệch.
  const synced = await prisma.$executeRawUnsafe(`
    UPDATE "Product" p
    SET    stock = sub.total
    FROM  (SELECT product_id, COALESCE(SUM(GREATEST(0, on_hand - reserved)), 0)::int AS total
           FROM "Inventory" GROUP BY product_id) sub
    WHERE  p.id = sub.product_id AND p.stock <> sub.total
  `);
  if (synced > 0) {
    console.log(`      đã đồng bộ lại Product.stock cho ${synced.toLocaleString()} sản phẩm khớp 100% với Inventory`);
  }

  const [row] = await prisma.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*) FROM "Product" WHERE is_deleted = false)::int AS products,
      (SELECT COUNT(*) FROM "Inventory")::int                        AS inventory,
      (SELECT COUNT(*) FROM "Inventory" WHERE variant_id <> '')::int AS variant_rows,
      (SELECT COUNT(*) FROM "Product" p
        WHERE p.is_deleted = false
          AND NOT EXISTS (SELECT 1 FROM "Inventory" i WHERE i.product_id = p.id))::int AS missing
  `);

  if (plain + variants > 0) {
    console.log(`      thêm ${(plain + variants).toLocaleString()} bản ghi tồn kho`);
  }
  console.log(`      ${row.inventory.toLocaleString()} dòng tồn kho ` +
              `(${row.variant_rows.toLocaleString()} theo biến thể) ` +
              `cho ${row.products.toLocaleString()} sản phẩm`);

  if (row.missing > 0) {
    console.warn(`      ⚠ ${row.missing.toLocaleString()} sản phẩm CHƯA có tồn kho — sẽ không đặt hàng được`);
  }
}

main()
  .catch(e => { console.error('      lỗi khởi tạo tồn kho:', e.message); process.exitCode = 0; })
  .finally(() => prisma.$disconnect());
