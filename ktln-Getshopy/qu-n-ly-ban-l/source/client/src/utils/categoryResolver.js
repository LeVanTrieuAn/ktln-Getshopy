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

  // 2. Phân tích ngữ nghĩa theo tên sản phẩm (Keyword resolver)
  if (name.includes('điện thoại') || name.includes('iphone') || name.includes('redmi') || name.includes('galaxy') || name.includes('smartphone')) return 'cat-phone';
  if (name.includes('laptop') || name.includes('macbook') || name.includes('thinkpad') || name.includes('zenbook') || name.includes('vivobook')) return 'cat-laptop';
  if (name.includes('ipad') || name.includes('tablet') || name.includes('máy tính bảng')) return 'cat-tablet';
  if (name.includes('đồng hồ') || name.includes('watch') || name.includes('smartwatch')) return 'cat-watch';
  if (name.includes('sạc') || name.includes('cáp') || name.includes('pin dự phòng') || name.includes('adapter') || name.includes('powerbank')) return 'cat-mobile-acc-charger';
  if (name.includes('tai nghe') || name.includes('airpods') || name.includes('headphone') || name.includes('earphone')) return 'cat-av-bt-earphone';
  if (name.includes('loa') || name.includes('soundbar') || name.includes('speaker')) return 'cat-av-speaker';
  if (name.includes('chuột') || name.includes('mouse')) return 'cat-laptop-acc-mouse';
  if (name.includes('bàn phím') || name.includes('keyboard')) return 'cat-laptop-acc-keyboard';
  if (name.includes('camera') || name.includes('webcam') || name.includes('cam')) return 'cat-cam-security';
  if (name.includes('ốp lưng') || name.includes('bao da') || name.includes('case')) return 'cat-mobile-acc-case-phone';
  if (name.includes('balo') || name.includes('túi chống sốc')) return 'cat-laptop-acc-bag';
  if (name.includes('ổ cứng') || name.includes('ssd') || name.includes('hdd')) return 'cat-av-hdd';
  if (name.includes('thẻ nhớ') || name.includes('microsd')) return 'cat-av-sdcard';
  if (name.includes('usb')) return 'cat-av-usb';

  // 3. Fallback mặc định an toàn cho cửa hàng công nghệ (Điện thoại)
  return 'cat-phone';
}

/**
 * Lấy URL ảnh sản phẩm hợp lệ, tự động gán ảnh fallback chuẩn danh mục nếu rỗng/thiếu.
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

  if (img && (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:image/') || img.startsWith('/images/'))) {
    return img;
  }

  // Tự động phân giải danh mục và trả về ảnh fallback tương ứng
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

