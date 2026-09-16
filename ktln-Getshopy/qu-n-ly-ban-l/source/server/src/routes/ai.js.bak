const express = require('express');
const { prisma } = require('../db');
const router = express.Router();

// ── AI Modules ──────────────────────────────────────────────────────────────
const { classifyIntent, removeDiacritics } = require('../ai/huggingface');
const { generateChatResponse }             = require('../ai/llm');
const { analyzeProductImage }              = require('../ai/visualSearch');

// ── Định dạng tiền tệ ────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

// ── Keyword map: từ khoá → tên danh mục ──────────────────────────────────────
const CATEGORY_KEYWORD_MAP = {
  'dien thoai':  'Điện thoại thông minh',
  'smartphone':  'Điện thoại thông minh',
  'android':     'Điện thoại thông minh',
  'laptop':      'Máy tính xách tay',
  'may tinh xach tay': 'Máy tính xách tay',
  'may tinh bang': 'Máy tính bảng',
  'tablet':      'Máy tính bảng',
  'tai nghe':    'Phụ kiện công nghệ',
  'dong ho thong minh': 'Đồng hồ thông minh',
  'smartwatch':  'Đồng hồ thông minh',
  'dong ho':     'Phụ kiện công nghệ',
  'loa':         'Phụ kiện công nghệ',
  'tivi':        'Tivi & Thiết bị giải trí',
  'tv':          'Tivi & Thiết bị giải trí',
  'may anh':     'Máy ảnh & Quay phim',
  'camera':      'Máy ảnh & Quay phim',
  'am thanh':    'Thiết bị âm thanh',
  'gaming':      'Gaming',
  'nha thong minh': 'Nhà thông minh',
  'van phong':   'Thiết bị văn phòng',
  'linh kien':   'Linh kiện máy tính',
};

// ── Lưu ChatLog vào DB (async, không block response) ──────────────────────────
async function saveChatLog({ sessionId, customerId, message, response, intent, score, source }) {
  try {
    await prisma.chatLog.create({
      data: {
        session_id:  String(sessionId || 'unknown'),
        customer_id: customerId ? BigInt(customerId) : null,
        message:     String(message).slice(0, 2000),
        response:    String(response).slice(0, 4000),
        intent:      String(intent),
        score:       Number(score) || 0,
        source:      String(source || 'llm'),
      }
    });
  } catch (err) {
    console.warn('[ChatLog] Lưu log thất bại:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD CONTEXT — Query DB theo intent để đưa vào prompt cho LLM
// ─────────────────────────────────────────────────────────────────────────────
async function buildContext(intent, message) {
  const norm    = removeDiacritics(message).toLowerCase();
  let products  = [];
  let policy    = null;
  let link      = null;

  try {
    switch (intent) {

      // ── Tìm sản phẩm / Hỏi giá / Hỏi specs ──────────────────────────────
      case 'SEARCH_PRODUCT':
      case 'ASK_PRICE':
      case 'ASK_SPECS':
      case 'ASK_ACCESSORIES':
      case 'SEARCH_CATEGORY': {
        // Bước 1: Trích ngân sách nếu có (dưới X triệu / tầm X triệu)
        const budgetMatch = message.match(/(\d+[\d.,]*)\s*(triệu|tr\b|củ|k\b|nghìn)/i);
        let priceFilter = {};
        if (budgetMatch) {
          const unit = budgetMatch[2].toLowerCase();
          const val  = parseFloat(budgetMatch[1].replace(',', '.'));
          const vnd  = (unit === 'k' || unit === 'nghìn') ? val * 1_000 : val * 1_000_000;
          // "dưới X" hoặc "tầm X" → lấy ±30%
          priceFilter = /duoi|dưới/.test(norm)
            ? { lte: vnd }
            : { lte: vnd * 1.3, gte: vnd * 0.7 };
        }

        const stopWords = new Set([
          'muon','mua','tim','xem','gia','bao','nhieu','co','ban','khong',
          'shop','oi','can','toi','minh','em','ban','cho','hoi','ve',
          'duoi','tam','khoang','nao','gi','nhu','the','nay','do',
          'tiep','theo','la','nua','them','voi','nhe','nha'
        ]);
        
        let normClean = norm
          .replace(/may tinh xach tay|may tinh/g, 'laptop')
          .replace(/dien thoai/g, 'smartphone')
          .replace(/may tinh bang/g, 'tablet')
          .replace(/\btv\b/g, 'tivi');

        // Bước 2: Tìm theo danh mục keyword và các từ khóa thêm
        let matchedKw = null;
        let matchedCatName = null;
        for (const [kw, catName] of Object.entries(CATEGORY_KEYWORD_MAP)) {
          if (new RegExp(`\\b${kw}\\b`).test(normClean)) {
            matchedCatName = catName;
            matchedKw = kw;
            break;
          }
        }

        if (matchedCatName) {
          const category = await prisma.category.findFirst({
            where: { name: { contains: matchedCatName, mode: 'insensitive' } }
          });
          if (category) {
            const extraTokens = normClean.replace(matchedKw, '').split(/\s+/).filter(w => !stopWords.has(w) && w.length > 1);
            if (extraTokens.length > 0) {
              products = await prisma.product.findMany({
                where: {
                  category_id: category.id,
                  OR: extraTokens.map(t => ({ name: { contains: t, mode: 'insensitive' } })),
                  is_deleted: false,
                  stock: { gt: 0 },
                  ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
                }
              });
              if (products.length > 0) {
                products.forEach(p => {
                  p._score = extraTokens.filter(t => p.name.toLowerCase().includes(t.toLowerCase())).length;
                });
                products.sort((a, b) => b._score - a._score || b.sold - a.sold);
                products = products.slice(0, 4);
              }
            }
            
            // Fallback nếu extraTokens không có hoặc không tìm thấy sp nào (ví dụ user type "tiếp theo là tv nữa")
            if (products.length === 0) {
              products = await prisma.product.findMany({
                where: {
                  category_id: category.id,
                  is_deleted: false,
                  stock: { gt: 0 },
                  ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
                },
                orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
                take: 4,
              });
            }
            link = `/shop?category=${category.id}`;
          }
        }

        // Bước 3: Nếu chưa có, tìm theo tên sản phẩm cụ thể (Tối ưu full-text JS)
        if (products.length === 0) {
          const tokens = normClean.split(/\s+/).filter(w => !stopWords.has(w) && w.length > 1);
          if (tokens.length > 0) {
            let candidateProducts = await prisma.product.findMany({
              where: {
                OR: tokens.map(t => ({ name: { contains: t, mode: 'insensitive' } })),
                is_deleted: false,
                ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
              },
              take: 50,
            });
            if (candidateProducts.length > 0) {
              candidateProducts.forEach(p => {
                p._score = tokens.filter(t => p.name.toLowerCase().includes(t.toLowerCase())).length;
              });
              candidateProducts.sort((a, b) => b._score - a._score || b.sold - a.sold);
              products = candidateProducts.slice(0, 4);
              if (products.length > 0) {
                link = `/product/${products[0].id}`;
              }
            }
          }
        }

        // Bước 4: Fallback — sản phẩm bán chạy nhất
        if (products.length === 0) {
          products = await prisma.product.findMany({
            where: { is_deleted: false, stock: { gt: 0 } },
            orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
            take: 4,
          });
          link = '/shop';
        }
        break;
      }

      // ── Gợi ý / Tư vấn chọn máy ──────────────────────────────────────────
      case 'ASK_RECOMMEND': {
        const budgetMatch = message.match(/(\d+[\d.,]*)\s*(triệu|tr\b|củ)/i);
        let whereClause = { is_deleted: false, stock: { gt: 0 } };
        if (budgetMatch) {
          const budget = parseFloat(budgetMatch[1]) * 1_000_000;
          whereClause.price = { lte: budget * 1.2, gte: budget * 0.5 };
        }
        products = await prisma.product.findMany({
          where: whereClause,
          orderBy: [{ rating: 'desc' }, { sold: 'desc' }],
          take: 4,
        });
        if (products[0]) link = `/product/${products[0].id}`;
        break;
      }

      // ── So sánh sản phẩm ──────────────────────────────────────────────────
      case 'COMPARE_PRODUCT':
      case 'COMPARE_SPECS': {
        // Tách tên 2 sản phẩm bằng "vs", "và", "hay", "với"
        const splitPat = /\s+(vs\.?|và|hay|với|hoặc)\s+/i;
        const parts = message.split(splitPat)
          .filter(s => s.length > 2 && !/^(vs\.?|và|hay|với|hoặc)$/i.test(s));

        if (parts.length >= 2) {
          const [p1, p2] = await Promise.all([
            prisma.product.findFirst({
              where: { name: { contains: parts[0].trim(), mode: 'insensitive' }, is_deleted: false }
            }),
            prisma.product.findFirst({
              where: { name: { contains: parts[parts.length - 1].trim(), mode: 'insensitive' }, is_deleted: false }
            }),
          ]);
          if (p1) products.push(p1);
          if (p2) products.push(p2);
          if (products[0]) link = `/product/${products[0].id}`;
        }

        // Nếu không tách được → lấy top sản phẩm bán chạy để LLM tự gợi ý
        if (products.length === 0) {
          products = await prisma.product.findMany({
            where: { is_deleted: false, stock: { gt: 0 } },
            orderBy: { sold: 'desc' },
            take: 4,
          });
        }
        break;
      }

      // ── Kiểm tra tồn kho ──────────────────────────────────────────────────
      case 'CHECK_STOCK': {
        const stopWords = new Set(['con','hang','khong','shop','san','co','gấp','het','ngay']);
        const tokens = norm.split(/\s+/).filter(w => !stopWords.has(w) && w.length > 1);
        const keyword = tokens.join(' ').trim();
        if (keyword) {
          const found = await prisma.product.findFirst({
            where: { name: { contains: keyword, mode: 'insensitive' }, is_deleted: false }
          });
          if (found) {
            products = [found];
            link = `/product/${found.id}`;
          }
        }
        break;
      }

      // ── Sản phẩm bán chạy ─────────────────────────────────────────────────
      case 'ASK_BEST_SELLER': {
        products = await prisma.product.findMany({
          where: { is_deleted: false },
          orderBy: { sold: 'desc' },
          take: 4,
        });
        break;
      }

      // ── Sản phẩm mới nhất ─────────────────────────────────────────────────
      case 'ASK_NEW_ARRIVAL': {
        products = await prisma.product.findMany({
          where: { is_deleted: false },
          orderBy: { id: 'desc' },
          take: 4,
        });
        break;
      }

      // ── Khuyến mãi / Flash sale ───────────────────────────────────────────
      case 'ASK_PROMO': {
        const activeSales = await prisma.flashSale.findMany({
          where: { is_deleted: false, is_active: true },
          take: 3,
        });
        if (activeSales.length > 0) {
          policy = 'CHƯƠNG TRÌNH KHUYẾN MÃI ĐANG CHẠY:\n' +
            activeSales.map(s =>
              `- "${s.title}": giảm ${s.discount_percent}%` +
              (s.end_date ? `, kết thúc ${new Date(s.end_date).toLocaleDateString('vi-VN')}` : '')
            ).join('\n');
        }
        // Lấy sản phẩm đang sale
        products = await prisma.product.findMany({
          where: { is_deleted: false, stock: { gt: 0 } },
          orderBy: { sold: 'desc' },
          take: 3,
        });
        link = '/shop';
        break;
      }

      // ── Chê mắc / Mặc cả ─────────────────────────────────────────────────
      case 'PRICE_COMPLAINT': {
        const budgetMatch = message.match(/(\d+[\d.,]*)\s*(triệu|tr\b|củ|k\b|nghìn)/i);
        if (budgetMatch) {
          const unit = budgetMatch[2].toLowerCase();
          const val  = parseFloat(budgetMatch[1]);
          const vnd  = (unit === 'k' || unit === 'nghìn') ? val * 1_000 : val * 1_000_000;
          products = await prisma.product.findMany({
            where: { is_deleted: false, stock: { gt: 0 }, price: { lte: vnd } },
            orderBy: { price: 'desc' },
            take: 3,
          });
        } else {
          products = await prisma.product.findMany({
            where: { is_deleted: false, stock: { gt: 0 } },
            orderBy: { price: 'asc' },
            take: 3,
          });
        }
        if (products[0]) link = `/product/${products[0].id}`;
        break;
      }

      // ── Giao hàng ─────────────────────────────────────────────────────────
      case 'ASK_DELIVERY':
        policy = 'Nội thành TP.HCM & HN: giao 2–4 tiếng. Tỉnh thành: 1–3 ngày. Miễn phí ship đơn từ 500k. Giao hỏa tốc có phụ phí.';
        link = null;
        break;

      // ── Đổi trả / Bảo hành ───────────────────────────────────────────────
      case 'ASK_RETURN':
        policy = 'Đổi trả trong 7 ngày nếu lỗi NSX. Bảo hành chính hãng 12 tháng. Sản phẩm lỗi do người dùng không áp dụng.';
        link = null;
        break;

      // ── Thanh toán ────────────────────────────────────────────────────────
      case 'ASK_PAYMENT':
        policy = 'Hỗ trợ: Tiền mặt, COD, chuyển khoản, MoMo, ZaloPay, VNPAY, Visa/Mastercard. Trả góp 0% lãi suất 3–24 tháng qua thẻ tín dụng.';
        link = null;
        break;

      // ── Theo dõi đơn hàng ─────────────────────────────────────────────────
      case 'TRACK_ORDER':
        policy = 'Đăng nhập → Đơn hàng của tôi để xem trạng thái. Hotline hỗ trợ 24/7: 1800-xxxx (miễn phí).';
        link = '/profile';
        break;

      // ── Hủy đơn ───────────────────────────────────────────────────────────
      case 'CANCEL_ORDER':
        policy = 'Hủy đơn: Đăng nhập → Đơn hàng của tôi → Chọn đơn → Hủy đơn. Chỉ hủy được khi đơn còn ở trạng thái "Đang xử lý".';
        link = '/profile';
        break;

      // ── Liên hệ ───────────────────────────────────────────────────────────
      case 'CONTACT':
        policy = 'Địa chỉ: TP.HCM. Hotline: 1800-xxxx (miễn phí, 24/7). Email: support@getshopy.vn. Facebook/Zalo: Getshopy Official.';
        link = null;
        break;

      // ── Thu cũ đổi mới ────────────────────────────────────────────────────
      case 'ASK_TRADE_IN': {
        products = await prisma.product.findMany({
          where: { is_deleted: false, stock: { gt: 0 } },
          orderBy: { sold: 'desc' },
          take: 3,
        });
        policy = 'Getshopy hỗ trợ thu cũ đổi mới. Định giá miễn phí tại cửa hàng, giá thu tốt nhất thị trường.';
        if (products[0]) link = `/product/${products[0].id}`;
        break;
      }

      // ── Hàng cũ / Refurbished ─────────────────────────────────────────────
      case 'ASK_SECOND_HAND':
        policy = 'Getshopy bán máy refurbished (tân trang) được kiểm tra 100+ điểm, bảo hành 6 tháng, giảm 15–25% so với hàng mới.';
        link = null;
        break;

      // Các intent còn lại không cần DB
      default:
        break;
    }
  } catch (err) {
    console.warn(`[buildContext] Query thất bại cho intent=${intent}:`, err.message);
  }

  return { products, policy, link };
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK RESPONSE — Dùng khi LLM không khả dụng
// ─────────────────────────────────────────────────────────────────────────────
function fallbackResponse(intent, context) {
  const { products, link } = context;

  if (products.length > 0) {
    const list = products.slice(0, 3)
      .map(p => `**${p.name}** — ${fmt(p.price)}`)
      .join(', ');
    return {
      text: `Dạ bên em đang có: ${list}. Anh/chị muốn tư vấn chi tiết sản phẩm nào không ạ?`,
      link,
      products
    };
  }

  const defaults = {
    GREETING:         { text: 'Dạ Getshopy xin chào ạ! Anh/chị đang cần tìm điện thoại, laptop hay phụ kiện gì ạ?', link: null },
    ASK_DELIVERY:     { text: 'Dạ giao nội thành 2–4 tiếng, tỉnh thành 1–3 ngày, miễn phí ship từ 500k ạ!', link: null },
    ASK_RETURN:       { text: 'Dạ đổi trả 7 ngày, bảo hành 12 tháng chính hãng ạ!', link: null },
    ASK_PAYMENT:      { text: 'Dạ hỗ trợ COD, MoMo, ZaloPay, trả góp 0% ạ!', link: null },
    TRACK_ORDER:      { text: 'Dạ anh/chị vào mục "Đơn hàng của tôi" để kiểm tra nhé ạ!', link: '/profile' },
    CANCEL_ORDER:     { text: 'Dạ vào "Đơn hàng của tôi" → Chọn đơn → Hủy đơn nhé ạ!', link: '/profile' },
    FEEDBACK_POSITIVE:{ text: 'Dạ cảm ơn anh/chị rất nhiều! 🌟 Getshopy luôn cố gắng phục vụ tốt nhất ạ!', link: null },
    COMPLAINT:        { text: 'Dạ em thành thật xin lỗi! Anh/chị liên hệ hotline 1800-xxxx để được hỗ trợ ngay ạ!', link: null },
  };

  return defaults[intent] || {
    text: 'Dạ anh/chị cần tư vấn sản phẩm nào? Bên em có điện thoại, laptop, máy tính bảng và phụ kiện ạ!',
    link: null,
  };
}

// NOTE: /api/b2c/products is handled by routes/b2c.js — do not duplicate here.

// NOTE: /api/b2c/flash-sales is handled by routes/b2c.js — do not duplicate here.

// ══════════════════════════════════════════════════════════════════════════════
// 3. POST /api/b2c/chat — AI Chatbot
//    Pipeline: classifyIntent → buildContext (DB) → generateChatResponse (LLM)
// ══════════════════════════════════════════════════════════════════════════════
router.post('/b2c/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const sessionId = req.ip || req.headers['x-forwarded-for'] || 'default';

    // ── BƯỚC 1: Phân loại intent (mDeBERTa + rule-based) ──────────────────
    const { intent, score, source } = await classifyIntent(message);
    console.log(`[Chat] "${message.slice(0,50)}" → ${intent} (${score.toFixed?.(3) ?? score}, ${source})`);

    // ── BƯỚC 2: Query DB theo intent để lấy context thực ──────────────────
    const context = await buildContext(intent, message);

    // ── BƯỚC 3: Sinh câu trả lời bằng LLM ────────────────────────────────
    let responseText = null;
    try {
      responseText = await generateChatResponse({
        intent,
        context,
        message,
        history,
      });
    } catch (llmErr) {
      console.warn('[Chat] LLM generation failed:', llmErr.message);
    }

    // ── BƯỚC 4: Fallback nếu LLM không khả dụng ──────────────────────────
    const aiResponse = responseText
      ? { text: responseText, link: context.link, products: context.products }
      : fallbackResponse(intent, context);

    // ── Lưu ChatLog (fire-and-forget) ────────────────────────────────────
    let customerId = null;
    try {
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
        customerId = decoded.id || decoded.customerId || null;
      }
    } catch (_) { /* chưa đăng nhập */ }

    saveChatLog({
      sessionId, customerId, message,
      response: aiResponse.text,
      intent, score, source,
    });

    res.json(aiResponse);

  } catch (err) {
    console.error('[Chat Error]', err.message);
    res.json({
      text: 'Dạ em đang gặp sự cố kỹ thuật nhỏ. Anh/chị vui lòng thử lại sau ít phút nhé ạ!',
      link: null,
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI SMART SEARCH — Hiểu câu tìm kiếm mơ hồ / ngôn ngữ tự nhiên
// POST /api/ai/smart-search
// Body: { query: string }
// Returns: { products: [], hint: string, keywords: string[] }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/ai/smart-search', async (req, res) => {
  const { query } = req.body;
  if (!query || !String(query).trim()) {
    return res.status(400).json({ error: 'query is required' });
  }

  const rawQuery = String(query).trim();

  try {
    // ── BƯỚC 1: Gọi LLM để extract search keywords từ câu mơ hồ ─────────────
    const HF_API_KEY_SS  = process.env.HF_API_KEY;
    const HF_LLM_MODEL_SS = process.env.HF_LLM_MODEL || 'Qwen/Qwen2.5-72B-Instruct';
    const HF_LLM_URL_SS   = 'https://router.huggingface.co/featherless-ai/v1/chat/completions';

    let keywords = [];
    let categoryHint = null;
    let priceMax = null;
    let priceMin = null;
    let hint = '';

    if (HF_API_KEY_SS) {
      const systemPrompt = `Bạn là AI trợ lý tìm kiếm sản phẩm cho cửa hàng điện tử Getshopy.
Nhiệm vụ: Phân tích câu tìm kiếm của khách hàng (có thể là ngôn ngữ thông thường, slang, mơ hồ) 
và trả về JSON với các trường sau:
- "keywords": mảng tối đa 3 từ khóa tìm kiếm SẢN PHẨM QUAN TRỌNG NHẤT (TIẾNG VIỆT CÓ DẤU, danh từ chính yếu để tra cứu DB, hoặc tên thương hiệu). QUAN TRỌNG: Chỉ đưa vào keywords những từ THỰC SỰ đặc trưng cho sản phẩm cần tìm. Tên thương hiệu (Sony, Apple, Samsung...) và tên sản phẩm (màn hình, laptop, tai nghe...) là keywords tốt. KHÔNG đưa vào các từ mô tả chung chung như "tốt", "xịn", "cao cấp" trừ khi đó là tên model.
- "brand": tên thương hiệu riêng biệt nếu có (ví dụ: "Sony", "Apple", "Samsung", null nếu không đề cập). Đây là trường riêng, không lặp lại trong keywords.
- "category": tên danh mục nếu xác định được (chọn CHÍNH XÁC một trong: "Điện thoại thông minh", "Máy tính xách tay", "Máy tính bảng", "Phụ kiện công nghệ", "Tivi & Thiết bị giải trí", "Màn hình máy tính", "Máy ảnh & Quay phim", "Đồng hồ thông minh", "Máy chơi game", "Thiết bị nhà thông minh", "Thiết bị mạng", "Thiết bị âm thanh", null nếu không rõ). LƯU Ý QUAN TRỌNG: "màn hình", "monitor", "display" → "Màn hình máy tính"; "tivi", "TV" → "Tivi & Thiết bị giải trí"; "tai nghe", "loa", "headphone", "earphone", "earbuds", "speaker", "âm thanh" → "Thiết bị âm thanh".
- "price_max": ngân sách tối đa (số nguyên, đơn vị VNĐ, null nếu không đề cập). LƯU Ý: "dưới X triệu" = X*1000000, "tầm X triệu" = X*1000000, "X trieu" = X*1000000.
- "price_min": ngân sách tối thiểu (số nguyên, đơn vị VNĐ, null nếu không đề cập)  
- "hint": câu giải thích ngắn về kết quả tìm kiếm bằng tiếng Việt (ví dụ: "Màn hình máy tính Sony")

Ví dụ:
- "màn hình của Sony" → {"keywords":["màn hình"],"brand":"Sony","category":"Màn hình máy tính","price_max":null,"price_min":null,"hint":"Màn hình máy tính Sony"}
- "điện thoại Samsung dưới 10 triệu" → {"keywords":["điện thoại"],"brand":"Samsung","category":"Điện thoại thông minh","price_max":10000000,"price_min":null,"hint":"Điện thoại Samsung tầm trung"}
- "tai nghe dưới 10 triệu" → {"keywords":["tai nghe"],"brand":null,"category":"Thiết bị âm thanh","price_max":10000000,"price_min":null,"hint":"Tai nghe dưới 10 triệu"}
- "tai nghe chống ồn" → {"keywords":["tai nghe","chống ồn"],"brand":null,"category":"Thiết bị âm thanh","price_max":null,"price_min":null,"hint":"Tai nghe chống ồn chủ động (ANC)"}
- "máy tính làm đồ họa dưới 30 triệu" → {"keywords":["đồ họa"],"brand":null,"category":"Máy tính xách tay","price_max":30000000,"price_min":null,"hint":"Laptop cấu hình mạnh cho thiết kế đồ họa"}

Chỉ trả về JSON thuần, không có markdown hay text bổ sung.`;


      try {
        const response = await fetch(HF_LLM_URL_SS, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HF_API_KEY_SS}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: HF_LLM_MODEL_SS,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user',   content: rawQuery },
            ],
            temperature: 0.3,
            max_tokens: 200,
            stream: false,
          }),
          signal: AbortSignal.timeout(20_000),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data?.choices?.[0]?.message?.content?.trim();
          if (content) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              keywords    = Array.isArray(parsed.keywords) ? parsed.keywords : [];
              // Đưa brand vào đầu keywords list nếu có (brand là filter quan trọng nhất)
              const brand = parsed.brand ? String(parsed.brand).trim() : null;
              if (brand && !keywords.some(k => removeDiacritics(k).toLowerCase() === removeDiacritics(brand).toLowerCase())) {
                keywords = [brand, ...keywords];
              }
              categoryHint = parsed.category || null;
              priceMax    = parsed.price_max ? Number(parsed.price_max) : null;
              priceMin    = parsed.price_min ? Number(parsed.price_min) : null;
              hint        = parsed.hint || '';
              console.log(`[SmartSearch] HF Qwen parsed → keywords=${JSON.stringify(keywords)}, brand=${brand}, category=${categoryHint}, hint="${hint}"`);
            }
          }
        }
      } catch (llmErr) {
        console.warn('[SmartSearch] HF Qwen failed, using fallback keyword split:', llmErr.message);
      }
    }

    // ── Fallback: tách từ thủ công nếu LLM thất bại ─────────────────────────
    if (keywords.length === 0) {
      const norm = removeDiacritics(rawQuery).toLowerCase();
      const stopWords = new Set(['toi','muon','can','mua','tim','kiem','cho','mot','cai','san','pham','cua','va','hoac','hay','la','de','xem','gia']);
      keywords = norm.split(/\s+/).filter(w => !stopWords.has(w) && w.length > 1).slice(0, 4);
      hint = `Kết quả cho "${rawQuery}"`;
    }

    // ── BƯỚC 2: Query DB ─────────────────────────────────────────────────────
    // Chiến lược:
    //   A. Có category + keywords → filter cứng category, tìm keyword trong NAME
    //   B. Có category, không keywords → top bán chạy của category
    //   C. Chỉ có keywords → tìm keyword trong NAME (không description → tránh false positive)
    //   D. Fallback → top sellers toàn shop
    let products = [];
    const allCategories = await prisma.category.findMany({});
    const categoryMap = {};
    allCategories.forEach(c => categoryMap[c.id] = c.name);

    const priceFilter = {};
    if (priceMax) priceFilter.lte = priceMax;
    if (priceMin) priceFilter.gte = priceMin;

    let matchedCatId = null;
    let matchedCatName = null;
    if (categoryHint) {
      // Tìm category khớp TỐT NHẤT (ưu tiên khớp đầy đủ hơn khớp một phần)
      const catNorm = removeDiacritics(categoryHint).toLowerCase();
      const matchedCat = allCategories
        .map(c => {
          const cNorm = removeDiacritics(c.name).toLowerCase();
          // Tính điểm: khớp đầy đủ = 3, cNorm chứa catNorm = 2, catNorm chứa cNorm = 1
          let score = 0;
          if (cNorm === catNorm) score = 3;
          else if (cNorm.includes(catNorm)) score = 2;
          else if (catNorm.includes(cNorm)) score = 1;
          return { cat: c, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.cat;
      if (matchedCat) { matchedCatId = matchedCat.id; matchedCatName = matchedCat.name; }
    }

    // Lọc bỏ keywords trùng với từ trong tên category (quá generic, gây false positive)
    // Ví dụ: categoryHint="Điện thoại thông minh" → loại "thông minh", "điện thoại" khỏi keywords
    let filteredKeywords = keywords;
    if (matchedCatName) {
      const catWords = new Set(removeDiacritics(matchedCatName).toLowerCase().split(/\s+/));
      filteredKeywords = keywords.filter(k => {
        const kNorm = removeDiacritics(k).toLowerCase();
        // Giữ keyword nếu không phải là từ đơn thuần của tên category
        return !catWords.has(kNorm) && !kNorm.split(/\s+/).every(w => catWords.has(w));
      });
    }

    if (matchedCatId && filteredKeywords.length > 0) {
      // A: Category làm bộ lọc cứng + TẤT CẢ keywords phải match trong NAME
      // Dùng AND (mỗi keyword là 1 điều kiện bắt buộc) thay vì OR để tránh false positive
      const catKwProducts = await prisma.product.findMany({
        where: {
          category_id: matchedCatId,
          AND: filteredKeywords.map(k => ({ name: { contains: k, mode: 'insensitive' } })),
          is_deleted: false,
          ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
        },
        take: 50,
      });
      catKwProducts.forEach(p => {
        const pNameNorm = removeDiacritics(p.name || '').toLowerCase();
        let score = 0;
        filteredKeywords.forEach(k => {
          if (pNameNorm.includes(removeDiacritics(k).toLowerCase())) score += 5;
        });
        p._score = score;
      });
      catKwProducts.sort((a, b) => b._score - a._score || b.sold - a.sold);
      // Chỉ lấy sản phẩm có score >= 5 (phải match ít nhất 1 keyword có nghĩa)
      products = catKwProducts.filter(p => p._score >= 5).slice(0, 8);

      // Fallback: AND quá chặt không ra → thử OR nhưng yêu cầu score cao (match >= 2 keywords)
      if (products.length < 2 && filteredKeywords.length >= 2) {
        const catOrProducts = await prisma.product.findMany({
          where: {
            category_id: matchedCatId,
            OR: filteredKeywords.map(k => ({ name: { contains: k, mode: 'insensitive' } })),
            is_deleted: false,
            ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
          },
          take: 50,
        });
        catOrProducts.forEach(p => {
          const pNameNorm = removeDiacritics(p.name || '').toLowerCase();
          p._score = filteredKeywords.filter(k => pNameNorm.includes(removeDiacritics(k).toLowerCase())).length * 5;
        });
        catOrProducts.sort((a, b) => b._score - a._score || b.sold - a.sold);
        // Chỉ lấy nếu match >= 2 keywords (tránh single-keyword false positive)
        const minMatchRequired = filteredKeywords.length >= 2 ? 10 : 5;
        products = catOrProducts.filter(p => p._score >= minMatchRequired).slice(0, 8);
      }

      // Nếu keyword vẫn không match trong category → lấy top sản phẩm của category đó
      if (products.length < 2) {
        const catTop = await prisma.product.findMany({
          where: {
            category_id: matchedCatId,
            is_deleted: false,
            ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
          },
          orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
          take: 8,
        });
        const existingIds = new Set(products.map(p => String(p.id)));
        for (const p of catTop) {
          if (!existingIds.has(String(p.id))) { products.push(p); existingIds.add(String(p.id)); }
          if (products.length >= 8) break;
        }
      }

    } else if (matchedCatId) {
      // B: Chỉ có category — hoặc filteredKeywords trống (toàn từ category) → top bán chạy của category
      products = await prisma.product.findMany({
        where: {
          category_id: matchedCatId,
          is_deleted: false,
          ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
        },
        orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
        take: 8,
      });

    } else if (keywords.length > 0) {
      // C: Không có category — yêu cầu TẤT CẢ keywords match trong NAME (AND)
      // Tránh: query "màn hình Sony" → AND → chỉ lấy sp có cả "màn hình" lẫn "Sony" trong tên
      const kwProducts = await prisma.product.findMany({
        where: {
          AND: keywords.map(k => ({ name: { contains: k, mode: 'insensitive' } })),
          is_deleted: false,
          ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
        },
        take: 50,
      });
      kwProducts.forEach(p => {
        const pNameNorm = removeDiacritics(p.name || '').toLowerCase();
        let score = 0;
        keywords.forEach(k => {
          if (pNameNorm.includes(removeDiacritics(k).toLowerCase())) score += 5;
        });
        p._score = score;
      });
      kwProducts.sort((a, b) => b._score - a._score || b.sold - a.sold);
      // Yêu cầu match đủ tất cả keywords (AND đã đảm bảo điều này)
      products = kwProducts.filter(p => p._score >= keywords.length * 5).slice(0, 8);

      // Fallback: AND không ra kết quả (ít sản phẩm trong DB) → thử OR với score cao
      if (products.length === 0 && keywords.length >= 2) {
        const kwOrProducts = await prisma.product.findMany({
          where: {
            OR: keywords.map(k => ({ name: { contains: k, mode: 'insensitive' } })),
            is_deleted: false,
            ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
          },
          take: 50,
        });
        kwOrProducts.forEach(p => {
          const pNameNorm = removeDiacritics(p.name || '').toLowerCase();
          p._score = keywords.filter(k => pNameNorm.includes(removeDiacritics(k).toLowerCase())).length * 5;
        });
        kwOrProducts.sort((a, b) => b._score - a._score || b.sold - a.sold);
        // Chỉ lấy sản phẩm match >= 2 keywords (score >= 10)
        products = kwOrProducts.filter(p => p._score >= 10).slice(0, 8);
      }
    }

    // ── BƯỚC 3: Fallback ────────────────────────────────────────────────────
    if (products.length === 0) {
      const hasPriceFilter = Object.keys(priceFilter).length > 0;

      if (hasPriceFilter) {
        // Có price filter → BẮT BUỘC giữ price filter, không bao giờ bỏ
        // Thử lại trong category (nếu có) VỚI price filter
        if (matchedCatId) {
          products = await prisma.product.findMany({
            where: {
              category_id: matchedCatId,
              is_deleted: false,
              price: priceFilter,  // GIỮ price filter
            },
            orderBy: [{ price: 'asc' }],
            take: 8,
          });
          if (products.length > 0) {
            hint = `Các sản phẩm phù hợp trong tầm giá`;
          }
        }

        // Vẫn không có → tìm toàn shop với price filter
        if (products.length === 0) {
          products = await prisma.product.findMany({
            where: {
              is_deleted: false,
              price: priceFilter,  // VẪN giữ price filter!
              stock: { gt: 0 },
            },
            orderBy: [{ sold: 'desc' }],
            take: 8,
          });
          hint = hint || `Sản phẩm trong tầm giá`;
        }

        // Trường hợp cực kỳ hiếm: DB thực sự không có sản phẩm nào trong tầm giá
        if (products.length === 0) {
          hint = `Không tìm thấy sản phẩm nào trong tầm giá này`;
        }
      } else {
        // Không có giới hạn giá → fallback top sellers (có category filter nếu biết)
        products = await prisma.product.findMany({
          where: {
            is_deleted: false,
            stock: { gt: 0 },
            ...(matchedCatId ? { category_id: matchedCatId } : {}),
          },
          orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
          take: 8,
        });
        hint = hint || 'Sản phẩm bán chạy nhất';
      }
    }

    // ── Serialize (BigInt → Number) ──────────────────────────────────────────
    const serialized = products.slice(0, 8).map(p => ({
      id:       Number(p.id),
      name:     p.name,
      price:    Number(p.price),
      image:    p.images?.[0] || p.image || null,
      images:   p.images || [],
      rating:   p.rating ? Number(p.rating) : null,
      sold:     Number(p.sold || 0),
      stock:    Number(p.stock || 0),
      category: categoryMap[p.category_id] || null,
    }));

    res.json({ products: serialized, hint, keywords });

  } catch (err) {
    console.error('[SmartSearch Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. POST /api/b2c/visual-search — Tìm kiếm sản phẩm bằng hình ảnh
//
//    Pipeline 2 bước:
//      [Bước 1] BLIP (HuggingFace) — Image Captioning: ảnh → caption tiếng Anh
//      [Bước 2] Qwen2.5-72B (HuggingFace) — Phân tích caption → JSON có cấu trúc
//      [Bước 3] Prisma DB — Tìm sản phẩm theo category + keywords
// ══════════════════════════════════════════════════════════════════════════════
router.post('/b2c/visual-search', async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 la bat buoc' });
    }
    if (!imageBase64.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Dinh dang anh khong hop le.' });
    }

    console.log('[VisualSearch] Nhan yeu cau phan tich anh, kich thuoc:', Math.round(imageBase64.length / 1024), 'KB');

    // BUOC 1 & 2: BLIP + Qwen phan tich anh
    const { caption, analysis } = await analyzeProductImage(imageBase64);

    if (!caption && !analysis) {
      return res.json({
        text: 'Da em chua nhan dang duoc san pham trong anh nay a! Anh/chi co the mo ta them bang van ban de em tim kiem giup khong a?',
        products: [], caption: null, analysis: null,
      });
    }

    if (analysis && !analysis.category && analysis.keywords?.length === 0) {
      return res.json({
        text: `Da em thay trong anh la: "${analysis.description_vi || caption}". Day co ve khong phai san pham dien tu a.`,
        products: [], caption, analysis,
      });
    }

    // BUOC 3: Doi chieu dac trung AI voi san pham trong DB
    const keywords = (analysis?.keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean);
    const brand    = (analysis?.brand    || '').toLowerCase().trim();
    const category = analysis?.category  || null;
    const color    = (analysis?.color    || '').toLowerCase().trim();

    let categoryId = null;
    let brandId    = null;

    if (category) {
      const catRecord = await prisma.category.findFirst({
        where: { name: { contains: category, mode: 'insensitive' } },
      });
      if (catRecord) categoryId = catRecord.id;
    }

    if (brand) {
      const brandRecord = await prisma.brand.findFirst({
        where: { name: { contains: brand, mode: 'insensitive' }, is_deleted: false },
      });
      if (brandRecord) brandId = brandRecord.id;
    }

    let candidates = [];

    if (categoryId) {
      const byCat = await prisma.product.findMany({
        where: { category_id: categoryId, is_deleted: false, stock: { gt: 0 } },
        orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
        take: 60,
      });
      candidates.push(...byCat);
    }

    if (brandId) {
      const byBrand = await prisma.product.findMany({
        where: { brand_id: brandId, is_deleted: false, stock: { gt: 0 } },
        orderBy: [{ sold: 'desc' }],
        take: 30,
      });
      candidates.push(...byBrand);
    }

    if (keywords.length > 0) {
      const byKeyword = await prisma.product.findMany({
        where: {
          OR: keywords.map(k => ({ name: { contains: k, mode: 'insensitive' } })),
          is_deleted: false,
          stock: { gt: 0 },
        },
        take: 40,
      });
      candidates.push(...byKeyword);
    }

    if (candidates.length === 0) {
      candidates = await prisma.product.findMany({
        where: { is_deleted: false, stock: { gt: 0 } },
        orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
        take: 20,
      });
    }

    // Deduplicate
    const seen = new Set();
    candidates = candidates.filter(p => {
      const key = p.id.toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Multi-dimensional scoring: category(+20) brand(+15) keyword(+8) brand-name(+5) color(+3) sold/rating bonus
    candidates.forEach(p => {
      const pName = (p.name || '').toLowerCase();
      let score = 0;
      if (categoryId && p.category_id === categoryId) score += 20;
      if (brandId    && p.brand_id    === brandId)    score += 15;
      keywords.forEach(k => { if (pName.includes(k)) score += 8; });
      if (brand && pName.includes(brand)) score += 5;
      if (color && pName.includes(color)) score += 3;
      score += Math.min(Number(p.sold   || 0) / 1000, 3);
      score += Math.min(Number(p.rating || 0) * 0.5, 2.5);
      p._score = score;
    });

    candidates.sort((a, b) => b._score - a._score);
    const products = candidates.slice(0, 4);

    const serializedProducts = products.map(p => ({
      id:     Number(p.id),
      name:   p.name,
      price:  Number(p.price),
      image:  p.image || null,
      rating: p.rating ? Number(p.rating) : null,
      sold:   Number(p.sold  || 0),
      stock:  Number(p.stock || 0),
    }));

    // BƯỚC 4: Dùng Qwen LLM sinh câu trả lời tự nhiên tiếng Việt
    const visualContext = {
      products: serializedProducts,
    };
    const visualMessage = serializedProducts.length > 0
      ? `Khách vừa gửi ảnh. Gemini Vision nhận ra: ${analysis.description_vi || caption}` +
        `${analysis.brand    ? `, thương hiệu ${analysis.brand}`    : ''}` +
        `${analysis.color    ? `, màu ${analysis.color}`            : ''}` +
        `${analysis.category ? `, danh mục ${analysis.category}`   : ''}. ` +
        `Đã tìm thấy ${serializedProducts.length} sản phẩm phù hợp trong kho. ` +
        `Hãy tư vấn ngắn gọn và gợi ý các sản phẩm trên cho khách.`
      : `Khách vừa gửi ảnh. Gemini Vision nhận ra: ${analysis.description_vi || caption}` +
        `${analysis.category ? `, danh mục ${analysis.category}` : ''}. ` +
        `Hiện kho không có sản phẩm tương tự. Hãy thông báo thân thiện và hỏi thêm nhu cầu.`;

    const llmText = await generateChatResponse({
      intent: 'VISUAL_SEARCH',
      context: visualContext,
      message: visualMessage,
      history: [],
    });

    // Fallback nếu LLM không trả lời được
    const brandText    = analysis?.brand    ? ` **${analysis.brand}**`                       : '';
    const categoryText = analysis?.category ? ` thuộc danh mục **${analysis.category}**`    : '';
    const colorText    = analysis?.color    ? `, màu ${analysis.color}`                      : '';
    const descText     = analysis?.description_vi || 'sản phẩm từ ảnh bạn gửi';

    let responseText;
    if (llmText) {
      responseText = llmText;
    } else if (serializedProducts.length > 0) {
      responseText = `Dạ em đã phân tích ảnh và nhận ra đây là${brandText ? ` sản phẩm${brandText}` : ''} — ${descText}${colorText} ạ!\n\nDựa trên **danh mục**, **thương hiệu** và **từ khóa** nhận dạng được, bên em có **${serializedProducts.length} sản phẩm phù hợp** cho anh/chị tham khảo ạ!`;
    } else {
      responseText = `Dạ em nhận ra trong ảnh là ${descText}${colorText}${categoryText} ạ! Tuy nhiên hiện tại bên em chưa có sản phẩm tương tự trong kho ạ. Anh/chị muốn em tìm thêm sản phẩm nào khác không ạ?`;
    }

    console.log(`[VisualSearch] Hoàn thành — ${serializedProducts.length} sản phẩm, LLM: ${llmText ? 'OK' : 'fallback'}.`);

    res.json({ text: responseText, products: serializedProducts, caption, analysis });

  } catch (err) {
    console.error('[VisualSearch Error]', err.message);
    res.status(500).json({
      text: 'Da em dang gap su co khi phan tich anh. Anh/chi vui long thu lai sau it phut nhe a!',
      products: [],
    });
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// 5. POST /api/ai/smart-search-image — Tìm kiếm kết hợp ảnh + văn bản từ searchbar
//
// 4 trường hợp xử lý:
//   TH1: Chỉ có ảnh (query trống / enter ngay) → visual search thuần tuý
//   TH2: Ảnh + query liên quan đến ảnh        → kết hợp cả hai
//   TH3: Ảnh + query không liên quan đến ảnh  → ưu tiên query text
//   TH4: Ảnh + query chung chung              → dùng AI cho cả hai
// ══════════════════════════════════════════════════════════════════════════════
router.post('/ai/smart-search-image', async (req, res) => {
  const { query = '', imageBase64 } = req.body;
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }
  if (!imageBase64.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid image format' });
  }

  const rawQuery = String(query).trim();

  try {
    // ── BƯỚC 1: Phân tích ảnh (luôn chạy) ────────────────────────────────
    const { analyzeProductImage } = require('../ai/visualSearch');
    const { caption, analysis } = await analyzeProductImage(imageBase64);

    const imageKeywords  = (analysis?.keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean);
    const imageBrand     = (analysis?.brand    || '').toLowerCase().trim();
    const imageCategory  = analysis?.category  || null;
    const imageDescVI    = analysis?.description_vi || caption || '';

    const allCategories = await prisma.category.findMany({});
    const categoryMap   = {};
    allCategories.forEach(c => categoryMap[c.id] = c.name);

    let products = [];
    let hint     = '';
    let mode     = 'image_only'; // 'image_only' | 'combined' | 'text_only' | 'ai_both'

    // ── BƯỚC 2: Xác định trường hợp ──────────────────────────────────────
    const VAGUE_PATTERNS = /^(tìm|tìm kiếm|mua|xem|tương tự|giống|kiểu này|loại này|cái này|sản phẩm này|gợi ý|recommend|similar|like this|tư vấn)$/i;
    const isQueryEmpty  = !rawQuery;
    const isQueryVague  = rawQuery && VAGUE_PATTERNS.test(rawQuery.replace(/\s+/g, ' ').trim());

    // Kiểm tra query có liên quan đến ảnh không (dùng LLM hoặc keyword overlap)
    let isQueryRelated = false;
    if (rawQuery && !isQueryVague) {
      const HF_API_KEY_SI  = process.env.HF_API_KEY;
      const HF_LLM_URL_SI  = 'https://router.huggingface.co/featherless-ai/v1/chat/completions';
      const HF_MODEL_SI    = process.env.HF_LLM_MODEL || 'Qwen/Qwen2.5-7B-Instruct';

      if (HF_API_KEY_SI) {
        try {
          const relCheckResp = await fetch(HF_LLM_URL_SI, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HF_API_KEY_SI}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: HF_MODEL_SI,
              messages: [
                { role: 'system', content: `Bạn là AI kiểm tra xem câu tìm kiếm có liên quan đến mô tả ảnh không.
Trả lời JSON: {"related": true/false, "reason": "ngắn gọn"}
- related=true: câu tìm kiếm đề cập đến cùng loại sản phẩm, thương hiệu, hoặc danh mục với ảnh
- related=false: câu tìm kiếm hoàn toàn khác loại sản phẩm với ảnh
Ví dụ: ảnh="tai nghe Sony", query="Sony 1000XM5" → related=true
Ví dụ: ảnh="tai nghe Sony", query="iPhone 15 Pro" → related=false
Chỉ trả về JSON thuần.` },
                { role: 'user', content: `Ảnh: "${imageDescVI}${imageBrand ? `, thương hiệu ${imageBrand}` : ''}${imageCategory ? `, danh mục ${imageCategory}` : ''}"\nCâu tìm kiếm: "${rawQuery}"` }
              ],
              temperature: 0.1,
              max_tokens: 60,
              stream: false,
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (relCheckResp.ok) {
            const relData = await relCheckResp.json();
            const relContent = relData?.choices?.[0]?.message?.content?.trim() || '';
            const relJson = relContent.match(/\{[\s\S]*\}/);
            if (relJson) {
              const parsed = JSON.parse(relJson[0]);
              isQueryRelated = !!parsed.related;
            }
          }
        } catch (e) {
          // Fallback: kiểm tra keyword overlap thủ công
          const { removeDiacritics } = require('../ai/huggingface');
          const queryNorm = removeDiacritics(rawQuery).toLowerCase();
          const imageTerms = [...imageKeywords, imageBrand, imageCategory || ''].filter(Boolean);
          isQueryRelated = imageTerms.some(t => queryNorm.includes(removeDiacritics(t).toLowerCase()));
        }
      } else {
        // Không có API key → fallback keyword overlap
        const { removeDiacritics } = require('../ai/huggingface');
        const queryNorm = removeDiacritics(rawQuery).toLowerCase();
        const imageTerms = [...imageKeywords, imageBrand, imageCategory || ''].filter(Boolean);
        isQueryRelated = imageTerms.some(t => t.length > 1 && queryNorm.includes(removeDiacritics(t).toLowerCase()));
      }
    }

    // Xác định mode
    if (isQueryEmpty || isQueryVague && !rawQuery) {
      mode = 'image_only';
    } else if (isQueryVague) {
      mode = 'ai_both';
    } else if (isQueryRelated) {
      mode = 'combined';
    } else {
      mode = 'text_only';
    }

    console.log(`[SmartSearchImage] mode=${mode}, query="${rawQuery}", imageCategory=${imageCategory}, imageBrand=${imageBrand}`);

    // ── BƯỚC 3: Query DB theo mode ────────────────────────────────────────

    // Helper: tìm category id từ tên
    const findCatId = (catName) => {
      if (!catName) return null;
      const { removeDiacritics } = require('../ai/huggingface');
      const norm = removeDiacritics(catName).toLowerCase();
      return allCategories
        .map(c => ({ c, score: removeDiacritics(c.name).toLowerCase() === norm ? 3 : removeDiacritics(c.name).toLowerCase().includes(norm) ? 2 : norm.includes(removeDiacritics(c.name).toLowerCase()) ? 1 : 0 }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.c?.id || null;
    };

    const serializeProducts = (prods) => prods.slice(0, 8).map(p => ({
      id:       Number(p.id),
      name:     p.name,
      price:    Number(p.price),
      image:    p.images?.[0] || p.image || null,
      images:   p.images || [],
      rating:   p.rating ? Number(p.rating) : null,
      sold:     Number(p.sold || 0),
      stock:    Number(p.stock || 0),
      category: categoryMap[p.category_id] || null,
    }));

    if (mode === 'image_only' || mode === 'ai_both') {
      // Dùng visual search kết quả + nếu ai_both thì cộng thêm smart-search text
      const imageCatId = findCatId(imageCategory);
      const searchTerms = [...(imageBrand ? [imageBrand] : []), ...imageKeywords].filter(Boolean);

      if (imageCatId && searchTerms.length > 0) {
        const rows = await prisma.product.findMany({
          where: {
            category_id: imageCatId,
            AND: searchTerms.slice(0, 2).map(k => ({ name: { contains: k, mode: 'insensitive' } })),
            is_deleted: false,
          },
          take: 50,
        });
        if (rows.length === 0 && searchTerms.length > 0) {
          // Thử OR
          const rows2 = await prisma.product.findMany({
            where: {
              category_id: imageCatId,
              OR: searchTerms.map(k => ({ name: { contains: k, mode: 'insensitive' } })),
              is_deleted: false,
            },
            take: 50,
          });
          rows2.forEach(p => {
            const n = (p.name || '').toLowerCase();
            p._score = searchTerms.filter(k => n.includes(k.toLowerCase())).length * 5;
          });
          rows2.sort((a, b) => b._score - a._score || b.sold - a.sold);
          products = rows2.slice(0, 8);
        } else {
          rows.forEach(p => {
            const n = (p.name || '').toLowerCase();
            p._score = searchTerms.filter(k => n.includes(k.toLowerCase())).length * 5;
          });
          rows.sort((a, b) => b._score - a._score || b.sold - a.sold);
          products = rows.slice(0, 8);
        }
      } else if (imageCatId) {
        products = await prisma.product.findMany({
          where: { category_id: imageCatId, is_deleted: false },
          orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
          take: 8,
        });
      }

      // Nếu ai_both → merge thêm smart-search text results
      if (mode === 'ai_both' && rawQuery) {
        try {
          const textResult = await (async () => {
            // Gọi lại logic smart-search cho rawQuery
            const resp2 = await fetch(`http://localhost:${process.env.PORT || 8080}/api/ai/smart-search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: rawQuery }),
              signal: AbortSignal.timeout(15000),
            });
            if (resp2.ok) return resp2.json();
            return null;
          })();
          if (textResult?.products?.length > 0) {
            const existingIds = new Set(products.map(p => String(p.id)));
            for (const p of textResult.products) {
              if (!existingIds.has(String(p.id))) {
                products.push({
                  id: p.id, name: p.name, price: p.price,
                  images: p.images || [], image: p.image,
                  rating: p.rating, sold: p.sold || 0, stock: p.stock || 0,
                  category_id: null,
                });
                existingIds.add(String(p.id));
              }
              if (products.length >= 8) break;
            }
          }
        } catch (e) {
          console.warn('[SmartSearchImage] ai_both text merge failed:', e.message);
        }
      }

      hint = mode === 'image_only'
        ? `Sản phẩm tương tự: ${imageDescVI}`
        : `Kết quả AI từ ảnh + "${rawQuery}"`;

    } else if (mode === 'text_only') {
      // TH3: Ưu tiên hoàn toàn query text, bỏ qua ảnh
      try {
        const resp3 = await fetch(`http://localhost:${process.env.PORT || 8080}/api/ai/smart-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: rawQuery }),
          signal: AbortSignal.timeout(20000),
        });
        if (resp3.ok) {
          const d = await resp3.json();
          products = (d.products || []).map(p => ({ ...p, category_id: null }));
          hint     = d.hint || `Kết quả cho "${rawQuery}"`;
        }
      } catch (e) {
        console.warn('[SmartSearchImage] text_only smart-search failed:', e.message);
      }

    } else if (mode === 'combined') {
      // TH2: Kết hợp query + image context
      const imageCatId = findCatId(imageCategory);
      try {
        const resp4 = await fetch(`http://localhost:${process.env.PORT || 8080}/api/ai/smart-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: `${rawQuery} ${imageBrand || ''} ${imageCategory || ''}`.trim() }),
          signal: AbortSignal.timeout(20000),
        });
        if (resp4.ok) {
          const d = await resp4.json();
          // Ưu tiên sản phẩm có cùng category với ảnh
          const textProducts = (d.products || []).map(p => ({ ...p, category_id: null }));
          if (imageCatId) {
            // Đảm bảo sản phẩm trong category ảnh nằm trước
            const inCat   = textProducts.filter(p => p.category === categoryMap[imageCatId]);
            const outCat  = textProducts.filter(p => p.category !== categoryMap[imageCatId]);
            products = [...inCat, ...outCat].slice(0, 8);
          } else {
            products = textProducts.slice(0, 8);
          }
          hint = `Kết quả kết hợp ảnh + "${rawQuery}"`;
        }
      } catch (e) {
        console.warn('[SmartSearchImage] combined smart-search failed:', e.message);
      }
    }

    // ── Fallback nếu không có kết quả ────────────────────────────────────
    if (products.length === 0) {
      products = await prisma.product.findMany({
        where: { is_deleted: false, stock: { gt: 0 } },
        orderBy: [{ sold: 'desc' }],
        take: 8,
      });
      hint = 'Sản phẩm phổ biến';
    }

    const serialized = serializeProducts(products);

    res.json({
      products: serialized,
      hint,
      mode,
      imageCaption: imageDescVI,
      imageAnalysis: { brand: analysis?.brand, category: imageCategory, keywords: imageKeywords },
    });

  } catch (err) {
    console.error('[SmartSearchImage Error]', err.message);
    res.status(500).json({ error: err.message, products: [], hint: '' });
  }
});

module.exports = router;


