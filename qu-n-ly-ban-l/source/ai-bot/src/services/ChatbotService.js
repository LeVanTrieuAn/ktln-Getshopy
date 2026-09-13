'use strict';
/**
 * ============================================================
 * CHATBOT SERVICE — Getshopy AI Chatbot Engine v3.0
 * services/ChatbotService.js
 * ============================================================
 *
 * ĐẠI NÂNG CẤP v3:
 *   - KnowledgeCache thay vì hardcoded CATEGORY_KEYWORD_MAP cũ
 *   - Brand-aware search (detect brand → filter brand_id)
 *   - Real 49-category taxonomy (parent→child expansion)
 *   - 67 brand detection trong buildContext
 *   - ProductSpecsCache: thông số kỹ thuật thực từ DB
 *   - Optimized payload: bỏ images/stock/variants, thêm top 3 specs
 *
 * Pipeline:
 *   classifyIntent (mDeBERTa + rule-based)
 *   → buildContext (query DB theo intent + brand + category)
 *   → generateChatResponse (Qwen LLM) + specs context
 *   → fallback nếu LLM fail
 *
 * @module ChatbotService
 */

const { prisma } = require('../db');
const { classifyIntent, removeDiacritics } = require('../ai/huggingface');
const { generateChatResponse }             = require('../ai/llm');
const KC  = require('./KnowledgeCache');
const PSC = require('./ProductSpecsCache');

// ── Định dạng tiền tệ ────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

// ── Optimized SELECT cho Chatbot queries (bỏ variants, branch_ids) ──────────
const CHATBOT_SELECT = {
  id: true, name: true, price: true, original_price: true,
  image: true, images: true, rating: true, sold: true,
  category_id: true, brand_id: true, description: true,
};

/** Serialize BigInt → Number + thêm top 3 specs, bỏ fields FE không cần */
function serializeProducts(products) {
  if (!Array.isArray(products)) return [];
  const categoryMap = KC.getCategoryMap();
  return products.slice(0, 4).map(p => {
    let imagesArr = [];
    if (Array.isArray(p.images)) {
      imagesArr = p.images;
    } else if (typeof p.images === 'string') {
      try { imagesArr = JSON.parse(p.images); } catch (_) { imagesArr = []; }
    }
    const mainImg = imagesArr[0] || (typeof p.image === 'string' && !p.image.startsWith('[') ? p.image : null);

    // Lấy top 3 specs quan trọng nhất
    const specs = PSC.getTopSpecs(p, 3);

    return {
      id:             Number(p.id),
      name:           p.name,
      price:          Number(p.price),
      original_price: p.original_price ? Number(p.original_price) : Number(p.price),
      image:          mainImg,
      // BỎ: images (FE load riêng), stock, variants, branch_ids
      rating:         p.rating ? Number(p.rating) : 5,
      category_id:    p.category_id,
      brand_id:       p.brand_id,
      category:       categoryMap?.[p.category_id] || null,
      specs:          specs,  // Top 3 specs cho FE hiển thị
    };
  });
}

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
// FOLLOW-UP DETECTOR — Phát hiện câu nối tiếp cần dùng ngữ cảnh từ history
// Ví dụ: "Hãy hiển thị", "Cho xem đi", "Mua ngay", "Xem thêm"...
// ─────────────────────────────────────────────────────────────────────────────
const FOLLOWUP_PATTERNS = [
  /^(hay|hãy|cho|xem|hiển thị|show|bán|mua|đặt|thêm|tiếp|ok|oke|được|good|ừ|vâng|dạ|đúng|đặt mua)/i,
  /^(sản phẩm|sp|kết quả|list|danh sách|đó|này|vậy|bao nhiêu|mấy tiền|giá)/i,
];

function isFollowUp(message) {
  const trimmed = message.trim();
  if (trimmed.length < 25) {
    return FOLLOWUP_PATTERNS.some(p => p.test(trimmed));
  }
  return false;
}

/**
 * Trích xuất từ khóa quan trọng từ lịch sử chat (tối đa 2 lượt gần nhất)
 * để bổ sung vào câu hỏi follow-up.
 */
function extractKeywordsFromHistory(history = []) {
  const stopWords = new Set([
    'muon','mua','tim','xem','gia','bao','nhieu','co','ban','khong',
    'shop','oi','can','toi','minh','em','cho','hoi','ve','duoi','tam',
    'khoang','nao','gi','nhu','the','nay','do','la','nua','them','voi',
    'nhe','nha','da','roi','hay','hay','cho','hien','thi','san','pham',
    'ok','oke','duoc','vang','dung','dat','tiep','good','gio'
  ]);
  const recentMsgs = history.slice(-4).filter(h => h.sender === 'user');
  const combined = recentMsgs.map(h => removeDiacritics(h.text || '').toLowerCase()).join(' ');
  const tokens = combined.split(/\s+/).filter(w => !stopWords.has(w) && w.length > 2);
  // Deduplicate
  return [...new Set(tokens)].slice(0, 6);
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD CONTEXT — Query DB theo intent + brand + category
// ĐẠI NÂNG CẤP: dùng KnowledgeCache thay vì hardcoded map
// ─────────────────────────────────────────────────────────────────────────────
async function buildContext(intent, message, history = []) {
  await KC.ensureLoaded();

  // Nếu câu hỏi là follow-up ngắn → ghép từ khóa từ history
  let effectiveMessage = message;
  if (isFollowUp(message) && history.length > 0) {
    const historyKeywords = extractKeywordsFromHistory(history);
    if (historyKeywords.length > 0) {
      effectiveMessage = message + ' ' + historyKeywords.join(' ');
      console.log(`[buildContext] Follow-up detected → effectiveMessage: "${effectiveMessage}"`);
    }
  }

  const norm    = removeDiacritics(effectiveMessage).toLowerCase();
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
        // Bước 1: Trích ngân sách nếu có (ưu tiên effectiveMessage)
        const budgetMatch = effectiveMessage.match(/(\d+[\d.,]*)\s*(triệu|tr\b|củ|k\b|nghìn)/i);
        let priceFilter = {};
        if (budgetMatch) {
          const unit = budgetMatch[2].toLowerCase();
          const val  = parseFloat(budgetMatch[1].replace(',', '.'));
          const vnd  = (unit === 'k' || unit === 'nghìn') ? val * 1_000 : val * 1_000_000;
          priceFilter = /duoi|dưới/.test(norm)
            ? { lte: vnd }
            : { lte: vnd * 1.3, gte: vnd * 0.7 };
        }

        // Bước 2: Detect brand từ KnowledgeCache (67 brands + aliases)
        const detectedBrandId = KC.detectBrand(message);
        const brandFilter = detectedBrandId ? { brand_id: detectedBrandId } : {};

        // Bước 3: Detect category từ KnowledgeCache (49 categories)
        const detectedCatId = KC.detectCategory(message);
        let categoryFilter = {};
        if (detectedCatId) {
          const expandedIds = KC.expandCategoryIds(detectedCatId);
          categoryFilter = expandedIds.length === 1
            ? { category_id: expandedIds[0] }
            : { category_id: { in: expandedIds } };
        }

        // Bước 4: Extract extra keywords (bỏ stop words + brand + category words)
        const stopWords = new Set([
          'muon','mua','tim','xem','gia','bao','nhieu','co','ban','khong',
          'shop','oi','can','toi','minh','em','ban','cho','hoi','ve',
          'duoi','tam','khoang','nao','gi','nhu','the','nay','do',
          'tiep','theo','la','nua','them','voi','nhe','nha'
        ]);

        // Bỏ brand words và category words khỏi search tokens
        const brandMap = KC.getBrandMap();
        const categoryMap = KC.getCategoryMap();
        const brandName = detectedBrandId ? (brandMap[detectedBrandId] || '') : '';
        const catName = detectedCatId ? (categoryMap[detectedCatId] || '') : '';
        const excludeWords = new Set([
          ...removeDiacritics(brandName).toLowerCase().split(/\s+/),
          ...removeDiacritics(catName).toLowerCase().split(/\s+/),
        ].filter(Boolean));

        const tokens = norm.split(/\s+/).filter(w =>
          !stopWords.has(w) && !excludeWords.has(w) && w.length > 1
        );

        // Bước 5: Query DB — brand + category + keywords
        const baseWhere = {
          ...categoryFilter,
          ...brandFilter,
          is_deleted: false,
          stock: { gt: 0 },
          ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
        };

        if (tokens.length > 0) {
          // Tìm với keyword matching
          let candidates = await prisma.product.findMany({
            where: {
              ...baseWhere,
              OR: tokens.map(t => ({ name: { contains: t, mode: 'insensitive' } })),
            },
            take: 50,
          });
          if (candidates.length > 0) {
            candidates.forEach(p => {
              p._score = tokens.filter(t => p.name.toLowerCase().includes(t.toLowerCase())).length;
            });
            candidates.sort((a, b) => b._score - a._score || b.sold - a.sold);
            products = candidates.slice(0, 4);
          }
        }

        // Fallback: top sản phẩm trong category/brand
        if (products.length === 0) {
          products = await prisma.product.findMany({
            where: baseWhere,
            orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
            take: 4,
          });
        }

        // Fallback cuối: nếu brand/category filter quá chặt → bỏ brand
        if (products.length === 0 && detectedBrandId) {
          delete baseWhere.brand_id;
          products = await prisma.product.findMany({
            where: baseWhere,
            orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
            take: 4,
          });
        }

        // Fallback cuối cùng: top bán chạy toàn cửa hàng
        if (products.length === 0) {
          products = await prisma.product.findMany({
            where: { is_deleted: false, stock: { gt: 0 } },
            orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
            take: 4,
          });
          link = '/shop';
        } else {
          link = detectedCatId ? `/shop?category=${detectedCatId}` : (products[0] ? `/product/${products[0].id}` : '/shop');
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

        // Detect category + brand cho tư vấn chính xác hơn
        const catId = KC.detectCategory(message);
        if (catId) {
          const expandedIds = KC.expandCategoryIds(catId);
          whereClause.category_id = expandedIds.length === 1 ? expandedIds[0] : { in: expandedIds };
        }
        const brandId = KC.detectBrand(message);
        if (brandId) whereClause.brand_id = brandId;

        products = await prisma.product.findMany({
          where: whereClause,
          orderBy: [{ rating: 'desc' }, { sold: 'desc' }],
          take: 4,
        });

        // Fallback nếu filter quá chặt
        if (products.length === 0) {
          delete whereClause.brand_id;
          delete whereClause.category_id;
          products = await prisma.product.findMany({
            where: whereClause,
            orderBy: [{ rating: 'desc' }, { sold: 'desc' }],
            take: 4,
          });
        }

        if (products[0]) link = `/product/${products[0].id}`;
        break;
      }

      // ── So sánh sản phẩm ──────────────────────────────────────────────────
      case 'COMPARE_PRODUCT':
      case 'COMPARE_SPECS': {
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

        if (products.length === 0) {
          products = await prisma.product.findMany({
            where: { is_deleted: false, stock: { gt: 0 } },
            orderBy: { sold: 'desc' },
            take: 4,
          });
        }
        break;
      }

      // ── Kiểm tra tồn kho (nâng cấp: thêm brand detection) ─────────────────
      case 'CHECK_STOCK': {
        const stockStopWords = new Set(['con','hang','khong','shop','san','co','gap','het','ngay']);
        const tokens = norm.split(/\s+/).filter(w => !stockStopWords.has(w) && w.length > 1);
        const keyword = tokens.join(' ').trim();

        const brandId = KC.detectBrand(message);
        const stockWhere = { is_deleted: false };
        if (brandId) stockWhere.brand_id = brandId;

        if (keyword) {
          const found = await prisma.product.findFirst({
            where: { ...stockWhere, name: { contains: keyword, mode: 'insensitive' } }
          });
          if (found) {
            products = [found];
            link = `/product/${found.id}`;
          }
        }
        break;
      }

      // ── Sản phẩm bán chạy (nâng cấp: category-aware) ──────────────────────
      case 'ASK_BEST_SELLER': {
        const catId = KC.detectCategory(message);
        const baseWhere = { is_deleted: false };
        if (catId) {
          const expandedIds = KC.expandCategoryIds(catId);
          baseWhere.category_id = expandedIds.length === 1 ? expandedIds[0] : { in: expandedIds };
        }
        products = await prisma.product.findMany({
          where: baseWhere,
          orderBy: { sold: 'desc' },
          take: 4,
        });
        break;
      }

      // ── Sản phẩm mới nhất (nâng cấp: category-aware) ──────────────────────
      case 'ASK_NEW_ARRIVAL': {
        const catId = KC.detectCategory(message);
        const baseWhere = { is_deleted: false };
        if (catId) {
          const expandedIds = KC.expandCategoryIds(catId);
          baseWhere.category_id = expandedIds.length === 1 ? expandedIds[0] : { in: expandedIds };
        }
        products = await prisma.product.findMany({
          where: baseWhere,
          orderBy: { id: 'desc' },
          take: 4,
        });
        break;
      }

      // ── Camera ─────────────────────────────────────────────────────────────
      case 'ASK_CAMERA': {
        // Detect brand (VD: "camera iPhone 16 Pro Max" → Apple)
        const brandId = KC.detectBrand(message);
        const brandFilter = brandId ? { brand_id: brandId } : {};

        // Nếu hỏi camera điện thoại → tìm điện thoại
        if (/dien thoai|iphone|samsung|galaxy|xiaomi|oppo|vivo|realme|pixel/i.test(norm)) {
          products = await prisma.product.findMany({
            where: { category_id: 'cat-phone', ...brandFilter, is_deleted: false, stock: { gt: 0 } },
            orderBy: [{ sold: 'desc' }],
            take: 4,
          });
        } else {
          // Camera giám sát
          const camCatIds = KC.expandCategoryIds('cat-camera');
          products = await prisma.product.findMany({
            where: { category_id: { in: camCatIds }, ...brandFilter, is_deleted: false, stock: { gt: 0 } },
            orderBy: [{ sold: 'desc' }],
            take: 4,
          });
        }
        if (products[0]) link = `/product/${products[0].id}`;
        break;
      }

      // ── Pin / Sạc ─────────────────────────────────────────────────────────
      case 'ASK_BATTERY': {
        const brandId = KC.detectBrand(message);
        const brandFilter = brandId ? { brand_id: brandId } : {};

        // Nếu hỏi pin điện thoại → tìm điện thoại đó
        if (/dien thoai|iphone|samsung|galaxy|xiaomi|oppo|vivo|realme/i.test(norm)) {
          products = await prisma.product.findMany({
            where: { category_id: 'cat-phone', ...brandFilter, is_deleted: false, stock: { gt: 0 } },
            orderBy: [{ sold: 'desc' }],
            take: 4,
          });
        } else {
          // Sạc dự phòng / sạc cáp
          products = await prisma.product.findMany({
            where: { category_id: { in: ['cat-mobile-acc-powerbank', 'cat-mobile-acc-charger'] }, ...brandFilter, is_deleted: false, stock: { gt: 0 } },
            orderBy: [{ sold: 'desc' }],
            take: 4,
          });
        }
        if (products[0]) link = `/product/${products[0].id}`;
        break;
      }

      // ── Khuyến mãi / Flash sale ───────────────────────────────────────────
      case 'ASK_PROMO': {
        const activeSales = await prisma.flashSale.findMany({
          where: { is_deleted: false, end_time: { gt: new Date() } },
          take: 3,
        });
        if (activeSales.length > 0) {
          policy = 'CHƯƠNG TRÌNH KHUYẾN MÃI ĐANG CHẠY:\n' +
            activeSales.map(s =>
              `- "${s.title}": giảm ${s.discount_percent}%` +
              (s.end_time ? `, kết thúc ${new Date(s.end_time).toLocaleDateString('vi-VN')}` : '')
            ).join('\n');
        }
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
        break;

      // ── Đổi trả / Bảo hành ───────────────────────────────────────────────
      case 'ASK_RETURN':
        policy = 'Đổi trả trong 7 ngày nếu lỗi NSX. Bảo hành chính hãng 12 tháng. Sản phẩm lỗi do người dùng không áp dụng.';
        break;

      // ── Thanh toán ────────────────────────────────────────────────────────
      case 'ASK_PAYMENT':
        policy = 'Hỗ trợ: Tiền mặt, COD, chuyển khoản, MoMo, ZaloPay, VNPAY, Visa/Mastercard. Trả góp 0% lãi suất 3–24 tháng qua thẻ tín dụng.';
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
        break;

      // Các intent còn lại không cần DB
      default:
        break;
    }
  } catch (err) {
    console.warn(`[buildContext] Query thất bại cho intent=${intent}:`, err.message);
  }

  return { products: serializeProducts(products), policy, link, effectiveMessage };
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
    GREETING:         { text: 'Dạ Getshopy xin chào ạ! 👋 Cửa hàng em có hơn 600.000 sản phẩm từ 67 thương hiệu. Anh/chị đang cần tìm gì ạ?', link: null },
    ASK_DELIVERY:     { text: 'Dạ giao nội thành 2–4 tiếng, tỉnh thành 1–3 ngày, miễn phí ship từ 500k ạ!', link: null },
    ASK_RETURN:       { text: 'Dạ đổi trả 7 ngày, bảo hành 12 tháng chính hãng ạ!', link: null },
    ASK_PAYMENT:      { text: 'Dạ hỗ trợ COD, MoMo, ZaloPay, trả góp 0% ạ!', link: null },
    TRACK_ORDER:      { text: 'Dạ anh/chị vào mục "Đơn hàng của tôi" để kiểm tra nhé ạ!', link: '/profile' },
    CANCEL_ORDER:     { text: 'Dạ vào "Đơn hàng của tôi" → Chọn đơn → Hủy đơn nhé ạ!', link: '/profile' },
    FEEDBACK_POSITIVE:{ text: 'Dạ cảm ơn anh/chị rất nhiều! 🌟 Getshopy luôn cố gắng phục vụ tốt nhất ạ!', link: null },
    COMPLAINT:        { text: 'Dạ em thành thật xin lỗi! Anh/chị liên hệ hotline 1800-xxxx để được hỗ trợ ngay ạ!', link: null },
  };

  return defaults[intent] || {
    text: 'Dạ anh/chị cần tư vấn sản phẩm nào? Bên em có hơn 600.000 sản phẩm từ 67 thương hiệu, 8 danh mục chính ạ!',
    link: null,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN: chat() — Pipeline hoàn chỉnh
// ═════════════════════════════════════════════════════════════════════════════
async function chat({ message, history = [], req }) {
  if (!message?.trim()) {
    throw { status: 400, error: 'Message is required' };
  }

  await KC.ensureLoaded();
  const sessionId = req?.ip || req?.headers?.['x-forwarded-for'] || 'default';

  // ── BƯỚC 1: Phân loại intent (mDeBERTa + rule-based) ──────────────────
  const { intent, score, source } = await classifyIntent(message);
  console.log(`[Chat] "${message.slice(0,50)}" → ${intent} (${score.toFixed?.(3) ?? score}, ${source})`);

  // ── BƯỚC 2: Query DB theo intent để lấy context thực (truyền history để xử lý follow-up) ──
  const context = await buildContext(intent, message, history);

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
    const auth = req?.headers?.authorization;
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

  return aiResponse;
}

module.exports = {
  chat,
  buildContext,
  fallbackResponse,
  saveChatLog,
  isFollowUp,
  extractKeywordsFromHistory,
};
