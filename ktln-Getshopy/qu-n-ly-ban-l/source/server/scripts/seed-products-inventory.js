/**
 * Seed sản phẩm từ dữ liệu crawl TGDĐ + khởi tạo tồn kho.
 *
 * Thay cho chuỗi 37 script one-off phải chạy tay theo thứ tự không ghi lại ở
 * đâu (Phase 2.0.3 của implement plan). Idempotent: chạy lại nhiều lần không
 * nhân bản dữ liệu.
 *
 *   node scripts/seed-products-inventory.js          # toàn bộ 26.262 sản phẩm
 *   node scripts/seed-products-inventory.js 2000     # giới hạn, để dev cho nhanh
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const LIMIT = parseInt(process.argv[2] || '0', 10) || Infinity;
const BATCH = 1000;
const SRC = path.join(__dirname, 'data', 'tgdd-products.json');

const parseJson = (v, fallback) => {
  if (Array.isArray(v) || (v && typeof v === 'object')) return v;
  try { return JSON.parse(v); } catch { return fallback; }
};

async function main() {
  console.log('Đọc', SRC);
  const all = JSON.parse(fs.readFileSync(SRC, 'utf-8'));
  const rows = all.slice(0, LIMIT === Infinity ? all.length : LIMIT);
  console.log(`  ${rows.length.toLocaleString()} / ${all.length.toLocaleString()} sản phẩm`);

  // Chỉ giữ sản phẩm có category + brand đã tồn tại, tránh gãy khoá ngoại logic
  const cats = new Set((await prisma.category.findMany({ select: { id: true } })).map(c => c.id));
  const brands = new Set((await prisma.brand.findMany({ select: { id: true } })).map(b => b.id));

  const existing = await prisma.product.count();
  if (existing > 0) {
    console.log(`  DB đã có ${existing.toLocaleString()} sản phẩm — xoá để seed lại sạch`);
    await prisma.stockReservation.deleteMany({});
    await prisma.inventory.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.product.deleteMany({});
  }

  let inserted = 0, skipped = 0, id = 1;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const data = [];

    for (const p of chunk) {
      if (!cats.has(p.category_id) || !brands.has(p.brand_id)) { skipped++; continue; }
      data.push({
        id: BigInt(id++),
        name: String(p.name),
        // Tiền là Int đơn vị đồng. Dữ liệu nguồn đã là số nguyên, nhưng vẫn
        // làm tròn phòng bản crawl khác có phần lẻ.
        price: Math.round(Number(p.price)),
        original_price: Math.round(Number(p.original_price ?? p.price)),
        category_id: p.category_id,
        brand_id: p.brand_id,
        stock: Number(p.stock) || 0,
        rating: Number(p.rating) || 5,
        sold: Number(p.sold) || 0,
        image: p.image || null,
        images: parseJson(p.images, []),
        description: p.description || null,
        specs: parseJson(p.specs, {}),
        variants: parseJson(p.variants, []),
        branch_ids: parseJson(p.branch_ids, []),
        is_banner: !!p.is_banner,
        is_deleted: !!p.is_deleted,
      });
    }

    if (data.length > 0) {
      await prisma.product.createMany({ data, skipDuplicates: true });
      inserted += data.length;
    }
    process.stdout.write(`\r  đã ghi ${inserted.toLocaleString()} sản phẩm`);
  }
  console.log();
  if (skipped > 0) console.log(`  bỏ qua ${skipped.toLocaleString()} (category/brand không tồn tại)`);

  // ── Tồn kho ──────────────────────────────────────────────────────────
  // Inventory là nguồn sự thật; Product.stock giữ vai trò cột đọc nhanh để
  // code cũ đọc product.stock không gãy.
  console.log('Khởi tạo tồn kho từ Product.stock...');
  const created = await prisma.$executeRaw`
    INSERT INTO "Inventory" (product_id, variant_id, branch_id, on_hand, reserved, updated_at)
    SELECT id, '', '', GREATEST(0, stock), 0, NOW()
    FROM   "Product"
    WHERE  is_deleted = false
    ON CONFLICT (product_id, variant_id, branch_id) DO NOTHING
  `;
  console.log(`  ${created.toLocaleString()} bản ghi tồn kho`);

  const [{ total, on_hand }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total, COALESCE(SUM(on_hand),0)::int AS on_hand FROM "Inventory"
  `;
  console.log(`\nXong: ${inserted.toLocaleString()} sản phẩm · ${total.toLocaleString()} dòng tồn kho · ${on_hand.toLocaleString()} món trong kho`);
}

main()
  .catch(e => { console.error('\nLỗi:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
