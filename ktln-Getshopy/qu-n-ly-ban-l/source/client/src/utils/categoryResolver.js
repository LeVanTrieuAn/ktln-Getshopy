/**
 * categoryResolver.js
 * ─────────────────────────────────────────────────────────────────
 * Bộ phân giải danh mục đa tầng & tiện ích ảnh fallback.
 * Đảm bảo 100% sản phẩm luôn xác định được danh mục và có ảnh hiển thị,
 * không bao giờ bị rơi vào trường hợp "unknown category" hay vỡ ảnh.
 * ─────────────────────────────────────────────────────────────────
 */

import { CATEGORY_BASE64 } from '../constants/categoryBase64';

// Bộ sưu tập ảnh fallback Base64 chuẩn từ TGDD cho 31 danh mục (hoàn toàn offline)
export const CATEGORY_FALLBACK_IMAGES = {
  ...CATEGORY_BASE64,

  // Fallback bổ sung danh mục cha nếu cần
  'cat-mobile-acc': CATEGORY_BASE64['cat-mobile-acc-charger'] || '/images/commerce/cat_phone_case.jpg',
  'cat-laptop-acc': CATEGORY_BASE64['cat-laptop-acc-mouse'] || '/images/commerce/prod_mouse.jpg',
  'cat-av': CATEGORY_BASE64['cat-av-bt-earphone'] || '/images/commerce/cat_headphones.jpg',
  'cat-camera': CATEGORY_BASE64['cat-cam-security'] || '/images/commerce/cat_all.jpg',
  'DEFAULT': CATEGORY_BASE64['cat-phone'] || '/images/commerce/cat_all.jpg'
};

/**
 * Chuẩn hóa chuỗi tiếng Việt: bỏ dấu, lowercase, chuẩn hóa khoảng trắng.
 * Nguồn: Unicode NFD normalization (ECMA-262, String.prototype.normalize)
 * Ví dụ: "Điện Thoại" → "dien thoai", "Đồng hồ" → "dong ho"
 * @param {string} str
 * @returns {string}
 */
export function stripVietnamese(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, m => m === 'đ' ? 'd' : 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Bảng alias: input không dấu (hoặc biến thể phổ biến) → category_id
 * Hỗ trợ người dùng gõ không dấu, gõ sai chính tả phổ biến, gõ tiếng Anh.
 * Thứ tự: match được kiểm tra từ trên xuống (more specific trước).
 */
const UNACCENTED_ALIASES = [
  // Điện thoại
  { keywords: ['dien thoai', 'smartphone', 'iphone', 'redmi', 'galaxy', 'phone'], catId: 'cat-phone' },
  // Laptop
  { keywords: ['laptop', 'macbook', 'thinkpad', 'zenbook', 'vivobook', 'may tinh xach tay'], catId: 'cat-laptop' },
  // Tablet / máy tính bảng
  { keywords: ['may tinh bang', 'tablet', 'ipad', 'may tinh bang', 'mtb'], catId: 'cat-tablet' },
  // Smartwatch / đồng hồ thông minh
  { keywords: ['dong ho thong minh', 'smartwatch', 'dong ho', 'apple watch', 'watch'], catId: 'cat-watch' },
  // Sạc dự phòng (phải trước "sac cap" vì cụ thể hơn)
  { keywords: ['sac du phong', 'powerbank', 'pin du phong', 'power bank'], catId: 'cat-mobile-acc-powerbank' },
  // Sạc, cáp
  { keywords: ['sac cap', 'sac va cap', 'cap sac', 'adapter', 'cu sac', 'day cap', 'cap'], catId: 'cat-mobile-acc-charger' },
  // Ốp lưng điện thoại
  { keywords: ['op lung dien thoai', 'op lung', 'bao da', 'case dien thoai'], catId: 'cat-mobile-acc-case-phone' },
  // Ốp lưng tablet
  { keywords: ['op lung tablet', 'op lung may tinh bang', 'case tablet'], catId: 'cat-mobile-acc-case-tablet' },
  // Miếng dán camera (phải trước miếng dán màn hình vì cụ thể hơn)
  { keywords: ['mieng dan camera', 'dan camera', 'bao ve camera'], catId: 'cat-mobile-acc-cam-cover' },
  // Miếng dán màn hình
  { keywords: ['mieng dan man hinh', 'kinh cuong luc', 'cuong luc', 'mieng dan'], catId: 'cat-mobile-acc-screen' },
  // Giá đỡ điện thoại
  { keywords: ['gia do dien thoai', 'gia do', 'ke do', 'stand dien thoai'], catId: 'cat-mobile-acc-stand' },
  // Chuột máy tính
  { keywords: ['chuot may tinh', 'chuot', 'mouse'], catId: 'cat-laptop-acc-mouse' },
  // Bàn phím
  { keywords: ['ban phim', 'keyboard', 'phim co'], catId: 'cat-laptop-acc-keyboard' },
  // Balo, túi chống sốc
  { keywords: ['balo chong soc', 'tui chong soc', 'balo laptop', 'balo', 'tui dung laptop'], catId: 'cat-laptop-acc-bag' },
  // Túi đựng phụ kiện
  { keywords: ['tui dung phu kien', 'tui phu kien', 'tui cam tay'], catId: 'cat-laptop-acc-pouch' },
  // Miếng lót chuột
  { keywords: ['mieng lot chuot', 'lot chuot', 'mousepad', 'pad chuot'], catId: 'cat-laptop-acc-mousepad' },
  // Bảng vẽ điện tử
  { keywords: ['bang ve dien tu', 'bang ve', 'drawing tablet', 'may ve'], catId: 'cat-laptop-acc-drawing' },
  // Tai nghe Bluetooth (phải trước "tai nghe day" và "tai nghe chup tai")
  { keywords: ['tai nghe bluetooth', 'tai nghe bt', 'airpods', 'tws', 'true wireless'], catId: 'cat-av-bt-earphone' },
  // Tai nghe chụp tai (over-ear)
  { keywords: ['tai nghe chup tai', 'tai nghe over ear', 'headphone', 'headset'], catId: 'cat-av-headphone' },
  // Tai nghe thể thao
  { keywords: ['tai nghe the thao', 'tai nghe sport', 'sport earphone', 'in-ear the thao'], catId: 'cat-av-sport-earphone' },
  // Tai nghe dây (sau các loại cụ thể hơn)
  { keywords: ['tai nghe day', 'tai nghe co day', 'wired earphone', 'tai nghe'], catId: 'cat-av-wire-earphone' },
  // Loa
  { keywords: ['loa bluetooth', 'loa khong day', 'speaker', 'soundbar', 'loa'], catId: 'cat-av-speaker' },
  // Micro
  { keywords: ['micro thu am', 'micro', 'microphone', 'mic thu am', 'mic'], catId: 'cat-av-mic' },
  // Máy chiếu
  { keywords: ['may chieu', 'may chieu mini', 'projector'], catId: 'cat-av-projector' },
  // Ổ cứng / SSD
  { keywords: ['o cung', 'ssd', 'hdd', 'o cung di dong', 'o cung ngoai'], catId: 'cat-av-hdd' },
  // Thẻ nhớ
  { keywords: ['the nho', 'microsd', 'sd card', 'memory card', 'the micro sd'], catId: 'cat-av-sdcard' },
  // USB
  { keywords: ['usb', 'o nho usb', 'flash drive', 'usb drive', 'thumbdrive'], catId: 'cat-av-usb' },
  // Camera giám sát (ngoài trời / tổng quát)
  { keywords: ['camera giam sat', 'camera ngoai troi', 'camera an ninh', 'camera security', 'camera'], catId: 'cat-cam-security' },
  // Camera trong nhà
  { keywords: ['camera trong nha', 'camera ip', 'camera wifi', 'camera noi that'], catId: 'cat-cam-indoor' },
  // Chuông cửa camera
  { keywords: ['chuong cua camera', 'chuong cua thong minh', 'doorbell', 'chuong cua'], catId: 'cat-cam-doorbell' },
];

/**
 * Phân giải category từ input text (không dấu hoặc có dấu).
 * Dùng cho filter category sidebar khi user gõ tìm kiếm.
 * Trả về category_id hoặc null nếu không khớp.
 * @param {string} input - Text người dùng nhập (có hoặc không dấu)
 * @returns {string|null}
 */
export function resolveCategoryFromText(input) {
  if (!input) return null;
  const normalized = stripVietnamese(input);

  for (const { keywords, catId } of UNACCENTED_ALIASES) {
    for (const kw of keywords) {
      if (normalized.includes(kw) || kw.includes(normalized)) {
        return catId;
      }
    }
  }
  return null;
}

/**
 * Phân giải danh mục chính xác từ mã ID hoặc phân tích ngữ nghĩa tên sản phẩm.
 * Không bao giờ trả về null/undefined/unknown.
 */
export function resolveCategory(product = {}) {
  let catId = (product.category_id || product.categoryId || product.catId || '').toLowerCase().trim();
  const name = (product.name || '').toLowerCase();

  // 1. Khớp chính xác hoặc khớp mã cha/mã cũ
  if (catId) {
    if (catId === 'cat-phone' || catId === 'c1') return 'cat-phone';
    if (catId === 'cat-laptop' || catId === 'c2') return 'cat-laptop';
    if (catId === 'cat-tablet' || catId === 'c3') return 'cat-tablet';
    if (catId === 'cat-watch' || catId === 'c7') return 'cat-watch';

    // Sub-categories matching
    if (catId.includes('charger') || catId.includes('powerbank')) return 'cat-mobile-acc-charger';
    if (catId.includes('case-phone') || catId.includes('case-tablet') || catId.includes('airpods-case')) return 'cat-mobile-acc-case-phone';
    if (catId.includes('cam-cover')) return 'cat-mobile-acc-cam-cover';
    if (catId.includes('screen')) return 'cat-mobile-acc-screen';
    if (catId.includes('stand')) return 'cat-mobile-acc-stand';
    if (catId.includes('mousepad')) return 'cat-laptop-acc-mousepad';
    if (catId.includes('mouse')) return 'cat-laptop-acc-mouse';
    if (catId.includes('keyboard')) return 'cat-laptop-acc-keyboard';
    if (catId.includes('bag')) return 'cat-laptop-acc-bag';
    if (catId.includes('pouch')) return 'cat-laptop-acc-pouch';
    if (catId.includes('drawing')) return 'cat-laptop-acc-drawing';
    if (catId.includes('earphone')) return 'cat-av-bt-earphone';
    if (catId.includes('headphone')) return 'cat-av-headphone';
    if (catId.includes('speaker')) return 'cat-av-speaker';
    if (catId.includes('mic')) return 'cat-av-mic';
    if (catId.includes('projector')) return 'cat-av-projector';
    if (catId.includes('hdd') || catId.includes('ssd')) return 'cat-av-hdd';
    if (catId.includes('sdcard')) return 'cat-av-sdcard';
    if (catId.includes('usb')) return 'cat-av-usb';
    if (catId.includes('doorbell')) return 'cat-cam-doorbell';
    if (catId.includes('security') || catId.includes('cam')) return 'cat-cam-security';

    // Tiền tố cha
    if (catId.startsWith('cat-mobile-acc') || catId === 'c4') return 'cat-mobile-acc-charger';
    if (catId.startsWith('cat-laptop-acc') || catId === 'c9' || catId === 'c11') return 'cat-laptop-acc-mouse';
    if (catId.startsWith('cat-av') || catId === 'c5' || catId === 'c8') return 'cat-av-bt-earphone';
    if (catId.startsWith('cat-camera') || catId === 'c6' || catId === 'c10') return 'cat-cam-security';
  }

  // 2. Phân tích ngữ nghĩa theo tên sản phẩm (Keyword resolver — có dấu và không dấu)
  const nameStripped = stripVietnamese(name);

  if (name.includes('điện thoại') || name.includes('iphone') || name.includes('redmi') || name.includes('galaxy') || name.includes('smartphone') || nameStripped.includes('dien thoai')) return 'cat-phone';
  if (name.includes('laptop') || name.includes('macbook') || name.includes('thinkpad') || name.includes('zenbook') || name.includes('vivobook')) return 'cat-laptop';
  if (name.includes('ipad') || name.includes('tablet') || name.includes('máy tính bảng') || nameStripped.includes('may tinh bang')) return 'cat-tablet';
  if (name.includes('đồng hồ') || name.includes('watch') || name.includes('smartwatch') || nameStripped.includes('dong ho')) return 'cat-watch';
  if (name.includes('sạc') || name.includes('cáp') || name.includes('pin dự phòng') || name.includes('adapter') || name.includes('powerbank') || nameStripped.includes('sac') || nameStripped.includes('cap sac')) return 'cat-mobile-acc-charger';
  if (name.includes('tai nghe') || name.includes('airpods') || name.includes('headphone') || name.includes('earphone') || nameStripped.includes('tai nghe')) return 'cat-av-bt-earphone';
  if (name.includes('loa') || name.includes('soundbar') || name.includes('speaker')) return 'cat-av-speaker';
  if (name.includes('chuột') || name.includes('mouse') || nameStripped.includes('chuot')) return 'cat-laptop-acc-mouse';
  if (name.includes('bàn phím') || name.includes('keyboard') || nameStripped.includes('ban phim')) return 'cat-laptop-acc-keyboard';
  if (name.includes('camera') || name.includes('webcam') || name.includes('cam')) return 'cat-cam-security';
  if (name.includes('ốp lưng') || name.includes('bao da') || name.includes('case') || nameStripped.includes('op lung')) return 'cat-mobile-acc-case-phone';
  if (name.includes('balo') || name.includes('túi chống sốc') || nameStripped.includes('balo') || nameStripped.includes('tui chong soc')) return 'cat-laptop-acc-bag';
  if (name.includes('ổ cứng') || name.includes('ssd') || name.includes('hdd') || nameStripped.includes('o cung')) return 'cat-av-hdd';
  if (name.includes('thẻ nhớ') || name.includes('microsd') || nameStripped.includes('the nho')) return 'cat-av-sdcard';
  if (name.includes('usb')) return 'cat-av-usb';

  // 3. Fallback mặc định an toàn cho cửa hàng công nghệ (Điện thoại)
  return 'cat-phone';
}

// ── CỜ KIỂM THỬ TẮT CDN ──────────────────────────────────────────
// Đặt true: Bỏ qua 100% link CDN ảnh bên ngoài (tgdd, unsplash, picsum...),
// ép toàn bộ sản phẩm trên giao diện hiển thị bằng bộ ảnh Fallback Base64 theo danh mục.
// Đặt false: Hoạt động bình thường (ưu tiên ảnh CDN thật, chỉ fallback khi lỗi/rỗng).
export const DISABLE_CDN_FOR_TESTING = true;

/**
 * Lấy URL ảnh sản phẩm hợp lệ, tự động gán ảnh fallback chuẩn danh mục nếu rỗng/thiếu/khi tắt CDN.
 */
export function getProductImage(product = {}) {
  let img = product.selectedVariant?.image || product.image || (product.images && product.images.length > 0 ? product.images[0] : null);

  // Parse JSON nếu images là chuỗi JSON
  if (!img && typeof product.images === 'string' && product.images.startsWith('[')) {
    try {
      const parsed = JSON.parse(product.images);
      if (parsed && parsed.length > 0) img = parsed[0];
    } catch {}
  }

  // Nếu đang kiểm thử tắt CDN: Bỏ qua http/https ngoài, chỉ dùng Base64
  if (!DISABLE_CDN_FOR_TESTING) {
    if (img && (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:image/') || img.startsWith('/images/'))) {
      return img;
    }
  } else {
    if (img && img.startsWith('data:image/')) {
      return img;
    }
  }

  // Tự động phân giải danh mục và trả về ảnh fallback Base64 tương ứng
  const catKey = resolveCategory(product);
  return CATEGORY_FALLBACK_IMAGES[catKey] || CATEGORY_FALLBACK_IMAGES['cat-phone'];
}

/**
 * Xử lý sự kiện onError trên thẻ <img>:
 * Đắp ảnh fallback chuẩn theo danh mục và ngăn loop vô tận.
 */
export function handleImageError(e, product = {}) {
  e.target.onerror = null; // Chống lặp vô hạn
  const catKey = resolveCategory(product);
  e.target.src = CATEGORY_FALLBACK_IMAGES[catKey] || CATEGORY_FALLBACK_IMAGES['cat-phone'];
}

