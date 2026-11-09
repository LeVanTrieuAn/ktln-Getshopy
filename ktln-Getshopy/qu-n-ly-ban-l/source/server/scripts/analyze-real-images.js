/**
 * analyze-real-images.js
 * Phân tích ảnh từ sản phẩm thật (non-picsum) theo category
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient({ log: [] });

async function main() {
  console.log('\n📊 PHÂN TÍCH ẢNH TỪ SẢN PHẨM THẬT');
  console.log('═'.repeat(60));

  // 1. Đếm sản phẩm có ảnh thật (không phải picsum)
  const realProducts = await prisma.product.findMany({
    where: {
      is_deleted: false,
      image: { not: { contains: 'picsum' } },
    },
    select: { id: true, category_id: true, brand_id: true, image: true, images: true, name: true },
    orderBy: { id: 'asc' },
  });
  console.log(`  Tổng SP có ảnh thật (non-picsum): ${realProducts.length}`);

  // 2. Group images by category
  const catImages = {};
  const catBrandImages = {};
  
  for (const p of realProducts) {
    const cat = p.category_id;
    const brand = p.brand_id;
    const key = `${cat}|${brand}`;
    
    if (!catImages[cat]) catImages[cat] = new Set();
    if (!catBrandImages[key]) catBrandImages[key] = new Set();

    // Collect image URLs
    if (p.image && !p.image.includes('picsum')) {
      catImages[cat].add(p.image);
      catBrandImages[key].add(p.image);
    }
    
    try {
      const imgs = JSON.parse(p.images || '[]');
      for (const img of imgs) {
        if (img && !img.includes('picsum')) {
          catImages[cat].add(img);
          catBrandImages[key].add(img);
        }
      }
    } catch(e) {}
  }

  // 3. Print summary
  console.log('\n  📋 Ảnh thật theo Category:');
  const sortedCats = Object.entries(catImages)
    .map(([cat, set]) => ({ cat, count: set.size }))
    .sort((a,b) => b.count - a.count);
  
  for (const { cat, count } of sortedCats) {
    console.log(`    ${cat.padEnd(35)} : ${count} ảnh unique`);
  }

  // 4. Print brand×cat summary (top 30)
  console.log('\n  📋 Top 30 cặp (Category, Brand) có ảnh thật:');
  const sortedPairs = Object.entries(catBrandImages)
    .map(([key, set]) => ({ key, count: set.size }))
    .sort((a,b) => b.count - a.count);
  
  for (const { key, count } of sortedPairs.slice(0, 30)) {
    console.log(`    ${key.padEnd(50)} : ${count} ảnh`);
  }

  // 5. Export image pools to JSON file
  const output = {};
  for (const [cat, set] of Object.entries(catImages)) {
    output[cat] = [...set];
  }
  
  const outputPath = path.join(__dirname, 'data', 'real-image-pools.json');
  if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n  💾 Exported to: ${outputPath}`);
  console.log(`  Tổng categories: ${Object.keys(output).length}`);
  console.log(`  Tổng ảnh unique: ${Object.values(output).reduce((s, arr) => s + arr.length, 0)}`);

  // 6. Also export brand×cat pools
  const brandCatOutput = {};
  for (const [key, set] of Object.entries(catBrandImages)) {
    if (set.size > 0) brandCatOutput[key] = [...set];
  }
  const brandCatPath = path.join(__dirname, 'data', 'real-image-pools-brand-cat.json');
  fs.writeFileSync(brandCatPath, JSON.stringify(brandCatOutput, null, 2));
  console.log(`  💾 Brand×Cat pools: ${brandCatPath} (${Object.keys(brandCatOutput).length} pairs)`);

  // 7. Count products with picsum (mock)
  const mockCount = await prisma.product.count({
    where: { is_deleted: false, image: { contains: 'picsum' } },
  });
  console.log(`\n  📊 SP cần update ảnh (picsum): ${mockCount.toLocaleString()}`);

  // 8. Check "Khác" brand products
  const khacCount = await prisma.product.count({
    where: { brand_id: 'br-khac', is_deleted: false },
  });
  const khacSample = await prisma.product.findMany({
    where: { brand_id: 'br-khac', is_deleted: false },
    select: { name: true, category_id: true },
    take: 10,
  });
  console.log(`\n  📊 SP brand "Khác": ${khacCount.toLocaleString()}`);
  console.log('  Mẫu tên:');
  for (const s of khacSample) {
    console.log(`    [${s.category_id}] ${s.name}`);
  }
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
