/**
 * rename-products.js
 * ─────────────────────────────────────────────────────────────────
 * Đổi tên toàn bộ 600,000 sản phẩm thành tên thực tế
 * theo từng brand × category, không có brand ID hay số index.
 *
 * Chiến lược:
 *   - Với mỗi cặp (category_id, brand_id) độc nhất trong DB
 *   - Pool ~20–40 tên thật sự cho cặp đó
 *   - UpdateMany theo nhóm tên → tối thiểu số DB round-trips
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

// ══════════════════════════════════════════════════════════════════
// NAME POOLS — Tên thực tế theo (category, brand)
// ══════════════════════════════════════════════════════════════════

const NAME_POOLS = {

  // ── ĐIỆN THOẠI ──────────────────────────────────────────────────
  'cat-phone': {
    'br-apple': [
      'iPhone 16 Pro Max 256GB Natural Titanium','iPhone 16 Pro Max 512GB Black Titanium',
      'iPhone 16 Pro 128GB Desert Titanium','iPhone 16 Pro 256GB White Titanium',
      'iPhone 16 Plus 128GB Ultramarine','iPhone 16 Plus 256GB Pink',
      'iPhone 16 128GB Black','iPhone 16 128GB White','iPhone 16 256GB Teal',
      'iPhone 15 Pro Max 256GB Black Titanium','iPhone 15 Pro Max 512GB Natural Titanium',
      'iPhone 15 Pro 128GB White Titanium','iPhone 15 Pro 256GB Blue Titanium',
      'iPhone 15 Plus 128GB Yellow','iPhone 15 Plus 256GB Green',
      'iPhone 15 128GB Pink','iPhone 15 128GB Blue',
      'iPhone 14 Pro Max 256GB Deep Purple','iPhone 14 128GB Blue',
      'iPhone SE (3rd Gen) 128GB Midnight','iPhone SE (3rd Gen) 64GB Starlight',
      'iPhone 13 128GB Pink','iPhone 13 256GB Green',
    ],
    'br-samsung': [
      'Galaxy S25 Ultra 512GB Titanium Black','Galaxy S25 Ultra 256GB Titanium Gray',
      'Galaxy S25+ 256GB Icy Blue','Galaxy S25+ 512GB Silver Shadow',
      'Galaxy S25 128GB Navy','Galaxy S25 256GB Mint',
      'Galaxy S24 Ultra 512GB Titanium Yellow','Galaxy S24+ 256GB Jade Green',
      'Galaxy S24 256GB Onyx Black',
      'Galaxy Z Fold6 512GB Navy','Galaxy Z Fold6 256GB Silver Shadow',
      'Galaxy Z Flip6 256GB Yellow','Galaxy Z Flip6 512GB Mint',
      'Galaxy A55 5G 256GB Awesome Iceblue','Galaxy A55 5G 128GB Awesome Navy',
      'Galaxy A35 5G 256GB Awesome Iceblue','Galaxy A35 5G 128GB Awesome Lilac',
      'Galaxy A25 5G 128GB Blue Black','Galaxy A15 5G 128GB Blue',
      'Galaxy M55 5G 256GB Smoky Teal','Galaxy M35 5G 128GB Grayish Black',
    ],
    'br-oppo': [
      'OPPO Find X8 Pro 512GB Space Black','OPPO Find X8 Pro 256GB Pearl White',
      'OPPO Find X8 256GB Space Black','OPPO Find X8 512GB Starry Blue',
      'OPPO Find N3 Flip 256GB Misty Purple',
      'OPPO Reno12 Pro 5G 256GB Sunset Gold','OPPO Reno12 Pro 5G 512GB Gray',
      'OPPO Reno12 5G 256GB Matte Brown','OPPO Reno12 F 256GB Black',
      'OPPO Reno11 Pro 5G 256GB Blue','OPPO Reno11 5G 256GB Rock Gray',
      'OPPO A3 Pro 5G 256GB Starry Black','OPPO A3 5G 256GB Starry Purple',
      'OPPO A38 128GB Glowing Black','OPPO A18 128GB Glowing Black',
      'OPPO A58 256GB Glowing Black','OPPO A78 5G 128GB Glowing Blue',
    ],
    'br-xiaomi': [
      'Xiaomi 14 Ultra 512GB Black','Xiaomi 14 Ultra 1TB White',
      'Xiaomi 14 Pro 512GB Black','Xiaomi 14 Pro 256GB White',
      'Xiaomi 14 256GB Black','Xiaomi 14 128GB Jade Green',
      'Xiaomi 14T Pro 512GB Titan Black','Xiaomi 14T 256GB Titan Blue',
      'Redmi Note 14 Pro+ 5G 512GB Midnight Black',
      'Redmi Note 14 Pro 5G 256GB Aurora Purple',
      'Redmi Note 14 256GB Jade Green',
      'Redmi Note 13 Pro+ 5G 256GB Aurora Purple',
      'Redmi Note 13 Pro 5G 256GB Midnight Black',
      'Redmi 13C 256GB Navy Blue','Redmi 13C 128GB Startrail Black',
      'Poco X6 Pro 512GB Black','Poco X6 256GB Yellow',
      'Poco F6 Pro 512GB Black','Poco F6 256GB Titanium White',
      'Poco M6 Pro 256GB Black',
    ],
    'br-vivo': [
      'vivo V40 Pro 5G 256GB Titanium Grey','vivo V40 5G 256GB Ganges Blue',
      'vivo V40 Lite 5G 256GB Blacky Black',
      'vivo V30 Pro 5G 512GB Peacock Green','vivo V30 5G 256GB Peacock Green',
      'vivo Y300 Pro+ 5G 256GB Crystal Black','vivo Y300+ 5G 256GB Titanium Blue',
      'vivo Y200 5G 256GB Crystal Purple','vivo Y200e 5G 256GB Wave Green',
      'vivo Y100A 128GB Meteor Black','vivo Y17s 128GB Glitter Purple',
    ],
    'br-realme': [
      'realme GT 6T 5G 256GB Fluid Silver','realme GT 6 5G 512GB Fluid Silver',
      'realme GT Neo 6 SE 5G 256GB Peacock Green',
      'realme 12 Pro+ 5G 512GB Navigator Beige',
      'realme 12 Pro 5G 256GB Submarine Blue',
      'realme 12+ 5G 256GB Navigator Beige','realme 12 5G 256GB Skyline Blue',
      'realme Narzo 70 Pro 5G 256GB Glass Black',
      'realme C67 5G 256GB Stargazing Black','realme C65 5G 128GB Sunset Purple',
      'realme C63 128GB Leather Green','realme C55 128GB Rainforest',
    ],
    'br-honor': [
      'HONOR Magic6 Pro 512GB Supernova Blue','HONOR Magic6 256GB Midnight Black',
      'HONOR Magic V2 512GB Black','HONOR Magic V3 512GB Titanium Black',
      'HONOR 200 Pro 512GB Midnight Black','HONOR 200 256GB Moonlight White',
      'HONOR 90 Smart 256GB Cyan Lake','HONOR 90 Pro 512GB Midnight Black',
      'HONOR X9b 5G 256GB Cyan Lake','HONOR X8b 256GB Titanium Silver',
      'HONOR X7b 128GB Titanium Silver',
    ],
    'br-nokia': [
      'Nokia G60 5G 128GB Midnight Black','Nokia G42 5G 128GB So Purple',
      'Nokia X30 5G 256GB Ice Blue','Nokia C32 128GB Charcoal',
      'Nokia C22 64GB Purple','Nokia 3310 4G Dual SIM',
      'Nokia 105 4G Dual SIM','Nokia 110 4G Dual SIM',
    ],
    'br-motorola': [
      'Motorola Edge 50 Pro 5G 256GB Black Beauty',
      'Motorola Edge 50 Fusion 5G 256GB Hot Pink',
      'Motorola Edge 50 Neo 5G 256GB Peach Fuzz',
      'Motorola Moto G85 5G 256GB Cobalt Blue',
      'Motorola Moto G75 5G 256GB Cabo Blue',
      'Motorola Moto G54 5G 256GB Pearl Blue',
      'Motorola Razr 50 Ultra 5G 256GB Midnight Blue',
      'Motorola Razr 50 5G 256GB Koala Gray',
    ],
    'br-tecno': [
      'TECNO Camon 30 Pro 5G 256GB Moonlit Silver',
      'TECNO Camon 30 5G 256GB Stardust Grey',
      'TECNO Camon 20 Pro 5G 256GB Serenity Blue',
      'TECNO Spark 20 Pro+ 256GB Startrail Black',
      'TECNO Spark 20 Pro 256GB Gravity Black',
      'TECNO Spark 20C 128GB Moonlit Silver',
      'TECNO Pova 6 Neo 5G 128GB Startrail Black',
      'TECNO Pova 5 Pro 5G 128GB Amber Gold',
    ],
    'br-infinix': [
      'Infinix Note 40 Pro 5G 256GB Volcanic Orange',
      'Infinix Note 40 Pro 256GB Race Teal',
      'Infinix Note 40 256GB Obsidian Black',
      'Infinix Hot 40i 128GB Starlit Black',
      'Infinix Hot 40 128GB Garnet Red',
      'Infinix Smart 8 Plus 128GB Galaxy White',
      'Infinix Zero 40 5G 256GB Titanium Gray',
    ],
    'br-itel': [
      'itel A70 Itel 256GB Azure Blue','itel A70 128GB Dreamy Gold',
      'itel S24 128GB Blue Star','itel P55+ 4G 64GB NFC Black',
      'itel P55 4G 128GB Blue','itel P40+ 64GB Black',
    ],
    'br-masstel': [
      'Masstel Tab 10 Ultra 128GB','Masstel Fami Pro 4G 32GB',
      'Masstel Fami Z 32GB','Masstel N715 4G 16GB',
      'Masstel Tab 8 Plus 64GB','Masstel Blu 50 64GB',
    ],
    'br-mobell': [
      'Mobell Nova 8 Plus 64GB Black','Mobell S19 Pro 64GB Blue',
      'Mobell F10 Pro 64GB Gold','Mobell Star P15 4G 64GB',
      'Mobell C9000 Pro 128GB',
    ],
  },

  // ── LAPTOP ───────────────────────────────────────────────────────
  'cat-laptop': {
    'br-apple': [
      'MacBook Air M3 13 inch 8GB 256GB Midnight',
      'MacBook Air M3 13 inch 8GB 512GB Starlight',
      'MacBook Air M3 15 inch 8GB 256GB Silver',
      'MacBook Air M3 15 inch 16GB 512GB Midnight',
      'MacBook Pro M4 14 inch 16GB 512GB Silver',
      'MacBook Pro M4 Pro 14 inch 24GB 512GB Space Black',
      'MacBook Pro M4 Pro 16 inch 24GB 512GB Silver',
      'MacBook Pro M4 Max 16 inch 48GB 1TB Space Black',
    ],
    'br-asus': [
      'Asus Vivobook 15 OLED A1507QA Snapdragon X 16GB 512GB',
      'Asus Vivobook 15 X1504VA i5-1335U 16GB 512GB Blue',
      'Asus Vivobook 16X K3605ZC i5-12500H 16GB 512GB RTX3050',
      'Asus Zenbook 14 OLED UX3405MA Ultra 7 16GB 512GB',
      'Asus Zenbook 14X OLED UX3404VA i7-13700H 16GB 512GB',
      'Asus ROG Strix G16 G614JVR i9-14900HX 16GB 1TB RTX4060',
      'Asus ROG Strix G18 G814JVR i9-14900HX 32GB 1TB RTX4060',
      'Asus ROG Zephyrus G14 GA403UI Ryzen AI 9 16GB 1TB RTX4070',
      'Asus ROG Flow X16 GV601VV i9-13900H 16GB 1TB RTX4060',
      'Asus ProArt Studiobook 16 H7606WI Ryzen AI 9 64GB 2TB',
      'Asus ExpertBook B5 B5302CBA i7-1265U 16GB 512GB',
    ],
    'br-hp': [
      'HP Pavilion 15-eg3066TU i5-1335U 16GB 512GB Silver',
      'HP Pavilion 15-eg3067TU i7-1355U 16GB 512GB Blue',
      'HP Envy x360 14-fc0093TU Ultra 5 125U 16GB 512GB',
      'HP Envy 16-ac0090TU Ultra 7 155H 32GB 1TB RTX4060',
      'HP Spectre x360 14-eu0083TU Ultra 7 155U 16GB 1TB',
      'HP Victus 16-r1022TX i7-14700HX 16GB 512GB RTX4060',
      'HP Victus 15-fb2023AX Ryzen 5 7535HS 16GB 512GB RTX2050',
      'HP EliteBook 840 G10 i7-1355U 16GB 512GB',
      'HP ZBook Firefly 14 G11 Ultra 7 165U 32GB 1TB',
      'HP 15s-du3584TU i5-1135G7 8GB 512GB Silver',
    ],
    'br-lenovo': [
      'Lenovo IdeaPad Slim 5 Gen 9 14IMH9 Ultra 5 125H 16GB 512GB',
      'Lenovo IdeaPad Gaming 3 Gen 9 15ARH8 Ryzen 5 7535HS 16GB 512GB RTX3050',
      'Lenovo LOQ 15IRH8 i5-13420H 16GB 512GB RTX3050',
      'Lenovo Legion 5 Gen 9 15APH9 Ryzen 7 8845HS 16GB 512GB RTX4060',
      'Lenovo Legion Pro 5 Gen 9 16IRX9 i9-14900HX 16GB 1TB RTX4060',
      'Lenovo Legion Pro 7 Gen 9 16IRX9 i9-14900HX 32GB 1TB RTX4080',
      'Lenovo ThinkBook 14 Gen 7 IMH 14 Ultra 5 125H 16GB 512GB',
      'Lenovo ThinkBook 16 Gen 7 IML Ultra 5 125H 16GB 512GB',
      'Lenovo ThinkPad X1 Carbon Gen 12 Ultra 7 165U 32GB 1TB',
      'Lenovo Yoga 7 2-in-1 14IML9 Ultra 5 125U 16GB 512GB',
      'Lenovo Yoga Slim 7 14IMH9 Ultra 7 155H 16GB 1TB',
    ],
    'br-acer': [
      'Acer Aspire 5 A515-58GM i5-1335U 8GB 512GB RTX2050',
      'Acer Aspire 5 A515-58P i5-1335U 16GB 512GB Silver',
      'Acer Aspire 3 A315-59 i5-1235U 8GB 512GB Silver',
      'Acer Swift Go 14 SFG14-73 Ultra 5 125H 16GB 512GB',
      'Acer Swift Go 16 SFG16-72 Ultra 5 125U 16GB 512GB OLED',
      'Acer Nitro V 15 ANV15-51 i5-13420H 16GB 512GB RTX3050',
      'Acer Nitro V 16 ANV16-41 Ryzen 5 8645HS 16GB 512GB RTX4050',
      'Acer Predator Helios Neo 16 PHN16-72 i7-14700HX 16GB 1TB RTX4070',
      'Acer Predator Helios 18 PH18-72 i9-14900HX 32GB 1TB RTX4080',
      'Acer TravelMate P4 TMP414-53 i7-1355U 16GB 512GB',
    ],
    'br-dell': [
      'Dell Inspiron 15 3520 i5-1235U 8GB 512GB Silver',
      'Dell Inspiron 16 5630 i7-1360P 16GB 512GB Platinum Silver',
      'Dell XPS 13 9340 Ultra 7 155H 16GB 512GB Platinum',
      'Dell XPS 15 9540 Ultra 9 185H 32GB 1TB RTX4070',
      'Dell XPS 16 9640 Ultra 9 185H 32GB 2TB RTX4070',
      'Dell Vostro 15 3530 i5-1335U 16GB 512GB Black',
      'Dell Latitude 5540 i5-1345U 16GB 512GB',
      'Dell G15 5530 Gaming i7-13650HX 16GB 512GB RTX3050',
      'Dell Alienware m18 R2 i9-14900HX 32GB 1TB RTX4090',
      'Dell Alienware x16 R2 Ultra 9 185HX 32GB 2TB RTX4090',
    ],
    'br-msi': [
      'MSI Modern 15 H B13M i5-13420H 16GB 512GB Urban Silver',
      'MSI Thin 15 B12UCX i5-12450H 8GB 512GB Carbon Gray RTX2050',
      'MSI Katana 15 B13VGK i7-13620H 16GB 1TB RTX4070',
      'MSI Titan 18 HX A14VIG i9-14900HX 64GB 2TB RTX4090',
      'MSI Raider GE78 HX i9-14900HX 32GB 2TB RTX4080',
      'MSI Stealth 16 AI Studio Ultra 9 185HX 32GB 2TB RTX4090',
      'MSI Creator Z16P B12UGT i7-12700H 32GB 2TB RTX3080Ti',
      'MSI Prestige 16 AI Evo B1MG Ultra 7 155H 32GB 1TB',
      'MSI Claw A1M Ultra 7 155H 16GB 512GB Gaming Handheld',
    ],
    'br-lg': [
      'LG gram 16 2024 16Z90S Ultra 7 155H 16GB 1TB White',
      'LG gram 14 2024 14Z90S Ultra 5 125H 16GB 512GB White',
      'LG gram Pro 16 2024 16Z90SP Ultra 9 185H 32GB 1TB White',
      'LG gram Pro 17 2024 17Z90SP Ultra 7 155H 16GB 1TB White',
      'LG gram Style 14 2024 14Z90RS Ultra 5 125H 16GB 512GB',
      'LG gram +view 16 Portable Monitor Silver',
    ],
    'br-microsoft': [
      'Microsoft Surface Pro 11 Ultra 5 X Plus 16GB 512GB Platinum',
      'Microsoft Surface Pro 10 i7-1365U 32GB 1TB Platinum',
      'Microsoft Surface Laptop 6 13.5 Ultra 5 135H 16GB 512GB Platinum',
      'Microsoft Surface Laptop 6 15 Ultra 7 165H 16GB 512GB Sage',
      'Microsoft Surface Laptop Studio 2 i7-13700H 32GB 2TB RTX4060',
      'Microsoft Surface Book 3 i7 32GB 1TB GTX1660Ti',
    ],
    'br-gigabyte': [
      'Gigabyte Aorus 15X AXG-43VN554SH i9-14900HX 32GB 1TB RTX4090',
      'Gigabyte Aorus 15 BKF i5-13500H 16GB 512GB RTX4060',
      'Gigabyte G5 KF5-H3VN384KH i7-13620H 16GB 512GB RTX4060',
      'Gigabyte G6X 9KG i7-13650HX 16GB 512GB RTX4060',
      'Gigabyte Aero 16 BSF i9-13980HX 32GB 1TB RTX4070',
    ],
    'br-razer': [
      'Razer Blade 16 2024 Ultra 9 185HX 32GB 1TB RTX4090',
      'Razer Blade 15 2024 i9-14900HX 16GB 1TB RTX4080',
      'Razer Blade 14 2024 Ryzen 9 8945HX 32GB 1TB RTX4070',
      'Razer Blade Stealth 13 i7-1165G7 16GB 512GB',
      'Razer Book 13 i7-1165G7 16GB 512GB Mercury White',
    ],
    'br-masstel': [
      'Masstel Laptop S15 Celeron N4020 4GB 128GB SSD',
      'Masstel Laptop S14 N4020 4GB 64GB eMMC',
      'Masstel Tab 10 Business 4GB 64GB',
    ],
    'br-infinix': [
      'Infinix INBook X2 Plus i5-1235U 16GB 512GB Green',
      'Infinix InBook Y4 Max Core i7 Ultra 16GB 1TB',
      'Infinix ZeroBook Ultra 14 Ultra 7 155H 16GB 1TB',
      'Infinix INBook X1 Neo i3-1115G4 8GB 256GB',
    ],
  },

  // ── TABLET ───────────────────────────────────────────────────────
  'cat-tablet': {
    'br-apple': [
      'iPad Pro M4 13 inch WiFi 256GB Silver','iPad Pro M4 13 inch WiFi 512GB Space Black',
      'iPad Pro M4 11 inch WiFi 256GB Silver','iPad Pro M4 11 inch 5G 512GB Space Black',
      'iPad Air M2 13 inch WiFi 128GB Blue','iPad Air M2 13 inch WiFi 256GB Purple',
      'iPad Air M2 11 inch WiFi 128GB Blue','iPad Air M2 11 inch 5G 256GB Starlight',
      'iPad mini A17 Pro WiFi 128GB Blue','iPad mini A17 Pro 5G 256GB Purple',
      'iPad Gen 10 WiFi 64GB Blue','iPad Gen 10 WiFi 256GB Pink',
      'iPad Gen 10 5G 64GB Silver',
    ],
    'br-samsung': [
      'Samsung Galaxy Tab S10 Ultra WiFi 256GB Graphite',
      'Samsung Galaxy Tab S10+ WiFi 256GB Platinum Silver',
      'Samsung Galaxy Tab S10 WiFi 128GB Graphite',
      'Samsung Galaxy Tab S10 FE WiFi 128GB Lavender',
      'Samsung Galaxy Tab S9 Ultra 5G 256GB Graphite',
      'Samsung Galaxy Tab S9+ WiFi 512GB Beige',
      'Samsung Galaxy Tab S9 FE WiFi 128GB Lavender',
      'Samsung Galaxy Tab A9+ WiFi 64GB Graphite',
      'Samsung Galaxy Tab A9+ 5G 128GB Graphite',
      'Samsung Galaxy Tab A9 WiFi 64GB Gray',
    ],
    'br-lenovo': [
      'Lenovo Tab P12 Pro 12.6 inch 8GB 256GB Storm Grey',
      'Lenovo Tab P11 Pro Gen 2 8GB 256GB Storm Grey',
      'Lenovo Tab P11 Gen 2 6GB 128GB Storm Grey',
      'Lenovo Tab M11 4GB 128GB Luna Grey',
      'Lenovo Tab M10 Plus Gen 3 4GB 128GB Storm Grey',
      'Lenovo Legion Tab Y700 Gen 2 12GB 256GB Titanium White',
    ],
    'br-xiaomi': [
      'Xiaomi Pad 7 12GB 256GB Mist Blue','Xiaomi Pad 7 Pro 8GB 256GB Crystal Silver',
      'Xiaomi Pad 6S Pro 12GB 512GB Graphite Gray',
      'Xiaomi Pad 6 8GB 256GB Mist Blue','Xiaomi Pad 5 Pro 8GB 256GB Cosmic Gray',
      'Xiaomi Redmi Pad Pro 6GB 128GB Graphite Gray',
    ],
    'br-honor': [
      'HONOR Pad X9 5G 6GB 128GB Space Gray','HONOR Pad 9 12GB 256GB Space Gray',
      'HONOR MagicPad 2 16GB 512GB Gray','HONOR MagicPad 13 8GB 256GB Midnight Black',
    ],
    'br-masstel': [
      'Masstel Tab 10 Plus 4GB 64GB Black','Masstel Tab 8 Pro 3GB 32GB',
      'Masstel Tab 10 HD 4GB 128GB','Masstel Tab 7 4G 2GB 32GB',
    ],
  },

  // ── SMARTWATCH ───────────────────────────────────────────────────
  'cat-watch': {
    'br-apple': [
      'Apple Watch Series 10 44mm Jet Black Aluminum',
      'Apple Watch Series 10 46mm Rose Gold Aluminum',
      'Apple Watch Ultra 2 49mm Black Titanium',
      'Apple Watch Ultra 2 49mm Natural Titanium',
      'Apple Watch SE Gen 2 44mm Midnight Aluminum',
      'Apple Watch SE Gen 2 40mm Starlight Aluminum',
      'Apple Watch Series 9 45mm Midnight Aluminum',
      'Apple Watch Series 9 41mm Pink Aluminum',
    ],
    'br-samsung': [
      'Samsung Galaxy Watch7 44mm Cream','Samsung Galaxy Watch7 40mm Green',
      'Samsung Galaxy Watch Ultra 47mm Titanium White',
      'Samsung Galaxy Watch6 Classic 47mm Black',
      'Samsung Galaxy Watch6 44mm Gold','Samsung Galaxy Watch6 40mm Silver',
      'Samsung Galaxy Watch FE 40mm Pink Gold',
      'Samsung Galaxy Fit3 Pink Gold',
    ],
    'br-garmin': [
      'Garmin Fenix 8 Solar 51mm Graphite','Garmin Fenix 8 AMOLED 47mm Carbon Gray',
      'Garmin Forerunner 965 Carbon Gray DLC Titanium',
      'Garmin Forerunner 265 Whitestone','Garmin Forerunner 165 Tidal Blue',
      'Garmin Venu 3S Sage Gray Soft Gold','Garmin Venu 3 Whitestone Slate',
      'Garmin Vivoactive 5 Ivory Gold','Garmin Epix Pro 51mm Carbon Gray DLC',
      'Garmin Instinct 2X Solar Tactical Edition',
    ],
    'br-xiaomi': [
      'Xiaomi Watch S4 Sport Black','Xiaomi Watch S3 Silver',
      'Xiaomi Watch S2 Pro 46mm Black','Xiaomi Watch S1 Pro Black',
      'Redmi Watch 5 Lite Obsidian Black','Redmi Watch 4 Obsidian Black',
      'Redmi Watch 3 Midnight Black','Xiaomi Smart Band 9 Pro Black',
      'Xiaomi Smart Band 9 Active Black',
    ],
    'br-huawei': [
      'Huawei Watch GT 5 Pro 46mm Titanium Gray',
      'Huawei Watch GT 5 46mm Black','Huawei Watch GT 5 42mm Aurora White',
      'Huawei Watch Ultimate Expedition Black',
      'Huawei Band 9 Starry Black','Huawei Watch 4 Pro Black',
      'Huawei Watch Fit 3 Black',
    ],
    'br-amazfit': [
      'Amazfit Falcon 2 Black','Amazfit Balance Black',
      'Amazfit Cheetah Pro Black','Amazfit Cheetah Square Black',
      'Amazfit GTR 4 Superspeed Black','Amazfit GTS 4 Mini Midnight Black',
      'Amazfit Bip 5 Black','Amazfit T-Rex Ultra Black',
      'Amazfit Active Black','Amazfit Band 7 Black',
    ],
    'br-honor': [
      'HONOR Watch 4 Pro Black','HONOR Watch GS Pro Black',
      'HONOR Band 9 Midnight Black','HONOR Magic Watch 2 46mm Agate Black',
    ],
    'br-fitbit': [
      'Fitbit Sense 2 Shadow Gray Graphite','Fitbit Versa 4 Black Graphite',
      'Fitbit Inspire 3 Midnight Zen Black','Fitbit Charge 6 Black Obsidian',
      'Fitbit Luxe Soft Gold Peony Band',
    ],
    'br-befit': [
      'BeFit Smart Watch Pro 46mm Black','BeFit Ultra 2 Sport Black',
      'BeFit Active 3 Pro Navy Blue','BeFit Classic 2 Silver',
    ],
    'br-polar': [
      'Polar Vantage V3 Black','Polar Grit X2 Pro Black',
      'Polar Pacer Pro Black','Polar Pacer Black',
      'Polar Ignite 3 Black','Polar M430 Black',
    ],
  },

  // ── PHỤ KIỆN DI ĐỘNG — SẠC DỰ PHÒNG ────────────────────────────
  'cat-mobile-acc-powerbank': {
    'br-anker': [
      'Anker PowerCore Slim 10000 PD 20W','Anker PowerCore 20000 PD 22.5W',
      'Anker PowerCore III Elite 25600 65W','Anker PowerCore+ 26800 PD 45W',
      'Anker PowerCore Essential 20000 18W',
      'Anker 737 Power Bank 140W 24000mAh','Anker 733 Power Bank Fusion 10000 30W',
    ],
    'br-baseus': [
      'Baseus Adaman2 Digital Display 20000mAh 65W','Baseus Blade 100W 20000mAh',
      'Baseus Star-Lord 22.5W 30000mAh Digital','Baseus Amblight 65W 30000mAh',
      'Baseus Elf Digital Display 10000mAh 22.5W',
    ],
    'br-energizer': [
      'Energizer UE10027 10000mAh 18W','Energizer UE20104 20000mAh 20W PD',
      'Energizer UE10004Q 10000mAh Qi 18W','Energizer UE30000 30000mAh PD',
    ],
    'br-romoss': [
      'Romoss Sense 8+ 30000mAh 65W PD Fast Charge','Romoss PEA40 40000mAh 22.5W',
      'Romoss LT20PS 20000mAh 65W PD','Romoss Sense 6PS 20000mAh 18W',
    ],
    'br-samsung': [
      'Samsung 25W Battery Pack 10000mAh','Samsung 45W Battery Pack 20000mAh',
      'Samsung Wireless Battery Pack 10000mAh 25W',
    ],
    'br-xiaomi': [
      'Xiaomi Power Bank 3 Ultra Compact 10000mAh 22.5W',
      'Xiaomi 33W Power Bank 10000mAh Pocket Pro',
      'Xiaomi Power Bank 50W 20000mAh',
    ],
    'br-pisen': [
      'Pisen TS-D259 10000mAh 22.5W Fast Charge','Pisen TS-D265 20000mAh 65W PD',
      'Pisen Quick Charge 3.0 20000mAh Compact',
    ],
    'br-ravpower': [
      'RAVPower Pioneer 20000mAh 65W PD','RAVPower PD Pioneer 10000mAh 18W',
      'RAVPower Universal Series 30000mAh',
    ],
    'br-aukey': [
      'Aukey Sprint 10000mAh 18W Power Bank','Aukey Basix 26800mAh 30W PD',
      'Aukey Sprint Lite 10000mAh USB-C',
    ],
    'br-ugreen': [
      'Ugreen 100W Power Bank 25000mAh Fast Charge','Ugreen 10000mAh 45W Portable',
      'Ugreen Nexode 20000mAh 65W PD',
    ],
    'br-xmobile': [
      'Xmobile Energy 20000mAh 22.5W Quick Charge','Xmobile Pro 10000mAh 18W',
    ],
  },

  // ── PHỤ KIỆN DI ĐỘNG — SẠC, CÁP ────────────────────────────────
  'cat-mobile-acc-charger': {
    'br-anker': [
      'Anker 737 Charger GaN 120W 3 cổng','Anker Prime 100W GaN 4 cổng',
      'Anker 735 GaN 65W 3 cổng','Anker Nano 45W USB-C','Anker 312 USB-A 15W',
      'Anker PowerLine III Flow USB-C to Lightning 1.8m',
      'Anker Powerline+ III Cáp USB-C to USB-C 100W 1.8m',
    ],
    'br-baseus': [
      'Baseus GaN5 Pro 100W 4 cổng Desktop Charger',
      'Baseus Compact 30W USB-C Fast Charger','Baseus Pixel 65W 3 cổng GaN',
      'Baseus Superior Pro USB-C to USB-C Cable 100W 2m',
      'Baseus Crystal Shine MagSafe Cable 2.4A 1.2m',
    ],
    'br-apple': [
      'Apple 20W USB-C Power Adapter','Apple 35W Dual USB-C Port Adapter',
      'Apple 67W USB-C Power Adapter','Apple 96W USB-C Power Adapter',
      'Apple USB-C to Lightning Cable 2m','Apple USB-C to USB-C Cable 2m 240W',
      'Apple MagSafe Charger 15W 1m',
    ],
    'br-samsung': [
      'Samsung 45W Super Fast Charger USB-C','Samsung 25W Fast Charger USB-C',
      'Samsung 15W Wireless Charger Pad','Samsung USB-C to USB-C Cable 5A 1m',
    ],
    'br-ugreen': [
      'Ugreen Nexode 100W GaN Charger 4 Port','Ugreen Nexode 65W 3-Port Compact',
      'Ugreen USB-C to USB-C Cable 240W 1m Braided','Ugreen MFi Lightning to USB-C 36W 1.5m',
    ],
    'br-belkin': [
      'Belkin BoostCharge Pro 108W 4-Port GaN','Belkin 30W USB-C Car Charger',
      'Belkin BoostCharge USB-C to USB-C 100W 2m',
    ],
  },

  // ── ỐP LƯNG ĐIỆN THOẠI ──────────────────────────────────────────
  'cat-mobile-acc-case-phone': {
    'br-spigen': [
      'Spigen Ultra Hybrid iPhone 16 Pro Max Crystal Clear',
      'Spigen Tough Armor iPhone 16 Pro Metal Slate',
      'Spigen Slim Armor CS iPhone 16 Black',
      'Spigen Ultra Hybrid Samsung Galaxy S25 Ultra Frost Clear',
      'Spigen Rugged Armor Galaxy S25+ Matte Black',
      'Spigen Liquid Air Galaxy A55 Matte Black',
      'Spigen Neo Flex Screen Protector iPhone 16',
    ],
    'br-esr': [
      'ESR Classic Kickstand iPhone 16 Pro Max Clear','ESR Air Armor iPhone 16 Pro Frost Clear',
      'ESR Boost Kickstand Galaxy S25 Ultra Clear','ESR Classic Shield Samsung S24',
      'ESR HaloLock MagSafe Case iPhone 15 Pro Black',
    ],
    'br-apple': [
      'Apple FineWoven Case iPhone 16 Pro Max Black',
      'Apple Silicone Case iPhone 16 Pro Black',
      'Apple Clear Case iPhone 16 Pro with MagSafe',
    ],
    'br-samsung': [
      'Samsung Standing Grip Case Galaxy S25 Ultra Titanium Silver',
      'Samsung Vegan Leather Case Galaxy S25+ Black',
      'Samsung Clear Gadget Case Galaxy S25 Transparent',
    ],
    'br-nillkin': [
      'Nillkin Super Frosted Shield iPhone 16 Black','Nillkin CamShield Pro iPhone 16 Pro Max Black',
      'Nillkin Super Frosted Samsung Galaxy S25 Ultra White',
    ],
    'br-capdase': [
      'Capdase Soft Jacket Xpose iPhone 16 Pro Translucent Black',
      'Capdase Metalic Jacket Pixel Samsung S25 Silver',
    ],
    'br-zagg': [
      'ZAGG InvisibleShield Glass Elite iPhone 16 Pro Max',
      'ZAGG InvisibleShield Ultra Clear Samsung Galaxy S25',
    ],
    'br-hydragel': [
      'Hydragel Nano Miếng dán màn hình trong suốt iPhone 16 Pro Max',
      'Hydragel Matte Chống lóa Samsung Galaxy S25 Ultra',
    ],
    'br-rock': [
      'ROCK Guard Ultra Slim iPhone 16 Pro Max Frosted Gray',
      'ROCK Origin Shield Samsung Galaxy S25 Black',
    ],
  },

  // ── MIẾNG DÁN MÀN HÌNH ──────────────────────────────────────────
  'cat-mobile-acc-screen': {
    'br-zagg': [
      'ZAGG InvisibleShield Glass Elite iPhone 16 Pro Max','ZAGG InvisibleShield 360 Samsung S25',
      'ZAGG InvisibleShield Ultra Clear+ Galaxy S25 Ultra',
    ],
    'br-spigen': [
      'Spigen Tempered Glass Screen Protector GLAS.tR iPhone 16 Pro',
      'Spigen ALM GLAS.tR Slim Samsung Galaxy S25 Ultra',
    ],
    'br-hydragel': [
      'Hydragel Nano TPU Film iPhone 16 Pro Max Matte','Hydragel Anti-Fingerprint Samsung Galaxy S25',
      'Hydragel Full Cover Xiaomi 14 Ultra',
    ],
    'br-esr': [
      'ESR Tempered Glass 2-Pack iPhone 16 Pro Max','ESR Liquid Skin Full-Cover Samsung S25',
    ],
    'br-baseus': [
      'Baseus Crystal 0.3mm Full Glass iPhone 16 Pro Max 2-pack',
      'Baseus Diamond Series Anti-Fingerprint Samsung Galaxy S25',
    ],
  },

  // ── TAI NGHE BLUETOOTH ───────────────────────────────────────────
  'cat-av-bt-earphone': {
    'br-apple': [
      'AirPods Pro 2nd Gen USB-C','AirPods 4 Active Noise Cancellation',
      'AirPods 4','AirPods 3rd Gen Lightning',
    ],
    'br-samsung': [
      'Samsung Galaxy Buds3 Pro Graphite','Samsung Galaxy Buds3 White',
      'Samsung Galaxy Buds2 Pro Black','Samsung Galaxy Buds2 White',
      'Samsung Galaxy Buds FE Graphite',
    ],
    'br-jbl': [
      'JBL Tour Pro 2 True Wireless ANC','JBL Tune Beam 2 True Wireless',
      'JBL Tune Buds True Wireless ANC','JBL Free NC TWS',
      'JBL Live Pro 2 TWS ANC Black','JBL Endurance Peak 3 True Wireless',
    ],
    'br-sony-audio': [
      'Sony WF-1000XM5 Industry Leading ANC Black','Sony WF-1000XM5 Silver',
      'Sony WF-C700N True Wireless ANC Lavender','Sony WF-C510 True Wireless Black',
      'Sony LinkBuds Open-Type True Wireless White',
    ],
    'br-xiaomi': [
      'Xiaomi Buds 5 Pro True Wireless ANC Black','Xiaomi Buds 5 True Wireless Black',
      'Redmi Buds 6 Pro True Wireless ANC Black','Redmi Buds 6 True Wireless Black',
      'Redmi Buds 5 Pro ANC Midnight Black',
    ],
    'br-beats': [
      'Beats Powerbeats Pro 2 Jet Black','Beats Studio Buds+ True Wireless ANC Black',
      'Beats Fit Pro True Wireless Black','Beats Studio Buds True Wireless Black',
    ],
    'br-jabra': [
      'Jabra Evolve2 Buds True Wireless ANC','Jabra Elite 10 Titanium Black ANC',
      'Jabra Elite 8 Active True Wireless','Jabra Elite 4 True Wireless Black',
    ],
    'br-1more': [
      '1MORE Aero True Wireless ANC Black','1MORE Evo True Wireless ANC Black',
      '1MORE ComfoBuds Pro ANC True Wireless','1MORE ColorBuds 2 True Wireless',
    ],
    'br-skullcandy': [
      'Skullcandy Push Active True Wireless Black/Yellow',
      'Skullcandy Grind True Wireless Black','Skullcandy Indy ANC True Wireless Black',
    ],
    'br-edifier': [
      'Edifier NeoBuds Pro 2 True Wireless ANC Black',
      'Edifier TWS1 Pro 2 True Wireless ANC Black','Edifier X5 Lite True Wireless Black',
    ],
    'br-realme': [
      'realme Buds Air 6 Pro True Wireless ANC Black',
      'realme Buds Air 6 True Wireless Black','realme Buds T310 True Wireless Black',
    ],
  },

  // ── TAI NGHE CHỤP TAI ────────────────────────────────────────────
  'cat-av-headphone': {
    'br-sony-audio': [
      'Sony WH-1000XM5 Over-Ear ANC Black','Sony WH-1000XM5 Silver',
      'Sony WH-1000XM4 Over-Ear ANC Black','Sony WH-XB910N Extra Bass ANC Black',
      'Sony MDR-7506 Studio Monitor Headphones',
    ],
    'br-bose': [
      'Bose QuietComfort Ultra Headphones Black',
      'Bose QuietComfort 45 Black','Bose QuietComfort 45 White Smoke',
      'Bose Noise Cancelling 700 Black','Bose SoundLink Around-Ear II Black',
    ],
    'br-sennheiser': [
      'Sennheiser Momentum 4 Wireless Black','Sennheiser Momentum 4 Wireless White',
      'Sennheiser HD 660S2 Open-Back','Sennheiser HD 560S Reference',
      'Sennheiser ACCENTUM Plus Wireless Black',
    ],
    'br-beats': [
      'Beats Studio Pro Over-Ear ANC Black','Beats Solo4 On-Ear Black',
      'Beats Pro Over-Ear Studio Black','Beats EP On-Ear Black',
    ],
    'br-jabra': [
      'Jabra Evolve2 85 Over-Ear ANC Black','Jabra Evolve2 75 Stereo MS Black',
      'Jabra Engage 55 UC Over-Ear',
    ],
    'br-audio-technica': [
      'Audio-Technica ATH-M50xBT2 Wireless Black',
      'Audio-Technica ATH-M50x Studio Monitor Black',
      'Audio-Technica ATH-ANC700BT ANC Black',
    ],
    'br-shure': [
      'Shure AONIC 50 Gen 2 ANC Black','Shure AONIC 40 ANC Black',
      'Shure SRH840A Monitoring Black',
    ],
    'br-marshall': [
      'Marshall Monitor III ANC Black','Marshall Major V Black',
      'Marshall Motif II ANC Black','Marshall Minor IV On-Ear Black',
    ],
  },

  // ── LOA ───────────────────────────────────────────────────────────
  'cat-av-speaker': {
    'br-jbl': [
      'JBL Charge 5 Wi-Fi Blue','JBL Charge 5 Wi-Fi Black',
      'JBL Flip 7 Black','JBL Flip 7 Red',
      'JBL Xtreme 4 Black','JBL Boombox 3 Black',
      'JBL PartyBox 320 Black','JBL Go 4 Black',
      'JBL Pulse 5 Black','JBL Clip 5 Black',
    ],
    'br-sony-audio': [
      'Sony SRS-XB100 Black','Sony SRS-XB100 Blue',
      'Sony SRS-XG300 Black','Sony SRS-XG500 Black',
      'Sony SRS-RA5000 White','Sony SRS-RA3000 Gray',
    ],
    'br-bose': [
      'Bose SoundLink Max Portable Speaker Black',
      'Bose SoundLink Flex 2 Black','Bose SoundLink Flex 2 Blue Dusk',
      'Bose SoundLink Mini 3 Soft Black','Bose Home Speaker 500 Black',
    ],
    'br-marshall': [
      'Marshall Willen II Black','Marshall Emberton III Black',
      'Marshall Tufton Black','Marshall Woburn III Black and Brass',
      'Marshall Stanmore III Black and Brass',
    ],
    'br-harman': [
      'Harman Kardon Onyx Studio 8 Black','Harman Kardon Go + Play 3 Black',
      'Harman Kardon Aura Studio 4 Black','Harman Kardon SoundSticks 4 Black',
    ],
    'br-edifier': [
      'Edifier R1280T Powered Bookshelf Speakers','Edifier R2000DB Powered Bluetooth Bookshelf',
      'Edifier R33BT Wireless Speaker Black','Edifier MP230 Portable Wireless Speaker',
    ],
  },

  // ── CAMERA GIÁM SÁT ──────────────────────────────────────────────
  'cat-cam-security': {
    'br-hikvision': [
      'Hikvision DS-2CD2143G2-I 4MP AcuSense Fixed Dome','Hikvision DS-2CD2183G2-I 8MP AcuSense',
      'Hikvision DS-2CD2347G2-LU ColorVu 4MP','Hikvision DS-2DE4425IWG-E PTZ 4MP',
      'Hikvision DS-7616NI-K2/16P NVR 16CH 4K',
    ],
    'br-dahua': [
      'Dahua IPC-HDW2849H-S-IL 8MP Smart Dual Light','Dahua IPC-HFW2849S-S-IL 8MP',
      'Dahua SD49425XB-HNR PTZ 4MP WizMind','Dahua NVR4216-4KS3 NVR 16CH 4K',
    ],
    'br-kbone': [
      'KBvision KX-A8002iN3 8MP AI Camera','KBvision KX-C4003N3 4MP ColorVu',
      'KBvision KX-A2012N3-A 2MP IP Camera H.265+',
    ],
    'br-ezviz': [
      'EZVIZ H8C 2K+ PTZ Camera Outdoor','EZVIZ H4 1080P Smart Home Camera',
      'EZVIZ BC1C 2K+ Solar Camera','EZVIZ CB3 2K+ Wire-Free Camera',
    ],
    'br-vantech': [
      'Vantech AI-VPH202AI 2MP AI Camera PoE','Vantech VPH-3690AI 3MP Smart',
      'Vantech AI-V2060B 2MP Full Color',
    ],
  },

  // ── CAMERA TRONG NHÀ ─────────────────────────────────────────────
  'cat-cam-indoor': {
    'br-imou': [
      'Imou Cruiser 2 4MP AI Smart Outdoor','Imou Cell Go 4MP Color Night Vision',
      'Imou Ranger 2C 4MP 360° PTZ Indoor','Imou Cue 3 3MP IP66 Indoor',
      'Imou Bullet 2C 4MP H.265 Outdoor',
    ],
    'br-reolink': [
      'Reolink E1 Pro 5MP WiFi Indoor Camera','Reolink TrackMix PoE 8MP Dual Lens',
      'Reolink RLC-810A 8MP Smart Detection PoE','Reolink E1 Outdoor Pro 5MP WiFi',
    ],
    'br-ezviz': [
      'EZVIZ C6 3K Smart Home Pan/Tilt Camera','EZVIZ C3W Pro 4MP Color Night Vision',
      'EZVIZ TY2 2MP 360° AI Smart Indoor','EZVIZ H6c 2K+ 3MP Indoor Camera',
    ],
    'br-xiaomi-cam': [
      'Xiaomi Camera 2K Pro 360° Xoay 360 AI','Xiaomi Outdoor Camera AW300 2K',
      'Xiaomi Smart Camera C400 4MP 360°','Xiaomi Smart Camera C300 2K WiFi',
    ],
    'br-tp-link': [
      'TP-Link Tapo C225 2.5K QHD Pan/Tilt AI','TP-Link Tapo C320WS 4MP 2K Outdoor',
      'TP-Link Tapo C220 4MP Pan/Tilt Camera Indoor','TP-Link Tapo C110 3MP Indoor Security',
    ],
    'br-imilab': [
      'IMILAB EC5 4MP Floodlight Camera Outdoor','IMILAB C22 3K Home Camera',
      'IMILAB W22 Pro 3K Pan/Tilt Camera','IMILAB C30 2K Home Cameras 1296P',
    ],
  },

  // ── Ổ CỨNG ───────────────────────────────────────────────────────
  'cat-av-hdd': {
    'br-seagate': [
      'Seagate Expansion 2TB USB 3.0 Portable','Seagate Expansion 4TB Desktop External',
      'Seagate Backup Plus Slim 2TB Portable Blue','Seagate One Touch SSD 1TB Silver',
      'Seagate Barracuda 2TB 7200RPM 256MB Cache Internal',
      'Seagate IronWolf 4TB NAS 5400RPM','Seagate FireCuda 530 4TB M.2 NVMe SSD',
    ],
    'br-wd': [
      'WD Elements Portable 2TB USB 3.0 Black','WD Elements Desktop 6TB USB 3.0',
      'WD My Passport 2TB USB-C Black','WD My Passport SSD 1TB Blue',
      'WD Blue 2TB 5400RPM 256MB SATA Internal','WD Black SN850X 2TB NVMe SSD M.2',
      'WD Red Plus 4TB NAS 5400RPM SATA',
    ],
    'br-toshiba': [
      'Toshiba Canvio Basics 2TB USB 3.0 Black','Toshiba Canvio Advance 2TB USB 3.0 Black',
      'Toshiba Canvio Flex 2TB USB-C',
      'Toshiba P300 2TB 7200RPM 256MB SATA',
    ],
    'br-samsung-st': [
      'Samsung T7 Portable SSD 2TB Black USB 3.2','Samsung T7 Shield 2TB Beige',
      'Samsung T9 Portable SSD 4TB Black USB 3.2 Gen 2×2',
      'Samsung 870 EVO 2TB SATA III SSD 2.5"','Samsung 990 Pro 2TB PCIe 4.0 NVMe M.2',
    ],
    'br-kingston': [
      'Kingston XS2000 Pocket-Sized SSD 2TB USB 3.2','Kingston XS1000 External SSD 2TB',
      'Kingston A400 480GB SATA III SSD','Kingston KC3000 2TB PCIe 4.0 NVMe',
    ],
  },

  // ── THẺ NHỚ ──────────────────────────────────────────────────────
  'cat-av-sdcard': {
    'br-sandisk': [
      'SanDisk Extreme PRO microSDXC 512GB V30 A2 200MB/s','SanDisk Extreme microSDXC 256GB V30 A2',
      'SanDisk Ultra microSDXC 256GB Class 10 120MB/s',
      'SanDisk Extreme PRO SDXC 256GB UHS-I V30 200MB/s',
      'SanDisk Extreme SD Card 1TB A2 V30',
    ],
    'br-samsung-st': [
      'Samsung EVO Select microSDXC 256GB 130MB/s A2','Samsung Pro Plus microSDXC 512GB 180MB/s',
      'Samsung Pro Ultimate microSDXC 512GB 200MB/s',
    ],
    'br-lexar': [
      'Lexar PLAY microSDXC 512GB UHS-I 150MB/s','Lexar SILVER PLUS microSDXC 256GB 205MB/s',
      'Lexar Professional 1066x SDHC 32GB 160MB/s',
    ],
    'br-kingston': [
      'Kingston Canvas Go! Plus microSDXC 512GB 170MB/s',
      'Kingston Canvas React Plus microSDXC 256GB 285MB/s',
    ],
    'br-transcend': [
      'Transcend 350V microSDXC 256GB Class10 UHS-I U1',
      'Transcend 330S microSDXC 256GB UHS-I U3 100MB/s',
    ],
  },

  // ── USB ───────────────────────────────────────────────────────────
  'cat-av-usb': {
    'br-sandisk': [
      'SanDisk Ultra Flair USB 3.0 256GB 150MB/s','SanDisk Extreme Pro USB 3.2 512GB 420MB/s',
      'SanDisk Ultra Dual Drive Go USB-C 256GB','SanDisk Ultra Fit USB 3.1 128GB',
    ],
    'br-samsung-st': [
      'Samsung FIT Plus USB 3.1 256GB 400MB/s','Samsung Bar Plus USB 3.1 256GB 300MB/s',
    ],
    'br-kingston': [
      'Kingston DataTraveler Exodia M 256GB USB 3.2','Kingston DataTraveler Max 512GB USB 3.2 Gen 2',
    ],
    'br-transcend': [
      'Transcend JetFlash 930C 256GB USB 3.2 Type-C + Type-A',
      'Transcend JetFlash 790 256GB USB 3.1',
    ],
    'br-pny': [
      'PNY Pro Elite V2 USB 3.2 256GB 600MB/s','PNY Turbo Attache 4 USB 3.0 256GB',
    ],
    'br-lexar': [
      'Lexar JumpDrive P30 USB 3.2 512GB 450MB/s','Lexar JumpDrive S80 USB 3.1 256GB',
    ],
  },

  // ── HUB, CÁP CHUYỂN ĐỔI ─────────────────────────────────────────
  'cat-laptop-acc-hub': {
    'br-ugreen': [
      'Ugreen Revodok Pro 209 12-in-2 Dual Monitor Hub Thunderbolt 4',
      'Ugreen 9-in-1 USB-C Hub 4K HDMI PD 100W','Ugreen 7-in-1 Hub USB-C 4K HDMI',
      'Ugreen USB-C to 4 USB-A 3.0 Slim Hub','Ugreen USB-C to HDMI 4K Adapter',
    ],
    'br-anker': [
      'Anker 555 USB-C Hub 8-in-1 4K HDMI','Anker 341 USB-C Hub 7-in-1',
      'Anker PowerExpand+ 7-in-1 USB-C PD Media Hub',
      'Anker 512 USB-C Adapter 5-in-1','Anker 563 USB-C Docking Station 10-in-1',
    ],
    'br-baseus': [
      'Baseus Mechanical Eye 6-in-1 USB-C Hub','Baseus Harmonia 6-in-1 USB-C Hub',
      'Baseus Replicator 12-in-1 Hub USB-C Dual HDMI 4K',
    ],
    'br-logitech': [
      'Logitech Logi Dock Flex Desktop Hub USB-C','Logitech Universal USB-C Multimedia Hub',
    ],
  },

  // ── CHUỘT MÁY TÍNH ──────────────────────────────────────────────
  'cat-laptop-acc-mouse': {
    'br-logitech': [
      'Logitech MX Master 3S Wireless 8000 DPI Graphite',
      'Logitech MX Anywhere 3S Compact Wireless Black',
      'Logitech G Pro X Superlight 2 Wireless Black',
      'Logitech G502 X Plus Wireless Black','Logitech G403 Hero Gaming Black',
      'Logitech M750 Signature Wireless Black',
    ],
    'br-razer': [
      'Razer DeathAdder V3 HyperSpeed Wireless Black',
      'Razer Viper V3 Pro Wireless Black','Razer Basilisk V3 Pro Wireless Black',
      'Razer Orochi V2 Multi-Device Wireless Black',
    ],
    'br-microsoft': [
      'Microsoft Arc Wireless Mouse Black','Microsoft Bluetooth Ergonomic Mouse Black',
      'Microsoft Pro IntelliMouse Black',
    ],
    'br-dell': [
      'Dell Premier Rechargeable Wireless Mouse MS900','Dell Bluetooth Mouse MS700',
      'Dell Multi-Device Wireless Mouse MS5320W',
    ],
    'br-hp': [
      'HP 935 Creator Wireless Mouse Black','HP ENVY Rechargeable Mouse 500 Black',
      'HP Z3700 Dual Mode Wireless Mouse',
    ],
    'br-msi': [
      'MSI Clutch GM41 Lightweight Wireless Black',
      'MSI Accolade EK31 Wireless Gaming Black',
    ],
  },

  // ── BÀN PHÍM ─────────────────────────────────────────────────────
  'cat-laptop-acc-keyboard': {
    'br-logitech': [
      'Logitech MX Keys S Wireless Illuminated Graphite',
      'Logitech MX Mechanical Mini Wireless Pale Gray',
      'Logitech G Pro X TKL Gaming Keyboard Black',
      'Logitech G915 TKL Wireless LIGHTSPEED Clicky Black',
      'Logitech K380s Multi-Device Wireless Graphite',
    ],
    'br-razer': [
      'Razer BlackWidow V4 Pro Wireless Yellow Switch Black',
      'Razer Huntsman V3 Pro TKL Analog Optical Black',
      'Razer DeathStalker V2 Pro Wireless Black',
    ],
    'br-microsoft': [
      'Microsoft Ergonomic Keyboard Black','Microsoft Bluetooth Keyboard Black',
      'Microsoft Surface Keyboard Platinum',
    ],
    'br-asus': [
      'Asus ROG Falchion RX Low-Profile Compact Wireless Black',
      'Asus ROG Strix Flare II Animate TKL Black',
    ],
    'br-msi': [
      'MSI VIGOR GK71 Sonic Gaming Keyboard Red','MSI VIGOR GK50 Low Profile TKL Black',
    ],
    'br-dell': [
      'Dell Pro Wireless Keyboard KB740 Black','Dell Alienware Pro Wireless Keyboard Black',
    ],
  },

  // ── ROUTER THIẾT BỊ MẠNG ────────────────────────────────────────
  'cat-laptop-acc-router': {
    'br-tp-link': [
      'TP-Link Archer BE9300 WiFi 7 Tri-Band Router','TP-Link Archer AX73 WiFi 6 AX5400',
      'TP-Link Deco XE75 Pro AXE5400 WiFi 6E Mesh','TP-Link EX511 WiFi 6 AX3000',
      'TP-Link Archer C80 WiFi 5 AC1900','TP-Link TL-WR840N 300Mbps Wireless N Router',
    ],
    'br-tplink-net': [
      'TP-Link Archer BE9300 WiFi 7','TP-Link Deco BE85 WiFi 7 Mesh',
      'TP-Link Archer AXE300 WiFi 6E Tri-Band',
    ],
    'br-asus': [
      'Asus RT-BE96U WiFi 7 Dual Band Router 10Gbps',
      'Asus ZenWiFi Pro ET12 WiFi 6E AXE11000 Mesh',
      'Asus RT-AX88U Pro WiFi 6 AX6000 Dual Band',
    ],
    'br-linksys': [
      'Linksys Velop Pro 7 BE11000 Tri-Band Mesh',
      'Linksys Hydra Pro 6E AXE6600 WiFi 6E Router',
    ],
    'br-netgear': [
      'Netgear Orbi RBK963S WiFi 6E AXE11000 Tri-Band Mesh',
      'Netgear Nighthawk RS700S WiFi 7 BE19000',
    ],
    'br-totolink': [
      'TOTOLINK X6000R WiFi 6 AX3000 Dual Band','TOTOLINK X5000R WiFi 6 AX1800',
      'TOTOLINK N300RT 300Mbps WiFi Router',
    ],
    'br-mercusys': [
      'Mercusys MR90X WiFi 6 AX6000 Dual Band','Mercusys MR70X WiFi 6 AX1800',
      'Mercusys Halo H70X AX1800 WiFi 6 Mesh',
    ],
  },

  // ── WEBCAM ────────────────────────────────────────────────────────
  'cat-cam-webcam': {
    'br-logitech': [
      'Logitech StreamCam Full HD 1080p 60fps USB-C','Logitech C920s HD Pro Webcam 1080p',
      'Logitech Brio 500 Full HD Webcam Graphite','Logitech MX Brio 705 4K Enterprise Webcam',
      'Logitech C505 HD 720p Webcam',
    ],
    'br-razer': [
      'Razer Kiyo Pro Ultra 4K 60fps Streaming Webcam',
      'Razer Kiyo X Full HD 1080p Streaming Webcam',
    ],
    'br-microsoft': [
      'Microsoft Modern Webcam Full HD 1080p Teams Certified',
      'Microsoft LifeCam HD-3000 720p USB Webcam',
    ],
  },

  // ── MICRO ─────────────────────────────────────────────────────────
  'cat-av-mic': {
    'br-shure': [
      'Shure MV7X Professional USB/XLR Dynamic Podcast Mic',
      'Shure SM7B Cardioid Dynamic Microphone','Shure MV7 USB Podcast Microphone Black',
      'Shure SM58 Dynamic Vocal Microphone','Shure PGA48 Cardioid Dynamic Mic',
    ],
    'br-sennheiser': [
      'Sennheiser Profile USB Microphone','Sennheiser MK 4 Cardioid Condenser',
      'Sennheiser e945 Super-Cardioid Dynamic Mic',
    ],
    'br-sony-audio': [
      'Sony ECM-B10 Compact Multi-Interface Shotgun Mic',
      'Sony ECM-W2BT Wireless Microphone System',
    ],
    'br-jabra': [
      'Jabra Speak2 75 MS Portable Speakerphone','Jabra Speak 510+ Portable USB/BT',
    ],
  },

  // ── BALO TÚI CHỐNG SỐC ──────────────────────────────────────────
  'cat-laptop-acc-bag': {
    'br-dell': [
      'Dell Premier Backpack 15 PE1520P Black','Dell EcoLoop Premier Slim Backpack 15 Black',
      'Dell Professional Backpack 15 Black',
    ],
    'br-hp': [
      'HP Renew Business 17.3 Laptop Bag','HP Pavilion Gaming Backpack 500 15.6',
      'HP Prelude Pro 15.6 Backpack Black',
    ],
    'br-asus': [
      'Asus ProArt 16 Backpack Black','Asus ROG Ranger BP4701 17 Gaming Backpack',
      'Asus Nereus Laptop Backpack 16 Black',
    ],
    'br-razer': [
      'Razer Rogue 16 Backpack V3 Black','Razer Tactical 15.6 Slim Backpack Black',
    ],
  },

  // ── MIẾNG LÓT CHUỘT ──────────────────────────────────────────────
  'cat-laptop-acc-mousepad': {
    'br-razer': [
      'Razer Goliathus Extended Speed Edition Black','Razer Gigantus V2 XXL Black',
      'Razer Atlas Tempered Glass Black','Razer Strider Chroma RGB XXL',
    ],
    'br-logitech': [
      'Logitech G840 XL Gaming Mouse Pad Black','Logitech G640 Large Cloth Gaming',
      'Logitech Studio Desk Mat Lavender',
    ],
    'br-msi': [
      'MSI Agility GD30 Pro Gaming Mousepad Large','MSI Agility GD70 Pro XXL Black',
    ],
  },

  // ── BẢNG VẼ ĐIỆN TỬ ─────────────────────────────────────────────
  'cat-laptop-acc-drawing': {
    'br-dell': [
      'Wacom Intuos Medium Bluetooth Black','Wacom Intuos Pro M Paper Edition',
    ],
    'br-hp': [
      'Huion Kamvas Pro 24 4K Pen Display','Huion Inspiroy Dial 2 Wireless',
    ],
    'br-microsoft': [
      'XP-PEN Artist 16 Gen 2 Pen Display 15.4"','XP-PEN Deco Pro Small Wireless',
    ],
    'br-logitech': [
      'XP-PEN Innovator 16 Pen Display 2K IPS','XP-PEN Star G960S Plus Drawing Tablet',
    ],
  },

};

// ── Fallback pool dùng khi không có template cụ thể ──────────────
function makeFallbackPool(catId, brandName, catName) {
  return [
    `${brandName} ${catName} Chính Hãng`,
    `${brandName} ${catName} Cao Cấp`,
    `${brandName} ${catName} Pro Edition`,
    `${brandName} ${catName} Premium`,
    `${brandName} ${catName} Plus`,
    `${brandName} ${catName} Elite`,
  ];
}

const BRAND_NAMES = {
  'br-apple':'Apple','br-samsung':'Samsung','br-oppo':'OPPO','br-xiaomi':'Xiaomi',
  'br-vivo':'vivo','br-realme':'realme','br-nokia':'Nokia','br-masstel':'Masstel',
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
  'br-imilab':'IMILAB','br-annke':'ANNKE','br-kamera':'Kamera',
  'br-seagate':'Seagate','br-wd':'Western Digital','br-samsung-st':'Samsung',
  'br-sandisk':'SanDisk','br-kingston':'Kingston','br-lexar':'Lexar',
  'br-transcend':'Transcend','br-toshiba':'Toshiba','br-pny':'PNY',
  'br-tplink-net':'TP-Link','br-asus-net':'Asus','br-linksys':'Linksys',
  'br-dlink':'D-Link','br-netgear':'Netgear','br-totolink':'TOTOLINK',
  'br-mercusys':'Mercusys','br-cam-webcam':'Generic',
};
const CAT_NAMES = {
  'cat-phone':'Điện thoại','cat-laptop':'Laptop','cat-tablet':'Tablet','cat-watch':'Smartwatch',
  'cat-mobile-acc-powerbank':'Sạc dự phòng','cat-mobile-acc-charger':'Sạc cáp',
  'cat-mobile-acc-case-phone':'Ốp lưng điện thoại','cat-mobile-acc-case-tablet':'Ốp lưng tablet',
  'cat-mobile-acc-screen':'Miếng dán màn hình','cat-mobile-acc-cam-cover':'Dán camera',
  'cat-mobile-acc-airpods-case':'Túi AirPods','cat-mobile-acc-fan':'Quạt mini',
  'cat-mobile-acc-pen':'Bút cảm ứng','cat-mobile-acc-stand':'Giá đỡ',
  'cat-mobile-acc-strap':'Dây đeo điện thoại','cat-mobile-acc-lens':'Lens điện thoại',
  'cat-laptop-acc-hub':'Hub USB-C','cat-laptop-acc-mouse':'Chuột máy tính',
  'cat-laptop-acc-keyboard':'Bàn phím','cat-laptop-acc-router':'Router WiFi',
  'cat-laptop-acc-bag':'Balo laptop','cat-laptop-acc-pouch':'Túi phụ kiện',
  'cat-laptop-acc-keyboard-cover':'Phủ phím laptop','cat-laptop-acc-software':'Phần mềm',
  'cat-laptop-acc-monitor-stand':'Giá treo màn hình','cat-laptop-acc-mousepad':'Miếng lót chuột',
  'cat-laptop-acc-drawing':'Bảng vẽ điện tử',
  'cat-av-bt-earphone':'Tai nghe Bluetooth','cat-av-wire-earphone':'Tai nghe dây',
  'cat-av-headphone':'Tai nghe chụp tai','cat-av-sport-earphone':'Tai nghe thể thao',
  'cat-av-speaker':'Loa bluetooth','cat-av-mic':'Micro',
  'cat-av-projector':'Máy chiếu','cat-av-smartglass':'Kính thông minh',
  'cat-av-hdd':'Ổ cứng','cat-av-sdcard':'Thẻ nhớ','cat-av-usb':'USB',
  'cat-cam-security':'Camera Giám Sát','cat-cam-indoor':'Camera trong nhà',
  'cat-cam-outdoor':'Camera ngoài trời','cat-cam-solar':'Camera Năng Lượng Mặt Trời',
  'cat-cam-4g':'Camera 4G','cat-cam-doorbell':'Chuông cửa Camera','cat-cam-webcam':'Webcam',
};

// ── Lấy name pool ─────────────────────────────────────────────────
function getNamePool(catId, brandId) {
  const catPool = NAME_POOLS[catId];
  if (catPool && catPool[brandId] && catPool[brandId].length > 0) {
    return catPool[brandId];
  }
  // Fallback: dùng tên brand + category
  const brandName = BRAND_NAMES[brandId] || brandId;
  const catName   = CAT_NAMES[catId]    || catId;
  return makeFallbackPool(catId, brandName, catName);
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── MAIN ──────────────────────────────────────────────────────────
async function main() {
  console.log('\n✏️  RENAME PRODUCTS — Đặt tên sản phẩm thực tế');
  console.log('═'.repeat(60));

  const total = await prisma.product.count();
  console.log(`  Tổng sản phẩm cần rename : ${total.toLocaleString()}`);

  // Lấy danh sách (category_id, brand_id) distinct
  const pairs = await prisma.$queryRaw`
    SELECT DISTINCT category_id, brand_id FROM "Product" WHERE is_deleted = false
  `;
  console.log(`  Số cặp (category, brand) : ${pairs.length}`);
  console.log('─'.repeat(60));

  const startMs = Date.now();
  let totalUpdated = 0;
  let pairIdx = 0;

  for (const { category_id: catId, brand_id: brandId } of pairs) {
    pairIdx++;
    const namePool = getNamePool(catId, brandId);

    let cursor;
    while (true) {
      const products = await prisma.product.findMany({
        where:   { category_id: catId, brand_id: brandId, is_deleted: false },
        select:  { id: true },
        take:    5000,
        orderBy: { id: 'asc' },
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (products.length === 0) break;

      // Group bởi tên để dùng updateMany (giảm số lần gọi DB)
      const byName = {};
      for (const p of products) {
        const name = pick(namePool);
        if (!byName[name]) byName[name] = [];
        byName[name].push(p.id);
      }

      // Bulk update theo nhóm tên
      await Promise.all(
        Object.entries(byName).map(([name, ids]) =>
          prisma.product.updateMany({ where: { id: { in: ids } }, data: { name } })
        )
      );

      totalUpdated += products.length;
      cursor = products[products.length - 1].id;

      const elapsed = (Date.now() - startMs) / 1000;
      const rps     = Math.round(totalUpdated / Math.max(elapsed, 1));
      const eta     = rps > 0 ? Math.ceil((total - totalUpdated) / rps) : 0;
      const etaStr  = eta > 60 ? `${Math.floor(eta/60)}m${eta%60}s` : `${eta}s`;
      process.stdout.write(
        `\r  Pair ${pairIdx}/${pairs.length} | ${totalUpdated.toLocaleString()}/${total.toLocaleString()}` +
        `  ${rps.toLocaleString()}/s  ETA:${etaStr}     `
      );
    }
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log('\n');
  console.log('  ╔═════════════════════════════════════════════╗');
  console.log('  ║         RENAME HOÀN THÀNH                   ║');
  console.log('  ╠═════════════════════════════════════════════╣');
  console.log(`  ║  Sản phẩm đã đổi tên : ${String(totalUpdated.toLocaleString()).padStart(10)}           ║`);
  console.log(`  ║  Số cặp (cat,brand)  : ${String(pairs.length).padStart(10)}           ║`);
  console.log(`  ║  Thời gian           : ${String(elapsed + 's').padStart(10)}           ║`);
  console.log('  ╚═════════════════════════════════════════════╝\n');

  // Hiển thị 10 tên mẫu
  const samples = await prisma.product.findMany({ take: 10, orderBy: { id: 'asc' }, select: { name: true, category_id: true, brand_id: true } });
  console.log('  📋 Tên mẫu sau khi đổi:');
  for (const s of samples) console.log(`    [${s.category_id}|${s.brand_id}] ${s.name}`);
}

main()
  .catch(e => { console.error('\n❌ Lỗi:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
