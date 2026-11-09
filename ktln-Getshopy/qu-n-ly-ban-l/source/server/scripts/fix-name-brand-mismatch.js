/**
 * fix-name-brand-mismatch.js
 * ─────────────────────────────────────────────────────────────────
 * Fix lỗi tên sản phẩm không khớp brand:
 *   - Mỗi (brand_id, category_id) chỉ dùng tên đúng của brand đó
 *   - Không bao giờ dùng tên của brand khác làm fallback
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

// ── Tên sản phẩm thật theo brand — KHÔNG nhầm brand ──────────────
const BRAND_TEMPLATES = {

  // ══════════════════════════════════════════════
  // ĐIỆN THOẠI
  // ══════════════════════════════════════════════
  'cat-phone|br-apple': [
    { name:'iPhone 16 Pro Max 256GB Black Titanium', price:34490000, orig:36990000, imgs:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-max-black-titanium-select?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-deserttitanium?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-whitetitanium?wid=800&hei=800&fmt=jpeg&qlt=90'] },
    { name:'iPhone 16 Pro Max 512GB Desert Titanium', price:38990000, orig:41490000, imgs:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-max-desert-titanium-select?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-blacktitanium?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-naturaltitanium?wid=800&hei=800&fmt=jpeg&qlt=90'] },
    { name:'iPhone 16 Pro 128GB White Titanium', price:28490000, orig:30990000, imgs:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-whitetitanium?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-deserttitanium?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-blacktitanium?wid=800&hei=800&fmt=jpeg&qlt=90'] },
    { name:'iPhone 16 Plus 128GB Ultramarine', price:26490000, orig:28990000, imgs:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-7inch-ultramarine?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-7inch-teal?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-7inch-pink?wid=800&hei=800&fmt=jpeg&qlt=90'] },
    { name:'iPhone 16 128GB Black', price:22490000, orig:24990000, imgs:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-black?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-ultramarine?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-white?wid=800&hei=800&fmt=jpeg&qlt=90'] },
    { name:'iPhone 15 Pro Max 512GB Black Titanium', price:30990000, orig:34990000, imgs:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-15-pro-max-black-titanium-select?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-15-pro-max-natural-titanium-select?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-15-pro-max-white-titanium-select?wid=800&hei=800&fmt=jpeg&qlt=90'] },
    { name:'iPhone 15 128GB Pink', price:18990000, orig:22990000, imgs:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-15-pink-select?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-15-blue-select?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-15-yellow-select?wid=800&hei=800&fmt=jpeg&qlt=90'] },
    { name:'iPhone SE (3rd Gen) 128GB Midnight', price:11490000, orig:13490000, imgs:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-se-finish-select-202203-midnight?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-se-finish-select-202203-starlight?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-se-finish-select-202203-red?wid=800&hei=800&fmt=jpeg&qlt=90'] },
  ],
  'cat-phone|br-samsung': [
    { name:'Samsung Galaxy S25 Ultra 512GB Titanium Black', price:33990000, orig:36990000, imgs:['https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-ultra-s938-sm-s938bzkgxxv-thumb-543814706?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-ultra-s938-sm-s938bktgxxv-thumb-543814712?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-ultra-s938-sm-s938bztgxxv-thumb-543814718?$650_519_PNG$'] },
    { name:'Samsung Galaxy S25+ 256GB Icy Blue', price:26990000, orig:29990000, imgs:['https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-plus-s936-sm-s936blbgxxv-thumb-543832422?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-plus-s936-sm-s936bzvgxxv-thumb-543832428?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-plus-s936-sm-s936bkdgxxv-thumb-543832434?$650_519_PNG$'] },
    { name:'Samsung Galaxy S25 128GB Navy', price:22990000, orig:25990000, imgs:['https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-s931-sm-s931bzvgxxv-thumb-543840420?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-s931-sm-s931bkdgxxv-thumb-543840426?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-s931-sm-s931biygxxv-thumb-543840432?$650_519_PNG$'] },
    { name:'Samsung Galaxy A55 5G 256GB Awesome Iceblue', price:9490000, orig:10990000, imgs:['https://images.samsung.com/is/image/samsung/p6pim/vn/sm-a556elvaxxv/gallery/vn-galaxy-a55-5g-sm-a556elvaxxv-thumb-539484882?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/sm-a556ekaaxxv/gallery/vn-galaxy-a55-5g-sm-a556ekaaxxv-thumb-539484888?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/sm-a556ezkdxxv/gallery/vn-galaxy-a55-5g-sm-a556ezkdxxv-thumb-539484894?$650_519_PNG$'] },
    { name:'Samsung Galaxy A35 5G 128GB Awesome Iceblue', price:7490000, orig:8990000, imgs:['https://images.samsung.com/is/image/samsung/p6pim/vn/sm-a356elvaxxv/gallery/vn-galaxy-a35-5g-sm-a356elvaxxv-thumb-539484576?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/sm-a356ezkdxxv/gallery/vn-galaxy-a35-5g-sm-a356ezkdxxv-thumb-539484582?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/sm-a356ezwdxxv/gallery/vn-galaxy-a35-5g-sm-a356ezwdxxv-thumb-539484588?$650_519_PNG$'] },
    { name:'Samsung Galaxy Z Fold6 512GB Navy', price:42990000, orig:47990000, imgs:['https://images.samsung.com/is/image/samsung/p6pim/vn/2407/gallery/vn-galaxy-z-fold6-f956-sm-f956bkbgxxv-thumb-541548754?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2407/gallery/vn-galaxy-z-fold6-f956-sm-f956bzkgxxv-thumb-541548760?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2407/gallery/vn-galaxy-z-fold6-f956-sm-f956bztgxxv-thumb-541548766?$650_519_PNG$'] },
    { name:'Samsung Galaxy Z Flip6 256GB Yellow', price:25990000, orig:28990000, imgs:['https://images.samsung.com/is/image/samsung/p6pim/vn/2407/gallery/vn-galaxy-z-flip6-f741-sm-f741bzyexxv-thumb-541545994?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2407/gallery/vn-galaxy-z-flip6-f741-sm-f741bzkgxxv-thumb-541546000?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2407/gallery/vn-galaxy-z-flip6-f741-sm-f741bzkexxv-thumb-541546006?$650_519_PNG$'] },
  ],
  'cat-phone|br-oppo': [
    { name:'OPPO Find X8 Pro 512GB Space Black', price:28990000, orig:32990000, imgs:['https://image.oppo.com/content/dam/oppo/product-asset-library/find-x8-pro/find-x8-pro-v1/assets/pc/kv-banner.png','https://image.oppo.com/content/dam/oppo/product-asset-library/find-x8-pro/find-x8-pro-v1/assets/pc/color-selector-black.png','https://image.oppo.com/content/dam/oppo/product-asset-library/find-x8-pro/find-x8-pro-v1/assets/pc/color-selector-white.png'] },
    { name:'OPPO Reno12 Pro 5G 256GB Sunset Gold', price:11990000, orig:13990000, imgs:['https://image.oppo.com/content/dam/oppo/product-asset-library/reno12-pro/reno12-pro-v1/assets/pc/reno12-pro-kv-banner.jpg','https://image.oppo.com/content/dam/oppo/product-asset-library/reno12-pro/reno12-pro-v1/assets/pc/color-nav-image-gold.jpg','https://image.oppo.com/content/dam/oppo/product-asset-library/reno12-pro/reno12-pro-v1/assets/pc/color-nav-image-gray.jpg'] },
    { name:'OPPO Reno12 5G 256GB Matte Brown', price:9490000, orig:10990000, imgs:['https://image.oppo.com/content/dam/oppo/product-asset-library/reno12/reno12-v1/assets/pc/reno12-kv.jpg','https://image.oppo.com/content/dam/oppo/product-asset-library/reno12/reno12-v1/assets/pc/colors-brown.jpg','https://image.oppo.com/content/dam/oppo/product-asset-library/reno12/reno12-v1/assets/pc/colors-grey.jpg'] },
    { name:'OPPO A3 Pro 5G 256GB Starry Black', price:6490000, orig:7990000, imgs:['https://image.oppo.com/content/dam/oppo/product-asset-library/a3-pro/a3-pro-v1/assets/pc/kv.jpg','https://image.oppo.com/content/dam/oppo/product-asset-library/a3-pro/a3-pro-v1/assets/pc/color-black.jpg','https://image.oppo.com/content/dam/oppo/product-asset-library/a3-pro/a3-pro-v1/assets/pc/color-purple.jpg'] },
    { name:'OPPO A38 128GB Glowing Black', price:3990000, orig:4990000, imgs:['https://image.oppo.com/content/dam/oppo/product-asset-library/a38/a38-v1/assets/pc/kv.jpg','https://image.oppo.com/content/dam/oppo/product-asset-library/a38/a38-v1/assets/pc/color-black.jpg','https://image.oppo.com/content/dam/oppo/product-asset-library/a38/a38-v1/assets/pc/color-gold.jpg'] },
  ],
  'cat-phone|br-xiaomi': [
    { name:'Xiaomi 14 Ultra 512GB Black', price:27990000, orig:31990000, imgs:['https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F55D16E7C0BA/pms_1705318265.36459148.png','https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F55D16E7C0BA/pms_1705318265.76285745.png','https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F55D16E7C0BA/pms_1705318266.09289004.png'] },
    { name:'Xiaomi 14T Pro 512GB Titan Black', price:17490000, orig:19990000, imgs:['https://i01.appmifile.com/webfile/globalimg/products/m/14t-pro/pc-spec-black.png','https://i01.appmifile.com/webfile/globalimg/products/m/14t-pro/pc-spec-titanium.png','https://i01.appmifile.com/webfile/globalimg/products/m/14t-pro/pc-spec-blue.png'] },
    { name:'Redmi Note 14 Pro+ 5G 512GB Midnight Black', price:10490000, orig:11990000, imgs:['https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-14-pro-plus-5g/spec-black.png','https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-14-pro-plus-5g/spec-purple.png','https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-14-pro-plus-5g/spec-silver.png'] },
    { name:'Redmi Note 13 Pro+ 5G 256GB Aurora Purple', price:8990000, orig:10490000, imgs:['https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-13-pro-plus-5g/spec_black.png','https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-13-pro-plus-5g/spec_purple.png','https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-13-pro-plus-5g/spec_white.png'] },
    { name:'Poco X6 Pro 512GB Black', price:8490000, orig:9990000, imgs:['https://i01.appmifile.com/webfile/globalimg/products/m/poco-x6-pro/spec-black.png','https://i01.appmifile.com/webfile/globalimg/products/m/poco-x6-pro/spec-yellow.png','https://i01.appmifile.com/webfile/globalimg/products/m/poco-x6-pro/spec-grey.png'] },
    { name:'Redmi 13C 128GB Navy Blue', price:3490000, orig:4290000, imgs:['https://i01.appmifile.com/webfile/globalimg/products/m/redmi-13c/spec-blue.png','https://i01.appmifile.com/webfile/globalimg/products/m/redmi-13c/spec-black.png','https://i01.appmifile.com/webfile/globalimg/products/m/redmi-13c/spec-green.png'] },
  ],
  'cat-phone|br-vivo': [
    { name:'vivo V40 Pro 5G 256GB Titanium Grey', price:13990000, orig:15990000, imgs:['https://www.vivo.com/content/dam/vivo/global/products/v40-pro/v40-pro-titanium-grey.png','https://www.vivo.com/content/dam/vivo/global/products/v40-pro/v40-pro-ganges-blue.png','https://www.vivo.com/content/dam/vivo/global/products/v40-pro/v40-pro-back.png'] },
    { name:'vivo V40 5G 256GB Ganges Blue', price:11990000, orig:13490000, imgs:['https://www.vivo.com/content/dam/vivo/global/products/v40/v40-ganges-blue.png','https://www.vivo.com/content/dam/vivo/global/products/v40/v40-titanium-grey.png','https://www.vivo.com/content/dam/vivo/global/products/v40/v40-peach.png'] },
    { name:'vivo Y300 Pro+ 5G 256GB Crystal Black', price:8490000, orig:9990000, imgs:['https://www.vivo.com/content/dam/vivo/global/products/y300-pro/y300-pro-crystal-black.png','https://www.vivo.com/content/dam/vivo/global/products/y300-pro/y300-pro-titanium-blue.png','https://www.vivo.com/content/dam/vivo/global/products/y300-pro/y300-pro-back.png'] },
    { name:'vivo Y200 5G 256GB Crystal Purple', price:6490000, orig:7990000, imgs:['https://www.vivo.com/content/dam/vivo/global/products/y200/y200-crystal-purple.png','https://www.vivo.com/content/dam/vivo/global/products/y200/y200-crystal-black.png','https://www.vivo.com/content/dam/vivo/global/products/y200/y200-back.png'] },
  ],
  'cat-phone|br-realme': [
    { name:'realme GT 6 5G 512GB Fluid Silver', price:15490000, orig:17490000, imgs:['https://image.realme.com/content/dam/realme/vn/product/gt6/realme-gt-6-silver.png','https://image.realme.com/content/dam/realme/vn/product/gt6/realme-gt-6-blue.png','https://image.realme.com/content/dam/realme/vn/product/gt6/realme-gt-6-back.png'] },
    { name:'realme 12 Pro+ 5G 512GB Navigator Beige', price:11490000, orig:13490000, imgs:['https://image.realme.com/content/dam/realme/vn/product/12pro-plus/realme-12-pro-plus-beige.png','https://image.realme.com/content/dam/realme/vn/product/12pro-plus/realme-12-pro-plus-blue.png','https://image.realme.com/content/dam/realme/vn/product/12pro-plus/realme-12-pro-plus-back.png'] },
    { name:'realme C67 5G 256GB Stargazing Black', price:4990000, orig:5990000, imgs:['https://image.realme.com/content/dam/realme/vn/product/c67-5g/realme-c67-5g-black.png','https://image.realme.com/content/dam/realme/vn/product/c67-5g/realme-c67-5g-purple.png','https://image.realme.com/content/dam/realme/vn/product/c67-5g/realme-c67-5g-back.png'] },
    { name:'realme Narzo 70 Pro 5G 256GB Glass Black', price:6990000, orig:7990000, imgs:['https://image.realme.com/content/dam/realme/vn/product/narzo-70-pro/realme-narzo-70-pro-black.png','https://image.realme.com/content/dam/realme/vn/product/narzo-70-pro/realme-narzo-70-pro-green.png','https://image.realme.com/content/dam/realme/vn/product/narzo-70-pro/realme-narzo-70-pro-back.png'] },
  ],
  'cat-phone|br-honor': [
    { name:'HONOR Magic6 Pro 512GB Supernova Blue', price:22990000, orig:25990000, imgs:['https://www.hihonor.com/content/dam/honor/global/products/phones/magic6-pro/specs/honor-magic6-pro-blue.png','https://www.hihonor.com/content/dam/honor/global/products/phones/magic6-pro/specs/honor-magic6-pro-black.png','https://www.hihonor.com/content/dam/honor/global/products/phones/magic6-pro/specs/honor-magic6-pro-back.png'] },
    { name:'HONOR 200 Pro 512GB Midnight Black', price:15990000, orig:17990000, imgs:['https://www.hihonor.com/content/dam/honor/global/products/phones/honor-200-pro/specs/honor-200-pro-black.png','https://www.hihonor.com/content/dam/honor/global/products/phones/honor-200-pro/specs/honor-200-pro-white.png','https://www.hihonor.com/content/dam/honor/global/products/phones/honor-200-pro/specs/honor-200-pro-back.png'] },
    { name:'HONOR X9b 5G 256GB Cyan Lake', price:7990000, orig:9490000, imgs:['https://www.hihonor.com/content/dam/honor/global/products/phones/honor-x9b/specs/honor-x9b-cyan.png','https://www.hihonor.com/content/dam/honor/global/products/phones/honor-x9b/specs/honor-x9b-black.png','https://www.hihonor.com/content/dam/honor/global/products/phones/honor-x9b/specs/honor-x9b-back.png'] },
  ],
  'cat-phone|br-nokia': [
    { name:'Nokia G60 5G 128GB Midnight Black', price:4990000, orig:5990000, imgs:['https://www.nokia.com/sites/default/files/styles/scale_1920/public/2022-09/Nokia_G60_5G_Midnight_Black_front.jpg','https://www.nokia.com/sites/default/files/styles/scale_1920/public/2022-09/Nokia_G60_5G_Midnight_Black_back.jpg','https://www.nokia.com/sites/default/files/styles/scale_1920/public/2022-09/Nokia_G60_5G_Midnight_Black_side.jpg'] },
    { name:'Nokia G42 5G 128GB So Purple', price:3490000, orig:4290000, imgs:['https://www.nokia.com/sites/default/files/styles/scale_1920/public/2023-07/nokia_g42_5g_so_purple_front.jpg','https://www.nokia.com/sites/default/files/styles/scale_1920/public/2023-07/nokia_g42_5g_so_purple_back.jpg','https://www.nokia.com/sites/default/files/styles/scale_1920/public/2023-07/nokia_g42_5g_so_grey_front.jpg'] },
    { name:'Nokia C32 128GB Charcoal', price:2490000, orig:2990000, imgs:['https://www.nokia.com/sites/default/files/styles/scale_1920/public/2023-05/nokia_c32_charcoal_front.jpg','https://www.nokia.com/sites/default/files/styles/scale_1920/public/2023-05/nokia_c32_charcoal_back.jpg','https://www.nokia.com/sites/default/files/styles/scale_1920/public/2023-05/nokia_c32_beach_pink_front.jpg'] },
  ],
  'cat-phone|br-motorola': [
    { name:'Motorola Edge 50 Pro 5G 256GB Black Beauty', price:12990000, orig:14990000, imgs:['https://motorola-global-portal.custhelp.com/ci/fattach/get/5015836/0/filename/edge50pro-black-beauty.jpg','https://motorola-global-portal.custhelp.com/ci/fattach/get/5015837/0/filename/edge50pro-hot-pink.jpg','https://motorola-global-portal.custhelp.com/ci/fattach/get/5015838/0/filename/edge50pro-back.jpg'] },
    { name:'Motorola Moto G85 5G 256GB Cobalt Blue', price:8490000, orig:9990000, imgs:['https://motorola-global-portal.custhelp.com/ci/fattach/get/5012234/0/filename/motog85-cobalt-blue.jpg','https://motorola-global-portal.custhelp.com/ci/fattach/get/5012235/0/filename/motog85-urban-grey.jpg','https://motorola-global-portal.custhelp.com/ci/fattach/get/5012236/0/filename/motog85-back.jpg'] },
    { name:'Motorola Razr 50 Ultra 5G 256GB Midnight Blue', price:22990000, orig:25990000, imgs:['https://motorola-global-portal.custhelp.com/ci/fattach/get/5018823/0/filename/razr50ultra-midnight-blue.jpg','https://motorola-global-portal.custhelp.com/ci/fattach/get/5018824/0/filename/razr50ultra-spring-green.jpg','https://motorola-global-portal.custhelp.com/ci/fattach/get/5018825/0/filename/razr50ultra-open.jpg'] },
  ],
  'cat-phone|br-tecno': [
    { name:'TECNO Camon 30 Pro 5G 256GB Moonlit Silver', price:6490000, orig:7990000, imgs:['https://www.tecno-mobile.com/content/dam/tecno/global/products/camon30pro5g/silver.png','https://www.tecno-mobile.com/content/dam/tecno/global/products/camon30pro5g/black.png','https://www.tecno-mobile.com/content/dam/tecno/global/products/camon30pro5g/back.png'] },
    { name:'TECNO Spark 20 Pro+ 256GB Startrail Black', price:4490000, orig:5490000, imgs:['https://www.tecno-mobile.com/content/dam/tecno/global/products/spark20proplus/black.png','https://www.tecno-mobile.com/content/dam/tecno/global/products/spark20proplus/silver.png','https://www.tecno-mobile.com/content/dam/tecno/global/products/spark20proplus/back.png'] },
    { name:'TECNO Pova 6 Neo 5G 128GB Startrail Black', price:3490000, orig:4490000, imgs:['https://www.tecno-mobile.com/content/dam/tecno/global/products/pova6neo/black.png','https://www.tecno-mobile.com/content/dam/tecno/global/products/pova6neo/gold.png','https://www.tecno-mobile.com/content/dam/tecno/global/products/pova6neo/back.png'] },
  ],
  'cat-phone|br-infinix': [
    { name:'Infinix Note 40 Pro 5G 256GB Volcanic Orange', price:5990000, orig:7490000, imgs:['https://www.infinixmobility.com/content/dam/infinix/global/products/note40pro5g/orange.png','https://www.infinixmobility.com/content/dam/infinix/global/products/note40pro5g/teal.png','https://www.infinixmobility.com/content/dam/infinix/global/products/note40pro5g/back.png'] },
    { name:'Infinix Hot 40i 128GB Starlit Black', price:2990000, orig:3990000, imgs:['https://www.infinixmobility.com/content/dam/infinix/global/products/hot40i/black.png','https://www.infinixmobility.com/content/dam/infinix/global/products/hot40i/red.png','https://www.infinixmobility.com/content/dam/infinix/global/products/hot40i/back.png'] },
    { name:'Infinix Zero 40 5G 256GB Titanium Gray', price:7990000, orig:9490000, imgs:['https://www.infinixmobility.com/content/dam/infinix/global/products/zero40-5g/gray.png','https://www.infinixmobility.com/content/dam/infinix/global/products/zero40-5g/gold.png','https://www.infinixmobility.com/content/dam/infinix/global/products/zero40-5g/back.png'] },
  ],
  'cat-phone|br-itel': [
    { name:'itel A70 256GB Azure Blue', price:1990000, orig:2490000, imgs:['https://www.itel-africa.com/content/dam/itel/global/products/a70/blue.png','https://www.itel-africa.com/content/dam/itel/global/products/a70/black.png','https://www.itel-africa.com/content/dam/itel/global/products/a70/back.png'] },
    { name:'itel S24 128GB Blue Star', price:2990000, orig:3490000, imgs:['https://www.itel-africa.com/content/dam/itel/global/products/s24/blue.png','https://www.itel-africa.com/content/dam/itel/global/products/s24/black.png','https://www.itel-africa.com/content/dam/itel/global/products/s24/back.png'] },
    { name:'itel P55+ 4G 64GB NFC Black', price:2490000, orig:2990000, imgs:['https://www.itel-africa.com/content/dam/itel/global/products/p55plus/black.png','https://www.itel-africa.com/content/dam/itel/global/products/p55plus/blue.png','https://www.itel-africa.com/content/dam/itel/global/products/p55plus/back.png'] },
  ],
  'cat-phone|br-masstel': [
    { name:'Masstel Tab 10 Ultra 4G 128GB Black', price:2290000, orig:2990000, imgs:['https://masstel.vn/upload/images/products/tab10ultra-black.jpg','https://masstel.vn/upload/images/products/tab10ultra-silver.jpg','https://masstel.vn/upload/images/products/tab10ultra-back.jpg'] },
    { name:'Masstel Fami Pro 4G 32GB', price:1490000, orig:1990000, imgs:['https://masstel.vn/upload/images/products/fami-pro-black.jpg','https://masstel.vn/upload/images/products/fami-pro-gold.jpg','https://masstel.vn/upload/images/products/fami-pro-back.jpg'] },
  ],
  'cat-phone|br-mobell': [
    { name:'Mobell Nova 8 Plus 128GB Black', price:1490000, orig:1990000, imgs:['https://mobell.vn/upload/products/nova8plus-black.jpg','https://mobell.vn/upload/products/nova8plus-gold.jpg','https://mobell.vn/upload/products/nova8plus-back.jpg'] },
    { name:'Mobell S19 Pro 64GB Blue', price:990000, orig:1290000, imgs:['https://mobell.vn/upload/products/s19pro-blue.jpg','https://mobell.vn/upload/products/s19pro-black.jpg','https://mobell.vn/upload/products/s19pro-back.jpg'] },
  ],

  // ══════════════════════════════════════════════
  // LAPTOP
  // ══════════════════════════════════════════════
  'cat-laptop|br-apple': [
    { name:'MacBook Air M3 13 inch 8GB 256GB Midnight', price:27490000, orig:29990000, imgs:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-midnight-select-20220606?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-midnight-back-20220606?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-midnight-open-20220606?wid=800&hei=800&fmt=jpeg&qlt=90'] },
    { name:'MacBook Air M3 15 inch 16GB 512GB Starlight', price:34490000, orig:37990000, imgs:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-starlight-select-20220606?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-starlight-back-20220606?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-starlight-open-20220606?wid=800&hei=800&fmt=jpeg&qlt=90'] },
    { name:'MacBook Pro M4 Pro 14 inch 24GB 512GB Space Black', price:54990000, orig:59990000, imgs:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/mbp-spacegray-select-202310?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/mbp-spacegray-back-202310?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/mbp-spacegray-open-202310?wid=800&hei=800&fmt=jpeg&qlt=90'] },
    { name:'MacBook Pro M4 Max 16 inch 48GB 1TB Silver', price:84990000, orig:91990000, imgs:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/mbp-silver-select-202310?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/mbp-silver-back-202310?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/mbp-silver-open-202310?wid=800&hei=800&fmt=jpeg&qlt=90'] },
  ],
  'cat-laptop|br-asus': [
    { name:'Asus ROG Strix G16 G614JVR i9-14900HX 16GB 1TB RTX4060', price:32990000, orig:36990000, imgs:['https://dlcdnwebimgs.asus.com/gain/6B89CBA5-45EB-4A1F-8779-3E1A487C2D59/w1000/h732','https://dlcdnwebimgs.asus.com/gain/9F9CA7C1-C024-47C2-8F6B-2E0C73B84024/w1000/h732','https://dlcdnwebimgs.asus.com/gain/E7F78AE2-9F4E-47B3-A0AE-9D1E28E3C0B1/w1000/h732'] },
    { name:'Asus Zenbook 14 OLED UX3405MA Ultra 7 16GB 512GB', price:22990000, orig:26990000, imgs:['https://dlcdnwebimgs.asus.com/gain/D1D1D7C1-C024-47C2-8F6B-2E0C73B84024/w1000/h732','https://dlcdnwebimgs.asus.com/gain/E1E1E7C1-C024-47C2-8F6B-2E0C73B84025/w1000/h732','https://dlcdnwebimgs.asus.com/gain/F1F1F7C1-C024-47C2-8F6B-2E0C73B84026/w1000/h732'] },
    { name:'Asus Vivobook 15 OLED A1507QA Snapdragon X 16GB 512GB', price:16990000, orig:18990000, imgs:['https://dlcdnwebimgs.asus.com/gain/A9A9A7C1-C024-47C2-8F6B-2E0C73B84024/w1000/h732','https://dlcdnwebimgs.asus.com/gain/B9B9B7C1-C024-47C2-8F6B-2E0C73B84025/w1000/h732','https://dlcdnwebimgs.asus.com/gain/C9C9C7C1-C024-47C2-8F6B-2E0C73B84026/w1000/h732'] },
  ],
  'cat-laptop|br-hp': [
    { name:'HP Pavilion 15-eg3066TU i5-1335U 16GB 512GB Silver', price:14990000, orig:16990000, imgs:['https://ssl-product-images.www8-hp.com/digmedialib/prodimg/knowledgebase/c09061534.png','https://ssl-product-images.www8-hp.com/digmedialib/prodimg/knowledgebase/c09061535.png','https://ssl-product-images.www8-hp.com/digmedialib/prodimg/knowledgebase/c09061536.png'] },
    { name:'HP Envy x360 14-fc0093TU Ultra 5 125U 16GB 512GB', price:23990000, orig:26990000, imgs:['https://ssl-product-images.www8-hp.com/digmedialib/prodimg/knowledgebase/c08907271.png','https://ssl-product-images.www8-hp.com/digmedialib/prodimg/knowledgebase/c08907272.png','https://ssl-product-images.www8-hp.com/digmedialib/prodimg/knowledgebase/c08907273.png'] },
    { name:'HP Victus 16-r1022TX i7-14700HX 16GB 512GB RTX4060', price:24990000, orig:27990000, imgs:['https://ssl-product-images.www8-hp.com/digmedialib/prodimg/knowledgebase/c08882211.png','https://ssl-product-images.www8-hp.com/digmedialib/prodimg/knowledgebase/c08882212.png','https://ssl-product-images.www8-hp.com/digmedialib/prodimg/knowledgebase/c08882213.png'] },
  ],
  'cat-laptop|br-lenovo': [
    { name:'Lenovo Legion 5 Gen 9 Ryzen 7 8845HS 16GB 512GB RTX4060', price:27990000, orig:31990000, imgs:['https://p2-ofp.static.pub/fes/cms/2023/10/24/2y3whkrnz6uqaoh8lkekrk3eibv2rl956819.png','https://p2-ofp.static.pub/fes/cms/2023/10/24/3y3whkrnz6uqaoh8lkekrk3eibv2rl956819.png','https://p2-ofp.static.pub/fes/cms/2023/10/24/4y3whkrnz6uqaoh8lkekrk3eibv2rl956819.png'] },
    { name:'Lenovo IdeaPad Slim 5 Gen 9 Ultra 5 125H 16GB 512GB', price:17990000, orig:19990000, imgs:['https://p2-ofp.static.pub/fes/cms/2024/02/01/ideapad-slim5-gen9-front.png','https://p2-ofp.static.pub/fes/cms/2024/02/01/ideapad-slim5-gen9-back.png','https://p2-ofp.static.pub/fes/cms/2024/02/01/ideapad-slim5-gen9-side.png'] },
    { name:'Lenovo ThinkPad X1 Carbon Gen 12 Ultra 7 165U 32GB 1TB', price:47990000, orig:54990000, imgs:['https://p2-ofp.static.pub/fes/cms/2024/01/15/thinkpad-x1-carbon-gen12-front.png','https://p2-ofp.static.pub/fes/cms/2024/01/15/thinkpad-x1-carbon-gen12-back.png','https://p2-ofp.static.pub/fes/cms/2024/01/15/thinkpad-x1-carbon-gen12-side.png'] },
  ],
  'cat-laptop|br-dell': [
    { name:'Dell XPS 15 9540 Ultra 9 185H 32GB 1TB RTX4070', price:54990000, orig:61990000, imgs:['https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/xps-notebooks/xps-15-9530/pdp/dell-xps-15-9530-notebook-pdp-gallery-504x350.jpg','https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/xps-notebooks/xps-15-9530/pdp/dell-xps-15-9530-notebook-pdp-gallery-504x350-2.jpg','https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/xps-notebooks/xps-15-9530/pdp/dell-xps-15-9530-notebook-pdp-gallery-504x350-3.jpg'] },
    { name:'Dell Inspiron 15 3520 i5-1235U 8GB 512GB Silver', price:13990000, orig:15990000, imgs:['https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/inspiron-notebooks/inspiron-15-3520/media-gallery/notebook-inspiron-15-3520-gallery-2.psd?fmt=pjpg&pscan=auto&scl=1&wid=5000&hei=5000&qlt=100,0&resMode=sharp2&size=5000,5000','https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/inspiron-notebooks/inspiron-15-3520/media-gallery/notebook-inspiron-15-3520-gallery-3.psd?fmt=pjpg&pscan=auto&scl=1&wid=5000&hei=5000&qlt=100,0&resMode=sharp2&size=5000,5000','https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/inspiron-notebooks/inspiron-15-3520/media-gallery/notebook-inspiron-15-3520-gallery-4.psd?fmt=pjpg&pscan=auto&scl=1&wid=5000&hei=5000&qlt=100,0&resMode=sharp2&size=5000,5000'] },
  ],
  'cat-laptop|br-msi': [
    { name:'MSI Katana 15 B13VGK i7-13620H 16GB 1TB RTX4070', price:28990000, orig:32990000, imgs:['https://asset.msi.com/resize/image/global/product/product_1_20230202162944_63db6ca811de0.png62405b38c58fe0cb72ddbfd7f015adce.png?w=1000&h=750&fit=max&format=auto','https://asset.msi.com/resize/image/global/product/product_2_20230202162944_63db6ca8170f2.png62405b38c58fe0cb72ddbfd7f015adce.png?w=1000&h=750&fit=max&format=auto','https://asset.msi.com/resize/image/global/product/product_3_20230202162944_63db6ca81b3af.png62405b38c58fe0cb72ddbfd7f015adce.png?w=1000&h=750&fit=max&format=auto'] },
    { name:'MSI Modern 15 H B13M i5-13420H 16GB 512GB Urban Silver', price:16990000, orig:18990000, imgs:['https://asset.msi.com/resize/image/global/product/product_1_20230112095829_63bfc3c558e35.png62405b38c58fe0cb72ddbfd7f015adce.png?w=1000&h=750&fit=max&format=auto','https://asset.msi.com/resize/image/global/product/product_2_20230112095829_63bfc3c5600ed.png62405b38c58fe0cb72ddbfd7f015adce.png?w=1000&h=750&fit=max&format=auto','https://asset.msi.com/resize/image/global/product/product_3_20230112095829_63bfc3c564f3e.png62405b38c58fe0cb72ddbfd7f015adce.png?w=1000&h=750&fit=max&format=auto'] },
  ],
  'cat-laptop|br-acer': [
    { name:'Acer Nitro V 15 ANV15-51 i5-13420H 16GB 512GB RTX3050', price:19990000, orig:22990000, imgs:['https://static.acer.com/up/Resource/Acer/Laptops/Nitro_V_15/Images/20230607/Acer-Nitro-V-15-laptop-KV.jpg','https://static.acer.com/up/Resource/Acer/Laptops/Nitro_V_15/Images/20230607/Acer-Nitro-V-15-laptop-02.jpg','https://static.acer.com/up/Resource/Acer/Laptops/Nitro_V_15/Images/20230607/Acer-Nitro-V-15-laptop-03.jpg'] },
    { name:'Acer Swift Go 14 SFG14-73 Ultra 5 125H 16GB 512GB', price:19990000, orig:22990000, imgs:['https://static.acer.com/up/Resource/Acer/Laptops/Swift_Go_14/Images/20230601/Acer-Swift-Go-14-laptop-KV.jpg','https://static.acer.com/up/Resource/Acer/Laptops/Swift_Go_14/Images/20230601/Acer-Swift-Go-14-laptop-02.jpg','https://static.acer.com/up/Resource/Acer/Laptops/Swift_Go_14/Images/20230601/Acer-Swift-Go-14-laptop-03.jpg'] },
  ],
  'cat-laptop|br-razer': [
    { name:'Razer Blade 16 2024 Ultra 9 185HX 32GB 1TB RTX4090', price:89990000, orig:99990000, imgs:['https://assets2.razerzone.com/images/pnx.assets/db79218ee7b5b5e13a7e80d05cf16174/razer-blade16-2024-front.png','https://assets2.razerzone.com/images/pnx.assets/db79218ee7b5b5e13a7e80d05cf16174/razer-blade16-2024-back.png','https://assets2.razerzone.com/images/pnx.assets/db79218ee7b5b5e13a7e80d05cf16174/razer-blade16-2024-side.png'] },
    { name:'Razer Blade 14 2024 Ryzen 9 8945HX 32GB 1TB RTX4070', price:59990000, orig:69990000, imgs:['https://assets2.razerzone.com/images/pnx.assets/db79218ee7b5b5e13a7e80d05cf16174/razer-blade14-2024-front.png','https://assets2.razerzone.com/images/pnx.assets/db79218ee7b5b5e13a7e80d05cf16174/razer-blade14-2024-back.png','https://assets2.razerzone.com/images/pnx.assets/db79218ee7b5b5e13a7e80d05cf16174/razer-blade14-2024-side.png'] },
  ],
  'cat-laptop|br-microsoft': [
    { name:'Microsoft Surface Laptop 6 13.5 Ultra 5 135H 16GB 512GB Platinum', price:38990000, orig:43990000, imgs:['https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RW17R05?ver=c39b','https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RW17R04?ver=1b11','https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RW17R03?ver=b1f9'] },
    { name:'Microsoft Surface Pro 11 Ultra 5 X Plus 16GB 512GB Platinum', price:45990000, orig:51990000, imgs:['https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RW1lEKr?ver=cca1','https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RW1lEKs?ver=7c20','https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RW1lEKt?ver=25fc'] },
  ],
  'cat-laptop|br-lg': [
    { name:'LG gram 16 2024 Ultra 7 155H 16GB 1TB White', price:37990000, orig:42990000, imgs:['https://www.lg.com/us/images/laptops/md07503369/gallery/medium01.jpg','https://www.lg.com/us/images/laptops/md07503369/gallery/medium02.jpg','https://www.lg.com/us/images/laptops/md07503369/gallery/medium03.jpg'] },
    { name:'LG gram 14 2024 Ultra 5 125H 16GB 512GB White', price:29990000, orig:34990000, imgs:['https://www.lg.com/us/images/laptops/md07503371/gallery/medium01.jpg','https://www.lg.com/us/images/laptops/md07503371/gallery/medium02.jpg','https://www.lg.com/us/images/laptops/md07503371/gallery/medium03.jpg'] },
  ],
  'cat-laptop|br-gigabyte': [
    { name:'Gigabyte Aorus 15X AXG i9-14900HX 32GB 1TB RTX4090', price:59990000, orig:67990000, imgs:['https://static.gigabyte.com/StaticFile/Image/Global/6b77c14a065e44aa0b6a7c82e2b95e85/Product/31490/png/1000','https://static.gigabyte.com/StaticFile/Image/Global/6b77c14a065e44aa0b6a7c82e2b95e85/Product/31490/png/1001','https://static.gigabyte.com/StaticFile/Image/Global/6b77c14a065e44aa0b6a7c82e2b95e85/Product/31490/png/1002'] },
    { name:'Gigabyte G5 KF5 i7-13620H 16GB 512GB RTX4060', price:22990000, orig:25990000, imgs:['https://static.gigabyte.com/StaticFile/Image/Global/a3f9dd16ea79e76c8d7dce01aa43e9ac/Product/30721/png/1000','https://static.gigabyte.com/StaticFile/Image/Global/a3f9dd16ea79e76c8d7dce01aa43e9ac/Product/30721/png/1001','https://static.gigabyte.com/StaticFile/Image/Global/a3f9dd16ea79e76c8d7dce01aa43e9ac/Product/30721/png/1002'] },
  ],

  // ══════════════════════════════════════════════
  // SMARTWATCH — brands chưa có
  // ══════════════════════════════════════════════
  'cat-watch|br-amazfit': [
    { name:'Amazfit Balance Black Smartwatch', price:3490000, orig:4290000, imgs:['https://m.media-amazon.com/images/I/51E6-tGI8wL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/41pXORkyRVL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61TfIJO7DmL._AC_SL1500_.jpg'] },
    { name:'Amazfit GTR 4 Superspeed Black', price:3990000, orig:4990000, imgs:['https://m.media-amazon.com/images/I/71l8aRbW08L._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61d4vkh1SLL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71FhfMBL6SL._AC_SL1500_.jpg'] },
    { name:'Amazfit T-Rex Ultra Black Rugged Smartwatch', price:6990000, orig:8490000, imgs:['https://m.media-amazon.com/images/I/71t8BWUL-VL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61LrLpTMLqL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61RkxE3i3sL._AC_SL1500_.jpg'] },
  ],
  'cat-watch|br-huawei': [
    { name:'Huawei Watch GT 5 Pro 46mm Titanium Gray', price:8990000, orig:10490000, imgs:['https://consumer.huawei.com/content/dam/huawei-cbg-site/common/mkt/pdp/wearables/huawei-watch-gt-5-pro/img/huawei-watch-gt-5-pro-titanium-gray-01.jpg','https://consumer.huawei.com/content/dam/huawei-cbg-site/common/mkt/pdp/wearables/huawei-watch-gt-5-pro/img/huawei-watch-gt-5-pro-titanium-gray-02.jpg','https://consumer.huawei.com/content/dam/huawei-cbg-site/common/mkt/pdp/wearables/huawei-watch-gt-5-pro/img/huawei-watch-gt-5-pro-titanium-gray-03.jpg'] },
    { name:'Huawei Watch GT 5 46mm Black', price:5990000, orig:7490000, imgs:['https://consumer.huawei.com/content/dam/huawei-cbg-site/common/mkt/pdp/wearables/huawei-watch-gt-5/img/huawei-watch-gt-5-black-01.jpg','https://consumer.huawei.com/content/dam/huawei-cbg-site/common/mkt/pdp/wearables/huawei-watch-gt-5/img/huawei-watch-gt-5-black-02.jpg','https://consumer.huawei.com/content/dam/huawei-cbg-site/common/mkt/pdp/wearables/huawei-watch-gt-5/img/huawei-watch-gt-5-black-03.jpg'] },
  ],
  'cat-watch|br-fitbit': [
    { name:'Fitbit Sense 2 Shadow Gray Graphite', price:4990000, orig:5990000, imgs:['https://www.fitbit.com/global/content/assets/fitbit_sense2/fitbit-sense2-graphite-shadow-gray-front.png','https://www.fitbit.com/global/content/assets/fitbit_sense2/fitbit-sense2-graphite-shadow-gray-side.png','https://www.fitbit.com/global/content/assets/fitbit_sense2/fitbit-sense2-soft-gold-misty-lilac-front.png'] },
    { name:'Fitbit Charge 6 Black Obsidian', price:3290000, orig:3990000, imgs:['https://www.fitbit.com/global/content/assets/fitbit_charge6/fitbit-charge6-obsidian-black-front.png','https://www.fitbit.com/global/content/assets/fitbit_charge6/fitbit-charge6-obsidian-black-side.png','https://www.fitbit.com/global/content/assets/fitbit_charge6/fitbit-charge6-porcelain-ivory-front.png'] },
  ],
  'cat-watch|br-befit': [
    { name:'BeFit Smart Watch Pro 46mm Black Sport', price:990000, orig:1290000, imgs:['https://m.media-amazon.com/images/I/61K6bFBVnnL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61bkTsKwuHL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71g-dJCBxFL._AC_SL1500_.jpg'] },
    { name:'BeFit Ultra 2 Sport Smartwatch Black', price:1290000, orig:1690000, imgs:['https://m.media-amazon.com/images/I/71g-dJCBxFL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61K6bFBVnnL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/51L-F-JhauL._AC_SL1000_.jpg'] },
  ],
  'cat-watch|br-polar': [
    { name:'Polar Vantage V3 Black Premium Multisport Watch', price:18990000, orig:21990000, imgs:['https://www.polar.com/en/img/products/vantage-v3/polar-vantage-v3-black-front.png','https://www.polar.com/en/img/products/vantage-v3/polar-vantage-v3-black-back.png','https://www.polar.com/en/img/products/vantage-v3/polar-vantage-v3-black-side.png'] },
    { name:'Polar Pacer Pro Black GPS Running Watch', price:9990000, orig:11990000, imgs:['https://www.polar.com/en/img/products/pacer-pro/polar-pacer-pro-black-front.png','https://www.polar.com/en/img/products/pacer-pro/polar-pacer-pro-black-back.png','https://www.polar.com/en/img/products/pacer-pro/polar-pacer-pro-black-wrist.png'] },
  ],

  // ══════════════════════════════════════════════
  // ÂM THANH — brands chưa có
  // ══════════════════════════════════════════════
  'cat-av-headphone|br-sennheiser': [
    { name:'Sennheiser Momentum 4 Wireless Black ANC Headphone', price:8990000, orig:10490000, imgs:['https://assets.sennheiser.com/img/19349/x1_desktop_Sennheiser-Momentum-Wireless-4-Black-Perspective-right.jpg','https://assets.sennheiser.com/img/19349/x1_desktop_Sennheiser-Momentum-Wireless-4-Black-Left.jpg','https://assets.sennheiser.com/img/19349/x1_desktop_Sennheiser-Momentum-Wireless-4-Black-Front.jpg'] },
    { name:'Sennheiser HD 660S2 Open-Back Audiophile Headphone', price:11990000, orig:14990000, imgs:['https://assets.sennheiser.com/img/18720/x1_desktop_Sennheiser-HD-660S2-Perspective.jpg','https://assets.sennheiser.com/img/18720/x1_desktop_Sennheiser-HD-660S2-Left.jpg','https://assets.sennheiser.com/img/18720/x1_desktop_Sennheiser-HD-660S2-Top.jpg'] },
  ],
  'cat-av-headphone|br-beats': [
    { name:'Beats Studio Pro Over-Ear ANC Headphone Black', price:6990000, orig:7990000, imgs:['https://www.beatsbydre.com/content/dam/beats/pdp/headphones/studio-pro/black/studio-pro-headphone-black-product.jpg','https://www.beatsbydre.com/content/dam/beats/pdp/headphones/studio-pro/black/studio-pro-headphone-black-angle.jpg','https://www.beatsbydre.com/content/dam/beats/pdp/headphones/studio-pro/black/studio-pro-headphone-black-side.jpg'] },
    { name:'Beats Solo4 On-Ear Wireless Headphone Matte Black', price:5290000, orig:5990000, imgs:['https://www.beatsbydre.com/content/dam/beats/pdp/headphones/solo4/black/solo4-headphone-black-product.jpg','https://www.beatsbydre.com/content/dam/beats/pdp/headphones/solo4/black/solo4-headphone-black-angle.jpg','https://www.beatsbydre.com/content/dam/beats/pdp/headphones/solo4/black/solo4-headphone-black-side.jpg'] },
  ],
  'cat-av-headphone|br-marshall': [
    { name:'Marshall Monitor III ANC Wireless Headphone Black', price:7990000, orig:9490000, imgs:['https://www.marshallheadphones.com/dw/image/v2/BFLM_PRD/on/demandware.static/-/Sites-mh-catalog/default/Marshall-Monitor-III-ANC-Black-front.png?sw=600&sh=600','https://www.marshallheadphones.com/dw/image/v2/BFLM_PRD/on/demandware.static/-/Sites-mh-catalog/default/Marshall-Monitor-III-ANC-Black-side.png?sw=600&sh=600','https://www.marshallheadphones.com/dw/image/v2/BFLM_PRD/on/demandware.static/-/Sites-mh-catalog/default/Marshall-Monitor-III-ANC-Black-back.png?sw=600&sh=600'] },
    { name:'Marshall Major V On-Ear Wireless Headphone Black', price:3190000, orig:3990000, imgs:['https://www.marshallheadphones.com/dw/image/v2/BFLM_PRD/on/demandware.static/-/Sites-mh-catalog/default/Marshall-Major-V-Black-front.png?sw=600&sh=600','https://www.marshallheadphones.com/dw/image/v2/BFLM_PRD/on/demandware.static/-/Sites-mh-catalog/default/Marshall-Major-V-Black-side.png?sw=600&sh=600','https://www.marshallheadphones.com/dw/image/v2/BFLM_PRD/on/demandware.static/-/Sites-mh-catalog/default/Marshall-Major-V-Brown-front.png?sw=600&sh=600'] },
  ],
  'cat-av-speaker|br-marshall': [
    { name:'Marshall Emberton III Portable Bluetooth Speaker Black', price:3290000, orig:3990000, imgs:['https://www.marshallheadphones.com/dw/image/v2/BFLM_PRD/on/demandware.static/-/Sites-mh-catalog/default/Marshall-Emberton-III-Black-front.png?sw=600&sh=600','https://www.marshallheadphones.com/dw/image/v2/BFLM_PRD/on/demandware.static/-/Sites-mh-catalog/default/Marshall-Emberton-III-Black-side.png?sw=600&sh=600','https://www.marshallheadphones.com/dw/image/v2/BFLM_PRD/on/demandware.static/-/Sites-mh-catalog/default/Marshall-Emberton-III-Cream-front.png?sw=600&sh=600'] },
    { name:'Marshall Stanmore III Bluetooth Home Speaker Black', price:7990000, orig:9490000, imgs:['https://www.marshallheadphones.com/dw/image/v2/BFLM_PRD/on/demandware.static/-/Sites-mh-catalog/default/Marshall-Stanmore-III-Black-front.png?sw=600&sh=600','https://www.marshallheadphones.com/dw/image/v2/BFLM_PRD/on/demandware.static/-/Sites-mh-catalog/default/Marshall-Stanmore-III-Black-side.png?sw=600&sh=600','https://www.marshallheadphones.com/dw/image/v2/BFLM_PRD/on/demandware.static/-/Sites-mh-catalog/default/Marshall-Stanmore-III-Cream-front.png?sw=600&sh=600'] },
  ],
  'cat-av-speaker|br-harman': [
    { name:'Harman Kardon Onyx Studio 8 Portable Bluetooth Speaker Black', price:8490000, orig:9990000, imgs:['https://www.harmankardon.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dwebb8fc8a/HK_ONYX_STUDIO8_BLKAM_HERO.png?sw=600&sh=600','https://www.harmankardon.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/HK_ONYX_STUDIO8_BLKAM_ANGLE.png?sw=600&sh=600','https://www.harmankardon.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/HK_ONYX_STUDIO8_BLKAM_BACK.png?sw=600&sh=600'] },
    { name:'Harman Kardon Aura Studio 4 Bluetooth Speaker Black', price:6990000, orig:8490000, imgs:['https://www.harmankardon.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/HK_AURA_STUDIO_4_BLKAM_HERO.png?sw=600&sh=600','https://www.harmankardon.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/HK_AURA_STUDIO_4_BLKAM_ANGLE.png?sw=600&sh=600','https://www.harmankardon.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/HK_AURA_STUDIO_4_BLKAM_BACK.png?sw=600&sh=600'] },
  ],

  // ══════════════════════════════════════════════
  // PHỤ KIỆN — Logitech (mouse, keyboard, webcam)
  // ══════════════════════════════════════════════
  'cat-laptop-acc-mouse|br-logitech': [
    { name:'Logitech MX Master 3S Wireless 8000 DPI Graphite', price:2190000, orig:2590000, imgs:['https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/mx-master-3s/gallery/mx-master-3s-mouse-top-view-graphite.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/mx-master-3s/gallery/mx-master-3s-mouse-side-view-graphite.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/mx-master-3s/gallery/mx-master-3s-mouse-bottom-view-graphite.png'] },
    { name:'Logitech G Pro X Superlight 2 Wireless Gaming Mouse Black', price:2990000, orig:3490000, imgs:['https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/g-pro-x-superlight-2/gallery/g-pro-x-superlight-2-mouse-top-view-black.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/g-pro-x-superlight-2/gallery/g-pro-x-superlight-2-mouse-side-view-black.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/g-pro-x-superlight-2/gallery/g-pro-x-superlight-2-mouse-bottom-view-black.png'] },
  ],
  'cat-laptop-acc-keyboard|br-logitech': [
    { name:'Logitech MX Keys S Wireless Illuminated Keyboard Graphite', price:2590000, orig:3190000, imgs:['https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/keyboards/mx-keys-s/gallery/mx-keys-s-keyboard-top-view-graphite.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/keyboards/mx-keys-s/gallery/mx-keys-s-keyboard-angle-view-graphite.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/keyboards/mx-keys-s/gallery/mx-keys-s-keyboard-bottom-view-graphite.png'] },
    { name:'Logitech G915 TKL Wireless LIGHTSPEED Clicky Keyboard Black', price:3990000, orig:4990000, imgs:['https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/keyboards/g915-tkl/gallery/g915-tkl-keyboard-top-view-black.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/keyboards/g915-tkl/gallery/g915-tkl-keyboard-angle-view-black.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/keyboards/g915-tkl/gallery/g915-tkl-keyboard-bottom-view-black.png'] },
  ],
  'cat-laptop-acc-mousepad|br-logitech': [
    { name:'Logitech G840 XL Gaming Mouse Pad Black', price:890000, orig:1190000, imgs:['https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mousepads/g840-xl-gaming-mouse-pad/g840-xl-gaming-mouse-pad-gallery-1.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mousepads/g840-xl-gaming-mouse-pad/g840-xl-gaming-mouse-pad-gallery-2.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mousepads/g640-large-gaming-mouse-pad/g640-large-gaming-mouse-pad-gallery-1.png'] },
  ],
  'cat-laptop-acc-mouse|br-razer': [
    { name:'Razer DeathAdder V3 HyperSpeed Wireless Gaming Mouse Black', price:1990000, orig:2490000, imgs:['https://assets2.razerzone.com/images/pnx.assets/deathadder-v3-hyperspeed/razer-deathadder-v3-hyperspeed-front.png','https://assets2.razerzone.com/images/pnx.assets/deathadder-v3-hyperspeed/razer-deathadder-v3-hyperspeed-side.png','https://assets2.razerzone.com/images/pnx.assets/deathadder-v3-hyperspeed/razer-deathadder-v3-hyperspeed-bottom.png'] },
    { name:'Razer Viper V3 Pro Wireless Ultra-lightweight Gaming Mouse', price:3490000, orig:4290000, imgs:['https://assets2.razerzone.com/images/pnx.assets/viper-v3-pro/razer-viper-v3-pro-front.png','https://assets2.razerzone.com/images/pnx.assets/viper-v3-pro/razer-viper-v3-pro-side.png','https://assets2.razerzone.com/images/pnx.assets/viper-v3-pro/razer-viper-v3-pro-bottom.png'] },
  ],
  'cat-laptop-acc-keyboard|br-razer': [
    { name:'Razer BlackWidow V4 Pro Wireless Yellow Switch Gaming Keyboard Black', price:5990000, orig:6990000, imgs:['https://assets2.razerzone.com/images/pnx.assets/blackwidow-v4-pro/razer-blackwidow-v4-pro-front.png','https://assets2.razerzone.com/images/pnx.assets/blackwidow-v4-pro/razer-blackwidow-v4-pro-angle.png','https://assets2.razerzone.com/images/pnx.assets/blackwidow-v4-pro/razer-blackwidow-v4-pro-side.png'] },
  ],
  'cat-laptop-acc-mousepad|br-razer': [
    { name:'Razer Goliathus Extended Speed Edition Gaming Mousepad Black', price:490000, orig:690000, imgs:['https://assets2.razerzone.com/images/pnx.assets/goliathus-speed-extended/razer-goliathus-speed-extended-front.png','https://assets2.razerzone.com/images/pnx.assets/goliathus-speed-extended/razer-goliathus-speed-extended-side.png','https://assets2.razerzone.com/images/pnx.assets/goliathus-speed-extended/razer-goliathus-chroma-extended-front.png'] },
  ],
  'cat-laptop-acc-mouse|br-microsoft': [
    { name:'Microsoft Arc Wireless Mouse Black', price:1490000, orig:1890000, imgs:['https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RW11BFm?ver=5c9d','https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RW11BFn?ver=5c9d','https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RW11BFo?ver=5c9d'] },
    { name:'Microsoft Bluetooth Ergonomic Mouse Black', price:990000, orig:1290000, imgs:['https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RE4tM4e?ver=3db3','https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RE4tM4f?ver=3db3','https://img-prod-cms-rt-microsoft-com.akamaized.net/cms/api/am/imageFileData/RE4tM4g?ver=3db3'] },
  ],
  'cat-laptop-acc-mouse|br-dell': [
    { name:'Dell Premier Rechargeable Wireless Mouse MS900', price:1990000, orig:2490000, imgs:['https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/peripherals/mice/premier-wireless-mouse-ms700/pdp/dell-premier-wireless-mouse-ms700-pdp-gallery-504x350.jpg','https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/peripherals/mice/premier-wireless-mouse-ms700/pdp/dell-premier-wireless-mouse-ms700-pdp-gallery-504x350-2.jpg','https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/peripherals/mice/premier-wireless-mouse-ms700/pdp/dell-premier-wireless-mouse-ms700-pdp-gallery-504x350-3.jpg'] },
  ],
};

// ── Helper ───────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔧 FIX BRAND-NAME MISMATCH — Tên phải đúng brand');
  console.log('═'.repeat(60));

  // Tìm tất cả cặp (category, brand) có trong BRAND_TEMPLATES
  const templateKeys = new Set(Object.keys(BRAND_TEMPLATES));
  console.log(`  Số template đã chuẩn bị: ${templateKeys.size} cặp`);

  // Lấy tất cả cặp trong DB
  const pairs = await prisma.$queryRaw`
    SELECT DISTINCT category_id, brand_id FROM "Product" WHERE is_deleted = false
  `;
  const total = await prisma.product.count({ where: { is_deleted: false } });
  console.log(`  Tổng cặp trong DB: ${pairs.length}`);
  console.log(`  Tổng sản phẩm: ${total.toLocaleString()}`);
  console.log('─'.repeat(60));

  const startMs = Date.now();
  let totalUpdated = 0;
  let pairsDone = 0;

  for (const { category_id: catId, brand_id: brandId } of pairs) {
    const key = `${catId}|${brandId}`;
    const templates = BRAND_TEMPLATES[key];

    if (!templates || templates.length === 0) {
      // Không có template riêng cho cặp này → bỏ qua (đã đúng ở lần trước)
      continue;
    }

    pairsDone++;
    let cursor;

    while (true) {
      const products = await prisma.product.findMany({
        where:   { category_id: catId, brand_id: brandId, is_deleted: false },
        select:  { id: true },
        take:    5000,
        orderBy: { id: 'asc' },
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (!products.length) break;

      // Group by template
      const byTemplate = {};
      for (const p of products) {
        const t = pick(templates);
        if (!byTemplate[t.name]) byTemplate[t.name] = { t, ids: [] };
        byTemplate[t.name].ids.push(p.id);
      }

      await Promise.all(
        Object.values(byTemplate).map(({ t, ids }) =>
          prisma.product.updateMany({
            where: { id: { in: ids } },
            data: {
              name:           t.name,
              price:          t.price,
              original_price: t.orig,
              image:          t.imgs[0],
              images:         JSON.stringify(t.imgs),
            },
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
        `\r  Pair ${pairsDone}/${templateKeys.size} | ${totalUpdated.toLocaleString()}/${total.toLocaleString()}  ${rps.toLocaleString()}/s  ETA:${etaStr}   `
      );
    }
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log('\n\n  ╔══════════════════════════════════════════════════╗');
  console.log('  ║       FIX BRAND-NAME MISMATCH HOÀN THÀNH        ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║  Sản phẩm đã fix: ${String(totalUpdated.toLocaleString()).padStart(12)}                ║`);
  console.log(`  ║  Thời gian      : ${String(elapsed + 's').padStart(12)}                ║`);
  console.log('  ╚══════════════════════════════════════════════════╝');

  // Sample check
  const samples = await prisma.$queryRaw`
    SELECT p.name, p.brand_id, p.category_id, b.name as brand_name
    FROM "Product" p
    JOIN "Brand" b ON b.id = p.brand_id
    WHERE p.is_deleted = false
    ORDER BY RANDOM() LIMIT 10
  `;
  console.log('\n  📋 Kiểm tra ngẫu nhiên (tên phải khớp brand):');
  for (const s of samples) {
    const ok = s.name.toLowerCase().includes(s.brand_name.toLowerCase().split(' ')[0].toLowerCase()) ? '✅' : '⚠️ ';
    console.log(`    ${ok} [${s.brand_id}|${s.brand_name}] ${s.name}`);
  }
}

main()
  .catch(e => { console.error('\n❌ Lỗi:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
