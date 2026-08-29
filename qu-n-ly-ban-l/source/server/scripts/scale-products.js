/**
 * scale-products.js
 * ─────────────────────────────────────────────────────────────────
 * Scale tổng sản phẩm lên TARGET_TOTAL (mặc định 600,000).
 *
 * Cách dùng:
 *   node scale-products.js             ← scale lên 600,000
 *   node scale-products.js 1000000     ← scale lên 1,000,000
 *
 * Chiến lược:
 *   - Đếm số sản phẩm hiện tại → tính số cần thêm
 *   - Sinh dữ liệu realistic theo từng batch (BATCH_SIZE)
 *   - Dùng prisma.product.createMany() để bulk insert
 *   - Hiển thị progress bar ngay trên terminal
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: [], // tắt query log để terminal sạch
});

// ── Config ────────────────────────────────────────────────────────
const TARGET_TOTAL = parseInt(process.argv[2] || '600000', 10);
const BATCH_SIZE   = 2000; // rows per createMany call (tối ưu cho Supabase pooler)

// ── Lookup data (khớp với DB thực) ───────────────────────────────
// ── Chỉ dùng subcategory cấp 2 (leaf) cho sản phẩm ──────────────
const CATEGORIES = [
  // Sản phẩm chính
  'cat-phone', 'cat-laptop', 'cat-tablet', 'cat-watch',
  // Phụ kiện di động
  'cat-mobile-acc-powerbank', 'cat-mobile-acc-charger', 'cat-mobile-acc-case-phone',
  'cat-mobile-acc-case-tablet', 'cat-mobile-acc-screen', 'cat-mobile-acc-cam-cover',
  'cat-mobile-acc-airpods-case', 'cat-mobile-acc-fan', 'cat-mobile-acc-pen',
  'cat-mobile-acc-stand', 'cat-mobile-acc-strap', 'cat-mobile-acc-lens',
  // Phụ kiện laptop, PC
  'cat-laptop-acc-hub', 'cat-laptop-acc-mouse', 'cat-laptop-acc-keyboard',
  'cat-laptop-acc-router', 'cat-laptop-acc-bag', 'cat-laptop-acc-pouch',
  'cat-laptop-acc-keyboard-cover', 'cat-laptop-acc-software',
  'cat-laptop-acc-monitor-stand', 'cat-laptop-acc-mousepad', 'cat-laptop-acc-drawing',
  // Thiết bị nghe nhìn
  'cat-av-bt-earphone', 'cat-av-wire-earphone', 'cat-av-headphone',
  'cat-av-sport-earphone', 'cat-av-speaker', 'cat-av-mic',
  'cat-av-projector', 'cat-av-smartglass', 'cat-av-hdd', 'cat-av-sdcard', 'cat-av-usb',
  // Camera
  'cat-cam-security', 'cat-cam-indoor', 'cat-cam-outdoor', 'cat-cam-solar',
  'cat-cam-4g', 'cat-cam-doorbell', 'cat-cam-webcam',
];
const CAT_NAMES  = {
  'cat-phone': 'Điện thoại', 'cat-laptop': 'Laptop',
  'cat-tablet': 'Tablet',    'cat-watch': 'Smartwatch',
  'cat-mobile-acc-powerbank': 'Sạc dự phòng',
  'cat-mobile-acc-charger': 'Sạc, cáp',
  'cat-mobile-acc-case-phone': 'Ốp lưng điện thoại',
  'cat-mobile-acc-case-tablet': 'Ốp lưng máy tính bảng',
  'cat-mobile-acc-screen': 'Miếng dán',
  'cat-mobile-acc-cam-cover': 'Miếng dán Camera',
  'cat-mobile-acc-airpods-case': 'Túi đựng AirPods',
  'cat-mobile-acc-fan': 'Quạt mini',
  'cat-mobile-acc-pen': 'Bút tablet',
  'cat-mobile-acc-stand': 'Giá đỡ điện thoại/laptop',
  'cat-mobile-acc-strap': 'Dây đeo điện thoại',
  'cat-mobile-acc-lens': 'Ống kính điện thoại',
  'cat-laptop-acc-hub': 'Hub, cáp chuyển đổi',
  'cat-laptop-acc-mouse': 'Chuột máy tính',
  'cat-laptop-acc-keyboard': 'Bàn phím',
  'cat-laptop-acc-router': 'Router & Thiết bị mạng',
  'cat-laptop-acc-bag': 'Balo, túi chống sốc',
  'cat-laptop-acc-pouch': 'Túi đựng phụ kiện',
  'cat-laptop-acc-keyboard-cover': 'Phủ phím laptop',
  'cat-laptop-acc-software': 'Phần mềm',
  'cat-laptop-acc-monitor-stand': 'Giá treo màn hình',
  'cat-laptop-acc-mousepad': 'Miếng lót chuột',
  'cat-laptop-acc-drawing': 'Bảng vẽ điện tử',
  'cat-av-bt-earphone': 'Tai nghe Bluetooth',
  'cat-av-wire-earphone': 'Tai nghe dây',
  'cat-av-headphone': 'Tai nghe chụp tai',
  'cat-av-sport-earphone': 'Tai nghe thể thao',
  'cat-av-speaker': 'Loa',
  'cat-av-mic': 'Micro',
  'cat-av-projector': 'Máy chiếu',
  'cat-av-smartglass': 'Kính thông minh',
  'cat-av-hdd': 'Ổ cứng',
  'cat-av-sdcard': 'Thẻ nhớ',
  'cat-av-usb': 'USB',
  'cat-cam-security': 'Camera Giám Sát',
  'cat-cam-indoor': 'Camera trong nhà',
  'cat-cam-outdoor': 'Camera ngoài trời',
  'cat-cam-solar': 'Camera Năng Lượng Mặt Trời',
  'cat-cam-4g': 'Camera 4G',
  'cat-cam-doorbell': 'Chuông cửa Camera',
  'cat-cam-webcam': 'Webcam',
};

// ── Brand pool theo category (khớp với seed-brands.js) ───────────
const CAT_BRAND_POOL = {
  'cat-phone':    ['br-apple','br-samsung','br-oppo','br-xiaomi','br-vivo',
                   'br-realme','br-nokia','br-masstel','br-mobell',
                   'br-tecno','br-infinix','br-itel','br-honor','br-motorola'],
  'cat-laptop':   ['br-apple','br-asus','br-hp','br-lenovo','br-acer',
                   'br-dell','br-msi','br-masstel','br-lg','br-microsoft',
                   'br-gigabyte','br-razer','br-infinix'],
  'cat-tablet':   ['br-apple','br-samsung','br-lenovo','br-xiaomi','br-masstel','br-honor'],
  'cat-watch':    ['br-apple','br-samsung','br-garmin','br-xiaomi',
                   'br-huawei','br-amazfit','br-befit','br-fitbit','br-honor','br-polar'],
  'cat-mobile-acc': ['br-anker','br-baseus','br-energizer','br-ugreen',
                     'br-apple','br-samsung','br-xmobile','br-spigen',
                     'br-esr','br-hydragel','br-nillkin','br-romoss',
                     'br-capdase','br-zagg','br-belkin','br-pisen','br-aukey','br-rock'],
  'cat-laptop-acc': ['br-anker','br-baseus','br-ugreen','br-logitech',
                     'br-dell','br-hp','br-asus','br-microsoft',
                     'br-belkin','br-razer','br-msi','br-kingston','br-tplink-net'],
  'cat-av':       ['br-jbl','br-sony-audio','br-bose','br-sennheiser',
                   'br-jabra','br-edifier','br-1more','br-skullcandy',
                   'br-beats','br-shure','br-audio-technica','br-samsung',
                   'br-apple','br-xiaomi','br-plantronics','br-logitech',
                   'br-marshall','br-harman'],
  'cat-camera':   ['br-hikvision','br-dahua','br-kbone','br-reolink',
                   'br-imou','br-ezviz','br-tp-link','br-xiaomi-cam',
                   'br-vantech','br-imilab','br-annke'],
  'storage':      ['br-seagate','br-wd','br-samsung-st','br-sandisk',
                   'br-kingston','br-lexar','br-transcend','br-toshiba','br-pny'],
};
const ALL_BRAND_IDS = [
  'br-apple','br-samsung','br-oppo','br-xiaomi','br-vivo','br-realme',
  'br-nokia','br-masstel','br-mobell','br-tecno','br-infinix','br-itel',
  'br-honor','br-motorola','br-asus','br-hp','br-lenovo','br-acer','br-dell',
  'br-msi','br-lg','br-microsoft','br-gigabyte','br-razer','br-garmin',
  'br-huawei','br-amazfit','br-befit','br-fitbit','br-polar','br-anker',
  'br-baseus','br-energizer','br-ugreen','br-romoss','br-aukey','br-ravpower',
  'br-belkin','br-xmobile','br-pisen','br-spigen','br-esr','br-hydragel',
  'br-capdase','br-memumi','br-zagg','br-nillkin','br-rock','br-jbl',
  'br-sony-audio','br-bose','br-sennheiser','br-jabra','br-edifier','br-1more',
  'br-skullcandy','br-beats','br-shure','br-audio-technica','br-plantronics',
  'br-logitech','br-marshall','br-harman','br-hikvision','br-dahua','br-kbone',
  'br-reolink','br-imou','br-ezviz','br-tp-link','br-xiaomi-cam','br-vantech',
  'br-imilab','br-annke','br-seagate','br-wd','br-samsung-st','br-sandisk',
  'br-kingston','br-lexar','br-transcend','br-toshiba','br-pny',
];

// Lấy brand pool phù hợp theo category_id
function getBrandPool(catId) {
  if (!catId) return ALL_BRAND_IDS;
  if (catId === 'cat-phone')  return CAT_BRAND_POOL['cat-phone'];
  if (catId === 'cat-laptop') return CAT_BRAND_POOL['cat-laptop'];
  if (catId === 'cat-tablet') return CAT_BRAND_POOL['cat-tablet'];
  if (catId === 'cat-watch')  return CAT_BRAND_POOL['cat-watch'];
  if (catId.startsWith('cat-mobile-acc')) return CAT_BRAND_POOL['cat-mobile-acc'];
  if (catId.startsWith('cat-laptop-acc')) return CAT_BRAND_POOL['cat-laptop-acc'];
  if (['cat-av-hdd','cat-av-sdcard','cat-av-usb'].includes(catId)) return CAT_BRAND_POOL['storage'];
  if (catId.startsWith('cat-av'))   return CAT_BRAND_POOL['cat-av'];
  if (catId.startsWith('cat-cam'))  return CAT_BRAND_POOL['cat-camera'];
  return ALL_BRAND_IDS;
}

// Lấy tên brand từ ID (dùng trong generateProduct)
const BRAND_NAMES = {
  'br-apple':'Apple','br-samsung':'Samsung','br-oppo':'OPPO','br-xiaomi':'Xiaomi',
  'br-vivo':'vivo','br-realme':'realme','br-nokia':'Nokia/HMD','br-masstel':'Masstel',
  'br-mobell':'Mobell','br-tecno':'TECNO','br-infinix':'Infinix','br-itel':'itel',
  'br-honor':'HONOR','br-motorola':'Motorola','br-asus':'Asus','br-hp':'HP',
  'br-lenovo':'Lenovo','br-acer':'Acer','br-dell':'Dell','br-msi':'MSI',
  'br-lg':'LG','br-microsoft':'Microsoft','br-gigabyte':'Gigabyte','br-razer':'Razer',
  'br-garmin':'Garmin','br-huawei':'Huawei','br-amazfit':'Amazfit','br-befit':'BeFit',
  'br-fitbit':'Fitbit','br-polar':'Polar','br-anker':'Anker','br-baseus':'Baseus',
  'br-energizer':'Energizer','br-ugreen':'Ugreen','br-romoss':'Romoss',
  'br-aukey':'Aukey','br-ravpower':'RAVPower','br-belkin':'Belkin',
  'br-xmobile':'Xmobile','br-pisen':'Pisen','br-spigen':'Spigen','br-esr':'ESR',
  'br-hydragel':'Hydragel','br-capdase':'Capdase','br-memumi':'Mẹ Muội',
  'br-zagg':'ZAGG','br-nillkin':'Nillkin','br-rock':'ROCK','br-jbl':'JBL',
  'br-sony-audio':'Sony','br-bose':'Bose','br-sennheiser':'Sennheiser',
  'br-jabra':'Jabra','br-edifier':'Edifier','br-1more':'1MORE',
  'br-skullcandy':'Skullcandy','br-beats':'Beats','br-shure':'Shure',
  'br-audio-technica':'Audio-Technica','br-plantronics':'Plantronics',
  'br-logitech':'Logitech','br-marshall':'Marshall','br-harman':'Harman Kardon',
  'br-hikvision':'Hikvision','br-dahua':'Dahua','br-kbone':'KBvision',
  'br-reolink':'Reolink','br-imou':'Imou','br-ezviz':'EZVIZ',
  'br-tp-link':'TP-Link','br-xiaomi-cam':'Xiaomi Camera','br-vantech':'Vantech',
  'br-imilab':'IMILAB','br-annke':'ANNKE','br-seagate':'Seagate',
  'br-wd':'Western Digital','br-samsung-st':'Samsung','br-sandisk':'SanDisk',
  'br-kingston':'Kingston','br-lexar':'Lexar','br-transcend':'Transcend',
  'br-toshiba':'Toshiba','br-pny':'PNY',
};

const BRANCHES  = ['HCM001', 'HCM002', 'HN001'];
const COLORS    = ['Black','White','Silver','Gold','Blue','Red','Green','Purple','Rose Gold','Gray','Midnight','Starlight'];
const STORAGES  = ['64GB','128GB','256GB','512GB','1TB','2TB'];
const ADJECTIVES = ['Pro','Max','Ultra','Plus','Lite','Air','Neo','Edge','Prime','Elite','SE','X','Z','S'];
const PICSUM_IDS = Array.from({ length: 50 }, (_, i) => (i * 20) % 1000);


// ── Helpers ───────────────────────────────────────────────────────
const rand    = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick    = (arr) => arr[randInt(0, arr.length - 1)];

/**
 * Sinh một sản phẩm mock có dữ liệu realistic
 * @param {number} idx - index toàn cục (dùng để tạo picsum id đa dạng)
 */
function generateProduct(idx) {
  const catId    = pick(CATEGORIES);
  const catName  = CAT_NAMES[catId] || 'Sản phẩm';
  const brandId  = pick(getBrandPool(catId));
  const brandName = BRAND_NAMES[brandId] || brandId;
  const adj      = pick(ADJECTIVES);
  const model    = `${brandName} ${catName.split(' ')[0]} ${adj}`;
  const variant  = `Mẫu ${idx + 1}`;
  const name     = `${model} - ${variant}`;

  const originalPrice = Math.round(rand(500_000, 50_000_000) / 1000) * 1000;
  const discountPct   = rand(0.02, 0.3);
  const price         = Math.round(originalPrice * (1 - discountPct) * 100) / 100;

  const picsumId  = PICSUM_IDS[idx % PICSUM_IDS.length];
  const picsumId2 = PICSUM_IDS[(idx + 7) % PICSUM_IDS.length];
  const image     = `https://picsum.photos/id/${picsumId}/400/400`;
  const images    = JSON.stringify([image, `https://picsum.photos/id/${picsumId2}/400/400`]);

  // 1-2 màu sắc variants
  const numColors = randInt(1, 3);
  const usedColors = new Set();
  const variants = [];
  while (variants.length < numColors) {
    const c = pick(COLORS);
    if (!usedColors.has(c)) {
      usedColors.add(c);
      // Đôi khi thêm storage
      const v = Math.random() > 0.5
        ? { color: c, storage: pick(STORAGES) }
        : { color: c };
      variants.push(v);
    }
  }

  // 1-3 chi nhánh ngẫu nhiên
  const numBranches = randInt(1, BRANCHES.length);
  const shuffled    = [...BRANCHES].sort(() => Math.random() - 0.5);
  const branchIds   = shuffled.slice(0, numBranches);

  return {
    name,
    price,
    original_price: originalPrice,
    category_id:    catId,
    brand_id:       brandId,
    stock:          randInt(0, 1000),
    rating:         Math.round(rand(3.5, 5.0) * 100) / 100,
    sold:           randInt(0, 500),
    image,
    images,
    description:    `Sản phẩm ${name} mang đến trải nghiệm tuyệt vời. Thiết kế hiện đại, hiệu năng mạnh mẽ, phù hợp mọi nhu cầu sử dụng.`,
    variants:       JSON.stringify(variants),
    branch_ids:     branchIds,
    is_banner:      false,
    is_deleted:     false,
  };
}

// ── Progress bar ──────────────────────────────────────────────────
function printProgress(done, total, startMs) {
  const pct      = done / total;
  const barLen   = 40;
  const filled   = Math.round(pct * barLen);
  const bar      = '█'.repeat(filled) + '░'.repeat(barLen - filled);
  const elapsed  = (Date.now() - startMs) / 1000;
  const rps      = done / elapsed;
  const remaining = rps > 0 ? (total - done) / rps : 0;
  const eta      = remaining > 60
    ? `${Math.floor(remaining / 60)}m ${Math.floor(remaining % 60)}s`
    : `${Math.floor(remaining)}s`;

  process.stdout.write(
    `\r  [${bar}] ${(pct * 100).toFixed(1)}%  ${done.toLocaleString()}/${total.toLocaleString()}  ` +
    `${Math.round(rps).toLocaleString()} rows/s  ETA: ${eta}   `
  );
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 SCALE PRODUCTS — Supabase PostgreSQL');
  console.log('═'.repeat(50));

  // 1. Đếm hiện tại
  const currentCount = await prisma.product.count();
  const needed       = TARGET_TOTAL - currentCount;

  console.log(`  Hiện tại   : ${currentCount.toLocaleString()} sản phẩm`);
  console.log(`  Mục tiêu   : ${TARGET_TOTAL.toLocaleString()} sản phẩm`);
  console.log(`  Cần thêm   : ${needed.toLocaleString()} sản phẩm`);
  console.log(`  Batch size : ${BATCH_SIZE.toLocaleString()} / lần insert`);
  console.log('─'.repeat(50));

  if (needed <= 0) {
    console.log(`✅ Đã đủ ${currentCount.toLocaleString()} sản phẩm. Không cần thêm.`);
    return;
  }

  // 2. Insert theo batch
  const startMs  = Date.now();
  let inserted   = 0;
  let batchIndex = 0;

  while (inserted < needed) {
    const batchCount = Math.min(BATCH_SIZE, needed - inserted);
    const rows = [];

    for (let i = 0; i < batchCount; i++) {
      rows.push(generateProduct(currentCount + inserted + i));
    }

    const result = await prisma.product.createMany({
      data: rows,
      skipDuplicates: false,
    });

    inserted += result.count;
    batchIndex++;
    printProgress(inserted, needed, startMs);
  }

  // 3. Kết quả
  const elapsed  = ((Date.now() - startMs) / 1000).toFixed(1);
  const finalCount = await prisma.product.count();

  console.log('\n');
  console.log('═'.repeat(50));
  console.log(`✅ HOÀN THÀNH!`);
  console.log(`   Đã thêm   : ${inserted.toLocaleString()} sản phẩm`);
  console.log(`   Tổng hiện tại : ${finalCount.toLocaleString()} sản phẩm`);
  console.log(`   Thời gian  : ${elapsed}s`);
  console.log(`   Tốc độ TB  : ${Math.round(inserted / elapsed).toLocaleString()} rows/s`);
  console.log('═'.repeat(50));
}

main()
  .catch((e) => {
    console.error('\n❌ Lỗi:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
