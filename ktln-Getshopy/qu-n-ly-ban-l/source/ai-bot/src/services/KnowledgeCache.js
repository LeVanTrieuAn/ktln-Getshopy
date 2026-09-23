'use strict';
/**
 * ============================================================
 * KNOWLEDGE CACHE — Getshopy AI Knowledge Base
 * services/KnowledgeCache.js
 * ============================================================
 *
 * Cache tĩnh cho Categories (49) + Brands (67) + aliases.
 * Load 1 lần từ DB, refresh mỗi 5 phút.
 * Tất cả AI services dùng chung cache này thay vì query DB mỗi request.
 *
 * @module KnowledgeCache
 */

const { prisma } = require('../db');
const { removeDiacritics } = require('../ai/huggingface');

// ─────────────────────────────────────────────────────────────────────────────
// CACHE STATE
// ─────────────────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

let _categories     = [];         // Array<{id, name, parent_id, sort_order}>
let _categoryMap    = {};         // {id → name}
let _parentCats     = [];         // [{id, name, children: [{id, name}]}]
let _childToParent  = {};         // {childId → parentId}
let _parentToChildren = {};       // {parentId → [childId, ...]}

let _brands         = [];         // Array<{id, name}>
let _brandMap       = {};         // {id → name}
let _brandAliases   = {};         // {normalizedAlias → brandId}

let _lastRefresh    = 0;
let _refreshPromise = null;

// ─────────────────────────────────────────────────────────────────────────────
// BRAND ALIAS MAP — Từ khóa phổ biến → brand_id
// Bao gồm tên model, biệt danh, viết tắt, typo phổ biến
// ─────────────────────────────────────────────────────────────────────────────
// ─── 33 thương hiệu thực tế trong DB (theo SEED_DOCUMENTATION.md) ───────────
const BRAND_KEYWORD_ALIASES = {
  // Apple
  'iphone': 'br-apple', 'macbook': 'br-apple', 'ipad': 'br-apple',
  'airpods': 'br-apple', 'apple watch': 'br-apple', 'apple': 'br-apple',
  'imac': 'br-apple', 'mac mini': 'br-apple', 'mac studio': 'br-apple',
  'mac pro': 'br-apple', 'homepod': 'br-apple', 'airtag': 'br-apple',

  // Samsung
  'samsung': 'br-samsung', 'galaxy': 'br-samsung', 'galaxy tab': 'br-samsung',
  'galaxy watch': 'br-samsung', 'galaxy buds': 'br-samsung', 'galaxy book': 'br-samsung',
  'galaxy fold': 'br-samsung', 'galaxy flip': 'br-samsung',
  'galaxy s': 'br-samsung', 'galaxy a': 'br-samsung', 'galaxy z': 'br-samsung',

  // Xiaomi
  'xiaomi': 'br-xiaomi', 'redmi': 'br-xiaomi', 'poco': 'br-xiaomi',
  'mi band': 'br-xiaomi', 'mi watch': 'br-xiaomi',

  // OPPO / realme / vivo / HONOR
  'oppo': 'br-oppo', 'reno': 'br-oppo', 'find x': 'br-oppo', 'find n': 'br-oppo',
  'realme': 'br-realme',
  'vivo': 'br-vivo',
  'honor': 'br-honor',

  // Motorola
  'motorola': 'br-motorola', 'moto': 'br-motorola',

  // Infinix / TECNO — chưa có sản phẩm trong DB hiện tại, alias giữ lại nhưng không resolve được
  // 'infinix': 'br-infinix',
  // 'tecno': 'br-tecno',

  // MSI + Anker — vẫn có sản phẩm trong DB (legacy seed)
  'msi': 'br-msi', 'msi gaming': 'br-msi', 'msi laptop': 'br-msi',
  'anker': 'br-anker',

  // Laptop brands
  'acer': 'br-acer', 'aspire': 'br-acer', 'nitro': 'br-acer',
  'predator': 'br-acer', 'swift': 'br-acer',
  'asus': 'br-asus', 'zenbook': 'br-asus', 'vivobook': 'br-asus',
  'rog': 'br-asus', 'tuf': 'br-asus',
  'dell': 'br-dell', 'inspiron': 'br-dell', 'latitude': 'br-dell',
  'xps': 'br-dell', 'alienware': 'br-dell', 'vostro': 'br-dell',
  'hp': 'br-hp', 'pavilion': 'br-hp', 'envy': 'br-hp',
  'spectre': 'br-hp', 'omen': 'br-hp', 'victus': 'br-hp', 'elitebook': 'br-hp',
  'lenovo': 'br-lenovo', 'thinkpad': 'br-lenovo', 'ideapad': 'br-lenovo',
  'yoga': 'br-lenovo', 'legion': 'br-lenovo', 'thinkbook': 'br-lenovo',

  // Smartwatch
  'amazfit': 'br-amazfit',
  'huawei': 'br-huawei', 'huawei watch': 'br-huawei', 'matepad': 'br-huawei',

  // Audio (Sony DB id = br-sony-audio)
  'jbl': 'br-jbl',
  'sony': 'br-sony-audio', 'wh-1000xm': 'br-sony-audio', 'wf-1000xm': 'br-sony-audio',
  'xm5': 'br-sony-audio', 'xm4': 'br-sony-audio',
  'marshall': 'br-marshall',

  // Accessories
  'baseus': 'br-baseus',
  'ugreen': 'br-ugreen',
  'esr': 'br-esr',           // miếng dán màn hình

  // Gaming peripherals
  'razer': 'br-razer', 'deathadder': 'br-razer',
  'blackwidow': 'br-razer', 'kraken': 'br-razer',
  'logitech': 'br-logitech', 'mx master': 'br-logitech',
  'mx keys': 'br-logitech', 'g pro': 'br-logitech',

  // Camera / Security
  'dahua': 'br-dahua',
  'ezviz': 'br-ezviz',
  'imou': 'br-imou',
  'tp-link': 'br-tp-link', 'tplink': 'br-tp-link', 'tp link': 'br-tp-link',

  // Storage
  'kingston': 'br-kingston',
  'sandisk': 'br-sandisk',
  'seagate': 'br-seagate',

  // Network
  'totolink': 'br-totolink',
};

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY KEYWORD → CATEGORY ID mapping
// 34 danh mục thực tế: 8 root + 26 leaf (theo SEED_DOCUMENTATION.md)
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_KEYWORD_TO_ID = {
  // ── Cấp 1 (cha) ──────────────────────────────────────────────
  'dien thoai': 'cat-phone', 'smartphone': 'cat-phone', 'phone': 'cat-phone',
  'android': 'cat-phone', 'ios': 'cat-phone',
  'laptop': 'cat-laptop', 'may tinh xach tay': 'cat-laptop', 'notebook': 'cat-laptop',
  'may tinh': 'cat-laptop', 'computer': 'cat-laptop', 'pc': 'cat-laptop', // FIX: 'máy tính' → laptop
  'tablet': 'cat-tablet', 'may tinh bang': 'cat-tablet', 'ipad': 'cat-tablet',
  'smartwatch': 'cat-watch', 'dong ho thong minh': 'cat-watch', 'dong ho': 'cat-watch',
  'watch': 'cat-watch', 'apple watch': 'cat-watch', 'smart watch': 'cat-watch', // FIX: more watch aliases

  // ── Phụ kiện di động — 7 sub-cat tồn tại ─────────────────────
  // (đã xóa: powerbank, case-phone, strap, pen, lens)
  'sac du phong': 'cat-mobile-acc-charger', 'pin du phong': 'cat-mobile-acc-charger',
  'powerbank': 'cat-mobile-acc-charger',          // → gần nhất là charger
  'sac': 'cat-mobile-acc-charger', 'cap sac': 'cat-mobile-acc-charger',
  'cu sac': 'cat-mobile-acc-charger', 'sac nhanh': 'cat-mobile-acc-charger',
  'cap': 'cat-mobile-acc-charger',
  'op lung may tinh bang': 'cat-mobile-acc-case-tablet',
  'op lung tablet': 'cat-mobile-acc-case-tablet', 'bao da tablet': 'cat-mobile-acc-case-tablet',
  'mieng dan': 'cat-mobile-acc-screen', 'cuong luc': 'cat-mobile-acc-screen',
  'kinh cuong luc': 'cat-mobile-acc-screen',
  'mieng dan camera': 'cat-mobile-acc-cam-cover',
  'tui dung airpods': 'cat-mobile-acc-airpods-case', 'case airpods': 'cat-mobile-acc-airpods-case',
  'quat mini': 'cat-mobile-acc-fan', 'quat cam tay': 'cat-mobile-acc-fan',
  'gia do': 'cat-mobile-acc-stand', 'gia do dien thoai': 'cat-mobile-acc-stand',
  'gia do laptop': 'cat-mobile-acc-stand', 'de dien thoai': 'cat-mobile-acc-stand',

  // ── Phụ kiện laptop, PC — 6 sub-cat tồn tại ──────────────────
  // (đã xóa: hub, router, keyboard-cover, software, monitor-stand)
  'chuot': 'cat-laptop-acc-mouse', 'chuot may tinh': 'cat-laptop-acc-mouse',
  'chuot khong day': 'cat-laptop-acc-mouse', 'mouse': 'cat-laptop-acc-mouse',
  'ban phim': 'cat-laptop-acc-keyboard', 'ban phim co': 'cat-laptop-acc-keyboard',
  'keyboard': 'cat-laptop-acc-keyboard',
  'balo': 'cat-laptop-acc-bag', 'tui chong soc': 'cat-laptop-acc-bag',
  'balo laptop': 'cat-laptop-acc-bag', 'tui laptop': 'cat-laptop-acc-bag',
  'tui dung phu kien': 'cat-laptop-acc-pouch', 'tui phu kien': 'cat-laptop-acc-pouch',
  'lot chuot': 'cat-laptop-acc-mousepad', 'mieng lot chuot': 'cat-laptop-acc-mousepad',
  'mousepad': 'cat-laptop-acc-mousepad',
  'bang ve dien tu': 'cat-laptop-acc-drawing', 'bang ve': 'cat-laptop-acc-drawing',

  // ── Thiết bị nghe nhìn — 10 sub-cat tồn tại ─────────────────
  // (đã xóa: smartglass)
  'tai nghe bluetooth': 'cat-av-bt-earphone', 'tai nghe true wireless': 'cat-av-bt-earphone',
  'tws': 'cat-av-bt-earphone', 'earbuds': 'cat-av-bt-earphone',
  'tai nghe day': 'cat-av-wire-earphone', 'tai nghe co day': 'cat-av-wire-earphone',
  'tai nghe chup tai': 'cat-av-headphone', 'headphone': 'cat-av-headphone',
  'tai nghe over ear': 'cat-av-headphone', 'tai nghe chong on': 'cat-av-headphone',
  'tai nghe the thao': 'cat-av-sport-earphone', 'tai nghe chay bo': 'cat-av-sport-earphone',
  'tai nghe': 'cat-av-bt-earphone', // default → bluetooth
  'loa': 'cat-av-speaker', 'loa bluetooth': 'cat-av-speaker',
  'loa di dong': 'cat-av-speaker', 'speaker': 'cat-av-speaker',
  'micro': 'cat-av-mic', 'mic': 'cat-av-mic', 'microphone': 'cat-av-mic',
  'mic thu am': 'cat-av-mic',
  'may chieu': 'cat-av-projector', 'projector': 'cat-av-projector',
  'o cung': 'cat-av-hdd', 'hdd': 'cat-av-hdd', 'ssd': 'cat-av-hdd',
  'o cung di dong': 'cat-av-hdd',
  'the nho': 'cat-av-sdcard', 'sd card': 'cat-av-sdcard', 'microsd': 'cat-av-sdcard',
  'usb': 'cat-av-usb', 'usb flash': 'cat-av-usb',

  // ── Camera — 3 sub-cat tồn tại ───────────────────────────────
  // (đã xóa: outdoor, solar, 4g, webcam)
  'camera': 'cat-camera', 'camera giam sat': 'cat-cam-security',
  'camera trong nha': 'cat-cam-indoor', 'camera ip': 'cat-cam-indoor',
  'chuong cua camera': 'cat-cam-doorbell', 'chuong cua': 'cat-cam-doorbell',
};

// ─────────────────────────────────────────────────────────────────────────────
// REFRESH — Load from DB
// ─────────────────────────────────────────────────────────────────────────────

async function _loadFromDB() {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ orderBy: { sort_order: 'asc' } }),
    prisma.brand.findMany({ where: { is_deleted: false } }),
  ]);

  // Categories
  _categories = categories;
  _categoryMap = {};
  _parentCats = [];
  _childToParent = {};
  _parentToChildren = {};

  const parentMap = {};
  categories.forEach(c => {
    _categoryMap[c.id] = c.name;
    if (!c.parent_id) {
      parentMap[c.id] = { ...c, children: [] };
    }
  });
  categories.forEach(c => {
    if (c.parent_id && parentMap[c.parent_id]) {
      parentMap[c.parent_id].children.push(c);
      _childToParent[c.id] = c.parent_id;
      if (!_parentToChildren[c.parent_id]) _parentToChildren[c.parent_id] = [];
      _parentToChildren[c.parent_id].push(c.id);
    }
  });
  _parentCats = Object.values(parentMap);

  // Brands
  _brands = brands;
  _brandMap = {};
  brands.forEach(b => { _brandMap[b.id] = b.name; });

  // Build brand aliases from DB names
  _brandAliases = { ...BRAND_KEYWORD_ALIASES };
  brands.forEach(b => {
    const norm = removeDiacritics(b.name).toLowerCase();
    if (!_brandAliases[norm]) _brandAliases[norm] = b.id;
  });

  _lastRefresh = Date.now();
  console.log(`[KnowledgeCache] ✅ Loaded ${categories.length} categories, ${brands.length} brands`);
}

async function ensureLoaded() {
  if (_categories.length > 0 && Date.now() - _lastRefresh < CACHE_TTL_MS) return;
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = _loadFromDB().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/** All categories (flat array) */
function getCategories() { return _categories; }

/** Map: categoryId → categoryName */
function getCategoryMap() { return _categoryMap; }

/** Parent categories with children */
function getParentCategories() { return _parentCats; }

/** Map: brandId → brandName */
function getBrandMap() { return _brandMap; }

/** All brands (flat array) */
function getBrands() { return _brands; }

/** Get child category IDs for a parent (or return [id] if already a child) */
function getChildCategoryIds(categoryId) {
  if (_parentToChildren[categoryId]) return _parentToChildren[categoryId];
  return [categoryId]; // Already a leaf
}

/** Get all category IDs for search (parent → expand to children, child → as-is) */
function expandCategoryIds(categoryId) {
  if (_parentToChildren[categoryId]) {
    return [categoryId, ..._parentToChildren[categoryId]];
  }
  const parentId = _childToParent[categoryId];
  return parentId ? [categoryId] : [categoryId];
}

/** Detect brand from text → brandId or null */
function detectBrand(text) {
  if (!text) return null;
  const norm = removeDiacritics(text).toLowerCase();

  // Try longest match first (e.g. "apple watch" before "apple")
  const sortedKeys = Object.keys(_brandAliases).sort((a, b) => b.length - a.length);
  for (const alias of sortedKeys) {
    if (norm.includes(alias)) return _brandAliases[alias];
  }
  return null;
}

/** Detect category from text → categoryId or null */
function detectCategory(text) {
  if (!text) return null;
  const norm = removeDiacritics(text).toLowerCase();

  // Try longest match first
  const sortedKeys = Object.keys(CATEGORY_KEYWORD_TO_ID).sort((a, b) => b.length - a.length);
  for (const kw of sortedKeys) {
    if (norm.includes(kw)) return CATEGORY_KEYWORD_TO_ID[kw];
  }
  return null;
}

/** Find categoryId by name (fuzzy match against DB categories) */
function findCategoryIdByName(catName) {
  if (!catName) return null;
  const norm = removeDiacritics(catName).toLowerCase();

  // First try CATEGORY_KEYWORD_TO_ID
  const kwMatch = CATEGORY_KEYWORD_TO_ID[norm];
  if (kwMatch) return kwMatch;

  // Then fuzzy match against DB names
  return _categories
    .map(c => ({
      c,
      score: removeDiacritics(c.name).toLowerCase() === norm ? 3
           : removeDiacritics(c.name).toLowerCase().includes(norm) ? 2
           : norm.includes(removeDiacritics(c.name).toLowerCase()) ? 1
           : 0,
    }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.c?.id || null;
}

/** Generate formatted category taxonomy for LLM prompts */
function getCategoryTaxonomyForPrompt() {
  if (_parentCats.length === 0) {
    return 'Chưa load categories';
  }
  return _parentCats.map(p => {
    const childNames = p.children.map(c => c.name).join(', ');
    return `• ${p.name}${childNames ? `: ${childNames}` : ''}`;
  }).join('\n');
}

/** Get brand names list for LLM prompts */
function getBrandNamesForPrompt() {
  return _brands.map(b => b.name).filter(n => n !== 'Khác').join(', ');
}

/** Force refresh cache */
async function refresh() {
  _lastRefresh = 0;
  return ensureLoaded();
}

// ─────────────────────────────────────────────────────────────────────────────
// SPEC KEYWORD ALIASES — Từ khóa specs tiếng Việt → field name chuẩn
// Dùng cho Search/Chatbot để detect khi user hỏi về specs cụ thể
// ─────────────────────────────────────────────────────────────────────────────
const SPEC_KEYWORD_ALIASES = {
  // Chống nước
  'chong nuoc': 'waterproof', 'khang nuoc': 'waterproof', 'ip67': 'waterproof',
  'ip68': 'waterproof', 'ipx4': 'waterproof', 'ipx5': 'waterproof',
  'ipx7': 'waterproof', 'waterproof': 'waterproof',

  // Sạc nhanh / Pin
  'sac nhanh': 'fast_charging', 'quick charge': 'fast_charging', 'pd': 'fast_charging',
  'magsafe': 'fast_charging', 'gan': 'fast_charging', 'qi': 'wireless_charging',
  'pin': 'battery', 'dung luong pin': 'battery', 'mah': 'battery',

  // Màn hình
  'man hinh': 'screen', 'amoled': 'screen', 'oled': 'screen', 'ips': 'screen',
  'retina': 'screen', '120hz': 'screen', '90hz': 'screen', '60hz': 'screen',
  'do phan giai': 'resolution', 'full hd': 'resolution', '4k': 'resolution',
  '2k': 'resolution', '1080p': 'resolution', '720p': 'resolution',

  // Chip / CPU
  'chip': 'chip', 'cpu': 'chip', 'vi xu ly': 'chip', 'bo xu ly': 'chip',
  'snapdragon': 'chip', 'exynos': 'chip', 'dimensity': 'chip',
  'apple silicon': 'chip', 'a18': 'chip', 'm1': 'chip', 'm2': 'chip',
  'm3': 'chip', 'm4': 'chip', 'm5': 'chip',

  // RAM / Bộ nhớ
  'ram': 'ram', 'bo nho': 'storage', 'rom': 'storage', 'dung luong': 'storage',
  'ssd': 'storage', 'hdd': 'storage', 'nvme': 'storage',

  // Camera
  'camera': 'camera', 'cam truoc': 'front_camera', 'cam sau': 'camera',
  'megapixel': 'camera', 'mp': 'camera', 'zoom': 'camera',

  // Kết nối
  '5g': 'connectivity', 'wifi': 'connectivity', 'bluetooth': 'connectivity',
  'nfc': 'connectivity', 'usb c': 'ports', 'type c': 'ports',
  'lightning': 'ports', 'hdmi': 'ports', 'thunderbolt': 'ports',

  // Âm thanh
  'chong on': 'feature', 'anc': 'feature', 'enc': 'feature',
  'noise cancel': 'feature', 'ldac': 'codec', 'aptx': 'codec',
  'hi-res': 'feature', 'dolby': 'feature',

  // Bàn phím / Chuột
  'switch': 'switch', 'hot swap': 'switch', 'dpi': 'dpi',
  'co': 'type', 'membrane': 'type',

  // GPU
  'card do hoa': 'gpu', 'vga': 'gpu', 'gpu': 'gpu',
  'rtx': 'gpu', 'gtx': 'gpu', 'radeon': 'gpu',

  // Thiết kế
  'trong luong': 'weight', 'khoi luong': 'weight', 'nhe': 'weight',
  'chat lieu': 'material', 'kim loai': 'material', 'nhua': 'material',
};

/**
 * Detect spec keyword trong text → trả field name chuẩn.
 * @param {string} text
 * @returns {string|null} — VD: 'waterproof', 'screen', 'ram'
 */
function detectSpecKeyword(text) {
  if (!text) return null;
  const norm = removeDiacritics(text).toLowerCase().trim();
  for (const [alias, field] of Object.entries(SPEC_KEYWORD_ALIASES)) {
    if (norm.includes(alias)) return field;
  }
  return null;
}

/**
 * Detect tất cả spec keywords trong text → trả mảng field names.
 */
function detectAllSpecKeywords(text) {
  if (!text) return [];
  const norm = removeDiacritics(text).toLowerCase().trim();
  const found = new Set();
  for (const [alias, field] of Object.entries(SPEC_KEYWORD_ALIASES)) {
    if (norm.includes(alias)) found.add(field);
  }
  return [...found];
}

module.exports = {
  ensureLoaded,
  getCategories,
  getCategoryMap,
  getParentCategories,
  getBrandMap,
  getBrands,
  getChildCategoryIds,
  expandCategoryIds,
  detectBrand,
  detectCategory,
  findCategoryIdByName,
  getCategoryTaxonomyForPrompt,
  getBrandNamesForPrompt,
  refresh,
  detectSpecKeyword,
  detectAllSpecKeywords,
  // Expose for direct use
  BRAND_KEYWORD_ALIASES,
  CATEGORY_KEYWORD_TO_ID,
  SPEC_KEYWORD_ALIASES,
};
