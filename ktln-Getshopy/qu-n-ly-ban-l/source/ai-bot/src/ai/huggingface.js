/**
 * ============================================================
 * HUGGING FACE INFERENCE API — NLP ENGINE
 * huggingface.js — Getshopy AI Chatbot Engine v3.0
 * ============================================================
 *
 * Module này thay thế toàn bộ pipeline NLP tự viết cũ
 * (NaiveBayes, LogisticRegression, LinearSVM, EnsembleClassifier)
 * bằng cách gọi Hugging Face Inference API.
 *
 * Model hiện tại: Zero-shot classification (multilingual)
 * Kế hoạch: Fine-tune với trainingData của Getshopy và host
 *            model riêng trên Hugging Face Hub → gọi lại qua API.
 *
 * @module huggingface
 * @version 3.0.0
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// INTENT LABELS — Danh sách tất cả Intent mà Chatbot có thể phân loại
// Thứ tự không quan trọng, model zero-shot sẽ tự so sánh
// ─────────────────────────────────────────────────────────────────────────────
const INTENT_LABELS = [
  'GREETING',           // Chào hỏi
  'HELP',               // Hỏi trợ giúp / tôi là ai
  'SEARCH_PRODUCT',     // Tìm kiếm sản phẩm cụ thể
  'SEARCH_CATEGORY',    // Tìm theo danh mục (tai nghe, laptop...)
  'ASK_PRICE',          // Hỏi giá sản phẩm
  'ASK_SPECS',          // Hỏi cấu hình, thông số kỹ thuật
  'ASK_ACCESSORIES',    // Hỏi phụ kiện đi kèm
  'ASK_PROMO',          // Hỏi khuyến mãi, flash sale
  'ASK_DELIVERY',       // Hỏi giao hàng, vận chuyển
  'ASK_RETURN',         // Hỏi đổi trả, bảo hành
  'ASK_PAYMENT',        // Hỏi phương thức thanh toán
  'ASK_REVIEW',         // Hỏi đánh giá sản phẩm
  'ASK_RECOMMEND',      // Nhờ gợi ý, tư vấn sản phẩm
  'ASK_BEST_SELLER',    // Hỏi sản phẩm bán chạy nhất
  'ASK_NEW_ARRIVAL',    // Hỏi hàng mới về
  'ASK_PREORDER',       // Hỏi đặt trước, pre-order
  'ASK_GIFT',           // Hỏi quà tặng kèm
  'ASK_GIFT_WRAP',      // Hỏi gói quà, bao bì đặc biệt
  'ASK_LOYALTY',        // Hỏi tích điểm, thành viên
  'ASK_INVOICE',        // Hỏi hóa đơn VAT
  'ASK_SECOND_HAND',    // Hỏi hàng cũ, refurbished
  'ASK_AUTHENTIC',      // Hỏi hàng chính hãng, nguồn gốc
  'ASK_TRADE_IN',       // Hỏi thu cũ đổi mới
  'ASK_REPAIR',         // Hỏi sửa chữa, bảo hành
  'ASK_CAMERA',         // Hỏi về camera
  'ASK_BATTERY',        // Hỏi về pin, sạc
  'ASK_DISPLAY',        // Hỏi về màn hình
  'ASK_STORAGE',        // Hỏi về bộ nhớ, RAM
  'ASK_CONNECTIVITY',   // Hỏi về kết nối (5G, WiFi, Bluetooth)
  'ASK_GAMING',         // Hỏi về gaming
  'ASK_WATERPROOF',     // Hỏi về khả năng chống nước
  'ASK_OS',             // Hỏi về hệ điều hành
  'ASK_DESIGN',         // Hỏi về thiết kế, màu sắc
  'ASK_COMPATIBILITY',  // Hỏi về tương thích phụ kiện
  'COMPARE_PRODUCT',    // So sánh sản phẩm
  'COMPARE_SPECS',      // So sánh thông số kỹ thuật
  'COMPARE_ACCESSORIES',// So sánh biến thể / phụ kiện
  'CHECK_STOCK',        // Kiểm tra tồn kho
  'TRACK_ORDER',        // Theo dõi đơn hàng
  'CANCEL_ORDER',       // Hủy đơn hàng
  'CHANGE_PRODUCT',     // Đổi sản phẩm khác
  'PRICE_COMPLAINT',    // Phàn nàn giá cao, mặc cả
  'COMPLAINT',          // Khiếu nại, phàn nàn chung
  'FEEDBACK_POSITIVE',  // Phản hồi tích cực, khen ngợi
  'BULK_ORDER',         // Mua số lượng lớn, sỉ
  'URGENT_NEED',        // Cần hàng gấp
  'CONTACT',            // Hỏi thông tin liên hệ, địa chỉ
  'SMALLTALK',          // Trò chuyện thông thường
  'UNKNOWN',            // Không hiểu / ngoài phạm vi
];

// ─────────────────────────────────────────────────────────────────────────────
// MODEL CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Model mặc định cho zero-shot classification.
 * Hỗ trợ đa ngôn ngữ bao gồm tiếng Việt.
 * 
 * Kế hoạch future: Thay bằng model fine-tuned của Getshopy
 * sau khi training hoàn tất trên Hugging Face Hub.
 * Ví dụ: 'your-hf-username/getshopy-intent-classifier'
 */
const DEFAULT_MODEL = process.env.HF_MODEL || 'MoritzLaurer/mDeBERTa-v3-base-mnli-xnli';

/** Confidence threshold — Dưới ngưỡng này → fallback UNKNOWN */
const CONFIDENCE_THRESHOLD = parseFloat(process.env.HF_CONFIDENCE_THRESHOLD || '0.35');

// ─────────────────────────────────────────────────────────────────────────────
// RULE-BASED PRE-CLASSIFIER (Xử lý trước khi gọi API)
// Các pattern đơn giản, chắc chắn — không cần gọi API tốn thời gian
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loại bỏ dấu tiếng Việt để chuẩn hóa so sánh.
 * @param {string} str
 * @returns {string}
 */
function removeDiacritics(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Pre-classify các pattern đơn giản và rõ ràng.
 * Trả về intent ngay mà không cần gọi Hugging Face API.
 * Bao phủ ~95% câu hỏi phổ biến của khách hàng điện tử Việt Nam.
 *
 * @param {string} message - Tin nhắn gốc
 * @returns {{ intent: string, score: number, source: string } | null}
 */
function preClassify(message) {
  const norm = removeDiacritics(message).toLowerCase().trim();

  // ── Greeting ──────────────────────────────────────────────────────────────
  if (/^(xin chao|hello|hi|hey|alo|chao|chao ban|chao shop|shop oi|em oi|co ai khong|alo shop|good morning|good evening|chao em|ban oi)[!.,?\s]*$/i.test(norm)) {
    return { intent: 'GREETING', score: 1.0, source: 'rule' };
  }

  // ── Tìm theo ngân sách / danh mục + giá ──────────────────────────────────
  // "điện thoại dưới 15 triệu", "laptop tầm 20 triệu", "tai nghe khoảng 500k"
  if (/(dien thoai|smartphone|iphone|samsung|xiaomi|oppo|vivo|realme|laptop|may tinh|tai nghe|dong ho|may tinh bang|tablet|airpods|loa)/.test(norm) &&
      /(duoi|tam|khoang|tu|den|gia|trieu|k\b|nghin|budget|bao nhieu)/.test(norm)) {
    return { intent: 'SEARCH_PRODUCT', score: 0.92, source: 'rule' };
  }

  // ── Mua / tìm sản phẩm trực tiếp (KHÔNG cần từ "không" hay giá) ───────────
  // "tôi muốn mua iphone", "mua samsung s24", "cần mua laptop", "tìm mua airpods"
  if (/(muon mua|can mua|tim mua|mua ngay|mua|order|dat mua|chot mua|cho minh xem).{0,30}(iphone|samsung|xiaomi|oppo|vivo|realme|laptop|may tinh|tai nghe|airpods|android|ios|dien thoai|smartphone|tablet|dong ho|loa)/.test(norm) ||
      /(iphone|samsung|xiaomi|oppo|vivo|realme|laptop|may tinh|tai nghe|airpods|dien thoai).{0,30}(muon mua|can mua|tim mua|mua ngay|mua)/.test(norm)) {
    return { intent: 'SEARCH_PRODUCT', score: 0.92, source: 'rule' };
  }

  // ── "tìm X" standalone — fix: .{0,40} thay vì .{2,40} để bắt "tìm iPhone" (1 space) ─
  if (/^tim\s+(iphone|samsung|xiaomi|oppo|vivo|realme|laptop|may tinh|tai nghe|airpods|dien thoai|smartphone|tablet|dong ho|loa|apple|sony|logitech|anker|dell|hp|asus|lenovo)/.test(norm) ||
      /(tim|can mua|muon mua|dang can|can tim|cho minh|ban co|shop co|shop ban|cho xem|minh xem).{0,40}(khong|duoc khong|ko|k\b|iphone|samsung|dien thoai|laptop|may tinh|tai nghe|airpods|tablet|dong ho|smartphone)/.test(norm)) {
    return { intent: 'SEARCH_PRODUCT', score: 0.88, source: 'rule' };
  }

  // ── Giao hàng (phải đặt TRƯỚC giá — "giao hang" chứa chữ "gia" nếu check sau) ─────────
  if (/(giao hang|ship|van chuyen|free ship|phi ship|delivery|shipping|bao lau giao|bao lau|khi nao nhan|nhan hang|giao nhanh|giao hom nay|express|hoa toc)/.test(norm)) {
    return { intent: 'ASK_DELIVERY', score: 0.92, source: 'rule' };
  }

  // ── Hỏi giá cụ thể (dùng \b để tránh match "gia" trong "giao") ─────────────────
  if (/(bao nhieu tien|bao nhieu|cost|price|how much)/.test(norm) ||
      /\bgia\b/.test(norm)) {
    return { intent: 'ASK_PRICE', score: 0.88, source: 'rule' };
  }

  // ── Gợi ý / Tư vấn ────────────────────────────────────────────────────────
  if (/(tu van|goi y|nen mua|mua gi|chon gi|recommend|suggest|gioi thieu|ban nghi|chon con nao|con nao tot|nen chon|may nao tot|may nao phu hop)/.test(norm)) {
    return { intent: 'ASK_RECOMMEND', score: 0.90, source: 'rule' };
  }

  // ── So sánh sản phẩm ──────────────────────────────────────────────────────
  if (/(so sanh|khac nhau|khac gi|hay la|vs\b|versus|con nao hon|cai nao hon|between|hay|hoac)/.test(norm) &&
      /(dien thoai|laptop|may tinh|iphone|samsung|tai nghe|may tinh bang|may anh)/.test(norm)) {
    return { intent: 'COMPARE_PRODUCT', score: 0.90, source: 'rule' };
  }

  // ── Hàng bán chạy / mới nhất ──────────────────────────────────────────────
  if (/(ban chay|pho bien|hot nhat|ban nhieu|bestseller|best seller|nhieu nguoi mua|moi nhat|moi ve|hang moi|san pham moi|new arrival|vua ra|moi ra mat)/.test(norm)) {
    if (/moi|new|vua ra|moi ra/.test(norm)) return { intent: 'ASK_NEW_ARRIVAL', score: 0.90, source: 'rule' };
    return { intent: 'ASK_BEST_SELLER', score: 0.90, source: 'rule' };
  }

  // ── Kiểm tra tồn kho ──────────────────────────────────────────────────────
  if (/(con hang|con khong|con may cai|het hang|out of stock|in stock|ton kho|con san pham|con do khong|available)/.test(norm)) {
    return { intent: 'CHECK_STOCK', score: 0.92, source: 'rule' };
  }

  // ── Theo dõi đơn hàng ─────────────────────────────────────────────────────
  if (/(don hang|tra hang|kiem tra don|trang thai don|order cua|theo doi don|don cua toi|don cua minh|track order|where is my order)/.test(norm)) {
    return { intent: 'TRACK_ORDER', score: 0.95, source: 'rule' };
  }

  // ── Hủy đơn ───────────────────────────────────────────────────────────────
  if (/huy don|cancel order|khong muon mua nua|huy mua/.test(norm)) {
    return { intent: 'CANCEL_ORDER', score: 0.95, source: 'rule' };
  }

  // ── Đổi sản phẩm khác ─────────────────────────────────────────────────────
  if (/(doi sang|doi thanh|doi qua|thay bang|doi may|doi san pham)/.test(norm)) {
    return { intent: 'CHANGE_PRODUCT', score: 0.90, source: 'rule' };
  }

  // ── Giao hàng ─────────────────────────────────────────────────────────────
  if (/(giao hang|ship|van chuyen|free ship|phi ship|delivery|shipping|bao lau giao|khi nao nhan|nhan hang|giao nhanh|giao hom nay|express|hoa toc)/.test(norm)) {
    return { intent: 'ASK_DELIVERY', score: 0.92, source: 'rule' };
  }

  // ── Thanh toán ────────────────────────────────────────────────────────────
  if (/(thanh toan|chuyen khoan|tra gop|installment|momo|vnpay|zalopay|atm|visa|mastercard|cod|tien mat|cash|payment|tra truoc)/.test(norm)) {
    return { intent: 'ASK_PAYMENT', score: 0.92, source: 'rule' };
  }

  // ── Bảo hành / đổi trả ────────────────────────────────────────────────────
  if (/(bao hanh|doi tra|tra hang|loi may|hong may|repair|warranty|loi|bi loi|bi hong|khong dung|kem chat luong)/.test(norm)) {
    return { intent: 'ASK_RETURN', score: 0.90, source: 'rule' };
  }

  // ── Khuyến mãi / Flash sale ───────────────────────────────────────────────
  if (/(khuyen mai|flash sale|giam gia|sale|coupon|voucher|ma giam|uu dai|deal|promo|discount|co sale khong)/.test(norm)) {
    return { intent: 'ASK_PROMO', score: 0.90, source: 'rule' };
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  if (/(camera|chup anh|chup hinh|photo|megapixel|quay phim|quay video|selfie|lens|ong kinh|chup dep)/.test(norm)) {
    return { intent: 'ASK_CAMERA', score: 0.90, source: 'rule' };
  }

  // ── Pin / Sạc ─────────────────────────────────────────────────────────────
  if (/(pin|sac|battery|mah|dung luong pin|sac nhanh|sac khong day|wireless charging|tai sao het pin|pin lau|pin trau)/.test(norm)) {
    return { intent: 'ASK_BATTERY', score: 0.90, source: 'rule' };
  }

  // ── Màn hình ──────────────────────────────────────────────────────────────
  if (/(man hinh|display|screen|inch|resolution|oled|amoled|lcd|refresh rate|hz|do sang|do phan giai)/.test(norm)) {
    return { intent: 'ASK_DISPLAY', score: 0.90, source: 'rule' };
  }

  // ── Bộ nhớ / RAM ──────────────────────────────────────────────────────────
  if (/(bo nho|ram|rom|storage|gb|tb|dung luong|the nho|nang cap bo nho|internal|external)/.test(norm)) {
    return { intent: 'ASK_STORAGE', score: 0.90, source: 'rule' };
  }

  // ── Gaming ────────────────────────────────────────────────────────────────
  if (/(game|choi game|gaming|pubg|liên quân|lien quan|free fire|genshin|ping|fps|lag|giat|do hoa|phan cung choi game)/.test(norm)) {
    return { intent: 'ASK_GAMING', score: 0.90, source: 'rule' };
  }

  // ── Kết nối ───────────────────────────────────────────────────────────────
  if (/(5g|wifi|bluetooth|usb|type-c|lightning|nfc|sim|esim|ket noi|hotspot|mang)/.test(norm)) {
    return { intent: 'ASK_CONNECTIVITY', score: 0.88, source: 'rule' };
  }

  // ── Chống nước ────────────────────────────────────────────────────────────
  if (/(chong nuoc|waterproof|water resistant|ip67|ip68|kha nang chiu nuoc)/.test(norm)) {
    return { intent: 'ASK_WATERPROOF', score: 0.92, source: 'rule' };
  }

  // ── Thiết kế / màu sắc ────────────────────────────────────────────────────
  if (/(thiet ke|mau sac|color|mau|dep khong|nang bao nhieu|trong luong|material|chat lieu|kim loai|kinh|nhua|mau gi)/.test(norm)) {
    return { intent: 'ASK_DESIGN', score: 0.85, source: 'rule' };
  }

  // ── Chính hãng / Nguồn gốc ────────────────────────────────────────────────
  if (/(chinh hang|hang chinh|authentic|nguon goc|xuat xu|bao dam|cam ket|fake|hang nhai|gia mao)/.test(norm)) {
    return { intent: 'ASK_AUTHENTIC', score: 0.92, source: 'rule' };
  }

  // ── Thu cũ đổi mới ────────────────────────────────────────────────────────
  if (/(thu cu|doi cu|trade in|trade-in|cu doi moi|ban may cu|gia thu cu)/.test(norm)) {
    return { intent: 'ASK_TRADE_IN', score: 0.92, source: 'rule' };
  }

  // ── Phụ kiện ──────────────────────────────────────────────────────────────
  if (/(phu kien|op lung|case|cuong luc|sac du phong|cap sac|tai nghe|airpods|bao da|kem theo|tang kem|hop so|hu)/.test(norm) &&
      !/(tai nghe nao|laptop nao|dien thoai nao)/.test(norm)) {
    return { intent: 'ASK_ACCESSORIES', score: 0.85, source: 'rule' };
  }

  // ── Đặt trước / Pre-order ─────────────────────────────────────────────────
  if (/(dat truoc|pre-order|preorder|khi nao ra|sap ra mat|ngay ra mat|cho dat truoc)/.test(norm)) {
    return { intent: 'ASK_PREORDER', score: 0.90, source: 'rule' };
  }

  // ── Mua số lượng lớn / Sỉ ────────────────────────────────────────────────
  if (/(si|so luong lon|bulk|nhieu cai|100 cai|gia si|mua si|mua nhieu|gia tot cho so luong)/.test(norm)) {
    return { intent: 'BULK_ORDER', score: 0.90, source: 'rule' };
  }

  // ── Cần gấp / Khẩn cấp ───────────────────────────────────────────────────
  if (/(gap|khan cap|hom nay|chieu nay|ngay bay gio|luon|can ngay|urgent|nhanh nhat)/.test(norm)) {
    return { intent: 'URGENT_NEED', score: 0.88, source: 'rule' };
  }

  // ── Mặc cả / Chê giá ─────────────────────────────────────────────────────
  if (/(dat qua|mac qua|giam them|bot duoc khong|mac ca|thuong luong|gia tot hon|giam gia cho|roi gia chua|gia nhu vay|qua mac)/.test(norm)) {
    return { intent: 'PRICE_COMPLAINT', score: 0.90, source: 'rule' };
  }

  // ── Phàn nàn / Khiếu nại ─────────────────────────────────────────────────
  if (/(phan nan|khieu nai|that vong|qua te|kem chat luong|bi lua|bi gian|toi te|complaint|dich vu kem|khong hai long|sai san pham|sai mau|thieu)/.test(norm)) {
    return { intent: 'COMPLAINT', score: 0.90, source: 'rule' };
  }

  // ── Khen ngợi ─────────────────────────────────────────────────────────────
  if (/(cam on|tuyet voi|rat tot|dich vu tot|5 sao|hai long|ung y|shop tot|nhanh that|giao nhanh that|than thien|nhiet tinh|pro|chuyen nghiep)/.test(norm)) {
    return { intent: 'FEEDBACK_POSITIVE', score: 0.90, source: 'rule' };
  }

  // ── Liên hệ / Địa chỉ ────────────────────────────────────────────────────
  if (/(lien he|dia chi|so dien thoai|hotline|email|facebook|zalo|trang web|website|cua hang|showroom|o dau|o cho nao)/.test(norm)) {
    return { intent: 'CONTACT', score: 0.90, source: 'rule' };
  }

  // ── Tích điểm / Thành viên ────────────────────────────────────────────────
  if (/(tich diem|diem thuong|thanh vien|loyalty|member|uu tien|doi diem|su dung diem)/.test(norm)) {
    return { intent: 'ASK_LOYALTY', score: 0.90, source: 'rule' };
  }

  // ── Quà tặng ─────────────────────────────────────────────────────────────
  if (/(qua tang|tang kem|bao bi|goi qua|hop qua|gift|present|tang|nhan qua)/.test(norm)) {
    return { intent: 'ASK_GIFT', score: 0.88, source: 'rule' };
  }

  // ── Hóa đơn VAT ──────────────────────────────────────────────────────────
  if (/(hoa don|vat|invoice|xuat hoa don|bill|receipt|phieu mua hang)/.test(norm)) {
    return { intent: 'ASK_INVOICE', score: 0.92, source: 'rule' };
  }

  // ── Sửa chữa ─────────────────────────────────────────────────────────────
  if (/(sua chua|sua may|bao duong|sua|sua phone|sua laptop|trung tam bao hanh|dich vu sua)/.test(norm)) {
    return { intent: 'ASK_REPAIR', score: 0.90, source: 'rule' };
  }

  // ── Hàng cũ / Refurbished ─────────────────────────────────────────────────
  if (/(hang cu|may cu|second hand|cu like new|con cu|refurbished|qua su dung)/.test(norm)) {
    return { intent: 'ASK_SECOND_HAND', score: 0.90, source: 'rule' };
  }

  return null;
}


// ─────────────────────────────────────────────────────────────────────────────
// CACHE LAYER — Tránh gọi API lặp lại cho cùng một câu hỏi
// ─────────────────────────────────────────────────────────────────────────────

/** Simple in-memory cache (max 200 entries, TTL 10 phút) */
const _cache = new Map();
const CACHE_MAX = 200;
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  if (_cache.size >= CACHE_MAX) {
    // Xóa entry cũ nhất
    const firstKey = _cache.keys().next().value;
    _cache.delete(firstKey);
  }
  _cache.set(key, { value, ts: Date.now() });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTION — classifyIntent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phân loại ý định (Intent) của tin nhắn người dùng.
 * 
 * Pipeline:
 *   1. Pre-classify (rule-based, không tốn API)
 *   2. Cache lookup (tránh gọi lại cho câu y chang)
 *   3. Hugging Face Inference API (zero-shot classification)
 *   4. Fallback UNKNOWN nếu confidence thấp
 *
 * @param {string} message - Tin nhắn của người dùng
 * @returns {Promise<{ intent: string, score: number, source: string }>}
 */
async function classifyIntent(message) {
  if (!message || !message.trim()) {
    return { intent: 'UNKNOWN', score: 0, source: 'empty' };
  }

  const text = message.trim();

  // Bước 1: Rule-based pre-classify
  const ruleResult = preClassify(text);
  if (ruleResult) {
    console.log(`[HF] Pre-classified: "${text.slice(0, 40)}" → ${ruleResult.intent} (rule)`);
    return ruleResult;
  }

  // Bước 2: Cache
  const cacheKey = text.toLowerCase().slice(0, 200);
  const cached = cacheGet(cacheKey);
  if (cached) {
    console.log(`[HF] Cache hit: "${text.slice(0, 40)}" → ${cached.intent}`);
    return cached;
  }

  // Bước 3: Kiểm tra API Key
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey || apiKey === 'hf_your_api_key_here' || !apiKey.startsWith('hf_')) {
    console.warn('[HF] ⚠️  HF_API_KEY chưa được cấu hình — dùng fallback UNKNOWN');
    return { intent: 'UNKNOWN', score: 0, source: 'no_api_key' };
  }

  // Bước 4: Gọi HuggingFace Inference Router (hf-inference provider)
  // api-inference.huggingface.co đã deprecated — dùng router mới
  try {
    const response = await fetch(
      `https://router.huggingface.co/hf-inference/models/${DEFAULT_MODEL}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            candidate_labels: INTENT_LABELS,
            multi_label: false,
          },
        }),
        signal: AbortSignal.timeout(8000), // timeout 8 giây
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HF API Error ${response.status}: ${errText}`);
    }

    const data = await response.json();

    // Model đang loading (cold start) → thử lại sau
    if (data.error && data.error.includes('loading')) {
      console.warn('[HF] Model đang warm-up, dùng UNKNOWN tạm thời...');
      return { intent: 'UNKNOWN', score: 0, source: 'model_loading' };
    }

    // Parse response — router mới trả [{label, score}] thay vì {labels:[], scores:[]}
    let labels, scores;
    if (Array.isArray(data)) {
      // Format mới: [{label: 'greeting', score: 0.39}, ...]
      labels = data.map(item => item.label);
      scores = data.map(item => item.score);
    } else if (data.labels && data.scores) {
      // Format cũ (fallback)
      labels = data.labels;
      scores = data.scores;
    } else {
      console.warn('[HF] Unexpected response format:', JSON.stringify(data).slice(0, 100));
      return { intent: 'UNKNOWN', score: 0, source: 'parse_error' };
    }

    const topIntent = labels[0] || 'UNKNOWN';
    const topScore = scores[0] || 0;

    console.log(`[HF] API result: "${text.slice(0, 40)}" → ${topIntent} (score: ${topScore.toFixed(3)})`);

    const result = {
      intent: topScore >= CONFIDENCE_THRESHOLD ? topIntent : 'UNKNOWN',
      score: topScore,
      source: 'huggingface',
    };

    // Lưu cache
    cacheSet(cacheKey, result);
    return result;

  } catch (err) {
    console.error(`[HF] API call failed: ${err.message}`);
    // Fallback gracefully — không crash chatbot
    return { intent: 'UNKNOWN', score: 0, source: 'api_error' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  classifyIntent,
  INTENT_LABELS,
  removeDiacritics,
};
