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
              const keyword = tokens.join(' ');
              link = `/shop?search=${encodeURIComponent(keyword)}`;
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
    };
  }

  const defaults = {
    GREETING:         { text: 'Dạ Getshopy xin chào ạ! Anh/chị đang cần tìm điện thoại, laptop hay phụ kiện gì ạ?', link: '/' },
    ASK_DELIVERY:     { text: 'Dạ giao nội thành 2–4 tiếng, tỉnh thành 1–3 ngày, miễn phí ship từ 500k ạ!', link: '/' },
    ASK_RETURN:       { text: 'Dạ đổi trả 7 ngày, bảo hành 12 tháng chính hãng ạ!', link: '/' },
    ASK_PAYMENT:      { text: 'Dạ hỗ trợ COD, MoMo, ZaloPay, trả góp 0% ạ!', link: '/' },
    TRACK_ORDER:      { text: 'Dạ anh/chị vào mục "Đơn hàng của tôi" để kiểm tra nhé ạ!', link: '/profile' },
    CANCEL_ORDER:     { text: 'Dạ vào "Đơn hàng của tôi" → Chọn đơn → Hủy đơn nhé ạ!', link: '/profile' },
    FEEDBACK_POSITIVE:{ text: 'Dạ cảm ơn anh/chị rất nhiều! 🌟 Getshopy luôn cố gắng phục vụ tốt nhất ạ!', link: '/' },
    COMPLAINT:        { text: 'Dạ em thành thật xin lỗi! Anh/chị liên hệ hotline 1800-xxxx để được hỗ trợ ngay ạ!', link: '/' },
  };

  return defaults[intent] || {
    text: 'Dạ anh/chị cần tư vấn sản phẩm nào? Bên em có điện thoại, laptop, máy tính bảng và phụ kiện ạ!',
    link: '/',
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. GET /api/b2c/products — Lấy sản phẩm theo danh mục (B2C storefront)
// ══════════════════════════════════════════════════════════════════════════════
router.get('/b2c/products', async (req, res) => {
  try {
    const { category, limit = 8, page = 1, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { is_deleted: false };
    if (category) where.category_id = parseInt(category);
    if (search)   where.name = { contains: search, mode: 'insensitive' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true, brand: true },
        orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
        take: parseInt(limit),
        skip,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ products, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('[b2c/products]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. GET /api/b2c/flash-sales — Flash sale đang hoạt động
// ══════════════════════════════════════════════════════════════════════════════
router.get('/b2c/flash-sales', async (req, res) => {
  try {
    const now = new Date();
    const sales = await prisma.flashSale.findMany({
      where: {
        is_deleted: false,
        is_active: true,
        OR: [{ end_date: null }, { end_date: { gte: now } }],
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(sales);
  } catch (err) {
    console.error('[b2c/flash-sales]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
      ? { text: responseText, link: context.link }
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
    const HF_LLM_URL_SS   = `https://api-inference.huggingface.co/models/${HF_LLM_MODEL_SS}/v1/chat/completions`;

    let keywords = [];
    let categoryHint = null;
    let priceMax = null;
    let priceMin = null;
    let hint = '';

    if (HF_API_KEY_SS) {
      const systemPrompt = `Bạn là AI trợ lý tìm kiếm sản phẩm cho cửa hàng điện tử Getshopy.
Nhiệm vụ: Phân tích câu tìm kiếm của khách hàng (có thể là ngôn ngữ thông thường, slang, mơ hồ) 
và trả về JSON với các trường sau:
- "keywords": mảng tối đa 4 từ khóa tìm kiếm sản phẩm quan trọng nhất (TIẾNG VIỆT CÓ DẤU chuẩn xác, danh từ chính yếu để tra cứu DB, hoặc tên thương hiệu. RẤT QUAN TRỌNG: Phải ghi có dấu, ví dụ "điện thoại" thay vì "dien thoai").
- "category": tên danh mục nếu xác định được (chọn CHÍNH XÁC một trong: "Điện thoại thông minh", "Máy tính xách tay", "Máy tính bảng", "Phụ kiện công nghệ", "Tivi & Thiết bị giải trí", "Máy ảnh & Quay phim", "Đồng hồ thông minh", "Máy chơi game", "Thiết bị nhà thông minh", "Thiết bị mạng", null nếu không rõ)
- "price_max": ngân sách tối đa (số nguyên, đơn vị VNĐ, null nếu không đề cập)
- "price_min": ngân sách tối thiểu (số nguyên, đơn vị VNĐ, null nếu không đề cập)  
- "hint": câu giải thích ngắn về kết quả tìm kiếm bằng tiếng Việt (ví dụ: "Smartphone cao cấp phổ biến nhất")

Ví dụ:
- "điện thoại xịn xịn" → {"keywords":["điện thoại", "flagship", "cao cấp"],"category":"Điện thoại thông minh","price_max":null,"price_min":null,"hint":"Smartphone cao cấp, hiệu năng mạnh mẽ"}
- "máy tính làm đồ họa dưới 30 triệu" → {"keywords":["laptop", "đồ họa", "máy tính xách tay"],"category":"Máy tính xách tay","price_max":30000000,"price_min":null,"hint":"Laptop cấu hình mạnh cho thiết kế đồ họa"}
- "tai nghe chống ồn" → {"keywords":["tai nghe", "chống ồn", "ANC"],"category":"Phụ kiện công nghệ","price_max":null,"price_min":null,"hint":"Tai nghe chống ồn chủ động (ANC)"}

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
              categoryHint = parsed.category || null;
              priceMax    = parsed.price_max ? Number(parsed.price_max) : null;
              priceMin    = parsed.price_min ? Number(parsed.price_min) : null;
              hint        = parsed.hint || '';
              console.log(`[SmartSearch] HF Qwen parsed → keywords=${keywords}, category=${categoryHint}, hint="${hint}"`);
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
    let products = [];
    const allCategories = await prisma.category.findMany({});
    const categoryMap = {};
    allCategories.forEach(c => categoryMap[c.id] = c.name);

    const priceFilter = {};
    if (priceMax) priceFilter.lte = priceMax;
    if (priceMin) priceFilter.gte = priceMin;

    let matchedCatId = null;
    if (categoryHint) {
      const matchedCat = allCategories.find(c => removeDiacritics(c.name).toLowerCase().includes(removeDiacritics(categoryHint).toLowerCase()));
      if (matchedCat) matchedCatId = matchedCat.id;
    }

    // Ưu tiên 1: Tìm theo keyword trước (nếu có keyword)
    if (keywords.length > 0) {
      const keywordProducts = await prisma.product.findMany({
        where: {
          OR: [
            ...keywords.map(k => ({ name: { contains: k, mode: 'insensitive' } })),
            ...keywords.map(k => ({ description: { contains: k, mode: 'insensitive' } }))
          ],
          is_deleted: false,
          ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
        },
        take: 50,
      });

      // Score by keyword match count and category
      keywordProducts.forEach(p => {
        const pNameNorm = removeDiacritics(p.name || '').toLowerCase();
        const pDescNorm = removeDiacritics(p.description || '').toLowerCase();
        
        let score = 0;
        keywords.forEach(k => {
          const kNorm = removeDiacritics(k).toLowerCase();
          if (pNameNorm.includes(kNorm)) score += 5; // Tên trúng từ khóa -> ưu tiên cao nhất
          if (pDescNorm.includes(kNorm)) score += 1;
        });

        // Boost điểm cực mạnh nếu trúng category AI dự đoán
        if (matchedCatId && p.category_id === matchedCatId) {
          score += 10;
        }

        p._score = score;
      });
      
      keywordProducts.sort((a, b) => b._score - a._score || b.sold - a.sold);
      products = keywordProducts.slice(0, 8);
    }

    // Ưu tiên 2: Nếu không đủ kết quả từ keyword, nhưng có category -> lấy sản phẩm hot của category đó
    if (products.length < 4 && matchedCatId) {
      const catWhere = {
        is_deleted: false,
        category_id: matchedCatId,
        ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
      };
      const catProducts = await prisma.product.findMany({
        where: catWhere,
        orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
        take: 8,
      });

      const existingIds = new Set(products.map(p => String(p.id)));
      for (const p of catProducts) {
        if (!existingIds.has(String(p.id))) {
          products.push(p);
          existingIds.add(String(p.id));
        }
        if (products.length >= 8) break;
      }
    }

    // ── BƯỚC 3: Fallback — top sellers nếu vẫn trống ────────────────────────
    if (products.length === 0) {
      products = await prisma.product.findMany({
        where: { is_deleted: false, stock: { gt: 0 } },
        orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
        take: 8,
      });
      hint = hint || 'Sản phẩm bán chạy nhất';
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

module.exports = router;

