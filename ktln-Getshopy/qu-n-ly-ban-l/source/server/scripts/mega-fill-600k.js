/**
 * mega-fill-600k.js
 * ─────────────────────────────────────────────────────────────────
 * Scale Supabase/PostgreSQL lên đúng 600,000 sản phẩm.
 *
 * Đặc điểm:
 *   ✅ 67 brand + "Khác" — phân bổ đồng đều
 *   ✅ 7 danh mục lớn (45 leaf categories)
 *   ✅ Tên sản phẩm REALISTIC + UNIQUE (không trùng)
 *   ✅ Ảnh UNIQUE mỗi sản phẩm (picsum seed)
 *   ✅ Giá hợp lý theo category
 *   ✅ Description + Thông số kỹ thuật HTML
 *   ✅ Variants (color/storage)
 *
 * Cách dùng:
 *   node scripts/mega-fill-600k.js
 *   node scripts/mega-fill-600k.js 1000000
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

const TARGET    = parseInt(process.argv[2] || '600000', 10);
const BATCH_SIZE = 3000;

// ══════════════════════════════════════════════════════════════════
// LEAF CATEGORIES
// ══════════════════════════════════════════════════════════════════
const LEAF_CATS = [
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
  'cat-mobile-acc-case-phone':'Ốp lưng điện thoại','cat-mobile-acc-case-tablet':'Ốp lưng tablet',
  'cat-mobile-acc-screen':'Miếng dán','cat-mobile-acc-cam-cover':'Miếng dán Camera',
  'cat-mobile-acc-airpods-case':'Túi đựng AirPods','cat-mobile-acc-fan':'Quạt mini',
  'cat-mobile-acc-pen':'Bút cảm ứng','cat-mobile-acc-stand':'Giá đỡ',
  'cat-mobile-acc-strap':'Dây đeo điện thoại','cat-mobile-acc-lens':'Ống kính',
  'cat-laptop-acc-hub':'Hub USB-C','cat-laptop-acc-mouse':'Chuột máy tính',
  'cat-laptop-acc-keyboard':'Bàn phím','cat-laptop-acc-router':'Router WiFi',
  'cat-laptop-acc-bag':'Balo, túi chống sốc','cat-laptop-acc-pouch':'Túi đựng phụ kiện',
  'cat-laptop-acc-keyboard-cover':'Phủ phím laptop','cat-laptop-acc-software':'Phần mềm',
  'cat-laptop-acc-monitor-stand':'Giá treo màn hình','cat-laptop-acc-mousepad':'Miếng lót chuột',
  'cat-laptop-acc-drawing':'Bảng vẽ điện tử',
  'cat-av-bt-earphone':'Tai nghe Bluetooth','cat-av-wire-earphone':'Tai nghe dây',
  'cat-av-headphone':'Tai nghe chụp tai','cat-av-sport-earphone':'Tai nghe thể thao',
  'cat-av-speaker':'Loa','cat-av-mic':'Micro thu âm',
  'cat-av-projector':'Máy chiếu','cat-av-smartglass':'Kính thông minh',
  'cat-av-hdd':'Ổ cứng','cat-av-sdcard':'Thẻ nhớ','cat-av-usb':'USB',
  'cat-cam-security':'Camera Giám Sát','cat-cam-indoor':'Camera trong nhà',
  'cat-cam-outdoor':'Camera ngoài trời','cat-cam-solar':'Camera Năng Lượng Mặt Trời',
  'cat-cam-4g':'Camera 4G','cat-cam-doorbell':'Chuông cửa Camera','cat-cam-webcam':'Webcam',
};

// ══════════════════════════════════════════════════════════════════
// BRAND → CATEGORY MAPPING (brand nào bán category nào)
// ══════════════════════════════════════════════════════════════════
const BRAND_CAT = {
  'br-apple':       ['cat-phone','cat-laptop','cat-tablet','cat-watch','cat-mobile-acc-charger','cat-mobile-acc-case-phone','cat-av-bt-earphone','cat-av-headphone'],
  'br-samsung':     ['cat-phone','cat-tablet','cat-watch','cat-mobile-acc-charger','cat-mobile-acc-case-phone','cat-av-bt-earphone','cat-av-hdd','cat-av-sdcard'],
  'br-oppo':        ['cat-phone','cat-mobile-acc-charger','cat-av-bt-earphone'],
  'br-xiaomi':      ['cat-phone','cat-tablet','cat-watch','cat-mobile-acc-powerbank','cat-mobile-acc-charger','cat-av-bt-earphone','cat-cam-indoor','cat-cam-outdoor'],
  'br-vivo':        ['cat-phone','cat-mobile-acc-charger','cat-av-bt-earphone'],
  'br-realme':      ['cat-phone','cat-mobile-acc-powerbank','cat-mobile-acc-charger','cat-av-bt-earphone'],
  'br-honor':       ['cat-phone','cat-tablet','cat-watch','cat-mobile-acc-charger'],
  'br-motorola':    ['cat-phone'],
  'br-asus':        ['cat-laptop','cat-laptop-acc-keyboard','cat-laptop-acc-router','cat-laptop-acc-mouse','cat-laptop-acc-bag'],
  'br-hp':          ['cat-laptop','cat-laptop-acc-mouse','cat-laptop-acc-bag'],
  'br-lenovo':      ['cat-laptop','cat-tablet','cat-laptop-acc-keyboard'],
  'br-acer':        ['cat-laptop'],
  'br-dell':        ['cat-laptop','cat-laptop-acc-mouse','cat-laptop-acc-bag','cat-laptop-acc-monitor-stand'],
  'br-msi':         ['cat-laptop','cat-laptop-acc-keyboard','cat-laptop-acc-mouse','cat-laptop-acc-mousepad'],
  'br-microsoft':   ['cat-laptop','cat-laptop-acc-keyboard','cat-laptop-acc-mouse'],
  'br-razer':       ['cat-laptop','cat-laptop-acc-keyboard','cat-laptop-acc-mouse','cat-laptop-acc-mousepad','cat-av-headphone'],
  'br-machenike':   ['cat-laptop','cat-laptop-acc-keyboard','cat-laptop-acc-mouse'],
  'br-singpc':      ['cat-laptop'],
  'br-amazfit':     ['cat-watch'],
  'br-huawei':      ['cat-watch','cat-phone','cat-mobile-acc-charger'],
  'br-kidcare':     ['cat-watch'],
  'br-anker':       ['cat-mobile-acc-powerbank','cat-mobile-acc-charger','cat-laptop-acc-hub'],
  'br-baseus':      ['cat-mobile-acc-powerbank','cat-mobile-acc-charger','cat-mobile-acc-screen','cat-laptop-acc-hub','cat-mobile-acc-case-phone'],
  'br-ugreen':      ['cat-mobile-acc-charger','cat-laptop-acc-hub','cat-laptop-acc-mouse','cat-laptop-acc-keyboard'],
  'br-xmobile':     ['cat-mobile-acc-charger','cat-mobile-acc-powerbank','cat-mobile-acc-case-phone'],
  'br-innostyle':   ['cat-mobile-acc-charger','cat-mobile-acc-powerbank','cat-laptop-acc-hub'],
  'br-avaplus':     ['cat-mobile-acc-charger','cat-mobile-acc-case-phone','cat-mobile-acc-screen','cat-mobile-acc-stand'],
  'br-alpha-works': ['cat-mobile-acc-charger','cat-mobile-acc-powerbank','cat-laptop-acc-hub'],
  'br-eroc':        ['cat-mobile-acc-charger','cat-mobile-acc-powerbank'],
  'br-hydrus':      ['cat-mobile-acc-screen','cat-mobile-acc-cam-cover','cat-mobile-acc-case-phone'],
  'br-hyperwork':   ['cat-laptop-acc-hub','cat-laptop-acc-monitor-stand','cat-laptop-acc-bag'],
  'br-hyperspace':  ['cat-mobile-acc-powerbank','cat-mobile-acc-charger','cat-laptop-acc-hub'],
  'br-jcpal':       ['cat-mobile-acc-screen','cat-mobile-acc-cam-cover','cat-laptop-acc-keyboard-cover','cat-mobile-acc-case-phone'],
  'br-jbl':         ['cat-av-bt-earphone','cat-av-wire-earphone','cat-av-sport-earphone','cat-av-speaker','cat-av-headphone'],
  'br-sony':        ['cat-av-bt-earphone','cat-av-wire-earphone','cat-av-headphone','cat-av-speaker','cat-av-mic'],
  'br-marshall':    ['cat-av-speaker','cat-av-headphone','cat-av-bt-earphone'],
  'br-boya':        ['cat-av-mic'],
  'br-corsair':     ['cat-laptop-acc-keyboard','cat-laptop-acc-mouse','cat-laptop-acc-mousepad','cat-av-headphone'],
  'br-akko':        ['cat-laptop-acc-keyboard','cat-laptop-acc-mouse','cat-laptop-acc-mousepad'],
  'br-dareu':       ['cat-laptop-acc-keyboard','cat-laptop-acc-mouse','cat-laptop-acc-mousepad'],
  'br-havit':       ['cat-laptop-acc-keyboard','cat-laptop-acc-mouse','cat-av-bt-earphone','cat-av-headphone'],
  'br-rapoo':       ['cat-laptop-acc-keyboard','cat-laptop-acc-mouse'],
  'br-philips':     ['cat-av-bt-earphone','cat-av-headphone','cat-av-speaker'],
  'br-shokz':       ['cat-av-sport-earphone','cat-av-bt-earphone'],
  'br-hyundai-audio':['cat-av-speaker','cat-av-bt-earphone'],
  'br-thonet-vander':['cat-av-speaker'],
  'br-logitech':    ['cat-laptop-acc-mouse','cat-laptop-acc-keyboard','cat-laptop-acc-mousepad','cat-av-speaker','cat-cam-webcam'],
  'br-dahua':       ['cat-cam-security','cat-cam-indoor','cat-cam-outdoor','cat-cam-4g'],
  'br-ezviz':       ['cat-cam-indoor','cat-cam-outdoor','cat-cam-doorbell','cat-cam-security'],
  'br-imou':        ['cat-cam-indoor','cat-cam-outdoor','cat-cam-doorbell'],
  'br-tplink':      ['cat-cam-indoor','cat-laptop-acc-router','cat-cam-doorbell'],
  'br-tiandy':      ['cat-cam-security','cat-cam-indoor','cat-cam-outdoor','cat-cam-4g'],
  'br-insta360':    ['cat-cam-outdoor','cat-cam-webcam'],
  'br-totolink':    ['cat-laptop-acc-router'],
  'br-seagate':     ['cat-av-hdd'],
  'br-kingston':    ['cat-av-sdcard','cat-av-usb','cat-av-hdd'],
  'br-sandisk':     ['cat-av-sdcard','cat-av-usb'],
  'br-kioxia':      ['cat-av-sdcard','cat-av-usb','cat-av-hdd'],
  'br-adata':       ['cat-av-hdd','cat-av-usb','cat-av-sdcard'],
  'br-orico':       ['cat-laptop-acc-hub','cat-av-hdd','cat-laptop-acc-pouch'],
  'br-tomtoc':      ['cat-laptop-acc-bag','cat-laptop-acc-pouch'],
  'br-topo-designs':['cat-laptop-acc-bag'],
  'br-tucano':      ['cat-laptop-acc-bag','cat-laptop-acc-pouch'],
  'br-wacom':       ['cat-laptop-acc-drawing'],
  'br-ulanzi':      ['cat-av-mic','cat-mobile-acc-stand','cat-mobile-acc-lens'],
  'br-wanbo':       ['cat-av-projector'],
  'br-khac':        LEAF_CATS, // fallback — mọi category
};

// ══════════════════════════════════════════════════════════════════
// BRAND NAMES
// ══════════════════════════════════════════════════════════════════
const BRAND_NAMES = {
  'br-adata':'ADATA','br-avaplus':'AVA+','br-acer':'Acer','br-akko':'Akko',
  'br-alpha-works':'Alpha Works','br-amazfit':'Amazfit','br-anker':'Anker',
  'br-apple':'Apple','br-asus':'Asus','br-baseus':'Baseus','br-boya':'Boya',
  'br-corsair':'Corsair','br-dahua':'Dahua','br-dareu':'Dareu','br-dell':'Dell',
  'br-ezviz':'EZVIZ','br-eroc':'Eroc','br-honor':'HONOR','br-hp':'HP',
  'br-havit':'Havit','br-huawei':'Huawei','br-hydrus':'Hydrus',
  'br-hyperwork':'HyperWork','br-hyperspace':'Hyperspace',
  'br-hyundai-audio':'Hyundai Audio','br-imou':'Imou','br-innostyle':'Innostyle',
  'br-insta360':'Insta360','br-jbl':'JBL','br-jcpal':'JCPAL','br-kidcare':'Kidcare',
  'br-kingston':'Kingston','br-kioxia':'Kioxia','br-lenovo':'Lenovo',
  'br-logitech':'Logitech','br-msi':'MSI','br-machenike':'Machenike',
  'br-marshall':'Marshall','br-microsoft':'Microsoft','br-motorola':'Motorola',
  'br-oppo':'OPPO','br-orico':'Orico','br-philips':'Philips','br-rapoo':'Rapoo',
  'br-razer':'Razer','br-samsung':'Samsung','br-sandisk':'SanDisk',
  'br-seagate':'Seagate','br-shokz':'Shokz','br-singpc':'SingPC','br-sony':'Sony',
  'br-totolink':'TOTOLINK','br-tplink':'TP-Link','br-thonet-vander':'Thonet & Vander',
  'br-tiandy':'Tiandy','br-tomtoc':'Tomtoc','br-topo-designs':'Topo Designs',
  'br-tucano':'Tucano','br-ugreen':'Ugreen','br-ulanzi':'Ulanzi','br-wacom':'Wacom',
  'br-wanbo':'Wanbo','br-xiaomi':'Xiaomi','br-xmobile':'Xmobile',
  'br-realme':'realme','br-vivo':'vivo','br-khac':'Khác',
};

// ══════════════════════════════════════════════════════════════════
// PRODUCT NAME TEMPLATES — REALISTIC theo (category, brand)
// Mỗi template có {color}, {storage}, {size} placeholders
// ══════════════════════════════════════════════════════════════════
const NAME_TEMPLATES = {
  'cat-phone': {
    'br-apple': ['iPhone 16 Pro Max {storage} {color}','iPhone 16 Pro {storage} {color}','iPhone 16 Plus {storage} {color}','iPhone 16 {storage} {color}','iPhone 15 Pro Max {storage} {color}','iPhone 15 Pro {storage} {color}','iPhone 15 Plus {storage} {color}','iPhone 15 {storage} {color}','iPhone 14 {storage} {color}','iPhone SE (3rd Gen) {storage} {color}','iPhone 13 {storage} {color}'],
    'br-samsung': ['Galaxy S25 Ultra {storage} {color}','Galaxy S25+ {storage} {color}','Galaxy S25 {storage} {color}','Galaxy S24 Ultra {storage} {color}','Galaxy S24+ {storage} {color}','Galaxy S24 {storage} {color}','Galaxy Z Fold6 {storage} {color}','Galaxy Z Flip6 {storage} {color}','Galaxy A55 5G {storage} {color}','Galaxy A35 5G {storage} {color}','Galaxy A25 5G {storage} {color}','Galaxy A15 {storage} {color}','Galaxy M55 5G {storage} {color}'],
    'br-oppo': ['OPPO Find X8 Pro {storage} {color}','OPPO Find X8 {storage} {color}','OPPO Reno12 Pro 5G {storage} {color}','OPPO Reno12 5G {storage} {color}','OPPO Reno12 F {storage} {color}','OPPO Reno11 Pro 5G {storage} {color}','OPPO A3 Pro 5G {storage} {color}','OPPO A3 5G {storage} {color}','OPPO A38 {storage} {color}','OPPO A18 {storage} {color}'],
    'br-xiaomi': ['Xiaomi 14 Ultra {storage} {color}','Xiaomi 14 Pro {storage} {color}','Xiaomi 14 {storage} {color}','Xiaomi 14T Pro {storage} {color}','Xiaomi 14T {storage} {color}','Redmi Note 14 Pro+ 5G {storage} {color}','Redmi Note 14 Pro 5G {storage} {color}','Redmi Note 14 {storage} {color}','Redmi 13C {storage} {color}','Poco X6 Pro {storage} {color}','Poco F6 Pro {storage} {color}','Poco M6 Pro {storage} {color}'],
    'br-vivo': ['vivo V40 Pro 5G {storage} {color}','vivo V40 5G {storage} {color}','vivo V40 Lite 5G {storage} {color}','vivo V30 Pro 5G {storage} {color}','vivo Y300 Pro+ 5G {storage} {color}','vivo Y200 5G {storage} {color}','vivo Y100A {storage} {color}','vivo Y17s {storage} {color}'],
    'br-realme': ['realme GT 6T 5G {storage} {color}','realme GT 6 5G {storage} {color}','realme 12 Pro+ 5G {storage} {color}','realme 12 Pro 5G {storage} {color}','realme 12+ 5G {storage} {color}','realme Narzo 70 Pro 5G {storage} {color}','realme C67 5G {storage} {color}','realme C65 5G {storage} {color}'],
    'br-honor': ['HONOR Magic6 Pro {storage} {color}','HONOR Magic V3 {storage} {color}','HONOR 200 Pro {storage} {color}','HONOR 200 {storage} {color}','HONOR X9b 5G {storage} {color}','HONOR X8b {storage} {color}','HONOR X7b {storage} {color}'],
    'br-motorola': ['Motorola Edge 50 Pro 5G {storage} {color}','Motorola Edge 50 Fusion 5G {storage} {color}','Motorola Edge 50 Neo 5G {storage} {color}','Motorola Moto G85 5G {storage} {color}','Motorola Moto G75 5G {storage} {color}','Motorola Razr 50 Ultra {storage} {color}'],
    'br-huawei': ['Huawei Pura 70 Ultra {storage} {color}','Huawei Pura 70 Pro {storage} {color}','Huawei Nova 12 Ultra {storage} {color}','Huawei Nova 12 SE {storage} {color}'],
  },
  'cat-laptop': {
    'br-apple': ['MacBook Air M3 13 inch {ram} {storage} {color}','MacBook Air M3 15 inch {ram} {storage} {color}','MacBook Pro M4 14 inch {ram} {storage} {color}','MacBook Pro M4 Pro 14 inch {ram} {storage} {color}','MacBook Pro M4 Pro 16 inch {ram} {storage} {color}','MacBook Pro M4 Max 16 inch {ram} {storage} {color}'],
    'br-asus': ['Asus Vivobook 15 OLED i5 {ram} {storage}','Asus Vivobook 16X i7 {ram} {storage} RTX3050','Asus Zenbook 14 OLED Ultra 7 {ram} {storage}','Asus ROG Strix G16 i9 {ram} {storage} RTX4060','Asus ROG Strix G18 i9 {ram} {storage} RTX4070','Asus ROG Zephyrus G14 Ryzen AI 9 {ram} {storage} RTX4070','Asus ROG Flow X16 i9 {ram} {storage} RTX4060','Asus ProArt Studiobook 16 {ram} {storage}','Asus ExpertBook B5 i7 {ram} {storage}','Asus TUF Gaming A15 Ryzen 7 {ram} {storage} RTX4060'],
    'br-hp': ['HP Pavilion 15 i5 {ram} {storage} Silver','HP Pavilion 15 i7 {ram} {storage} Blue','HP Envy x360 14 Ultra 5 {ram} {storage}','HP Envy 16 Ultra 7 {ram} {storage} RTX4060','HP Spectre x360 14 Ultra 7 {ram} {storage}','HP Victus 16 i7 {ram} {storage} RTX4060','HP EliteBook 840 G10 i7 {ram} {storage}','HP ZBook Firefly 14 G11 Ultra 7 {ram} {storage}','HP Omen 16 i9 {ram} {storage} RTX4070'],
    'br-lenovo': ['Lenovo IdeaPad Slim 5 Ultra 5 {ram} {storage}','Lenovo IdeaPad Gaming 3 Ryzen 5 {ram} {storage} RTX3050','Lenovo LOQ 15 i5 {ram} {storage} RTX3050','Lenovo Legion 5 Ryzen 7 {ram} {storage} RTX4060','Lenovo Legion Pro 5 i9 {ram} {storage} RTX4070','Lenovo ThinkBook 14 Ultra 5 {ram} {storage}','Lenovo ThinkPad X1 Carbon Gen 12 Ultra 7 {ram} {storage}','Lenovo Yoga 7 2-in-1 Ultra 5 {ram} {storage}','Lenovo Yoga Slim 7 Ultra 7 {ram} {storage}'],
    'br-acer': ['Acer Aspire 5 i5 {ram} {storage} RTX2050','Acer Aspire 3 i5 {ram} {storage}','Acer Swift Go 14 Ultra 5 {ram} {storage}','Acer Swift Go 16 Ultra 5 {ram} {storage} OLED','Acer Nitro V 15 i5 {ram} {storage} RTX3050','Acer Nitro V 16 Ryzen 5 {ram} {storage} RTX4050','Acer Predator Helios Neo 16 i7 {ram} {storage} RTX4070','Acer TravelMate P4 i7 {ram} {storage}'],
    'br-dell': ['Dell Inspiron 15 i5 {ram} {storage} Silver','Dell Inspiron 16 i7 {ram} {storage}','Dell XPS 13 Ultra 7 {ram} {storage}','Dell XPS 15 Ultra 9 {ram} {storage} RTX4070','Dell Vostro 15 i5 {ram} {storage}','Dell Latitude 5540 i5 {ram} {storage}','Dell G15 Gaming i7 {ram} {storage} RTX4060','Dell Alienware m18 i9 {ram} {storage} RTX4090'],
    'br-msi': ['MSI Modern 15 i5 {ram} {storage}','MSI Thin 15 i5 {ram} {storage} RTX2050','MSI Katana 15 i7 {ram} {storage} RTX4070','MSI Titan 18 HX i9 {ram} {storage} RTX4090','MSI Raider GE78 i9 {ram} {storage} RTX4080','MSI Stealth 16 AI Ultra 9 {ram} {storage} RTX4090','MSI Prestige 16 AI Evo Ultra 7 {ram} {storage}','MSI Claw A1M Ultra 7 {ram} {storage}'],
    'br-microsoft': ['Microsoft Surface Pro 11 Ultra 5 {ram} {storage}','Microsoft Surface Laptop 6 13.5 Ultra 5 {ram} {storage}','Microsoft Surface Laptop 6 15 Ultra 7 {ram} {storage}','Microsoft Surface Laptop Studio 2 i7 {ram} {storage} RTX4060'],
    'br-razer': ['Razer Blade 16 Ultra 9 {ram} {storage} RTX4090','Razer Blade 15 i9 {ram} {storage} RTX4080','Razer Blade 14 Ryzen 9 {ram} {storage} RTX4070','Razer Book 13 i7 {ram} {storage}'],
    'br-machenike': ['Machenike Star 15 i7 {ram} {storage} RTX4060','Machenike Star 16 i9 {ram} {storage} RTX4070','Machenike L17 Pro i7 {ram} {storage} RTX4060','Machenike S16 Ultra 7 {ram} {storage}'],
    'br-singpc': ['SingPC M16 i5 {ram} {storage}','SingPC M15 Pro i7 {ram} {storage}','SingPC E16 Ryzen 5 {ram} {storage}'],
  },
  'cat-tablet': {
    'br-apple': ['iPad Pro M4 13 inch WiFi {storage} {color}','iPad Pro M4 11 inch WiFi {storage} {color}','iPad Air M2 13 inch WiFi {storage} {color}','iPad Air M2 11 inch WiFi {storage} {color}','iPad mini A17 Pro WiFi {storage} {color}','iPad Gen 10 WiFi {storage} {color}'],
    'br-samsung': ['Samsung Galaxy Tab S10 Ultra WiFi {storage} {color}','Samsung Galaxy Tab S10+ WiFi {storage} {color}','Samsung Galaxy Tab S10 FE WiFi {storage} {color}','Samsung Galaxy Tab S9 Ultra 5G {storage} {color}','Samsung Galaxy Tab A9+ WiFi {storage} {color}','Samsung Galaxy Tab A9 WiFi {storage} {color}'],
    'br-xiaomi': ['Xiaomi Pad 7 {storage} {color}','Xiaomi Pad 7 Pro {storage} {color}','Xiaomi Pad 6S Pro {storage} {color}','Xiaomi Pad 6 {storage} {color}','Xiaomi Redmi Pad Pro {storage} {color}'],
    'br-lenovo': ['Lenovo Tab P12 Pro {storage} {color}','Lenovo Tab P11 Pro Gen 2 {storage} {color}','Lenovo Tab M11 {storage} {color}','Lenovo Tab M10 Plus Gen 3 {storage} {color}','Lenovo Legion Tab {storage} {color}'],
    'br-honor': ['HONOR Pad X9 5G {storage} {color}','HONOR Pad 9 {storage} {color}','HONOR MagicPad 2 {storage} {color}'],
  },
  'cat-watch': {
    'br-apple': ['Apple Watch Series 10 {size} {color}','Apple Watch Ultra 2 49mm {color}','Apple Watch SE Gen 2 {size} {color}','Apple Watch Series 9 {size} {color}'],
    'br-samsung': ['Samsung Galaxy Watch7 {size} {color}','Samsung Galaxy Watch Ultra 47mm {color}','Samsung Galaxy Watch6 Classic {size} {color}','Samsung Galaxy Watch FE {size} {color}','Samsung Galaxy Fit3 {color}'],
    'br-xiaomi': ['Xiaomi Watch S4 Sport {color}','Xiaomi Watch S3 {color}','Xiaomi Watch S2 Pro {size} {color}','Redmi Watch 5 Lite {color}','Redmi Watch 4 {color}','Xiaomi Smart Band 9 Pro {color}','Xiaomi Smart Band 9 Active {color}'],
    'br-amazfit': ['Amazfit Falcon 2 {color}','Amazfit Balance {color}','Amazfit Cheetah Pro {color}','Amazfit GTR 4 {color}','Amazfit GTS 4 Mini {color}','Amazfit Bip 5 {color}','Amazfit T-Rex Ultra {color}','Amazfit Active {color}','Amazfit Band 7 {color}'],
    'br-huawei': ['Huawei Watch GT 5 Pro {size} {color}','Huawei Watch GT 5 {size} {color}','Huawei Watch Ultimate {color}','Huawei Band 9 {color}','Huawei Watch 4 Pro {color}','Huawei Watch Fit 3 {color}'],
    'br-honor': ['HONOR Watch 4 Pro {color}','HONOR Watch GS Pro {color}','HONOR Band 9 {color}','HONOR Magic Watch 2 {size} {color}'],
    'br-kidcare': ['Kidcare S8 Plus {color}','Kidcare S6 Pro {color}','Kidcare 08S {color}','Kidcare 06S {color}','Kidcare A6 {color}'],
  },
  // ── PHỤ KIỆN DI ĐỘNG ─────────────────────────────────────────────
  'cat-mobile-acc-powerbank': {
    'br-anker': ['Anker PowerCore Slim 10000 PD {watt}','Anker PowerCore 20000 PD {watt}','Anker PowerCore III Elite 25600 {watt}','Anker 737 Power Bank 140W 24000mAh','Anker 733 Power Bank Fusion 10000 {watt}'],
    'br-baseus': ['Baseus Adaman2 Digital Display 20000mAh {watt}','Baseus Blade {watt} 20000mAh','Baseus Star-Lord {watt} 30000mAh','Baseus Amblight {watt} 30000mAh','Baseus Elf Digital 10000mAh {watt}'],
    'br-xiaomi': ['Xiaomi Power Bank 3 Ultra Compact 10000mAh {watt}','Xiaomi 33W Power Bank 10000mAh','Xiaomi Power Bank 50W 20000mAh'],
    'br-xmobile': ['Xmobile Energy 20000mAh {watt}','Xmobile Pro 10000mAh {watt}','Xmobile Ultra 15000mAh {watt}'],
    'br-realme': ['realme Power Bank 2 10000mAh {watt}','realme Power Bank 3 20000mAh {watt}'],
    'br-innostyle': ['Innostyle Powergo Pro {watt} 20000mAh','Innostyle Powergo Ultra {watt} 10000mAh'],
    'br-alpha-works': ['Alpha Works Pro Power {watt} 20000mAh','Alpha Works Compact {watt} 10000mAh'],
    'br-eroc': ['Eroc Power Station {watt} 20000mAh','Eroc Slim {watt} 10000mAh'],
    'br-hyperspace': ['Hyperspace Power Max {watt} 20000mAh','Hyperspace Slim {watt} 10000mAh'],
  },
  'cat-mobile-acc-charger': {
    'br-anker': ['Anker 737 Charger GaN 120W 3 cổng','Anker Prime 100W GaN 4 cổng','Anker 735 GaN 65W 3 cổng','Anker Nano 45W USB-C','Anker PowerLine III Flow USB-C to Lightning 1.8m','Anker Powerline+ III USB-C to USB-C 100W 1.8m'],
    'br-baseus': ['Baseus GaN5 Pro 100W 4 cổng','Baseus Compact 30W USB-C','Baseus Pixel 65W 3 cổng GaN','Baseus Superior Pro USB-C Cable 100W 2m','Baseus Crystal Shine MagSafe Cable 2.4A 1.2m'],
    'br-apple': ['Apple 20W USB-C Power Adapter','Apple 35W Dual USB-C Port Adapter','Apple 67W USB-C Power Adapter','Apple USB-C to Lightning Cable 2m','Apple MagSafe Charger 15W 1m'],
    'br-samsung': ['Samsung 45W Super Fast Charger USB-C','Samsung 25W Fast Charger USB-C','Samsung 15W Wireless Charger Pad','Samsung USB-C to USB-C Cable 5A 1m'],
    'br-ugreen': ['Ugreen Nexode 100W GaN 4 Port','Ugreen Nexode 65W 3-Port','Ugreen USB-C to USB-C 240W 1m','Ugreen MFi Lightning to USB-C 36W 1.5m'],
    'br-innostyle': ['Innostyle USB-C 67W GaN Charger','Innostyle MagSafe Charger 15W','Innostyle USB-C Cable 100W 2m'],
    'br-xmobile': ['Xmobile USB-C 30W Fast Charger','Xmobile USB-C Cable 60W 1m','Xmobile Wireless Charger 15W'],
    'br-oppo': ['OPPO SUPERVOOC 80W Charger','OPPO VOOC USB-C Cable 65W','OPPO 33W Fast Charger USB-C'],
    'br-xiaomi': ['Xiaomi 67W GaN Charger USB-C','Xiaomi 120W HyperCharge','Xiaomi USB-C to USB-C Cable 6A 1m'],
    'br-vivo': ['vivo FlashCharge 44W Charger','vivo USB-C Cable 33W 1m'],
    'br-realme': ['realme 65W SUPERVOOC Charger','realme USB-C SuperDart Cable 1m'],
    'br-honor': ['HONOR SuperCharge 66W Charger','HONOR USB-C Cable 6A 1m'],
    'br-huawei': ['Huawei SuperCharge 66W Charger','Huawei 40W Car Charger USB-C'],
    'br-avaplus': ['AVA+ USB-C PD 30W Wall Charger','AVA+ USB-C Cable 60W 1.2m','AVA+ Car Charger USB-C 36W'],
    'br-alpha-works': ['Alpha Works GaN 65W Charger','Alpha Works USB-C Cable 100W 2m'],
    'br-eroc': ['Eroc Mini 30W USB-C Charger','Eroc USB-C Cable 3A 1m'],
    'br-hyperspace': ['Hyperspace 100W GaN 3 cổng','Hyperspace USB-C Cable 240W 2m'],
  },
  'cat-mobile-acc-case-phone': {
    'br-baseus': ['Baseus Crystal iPhone 16 Pro Max {color}','Baseus Glitter Galaxy S25 Ultra {color}','Baseus Magnetic iPhone 16 Pro {color}','Baseus Liquid Silicone iPhone 15 {color}'],
    'br-apple': ['Apple FineWoven Case iPhone 16 Pro Max {color}','Apple Silicone Case iPhone 16 Pro {color}','Apple Clear Case iPhone 16 with MagSafe'],
    'br-samsung': ['Samsung Standing Grip Case Galaxy S25 Ultra {color}','Samsung Vegan Leather Case Galaxy S25+ {color}','Samsung Clear Gadget Case Galaxy S25'],
    'br-hydrus': ['Hydrus Crystal Clear iPhone 16 Pro Max','Hydrus Tough Armor Samsung S25 Ultra {color}','Hydrus Liquid Shield iPhone 16 {color}'],
    'br-jcpal': ['JCPAL iGuard iPhone 16 Pro Max {color}','JCPAL FlexForm Galaxy S25 {color}','JCPAL DualPro iPhone 15 Pro {color}'],
    'br-avaplus': ['AVA+ Clear Case iPhone 16 Pro Max','AVA+ Slim Fit Samsung Galaxy S25 {color}','AVA+ Soft TPU iPhone 16 {color}'],
    'br-xmobile': ['Xmobile Silicone iPhone 16 Pro {color}','Xmobile Clear Case Galaxy S25 {color}','Xmobile Shockproof iPhone 15 {color}'],
  },
  // (More accessories categories follow the same pattern...)
  'cat-mobile-acc-screen': {
    'br-jcpal': ['JCPAL Tempered Glass iPhone 16 Pro Max','JCPAL Privacy Screen iPhone 16 Pro','JCPAL Crystal Clear Samsung S25 Ultra','JCPAL Matte Film iPhone 15'],
    'br-hydrus': ['Hydrus Nano Film iPhone 16 Pro Max Matte','Hydrus Anti-Fingerprint Samsung S25','Hydrus Full Cover Xiaomi 14 Ultra'],
    'br-baseus': ['Baseus Crystal 0.3mm Glass iPhone 16 Pro Max 2-pack','Baseus Diamond Anti-Fingerprint Samsung S25'],
    'br-avaplus': ['AVA+ Tempered Glass iPhone 16 Pro Max','AVA+ Full Cover Samsung S25 Ultra'],
  },
  'cat-mobile-acc-cam-cover': {
    'br-jcpal': ['JCPAL Camera Lens Protector iPhone 16 Pro Max','JCPAL Camera Film Samsung Galaxy S25 Ultra'],
    'br-hydrus': ['Hydrus Camera Cover iPhone 16 Pro Max','Hydrus Camera Shield Samsung S25'],
  },
  'cat-mobile-acc-stand': {
    'br-ulanzi': ['Ulanzi Phone Tripod MT-31 Mini','Ulanzi ST-27 Phone Holder','Ulanzi Magnetic Phone Grip MG-01'],
    'br-avaplus': ['AVA+ Phone Stand Foldable Aluminum','AVA+ Desktop Phone Holder','AVA+ Car Phone Mount Magnetic'],
  },
  'cat-mobile-acc-lens': {
    'br-ulanzi': ['Ulanzi Wide Angle Lens 18mm Phone','Ulanzi Macro Lens 75mm Phone','Ulanzi Anamorphic Lens 1.33x','Ulanzi Fisheye Lens 238° Phone'],
  },
  // ── PHỤ KIỆN LAPTOP ─────────────────────────────────────────────
  'cat-laptop-acc-hub': {
    'br-ugreen': ['Ugreen Revodok Pro 12-in-2 Hub Thunderbolt 4','Ugreen 9-in-1 USB-C Hub 4K HDMI PD 100W','Ugreen 7-in-1 Hub USB-C 4K HDMI','Ugreen USB-C to 4 USB-A 3.0 Slim Hub','Ugreen USB-C to HDMI 4K Adapter'],
    'br-anker': ['Anker 555 USB-C Hub 8-in-1 4K HDMI','Anker 341 USB-C Hub 7-in-1','Anker 563 USB-C Docking Station 10-in-1','Anker 512 USB-C Adapter 5-in-1'],
    'br-baseus': ['Baseus Mechanical Eye 6-in-1 USB-C Hub','Baseus Replicator 12-in-1 Hub Dual HDMI 4K','Baseus Harmonia 6-in-1 USB-C Hub'],
    'br-orico': ['Orico TB3 Thunderbolt 4 Dock 12-in-1','Orico USB-C Hub 9-in-1 4K60Hz','Orico USB-C to 4-Port USB-A Hub'],
    'br-hyperwork': ['HyperWork USB-C Hub 10-in-1 4K','HyperWork Thunderbolt 4 Dock','HyperWork USB-C 7-in-1 Slim Hub'],
    'br-innostyle': ['Innostyle USB-C Hub 6-in-1 HDMI 4K','Innostyle Hub Plus 8-in-1 PD 100W'],
    'br-alpha-works': ['Alpha Works USB-C Hub 8-in-1','Alpha Works Dock Pro 12-in-1 Thunderbolt'],
    'br-hyperspace': ['Hyperspace Hub Pro USB-C 10-in-1','Hyperspace Slim Hub 6-in-1 4K'],
  },
  'cat-laptop-acc-mouse': {
    'br-logitech': ['Logitech MX Master 3S Wireless {color}','Logitech MX Anywhere 3S Compact {color}','Logitech G Pro X Superlight 2 {color}','Logitech G502 X Plus {color}','Logitech G403 Hero Gaming {color}','Logitech M750 Signature {color}'],
    'br-razer': ['Razer DeathAdder V3 HyperSpeed {color}','Razer Viper V3 Pro Wireless {color}','Razer Basilisk V3 Pro {color}','Razer Orochi V2 {color}'],
    'br-corsair': ['Corsair Dark Core RGB Pro SE Wireless','Corsair M75 Air Wireless {color}','Corsair Katar Elite Wireless {color}','Corsair Harpoon RGB Wireless'],
    'br-akko': ['Akko Wasp AO18 Wireless {color}','Akko AG325C Gaming Mouse {color}','Akko Multi-Mode Mouse AM200 {color}'],
    'br-dareu': ['Dareu A950 Pro Wireless {color}','Dareu EM945 Gaming {color}','Dareu A955 Lightweight {color}','Dareu LM115G Wireless {color}'],
    'br-rapoo': ['Rapoo M650 Silent Wireless {color}','Rapoo MT760 Multi-Mode {color}','Rapoo VT200S Gaming {color}'],
    'br-havit': ['Havit MS78GT Wireless {color}','Havit MS976GT Gaming {color}','Havit HV-MS760 Wireless {color}'],
    'br-microsoft': ['Microsoft Arc Mouse {color}','Microsoft Bluetooth Ergonomic Mouse {color}','Microsoft Pro IntelliMouse {color}'],
    'br-dell': ['Dell Premier Rechargeable Mouse MS900','Dell Bluetooth Mouse MS700 {color}','Dell Multi-Device Mouse MS5320W'],
    'br-hp': ['HP 935 Creator Wireless Mouse','HP Z3700 Dual Mode Wireless {color}','HP ENVY Rechargeable Mouse 500'],
    'br-msi': ['MSI Clutch GM41 Lightweight {color}','MSI Accolade EK31 Gaming {color}'],
    'br-machenike': ['Machenike M8 Pro Wireless {color}','Machenike L8 Gaming {color}'],
    'br-asus': ['Asus ROG Gladius III Wireless {color}','Asus ROG Keris II Ace {color}','Asus ProArt Mouse MD300 {color}'],
    'br-ugreen': ['Ugreen MU006 Wireless Silent {color}','Ugreen MU007 Bluetooth {color}'],
  },
  'cat-laptop-acc-keyboard': {
    'br-logitech': ['Logitech MX Keys S Wireless {color}','Logitech MX Mechanical Mini {color}','Logitech G Pro X TKL Gaming {color}','Logitech G915 TKL Wireless {color}','Logitech K380s Multi-Device {color}'],
    'br-razer': ['Razer BlackWidow V4 Pro Wireless {color}','Razer Huntsman V3 Pro TKL {color}','Razer DeathStalker V2 Pro {color}'],
    'br-corsair': ['Corsair K100 Air Wireless Ultra-Thin {color}','Corsair K70 RGB Pro Mechanical {color}','Corsair K65 Plus Wireless 75% {color}'],
    'br-akko': ['Akko 5075B Plus HE Magnetic Switch {color}','Akko 3098B Multi-Mode {color}','Akko MOD007B V3 75% {color}','Akko ACR 68 Alice {color}'],
    'br-dareu': ['Dareu EK75 Pro Wireless {color}','Dareu A87 Pro Mechanical {color}','Dareu EK87 Multi-Mode {color}'],
    'br-rapoo': ['Rapoo V700-8A Wireless Mechanical {color}','Rapoo E9050G Ultra-Slim {color}'],
    'br-havit': ['Havit KB875L Mechanical TKL {color}','Havit KB487L Wireless {color}'],
    'br-microsoft': ['Microsoft Ergonomic Keyboard {color}','Microsoft Surface Keyboard {color}'],
    'br-asus': ['Asus ROG Falchion RX Compact {color}','Asus ROG Strix Flare II TKL {color}'],
    'br-msi': ['MSI VIGOR GK71 Sonic {color}','MSI VIGOR GK50 Low Profile TKL {color}'],
    'br-dell': ['Dell Pro Wireless Keyboard KB740','Dell Alienware Pro Wireless Keyboard'],
    'br-ugreen': ['Ugreen KU101 Wireless Mechanical {color}','Ugreen KU004 Slim Bluetooth {color}'],
    'br-machenike': ['Machenike KT68 Pro Wireless {color}','Machenike K500 Mechanical {color}'],
    'br-lenovo': ['Lenovo ThinkPad TrackPoint Keyboard II','Lenovo Professional Wireless Keyboard'],
  },
  'cat-laptop-acc-router': {
    'br-tplink': ['TP-Link Archer BE9300 WiFi 7','TP-Link Archer AX73 WiFi 6 AX5400','TP-Link Deco XE75 Pro WiFi 6E Mesh','TP-Link Archer C80 WiFi 5 AC1900','TP-Link TL-WR840N 300Mbps','TP-Link EX511 WiFi 6 AX3000'],
    'br-totolink': ['TOTOLINK X6000R WiFi 6 AX3000','TOTOLINK X5000R WiFi 6 AX1800','TOTOLINK N300RT 300Mbps','TOTOLINK A810R WiFi 5 AC1200'],
    'br-asus': ['Asus RT-BE96U WiFi 7 10Gbps','Asus ZenWiFi Pro ET12 WiFi 6E Mesh','Asus RT-AX88U Pro WiFi 6 AX6000','Asus RT-AX58U WiFi 6 AX3000'],
  },
  'cat-laptop-acc-bag': {
    'br-tomtoc': ['Tomtoc Defender A13 Laptop Bag 16 inch','Tomtoc Versatile A14 Laptop Briefcase 15.6','Tomtoc Premium H62 Laptop Backpack','Tomtoc Navigator T71 Backpack 15.6 inch'],
    'br-topo-designs': ['Topo Designs Commuter Briefcase 15 Laptop','Topo Designs Rover Pack Classic','Topo Designs Global Briefcase 3-Day'],
    'br-tucano': ['Tucano Loop Laptop Bag 15.6 inch {color}','Tucano Lato Backpack 17 inch {color}','Tucano Smilza Laptop Slim Case 14 inch {color}'],
    'br-dell': ['Dell Premier Backpack 15 PE1520P','Dell EcoLoop Premier Slim Backpack 15','Dell Professional Backpack 15'],
    'br-hp': ['HP Renew Business 17.3 Laptop Bag','HP Pavilion Gaming Backpack 500 15.6','HP Prelude Pro 15.6 Backpack'],
    'br-asus': ['Asus ProArt 16 Backpack','Asus ROG Ranger BP4701 17 Gaming Backpack','Asus Nereus Laptop Backpack 16'],
    'br-hyperwork': ['HyperWork Urban Laptop Backpack 15.6','HyperWork Slim Laptop Sleeve 14 inch'],
  },
  'cat-laptop-acc-pouch': {
    'br-tomtoc': ['Tomtoc Defender A22 Tech Pouch {color}','Tomtoc Electronic Organizer A21'],
    'br-tucano': ['Tucano Minilux Tech Pouch {color}','Tucano Naviga Accessories Pouch {color}'],
    'br-orico': ['Orico Portable HDD Case PHB-25 {color}','Orico Accessory Pouch PBS95 {color}'],
  },
  'cat-laptop-acc-keyboard-cover': {
    'br-jcpal': ['JCPAL FitSkin Keyboard Cover MacBook Pro 16 M4','JCPAL FitSkin MacBook Air 15 M3','JCPAL FitSkin MacBook Air 13 M3'],
  },
  'cat-laptop-acc-mousepad': {
    'br-razer': ['Razer Goliathus Extended Speed Edition','Razer Gigantus V2 XXL','Razer Atlas Tempered Glass','Razer Strider Chroma RGB XXL'],
    'br-logitech': ['Logitech G840 XL Gaming Mouse Pad','Logitech G640 Large Cloth Gaming','Logitech Studio Desk Mat {color}'],
    'br-corsair': ['Corsair MM700 RGB Extended Mouse Pad','Corsair MM300 Pro Extended','Corsair MM500 Premium 3XL'],
    'br-akko': ['Akko Desk Mat {color} XL','Akko Gaming Mouse Pad XXL {color}'],
    'br-dareu': ['Dareu ESP101 Gaming Mousepad XL','Dareu ESP109 Speed Edition'],
    'br-msi': ['MSI Agility GD30 Pro Gaming','MSI Agility GD70 Pro XXL'],
  },
  'cat-laptop-acc-monitor-stand': {
    'br-dell': ['Dell Monitor Stand MS521H Dual','Dell Monitor Arm MDA20 Single'],
    'br-hyperwork': ['HyperWork Monitor Arm MA-200 Single','HyperWork Dual Monitor Stand MA-300'],
  },
  'cat-laptop-acc-drawing': {
    'br-wacom': ['Wacom Intuos Medium Bluetooth {color}','Wacom Intuos Pro M Paper Edition','Wacom Intuos Small {color}','Wacom One 13 Touch Pen Display','Wacom Cintiq 16 Pen Display','Wacom Cintiq Pro 27 Pen Display'],
  },
  'cat-laptop-acc-software': {},
  // ── THIẾT BỊ NGHE NHÌN ──────────────────────────────────────────
  'cat-av-bt-earphone': {
    'br-apple': ['AirPods Pro 2nd Gen USB-C','AirPods 4 Active Noise Cancellation','AirPods 4','AirPods 3rd Gen Lightning'],
    'br-samsung': ['Samsung Galaxy Buds3 Pro {color}','Samsung Galaxy Buds3 {color}','Samsung Galaxy Buds2 Pro {color}','Samsung Galaxy Buds FE {color}'],
    'br-jbl': ['JBL Tour Pro 2 TWS ANC','JBL Tune Beam 2 TWS','JBL Tune Buds TWS ANC','JBL Free NC TWS','JBL Live Pro 2 TWS ANC','JBL Endurance Peak 3 TWS'],
    'br-sony': ['Sony WF-1000XM5 ANC {color}','Sony WF-C700N TWS ANC {color}','Sony WF-C510 TWS {color}','Sony LinkBuds Open-Type {color}'],
    'br-marshall': ['Marshall Minor IV TWS {color}','Marshall Motif II ANC TWS {color}','Marshall Mode II TWS {color}'],
    'br-xiaomi': ['Xiaomi Buds 5 Pro ANC {color}','Xiaomi Buds 5 TWS {color}','Redmi Buds 6 Pro ANC {color}','Redmi Buds 6 TWS {color}'],
    'br-oppo': ['OPPO Enco X3 ANC TWS {color}','OPPO Enco Free3 TWS {color}','OPPO Enco Air4 Pro {color}'],
    'br-vivo': ['vivo TWS 4 ANC {color}','vivo TWS 3 Pro {color}','vivo TWS Air 2 {color}'],
    'br-realme': ['realme Buds Air 6 Pro ANC {color}','realme Buds Air 6 TWS {color}','realme Buds T310 {color}'],
    'br-philips': ['Philips TAT4556 ANC TWS {color}','Philips TAT3508 TWS {color}','Philips TAT2236 TWS {color}'],
    'br-havit': ['Havit TW967 ANC TWS {color}','Havit TW959 TWS {color}','Havit i99 TWS {color}'],
    'br-shokz': ['Shokz OpenFit Air {color}','Shokz OpenFit {color}'],
    'br-hyundai-audio': ['Hyundai Audio HY-T03 TWS {color}','Hyundai Audio HY-T05 ANC TWS {color}'],
    'br-honor': ['HONOR Earbuds X7 TWS {color}','HONOR Choice Earbuds X5 {color}'],
    'br-huawei': ['Huawei FreeBuds Pro 3 {color}','Huawei FreeBuds 6i {color}','Huawei FreeBuds SE 2 {color}'],
  },
  'cat-av-wire-earphone': {
    'br-sony': ['Sony MDR-EX155AP In-Ear {color}','Sony MDR-EX15LP In-Ear {color}','Sony IER-M9 In-Ear Monitor'],
    'br-jbl': ['JBL Tune 110 In-Ear {color}','JBL T210 In-Ear {color}','JBL Endurance Run 2 {color}'],
    'br-samsung': ['Samsung EO-IA500 In-Ear {color}','Samsung AKG Type-C Earphones {color}'],
  },
  'cat-av-headphone': {
    'br-sony': ['Sony WH-1000XM5 Over-Ear ANC {color}','Sony WH-1000XM4 ANC {color}','Sony WH-XB910N Extra Bass ANC {color}','Sony MDR-7506 Studio Monitor'],
    'br-jbl': ['JBL Tune 770NC Over-Ear ANC {color}','JBL Tune 720BT Over-Ear {color}','JBL Tune 520BT On-Ear {color}','JBL Quantum 910X Gaming Wireless'],
    'br-marshall': ['Marshall Monitor III ANC {color}','Marshall Major V {color}','Marshall Minor IV {color}'],
    'br-razer': ['Razer Kraken V4 Pro Gaming Wireless','Razer BlackShark V2 Pro Gaming {color}','Razer Barracuda Pro Wireless ANC {color}'],
    'br-corsair': ['Corsair HS80 Max Wireless Gaming {color}','Corsair Virtuoso Max Wireless {color}','Corsair HS65 Wireless Gaming {color}'],
    'br-havit': ['Havit H2002D Gaming Headset {color}','Havit H630BT Wireless ANC {color}'],
    'br-philips': ['Philips TAH8856 Over-Ear ANC {color}','Philips SHP9500 Open-Back Reference','Philips TAH5205 Over-Ear {color}'],
  },
  'cat-av-sport-earphone': {
    'br-shokz': ['Shokz OpenRun Pro 2 Bone Conduction {color}','Shokz OpenRun Pro {color}','Shokz OpenRun {color}','Shokz OpenSwim Pro {color}','Shokz OpenMove {color}'],
    'br-jbl': ['JBL Endurance Peak 3 Sport TWS {color}','JBL Endurance Race 2 {color}','JBL Reflect Aero TWS {color}'],
  },
  'cat-av-speaker': {
    'br-jbl': ['JBL Charge 5 Wi-Fi {color}','JBL Flip 7 {color}','JBL Xtreme 4 {color}','JBL Boombox 3 {color}','JBL PartyBox 320 {color}','JBL Go 4 {color}','JBL Pulse 5 {color}','JBL Clip 5 {color}'],
    'br-sony': ['Sony SRS-XB100 {color}','Sony SRS-XG300 {color}','Sony SRS-XG500 {color}','Sony SRS-RA5000 {color}'],
    'br-marshall': ['Marshall Willen II {color}','Marshall Emberton III {color}','Marshall Tufton {color}','Marshall Woburn III {color}','Marshall Stanmore III {color}'],
    'br-hyundai-audio': ['Hyundai Audio HY-SP01 {color}','Hyundai Audio HY-SP03 Portable {color}','Hyundai Audio HY-SP05 Party {color}'],
    'br-thonet-vander': ['Thonet & Vander Frei 2.0 {color}','Thonet & Vander Kugel {color}','Thonet & Vander Flug {color}','Thonet & Vander Drang {color}'],
    'br-philips': ['Philips TAS2208 Portable {color}','Philips TAS7807 Party {color}','Philips TAB8507 Soundbar'],
    'br-logitech': ['Logitech Z407 2.1 Bluetooth','Logitech Z906 5.1 Surround','Logitech Z207 2.0 Bluetooth'],
  },
  'cat-av-mic': {
    'br-boya': ['Boya BY-M1 Lavalier Microphone','Boya BY-MM1 Cardioid Shotgun','Boya BY-PM700 USB Condenser','Boya BY-WM4 Pro K6 Wireless','Boya BY-V10 Wireless USB-C','Boya BY-MC2 Conference Mic'],
    'br-sony': ['Sony ECM-B10 Compact Shotgun','Sony ECM-W2BT Wireless System','Sony ECM-S1 Wireless Streaming Mic'],
    'br-ulanzi': ['Ulanzi VM-Q1 Wireless Mic USB-C','Ulanzi VM-2 Shotgun Microphone','Ulanzi V-Mic Lite Mini Shotgun'],
  },
  'cat-av-projector': {
    'br-wanbo': ['Wanbo T2 Max New 1080P Projector','Wanbo T4 1080P Auto Focus','Wanbo TT Portable Projector 1080P','Wanbo X5 4K Laser Projector','Wanbo Mozart 1 Pro 1080P','Wanbo DaVinci 1 Pro 1080P'],
  },
  'cat-av-smartglass': {},
  'cat-av-hdd': {
    'br-seagate': ['Seagate Expansion {storage} USB 3.0 Portable','Seagate Expansion Desktop {storage}','Seagate Backup Plus Slim {storage} {color}','Seagate One Touch SSD {storage} {color}','Seagate Barracuda {storage} 7200RPM Internal','Seagate IronWolf {storage} NAS','Seagate FireCuda 530 {storage} NVMe SSD'],
    'br-kingston': ['Kingston XS2000 SSD {storage} USB 3.2','Kingston XS1000 SSD {storage}','Kingston A400 SSD {storage} SATA','Kingston KC3000 {storage} PCIe 4.0 NVMe','Kingston NV2 {storage} NVMe M.2'],
    'br-samsung': ['Samsung T7 Portable SSD {storage} {color}','Samsung T7 Shield SSD {storage} {color}','Samsung T9 SSD {storage} USB 3.2','Samsung 870 EVO {storage} SATA SSD','Samsung 990 Pro {storage} PCIe 4.0 NVMe M.2'],
    'br-adata': ['ADATA HD710 Pro {storage} Shockproof {color}','ADATA HD770G {storage} RGB External','ADATA SE880 {storage} External SSD','ADATA Legend 960 Max {storage} NVMe M.2','ADATA XPG SX8200 Pro {storage} NVMe'],
    'br-kioxia': ['Kioxia Exceria Plus G3 {storage} NVMe M.2','Kioxia Exceria Pro {storage} NVMe','Kioxia Exceria {storage} SATA SSD'],
    'br-orico': ['Orico NVME M.2 SSD Enclosure USB-C','Orico 2.5 inch HDD Enclosure USB 3.0','Orico 3.5 inch HDD Enclosure USB-C'],
  },
  'cat-av-sdcard': {
    'br-sandisk': ['SanDisk Extreme PRO microSDXC {storage} V30 A2','SanDisk Extreme microSDXC {storage} V30','SanDisk Ultra microSDXC {storage} Class 10','SanDisk Extreme PRO SDXC {storage} V30'],
    'br-samsung': ['Samsung EVO Select microSDXC {storage} A2','Samsung Pro Plus microSDXC {storage}','Samsung Pro Ultimate microSDXC {storage}'],
    'br-kingston': ['Kingston Canvas Go Plus microSDXC {storage}','Kingston Canvas React Plus {storage}','Kingston Canvas Select Plus {storage}'],
    'br-kioxia': ['Kioxia Exceria Plus microSDXC {storage} V30','Kioxia Exceria High Endurance {storage}','Kioxia Exceria microSDXC {storage} Class 10'],
    'br-adata': ['ADATA Premier Pro microSDXC {storage} V30 A2','ADATA Premier microSDXC {storage} Class 10'],
  },
  'cat-av-usb': {
    'br-sandisk': ['SanDisk Ultra Flair USB 3.0 {storage}','SanDisk Extreme Pro USB 3.2 {storage}','SanDisk Ultra Dual Drive Go USB-C {storage}','SanDisk Ultra Fit USB 3.1 {storage}'],
    'br-kingston': ['Kingston DataTraveler Exodia M {storage} USB 3.2','Kingston DataTraveler Max {storage} USB 3.2'],
    'br-kioxia': ['Kioxia TransMemory U301 {storage} USB 3.2','Kioxia TransMemory U365 {storage}'],
    'br-adata': ['ADATA UV128 USB 3.2 {storage}','ADATA UE800 USB-C {storage}','ADATA UV150 USB 3.0 {storage}'],
    'br-samsung': ['Samsung FIT Plus USB 3.1 {storage}','Samsung Bar Plus USB 3.1 {storage}'],
  },
  // ── CAMERA ──────────────────────────────────────────────────────
  'cat-cam-security': {
    'br-dahua': ['Dahua IPC-HDW2849H 8MP Smart Dual Light','Dahua IPC-HFW2849S 8MP Bullet','Dahua SD49425XB PTZ 4MP WizMind','Dahua NVR4216 NVR 16CH 4K'],
    'br-tiandy': ['Tiandy TC-C34GS 4MP AI Camera','Tiandy TC-C38XS 8MP ColorVu','Tiandy TC-R3220 NVR 32CH 4K','Tiandy TC-C32QN 2MP IP Camera'],
    'br-ezviz': ['EZVIZ H8C 2K+ PTZ Camera Outdoor','EZVIZ H4 1080P Smart Home Camera','EZVIZ BC1C 2K+ Solar Camera','EZVIZ CB3 2K+ Wire-Free Camera'],
  },
  'cat-cam-indoor': {
    'br-imou': ['Imou Cruiser 2 4MP AI Smart','Imou Cell Go 4MP Color Night','Imou Ranger 2C 4MP 360° PTZ','Imou Cue 3 3MP Indoor'],
    'br-ezviz': ['EZVIZ C6 3K Smart Pan/Tilt','EZVIZ C3W Pro 4MP Color Night','EZVIZ TY2 2MP 360° AI Smart','EZVIZ H6c 2K+ 3MP Indoor'],
    'br-xiaomi': ['Xiaomi Camera 2K Pro 360° AI','Xiaomi Smart Camera C400 4MP 360°','Xiaomi Smart Camera C300 2K WiFi'],
    'br-tplink': ['TP-Link Tapo C225 2.5K QHD Pan/Tilt','TP-Link Tapo C220 4MP Pan/Tilt','TP-Link Tapo C110 3MP Indoor'],
    'br-dahua': ['Dahua IPC-A42P 4MP Pan/Tilt Indoor','Dahua IPC-K22AP 2MP Indoor'],
    'br-tiandy': ['Tiandy TC-H332N 3MP Indoor Pan/Tilt','Tiandy TC-H334N 4MP Smart Indoor'],
  },
  'cat-cam-outdoor': {
    'br-ezviz': ['EZVIZ H8C Pro 4MP Outdoor PTZ','EZVIZ C3X 4MP Outdoor AI','EZVIZ C8C 2K Outdoor Pan/Tilt'],
    'br-imou': ['Imou Bullet 2C 4MP Outdoor','Imou Cell 2 4MP Outdoor Solar','Imou Knight 4K 8MP Outdoor'],
    'br-xiaomi': ['Xiaomi Outdoor Camera AW300 2K','Xiaomi Outdoor Camera CW400 4MP'],
    'br-dahua': ['Dahua IPC-HFW2849S 8MP Outdoor Bullet','Dahua IPC-HFW2441S 4MP Outdoor'],
    'br-tiandy': ['Tiandy TC-C34WS 4MP Outdoor Bullet','Tiandy TC-C38XS 8MP Outdoor ColorVu'],
    'br-insta360': ['Insta360 GO 3S Action Camera 4K','Insta360 X4 360° Action Camera 8K'],
  },
  'cat-cam-solar': {
    'br-ezviz': ['EZVIZ BC1C 2K+ Solar Camera'],
    'br-imou': ['Imou Cell 2 4MP Solar Outdoor Camera'],
  },
  'cat-cam-4g': {
    'br-dahua': ['Dahua IPC-HFW2441S-4G 4MP 4G Camera','Dahua SD49425XB-4G PTZ 4MP 4G'],
    'br-tiandy': ['Tiandy TC-C34GS-4G 4MP 4G Camera','Tiandy TC-C38XS-4G 8MP 4G Outdoor'],
  },
  'cat-cam-doorbell': {
    'br-ezviz': ['EZVIZ DB2 Pro 2K Video Doorbell WiFi','EZVIZ DB1C 1080P Video Doorbell'],
    'br-imou': ['Imou Doorbell Kit 2K WiFi','Imou DB60 2K Battery Doorbell'],
    'br-tplink': ['TP-Link Tapo D230S1 Smart Video Doorbell 2K'],
  },
  'cat-cam-webcam': {
    'br-logitech': ['Logitech StreamCam Full HD 1080p 60fps','Logitech C920s HD Pro 1080p','Logitech Brio 500 Full HD {color}','Logitech MX Brio 705 4K Enterprise','Logitech C505 HD 720p'],
    'br-insta360': ['Insta360 Link 2 4K AI Webcam','Insta360 Link 2C 4K USB-C Webcam'],
  },
  'cat-mobile-acc-case-tablet': {},
  'cat-mobile-acc-airpods-case': {},
  'cat-mobile-acc-fan': {},
  'cat-mobile-acc-pen': {},
  'cat-mobile-acc-strap': {},
};

// ══════════════════════════════════════════════════════════════════
// VARIANT DATA — colors, storages, sizes, etc.
// ══════════════════════════════════════════════════════════════════
const PHONE_COLORS = ['Titanium Black','White Titanium','Desert Titanium','Natural Titanium','Ultramarine','Black','White','Blue','Green','Pink','Purple','Gold','Silver','Red','Icy Blue','Cream','Navy','Teal','Starlight','Midnight'];
const LAPTOP_COLORS = ['Silver','Space Gray','Midnight','Starlight','Blue','Gray','Black','White'];
const ACC_COLORS = ['Black','White','Gray','Blue','Pink','Navy','Green','Silver','Rose Gold','Red','Purple'];
const WATCH_COLORS = ['Black','Silver','Gold','Midnight','Starlight','Rose Gold','Graphite','Cream','Green','Blue','Titanium Gray','White'];
const SPEAKER_COLORS = ['Black','Blue','Red','White','Green','Gray','Teal','Pink','Camo','Squad'];

const PHONE_STORAGES = ['64GB','128GB','256GB','512GB','1TB'];
const TABLET_STORAGES = ['64GB','128GB','256GB','512GB'];
const LAPTOP_RAMS = ['8GB','16GB','32GB','64GB'];
const LAPTOP_SSDS = ['256GB','512GB','1TB','2TB'];
const HDD_STORAGES = ['256GB','500GB','1TB','2TB','4TB','8TB'];
const SDCARD_STORAGES = ['32GB','64GB','128GB','256GB','512GB','1TB'];
const USB_STORAGES = ['32GB','64GB','128GB','256GB','512GB'];
const WATCH_SIZES = ['40mm','42mm','44mm','45mm','46mm','47mm','49mm'];
const WATT_VALUES = ['18W','20W','22.5W','30W','33W','45W','65W','100W','140W'];

const BRANCHES = ['HCM001','HCM002','HN001'];

// ══════════════════════════════════════════════════════════════════
// PRICE RANGES per category (VNĐ)
// ══════════════════════════════════════════════════════════════════
const PRICE_RANGES = {
  'cat-phone': [2000000, 50000000],
  'cat-laptop': [8000000, 90000000],
  'cat-tablet': [3000000, 40000000],
  'cat-watch': [500000, 30000000],
  'cat-mobile-acc-powerbank': [150000, 3000000],
  'cat-mobile-acc-charger': [50000, 2000000],
  'cat-mobile-acc-case-phone': [50000, 1500000],
  'cat-mobile-acc-case-tablet': [100000, 2000000],
  'cat-mobile-acc-screen': [30000, 500000],
  'cat-mobile-acc-cam-cover': [30000, 300000],
  'cat-mobile-acc-airpods-case': [50000, 500000],
  'cat-mobile-acc-fan': [50000, 500000],
  'cat-mobile-acc-pen': [100000, 3000000],
  'cat-mobile-acc-stand': [50000, 1000000],
  'cat-mobile-acc-strap': [30000, 300000],
  'cat-mobile-acc-lens': [100000, 2000000],
  'cat-laptop-acc-hub': [200000, 5000000],
  'cat-laptop-acc-mouse': [100000, 4000000],
  'cat-laptop-acc-keyboard': [200000, 6000000],
  'cat-laptop-acc-router': [200000, 15000000],
  'cat-laptop-acc-bag': [200000, 5000000],
  'cat-laptop-acc-pouch': [100000, 1000000],
  'cat-laptop-acc-keyboard-cover': [50000, 500000],
  'cat-laptop-acc-software': [200000, 10000000],
  'cat-laptop-acc-monitor-stand': [300000, 5000000],
  'cat-laptop-acc-mousepad': [50000, 2000000],
  'cat-laptop-acc-drawing': [500000, 30000000],
  'cat-av-bt-earphone': [200000, 8000000],
  'cat-av-wire-earphone': [50000, 5000000],
  'cat-av-headphone': [200000, 10000000],
  'cat-av-sport-earphone': [300000, 5000000],
  'cat-av-speaker': [200000, 15000000],
  'cat-av-mic': [100000, 10000000],
  'cat-av-projector': [1000000, 30000000],
  'cat-av-smartglass': [500000, 15000000],
  'cat-av-hdd': [200000, 10000000],
  'cat-av-sdcard': [50000, 2000000],
  'cat-av-usb': [50000, 1000000],
  'cat-cam-security': [300000, 10000000],
  'cat-cam-indoor': [300000, 5000000],
  'cat-cam-outdoor': [500000, 8000000],
  'cat-cam-solar': [500000, 5000000],
  'cat-cam-4g': [800000, 10000000],
  'cat-cam-doorbell': [500000, 5000000],
  'cat-cam-webcam': [200000, 5000000],
};

// ══════════════════════════════════════════════════════════════════
// SPECS TEMPLATES per category (HTML)
// ══════════════════════════════════════════════════════════════════
const SPECS_TEMPLATES = {
  'cat-phone': (name, brand) => {
    const screens = ['6.1 inch OLED','6.3 inch Super Retina XDR','6.7 inch AMOLED','6.5 inch IPS LCD','6.8 inch Dynamic AMOLED 2X','6.6 inch LTPO AMOLED'];
    const chips = ['Apple A18 Pro','Snapdragon 8 Gen 3','Dimensity 9300','Snapdragon 7 Gen 3','Exynos 2400','Snapdragon 6 Gen 1'];
    const rams = ['6GB','8GB','12GB','16GB'];
    const cams = ['48MP + 12MP + 12MP','200MP + 50MP + 12MP','50MP + 13MP','108MP + 12MP + 5MP','64MP + 8MP + 2MP'];
    const batts = ['4000mAh','4500mAh','4685mAh','5000mAh','5500mAh','6000mAh'];
    const p = (arr) => arr[Math.floor(Math.random()*arr.length)];
    return `<div class="specs"><h3>${name}</h3><p>Sản phẩm chính hãng ${brand}, bảo hành 12 tháng.</p><table><tr><td>Màn hình</td><td>${p(screens)}</td></tr><tr><td>Chip</td><td>${p(chips)}</td></tr><tr><td>RAM</td><td>${p(rams)}</td></tr><tr><td>Camera</td><td>${p(cams)}</td></tr><tr><td>Pin</td><td>${p(batts)}</td></tr></table></div>`;
  },
  'cat-laptop': (name, brand) => {
    const screens = ['14 inch IPS FHD','15.6 inch OLED 2.8K','16 inch IPS 2.5K 165Hz','14 inch OLED 2.8K','17.3 inch FHD 144Hz'];
    const cpus = ['Intel Core Ultra 7 155H','Intel Core i7-14700HX','AMD Ryzen 7 8845HS','Intel Core Ultra 5 125H','Intel Core i5-13420H','Apple M3','Apple M4 Pro'];
    const p = (arr) => arr[Math.floor(Math.random()*arr.length)];
    return `<div class="specs"><h3>${name}</h3><p>Sản phẩm chính hãng ${brand}, bảo hành 24 tháng.</p><table><tr><td>Màn hình</td><td>${p(screens)}</td></tr><tr><td>CPU</td><td>${p(cpus)}</td></tr><tr><td>Card đồ họa</td><td>Integrated / NVIDIA RTX</td></tr></table></div>`;
  },
  'cat-watch': (name, brand) => {
    const screens = ['1.47 inch AMOLED','1.43 inch AMOLED','1.9 inch AMOLED','1.39 inch OLED','1.2 inch MIP'];
    const batts = ['1-2 ngày','3-5 ngày','7-14 ngày','18 ngày','Lên đến 30 ngày'];
    const p = (arr) => arr[Math.floor(Math.random()*arr.length)];
    return `<div class="specs"><h3>${name}</h3><p>Sản phẩm chính hãng ${brand}. Chống nước 5ATM.</p><table><tr><td>Màn hình</td><td>${p(screens)}</td></tr><tr><td>Pin</td><td>${p(batts)}</td></tr><tr><td>Kết nối</td><td>Bluetooth 5.3, GPS</td></tr></table></div>`;
  },
};

const defaultSpec = (name, brand, catName) =>
  `<div class="specs"><h3>${name}</h3><p>${brand} ${catName} — Sản phẩm chính hãng, chất lượng cao, bảo hành đầy đủ.</p></div>`;

// ══════════════════════════════════════════════════════════════════
// DISTRIBUTION — Phân bổ % theo danh mục lớn
// ══════════════════════════════════════════════════════════════════
const DISTRIBUTION = {
  'phone':       0.15,   // 15% → ~90,000
  'laptop':      0.15,   // 15% → ~90,000
  'tablet':      0.05,   // 5%  → ~30,000
  'watch':       0.08,   // 8%  → ~48,000
  'mobile-acc':  0.22,   // 22% → ~132,000
  'laptop-acc':  0.18,   // 18% → ~108,000
  'av':          0.10,   // 10% → ~60,000
  'camera':      0.07,   // 7%  → ~42,000
};

const CAT_GROUP = {};
for (const catId of LEAF_CATS) {
  if (catId === 'cat-phone') CAT_GROUP[catId] = 'phone';
  else if (catId === 'cat-laptop') CAT_GROUP[catId] = 'laptop';
  else if (catId === 'cat-tablet') CAT_GROUP[catId] = 'tablet';
  else if (catId === 'cat-watch') CAT_GROUP[catId] = 'watch';
  else if (catId.startsWith('cat-mobile-acc')) CAT_GROUP[catId] = 'mobile-acc';
  else if (catId.startsWith('cat-laptop-acc')) CAT_GROUP[catId] = 'laptop-acc';
  else if (catId.startsWith('cat-cam')) CAT_GROUP[catId] = 'camera';
  else CAT_GROUP[catId] = 'av'; // cat-av-*
}

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════
const rand    = (a, b) => Math.random() * (b - a) + a;
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick    = (arr)  => arr.length ? arr[randInt(0, arr.length - 1)] : null;

function getColorsForCat(catId) {
  if (catId === 'cat-phone') return PHONE_COLORS;
  if (catId === 'cat-laptop') return LAPTOP_COLORS;
  if (catId === 'cat-watch') return WATCH_COLORS;
  if (catId.startsWith('cat-av-speaker')) return SPEAKER_COLORS;
  return ACC_COLORS;
}

function getStorageForCat(catId) {
  if (catId === 'cat-phone') return PHONE_STORAGES;
  if (catId === 'cat-tablet') return TABLET_STORAGES;
  if (catId === 'cat-av-hdd') return HDD_STORAGES;
  if (catId === 'cat-av-sdcard') return SDCARD_STORAGES;
  if (catId === 'cat-av-usb') return USB_STORAGES;
  return PHONE_STORAGES;
}

// Build pre-computed brand→cats reverse map
const CAT_TO_BRANDS = {};
for (const catId of LEAF_CATS) {
  CAT_TO_BRANDS[catId] = [];
  for (const [brandId, cats] of Object.entries(BRAND_CAT)) {
    if (cats.includes(catId)) CAT_TO_BRANDS[catId].push(brandId);
  }
  if (CAT_TO_BRANDS[catId].length === 0) CAT_TO_BRANDS[catId].push('br-khac');
}

let _globalIdx = 0;
const _usedNames = new Set();

function makeProduct(catId, brandId) {
  _globalIdx++;
  const idx = _globalIdx;
  const brandName = BRAND_NAMES[brandId] || brandId;
  const catName = CAT_NAMES[catId] || 'Sản phẩm';
  const colors = getColorsForCat(catId);

  // ── Generate unique name ──────────────────────────────────────
  let name;
  const catTemplates = NAME_TEMPLATES[catId];
  const brandTemplates = catTemplates && catTemplates[brandId];

  if (brandTemplates && brandTemplates.length > 0) {
    const template = pick(brandTemplates);
    name = template
      .replace('{color}', pick(colors))
      .replace('{storage}', pick(getStorageForCat(catId)))
      .replace('{ram}', pick(LAPTOP_RAMS))
      .replace('{size}', pick(WATCH_SIZES))
      .replace('{watt}', pick(WATT_VALUES));
  } else {
    // Fallback: generic name
    const adj = pick(['Pro','Max','Ultra','Plus','Lite','Air','Neo','Edge','Prime','Elite','SE','X','Z','S']);
    name = `${brandName} ${catName} ${adj}`;
  }

  // Ensure uniqueness by appending model code
  const modelCode = `${String.fromCharCode(65 + (idx % 26))}${String.fromCharCode(65 + ((idx >> 5) % 26))}${(idx % 10000).toString().padStart(4, '0')}`;
  name = `${name} (${modelCode})`;

  // ── Price ────────────────────────────────────────────────────
  const [minP, maxP] = PRICE_RANGES[catId] || [100000, 5000000];
  const originalPrice = Math.round(rand(minP, maxP) / 1000) * 1000;
  const discountPct = rand(0.03, 0.30);
  const price = Math.round(originalPrice * (1 - discountPct) / 100) * 100;

  // ── Image (unique per product using picsum seed) ─────────────
  const seed1 = `prod${idx}a`;
  const seed2 = `prod${idx}b`;
  const seed3 = `prod${idx}c`;
  const image  = `https://picsum.photos/seed/${seed1}/400/400`;
  const images = JSON.stringify([
    `https://picsum.photos/seed/${seed1}/400/400`,
    `https://picsum.photos/seed/${seed2}/400/400`,
    `https://picsum.photos/seed/${seed3}/400/400`,
  ]);

  // ── Variants ─────────────────────────────────────────────────
  const numColors = randInt(1, 3);
  const usedColors = new Set();
  const variants = [];
  while (variants.length < numColors) {
    const c = pick(colors);
    if (!usedColors.has(c)) {
      usedColors.add(c);
      if (['cat-phone','cat-tablet'].includes(catId)) {
        variants.push({ color: c, storage: pick(getStorageForCat(catId)) });
      } else {
        variants.push({ color: c });
      }
    }
  }

  // ── Description with specs ──────────────────────────────────
  const specFn = SPECS_TEMPLATES[catId];
  const description = specFn
    ? specFn(name, brandName)
    : defaultSpec(name, brandName, catName);

  // ── Branch ──────────────────────────────────────────────────
  const numBranches = randInt(1, BRANCHES.length);
  const branchIds = [...BRANCHES].sort(() => Math.random() - 0.5).slice(0, numBranches);

  return {
    name, price,
    original_price: originalPrice,
    category_id:    catId,
    brand_id:       brandId,
    stock:          randInt(0, 999),
    rating:         Math.round(rand(3.5, 5.0) * 100) / 100,
    sold:           randInt(0, 2000),
    image, images,
    description,
    variants:       JSON.stringify(variants),
    branch_ids:     branchIds,
    is_banner:      false,
    is_deleted:     false,
  };
}

async function insertBatch(rows) {
  await prisma.product.createMany({ data: rows, skipDuplicates: false });
}

function printBar(done, total, startMs, label) {
  const pct     = Math.min(done / total, 1);
  const filled  = Math.round(pct * 40);
  const bar     = '█'.repeat(filled) + '░'.repeat(40 - filled);
  const elapsed = (Date.now() - startMs) / 1000;
  const rps     = done / Math.max(elapsed, 1);
  const eta     = rps > 0 ? Math.ceil((total - done) / rps) : 0;
  const etaStr  = eta > 60 ? `${Math.floor(eta/60)}m${eta%60}s` : `${eta}s`;
  process.stdout.write(
    `\r  [${bar}] ${(pct*100).toFixed(1)}%  ${done.toLocaleString()}/${total.toLocaleString()}` +
    `  ${Math.round(rps).toLocaleString()}/s  ETA:${etaStr}  ${label}      `
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n🚀 MEGA FILL 600,000 PRODUCTS — 67 Brands × 45 Categories');
  console.log('═'.repeat(65));

  // 1. Check brands exist
  const brands = await prisma.brand.findMany({ select: { id: true } });
  const brandIds = new Set(brands.map(b => b.id));
  console.log(`  Brands trong DB: ${brandIds.size}`);

  // 2. Count current
  const currentTotal = await prisma.product.count();
  const needed = Math.max(0, TARGET - currentTotal);
  console.log(`  Sản phẩm hiện tại: ${currentTotal.toLocaleString()}`);
  console.log(`  Mục tiêu         : ${TARGET.toLocaleString()}`);
  console.log(`  Cần thêm         : ${needed.toLocaleString()}`);

  if (needed <= 0) {
    console.log('\n✅ Đã đủ sản phẩm!');
    return;
  }

  // 3. Build job list based on distribution
  console.log('\n  📊 Xây dựng phân bổ sản phẩm...');
  const jobs = []; // { catId, brandId, count }

  // Calculate per-group totals
  const groupTotals = {};
  for (const [group, pct] of Object.entries(DISTRIBUTION)) {
    groupTotals[group] = Math.floor(needed * pct);
  }
  // Fix rounding
  let totalAssigned = Object.values(groupTotals).reduce((a,b) => a+b, 0);
  const diff = needed - totalAssigned;
  groupTotals['mobile-acc'] += diff; // put remainder in largest group

  // For each group, distribute across leaf cats, then across brands
  for (const [group, groupTotal] of Object.entries(groupTotals)) {
    const groupCats = LEAF_CATS.filter(c => CAT_GROUP[c] === group);
    if (groupCats.length === 0) continue;

    const perCat = Math.floor(groupTotal / groupCats.length);
    let catRemainder = groupTotal - perCat * groupCats.length;

    for (const catId of groupCats) {
      const catTotal = perCat + (catRemainder > 0 ? 1 : 0);
      if (catRemainder > 0) catRemainder--;

      const validBrands = CAT_TO_BRANDS[catId].filter(b => brandIds.has(b));
      if (validBrands.length === 0) continue;

      const perBrand = Math.floor(catTotal / validBrands.length);
      let brandRemainder = catTotal - perBrand * validBrands.length;

      for (const brandId of validBrands) {
        const count = perBrand + (brandRemainder > 0 ? 1 : 0);
        if (brandRemainder > 0) brandRemainder--;
        if (count > 0) {
          jobs.push({ catId, brandId, count });
        }
      }
    }
  }

  const totalFromJobs = jobs.reduce((s, j) => s + j.count, 0);
  console.log(`  Jobs tạo: ${jobs.length} cặp (cat, brand)`);
  console.log(`  Tổng SP từ jobs: ${totalFromJobs.toLocaleString()}`);

  // Print distribution summary
  console.log('\n  📋 Phân bổ theo nhóm:');
  for (const [group, total] of Object.entries(groupTotals)) {
    console.log(`    ${group.padEnd(15)} : ${total.toLocaleString().padStart(10)} SP (${(total/needed*100).toFixed(1)}%)`);
  }
  console.log('─'.repeat(65));

  // 4. Execute
  const startMs = Date.now();
  let totalInserted = 0;
  let batch = [];

  for (const job of jobs) {
    for (let i = 0; i < job.count; i++) {
      batch.push(makeProduct(job.catId, job.brandId));
      if (batch.length >= BATCH_SIZE) {
        await insertBatch(batch);
        totalInserted += batch.length;
        batch = [];
        printBar(totalInserted, totalFromJobs, startMs, 'Inserting...');
      }
    }
  }

  if (batch.length > 0) {
    await insertBatch(batch);
    totalInserted += batch.length;
    printBar(totalInserted, totalFromJobs, startMs, 'Done!');
  }

  // 5. Final report
  console.log('\n\n  🔍 Kiểm tra kết quả...');
  const [finalTotal, brandCounts, catCounts] = await Promise.all([
    prisma.product.count(),
    prisma.$queryRaw`SELECT brand_id as id, COUNT(*)::int as cnt FROM "Product" WHERE is_deleted=false GROUP BY brand_id ORDER BY cnt DESC`,
    prisma.$queryRaw`SELECT category_id as id, COUNT(*)::int as cnt FROM "Product" WHERE is_deleted=false GROUP BY category_id ORDER BY cnt DESC`,
  ]);

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

  console.log('\n  ╔══════════════════════════════════════════════════╗');
  console.log('  ║            KẾT QUẢ HOÀN THÀNH                   ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║  Tổng sản phẩm      : ${String(finalTotal.toLocaleString()).padStart(10)}                ║`);
  console.log(`  ║  Đã insert thêm     : ${String(totalInserted.toLocaleString()).padStart(10)}                ║`);
  console.log(`  ║  Thời gian          : ${String(elapsed + 's').padStart(10)}                ║`);
  console.log(`  ║  Tốc độ TB          : ${String(Math.round(totalInserted/elapsed).toLocaleString()+'/s').padStart(10)}                ║`);
  console.log(`  ║  Số brand có SP     : ${String(brandCounts.length).padStart(10)}                ║`);
  console.log(`  ║  Số category có SP  : ${String(catCounts.length).padStart(10)}                ║`);
  console.log('  ╚══════════════════════════════════════════════════╝');

  console.log('\n  📊 Top 15 brand theo số SP:');
  for (const row of brandCounts.slice(0, 15)) {
    const name = BRAND_NAMES[row.id] || row.id;
    console.log(`    ${name.padEnd(20)} : ${String(row.cnt).padStart(10)}`);
  }

  console.log('\n  📊 Top 15 category theo số SP:');
  for (const row of catCounts.slice(0, 15)) {
    const name = CAT_NAMES[row.id] || row.id;
    console.log(`    ${name.padEnd(30)} : ${String(row.cnt).padStart(10)}`);
  }

  // Check brands with 0 products
  const allBrandIds = Object.keys(BRAND_NAMES);
  const brandsWithProducts = new Set(brandCounts.map(r => r.id));
  const emptyBrands = allBrandIds.filter(id => !brandsWithProducts.has(id));
  if (emptyBrands.length > 0) {
    console.log(`\n  ⚠️  ${emptyBrands.length} brand không có sản phẩm: ${emptyBrands.map(id => BRAND_NAMES[id]).join(', ')}`);
  } else {
    console.log('\n  ✅ Tất cả brand đều có sản phẩm!');
  }
}

main()
  .catch(e => { console.error('\n❌ Lỗi:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
