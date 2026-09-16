/**
 * pro-rename.js
 * ─────────────────────────────────────────────────────────────────
 * Đổi tên 600,000 sản phẩm theo format CHUYÊN NGHIỆP
 * học từ 18,000 sản phẩm gốc TGDD.
 *
 * Format mẫu từ TGDD:
 *   Phone:   "Điện thoại Samsung Galaxy S25 Ultra 12GB/256GB"
 *   Laptop:  "Laptop Asus Vivobook 15 OLED A1507QA (Ryzen 5, 16GB, 512GB SSD)"
 *   Watch:   "Đồng hồ thông minh Amazfit Active 3 46mm dây Silicone"
 *   Mouse:   "Chuột Bluetooth Silent Logitech Signature M650"
 *   Camera:  "Camera IP 360 Độ IMOU Ranger 2 A32P Pro"
 *   Speaker: "Loa Bluetooth JBL Flip 7"
 *   USB:     "USB 3.2 64GB Kingston DataTraveler Exodia DTX"
 *   SD:      "Thẻ nhớ SanDisk MicroSD 128GB class 10_U3"
 *
 * Cách dùng:
 *   node scripts/pro-rename.js
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
const BATCH = 5000;

// ══════════════════════════════════════════════════════════════════
// BRAND NAME MAP
// ══════════════════════════════════════════════════════════════════
const BN = {
  'br-adata':'ADATA','br-avaplus':'AVA+','br-acer':'Acer','br-akko':'Akko',
  'br-alpha-works':'Alpha Works','br-amazfit':'Amazfit','br-anker':'Anker',
  'br-apple':'Apple','br-asus':'Asus','br-baseus':'Baseus','br-boya':'Boya',
  'br-corsair':'Corsair','br-dahua':'Dahua','br-dareu':'Dareu','br-dell':'Dell',
  'br-ezviz':'EZVIZ','br-eroc':'Eroc','br-honor':'HONOR','br-hp':'HP',
  'br-havit':'Havit','br-huawei':'Huawei','br-hydrus':'Hydrus',
  'br-hyperwork':'HyperWork','br-hyperspace':'Hyperspace',
  'br-hyundai-audio':'Hyundai Audio','br-imou':'IMOU','br-innostyle':'Innostyle',
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
  'br-realme':'realme','br-vivo':'vivo','br-khac':'',
};

const pick = a => a[Math.floor(Math.random()*a.length)];
const randInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a;

// ══════════════════════════════════════════════════════════════════
// REALISTIC NAME POOLS — format TGDD
// ══════════════════════════════════════════════════════════════════

// ── ĐIỆN THOẠI ──────────────────────────────────────────────────
const PHONE_MODELS = {
  'br-apple': [
    {model:'iPhone 17 Pro Max',ram:'8GB',storages:['256GB','512GB','1TB']},
    {model:'iPhone 17 Pro',ram:'8GB',storages:['128GB','256GB','512GB']},
    {model:'iPhone 17',ram:'8GB',storages:['128GB','256GB']},
    {model:'iPhone 17 Air',ram:'8GB',storages:['128GB','256GB']},
    {model:'iPhone 16 Pro Max',ram:'8GB',storages:['256GB','512GB','1TB']},
    {model:'iPhone 16 Pro',ram:'8GB',storages:['128GB','256GB','512GB']},
    {model:'iPhone 16 Plus',ram:'8GB',storages:['128GB','256GB','512GB']},
    {model:'iPhone 16',ram:'8GB',storages:['128GB','256GB']},
    {model:'iPhone 15 Pro Max',ram:'8GB',storages:['256GB','512GB','1TB']},
    {model:'iPhone 15',ram:'6GB',storages:['128GB','256GB']},
    {model:'iPhone SE 4',ram:'8GB',storages:['128GB','256GB']},
  ],
  'br-samsung': [
    {model:'Samsung Galaxy S26 Ultra 5G',ram:'12GB',storages:['256GB','512GB','1TB']},
    {model:'Samsung Galaxy S26+ 5G',ram:'12GB',storages:['256GB','512GB']},
    {model:'Samsung Galaxy S26 5G',ram:'8GB',storages:['128GB','256GB']},
    {model:'Samsung Galaxy S25 Ultra 5G',ram:'12GB',storages:['256GB','512GB','1TB']},
    {model:'Samsung Galaxy S25+ 5G',ram:'12GB',storages:['256GB','512GB']},
    {model:'Samsung Galaxy S25 5G',ram:'8GB',storages:['128GB','256GB']},
    {model:'Samsung Galaxy Z Fold8 5G',ram:'12GB',storages:['256GB','512GB']},
    {model:'Samsung Galaxy Z Flip8 5G',ram:'8GB',storages:['256GB','512GB']},
    {model:'Samsung Galaxy A56 5G',ram:'8GB',storages:['128GB','256GB']},
    {model:'Samsung Galaxy A37 5G',ram:'6GB',storages:['128GB','256GB']},
    {model:'Samsung Galaxy A26 5G',ram:'6GB',storages:['128GB']},
    {model:'Samsung Galaxy A16 5G',ram:'4GB',storages:['128GB']},
    {model:'Samsung Galaxy M55 5G',ram:'8GB',storages:['128GB','256GB']},
  ],
  'br-oppo': [
    {model:'OPPO Find X8 Pro',ram:'12GB',storages:['256GB','512GB']},
    {model:'OPPO Find X8',ram:'12GB',storages:['256GB','512GB']},
    {model:'OPPO Reno16 Pro 5G',ram:'12GB',storages:['256GB','512GB']},
    {model:'OPPO Reno16 5G',ram:'8GB',storages:['128GB','256GB']},
    {model:'OPPO Reno16 F',ram:'8GB',storages:['128GB','256GB']},
    {model:'OPPO A6',ram:'8GB',storages:['128GB','256GB']},
    {model:'OPPO A3 Pro 5G',ram:'8GB',storages:['128GB','256GB']},
    {model:'OPPO A18',ram:'4GB',storages:['64GB','128GB']},
  ],
  'br-xiaomi': [
    {model:'Xiaomi 15 Ultra',ram:'16GB',storages:['256GB','512GB']},
    {model:'Xiaomi 15 Pro',ram:'12GB',storages:['256GB','512GB']},
    {model:'Xiaomi 17T 5G',ram:'12GB',storages:['256GB','512GB']},
    {model:'Xiaomi Redmi Note 17 Pro 5G',ram:'8GB',storages:['128GB','256GB']},
    {model:'Xiaomi Redmi Note 17 Pro Max 5G',ram:'12GB',storages:['256GB','512GB']},
    {model:'Xiaomi Redmi Note 17 4G',ram:'6GB',storages:['128GB']},
    {model:'Xiaomi Poco X6 Pro 5G',ram:'8GB',storages:['256GB','512GB']},
    {model:'Xiaomi Poco F6 Pro 5G',ram:'12GB',storages:['256GB','512GB']},
    {model:'Xiaomi Redmi 14C',ram:'4GB',storages:['64GB','128GB']},
  ],
  'br-vivo': [
    {model:'vivo X300 Ultra',ram:'12GB',storages:['256GB','512GB']},
    {model:'vivo V70 FE',ram:'8GB',storages:['128GB','256GB']},
    {model:'vivo V40 Pro 5G',ram:'12GB',storages:['256GB','512GB']},
    {model:'vivo V40 5G',ram:'8GB',storages:['128GB','256GB']},
    {model:'vivo Y300 Pro+ 5G',ram:'8GB',storages:['128GB','256GB']},
    {model:'vivo Y200 5G',ram:'8GB',storages:['128GB','256GB']},
    {model:'vivo Y19s',ram:'4GB',storages:['64GB','128GB']},
  ],
  'br-realme': [
    {model:'realme GT 7 5G',ram:'12GB',storages:['256GB','512GB']},
    {model:'realme 16T 5G',ram:'8GB',storages:['128GB','256GB']},
    {model:'realme 14 Pro+ 5G',ram:'12GB',storages:['256GB','512GB']},
    {model:'realme 14 Pro 5G',ram:'8GB',storages:['128GB','256GB']},
    {model:'realme C75 5G',ram:'6GB',storages:['128GB']},
    {model:'realme C65 5G',ram:'4GB',storages:['64GB','128GB']},
  ],
  'br-honor': [
    {model:'HONOR 600 Lite',ram:'8GB',storages:['128GB','256GB']},
    {model:'HONOR Magic6 Pro',ram:'12GB',storages:['256GB','512GB']},
    {model:'HONOR 200 Pro',ram:'12GB',storages:['256GB','512GB']},
    {model:'HONOR X9b 5G',ram:'8GB',storages:['128GB','256GB']},
    {model:'HONOR X8b',ram:'8GB',storages:['128GB','256GB']},
  ],
  'br-motorola': [
    {model:'Motorola Razr Fold',ram:'12GB',storages:['256GB','512GB']},
    {model:'Motorola Edge 50 Pro 5G',ram:'12GB',storages:['256GB','512GB']},
    {model:'Motorola Edge 50 Neo 5G',ram:'8GB',storages:['128GB','256GB']},
    {model:'Motorola Moto G85 5G',ram:'8GB',storages:['128GB','256GB']},
  ],
  'br-huawei': [
    {model:'Huawei Pura 70 Ultra',ram:'16GB',storages:['256GB','512GB']},
    {model:'Huawei Pura 70 Pro',ram:'12GB',storages:['256GB','512GB']},
    {model:'Huawei Nova 13 Ultra',ram:'12GB',storages:['256GB','512GB']},
  ],
  'br-khac': [
    {model:'Nothing Phone (4a) 5G',ram:'8GB',storages:['128GB','256GB']},
    {model:'Nothing Phone (3a) 5G',ram:'8GB',storages:['128GB','256GB']},
    {model:'Infinix Hot 60 Pro',ram:'8GB',storages:['128GB','256GB']},
    {model:'TECNO Spark 30 Pro',ram:'8GB',storages:['128GB','256GB']},
    {model:'Nokia C110 4G',ram:'4GB',storages:['64GB','128GB']},
    {model:'itel P65',ram:'4GB',storages:['64GB','128GB']},
    {model:'Masstel Tango 20 4G',ram:'3GB',storages:['32GB','64GB']},
    {model:'Benco V91',ram:'4GB',storages:['64GB','128GB']},
  ],
};

function genPhoneName(brandId) {
  const models = PHONE_MODELS[brandId] || PHONE_MODELS['br-khac'];
  const m = pick(models);
  const s = pick(m.storages);
  return `Điện thoại ${m.model} ${m.ram}/${s}`;
}

// ── LAPTOP ──────────────────────────────────────────────────────
const LAPTOP_MODELS = {
  'br-apple': [
    'MacBook Air M5 13 inch 16GB/{ssd}','MacBook Air M5 15 inch 16GB/{ssd}',
    'MacBook Air M3 13 inch 8GB/{ssd}','MacBook Air M3 15 inch 16GB/{ssd}',
    'MacBook Neo 13 inch A18 Pro 8GB/{ssd}',
    'MacBook Pro M4 Pro 14 inch 24GB/{ssd}','MacBook Pro M4 Pro 16 inch 24GB/{ssd}',
    'MacBook Pro M4 Max 16 inch 48GB/{ssd}',
  ],
  'br-asus': [
    'Laptop Asus Vivobook 15 OLED A1507QA (Snapdragon X, {ram}, {ssd} SSD)',
    'Laptop Asus Vivobook S14 S3407VA (Core 5 210H, {ram}, {ssd} SSD)',
    'Laptop Asus X1504VA (Core 5, {ram}, {ssd} SSD)',
    'Laptop Asus Vivobook 16X K3605ZF (i7 12700H, {ram}, {ssd} SSD, RTX 2050)',
    'Laptop Asus ROG Strix G16 G614JVR (i9 14900HX, {ram}, {ssd} SSD, RTX 4060)',
    'Laptop Asus ROG Zephyrus G14 GA403UV (Ryzen AI 9, {ram}, {ssd} SSD, RTX 4060)',
    'Laptop Asus Zenbook 14 OLED UX3405MA (Ultra 7, {ram}, {ssd} SSD)',
    'Laptop Asus TUF Gaming A15 FA507RC (Ryzen 7, {ram}, {ssd} SSD, RTX 4050)',
    'Laptop Asus ExpertBook B5 B5404CVA (Ultra 7, {ram}, {ssd} SSD)',
  ],
  'br-hp': [
    'Laptop HP 15 FC0023AU (R5 7520U, {ram}, {ssd} SSD)',
    'Laptop HP 240R G10 (Core 5 120U, {ram}, {ssd} SSD)',
    'Laptop HP 245 G10 (R5, {ram}, {ssd} SSD)',
    'Laptop HP Pavilion 15 EG3078TU (i5 1334U, {ram}, {ssd} SSD)',
    'Laptop HP Envy x360 14 (Ultra 5, {ram}, {ssd} SSD)',
    'Laptop HP Victus 16 (i7 14700HX, {ram}, {ssd} SSD, RTX 4060)',
    'Laptop HP Omen 16 (i9 14900HX, {ram}, {ssd} SSD, RTX 4070)',
    'Laptop HP ZBook Firefly 14 G11 (Ultra 7, {ram}, {ssd} SSD)',
  ],
  'br-dell': [
    'Laptop Dell 15 DC15250 (i5 1334U, {ram}, {ssd} SSD)',
    'Laptop Dell 15 DC15255 (R5 7530U, {ram}, {ssd} SSD)',
    'Laptop Dell Inspiron 16 5630 (i7 1360P, {ram}, {ssd} SSD)',
    'Laptop Dell XPS 13 9340 (Ultra 7, {ram}, {ssd} SSD)',
    'Laptop Dell Vostro 15 3520 (i5 1235U, {ram}, {ssd} SSD)',
    'Laptop Dell G15 5530 (i7 13650HX, {ram}, {ssd} SSD, RTX 4060)',
    'Laptop Dell Alienware m18 R2 (i9 14900HX, {ram}, {ssd} SSD, RTX 4090)',
    'Laptop Dell Latitude 5540 (i5 1345U, {ram}, {ssd} SSD)',
  ],
  'br-lenovo': [
    'Laptop Lenovo IdeaPad Slim 3 15IAH8 (i5 12450H, {ram}, {ssd} SSD)',
    'Laptop Lenovo IdeaPad Slim 3 15IPH11 (Ultra 5, {ram}, {ssd} SSD)',
    'Laptop Lenovo IdeaPad Slim 5 15ARP10 (R5 7535HS, {ram}, {ssd} SSD)',
    'Laptop Lenovo LOQ 15 (i5 13420H, {ram}, {ssd} SSD, RTX 3050)',
    'Laptop Lenovo Legion 5 (R7 7840HS, {ram}, {ssd} SSD, RTX 4060)',
    'Laptop Lenovo Legion Pro 5 (i9 14900HX, {ram}, {ssd} SSD, RTX 4070)',
    'Laptop Lenovo ThinkPad X1 Carbon Gen 12 (Ultra 7, {ram}, {ssd} SSD)',
    'Laptop Lenovo Yoga 7 2-in-1 14 (Ultra 5, {ram}, {ssd} SSD)',
  ],
  'br-acer': [
    'Laptop Acer Aspire Lite 14 (R7 7730U, {ram}, {ssd} SSD)',
    'Laptop Acer Aspire Go 15 (Core 5 120U, {ram}, {ssd} SSD)',
    'Laptop Acer Aspire 3 15 (i5 1235U, {ram}, {ssd} SSD)',
    'Laptop Acer Swift Go 14 (Ultra 5, {ram}, {ssd} SSD)',
    'Laptop Acer Nitro V 15 (i5 13420H, {ram}, {ssd} SSD, RTX 3050)',
    'Laptop Acer Nitro V 16 (R5 7535HS, {ram}, {ssd} SSD, RTX 4050)',
    'Laptop Acer Predator Helios Neo 16 (i7 14700HX, {ram}, {ssd} SSD, RTX 4070)',
  ],
  'br-msi': [
    'Laptop MSI Modern 15 F1MG (Core 5 120U, {ram}, {ssd} SSD)',
    'Laptop MSI Modern 15 F13MG (i5 1334U, {ram}, {ssd} SSD)',
    'Laptop MSI Thin 15 B13UC (i5 13420H, {ram}, {ssd} SSD, RTX 2050)',
    'Laptop MSI Katana 15 B13VFK (i7 13620H, {ram}, {ssd} SSD, RTX 4060)',
    'Laptop MSI Raider GE78 HX (i9 14900HX, {ram}, {ssd} SSD, RTX 4080)',
    'Laptop MSI Stealth 16 AI (Ultra 9, {ram}, {ssd} SSD, RTX 4090)',
    'Laptop MSI Prestige 16 AI Evo (Ultra 7, {ram}, {ssd} SSD)',
  ],
  'br-microsoft': [
    'Microsoft Surface Pro 11 (Ultra 5, {ram}, {ssd} SSD)',
    'Microsoft Surface Laptop 6 13.5 inch (Ultra 5, {ram}, {ssd} SSD)',
    'Microsoft Surface Laptop 6 15 inch (Ultra 7, {ram}, {ssd} SSD)',
    'Microsoft Surface Laptop Studio 2 (i7 13700H, {ram}, {ssd} SSD, RTX 4060)',
  ],
  'br-razer': [
    'Laptop Razer Blade 16 (Ultra 9, {ram}, {ssd} SSD, RTX 4090)',
    'Laptop Razer Blade 14 (R9 7940HS, {ram}, {ssd} SSD, RTX 4070)',
  ],
  'br-machenike': [
    'Laptop Machenike Star 15 (i7 13620H, {ram}, {ssd} SSD, RTX 4060)',
    'Laptop Machenike Star 16 (i9 14900HX, {ram}, {ssd} SSD, RTX 4070)',
    'Laptop Machenike L17 Pro (i7 14700HX, {ram}, {ssd} SSD, RTX 4060)',
  ],
  'br-singpc': [
    'Laptop SingPC M16 (i5 1235U, {ram}, {ssd} SSD)',
    'Laptop SingPC M15 Pro (i7 12700H, {ram}, {ssd} SSD)',
  ],
  'br-khac': [
    'Laptop Gigabyte G5 MF (i5 12500H, {ram}, {ssd} SSD, RTX 4050)',
    'Laptop LG Gram 16 (Ultra 7, {ram}, {ssd} SSD)',
  ],
};
const LAPTOP_RAMS = ['8GB','16GB','32GB','64GB'];
const LAPTOP_SSDS = ['256GB','512GB','1TB','2TB'];

function genLaptopName(brandId) {
  const models = LAPTOP_MODELS[brandId] || LAPTOP_MODELS['br-khac'];
  const tpl = pick(models);
  return tpl.replace('{ram}',pick(LAPTOP_RAMS)).replace('{ssd}',pick(LAPTOP_SSDS));
}

// ── TABLET ──────────────────────────────────────────────────────
const TABLET_TEMPLATES = {
  'br-apple': ['iPad Pro M5 WiFi 11 inch {st}','iPad Pro M5 WiFi 13 inch {st}','iPad Air M4 11 inch WiFi {st}','iPad Air M4 13 inch WiFi {st}','iPad mini 7 WiFi {st}','iPad 11 WiFi {st}','iPad 11 5G {st}'],
  'br-samsung': ['Samsung Galaxy Tab S11 5G {st}','Samsung Galaxy Tab S10 Lite 5G {st}','Samsung Galaxy Tab S10 FE WiFi {st}','Samsung Galaxy Tab A11 Plus WiFi {st}','Samsung Galaxy Tab A11 Plus 5G {st}','Samsung Galaxy Tab A11 4G {st}'],
  'br-xiaomi': ['Xiaomi Pad 8 {st}','Xiaomi Pad 8 Pro {st}','Xiaomi Redmi Pad 2 {st}','Xiaomi Redmi Pad 2 Pro {st}'],
  'br-lenovo': ['Lenovo IdeaTab 5G {st}','Lenovo Tab P12 Pro {st}','Lenovo Tab M11 {st}'],
  'br-honor': ['HONOR Pad X9 WiFi {st}','HONOR Pad 9 WiFi {st}'],
  'br-khac': ['OPPO Pad 5 {st}','OPPO Pad SE {st}','OPPO Pad Neo {st}','OPPO Pad 3 {st}'],
};
const TAB_STORAGES = ['64GB','128GB','256GB','512GB'];

function genTabletName(brandId) {
  const tpls = TABLET_TEMPLATES[brandId] || TABLET_TEMPLATES['br-khac'];
  return pick(tpls).replace('{st}',pick(TAB_STORAGES));
}

// ── SMARTWATCH ──────────────────────────────────────────────────
const WATCH_TEMPLATES = {
  'br-apple': ['Apple Watch Series 11 {sz} viền nhôm dây thể thao','Apple Watch SE 3 {sz} viền nhôm dây thể thao','Apple Watch SE 3 GPS Cellular {sz} viền nhôm dây thể thao','Apple Watch Ultra 3 GPS Cellular 49mm viền Titanium dây Ocean'],
  'br-samsung': ['Samsung Galaxy Watch9 Bluetooth {sz} dây Silicone','Samsung Galaxy Watch Ultra 2','Samsung Galaxy Watch8 Classic Bluetooth {sz} dây Silicone','Samsung Galaxy Watch FE {sz} dây Silicone','Samsung Galaxy Fit4'],
  'br-xiaomi': ['Vòng đeo tay thông minh Xiaomi Smart Band 10 Pro viền gốm','Vòng đeo tay thông minh Mi Band 10 Pro','Xiaomi Watch S4 Sport {sz}','Xiaomi Watch S3 {sz}','Redmi Watch 5 Lite','Redmi Watch 4'],
  'br-amazfit': ['Amazfit Active 3 Premium {sz} dây Silicone','Amazfit Bip Max {sz} dây Silicone','Amazfit Balance {sz}','Amazfit T-Rex Ultra {sz}','Amazfit GTR 4 {sz}','Amazfit GTS 4 Mini','Amazfit Active {sz}'],
  'br-huawei': ['Huawei Watch Fit 5 {sz} dây Nylon','Huawei Watch Fit 5 Pro {sz} dây Nylon','Huawei Watch GT Runner 2 {sz} dây Nylon','Huawei Watch 5 {sz}','Huawei Watch 5 {sz} dây Composite','Huawei Watch Fit 4','Vòng đeo tay thông minh Huawei Band 11 dây cao su','Vòng đeo tay thông minh Huawei Band 11 Pro dây Nylon dệt'],
  'br-honor': ['HONOR Watch 5 {sz}','HONOR Band 9 dây Silicone','HONOR Watch GS Pro {sz}'],
  'br-kidcare': ['Đồng hồ định vị trẻ em Kidcare Sight S25','Đồng hồ định vị trẻ em Kidcare K25','Đồng hồ định vị trẻ em Kidcare S20 Pro','Đồng hồ định vị trẻ em Kidcare 08S Pro'],
  'br-khac': ['Garmin Fenix 8 Solar {sz}','Garmin Forerunner 265','Fitbit Charge 6','Polar Pacer Pro'],
};
const WATCH_SIZES = ['40mm','42mm','44mm','46mm','46.8mm','49.5mm','43.5mm'];

function genWatchName(brandId) {
  const tpls = WATCH_TEMPLATES[brandId] || WATCH_TEMPLATES['br-khac'];
  return pick(tpls).replace('{sz}',pick(WATCH_SIZES));
}

// ══════════════════════════════════════════════════════════════════
// PHỤ KIỆN DI ĐỘNG — format TGDD
// ══════════════════════════════════════════════════════════════════
const ACC_TEMPLATES = {
  'cat-mobile-acc-charger': {
    'br-anker':['Adapter sạc nhanh Type C IQ3 45W Anker Nano A121D','Bộ sạc nhanh 3 cổng USB Type C IQ4 GaN 100W Anker B121B kèm cáp Type C','Adapter sạc 4 cổng USB Type C IQ3 GaN 140W AI LED Display Anker Zolo B2697','Cáp Type C Type C 1.8m Anker Zolo A8060'],
    'br-apple':['Adapter sạc Type C 20W cho iPhone iPad Apple MHJE3','Adapter sạc Dual Type C 35W Apple MNWP3','Adapter sạc Type C 30W iPhone iPad MacBook Apple MY1W2','Cáp Type C Lightning 1m Apple MX0K2'],
    'br-baseus':['Adapter 2 cổng USB Type C PD kèm cáp Type C 100W Baseus CCGAN100E5','Cáp Type C Lightning 1m Baseus Titanium Alloy CB000135'],
    'br-samsung':['Adapter sạc Type C PD 25W Samsung EP-T2510N','Bộ Adapter sạc kèm cáp Type C Type C PD 45W Samsung EP-T4511XB','Adapter sạc Type C PD 45W Samsung EP-T4511NB'],
    'br-ugreen':['Adapter sạc Type C PD QC 4.0 GaN 30W Ugreen Nexode CD319','Adapter sạc 4 cổng USB Type C PD QC3.0 GaN 100W Ugreen Robot Uno X688','Adapter sạc 3 cổng USB Type C PD 3.0 GaN 100W Ugreen Nexode Pro X757'],
    'br-xmobile':['Adapter sạc Type C PD 20W Xmobile DS602A','Adapter sạc 2 cổng Type C PD QC 3.0 20W Xmobile DC02','Xmobile CS 65W AW kèm cáp dây rút Type C và sạc Apple Watch','Cáp sạc nhanh lò xo đa năng 4 in 1 Lightning Type C 60W 1.5m Xmobile CS312'],
    'br-innostyle':['Adapter sạc Type C PD 30W Innostyle','Cáp USB-C 100W 2m Innostyle Premium'],
    'br-oppo':['Adapter sạc nhanh SUPERVOOC 80W OPPO','Cáp Type C VOOC 65W OPPO'],
    'br-xiaomi':['Adapter sạc 67W GaN USB-C Xiaomi','Adapter sạc HyperCharge 120W Xiaomi'],
    'br-vivo':['Adapter sạc FlashCharge 44W vivo','Cáp USB-C 33W 1m vivo'],
    'br-realme':['Adapter sạc SUPERVOOC 65W realme','Cáp USB-C SuperDart 1m realme'],
    'br-honor':['Adapter sạc SuperCharge 66W HONOR','Cáp USB-C 6A 1m HONOR'],
    'br-huawei':['Adapter sạc SuperCharge 66W Huawei','Sạc nhanh ô tô 40W USB-C Huawei'],
    'br-avaplus':['Adapter sạc USB-C PD 30W AVA+','Cáp USB-C 60W 1.2m AVA+','Sạc xe hơi USB-C 36W AVA+'],
    'br-alpha-works':['Adapter sạc GaN 65W Alpha Works','Cáp USB-C 100W 2m Alpha Works'],
    'br-eroc':['Adapter sạc Mini 30W USB-C Eroc','Cáp USB-C 3A 1m Eroc'],
    'br-hyperspace':['Adapter sạc GaN 100W 3 cổng Hyperspace','Cáp USB-C 240W 2m Hyperspace'],
  },
  'cat-mobile-acc-powerbank': {
    'br-anker':['Pin dự phòng 10000mAh PowerCore Slim PD 20W Anker A1229','Pin dự phòng 20000mAh PowerCore PD 65W Anker A1287','Pin dự phòng 24000mAh Power Bank 140W Anker 737 A1289'],
    'br-baseus':['Pin dự phòng 20000mAh Adaman2 65W Baseus PSMN-C','Pin dự phòng 10000mAh Elf Digital 22.5W Baseus PPJL-A','Pin dự phòng 30000mAh Star-Lord 30W Baseus PPXJ-C'],
    'br-xiaomi':['Pin dự phòng 10000mAh Xiaomi 33W Power Bank PB100SZM','Pin dự phòng 20000mAh Xiaomi 50W Power Bank PB200SZM'],
    'br-xmobile':['Pin dự phòng 20000mAh 22.5W Xmobile Energy DS032','Pin dự phòng 10000mAh PD 20W Xmobile Pro DS044'],
    'br-realme':['Pin dự phòng 10000mAh 30W realme PB1','Pin dự phòng 20000mAh 33W realme PB2'],
    'br-innostyle':['Pin dự phòng 20000mAh PD 65W Innostyle Powergo Pro','Pin dự phòng 10000mAh 30W Innostyle Powergo Ultra'],
    'br-alpha-works':['Pin dự phòng 20000mAh 65W Alpha Works Power Pro','Pin dự phòng 10000mAh 22.5W Alpha Works Compact'],
    'br-eroc':['Pin dự phòng 20000mAh 45W Eroc Power Station','Pin dự phòng 10000mAh 22.5W Eroc Slim'],
    'br-hyperspace':['Pin dự phòng 20000mAh 65W Hyperspace Power Max','Pin dự phòng 10000mAh 30W Hyperspace Slim'],
  },
  'cat-mobile-acc-case-phone': {
    'br-baseus':['Ốp lưng iPhone 17 Pro Max nhựa dẻo TPU Baseus Crystal','Ốp lưng Samsung Galaxy S26 Ultra nhựa cứng PC Baseus Glitter','Ốp lưng iPhone 16 Pro MagSafe Baseus Magnetic'],
    'br-apple':['Ốp lưng FineWoven iPhone 16 Pro Max MagSafe Apple','Ốp lưng Silicone iPhone 16 Pro MagSafe Apple','Ốp lưng trong suốt iPhone 16 MagSafe Apple'],
    'br-samsung':['Ốp lưng Samsung Galaxy S26 Ultra Standing Grip Case Samsung','Ốp lưng Samsung Galaxy S25+ Clear Gadget Case Samsung'],
    'br-hydrus':['Ốp lưng iPhone 17 Pro Max trong suốt Hydrus Crystal Clear','Ốp lưng Samsung Galaxy S26 Ultra chống sốc Hydrus Tough Armor'],
    'br-jcpal':['Ốp lưng iPhone 17 Pro Max iGuard JCPAL','Ốp lưng Samsung Galaxy S25 FlexForm JCPAL'],
    'br-avaplus':['Ốp lưng iPhone 16 Pro Max trong suốt AVA+ Clear','Ốp lưng Samsung Galaxy S25 nhựa dẻo TPU AVA+'],
    'br-xmobile':['Ốp lưng iPhone 16 Pro Silicone Xmobile','Ốp lưng Samsung Galaxy S25 trong suốt Xmobile Clear'],
  },
  'cat-mobile-acc-case-tablet': {
    'br-apple':['Bao da Smart Folio cho iPad Pro M5 11 inch Apple','Bao da Smart Folio cho iPad Air M4 11 inch Apple','Ốp lưng iPad mini 7 nắp gập Apple Smart Folio'],
    'br-samsung':['Bao da Galaxy Tab S11 Samsung kèm bàn phím AI','Bao da Galaxy Tab S10 FE Samsung kèm bàn phím AI','Bao da Galaxy Tab A11 Plus Samsung'],
    'br-avaplus':['Bao da iPad 11 PU PC AVA+ OC Mesa Click','Bao da Xiaomi Pad 2 PU PC AVA+ OC Cloud','Bao da Galaxy Tab A11 Plus PU PC AVA+ OC Cloud'],
    'br-khac':['Bao da iPad Air M4 nắp gập TPU PU ESR Rebound Magnetic','Ốp lưng iPad mini 6 nắp gập PC Proud JM','Bao da iPad Air 6 13 inch Uniq Camden Click'],
  },
  'cat-mobile-acc-screen': {
    'br-jcpal':['Miếng dán kính cường lực iPhone 17 Pro Max JCPAL','Miếng dán kính cường lực iPhone 17 Pro JCPAL','Miếng dán MacBook Neo 13 inch JCPAL'],
    'br-hydrus':['Miếng dán kính cường lực iPhone 17 Pro Max chống nhìn trộm Hydrus','Miếng dán kính cường lực Samsung Galaxy S26 Ultra Hydrus Nano Film'],
    'br-baseus':['Miếng dán kính cường lực iPhone 16 Pro Max 0.3mm Baseus Crystal 2 miếng','Miếng dán kính Samsung Galaxy S25 chống vân tay Baseus Diamond'],
    'br-avaplus':['Miếng dán kính cường lực iPhone 17 Pro Max AVA+','Miếng dán kính cường lực chống nhìn trộm iPhone 17 Pro AVA+'],
    'br-khac':['Miếng dán kính cường lực iPhone 16 Pro Max Premium Jincase','Miếng dán kính cường lực Samsung Galaxy A06 Jincase','Miếng dán kính cường lực iPhone 17 Air Uniq'],
  },
  'cat-mobile-acc-cam-cover': {
    'br-jcpal':['Miếng dán camera iPhone 17 Pro/17 Pro Max kính thủy tinh JCPAL','Miếng dán camera iPhone 16 Pro/16 Pro Max JCPAL'],
    'br-hydrus':['Miếng dán camera iPhone 17 Pro Max Hydrus Crystal','Miếng dán camera Samsung Galaxy S26 Ultra Hydrus Shield'],
    'br-khac':['Miếng dán camera iPhone 17 Pro Max Optix viền nhôm thủy tinh Uniq','Miếng dán camera iPhone 17 Air Optix PC thủy tinh Uniq','Miếng dán camera iPhone 16 Pro Max Silicat Mipow','Miếng dán camera iPhone 17 Pro Max Dekey 3D Camera Lens'],
  },
  'cat-mobile-acc-airpods-case': {
    'br-khac':['Túi đựng AirPods Pro 3 Silicone PC Uniq Lino Liquid','Túi đựng AirPods 4 Silicone PC kèm móc Uniq Nexo Active Hybrid','Túi đựng AirPods Pro 3 TPU Uniq Glase','Túi đựng AirPods Pro 3 PC TPU Uniq Clyde','Túi đựng AirPods Pro 2 da PU nhua PC Uniq Coehl Haven','Túi đựng AirPods 1/2 Silicone kèm móc JM FR03','Túi đựng AirPods Pro 3 PU PC Uniq Lyden Vex'],
  },
  'cat-mobile-acc-stand': {
    'br-ulanzi':['Giá đỡ điện thoại kiêm Tripod mini Magnetic 24cm Ulanzi MA60','Giá đỡ điện thoại Magnetic kết hợp đế hít Silicone Ulanzi MA39','Giá đỡ điện thoại Magnetic gấp gọn Ulanzi MA02'],
    'br-avaplus':['Đế điện thoại xoay 360° CS-SP003 AVA+','Đế điện thoại xoay 360° CS-SP007 AVA+','Giá đỡ điện thoại đeo cổ AVA+ JCS1132'],
    'br-khac':['Đế laptop Orico PFB-A24','Đế laptop Havit ST7304','Đế laptop xoay 360° Havit ST7411','Giá đỡ điện thoại kẹp cửa gió xe hơi Havit ST7211','Đế laptop JCPAL JCP6257','Đế laptop HyperStand HTU6-GR'],
  },
  'cat-mobile-acc-fan': {
    'br-avaplus':['Quạt cầm tay AVA+ JF-402','Quạt cầm tay AVA+ JF-312','Quạt cầm tay AVA+ JF-203','Quạt cầm tay AVA+ JF-412','Quạt cầm tay AVA+ Mini JF329','Quạt để bàn xoay 160 độ AVA+ JF418','Quạt để bàn AVA+ JF83'],
    'br-hydrus':['Quạt cầm tay mini Hydrus JF-95','Quạt để bàn Hydrus JF-96','Quạt để bàn Hydrus JF-83','Quạt cầm tay mini Hydrus JF-91'],
    'br-khac':['Quạt để bàn mini TOTOLINK FAN03','Quạt sạc kẹp mini TOTOLINK FAN01','Quạt để bàn mini Lock&Lock ENF336'],
  },
  'cat-mobile-acc-pen':{'br-khac':['Bút cảm ứng Apple Pencil Pro','Bút cảm ứng Apple Pencil USB-C','Bút cảm ứng Baseus Smooth Writing Stylus','Bút cảm ứng Samsung S Pen Pro','Bút cảm ứng Wacom Bamboo Ink Plus']},
  'cat-mobile-acc-strap':{'br-khac':['Dây đeo điện thoại da PU AVA+','Dây đeo điện thoại vải dù Crossbody AVA+','Dây đeo điện thoại Silicon thể thao Baseus','Dây đeo cổ tay điện thoại Uniq Novo']},
  'cat-mobile-acc-lens':{'br-ulanzi':['Ống kính góc rộng 18mm cho điện thoại Ulanzi','Ống kính Macro 75mm cho điện thoại Ulanzi','Ống kính Anamorphic 1.33x cho điện thoại Ulanzi','Ống kính Fisheye 238° cho điện thoại Ulanzi']},
};

// ══════════════════════════════════════════════════════════════════
// PHỤ KIỆN LAPTOP — format TGDD
// ══════════════════════════════════════════════════════════════════
const LAPTOP_ACC_TEMPLATES = {
  'cat-laptop-acc-mouse': {
    'br-logitech':['Chuột Bluetooth Silent Logitech Signature M650','Chuột Bluetooth Logitech MX Master 4','Chuột gaming không dây Logitech Pro X2 Superstrike','Chuột Bluetooth Silent Logitech MX Anywhere 3S','Chuột có dây gaming Logitech G502 Hero','Chuột Bluetooth Silent Logitech M240','Chuột Bluetooth gaming Logitech G304'],
    'br-razer':['Chuột có dây gaming Razer DeathAdder V3','Chuột có dây gaming Razer Basilisk V3','Chuột sạc Bluetooth gaming Razer Cobra Pro','Chuột sạc Bluetooth gaming Razer Basilisk V3 Pro 35K'],
    'br-corsair':['Chuột có dây gaming Corsair Katar Pro','Chuột Bluetooth gaming Corsair M75 Air','Chuột Bluetooth gaming Corsair Dark Core RGB Pro SE'],
    'br-akko':['Chuột Bluetooth Akko Cat Theme Mouse Pink Angie','Chuột Bluetooth Akko Cat Theme Mouse Orange Kate','Chuột Bluetooth Akko Wasp AO18'],
    'br-dareu':['Chuột không dây gaming Dareu A950 Pro','Chuột có dây gaming Dareu EM945','Chuột Bluetooth Silent Dareu LM115G'],
    'br-rapoo':['Chuột Bluetooth Silent Rapoo M590','Chuột Bluetooth Silent Rapoo B2W','Chuột Bluetooth Rapoo M650 Silent'],
    'br-havit':['Chuột Bluetooth Silent Havit MS78GT','Chuột có dây gaming Havit MS976GT'],
    'br-philips':['Chuột Bluetooth Philips SPK7438'],
    'br-microsoft':['Chuột Bluetooth Apple Magic Mouse USB-C','Chuột Bluetooth Microsoft Arc Mouse'],
    'br-dell':['Chuột Bluetooth Dell Premier MS900','Chuột Bluetooth Dell MS700'],
    'br-hp':['Chuột Bluetooth HP 935 Creator','Chuột Bluetooth HP Z3700 Dual Mode'],
    'br-msi':['Chuột có dây gaming MSI Clutch GM41','Chuột Bluetooth gaming MSI Accolade EK31'],
    'br-asus':['Chuột có dây gaming Asus TUF M3 Gen II','Chuột gaming không dây Asus ROG Strix Impact III','Chuột Bluetooth Asus ProArt Mouse MD300'],
    'br-machenike':['Chuột không dây gaming Machenike M8 Pro','Chuột có dây gaming Machenike L8'],
    'br-ugreen':['Chuột Bluetooth Silent Ugreen MU006','Chuột Bluetooth Ugreen MU007'],
  },
  'cat-laptop-acc-keyboard': {
    'br-logitech':['Bộ bàn phím chuột Bluetooth Logitech MK250','Bàn phím Bluetooth Logitech Slim Solar K980','Bàn phím Bluetooth Logitech K380s','Bàn phím Bluetooth Logitech Signature K650'],
    'br-razer':['Bàn phím cơ có dây gaming Razer BlackWidow V4 X Green Switch','Bàn phím cơ có dây gaming Razer BlackWidow V4 75 White Edition','Bàn phím cơ Bluetooth Razer BlackWidow V4 TKL HyperSpeed Orange Tactile Switch','Bàn phím cơ có dây gaming Razer BlackWidow V4 Pro Green Switch','Bàn phím cơ có dây gaming Razer BlackWidow V4 Pro Yellow Switch'],
    'br-corsair':['Bàn phím cơ Bluetooth Corsair K100 Air Wireless Ultra-Thin','Bàn phím cơ có dây gaming Corsair K70 RGB Pro','Bàn phím cơ Bluetooth Corsair K65 Plus 75%'],
    'br-akko':['Bàn phím cơ có dây Akko Fun60 Pro SP White','Bàn phím cơ có dây Akko Fun60 Pro SP Black','Bàn phím cơ Bluetooth Akko Fun60 Max SP Glare Magnetic Switches','Bàn phím cơ Bluetooth Akko AC87 Matcha Red Bean Stellar Rose'],
    'br-dareu':['Bàn phím cơ có dây gaming Dareu LK145','Bàn phím cơ Bluetooth Dareu EK75 Pro','Bàn phím cơ Bluetooth Dareu A87 Pro'],
    'br-apple':['Bàn phím Apple Magic Keyboard USB-C MXCL3','Bàn phím Apple Magic Keyboard USB-C Touch ID MXCK3','Magic Keyboard cho iPad Pro M4 11 inch Apple'],
    'br-machenike':['Bàn phím cơ Bluetooth Machenike KG98 RGB Purple Gold Switch','Bàn phím cơ Bluetooth Machenike KT68 Pro'],
    'br-hyperwork':['Bàn phím Bluetooth HyperWork SilentKey Mini'],
    'br-microsoft':['Bàn phím Bluetooth Microsoft Ergonomic Keyboard','Bàn phím Bluetooth Microsoft Surface Keyboard'],
  },
  'cat-laptop-acc-bag': {
    'br-tomtoc':['Túi xách chống sốc MacBook Pro 14 inch Tomtoc A14D2B1','Túi chống sốc Laptop 14 inch Tomtoc Briefcase Premium A11D3P1','Túi chống sốc Laptop 13 inch Tomtoc Spill-Resistant','Túi xách chống sốc Laptop 16 inch Tomtoc','Balo laptop 16 inch Tomtoc Flap','Balo laptop Tomtoc Premium H62'],
    'br-tucano':['Túi xách chống sốc Laptop 14 inch Tucano Smilza Superslim','Túi chống sốc MacBook Pro 16 inch Tucano Velluto','Balo laptop 15.6 inch Tucano Gommo','Balo laptop 15.6 inch Tucano Rollo','Túi xách chống sốc Laptop 14 inch Tucano Gommo Superslim'],
    'br-topo-designs':['Balo Topo Designs Commuter Briefcase','Balo Topo Designs Rover Pack Classic'],
    'br-dell':['Balo laptop 15 inch Dell Premier PE1520P','Balo laptop Dell EcoLoop Premier Slim 15','Balo laptop Dell Professional 15'],
    'br-hp':['Balo laptop 15.6 inch HP Renew Business','Balo laptop HP Pavilion Gaming 500 15.6','Balo laptop 15.6 inch HP Prelude Pro'],
    'br-asus':['Balo laptop Asus ProArt 16','Balo gaming Asus ROG Ranger BP4701 17','Balo laptop Asus Nereus 16'],
    'br-hyperwork':['Balo laptop 15.6 inch HyperWork Urban','Túi chống sốc laptop 14 inch HyperWork Slim'],
    'br-khac':['Túi chống sốc laptop 16 inch Togo TCS16-TD','Balo laptop 16 inch Togo TGB06','Balo laptop 15.6 inch Togo TGB08','Balo laptop 15.6 inch Targus TBB653GL','Balo laptop 15.6 inch Targus Geolite Essential TSB960GL','Balo laptop 15.6 inch Targus Transpire Compact TBB632GL'],
  },
  'cat-laptop-acc-mousepad': {
    'br-razer':['Miếng lót chuột Razer Goliathus Mobile Small','Miếng lót chuột Razer Gigantus V2 Soft Gaming Large','Miếng lót chuột Razer Gigantus V2 Soft Gaming XXL','Miếng lót chuột Razer Pro Glide XXL','Miếng lót chuột Razer Firefly V2 Hard Surface','Miếng lót chuột Razer Strider Large','Miếng lót chuột Razer Strider Large Quartz Edition','Miếng lót chuột Razer Goliathus Chroma Extended'],
    'br-logitech':['Miếng lót chuột Logitech Studio Series','Miếng lót chuột Logitech Desk Mat Studio Series'],
    'br-dareu':['Miếng lót chuột Dareu ESP108','Miếng lót chuột Dareu ESP119'],
    'br-akko':['Miếng lót chuột Akko Cat Theme Mousepad Gary Mimo'],
    'br-corsair':['Miếng lót chuột Corsair MM700 RGB Extended','Miếng lót chuột Corsair MM300 Pro Extended'],
    'br-msi':['Miếng lót chuột MSI Agility GD30 Pro Gaming','Miếng lót chuột MSI Agility GD70 Pro XXL'],
    'br-hyperwork':['Miếng lót chuột HyperWork Core Pad Size S','Miếng lót chuột HyperWork Core Pad Size L','Miếng lót chuột HyperWork Fable 45cm','Miếng lót chuột HyperWork Fable 90cm'],
  },
  'cat-laptop-acc-pouch': {
    'br-tomtoc':['Túi đeo chéo Tomtoc Slash T27 Shoulder Bag','Túi đeo chéo Tomtoc Crossbody EDC Sling Bag T24S1D1','Túi xách Tomtoc Electronic Organizer T11M1D1','Túi đeo chéo Tomtoc Wander T26 X-Pac Daily Sling','Túi đeo chéo Tomtoc X-Pac Aviator T37 Travel Crossbody'],
    'br-innostyle':['Túi đeo chéo Innostyle FlexiCarry Crossbody Sling FC22','Túi đeo chéo Innostyle VersalSling Crossbody Bag S2101'],
    'br-topo-designs':['Balo Topo Designs Mountain Sling Bag','Túi xách Topo Designs Mini Quick Pack','Túi đeo chéo Topo Designs Mini Shoulder Bag'],
    'br-orico':['Túi đựng ổ cứng Orico PHB-25','Túi đựng phụ kiện Orico PBS95'],
    'br-tucano':['Túi đựng phụ kiện Tucano Minilux Tech Pouch','Túi đựng phụ kiện Tucano Naviga Accessories Pouch'],
  },
  'cat-laptop-acc-router': {
    'br-tplink':['Router WiFi 6 TP-Link Archer AX73 AX5400','Router WiFi 7 TP-Link Archer BE9300','Bộ Phát WiFi 6E Mesh TP-Link Deco XE75 Pro','Router WiFi 5 TP-Link Archer C80 AC1900','Router WiFi TP-Link TL-WR840N 300Mbps','Router WiFi 6 TP-Link EX511 AX3000'],
    'br-totolink':['Router WiFi 6 TOTOLINK X6000R AX3000','Router WiFi 6 TOTOLINK X5000R AX1800','Router WiFi TOTOLINK N300RT 300Mbps','Router WiFi 5 TOTOLINK A810R AC1200'],
    'br-asus':['Router WiFi 7 Asus RT-BE96U 10Gbps','Bộ Phát WiFi 6E Mesh Asus ZenWiFi Pro ET12','Router WiFi 6 Asus RT-AX88U Pro AX6000','Router WiFi 6 Asus RT-AX58U AX3000'],
  },
  'cat-laptop-acc-hub': {
    'br-ugreen':['Hub USB-C 9-in-1 4K HDMI PD 100W Ugreen','Hub USB-C 7-in-1 4K HDMI Ugreen','Hub USB-C to 4 USB-A 3.0 Slim Ugreen','Adapter USB-C to HDMI 4K Ugreen'],
    'br-anker':['Hub USB-C 8-in-1 4K HDMI Anker 555','Hub USB-C 7-in-1 Anker 341','Docking Station USB-C 10-in-1 Anker 563'],
    'br-baseus':['Hub USB-C 6-in-1 Baseus Mechanical Eye','Hub USB-C 12-in-1 Dual HDMI 4K Baseus Replicator'],
    'br-orico':['Dock Thunderbolt 4 12-in-1 Orico TB3','Hub USB-C 9-in-1 4K60Hz Orico'],
    'br-hyperwork':['Hub USB-C 10-in-1 4K HyperWork','Dock Thunderbolt 4 HyperWork'],
    'br-innostyle':['Hub USB-C 6-in-1 HDMI 4K Innostyle'],
    'br-alpha-works':['Hub USB-C 8-in-1 Alpha Works'],
    'br-hyperspace':['Hub USB-C 10-in-1 Pro Hyperspace'],
  },
  'cat-laptop-acc-drawing': {
    'br-wacom':['Bảng vẽ điện tử Wacom Intuos Small Bluetooth CTL-4100WL','Bảng vẽ điện tử Wacom Intuos Small CTL-4100','Bảng vẽ điện tử Wacom One S Pen Tablet CTC4110WL','Bảng vẽ điện tử Wacom Cintiq 16 Pen Display','Bảng vẽ điện tử Wacom Cintiq Pro 27'],
    'br-kidcare':['Bảng vẽ tự xóa đa sắc Kidcare màn hình LCD 12 inch H12M','Bảng vẽ tự xóa đa sắc Kidcare màn hình LCD 8.5 inch H8M2'],
  },
  'cat-laptop-acc-keyboard-cover':{'br-jcpal':['Phủ phím MacBook Pro 16 inch M4 JCPAL FitSkin','Phủ phím MacBook Air 15 inch M3 JCPAL FitSkin','Phủ phím MacBook Air 13 inch M3 JCPAL FitSkin']},
  'cat-laptop-acc-monitor-stand':{'br-dell':['Chân đế màn hình Dell Monitor Stand MS521H Dual','Cánh tay giữ màn hình Dell Monitor Arm MDA20'],'br-hyperwork':['Cánh tay giữ màn hình HyperWork MA-200 Single','Chân đế đôi màn hình HyperWork MA-300']},
  'cat-laptop-acc-software':{'br-khac':['Phần mềm Microsoft 365 Personal 1 năm','Phần mềm Microsoft 365 Family 1 năm','Phần mềm diệt virus Kaspersky Plus 1 năm 1PC','Phần mềm Adobe Creative Cloud 1 năm']},
};

// ══════════════════════════════════════════════════════════════════
// THIẾT BỊ NGHE NHÌN — format TGDD
// ══════════════════════════════════════════════════════════════════
const AV_TEMPLATES = {
  'cat-av-bt-earphone': {
    'br-apple':['Tai nghe Bluetooth AirPods Pro 3','Tai nghe Bluetooth AirPods 4 có chống ồn','Tai nghe Bluetooth AirPods 4','Tai nghe Bluetooth AirPods 3'],
    'br-samsung':['Tai nghe Bluetooth Samsung Galaxy Buds3 Pro','Tai nghe Bluetooth Samsung Galaxy Buds3','Tai nghe Bluetooth Samsung Galaxy Buds FE'],
    'br-jbl':['Tai nghe Bluetooth JBL Tour Pro 2','Tai nghe Bluetooth JBL Tune Beam 2','Tai nghe Bluetooth chống ồn JBL Tune Buds','Tai nghe Bluetooth JBL Live Pro 2','Tai nghe Bluetooth JBL Endurance Peak 3'],
    'br-sony':['Tai nghe Bluetooth chống ồn Sony WF-1000XM5','Tai nghe Bluetooth chống ồn Sony WF-C700N','Tai nghe Bluetooth Sony WF-C510','Tai nghe Bluetooth Sony LinkBuds Open-Type'],
    'br-marshall':['Tai nghe Bluetooth Marshall Minor IV','Tai nghe Bluetooth chống ồn Marshall Motif II','Tai nghe Bluetooth Marshall Mode II'],
    'br-xiaomi':['Tai nghe Bluetooth chống ồn Xiaomi Buds 5 Pro','Tai nghe Bluetooth Xiaomi Buds 5','Tai nghe Bluetooth chống ồn Redmi Buds 6 Pro','Tai nghe Bluetooth Redmi Buds 6'],
    'br-oppo':['Tai nghe Bluetooth chống ồn OPPO Enco X3','Tai nghe Bluetooth OPPO Enco Free3','Tai nghe Bluetooth OPPO Enco Air4 Pro'],
    'br-vivo':['Tai nghe Bluetooth chống ồn vivo TWS 4','Tai nghe Bluetooth vivo TWS Air 2'],
    'br-realme':['Tai nghe Bluetooth chống ồn realme Buds Air 6 Pro','Tai nghe Bluetooth realme Buds Air 6'],
    'br-philips':['Tai nghe Bluetooth chống ồn Philips TAT4556','Tai nghe Bluetooth Philips TAT3508'],
    'br-havit':['Tai nghe Bluetooth chống ồn Havit TW967','Tai nghe Bluetooth Havit TW959'],
    'br-shokz':['Tai nghe Bluetooth Shokz OpenFit Air','Tai nghe Bluetooth Shokz OpenFit'],
    'br-hyundai-audio':['Tai nghe Bluetooth Hyundai Audio HY-T03','Tai nghe Bluetooth chống ồn Hyundai Audio HY-T05'],
    'br-honor':['Tai nghe Bluetooth HONOR Earbuds X7','Tai nghe Bluetooth HONOR Choice Earbuds X5'],
    'br-huawei':['Tai nghe Bluetooth chống ồn Huawei FreeBuds Pro 3','Tai nghe Bluetooth Huawei FreeBuds 6i','Tai nghe Bluetooth Huawei FreeBuds SE 2'],
  },
  'cat-av-headphone': {
    'br-sony':['Tai nghe Bluetooth Chụp Tai Sony WH-1000XM5','Tai nghe Bluetooth Chụp Tai Sony WH-1000XM4','Tai nghe Bluetooth Chụp Tai Sony WH-XB910N Extra Bass','Tai nghe có dây chụp tai kiểm âm Sony MDR-7506'],
    'br-jbl':['Tai nghe Bluetooth Chụp Tai chống ồn JBL Tune 770NC','Tai nghe Bluetooth Chụp Tai JBL Tune 720BT','Tai nghe Bluetooth On-Ear JBL Tune 520BT','Tai nghe gaming không dây JBL Quantum 910X'],
    'br-marshall':['Tai nghe Bluetooth Chụp Tai chống ồn Marshall Monitor III','Tai nghe Bluetooth Chụp Tai Marshall Major V'],
    'br-razer':['Tai nghe gaming không dây Razer Kraken V4 Pro','Tai nghe gaming không dây Razer BlackShark V2 Pro','Tai nghe Bluetooth chống ồn Razer Barracuda Pro'],
    'br-corsair':['Tai nghe gaming không dây Corsair HS80 Max','Tai nghe gaming không dây Corsair Virtuoso Max','Tai nghe gaming không dây Corsair HS65'],
    'br-havit':['Tai nghe gaming có dây Havit H2002D','Tai nghe Bluetooth chống ồn Havit H630BT'],
    'br-philips':['Tai nghe Bluetooth Chụp Tai chống ồn Philips TAH8856','Tai nghe có dây open-back Philips SHP9500','Tai nghe Bluetooth Chụp Tai Philips TAH5205'],
  },
  'cat-av-wire-earphone': {
    'br-sony':['Tai nghe có dây nhét tai Sony MDR-EX155AP','Tai nghe có dây nhét tai Sony MDR-EX15LP'],
    'br-jbl':['Tai nghe có dây nhét tai JBL Tune 110','Tai nghe có dây nhét tai JBL T210'],
    'br-samsung':['Tai nghe có dây nhét tai Samsung EO-IA500','Tai nghe có dây Type-C AKG Samsung'],
  },
  'cat-av-sport-earphone': {
    'br-shokz':['Tai nghe thể thao Bluetooth truyền âm thanh qua xương Shokz OpenRun Pro 2','Tai nghe thể thao Bluetooth Shokz OpenRun Pro','Tai nghe thể thao Bluetooth Shokz OpenRun','Tai nghe bơi lội Bluetooth Shokz OpenSwim Pro','Tai nghe thể thao Bluetooth Shokz OpenMove'],
    'br-jbl':['Tai nghe thể thao Bluetooth JBL Endurance Peak 3','Tai nghe thể thao Bluetooth JBL Endurance Race 2','Tai nghe thể thao Bluetooth JBL Reflect Aero'],
  },
  'cat-av-speaker': {
    'br-jbl':['Loa Bluetooth JBL Charge 5','Loa Bluetooth JBL Flip 7','Loa Bluetooth JBL Xtreme 4','Loa Bluetooth JBL Boombox 3','Loa karaoke JBL PartyBox 320','Loa Bluetooth JBL Go 4','Loa Bluetooth JBL Pulse 5','Loa Bluetooth JBL Clip 5'],
    'br-sony':['Loa Bluetooth Sony SRS-XB100','Loa Bluetooth Sony SRS-XG300','Loa Bluetooth Sony SRS-XG500'],
    'br-marshall':['Loa Bluetooth Marshall Willen II','Loa Bluetooth Marshall Emberton III','Loa Bluetooth Marshall Tufton','Loa Bluetooth Marshall Woburn III','Loa Bluetooth Marshall Stanmore III','Loa Bluetooth Marshall Middleton II'],
    'br-hyundai-audio':['Loa Bluetooth Hyundai Audio HY-SP01','Loa Bluetooth Hyundai Audio HY-SP03','Loa Bluetooth Hyundai Audio HY-SP05 Party'],
    'br-thonet-vander':['Loa Bluetooth Thonet & Vander Frei 2.0','Loa Bluetooth Thonet & Vander Kugel','Loa Bluetooth Thonet & Vander Flug','Loa Bluetooth Thonet & Vander Drang'],
    'br-philips':['Loa Bluetooth Philips TAS2208','Loa Bluetooth Philips TAS7807 Party','Loa Soundbar Philips TAB8507'],
    'br-logitech':['Loa Bluetooth 2.1 Logitech Z407','Loa 5.1 Surround Sound Logitech Z906','Loa Bluetooth 2.0 Logitech Z207'],
  },
  'cat-av-mic': {
    'br-boya':['Micro Thu Âm gắn máy ảnh Boya BY-M1 Lavalier','Micro Thu Âm Cardioid Shotgun Boya BY-MM1','Micro Thu Âm USB Condenser Boya BY-PM700','Micro Không Dây Boya BY-WM4 Pro K6','Micro Không Dây USB-C Boya BY-V10','Micro Thu Âm hội nghị Boya BY-MC2'],
    'br-sony':['Micro Thu Âm Compact Shotgun Sony ECM-B10','Micro Không Dây Sony ECM-W2BT','Micro Thu Âm Streaming Sony ECM-S1'],
    'br-ulanzi':['Micro Không Dây USB-C Ulanzi VM-Q1','Micro Thu Âm Shotgun Ulanzi VM-2','Micro Thu Âm mini Shotgun Ulanzi V-Mic Lite'],
  },
  'cat-av-projector': {
    'br-wanbo':['Máy chiếu Wanbo Full HD T2 Ultra','Máy chiếu Wanbo Full HD Cube 2 Pro','Máy chiếu Wanbo Full HD X5 Pro','Máy chiếu Wanbo HD Dali','Máy chiếu Wanbo Full HD Mozart 1 Pro','Máy chiếu Wanbo Full HD Vali 1 Pro','Máy chiếu Wanbo Full HD Vali 1','Máy chiếu Wanbo HD Cube 1','Máy chiếu Wanbo Full HD Togo Pro'],
    'br-eroc':['Máy chiếu Full HD Eroc Flip Plus','Máy chiếu HD Eroc Magic Ultra','Máy chiếu Full HD Eroc Master'],
    'br-xiaomi':['Máy Chiếu Xiaomi Smart Projector L1 Pro','Máy chiếu Xgimi Full HD Elfin Flip Plus','Máy chiếu Xgimi Full HD Mogo 4','Máy chiếu Xgimi Full HD Mogo 4 Laser','Máy chiếu Xgimi 4K UHD Horizon 20 Max'],
  },
  'cat-av-hdd': {
    'br-seagate':['Ổ cứng di động 1TB Seagate Expansion Portable','Ổ cứng di động 2TB Seagate Expansion Portable','Ổ cứng di động 4TB Seagate Expansion Desktop','Ổ cứng SSD 1TB Seagate One Touch Portable','Ổ cứng gắn trong 2TB Seagate Barracuda 7200RPM'],
    'br-kingston':['Ổ cứng SSD 1TB Kingston XS2000 Portable','Ổ cứng SSD 500GB Kingston XS1000 Portable','Ổ cứng SSD 480GB Kingston A400 SATA','Ổ cứng SSD 1TB Kingston KC3000 PCIe 4.0 NVMe','Ổ cứng SSD 1TB Kingston NV2 NVMe M.2'],
    'br-samsung':['Ổ cứng SSD 1TB Samsung T7 Portable','Ổ cứng SSD 2TB Samsung T7 Portable','Ổ cứng SSD 2TB Samsung T7 Shield Portable','Ổ cứng SSD 1TB Samsung 870 EVO SATA','Ổ cứng SSD 2TB Samsung 990 Pro PCIe 4.0 NVMe M.2'],
    'br-adata':['Ổ cứng di động 2TB ADATA HD710 Pro Shockproof','Ổ cứng di động 1TB ADATA HD770G RGB','Ổ cứng SSD 1TB ADATA SE880 Portable','Ổ cứng SSD 1TB ADATA Legend 960 Max NVMe M.2'],
    'br-kioxia':['Ổ cứng SSD 1TB Kioxia Exceria Plus G3 NVMe M.2','Ổ cứng SSD 500GB Kioxia Exceria Pro NVMe','Ổ cứng SSD 2TB Kioxia Exceria Plus G2 Portable LXD20K002TG8','Ổ cứng SSD 1TB Kioxia Exceria Plus Portable LXD10S001TG8'],
    'br-orico':['Box ổ cứng NVMe M.2 SSD USB-C Orico','Box ổ cứng 2.5 inch USB 3.0 Orico','Box ổ cứng 3.5 inch USB-C Orico'],
  },
  'cat-av-sdcard': {
    'br-sandisk':['Thẻ nhớ SanDisk MicroSD {st} Extreme Pro class 10_U3','Thẻ nhớ SanDisk MicroSD {st} class 10_U1','Thẻ nhớ chuyên Camera SanDisk MicroSD {st} class 10_U3','Thẻ nhớ Sandisk Creator MicroSD {st} Extreme class 10_U3'],
    'br-samsung':['Thẻ nhớ Samsung EVO Select MicroSD {st} A2','Thẻ nhớ Samsung Pro Plus MicroSD {st}','Thẻ nhớ Samsung Pro Ultimate MicroSD {st}'],
    'br-kingston':['Thẻ nhớ Kingston MicroSD {st} class 10_U1','Thẻ nhớ Kingston Canvas Go Plus MicroSD {st}'],
    'br-kioxia':['Thẻ nhớ Kioxia MicroSD {st} Class 10_U1','Thẻ nhớ Kioxia MicroSD {st} Class 10_U3','Thẻ nhớ chuyên Camera Kioxia MicroSD {st} Class 10_U3','Thẻ nhớ Kioxia MicroSD G3 {st} Class 10_U3'],
    'br-adata':['Thẻ nhớ ADATA Premier Pro MicroSD {st} V30 A2','Thẻ nhớ ADATA Premier MicroSD {st} Class 10'],
    'br-xiaomi':['Thẻ nhớ HIKSEMI MicroSD {st} Class 10_U1','Thẻ nhớ HIKSEMI MicroSD {st} Neo Lux Class 10_U3'],
  },
  'cat-av-usb': {
    'br-sandisk':['USB 3.2 {st} SanDisk CZ410','USB Phone Drive 3.2 {st} SanDisk SDDDC6','USB Type C 3.2 {st} SanDisk SDCZB','USB OTG 3.1 {st} Type C SanDisk SDDDC3','USB 3.2 {st} SanDisk SDCZIA FIFA World Cup 2026 Edition','USB Phone Drive 3.2 {st} Type C SanDisk SDIXS0N'],
    'br-kingston':['USB 3.2 {st} Kingston DataTraveler Exodia DTX','USB 3.2 {st} Kingston DataTraveler Exodia DTXM','USB 3.2 {st} Kingston DataTraveler Exodia DTXS'],
    'br-kioxia':['USB 3.2 {st} Kioxia U366','USB 3.2 {st} Kioxia U365','USB 3.2 {st} Kioxia U301 Gen 1'],
    'br-adata':['USB 3.2 {st} ADATA AUV150','USB 3.2 {st} ADATA UC310','USB 3.2 {st} ADATA UE800 Type-C'],
    'br-samsung':['USB 3.1 {st} Samsung FIT Plus','USB 3.1 {st} Samsung Bar Plus'],
  },
  'cat-av-smartglass':{'br-khac':['Kính thông minh Ray-Ban Meta Wayfarer','Kính thông minh XREAL Air 2 Pro','Kính thông minh Huawei Eyewear 2']},
};

// ══════════════════════════════════════════════════════════════════
// CAMERA — format TGDD
// ══════════════════════════════════════════════════════════════════
const CAM_TEMPLATES = {
  'cat-cam-security': {
    'br-imou':['Camera IP 360 Độ IMOU TA32CP-L','Camera IP 360 Độ IMOU Ranger 2 A32EP-L','Camera IP 360 Độ IMOU Ranger 2 A32P Pro','Camera IP 360 Độ IMOU TA32P Pro','Camera IP 360 Độ IMOU Ranger 2 A52P','Camera IP 360 Độ IMOU RANGER RC GK2CP-3C0WR'],
    'br-ezviz':['Camera IP 360 Độ EZVIZ TY1','Camera IP 360 Độ EZVIZ S10','Camera IP 360 Độ 8MP EZVIZ H6C G1','Camera IP Ngoài Trời 360 Độ EZVIZ H8C Pro'],
    'br-tplink':['Camera IP 360 Độ TP-Link Tapo C220','Camera IP 360 Độ TP-Link Tapo C200C','Camera IP Ngoài Trời 360 Độ TP-Link Tapo C500'],
    'br-dahua':['Camera IP 360 Độ Dahua DH-H3I','Camera IP Ngoài trời 360 Độ Dahua DH-P3AS-PV'],
    'br-tiandy':['Camera IP 360 Độ Tiandy TC-H322N','Camera IP Ngoài trời Tiandy TC-C34WS 4MP'],
  },
  'cat-cam-indoor': {
    'br-ulanzi':['Chân Tripod Kiêm Gậy Selfie Tự Bung Chân Nhanh 2.13m Ulanzi MT-80','Chân Tripod Magnetic Tự Bung Chân Nhanh 1.8m Ulanzi SK-21','Chân Tripod Kiêm Gậy Selfie Magnetic AI Auto Tracking 360 1.61m Ulanzi TT23M Kèm Remote Bluetooth','Chân Tripod Mini Kiêm Gậy Selfie 31cm Ulanzi SnapGo MT55','Chân Tripod Kiêm Gậy Selfie 1.5m Ulanzi MT-44B Kèm Remote Bluetooth','Chân Tripod Kiêm Gậy Selfie Magnetic Tự Bung Chân Nhanh 1.5m Ulanzi MT-85 Kèm Remote Bluetooth'],
    'br-insta360':['Camera hành trình Insta360 X6 Standard Bundle','Camera hành trình Insta360 X6 Essentials Bundle'],
    'br-khac':['Camera kỹ thuật số DJI Osmo Pocket 4P Vlog Combo','Camera hành trình DJI Action 5 Pro Standard Bundle'],
    'br-imou':['Camera IP 360 Độ IMOU Cue 3 3MP trong nhà','Camera IP 360 Độ IMOU Cell Go 4MP trong nhà'],
    'br-ezviz':['Camera IP trong nhà 360 Độ EZVIZ C6 3K','Camera IP trong nhà EZVIZ TY2 2MP 360°','Camera IP trong nhà EZVIZ H6c 2K+ 3MP'],
    'br-tplink':['Camera IP 360 Độ TP-Link Tapo C225 2.5K','Camera IP trong nhà TP-Link Tapo C110 3MP'],
    'br-dahua':['Camera IP 360 Độ trong nhà Dahua IPC-A42P 4MP'],
    'br-tiandy':['Camera IP trong nhà 360 Độ Tiandy TC-H332N 3MP'],
    'br-xiaomi':['Camera IP trong nhà 360 Độ Xiaomi Smart Camera C400 4MP','Camera IP trong nhà Xiaomi Smart Camera C300 2K WiFi'],
  },
  'cat-cam-outdoor': {
    'br-imou':['Camera IP Ngoài trời 360 Độ IMOU Cruiser 2C S7CP','Camera IP Ngoài trời IMOU Bullet 2C 4MP','Camera IP Ngoài Trời Năng Lượng Mặt Trời IMOU Cell 2 4MP','Camera IP Ngoài Trời 360 Độ IMOU AOV PT Wifi 4G Năng Lượng Mặt Trời B7ED'],
    'br-ezviz':['Camera IP Ngoài Trời 360 Độ EZVIZ H8C Pro 4MP','Camera IP Ngoài Trời EZVIZ C3X 4MP AI','Camera IP Ngoài Trời EZVIZ C8C 2K Pan/Tilt'],
    'br-dahua':['Camera IP Ngoài Trời 8MP Dahua IPC-HFW2849S','Camera IP Ngoài Trời 4MP Dahua IPC-HFW2441S'],
    'br-tiandy':['Camera IP Ngoài Trời 4MP Tiandy TC-C34WS','Camera IP Ngoài Trời 8MP ColorVu Tiandy TC-C38XS'],
    'br-insta360':['Camera hành trình 4K Insta360 GO 3S','Camera 360° hành trình 8K Insta360 X4'],
    'br-xiaomi':['Camera IP Ngoài Trời 2K Xiaomi Outdoor Camera AW300'],
  },
  'cat-cam-solar':{'br-ezviz':['Camera IP Năng Lượng Mặt Trời 2K+ EZVIZ BC1C','Camera IP Năng Lượng Mặt Trời EZVIZ EB3 Lite'],'br-imou':['Camera IP Năng Lượng Mặt Trời 4MP IMOU Cell 2','Camera IP Năng Lượng Mặt Trời IMOU AOV PT 4G']},
  'cat-cam-4g':{'br-dahua':['Camera IP 4G 4MP Dahua IPC-HFW2441S-4G','Camera IP PTZ 4G 4MP Dahua SD49425XB-4G'],'br-tiandy':['Camera IP 4G 4MP Tiandy TC-C34GS-4G','Camera IP 4G 8MP Ngoài Trời Tiandy TC-C38XS-4G']},
  'cat-cam-doorbell':{'br-tplink':['Chuông Cửa Camera Thông Minh 3MP TP-Link Tapo D210','Chuông Cửa Camera Thông Minh 3MP TP-Link Tapo D205'],'br-ezviz':['Chuông Cửa Camera Thông Minh 3MP EZVIZ CP3'],'br-imou':['Chuông Cửa Camera 2K WiFi IMOU DB60','Chuông Cửa Camera IMOU Doorbell Kit 2K']},
  'cat-cam-webcam':{'br-logitech':['Webcam Full HD 1080p 60fps Logitech StreamCam USB-C','Webcam Full HD 1080p Logitech C920s HD Pro','Webcam Full HD Logitech Brio 500','Webcam 4K Logitech MX Brio 705','Webcam HD 720p Logitech C505'],'br-insta360':['Webcam 4K AI Insta360 Link 2','Webcam 4K USB-C Insta360 Link 2C']},
};

const SD_STORAGES = ['32GB','64GB','128GB','256GB','512GB'];
const USB_STORAGES = ['32GB','64GB','128GB','256GB','512GB'];

// ══════════════════════════════════════════════════════════════════
// NAME GENERATOR — picks correct template based on category
// ══════════════════════════════════════════════════════════════════
function genName(catId, brandId) {
  const brand = BN[brandId] || '';

  // Major categories with dedicated generators
  if (catId === 'cat-phone')  return genPhoneName(brandId);
  if (catId === 'cat-laptop') return genLaptopName(brandId);
  if (catId === 'cat-tablet') return genTabletName(brandId);
  if (catId === 'cat-watch')  return genWatchName(brandId);

  // Accessories
  const accPool = ACC_TEMPLATES[catId];
  if (accPool) {
    const brandPool = accPool[brandId] || accPool['br-khac'] || Object.values(accPool).flat();
    if (brandPool && brandPool.length > 0) return pick(brandPool);
  }

  // Laptop accessories
  const lapAccPool = LAPTOP_ACC_TEMPLATES[catId];
  if (lapAccPool) {
    const brandPool = lapAccPool[brandId] || lapAccPool['br-khac'] || Object.values(lapAccPool).flat();
    if (brandPool && brandPool.length > 0) return pick(brandPool);
  }

  // AV
  const avPool = AV_TEMPLATES[catId];
  if (avPool) {
    let brandPool = avPool[brandId] || avPool['br-khac'] || Object.values(avPool).flat();
    if (brandPool && brandPool.length > 0) {
      let name = pick(brandPool);
      name = name.replace('{st}', pick(catId === 'cat-av-usb' ? USB_STORAGES : SD_STORAGES));
      return name;
    }
  }

  // Camera
  const camPool = CAM_TEMPLATES[catId];
  if (camPool) {
    const brandPool = camPool[brandId] || camPool['br-khac'] || Object.values(camPool).flat();
    if (brandPool && brandPool.length > 0) return pick(brandPool);
  }

  // Ultimate fallback — should not reach here often
  const catName = {
    'cat-mobile-acc-pen':'Bút cảm ứng','cat-mobile-acc-strap':'Dây đeo điện thoại',
    'cat-mobile-acc-lens':'Ống kính điện thoại','cat-mobile-acc-fan':'Quạt cầm tay',
  }[catId] || 'Phụ kiện';
  return `${catName} ${brand} chính hãng`.trim();
}

// ══════════════════════════════════════════════════════════════════
// MAIN — rename all products
// ══════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n✏️  PRO RENAME — Đổi tên 600K sản phẩm theo format TGDD');
  console.log('═'.repeat(65));

  const total = await prisma.product.count({ where: { is_deleted: false } });
  console.log(`  Tổng sản phẩm: ${total.toLocaleString()}`);

  const pairs = await prisma.$queryRaw`
    SELECT DISTINCT category_id, brand_id FROM "Product" WHERE is_deleted = false
  `;
  console.log(`  Cặp (category, brand): ${pairs.length}`);
  console.log('─'.repeat(65));

  const startMs = Date.now();
  let totalUpdated = 0;
  let pairIdx = 0;

  for (const { category_id: catId, brand_id: brandId } of pairs) {
    pairIdx++;
    let cursor;
    while (true) {
      const products = await prisma.product.findMany({
        where:   { category_id: catId, brand_id: brandId, is_deleted: false },
        select:  { id: true },
        take:    BATCH,
        orderBy: { id: 'asc' },
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (!products.length) break;

      // Group by name for bulk update
      const byName = {};
      for (const p of products) {
        const name = genName(catId, brandId);
        if (!byName[name]) byName[name] = [];
        byName[name].push(p.id);
      }

      await Promise.all(
        Object.entries(byName).map(([name, ids]) =>
          prisma.product.updateMany({ where: { id: { in: ids } }, data: { name } })
        )
      );

      totalUpdated += products.length;
      cursor = products[products.length - 1].id;

      const elapsed = (Date.now() - startMs) / 1000;
      const rps = Math.round(totalUpdated / Math.max(elapsed, 1));
      const eta = rps > 0 ? Math.ceil((total - totalUpdated) / rps) : 0;
      const etaStr = eta > 60 ? `${Math.floor(eta/60)}m${eta%60}s` : `${eta}s`;
      process.stdout.write(
        `\r  Pair ${pairIdx}/${pairs.length} | ${totalUpdated.toLocaleString()}/${total.toLocaleString()}  ${rps.toLocaleString()}/s  ETA:${etaStr}     `
      );
    }
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log('\n\n  ╔══════════════════════════════════════════════════╗');
  console.log('  ║        PRO RENAME HOÀN THÀNH                     ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║  Sản phẩm đã đổi tên : ${String(totalUpdated.toLocaleString()).padStart(10)}                ║`);
  console.log(`  ║  Cặp (cat,brand)      : ${String(pairs.length).padStart(10)}                ║`);
  console.log(`  ║  Thời gian            : ${String(elapsed + 's').padStart(10)}                ║`);
  console.log('  ╚══════════════════════════════════════════════════╝');

  // Sample
  console.log('\n  📋 Mẫu tên sau khi đổi:');
  const sampleCats = ['cat-phone','cat-laptop','cat-watch','cat-mobile-acc-charger','cat-laptop-acc-mouse','cat-av-bt-earphone','cat-av-speaker','cat-av-hdd','cat-av-sdcard','cat-av-usb','cat-cam-security','cat-laptop-acc-bag'];
  for (const cat of sampleCats) {
    const s = await prisma.product.findFirst({
      where: { category_id: cat, is_deleted: false },
      select: { name: true, brand_id: true },
    });
    if (s) console.log(`    [${cat}] ${s.name}`);
  }
}

main()
  .catch(e => { console.error('\n❌ Lỗi:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
