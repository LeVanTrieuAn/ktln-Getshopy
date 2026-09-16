/**
 * seed-brands.js
 * ─────────────────────────────────────────────────────────────────
 * Tái cấu trúc Brand thành hệ thống chi tiết theo từng phân khúc,
 * phản ánh thị trường công nghệ thực tế tại Việt Nam.
 *
 * Cách dùng:
 *   node scripts/seed-brands.js
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

// ══════════════════════════════════════════════════════════════════
// DANH SÁCH BRAND MỚI — THEO PHÂN KHÚC THỊ TRƯỜNG VIỆT NAM
// ══════════════════════════════════════════════════════════════════

const NEW_BRANDS = [
  // ── Smartphone (Điện thoại di động) ─────────────────────────────
  { id: 'br-apple',      name: 'Apple',      segment: 'phone,laptop,tablet,watch,acc' },
  { id: 'br-samsung',    name: 'Samsung',    segment: 'phone,tablet,watch,acc' },
  { id: 'br-oppo',       name: 'OPPO',       segment: 'phone,acc' },
  { id: 'br-xiaomi',     name: 'Xiaomi',     segment: 'phone,tablet,watch,acc' },
  { id: 'br-vivo',       name: 'vivo',       segment: 'phone' },
  { id: 'br-realme',     name: 'realme',     segment: 'phone,acc' },
  { id: 'br-nokia',      name: 'Nokia/HMD',  segment: 'phone' },
  { id: 'br-masstel',    name: 'Masstel',    segment: 'phone,laptop,tablet' },
  { id: 'br-mobell',     name: 'Mobell',     segment: 'phone' },
  { id: 'br-tecno',      name: 'TECNO',      segment: 'phone' },
  { id: 'br-infinix',    name: 'Infinix',    segment: 'phone,laptop' },
  { id: 'br-itel',       name: 'itel',       segment: 'phone' },
  { id: 'br-honor',      name: 'HONOR',      segment: 'phone,tablet,watch' },
  { id: 'br-motorola',   name: 'Motorola',   segment: 'phone' },

  // ── Laptop (Máy tính xách tay) ───────────────────────────────────
  { id: 'br-asus',       name: 'Asus',       segment: 'laptop,acc' },
  { id: 'br-hp',         name: 'HP',         segment: 'laptop,acc' },
  { id: 'br-lenovo',     name: 'Lenovo',     segment: 'laptop,tablet,acc' },
  { id: 'br-acer',       name: 'Acer',       segment: 'laptop' },
  { id: 'br-dell',       name: 'Dell',       segment: 'laptop,acc' },
  { id: 'br-msi',        name: 'MSI',        segment: 'laptop,acc' },
  { id: 'br-lg',         name: 'LG',         segment: 'laptop' },
  { id: 'br-microsoft',  name: 'Microsoft',  segment: 'laptop,acc' },
  { id: 'br-gigabyte',   name: 'Gigabyte',   segment: 'laptop,acc' },
  { id: 'br-razer',      name: 'Razer',      segment: 'laptop,acc' },

  // ── Smartwatch & Wearables ────────────────────────────────────────
  { id: 'br-garmin',     name: 'Garmin',     segment: 'watch' },
  { id: 'br-huawei',     name: 'Huawei',     segment: 'watch,acc' },
  { id: 'br-amazfit',    name: 'Amazfit',    segment: 'watch' },
  { id: 'br-befit',      name: 'BeFit',      segment: 'watch' },
  { id: 'br-fitbit',     name: 'Fitbit',     segment: 'watch' },
  { id: 'br-polar',      name: 'Polar',      segment: 'watch' },

  // ── Phụ kiện — Sạc & Pin ─────────────────────────────────────────
  { id: 'br-anker',      name: 'Anker',      segment: 'acc' },
  { id: 'br-baseus',     name: 'Baseus',     segment: 'acc' },
  { id: 'br-energizer',  name: 'Energizer',  segment: 'acc' },
  { id: 'br-ugreen',     name: 'Ugreen',     segment: 'acc' },
  { id: 'br-romoss',     name: 'Romoss',     segment: 'acc' },
  { id: 'br-aukey',      name: 'Aukey',      segment: 'acc' },
  { id: 'br-ravpower',   name: 'RAVPower',   segment: 'acc' },
  { id: 'br-belkin',     name: 'Belkin',     segment: 'acc' },
  { id: 'br-xmobile',    name: 'Xmobile',    segment: 'acc' },
  { id: 'br-pisen',      name: 'Pisen',      segment: 'acc' },

  // ── Phụ kiện — Ốp lưng & Bảo vệ ────────────────────────────────
  { id: 'br-spigen',     name: 'Spigen',     segment: 'acc' },
  { id: 'br-esr',        name: 'ESR',        segment: 'acc' },
  { id: 'br-hydragel',   name: 'Hydragel',   segment: 'acc' },
  { id: 'br-capdase',    name: 'Capdase',    segment: 'acc' },
  { id: 'br-memumi',     name: 'Mẹ Muội',    segment: 'acc' },
  { id: 'br-zagg',       name: 'ZAGG',       segment: 'acc' },
  { id: 'br-nillkin',    name: 'Nillkin',    segment: 'acc' },
  { id: 'br-rock',       name: 'ROCK',       segment: 'acc' },

  // ── Tai nghe & Âm thanh ──────────────────────────────────────────
  { id: 'br-jbl',        name: 'JBL',        segment: 'acc,av' },
  { id: 'br-sony-audio', name: 'Sony',       segment: 'acc,av' },
  { id: 'br-bose',       name: 'Bose',       segment: 'av' },
  { id: 'br-sennheiser', name: 'Sennheiser', segment: 'av' },
  { id: 'br-jabra',      name: 'Jabra',      segment: 'av' },
  { id: 'br-edifier',    name: 'Edifier',    segment: 'av' },
  { id: 'br-1more',      name: '1MORE',      segment: 'av' },
  { id: 'br-skullcandy', name: 'Skullcandy', segment: 'av' },
  { id: 'br-beats',      name: 'Beats',      segment: 'av' },
  { id: 'br-shure',      name: 'Shure',      segment: 'av' },
  { id: 'br-audio-technica', name: 'Audio-Technica', segment: 'av' },
  { id: 'br-plantronics', name: 'Plantronics', segment: 'av' },
  { id: 'br-logitech',   name: 'Logitech',   segment: 'acc,av' },
  { id: 'br-marshall',   name: 'Marshall',   segment: 'av' },
  { id: 'br-harman',     name: 'Harman Kardon', segment: 'av' },

  // ── Camera & Thiết bị giám sát ───────────────────────────────────
  { id: 'br-hikvision',  name: 'Hikvision',  segment: 'camera' },
  { id: 'br-dahua',      name: 'Dahua',      segment: 'camera' },
  { id: 'br-kbone',      name: 'KBvision',   segment: 'camera' },
  { id: 'br-reolink',    name: 'Reolink',    segment: 'camera' },
  { id: 'br-imou',       name: 'Imou',       segment: 'camera' },
  { id: 'br-ezviz',      name: 'EZVIZ',      segment: 'camera' },
  { id: 'br-tp-link',    name: 'TP-Link',    segment: 'camera,acc' },
  { id: 'br-xiaomi-cam', name: 'Xiaomi Camera', segment: 'camera' },
  { id: 'br-vantech',    name: 'Vantech',    segment: 'camera' },
  { id: 'br-kamera',     name: 'Kamera',     segment: 'camera' },
  { id: 'br-imilab',     name: 'IMILAB',     segment: 'camera' },
  { id: 'br-annke',      name: 'ANNKE',      segment: 'camera' },

  // ── Thiết bị mạng & Router ───────────────────────────────────────
  { id: 'br-asus-net',   name: 'Asus',       segment: 'network' },
  { id: 'br-tplink-net', name: 'TP-Link',    segment: 'network' },
  { id: 'br-linksys',    name: 'Linksys',    segment: 'network' },
  { id: 'br-dlink',      name: 'D-Link',     segment: 'network' },
  { id: 'br-netgear',    name: 'Netgear',    segment: 'network' },
  { id: 'br-totolink',   name: 'TOTOLINK',   segment: 'network' },
  { id: 'br-mercusys',   name: 'Mercusys',   segment: 'network' },

  // ── Lưu trữ (HDD, SSD, USB, Thẻ nhớ) ───────────────────────────
  { id: 'br-seagate',    name: 'Seagate',    segment: 'storage' },
  { id: 'br-wd',         name: 'Western Digital', segment: 'storage' },
  { id: 'br-samsung-st', name: 'Samsung',    segment: 'storage' },
  { id: 'br-sandisk',    name: 'SanDisk',    segment: 'storage' },
  { id: 'br-kingston',   name: 'Kingston',   segment: 'storage' },
  { id: 'br-lexar',      name: 'Lexar',      segment: 'storage' },
  { id: 'br-transcend',  name: 'Transcend',  segment: 'storage' },
  { id: 'br-toshiba',    name: 'Toshiba',    segment: 'storage' },
  { id: 'br-pny',        name: 'PNY',        segment: 'storage' },
];

// ── Mapping category → brand IDs phù hợp (cho scale-products) ────
// (Xuất ra cuối script để dùng trong scale-products.js)

async function main() {
  console.log('\n🏷️  SEED BRANDS — Nhãn hàng chi tiết thị trường VN');
  console.log('═'.repeat(55));

  // 1. Lấy brand cũ
  const oldBrands = await prisma.brand.findMany({ select: { id: true, name: true } });
  console.log(`  📋 Brand cũ cần xóa  : ${oldBrands.length} (${oldBrands.map(b => b.name).join(', ')})`);

  // 2. Xóa brand cũ
  // (Products vẫn trỏ brand_id cũ — sẽ reassign sau)
  await prisma.brand.deleteMany({ where: { id: { in: oldBrands.map(b => b.id) } } });
  console.log(`  🗑️  Đã xóa ${oldBrands.length} brand cũ`);

  // 3. Insert brand mới
  const brandData = NEW_BRANDS.map(({ id, name }) => ({
    id,
    name,
    is_deleted: false,
  }));
  await prisma.brand.createMany({ data: brandData, skipDuplicates: true });
  console.log(`  ✅ Đã insert ${brandData.length} brand mới`);

  // 4. Reassign products — map theo category để gán brand hợp lý
  console.log('\n  🔄 Reassign brand cho sản phẩm theo category...');

  // Mapping: category_id pattern → brand IDs phù hợp
  const CAT_BRAND_MAP = {
    // Điện thoại
    'cat-phone':    ['br-apple', 'br-samsung', 'br-oppo', 'br-xiaomi', 'br-vivo',
                     'br-realme', 'br-nokia', 'br-masstel', 'br-mobell',
                     'br-tecno', 'br-infinix', 'br-itel', 'br-honor', 'br-motorola'],
    // Laptop
    'cat-laptop':   ['br-apple', 'br-asus', 'br-hp', 'br-lenovo', 'br-acer',
                     'br-dell', 'br-msi', 'br-masstel', 'br-lg', 'br-microsoft',
                     'br-gigabyte', 'br-razer', 'br-infinix'],
    // Tablet
    'cat-tablet':   ['br-apple', 'br-samsung', 'br-lenovo', 'br-xiaomi',
                     'br-masstel', 'br-honor'],
    // Smartwatch
    'cat-watch':    ['br-apple', 'br-samsung', 'br-garmin', 'br-xiaomi',
                     'br-huawei', 'br-amazfit', 'br-befit', 'br-fitbit',
                     'br-honor', 'br-polar'],
    // Phụ kiện di động
    'cat-mobile-acc': ['br-anker', 'br-baseus', 'br-energizer', 'br-ugreen',
                       'br-apple', 'br-samsung', 'br-xmobile', 'br-spigen',
                       'br-esr', 'br-hydragel', 'br-nillkin', 'br-romoss',
                       'br-capdase', 'br-zagg', 'br-belkin', 'br-pisen',
                       'br-aukey', 'br-rock'],
    // Phụ kiện laptop, PC
    'cat-laptop-acc': ['br-anker', 'br-baseus', 'br-ugreen', 'br-logitech',
                       'br-dell', 'br-hp', 'br-asus', 'br-microsoft',
                       'br-belkin', 'br-razer', 'br-msi', 'br-kingston',
                       'br-tplink-net', 'br-tp-link'],
    // Tai nghe & Âm thanh
    'cat-av':       ['br-jbl', 'br-sony-audio', 'br-bose', 'br-sennheiser',
                     'br-jabra', 'br-edifier', 'br-1more', 'br-skullcandy',
                     'br-beats', 'br-shure', 'br-audio-technica', 'br-samsung',
                     'br-apple', 'br-xiaomi', 'br-plantronics', 'br-logitech',
                     'br-marshall', 'br-harman'],
    // Camera
    'cat-camera':   ['br-hikvision', 'br-dahua', 'br-kbone', 'br-reolink',
                     'br-imou', 'br-ezviz', 'br-tp-link', 'br-xiaomi-cam',
                     'br-vantech', 'br-imilab', 'br-annke'],
    // Storage
    'storage':      ['br-seagate', 'br-wd', 'br-samsung-st', 'br-sandisk',
                     'br-kingston', 'br-lexar', 'br-transcend', 'br-toshiba', 'br-pny'],
  };

  // Flatten brands per category prefix
  const getCatKey = (catId) => {
    if (!catId) return null;
    if (catId === 'cat-phone')  return 'cat-phone';
    if (catId === 'cat-laptop') return 'cat-laptop';
    if (catId === 'cat-tablet') return 'cat-tablet';
    if (catId === 'cat-watch')  return 'cat-watch';
    if (catId.startsWith('cat-mobile-acc')) return 'cat-mobile-acc';
    if (catId.startsWith('cat-laptop-acc')) return 'cat-laptop-acc';
    if (catId.startsWith('cat-av'))         return 'cat-av';
    if (catId.startsWith('cat-cam'))        return 'cat-camera';
    if (['cat-av-hdd','cat-av-sdcard','cat-av-usb'].includes(catId)) return 'storage';
    return null;
  };

  const { createRng } = require('./lib/rng');
  const rng = createRng('seed-brands');
  const randPick = (arr) => arr[Math.floor(rng() * arr.length)];
  const ALL_BRAND_IDS = NEW_BRANDS.map(b => b.id);

  let totalUpdated = 0;
  let cursor = undefined;

  while (true) {
    const products = await prisma.product.findMany({
      select: { id: true, category_id: true },
      take: 5000,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });

    if (products.length === 0) break;

    // Group by new brand
    const groupByBrand = {};
    for (const p of products) {
      const catKey = getCatKey(p.category_id);
      const brandPool = catKey && CAT_BRAND_MAP[catKey]
        ? CAT_BRAND_MAP[catKey]
        : ALL_BRAND_IDS;
      const newBrand = randPick(brandPool);
      if (!groupByBrand[newBrand]) groupByBrand[newBrand] = [];
      groupByBrand[newBrand].push(p.id);
    }

    // Bulk update per brand
    for (const [brandId, ids] of Object.entries(groupByBrand)) {
      await prisma.product.updateMany({
        where: { id: { in: ids } },
        data: { brand_id: brandId },
      });
    }

    totalUpdated += products.length;
    cursor = products[products.length - 1].id;
    process.stdout.write(`\r  Progress: ${totalUpdated.toLocaleString()} sản phẩm   `);
  }

  // 5. Verify
  console.log('\n\n  🔍 Kiểm tra kết quả...');
  const finalCount  = await prisma.brand.count();
  const invalidProds = await prisma.product.count({
    where: { brand_id: { notIn: ALL_BRAND_IDS } },
  });

  console.log('\n  ╔════════════════════════════════════════╗');
  console.log('  ║         SEED BRANDS HOÀN THÀNH         ║');
  console.log('  ╠════════════════════════════════════════╣');
  console.log(`  ║  Tổng brand mới     : ${String(finalCount).padStart(5)}              ║`);
  console.log(`  ║  Sản phẩm đã update : ${String(totalUpdated).padStart(8)}           ║`);
  console.log(`  ║  Sản phẩm lỗi brand : ${String(invalidProds).padStart(5)}              ║`);
  console.log('  ╚════════════════════════════════════════╝');

  if (invalidProds === 0) {
    console.log('\n  ✅ Tất cả sản phẩm đã được gán brand hợp lệ!\n');
  } else {
    console.warn(`\n  ⚠️  Còn ${invalidProds} sản phẩm brand không hợp lệ!\n`);
  }

  // 6. In danh sách brand để update scale-products.js
  console.log('  📋 Danh sách brand IDs (dùng cho scale-products.js):');
  const bySegment = {
    'phone': [], 'laptop': [], 'tablet': [],
    'watch': [], 'acc': [], 'av': [], 'camera': [], 'network': [], 'storage': [],
  };
  for (const b of NEW_BRANDS) {
    b.segment.split(',').forEach(s => {
      if (bySegment[s]) bySegment[s].push(b.id);
    });
  }
  for (const [seg, ids] of Object.entries(bySegment)) {
    if (ids.length) console.log(`    ${seg}: ${ids.join(', ')}`);
  }
}

main()
  .catch((e) => { console.error('\n❌ Lỗi:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
