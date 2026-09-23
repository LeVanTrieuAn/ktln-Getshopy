/**
 * ============================================================
 * CHATBOT STRESS TEST — Getshopy AI Bot v3
 * ============================================================
 *
 * Bao phủ:
 *   A. Brand queries       — 33 brands × 8 templates  =  264
 *   B. Category queries    — 34 cats   × 6 templates  =  204
 *   C. Brand×Cat combos    — 40 pairs  × 3 templates  =  120
 *   D. Price bracket       — 9 cats    × 6 prices     =   54 + 36 explicit = 90
 *   E. Spec queries        — 8 groups  × 10 each      =   80
 *   F. Intent tests        — 15 intents × 6 each      =   90
 *   G. Compare queries     — 20 pairs  × 2 templates  =   40
 *   H. Budget combos       — brand × budget            =   60
 *   I. Specific product    — 50 cụ thể                =   50
 *   J. Edge / adversarial  — 40                       =   40
 *   K. Sub-cat specifics   — 30                       =   30
 *   L. Multi-attribute     — 50                       =   50
 *   ──────────────────────────────────────────────────────────
 *   TỔNG                                             ≥ 1118
 *
 * Cách chạy:
 *   node tests/chatbot-stress-test.js
 *   node tests/chatbot-stress-test.js --url http://localhost:3000
 *   node tests/chatbot-stress-test.js --group BRAND
 *   node tests/chatbot-stress-test.js --concurrency 3
 *   node tests/chatbot-stress-test.js --quick       # chỉ check HTTP+text
 *   node tests/chatbot-stress-test.js --out ./results.json
 *
 * Variables môi trường:
 *   BASE_URL      (default: http://localhost:3000)
 *   DELAY_MS      (default: 200)   — delay giữa mỗi test
 *   TIMEOUT_MS    (default: 25000) — abort sau N ms
 *   CONCURRENCY   (default: 1)
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag, def) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
};
const hasFlag = f => args.includes(f);

const BASE_URL   = getArg('--url', process.env.BASE_URL || 'http://localhost:3000');
const CHAT_URL   = `${BASE_URL}/api/b2c/chat`;
const DELAY_MS   = parseInt(getArg('--delay',  process.env.DELAY_MS    || '200'), 10);
const TIMEOUT_MS = parseInt(getArg('--timeout', process.env.TIMEOUT_MS  || '25000'), 10);
const CONCURRENCY= parseInt(getArg('--concurrency', process.env.CONCURRENCY || '1'), 10);
const OUT_FILE   = getArg('--out', `./test-results-${Date.now()}.json`);
const ONLY_GROUP = getArg('--group', null);
const QUICK_MODE = hasFlag('--quick');

// ─────────────────────────────────────────────────────────────────────────────
// DATA — 33 BRANDS (SEED_DOCUMENTATION.md)
// ─────────────────────────────────────────────────────────────────────────────
const BRANDS = [
  { id:'br-apple',    name:'Apple',    cat:'cat-phone',    keywords:['iPhone','MacBook','iPad','AirPods','Apple Watch'] },
  { id:'br-samsung',  name:'Samsung',  cat:'cat-phone',    keywords:['Samsung','Galaxy S','Galaxy A','Galaxy Z Fold'] },
  { id:'br-xiaomi',   name:'Xiaomi',   cat:'cat-phone',    keywords:['Xiaomi','Redmi Note','POCO X','Mi Watch'] },
  { id:'br-oppo',     name:'OPPO',     cat:'cat-phone',    keywords:['OPPO','Reno 13','Find X8'] },
  { id:'br-vivo',     name:'Vivo',     cat:'cat-phone',    keywords:['Vivo','Vivo V40','Vivo Y100'] },
  { id:'br-realme',   name:'realme',   cat:'cat-phone',    keywords:['realme','Realme 13','Realme GT'] },
  { id:'br-honor',    name:'HONOR',    cat:'cat-phone',    keywords:['HONOR','Honor X9b','Honor 200'] },
  { id:'br-motorola', name:'Motorola', cat:'cat-phone',    keywords:['Motorola','Moto G85','Moto Edge'] },
  { id:'br-anker',    name:'Anker',    cat:'cat-mobile-acc-charger', keywords:['Anker','sạc Anker','pin dự phòng Anker'] },
  { id:'br-msi',      name:'MSI',      cat:'cat-laptop',   keywords:['MSI','MSI Katana','MSI Titan','MSI laptop'] },
  { id:'br-asus',     name:'Asus',     cat:'cat-laptop',   keywords:['Asus','ROG Strix','TUF Gaming','ZenBook','VivoBook'] },
  { id:'br-dell',     name:'Dell',     cat:'cat-laptop',   keywords:['Dell','Dell XPS 13','Inspiron 15','Alienware'] },
  { id:'br-hp',       name:'HP',       cat:'cat-laptop',   keywords:['HP','HP Pavilion','HP Envy','HP Omen','Victus'] },
  { id:'br-lenovo',   name:'Lenovo',   cat:'cat-laptop',   keywords:['Lenovo','ThinkPad','IdeaPad','Legion 5','Yoga'] },
  { id:'br-acer',     name:'Acer',     cat:'cat-laptop',   keywords:['Acer','Aspire 5','Nitro 5','Predator Helios'] },
  { id:'br-huawei',   name:'Huawei',   cat:'cat-watch',    keywords:['Huawei Watch GT4','Huawei Band 9','MatePad'] },
  { id:'br-amazfit',  name:'Amazfit',  cat:'cat-watch',    keywords:['Amazfit','Amazfit GTR 4','Amazfit GTS 4'] },
  { id:'br-jbl',      name:'JBL',      cat:'cat-av-speaker',keywords:['JBL','JBL Flip 6','JBL Charge 5','JBL Tune'] },
  { id:'br-sony-audio',name:'Sony',   cat:'cat-av-headphone',keywords:['Sony','WH-1000XM5','WF-1000XM5','Sony XB910N'] },
  { id:'br-marshall', name:'Marshall', cat:'cat-av-speaker',keywords:['Marshall','Marshall Emberton','Marshall Kilburn'] },
  { id:'br-razer',    name:'Razer',    cat:'cat-laptop-acc-mouse',keywords:['Razer','DeathAdder V3','BlackWidow V4','Kraken V3'] },
  { id:'br-logitech', name:'Logitech', cat:'cat-laptop-acc-mouse',keywords:['Logitech','MX Master 3','G502 Hero','MX Keys'] },
  { id:'br-sandisk',  name:'SanDisk',  cat:'cat-av-sdcard', keywords:['SanDisk','SanDisk Extreme','SanDisk Ultra 128GB'] },
  { id:'br-kingston', name:'Kingston', cat:'cat-av-sdcard', keywords:['Kingston','Kingston Canvas','Kingston DataTraveler'] },
  { id:'br-seagate',  name:'Seagate',  cat:'cat-av-hdd',    keywords:['Seagate','Seagate One Touch','Seagate Expansion'] },
  { id:'br-ugreen',   name:'Ugreen',   cat:'cat-mobile-acc-charger', keywords:['Ugreen','sạc Ugreen','cáp Ugreen'] },
  { id:'br-baseus',   name:'Baseus',   cat:'cat-mobile-acc-charger', keywords:['Baseus','sạc Baseus','cáp Baseus'] },
  { id:'br-totolink', name:'TOTOLINK', cat:'cat-camera',    keywords:['TOTOLINK','Totolink N300','Totolink router'] },
  { id:'br-esr',      name:'ESR',      cat:'cat-mobile-acc-screen', keywords:['ESR','miếng dán ESR','kính ESR'] },
  { id:'br-imou',     name:'Imou',     cat:'cat-cam-indoor',keywords:['Imou','camera Imou','Imou Ranger'] },
  { id:'br-ezviz',    name:'EZVIZ',    cat:'cat-cam-indoor',keywords:['EZVIZ','camera EZVIZ','EZVIZ C6'] },
  { id:'br-tp-link',  name:'TP-Link',  cat:'cat-cam-security',keywords:['TP-Link','Tapo C200','Tapo C210','TP Link camera'] },
  { id:'br-dahua',    name:'Dahua',    cat:'cat-cam-security',keywords:['Dahua','camera Dahua','Dahua IPC'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// DATA — 34 CATEGORIES (SEED_DOCUMENTATION.md)
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  // Root
  { id:'cat-phone',                name:'Điện thoại',              kw:'điện thoại smartphone' },
  { id:'cat-tablet',               name:'Tablet',                  kw:'máy tính bảng tablet' },
  { id:'cat-laptop',               name:'Laptop',                  kw:'laptop máy tính xách tay' },
  { id:'cat-watch',                name:'Smartwatch',              kw:'đồng hồ thông minh smartwatch' },
  { id:'cat-mobile-acc',           name:'Phụ kiện di động',        kw:'phụ kiện điện thoại' },
  { id:'cat-av',                   name:'Thiết bị nghe nhìn',      kw:'thiết bị âm thanh nghe nhìn' },
  { id:'cat-laptop-acc',           name:'Phụ kiện laptop',         kw:'phụ kiện máy tính laptop' },
  { id:'cat-camera',               name:'Camera',                  kw:'camera an ninh' },
  // Sub — mobile-acc (7)
  { id:'cat-mobile-acc-case-tablet',name:'Ốp lưng máy tính bảng', kw:'ốp lưng tablet ốp lưng iPad bao da' },
  { id:'cat-mobile-acc-screen',    name:'Miếng dán màn hình',      kw:'miếng dán cường lực kính cường lực' },
  { id:'cat-mobile-acc-airpods-case',name:'Túi đựng AirPods',      kw:'túi AirPods case AirPods hộp đựng AirPods' },
  { id:'cat-mobile-acc-cam-cover', name:'Miếng dán Camera',        kw:'miếng dán camera miếng che camera' },
  { id:'cat-mobile-acc-stand',     name:'Giá đỡ điện thoại',       kw:'giá đỡ điện thoại đế điện thoại giá đỡ laptop' },
  { id:'cat-mobile-acc-charger',   name:'Sạc, cáp',               kw:'sạc nhanh cáp sạc củ sạc sạc dự phòng' },
  { id:'cat-mobile-acc-fan',       name:'Quạt mini',               kw:'quạt mini quạt cầm tay quạt gắn điện thoại' },
  // Sub — av (10)
  { id:'cat-av-bt-earphone',       name:'Tai nghe Bluetooth',      kw:'tai nghe bluetooth TWS earbuds không dây' },
  { id:'cat-av-wire-earphone',     name:'Tai nghe dây',            kw:'tai nghe dây tai nghe có dây in-ear' },
  { id:'cat-av-headphone',         name:'Tai nghe chụp tai',       kw:'tai nghe chụp tai headphone over-ear chống ồn' },
  { id:'cat-av-sport-earphone',    name:'Tai nghe thể thao',       kw:'tai nghe thể thao chạy bộ tập gym' },
  { id:'cat-av-speaker',           name:'Loa',                     kw:'loa bluetooth loa di động loa không dây' },
  { id:'cat-av-mic',               name:'Micro',                   kw:'micro thu âm microphone mic podcast' },
  { id:'cat-av-projector',         name:'Máy chiếu',               kw:'máy chiếu projector máy chiếu mini' },
  { id:'cat-av-hdd',               name:'Ổ cứng',                  kw:'ổ cứng di động HDD SSD ổ cứng 1TB' },
  { id:'cat-av-sdcard',            name:'Thẻ nhớ',                 kw:'thẻ nhớ SD card microSD thẻ nhớ 128GB' },
  { id:'cat-av-usb',               name:'USB',                     kw:'USB flash drive USB 3.0 USB 256GB' },
  // Sub — laptop-acc (6)
  { id:'cat-laptop-acc-mouse',     name:'Chuột máy tính',          kw:'chuột máy tính chuột không dây gaming mouse' },
  { id:'cat-laptop-acc-keyboard',  name:'Bàn phím',                kw:'bàn phím cơ bàn phím gaming keyboard' },
  { id:'cat-laptop-acc-bag',       name:'Balo, túi chống sốc',     kw:'balo laptop túi laptop túi chống sốc' },
  { id:'cat-laptop-acc-pouch',     name:'Túi đựng phụ kiện',       kw:'túi đựng phụ kiện túi phụ kiện' },
  { id:'cat-laptop-acc-mousepad',  name:'Miếng lót chuột',         kw:'lót chuột miếng lót chuột mousepad gaming' },
  { id:'cat-laptop-acc-drawing',   name:'Bảng vẽ điện tử',         kw:'bảng vẽ điện tử drawing tablet' },
  // Sub — camera (3)
  { id:'cat-cam-security',         name:'Camera Giám Sát',         kw:'camera giám sát camera ngoài trời camera an ninh' },
  { id:'cat-cam-indoor',           name:'Camera trong nhà',        kw:'camera trong nhà camera IP camera wifi' },
  { id:'cat-cam-doorbell',         name:'Chuông cửa Camera',       kw:'chuông cửa camera chuông thông minh doorbell' },
];

// ─────────────────────────────────────────────────────────────────────────────
// TEST CASE BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

let tcId = 0;
const makeId = (prefix) => `${prefix}-${String(++tcId).padStart(4,'0')}`;

function tc(group, desc, message, assertions = {}) {
  return { id: makeId(group), group, description: desc, message, assertions };
}

// ─── GROUP A: BRAND QUERIES (33 × 8 = 264) ───────────────────────────────────
const GROUP_A = [];
const brandCatLabel = (b) =>
  b.cat.includes('phone')   ? 'điện thoại' :
  b.cat.includes('laptop')  ? 'laptop' :
  b.cat.includes('watch')   ? 'đồng hồ' :
  b.cat.includes('speaker') ? 'loa' :
  b.cat.includes('mouse')   ? 'chuột' :
  b.cat.includes('sdcard')  ? 'thẻ nhớ' :
  b.cat.includes('hdd')     ? 'ổ cứng' :
  b.cat.includes('charger') ? 'sạc' :
  b.cat.includes('cam')     ? 'camera' : 'sản phẩm';

// Templates phân loại theo loại intent dự kiến:
//   productBrand   (strict) — bắt buộc có SP và ít nhất 1 SP đúng brand
//   softProductBrand        — nếu có SP trả về thì ít nhất 1 SP đúng brand
const brandTemplates = (b) => [
  // 0: tìm trực tiếp keyword → strict brand
  { msg: `cho mình xem ${b.keywords[0]} đi`,                assertions: { hasText:true, productBrand: b.id, minProducts: 1 } },
  // 1: tìm tên + danh mục → strict
  { msg: `tìm ${b.name} ${brandCatLabel(b)}`,               assertions: { hasText:true, productBrand: b.id, minProducts: 1 } },
  // 2: có gì → strict
  { msg: `${b.name} có những sản phẩm gì`,                  assertions: { hasText:true, productBrand: b.id, minProducts: 1 } },
  // 3: giá → có thể trả text → soft
  { msg: `${b.keywords[0]} giá bao nhiêu`,                  assertions: { hasText:true, softProductBrand: b.id } },
  // 4: giá có ngưỡng → soft
  { msg: `${b.keywords[0]||b.name} dưới 10 triệu có không`, assertions: { hasText:true, softProductBrand: b.id } },
  // 5: so sánh → COMPARE, không chắc có SP
  { msg: `so sánh ${b.name} với hãng khác`,                 assertions: { hasText:true } },
  // 6: bán chạy → strict
  { msg: `${b.name} bán chạy nhất là gì`,                   assertions: { hasText:true, productBrand: b.id, minProducts: 1 } },
  // 7: mua → soft
  { msg: `mua ${b.keywords[0]} ở đây được không`,           assertions: { hasText:true, softProductBrand: b.id } },
];
for (const b of BRANDS) {
  for (const { msg, assertions } of brandTemplates(b)) {
    GROUP_A.push(tc('BRAND', `[${b.name}] ${msg.slice(0,50)}`, msg, assertions));
  }
}


// ─── GROUP B: CATEGORY QUERIES (34 × 6 = 204) ───────────────────────────────
const GROUP_B = [];
const catTemplates = (c) => [
  `tìm ${c.kw.split(' ')[0]} cho mình`,
  `${c.kw.split(' ')[0]} nào tốt nhất`,
  `gợi ý ${c.name.toLowerCase()} tốt`,
  `${c.name.toLowerCase()} bán chạy nhất`,
  `${c.name.toLowerCase()} dưới 5 triệu`,
  `có ${c.name.toLowerCase()} mới không`,
];
for (const c of CATEGORIES) {
  for (const msg of catTemplates(c)) {
    GROUP_B.push(tc('CATEGORY', `[${c.name}] ${msg.slice(0,50)}`, msg, {
      hasText: true,
      expectedCategory: c.id,
    }));
  }
}

// ─── GROUP C: BRAND × CATEGORY COMBOS (40 pairs × 3 = 120) ──────────────────
const GROUP_C = [];
const BRAND_CAT_PAIRS = [
  // Phone brands
  ['br-apple',    'Điện thoại',     'cat-phone',             'iPhone 17'],
  ['br-samsung',  'Điện thoại',     'cat-phone',             'Samsung Galaxy S25'],
  ['br-xiaomi',   'Điện thoại',     'cat-phone',             'Redmi Note 14'],
  ['br-oppo',     'Điện thoại',     'cat-phone',             'OPPO Reno 13'],
  ['br-vivo',     'Điện thoại',     'cat-phone',             'Vivo V40'],
  ['br-realme',   'Điện thoại',     'cat-phone',             'realme 13 Pro'],
  ['br-honor',    'Điện thoại',     'cat-phone',             'HONOR X9b'],
  ['br-motorola', 'Điện thoại',     'cat-phone',             'Moto G85'],
  ['br-infinix',  'Điện thoại',     'cat-phone',             'Infinix Note 40 Pro'],
  ['br-tecno',    'Điện thoại',     'cat-phone',             'Tecno Camon 30'],
  // Tablet
  ['br-apple',    'Tablet',         'cat-tablet',            'iPad Pro M4'],
  ['br-samsung',  'Tablet',         'cat-tablet',            'Galaxy Tab S9'],
  ['br-lenovo',   'Tablet',         'cat-tablet',            'Lenovo Tab P12'],
  ['br-xiaomi',   'Tablet',         'cat-tablet',            'Xiaomi Pad 6'],
  // Laptop brands
  ['br-asus',     'Laptop',         'cat-laptop',            'ASUS ROG'],
  ['br-dell',     'Laptop',         'cat-laptop',            'Dell XPS'],
  ['br-hp',       'Laptop',         'cat-laptop',            'HP Pavilion'],
  ['br-lenovo',   'Laptop',         'cat-laptop',            'ThinkPad X1'],
  ['br-acer',     'Laptop',         'cat-laptop',            'Acer Nitro 5'],
  // Smartwatch
  ['br-apple',    'Smartwatch',     'cat-watch',             'Apple Watch Series 10'],
  ['br-samsung',  'Smartwatch',     'cat-watch',             'Galaxy Watch 7'],
  ['br-amazfit',  'Smartwatch',     'cat-watch',             'Amazfit GTR 4'],
  ['br-huawei',   'Smartwatch',     'cat-watch',             'Huawei Watch GT4'],
  // Audio
  ['br-jbl',      'Loa Bluetooth',  'cat-av-speaker',        'JBL Charge 5'],
  ['br-sony',     'Tai nghe',       'cat-av-headphone',      'Sony WH-1000XM5'],
  ['br-marshall', 'Loa',            'cat-av-speaker',        'Marshall Emberton'],
  ['br-jbl',      'Tai nghe BT',   'cat-av-bt-earphone',    'JBL Tune 235'],
  // Gaming
  ['br-razer',    'Chuột gaming',   'cat-laptop-acc-mouse',  'Razer DeathAdder'],
  ['br-razer',    'Bàn phím',       'cat-laptop-acc-keyboard','Razer BlackWidow'],
  ['br-logitech', 'Chuột',          'cat-laptop-acc-mouse',  'Logitech MX Master 3'],
  ['br-logitech', 'Bàn phím',       'cat-laptop-acc-keyboard','Logitech MX Keys'],
  // Storage
  ['br-sandisk',  'Thẻ nhớ',        'cat-av-sdcard',         'SanDisk Extreme 128GB'],
  ['br-kingston', 'USB',            'cat-av-usb',             'Kingston DataTraveler'],
  ['br-seagate',  'Ổ cứng',         'cat-av-hdd',            'Seagate One Touch'],
  // Charger
  ['br-ugreen',   'Sạc',           'cat-mobile-acc-charger', 'Ugreen Nexode'],
  ['br-baseus',   'Sạc',           'cat-mobile-acc-charger', 'Baseus GaN'],
  // Camera
  ['br-ezviz',    'Camera trong nhà','cat-cam-indoor',       'EZVIZ C6'],
  ['br-imou',     'Camera wifi',    'cat-cam-indoor',        'Imou Ranger 2'],
  ['br-dahua',    'Camera giám sát','cat-cam-security',      'Dahua IPC'],
  ['br-tp-link',  'Camera',         'cat-cam-security',      'TP-Link Tapo C200'],
];
for (const [brandId, catLabel, catId, product] of BRAND_CAT_PAIRS) {
  const brandName = BRANDS.find(b => b.id === brandId)?.name || brandId;
  GROUP_C.push(
    tc('BRAND_CAT', `${brandName}+${catLabel}: tìm sản phẩm`, `tìm ${catLabel.toLowerCase()} ${brandName}`, { hasText:true, productBrand: brandId, minProducts: 1 }),
    tc('BRAND_CAT', `${brandName}+${catLabel}: giá bao nhiêu`, `${product} giá bao nhiêu`, { hasText:true, softProductBrand: brandId }),
    tc('BRAND_CAT', `${brandName}+${catLabel}: tư vấn`, `tư vấn ${catLabel.toLowerCase()} ${brandName} cho tôi`, { hasText:true, softProductBrand: brandId }),
  );
}

// ─── GROUP D: PRICE BRACKET QUERIES (9 cat × 6 + 36 explicit = 90) ──────────
const GROUP_D = [];
const PRICE_CATS = [
  ['điện thoại', 'cat-phone'],
  ['laptop',     'cat-laptop'],
  ['máy tính bảng', 'cat-tablet'],
  ['đồng hồ thông minh', 'cat-watch'],
  ['tai nghe bluetooth', 'cat-av-bt-earphone'],
  ['tai nghe chụp tai', 'cat-av-headphone'],
  ['loa bluetooth', 'cat-av-speaker'],
  ['ổ cứng di động', 'cat-av-hdd'],
  ['camera giám sát', 'cat-cam-security'],
];
const PRICE_TEMPLATES = (cat) => [
  `${cat} dưới 5 triệu`,
  `${cat} dưới 10 triệu`,
  `${cat} dưới 15 triệu`,
  `${cat} từ 10 triệu đến 20 triệu`,
  `${cat} tầm 20 triệu`,
  `${cat} trên 30 triệu`,
];
for (const [catName, catId] of PRICE_CATS) {
  for (const msg of PRICE_TEMPLATES(catName)) {
    GROUP_D.push(tc('PRICE', `[price] ${msg}`, msg, { hasText: true, hasProducts: !['cat-cam-security'].includes(catId) }));
  }
}
// Explicit price queries
const EXPLICIT_PRICE = [
  'điện thoại từ 6 triệu đến 10 triệu',
  'điện thoại từ 13 triệu đến 20 triệu',
  'điện thoại từ 20 triệu đến 35 triệu',
  'điện thoại từ 35 triệu đến 60 triệu',
  'điện thoại khoảng 25 triệu',
  'laptop dưới 20 triệu',
  'laptop từ 20 đến 30 triệu',
  'laptop gaming tầm 25 triệu',
  'laptop văn phòng dưới 15 triệu',
  'laptop cao cấp trên 40 triệu',
  'máy tính bảng dưới 10 triệu',
  'máy tính bảng iPad giá rẻ',
  'đồng hồ thông minh dưới 3 triệu',
  'đồng hồ Apple Watch giá bao nhiêu',
  'tai nghe bluetooth dưới 500k',
  'tai nghe dưới 1 triệu',
  'tai nghe chống ồn từ 3 đến 8 triệu',
  'loa bluetooth dưới 2 triệu',
  'loa JBL tầm 3 triệu',
  'ổ cứng 1TB dưới 2 triệu',
  'thẻ nhớ 128GB giá rẻ nhất',
  'USB 256GB giá bao nhiêu',
  'chuột gaming dưới 1 triệu',
  'bàn phím cơ tầm 2 triệu',
  'chuột Logitech dưới 1.5 triệu',
  'sạc nhanh 65W giá bao nhiêu',
  'cáp sạc dưới 200k',
  'miếng dán màn hình dưới 100k',
  'camera wifi dưới 1 triệu',
  'camera giám sát dưới 500k',
  'quạt mini giá rẻ',
  'balo laptop dưới 500k',
  'mousepad gaming tầm 300k',
  'bảng vẽ điện tử dưới 3 triệu',
  'micro thu âm dưới 2 triệu',
  'máy chiếu mini dưới 5 triệu',
];
for (const msg of EXPLICIT_PRICE) {
  GROUP_D.push(tc('PRICE', `[explicit] ${msg}`, msg, { hasText: true }));
}

// ─── GROUP E: SPEC QUERIES (8 nhóm × 10 = 80) ───────────────────────────────
const GROUP_E = [];
const SPEC_QUERIES = [
  // Camera spec
  ['SPEC_CAMERA', 'điện thoại chụp ảnh đẹp nhất'],
  ['SPEC_CAMERA', 'điện thoại camera 200MP'],
  ['SPEC_CAMERA', 'điện thoại selfie tốt'],
  ['SPEC_CAMERA', 'điện thoại quay video 4K'],
  ['SPEC_CAMERA', 'iPhone chụp ảnh đẹp'],
  ['SPEC_CAMERA', 'điện thoại camera macro'],
  ['SPEC_CAMERA', 'điện thoại camera tele zoom tốt'],
  ['SPEC_CAMERA', 'Samsung camera 50MP giá tốt'],
  ['SPEC_CAMERA', 'điện thoại camera trước đẹp cho gái'],
  ['SPEC_CAMERA', 'điện thoại chụp ảnh đêm tốt'],
  // Pin/Battery spec
  ['SPEC_BATTERY', 'điện thoại pin trâu nhất'],
  ['SPEC_BATTERY', 'điện thoại pin 6000mAh'],
  ['SPEC_BATTERY', 'điện thoại sạc nhanh 120W'],
  ['SPEC_BATTERY', 'điện thoại sạc không dây'],
  ['SPEC_BATTERY', 'laptop pin 12 tiếng'],
  ['SPEC_BATTERY', 'điện thoại dùng cả ngày không hết pin'],
  ['SPEC_BATTERY', 'sạc nhanh 65W cho laptop'],
  ['SPEC_BATTERY', 'điện thoại pin lâu dưới 10 triệu'],
  ['SPEC_BATTERY', 'Samsung pin trâu'],
  ['SPEC_BATTERY', 'iPhone pin lâu'],
  // Display spec
  ['SPEC_DISPLAY', 'điện thoại màn hình OLED đẹp'],
  ['SPEC_DISPLAY', 'điện thoại màn hình 120Hz'],
  ['SPEC_DISPLAY', 'điện thoại màn hình lớn 6.7 inch'],
  ['SPEC_DISPLAY', 'laptop màn hình OLED 2K'],
  ['SPEC_DISPLAY', 'điện thoại màn hình sáng dùng ngoài trời'],
  ['SPEC_DISPLAY', 'máy tính bảng màn hình đẹp để xem phim'],
  ['SPEC_DISPLAY', 'tablet OLED 12 inch'],
  ['SPEC_DISPLAY', 'điện thoại AMOLED dưới 10 triệu'],
  ['SPEC_DISPLAY', 'laptop 15.6 inch màn hình Full HD'],
  ['SPEC_DISPLAY', 'điện thoại màn hình cong'],
  // Chip/CPU spec
  ['SPEC_CHIP', 'điện thoại chip Snapdragon 8 Gen 3'],
  ['SPEC_CHIP', 'điện thoại chip A18 Pro'],
  ['SPEC_CHIP', 'laptop chip Intel Core Ultra 7'],
  ['SPEC_CHIP', 'laptop chip AMD Ryzen 7'],
  ['SPEC_CHIP', 'điện thoại hiệu năng mạnh nhất'],
  ['SPEC_CHIP', 'điện thoại chạy mượt mà nhất'],
  ['SPEC_CHIP', 'laptop gaming chip i9'],
  ['SPEC_CHIP', 'điện thoại Dimensity 9300 giá tốt'],
  ['SPEC_CHIP', 'chip Apple M4 laptop'],
  ['SPEC_CHIP', 'laptop chip Ryzen 5 dưới 15 triệu'],
  // RAM/Storage spec
  ['SPEC_RAM', 'điện thoại 12GB RAM'],
  ['SPEC_RAM', 'điện thoại 256GB bộ nhớ'],
  ['SPEC_RAM', 'laptop 32GB RAM'],
  ['SPEC_RAM', 'laptop SSD 1TB'],
  ['SPEC_RAM', 'điện thoại 512GB giá tốt'],
  ['SPEC_RAM', 'laptop RAM 16GB i7'],
  ['SPEC_RAM', 'máy tính bảng 256GB'],
  ['SPEC_RAM', 'thẻ nhớ 256GB tốc độ cao'],
  ['SPEC_RAM', 'ổ cứng SSD 2TB'],
  ['SPEC_RAM', 'USB 512GB'],
  // Connectivity spec
  ['SPEC_CONNECT', 'điện thoại 5G dưới 10 triệu'],
  ['SPEC_CONNECT', 'điện thoại WiFi 6E'],
  ['SPEC_CONNECT', 'điện thoại Bluetooth 5.3'],
  ['SPEC_CONNECT', 'điện thoại 2 SIM 5G'],
  ['SPEC_CONNECT', 'laptop WiFi 6'],
  ['SPEC_CONNECT', 'điện thoại NFC để thanh toán'],
  ['SPEC_CONNECT', 'điện thoại USB Type-C'],
  ['SPEC_CONNECT', 'laptop Thunderbolt 4'],
  ['SPEC_CONNECT', 'điện thoại eSIM'],
  ['SPEC_CONNECT', 'tai nghe Bluetooth 5.3 latency thấp'],
  // Gaming spec
  ['SPEC_GAMING', 'điện thoại chơi game mượt'],
  ['SPEC_GAMING', 'điện thoại chơi PUBG Mobile không lag'],
  ['SPEC_GAMING', 'điện thoại gaming dưới 15 triệu'],
  ['SPEC_GAMING', 'laptop chơi game tốt'],
  ['SPEC_GAMING', 'laptop gaming RTX 4060'],
  ['SPEC_GAMING', 'điện thoại tản nhiệt tốt khi chơi game'],
  ['SPEC_GAMING', 'điện thoại FPS cao chơi game'],
  ['SPEC_GAMING', 'chuột gaming cho game thủ'],
  ['SPEC_GAMING', 'bàn phím gaming có LED'],
  ['SPEC_GAMING', 'laptop gaming dưới 25 triệu'],
  // Waterproof/Design
  ['SPEC_DESIGN', 'điện thoại chống nước IP68'],
  ['SPEC_DESIGN', 'điện thoại thiết kế đẹp mỏng nhẹ'],
  ['SPEC_DESIGN', 'điện thoại màu đẹp cho nữ'],
  ['SPEC_DESIGN', 'đồng hồ chống nước 5ATM'],
  ['SPEC_DESIGN', 'tai nghe chống nước IPX5'],
  ['SPEC_DESIGN', 'điện thoại siêu mỏng'],
  ['SPEC_DESIGN', 'laptop mỏng nhẹ dưới 1.5kg'],
  ['SPEC_DESIGN', 'điện thoại màu titan'],
  ['SPEC_DESIGN', 'điện thoại chống bụi chống nước'],
  ['SPEC_DESIGN', 'đồng hồ thể thao dày dặn'],
];
for (const [grp, msg] of SPEC_QUERIES) {
  GROUP_E.push(tc(grp, msg.slice(0,60), msg, { hasText: true }));
}

// ─── GROUP F: INTENT TESTS (15 intents × 6 = 90) ────────────────────────────
const GROUP_F = [];
const INTENT_CASES = [
  // GREETING
  ['INTENT_GREETING', 'Xin chào shop'],
  ['INTENT_GREETING', 'Hello'],
  ['INTENT_GREETING', 'Hi shop ơi'],
  ['INTENT_GREETING', 'Chào buổi sáng'],
  ['INTENT_GREETING', 'Em ơi có ai không'],
  ['INTENT_GREETING', 'Alo shop'],
  // ASK_DELIVERY
  ['INTENT_DELIVERY', 'giao hàng bao lâu'],
  ['INTENT_DELIVERY', 'phí ship bao nhiêu'],
  ['INTENT_DELIVERY', 'có giao hàng hỏa tốc không'],
  ['INTENT_DELIVERY', 'ship về tỉnh có không'],
  ['INTENT_DELIVERY', 'giao hàng miễn phí không'],
  ['INTENT_DELIVERY', 'hàng bao lâu về tới nơi'],
  // ASK_PAYMENT
  ['INTENT_PAYMENT', 'thanh toán bằng gì'],
  ['INTENT_PAYMENT', 'có trả góp không'],
  ['INTENT_PAYMENT', 'chuyển khoản được không'],
  ['INTENT_PAYMENT', 'có nhận MoMo không'],
  ['INTENT_PAYMENT', 'có nhận ZaloPay không'],
  ['INTENT_PAYMENT', 'trả góp 0% không'],
  // ASK_RETURN
  ['INTENT_RETURN', 'đổi trả như thế nào'],
  ['INTENT_RETURN', 'bảo hành bao lâu'],
  ['INTENT_RETURN', 'máy bị lỗi đổi được không'],
  ['INTENT_RETURN', 'chính sách đổi trả'],
  ['INTENT_RETURN', 'máy hỏng sau 1 tháng làm sao'],
  ['INTENT_RETURN', 'warranty 12 tháng không'],
  // ASK_PROMO
  ['INTENT_PROMO', 'có khuyến mãi không'],
  ['INTENT_PROMO', 'mã giảm giá không'],
  ['INTENT_PROMO', 'flash sale hôm nay'],
  ['INTENT_PROMO', 'voucher giảm giá'],
  ['INTENT_PROMO', 'có deal gì hot không'],
  ['INTENT_PROMO', 'coupon mua điện thoại'],
  // ASK_BEST_SELLER
  ['INTENT_BESTSELLER', 'điện thoại bán chạy nhất'],
  ['INTENT_BESTSELLER', 'laptop nhiều người mua nhất'],
  ['INTENT_BESTSELLER', 'sản phẩm hot nhất tháng này'],
  ['INTENT_BESTSELLER', 'bestseller của shop là gì'],
  ['INTENT_BESTSELLER', 'tai nghe nào đang hot'],
  ['INTENT_BESTSELLER', 'đồng hồ phổ biến nhất'],
  // ASK_NEW_ARRIVAL
  ['INTENT_NEW', 'hàng mới về gì'],
  ['INTENT_NEW', 'điện thoại mới nhất 2025'],
  ['INTENT_NEW', 'sản phẩm vừa ra mắt'],
  ['INTENT_NEW', 'laptop mới nhất của Asus'],
  ['INTENT_NEW', 'iPhone mới nhất là gì'],
  ['INTENT_NEW', 'Samsung Galaxy mới ra'],
  // CHECK_STOCK
  ['INTENT_STOCK', 'iPhone 17 còn hàng không'],
  ['INTENT_STOCK', 'Samsung Galaxy S25 còn không'],
  ['INTENT_STOCK', 'sản phẩm này còn không'],
  ['INTENT_STOCK', 'laptop Dell còn mấy cái'],
  ['INTENT_STOCK', 'còn hàng không'],
  ['INTENT_STOCK', 'AirPods Pro còn hàng không'],
  // TRACK_ORDER
  ['INTENT_ORDER', 'đơn hàng của tôi đâu rồi'],
  ['INTENT_ORDER', 'theo dõi đơn hàng'],
  ['INTENT_ORDER', 'kiểm tra đơn hàng'],
  ['INTENT_ORDER', 'order chưa về'],
  ['INTENT_ORDER', 'đơn hàng đang ở đâu'],
  ['INTENT_ORDER', 'khi nào nhận được hàng'],
  // CANCEL_ORDER
  ['INTENT_CANCEL', 'hủy đơn hàng'],
  ['INTENT_CANCEL', 'cancel order'],
  ['INTENT_CANCEL', 'không muốn mua nữa'],
  ['INTENT_CANCEL', 'hủy đơn giúp tôi'],
  ['INTENT_CANCEL', 'tôi muốn hủy'],
  ['INTENT_CANCEL', 'hủy mua'],
  // PRICE_COMPLAINT
  ['INTENT_PRICE_COMPLAINT', 'giá cao quá'],
  ['INTENT_PRICE_COMPLAINT', 'bớt được không'],
  ['INTENT_PRICE_COMPLAINT', 'đắt quá giảm đi'],
  ['INTENT_PRICE_COMPLAINT', 'chỗ khác rẻ hơn'],
  ['INTENT_PRICE_COMPLAINT', 'giá này mắc lắm'],
  ['INTENT_PRICE_COMPLAINT', 'thương lượng giá không'],
  // CONTACT
  ['INTENT_CONTACT', 'địa chỉ shop ở đâu'],
  ['INTENT_CONTACT', 'hotline của shop'],
  ['INTENT_CONTACT', 'liên hệ shop như thế nào'],
  ['INTENT_CONTACT', 'số điện thoại shop'],
  ['INTENT_CONTACT', 'facebook shop'],
  ['INTENT_CONTACT', 'zalo shop'],
  // ASK_RECOMMEND
  ['INTENT_RECOMMEND', 'tư vấn cho tôi điện thoại tốt'],
  ['INTENT_RECOMMEND', 'nên mua gì'],
  ['INTENT_RECOMMEND', 'laptop nào phù hợp sinh viên'],
  ['INTENT_RECOMMEND', 'giới thiệu tai nghe tốt'],
  ['INTENT_RECOMMEND', 'chọn điện thoại nào'],
  ['INTENT_RECOMMEND', 'tư vấn chọn máy'],
  // BULK_ORDER
  ['INTENT_BULK', 'mua số lượng lớn được giảm không'],
  ['INTENT_BULK', 'mua sỉ có giá đặc biệt không'],
  ['INTENT_BULK', 'order 50 cái giá sao'],
  ['INTENT_BULK', 'mua nhiều giảm thêm không'],
  ['INTENT_BULK', 'giá sỉ là bao nhiêu'],
  ['INTENT_BULK', 'mua cho công ty 100 máy'],
  // FEEDBACK_POSITIVE
  ['INTENT_FEEDBACK', 'shop tư vấn rất tốt'],
  ['INTENT_FEEDBACK', 'cảm ơn shop'],
  ['INTENT_FEEDBACK', 'shop thật sự pro'],
  ['INTENT_FEEDBACK', 'hài lòng với dịch vụ'],
  ['INTENT_FEEDBACK', 'shop nhanh và nhiệt tình'],
  ['INTENT_FEEDBACK', '5 sao cho shop'],
];
for (const [grp, msg] of INTENT_CASES) {
  GROUP_F.push(tc(grp, msg.slice(0,60), msg, { hasText: true }));
}

// ─── GROUP G: COMPARE QUERIES (20 pairs × 2 = 40) ───────────────────────────
const GROUP_G = [];
const COMPARE_PAIRS = [
  ['iPhone 17', 'Samsung Galaxy S25'],
  ['iPhone 17 Pro', 'Samsung Galaxy S25 Ultra'],
  ['Redmi Note 14', 'OPPO Reno 13'],
  ['Xiaomi 15', 'OPPO Find X8'],
  ['vivo V40', 'realme 13 Pro'],
  ['Asus ROG', 'Lenovo Legion'],
  ['Dell XPS', 'MacBook Pro'],
  ['HP Pavilion', 'Acer Aspire 5'],
  ['Apple Watch', 'Samsung Galaxy Watch'],
  ['Amazfit GTR 4', 'Huawei Watch GT4'],
  ['Sony WH-1000XM5', 'JBL Tour One M2'],
  ['Logitech MX Master 3', 'Razer DeathAdder V3'],
  ['SanDisk Extreme', 'Kingston Canvas Go'],
  ['JBL Flip 6', 'Marshall Emberton'],
  ['EZVIZ C6', 'Imou Ranger 2'],
  ['Razer BlackWidow', 'Logitech MX Keys'],
  ['Ugreen GaN', 'Baseus GaN'],
  ['Seagate One Touch', 'WD My Passport'],
  ['Dahua IPC', 'Tapo C200'],
  ['OPPO Reno 13', 'vivo V40'],
];
for (const [p1, p2] of COMPARE_PAIRS) {
  GROUP_G.push(
    tc('COMPARE', `so sánh ${p1} vs ${p2}`, `so sánh ${p1} với ${p2}`, { hasText: true }),
    tc('COMPARE', `${p1} hay ${p2} tốt hơn`, `${p1} hay ${p2} tốt hơn`, { hasText: true }),
  );
}

// ─── GROUP H: BUDGET COMBOS (brand + budget = 60) ───────────────────────────
const GROUP_H = [];
const BUDGET_COMBOS = [
  ['iPhone tầm 20 triệu', 'br-apple'],
  ['Samsung 10 triệu', 'br-samsung'],
  ['Xiaomi dưới 8 triệu', 'br-xiaomi'],
  ['OPPO dưới 12 triệu', 'br-oppo'],
  ['realme dưới 6 triệu', 'br-realme'],
  ['Asus laptop dưới 20 triệu', 'br-asus'],
  ['Dell laptop tầm 25 triệu', 'br-dell'],
  ['HP laptop dưới 15 triệu', 'br-hp'],
  ['Lenovo laptop sinh viên 15 triệu', 'br-lenovo'],
  ['Acer laptop gaming 20 triệu', 'br-acer'],
  ['JBL loa dưới 2 triệu', 'br-jbl'],
  ['Sony tai nghe dưới 5 triệu', 'br-sony'],
  ['Logitech chuột dưới 1 triệu', 'br-logitech'],
  ['Razer chuột dưới 1.5 triệu', 'br-razer'],
  ['SanDisk thẻ nhớ dưới 300k', 'br-sandisk'],
  ['Amazfit đồng hồ dưới 3 triệu', 'br-amazfit'],
  ['Huawei đồng hồ dưới 5 triệu', 'br-huawei'],
  ['EZVIZ camera dưới 1 triệu', 'br-ezviz'],
  ['Baseus sạc dưới 300k', 'br-baseus'],
  ['Seagate ổ cứng dưới 1.5 triệu', 'br-seagate'],
  // Additional combos
  ['điện thoại Samsung tầm 7 triệu', 'br-samsung'],
  ['iPhone 11 giá bao nhiêu', 'br-apple'],
  ['Xiaomi Redmi Note giá rẻ nhất', 'br-xiaomi'],
  ['OPPO A series dưới 8 triệu', 'br-oppo'],
  ['Vivo Y series dưới 5 triệu', 'br-vivo'],
  ['HONOR điện thoại tầm 6 triệu', 'br-honor'],
  ['Motorola dưới 5 triệu', 'br-motorola'],
  ['Infinix điện thoại rẻ', 'br-infinix'],
  ['TECNO điện thoại giá sinh viên', 'br-tecno'],
  ['Asus ZenBook dưới 18 triệu', 'br-asus'],
  ['Dell Inspiron 15 giá', 'br-dell'],
  ['HP Victus gaming 20 triệu', 'br-hp'],
  ['Lenovo IdeaPad dưới 12 triệu', 'br-lenovo'],
  ['Acer Aspire 5 giá bao nhiêu', 'br-acer'],
  ['Marshall loa tầm 3 triệu', 'br-marshall'],
  ['Kingston USB 128GB giá', 'br-kingston'],
  ['Seagate 2TB giá bao nhiêu', 'br-seagate'],
  ['Ugreen sạc 65W giá', 'br-ugreen'],
  ['Imou camera giá rẻ', 'br-imou'],
  ['Dahua camera dưới 1 triệu', 'br-dahua'],
  ['TP-Link Tapo C200 giá', 'br-tp-link'],
  ['ESR miếng dán giá', 'br-esr'],
  ['TOTOLINK router giá', 'br-totolink'],
  ['JBL Charge 5 giá bao nhiêu', 'br-jbl'],
  ['Sony WH-1000XM5 giá bao nhiêu', 'br-sony'],
  ['Razer DeathAdder V3 giá', 'br-razer'],
  ['Logitech MX Master 3 giá', 'br-logitech'],
  ['SanDisk Extreme 128GB giá', 'br-sandisk'],
  ['Amazfit GTR 4 giá', 'br-amazfit'],
  ['Huawei Watch GT4 giá', 'br-huawei'],
];
for (const [msg, brandId] of BUDGET_COMBOS) {
  GROUP_H.push(tc('BUDGET', msg.slice(0,60), msg, { hasText: true, expectedBrand: brandId }));
}

// ─── GROUP I: SPECIFIC PRODUCT QUERIES (50) ──────────────────────────────────
const GROUP_I = [
  tc('SPECIFIC', 'iPhone 17 Pro Max giá bao nhiêu',       'iPhone 17 Pro Max giá bao nhiêu', {hasText:true}),
  tc('SPECIFIC', 'iPhone 17 Pro giá',                      'cho xem iPhone 17 Pro', {hasText:true}),
  tc('SPECIFIC', 'iPhone 16 256GB bao nhiêu',              'iPhone 16 256GB giá bao nhiêu', {hasText:true}),
  tc('SPECIFIC', 'Samsung Galaxy S25 Ultra',               'Samsung Galaxy S25 Ultra bán không', {hasText:true}),
  tc('SPECIFIC', 'Samsung Galaxy S25',                     'tìm Samsung Galaxy S25', {hasText:true}),
  tc('SPECIFIC', 'Galaxy Z Fold 6',                        'Galaxy Z Fold 6 có không', {hasText:true}),
  tc('SPECIFIC', 'Xiaomi 15 Pro',                          'Xiaomi 15 Pro cấu hình', {hasText:true}),
  tc('SPECIFIC', 'Redmi Note 14 Pro',                      'Redmi Note 14 Pro mua ở đây không', {hasText:true}),
  tc('SPECIFIC', 'OPPO Find X8 Pro',                       'OPPO Find X8 Pro có bán không', {hasText:true}),
  tc('SPECIFIC', 'OPPO Reno 13 Series',                    'OPPO Reno 13 giá', {hasText:true}),
  tc('SPECIFIC', 'Asus ROG Strix G16',                     'Asus ROG Strix G16 2025 giá', {hasText:true}),
  tc('SPECIFIC', 'Dell XPS 15 giá',                        'Dell XPS 15 giá bao nhiêu', {hasText:true}),
  tc('SPECIFIC', 'HP Omen 16 gaming',                      'HP Omen 16 cấu hình', {hasText:true}),
  tc('SPECIFIC', 'Lenovo Legion 5 Pro',                    'Lenovo Legion 5 Pro giá', {hasText:true}),
  tc('SPECIFIC', 'Acer Nitro 5 2024',                      'Acer Nitro 5 2024 bao nhiêu', {hasText:true}),
  tc('SPECIFIC', 'MacBook Pro M4',                         'MacBook Pro M4 giá bao nhiêu', {hasText:true}),
  tc('SPECIFIC', 'Apple Watch Series 10',                  'Apple Watch Series 10 bán không', {hasText:true}),
  tc('SPECIFIC', 'Galaxy Watch 7',                         'Samsung Galaxy Watch 7 giá', {hasText:true}),
  tc('SPECIFIC', 'Amazfit GTR 4',                          'Amazfit GTR 4 có bán không', {hasText:true}),
  tc('SPECIFIC', 'Huawei Watch GT4',                       'Huawei Watch GT4 giá bao nhiêu', {hasText:true}),
  tc('SPECIFIC', 'AirPods Pro 3',                          'AirPods Pro 3 giá bao nhiêu', {hasText:true}),
  tc('SPECIFIC', 'Samsung Galaxy Buds3 Pro',               'Galaxy Buds3 Pro giá', {hasText:true}),
  tc('SPECIFIC', 'Sony WH-1000XM5',                        'Sony WH-1000XM5 có bán không', {hasText:true}),
  tc('SPECIFIC', 'JBL Flip 7',                             'JBL Flip 7 giá bao nhiêu', {hasText:true}),
  tc('SPECIFIC', 'JBL Charge 5',                           'JBL Charge 5 bao nhiêu tiền', {hasText:true}),
  tc('SPECIFIC', 'Marshall Emberton III',                  'Marshall Emberton III giá', {hasText:true}),
  tc('SPECIFIC', 'Logitech MX Master 3S',                  'Logitech MX Master 3S giá', {hasText:true}),
  tc('SPECIFIC', 'Razer DeathAdder V3',                    'Razer DeathAdder V3 Pro giá', {hasText:true}),
  tc('SPECIFIC', 'SanDisk Extreme 128GB',                  'SanDisk Extreme 128GB bao nhiêu', {hasText:true}),
  tc('SPECIFIC', 'Seagate One Touch 2TB',                  'Seagate One Touch 2TB giá', {hasText:true}),
  tc('SPECIFIC', 'EZVIZ C6 camera',                        'EZVIZ C6 camera trong nhà giá', {hasText:true}),
  tc('SPECIFIC', 'Imou Ranger 2C',                         'Imou Ranger 2C có không', {hasText:true}),
  tc('SPECIFIC', 'TP-Link Tapo C200',                      'Tapo C200 giá bao nhiêu', {hasText:true}),
  tc('SPECIFIC', 'Dahua IPC camera',                       'camera Dahua giá bao nhiêu', {hasText:true}),
  tc('SPECIFIC', 'Ugreen Nexode 65W',                      'Ugreen Nexode 65W giá', {hasText:true}),
  tc('SPECIFIC', 'Baseus GaN 100W',                        'Baseus GaN 100W giá', {hasText:true}),
  tc('SPECIFIC', 'iPad Pro M4 13 inch',                    'iPad Pro M4 13 inch giá', {hasText:true}),
  tc('SPECIFIC', 'Samsung Galaxy Tab S9 Ultra',            'Galaxy Tab S9 Ultra có bán không', {hasText:true}),
  tc('SPECIFIC', 'Lenovo Tab P12 Pro',                     'Lenovo Tab P12 Pro giá', {hasText:true}),
  tc('SPECIFIC', 'Xiaomi Pad 7',                           'Xiaomi Pad 7 giá bao nhiêu', {hasText:true}),
  tc('SPECIFIC', 'HONOR tablet',                           'máy tính bảng HONOR có không', {hasText:true}),
  tc('SPECIFIC', 'Infinix Note 40 Pro',                    'Infinix Note 40 Pro giá', {hasText:true}),
  tc('SPECIFIC', 'TECNO Camon 30',                         'TECNO Camon 30 giá bao nhiêu', {hasText:true}),
  tc('SPECIFIC', 'Kingston DataTraveler USB',              'Kingston DataTraveler 256GB giá', {hasText:true}),
  tc('SPECIFIC', 'ESR miếng dán iPhone',                   'ESR miếng dán cho iPhone 17 giá', {hasText:true}),
  tc('SPECIFIC', 'balo Tomtoc laptop',                     'balo laptop chống sốc giá dưới 500k', {hasText:true}),
  tc('SPECIFIC', 'mousepad gaming lớn',                    'mousepad gaming XL giá bao nhiêu', {hasText:true}),
  tc('SPECIFIC', 'bảng vẽ Wacom',                          'bảng vẽ điện tử tốt nhất', {hasText:true}),
  tc('SPECIFIC', 'micro Blue Yeti',                        'micro thu âm podcast tốt', {hasText:true}),
  tc('SPECIFIC', 'máy chiếu mini Xiaomi',                  'máy chiếu mini dưới 3 triệu', {hasText:true}),
];

// ─── GROUP J: EDGE / ADVERSARIAL CASES (40) ──────────────────────────────────
const GROUP_J = [
  // Empty / near-empty — server có thể trả 400 cho input rỗng/vô nghĩa (đúng)
  tc('EDGE', 'Tin nhắn rỗng', ' ', { allow400: true }),
  tc('EDGE', 'Chỉ dấu chấm than', '!!!', { allow400: true }),
  tc('EDGE', 'Chỉ số', '123', { hasText: true }),
  tc('EDGE', 'Tiếng Anh thuần', 'I want to buy a smartphone', { hasText: true }),
  tc('EDGE', 'Tiếng Trung', '我要买手机', { hasText: true }),
  tc('EDGE', 'Emoji only', '📱💻⌚', { hasText: true }),
  tc('EDGE', 'Câu rất dài', 'tôi đang muốn mua một chiếc điện thoại tầm giá từ 15 đến 20 triệu đồng, có camera tốt để chụp ảnh đẹp, pin lâu khoảng 5000mAh, chạy 5G, màn hình AMOLED 120Hz, chip Snapdragon 8 thế hệ mới nhất, RAM 12GB, bộ nhớ trong 256GB, thiết kế mỏng nhẹ dưới 200 gram, màu đen hoặc xám, hãng Samsung hoặc Xiaomi, anh ơi em có gợi ý không', { hasText: true }),
  tc('EDGE', 'Typo brand Apple', 'iphon 17 pro max bao nhieu', { hasText: true }),
  tc('EDGE', 'Typo brand Samsung', 'samung s25 ultra', { hasText: true }),
  tc('EDGE', 'Viết tắt common', 'dt samsung 15tr', { hasText: true }),
  // Out of scope
  tc('EDGE', 'Hỏi về thực phẩm', 'bán đồ ăn không', { hasText: true }),
  tc('EDGE', 'Hỏi về xe cộ', 'xe máy Honda giá bao nhiêu', { hasText: true }),
  tc('EDGE', 'Hỏi về quần áo', 'áo thun Nike giá', { hasText: true }),
  tc('EDGE', 'Hỏi thời tiết', 'thời tiết hôm nay thế nào', { hasText: true }),
  tc('EDGE', 'Hỏi toán học', '2 + 2 = ?', { hasText: true }),
  tc('EDGE', 'Hỏi lịch sử', 'thế chiến 2 bắt đầu năm nào', { hasText: true }),
  tc('EDGE', 'Câu phủ định sản phẩm', 'tôi không muốn mua iPhone', { hasText: true }),
  tc('EDGE', 'Tên người không liên quan', 'Nguyễn Văn A là ai', { hasText: true }),
  tc('EDGE', 'URL trong câu hỏi', 'tìm sản phẩm tại https://example.com', { hasText: true }),
  tc('EDGE', 'Trộn Anh-Việt', 'tôi muốn buy iPhone 17 Pro Max bao nhiêu tiền', { hasText: true }),
  // Security — server có thể sanitize và trả về 400 hoặc xử lý an toàn
  tc('EDGE', 'SQL injection attempt', "'; DROP TABLE Product; --", { allow400: true }),
  tc('EDGE', 'Script tag', '<script>alert(1)</script>', { allow400: true }),
  tc('EDGE', 'XSS attempt', '"><img src=x onerror=alert(1)>', { allow400: true }),
  // Repeated queries
  tc('EDGE', 'Lặp lại 3 lần iPhone', 'iPhone iPhone iPhone', { hasText: true }),
  tc('EDGE', 'Câu hỏi ngược', 'không mua Samsung thì mua gì', { hasText: true }),
  // Very specific niche
  tc('EDGE', 'Sản phẩm ngừng sản xuất', 'iPhone 6 có không', { hasText: true }),
  tc('EDGE', 'Sản phẩm chưa ra mắt', 'iPhone 20 giá bao nhiêu', { hasText: true }),
  tc('EDGE', 'Hỏi về màu không tồn tại', 'iPhone màu hồng tím không', { hasText: true }),
  tc('EDGE', 'Hỏi đặt hàng', 'đặt hàng iPhone 17 được không', { hasText: true }),
  tc('EDGE', 'Hỏi kiểm tra đơn + sản phẩm', 'đơn mua iPhone của tôi đâu rồi', { hasText: true }),
  // Price edge cases
  tc('EDGE', 'Giá 0 đồng', 'có điện thoại nào miễn phí không', { hasText: true }),
  tc('EDGE', 'Giá rất cao', 'điện thoại 1 tỷ có không', { hasText: true }),
  tc('EDGE', 'Dải giá ngược', 'từ 30 triệu đến 5 triệu', { hasText: true }),
  tc('EDGE', 'Đơn vị không chuẩn', 'laptop tầm 20 đô', { hasText: true }),
  tc('EDGE', 'Giá k (1000)', 'tai nghe 500k có không', { hasText: true }),
  tc('EDGE', 'Số lượng mua', 'mua 3 cái iPhone 17', { hasText: true }),
  tc('EDGE', 'Địa chỉ trong câu hỏi', 'mua điện thoại giao về quận 7', { hasText: true }),
  tc('EDGE', 'Hỏi thông tin cá nhân', 'ai là chủ shop này', { hasText: true }),
  tc('EDGE', 'Câu hỏi ngắn nhất có nghĩa', 'mua gì tốt', { hasText: true }),
];

// ─── GROUP K: SUB-CATEGORY SPECIFICS (30) ────────────────────────────────────
const GROUP_K = [
  tc('SUBCAT', 'ốp lưng iPad Air', 'ốp lưng cho iPad Air M3', {hasText:true}),
  tc('SUBCAT', 'bao da Samsung Tab S9', 'bao da Samsung Galaxy Tab S9', {hasText:true}),
  tc('SUBCAT', 'cường lực iPhone 17', 'miếng dán cường lực cho iPhone 17', {hasText:true}),
  tc('SUBCAT', 'cường lực Samsung', 'kính cường lực Galaxy S25', {hasText:true}),
  tc('SUBCAT', 'túi AirPods Pro', 'túi đựng AirPods Pro 3', {hasText:true}),
  tc('SUBCAT', 'miếng dán camera', 'miếng dán camera iPhone 17 Pro', {hasText:true}),
  tc('SUBCAT', 'giá đỡ laptop bàn', 'giá đỡ laptop để bàn', {hasText:true}),
  tc('SUBCAT', 'giá đỡ điện thoại xe', 'giá đỡ điện thoại trên xe', {hasText:true}),
  tc('SUBCAT', 'sạc 45W Samsung', 'sạc nhanh 45W cho Samsung', {hasText:true}),
  tc('SUBCAT', 'cáp USB-C 1m', 'cáp USB-C 1 mét sạc nhanh', {hasText:true}),
  tc('SUBCAT', 'quạt mini làm mát điện thoại', 'quạt mini làm mát gắn sau điện thoại', {hasText:true}),
  tc('SUBCAT', 'tai nghe nhét tai bluetooth', 'tai nghe nhét tai bluetooth TWS', {hasText:true}),
  tc('SUBCAT', 'tai nghe sport Samsung', 'tai nghe thể thao Samsung', {hasText:true}),
  tc('SUBCAT', 'tai nghe dây 3.5mm', 'tai nghe dây jack 3.5mm', {hasText:true}),
  tc('SUBCAT', 'loa di động mini', 'loa bluetooth nhỏ gọn bỏ túi', {hasText:true}),
  tc('SUBCAT', 'micro streaming', 'micro cho streamer youtube', {hasText:true}),
  tc('SUBCAT', 'micro karaoke bluetooth', 'mic không dây để hát', {hasText:true}),
  tc('SUBCAT', 'máy chiếu phòng ngủ', 'máy chiếu mini cho phòng ngủ', {hasText:true}),
  tc('SUBCAT', 'ổ cứng di động 2TB', 'ổ cứng di động 2TB giá', {hasText:true}),
  tc('SUBCAT', 'thẻ nhớ 64GB', 'thẻ nhớ 64GB cho máy ảnh', {hasText:true}),
  tc('SUBCAT', 'USB 3.2 tốc độ cao', 'USB 3.2 256GB tốc độ cao', {hasText:true}),
  tc('SUBCAT', 'chuột không dây văn phòng', 'chuột không dây cho văn phòng', {hasText:true}),
  tc('SUBCAT', 'bàn phím tenkeyless', 'bàn phím cơ tenkeyless đẹp', {hasText:true}),
  tc('SUBCAT', 'balo chống nước 15.6', 'balo laptop 15.6 chống nước', {hasText:true}),
  tc('SUBCAT', 'túi đựng chuột sạc', 'túi đựng phụ kiện chuột sạc cáp', {hasText:true}),
  tc('SUBCAT', 'lót chuột dài rộng', 'lót chuột XXL cỡ lớn', {hasText:true}),
  tc('SUBCAT', 'bảng vẽ A4', 'bảng vẽ điện tử A4 cho thiết kế', {hasText:true}),
  tc('SUBCAT', 'camera cửa hàng', 'camera giám sát cho cửa hàng', {hasText:true}),
  tc('SUBCAT', 'camera chuông cửa', 'chuông cửa camera thông minh', {hasText:true}),
  tc('SUBCAT', 'camera wifi trong nhà pet', 'camera trong nhà trông thú cưng', {hasText:true}),
];

// ─── GROUP L: MULTI-ATTRIBUTE QUERIES (50) ───────────────────────────────────
const GROUP_L = [
  tc('MULTI', 'iPhone pin lâu camera tốt', 'iPhone nào vừa pin lâu vừa camera đẹp', {hasText:true}),
  tc('MULTI', 'Samsung gaming 5G dưới 15tr', 'Samsung gaming 5G dưới 15 triệu', {hasText:true}),
  tc('MULTI', 'laptop sinh viên mỏng nhẹ 15tr', 'laptop cho sinh viên mỏng nhẹ dưới 15 triệu', {hasText:true}),
  tc('MULTI', 'laptop gaming RTX 4060 30tr', 'laptop gaming RTX 4060 tầm 30 triệu', {hasText:true}),
  tc('MULTI', 'tablet vẽ 8tr', 'máy tính bảng dùng để vẽ dưới 8 triệu', {hasText:true}),
  tc('MULTI', 'đồng hồ thể thao GPS 5tr', 'đồng hồ thông minh có GPS theo dõi thể thao dưới 5 triệu', {hasText:true}),
  tc('MULTI', 'tai nghe ANC dưới 3tr', 'tai nghe chụp tai chống ồn ANC dưới 3 triệu', {hasText:true}),
  tc('MULTI', 'tai nghe TWS pin lâu', 'tai nghe bluetooth TWS pin lâu dưới 1.5 triệu', {hasText:true}),
  tc('MULTI', 'loa ngoài trời chống nước', 'loa bluetooth chống nước đi biển', {hasText:true}),
  tc('MULTI', 'chuột gaming nhẹ dưới 1tr', 'chuột gaming nhẹ dưới 700g dưới 1 triệu', {hasText:true}),
  tc('MULTI', 'bàn phím cơ RGB dưới 2tr', 'bàn phím cơ có đèn RGB dưới 2 triệu', {hasText:true}),
  tc('MULTI', 'điện thoại nữ đẹp 10tr', 'điện thoại cho nữ thiết kế đẹp tầm 10 triệu', {hasText:true}),
  tc('MULTI', 'điện thoại cao tuổi pin lâu', 'điện thoại cho người cao tuổi pin lâu dễ dùng', {hasText:true}),
  tc('MULTI', 'điện thoại học sinh 5tr', 'điện thoại cho học sinh dưới 5 triệu', {hasText:true}),
  tc('MULTI', 'iPhone dùng chụp ảnh đêm', 'iPhone nào chụp ảnh đêm đẹp nhất', {hasText:true}),
  tc('MULTI', 'Samsung chống nước IP68', 'Samsung chống nước IP68 tầm 12 triệu', {hasText:true}),
  tc('MULTI', 'điện thoại 2 sim 5G camera tốt', 'điện thoại 2 SIM 5G camera tốt dưới 8 triệu', {hasText:true}),
  tc('MULTI', 'laptop RAM 16 SSD 512 i7', 'laptop RAM 16GB SSD 512GB chip Intel Core i7', {hasText:true}),
  tc('MULTI', 'laptop văn phòng Excel Powerpoint', 'laptop văn phòng dùng Excel Word Powerpoint', {hasText:true}),
  tc('MULTI', 'laptop kỹ sư lập trình', 'laptop cho kỹ sư lập trình RAM 16GB', {hasText:true}),
  tc('MULTI', 'tablet xem phim ổn định', 'tablet xem phim màn hình đẹp pin lâu', {hasText:true}),
  tc('MULTI', 'tablet học online con', 'máy tính bảng cho con học online dưới 6 triệu', {hasText:true}),
  tc('MULTI', 'tai nghe thể thao chống nước gym', 'tai nghe tập gym chống nước không dây', {hasText:true}),
  tc('MULTI', 'micro podcast chuyên nghiệp', 'micro thu âm podcast chuyên nghiệp dưới 3 triệu', {hasText:true}),
  tc('MULTI', 'ổ cứng backup dữ liệu 1TB', 'ổ cứng di động để backup dữ liệu 1TB tốt nhất', {hasText:true}),
  tc('MULTI', 'thẻ nhớ tốc độ cao máy ảnh', 'thẻ nhớ tốc độ cao 128GB cho máy ảnh mirrorless', {hasText:true}),
  tc('MULTI', 'camera wifi góc rộng trong nhà', 'camera wifi góc rộng 160 độ trong nhà', {hasText:true}),
  tc('MULTI', 'camera ngoài trời chống nước IP66', 'camera ngoài trời chống nước IP66 full HD', {hasText:true}),
  tc('MULTI', 'sạc GaN 65W nhỏ gọn', 'sạc GaN 65W nhỏ gọn cho laptop', {hasText:true}),
  tc('MULTI', 'balo laptop 15.6 chống nước giá rẻ', 'balo laptop 15.6 inch chống nước giá rẻ', {hasText:true}),
  tc('MULTI', 'điện thoại dưới 30tr high-end', 'điện thoại cao cấp dưới 30 triệu flagship', {hasText:true}),
  tc('MULTI', 'điện thoại tầm trung tốt nhất 2025', 'điện thoại tầm trung tốt nhất 2025', {hasText:true}),
  tc('MULTI', 'điện thoại chơi game và làm việc', 'điện thoại vừa chơi game vừa làm việc tốt', {hasText:true}),
  tc('MULTI', 'laptop dưới 10tr học sinh', 'laptop dưới 10 triệu dùng học tốt', {hasText:true}),
  tc('MULTI', 'tai nghe BT không lag gaming', 'tai nghe bluetooth latency thấp không lag khi gaming', {hasText:true}),
  tc('MULTI', 'loa karaoke mini bluetooth', 'loa karaoke mini có thể cắm mic bluetooth', {hasText:true}),
  tc('MULTI', 'đồng hồ đo nhịp tim SpO2', 'đồng hồ thông minh đo nhịp tim SpO2 dưới 2 triệu', {hasText:true}),
  tc('MULTI', 'máy chiếu kết nối điện thoại', 'máy chiếu mini kết nối điện thoại xem phim', {hasText:true}),
  tc('MULTI', 'Samsung tốt hơn Xiaomi tầm 8 triệu', 'Samsung hay Xiaomi tốt hơn tầm 8 triệu', {hasText:true}),
  tc('MULTI', 'iPhone vs Android camera 2025', 'iPhone hay Android chụp ảnh đẹp hơn 2025', {hasText:true}),
  tc('MULTI', 'Asus hay Dell laptop 20tr', 'Asus hay Dell tốt hơn tầm 20 triệu', {hasText:true}),
  tc('MULTI', 'Sony hay JBL tai nghe chụp tai', 'Sony hay JBL chụp tai tốt hơn', {hasText:true}),
  tc('MULTI', 'Razer hay Logitech chuột gaming', 'Razer hay Logitech chuột gaming tốt hơn', {hasText:true}),
  tc('MULTI', 'EZVIZ hay Imou camera nhà', 'EZVIZ hay Imou camera trong nhà tốt hơn', {hasText:true}),
  tc('MULTI', 'điện thoại Snapdragon 8 Elite', 'điện thoại dùng chip Snapdragon 8 Elite', {hasText:true}),
  tc('MULTI', 'laptop AMD Ryzen 7 gaming', 'laptop AMD Ryzen 7 chơi game tốt', {hasText:true}),
  tc('MULTI', 'tablet Android tốt nhất thay thế iPad', 'tablet Android có thể thay thế iPad dưới 8 triệu', {hasText:true}),
  tc('MULTI', 'loa soundbar giá rẻ', 'loa soundbar xem phim tivi giá rẻ nhất', {hasText:true}),
  tc('MULTI', 'USB-C hub cho MacBook', 'hub USB-C nhiều cổng cho MacBook', {hasText:true}),
  tc('MULTI', 'ổ cứng NVMe M.2 laptop', 'ổ cứng NVMe M.2 nâng cấp laptop 1TB', {hasText:true}),
];

// ─────────────────────────────────────────────────────────────────────────────
// ASSEMBLE ALL TEST CASES
// ─────────────────────────────────────────────────────────────────────────────
const ALL_TEST_CASES = [
  ...GROUP_A,
  ...GROUP_B,
  ...GROUP_C,
  ...GROUP_D,
  ...GROUP_E,
  ...GROUP_F,
  ...GROUP_G,
  ...GROUP_H,
  ...GROUP_I,
  ...GROUP_J,
  ...GROUP_K,
  ...GROUP_L,
];

const FILTERED = ONLY_GROUP
  ? ALL_TEST_CASES.filter(t => t.group.toUpperCase().startsWith(ONLY_GROUP.toUpperCase()))
  : ALL_TEST_CASES;

// ─────────────────────────────────────────────────────────────────────────────
// TEST RUNNER
// ─────────────────────────────────────────────────────────────────────────────
async function runTest(tc) {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: tc.message, history: [] }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const ms = Date.now() - start;
    const data = await res.json().catch(() => ({}));

    const failures = [];
    // allow400: câu hỏi rỗng/vô nghĩa → server trả 400 là đúng
    if (tc.assertions.allow400) {
      if (res.status >= 500) failures.push(`Unexpected server error HTTP ${res.status}`);
    } else {
      if (!res.ok)                         failures.push(`HTTP ${res.status}`);
      if (!data.text || !data.text.trim()) failures.push('Empty response text');
    }
    // minProducts: yêu cầu ít nhất N sản phẩm
    if (tc.assertions.minProducts) {
      const count = data.products?.length || 0;
      if (count < tc.assertions.minProducts)
        failures.push(`Expected >= ${tc.assertions.minProducts} products, got ${count}`);
    }
    // productBrand (strict): có SP và ít nhất 1 SP đúng brand
    if (tc.assertions.productBrand) {
      const prods = data.products || [];
      if (prods.length === 0) {
        failures.push(`[brand] Expected products with brand=${tc.assertions.productBrand}, got none`);
      } else if (!prods.some(p => p.brand_id === tc.assertions.productBrand)) {
        const got = [...new Set(prods.map(p => p.brand_id))].slice(0, 4).join(', ');
        failures.push(`[brand] Expected ${tc.assertions.productBrand} in products, got: ${got}`);
      }
    }
    // softProductBrand: nếu có SP trả về thì ít nhất 1 SP đúng brand
    if (tc.assertions.softProductBrand && (data.products?.length || 0) > 0) {
      const prods = data.products;
      if (!prods.some(p => p.brand_id === tc.assertions.softProductBrand)) {
        const got = [...new Set(prods.map(p => p.brand_id))].slice(0, 4).join(', ');
        failures.push(`[soft-brand] Expected ${tc.assertions.softProductBrand} in products, got: ${got}`);
      }
    }
    if (tc.assertions.hasProducts && !QUICK_MODE) {
      if (!data.products || data.products.length === 0)
        failures.push('Expected products, got none');
    }

    return {
      id:          tc.id,
      group:       tc.group,
      description: tc.description,
      message:     tc.message,
      ms,
      status:      res.status,
      passed:      failures.length === 0,
      failures,
      response: {
        textSnippet:    (data.text || '').slice(0, 150),
        productCount:   data.products?.length || 0,
        topBrand:       data.products?.[0]?.brand_id || null,
        allBrands:      [...new Set((data.products || []).map(p => p.brand_id))].filter(Boolean).slice(0, 5),
        topCategory:    data.products?.[0]?.category || null,
      },
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      id: tc.id, group: tc.group, description: tc.description, message: tc.message,
      ms: Date.now() - start, status: 0, passed: false,
      failures: [err.name === 'AbortError' ? `TIMEOUT after ${TIMEOUT_MS}ms` : err.message],
      response: null,
    };
  }
}

async function runBatch(cases, concurrency) {
  const results = [];
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < cases.length) {
      const current = cases[idx++];
      const r = await runTest(current);
      results.push(r);
      const icon = r.passed ? '✅' : '❌';
      const ms = String(r.ms).padStart(5);
      const fail = r.failures.length ? ` [${r.failures.join(', ')}]` : '';
      process.stdout.write(
        `\r[${String(results.length).padStart(4)}/${cases.length}] ${icon} ${ms}ms  ${r.id} ${r.group.padEnd(20)} ${r.description.slice(0,50)}${fail}\n`
      );
      if (DELAY_MS > 0) await new Promise(res => setTimeout(res, DELAY_MS));
    }
  });
  await Promise.all(workers);
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────────────────────
function generateReport(results) {
  const total    = results.length;
  const passed   = results.filter(r => r.passed).length;
  const failed   = total - passed;
  const timeouts = results.filter(r => r.failures.some(f => f.includes('TIMEOUT'))).length;
  const avgMs    = Math.round(results.reduce((s,r) => s + r.ms, 0) / total);
  const p95Ms    = results.map(r => r.ms).sort((a,b) => a-b)[Math.floor(total * 0.95)];

  const byGroup = {};
  for (const r of results) {
    if (!byGroup[r.group]) byGroup[r.group] = { total:0, passed:0, totalMs:0 };
    byGroup[r.group].total++;
    byGroup[r.group].totalMs += r.ms;
    if (r.passed) byGroup[r.group].passed++;
  }

  console.log('\n' + '═'.repeat(70));
  console.log('  CHATBOT STRESS TEST — KẾT QUẢ');
  console.log('═'.repeat(70));
  console.log(`  Target URL : ${CHAT_URL}`);
  console.log(`  Tổng test  : ${total}`);
  console.log(`  ✅ Passed  : ${passed} (${((passed/total)*100).toFixed(1)}%)`);
  console.log(`  ❌ Failed  : ${failed}`);
  console.log(`  ⏱ Timeout : ${timeouts}`);
  console.log(`  Avg latency: ${avgMs}ms   P95: ${p95Ms}ms`);
  console.log('─'.repeat(70));
  console.log('  BY GROUP:');
  console.log('─'.repeat(70));
  const sortedGroups = Object.entries(byGroup).sort((a,b) => b[1].total - a[1].total);
  for (const [grp, s] of sortedGroups) {
    const pct    = ((s.passed/s.total)*100).toFixed(1);
    const avgGMs = Math.round(s.totalMs / s.total);
    const bar    = '█'.repeat(Math.round(s.passed/s.total*20)) + '░'.repeat(20 - Math.round(s.passed/s.total*20));
    console.log(`  ${grp.padEnd(25)} ${bar} ${pct.padStart(6)}% (${s.passed}/${s.total}) avg ${avgGMs}ms`);
  }
  console.log('─'.repeat(70));

  if (failed > 0) {
    console.log('\n  ❌ FAILURES:');
    results.filter(r => !r.passed).slice(0, 30).forEach(r => {
      console.log(`  [${r.id}] ${r.group} — "${r.message.slice(0,50)}"`);
      r.failures.forEach(f => console.log(`         ↳ ${f}`));
    });
    if (failed > 30) console.log(`  ... và ${failed - 30} failures khác (xem file JSON)`);
  }
  console.log('═'.repeat(70));

  return { summary: { total, passed, failed, timeouts, avgMs, p95Ms, passRate: ((passed/total)*100).toFixed(2) + '%' }, byGroup, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const { writeFileSync } = await import('fs');

  console.log('═'.repeat(70));
  console.log('  🤖 CHATBOT STRESS TEST — Getshopy AI Bot');
  console.log('═'.repeat(70));
  console.log(`  URL         : ${CHAT_URL}`);
  console.log(`  Test cases  : ${FILTERED.length} / ${ALL_TEST_CASES.length}`);
  console.log(`  Concurrency : ${CONCURRENCY}`);
  console.log(`  Delay       : ${DELAY_MS}ms`);
  console.log(`  Timeout     : ${TIMEOUT_MS}ms`);
  console.log(`  Quick mode  : ${QUICK_MODE}`);
  console.log(`  Group filter: ${ONLY_GROUP || '(all)'}`);
  console.log(`  Output      : ${OUT_FILE}`);
  console.log('─'.repeat(70));
  console.log('  Bắt đầu chạy...\n');

  const results = await runBatch(FILTERED, CONCURRENCY);
  const report  = generateReport(results);

  writeFileSync(OUT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n  📄 Chi tiết đã lưu vào: ${OUT_FILE}`);

  process.exit(report.summary.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(2);
});
