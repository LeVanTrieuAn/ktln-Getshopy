/**
 * fix_categories.js
 * Tự động reassign category cho sản phẩm seed bị gán sai,
 * dựa trên từ khóa trong tên sản phẩm.
 *
 * Chạy: node fix_categories.js
 */

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Map: keyword trong tên sản phẩm → category_id đúng
const NAME_TO_CAT = [
  // Laptop / MacBook
  { patterns: ['laptop', 'macbook', 'notebook'], catId: 'c2' },
  // Tablet / iPad
  { patterns: ['tablet', 'ipad', 'may tinh bang'], catId: 'c3' },
  // TV / Tivi / Màn hình
  { patterns: ['smart tv', 'tivi', ' tv ', 'television', 'màn hình', 'monitor', 'màn hình gaming', 'man hinh'], catId: 'c5' },
  // Tai nghe / Loa / Âm thanh
  { patterns: ['airpod', 'headphone', 'earphone', 'tai nghe', 'earbud', 'loa ', 'loa bluetooth', 'loa gaming', 'speaker', 'soundbar'], catId: 'c8' },
  // Đồng hồ thông minh
  { patterns: ['đồng hồ', 'dong ho', 'watch', 'smartwatch'], catId: 'c7' },
  // Camera
  { patterns: ['camera', 'máy ảnh', 'may anh', 'mirrorless', 'dslr'], catId: 'c6' },
  // Gaming console
  { patterns: ['gaming console', 'playstation', 'xbox', 'nintendo', 'game console'], catId: 'c9' },
  // Phụ kiện
  { patterns: ['chuột', 'bàn phím', 'keyboard', 'mouse', 'sạc', 'charger', 'cáp', 'cable', 'hub'], catId: 'c4' },
  // Nhà thông minh
  { patterns: ['smart home', 'robot hút', 'loa thông minh', 'bóng đèn thông minh'], catId: 'c10' },
];


function detectCategory(name) {
  const lower = name.toLowerCase();
  for (const rule of NAME_TO_CAT) {
    for (const pat of rule.patterns) {
      if (lower.includes(pat)) return rule.catId;
    }
  }
  return null;
}

async function main() {
  console.log('🔍 Fetching all products...');
  // Chỉ lấy sản phẩm fake (không phải real sản phẩm có ảnh)
  // Xử lý theo batch để tránh timeout
  let skip = 0;
  const batchSize = 500;
  let totalFixed = 0;
  let totalChecked = 0;

  while (true) {
    const batch = await p.product.findMany({
      skip,
      take: batchSize,
      select: { id: true, name: true, category_id: true },
      orderBy: { id: 'asc' }
    });

    if (batch.length === 0) break;
    totalChecked += batch.length;

    const updates = [];
    for (const prod of batch) {
      const correctCat = detectCategory(prod.name);
      if (correctCat && correctCat !== prod.category_id) {
        updates.push({ id: prod.id, newCat: correctCat, name: prod.name, oldCat: prod.category_id });
      }
    }

    if (updates.length > 0) {
      // Group by newCat → dùng updateMany với IN clause (1 query mỗi category thay vì N queries)
      const byCat = {};
      for (const u of updates) {
        if (!byCat[u.newCat]) byCat[u.newCat] = [];
        byCat[u.newCat].push(u.id);
      }
      for (const [catId, ids] of Object.entries(byCat)) {
        await p.product.updateMany({ where: { id: { in: ids } }, data: { category_id: catId } });
      }
      totalFixed += updates.length;
      console.log(`  Batch skip=${skip}: fixed ${updates.length} products`);
      updates.slice(0, 3).forEach(u =>
        console.log(`    "${u.name}" : ${u.oldCat} → ${u.newCat}`)
      );
    }

    skip += batchSize;
    if (batch.length < batchSize) break;
  }

  console.log(`\n✅ Done! Checked ${totalChecked} products, fixed ${totalFixed} wrong categories.`);
  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); process.exit(1); });
