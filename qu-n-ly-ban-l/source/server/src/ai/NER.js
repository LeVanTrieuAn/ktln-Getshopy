/**
 * NER — NAMED ENTITY RECOGNITION (Nhận dạng Thực thể)
 * =====================================================
 * @description
 *   Tự động "bóc tách" các thông số quan trọng từ câu của khách hàng.
 *   Sử dụng kỹ thuật Pattern Matching + Regular Expressions (CRF-inspired rules)
 *   để phát hiện chính xác các thực thể như:
 *
 *   INPUT: "Cho mình cái điện thoại màu đen, 256GB, tầm 10 củ, màn 6.7 inch"
 *   OUTPUT: {
 *     color:   "đen",
 *     storage: "256GB",
 *     budget:  10000000,
 *     display: "6.7 inch",
 *   }
 *
 *   Các thực thể được nhận dạng:
 *     - PRODUCT_NAME  : Tên thương hiệu/model (iPhone 15, MacBook Pro M3...)
 *     - BUDGET        : Ngân sách tiền (10 triệu, 5tr, 500k, 1.5 củ...)
 *     - STORAGE       : Dung lượng bộ nhớ (128GB, 256GB, 1TB...)
 *     - RAM           : RAM (8GB, 12GB, 16GB...)
 *     - COLOR         : Màu sắc (đen, trắng, xanh, vàng...)
 *     - DISPLAY_SIZE  : Kích thước màn hình (6.1 inch, 14 inch...)
 *     - REFRESH_RATE  : Tần số quét (120Hz, 144Hz...)
 *     - BATTERY       : Pin (5000mAh, 4500mAh...)
 *     - CATEGORY      : Loại sản phẩm (điện thoại, laptop, tablet...)
 *
 * @author Getshopy AI Team
 */

'use strict';

const { removeDiacritics } = require('../routes/aiHandlers');

// ─────────────────────────────────────────────────────────────────────────────
// DANH SÁCH THỰC THỂ (ENTITY DICTIONARIES)
// ─────────────────────────────────────────────────────────────────────────────

/** Màu sắc phổ biến (có dấu + không dấu) */
const COLORS = [
  'đen', 'trắng', 'xanh', 'xanh lá', 'xanh dương', 'xanh navy', 'xanh mint',
  'đỏ', 'vàng', 'hồng', 'tím', 'cam', 'nâu', 'bạc', 'xám', 'vàng đồng',
  'titan', 'titan đen', 'titan tự nhiên', 'titan vàng', 'titan trắng',
  'gold', 'silver', 'black', 'white', 'blue', 'red', 'pink', 'purple',
  'green', 'starlight', 'midnight', 'alpine', 'coral', 'lavender',
];

/** Danh mục sản phẩm phổ biến */
const CATEGORIES = [
  { pattern: /(dien thoai|smartphone|phone|iphone|galaxy|pixel)/i, label: 'Điện thoại thông minh' },
  { pattern: /(laptop|may tinh xach tay|notebook|macbook)/i,        label: 'Máy tính xách tay' },
  { pattern: /(tablet|may tinh bang|ipad)/i,                        label: 'Máy tính bảng' },
  { pattern: /(tai nghe|headphone|earphone|earbuds|airpods)/i,      label: 'Tai nghe' },
  { pattern: /(dong ho|smartwatch|apple watch|galaxy watch)/i,      label: 'Đồng hồ thông minh' },
  { pattern: /(loa|speaker)/i,                                       label: 'Loa' },
  { pattern: /(micro|microphone)/i,                                  label: 'Microphone' },
];

// ─────────────────────────────────────────────────────────────────────────────
// CLASS NER
// ─────────────────────────────────────────────────────────────────────────────

class NER {
  constructor() {
    /** Cache kết quả để tránh parse lại */
    this._cache = new Map();
  }

  /**
   * Phân tích câu và trích xuất tất cả thực thể.
   * Đây là hàm chính — gọi hàm này để lấy mọi thực thể trong một lần.
   *
   * @param {string} message - Câu của khách hàng
   * @returns {NERResult}    - Object chứa tất cả thực thể đã bóc tách
   *
   * @typedef {Object} NERResult
   * @property {string|null}  productName  - Tên sản phẩm/thương hiệu
   * @property {number|null}  budget       - Ngân sách (VND)
   * @property {string|null}  budgetRaw    - Ngân sách dạng gốc ("10 triệu")
   * @property {string|null}  storage      - Dung lượng ("256GB")
   * @property {string|null}  ram          - RAM ("8GB")
   * @property {string|null}  color        - Màu sắc ("đen")
   * @property {string|null}  displaySize  - Màn hình ("6.7 inch")
   * @property {number|null}  refreshRate  - Tần số quét (Hz)
   * @property {number|null}  battery      - Pin (mAh)
   * @property {string|null}  category     - Danh mục sản phẩm
   */
  extract(message) {
    if (!message) return this._emptyResult();
    if (this._cache.has(message)) return this._cache.get(message);

    const normalized = removeDiacritics(message).toLowerCase();

    const result = {
      productName:  this._extractProductName(message, normalized),
      budget:       null,
      budgetRaw:    null,
      storage:      this._extractStorage(normalized),
      ram:          this._extractRAM(normalized),
      color:        this._extractColor(message),
      displaySize:  this._extractDisplaySize(normalized),
      refreshRate:  this._extractRefreshRate(normalized),
      battery:      this._extractBattery(normalized),
      category:     this._extractCategory(normalized),
    };

    // Budget trả về cả amount và raw string
    const budgetResult = this._extractBudget(message, normalized);
    if (budgetResult) {
      result.budget    = budgetResult.amount;
      result.budgetRaw = budgetResult.raw;
    }

    // Log nếu có thực thể nào được bóc tách
    const found = Object.entries(result).filter(([, v]) => v !== null).map(([k]) => k);
    if (found.length > 0) {
      console.log(`[NER] Đã bóc tách từ "${message.slice(0, 60)}": ${found.join(', ')}`);
    }

    // Cache
    if (this._cache.size > 300) this._cache.clear();
    this._cache.set(message, result);
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────
  // CÁC HÀM TRÍCH XUẤT TỪNG LOẠI THỰC THỂ
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Trích xuất tên thương hiệu / model sản phẩm.
   * Ưu tiên model đầy đủ hơn chỉ tên brand.
   */
  _extractProductName(original, normalized) {
    // Các pattern theo thứ tự độ cụ thể (cụ thể nhất trước)
    const patterns = [
      // Apple products (full model)
      /\b(iphone\s*\d{1,2}\s*(?:pro\s*max|pro|plus|mini)?)\b/i,
      /\b(macbook\s*(?:air|pro)\s*(?:m[1-4]|[\d"]+(?:\s*inch)?)?)\b/i,
      /\b(ipad\s*(?:pro|air|mini)?\s*(?:[\d]+\s*(?:gen|inch))?)\b/i,
      /\b(airpods\s*(?:pro|max)?\s*(?:[\d]+)?)\b/i,
      /\b(apple\s*watch\s*(?:ultra|series)?\s*(?:[\d]+)?)\b/i,
      // Samsung
      /\b(galaxy\s*(?:s|a|z|m|f|note|fold|flip)\s*\d+\s*(?:ultra|plus|fe|5g)?)\b/i,
      /\b(samsung\s*galaxy\s*[\w\s]+)\b/i,
      // Google Pixel
      /\b(pixel\s*\d+\s*(?:pro|xl|fold|a)?)\b/i,
      // Laptop brands
      /\b(asus\s*(?:rog|tuf|zenbook|vivobook)\s*[\w\s\d-]+)\b/i,
      /\b(dell\s*(?:xps|inspiron|latitude|alienware)\s*[\d-]+)\b/i,
      /\b(lenovo\s*(?:thinkpad|legion|ideapad)\s*[\w\d\s-]+)\b/i,
      // Generic brand detection
      /\b(xiaomi|redmi|oppo|vivo|realme|honor|huawei|oneplus)\s*[\w\d\s]+\b/i,
    ];

    for (const pattern of patterns) {
      const match = normalized.match(pattern) || original.toLowerCase().match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  }

  /**
   * Trích xuất ngân sách — nhận diện đa dạng cách viết tiếng Việt.
   * VD: "10 triệu", "5tr", "1.5 củ", "500k", "500 nghìn"
   */
  _extractBudget(original, normalized) {
    // Pattern normalize không dấu
    const pattern = /(\d+(?:[,.]\d+)?)\s*(trieu|tr|cu|k|nghin|ngan)/i;
    const match = normalized.match(pattern);
    if (!match) return null;

    const num  = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toLowerCase();

    let amount;
    if (unit === 'k' || unit === 'nghin' || unit === 'ngan') {
      amount = num * 1_000;
    } else {
      amount = num * 1_000_000;
    }

    return { amount, raw: match[0] };
  }

  /**
   * Trích xuất dung lượng bộ nhớ.
   * VD: "256GB", "512 GB", "1TB", "128 gb"
   */
  _extractStorage(normalized) {
    const match = normalized.match(/(\d+)\s*(gb|tb|mb)(?!\s*ram)/i);
    if (!match) return null;
    const unit = match[2].toUpperCase();
    return `${match[1]}${unit}`;
  }

  /**
   * Trích xuất dung lượng RAM.
   * VD: "8GB RAM", "12 gb ram", "16GB"
   */
  _extractRAM(normalized) {
    // Ưu tiên pattern có từ "ram" đi kèm
    let match = normalized.match(/(\d+)\s*gb\s*ram/i) || normalized.match(/ram\s*(\d+)\s*gb/i);
    if (match) return `${match[1]}GB`;
    // Fallback: số + GB đứng độc lập (cẩn thận tránh nhầm với storage)
    match = normalized.match(/\b(\d+)\s*gb\b/i);
    if (match && [4, 6, 8, 12, 16, 24, 32].includes(parseInt(match[1]))) {
      return `${match[1]}GB`;
    }
    return null;
  }

  /**
   * Trích xuất màu sắc — hỗ trợ cả tiếng Việt có dấu.
   */
  _extractColor(original) {
    const lower = original.toLowerCase();
    // Sắp xếp từ dài nhất đến ngắn nhất để match "xanh lá" trước "xanh"
    const sorted = [...COLORS].sort((a, b) => b.length - a.length);
    for (const color of sorted) {
      if (lower.includes(color)) return color;
    }
    return null;
  }

  /**
   * Trích xuất kích thước màn hình.
   * VD: "6.7 inch", "14inch", "15.6\""
   */
  _extractDisplaySize(normalized) {
    const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:inch|")/i);
    return match ? `${match[1]} inch` : null;
  }

  /**
   * Trích xuất tần số quét màn hình.
   * VD: "120hz", "144 Hz", "165Hz"
   */
  _extractRefreshRate(normalized) {
    const match = normalized.match(/(\d{2,3})\s*hz/i);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Trích xuất dung lượng pin.
   * VD: "5000mah", "4500 mAh"
   */
  _extractBattery(normalized) {
    const match = normalized.match(/(\d{3,5})\s*mah/i);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Trích xuất danh mục sản phẩm từ câu.
   */
  _extractCategory(normalized) {
    for (const { pattern, label } of CATEGORIES) {
      if (pattern.test(normalized)) return label;
    }
    return null;
  }

  /** @returns {NERResult} - Object rỗng */
  _emptyResult() {
    return {
      productName: null, budget: null, budgetRaw: null,
      storage: null, ram: null, color: null, displaySize: null,
      refreshRate: null, battery: null, category: null,
    };
  }

  /**
   * Tóm tắt entities thành string để debug hoặc dùng trong prompt.
   * @param {NERResult} entities
   * @returns {string}
   */
  summarize(entities) {
    const parts = [];
    if (entities.productName) parts.push(`Sản phẩm: ${entities.productName}`);
    if (entities.category)    parts.push(`Loại: ${entities.category}`);
    if (entities.budgetRaw)   parts.push(`Ngân sách: ${entities.budgetRaw}`);
    if (entities.color)       parts.push(`Màu: ${entities.color}`);
    if (entities.storage)     parts.push(`Bộ nhớ: ${entities.storage}`);
    if (entities.ram)         parts.push(`RAM: ${entities.ram}`);
    if (entities.displaySize) parts.push(`Màn hình: ${entities.displaySize}`);
    if (entities.refreshRate) parts.push(`Tần số: ${entities.refreshRate}Hz`);
    if (entities.battery)     parts.push(`Pin: ${entities.battery}mAh`);
    return parts.join(' | ') || '(không có thực thể nào)';
  }
}

/** Singleton instance */
const nerInstance = new NER();
module.exports = NER;
module.exports.ner = nerInstance;
