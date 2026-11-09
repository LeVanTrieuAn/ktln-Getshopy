/**
 * reassign-brands-and-rebalance.js
 * ─────────────────────────────────────────────────────────────────
 * 1. Reassign brand đúng theo category (mọi category)
 * 2. Rebalance: điều chỉnh phân phối sản phẩm hợp lý hơn
 *    - Điện thoại: ~60,000 SP
 *    - Laptop: ~50,000 SP
 *    - Tablet: ~40,000 SP
 *    - Smartwatch: ~30,000 SP
 *    - Phụ kiện di động: ~150,000 SP tổng
 *    - Phụ kiện laptop: ~80,000 SP tổng
 *    - Âm thanh/AV: ~100,000 SP tổng
 *    - Camera: ~60,000 SP tổng
 *    - Lưu trữ: ~30,000 SP tổng
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

// ── Brand pools đúng theo category ───────────────────────────────
const CATEGORY_BRAND_MAP = {
  // ĐIỆN THOẠI
  'cat-phone': ['br-apple','br-samsung','br-oppo','br-xiaomi','br-vivo','br-realme','br-nokia','br-masstel','br-mobell','br-tecno','br-infinix','br-itel','br-honor','br-motorola'],

  // LAPTOP
  'cat-laptop': ['br-apple','br-asus','br-hp','br-lenovo','br-acer','br-dell','br-msi','br-lg','br-microsoft','br-gigabyte','br-razer'],

  // TABLET
  'cat-tablet': ['br-apple','br-samsung','br-lenovo','br-xiaomi','br-honor','br-masstel'],

  // SMARTWATCH
  'cat-watch': ['br-apple','br-samsung','br-garmin','br-xiaomi','br-huawei','br-amazfit','br-befit','br-fitbit','br-polar','br-honor'],

  // PHỤ KIỆN DI ĐỘNG
  'cat-mobile-acc-powerbank': ['br-anker','br-baseus','br-energizer','br-ugreen','br-romoss','br-aukey','br-ravpower','br-xmobile','br-pisen'],
  'cat-mobile-acc-charger':   ['br-anker','br-baseus','br-apple','br-samsung','br-belkin','br-ugreen','br-ravpower','br-xmobile','br-pisen'],
  'cat-mobile-acc-case-phone':   ['br-spigen','br-esr','br-nillkin','br-rock','br-capdase','br-memumi','br-zagg','br-belkin','br-baseus'],
  'cat-mobile-acc-case-tablet':  ['br-spigen','br-esr','br-nillkin','br-capdase','br-zagg','br-baseus','br-belkin'],
  'cat-mobile-acc-screen':       ['br-hydragel','br-zagg','br-spigen','br-esr','br-nillkin','br-memumi','br-capdase'],
  'cat-mobile-acc-cam-cover':    ['br-hydragel','br-spigen','br-esr','br-nillkin','br-zagg'],
  'cat-mobile-acc-airpods-case': ['br-spigen','br-esr','br-capdase','br-nillkin','br-memumi'],
  'cat-mobile-acc-fan':          ['br-baseus','br-rock','br-ugreen','br-xmobile'],
  'cat-mobile-acc-pen':          ['br-apple','br-baseus','br-ugreen','br-xmobile','br-rock'],
  'cat-mobile-acc-stand':        ['br-baseus','br-ugreen','br-rock','br-belkin','br-anker'],
  'cat-mobile-acc-strap':        ['br-capdase','br-spigen','br-nillkin','br-rock','br-baseus'],
  'cat-mobile-acc-lens':         ['br-baseus','br-rock','br-ugreen','br-xmobile'],

  // PHỤ KIỆN LAPTOP
  'cat-laptop-acc-hub':            ['br-anker','br-baseus','br-ugreen','br-belkin','br-rock','br-ravpower'],
  'cat-laptop-acc-mouse':          ['br-logitech','br-razer','br-microsoft','br-asus','br-dell','br-hp','br-baseus'],
  'cat-laptop-acc-keyboard':       ['br-logitech','br-razer','br-microsoft','br-asus','br-corsair','br-hp'],
  'cat-laptop-acc-router':         ['br-tp-link','br-tplink-net','br-asus-net','br-linksys','br-dlink','br-netgear','br-totolink','br-mercusys'],
  'cat-laptop-acc-bag':            ['br-capdase','br-belkin','br-spigen','br-nillkin','br-rock','br-baseus'],
  'cat-laptop-acc-pouch':          ['br-capdase','br-belkin','br-spigen','br-nillkin','br-rock'],
  'cat-laptop-acc-keyboard-cover': ['br-hydragel','br-zagg','br-spigen','br-nillkin','br-capdase'],
  'cat-laptop-acc-software':       ['br-microsoft','br-apple'],
  'cat-laptop-acc-monitor-stand':  ['br-logitech','br-asus','br-dell','br-hp','br-baseus','br-ugreen'],
  'cat-laptop-acc-mousepad':       ['br-logitech','br-razer','br-asus','br-corsair','br-rock','br-baseus'],
  'cat-laptop-acc-drawing':        ['br-logitech','br-razer','br-asus','br-microsoft','br-ugreen'],

  // ÂM THANH
  'cat-av-bt-earphone':    ['br-apple','br-samsung','br-sony-audio','br-jbl','br-bose','br-sennheiser','br-jabra','br-edifier','br-1more','br-skullcandy','br-beats','br-shure','br-audio-technica','br-plantronics'],
  'cat-av-wire-earphone':  ['br-sony-audio','br-jbl','br-sennheiser','br-audio-technica','br-shure','br-edifier','br-1more','br-skullcandy','br-jabra'],
  'cat-av-headphone':      ['br-sony-audio','br-bose','br-sennheiser','br-beats','br-marshall','br-harman','br-jabra','br-plantronics','br-audio-technica','br-shure'],
  'cat-av-sport-earphone': ['br-jbl','br-sony-audio','br-bose','br-beats','br-jabra','br-skullcandy','br-edifier','br-1more'],
  'cat-av-speaker':        ['br-jbl','br-sony-audio','br-bose','br-marshall','br-harman','br-edifier','br-skullcandy'],
  'cat-av-mic':            ['br-shure','br-audio-technica','br-sennheiser','br-jabra','br-plantronics','br-sony-audio'],
  'cat-av-projector':      ['br-sony-audio','br-jbl','br-bose','br-sennheiser','br-harman'],
  'cat-av-smartglass':     ['br-sony-audio','br-marshall','br-bose','br-jbl','br-edifier'],

  // LƯU TRỮ
  'cat-av-hdd':    ['br-seagate','br-wd','br-samsung-st','br-toshiba'],
  'cat-av-sdcard': ['br-sandisk','br-samsung-st','br-kingston','br-lexar','br-transcend','br-pny'],
  'cat-av-usb':    ['br-sandisk','br-kingston','br-lexar','br-transcend','br-pny','br-samsung-st'],

  // CAMERA
  'cat-cam-security': ['br-hikvision','br-dahua','br-kbone','br-reolink','br-vantech','br-annke'],
  'cat-cam-indoor':   ['br-imou','br-ezviz','br-tp-link','br-xiaomi-cam','br-imilab','br-reolink','br-hikvision'],
  'cat-cam-outdoor':  ['br-hikvision','br-dahua','br-reolink','br-ezviz','br-kbone','br-vantech','br-annke'],
  'cat-cam-solar':    ['br-reolink','br-ezviz','br-imilab','br-imou','br-annke'],
  'cat-cam-4g':       ['br-hikvision','br-dahua','br-reolink','br-ezviz','br-vantech'],
  'cat-cam-doorbell': ['br-ezviz','br-imou','br-reolink','br-tp-link','br-imilab','br-hikvision'],
  'cat-cam-webcam':   ['br-logitech','br-jabra','br-microsoft','br-hp'],
};

// ── Target distribution (tổng = 600,000) ─────────────────────────
// Đơn vị: số SP mong muốn mỗi category
const TARGET = {
  // Core products — nên có nhiều vì đây là sản phẩm chính
  'cat-phone':   60000,
  'cat-laptop':  50000,
  'cat-tablet':  40000,
  'cat-watch':   30000,

  // Phụ kiện di động
  'cat-mobile-acc-powerbank':    15000,
  'cat-mobile-acc-charger':      15000,
  'cat-mobile-acc-case-phone':   13000,
  'cat-mobile-acc-case-tablet':   8000,
  'cat-mobile-acc-screen':       12000,
  'cat-mobile-acc-cam-cover':     5000,
  'cat-mobile-acc-airpods-case':  5000,
  'cat-mobile-acc-fan':           5000,
  'cat-mobile-acc-pen':           5000,
  'cat-mobile-acc-stand':         7000,
  'cat-mobile-acc-strap':         5000,
  'cat-mobile-acc-lens':          4000,

  // Phụ kiện laptop
  'cat-laptop-acc-hub':            10000,
  'cat-laptop-acc-mouse':          12000,
  'cat-laptop-acc-keyboard':       10000,
  'cat-laptop-acc-router':          8000,
  'cat-laptop-acc-bag':             7000,
  'cat-laptop-acc-pouch':           5000,
  'cat-laptop-acc-keyboard-cover':  5000,
  'cat-laptop-acc-software':        4000,
  'cat-laptop-acc-monitor-stand':   5000,
  'cat-laptop-acc-mousepad':        8000,
  'cat-laptop-acc-drawing':         4000,

  // Âm thanh
  'cat-av-bt-earphone':   18000,
  'cat-av-wire-earphone': 10000,
  'cat-av-headphone':     15000,
  'cat-av-sport-earphone': 8000,
  'cat-av-speaker':       15000,
  'cat-av-mic':            8000,
  'cat-av-projector':      7000,
  'cat-av-smartglass':     5000,

  // Lưu trữ
  'cat-av-hdd':     8000,
  'cat-av-sdcard':  8000,
  'cat-av-usb':     7000,

  // Camera
  'cat-cam-security':   8000,
  'cat-cam-indoor':     8000,
  'cat-cam-outdoor':    7000,
  'cat-cam-solar':      6000,
  'cat-cam-4g':         5000,
  'cat-cam-doorbell':   5000,
  'cat-cam-webcam':     5000,
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  console.log('\n🔧 REASSIGN BRANDS + REBALANCE CATEGORIES');
  console.log('═'.repeat(60));

  // Lấy current counts
  const currentCounts = await prisma.$queryRaw`
    SELECT category_id, COUNT(*)::int as cnt
    FROM "Product" WHERE is_deleted = false
    GROUP BY category_id
  `;
  const currentMap = {};
  for (const r of currentCounts) currentMap[r.category_id] = r.cnt;

  const targetTotal = Object.values(TARGET).reduce((a, b) => a + b, 0);
  console.log(`  Target tổng: ${targetTotal.toLocaleString()} SP`);
  console.log(`  Hiện tại   : 600,000 SP`);

  // ── BƯỚC 1: Reassign brand sai category ──────────────────────
  console.log('\n  [1] Reassign brand sai category...');
  let totalReassigned = 0;

  for (const [catId, allowedBrands] of Object.entries(CATEGORY_BRAND_MAP)) {
    if (!allowedBrands || allowedBrands.length === 0) continue;

    const inList = allowedBrands.map(b => `'${b}'`).join(',');
    const wrongProducts = await prisma.$queryRaw`
      SELECT id FROM "Product"
      WHERE is_deleted = false
        AND category_id = ${catId}
        AND brand_id NOT IN (${prisma.$queryRawUnsafe ? catId : catId})
    `;

    // Dùng updateMany với NOT IN
    const wrongCount = await prisma.$executeRawUnsafe(`
      UPDATE "Product"
      SET brand_id = (
        SELECT b.id FROM "Brand" b
        WHERE b.id IN (${inList})
        ORDER BY RANDOM() LIMIT 1
      )
      WHERE is_deleted = false
        AND category_id = '${catId}'
        AND brand_id NOT IN (${inList})
    `);

    if (wrongCount > 0) {
      console.log(`    ✅ ${catId}: reassigned ${wrongCount.toLocaleString()} SP`);
      totalReassigned += wrongCount;
    }
  }
  console.log(`  Tổng reassigned: ${totalReassigned.toLocaleString()} SP`);

  // ── BƯỚC 2: Rebalance category counts ────────────────────────
  console.log('\n  [2] Rebalance phân phối category...');

  // Tính tổng target và scale về 600,000
  const scaleFactor = 600000 / targetTotal;
  const scaledTarget = {};
  let scaledSum = 0;
  const catKeys = Object.keys(TARGET);
  for (let i = 0; i < catKeys.length; i++) {
    const cat = catKeys[i];
    const scaled = i === catKeys.length - 1
      ? 600000 - scaledSum
      : Math.round(TARGET[cat] * scaleFactor);
    scaledTarget[cat] = scaled;
    scaledSum += scaled;
  }

  console.log('\n  Kế hoạch rebalance:');
  for (const [cat, tgt] of Object.entries(scaledTarget)) {
    const cur = currentMap[cat] || 0;
    const diff = tgt - cur;
    const sign = diff > 0 ? '+' : '';
    console.log(`    ${cat.padEnd(38)} ${cur.toLocaleString().padStart(7)} → ${tgt.toLocaleString().padStart(7)} (${sign}${diff.toLocaleString()})`);
  }

  // Reassign category: di chuyển từ over-quota sang under-quota
  // Lấy tất cả SP theo category_id, sắp xếp để biết cái nào thừa
  const overCategories  = Object.entries(scaledTarget).filter(([cat]) => (currentMap[cat] || 0) > scaledTarget[cat]).sort(([, a], [, b]) => b - a);
  const underCategories = Object.entries(scaledTarget).filter(([cat]) => (currentMap[cat] || 0) < scaledTarget[cat]).sort(([, a], [, b]) => b - a);

  let totalMoved = 0;
  console.log('\n  Đang di chuyển sản phẩm...');

  for (const [underCat, underTarget] of underCategories) {
    const currentUnder = (currentMap[underCat] || 0) + totalMoved; // approximate
    let needed = underTarget - (currentMap[underCat] || 0);
    if (needed <= 0) continue;

    const brandPool = CATEGORY_BRAND_MAP[underCat] || [];
    if (brandPool.length === 0) continue;

    for (const [overCat] of overCategories) {
      if (needed <= 0) break;
      const currentOver = currentMap[overCat] || 0;
      const overTarget  = scaledTarget[overCat];
      const surplus     = currentOver - overTarget;
      if (surplus <= 0) continue;

      const toMove = Math.min(needed, surplus);
      if (toMove <= 0) continue;

      // Lấy SP từ over-category để move sang under-category
      const productsToMove = await prisma.product.findMany({
        where:   { category_id: overCat, is_deleted: false },
        select:  { id: true },
        take:    toMove,
        orderBy: { id: 'desc' }, // lấy từ cuối để tránh hot products
      });

      if (productsToMove.length === 0) continue;

      // Assign brand ngẫu nhiên thuộc under-category
      const brandInList = brandPool.map(b => `'${b}'`).join(',');
      const ids = productsToMove.map(p => p.id);

      // Update từng batch 1000
      for (let i = 0; i < ids.length; i += 1000) {
        const batch = ids.slice(i, i + 1000);
        await prisma.$executeRawUnsafe(`
          UPDATE "Product"
          SET category_id = '${underCat}',
              brand_id = (
                SELECT id FROM "Brand"
                WHERE id IN (${brandInList})
                ORDER BY RANDOM() LIMIT 1
              )
          WHERE id IN (${batch.map(id => `'${id}'`).join(',')})
        `);
      }

      currentMap[overCat]  = (currentMap[overCat] || 0) - productsToMove.length;
      currentMap[underCat] = (currentMap[underCat] || 0) + productsToMove.length;
      needed    -= productsToMove.length;
      totalMoved += productsToMove.length;

      process.stdout.write(`\r  Đã di chuyển: ${totalMoved.toLocaleString()} SP   `);
    }
  }

  console.log('\n\n  ── KẾT QUẢ SAU REBALANCE ──');
  const finalCounts = await prisma.$queryRaw`
    SELECT category_id, COUNT(*)::int as cnt
    FROM "Product" WHERE is_deleted = false
    GROUP BY category_id ORDER BY cnt DESC
  `;
  const finalMap = {};
  for (const r of finalCounts) finalMap[r.category_id] = r.cnt;

  console.log('  Category           | Trước    | Sau      | Target');
  console.log('  ' + '─'.repeat(60));
  for (const cat of ['cat-phone','cat-laptop','cat-tablet','cat-watch']) {
    const before = currentCounts.find(c => c.category_id === cat)?.cnt || 0;
    const after  = finalMap[cat] || 0;
    const target = scaledTarget[cat];
    console.log(`  ${cat.padEnd(25)} | ${before.toString().padStart(8)} | ${after.toString().padStart(8)} | ${target.toString().padStart(8)}`);
  }

  console.log('\n  ╔══════════════════════════════════════════════════╗');
  console.log('  ║              HOÀN THÀNH                         ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║  Brand reassigned : ${String(totalReassigned.toLocaleString()).padStart(12)}               ║`);
  console.log(`  ║  SP di chuyển     : ${String(totalMoved.toLocaleString()).padStart(12)}               ║`);
  console.log('  ╚══════════════════════════════════════════════════╝');
}

main()
  .catch(e => { console.error('\n❌', e.message, e.stack); process.exit(1); })
  .finally(() => prisma.$disconnect());
