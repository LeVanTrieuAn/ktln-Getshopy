/**
 * fill-600k.js
 * ─────────────────────────────────────────────────────────────────
 * Scale Supabase lên đúng 600,000 sản phẩm với các ràng buộc:
 *   ✅ Mỗi BRAND    có ít nhất MIN_PER_BRAND sản phẩm
 *   ✅ Mỗi CATEGORY có ít nhất MIN_PER_CAT   sản phẩm
 *   ✅ Tổng đúng TARGET sản phẩm
 *
 * Cách dùng:
 *   node scripts/fill-600k.js
 *   node scripts/fill-600k.js 1000000    ← tuỳ chỉnh target
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

// ── Cấu hình ─────────────────────────────────────────────────────
const TARGET        = parseInt(process.argv[2] || '600000', 10);
const MIN_PER_BRAND = 20;
const MIN_PER_CAT   = 20;
const BATCH_SIZE    = 3000; // rows/lần insert

// ── Category leaf IDs (chỉ gán cho sản phẩm — không dùng parent) ─
const LEAF_CATEGORIES = [
  'cat-phone','cat-laptop','cat-tablet','cat-watch',
  'cat-mobile-acc-powerbank','cat-mobile-acc-charger','cat-mobile-acc-case-phone',
  'cat-mobile-acc-case-tablet','cat-mobile-acc-screen','cat-mobile-acc-cam-cover',
  'cat-mobile-acc-airpods-case','cat-mobile-acc-fan','cat-mobile-acc-pen',
  'cat-mobile-acc-stand','cat-mobile-acc-strap','cat-mobile-acc-lens',
  'cat-laptop-acc-hub','cat-laptop-acc-mouse','cat-laptop-acc-keyboard',
  'cat-laptop-acc-router','cat-laptop-acc-bag','cat-laptop-acc-pouch',
  'cat-laptop-acc-keyboard-cover','cat-laptop-acc-software',
  'cat-laptop-acc-monitor-stand','cat-laptop-acc-mousepad','cat-laptop-acc-drawing',
  'cat-av-bt-earphone','cat-av-wire-earphone','cat-av-headphone',
  'cat-av-sport-earphone','cat-av-speaker','cat-av-mic',
  'cat-av-projector','cat-av-smartglass','cat-av-hdd','cat-av-sdcard','cat-av-usb',
  'cat-cam-security','cat-cam-indoor','cat-cam-outdoor','cat-cam-solar',
  'cat-cam-4g','cat-cam-doorbell','cat-cam-webcam',
];

const CAT_NAMES = {
  'cat-phone':'Điện thoại','cat-laptop':'Laptop','cat-tablet':'Tablet','cat-watch':'Smartwatch',
  'cat-mobile-acc-powerbank':'Sạc dự phòng','cat-mobile-acc-charger':'Sạc, cáp',
  'cat-mobile-acc-case-phone':'Ốp lưng điện thoại','cat-mobile-acc-case-tablet':'Ốp lưng máy tính bảng',
  'cat-mobile-acc-screen':'Miếng dán','cat-mobile-acc-cam-cover':'Miếng dán Camera',
  'cat-mobile-acc-airpods-case':'Túi đựng AirPods','cat-mobile-acc-fan':'Quạt mini',
  'cat-mobile-acc-pen':'Bút tablet','cat-mobile-acc-stand':'Giá đỡ điện thoại/laptop',
  'cat-mobile-acc-strap':'Dây đeo điện thoại','cat-mobile-acc-lens':'Ống kính điện thoại',
  'cat-laptop-acc-hub':'Hub, cáp chuyển đổi','cat-laptop-acc-mouse':'Chuột máy tính',
  'cat-laptop-acc-keyboard':'Bàn phím','cat-laptop-acc-router':'Router & Thiết bị mạng',
  'cat-laptop-acc-bag':'Balo, túi chống sốc','cat-laptop-acc-pouch':'Túi đựng phụ kiện',
  'cat-laptop-acc-keyboard-cover':'Phủ phím laptop','cat-laptop-acc-software':'Phần mềm',
  'cat-laptop-acc-monitor-stand':'Giá treo màn hình','cat-laptop-acc-mousepad':'Miếng lót chuột',
  'cat-laptop-acc-drawing':'Bảng vẽ điện tử',
  'cat-av-bt-earphone':'Tai nghe Bluetooth','cat-av-wire-earphone':'Tai nghe dây',
  'cat-av-headphone':'Tai nghe chụp tai','cat-av-sport-earphone':'Tai nghe thể thao',
  'cat-av-speaker':'Loa','cat-av-mic':'Micro','cat-av-projector':'Máy chiếu',
  'cat-av-smartglass':'Kính thông minh','cat-av-hdd':'Ổ cứng',
  'cat-av-sdcard':'Thẻ nhớ','cat-av-usb':'USB',
  'cat-cam-security':'Camera Giám Sát','cat-cam-indoor':'Camera trong nhà',
  'cat-cam-outdoor':'Camera ngoài trời','cat-cam-solar':'Camera Năng Lượng Mặt Trời',
  'cat-cam-4g':'Camera 4G','cat-cam-doorbell':'Chuông cửa Camera','cat-cam-webcam':'Webcam',
};

// ── Brand → valid categories mapping ─────────────────────────────
const BRAND_CAT_MAP = {
  'br-apple':    ['cat-phone','cat-laptop','cat-tablet','cat-watch',
                  'cat-mobile-acc-charger','cat-mobile-acc-case-phone','cat-mobile-acc-airpods-case'],
  'br-samsung':  ['cat-phone','cat-tablet','cat-watch',
                  'cat-mobile-acc-case-phone','cat-av-bt-earphone','cat-av-wire-earphone'],
  'br-oppo':     ['cat-phone','cat-mobile-acc-charger','cat-mobile-acc-case-phone'],
  'br-xiaomi':   ['cat-phone','cat-tablet','cat-watch','cat-mobile-acc-powerbank',
                  'cat-mobile-acc-charger','cat-cam-indoor','cat-av-bt-earphone'],
  'br-vivo':     ['cat-phone','cat-mobile-acc-charger'],
  'br-realme':   ['cat-phone','cat-mobile-acc-powerbank','cat-mobile-acc-charger'],
  'br-nokia':    ['cat-phone'],
  'br-masstel':  ['cat-phone','cat-laptop','cat-tablet'],
  'br-mobell':   ['cat-phone'],
  'br-tecno':    ['cat-phone'],
  'br-infinix':  ['cat-phone','cat-laptop'],
  'br-itel':     ['cat-phone'],
  'br-honor':    ['cat-phone','cat-tablet','cat-watch'],
  'br-motorola': ['cat-phone'],
  'br-asus':     ['cat-laptop','cat-laptop-acc-keyboard','cat-laptop-acc-router'],
  'br-hp':       ['cat-laptop','cat-laptop-acc-mouse','cat-laptop-acc-keyboard'],
  'br-lenovo':   ['cat-laptop','cat-tablet','cat-laptop-acc-keyboard'],
  'br-acer':     ['cat-laptop'],
  'br-dell':     ['cat-laptop','cat-laptop-acc-mouse','cat-laptop-acc-monitor-stand'],
  'br-msi':      ['cat-laptop','cat-laptop-acc-keyboard','cat-laptop-acc-mousepad'],
  'br-lg':       ['cat-laptop'],
  'br-microsoft':['cat-laptop','cat-laptop-acc-keyboard','cat-laptop-acc-mouse'],
  'br-gigabyte': ['cat-laptop'],
  'br-razer':    ['cat-laptop','cat-laptop-acc-keyboard','cat-laptop-acc-mouse','cat-laptop-acc-mousepad'],
  'br-garmin':   ['cat-watch'],
  'br-huawei':   ['cat-watch','cat-mobile-acc-charger'],
  'br-amazfit':  ['cat-watch'],
  'br-befit':    ['cat-watch'],
  'br-fitbit':   ['cat-watch'],
  'br-polar':    ['cat-watch'],
  'br-anker':    ['cat-mobile-acc-powerbank','cat-mobile-acc-charger',
                  'cat-laptop-acc-hub','cat-laptop-acc-mouse'],
  'br-baseus':   ['cat-mobile-acc-powerbank','cat-mobile-acc-charger','cat-mobile-acc-screen',
                  'cat-laptop-acc-hub','cat-mobile-acc-case-phone'],
  'br-energizer':['cat-mobile-acc-powerbank','cat-mobile-acc-charger'],
  'br-ugreen':   ['cat-mobile-acc-charger','cat-laptop-acc-hub',
                  'cat-laptop-acc-mouse','cat-laptop-acc-keyboard'],
  'br-romoss':   ['cat-mobile-acc-powerbank','cat-mobile-acc-charger'],
  'br-aukey':    ['cat-mobile-acc-powerbank','cat-mobile-acc-charger','cat-laptop-acc-hub'],
  'br-ravpower': ['cat-mobile-acc-powerbank','cat-mobile-acc-charger'],
  'br-belkin':   ['cat-mobile-acc-charger','cat-laptop-acc-hub','cat-mobile-acc-case-phone'],
  'br-xmobile':  ['cat-mobile-acc-charger','cat-mobile-acc-powerbank'],
  'br-pisen':    ['cat-mobile-acc-powerbank','cat-mobile-acc-charger'],
  'br-spigen':   ['cat-mobile-acc-case-phone','cat-mobile-acc-case-tablet',
                  'cat-mobile-acc-screen','cat-laptop-acc-pouch'],
  'br-esr':      ['cat-mobile-acc-case-phone','cat-mobile-acc-case-tablet','cat-mobile-acc-screen'],
  'br-hydragel': ['cat-mobile-acc-screen','cat-mobile-acc-cam-cover'],
  'br-capdase':  ['cat-mobile-acc-case-phone','cat-laptop-acc-bag'],
  'br-memumi':   ['cat-mobile-acc-case-phone','cat-mobile-acc-case-tablet'],
  'br-zagg':     ['cat-mobile-acc-screen','cat-mobile-acc-case-phone','cat-laptop-acc-keyboard-cover'],
  'br-nillkin':  ['cat-mobile-acc-case-phone','cat-mobile-acc-screen'],
  'br-rock':     ['cat-mobile-acc-case-phone','cat-mobile-acc-charger'],
  'br-jbl':      ['cat-av-bt-earphone','cat-av-wire-earphone','cat-av-sport-earphone','cat-av-speaker'],
  'br-sony-audio':['cat-av-bt-earphone','cat-av-wire-earphone','cat-av-headphone','cat-av-speaker'],
  'br-bose':     ['cat-av-headphone','cat-av-speaker','cat-av-bt-earphone'],
  'br-sennheiser':['cat-av-headphone','cat-av-wire-earphone','cat-av-mic'],
  'br-jabra':    ['cat-av-bt-earphone','cat-av-headphone'],
  'br-edifier':  ['cat-av-speaker','cat-av-headphone'],
  'br-1more':    ['cat-av-bt-earphone','cat-av-wire-earphone','cat-av-sport-earphone'],
  'br-skullcandy':['cat-av-bt-earphone','cat-av-sport-earphone','cat-av-headphone'],
  'br-beats':    ['cat-av-bt-earphone','cat-av-headphone','cat-av-sport-earphone'],
  'br-shure':    ['cat-av-mic','cat-av-headphone','cat-av-wire-earphone'],
  'br-audio-technica':['cat-av-headphone','cat-av-wire-earphone','cat-av-mic'],
  'br-plantronics':['cat-av-headphone','cat-av-bt-earphone'],
  'br-logitech': ['cat-laptop-acc-mouse','cat-laptop-acc-keyboard',
                  'cat-laptop-acc-mousepad','cat-av-speaker'],
  'br-marshall': ['cat-av-speaker','cat-av-headphone'],
  'br-harman':   ['cat-av-speaker','cat-av-bt-earphone'],
  'br-hikvision':['cat-cam-security','cat-cam-indoor','cat-cam-outdoor','cat-cam-4g'],
  'br-dahua':    ['cat-cam-security','cat-cam-indoor','cat-cam-outdoor','cat-cam-4g'],
  'br-kbone':    ['cat-cam-security','cat-cam-indoor','cat-cam-outdoor'],
  'br-reolink':  ['cat-cam-indoor','cat-cam-outdoor','cat-cam-solar'],
  'br-imou':     ['cat-cam-indoor','cat-cam-outdoor','cat-cam-doorbell'],
  'br-ezviz':    ['cat-cam-indoor','cat-cam-outdoor','cat-cam-doorbell','cat-cam-security'],
  'br-tp-link':  ['cat-cam-indoor','cat-laptop-acc-router','cat-cam-doorbell'],
  'br-xiaomi-cam':['cat-cam-indoor','cat-cam-outdoor','cat-cam-security'],
  'br-vantech':  ['cat-cam-security','cat-cam-indoor','cat-cam-outdoor'],
  'br-imilab':   ['cat-cam-indoor','cat-cam-outdoor'],
  'br-annke':    ['cat-cam-security','cat-cam-outdoor','cat-cam-4g'],
  'br-seagate':  ['cat-av-hdd'],
  'br-wd':       ['cat-av-hdd'],
  'br-samsung-st':['cat-av-sdcard','cat-av-usb','cat-av-hdd'],
  'br-sandisk':  ['cat-av-sdcard','cat-av-usb'],
  'br-kingston': ['cat-av-sdcard','cat-av-usb','cat-av-hdd'],
  'br-lexar':    ['cat-av-sdcard','cat-av-usb'],
  'br-transcend':['cat-av-sdcard','cat-av-usb','cat-av-hdd'],
  'br-toshiba':  ['cat-av-hdd'],
  'br-pny':      ['cat-av-sdcard','cat-av-usb'],
  'br-tplink-net':['cat-laptop-acc-router'],
  'br-asus-net': ['cat-laptop-acc-router'],
  'br-linksys':  ['cat-laptop-acc-router'],
  'br-dlink':    ['cat-laptop-acc-router'],
  'br-netgear':  ['cat-laptop-acc-router'],
  'br-totolink': ['cat-laptop-acc-router'],
  'br-mercusys': ['cat-laptop-acc-router'],
  'br-cam-webcam':['cat-cam-webcam'],
};
// Fallback: brand không có map → random leaf cat
const getCatForBrand = (brandId) => {
  const cats = BRAND_CAT_MAP[brandId];
  return cats && cats.length ? cats : LEAF_CATEGORIES;
};

// ── Color / Storage / Adjectives ────────────────────────────────
const COLORS    = ['Black','White','Silver','Gold','Blue','Red','Green','Purple','Rose Gold','Gray','Midnight','Starlight'];
const STORAGES  = ['64GB','128GB','256GB','512GB','1TB','2TB'];
const ADJECTIVES= ['Pro','Max','Ultra','Plus','Lite','Air','Neo','Edge','Prime','Elite','SE','X','Z','S'];
const BRANCHES  = ['HCM001','HCM002','HN001'];
const PICSUM    = Array.from({ length: 50 }, (_, i) => (i * 20) % 1000);

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
  'br-toshiba':'Toshiba','br-pny':'PNY','br-tplink-net':'TP-Link',
  'br-asus-net':'Asus','br-linksys':'Linksys','br-dlink':'D-Link',
  'br-netgear':'Netgear','br-totolink':'TOTOLINK','br-mercusys':'Mercusys',
  'br-cam-webcam':'Generic',
};

// ── Helpers ──────────────────────────────────────────────────────
const rand    = (a, b) => Math.random() * (b - a) + a;
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick    = (arr)  => arr[randInt(0, arr.length - 1)];

let _globalIdx = 0; // global counter để tên sản phẩm unique

function makeProduct(catId, brandId) {
  _globalIdx++;
  const idx       = _globalIdx;
  const catName   = CAT_NAMES[catId] || 'Sản phẩm';
  const brandName = BRAND_NAMES[brandId] || brandId;
  const adj       = pick(ADJECTIVES);
  const name      = `${brandName} ${catName.split(' ')[0]} ${adj} - ${idx}`;

  const originalPrice = Math.round(rand(150_000, 50_000_000) / 1000) * 1000;
  const discountPct   = rand(0.02, 0.35);
  // Tiền là Int, đơn vị ĐỒNG. Công thức cũ `Math.round(x * 100) / 100` là tàn
  // dư từ thời cột tiền còn là Float — nó trả về số có 2 chữ số thập phân.
  // Product.price được Prisma ép về Int nên nhìn vẫn nguyên, nhưng giá trong
  // variants (JSON) giữ nguyên phần lẻ, và mọi phép so sánh số tiền sau đó lệch.
  // Làm tròn nghìn cho khớp cách niêm yết giá thực tế.
  const price         = Math.round(originalPrice * (1 - discountPct) / 1000) * 1000;

  const pId  = PICSUM[idx % PICSUM.length];
  const pId2 = PICSUM[(idx + 7) % PICSUM.length];
  const image  = `https://picsum.photos/id/${pId}/400/400`;
  const images = [image, `https://picsum.photos/id/${pId2}/400/400`];

  // ── Biến thể ──────────────────────────────────────────────────────────
  // Mỗi biến thể PHẢI có id, price, stock — không chỉ nhãn màu/dung lượng.
  //
  //   id    : khoá client gửi lên khi đặt hàng, và khoá của bảng Inventory.
  //           Thiếu id thì không tách được tồn kho theo biến thể, và client
  //           không có gì để chỉ ra khách đang chọn phiên bản nào.
  //   stock : tồn của RIÊNG biến thể đó. Thiếu thì màu đã hết vẫn bán được,
  //           vì hệ thống chỉ thấy tổng tồn của cả sản phẩm.
  //   price : biến thể dung lượng cao hơn thì đắt hơn — nếu dùng chung một
  //           giá thì khách chọn bản đắt vẫn trả giá gốc.
  //
  // Tổng stock các biến thể = stock của sản phẩm, để hai con số không mâu thuẫn.
  const productStock = randInt(0, 999);
  const numColors  = randInt(1, 3);
  const usedColors = new Set();
  const rawVariants = [];
  while (rawVariants.length < numColors) {
    const c = pick(COLORS);
    if (!usedColors.has(c)) {
      usedColors.add(c);
      rawVariants.push(Math.random() > 0.5 ? { color: c, storage: pick(STORAGES) } : { color: c });
    }
  }

  // Chia stock của sản phẩm cho các biến thể; phần dư dồn vào biến thể cuối
  const perVariant = Math.floor(productStock / rawVariants.length);
  const variants = rawVariants.map((v, i) => {
    // Dung lượng lớn hơn thì đắt hơn — cùng vị trí trong STORAGES thì cùng giá
    const storageIdx = v.storage ? STORAGES.indexOf(v.storage) : 0;
    const bump = storageIdx > 0 ? Math.round(price * 0.08 * storageIdx) : 0;
    return {
      // id ổn định trong phạm vi một sản phẩm, không phụ thuộc thứ tự mảng
      id: `v${i + 1}`,
      color: v.color,
      ...(v.storage ? { storage: v.storage } : {}),
      price: price + bump,
      stock: i === rawVariants.length - 1
        ? productStock - perVariant * (rawVariants.length - 1)
        : perVariant,
    };
  });

  const numBranches = randInt(1, BRANCHES.length);
  const branchIds   = [...BRANCHES].sort(() => Math.random() - 0.5).slice(0, numBranches);

  return {
    name, price,
    original_price: originalPrice,
    category_id:    catId,
    brand_id:       brandId,
    stock:          productStock,
    rating:         Math.round(rand(3.5, 5.0) * 100) / 100,
    sold:           randInt(0, 999),
    image, images,
    description: `${brandName} ${catName} ${adj} — Sản phẩm chính hãng, chất lượng cao, bảo hành đầy đủ.`,
    variants:    variants,
    branch_ids:  branchIds,
    is_banner:   false,
    is_deleted:  false,
  };
}

async function insertBatch(rows) {
  await prisma.product.createMany({ data: rows, skipDuplicates: false });
}

function printBar(done, total, startMs, label) {
  const pct     = Math.min(done / total, 1);
  const filled  = Math.round(pct * 35);
  const bar     = '█'.repeat(filled) + '░'.repeat(35 - filled);
  const elapsed = (Date.now() - startMs) / 1000;
  const rps     = done / Math.max(elapsed, 1);
  const eta     = rps > 0 ? Math.ceil((total - done) / rps) : 0;
  const etaStr  = eta > 60 ? `${Math.floor(eta/60)}m${eta%60}s` : `${eta}s`;
  process.stdout.write(
    `\r  [${bar}] ${(pct*100).toFixed(1)}%  ${done.toLocaleString()}/${total.toLocaleString()}` +
    `  ${Math.round(rps).toLocaleString()}/s  ETA:${etaStr}  ${label}      `
  );
}

// ── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 FILL 600,000 PRODUCTS — với ràng buộc min/brand & min/category');
  console.log('═'.repeat(65));

  // 1. Đọc brand và category hiện có trong DB
  const [brands, categories] = await Promise.all([
    prisma.brand.findMany({ select: { id: true } }),
    prisma.category.findMany({ where: { parent_id: { not: null } }, select: { id: true } }),
  ]);
  const allBrandIds = brands.map(b => b.id);
  const allCatIds   = categories.map(c => c.id).filter(id => LEAF_CATEGORIES.includes(id));

  console.log(`  Brands trong DB   : ${allBrandIds.length}`);
  console.log(`  Leaf categories   : ${allCatIds.length}`);

  // 2. Đếm hiện tại
  const currentTotal = await prisma.product.count();
  console.log(`  Sản phẩm hiện tại : ${currentTotal.toLocaleString()}`);
  console.log(`  Mục tiêu          : ${TARGET.toLocaleString()}`);

  if (currentTotal >= TARGET) {
    console.log(`\n✅ Đã đủ ${currentTotal.toLocaleString()} sản phẩm!`);
    return;
  }

  // 3. Đếm per-brand và per-category hiện tại
  console.log('\n  📊 Đếm phân bố hiện tại...');
  const [brandCounts, catCounts] = await Promise.all([
    prisma.$queryRaw`SELECT brand_id as id, COUNT(*)::int as cnt FROM "Product" WHERE is_deleted = false GROUP BY brand_id`,
    prisma.$queryRaw`SELECT category_id as id, COUNT(*)::int as cnt FROM "Product" WHERE is_deleted = false GROUP BY category_id`,
  ]);

  const brandCountMap = {};
  for (const r of brandCounts) brandCountMap[r.id] = Number(r.cnt);
  const catCountMap = {};
  for (const r of catCounts) catCountMap[r.id] = Number(r.cnt);

  // 4. Xây dựng "jobs" — danh sách (catId, brandId, count) cần insert
  const jobs = []; // { catId, brandId, count }

  // Phase A: Đảm bảo mỗi BRAND ≥ MIN_PER_BRAND
  let phaseACount = 0;
  for (const brandId of allBrandIds) {
    const current = brandCountMap[brandId] || 0;
    const needed  = Math.max(0, MIN_PER_BRAND - current);
    if (needed > 0) {
      const validCats = getCatForBrand(brandId).filter(c => allCatIds.includes(c));
      const catPool   = validCats.length ? validCats : allCatIds;
      // Chia đều qua các cat
      let rem = needed;
      let ci  = 0;
      while (rem > 0) {
        const catId = catPool[ci % catPool.length];
        const chunk = Math.min(rem, Math.ceil(needed / catPool.length) || 1);
        jobs.push({ catId, brandId, count: chunk });
        rem -= chunk;
        ci++;
      }
      phaseACount += needed;
    }
  }

  // Phase B: Đảm bảo mỗi CATEGORY ≥ MIN_PER_CAT
  let phaseBCount = 0;
  for (const catId of allCatIds) {
    // Tính dự kiến sau phase A
    const afterA = (catCountMap[catId] || 0) +
      jobs.filter(j => j.catId === catId).reduce((s, j) => s + j.count, 0);
    const needed = Math.max(0, MIN_PER_CAT - afterA);
    if (needed > 0) {
      const brandId = pick(allBrandIds.filter(b => getCatForBrand(b).includes(catId)) || allBrandIds);
      jobs.push({ catId, brandId, count: needed });
      phaseBCount += needed;
    }
  }

  const minGuaranteeTotal = phaseACount + phaseBCount;

  // Phase C: Fill ngẫu nhiên đến TARGET
  const afterMinGuarantee = currentTotal + minGuaranteeTotal;
  const remaining = Math.max(0, TARGET - afterMinGuarantee);
  // Không push vào jobs — xử lý riêng trong vòng lặp fill

  console.log(`\n  Phase A (min brand): +${phaseACount.toLocaleString()} sản phẩm`);
  console.log(`  Phase B (min cat)  : +${phaseBCount.toLocaleString()} sản phẩm`);
  console.log(`  Phase C (fill)     : +${remaining.toLocaleString()} sản phẩm`);
  console.log(`  Tổng cần insert    : +${(minGuaranteeTotal + remaining).toLocaleString()}\n`);
  console.log('─'.repeat(65));

  const startMs  = Date.now();
  let totalInserted = 0;
  const grandTotal  = minGuaranteeTotal + remaining;

  // ── Execute Phase A & B (từ jobs list) ───────────────────────
  console.log('  [Phase A+B] Đảm bảo tối thiểu per-brand và per-category...');
  let batch = [];
  for (const job of jobs) {
    for (let i = 0; i < job.count; i++) {
      batch.push(makeProduct(job.catId, job.brandId));
      if (batch.length >= BATCH_SIZE) {
        await insertBatch(batch);
        totalInserted += batch.length;
        batch = [];
        printBar(totalInserted, grandTotal, startMs, 'Phase A+B');
      }
    }
  }
  if (batch.length > 0) {
    await insertBatch(batch);
    totalInserted += batch.length;
    batch = [];
    printBar(totalInserted, grandTotal, startMs, 'Phase A+B');
  }

  // ── Execute Phase C (random fill) ────────────────────────────
  if (remaining > 0) {
    console.log('\n\n  [Phase C] Random fill đến 600,000...');
    let filled = 0;
    while (filled < remaining) {
      const batchCount = Math.min(BATCH_SIZE, remaining - filled);
      const rows = [];
      for (let i = 0; i < batchCount; i++) {
        const catId   = pick(allCatIds);
        const pool    = getCatForBrand(pick(allBrandIds)).filter(c => allCatIds.includes(c));
        const brandId = pick(allBrandIds.filter(b =>
          (getCatForBrand(b) || allCatIds).includes(catId)
        ) || allBrandIds);
        rows.push(makeProduct(catId, brandId));
      }
      await insertBatch(rows);
      filled        += rows.length;
      totalInserted += rows.length;
      printBar(totalInserted, grandTotal, startMs, 'Phase C');
    }
  }

  // ── Final report ──────────────────────────────────────────────
  console.log('\n\n  🔍 Kiểm tra kết quả cuối...');
  const [finalTotal, finalBrandCounts, finalCatCounts] = await Promise.all([
    prisma.product.count(),
    prisma.$queryRaw`SELECT brand_id as id, COUNT(*)::int as cnt FROM "Product" WHERE is_deleted=false GROUP BY brand_id`,
    prisma.$queryRaw`SELECT category_id as id, COUNT(*)::int as cnt FROM "Product" WHERE is_deleted=false GROUP BY category_id`,
  ]);

  const brandFinalMap = {};
  for (const r of finalBrandCounts) brandFinalMap[r.id] = Number(r.cnt);
  const catFinalMap = {};
  for (const r of finalCatCounts) catFinalMap[r.id] = Number(r.cnt);

  const brandsBelow = allBrandIds.filter(id => (brandFinalMap[id] || 0) < MIN_PER_BRAND);
  const catsBelow   = allCatIds.filter(id => (catFinalMap[id]   || 0) < MIN_PER_CAT);

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

  console.log('\n  ╔══════════════════════════════════════════════════╗');
  console.log('  ║            KẾT QUẢ HOÀN THÀNH                   ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║  Tổng sản phẩm      : ${String(finalTotal.toLocaleString()).padStart(10)}                ║`);
  console.log(`  ║  Đã insert thêm     : ${String(totalInserted.toLocaleString()).padStart(10)}                ║`);
  console.log(`  ║  Thời gian          : ${String(elapsed + 's').padStart(10)}                ║`);
  console.log(`  ║  Tốc độ TB          : ${String(Math.round(totalInserted/elapsed).toLocaleString()+'/s').padStart(10)}                ║`);
  console.log(`  ║  Brand dưới minimum : ${String(brandsBelow.length).padStart(10)}                ║`);
  console.log(`  ║  Cat dưới minimum   : ${String(catsBelow.length).padStart(10)}                ║`);
  console.log('  ╚══════════════════════════════════════════════════╝');

  if (brandsBelow.length > 0) {
    console.log(`\n  ⚠️  Brands < ${MIN_PER_BRAND}: ${brandsBelow.join(', ')}`);
  }
  if (catsBelow.length > 0) {
    console.log(`  ⚠️  Categories < ${MIN_PER_CAT}: ${catsBelow.join(', ')}`);
  }
  if (brandsBelow.length === 0 && catsBelow.length === 0) {
    console.log('\n  ✅ Tất cả brand và category đều đủ số lượng tối thiểu!\n');
  }
}

main()
  .catch(e => { console.error('\n❌ Lỗi:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
