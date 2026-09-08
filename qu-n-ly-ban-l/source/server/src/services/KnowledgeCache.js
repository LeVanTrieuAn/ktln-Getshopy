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
const BRAND_KEYWORD_ALIASES = {
  // Apple
  'iphone': 'br-apple', 'macbook': 'br-apple', 'ipad': 'br-apple',
  'airpods': 'br-apple', 'apple watch': 'br-apple', 'apple': 'br-apple',
  'imac': 'br-apple', 'mac mini': 'br-apple', 'mac studio': 'br-apple',
  'mac pro': 'br-apple', 'homepod': 'br-apple', 'airtag': 'br-apple',

  // Samsung
  'samsung': 'br-samsung', 'galaxy': 'br-samsung', 'galaxy tab': 'br-samsung',
  'galaxy watch': 'br-samsung', 'galaxy buds': 'br-samsung', 'galaxy book': 'br-samsung',
  'galaxy fold': 'br-samsung', 'galaxy flip': 'br-samsung', 'galaxy s': 'br-samsung',
  'galaxy a': 'br-samsung', 'galaxy z': 'br-samsung',

  // Xiaomi
  'xiaomi': 'br-xiaomi', 'redmi': 'br-xiaomi', 'poco': 'br-xiaomi',
  'mi band': 'br-xiaomi', 'mi watch': 'br-xiaomi',

  // OPPO / realme / vivo / HONOR
  'oppo': 'br-oppo', 'reno': 'br-oppo', 'find x': 'br-oppo', 'find n': 'br-oppo',
  'realme': 'br-realme',
  'vivo': 'br-vivo',
  'honor': 'br-honor',

  // Laptop brands
  'acer': 'br-acer', 'aspire': 'br-acer', 'nitro': 'br-acer', 'predator': 'br-acer', 'swift': 'br-acer',
  'asus': 'br-asus', 'zenbook': 'br-asus', 'vivobook': 'br-asus', 'rog': 'br-asus', 'tuf': 'br-asus',
  'dell': 'br-dell', 'inspiron': 'br-dell', 'latitude': 'br-dell', 'xps': 'br-dell', 'alienware': 'br-dell', 'vostro': 'br-dell',
  'hp': 'br-hp', 'pavilion': 'br-hp', 'envy': 'br-hp', 'spectre': 'br-hp', 'omen': 'br-hp', 'victus': 'br-hp', 'elitebook': 'br-hp',
  'lenovo': 'br-lenovo', 'thinkpad': 'br-lenovo', 'ideapad': 'br-lenovo', 'yoga': 'br-lenovo', 'legion': 'br-lenovo', 'thinkbook': 'br-lenovo',
  'msi': 'br-msi', 'stealth': 'br-msi', 'raider': 'br-msi', 'katana': 'br-msi', 'cyborg': 'br-msi',
  'microsoft': 'br-microsoft', 'surface': 'br-microsoft',
  'machenike': 'br-machenike',

  // Smartwatch
  'amazfit': 'br-amazfit',
  'huawei': 'br-huawei', 'huawei watch': 'br-huawei', 'matepad': 'br-huawei',

  // Audio
  'jbl': 'br-jbl',
  'sony': 'br-sony', 'wh-1000xm': 'br-sony', 'wf-1000xm': 'br-sony', 'xm5': 'br-sony', 'xm4': 'br-sony',
  'marshall': 'br-marshall',
  'shokz': 'br-shokz', 'openrun': 'br-shokz',
  'boya': 'br-boya',
  'havit': 'br-havit',

  // Accessories
  'anker': 'br-anker', 'soundcore': 'br-anker',
  'baseus': 'br-baseus',
  'ugreen': 'br-ugreen',
  'xmobile': 'br-xmobile',
  'innostyle': 'br-innostyle',
  'orico': 'br-orico',
  'tomtoc': 'br-tomtoc',
  'tucano': 'br-tucano',

  // Gaming peripherals
  'razer': 'br-razer', 'deathadder': 'br-razer', 'blackwidow': 'br-razer', 'kraken': 'br-razer',
  'corsair': 'br-corsair',
  'logitech': 'br-logitech', 'mx master': 'br-logitech', 'mx keys': 'br-logitech', 'g pro': 'br-logitech',
  'akko': 'br-akko',
  'dareu': 'br-dareu',
  'rapoo': 'br-rapoo',

  // Camera / Security
  'dahua': 'br-dahua',
  'ezviz': 'br-ezviz',
  'imou': 'br-imou',
  'tiandy': 'br-tiandy',
  'insta360': 'br-insta360',

  // Storage
  'kingston': 'br-kingston',
  'sandisk': 'br-sandisk',
  'seagate': 'br-seagate',
  'kioxia': 'br-kioxia',
  'adata': 'br-adata',

  // Network
  'tp-link': 'br-tplink', 'tplink': 'br-tplink', 'tp link': 'br-tplink',
  'totolink': 'br-totolink',

  // Others
  'philips': 'br-philips',
  'motorola': 'br-motorola', 'moto': 'br-motorola',
  'singpc': 'br-singpc',
  'wacom': 'br-wacom',
  'wanbo': 'br-wanbo',
  'ulanzi': 'br-ulanzi',
  'jcpal': 'br-jcpal',
  'kidcare': 'br-kidcare',
  'hyperwork': 'br-hyperwork',
  'hyperspace': 'br-hyperspace',
  'hydrus': 'br-hydrus',
  'eroc': 'br-eroc',
  'alpha works': 'br-alpha-works',
  'ava+': 'br-avaplus', 'ava plus': 'br-avaplus',
  'hyundai audio': 'br-hyundai-audio', 'hyundai': 'br-hyundai-audio',
  'topo designs': 'br-topo-designs',
  'thonet vander': 'br-thonet-vander', 'thonet': 'br-thonet-vander',
};

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY KEYWORD → CATEGORY ID mapping (49 categories)
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_KEYWORD_TO_ID = {
  // ── Cấp 1 (cha) ──────────────────────────────────────────────
  'dien thoai': 'cat-phone', 'smartphone': 'cat-phone', 'phone': 'cat-phone', 'android': 'cat-phone', 'ios': 'cat-phone',
  'laptop': 'cat-laptop', 'may tinh xach tay': 'cat-laptop', 'notebook': 'cat-laptop',
  'tablet': 'cat-tablet', 'may tinh bang': 'cat-tablet',
  'smartwatch': 'cat-watch', 'dong ho thong minh': 'cat-watch', 'dong ho': 'cat-watch',

  // ── Phụ kiện di động (cat-mobile-acc) ─────────────────────────
  'sac du phong': 'cat-mobile-acc-powerbank', 'pin du phong': 'cat-mobile-acc-powerbank', 'powerbank': 'cat-mobile-acc-powerbank',
  'sac': 'cat-mobile-acc-charger', 'cap sac': 'cat-mobile-acc-charger', 'cu sac': 'cat-mobile-acc-charger', 'sac nhanh': 'cat-mobile-acc-charger', 'cap': 'cat-mobile-acc-charger',
  'op lung': 'cat-mobile-acc-case-phone', 'op lung dien thoai': 'cat-mobile-acc-case-phone', 'case': 'cat-mobile-acc-case-phone',
  'op lung may tinh bang': 'cat-mobile-acc-case-tablet', 'op lung tablet': 'cat-mobile-acc-case-tablet', 'bao da tablet': 'cat-mobile-acc-case-tablet',
  'mieng dan': 'cat-mobile-acc-screen', 'cuong luc': 'cat-mobile-acc-screen', 'kinh cuong luc': 'cat-mobile-acc-screen',
  'mieng dan camera': 'cat-mobile-acc-cam-cover',
  'tui dung airpods': 'cat-mobile-acc-airpods-case', 'case airpods': 'cat-mobile-acc-airpods-case',
  'quat mini': 'cat-mobile-acc-fan', 'quat cam tay': 'cat-mobile-acc-fan',
  'but tablet': 'cat-mobile-acc-pen', 'but cam ung': 'cat-mobile-acc-pen', 'apple pencil': 'cat-mobile-acc-pen',
  'gia do': 'cat-mobile-acc-stand', 'gia do dien thoai': 'cat-mobile-acc-stand', 'gia do laptop': 'cat-mobile-acc-stand', 'de dien thoai': 'cat-mobile-acc-stand',
  'day deo': 'cat-mobile-acc-strap', 'day deo dien thoai': 'cat-mobile-acc-strap',
  'ong kinh dien thoai': 'cat-mobile-acc-lens', 'lens dien thoai': 'cat-mobile-acc-lens',

  // ── Phụ kiện laptop, PC (cat-laptop-acc) ──────────────────────
  'hub': 'cat-laptop-acc-hub', 'cap chuyen doi': 'cat-laptop-acc-hub', 'dongle': 'cat-laptop-acc-hub', 'usb-c hub': 'cat-laptop-acc-hub', 'adapter': 'cat-laptop-acc-hub',
  'chuot': 'cat-laptop-acc-mouse', 'chuot may tinh': 'cat-laptop-acc-mouse', 'chuot khong day': 'cat-laptop-acc-mouse', 'mouse': 'cat-laptop-acc-mouse',
  'ban phim': 'cat-laptop-acc-keyboard', 'ban phim co': 'cat-laptop-acc-keyboard', 'keyboard': 'cat-laptop-acc-keyboard',
  'router': 'cat-laptop-acc-router', 'wifi': 'cat-laptop-acc-router', 'bo phat wifi': 'cat-laptop-acc-router', 'mesh': 'cat-laptop-acc-router', 'thiet bi mang': 'cat-laptop-acc-router',
  'balo': 'cat-laptop-acc-bag', 'tui chong soc': 'cat-laptop-acc-bag', 'balo laptop': 'cat-laptop-acc-bag', 'tui laptop': 'cat-laptop-acc-bag',
  'tui dung phu kien': 'cat-laptop-acc-pouch', 'tui phu kien': 'cat-laptop-acc-pouch',
  'phu phim': 'cat-laptop-acc-keyboard-cover', 'phu phim laptop': 'cat-laptop-acc-keyboard-cover',
  'phan mem': 'cat-laptop-acc-software', 'software': 'cat-laptop-acc-software', 'office': 'cat-laptop-acc-software', 'windows': 'cat-laptop-acc-software',
  'gia treo man hinh': 'cat-laptop-acc-monitor-stand', 'arm monitor': 'cat-laptop-acc-monitor-stand',
  'lot chuot': 'cat-laptop-acc-mousepad', 'mieng lot chuot': 'cat-laptop-acc-mousepad', 'mousepad': 'cat-laptop-acc-mousepad',
  'bang ve dien tu': 'cat-laptop-acc-drawing', 'bang ve': 'cat-laptop-acc-drawing',

  // ── Thiết bị nghe nhìn (cat-av) ──────────────────────────────
  'tai nghe bluetooth': 'cat-av-bt-earphone', 'tai nghe true wireless': 'cat-av-bt-earphone', 'tws': 'cat-av-bt-earphone', 'earbuds': 'cat-av-bt-earphone',
  'tai nghe day': 'cat-av-wire-earphone', 'tai nghe co day': 'cat-av-wire-earphone',
  'tai nghe chup tai': 'cat-av-headphone', 'headphone': 'cat-av-headphone', 'tai nghe over ear': 'cat-av-headphone', 'tai nghe chong on': 'cat-av-headphone',
  'tai nghe the thao': 'cat-av-sport-earphone', 'tai nghe chay bo': 'cat-av-sport-earphone',
  'tai nghe': 'cat-av-bt-earphone', // default → bluetooth
  'loa': 'cat-av-speaker', 'loa bluetooth': 'cat-av-speaker', 'loa di dong': 'cat-av-speaker', 'speaker': 'cat-av-speaker',
  'micro': 'cat-av-mic', 'mic': 'cat-av-mic', 'microphone': 'cat-av-mic', 'mic thu am': 'cat-av-mic',
  'may chieu': 'cat-av-projector', 'projector': 'cat-av-projector',
  'kinh thong minh': 'cat-av-smartglass', 'smart glass': 'cat-av-smartglass',
  'o cung': 'cat-av-hdd', 'hdd': 'cat-av-hdd', 'ssd': 'cat-av-hdd', 'o cung di dong': 'cat-av-hdd',
  'the nho': 'cat-av-sdcard', 'sd card': 'cat-av-sdcard', 'microsd': 'cat-av-sdcard', 'the nho 128gb': 'cat-av-sdcard',
  'usb': 'cat-av-usb', 'usb flash': 'cat-av-usb',

  // ── Camera (cat-camera) ──────────────────────────────────────
  'camera': 'cat-camera', 'camera giam sat': 'cat-cam-security',
  'camera trong nha': 'cat-cam-indoor', 'camera ngoai troi': 'cat-cam-outdoor',
  'camera nang luong mat troi': 'cat-cam-solar', 'camera solar': 'cat-cam-solar',
  'camera 4g': 'cat-cam-4g',
  'chuong cua camera': 'cat-cam-doorbell', 'chuong cua': 'cat-cam-doorbell',
  'webcam': 'cat-cam-webcam',
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
  // Expose for direct use
  BRAND_KEYWORD_ALIASES,
  CATEGORY_KEYWORD_TO_ID,
};
