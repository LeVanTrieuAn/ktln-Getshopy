#!/usr/bin/env node
'use strict';
/**
 * append-real-products.js — THÊM các mẫu sản phẩm thật (crawl TGDĐ) vào catalog
 * đang có. KHÔNG xoá, KHÔNG sửa dòng nào có sẵn.
 * ─────────────────────────────────────────────────────────────────
 * data/tgdd-products.json có 26.262 dòng nhưng chỉ 495 mẫu khác nhau (mỗi mẫu
 * nhân bản 50–200 lần, giống hệt tên/giá/hãng). Nạp cả 26k thì trang chủ đầy
 * bản trùng, nên chỉ lấy MỖI TÊN MỘT DÒNG.
 *
 * Khác seed-products-inventory.js (xoá sạch rồi seed lại, chỉ dùng cho DB trống):
 * script này chỉ thêm, mã mới tiếp sau mã lớn nhất hiện có. Chạy lại không nhân
 * bản: tên đã có trong Product thì bỏ qua.
 *
 * THỨ TỰ KHI DỰNG MÁY MỚI: chạy SAU seed-data (bộ 3 triệu đơn). demo_dataset.py
 * chọn sản phẩm từ bảng Product theo mã — có thêm sản phẩm lúc đó thì bộ đơn
 * sinh ra khác bản đã dùng cho báo cáo.
 *
 * sold = 0: Product.sold là số bán THẬT từ đơn đã thanh toán (demo_dataset.py
 * --sold-mode sync); mẫu mới chưa có đơn nào nên không lấy số "đã bán" của TGDĐ.
 *
 *   docker compose exec server node scripts/append-real-products.js [--dry-run]
 */

const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');
const SRC = path.join(__dirname, 'data', 'tgdd-products.json');

const parseJson = (v, fallback) => {
  if (Array.isArray(v) || (v && typeof v === 'object')) return v;
  try { return JSON.parse(v); } catch { return fallback; }
};

async function main() {
  const all = require(SRC);
  const byName = new Map();
  for (const p of all) if (!byName.has(p.name)) byName.set(p.name, p);
  console.log(`${SRC}: ${all.length.toLocaleString('vi-VN')} dòng -> ${byName.size} mẫu khác nhau`);

  const cats = new Set((await prisma.category.findMany({ select: { id: true } })).map((c) => c.id));
  const brands = new Set((await prisma.brand.findMany({ select: { id: true } })).map((b) => b.id));
  const branches = new Set((await prisma.branch.findMany({ select: { id: true } })).map((b) => b.id));

  const names = [...byName.keys()];
  const existing = new Set(
    (await prisma.product.findMany({ where: { name: { in: names } }, select: { name: true } })).map((p) => p.name),
  );

  const rows = [];
  let skipCatBrand = 0;
  for (const p of byName.values()) {
    if (existing.has(p.name)) continue;
    if (!cats.has(p.category_id) || !brands.has(p.brand_id)) { skipCatBrand++; continue; }
    rows.push(p);
  }
  console.log(`  đã có sẵn: ${existing.size} | thiếu danh mục/hãng: ${skipCatBrand} | sẽ thêm: ${rows.length}`);
  if (DRY || rows.length === 0) { if (DRY) console.log('--dry-run: không ghi gì.'); return; }

  const [{ max }] = await prisma.$queryRawUnsafe('SELECT COALESCE(max(id), 0) AS max FROM "Product"');
  const start = BigInt(max) + 1n;
  let id = start;
  const data = rows.map((p) => {
    const b = parseJson(p.branch_ids, []).filter((x) => branches.has(x));
    return {
      id: id++,
      name: String(p.name),
      price: Math.round(Number(p.price)),
      original_price: Math.round(Number(p.original_price ?? p.price)),
      category_id: p.category_id,
      brand_id: p.brand_id,
      stock: Number(p.stock) || 0,
      rating: Number(p.rating) || 5,
      sold: 0,
      image: p.image || null,
      images: parseJson(p.images, p.image ? [p.image] : []),
      description: p.description || null,
      specs: parseJson(p.specs, {}),
      variants: parseJson(p.variants, []),
      branch_ids: b.length ? b : [...branches],
      is_banner: false,
      is_deleted: false,
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.product.createMany({ data });
    // Cùng dạng với ensure-inventory.js: sản phẩm không biến thể -> một dòng kho tổng.
    await tx.$executeRawUnsafe(
      `INSERT INTO "Inventory" (product_id, variant_id, branch_id, on_hand, reserved, updated_at)
       SELECT id, '', '', GREATEST(0, stock), 0, NOW() FROM "Product"
       WHERE id >= $1 AND is_deleted = false
       ON CONFLICT (product_id, variant_id, branch_id) DO NOTHING`, start);
    // Mã ghi tay không đẩy sequence: không chỉnh thì sản phẩm admin tạo sau đó lấy
    // lại mã 600.001... và trùng khoá chính.
    await tx.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"Product"', 'id'), (SELECT max(id) FROM "Product"))`);
  });
  console.log(`Đã thêm ${data.length} sản phẩm, mã ${start} – ${id - 1n}, kèm tồn kho.`);
}

main()
  .catch((e) => { console.error('\nLỗi:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
