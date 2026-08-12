/**
 * ============================================================
 * ENGINE NLP TIẾNG ANH — ENGLISH NLP ENGINE
 * englishNLP.js — Getshopy Dual-Engine NLP
 * ============================================================
 *
 * @module englishNLP
 * @description
 *   Engine xử lý tin nhắn tiếng Anh sử dụng thư viện `natural`.
 *   Cung cấp:
 *     [1] BayesClassifier của `natural` — phân loại Intent từ text tiếng Anh
 *     [2] PorterStemmer — rút gốc từ (running → run, buying → buy)
 *     [3] WordTokenizer — tách từ theo khoảng trắng và dấu câu
 *     [4] handleEnglishIntent() — sinh câu trả lời tiếng Anh đa dạng
 *
 *   GRACEFUL FALLBACK: Nếu `natural` chưa được cài (npm install),
 *   module tự dùng built-in SimpleClassifier thay thế và vẫn hoạt động.
 *
 * @author  Getshopy AI Team
 * @version 1.0.0
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT
// ─────────────────────────────────────────────────────────────────────────────

/** @type {import('../db')} */
const dbModule = require('../db');
const prisma   = dbModule.prisma || dbModule;

// ─────────────────────────────────────────────────────────────────────────────
// KHỞI TẠO NATURAL LIBRARY (GRACEFUL FALLBACK)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cờ xác nhận `natural` đã được cài và load thành công.
 * @type {boolean}
 */
let NATURAL_AVAILABLE = false;

/**
 * BayesClassifier từ thư viện `natural`.
 * Nếu `natural` chưa cài, dùng SimpleClassifier nội bộ thay thế.
 */
let classifier;

/**
 * PorterStemmer từ `natural` (rút gốc từ tiếng Anh).
 * Ví dụ: running → run, buying → buy, phones → phone
 */
let stemmer;

/**
 * WordTokenizer từ `natural` (tách từ).
 */
let tokenizer;

try {
  const natural = require('natural');
  classifier    = new natural.BayesClassifier();
  stemmer       = natural.PorterStemmer;
  tokenizer     = new natural.WordTokenizer();
  NATURAL_AVAILABLE = true;
  console.log('[EnglishNLP] ✅ Thư viện `natural` đã tải thành công — Engine Tiếng Anh sẵn sàng.');
} catch (_) {
  console.warn('[EnglishNLP] ⚠️  Thư viện `natural` chưa được cài. Chạy: npm install natural');
  console.warn('[EnglishNLP]    Đang dùng SimpleClassifier nội bộ thay thế...');

  // ── FALLBACK: SimpleClassifier nội bộ (keyword matching) ──
  class SimpleClassifier {
    constructor() { this._data = {}; }
    addDocument(text, label) {
      if (!this._data[label]) this._data[label] = [];
      this._data[label].push(text.toLowerCase());
    }
    train() { /* no-op */ }
    classify(text) {
      const lower = text.toLowerCase();
      let best = { label: 'UNKNOWN', score: 0 };
      for (const [label, docs] of Object.entries(this._data)) {
        const score = docs.reduce((acc, doc) => {
          const words = doc.split(' ');
          return acc + words.filter(w => lower.includes(w)).length / words.length;
        }, 0);
        if (score > best.score) best = { label, score };
      }
      return best.label;
    }
    getClassifications(text) {
      const lower = text.toLowerCase();
      return Object.entries(this._data).map(([label, docs]) => {
        const value = docs.reduce((acc, doc) => {
          const words = doc.split(' ');
          return acc + words.filter(w => lower.includes(w)).length / words.length;
        }, 0);
        return { label, value };
      }).sort((a, b) => b.value - a.value);
    }
  }
  classifier = new SimpleClassifier();
  stemmer    = { stem: w => w };   // identity — no stemming
  tokenizer  = { tokenize: t => t.toLowerCase().split(/\s+/) };
}

// ─────────────────────────────────────────────────────────────────────────────
// DỮ LIỆU HUẤN LUYỆN — ENGLISH TRAINING DATA
// Mapping 1-1 với các Intent trong trainingData.js (tiếng Việt)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Huấn luyện BayesClassifier với các câu mẫu tiếng Anh.
 * Mỗi Intent có ít nhất 8-12 câu mẫu đa dạng.
 */
(function trainEnglishClassifier() {

  // ── GREETING ──
  const GREETING = [
    'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
    'hi there', 'hey there', 'howdy', 'greetings', 'what is up', 'sup',
    'nice to meet you', 'hello there', 'hi getshopy', 'hello support',
  ];
  GREETING.forEach(s => classifier.addDocument(s, 'GREETING'));

  // ── HELP ──
  const HELP = [
    'help', 'help me', 'can you help', 'i need help', 'what can you do',
    'how does this work', 'what are you', 'what do you do', 'guide me',
    'i need assistance', 'support', 'how can i use this', 'what do you offer',
  ];
  HELP.forEach(s => classifier.addDocument(s, 'HELP'));

  // ── GOODBYE ──
  const GOODBYE = [
    'bye', 'goodbye', 'see you', 'talk later', 'take care', 'see ya',
    'farewell', 'catch you later', 'have a good day', 'thanks bye',
  ];
  GOODBYE.forEach(s => classifier.addDocument(s, 'GOODBYE'));

  // ── ASK_PRICE ──
  const ASK_PRICE = [
    'how much', 'what is the price', 'what does it cost', 'price of',
    'how much does it cost', 'tell me the price', 'pricing', 'cost',
    'how much is the', 'price for', 'what is the cost', 'price check',
    'can you tell me the price', 'how much does it sell for',
  ];
  ASK_PRICE.forEach(s => classifier.addDocument(s, 'ASK_PRICE'));

  // ── ASK_SPECS ──
  const ASK_SPECS = [
    'specifications', 'specs', 'what are the specs', 'technical details',
    'what is the RAM', 'storage capacity', 'processor', 'chip',
    'what features does it have', 'display size', 'screen resolution',
    'weight', 'dimensions', 'what are the technical specs', 'details about',
  ];
  ASK_SPECS.forEach(s => classifier.addDocument(s, 'ASK_SPECS'));

  // ── CHECK_STOCK ──
  const CHECK_STOCK = [
    'in stock', 'is it available', 'do you have', 'stock',
    'is it in stock', 'available now', 'can i order', 'when will it be available',
    'out of stock', 'stock availability', 'is this product available',
    'do you carry', 'currently available',
  ];
  CHECK_STOCK.forEach(s => classifier.addDocument(s, 'CHECK_STOCK'));

  // ── ASK_DELIVERY ──
  const ASK_DELIVERY = [
    'shipping', 'delivery', 'how long does shipping take', 'delivery time',
    'when will it arrive', 'shipping cost', 'free shipping', 'express delivery',
    'same day delivery', 'ship to', 'how fast can you deliver',
    'next day delivery', 'shipping fee', 'how long to ship',
  ];
  ASK_DELIVERY.forEach(s => classifier.addDocument(s, 'ASK_DELIVERY'));

  // ── ASK_PAYMENT ──
  const ASK_PAYMENT = [
    'payment', 'how can i pay', 'payment methods', 'credit card',
    'installment', 'pay in installments', 'zero interest', 'monthly payment',
    'can i pay with', 'debit card', 'cash on delivery', 'COD',
    'bank transfer', 'e-wallet', 'payment options',
  ];
  ASK_PAYMENT.forEach(s => classifier.addDocument(s, 'ASK_PAYMENT'));

  // ── ASK_RETURN ──
  const ASK_RETURN = [
    'return policy', 'can i return', 'refund', 'exchange',
    'warranty', 'how long is the warranty', 'what is the warranty',
    'money back', 'return within', 'product warranty', '30 day return',
    'broken product', 'defective', 'replace', 'exchange policy',
  ];
  ASK_RETURN.forEach(s => classifier.addDocument(s, 'ASK_RETURN'));

  // ── ASK_PROMO ──
  const ASK_PROMO = [
    'discount', 'sale', 'promo', 'promotion', 'coupon',
    'voucher', 'deal', 'offer', 'special offer', 'any deals',
    'flash sale', 'on sale', 'best deal', 'discount code',
    'any coupons', 'price drop', 'reduced price',
  ];
  ASK_PROMO.forEach(s => classifier.addDocument(s, 'ASK_PROMO'));

  // ── ASK_REVIEW ──
  const ASK_REVIEW = [
    'reviews', 'rating', 'what do people say', 'is it good',
    'customer reviews', 'feedback', 'user rating', 'star rating',
    'is it worth buying', 'recommended', 'is it reliable', 'quality',
    'honest review', 'how good is it', 'opinions',
  ];
  ASK_REVIEW.forEach(s => classifier.addDocument(s, 'ASK_REVIEW'));

  // ── RECOMMEND ──
  const RECOMMEND = [
    'recommend', 'suggest', 'what should i buy', 'best phone',
    'which one is better', 'what do you recommend', 'best laptop',
    'which is the best', 'good choice', 'help me choose',
    'best value for money', 'what is popular', 'top picks',
    'what should i get', 'best option',
  ];
  RECOMMEND.forEach(s => classifier.addDocument(s, 'RECOMMEND'));

  // ── COMPARE_PRODUCT ──
  const COMPARE_PRODUCT = [
    'compare', 'vs', 'versus', 'difference between', 'which is better',
    'iphone vs samsung', 'compare these two', 'what is the difference',
    'side by side', 'pros and cons', 'comparison', 'better than',
  ];
  COMPARE_PRODUCT.forEach(s => classifier.addDocument(s, 'COMPARE_PRODUCT'));

  // ── ASK_CAMERA ──
  const ASK_CAMERA = [
    'camera', 'photo quality', 'megapixel', 'MP', 'selfie camera',
    'front camera', 'rear camera', 'how many megapixels', 'camera quality',
    'good for photography', 'night mode', 'portrait mode', 'zoom',
    'optical zoom', 'video recording', '4K video',
  ];
  ASK_CAMERA.forEach(s => classifier.addDocument(s, 'ASK_CAMERA'));

  // ── ASK_BATTERY ──
  const ASK_BATTERY = [
    'battery', 'battery life', 'mAh', 'how long does the battery last',
    'charging speed', 'fast charging', 'wireless charging', 'battery capacity',
    'how fast does it charge', 'battery drain', 'battery performance',
    'does it support fast charge', 'watt charging', 'overnight charging',
  ];
  ASK_BATTERY.forEach(s => classifier.addDocument(s, 'ASK_BATTERY'));

  // ── ASK_GAMING ──
  const ASK_GAMING = [
    'gaming', 'game', 'fps', 'GPU', 'graphics card', 'gaming laptop',
    'can it run games', 'gaming performance', 'lag', 'frame rate',
    'gaming phone', 'refresh rate for gaming', 'RTX', 'play games on',
    'is it good for gaming', 'gaming specs',
  ];
  ASK_GAMING.forEach(s => classifier.addDocument(s, 'ASK_GAMING'));

  // ── ASK_INSTALLMENT ──
  const ASK_INSTALLMENT = [
    'installment', 'monthly payment', 'pay monthly', 'zero interest installment',
    'how many months', 'down payment', '0 percent interest', 'credit plan',
    'buy now pay later', 'BNPL', 'finance options', 'split payment',
  ];
  ASK_INSTALLMENT.forEach(s => classifier.addDocument(s, 'ASK_INSTALLMENT'));

  // ── PRICE_COMPLAINT ──
  const PRICE_COMPLAINT = [
    'too expensive', 'price is too high', 'way too much', 'overpriced',
    'cheaper elsewhere', 'can you lower the price', 'can i get a discount',
    'is this negotiable', 'best price', 'price match', 'that is a lot',
  ];
  PRICE_COMPLAINT.forEach(s => classifier.addDocument(s, 'PRICE_COMPLAINT'));

  // ── ASK_TRADE_IN ──
  const ASK_TRADE_IN = [
    'trade in', 'trade my old phone', 'exchange old for new', 'upgrade',
    'can i trade in', 'how much for my old phone', 'trade in value',
    'swap my old device', 'buyback', 'old device trade',
  ];
  ASK_TRADE_IN.forEach(s => classifier.addDocument(s, 'ASK_TRADE_IN'));

  // ── ASK_ACCESSORIES ──
  const ASK_ACCESSORIES = [
    'accessories', 'case', 'screen protector', 'charger', 'earbuds',
    'phone case', 'tempered glass', 'power bank', 'cable', 'adapter',
    'what accessories', 'do you sell cases', 'compatible accessories',
  ];
  ASK_ACCESSORIES.forEach(s => classifier.addDocument(s, 'ASK_ACCESSORIES'));

  // ── CONTACT ──
  const CONTACT = [
    'contact', 'phone number', 'email', 'address', 'where are you located',
    'hotline', 'customer service', 'call you', 'reach you',
    'store location', 'opening hours', 'store hours',
  ];
  CONTACT.forEach(s => classifier.addDocument(s, 'CONTACT'));

  // ── CANCEL_ORDER ──
  const CANCEL_ORDER = [
    'cancel order', 'cancel my order', 'cancel', 'i want to cancel',
    'stop my order', 'do not ship', 'cancel purchase',
  ];
  CANCEL_ORDER.forEach(s => classifier.addDocument(s, 'CANCEL_ORDER'));

  // ── TRACK_ORDER ──
  const TRACK_ORDER = [
    'track order', 'where is my order', 'order status', 'has it shipped',
    'when will i receive', 'tracking number', 'order tracking',
    'where is my package', 'shipment status',
  ];
  TRACK_ORDER.forEach(s => classifier.addDocument(s, 'TRACK_ORDER'));

  // ── SECOND_HAND ──
  const SECOND_HAND = [
    'second hand', 'used', 'refurbished', 'pre-owned', 'open box',
    'like new', 'certified refurbished', 'old model', 'renewed',
  ];
  SECOND_HAND.forEach(s => classifier.addDocument(s, 'SECOND_HAND'));

  // Huấn luyện classifier
  classifier.train();
  console.log('[EnglishNLP] ✅ BayesClassifier đã huấn luyện xong với', NATURAL_AVAILABLE ? '`natural`' : 'SimpleClassifier', '(22 Intents).');
})();

// ─────────────────────────────────────────────────────────────────────────────
// HÀM PHÂN LOẠI TIẾNG ANH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dự đoán Intent từ tin nhắn tiếng Anh.
 * Sử dụng PorterStemmer để rút gốc từ trước khi phân loại.
 *
 * @param {string} message - Tin nhắn tiếng Anh từ người dùng
 * @returns {{ intent: string, score: number, lang: 'en' }}
 *
 * @example
 * predictEnglish("what is the price of iphone 15")
 * // → { intent: 'ASK_PRICE', score: 0.87, lang: 'en' }
 */
function predictEnglish(message) {
  if (!message || typeof message !== 'string') {
    return { intent: 'UNKNOWN', score: 0, lang: 'en' };
  }

  // Tokenize và Stem
  const tokens  = tokenizer.tokenize(message.toLowerCase()) || [];
  const stemmed = NATURAL_AVAILABLE
    ? tokens.map(t => stemmer.stem(t)).join(' ')
    : message.toLowerCase();

  // Phân loại
  const intent = classifier.classify(stemmed) || 'UNKNOWN';

  // Lấy score của intent tốt nhất
  let score = 0.5;
  try {
    const classifications = classifier.getClassifications(stemmed);
    if (classifications && classifications.length > 0) {
      const best = classifications[0];
      // Normalize score về [0, 1]
      const total = classifications.reduce((s, c) => s + (c.value || 0), 0);
      score = total > 0 ? (best.value || 0) / total : 0.5;
    }
  } catch (_) { /* ignore */ }

  console.log(`[EnglishNLP] Predict: "${message.slice(0, 40)}" → Intent: ${intent} | Score: ${score.toFixed(3)}`);
  return { intent, score, lang: 'en' };
}

// ─────────────────────────────────────────────────────────────────────────────
// POOL CÂU TRẢ LỜI TIẾNG ANH — ENGLISH RESPONSE POOLS
// Mỗi Intent có 4-6 biến thể, chọn ngẫu nhiên để tránh lặp
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chọn ngẫu nhiên một phần tử từ mảng.
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/**
 * Định dạng giá VND sang chuỗi đọc được.
 * @param {number} price
 * @returns {string}
 */
const fmtVND = price => {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(1).replace('.0', '')} million VND`;
  if (price >= 1_000)     return `${(price / 1_000).toFixed(0)}k VND`;
  return `${price} VND`;
};

/**
 * Pool câu trả lời tiếng Anh theo từng Intent.
 * @type {Object<string, string[]>}
 */
const EN_POOL = {
  GREETING: [
    '👋 Hello! Welcome to Getshopy! I\'m your AI shopping assistant. Are you looking for a phone, laptop, or accessories today?',
    '😊 Hi there! Great to see you at Getshopy! What can I help you find today — smartphones, laptops, or headphones?',
    '🛍️ Hey! Welcome! I\'m here to help you find the perfect tech product. What are you shopping for today?',
    '👋 Hello and welcome to Getshopy! Tell me what you\'re looking for and I\'ll find the best options for you!',
  ],

  HELP: [
    'I\'m Getshopy\'s AI assistant! 🤖 I can help you with:\n- **Finding products** by budget or specs\n- **Comparing** two products side-by-side\n- **Checking prices** and stock availability\n- **Delivery & payment** information\n\nWhat would you like to know?',
    'Sure! I\'m here to make your shopping easier 😊 You can ask me about product prices, specs, delivery times, warranty, promotions, or just ask me to **recommend the best phone for your budget**!',
  ],

  GOODBYE: [
    '👋 Goodbye! Thanks for shopping with Getshopy. Hope to see you again soon!',
    '😊 Bye bye! Feel free to come back anytime you need help finding a product. Have a great day!',
    '🛍️ Thanks for visiting Getshopy! Come back anytime — we\'re always here to help!',
  ],

  ASK_PRICE: [
    'Sure! Could you tell me the **product name or model** you\'re asking about? I\'ll pull up the exact price for you right away! 💰',
    'I\'d be happy to check the price! Just let me know the **product name** (e.g., "iPhone 15 Pro", "Samsung Galaxy S24") and I\'ll look it up instantly!',
    'Great question! Please share the **exact model name** and I\'ll give you the current price including any active promotions 🏷️',
    'Of course! What product are you checking the price for? I can also let you know if there are any **discounts or flash sales** running right now!',
  ],

  ASK_SPECS: [
    'Happy to share the specs! Which product are you asking about? Give me the **model name** and I\'ll pull the full technical specifications! ⚙️',
    'Sure! Please tell me the **product name** you\'re interested in and I\'ll share the complete specs: processor, RAM, storage, camera, battery and more!',
    'Technical specs coming right up! 📋 Which model are you looking at? I can compare specs between two models if you\'re deciding between them too!',
  ],

  CHECK_STOCK: [
    'Let me check stock availability for you! Which **product and model** are you looking for? I\'ll confirm if it\'s in stock and how many units are left! 📦',
    'Sure! Tell me the **product name** and I\'ll check our inventory right away. If it\'s out of stock, I can suggest similar alternatives that are available!',
    'I\'ll check that for you! What **product** are you looking for? I can also notify you when out-of-stock items become available again!',
  ],

  ASK_DELIVERY: [
    '🚚 Here\'s our delivery info:\n- **Ho Chi Minh City & Hanoi:** 2–4 hours (express same-day)\n- **Other provinces:** 1–3 business days\n- **Free shipping** on orders over 500,000 VND!\n\nWould you like to place an order?',
    '📦 We ship nationwide! Express delivery within **2–4 hours** in major cities, **1–3 days** for other locations. Free shipping on orders over 500k VND. Where would you like us to deliver?',
    '🛵 Fast delivery is our priority! Orders placed before noon are delivered **same day** in HCM City. For express (2-hour window), add the rush delivery option at checkout!',
    'We partner with GHTK, GHN, and J&T Express for reliable delivery! You\'ll receive a **tracking link via SMS** once your order ships. Any specific location you need delivery to?',
  ],

  ASK_PAYMENT: [
    '💳 We accept many payment methods:\n- **Cash on Delivery (COD)** — pay when you receive\n- **Bank Transfer** — fast processing\n- **Credit/Debit Cards** — Visa, Mastercard\n- **E-Wallets** — MoMo, ZaloPay, VNPay\n- **0% Installment** — 3 to 24 months!\n\nWhich method works best for you?',
    'We\'ve got flexible payment options! 💳 You can pay with **COD, bank transfer, credit card, MoMo, ZaloPay** or even split it into **0% interest monthly payments** for up to 24 months. Which do you prefer?',
    'Yes, we offer **installment plans with 0% interest** through partnered credit cards! 🎉 You can split the payment over 3, 6, 12, or 24 months. Want to know which cards qualify?',
  ],

  ASK_RETURN: [
    '✅ Our return & warranty policy:\n- **30-day exchange** for manufacturer defects\n- **7-day return** if product doesn\'t match description\n- **12-month manufacturer warranty** included\n\nShop with confidence — we\'ve got you covered!',
    'Great news! 🛡️ We offer a **30-day 1-for-1 exchange** if your product has any manufacturing defects. Plus **12 months warranty** from the manufacturer. Any issues? We\'ll handle it!',
    'Our return policy is straightforward: **7 days** for full return/refund if product is as described, **30 days** for defective products. Just contact us and we\'ll arrange the return shipping at no cost to you!',
  ],

  ASK_PROMO: [
    '🎉 Current promotions at Getshopy:\n- **Weekly Flash Sale** every Friday — up to 20% off!\n- **Student discount:** 3% off with valid student ID\n- **Online payment bonus:** Extra 5% off\n- Use code **GETSHOPY10** for 10% off orders over 5M VND!\n\nWhich deal interests you?',
    '🏷️ Hot deals right now! We have **Flash Sales, bundle discounts**, and seasonal promotions. Follow our fanpage or leave your email to get notified about the next big sale!',
    'Yes! Use promo code **GETSHOPY10** at checkout for an extra **10% discount** on orders over 5 million VND (first-time customers). Want me to check if there are any active flash sales?',
  ],

  ASK_REVIEW: [
    'Our customers love us! ⭐ Let me pull up the top-rated products for you. Which category are you looking at — phones, laptops, or headphones?',
    '😊 Great question! I can share customer ratings and reviews. Which product are you considering? I\'ll give you an honest summary of what buyers are saying!',
    'Reviews matter! 📊 Tell me the product name and I\'ll share its **average rating, number of reviews**, and top customer feedback so you can make an informed decision!',
  ],

  RECOMMEND: [
    '🤔 Happy to recommend! To find your perfect match, let me ask:\n1. What\'s your **budget**?\n2. What will you **use it for** (work, gaming, photography, daily use)?\n3. Any **brand preference** (Apple, Samsung, Xiaomi, etc.)?\n\nAnswer these and I\'ll suggest the best options!',
    '💡 Let me help you choose! Tell me:\n- Your **budget range** (e.g., under 10M, 15-20M)\n- Main purpose (office work, gaming, camera quality)\n- iOS or Android preference?\n\nI\'ll find the perfect product for your needs!',
    'Great, I love helping people find the right product! 😊 Quick question: What\'s the **most important feature** to you — battery life, camera quality, performance, or price value?',
  ],

  COMPARE_PRODUCT: [
    '⚖️ Sure! I can compare products side by side. Which **two products** would you like to compare? (e.g., "iPhone 15 vs Samsung S24")',
    'Happy to help you decide! 📊 Tell me the **two models** you\'re comparing and what matters most to you (price, camera, battery, performance) — I\'ll give you a clear comparison!',
    'Great idea to compare before buying! Name the **two products** and I\'ll create a detailed comparison table covering price, specs, ratings, and my honest recommendation!',
  ],

  ASK_CAMERA: [
    '📸 Camera specs are super important! Which phone or device are you asking about? I\'ll share the full camera breakdown: main sensor MP, aperture, zoom, video resolution, and night mode capability!',
    'Great camera question! 📷 Tell me the **model** and I\'ll cover everything: front camera, rear camera (wide/ultrawide/telephoto), megapixels, OIS, aperture, and sample shot quality!',
    'For photography lovers! 🌟 Share the **product name** and I\'ll tell you if it has: optical image stabilization (OIS), portrait mode, night photography, pro video recording, and compare it against similar phones!',
  ],

  ASK_BATTERY: [
    '🔋 Battery life details! Which product are you asking about? I\'ll check the mAh capacity, fast charging wattage, wireless charging support, and real-world battery performance!',
    'Battery is everything! ⚡ Tell me the **model** and I\'ll share: battery capacity (mAh), charging speed, whether it supports wireless charging, and estimated screen-on time!',
    'Good thinking to check battery! 🔌 Tell me the product name — I\'ll check if it supports **fast charging, wireless charging, reverse charging**, and what the estimated battery life is!',
  ],

  ASK_GAMING: [
    '🎮 Gaming specs! For gaming performance you need to know the **chip, GPU, RAM, and cooling system**. Which device are you asking about? I\'ll break down its gaming capability!',
    'Level up! 🚀 Tell me the **product** and I\'ll evaluate its gaming performance: processor benchmark, GPU model, RAM, refresh rate, and if it can handle popular games at high settings!',
    'Gaming is serious business! 🎯 Which phone or laptop are you considering for gaming? I\'ll check: FPS performance, thermal management, gaming modes, refresh rate, and community gaming reviews!',
  ],

  ASK_INSTALLMENT: [
    '💳 Great news about installments! We offer **0% interest installment plans** through partnered credit cards:\n- 3 months | 6 months | 12 months | 24 months\n\nMinimum order value applies. Which credit card do you use? I can check if it qualifies!',
    'Yes, buy now and **pay in easy monthly installments** with 0% interest! Available via Visa, Mastercard, and select bank cards. How many months would you prefer to split the payment?',
  ],

  PRICE_COMPLAINT: [
    'I understand budget is important! 💰 Let me find you the **best value options** in your price range. What\'s your maximum budget? I\'ll filter the products and find the best specs for your money!',
    'That\'s fair! Let me look for **more affordable alternatives** with similar features. What budget are you comfortable with? I promise I can find something great without breaking the bank! 😊',
    'No worries! 🎯 Tell me your budget and the key features you need — I\'ll find products that give you the **best bang for your buck**!',
  ],

  ASK_TRADE_IN: [
    '🔄 We have a trade-in program! Bring your old device and our team will assess its value, which can be **deducted from the price of your new purchase**. Which device are you trading in?',
    'Great idea to trade in your old device! 📱 Tell me what you\'re trading (**model, condition, year**) and I\'ll give you an estimated trade-in value to put toward your new purchase!',
  ],

  ASK_ACCESSORIES: [
    '🎒 We stock a full range of accessories! Cases, screen protectors, chargers, earbuds, power banks, cables, hubs — you name it! Which product do you need accessories for?',
    'Yes, we have accessories for all our products! 🛍️ Tell me the device model and I\'ll recommend **compatible accessories** — cases, chargers, screen protectors, and more at great prices!',
  ],

  CONTACT: [
    '📞 You can reach Getshopy:\n- **Hotline:** 1800-xxxx (Free, 8AM-10PM daily)\n- **Email:** support@getshopy.vn\n- **Address:** Ho Chi Minh City (visit our map for directions)\n- **Chat:** You\'re already chatting with us! 😊',
    'Need to get in touch? 📱 Our customer service team is available **8AM to 10PM daily**. You can call our hotline, email us, or visit our store. Can I help resolve your issue right here?',
  ],

  CANCEL_ORDER: [
    '❌ Need to cancel? No problem! If your order is within **1 hour of placement**, I can cancel it for free. Please share your **order number** and I\'ll process the cancellation right away!',
    'I can help with cancellations! 📋 If the order hasn\'t been processed yet, we\'ll cancel it immediately with **full refund**. Share your order ID and I\'ll check the status!',
  ],

  TRACK_ORDER: [
    '📦 Order tracking! Please share your **order ID or phone number** used to place the order, and I\'ll check the current delivery status right away!',
    '🚚 Let me track that for you! Provide your **order number** and I\'ll give you the latest update on where your package is and estimated delivery time!',
  ],

  SECOND_HAND: [
    '♻️ We do carry **certified refurbished products** at 20-30% below new price! These are fully tested, cosmetically graded (95%+ condition), and come with our warranty. Want to see what\'s available?',
    'Looking for refurbished? Great choice for savings! 💰 Our **pre-owned products** are quality-checked and graded. They typically save you 20-30% compared to new. What product are you looking for?',
  ],

  UNKNOWN: [
    'I\'m not sure I understood that. Could you **rephrase your question** or tell me more specifically what you\'re looking for? I can help with: product prices, specs, delivery, payment, or recommendations! 😊',
    'Hmm, I\'m having trouble understanding. Could you be more specific? You can ask me things like "How much is iPhone 15?" or "Compare Samsung vs iPhone" and I\'ll help right away!',
    'I didn\'t quite catch that! 🤔 Feel free to ask me about product **prices, availability, specs, delivery, or promotions** — I\'m here to help!',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// HÀM XỬ LÝ INTENT TIẾNG ANH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Xử lý Intent tiếng Anh và trả về câu trả lời phù hợp.
 * Với các Intent cần DB (giá, tồn kho...), query Prisma và nhúng kết quả vào response.
 *
 * @param {string} intent  - Intent được phân loại bởi predictEnglish()
 * @param {string} message - Tin nhắn gốc của người dùng
 * @returns {Promise<{text: string, link: string}>}
 */
async function handleEnglishIntent(intent, message) {
  let text = '';
  let link = '/';

  // ── TRÍCH XUẤT TÊN SẢN PHẨM từ tin nhắn tiếng Anh ──
  const knownBrands = [
    'iphone', 'samsung', 'macbook', 'xiaomi', 'oppo', 'vivo', 'realme',
    'asus', 'dell', 'hp', 'lenovo', 'acer', 'msi', 'google pixel',
    'sony', 'lg', 'oneplus', 'motorola', 'nokia',
  ];
  const foundBrand = knownBrands.find(b => message.toLowerCase().includes(b));

  // ── TRÍCH XUẤT NGÂN SÁCH từ tin nhắn tiếng Anh ──
  const budgetMatch = message.match(/(\d[\d,\.]*)\s*(million|m|k|thousand)?/i);
  let budget = null;
  if (budgetMatch) {
    let raw = parseFloat(budgetMatch[1].replace(/,/g, ''));
    const unit = (budgetMatch[2] || '').toLowerCase();
    if (unit === 'million' || unit === 'm') raw *= 1_000_000;
    else if (unit === 'k' || unit === 'thousand') raw *= 1_000;
    if (raw >= 100_000) budget = raw; // Chỉ nhận nếu hợp lý
  }

  switch (intent) {

    // ── Intents không cần DB ──
    case 'GREETING':
    case 'HELP':
    case 'GOODBYE':
    case 'ASK_DELIVERY':
    case 'ASK_PAYMENT':
    case 'ASK_RETURN':
    case 'ASK_INSTALLMENT':
    case 'CONTACT':
    case 'CANCEL_ORDER':
    case 'TRACK_ORDER':
    case 'PRICE_COMPLAINT':
    case 'ASK_TRADE_IN': {
      text = pick(EN_POOL[intent] || EN_POOL.UNKNOWN);
      break;
    }

    // ── ASK_PRICE — Kéo giá từ DB ──
    case 'ASK_PRICE': {
      if (foundBrand) {
        try {
          const product = await prisma.product.findFirst({
            where: { name: { contains: foundBrand, mode: 'insensitive' }, is_deleted: false },
            orderBy: { rating: 'desc' },
          });
          if (product) {
            text = pick([
              `💰 The **${product.name}** is currently priced at **${fmtVND(product.price)}**. ⭐ Rating: ${product.rating}/5 | 🛒 ${product.sold} sold. Want to see more details?`,
              `Here's the price for **${product.name}**: **${fmtVND(product.price)}** 🏷️ (${product.stock > 0 ? `${product.stock} units in stock` : 'Currently out of stock'}). Any questions?`,
            ]);
            link = `/product/${product.id}`;
            break;
          }
        } catch (_) { /* fall through */ }
      }
      text = pick(EN_POOL.ASK_PRICE);
      break;
    }

    // ── CHECK_STOCK — Kiểm tra tồn kho ──
    case 'CHECK_STOCK': {
      if (foundBrand) {
        try {
          const product = await prisma.product.findFirst({
            where: { name: { contains: foundBrand, mode: 'insensitive' }, is_deleted: false },
          });
          if (product) {
            if (product.stock > 0) {
              text = pick([
                `✅ Great news! **${product.name}** is **in stock** with **${product.stock} units** available. Grab yours before it sells out! 🛒`,
                `📦 Yes! **${product.name}** is available — **${product.stock} left in stock**. Want to place an order?`,
              ]);
            } else {
              text = `😔 Unfortunately, **${product.name}** is currently **out of stock**. Would you like me to suggest a similar product that\'s available?`;
            }
            link = `/product/${product.id}`;
            break;
          }
        } catch (_) { /* fall through */ }
      }
      text = pick(EN_POOL.CHECK_STOCK);
      break;
    }

    // ── ASK_PROMO — Kiểm tra Flash Sale ──
    case 'ASK_PROMO': {
      try {
        const activeSales = await prisma.flashSale.findMany({
          where: { is_deleted: false, is_active: true },
          take: 2,
        });
        if (activeSales.length > 0) {
          const saleList = activeSales
            .map(s => `• **"${s.title}"** — ${s.discount_percent}% OFF`)
            .join('\n');
          text = `🎉 Hot deals happening right now!\n${saleList}\n\nDon't miss out — these deals are time-limited! Want to shop now?`;
          link = '/';
          break;
        }
      } catch (_) { /* fall through */ }
      text = pick(EN_POOL.ASK_PROMO);
      break;
    }

    // ── RECOMMEND — Gợi ý sản phẩm ──
    case 'RECOMMEND': {
      try {
        const where = budget
          ? { is_deleted: false, stock: { gt: 0 }, price: { lte: budget * 1.1, gte: budget * 0.5 } }
          : { is_deleted: false, stock: { gt: 0 } };

        const products = await prisma.product.findMany({
          where,
          orderBy: [{ rating: 'desc' }, { sold: 'desc' }],
          take: 3,
        });

        if (products.length > 0) {
          const lines = products.map((p, i) => {
            const badge = i === 0 ? ' 🔥 Top Pick' : '';
            return `• **${p.name}** — ${fmtVND(p.price)} (⭐${p.rating}/5)${badge}`;
          }).join('\n');

          const budgetNote = budget ? ` in your budget of **${fmtVND(budget)}**` : '';
          text = `🌟 Here are my top recommendations${budgetNote}:\n\n${lines}\n\nWant more details on any of these?`;
          link = `/product/${products[0].id}`;
          break;
        }
      } catch (_) { /* fall through */ }
      text = pick(EN_POOL.RECOMMEND);
      break;
    }

    // ── ASK_REVIEW — Rating sản phẩm ──
    case 'ASK_REVIEW': {
      if (foundBrand) {
        try {
          const product = await prisma.product.findFirst({
            where: { name: { contains: foundBrand, mode: 'insensitive' }, is_deleted: false },
            orderBy: { rating: 'desc' },
          });
          if (product) {
            text = pick([
              `⭐ **${product.name}** has an average rating of **${product.rating}/5** stars from our customers. It has sold **${product.sold} units** — a popular choice! Want to see it?`,
              `📊 Customer verdict on **${product.name}**: **${product.rating}/5 stars** | **${product.sold} sold**. ${product.rating >= 4.5 ? 'Highly recommended! 🏆' : 'Well received by buyers!'}`,
            ]);
            link = `/product/${product.id}`;
            break;
          }
        } catch (_) { /* fall through */ }
      }
      text = pick(EN_POOL.ASK_REVIEW);
      break;
    }

    // ── COMPARE_PRODUCT ──
    case 'COMPARE_PRODUCT': {
      const foundBrands = knownBrands.filter(b => message.toLowerCase().includes(b));
      if (foundBrands.length >= 2) {
        try {
          const [p1, p2] = await Promise.all([
            prisma.product.findFirst({ where: { name: { contains: foundBrands[0], mode: 'insensitive' }, is_deleted: false } }),
            prisma.product.findFirst({ where: { name: { contains: foundBrands[1], mode: 'insensitive' }, is_deleted: false } }),
          ]);
          if (p1 && p2) {
            const winner  = p1.rating >= p2.rating ? p1 : p2;
            const cheaper = p1.price  <= p2.price  ? p1 : p2;
            text = [
              `⚖️ Quick comparison: **${p1.name}** vs **${p2.name}**\n`,
              `| Feature | ${p1.name} | ${p2.name} |`,
              `|---|---|---|`,
              `| 💰 Price | ${fmtVND(p1.price)} | ${fmtVND(p2.price)} |`,
              `| ⭐ Rating | ${p1.rating}/5 | ${p2.rating}/5 |`,
              `| 🛒 Sold | ${p1.sold} | ${p2.sold} |`,
              `| 📦 Stock | ${p1.stock > 0 ? '✅' : '❌'} | ${p2.stock > 0 ? '✅' : '❌'} |`,
              `\n**My verdict:** **${winner.name}** is better rated. **${cheaper.name}** is more affordable. What matters most to you?`,
            ].join('\n');
            link = `/product/${winner.id}`;
            break;
          }
        } catch (_) { /* fall through */ }
      }
      text = pick(EN_POOL.COMPARE_PRODUCT);
      break;
    }

    // ── Các intents còn lại dùng pool cố định ──
    case 'ASK_SPECS':
    case 'ASK_CAMERA':
    case 'ASK_BATTERY':
    case 'ASK_GAMING':
    case 'ASK_ACCESSORIES':
    case 'SECOND_HAND': {
      text = pick(EN_POOL[intent] || EN_POOL.UNKNOWN);
      break;
    }

    default: {
      text = pick(EN_POOL.UNKNOWN);
    }
  }

  return { text, link };
}

// ─────────────────────────────────────────────────────────────────────────────
// XUẤT MODULE
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  /**
   * Dự đoán Intent từ text tiếng Anh
   * @type {typeof predictEnglish}
   */
  predictEnglish,

  /**
   * Xử lý Intent và sinh câu trả lời tiếng Anh
   * @type {typeof handleEnglishIntent}
   */
  handleEnglishIntent,

  /**
   * Cờ xác nhận thư viện `natural` đã được cài
   * @type {boolean}
   */
  NATURAL_AVAILABLE,

  /**
   * Chọn ngẫu nhiên từ mảng — export để test
   * @type {typeof pick}
   */
  pick,

  /**
   * Pool câu trả lời tiếng Anh — export để test/mở rộng
   * @type {typeof EN_POOL}
   */
  EN_POOL,
};
