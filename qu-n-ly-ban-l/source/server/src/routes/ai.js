const express = require('express');
const { prisma } = require('../db');
const router = express.Router();

const NaiveBayes = require('../ai/NaiveBayes');
const path = require('path');
const fs = require('fs');
const { trainModel } = require('../ai/train');
const {
  handleExpandedIntent, removeDiacritics,
  isPromoQuery, isDeliveryQuery, isReturnQuery, isPaymentQuery,
  isPriceComplaint, isChangeProductQuery, isTrackOrderQuery, isCancelOrderQuery,
} = require('./aiHandlers');

// ── DUAL-ENGINE NLP ──────────────────────────────────────────────────────────
// Tiếng Việt  → NaiveBayes tự viết + aiHandlers.js (không thay đổi)
// Tiếng Anh   → `natural` BayesClassifier + englishNLP.js
// ─────────────────────────────────────────────────────────────────────────────
const { detectLanguage, detectLanguageVerbose } = require('../ai/langDetect');
const { predictEnglish, handleEnglishIntent }   = require('../ai/englishNLP');

// ══════════════════════════════════════════════════════════════════════════════
// BẢNG ÁNH XẠ TỪ KHÓA → DANH MỤC
// Dùng để tìm sản phẩm theo loại (tai nghe, đồng hồ, điện thoại...)
// khi user hỏi chung chung mà không nêu đúng tên model sản phẩm.
// Key là dạng KHÔNG DẤU để so sánh bằng removeDiacritics()
// ══════════════════════════════════════════════════════════════════════════════
const CATEGORY_KEYWORD_MAP = {
  // Điện thoại thông minh
  'dien thoai':         'Điện thoại thông minh',
  'smartphone':         'Điện thoại thông minh',
  'phone':              'Điện thoại thông minh',
  'iphone':             'Điện thoại thông minh',
  'galaxy':             'Điện thoại thông minh',
  // Máy tính xách tay
  'laptop':             'Máy tính xách tay',
  'may tinh xach tay':  'Máy tính xách tay',
  'notebook':           'Máy tính xách tay',
  'may tinh':           'Máy tính xách tay',
  'macbook':            'Máy tính xách tay',  // MacBook Air / Pro / M-series
  // Máy tính bảng
  'tablet':             'Máy tính bảng',
  'ipad':               'Máy tính bảng',
  'may tinh bang':      'Máy tính bảng',
  // Phụ kiện công nghệ
  'tai nghe':           'Phụ kiện công nghệ',
  'headphone':          'Phụ kiện công nghệ',
  'earphone':           'Phụ kiện công nghệ',
  'earbuds':            'Phụ kiện công nghệ',
  'airpods':            'Phụ kiện công nghệ',
  'dong ho':            'Phụ kiện công nghệ',   // đồng hồ (thông minh)
  'smartwatch':         'Phụ kiện công nghệ',
  'apple watch':        'Phụ kiện công nghệ',
  'micro':              'Phụ kiện công nghệ',
  'microphone':         'Phụ kiện công nghệ',
  'loa':                'Phụ kiện công nghệ',
  'speaker':            'Phụ kiện công nghệ',
  'phu kien':           'Phụ kiện công nghệ',   // phụ kiện
};

// Danh sách thương hiệu phổ biến — dùng để lọc sản phẩm trong danh mục khi user nêu brand
const BRAND_KEYWORDS = [
  'apple', 'samsung', 'xiaomi', 'redmi', 'oppo', 'vivo', 'realme',
  'google', 'pixel', 'huawei', 'honor', 'nokia', 'motorola',
  'dell', 'asus', 'hp', 'lenovo', 'acer', 'msi', 'lg', 'sony',
  'jbl', 'bose', 'sennheiser', 'jabra', 'beats', 'anker',
  'garmin', 'fitbit', 'amazfit', 'casio',
];

// Regex nhận diện tin nhắn chào hỏi ngắn gọn
// (Model train trên 1M+ sample SEARCH_PRODUCT dễ "nuốt" cả câu chào đơn giản)
const GREETING_PATTERNS = [
  /^(xin chào|hello|hi|hey|alo|chào|chào bạn|chào shop|hi shop|hey shop|shop ơi|em ơi|có ai không|có ai đó không|alo shop)[\s!.,?]*$/i,
  /^(cho hỏi|hỏi thăm|xin chào nhé|chào nhé)[\s!.,?]*$/i,
];

// Khởi tạo Model AI Nội bộ
const aiModel = new NaiveBayes();
const MODEL_PATH = path.join(__dirname, '../ai/ai_model_weights.json');

// Hàm tải mô hình (Load model)
async function initAI() {
  const loaded = await aiModel.loadModel(MODEL_PATH);
  if (!loaded) {
    console.log('[AI] Không tìm thấy file Model. Tiến hành tự động Huấn luyện (Training)...');
    await trainModel();
    await aiModel.loadModel(MODEL_PATH);
  } else {
    console.log('[AI] Đã tải thành công Mô hình Naive Bayes từ ổ cứng.');
  }
}
// Chạy ngay khi Server khởi động — lỗi không được làm crash toàn bộ server
initAI().catch(err => {
  console.error('[AI] ⚠️  Khởi tạo AI thất bại, server vẫn tiếp tục chạy bình thường:', err.message);
  console.error('[AI] Chatbot sẽ dùng fallback responses cho đến khi model được load thành công.');
});

// ==========================================
// 1. AI Recommendation System (B2C)
// ==========================================
router.get('/b2c/recommendations', async (req, res) => {
  try {
    const { email } = req.query;
    
    // Fallback products (top selling / random) in case AI fails or user has no history
    const allProducts = await prisma.product.findMany({
      where: { is_deleted: false, stock: { gt: 0 } },
      orderBy: { id: 'desc' },
      take: 20
    });
    const fallbackIds = allProducts.map(p => Number(p.id)).slice(0, 4);

    if (!email) {
      // Guest user -> Return top products
      const prods = await prisma.product.findMany({
        where: { id: { in: fallbackIds } }
      });
      return res.json(prods.map(p => ({ ...p, id: Number(p.id) })));
    }

    // 1. Fetch user order history
    const orders = await prisma.order.findMany({
      where: {
        customer: {
          path: ['email'],
          equals: email
        }
      },
      orderBy: { date: 'desc' },
      take: 10
    });

    let historyText = "";
    if (orders.length > 0) {
      const boughtItems = orders.flatMap(o => o.items).map(i => i.name).slice(0, 5);
      historyText = `Khách hàng này đã từng mua: ${boughtItems.join(', ')}.`;
    } else {
      historyText = `Khách hàng này chưa từng mua sản phẩm nào.`;
    }

    // Thay vì gọi OpenRouter, ta dùng thuật toán thống kê Gợi ý sản phẩm cùng Category hoặc ngẫu nhiên
    const recentCategories = [...new Set(orders.flatMap(o => o.items).map(i => i.category_id))];
    
    let recommendedProducts = [];
    if (recentCategories.length > 0) {
      // Gợi ý các sản phẩm cùng danh mục mà khách đã mua
      recommendedProducts = await prisma.product.findMany({
        where: { category_id: { in: recentCategories }, is_deleted: false, stock: { gt: 0 } },
        take: 4
      });
    }

    if (recommendedProducts.length < 4) {
      recommendedProducts = await prisma.product.findMany({
        where: { id: { in: fallbackIds } }
      });
    }

    res.json(recommendedProducts.map(p => ({ ...p, id: Number(p.id) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. AI Campaign Suggestions (B2B Admin)
// ==========================================
router.get('/b2b/campaign-suggestions', async (req, res) => {
  try {
    // 1. Gather context for AI
    // - High stock products
    const highStockProducts = await prisma.product.findMany({
      where: { is_deleted: false, stock: { gt: 10 } },
      orderBy: { stock: 'desc' },
      take: 5
    });
    
    // - Past flash sales
    const pastSales = await prisma.flashSale.findMany({
      where: { is_deleted: false },
      orderBy: { id: 'desc' },
      take: 3
    });

    const contextData = {
      high_stock_products: highStockProducts.map(p => ({
        id: Number(p.id),
        name: p.name,
        stock: p.stock,
        price: p.price
      })),
      recent_campaigns: pastSales.map(fs => ({
        title: fs.title,
        discount_percent: fs.discount_percent
      }))
    };

    // Thuật toán Rule-based đề xuất Chiến dịch Flash Sale
    const topStock = highStockProducts[0];
    const suggestion = {
      title: `Sale Xả Kho ${topStock ? topStock.name : 'Sản Phẩm Hot'}`,
      reason: `Sản phẩm ${topStock ? topStock.name : ''} đang có lượng tồn kho cao (${topStock ? topStock.stock : 0} cái). Cần đẩy hàng nhanh.`,
      discount_percent: 20,
      product_id: topStock ? Number(topStock.id) : null
    };
    
    res.json({ success: true, suggestion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. AI Chatbot Assistant (B2C)
// ==========================================
router.post('/b2c/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // ── BƯỚC 1: PHÁT HIỆN NGÔN NGỮ ───────────────────────────────────────────
    const langInfo = detectLanguageVerbose(message);
    const lang     = langInfo.lang;   // 'vi' | 'en'
    console.log(`[LangDetect] "${message.slice(0, 40)}" → lang=${lang} | confidence=${langInfo.confidence} | vietRatio=${langInfo.vietRatio}`);

    // ── BƯỚC 2A: TIẾNG ANH → ENGLISH ENGINE (`natural`) ─────────────────────
    if (lang === 'en') {
      const { intent: enIntent, score: enScore } = predictEnglish(message);
      console.log(`[EnglishNLP] Intent: ${enIntent} | Score: ${enScore.toFixed(3)}`);

      const enResult = await handleEnglishIntent(enIntent, message);
      return res.json({ text: enResult.text, link: enResult.link, lang: 'en', intent: enIntent });
    }

    // ── BƯỚC 2B: TIẾNG VIỆT → NAIVE BAYES TỰ VIẾT ─────────────────────────────
    // Pre-classify câu chào hỏi ngắn gọn TRƯỚC Naive Bayes để tránh mis-classify.
    // Model train trên 1M+ sample SEARCH_PRODUCT nên rất dễ "nuốt" các câu đơn giản.
    let intent, score;
    if (GREETING_PATTERNS.some(p => p.test(message.trim()))) {
      // ── Pre-classify: câu chào hỏi ngắn → luôn là GREETING ──
      intent = 'GREETING'; score = 1.0;
      console.log(`[VI PreClassify] Greeting pattern matched → intent=GREETING`);
    } else {
      ({ intent, score } = aiModel.predict(message));
      console.log(`[VI NaiveBayes] Intent: ${intent} | Score: ${score}`);

      // ── Secondary Intent Correction ─────────────────────────────────────────
      // Model được train trên 1M+ sample SEARCH_PRODUCT nên rất dễ misclassify
      // các câu hỏi về giá, khuyến mãi, giao hàng... thành SEARCH_PRODUCT.
      // Các hàm isXxxQuery() dùng rule-based regex (với removeDiacritics) để
      // phát hiện intent thực sự và ghi đè kết quả Naive Bayes.
      const CORRECTABLE_INTENTS = new Set([
        'SEARCH_PRODUCT', 'SEARCH_CATEGORY', 'ASK_PRICE', 'ASK_SPECS', 'ASK_ACCESSORIES',
        // ASK_RECOMMEND cũng hay bị hiểu nhầm khi user hỏi "điện thoại oppo", "laptop dell"...
        'ASK_RECOMMEND', 'CHECK_STOCK', 'COMPARE_PRODUCT', 'ASK_REVIEW',
      ]);
      if (CORRECTABLE_INTENTS.has(intent)) {
        const msgN = removeDiacritics(message).toLowerCase();

        // ── Phát hiện câu SO SÁNH sản phẩm ─────────────────────────────────
        // Ưu tiên cao nhất: nếu có từ khóa so sánh → route sang COMPARE_SPECS
        // Ví dụ: "MacBook Air vs MacBook Pro cái nào tốt hơn", "iPhone 15 hay S24"
        const isCompare = /cai nao|ngon hon|tot hon|hay hon|dang mua hon|ban hon|manh hon|nhanh hon|thoi luong pin|nen chon|nen mua cai nao|so sanh|which is better/.test(msgN)
          && /vs|va |hay | hoac |hoac la/.test(msgN);
        if (isCompare) {
          intent = 'COMPARE_SPECS';
          console.log('[VI SecondaryFix] → COMPARE_SPECS (comparison query detected)');
        }
        // ── Từ khóa danh mục rõ ràng trong ASK_RECOMMEND ────────────────────
        // Ví dụ: "điện thoại oppo" bị NB classify thành ASK_RECOMMEND
        else {
          const hasCategoryKW = Object.keys(CATEGORY_KEYWORD_MAP).some(kw => msgN.includes(kw));
          if (hasCategoryKW && intent === 'ASK_RECOMMEND') {
            intent = 'SEARCH_CATEGORY';
            console.log('[VI SecondaryFix] → SEARCH_CATEGORY (category KW in ASK_RECOMMEND)');
          }
          else if (isPriceComplaint(message))     { intent = 'PRICE_COMPLAINT';  console.log('[VI SecondaryFix] → PRICE_COMPLAINT'); }
          else if (isPromoQuery(message))         { intent = 'ASK_PROMO';        console.log('[VI SecondaryFix] → ASK_PROMO'); }
          else if (isDeliveryQuery(message))      { intent = 'ASK_DELIVERY';     console.log('[VI SecondaryFix] → ASK_DELIVERY'); }
          else if (isReturnQuery(message))        { intent = 'ASK_RETURN';       console.log('[VI SecondaryFix] → ASK_RETURN'); }
          else if (isPaymentQuery(message))       { intent = 'ASK_PAYMENT';      console.log('[VI SecondaryFix] → ASK_PAYMENT'); }
          else if (isTrackOrderQuery(message))    { intent = 'TRACK_ORDER';      console.log('[VI SecondaryFix] → TRACK_ORDER'); }
          else if (isCancelOrderQuery(message))   { intent = 'CANCEL_ORDER';     console.log('[VI SecondaryFix] → CANCEL_ORDER'); }
          else if (isChangeProductQuery(message)) { intent = 'CHANGE_PRODUCT';   console.log('[VI SecondaryFix] → CHANGE_PRODUCT'); }
        }
      }
    }

    let aiResponse = { text: "Xin lỗi, tôi chưa hiểu ý bạn lắm. Bạn có thể nói rõ hơn được không?", link: null };

    if (intent === 'GREETING') {
      aiResponse.text = "Dạ Getshopy xin chào ạ! Hôm nay anh/chị đang muốn tìm điện thoại, laptop hay phụ kiện nào để em hỗ trợ tư vấn nhanh nhất ạ?";
    } 
    else if (intent === 'HELP') {
      aiResponse.text = "Dạ em là Trợ lý AI nội bộ của Getshopy đây ạ. Anh/chị cứ thoải mái cho em biết nhu cầu (mua máy làm việc, chơi game hay mua tặng), em sẽ lọc ra mẫu ưng ý nhất cho mình nhé!";
    }
    else if (intent === 'CONTACT') {
      aiResponse.text = "Dạ cửa hàng Getshopy có địa chỉ tại TP.HCM ạ. Anh/chị có muốn xem bản đồ không?";
      aiResponse.link = "/";
    }

    // ── NHÓM: HỎI KHUYẾN MÃI ──
    else if (intent === 'ASK_PROMO') {
      const activeSales = await prisma.flashSale.findMany({
        where: { is_deleted: false, is_active: true },
        take: 1
      });
      if (activeSales.length > 0) {
        aiResponse.text = `Dạ hiện bên em đang có chương trình **"${activeSales[0].title}"** giảm tới **${activeSales[0].discount_percent}%** luôn ạ! Anh/chị tranh thủ nhanh kẻo hết nhé. Xem ngay tại trang chủ ạ!`;
      } else {
        aiResponse.text = "Dạ hiện bên em chưa có Flash Sale đang chạy ạ. Nhưng anh/chị có thể để lại số điện thoại để em báo ngay khi có deal mới nhé! Hoặc ghé trang chủ xem sản phẩm đang giảm giá ạ.";
      }
      aiResponse.link = "/";
    }

    // ── NHÓM: HỎI GIAO HÀNG ──
    else if (intent === 'ASK_DELIVERY') {
      aiResponse.text = "Dạ bên em giao hàng toàn quốc ạ! Nội thành TP.HCM và Hà Nội giao trong **2–4 tiếng**, các tỉnh thành khác **1–3 ngày làm việc**. Đơn từ 500k được miễn phí ship ạ. Anh/chị muốn đặt hàng ngay không ạ?";
      aiResponse.link = "/";
    }

    // ── NHÓM: HỎI ĐỔI TRẢ BẢO HÀNH ──
    else if (intent === 'ASK_RETURN') {
      aiResponse.text = "Dạ Getshopy áp dụng chính sách **đổi trả trong 7 ngày** nếu sản phẩm lỗi do nhà sản xuất ạ. Bảo hành chính hãng **12 tháng**. Anh/chị yên tâm mua nhé, có vấn đề gì em hỗ trợ ngay ạ!";
      aiResponse.link = "/";
    }

    // ── NHÓM: HỎI THANH TOÁN ──
    else if (intent === 'ASK_PAYMENT') {
      aiResponse.text = "Dạ bên em hỗ trợ đa dạng hình thức thanh toán ạ: Tiền mặt, COD (nhận hàng trả tiền), chuyển khoản, thẻ tín dụng/ghi nợ, MoMo, ZaloPay, VNPAY. Đặc biệt **trả góp 0% lãi suất** qua thẻ tín dụng từ 3–24 tháng ạ!";
      aiResponse.link = "/";
    }

    // ── NHÓM: HỎI ĐÁNH GIÁ ──
    else if (intent === 'ASK_REVIEW') {
      const topProducts = await prisma.product.findMany({
        where: { is_deleted: false, stock: { gt: 0 } },
        orderBy: { id: 'desc' },
        take: 1
      });
      const top = topProducts[0];
      if (top) {
        aiResponse.text = `Dạ em xin phép tư vấn thật lòng ạ: Hiện bên em đang bán rất chạy dòng **${top.name}** và khách hàng phản hồi rất tích cực về chất lượng. Anh/chị muốn xem chi tiết không ạ?`;
        aiResponse.link = `/product/${top.id}`;
      } else {
        aiResponse.text = "Dạ sản phẩm bên em đều được kiểm định chất lượng trước khi đến tay khách hàng ạ. Anh/chị cứ yên tâm, có vấn đề gì em hỗ trợ đổi trả ngay nhé!";
      }
    }

    // ── NHÓM: KIỂM TRA TỒN KHO ──
    else if (intent === 'CHECK_STOCK') {
      const intentVerbs = new Set(['còn', 'hàng', 'không', 'shop', 'sẵn', 'có', 'gấp', 'bao', 'giờ', 'lại', 'rồi', 'hết', 'ngay', 'hôm', 'nay', 'được', 'cần']);
      const tokens = new (require('../ai/Tokenizer'))().tokenize(message);
      const entityKeywords = tokens.filter(w => !intentVerbs.has(w)).join(' ').trim();

      if (!entityKeywords) {
        aiResponse.text = "Dạ anh/chị muốn kiểm tra tồn kho của sản phẩm nào ạ? Cứ nói tên máy cho em, em check liền ạ!";
        return res.json(aiResponse);
      }

      const found = await prisma.product.findFirst({
        where: { name: { contains: entityKeywords, mode: 'insensitive' }, is_deleted: false }
      });

      if (found) {
        if (found.stock > 0) {
          aiResponse.text = `Dạ **${found.name}** hiện vẫn còn **${found.stock} sản phẩm** trong kho ạ! Anh/chị đặt ngay kẻo hết nhé, hàng đang rất hot đấy ạ.`;
          aiResponse.link = `/product/${found.id}`;
        } else {
          aiResponse.text = `Dạ rất tiếc, **${found.name}** hiện đã **tạm hết hàng** ạ. Anh/chị có muốn em gợi ý mẫu tương đương đang còn hàng không ạ?`;
          aiResponse.link = "/";
        }
      } else {
        aiResponse.text = "Dạ em chưa tìm thấy sản phẩm đó trong kho ạ. Anh/chị có thể nói rõ tên thương hiệu/model không để em kiểm tra chính xác hơn ạ?";
      }
    }

    // ── NHÓM: SO SÁNH SẢN PHẨM ──
    else if (intent === 'COMPARE_PRODUCT') {
      const intentVerbs = new Set(['so', 'sánh', 'hay', 'cái', 'nào', 'ngon', 'hơn', 'tốt', 'đáng', 'tiền', 'loại', 'khác', 'mua', 'khác', 'bền', 'mình', 'với', 'hai', 'này', 'điểm', 'gì']);
      const tokens = new (require('../ai/Tokenizer'))().tokenize(message);
      const entityKeywords = tokens.filter(w => !intentVerbs.has(w)).join(' ').trim();

      if (entityKeywords) {
        const found = await prisma.product.findMany({
          where: { name: { contains: entityKeywords, mode: 'insensitive' }, is_deleted: false },
          take: 1
        });
        if (found.length > 0) {
          const p = found[0];
          const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.price);
          aiResponse.text = `Dạ em xin phép tư vấn thật lòng ạ: **${p.name}** bên em đang bán rất chạy với giá **${formattedPrice}**. Đây là lựa chọn được nhiều khách tin dùng! Anh/chị đang so sánh với dòng nào để em phân tích chi tiết hơn ạ?`;
          aiResponse.link = `/product/${p.id}`;
        } else {
          aiResponse.text = "Dạ để em tư vấn so sánh chính xác, anh/chị có thể nói rõ tên 2 sản phẩm muốn so sánh không ạ? Ví dụ: \"iPhone 15 vs Samsung S24\" ạ.";
        }
      } else {
        aiResponse.text = "Dạ anh/chị muốn so sánh những dòng sản phẩm nào với nhau ạ? Em sẽ phân tích ưu/nhược điểm để anh/chị chọn được máy ưng ý nhất!";
      }
    }

    // ── NHÓM: GỢI Ý THEO NHU CẦU ──
    else if (intent === 'ASK_RECOMMEND') {
      // Phân tích xem có từ khóa về budget không
      const budgetMatch = message.match(/(\d+)\s*(triệu|tr|củ)/i);
      
      let recommendedProducts = [];
      if (budgetMatch) {
        const budget = parseInt(budgetMatch[1]) * 1_000_000;
        // Lọc sản phẩm trong khoảng ±20% budget
        recommendedProducts = await prisma.product.findMany({
          where: {
            is_deleted: false,
            stock: { gt: 0 },
            price: { lte: budget * 1.2, gte: budget * 0.5 }
          },
          take: 3
        });
      } else {
        // Không có budget, lấy sản phẩm bán chạy nhất (ID mới nhất)
        recommendedProducts = await prisma.product.findMany({
          where: { is_deleted: false, stock: { gt: 0 } },
          orderBy: { id: 'desc' },
          take: 3
        });
      }

      if (recommendedProducts.length > 0) {
        const names = recommendedProducts.map(p => `**${p.name}**`).join(', ');
        const budgetText = budgetMatch ? ` tầm ${budgetMatch[1]} triệu` : '';
        aiResponse.text = `Dạ với nhu cầu${budgetText}, em xin gợi ý: ${names} — đây đều là những mẫu đang bán rất chạy và được đánh giá cao ạ! Anh/chị muốn em tư vấn chi tiết cái nào không?`;
        aiResponse.link = `/product/${recommendedProducts[0].id}`;
      } else {
        aiResponse.text = "Dạ anh/chị cho em biết thêm nhu cầu sử dụng (học tập, làm việc, gaming, chụp ảnh) và khoảng ngân sách để em gợi ý chính xác nhất ạ!";
      }
    }

    // ── NHÓM: CHÊ MẮC / MẶC CẢ ──
    else if (intent === 'PRICE_COMPLAINT') {
      // Phát hiện xem khách có đề cập số tiền cụ thể không
      const budgetMatch = message.match(/(\d+)\s*(triệu|tr|củ|k|nghìn)/i);

      if (budgetMatch) {
        const budget = budgetMatch[1];
        const unit = budgetMatch[2].toLowerCase();
        const budgetVnd = unit === 'k' || unit === 'nghìn'
          ? parseInt(budget) * 1000
          : parseInt(budget) * 1_000_000;

        // Tìm sản phẩm phù hợp với budget
        const cheaper = await prisma.product.findMany({
          where: { is_deleted: false, stock: { gt: 0 }, price: { lte: budgetVnd } },
          orderBy: { price: 'desc' },
          take: 2
        });

        if (cheaper.length > 0) {
          const names = cheaper.map(p => `**${p.name}**`).join(' hoặc ');
          aiResponse.text = `Dạ em hiểu ạ! Với ngân sách đó thì bên em đang có ${names} — chất lượng rất ổn mà giá cực hợp lý đó ạ. Anh/chị xem thử nhé!`;
          aiResponse.link = `/product/${cheaper[0].id}`;
        } else {
          aiResponse.text = `Dạ với mức ngân sách ${budget} ${unit} thì hiện tại bên em chưa có mẫu phù hợp ạ. Anh/chị có thể tăng thêm một chút hoặc để em gợi ý hàng cũ/refurbished giá rẻ hơn không ạ?`;
        }
      } else {
        // Không có budget cụ thể, tư vấn chung
        const cheapest = await prisma.product.findMany({
          where: { is_deleted: false, stock: { gt: 0 } },
          orderBy: { price: 'asc' },
          take: 2
        });
        if (cheapest.length > 0) {
          const names = cheapest.map(p => {
            const price = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.price);
            return `**${p.name}** (${price})`;
          }).join(' và ');
          aiResponse.text = `Dạ em thông cảm ạ! Bên em cũng có nhiều mẫu giá tốt hơn đó, ví dụ như ${names}. Anh/chị cho em biết ngân sách khoảng bao nhiêu để em tìm mẫu phù hợp nhất nhé!`;
          aiResponse.link = `/product/${cheapest[0].id}`;
        } else {
          aiResponse.text = "Dạ em ghi nhận ạ! Anh/chị cho em biết budget tầm bao nhiêu để em tìm mẫu vừa đẹp vừa phù hợp túi tiền nhất cho mình nhé!";
        }
      }
    }

    // ── NHÓM: MUỐN ĐỔI MẶT HÀNG ──
    else if (intent === 'CHANGE_PRODUCT') {
      // Gợi ý 3 sản phẩm khác ngẫu nhiên từ DB
      const alternatives = await prisma.product.findMany({
        where: { is_deleted: false, stock: { gt: 0 } },
        orderBy: { id: 'desc' },
        take: 3
      });
      if (alternatives.length > 0) {
        const names = alternatives.map(p => `**${p.name}**`).join(', ');
        aiResponse.text = `Dạ không sao ạ, để em gợi ý thêm vài mẫu đang được khách hàng ưa chuộng: ${names}. Anh/chị thấy mẫu nào ưng mắt thì em tư vấn chi tiết thêm nhé!`;
        aiResponse.link = `/product/${alternatives[0].id}`;
      } else {
        aiResponse.text = "Dạ anh/chị cứ cho em biết mình đang cần dòng sản phẩm gì, em sẽ lọc ra các mẫu phù hợp nhất ngay ạ!";
      }
    }

    // ── NHÓM: THEO DÕI ĐƠN HÀNG ──
    else if (intent === 'TRACK_ORDER') {
      aiResponse.text = "Dạ để kiểm tra đơn hàng, anh/chị vui lòng đăng nhập vào tài khoản và vào mục **\"Đơn hàng của tôi\"** nhé ạ. Nếu đơn hàng chưa cập nhật sau 24h, anh/chị có thể liên hệ hotline **1800-xxxx** (miễn phí) để được hỗ trợ ngay ạ!";
      aiResponse.link = "/profile";
    }

    // ── NHÓM: HỦY ĐƠN HÀNG ──
    else if (intent === 'CANCEL_ORDER') {
      aiResponse.text = "Dạ em hiểu ạ. Để hủy đơn, anh/chị vào **\"Đơn hàng của tôi\"** → Chọn đơn cần hủy → Nhấn \"Hủy đơn\" nhé ạ. Lưu ý đơn hàng chỉ hủy được khi còn ở trạng thái **\"Đang xử lý\"**, nếu đã giao cho shipper thì anh/chị chờ nhận rồi hoàn hàng nhé ạ!";
      aiResponse.link = "/profile";
    }

    // ── NHÓM: HỎI QUÀ TẶNG KÈM ──
    else if (intent === 'ASK_GIFT') {
      aiResponse.text = "Dạ tùy từng sản phẩm sẽ có quà tặng kèm khác nhau ạ! Thông thường khi mua điện thoại sẽ có: **cáp sạc, củ sạc, ốp lưng** trong hộp. Mua laptop thường có **túi chống sốc**. Ngoài ra bên em hay có **khuyến mãi tặng tai nghe, bàn phím** theo từng đợt ạ. Anh/chị muốn em kiểm tra quà tặng kèm của sản phẩm cụ thể nào không?";
      aiResponse.link = "/";
    }

    // ── NHÓM: KHIẾU NẠI / PHÀN NÀN ──
    else if (intent === 'COMPLAINT') {
      aiResponse.text = "Dạ em thành thật xin lỗi về trải nghiệm không tốt của anh/chị ạ! 🙏 Em đã ghi nhận và sẽ chuyển ngay lên bộ phận chăm sóc khách hàng. Anh/chị vui lòng để lại **số điện thoại** hoặc **email** để đội ngũ hỗ trợ liên hệ lại trong vòng **30 phút** nhé ạ. Hoặc anh/chị có thể gọi ngay hotline **1800-xxxx** (miễn phí, 24/7) ạ.";
      aiResponse.link = "/";
    }

    // ── NHÓM: SO SÁNH CẤU HÌNH KỸ THUẬT ──
    else if (intent === 'COMPARE_SPECS') {
      // Bóc tách 2 tên sản phẩm từ câu hỏi (cách nhau bởi "và", "vs", "hay", "với")
      const splitPattern = /\s+(vs\.?|và|hay|với|hoặc)\s+/i;
      const rawParts = message.split(splitPattern).filter(p => p && !p.match(/^(vs\.?|và|hay|với|hoặc)$/i));

      // Loại bỏ phần đuôi "thì cái nào...", "cái nào ngon hơn", "mua cái nào" ra khỏi tên sản phẩm
      // Ví dụ: "MacBook Pro 14-inch M3 Pro thì cái nào chơi game ngon hơn" → "MacBook Pro 14-inch M3 Pro"
      const COMPARE_TRAILING_NOISE = /\s*(thì |thi |cai nao|ngon hon|tot hon|hay hon|dang mua|nen mua|choi game|hoc tap|lam viec|gaming|hon|nao|chon|tuyen|muon|nao tot|nao ngon)[\s\S]*/i;
      const cleanPart = (s) => removeDiacritics(s).replace(COMPARE_TRAILING_NOISE, '').trim();

      const parts = rawParts.map(cleanPart).filter(Boolean);

      if (parts.length >= 2) {
        // Tìm 2 sản phẩm trong DB (đã được clean khỏi trailing noise)
        const [p1, p2] = await Promise.all([
          prisma.product.findFirst({ where: { name: { contains: parts[0], mode: 'insensitive' }, is_deleted: false } }),
          prisma.product.findFirst({ where: { name: { contains: parts[parts.length - 1], mode: 'insensitive' }, is_deleted: false } })
        ]);

        if (p1 && p2) {
          const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
          // Xây dựng bảng so sánh từ dữ liệu thực trong DB
          const p1Desc = p1.description ? p1.description.substring(0, 80) + '...' : 'Xem thêm tại trang sản phẩm';
          const p2Desc = p2.description ? p2.description.substring(0, 80) + '...' : 'Xem thêm tại trang sản phẩm';

          aiResponse.text = [
            `Dạ đây là so sánh nhanh giữa **${p1.name}** và **${p2.name}** ạ:`,
            ``,
            `📱 **${p1.name}**`,
            `• Giá: ${fmt(p1.price)} | Đánh giá: ⭐ ${p1.rating}/5 | Đã bán: ${p1.sold}`,
            `• ${p1Desc}`,
            ``,
            `📱 **${p2.name}**`,
            `• Giá: ${fmt(p2.price)} | Đánh giá: ⭐ ${p2.rating}/5 | Đã bán: ${p2.sold}`,
            `• ${p2Desc}`,
            ``,
            `👉 Anh/chị muốn em tư vấn chọn cái nào dựa theo nhu cầu cụ thể không ạ?`
          ].join('\n');
          // Link về sản phẩm phổ biến hơn (sold nhiều hơn)
          aiResponse.link = `/product/${p1.sold >= p2.sold ? p1.id : p2.id}`;
        } else if (p1 || p2) {
          const found = p1 || p2;
          const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
          aiResponse.text = `Dạ em tìm thấy **${found.name}** (${fmt(found.price)}, ⭐${found.rating}/5). Anh/chị có thể nói rõ tên sản phẩm thứ 2 muốn so sánh để em phân tích chi tiết hơn không ạ?`;
          aiResponse.link = `/product/${found.id}`;
        } else {
          aiResponse.text = "Dạ anh/chị có thể nói rõ tên 2 sản phẩm muốn so sánh không ạ? Ví dụ: \"So sánh iPhone 15 vs Samsung S24\" hoặc \"MacBook Air và MacBook Pro cái nào tốt hơn\" ạ.";
        }
      } else {
        aiResponse.text = "Dạ để so sánh cấu hình, anh/chị vui lòng nêu tên cả 2 sản phẩm nhé ạ! Ví dụ: **\"iPhone 15 vs Samsung S24\"** hoặc **\"MacBook Air hay Dell XPS\"** ạ.";
      }
    }

    // ── NHÓM: SO SÁNH PHỤ KIỆN / BIẾN THỂ ĐI KÈM ──
    else if (intent === 'COMPARE_ACCESSORIES') {
      const intentVerbs = new Set(['có', 'màu', 'gì', 'nào', 'mấy', 'loại', 'dung', 'lượng', 'biến', 'thể', 'option', 'tặng', 'kèm', 'phụ', 'kiện', 'hộp', 'mua', 'lấy', 'combo']);
      const tokens = new (require('../ai/Tokenizer'))().tokenize(message);
      const entityKeywords = tokens.filter(w => !intentVerbs.has(w)).join(' ').trim();

      const found = entityKeywords
        ? await prisma.product.findFirst({ where: { name: { contains: entityKeywords, mode: 'insensitive' }, is_deleted: false } })
        : null;

      if (found) {
        // Đọc variants (màu sắc, bộ nhớ) và in ra
        let variantInfo = "Xem thêm chi tiết tại trang sản phẩm ạ.";
        try {
          const variants = Array.isArray(found.variants) ? found.variants : JSON.parse(found.variants || '[]');
          if (variants.length > 0) {
            // Nhóm theo key đầu tiên của variant (color, storage, ...)
            const variantSummary = variants.slice(0, 5).map(v => {
              const keys = Object.values(v).join(' / ');
              return `• ${keys}`;
            }).join('\n');
            variantInfo = `Hiện có các biến thể:\n${variantSummary}`;
          }
        } catch (e) { /* variants không phải JSON hợp lệ */ }

        aiResponse.text = [
          `Dạ thông tin phụ kiện & biến thể của **${found.name}** ạ:`,
          ``,
          variantInfo,
          ``,
          `📦 Trong hộp thường có: Cáp sạc, Củ sạc, Hướng dẫn sử dụng (tùy phiên bản).`,
          ``,
          `Anh/chị muốn xem cụ thể màu/dung lượng nào còn hàng không ạ?`
        ].join('\n');
        aiResponse.link = `/product/${found.id}`;
      } else {
        aiResponse.text = "Dạ anh/chị muốn xem biến thể màu sắc/dung lượng của sản phẩm nào ạ? Cứ nói tên máy cho em, em tra ngay nhé!";
      }
    }

    // ── NHÓM: TÌM KIẾM SẢN PHẨM (điện thoại, laptop, tablet, tai nghe, phụ kiện...) ──
    else if (['SEARCH_PRODUCT', 'ASK_PRICE', 'SEARCH_CATEGORY', 'ASK_SPECS', 'ASK_ACCESSORIES'].includes(intent)) {
      // Bước 1: Trích xuất từ khóa thực thể — loại bỏ động từ ý định
      const intentVerbs = new Set([
        'muốn', 'mua', 'tìm', 'kiếm', 'giá', 'bao', 'nhiêu', 'cho', 'hỏi',
        'xem', 'thông', 'tin', 'có', 'bán', 'không', 'shop', 'ơi', 'tiền',
        'cái', 'con', 'chiếc', 'cấu', 'hình', 'ram', 'chip', 'số', 'màn',
        'pin', 'bộ', 'nhớ', 'inch', 'cần', 'tôi', 'mình', 'em',
      ]);
      const tokens = new (require('../ai/Tokenizer'))().tokenize(message);
      const entityKeywords = tokens.filter(w => !intentVerbs.has(w)).join(' ').trim();
      const msgNorm = removeDiacritics(message).toLowerCase();

      if (!entityKeywords) {
        aiResponse.text = 'Dạ anh/chị cứ nói thoải mái nhé! Bên em có: **Điện thoại thông minh**, **Laptop**, **Máy tính bảng**, và **Phụ kiện** (tai nghe, đồng hồ, micro, loa...). Anh/chị cần tìm gì ạ?';
        return res.json(aiResponse);
      }

      // ── CẤP 1: Tìm sản phẩm theo tên cụ thể trong Database ──
      let foundProducts = await prisma.product.findMany({
        where: { name: { contains: entityKeywords, mode: 'insensitive' }, is_deleted: false },
        orderBy: { sold: 'desc' },
        take: 1
      });

      if (foundProducts.length > 0) {
        // Tìm thấy sản phẩm cụ thể
        const p = foundProducts[0];
        const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.price);
        if (intent === 'ASK_PRICE') {
          aiResponse.text = `Dạ siêu phẩm **${p.name}** bên em hiện đang có giá cực sốc chỉ **${formattedPrice}** thôi ạ. Không biết anh/chị thích bản màu nào để em check xem kho còn hàng không nhé?`;
        } else if (intent === 'ASK_SPECS') {
          const shortDesc = p.description ? (p.description.substring(0, 100) + '...') : 'Thiết kế sang trọng, hiệu năng mạnh mẽ.';
          aiResponse.text = `Dạ về cấu hình, dòng **${p.name}** nổi bật với: ${shortDesc} Anh/chị click vào "Xem ngay" để đọc chi tiết thông số RAM, Chip, Màn hình nhé ạ.`;
        } else {
          aiResponse.text = `Dạ bên em đang sẵn hàng **${p.name}** giá chỉ **${formattedPrice}** ạ. Dòng này đang bán rất chạy! Anh/chị muốn xem thêm hình ảnh chi tiết không ạ?`;
        }
        aiResponse.link = `/product/${p.id}`;

      } else {
        // ── CẤP 2: Tìm theo bảng CATEGORY_KEYWORD_MAP (tai nghe, đồng hồ...) ──
        const matchedCatName = Object.entries(CATEGORY_KEYWORD_MAP)
          .find(([kw]) => msgNorm.includes(kw))?.[1];

        if (matchedCatName) {
          const category = await prisma.category.findFirst({
            where: { name: { contains: matchedCatName, mode: 'insensitive' } }
          });

          if (category) {
            // Phát hiện thương hiệu (brand) trong tin nhắn để lọc thêm
            const brand = BRAND_KEYWORDS.find(b => msgNorm.includes(b));

            const catProducts = await prisma.product.findMany({
              where: {
                category_id: category.id,
                is_deleted: false,
                stock: { gt: 0 },
                ...(brand ? { name: { contains: brand, mode: 'insensitive' } } : {})
              },
              orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
              take: 3
            });

            const fmt = n => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

            if (catProducts.length > 0) {
              const productList = catProducts.map(p =>
                `• **${p.name}** — ${fmt(p.price)} (⭐${p.rating}/5, đã bán: ${p.sold})`
              ).join('\n');
              const brandStr = brand
                ? ` thương hiệu **${brand.charAt(0).toUpperCase() + brand.slice(1)}**`
                : '';
              aiResponse.text = `Dạ bên em đang có các **${category.name}**${brandStr} được ưa chuộng nhất ạ:\n\n${productList}\n\nAnh/chị muốn em tư vấn chi tiết mẫu nào, hoặc cho em biết ngân sách để em lọc chính xác hơn nhé ạ!`;
              aiResponse.link = `/category/${category.id}`;
            } else {
              const brandStr = brand ? ` thương hiệu **${brand}**` : '';
              aiResponse.text = `Dạ bên em hiện chưa có **${category.name}**${brandStr} trong kho ạ. Anh/chị có muốn xem thương hiệu khác trong danh mục này không ạ?`;
              aiResponse.link = `/`;
            }
          } else {
            // Category name tìm trong DB không ra (tên DB khác)
            aiResponse.text = `Dạ bên em có 4 danh mục chính: **Điện thoại thông minh**, **Máy tính xách tay**, **Máy tính bảng**, và **Phụ kiện công nghệ** (tai nghe, đồng hồ thông minh, micro, loa...). Anh/chị muốn xem loại nào ạ?`;
          }

        } else {
          // ── CẤP 3: Thử tìm theo tên danh mục trực tiếp ──
          const foundCategories = await prisma.category.findMany({
            where: { name: { contains: entityKeywords, mode: 'insensitive' } },
            take: 1
          });

          if (foundCategories.length > 0) {
            aiResponse.text = `Dạ bên em đang có rất nhiều mẫu mã thuộc dòng **${foundCategories[0].name}**. Anh/chị đang nhắm tới thương hiệu nào (Apple, Samsung, Dell...) hay có mức ngân sách tầm bao nhiêu để em lựa máy ngon nhất không ạ?`;
            aiResponse.link = `/category/${foundCategories[0].id}`;
          } else {
            // ── CẤP 4: Fallback thân thiện ──
            aiResponse.text = `Dạ em chưa tìm thấy sản phẩm "${entityKeywords}" trong kho ạ. Bên em đang có:\n• 📱 **Điện thoại thông minh** (iPhone, Samsung, Xiaomi, Oppo...)\n• 💻 **Laptop** (MacBook, Dell, Asus, HP...)\n• 📱 **Máy tính bảng** (iPad, Samsung Tab...)\n• 🎧 **Phụ kiện** (tai nghe, đồng hồ thông minh, micro, loa...)\n\nAnh/chị muốn tìm sản phẩm nào ạ?`;
            aiResponse.link = '/';
          }
        }
      }
    }

    // ── FALLBACK: Thử xử lý bảng Handler mở rộng nếu chưa có kết quả ở trên
    if (aiResponse.text === "Xin lỗi, tôi chưa hiểu ý bạn lắm. Bạn có thể nói rõ hơn được không?") {
      const sessionId = req.ip || req.headers['x-forwarded-for'] || 'default';
      const expandedResult = await handleExpandedIntent(intent, message, sessionId);
      if (expandedResult) {
        aiResponse.text = expandedResult.text;
        aiResponse.link = expandedResult.link;
      }
    }

    res.json(aiResponse);
  } catch (err) {
    console.error("AI Chat Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

