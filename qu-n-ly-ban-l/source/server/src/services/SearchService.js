'use strict';
/**
 * ============================================================
 * SEARCH SERVICE — Getshopy AI Search Engine v2.0
 * services/SearchService.js
 * ============================================================
 *
 * ĐẠI NÂNG CẤP:
 *   - Brand-aware search (filter brand_id thay vì chỉ tìm trong tên)
 *   - Real taxonomy (49 categories: 8 cha + 41 con)
 *   - Parent→Child category expansion
 *   - KnowledgeCache thay vì query DB mỗi request
 *   - Optimized scoring algorithm
 *
 * 3 tính năng:
 *   1. Smart Search (text)       — LLM extract keywords → DB query
 *   2. Visual Search (ảnh)       — Gemini Vision → DB matching
 *   3. Smart Search Image (kết hợp) — ảnh + text → 4 trường hợp
 *
 * @module SearchService
 */

const { prisma } = require('../db');
const { removeDiacritics }     = require('../ai/huggingface');
const { analyzeProductImage }  = require('../ai/visualSearch');
const { generateChatResponse } = require('../ai/llm');
const KC  = require('./KnowledgeCache');
const PSC = require('./ProductSpecsCache');

// ── Định dạng tiền tệ ────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Serialize BigInt → Number + thêm top 3 specs, bỏ fields dư thừa */
function serializeProducts(products, categoryMap = {}) {
  return products.slice(0, 8).map(p => {
    let imagesArr = [];
    if (Array.isArray(p.images)) {
      imagesArr = p.images;
    } else if (typeof p.images === 'string') {
      try { imagesArr = JSON.parse(p.images); } catch (_) { imagesArr = []; }
    }
    const mainImg = imagesArr[0] || (typeof p.image === 'string' && !p.image.startsWith('[') ? p.image : null);

    const specs = PSC.getTopSpecs(p, 3);

    return {
      id:       Number(p.id),
      name:     p.name,
      price:    Number(p.price),
      original_price: p.original_price ? Number(p.original_price) : Number(p.price),
      image:    mainImg,
      // BỎ: images array, stock, description HTML, variants
      rating:   p.rating ? Number(p.rating) : null,
      sold:     Number(p.sold || 0),
      category: categoryMap[p.category_id] || null,
      specs:    specs,  // Top 3 specs
    };
  });
}

/**
 * Build WHERE clause cho category — hỗ trợ parent→child expansion
 * Nếu catId là parent → trả IN tất cả child IDs
 * Nếu catId là child → trả chính nó
 */
function buildCategoryFilter(catId) {
  if (!catId) return {};
  const expandedIds = KC.expandCategoryIds(catId);
  return expandedIds.length === 1
    ? { category_id: expandedIds[0] }
    : { category_id: { in: expandedIds } };
}

/**
 * Build WHERE clause cho brand — lookup brand_id từ KnowledgeCache
 */
function buildBrandFilter(brandName) {
  if (!brandName) return {};
  const brandId = KC.detectBrand(brandName);
  return brandId ? { brand_id: brandId } : {};
}


// ═════════════════════════════════════════════════════════════════════════════
// 1. SMART SEARCH — Tìm kiếm bằng text (LLM extract keywords)
// ═════════════════════════════════════════════════════════════════════════════
async function smartSearch(query) {
  if (!query || !String(query).trim()) {
    throw { status: 400, error: 'query is required' };
  }

  await KC.ensureLoaded();
  const rawQuery = String(query).trim();
  const categoryMap = KC.getCategoryMap();

  // ── BƯỚC 1: Gọi LLM để extract search keywords từ câu mơ hồ ─────────────
  const HF_API_KEY  = process.env.HF_API_KEY;
  const HF_LLM_MODEL = process.env.HF_LLM_MODEL || 'Qwen/Qwen2.5-7B-Instruct';
  const HF_LLM_URL   = 'https://router.huggingface.co/featherless-ai/v1/chat/completions';

  let keywords = [];
  let categoryHint = null;
  let brandHint = null;
  let priceMax = null;
  let priceMin = null;
  let hint = '';

  // Lấy taxonomy thực từ KnowledgeCache cho prompt
  const categoryTaxonomy = KC.getCategoryTaxonomyForPrompt();
  const brandNames = KC.getBrandNamesForPrompt();

  if (HF_API_KEY) {
    const systemPrompt = `Bạn là AI trợ lý tìm kiếm sản phẩm cho cửa hàng điện tử Getshopy (600.000+ sản phẩm, 67 thương hiệu).
Nhiệm vụ: Phân tích câu tìm kiếm của khách hàng và trả về JSON.

DANH MỤC HỢP LỆ (chọn CHÍNH XÁC 1, ưu tiên danh mục cấp 2 cụ thể hơn):
${categoryTaxonomy}

THƯƠNG HIỆU HỢP LỆ: ${brandNames}

Trả về JSON:
- "keywords": mảng tối đa 3 từ khóa SẢN PHẨM (tiếng Việt có dấu, danh từ chính yếu). KHÔNG đưa tên thương hiệu vào keywords. KHÔNG đưa từ chung chung (tốt, xịn, cao cấp).
- "brand": tên thương hiệu chính xác từ danh sách trên, hoặc null. VD: "Apple", "Samsung", "Anker".
- "category": tên danh mục CHÍNH XÁC từ danh sách trên, hoặc null. Ưu tiên danh mục cấp 2 cụ thể.
- "price_max": ngân sách tối đa (VNĐ). "dưới X triệu" = X*1000000. null nếu không đề cập.
- "price_min": ngân sách tối thiểu (VNĐ). null nếu không đề cập.
- "hint": câu giải thích ngắn tiếng Việt về kết quả.

Ví dụ:
- "tai nghe chống ồn Sony" → {"keywords":["tai nghe","chống ồn"],"brand":"Sony","category":"Tai nghe chụp tai","price_max":null,"price_min":null,"hint":"Tai nghe chống ồn Sony"}
- "sạc dự phòng Anker 20000mAh" → {"keywords":["sạc dự phòng","20000mAh"],"brand":"Anker","category":"Sạc dự phòng","price_max":null,"price_min":null,"hint":"Sạc dự phòng Anker 20000mAh"}
- "laptop gaming dưới 30 triệu" → {"keywords":["gaming"],"brand":null,"category":"Laptop","price_max":30000000,"price_min":null,"hint":"Laptop gaming dưới 30 triệu"}
- "chuột không dây Logitech" → {"keywords":["chuột","không dây"],"brand":"Logitech","category":"Chuột máy tính","price_max":null,"price_min":null,"hint":"Chuột không dây Logitech"}
- "camera ngoài trời Dahua" → {"keywords":["camera"],"brand":"Dahua","category":"Camera ngoài trời","price_max":null,"price_min":null,"hint":"Camera ngoài trời Dahua"}
- "ốp lưng iPhone 15" → {"keywords":["ốp lưng","iPhone 15"],"brand":"Apple","category":"Ốp lưng điện thoại","price_max":null,"price_min":null,"hint":"Ốp lưng cho iPhone 15"}

Chỉ trả về JSON thuần, không có markdown hay text bổ sung.`;

    try {
      const response = await fetch(HF_LLM_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: HF_LLM_MODEL,
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
            keywords     = Array.isArray(parsed.keywords) ? parsed.keywords : [];
            brandHint    = parsed.brand ? String(parsed.brand).trim() : null;
            categoryHint = parsed.category || null;
            priceMax     = parsed.price_max ? Number(parsed.price_max) : null;
            priceMin     = parsed.price_min ? Number(parsed.price_min) : null;
            hint         = parsed.hint || '';
            console.log(`[SmartSearch] LLM → keywords=${JSON.stringify(keywords)}, brand=${brandHint}, category=${categoryHint}`);
          }
        }
      }
    } catch (llmErr) {
      console.warn('[SmartSearch] LLM failed, using fallback:', llmErr.message);
    }
  }

  // ── Fallback: rule-based nếu LLM thất bại ───────────────────────────────
  if (keywords.length === 0 && !brandHint && !categoryHint) {
    // Thử detect brand/category từ KnowledgeCache
    brandHint = null;
    const detectedBrandId = KC.detectBrand(rawQuery);
    if (detectedBrandId) {
      const brandMap = KC.getBrandMap();
      brandHint = brandMap[detectedBrandId] || null;
    }
    const detectedCatId = KC.detectCategory(rawQuery);
    if (detectedCatId) {
      categoryHint = categoryMap[detectedCatId] || null;
    }

    const norm = removeDiacritics(rawQuery).toLowerCase();
    const stopWords = new Set(['toi','muon','can','mua','tim','kiem','cho','mot','cai','san','pham','cua','va','hoac','hay','la','de','xem','gia']);
    keywords = norm.split(/\s+/).filter(w => !stopWords.has(w) && w.length > 1).slice(0, 4);
    hint = `Kết quả cho "${rawQuery}"`;
  }

  // ── BƯỚC 2: Resolve category & brand → DB IDs ────────────────────────────
  const allCategories = KC.getCategories();

  const priceFilter = {};
  if (priceMax) priceFilter.lte = priceMax;
  if (priceMin) priceFilter.gte = priceMin;

  // Resolve category
  let matchedCatId = null;
  if (categoryHint) {
    matchedCatId = KC.findCategoryIdByName(categoryHint);
  }

  // Resolve brand → brand_id filter
  let brandFilter = {};
  if (brandHint) {
    const brandId = KC.detectBrand(brandHint);
    if (brandId) brandFilter = { brand_id: brandId };
  }

  // Category expansion (parent → children)
  const categoryFilter = buildCategoryFilter(matchedCatId);

  // Filter keywords: bỏ từ trùng tên category
  let filteredKeywords = keywords;
  if (matchedCatId) {
    const catName = categoryMap[matchedCatId] || '';
    const catWords = new Set(removeDiacritics(catName).toLowerCase().split(/\s+/));
    filteredKeywords = keywords.filter(k => {
      const kNorm = removeDiacritics(k).toLowerCase();
      return !catWords.has(kNorm) && !kNorm.split(/\s+/).every(w => catWords.has(w));
    });
  }

  // ── BƯỚC 3: Query DB — Strategy: category + brand + keywords ─────────────
  let products = [];

  if (matchedCatId || Object.keys(brandFilter).length > 0) {
    // STRATEGY A: Có category và/hoặc brand → precision search
    const baseWhere = {
      ...categoryFilter,
      ...brandFilter,
      is_deleted: false,
      ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
    };

    if (filteredKeywords.length > 0) {
      // A1: category/brand + ALL keywords
      const andProducts = await prisma.product.findMany({
        where: {
          ...baseWhere,
          AND: filteredKeywords.map(k => ({ name: { contains: k, mode: 'insensitive' } })),
        },
        take: 50,
      });

      if (andProducts.length > 0) {
        andProducts.forEach(p => {
          const pNorm = removeDiacritics(p.name || '').toLowerCase();
          p._score = filteredKeywords.filter(k => pNorm.includes(removeDiacritics(k).toLowerCase())).length * 5;
        });
        andProducts.sort((a, b) => b._score - a._score || b.sold - a.sold);
        products = andProducts.slice(0, 8);
      }

      // A2: AND too strict → try OR
      if (products.length < 2 && filteredKeywords.length >= 2) {
        const orProducts = await prisma.product.findMany({
          where: {
            ...baseWhere,
            OR: filteredKeywords.map(k => ({ name: { contains: k, mode: 'insensitive' } })),
          },
          take: 50,
        });
        orProducts.forEach(p => {
          const pNorm = removeDiacritics(p.name || '').toLowerCase();
          p._score = filteredKeywords.filter(k => pNorm.includes(removeDiacritics(k).toLowerCase())).length * 5;
        });
        orProducts.sort((a, b) => b._score - a._score || b.sold - a.sold);
        const fromOr = orProducts.filter(p => p._score >= 5).slice(0, 8);
        if (fromOr.length > products.length) products = fromOr;
      }
    }

    // A3: Keywords không match → top sản phẩm trong category/brand
    if (products.length < 2) {
      const topProducts = await prisma.product.findMany({
        where: baseWhere,
        orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
        take: 8,
      });
      const existingIds = new Set(products.map(p => String(p.id)));
      for (const p of topProducts) {
        if (!existingIds.has(String(p.id))) { products.push(p); existingIds.add(String(p.id)); }
        if (products.length >= 8) break;
      }
    }

  } else if (filteredKeywords.length > 0) {
    // STRATEGY B: Chỉ có keywords → full search

    // B1: AND all keywords
    const kwProducts = await prisma.product.findMany({
      where: {
        AND: filteredKeywords.map(k => ({ name: { contains: k, mode: 'insensitive' } })),
        is_deleted: false,
        ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
      },
      take: 50,
    });
    kwProducts.forEach(p => {
      const pNorm = removeDiacritics(p.name || '').toLowerCase();
      p._score = filteredKeywords.filter(k => pNorm.includes(removeDiacritics(k).toLowerCase())).length * 5;
    });
    kwProducts.sort((a, b) => b._score - a._score || b.sold - a.sold);
    products = kwProducts.filter(p => p._score >= filteredKeywords.length * 5).slice(0, 8);

    // B2: AND quá chặt → OR
    if (products.length === 0 && filteredKeywords.length >= 2) {
      const kwOrProducts = await prisma.product.findMany({
        where: {
          OR: filteredKeywords.map(k => ({ name: { contains: k, mode: 'insensitive' } })),
          is_deleted: false,
          ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
        },
        take: 50,
      });
      kwOrProducts.forEach(p => {
        const pNorm = removeDiacritics(p.name || '').toLowerCase();
        p._score = filteredKeywords.filter(k => pNorm.includes(removeDiacritics(k).toLowerCase())).length * 5;
      });
      kwOrProducts.sort((a, b) => b._score - a._score || b.sold - a.sold);
      products = kwOrProducts.filter(p => p._score >= 10).slice(0, 8);
    }
  }

  // ── BƯỚC 4: Fallback ────────────────────────────────────────────────────
  if (products.length === 0) {
    const hasPriceFilter = Object.keys(priceFilter).length > 0;

    if (hasPriceFilter) {
      if (matchedCatId || Object.keys(brandFilter).length > 0) {
        products = await prisma.product.findMany({
          where: { ...categoryFilter, ...brandFilter, is_deleted: false, price: priceFilter },
          orderBy: [{ price: 'asc' }],
          take: 8,
        });
        if (products.length > 0) hint = `Các sản phẩm phù hợp trong tầm giá`;
      }

      if (products.length === 0) {
        products = await prisma.product.findMany({
          where: { is_deleted: false, price: priceFilter, stock: { gt: 0 } },
          orderBy: [{ sold: 'desc' }],
          take: 8,
        });
        hint = hint || `Sản phẩm trong tầm giá`;
      }

      if (products.length === 0) {
        hint = `Không tìm thấy sản phẩm nào trong tầm giá này`;
      }
    } else {
      products = await prisma.product.findMany({
        where: { is_deleted: false, stock: { gt: 0 }, ...categoryFilter, ...brandFilter },
        orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
        take: 8,
      });
      hint = hint || 'Sản phẩm bán chạy nhất';
    }
  }

  const serialized = serializeProducts(products, categoryMap);
  return { products: serialized, hint, keywords };
}


// ═════════════════════════════════════════════════════════════════════════════
// 2. VISUAL SEARCH — Tìm kiếm bằng hình ảnh (Gemini Vision)
// ═════════════════════════════════════════════════════════════════════════════
async function visualSearch(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw { status: 400, error: 'imageBase64 la bat buoc' };
  }
  if (!imageBase64.startsWith('data:image/')) {
    throw { status: 400, error: 'Dinh dang anh khong hop le.' };
  }

  await KC.ensureLoaded();
  console.log('[VisualSearch] Nhan yeu cau, kich thuoc:', Math.round(imageBase64.length / 1024), 'KB');

  // BUOC 1 & 2: Gemini Vision phân tích ảnh
  const { caption, analysis } = await analyzeProductImage(imageBase64);

  if (!caption && !analysis) {
    return {
      text: 'Da em chua nhan dang duoc san pham trong anh nay a! Anh/chi co the mo ta them bang van ban de em tim kiem giup khong a?',
      products: [], caption: null, analysis: null,
    };
  }

  if (analysis && !analysis.category && analysis.keywords?.length === 0) {
    return {
      text: `Da em thay trong anh la: "${analysis.description_vi || caption}". Day co ve khong phai san pham dien tu a.`,
      products: [], caption, analysis,
    };
  }

  // BUOC 3: Đối chiếu AI → DB bằng brand_id + category_id (thay vì chỉ name search)
  const keywords = (analysis?.keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean);
  const brand    = (analysis?.brand    || '').trim();
  const category = analysis?.category  || null;
  const color    = (analysis?.color    || '').toLowerCase().trim();

  // Resolve category → ID (dùng KnowledgeCache thay vì query DB)
  let categoryId = null;
  if (category) {
    categoryId = KC.findCategoryIdByName(category);
  }

  // Resolve brand → brand_id (dùng KnowledgeCache thay vì query DB)
  let brandId = null;
  if (brand) {
    brandId = KC.detectBrand(brand);
  }

  let candidates = [];
  const categoryFilter = buildCategoryFilter(categoryId);
  const brandFilterObj = brandId ? { brand_id: brandId } : {};

  // Strategy 1: category + brand (most precise)
  if (categoryId && brandId) {
    const precise = await prisma.product.findMany({
      where: { ...categoryFilter, brand_id: brandId, is_deleted: false, stock: { gt: 0 } },
      orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
      take: 30,
    });
    candidates.push(...precise);
  }

  // Strategy 2: category only
  if (categoryId && candidates.length < 10) {
    const byCat = await prisma.product.findMany({
      where: { ...categoryFilter, is_deleted: false, stock: { gt: 0 } },
      orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
      take: 40,
    });
    candidates.push(...byCat);
  }

  // Strategy 3: brand only
  if (brandId && candidates.length < 10) {
    const byBrand = await prisma.product.findMany({
      where: { brand_id: brandId, is_deleted: false, stock: { gt: 0 } },
      orderBy: [{ sold: 'desc' }],
      take: 30,
    });
    candidates.push(...byBrand);
  }

  // Strategy 4: keyword search
  if (keywords.length > 0 && candidates.length < 10) {
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

  // Fallback: top bán chạy
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

  // Multi-dimensional scoring (nâng cấp: brand_id match quan trọng hơn)
  candidates.forEach(p => {
    const pName = (p.name || '').toLowerCase();
    let score = 0;
    // Category match (dùng expanded IDs)
    if (categoryId) {
      const catIds = KC.expandCategoryIds(categoryId);
      if (catIds.includes(p.category_id)) score += 20;
    }
    // Brand match (dùng brand_id thay vì tìm trong tên — chính xác hơn)
    if (brandId && p.brand_id === brandId) score += 18;
    // Keyword match
    keywords.forEach(k => { if (pName.includes(k)) score += 8; });
    // Color match
    if (color && pName.includes(color)) score += 3;
    // Popularity bonus
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
  const visualContext = { products: serializedProducts };
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

  console.log(`[VisualSearch] Hoàn thành — ${serializedProducts.length} SP, brand=${brandId || 'none'}, cat=${categoryId || 'none'}`);
  return { text: responseText, products: serializedProducts, caption, analysis };
}


// ═════════════════════════════════════════════════════════════════════════════
// 3. SMART SEARCH WITH IMAGE — Kết hợp ảnh + text từ searchbar
// ═════════════════════════════════════════════════════════════════════════════
async function smartSearchWithImage(query, imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw { status: 400, error: 'imageBase64 is required' };
  }
  if (!imageBase64.startsWith('data:image/')) {
    throw { status: 400, error: 'Invalid image format' };
  }

  await KC.ensureLoaded();
  const rawQuery = String(query || '').trim();
  const categoryMap = KC.getCategoryMap();

  // ── BƯỚC 1: Phân tích ảnh (luôn chạy) ────────────────────────────────
  const { caption, analysis } = await analyzeProductImage(imageBase64);

  const imageKeywords  = (analysis?.keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean);
  const imageBrand     = (analysis?.brand    || '').trim();
  const imageCategory  = analysis?.category  || null;
  const imageDescVI    = analysis?.description_vi || caption || '';

  let products = [];
  let hint     = '';
  let mode     = 'image_only';

  // ── BƯỚC 2: Xác định trường hợp ──────────────────────────────────────
  const VAGUE_PATTERNS = /^(tìm|tìm kiếm|mua|xem|tương tự|giống|kiểu này|loại này|cái này|sản phẩm này|gợi ý|recommend|similar|like this|tư vấn)$/i;
  const isQueryEmpty  = !rawQuery;
  const isQueryVague  = rawQuery && VAGUE_PATTERNS.test(rawQuery.replace(/\s+/g, ' ').trim());

  // Kiểm tra query có liên quan đến ảnh không (dùng rule-based thay vì gọi LLM)
  let isQueryRelated = false;
  if (rawQuery && !isQueryVague) {
    const queryNorm = removeDiacritics(rawQuery).toLowerCase();
    const imageTerms = [...imageKeywords, imageBrand.toLowerCase(), (imageCategory || '').toLowerCase()].filter(Boolean);
    isQueryRelated = imageTerms.some(t => t.length > 1 && queryNorm.includes(removeDiacritics(t).toLowerCase()));

    // Nếu không match → thử detect brand/category overlap
    if (!isQueryRelated) {
      const queryBrandId = KC.detectBrand(rawQuery);
      const imageBrandId = imageBrand ? KC.detectBrand(imageBrand) : null;
      if (queryBrandId && imageBrandId && queryBrandId === imageBrandId) isQueryRelated = true;

      const queryCatId = KC.detectCategory(rawQuery);
      const imageCatId = imageCategory ? KC.findCategoryIdByName(imageCategory) : null;
      if (queryCatId && imageCatId) {
        const queryExpanded = KC.expandCategoryIds(queryCatId);
        const imageExpanded = KC.expandCategoryIds(imageCatId);
        if (queryExpanded.some(id => imageExpanded.includes(id))) isQueryRelated = true;
      }
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

  console.log(`[SmartSearchImage] mode=${mode}, query="${rawQuery}", imageBrand=${imageBrand}, imageCat=${imageCategory}`);

  // ── BƯỚC 3: Query DB theo mode ────────────────────────────────────────

  if (mode === 'image_only' || mode === 'ai_both') {
    const imageCatId = KC.findCategoryIdByName(imageCategory);
    const imageBrandId = imageBrand ? KC.detectBrand(imageBrand) : null;
    const catFilter = buildCategoryFilter(imageCatId);
    const brFilter = imageBrandId ? { brand_id: imageBrandId } : {};
    const searchTerms = [...imageKeywords].filter(Boolean);

    // First: brand + category precision
    if (imageCatId || imageBrandId) {
      const baseWhere = { ...catFilter, ...brFilter, is_deleted: false };

      if (searchTerms.length > 0) {
        let rows = await prisma.product.findMany({
          where: {
            ...baseWhere,
            AND: searchTerms.slice(0, 2).map(k => ({ name: { contains: k, mode: 'insensitive' } })),
          },
          take: 50,
        });
        if (rows.length === 0) {
          rows = await prisma.product.findMany({
            where: {
              ...baseWhere,
              OR: searchTerms.map(k => ({ name: { contains: k, mode: 'insensitive' } })),
            },
            take: 50,
          });
        }
        rows.forEach(p => {
          const n = (p.name || '').toLowerCase();
          p._score = searchTerms.filter(k => n.includes(k.toLowerCase())).length * 5;
        });
        rows.sort((a, b) => b._score - a._score || b.sold - a.sold);
        products = rows.slice(0, 8);
      } else {
        products = await prisma.product.findMany({
          where: baseWhere,
          orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
          take: 8,
        });
      }
    }

    // ai_both → merge thêm smart-search text results
    if (mode === 'ai_both' && rawQuery) {
      try {
        const textResult = await smartSearch(rawQuery);
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
    try {
      const d = await smartSearch(rawQuery);
      products = (d.products || []).map(p => ({ ...p, category_id: null }));
      hint     = d.hint || `Kết quả cho "${rawQuery}"`;
    } catch (e) {
      console.warn('[SmartSearchImage] text_only smart-search failed:', e.message);
    }

  } else if (mode === 'combined') {
    const imageCatId = KC.findCategoryIdByName(imageCategory);
    try {
      const d = await smartSearch(`${rawQuery} ${imageBrand || ''} ${imageCategory || ''}`.trim());
      const textProducts = (d.products || []).map(p => ({ ...p, category_id: null }));
      if (imageCatId) {
        const catIds = KC.expandCategoryIds(imageCatId);
        const catNames = catIds.map(id => categoryMap[id]).filter(Boolean);
        const inCat   = textProducts.filter(p => catNames.includes(p.category));
        const outCat  = textProducts.filter(p => !catNames.includes(p.category));
        products = [...inCat, ...outCat].slice(0, 8);
      } else {
        products = textProducts.slice(0, 8);
      }
      hint = `Kết quả kết hợp ảnh + "${rawQuery}"`;
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

  const serialized = serializeProducts(products, categoryMap);

  return {
    products: serialized,
    hint,
    mode,
    imageCaption: imageDescVI,
    imageAnalysis: { brand: analysis?.brand, category: imageCategory, keywords: imageKeywords },
  };
}


module.exports = {
  smartSearch,
  visualSearch,
  smartSearchWithImage,
};
