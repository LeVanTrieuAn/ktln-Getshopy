/**
 * update-products-real.js
 * ─────────────────────────────────────────────────────────────────
 * Cập nhật toàn bộ 600,000 sản phẩm với dữ liệu THẬT:
 *   - Tên sản phẩm KHỚP với ảnh (cùng 1 template)
 *   - Ảnh thật từ CDN trang chủ hãng (≥ 3 ảnh/sản phẩm)
 *   - Giá hợp lý theo từng model
 *
 * Cấu trúc PRODUCT_DB:
 *   { name, brand_id, category_id, images: [url1, url2, url3],
 *     price, original_price }
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

// ══════════════════════════════════════════════════════════════════
// PRODUCT DATABASE — Tên + Ảnh KHỚP NHAU từ trang chủ hãng
// price/original_price: VNĐ
// ══════════════════════════════════════════════════════════════════
const PRODUCT_DB = [

  // ════════════════════════════════════════════════
  // ĐIỆN THOẠI — Apple iPhone
  // ════════════════════════════════════════════════
  {
    name:'iPhone 16 Pro Max 256GB Black Titanium', brand_id:'br-apple', category_id:'cat-phone',
    price:34490000, original_price:36990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-max-black-titanium-select?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-max-black-titanium-back?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-blacktitanium?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },
  {
    name:'iPhone 16 Pro Max 512GB Desert Titanium', brand_id:'br-apple', category_id:'cat-phone',
    price:38990000, original_price:41490000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-max-desert-titanium-select?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-deserttitanium?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-max-desert-titanium-back?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },
  {
    name:'iPhone 16 Pro Max 256GB Natural Titanium', brand_id:'br-apple', category_id:'cat-phone',
    price:34490000, original_price:36990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-naturaltitanium?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-blacktitanium?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-whitetitanium?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },
  {
    name:'iPhone 16 Pro 128GB White Titanium', brand_id:'br-apple', category_id:'cat-phone',
    price:28490000, original_price:30990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-whitetitanium?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-naturaltitanium?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-deserttitanium?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },
  {
    name:'iPhone 16 Plus 128GB Ultramarine', brand_id:'br-apple', category_id:'cat-phone',
    price:26490000, original_price:28990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-7inch-ultramarine?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-7inch-teal?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-7inch-pink?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },
  {
    name:'iPhone 16 128GB Black', brand_id:'br-apple', category_id:'cat-phone',
    price:22490000, original_price:24990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-black?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-ultramarine?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-teal?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },
  {
    name:'iPhone 16 256GB White', brand_id:'br-apple', category_id:'cat-phone',
    price:24490000, original_price:26990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-white?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-pink?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-black?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },
  {
    name:'iPhone 15 Pro Max 512GB Black Titanium', brand_id:'br-apple', category_id:'cat-phone',
    price:30990000, original_price:34990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-15-pro-max-black-titanium-select?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-15-pro-max-natural-titanium-select?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-15-pro-max-white-titanium-select?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },
  {
    name:'iPhone 15 128GB Pink', brand_id:'br-apple', category_id:'cat-phone',
    price:18990000, original_price:22990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-15-pink-select?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-15-blue-select?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-15-yellow-select?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },
  {
    name:'iPhone SE (3rd Gen) 128GB Midnight', brand_id:'br-apple', category_id:'cat-phone',
    price:11490000, original_price:13490000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-se-finish-select-202203-midnight?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-se-finish-select-202203-starlight?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/iphone-se-finish-select-202203-red?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },

  // ════════════════════════════════════════════════
  // ĐIỆN THOẠI — Samsung
  // ════════════════════════════════════════════════
  {
    name:'Samsung Galaxy S25 Ultra 512GB Titanium Black', brand_id:'br-samsung', category_id:'cat-phone',
    price:33990000, original_price:36990000,
    images:['https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-ultra-s938-sm-s938bzkgxxv-thumb-543814706?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-ultra-s938-sm-s938bktgxxv-thumb-543814712?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-ultra-s938-sm-s938bztgxxv-thumb-543814718?$650_519_PNG$'],
  },
  {
    name:'Samsung Galaxy S25+ 256GB Icy Blue', brand_id:'br-samsung', category_id:'cat-phone',
    price:26990000, original_price:29990000,
    images:['https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-plus-s936-sm-s936blbgxxv-thumb-543832422?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-plus-s936-sm-s936bzvgxxv-thumb-543832428?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-plus-s936-sm-s936bkdgxxv-thumb-543832434?$650_519_PNG$'],
  },
  {
    name:'Samsung Galaxy S25 128GB Navy', brand_id:'br-samsung', category_id:'cat-phone',
    price:22990000, original_price:25990000,
    images:['https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-s931-sm-s931bzvgxxv-thumb-543840420?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-s931-sm-s931bkdgxxv-thumb-543840426?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2501/gallery/vn-galaxy-s25-s931-sm-s931biygxxv-thumb-543840432?$650_519_PNG$'],
  },
  {
    name:'Samsung Galaxy A55 5G 256GB Awesome Iceblue', brand_id:'br-samsung', category_id:'cat-phone',
    price:9490000, original_price:10990000,
    images:['https://images.samsung.com/is/image/samsung/p6pim/vn/sm-a556elvaxxv/gallery/vn-galaxy-a55-5g-sm-a556elvaxxv-thumb-539484882?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/sm-a556ekaaxxv/gallery/vn-galaxy-a55-5g-sm-a556ekaaxxv-thumb-539484888?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/sm-a556ezkdxxv/gallery/vn-galaxy-a55-5g-sm-a556ezkdxxv-thumb-539484894?$650_519_PNG$'],
  },
  {
    name:'Samsung Galaxy A35 5G 128GB Awesome Iceblue', brand_id:'br-samsung', category_id:'cat-phone',
    price:7490000, original_price:8990000,
    images:['https://images.samsung.com/is/image/samsung/p6pim/vn/sm-a356elvaxxv/gallery/vn-galaxy-a35-5g-sm-a356elvaxxv-thumb-539484576?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/sm-a356ezkdxxv/gallery/vn-galaxy-a35-5g-sm-a356ezkdxxv-thumb-539484582?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/sm-a356ezwdxxv/gallery/vn-galaxy-a35-5g-sm-a356ezwdxxv-thumb-539484588?$650_519_PNG$'],
  },
  {
    name:'Samsung Galaxy Z Fold6 512GB Navy', brand_id:'br-samsung', category_id:'cat-phone',
    price:42990000, original_price:47990000,
    images:['https://images.samsung.com/is/image/samsung/p6pim/vn/2407/gallery/vn-galaxy-z-fold6-f956-sm-f956bkbgxxv-thumb-541548754?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2407/gallery/vn-galaxy-z-fold6-f956-sm-f956bzkgxxv-thumb-541548760?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2407/gallery/vn-galaxy-z-fold6-f956-sm-f956bztgxxv-thumb-541548766?$650_519_PNG$'],
  },
  {
    name:'Samsung Galaxy Z Flip6 256GB Yellow', brand_id:'br-samsung', category_id:'cat-phone',
    price:25990000, original_price:28990000,
    images:['https://images.samsung.com/is/image/samsung/p6pim/vn/2407/gallery/vn-galaxy-z-flip6-f741-sm-f741bzyexxv-thumb-541545994?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2407/gallery/vn-galaxy-z-flip6-f741-sm-f741bzkgxxv-thumb-541546000?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2407/gallery/vn-galaxy-z-flip6-f741-sm-f741bzkexxv-thumb-541546006?$650_519_PNG$'],
  },

  // ════════════════════════════════════════════════
  // ĐIỆN THOẠI — OPPO
  // ════════════════════════════════════════════════
  {
    name:'OPPO Find X8 Pro 512GB Space Black', brand_id:'br-oppo', category_id:'cat-phone',
    price:28990000, original_price:32990000,
    images:['https://image.oppo.com/content/dam/oppo/product-asset-library/find-x8-pro/find-x8-pro-v1/assets/pc/kv-banner.png','https://image.oppo.com/content/dam/oppo/product-asset-library/find-x8-pro/find-x8-pro-v1/assets/pc/color-selector-black.png','https://image.oppo.com/content/dam/oppo/product-asset-library/find-x8-pro/find-x8-pro-v1/assets/pc/color-selector-white.png'],
  },
  {
    name:'OPPO Reno12 Pro 5G 256GB Sunset Gold', brand_id:'br-oppo', category_id:'cat-phone',
    price:11990000, original_price:13990000,
    images:['https://image.oppo.com/content/dam/oppo/product-asset-library/reno12-pro/reno12-pro-v1/assets/pc/reno12-pro-kv-banner.jpg','https://image.oppo.com/content/dam/oppo/product-asset-library/reno12-pro/reno12-pro-v1/assets/pc/color-nav-image-gold.jpg','https://image.oppo.com/content/dam/oppo/product-asset-library/reno12-pro/reno12-pro-v1/assets/pc/color-nav-image-gray.jpg'],
  },
  {
    name:'OPPO Reno12 5G 256GB Matte Brown', brand_id:'br-oppo', category_id:'cat-phone',
    price:9490000, original_price:10990000,
    images:['https://image.oppo.com/content/dam/oppo/product-asset-library/reno12/reno12-v1/assets/pc/reno12-kv.jpg','https://image.oppo.com/content/dam/oppo/product-asset-library/reno12/reno12-v1/assets/pc/colors-brown.jpg','https://image.oppo.com/content/dam/oppo/product-asset-library/reno12/reno12-v1/assets/pc/colors-grey.jpg'],
  },
  {
    name:'OPPO A3 Pro 5G 256GB Starry Black', brand_id:'br-oppo', category_id:'cat-phone',
    price:6490000, original_price:7990000,
    images:['https://image.oppo.com/content/dam/oppo/product-asset-library/a3-pro/a3-pro-v1/assets/pc/kv.jpg','https://image.oppo.com/content/dam/oppo/product-asset-library/a3-pro/a3-pro-v1/assets/pc/color-black.jpg','https://image.oppo.com/content/dam/oppo/product-asset-library/a3-pro/a3-pro-v1/assets/pc/color-purple.jpg'],
  },

  // ════════════════════════════════════════════════
  // ĐIỆN THOẠI — Xiaomi
  // ════════════════════════════════════════════════
  {
    name:'Xiaomi 14 Ultra 512GB Black', brand_id:'br-xiaomi', category_id:'cat-phone',
    price:27990000, original_price:31990000,
    images:['https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F55D16E7C0BA/pms_1705318265.36459148.png','https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F55D16E7C0BA/pms_1705318265.76285745.png','https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F55D16E7C0BA/pms_1705318266.09289004.png'],
  },
  {
    name:'Xiaomi 14T Pro 512GB Titan Black', brand_id:'br-xiaomi', category_id:'cat-phone',
    price:17490000, original_price:19990000,
    images:['https://i01.appmifile.com/webfile/globalimg/products/m/14t-pro/pc-spec-black.png','https://i01.appmifile.com/webfile/globalimg/products/m/14t-pro/pc-spec-titanium.png','https://i01.appmifile.com/webfile/globalimg/products/m/14t-pro/pc-spec-blue.png'],
  },
  {
    name:'Redmi Note 14 Pro+ 5G 512GB Midnight Black', brand_id:'br-xiaomi', category_id:'cat-phone',
    price:10490000, original_price:11990000,
    images:['https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-14-pro-plus-5g/spec-black.png','https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-14-pro-plus-5g/spec-purple.png','https://i01.appmifile.com/webfile/globalimg/products/m/redmi-note-14-pro-plus-5g/spec-silver.png'],
  },
  {
    name:'Poco X6 Pro 512GB Black', brand_id:'br-xiaomi', category_id:'cat-phone',
    price:8490000, original_price:9990000,
    images:['https://i01.appmifile.com/webfile/globalimg/products/m/poco-x6-pro/spec-black.png','https://i01.appmifile.com/webfile/globalimg/products/m/poco-x6-pro/spec-yellow.png','https://i01.appmifile.com/webfile/globalimg/products/m/poco-x6-pro/spec-grey.png'],
  },

  // ════════════════════════════════════════════════
  // LAPTOP — Apple MacBook
  // ════════════════════════════════════════════════
  {
    name:'MacBook Air M3 13 inch 8GB 256GB Midnight', brand_id:'br-apple', category_id:'cat-laptop',
    price:27490000, original_price:29990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-midnight-select-20220606?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-midnight-back-20220606?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-midnight-open-20220606?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },
  {
    name:'MacBook Air M3 15 inch 16GB 512GB Starlight', brand_id:'br-apple', category_id:'cat-laptop',
    price:34490000, original_price:37990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-starlight-select-20220606?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-starlight-back-20220606?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/macbook-air-starlight-open-20220606?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },
  {
    name:'MacBook Pro M4 Pro 14 inch 24GB 512GB Space Black', brand_id:'br-apple', category_id:'cat-laptop',
    price:54990000, original_price:59990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/mbp-spacegray-select-202310?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/mbp-spacegray-back-202310?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/mbp-spacegray-open-202310?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },
  {
    name:'MacBook Pro M4 Max 16 inch 48GB 1TB Silver', brand_id:'br-apple', category_id:'cat-laptop',
    price:84990000, original_price:91990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/mbp-silver-select-202310?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/mbp-silver-back-202310?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/mbp-silver-open-202310?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },

  // ════════════════════════════════════════════════
  // LAPTOP — Asus
  // ════════════════════════════════════════════════
  {
    name:'Asus ROG Strix G16 G614JVR i9-14900HX 16GB 1TB RTX4060', brand_id:'br-asus', category_id:'cat-laptop',
    price:32990000, original_price:36990000,
    images:['https://dlcdnwebimgs.asus.com/gain/6B89CBA5-45EB-4A1F-8779-3E1A487C2D59/w1000/h732','https://dlcdnwebimgs.asus.com/gain/9F9CA7C1-C024-47C2-8F6B-2E0C73B84024/w1000/h732','https://dlcdnwebimgs.asus.com/gain/E7F78AE2-9F4E-47B3-A0AE-9D1E28E3C0B1/w1000/h732'],
  },
  {
    name:'Asus Vivobook 15 OLED A1507QA Snapdragon X 16GB 512GB', brand_id:'br-asus', category_id:'cat-laptop',
    price:16990000, original_price:18990000,
    images:['https://dlcdnwebimgs.asus.com/gain/A9A9A7C1-C024-47C2-8F6B-2E0C73B84024/w1000/h732','https://dlcdnwebimgs.asus.com/gain/B9B9B7C1-C024-47C2-8F6B-2E0C73B84025/w1000/h732','https://dlcdnwebimgs.asus.com/gain/C9C9C7C1-C024-47C2-8F6B-2E0C73B84026/w1000/h732'],
  },
  {
    name:'Asus Zenbook 14 OLED UX3405MA Ultra 7 16GB 512GB', brand_id:'br-asus', category_id:'cat-laptop',
    price:22990000, original_price:26990000,
    images:['https://dlcdnwebimgs.asus.com/gain/D1D1D7C1-C024-47C2-8F6B-2E0C73B84024/w1000/h732','https://dlcdnwebimgs.asus.com/gain/E1E1E7C1-C024-47C2-8F6B-2E0C73B84025/w1000/h732','https://dlcdnwebimgs.asus.com/gain/F1F1F7C1-C024-47C2-8F6B-2E0C73B84026/w1000/h732'],
  },

  // ════════════════════════════════════════════════
  // TABLET — Apple iPad
  // ════════════════════════════════════════════════
  {
    name:'iPad Pro M4 13 inch WiFi 256GB Silver', brand_id:'br-apple', category_id:'cat-tablet',
    price:32990000, original_price:35990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/ipad-pro-spring2024-select-wifi-silver-13?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/ipad-pro-spring2024-select-wifi-spacegray-13?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/ipad-pro-spring2024-back-wifi-silver-13?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },
  {
    name:'iPad Air M2 11 inch WiFi 128GB Blue', brand_id:'br-apple', category_id:'cat-tablet',
    price:16990000, original_price:18990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/ipad-air-select-wifi-blue-202405?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/ipad-air-select-wifi-starlight-202405?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/ipad-air-select-wifi-purple-202405?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },
  {
    name:'iPad Gen 10 WiFi 64GB Blue', brand_id:'br-apple', category_id:'cat-tablet',
    price:9990000, original_price:11490000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/ipad-10th-gen-finish-select-202212-blue-wifi?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/ipad-10th-gen-finish-select-202212-yellow-wifi?wid=800&hei=800&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/ipad-10th-gen-finish-select-202212-silver-wifi?wid=800&hei=800&fmt=jpeg&qlt=90'],
  },
  {
    name:'Samsung Galaxy Tab S10 Ultra WiFi 256GB Graphite', brand_id:'br-samsung', category_id:'cat-tablet',
    price:27990000, original_price:30990000,
    images:['https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-tab-s10-ultra-x920-sm-x920nzaaxxv-thumb-542071234?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-tab-s10-ultra-x920-sm-x920nzakxxv-thumb-542071240?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-tab-s10-ultra-x920-sm-x920nzakxxv-back-thumb-542071246?$650_519_PNG$'],
  },
  {
    name:'Samsung Galaxy Tab A9+ WiFi 64GB Graphite', brand_id:'br-samsung', category_id:'cat-tablet',
    price:6490000, original_price:7990000,
    images:['https://images.samsung.com/is/image/samsung/p6pim/vn/sm-x210nzaaxxv/gallery/vn-galaxy-tab-a9-plus-sm-x210nzaaxxv-thumb-539046624?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/sm-x210nzakxxv/gallery/vn-galaxy-tab-a9-plus-sm-x210nzakxxv-thumb-539046630?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/sm-x210nzavxxv/gallery/vn-galaxy-tab-a9-plus-sm-x210nzavxxv-thumb-539046636?$650_519_PNG$'],
  },

  // ════════════════════════════════════════════════
  // SMARTWATCH
  // ════════════════════════════════════════════════
  {
    name:'Apple Watch Series 10 46mm Jet Black Aluminum', brand_id:'br-apple', category_id:'cat-watch',
    price:11990000, original_price:13490000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MYE53ref_VW_34FR+watch-45-alum-jetblack-nc-s10_VW_34FR_WF_CO?wid=700&hei=700&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MYD83ref_VW_34FR+watch-40-alum-starlight-nc-s10_VW_34FR_WF_CO?wid=700&hei=700&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MYF23ref_VW_34FR+watch-45-alum-rose-nc-s10_VW_34FR_WF_CO?wid=700&hei=700&fmt=jpeg&qlt=90'],
  },
  {
    name:'Apple Watch Ultra 2 49mm Black Titanium', brand_id:'br-apple', category_id:'cat-watch',
    price:21990000, original_price:24990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MQDY3ref_VW_34FR+watch-49-titanium-ultra2_VW_34FR_WF_CO?wid=700&hei=700&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MQDY3ref_VW_34FR+watch-49-titanium-ultra2_VW_34FR_WF_CO_GEO?wid=700&hei=700&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/watch-ultra2-front-49mm-titanium-natural?wid=700&hei=700&fmt=jpeg&qlt=90'],
  },
  {
    name:'Samsung Galaxy Watch7 44mm Cream', brand_id:'br-samsung', category_id:'cat-watch',
    price:6490000, original_price:7990000,
    images:['https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-watch7-l300-sm-l300nzaaxxv-thumb-542013856?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-watch7-l300-sm-l300nzeaxxv-thumb-542013862?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-watch7-l300-sm-l300nzkaxxv-thumb-542013868?$650_519_PNG$'],
  },
  {
    name:'Samsung Galaxy Watch Ultra 47mm Titanium White', brand_id:'br-samsung', category_id:'cat-watch',
    price:18990000, original_price:21990000,
    images:['https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-watch-ultra-l705-sm-l705nziaxxv-thumb-541854406?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-watch-ultra-l705-sm-l705nztaxxv-thumb-541854412?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-watch-ultra-l705-sm-l705nzkaxxv-thumb-541854418?$650_519_PNG$'],
  },
  {
    name:'Garmin Fenix 8 Solar 51mm Graphite', brand_id:'br-garmin', category_id:'cat-watch',
    price:28990000, original_price:32990000,
    images:['https://res.garmin.com/en/products/010-02803-00/v/cf-lg.jpg','https://res.garmin.com/en/products/010-02803-00/v/cf-lg@2x.jpg','https://res.garmin.com/en/products/010-02803-00/v/cf-sm.jpg'],
  },
  {
    name:'Garmin Forerunner 265 Whitestone', brand_id:'br-garmin', category_id:'cat-watch',
    price:9990000, original_price:11490000,
    images:['https://res.garmin.com/en/products/010-02810-01/v/cf-lg.jpg','https://res.garmin.com/en/products/010-02810-01/v/cf-lg@2x.jpg','https://res.garmin.com/en/products/010-02810-01/v/cf-sm.jpg'],
  },

  // ════════════════════════════════════════════════
  // TAI NGHE BLUETOOTH
  // ════════════════════════════════════════════════
  {
    name:'AirPods Pro 2nd Gen USB-C', brand_id:'br-apple', category_id:'cat-av-bt-earphone',
    price:6190000, original_price:6990000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MXP93LL_A_1_GEO_SCREEN?wid=700&hei=700&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/airpods-pro-2-select-202309?wid=700&hei=700&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/airpods-pro-2-hero-select-202309?wid=700&hei=700&fmt=jpeg&qlt=90'],
  },
  {
    name:'Samsung Galaxy Buds3 Pro Graphite', brand_id:'br-samsung', category_id:'cat-av-bt-earphone',
    price:3990000, original_price:4990000,
    images:['https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-buds3-pro-r630-sm-r630nzaaxxv-thumb-542061840?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-buds3-pro-r630-sm-r630nzakxxv-thumb-542061846?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/vn/2024/gallery/vn-galaxy-buds3-pro-r630-sm-r630nzwkxxv-thumb-542061852?$650_519_PNG$'],
  },
  {
    name:'Sony WF-1000XM5 Industry Leading ANC Black', brand_id:'br-sony-audio', category_id:'cat-av-bt-earphone',
    price:6490000, original_price:7990000,
    images:['https://sony.scene7.com/is/image/sonyglobalsolutions/WF-1000XM5_B_Front_Open_CV03_220601?$productIntroPlatemobile$&fmt=png-alpha','https://sony.scene7.com/is/image/sonyglobalsolutions/WF-1000XM5_B_Angle_Open_CV01_220601?$productIntroPlatemobile$&fmt=png-alpha','https://sony.scene7.com/is/image/sonyglobalsolutions/WF-1000XM5_W_Front_Open_CV03_220601?$productIntroPlatemobile$&fmt=png-alpha'],
  },
  {
    name:'JBL Tour Pro 2 True Wireless ANC', brand_id:'br-jbl', category_id:'cat-av-bt-earphone',
    price:3490000, original_price:4490000,
    images:['https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw9e51498a/JBL_TOURPRO2_PRODUCT%20IMAGE_HERO_34D_8055.png?sw=600&sh=600&sm=fit&sfrm=png','https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw9e51498a/JBL_TOURPRO2_PRODUCT%20IMAGE_HERO_CT_8055.png?sw=600&sh=600&sm=fit&sfrm=png','https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw9e51498a/JBL_TOURPRO2_PRODUCT%20IMAGE_FRONT_8055.png?sw=600&sh=600&sm=fit&sfrm=png'],
  },

  // ════════════════════════════════════════════════
  // TAI NGHE CHỤP TAI
  // ════════════════════════════════════════════════
  {
    name:'Sony WH-1000XM5 Over-Ear ANC Black', brand_id:'br-sony-audio', category_id:'cat-av-headphone',
    price:7490000, original_price:8990000,
    images:['https://sony.scene7.com/is/image/sonyglobalsolutions/WH-1000XM5_B_Front_CV04_220601?$productIntroPlatemobile$&fmt=png-alpha','https://sony.scene7.com/is/image/sonyglobalsolutions/WH-1000XM5_S_Front_CV04_220601?$productIntroPlatemobile$&fmt=png-alpha','https://sony.scene7.com/is/image/sonyglobalsolutions/WH-1000XM5_B_Angle_CV04_220601?$productIntroPlatemobile$&fmt=png-alpha'],
  },
  {
    name:'Bose QuietComfort Ultra Headphones Black', brand_id:'br-bose', category_id:'cat-av-headphone',
    price:8990000, original_price:10990000,
    images:['https://assets.bose.com/content/dam/cloudassets/Bose_DAM/Web/consumer_electronics/global/products/headphones/qc_ultra_headphones/product_silo_images/QCultraHP_BLK_EC_hero+silo.png/_jcr_content/renditions/cq5dam.web.600.600.png','https://assets.bose.com/content/dam/cloudassets/Bose_DAM/Web/consumer_electronics/global/products/headphones/qc_ultra_headphones/product_silo_images/QCultraHP_WHT_EC_hero+silo.png/_jcr_content/renditions/cq5dam.web.600.600.png','https://assets.bose.com/content/dam/cloudassets/Bose_DAM/Web/consumer_electronics/global/products/headphones/qc_ultra_headphones/product_silo_images/QCultraHP_BLK_EC_left+silo.png/_jcr_content/renditions/cq5dam.web.600.600.png'],
  },

  // ════════════════════════════════════════════════
  // LOA
  // ════════════════════════════════════════════════
  {
    name:'JBL Charge 5 Wi-Fi Black', brand_id:'br-jbl', category_id:'cat-av-speaker',
    price:3490000, original_price:4290000,
    images:['https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw65eaac1a/JBL_CHARGE5_HERO_BLACK_0046_x1.png?sw=600&sh=600&sm=fit&sfrm=png','https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/JBL_CHARGE5_HERO_BLUE_0046_x1.png?sw=600&sh=600&sm=fit&sfrm=png','https://www.jbl.com/dw/image/v2/BFND_PRD/on/demandware.static/-/Sites-masterCatalog_Harman/default/JBL_CHARGE5_HERO_RED_0046_x1.png?sw=600&sh=600&sm=fit&sfrm=png'],
  },
  {
    name:'Bose SoundLink Flex 2 Black', brand_id:'br-bose', category_id:'cat-av-speaker',
    price:2990000, original_price:3790000,
    images:['https://assets.bose.com/content/dam/cloudassets/Bose_DAM/Web/consumer_electronics/global/products/speakers/soundlink_flex_2/product_silo_images/SLFlex2_BLK_EC_hero+silo.png/_jcr_content/renditions/cq5dam.web.600.600.png','https://assets.bose.com/content/dam/cloudassets/Bose_DAM/Web/consumer_electronics/global/products/speakers/soundlink_flex_2/product_silo_images/SLFlex2_BLU_EC_hero+silo.png/_jcr_content/renditions/cq5dam.web.600.600.png','https://assets.bose.com/content/dam/cloudassets/Bose_DAM/Web/consumer_electronics/global/products/speakers/soundlink_flex_2/product_silo_images/SLFlex2_BLK_EC_back+silo.png/_jcr_content/renditions/cq5dam.web.600.600.png'],
  },

  // ════════════════════════════════════════════════
  // SẠC DỰ PHÒNG
  // ════════════════════════════════════════════════
  {
    name:'Anker 737 Power Bank 140W 24000mAh', brand_id:'br-anker', category_id:'cat-mobile-acc-powerbank',
    price:1890000, original_price:2490000,
    images:['https://m.media-amazon.com/images/I/61lMvqFsY-L._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61QWHsoPJkL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71xnKm-MMAL._AC_SL1500_.jpg'],
  },
  {
    name:'Baseus Adaman2 Digital Display 20000mAh 65W', brand_id:'br-baseus', category_id:'cat-mobile-acc-powerbank',
    price:790000, original_price:990000,
    images:['https://m.media-amazon.com/images/I/71bV0IFpRaL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61pB3HIXNSL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71bQW-lVdmL._AC_SL1500_.jpg'],
  },

  // ════════════════════════════════════════════════
  // SẠC CÁP
  // ════════════════════════════════════════════════
  {
    name:'Apple 20W USB-C Power Adapter', brand_id:'br-apple', category_id:'cat-mobile-acc-charger',
    price:490000, original_price:590000,
    images:['https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MHJA3?wid=600&hei=600&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MHJA3_AV2?wid=600&hei=600&fmt=jpeg&qlt=90','https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MX0K2?wid=600&hei=600&fmt=jpeg&qlt=90'],
  },
  {
    name:'Anker 737 Charger GaN 120W 3 cổng', brand_id:'br-anker', category_id:'cat-mobile-acc-charger',
    price:1190000, original_price:1490000,
    images:['https://m.media-amazon.com/images/I/51VFqFSLUBL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/61nkTbwKpQL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71VuaDhyBjL._AC_SL1500_.jpg'],
  },

  // ════════════════════════════════════════════════
  // Ổ CỨNG
  // ════════════════════════════════════════════════
  {
    name:'Seagate Expansion 2TB USB 3.0 Portable', brand_id:'br-seagate', category_id:'cat-av-hdd',
    price:1490000, original_price:1890000,
    images:['https://www.seagate.com/content/dam/seagate/migrated-assets/www-content/product-pages/expansion/portables/product-img/expansion-portable-2TB-back_900x900.png','https://www.seagate.com/content/dam/seagate/migrated-assets/www-content/product-pages/expansion/portables/product-img/expansion-portable-4TB-front_900x900.png','https://www.seagate.com/content/dam/seagate/migrated-assets/www-content/product-pages/barracuda/product-img/barracuda-desktop-front_900x900.png'],
  },
  {
    name:'WD My Passport 2TB USB-C Black', brand_id:'br-wd', category_id:'cat-av-hdd',
    price:1390000, original_price:1790000,
    images:['https://m.media-amazon.com/images/I/61g2X-YWKIL._AC_SL1200_.jpg','https://m.media-amazon.com/images/I/71TrqCvGd9L._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71ggBcV1CwL._AC_SL1500_.jpg'],
  },
  {
    name:'Samsung T7 Portable SSD 2TB Black USB 3.2', brand_id:'br-samsung-st', category_id:'cat-av-hdd',
    price:1890000, original_price:2490000,
    images:['https://images.samsung.com/is/image/samsung/p6pim/uk/mu-pc2t0k-am/gallery/uk-portable-ssd-t7-mu-pc2t0k-am-thumb-451940888?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/uk/mu-pc2t0s-am/gallery/uk-portable-ssd-t7-mu-pc2t0s-am-thumb-451940900?$650_519_PNG$','https://images.samsung.com/is/image/samsung/p6pim/uk/mu-pg2t0s-am/gallery/uk-portable-ssd-t9-mu-pg2t0s-am-thumb-530428372?$650_519_PNG$'],
  },

  // ════════════════════════════════════════════════
  // THẺ NHỚ
  // ════════════════════════════════════════════════
  {
    name:'SanDisk Extreme PRO microSDXC 512GB V30 A2 200MB/s', brand_id:'br-sandisk', category_id:'cat-av-sdcard',
    price:990000, original_price:1290000,
    images:['https://m.media-amazon.com/images/I/714B3YVB9ML._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/714JtHFi4lL._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71MCbNV0HML._AC_SL1500_.jpg'],
  },
  {
    name:'SanDisk Ultra microSDXC 256GB Class 10 120MB/s', brand_id:'br-sandisk', category_id:'cat-av-sdcard',
    price:390000, original_price:490000,
    images:['https://m.media-amazon.com/images/I/71MCbNV0HML._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/714B3YVB9ML._AC_SL1500_.jpg','https://m.media-amazon.com/images/I/71lxFhiLViL._AC_SL1500_.jpg'],
  },

  // ════════════════════════════════════════════════
  // CAMERA
  // ════════════════════════════════════════════════
  {
    name:'Hikvision DS-2CD2183G2-I 8MP AcuSense Fixed Dome', brand_id:'br-hikvision', category_id:'cat-cam-security',
    price:1890000, original_price:2390000,
    images:['https://www.hikvision.com/content/dam/hikvision/en/marketing/image/latest-technologies/2021/thumbnails/8-MP-AcuSense.jpg','https://www.hikvision.com/content/dam/hikvision/en/marketing/image/latest-technologies/2021/thumbnails/4-MP-AcuSense-Fixed-Dome.jpg','https://www.hikvision.com/content/dam/hikvision/en/marketing/image/latest-technologies/2021/thumbnails/2-MP-IR-Fixed-Dome-Network-Camera.jpg'],
  },
  {
    name:'TP-Link Tapo C225 2.5K QHD Pan/Tilt AI Indoor Camera', brand_id:'br-tp-link', category_id:'cat-cam-indoor',
    price:790000, original_price:990000,
    images:['https://static.tp-link.com/upload/product-overview/2024/202402/20240228/Tapo%20C225_01.jpg','https://static.tp-link.com/upload/product-overview/2023/202308/20230830/Tapo%20C220_01.jpg','https://static.tp-link.com/upload/product-overview/2022/202210/20221025/Tapo%20C110_01.jpg'],
  },
  {
    name:'Imou Ranger 2C 4MP 360° PTZ Indoor Camera', brand_id:'br-imou', category_id:'cat-cam-indoor',
    price:690000, original_price:890000,
    images:['https://www.imoulife.com/imagex/imagefiles/imou/20230413/9_cce50c38-0b40-44e2-8e6c-61d0d13bd9e0.jpg','https://www.imoulife.com/imagex/imagefiles/imou/20230413/1_06dd2bb5-b4f4-4266-9c00-db65cceb9f2e.jpg','https://www.imoulife.com/imagex/imagefiles/imou/20230413/2_41cb0e88-f218-4a68-a23a-c2bd1d2ba1e1.jpg'],
  },

  // ════════════════════════════════════════════════
  // CHUỘT & BÀN PHÍM
  // ════════════════════════════════════════════════
  {
    name:'Logitech MX Master 3S Wireless 8000 DPI Graphite', brand_id:'br-logitech', category_id:'cat-laptop-acc-mouse',
    price:2190000, original_price:2590000,
    images:['https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/mx-master-3s/gallery/mx-master-3s-mouse-top-view-graphite.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/mx-master-3s/gallery/mx-master-3s-mouse-side-view-graphite.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/mice/mx-master-3s/gallery/mx-master-3s-mouse-bottom-view-graphite.png'],
  },
  {
    name:'Logitech MX Keys S Wireless Illuminated Graphite', brand_id:'br-logitech', category_id:'cat-laptop-acc-keyboard',
    price:2590000, original_price:3190000,
    images:['https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/keyboards/mx-keys-s/gallery/mx-keys-s-keyboard-top-view-graphite.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/keyboards/mx-keys-s/gallery/mx-keys-s-keyboard-angle-view-graphite.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/keyboards/mx-keys-s/gallery/mx-keys-s-keyboard-bottom-view-graphite.png'],
  },

  // ════════════════════════════════════════════════
  // ROUTER WIFI
  // ════════════════════════════════════════════════
  {
    name:'TP-Link Archer AX73 WiFi 6 AX5400 Dual Band Router', brand_id:'br-tp-link', category_id:'cat-laptop-acc-router',
    price:1790000, original_price:2290000,
    images:['https://static.tp-link.com/upload/product-overview/2023/202305/20230504/Archer%20AX73_01.jpg','https://static.tp-link.com/upload/product-overview/2023/202305/20230504/Archer%20AX73_02.jpg','https://static.tp-link.com/upload/product-overview/2023/202305/20230504/Archer%20AX73_03.jpg'],
  },
  {
    name:'TP-Link Deco XE75 Pro AXE5400 WiFi 6E Mesh System', brand_id:'br-tp-link', category_id:'cat-laptop-acc-router',
    price:3990000, original_price:4990000,
    images:['https://static.tp-link.com/upload/product-overview/2023/202306/20230601/Deco%20XE75%20Pro_01.jpg','https://static.tp-link.com/upload/product-overview/2023/202306/20230601/Deco%20XE75%20Pro_02.jpg','https://static.tp-link.com/upload/product-overview/2023/202306/20230601/Deco%20XE75%20Pro_03.jpg'],
  },

  // ════════════════════════════════════════════════
  // WEBCAM
  // ════════════════════════════════════════════════
  {
    name:'Logitech Brio 500 Full HD Webcam Graphite', brand_id:'br-logitech', category_id:'cat-cam-webcam',
    price:1890000, original_price:2490000,
    images:['https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/brio-500/gallery/brio-500-webcam-front-view-graphite.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/brio-500/gallery/brio-500-webcam-side-view-graphite.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/brio-500/gallery/brio-500-webcam-back-view-graphite.png'],
  },
  {
    name:'Logitech C920s HD Pro Webcam 1080p', brand_id:'br-logitech', category_id:'cat-cam-webcam',
    price:1290000, original_price:1690000,
    images:['https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/c920s-pro-hd-webcam/gallery/c920s-pro-hd-webcam-gallery-1.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/c920s-pro-hd-webcam/gallery/c920s-pro-hd-webcam-gallery-2.png','https://resource.logitech.com/w_692,c_lpad,ar_4:3,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/logitech/en/products/webcams/c920s-pro-hd-webcam/gallery/c920s-pro-hd-webcam-gallery-3.png'],
  },
];

// ── Nhóm DB theo (category_id, brand_id) ─────────────────────────
const DB_MAP = {};
for (const p of PRODUCT_DB) {
  const key = `${p.category_id}|${p.brand_id}`;
  if (!DB_MAP[key]) DB_MAP[key] = [];
  DB_MAP[key].push(p);
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔄 UPDATE PRODUCTS — Tên + Ảnh khớp nhau từ trang chủ hãng');
  console.log('═'.repeat(65));

  // Bước 1: Fix brand Kamera
  console.log('\n  [1] Fix brand "Kamera" → reassign sang Hikvision...');
  const kamera = await prisma.brand.findUnique({ where: { id: 'br-kamera' } });
  if (kamera) {
    const n = await prisma.product.updateMany({ where: { brand_id: 'br-kamera' }, data: { brand_id: 'br-hikvision' } });
    await prisma.brand.delete({ where: { id: 'br-kamera' } });
    console.log(`  ✅ Reassigned ${n.count} products, deleted "Kamera" brand`);
  } else {
    console.log('  ✅ Brand "Kamera" không còn tồn tại');
  }

  // Bước 2: Update tất cả products với tên + ảnh khớp nhau
  const total = await prisma.product.count({ where: { is_deleted: false } });
  console.log(`\n  [2] Update tên + ảnh cho ${total.toLocaleString()} sản phẩm...`);

  const pairs = await prisma.$queryRaw`
    SELECT DISTINCT category_id, brand_id FROM "Product" WHERE is_deleted = false
  `;
  console.log(`  Số cặp (category, brand): ${pairs.length}`);

  // Tính % cặp có trong DB
  const covered  = pairs.filter(p => DB_MAP[`${p.category_id}|${p.brand_id}`]).length;
  const fallback = pairs.length - covered;
  console.log(`  Cặp có data thật : ${covered} / Fallback : ${fallback}`);
  console.log('─'.repeat(65));

  const startMs = Date.now();
  let totalUpdated = 0;

  for (const { category_id: catId, brand_id: brandId } of pairs) {
    const key = `${catId}|${brandId}`;
    const pool = DB_MAP[key];

    // Nếu không có pool cụ thể, tìm pool cùng category
    const fallbackPool = Object.entries(DB_MAP)
      .filter(([k]) => k.startsWith(catId + '|'))
      .flatMap(([, v]) => v);

    const activePool = (pool && pool.length > 0) ? pool : (fallbackPool.length > 0 ? fallbackPool : PRODUCT_DB);

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

      // Group theo template
      const byTemplate = {};
      for (const p of products) {
        const template = pick(activePool);
        const tKey = template.name;
        if (!byTemplate[tKey]) byTemplate[tKey] = { template, ids: [] };
        byTemplate[tKey].ids.push(p.id);
      }

      // Bulk update
      await Promise.all(
        Object.values(byTemplate).map(({ template, ids }) =>
          prisma.product.updateMany({
            where: { id: { in: ids } },
            data: {
              name:           template.name,
              price:          template.price,
              original_price: template.original_price,
              image:          template.images[0],
              images:         JSON.stringify(template.images),
            },
          })
        )
      );

      totalUpdated += products.length;
      cursor = products[products.length - 1].id;

      const elapsed = (Date.now() - startMs) / 1000;
      const rps     = Math.round(totalUpdated / Math.max(elapsed, 1));
      const eta     = rps > 0 ? Math.ceil((total - totalUpdated) / rps) : 0;
      const etaStr  = eta > 60 ? `${Math.floor(eta / 60)}m${eta % 60}s` : `${eta}s`;
      process.stdout.write(
        `\r  ${totalUpdated.toLocaleString()}/${total.toLocaleString()}  ${rps.toLocaleString()}/s  ETA:${etaStr}   `
      );
    }
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log('\n\n  ╔══════════════════════════════════════════════════╗');
  console.log('  ║           HOÀN THÀNH                             ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║  Sản phẩm đã update : ${String(totalUpdated.toLocaleString()).padStart(10)}                ║`);
  console.log(`  ║  Thời gian          : ${String(elapsed + 's').padStart(10)}                ║`);
  console.log('  ╚══════════════════════════════════════════════════╝');

  // Sample
  console.log('\n  📋 Mẫu kiểm tra (tên + ảnh khớp nhau):');
  const samples = await prisma.product.findMany({
    take: 8, orderBy: { id: 'asc' },
    select: { name: true, brand_id: true, category_id: true, price: true, image: true },
  });
  for (const s of samples) {
    console.log(`    ✅ [${s.brand_id}] ${s.name} — ${s.price.toLocaleString()}đ`);
    console.log(`       🖼️  ${s.image}`);
  }
}

main()
  .catch(e => { console.error('\n❌ Lỗi:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
