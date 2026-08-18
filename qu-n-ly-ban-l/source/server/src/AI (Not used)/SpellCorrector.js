/**
 * SPELL CORRECTOR — Levenshtein Distance (Khoảng cách chỉnh sửa)
 * ==============================================================
 * @description
 *   Tự động sửa lỗi chính tả trong input của khách hàng trước khi
 *   đưa vào pipeline phân loại Intent và query Database.
 *
 *   Thuật toán Levenshtein Distance đo số thao tác tối thiểu cần thực hiện
 *   (thêm, xóa, thay thế ký tự) để biến chuỗi A thành chuỗi B.
 *
 *   Ví dụ:
 *     "macbok pr"   → dist("macbok", "macbook") = 1  → sửa thành "macbook pro"
 *     "samsug"      → dist("samsug", "samsung") = 1  → sửa thành "samsung"
 *     "ipone 15"    → dist("ipone", "iphone") = 1    → sửa thành "iphone 15"
 *
 *   Ngưỡng sửa:
 *     - Từ ≤ 4 ký tự: chỉ sửa nếu distance = 1 (tránh sửa nhầm từ ngắn)
 *     - Từ 5-8 ký tự: sửa nếu distance ≤ 2
 *     - Từ > 8 ký tự: sửa nếu distance ≤ 3
 *
 * @uses natural.LevenshteinDistance
 * @author Getshopy AI Team
 */

'use strict';

const natural = require('natural');

/**
 * Danh sách từ khóa đúng chính tả thường gặp trong ngữ cảnh bán lẻ điện tử.
 * Đây là "từ điển" để SpellCorrector so sánh và gợi ý sửa.
 * Các từ được chuẩn hóa về chữ thường, không dấu (để match tiếng Việt gõ tắt).
 *
 * @type {string[]}
 */
const PRODUCT_DICTIONARY = [
  // Thương hiệu điện thoại
  'iphone', 'samsung', 'xiaomi', 'redmi', 'oppo', 'vivo', 'realme',
  'google', 'pixel', 'huawei', 'honor', 'nokia', 'motorola', 'oneplus',
  // Dòng sản phẩm Apple
  'macbook', 'macbookair', 'macbookpro', 'ipad', 'ipod', 'airpods', 'airpodspro',
  'applewatch', 'imac', 'macmini', 'macpro',
  // Dòng sản phẩm Samsung
  'galaxy', 'galaxys', 'galaxya', 'galaxyz', 'galaxyfold', 'galaxyflip', 'galaxywatch',
  // Laptop
  'laptop', 'dell', 'asus', 'acer', 'lenovo', 'thinkpad', 'hp', 'msi', 'surface',
  'xps', 'razer', 'gigabyte', 'aorus',
  // Phụ kiện
  'airpod', 'earbuds', 'headphone', 'earphone', 'smartwatch', 'charger',
  'bluetooth', 'wireless', 'speaker', 'microphone',
  // Từ kỹ thuật phổ biến
  'pro', 'max', 'ultra', 'plus', 'mini', 'lite', 'air', 'note',
  'android', 'ios', 'windows', 'macos',
  'ssd', 'nvme', 'ram', 'rom', 'cpu', 'gpu', 'chip',
  'amoled', 'oled', 'ips', 'lcd', 'qhd', 'fullhd',
];

class SpellCorrector {
  constructor(customDictionary = []) {
    /**
     * Từ điển kết hợp: PRODUCT_DICTIONARY + custom (thường là tên sản phẩm từ DB)
     * @type {string[]}
     */
    this.dictionary = [...new Set([...PRODUCT_DICTIONARY, ...customDictionary.map(w => w.toLowerCase())])];
    /**
     * Cache kết quả đã sửa để tránh tính lại với input giống nhau
     * @type {Map<string, string>}
     */
    this._cache = new Map();
  }

  /**
   * Mở rộng từ điển với danh sách tên sản phẩm từ Database.
   * Nên gọi sau khi load DB để correction chính xác hơn.
   *
   * @param {string[]} productNames - Danh sách tên sản phẩm
   */
  addProductNames(productNames) {
    productNames.forEach(name => {
      // Tách từng từ trong tên sản phẩm và thêm vào dictionary
      name.toLowerCase().split(/\s+/).forEach(word => {
        if (word.length >= 3 && !this.dictionary.includes(word)) {
          this.dictionary.push(word);
        }
      });
    });
    // Xóa cache vì dictionary đã thay đổi
    this._cache.clear();
  }

  /**
   * Tính ngưỡng chấp nhận sửa chính tả dựa trên độ dài từ.
   * Từ ngắn thì ngưỡng thấp hơn để tránh sửa nhầm.
   *
   * @param {number} wordLength
   * @returns {number} - Khoảng cách Levenshtein tối đa chấp nhận
   */
  _getThreshold(wordLength) {
    if (wordLength <= 4) return 1;
    if (wordLength <= 8) return 2;
    return 3;
  }

  /**
   * Tìm từ gần nhất trong dictionary cho một từ đầu vào.
   * Trả về từ gốc nếu không cần sửa (distance = 0) hoặc không tìm được gợi ý tốt.
   *
   * @param {string} word - Từ cần kiểm tra
   * @returns {{ corrected: string, distance: number, changed: boolean }}
   */
  correctWord(word) {
    const lower = word.toLowerCase();

    // Đã có trong dictionary → không cần sửa
    if (this.dictionary.includes(lower)) {
      return { corrected: word, distance: 0, changed: false };
    }

    const threshold = this._getThreshold(lower.length);
    let bestWord   = lower;
    let bestDist   = Infinity;

    for (const dictWord of this.dictionary) {
      // Bỏ qua nếu độ dài chênh lệch quá nhiều (tối ưu hiệu năng)
      if (Math.abs(dictWord.length - lower.length) > threshold) continue;

      const dist = natural.LevenshteinDistance(lower, dictWord);
      if (dist < bestDist) {
        bestDist = dist;
        bestWord = dictWord;
        if (dist === 0) break; // Tìm thấy exact match
      }
    }

    const changed = bestDist > 0 && bestDist <= threshold;
    return {
      corrected: changed ? bestWord : word,
      distance:  bestDist,
      changed,
    };
  }

  /**
   * Sửa lỗi chính tả cho toàn bộ câu đầu vào.
   * Chỉ sửa những từ nằm trong vocabulary kỹ thuật (tránh sửa nhầm tiếng Việt thường).
   *
   * @example
   *   corrector.correctSentence('cho hỏi giá macbok pro m3 bao nhieu')
   *   // → { corrected: 'cho hỏi giá macbook pro m3 bao nhieu', corrections: [{...}] }
   *
   * @param {string} sentence - Câu đầu vào
   * @returns {{ corrected: string, corrections: Array<{original, fixed, distance}>, changed: boolean }}
   */
  correctSentence(sentence) {
    if (!sentence || typeof sentence !== 'string') {
      return { corrected: sentence, corrections: [], changed: false };
    }

    // Check cache
    if (this._cache.has(sentence)) {
      return this._cache.get(sentence);
    }

    const words = sentence.split(/(\s+)/); // giữ lại khoảng trắng
    const corrections = [];
    let overallChanged = false;

    const correctedWords = words.map(token => {
      // Bỏ qua khoảng trắng và ký tự đặc biệt ngắn
      if (/^\s+$/.test(token) || token.length < 3) return token;

      const result = this.correctWord(token);
      if (result.changed) {
        corrections.push({
          original: token,
          fixed:    result.corrected,
          distance: result.distance,
        });
        overallChanged = true;
        return result.corrected;
      }
      return token;
    });

    const output = {
      corrected:   correctedWords.join(''),
      corrections,
      changed:     overallChanged,
    };

    // Cache kết quả (giới hạn 500 entries để tránh memory leak)
    if (this._cache.size > 500) this._cache.clear();
    this._cache.set(sentence, output);

    if (overallChanged) {
      console.log(`[SpellCorrector] "${sentence}" → "${output.corrected}"`,
        corrections.map(c => `(${c.original}→${c.fixed}, d=${c.distance})`).join(', '));
    }

    return output;
  }
}

/** Singleton instance */
let _instance = null;

/**
 * Lấy singleton SpellCorrector.
 * @param {string[]} [initialDict=[]] - Từ điển bổ sung (tên sản phẩm từ DB)
 * @returns {SpellCorrector}
 */
function getSpellCorrector(initialDict = []) {
  if (!_instance) _instance = new SpellCorrector(initialDict);
  return _instance;
}

module.exports = SpellCorrector;
module.exports.getSpellCorrector = getSpellCorrector;
