/**
 * generate-category-base64.js
 * ─────────────────────────────────────────────────────────────────
 * Tải 28 ảnh đại diện danh mục từ TGDD CDN và convert sang Data URI Base64.
 * Xuất ra: client/src/constants/categoryBase64.js
 * Giúp Frontend chạy hoàn toàn độc lập, offline, không phụ thuộc mạng/CDN.
 * ─────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');

const CATEGORY_IMAGE_URLS = {
  // 1. Thiết bị chính
  'cat-phone': 'https://cdn.tgdd.vn/Products/Images/42/369617/xiaomi-redmi-note-17-4g-purple-thumb-600x600.jpg',
  'cat-laptop': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/44/361311/hp-15-fc0023au-r5-7520u-d0bh1pa-thumb-639030592238863081-600x600.jpg',
  'cat-tablet': 'https://cdn.tgdd.vn/Products/Images/522/335308/ipad-11-wifi-yellow-thumb-600x600.jpg',
  'cat-watch': 'https://cdn.tgdd.vn/Products/Images/7077/358003/dong-ho-dinh-vi-tre-em-kidcare-sight-s25-den-thumb-600x600.jpg',

  // 2. Phụ kiện di động
  'cat-mobile-acc-charger': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/9499/363084/sac-nhanh-type-c-iq3-45w-anker-nano-a121d-thumb4-639122867487367367-600x600.jpg',
  'cat-mobile-acc-case-phone': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/1662/325750/bao-da-smart-folio-cho-ipad-pro-m4-11-inch-thumb2-639179113640687758-600x600.jpg',
  'cat-mobile-acc-case-tablet': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/1662/325750/bao-da-smart-folio-cho-ipad-pro-m4-11-inch-thumb2-639179113640687758-600x600.jpg',
  'cat-mobile-acc-screen': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/1363/342895/mieng-dan-kinh-cuong-luc-iphone-17-mipow-bj702-bk-thumb2-639162566534207160-600x600.jpg',
  'cat-mobile-acc-cam-cover': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/13118/344600/mieng-dan-camera-iphone-17-pro-iphone-17-pro-max-optix-vien-nhom-thuy-tinh-uniq-thumb-638930533604528113-600x600.jpg',
  'cat-mobile-acc-stand': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/6862/369154/gia-do-dien-thoai-kiem-tripod-mini-magnetic-24cm-ulanzi-ma60-thumb-639191554443320907-600x600.jpg',
  'cat-mobile-acc-airpods-case': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7925/331972/tui-dung-airpods-4-silicone-pc-uniq-lino-hybrid-liquid-thumb-638675203689538052-600x600.jpg',
  'cat-mobile-acc-fan': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7922/363970/quat-cam-tay-ava-jf-402-thumb-639120211080189890-600x600.jpg',

  // 3. Phụ kiện Laptop & PC
  'cat-laptop-acc-mouse': 'https://cdn.tgdd.vn/Products/Images/86/299931/chuot-khong-day-logitech-silent-signature-m650-size-m-300523-084259-600x600.jpg',
  'cat-laptop-acc-keyboard': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/4547/341121/bo-ban-phim-chuot-bluetooth-logitech-mk250-210725-042039-677-600x600.jpg',
  'cat-laptop-acc-bag': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7923/339538/tui-chong-soc-laptop-16-inch-togo-tcs16-td-040725-022032-876-600x600.jpg',
  'cat-laptop-acc-pouch': 'https://cdnv2.tgdd.vn/mwg-static/dmx/Products/Images/13818/364582/tui-deo-cheo-tomtoc-slash-t27-shoulder-bag-t27s1t1gc-thumb-639098623257252932-300x300.jpg',
  'cat-laptop-acc-mousepad': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/6858/362525/mieng-lot-chuot-hyperwork-core-pad-size-s-rhumb-639129859032112523-600x600.jpg',
  'cat-laptop-acc-drawing': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/10421/366839/bang-ve-tu-xoa-da-sac-kidcare-man-hinh-lcd-12-inch-h12m-thumb-639144393213977581-600x600.jpg',

  // 4. Âm thanh, nghe nhìn, lưu trữ
  'cat-av-bt-earphone': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/54/344776/tai-nghe-bluetooth-apple-airpods-pro-3-trang-mfhp4-thumb-639177367044323389-600x600.jpg',
  'cat-av-wire-earphone': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/54/344776/tai-nghe-bluetooth-apple-airpods-pro-3-trang-mfhp4-thumb-639177367044323389-600x600.jpg',
  'cat-av-headphone': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/54/344776/tai-nghe-bluetooth-apple-airpods-pro-3-trang-mfhp4-thumb-639177367044323389-600x600.jpg',
  'cat-av-sport-earphone': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/54/344776/tai-nghe-bluetooth-apple-airpods-pro-3-trang-mfhp4-thumb-639177367044323389-600x600.jpg',
  'cat-av-speaker': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/2162/344795/loa-bluetooth-alpha-works-aw-ikon12-thumb-2-638936187417369115-600x600.jpg',
  'cat-av-mic': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/11998/366831/thiet-bi-thu-am-khong-day-dji-mic-mini-2-1-tx-1-rx-dmmt02-dmmr01-thumb-639137458246897042-600x600.jpg',
  'cat-av-projector': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/862/359236/may-chieu-wanbo-full-hd-t2-ultra-thumb-638989947423963951-600x600.jpg',
  'cat-av-hdd': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/1902/366929/o-cung-ssd-1tb-sandisk-portable-sdssde30f-fifa-world-cup-2026-edition-thumb-639141324997789800-600x600.jpg',
  'cat-av-sdcard': 'https://cdn.tgdd.vn/Products/Images/55/314497/the-nho-kioxia-microsd-64gb-class-10-u1-thumb-2-600x600.jpg',
  'cat-av-usb': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/75/369924/usb-type-c-3-2-64gb-sandisk-sdczb-thumb-639210260426858186-600x600.jpg',

  // 5. Camera & Nhà thông minh
  'cat-cam-security': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/4728/329241/camera-ip-360-do-3mp-ezviz-ty1-thumb-1-638665876017214332-600x600.jpg',
  'cat-cam-indoor': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/3885/369148/chan-tripod-kiem-gay-selfie-tu-bung-chan-nhanh-2-13m-ulanzi-mt-80-thumb-639195288734841056-600x600.jpg',
  'cat-cam-doorbell': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/14239/366051/chuong-cua-camera-thong-minh-3mp-tp-link-tapo-d210-thumb-639122965676689029-600x600.jpg',
};

async function fetchAsBase64(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const base64Str = Buffer.from(buf).toString('base64');
    return `data:${contentType};base64,${base64Str}`;
  } catch (err) {
    console.warn(`  ⚠️ Failed to fetch ${url}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('🔄 Đang tải và convert 28 ảnh danh mục từ TGDD sang Base64...');
  const base64Map = {};
  const entries = Object.entries(CATEGORY_IMAGE_URLS);

  for (let i = 0; i < entries.length; i++) {
    const [catId, url] = entries[i];
    process.stdout.write(`  [${i + 1}/${entries.length}] ${catId}... `);
    const b64 = await fetchAsBase64(url);
    if (b64) {
      base64Map[catId] = b64;
      console.log(`✅ (${Math.round(b64.length / 1024)} KB)`);
    } else {
      console.log('❌ Fallback to local asset');
    }
  }

  const outputPath = path.join(__dirname, '../../client/src/constants/categoryBase64.js');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const content = `/**
 * categoryBase64.js
 * ─────────────────────────────────────────────────────────────────
 * Bộ ảnh fallback Base64 chuẩn từ Thế Giới Di Động cho 28+ danh mục.
 * Hoạt động 100% độc lập, offline, không phụ thuộc mạng, CDN hay MinIO.
 * ─────────────────────────────────────────────────────────────────
 */

export const CATEGORY_BASE64 = ${JSON.stringify(base64Map, null, 2)};
`;

  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`\n🎉 Đã xuất thành công file Base64 tại:\n   ${outputPath}`);
  console.log(`   Tổng số danh mục đã encode Base64: ${Object.keys(base64Map).length}/${entries.length}`);
}

main();

