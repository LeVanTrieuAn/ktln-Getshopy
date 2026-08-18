const express = require('express');
const { prisma } = require('../db');
const router = express.Router();

// ── AI Modules ──────────────────────────────────────────────────────────────
const { classifyIntent, removeDiacritics } = require('../ai/huggingface');
const { generateChatResponse }             = require('../ai/llm');

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
  'dong ho':     'Phụ kiện công nghệ',
  'loa':         'Phụ kiện công nghệ',
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

        // Bước 2: Tìm theo danh mục keyword
        const matchedCatName = Object.entries(CATEGORY_KEYWORD_MAP)
          .find(([kw]) => norm.includes(kw))?.[1];

        if (matchedCatName) {
          const category = await prisma.category.findFirst({
            where: { name: { contains: matchedCatName, mode: 'insensitive' } }
          });
          if (category) {
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
            link = `/shop?category=${category.id}`;
          }
        }

        // Bước 3: Nếu chưa có, tìm theo tên sản phẩm cụ thể
        if (products.length === 0) {
          const stopWords = new Set([
            'muon','mua','tim','xem','gia','bao','nhieu','co','ban','khong',
            'shop','oi','can','toi','minh','em','ban','cho','hoi','ve',
            'duoi','tam','khoang','nao','gi','nhu','the','nay','do',
          ]);
          const tokens = norm.split(/\s+/).filter(w => !stopWords.has(w) && w.length > 1);
          const keyword = tokens.join(' ').trim();

          if (keyword) {
            products = await prisma.product.findMany({
              where: {
                name: { contains: keyword, mode: 'insensitive' },
                is_deleted: false,
                ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
              },
              orderBy: [{ sold: 'desc' }],
              take: 4,
            });
            // Update link to search page
            link = `/shop?search=${encodeURIComponent(keyword)}`;
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

module.exports = router;
