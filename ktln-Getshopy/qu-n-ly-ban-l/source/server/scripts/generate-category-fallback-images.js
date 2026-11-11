/**
 * generate-category-fallback-images.js  (trước 11/11/2026: generate-category-base64.js)
 * ─────────────────────────────────────────────────────────────────
 * Tải 31 ảnh đại diện danh mục từ CDN Thế Giới Di Động, ghi thành FILE TĨNH:
 *   client/public/images/fallback/<category_id>.jpg
 * Ảnh dự phòng khi ảnh chính của sản phẩm lỗi (utils/categoryResolver.js).
 *
 * Vì sao file chứ không base64: bản đầu nhúng cả 31 ảnh dạng base64 vào JS
 * (categoryBase64.js, 2,4 MB) -> bundle chính 188 KB thành ~2,6 MB, mọi trang kể
 * cả admin/điện thoại tải thêm ~1,7 MB nén dù ảnh dự phòng gần như không hiện.
 * File tĩnh vẫn nằm trên server mình (không phụ thuộc CDN ngoài) nhưng chỉ tải
 * khi thật sự cần, trình duyệt cache 7 ngày (client/nginx.conf, location /images/).
 *
 *   node scripts/generate-category-fallback-images.js
 * Tải lỗi ảnh nào thì giữ file cũ của ảnh đó.
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
  // Bản đầu dùng ảnh chân tripod (bộ crawl cũ gán nhầm tripod vào Camera trong nhà —
  // xem lib/real-image-pool.js EXCLUDE_SLUGS); thay bằng camera trong nhà thật.
  'cat-cam-indoor': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/4728/340975/camera-ip-360-do-4mp-ezviz-s10-thumb2-639053798040960040-600x600.jpg',
  'cat-cam-doorbell': 'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/14239/366051/chuong-cua-camera-thong-minh-3mp-tp-link-tapo-d210-thumb-639122965676689029-600x600.jpg',
};

const OUT_DIR = path.join(__dirname, '../../client/public/images/fallback');

async function fetchImage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('image/jpeg')) throw new Error(`không phải JPEG (${type})`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const entries = Object.entries(CATEGORY_IMAGE_URLS);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Tải ${entries.length} ảnh đại diện danh mục -> ${path.relative(process.cwd(), OUT_DIR)}`);
  let ok = 0;
  for (let i = 0; i < entries.length; i++) {
    const [catId, url] = entries[i];
    const out = path.join(OUT_DIR, `${catId}.jpg`);
    process.stdout.write(`  [${i + 1}/${entries.length}] ${catId}... `);
    try {
      const buf = await fetchImage(url);
      fs.writeFileSync(out, buf);
      ok++;
      console.log(`${Math.round(buf.length / 1024)} KB`);
    } catch (err) {
      console.log(`LỖI (${err.message})${fs.existsSync(out) ? ' — giữ file cũ' : ' — CHƯA có file'}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`Xong: ${ok}/${entries.length} ảnh.`);
  if (ok < entries.length) process.exitCode = 1;
}

main();

