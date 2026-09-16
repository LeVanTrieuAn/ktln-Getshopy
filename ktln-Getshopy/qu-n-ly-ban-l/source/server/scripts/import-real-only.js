/**
 * import-real-only.js
 * ─────────────────────────────────────────────────────────────────
 * Xóa toàn bộ sản phẩm hiện tại và CHỈ import đúng 26,130 sản phẩm 
 * thực tế đã crawl từ Thế Giới Di Động (không sinh thêm biến thể).
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const fs   = require('fs');
const path = require('path');

const prisma = new PrismaClient({ log: [] });
const DATA_FILE = path.join(__dirname, 'data', 'tgdd-products.json');
const BRANCHES  = ['HCM001', 'HCM002', 'HN001'];
const BATCH_SIZE = 2000;

// ── Helpers ──────────────────────────────────────────────────────
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1) + a);

function printBar(done, total, label) {
  const pct    = Math.min(done / total, 1);
  const filled = Math.round(pct * 40);
  const bar    = '█'.repeat(filled) + '░'.repeat(40 - filled);
  process.stdout.write(`\r  [${bar}] ${(pct * 100).toFixed(1)}%  ${done.toLocaleString()}/${total.toLocaleString()}  ${label}    `);
}

async function main() {
  console.log('\n🔄 Đang khôi phục CHỈ SẢN PHẨM THỰC (Không Augment)');
  
  if (!fs.existsSync(DATA_FILE)) {
    console.error('❌ Không tìm thấy tgdd-products.json');
    return;
  }

  const crawledProducts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const validProducts = crawledProducts.filter(p => p.name && p.name.length >= 3 && p.price > 0);
  console.log(`  📦 Tổng sản phẩm thực từ TGDD: ${validProducts.length.toLocaleString()}`);

  // 1. Xóa toàn bộ dữ liệu hiện tại
  const currentCount = await prisma.product.count();
  console.log(`\n  🗑️  Đang xóa ${currentCount.toLocaleString()} sản phẩm hiện tại (bao gồm cả hàng augment)...`);
  let deleted = 0;
  while (true) {
    const ids = await prisma.product.findMany({ select: { id: true }, take: 5000 });
    if (ids.length === 0) break;
    const result = await prisma.product.deleteMany({ where: { id: { in: ids.map(r => r.id) } } });
    deleted += result.count;
    printBar(deleted, currentCount, 'Xóa');
  }
  console.log(`\n  ✅ Đã xóa sạch DB.`);

  // 2. Import lại bản gốc
  console.log('\n  📥 Bắt đầu import sản phẩm thực...');
  let totalInserted = 0;
  let batch = [];

  for (const raw of validProducts) {
    const numBranches = randInt(1, BRANCHES.length);
    const branchIds = [...BRANCHES].sort(() => Math.random() - 0.5).slice(0, numBranches);

    batch.push({
      name:           raw.name,
      price:          raw.price,
      original_price: raw.original_price || raw.price,
      category_id:    raw.category_id,
      brand_id:       raw.brand_id,
      image:          raw.image || null,
      images:         raw.images || JSON.stringify([]),
      description:    raw.description || `${raw.name} — Chính hãng tại Thế Giới Di Động.`,
      variants:       JSON.stringify([]), // Bỏ qua variants phức tạp
      stock:          randInt(10, 500),
      rating:         raw.rating || 4.8,
      sold:           raw.sold || randInt(0, 500),
      branch_ids:     branchIds,
      is_banner:      false,
      is_deleted:     false,
    });

    if (batch.length >= BATCH_SIZE) {
      await prisma.product.createMany({ data: batch });
      totalInserted += batch.length;
      batch = [];
      printBar(totalInserted, validProducts.length, 'Import');
    }
  }

  if (batch.length > 0) {
    await prisma.product.createMany({ data: batch });
    totalInserted += batch.length;
    printBar(totalInserted, validProducts.length, 'Import');
  }

  console.log(`\n\n  ✅ HOÀN TẤT! DB hiện tại chỉ chứa ĐÚNG ${totalInserted.toLocaleString()} sản phẩm thật từ TGDD.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
