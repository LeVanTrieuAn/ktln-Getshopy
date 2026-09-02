/**
 * fix-images-and-names.js
 * ─────────────────────────────────────────────────────────────────
 * 1. Update ảnh cho 573K+ SP mock (picsum) → ảnh THẬT từ category
 *    phù hợp, lấy từ pool ảnh 18K SP gốc.
 * 2. Fix tên sản phẩm brand "Khác": đảm bảo không có chữ "Khác".
 *
 * Cách dùng:
 *   node scripts/fix-images-and-names.js
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const fs   = require('fs');
const path = require('path');
const prisma = new PrismaClient({ log: [] });

const BATCH_SIZE = 5000;

// ── Load real image pools ─────────────────────────────────────────
const poolPath    = path.join(__dirname, 'data', 'real-image-pools.json');
const IMAGE_POOLS = JSON.parse(fs.readFileSync(poolPath, 'utf-8'));

// ── Fallback: nếu category không có ảnh, dùng ảnh từ category tương tự
const FALLBACK_MAP = {
  // Mobile accessories — dùng ảnh từ category tương tự
  'cat-mobile-acc-powerbank':     'cat-mobile-acc-charger',
  'cat-mobile-acc-case-phone':    'cat-mobile-acc-case-tablet',
  'cat-mobile-acc-pen':           'cat-mobile-acc-stand',
  'cat-mobile-acc-strap':         'cat-mobile-acc-stand',
  'cat-mobile-acc-lens':          'cat-mobile-acc-stand',
  // Laptop accessories
  'cat-laptop-acc-hub':           'cat-mobile-acc-charger',
  'cat-laptop-acc-router':        'cat-cam-indoor',
  'cat-laptop-acc-keyboard-cover':'cat-mobile-acc-screen',
  'cat-laptop-acc-software':      'cat-laptop',
  'cat-laptop-acc-monitor-stand': 'cat-mobile-acc-stand',
  // AV
  'cat-av-smartglass':            'cat-watch',
  // Camera
  'cat-cam-outdoor':              'cat-cam-security',
  'cat-cam-solar':                'cat-cam-security',
  'cat-cam-4g':                   'cat-cam-security',
  'cat-cam-webcam':               'cat-cam-indoor',
};

function getImagePool(catId) {
  if (IMAGE_POOLS[catId] && IMAGE_POOLS[catId].length > 0) return IMAGE_POOLS[catId];
  const fallback = FALLBACK_MAP[catId];
  if (fallback && IMAGE_POOLS[fallback] && IMAGE_POOLS[fallback].length > 0) return IMAGE_POOLS[fallback];
  // Ultimate fallback: merge all pools
  const all = Object.values(IMAGE_POOLS).flat();
  return all;
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function pickImages(pool) {
  // Pick 3 unique images from pool
  if (pool.length <= 3) return pool;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log('\n🖼️  FIX IMAGES & NAMES — Ảnh thật theo Category');
  console.log('═'.repeat(65));

  // ── STEP 1: Update ảnh cho sản phẩm mock (picsum) ──────────────
  console.log('\n  📸 BƯỚC 1: Update ảnh cho SP mock (picsum → ảnh thật)...');
  
  const mockCount = await prisma.product.count({
    where: { is_deleted: false, image: { contains: 'picsum' } },
  });
  console.log(`  SP cần update: ${mockCount.toLocaleString()}`);

  // Get distinct categories of mock products
  const mockCats = await prisma.$queryRaw`
    SELECT DISTINCT category_id FROM "Product" WHERE is_deleted = false AND image LIKE '%picsum%'
  `;
  console.log(`  Categories: ${mockCats.length}`);

  // Print pool sizes
  console.log('\n  📋 Pool ảnh theo category:');
  for (const { category_id: catId } of mockCats) {
    const pool = getImagePool(catId);
    const source = IMAGE_POOLS[catId]?.length > 0 ? 'trực tiếp' : `fallback → ${FALLBACK_MAP[catId] || 'all'}`;
    console.log(`    ${catId.padEnd(35)} : ${pool.length} ảnh (${source})`);
  }
  console.log('─'.repeat(65));

  const startMs = Date.now();
  let totalUpdated = 0;

  for (const { category_id: catId } of mockCats) {
    const pool = getImagePool(catId);
    
    let cursor;
    while (true) {
      const products = await prisma.product.findMany({
        where:   { category_id: catId, is_deleted: false, image: { contains: 'picsum' } },
        select:  { id: true },
        take:    BATCH_SIZE,
        orderBy: { id: 'asc' },
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (!products.length) break;

      // Group by image set to minimize DB calls
      const byImage = {};
      for (const p of products) {
        const imgs = pickImages(pool);
        const key = imgs[0]; // group by main image
        if (!byImage[key]) byImage[key] = { imgs, ids: [] };
        byImage[key].ids.push(p.id);
      }

      await Promise.all(
        Object.values(byImage).map(({ imgs, ids }) =>
          prisma.product.updateMany({
            where: { id: { in: ids } },
            data: {
              image:  imgs[0],
              images: JSON.stringify(imgs),
            },
          })
        )
      );

      totalUpdated += products.length;
      cursor = products[products.length - 1].id;

      const elapsed = (Date.now() - startMs) / 1000;
      const rps = Math.round(totalUpdated / Math.max(elapsed, 1));
      const eta = rps > 0 ? Math.ceil((mockCount - totalUpdated) / rps) : 0;
      const etaStr = eta > 60 ? `${Math.floor(eta/60)}m${eta%60}s` : `${eta}s`;
      process.stdout.write(
        `\r  [Images] ${totalUpdated.toLocaleString()}/${mockCount.toLocaleString()}  ${rps.toLocaleString()}/s  ETA:${etaStr}     `
      );
    }
  }

  console.log(`\n  ✅ Đã update ảnh cho ${totalUpdated.toLocaleString()} sản phẩm`);

  // ── STEP 2: Fix tên cho brand "Khác" ────────────────────────────
  console.log('\n  ✏️  BƯỚC 2: Fix tên cho brand "Khác"...');
  
  // Check if any names contain "Khác"
  const khacInName = await prisma.product.count({
    where: { brand_id: 'br-khac', name: { contains: 'Khác' }, is_deleted: false },
  });
  console.log(`  SP brand "Khác" có chữ "Khác" trong tên: ${khacInName}`);

  if (khacInName > 0) {
    // Fix by replacing "Khác" in name
    let fixCursor;
    let fixCount = 0;
    while (true) {
      const products = await prisma.product.findMany({
        where: { brand_id: 'br-khac', name: { contains: 'Khác' }, is_deleted: false },
        select: { id: true, name: true },
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
        ...(fixCursor ? { skip: 1, cursor: { id: fixCursor } } : {}),
      });
      if (!products.length) break;

      for (const p of products) {
        const newName = p.name.replace(/\bKhác\b/g, '').replace(/\s{2,}/g, ' ').trim();
        await prisma.product.update({ where: { id: p.id }, data: { name: newName } });
      }

      fixCount += products.length;
      fixCursor = products[products.length - 1].id;
      process.stdout.write(`\r  [Names] Fixed ${fixCount}/${khacInName}     `);
    }
    console.log(`\n  ✅ Đã fix ${fixCount} tên sản phẩm`);
  } else {
    console.log('  ✅ Không có SP nào có chữ "Khác" trong tên');
  }

  // ── STEP 3: Verify ──────────────────────────────────────────────
  console.log('\n  🔍 BƯỚC 3: Kiểm tra kết quả...');
  
  const remainingPicsum = await prisma.product.count({
    where: { is_deleted: false, image: { contains: 'picsum' } },
  });
  
  const remainingKhac = await prisma.product.count({
    where: { brand_id: 'br-khac', name: { contains: 'Khác' }, is_deleted: false },
  });

  // Sample check — 5 products per category to verify images match
  console.log('\n  📋 Mẫu kiểm tra (ảnh khớp category):');
  const checkCats = ['cat-phone','cat-laptop','cat-watch','cat-av-bt-earphone','cat-cam-security','cat-laptop-acc-mouse','cat-av-speaker','cat-mobile-acc-charger'];
  for (const catId of checkCats) {
    const sample = await prisma.product.findFirst({
      where: { category_id: catId, is_deleted: false },
      select: { name: true, image: true, category_id: true, brand_id: true },
    });
    if (sample) {
      console.log(`    ✅ [${catId}] ${sample.name.substring(0, 50)}`);
      console.log(`       🖼️  ${sample.image?.substring(0, 80)}...`);
    }
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log('\n  ╔══════════════════════════════════════════════════╗');
  console.log('  ║           HOÀN THÀNH                             ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║  SP đã update ảnh   : ${String(totalUpdated.toLocaleString()).padStart(10)}                ║`);
  console.log(`  ║  SP còn picsum      : ${String(remainingPicsum).padStart(10)}                ║`);
  console.log(`  ║  SP còn "Khác"      : ${String(remainingKhac).padStart(10)}                ║`);
  console.log(`  ║  Thời gian          : ${String(elapsed + 's').padStart(10)}                ║`);
  console.log('  ╚══════════════════════════════════════════════════╝');
}

main()
  .catch(e => { console.error('\n❌ Lỗi:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
