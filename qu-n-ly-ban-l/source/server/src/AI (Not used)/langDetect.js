/**
 * ============================================================
 * PHÁT HIỆN NGÔN NGỮ — LANGUAGE DETECTOR
 * langDetect.js — Getshopy Dual-Engine NLP
 * ============================================================
 *
 * @module langDetect
 * @description
 *   Phát hiện ngôn ngữ của tin nhắn người dùng dựa trên:
 *   [1] Tỉ lệ ký tự có dấu đặc trưng tiếng Việt
 *   [2] Từ khóa rõ ràng tiếng Anh (stopwords, modal verbs)
 *   [3] Fallback về 'vi' khi không xác định được
 *
 *   ZERO-DEPENDENCY — Không cần cài thêm bất kỳ thư viện nào.
 *
 * @author  Getshopy AI Team
 * @version 1.0.0
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// HẰNG SỐ CẤU HÌNH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ngưỡng tỉ lệ ký tự có dấu tiếng Việt để kết luận là VIETNAMESE.
 * Nếu tỉ lệ >= VIET_RATIO_THRESHOLD → 'vi'
 * @type {number}
 */
const VIET_RATIO_THRESHOLD = 0.06; // 6% ký tự có dấu → Tiếng Việt

/**
 * Số lượng từ tiếng Anh tối thiểu để kết luận là ENGLISH.
 * Ít nhất EN_WORD_MIN_COUNT từ English stopword phải xuất hiện.
 * @type {number}
 */
const EN_WORD_MIN_COUNT = 2;

// ─────────────────────────────────────────────────────────────────────────────
// BẢNG KÝ TỰ ĐẶC TRƯNG TIẾNG VIỆT
// Các nguyên âm/phụ âm có dấu chỉ xuất hiện trong Tiếng Việt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regex khớp các ký tự có dấu tiếng Việt.
 * Bao gồm: á à ả ã ạ ă ắ ặ â ấ ầ ể ề ê
 *           í ì ỉ ĩ ị ó ò ỏ õ ọ ô ố ồ ổ
 *           ú ù ủ ũ ụ ư ứ ừ ử ữ ự ý ỳ
 *           đ Đ và các biến thể hoa tương ứng
 * @type {RegExp}
 */
const VIET_CHAR_REGEX = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/g;

// ─────────────────────────────────────────────────────────────────────────────
// DANH SÁCH TỪ TIẾNG ANH PHỔ BIẾN
// Các từ này chỉ xuất hiện trong văn bản tiếng Anh thuần túy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tập từ tiếng Anh phổ biến để nhận diện.
 * Bao gồm: pronouns, modal verbs, question words, prepositions, common nouns
 * @type {Set<string>}
 */
const EN_WORD_SET = new Set([
  // Pronouns
  'i', 'you', 'he', 'she', 'we', 'they', 'it', 'me', 'him', 'her', 'us', 'them',
  // Modal verbs
  'can', 'could', 'will', 'would', 'should', 'shall', 'may', 'might', 'must',
  // Common verbs
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had', 'get', 'got',
  'want', 'need', 'like', 'look', 'know', 'think', 'buy', 'show', 'check',
  // Question words
  'what', 'where', 'when', 'how', 'why', 'which', 'who', 'whose',
  // Articles & Determiners
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'our', 'their',
  // Prepositions & Conjunctions
  'in', 'on', 'at', 'for', 'to', 'from', 'of', 'with', 'by', 'about',
  'and', 'or', 'but', 'if', 'not', 'so', 'as', 'than',
  // Common adjectives
  'good', 'best', 'better', 'great', 'new', 'cheap', 'expensive', 'fast',
  'nice', 'any', 'some', 'much', 'many', 'more', 'most',
  // E-commerce specific
  'price', 'cost', 'buy', 'order', 'ship', 'shipping', 'delivery', 'stock',
  'available', 'recommend', 'compare', 'specification', 'specs', 'review',
  'warranty', 'return', 'refund', 'payment', 'discount', 'sale', 'deal',
  'phone', 'laptop', 'headphone', 'tablet', 'watch', 'camera',
  'battery', 'charging', 'screen', 'display', 'memory', 'storage',
  'please', 'thanks', 'thank', 'hello', 'hi', 'hey', 'help',
]);

// ─────────────────────────────────────────────────────────────────────────────
// HÀM PHÁT HIỆN NGÔN NGỮ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Đếm số ký tự có dấu tiếng Việt trong chuỗi.
 *
 * @param {string} text
 * @returns {number}
 */
function countVietChars(text) {
  const matches = text.match(VIET_CHAR_REGEX);
  return matches ? matches.length : 0;
}

/**
 * Đếm số từ tiếng Anh phổ biến trong chuỗi.
 *
 * @param {string} text
 * @returns {number}
 */
function countEnWords(text) {
  const words = text.toLowerCase().split(/\s+/);
  return words.filter(w => EN_WORD_SET.has(w.replace(/[^a-z]/g, ''))).length;
}

/**
 * Phát hiện ngôn ngữ của tin nhắn.
 *
 * Thuật toán:
 * 1. Nếu text rỗng → trả về 'vi' (mặc định)
 * 2. Tính tỉ lệ ký tự tiếng Việt = vietChars / totalChars
 * 3. Nếu tỉ lệ >= VIET_RATIO_THRESHOLD → 'vi' (ngay cả khi có từ tiếng Anh lẫn vào)
 * 4. Nếu có >= EN_WORD_MIN_COUNT từ tiếng Anh rõ ràng → 'en'
 * 5. Fallback → 'vi'
 *
 * @param {string} message - Tin nhắn từ người dùng
 * @returns {'vi'|'en'} - Mã ngôn ngữ phát hiện được
 *
 * @example
 * detectLanguage("muốn mua điện thoại")  // → 'vi'
 * detectLanguage("want to buy iphone")   // → 'en'
 * detectLanguage("mua iphone 15 pro")    // → 'vi'  (không dấu nhưng cũng không có EN stopwords đủ)
 * detectLanguage("I want to buy a phone") // → 'en'
 * detectLanguage("hello xin chào")       // → 'vi'  (có ký tự tiếng Việt)
 */
function detectLanguage(message) {
  if (!message || typeof message !== 'string') return 'vi';

  const trimmed = message.trim();
  if (trimmed.length === 0) return 'vi';

  // ── BƯỚC 1: Kiểm tra ký tự tiếng Việt ──
  const totalChars = trimmed.replace(/\s/g, '').length;
  if (totalChars === 0) return 'vi';

  const vietChars  = countVietChars(trimmed);
  const vietRatio  = vietChars / totalChars;

  // Có dấu tiếng Việt → chắc chắn là tiếng Việt
  if (vietRatio >= VIET_RATIO_THRESHOLD) {
    return 'vi';
  }

  // ── BƯỚC 2: Kiểm tra từ tiếng Anh rõ ràng ──
  const enWordCount = countEnWords(trimmed);
  if (enWordCount >= EN_WORD_MIN_COUNT) {
    return 'en';
  }

  // ── BƯỚC 3: Fallback về tiếng Việt ──
  // Bao gồm: "mua iphone", "laptop gaming", "samsung s24" — không dấu
  // nhưng cũng không đủ từ tiếng Anh → an toàn hơn khi xử lý bằng engine Việt
  return 'vi';
}

/**
 * Phiên bản nâng cao: trả về thêm độ tin cậy (confidence).
 *
 * @param {string} message
 * @returns {{ lang: 'vi'|'en', confidence: 'high'|'medium'|'low', vietRatio: number, enWords: number }}
 *
 * @example
 * detectLanguageVerbose("I want to buy a laptop")
 * // → { lang: 'en', confidence: 'high', vietRatio: 0, enWords: 5 }
 */
function detectLanguageVerbose(message) {
  if (!message || typeof message !== 'string') {
    return { lang: 'vi', confidence: 'high', vietRatio: 0, enWords: 0 };
  }

  const trimmed   = message.trim();
  const totalChars = trimmed.replace(/\s/g, '').length || 1;
  const vietChars  = countVietChars(trimmed);
  const vietRatio  = vietChars / totalChars;
  const enWords    = countEnWords(trimmed);

  if (vietRatio >= VIET_RATIO_THRESHOLD) {
    const confidence = vietRatio >= 0.15 ? 'high' : 'medium';
    return { lang: 'vi', confidence, vietRatio: +vietRatio.toFixed(3), enWords };
  }

  if (enWords >= EN_WORD_MIN_COUNT) {
    const confidence = enWords >= 4 ? 'high' : 'medium';
    return { lang: 'en', confidence, vietRatio: +vietRatio.toFixed(3), enWords };
  }

  // Không chắc → low confidence, fallback vi
  return { lang: 'vi', confidence: 'low', vietRatio: +vietRatio.toFixed(3), enWords };
}

// ─────────────────────────────────────────────────────────────────────────────
// XUẤT MODULE
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  /**
   * Phát hiện ngôn ngữ chính (hàm chính)
   * @type {typeof detectLanguage}
   */
  detectLanguage,

  /**
   * Phát hiện ngôn ngữ với độ tin cậy (dùng cho debug/logging)
   * @type {typeof detectLanguageVerbose}
   */
  detectLanguageVerbose,

  /**
   * Đếm ký tự tiếng Việt (export để test)
   * @type {typeof countVietChars}
   */
  countVietChars,

  /**
   * Đếm từ tiếng Anh (export để test)
   * @type {typeof countEnWords}
   */
  countEnWords,

  // Hằng số để test/điều chỉnh từ bên ngoài
  VIET_RATIO_THRESHOLD,
  EN_WORD_MIN_COUNT,
};
