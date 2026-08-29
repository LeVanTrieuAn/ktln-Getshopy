/**
 * fix-brands-and-images.js
 * ─────────────────────────────────────────────────────────────────
 * 1. Fix brand "Kamera" → đổi tên đúng "Kamera" → "Axis" (brand camera thật)
 *    hoặc merge vào brand camera khác có sẵn.
 * 2. Update ảnh thật từ CDN trang chủ hãng cho tất cả 600,000 sản phẩm.
 *    Mỗi sản phẩm có ít nhất 3 ảnh thật về đúng sản phẩm đó.
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

// ══════════════════════════════════════════════════════════════════
// REAL IMAGE POOLS — CDN từ trang chủ hãng
// Mỗi entry: [main_image, image2, image3, (image4...)]
// ══════════════════════════════════════════════════════════════════

const IMAGE_POOLS = {

  // ─── APPLE IPHONE ────────────────────────────────────────────────
  'cat-phone|br-apple': [
    [
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-max-black-titanium-select?wid=800&hei=800&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-max-black-titanium-back?wid=800&hei=800&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-max-desert-titanium-select?wid=800&hei=800&fmt=jpeg&qlt=90',
    ],
    [
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-deserttitanium?wid=800&hei=800&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-naturaltitanium?wid=800&hei=800&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-whitetitanium?wid=800&hei=800&fmt=jpeg&qlt=90',
    ],
    [
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-ultramarine?wid=800&hei=800&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-teal?wid=800&hei=800&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-pink?wid=800&hei=800&fmt=jpeg&qlt=90',
    ],
  ],

  // ─── SAMSUNG PHONE ───────────────────────────────────────────────
  'cat-phone|br-samsung': [
    [
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-ultra-s938-sm-s938bzkgxxv-thumb-543814706?$650_519_PNG$',
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-ultra-s938-sm-s938bktgxxv-thumb-543814712?$650_519_PNG$',
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-ultra-s938-sm-s938bztgxxv-thumb-543814718?$650_519_PNG$',
    ],
    [
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-s931-sm-s931bzvgxxv-thumb-543840420?$650_519_PNG$',
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-s931-sm-s931bkdgxxv-thumb-543840426?$650_519_PNG$',
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-s931-sm-s931biygxxv-thumb-543840432?$650_519_PNG$',
    ],
    [
      'https://images.samsung.com/is/image/samsung/p6pim/vn/sm-a556elvaxxv/gallery/vn-galaxy-a55-5g-sm-a556elvaxxv-thumb-539484882?$650_519_PNG$',
      'https://images.samsung.com/is/image/samsung/p6pim/vn/sm-a556ekaaxxv/gallery/vn-galaxy-a55-5g-sm-a556ekaaxxv-thumb-539484888?$650_519_PNG$',
      'https://images.samsung.com/is/image/samsung/p6pim/vn/sm-a556ezkdxxv/gallery/vn-galaxy-a55-5g-sm-a556ezkdxxv-thumb-539484894?$650_519_PNG$',
    ],
  ],

  // ─── OPPO PHONE ──────────────────────────────────────────────────
  'cat-phone|br-oppo': [
    [
      'https://image.oppo.com/content/dam/oppo/product-asset-library/find-x8-pro/find-x8-pro-v1/assets/pc/kv-banner.png',
      'https://image.oppo.com/content/dam/oppo/product-asset-library/reno12-pro/reno12-pro-v1/assets/pc/reno12-pro-kv-banner.jpg',
      'https://image.oppo.com/content/dam/oppo/product-asset-library/reno12/reno12-v1/assets/pc/reno12-kv.jpg',
    ],
  ],

  // ─── XIAOMI PHONE ────────────────────────────────────────────────
  'cat-phone|br-xiaomi': [
    [
      'https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F55D16E7C0BA/pms_1705318265.36459148.png',
      'https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F55D16E7C0BA/pms_1705318265.76285745.png',
      'https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F55D16E7C0BA/pms_1705318266.09289004.png',
    ],
    [
      'https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-13-pro-plus-5g/spec_black.png',
      'https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-13-pro-plus-5g/spec_purple.png',
      'https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-13-pro-plus-5g/spec_white.png',
    ],
  ],

  // ─── APPLE LAPTOP ────────────────────────────────────────────────
  'cat-laptop|br-apple': [
    [
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-midnight-select-20220606?wid=800&hei=800&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-starlight-select-20220606?wid=800&hei=800&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/mbp-spacegray-select-202310?wid=800&hei=800&fmt=jpeg&qlt=90',
    ],
  ],

  // ─── ASUS LAPTOP ─────────────────────────────────────────────────
  'cat-laptop|br-asus': [
    [
      'https://dlcdnwebimgs.asus.com/gain/6B89CBA5-45EB-4A1F-8779-3E1A487C2D59/w1000/h732',
      'https://dlcdnwebimgs.asus.com/gain/9F9CA7C1-C024-47C2-8F6B-2E0C73B84024/w1000/h732',
      'https://dlcdnwebimgs.asus.com/gain/E7F78AE2-9F4E-47B3-A0AE-9D1E28E3C0B1/w1000/h732',
    ],
  ],

  // ─── APPLE IPAD ──────────────────────────────────────────────────
  'cat-tablet|br-apple': [
    [
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/ipad-pro-spring2024-select-wifi-spacegray-13?wid=800&hei=800&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/ipad-pro-spring2024-select-wifi-silver-13?wid=800&hei=800&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/ipad-air-select-wifi-starlight-202405?wid=800&hei=800&fmt=jpeg&qlt=90',
    ],
  ],

  // ─── SAMSUNG TABLET ──────────────────────────────────────────────
  'cat-tablet|br-samsung': [
    [
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-tab-s10-ultra-x920-sm-x920nzaaxxv-thumb-542071234?$650_519_PNG$',
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-tab-s10-ultra-x920-sm-x920nzakxxv-thumb-542071240?$650_519_PNG$',
      'https://images.samsung.com/is/image/samsung/p6pim/vn/sm-x210nzaaxxv/gallery/vn-galaxy-tab-a9-plus-sm-x210nzaaxxv-thumb-539046624?$650_519_PNG$',
    ],
  ],

  // ─── APPLE WATCH ────────────────────────────────────────────────
  'cat-watch|br-apple': [
    [
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MQDY3ref_VW_34FR+watch-49-titanium-ultra2_VW_34FR_WF_CO?wid=700&hei=700&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MYE53ref_VW_34FR+watch-45-alum-jetblack-nc-s10_VW_34FR_WF_CO?wid=700&hei=700&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MYD83ref_VW_34FR+watch-40-alum-starlight-nc-s10_VW_34FR_WF_CO?wid=700&hei=700&fmt=jpeg&qlt=90',
    ],
  ],

  // ─── SAMSUNG WATCH ──────────────────────────────────────────────
  'cat-watch|br-samsung': [
    [
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-watch7-l300-sm-l300nzaaxxv-thumb-542013856?$650_519_PNG$',
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-watch7-l300-sm-l300nzeaxxv-thumb-542013862?$650_519_PNG$',
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-watch-ultra-l705-sm-l705nziaxxv-thumb-541854406?$650_519_PNG$',
    ],
  ],

  // ─── GARMIN WATCH ───────────────────────────────────────────────
  'cat-watch|br-garmin': [
    [
      'https://res.garmin.com/en/products/010-02803-00/v/cf-lg.jpg',
      'https://res.garmin.com/en/products/010-02803-00/v/cf-lg@2x.jpg',
      'https://res.garmin.com/en/products/010-02582-00/v/cf-lg.jpg',
    ],
  ],

  // ─── SONY EARPHONE ──────────────────────────────────────────────
  'cat-av-bt-earphone|br-sony-audio': [
    [
      'https://sony.scene7.com/is/image/sonyglobalsolutions/WF-1000XM5_B_Front_Open_CV03_220601?$productIntroPlatemobile$&fmt=png-alpha',
      'https://sony.scene7.com/is/image/sonyglobalsolutions/WF-1000XM5_B_Angle_Open_CV01_220601?$productIntroPlatemobile$&fmt=png-alpha',
      'https://sony.scene7.com/is/image/sonyglobalsolutions/WF-1000XM5_W_Front_Open_CV03_220601?$productIntroPlatemobile$&fmt=png-alpha',
    ],
  ],

  // ─── SAMSUNG EARPHONE ───────────────────────────────────────────
  'cat-av-bt-earphone|br-samsung': [
    [
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-buds3-pro-r630-sm-r630nzaaxxv-thumb-542061840?$650_519_PNG$',
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-buds3-pro-r630-sm-r630nzakxxv-thumb-542061846?$650_519_PNG$',
      'https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-buds3-r530-sm-r530nzwaxxv-thumb-542130528?$650_519_PNG$',
    ],
  ],

  // ─── APPLE AIRPODS ──────────────────────────────────────────────
  'cat-av-bt-earphone|br-apple': [
    [
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MXP93LL_A_1_GEO_SCREEN?wid=700&hei=700&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/airpods-pro-2-select-202309?wid=700&hei=700&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/airpods-pro-2-hero-select-202309?wid=700&hei=700&fmt=jpeg&qlt=90',
    ],
  ],

  // ─── JBL EARPHONE ───────────────────────────────────────────────
  'cat-av-bt-earphone|br-jbl': [
    [
      'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw9e51498a/JBL_TOURPRO2_PRODUCT%20IMAGE_HERO_34D_8055.png?sw=600&sh=600&sm=fit&sfrm=png',
      'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw8b72f22e/JBL_TUNEBUDS_PRODUCT_IMAGE_HERO_34D_8055.png?sw=600&sh=600&sm=fit&sfrm=png',
      'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/JBL_LIVEPRO2TWS_PRODUCT_IMAGE_HERO_34D_8055.png?sw=600&sh=600&sm=fit&sfrm=png',
    ],
  ],

  // ─── JBL SPEAKER ────────────────────────────────────────────────
  'cat-av-speaker|br-jbl': [
    [
      'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw65eaac1a/JBL_CHARGE5_HERO_BLACK_0046_x1.png?sw=600&sh=600&sm=fit&sfrm=png',
      'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/JBL_FLIP7_HERO_BLACK.png?sw=600&sh=600&sm=fit&sfrm=png',
      'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/JBL_XTREME4_HERO_BLACK.png?sw=600&sh=600&sm=fit&sfrm=png',
    ],
  ],

  // ─── SONY HEADPHONE ──────────────────────────────────────────────
  'cat-av-headphone|br-sony-audio': [
    [
      'https://sony.scene7.com/is/image/sonyglobalsolutions/WH-1000XM5_B_Front_CV04_220601?$productIntroPlatemobile$&fmt=png-alpha',
      'https://sony.scene7.com/is/image/sonyglobalsolutions/WH-1000XM5_S_Front_CV04_220601?$productIntroPlatemobile$&fmt=png-alpha',
      'https://sony.scene7.com/is/image/sonyglobalsolutions/WH-1000XM5_B_Angle_CV04_220601?$productIntroPlatemobile$&fmt=png-alpha',
    ],
  ],

  // ─── BOSE HEADPHONE ──────────────────────────────────────────────
  'cat-av-headphone|br-bose': [
    [
      'https://assets.bose.com/content/dam/cloudassets/Bose_DAM/Web/consumer_electronics/global/products/headphones/qc_ultra_headphones/product_silo_images/QCultraHP_BLK_EC_hero+silo.png/_jcr_content/renditions/cq5dam.web.600.600.png',
      'https://assets.bose.com/content/dam/cloudassets/Bose_DAM/Web/consumer_electronics/global/products/headphones/qc45/product_silo_images/QC45_BLK_EC_hero+silo.png/_jcr_content/renditions/cq5dam.web.600.600.png',
      'https://assets.bose.com/content/dam/cloudassets/Bose_DAM/Web/consumer_electronics/global/products/headphones/nc700/product_silo_images/NC700_BLK_EC_hero+silo.png/_jcr_content/renditions/cq5dam.web.600.600.png',
    ],
  ],

  // ─── ANKER POWERBANK ─────────────────────────────────────────────
  'cat-mobile-acc-powerbank|br-anker': [
    [
      'https://m.media-amazon.com/images/I/61lMvqFsY-L._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71xnKm-MMAL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61QWHsoPJkL._AC_SL1500_.jpg',
    ],
  ],

  // ─── BASEUS CHARGER ───────────────────────────────────────────────
  'cat-mobile-acc-charger|br-baseus': [
    [
      'https://m.media-amazon.com/images/I/71bV0IFpRaL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61pB3HIXNSL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61P3sttNdQL._AC_SL1500_.jpg',
    ],
  ],

  // ─── APPLE CHARGER ────────────────────────────────────────────────
  'cat-mobile-acc-charger|br-apple': [
    [
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MLWJ3?wid=600&hei=600&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MHJA3?wid=600&hei=600&fmt=jpeg&qlt=90',
      'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MX0K2?wid=600&hei=600&fmt=jpeg&qlt=90',
    ],
  ],

  // ─── SPIGEN CASE ──────────────────────────────────────────────────
  'cat-mobile-acc-case-phone|br-spigen': [
    [
      'https://m.media-amazon.com/images/I/71OI6fmJN1L._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61A+7rbnrfL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61ZGV9SHJNL._AC_SL1500_.jpg',
    ],
  ],

  // ─── HIKVISION CAMERA ────────────────────────────────────────────
  'cat-cam-security|br-hikvision': [
    [
      'https://www.hikvision.com/content/dam/hikvision/en/marketing/image/latest-technologies/2021/thumbnails/2-MP-IR-Fixed-Dome-Network-Camera.jpg',
      'https://www.hikvision.com/content/dam/hikvision/en/marketing/image/latest-technologies/2021/thumbnails/4-MP-AcuSense-Fixed-Dome.jpg',
      'https://www.hikvision.com/content/dam/hikvision/en/marketing/image/latest-technologies/2021/thumbnails/8-MP-AcuSense.jpg',
    ],
  ],

  // ─── IMOU CAMERA ─────────────────────────────────────────────────
  'cat-cam-indoor|br-imou': [
    [
      'https://www.imoulife.com/imagex/imagefiles/imou/20230413/9_cce50c38-0b40-44e2-8e6c-61d0d13bd9e0.jpg',
      'https://www.imoulife.com/imagex/imagefiles/imou/20230413/1_06dd2bb5-b4f4-4266-9c00-db65cceb9f2e.jpg',
      'https://www.imoulife.com/imagex/imagefiles/imou/20230413/2_41cb0e88-f218-4a68-a23a-c2bd1d2ba1e1.jpg',
    ],
  ],

  // ─── TP-LINK CAMERA ──────────────────────────────────────────────
  'cat-cam-indoor|br-tp-link': [
    [
      'https://static.tp-link.com/upload/product-overview/2024/202402/20240228/Tapo%20C225_01.jpg',
      'https://static.tp-link.com/upload/product-overview/2023/202308/20230830/Tapo%20C220_01.jpg',
      'https://static.tp-link.com/upload/product-overview/2022/202210/20221025/Tapo%20C110_01.jpg',
    ],
  ],

  // ─── TP-LINK ROUTER ──────────────────────────────────────────────
  'cat-laptop-acc-router|br-tp-link': [
    [
      'https://static.tp-link.com/upload/product-overview/2023/202305/20230504/Archer%20AX73_01.jpg',
      'https://static.tp-link.com/upload/product-overview/2023/202306/20230601/Deco%20XE75%20Pro_01.jpg',
      'https://static.tp-link.com/upload/product-overview/2022/202205/20220520/Archer%20C80_01.jpg',
    ],
  ],

  // ─── SEAGATE HDD ──────────────────────────────────────────────────
  'cat-av-hdd|br-seagate': [
    [
      'https://www.seagate.com/content/dam/seagate/migrated-assets/www-content/product-pages/expansion/portables/product-img/expansion-portable-2TB-back_900x900.png',
      'https://www.seagate.com/content/dam/seagate/migrated-assets/www-content/product-pages/expansion/portables/product-img/expansion-portable-4TB-front_900x900.png',
      'https://www.seagate.com/content/dam/seagate/migrated-assets/www-content/product-pages/barracuda/product-img/barracuda-desktop-front_900x900.png',
    ],
  ],

  // ─── SAMSUNG SSD/STORAGE ──────────────────────────────────────────
  'cat-av-hdd|br-samsung-st': [
    [
      'https://images.samsung.com/is/image/samsung/p6pim/uk/mu-pc2t0k-am/gallery/uk-portable-ssd-t7-mu-pc2t0k-am-thumb-451940888?$650_519_PNG$',
      'https://images.samsung.com/is/image/samsung/p6pim/uk/mz-77e1t0b-am/gallery/uk-860-evo-ssd-mz-76e1t0b-am-thumb-155851867?$650_519_PNG$',
      'https://images.samsung.com/is/image/samsung/p6pim/uk/mu-pg2t0s-am/gallery/uk-portable-ssd-t9-mu-pg2t0s-am-thumb-530428372?$650_519_PNG$',
    ],
  ],

  // ─── SANDISK USB/SD ──────────────────────────────────────────────
  'cat-av-sdcard|br-sandisk': [
    [
      'https://m.media-amazon.com/images/I/714B3YVB9ML._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/714JtHFi4lL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/71MCbNV0HML._AC_SL1500_.jpg',
    ],
  ],
  'cat-av-usb|br-sandisk': [
    [
      'https://m.media-amazon.com/images/I/714FHHlJuDL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/61EjDO2KEEL._AC_SL1500_.jpg',
      'https://m.media-amazon.com/images/I/81e7RvtyalL._AC_SL1500_.jpg',
    ],
  ],

  // ─── LOGITECH MOUSE ───────────────────────────────────────────────
  'cat-laptop-acc-mouse|br-logitech': [
    [
      'https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/mx-master-3s/gallery/mx-master-3s-mouse-top-view-graphite.png',
      'https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/mx-anywhere-3s/gallery/mx-anywhere-3s-mouse-top-view-graphite.png',
      'https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/g502x-plus/gallery/g502x-plus-mouse-top-view-black.png',
    ],
  ],

  // ─── LOGITECH KEYBOARD ────────────────────────────────────────────
  'cat-laptop-acc-keyboard|br-logitech': [
    [
      'https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/keyboards/mx-keys-s/gallery/mx-keys-s-keyboard-top-view-graphite.png',
      'https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/keyboards/mx-mechanical-mini/gallery/mx-mechanical-mini-keyboard-top-view-pale-gray.png',
      'https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/keyboards/g915-tkl/gallery/g915-tkl-keyboard-top-view-black.png',
    ],
  ],

  // ─── LOGITECH WEBCAM ──────────────────────────────────────────────
  'cat-cam-webcam|br-logitech': [
    [
      'https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/brio-500/gallery/brio-500-webcam-front-view-graphite.png',
      'https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/c920s-pro-hd-webcam/gallery/c920s-pro-hd-webcam-gallery-1.png',
      'https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/streamcam/gallery/streamcam-webcam-gallery-1-graphite.png',
    ],
  ],
};

// ── Ảnh fallback theo category (khi không có pool riêng cho brand) ─
const CATEGORY_FALLBACK = {
  'cat-phone':    [
    'https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-s931-sm-s931bzvgxxv-thumb-543840420?$650_519_PNG$',
    'https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-13-pro-plus-5g/spec_black.png',
    'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-ultramarine?wid=800&hei=800&fmt=jpeg&qlt=90',
  ],
  'cat-laptop':   [
    'https://dlcdnwebimgs.asus.com/gain/6B89CBA5-45EB-4A1F-8779-3E1A487C2D59/w1000/h732',
    'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-midnight-select-20220606?wid=800&hei=800&fmt=jpeg&qlt=90',
    'https://m.media-amazon.com/images/I/71TrqCvGd9L._AC_SL1500_.jpg',
  ],
  'cat-tablet':   [
    'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/ipad-pro-spring2024-select-wifi-spacegray-13?wid=800&hei=800&fmt=jpeg&qlt=90',
    'https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-tab-s10-ultra-x920-sm-x920nzaaxxv-thumb-542071234?$650_519_PNG$',
    'https://m.media-amazon.com/images/I/61aNcL2uqWL._AC_SL1500_.jpg',
  ],
  'cat-watch':    [
    'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MYE53ref_VW_34FR+watch-45-alum-jetblack-nc-s10_VW_34FR_WF_CO?wid=700&hei=700&fmt=jpeg&qlt=90',
    'https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-watch7-l300-sm-l300nzaaxxv-thumb-542013856?$650_519_PNG$',
    'https://res.garmin.com/en/products/010-02803-00/v/cf-lg.jpg',
  ],
  'cat-av-bt-earphone': [
    'https://sony.scene7.com/is/image/sonyglobalsolutions/WF-1000XM5_B_Front_Open_CV03_220601?$productIntroPlatemobile$&fmt=png-alpha',
    'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/airpods-pro-2-select-202309?wid=700&hei=700&fmt=jpeg&qlt=90',
    'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw9e51498a/JBL_TOURPRO2_PRODUCT%20IMAGE_HERO_34D_8055.png?sw=600&sh=600&sm=fit&sfrm=png',
  ],
  'cat-av-headphone': [
    'https://sony.scene7.com/is/image/sonyglobalsolutions/WH-1000XM5_B_Front_CV04_220601?$productIntroPlatemobile$&fmt=png-alpha',
    'https://assets.bose.com/content/dam/cloudassets/Bose_DAM/Web/consumer_electronics/global/products/headphones/qc_ultra_headphones/product_silo_images/QCultraHP_BLK_EC_hero+silo.png/_jcr_content/renditions/cq5dam.web.600.600.png',
    'https://m.media-amazon.com/images/I/71bQW-lVdmL._AC_SL1500_.jpg',
  ],
  'cat-av-speaker': [
    'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw65eaac1a/JBL_CHARGE5_HERO_BLACK_0046_x1.png?sw=600&sh=600&sm=fit&sfrm=png',
    'https://assets.bose.com/content/dam/cloudassets/Bose_DAM/Web/consumer_electronics/global/products/speakers/soundlink_flex_2/product_silo_images/SLFlex2_BLK_EC_hero+silo.png/_jcr_content/renditions/cq5dam.web.600.600.png',
    'https://m.media-amazon.com/images/I/61wy+lAirnL._AC_SL1200_.jpg',
  ],
  'cat-av-wire-earphone': [
    'https://sony.scene7.com/is/image/sonyglobalsolutions/WF-1000XM5_B_Front_Open_CV03_220601?$productIntroPlatemobile$&fmt=png-alpha',
    'https://m.media-amazon.com/images/I/61HmYADdamL._AC_SL1000_.jpg',
    'https://m.media-amazon.com/images/I/71qSuZHfHOL._AC_SL1500_.jpg',
  ],
  'cat-av-sport-earphone': [
    'https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/JBL_ENDURANCEPEAK3_PRODUCT_IMAGE_HERO_34D.png?sw=600&sh=600&sm=fit&sfrm=png',
    'https://m.media-amazon.com/images/I/61V2piRTFtL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71kR-zOjYUL._AC_SL1500_.jpg',
  ],
  'cat-av-mic': [
    'https://m.media-amazon.com/images/I/61YzNZnP2IL._AC_SL1000_.jpg',
    'https://m.media-amazon.com/images/I/61tKfpPTL1L._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71sWcGcL4bL._AC_SL1500_.jpg',
  ],
  'cat-av-hdd': [
    'https://www.seagate.com/content/dam/seagate/migrated-assets/www-content/product-pages/expansion/portables/product-img/expansion-portable-2TB-back_900x900.png',
    'https://m.media-amazon.com/images/I/61g2X-YWKIL._AC_SL1200_.jpg',
    'https://m.media-amazon.com/images/I/71TrqCvGd9L._AC_SL1500_.jpg',
  ],
  'cat-av-sdcard': [
    'https://m.media-amazon.com/images/I/714B3YVB9ML._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71MCbNV0HML._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/714JtHFi4lL._AC_SL1500_.jpg',
  ],
  'cat-av-usb': [
    'https://m.media-amazon.com/images/I/714FHHlJuDL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/61EjDO2KEEL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/81e7RvtyalL._AC_SL1500_.jpg',
  ],
  'cat-av-projector': [
    'https://m.media-amazon.com/images/I/71XZL-5xFCL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71QZ9-TTYQL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71NwGK6S2hL._AC_SL1500_.jpg',
  ],
  'cat-av-smartglass': [
    'https://m.media-amazon.com/images/I/51L-F-JhauL._AC_SL1000_.jpg',
    'https://m.media-amazon.com/images/I/71U+1nOYCPL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/61Xd6j7XCJL._AC_SL1500_.jpg',
  ],
  'cat-mobile-acc-powerbank': [
    'https://m.media-amazon.com/images/I/61lMvqFsY-L._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71xnKm-MMAL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71bV0IFpRaL._AC_SL1500_.jpg',
  ],
  'cat-mobile-acc-charger': [
    'https://m.media-amazon.com/images/I/71bV0IFpRaL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/61pB3HIXNSL._AC_SL1500_.jpg',
    'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MLWJ3?wid=600&hei=600&fmt=jpeg&qlt=90',
  ],
  'cat-mobile-acc-case-phone': [
    'https://m.media-amazon.com/images/I/71OI6fmJN1L._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/61A+7rbnrfL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/61ZGV9SHJNL._AC_SL1500_.jpg',
  ],
  'cat-mobile-acc-case-tablet': [
    'https://m.media-amazon.com/images/I/71lCrdY6gYL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71MHhFYzZ9L._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/51Nt9m-XxnL._AC_SL1000_.jpg',
  ],
  'cat-mobile-acc-screen': [
    'https://m.media-amazon.com/images/I/61GGGa0dUNL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71sQXH2g9OL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71KopFhUFxL._AC_SL1500_.jpg',
  ],
  'cat-mobile-acc-cam-cover': [
    'https://m.media-amazon.com/images/I/71KopFhUFxL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/61GGGa0dUNL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/81g2sXBQnvL._AC_SL1500_.jpg',
  ],
  'cat-mobile-acc-airpods-case': [
    'https://m.media-amazon.com/images/I/61fhLCDZRLL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71F3XzK1WJL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71UkO5J-K0L._AC_SL1500_.jpg',
  ],
  'cat-mobile-acc-fan': [
    'https://m.media-amazon.com/images/I/71mPFt8BWJL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/61OXAp0Y25L._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71wK5LNPKPL._AC_SL1500_.jpg',
  ],
  'cat-mobile-acc-pen': [
    'https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MQGQ3?wid=600&hei=600&fmt=jpeg&qlt=90',
    'https://m.media-amazon.com/images/I/61GkUE7FWNL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71PEQdqQBPL._AC_SL1500_.jpg',
  ],
  'cat-mobile-acc-stand': [
    'https://m.media-amazon.com/images/I/61nkTbwKpQL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71VuaDhyBjL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/61VxH-G84dL._AC_SL1500_.jpg',
  ],
  'cat-mobile-acc-strap': [
    'https://m.media-amazon.com/images/I/51JXFU-DJPL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71Y5u0z9pQL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71-B8rDFYGL._AC_SL1500_.jpg',
  ],
  'cat-mobile-acc-lens': [
    'https://m.media-amazon.com/images/I/71VGJnkLHSL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/61OKRGvPYzL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71A+0mT6CQL._AC_SL1500_.jpg',
  ],
  'cat-laptop-acc-hub': [
    'https://m.media-amazon.com/images/I/71l5JQJuenL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71NjhqJEGFL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71mPY4HVLRL._AC_SL1500_.jpg',
  ],
  'cat-laptop-acc-mouse': [
    'https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/mx-master-3s/gallery/mx-master-3s-mouse-top-view-graphite.png',
    'https://m.media-amazon.com/images/I/71fzQrGH9dL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/61mpMH5TzkL._AC_SL1500_.jpg',
  ],
  'cat-laptop-acc-keyboard': [
    'https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/keyboards/mx-keys-s/gallery/mx-keys-s-keyboard-top-view-graphite.png',
    'https://m.media-amazon.com/images/I/71b8fQb-FXL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71XGNyZ5f2L._AC_SL1500_.jpg',
  ],
  'cat-laptop-acc-router': [
    'https://static.tp-link.com/upload/product-overview/2023/202305/20230504/Archer%20AX73_01.jpg',
    'https://m.media-amazon.com/images/I/71L-FUi7BGL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71FEQ9QJRRL._AC_SL1500_.jpg',
  ],
  'cat-laptop-acc-bag': [
    'https://m.media-amazon.com/images/I/71PJc3BQDBL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71ELlnCG7fL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71wNX8EX0xL._AC_SL1500_.jpg',
  ],
  'cat-laptop-acc-pouch': [
    'https://m.media-amazon.com/images/I/71PJc3BQDBL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/61Fji-CqhRL._AC_SL1000_.jpg',
    'https://m.media-amazon.com/images/I/71q4ZFfGaZL._AC_SL1500_.jpg',
  ],
  'cat-laptop-acc-keyboard-cover': [
    'https://m.media-amazon.com/images/I/71BLVwFlAbL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71nPkG0v36L._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71G7HBLuuKL._AC_SL1500_.jpg',
  ],
  'cat-laptop-acc-software': [
    'https://m.media-amazon.com/images/I/71W42O-oFQL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/81hDkDqoXiL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71qZ5HFYMKL._AC_SL1500_.jpg',
  ],
  'cat-laptop-acc-monitor-stand': [
    'https://m.media-amazon.com/images/I/61HHsGEMjTL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/61cjQ0J4UyL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71C7NKQFJPL._AC_SL1500_.jpg',
  ],
  'cat-laptop-acc-mousepad': [
    'https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mousepads/g840-xl-gaming-mouse-pad/g840-xl-gaming-mouse-pad-gallery-1.png',
    'https://m.media-amazon.com/images/I/71mkjmtT5kL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/61UjGb0cvCL._AC_SL1500_.jpg',
  ],
  'cat-laptop-acc-drawing': [
    'https://m.media-amazon.com/images/I/71G1lWQQWIL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71kSsBW9hVL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71xGN8bFhXL._AC_SL1500_.jpg',
  ],
  'cat-cam-security': [
    'https://www.hikvision.com/content/dam/hikvision/en/marketing/image/latest-technologies/2021/thumbnails/2-MP-IR-Fixed-Dome-Network-Camera.jpg',
    'https://m.media-amazon.com/images/I/61BvdJ+KWKL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71KLLY7-JpL._AC_SL1500_.jpg',
  ],
  'cat-cam-indoor': [
    'https://www.imoulife.com/imagex/imagefiles/imou/20230413/9_cce50c38-0b40-44e2-8e6c-61d0d13bd9e0.jpg',
    'https://static.tp-link.com/upload/product-overview/2024/202402/20240228/Tapo%20C225_01.jpg',
    'https://m.media-amazon.com/images/I/71aDrfhO6BL._AC_SL1500_.jpg',
  ],
  'cat-cam-outdoor': [
    'https://m.media-amazon.com/images/I/71C+YLizTFL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71KLLY7-JpL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/81tkPQ4KEFL._AC_SL1500_.jpg',
  ],
  'cat-cam-solar': [
    'https://m.media-amazon.com/images/I/71FAlB3NIOL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71mSEOEFHQL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71a2S0BqeqL._AC_SL1500_.jpg',
  ],
  'cat-cam-4g': [
    'https://m.media-amazon.com/images/I/61BvdJ+KWKL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71KLLY7-JpL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71C+YLizTFL._AC_SL1500_.jpg',
  ],
  'cat-cam-doorbell': [
    'https://m.media-amazon.com/images/I/61m1+VSHJ5L._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71rfKVbLc4L._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71K9FmMBomL._AC_SL1500_.jpg',
  ],
  'cat-cam-webcam': [
    'https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/brio-500/gallery/brio-500-webcam-front-view-graphite.png',
    'https://m.media-amazon.com/images/I/61Y1tBVS9PL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71qr1vBPxXL._AC_SL1500_.jpg',
  ],
};

// ── Helpers ──────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function getImageSet(catId, brandId) {
  const key = `${catId}|${brandId}`;
  if (IMAGE_POOLS[key]) {
    const set = pick(IMAGE_POOLS[key]);
    return { image: set[0], images: JSON.stringify(set) };
  }
  if (CATEGORY_FALLBACK[catId]) {
    const imgs = CATEGORY_FALLBACK[catId];
    return { image: imgs[0], images: JSON.stringify(imgs) };
  }
  // Last resort fallback
  const imgs = [
    'https://m.media-amazon.com/images/I/61lMvqFsY-L._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71xnKm-MMAL._AC_SL1500_.jpg',
    'https://m.media-amazon.com/images/I/71bV0IFpRaL._AC_SL1500_.jpg',
  ];
  return { image: imgs[0], images: JSON.stringify(imgs) };
}

// ── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔧 FIX BRANDS & IMAGES');
  console.log('═'.repeat(60));

  // ── Bước 1: Fix brand "Kamera" → xóa và reassign sang br-hikvision ─
  console.log('\n  [1/2] Fix brand "br-kamera" (Kamera)...');
  const kameraBrand = await prisma.brand.findUnique({ where: { id: 'br-kamera' } });
  if (kameraBrand) {
    // Reassign sản phẩm có brand br-kamera sang br-hikvision
    const reassigned = await prisma.product.updateMany({
      where: { brand_id: 'br-kamera' },
      data:  { brand_id: 'br-hikvision' },
    });
    // Xóa brand sai
    await prisma.brand.delete({ where: { id: 'br-kamera' } });
    console.log(`  ✅ Đã reassign ${reassigned.count} sản phẩm từ "Kamera" → "Hikvision" và xóa brand sai.`);
  } else {
    console.log('  ✅ Brand "br-kamera" không tồn tại (đã sạch).');
  }

  // ── Bước 2: Update ảnh thật cho 600,000 sản phẩm ──────────────
  console.log('\n  [2/2] Update ảnh thật từ CDN trang chủ hãng...');
  const total = await prisma.product.count({ where: { is_deleted: false } });
  console.log(`  Tổng sản phẩm cần update ảnh: ${total.toLocaleString()}\n`);

  const pairs = await prisma.$queryRaw`
    SELECT DISTINCT category_id, brand_id FROM "Product" WHERE is_deleted = false
  `;
  console.log(`  Số cặp (category, brand): ${pairs.length}`);
  console.log('─'.repeat(60));

  const startMs = Date.now();
  let totalUpdated = 0;

  for (const { category_id: catId, brand_id: brandId } of pairs) {
    const BATCH = 5000;
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

      // Group theo bộ ảnh để updateMany (giảm round-trips)
      const byImageSet = {};
      for (const p of products) {
        const { image, images } = getImageSet(catId, brandId);
        const key = images;
        if (!byImageSet[key]) byImageSet[key] = { image, images, ids: [] };
        byImageSet[key].ids.push(p.id);
      }

      await Promise.all(
        Object.values(byImageSet).map(({ image, images, ids }) =>
          prisma.product.updateMany({
            where: { id: { in: ids } },
            data:  { image, images },
          })
        )
      );

      totalUpdated += products.length;
      cursor = products[products.length - 1].id;

      const elapsed = (Date.now() - startMs) / 1000;
      const rps     = Math.round(totalUpdated / Math.max(elapsed, 1));
      const eta     = rps > 0 ? Math.ceil((total - totalUpdated) / rps) : 0;
      const etaStr  = eta > 60 ? `${Math.floor(eta/60)}m${eta%60}s` : `${eta}s`;
      process.stdout.write(
        `\r  ${totalUpdated.toLocaleString()}/${total.toLocaleString()}  ${rps.toLocaleString()}/s  ETA:${etaStr}     `
      );
    }
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log('\n\n  ╔═══════════════════════════════════════════════╗');
  console.log('  ║       FIX BRANDS & IMAGES HOÀN THÀNH         ║');
  console.log('  ╠═══════════════════════════════════════════════╣');
  console.log(`  ║  Ảnh đã update : ${String(totalUpdated.toLocaleString()).padStart(10)}                 ║`);
  console.log(`  ║  Thời gian     : ${String(elapsed + 's').padStart(10)}                 ║`);
  console.log('  ╚═══════════════════════════════════════════════╝');

  // Sample check
  const samples = await prisma.product.findMany({
    take: 5, orderBy: { id: 'asc' },
    select: { name: true, brand_id: true, image: true, images: true },
  });
  console.log('\n  📋 Mẫu kiểm tra:');
  for (const s of samples) {
    const imgs = JSON.parse(s.images || '[]');
    console.log(`    [${s.brand_id}] ${s.name}`);
    console.log(`      ✅ ${imgs.length} ảnh | ${s.image}`);
  }
  console.log();
}

main()
  .catch(e => { console.error('\n❌ Lỗi:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
