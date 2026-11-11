'use strict';
/**
 * ============================================================
 * RECOMMENDATION SERVICE — Getshopy AI Product Recommendations v4.0
 * services/RecommendationService.js
 * ============================================================
 *
 * ĐẠI NÂNG CẤP v4 — Behavior-Aware Personalization:
 *   - [v3] Category/Brand-based recommendations
 *   - [v3] Specs-based similarity scoring (ProductSpecsCache)
 *   - [v3] Flash sale price overlay + KnowledgeCache
 *   - [NEW v4] Recently Viewed re-engagement
 *   - [NEW v4] Collaborative Filtering (user-user session overlap)
 *   - [NEW v4] User Preference Profile (weighted category/brand/price)
 *   - [NEW v4] Trending Products (velocity-based)
 *
 * Strategy v4 (khi có behavior data):
 *   1. Recently Viewed + Not Purchased → 2 SP (re-engagement)
 *   2. Collaborative Filtering (similar users) → 2 SP
 *   3. User Preference (top category/brand from profile) → 2 SP
 *   4. Trending Products → 2 SP
 *   Fallback: v3 strategy nếu không đủ data
 *
 * @module RecommendationService
 */

const { prisma } = require('../db');
const KC  = require('./KnowledgeCache');
const PSC = require('./ProductSpecsCache');
const BS  = require('./BehaviorService');

// ─────────────────────────────────────────────────────────────────────────────
// AI Rec Container Integration (Collaborative Filtering via HTTP)
// Docker: AI_REC_URL=http://ai-rec:8000 | Local dev: http://localhost:8000
// ─────────────────────────────────────────────────────────────────────────────
const AI_REC_URL = process.env.AI_REC_URL || null;

/**
 * Gọi AI Rec container để lấy CF-based recommendations.
 * Trả về mảng product_ids hoặc [] nếu AI container không khả dụng.
 *
 * @param {string} customerId - ID khách hàng (VD: "CUST_0001")
 * @param {number} topK - Số lượng gợi ý tối đa
 * @returns {Promise<string[]>} - Mảng product_id strings từ AI model
 */
async function fetchAIRecRecommendations(customerId, topK = 8) {
  if (!AI_REC_URL) return [];
  try {
    const url = `${AI_REC_URL}/api/v1/recommend/customer/${encodeURIComponent(customerId)}?top_k=${topK}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return [];
    const data = await response.json();
    // data.recommendations = [{product_id: "..."}, ...]
    return (data.recommendations || []).map(r => r.product_id);
  } catch (err) {
    console.warn('[RecommendationService] AI Rec container unavailable, using fallback:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI-Rec realtime — gửi kèm món khách ĐÃ MUA (12/11/2026)
//
// AI-Rec chỉ train lại mỗi ngày lúc 22:00 (TRAIN_DAILY_AT), nên đơn mua trong ngày chưa
// vào hồ sơ khách: khách vừa mua điện thoại vẫn được gợi ý y như hôm qua. POST
// /api/v1/recommend/realtime nhận kèm danh sách món đã mua và ghép phần bản train chưa
// biết vào hồ sơ lúc suy luận, chấm bằng ma trận tương đồng đã train — không train lại
// (ai-rec/models/hybrid.py, live_purchases). Response cùng schema với GET.
//
// Giai đoạn 1 CHỈ gửi món đã mua; hành vi xem/giỏ chưa gửi (phạm vi người dùng đã duyệt).
// ─────────────────────────────────────────────────────────────────────────────

// Mẫu 1.975 khách (Postgres, 12/11/2026): số món khác nhau đã mua có trung vị 83, p90 207,
// p99 321. Món cũ hơn đã nằm trong bản train và AI-Rec giữ nguyên trọng số của chúng, nên
// cắt ở 200 món gần nhất không làm mất gì — chỉ cần phủ hết đơn kể từ lượt train gần nhất.
const AI_REC_LIVE_PURCHASES_LIMIT = 200;

// Đo 12/11/2026: GET trên ai-rec production p50 15 ms, p90 34 ms (30 khách, chưa có cache);
// POST trên model tổng hợp cỡ production p95 26 ms qua FastAPI. 1,5 s dư hai bậc độ lớn lúc
// bình thường mà vẫn chặn được lúc ai-rec treo (vd. đang train 22:00): hết giờ thì rơi về
// GET rồi rule-based — khách không thấy lỗi, chỉ thấy gợi ý chưa tính đơn hôm nay.
// Ngoại lệ đã gặp: lần gọi ĐẦU sau lúc nhàn rỗi mất 2,6 s (máy 16 GB, nghi bộ nhớ model bị
// đẩy ra) — khi đó POST hết giờ và GET gánh, tổng chờ tối đa 1,5 s + 3 s của GET.
const AI_REC_REALTIME_TIMEOUT_MS = 1500;

/**
 * Mã các món khách ĐÃ MUA THẬT, món mua gần nhất trước, tối đa `limit` món khác nhau.
 *
 * "Đã mua" = đơn ĐÃ THANH TOÁN và KHÔNG HUỶ (payment_status = 'PAID' AND status <> 'CANCELLED'),
 * dòng hàng số lượng > 0, sản phẩm còn bán — ĐÚNG định nghĩa tập train của AI-Rec (dbt
 * serving.pairs_customer_product / purchase_events_for_AI_rec) và của Product.sold
 * (data-platform-poc/demo_dataset.py sync_sold). Lệch định nghĩa thì món vừa huỷ vẫn vào
 * hồ sơ realtime trong khi lượt train tối nay bỏ nó. COD chỉ thành PAID lúc giao xong
 * (orderLifecycle.markDelivered), chuyển khoản lúc webhook báo tiền về.
 *
 * Đơn huỷ SAU lượt train vẫn còn trong hồ sơ đã train tới 22:00: danh sách này chỉ cộng
 * vào hồ sơ, không bớt (thiếu một món trong 200 món gần nhất không có nghĩa là đã huỷ).
 *
 * Dùng index sẵn có Order(customer_id), OrderItem(order_id), Product(is_deleted, id); đo
 * EXPLAIN ANALYZE khách nhiều đơn nhất (624 đơn, 490 món): 12 ms khi cache nóng.
 *
 * @param {number|string|bigint} customerId - B2CCustomer.id (từ token)
 * @returns {Promise<string[]>} - ProductID dạng chuỗi, như AI-Rec train (toString)
 */
async function getRecentPurchasedProductIds(customerId, limit = AI_REC_LIVE_PURCHASES_LIMIT) {
  const rows = await prisma.$queryRaw`
    SELECT oi.product_id
    FROM "Order" o
    JOIN "OrderItem" oi ON oi.order_id = o.id
    JOIN "Product" p ON p.id = oi.product_id AND p.is_deleted = false
    WHERE o.customer_id = ${BigInt(customerId)}
      AND o.payment_status = 'PAID'
      AND o.status <> 'CANCELLED'
      AND oi.quantity > 0
    GROUP BY oi.product_id
    ORDER BY MAX(o.date) DESC, oi.product_id DESC
    LIMIT ${limit}
  `;
  // product_id là BigInt: JSON.stringify ném lỗi với BigInt, và AI-Rec so khớp mã dạng chuỗi
  return rows.map(r => String(r.product_id));
}

/**
 * POST /api/v1/recommend/realtime. Trả mảng product_id theo thứ hạng của AI.
 *
 * NÉM lỗi khi HTTP lỗi hoặc hết giờ (khác fetchAIRecRecommendations trả []): bên gọi phải
 * phân biệt "AI trả lời, không có gì để gợi ý" với "AI không trả lời" — chỉ trường hợp
 * sau mới rơi về GET. Đồng hồ bao cả lúc đọc body.
 */
async function fetchAIRecRealtime(customerId, purchasedProductIds, topK) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_REC_REALTIME_TIMEOUT_MS);
  try {
    const response = await fetch(`${AI_REC_URL}/api/v1/recommend/realtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: String(customerId),
        purchased_product_ids: purchasedProductIds,
        top_k: topK,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return (data.recommendations || []).map(r => r.product_id);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Nhánh AI cho khách đã đăng nhập. Chuỗi dự phòng:
 *   1. POST realtime kèm món đã mua (đọc Postgres)  — gợi ý tính cả đơn hôm nay
 *   2. GET cũ                                       — đọc Postgres lỗi, hoặc POST lỗi/hết giờ
 *   3. []  -> getRecommendations() lấp bằng rule-based như trước
 *
 * @returns {Promise<string[]>}
 */
async function fetchAIRecForCustomer(customerId, topK) {
  let purchased = null;
  try {
    purchased = await getRecentPurchasedProductIds(customerId);
  } catch (err) {
    console.warn('[RecommendationService] Không đọc được món đã mua, dùng GET AI-Rec:', err.message);
  }
  if (purchased !== null) {
    try {
      return await fetchAIRecRealtime(customerId, purchased, topK);
    } catch (err) {
      const why = err.name === 'AbortError' ? `quá ${AI_REC_REALTIME_TIMEOUT_MS} ms` : err.message;
      console.warn('[RecommendationService] AI-Rec realtime lỗi, rơi về GET:', why);
    }
  }
  return fetchAIRecRecommendations(String(customerId), topK);
}

// ─────────────────────────────────────────────────────────────────────────────
// Flash Sale helpers
// ─────────────────────────────────────────────────────────────────────────────

const FLASH_SALE_TTL_MS = 60_000; // 60 giây
let _fsCache = null;
let _fsCacheTime = 0;
let _fsCachePromise = null;

const getActiveFlashSaleItems = async () => {
  if (_fsCache && Date.now() - _fsCacheTime < FLASH_SALE_TTL_MS) return _fsCache;
  if (_fsCachePromise) return _fsCachePromise;
  _fsCachePromise = (async () => {
    try {
      const activeSale = await prisma.flashSale.findFirst({
        where: { is_deleted: false, end_time: { gt: new Date() } }
      });
      const items = activeSale
        ? await prisma.flashSaleItem.findMany({ where: { flash_sale_id: activeSale.id } })
        : [];
      _fsCache = items;
      _fsCacheTime = Date.now();
      return _fsCache;
    } finally {
      _fsCachePromise = null;
    }
  })();
  return _fsCachePromise;
};

const applyFlashSaleToProduct = (product, fsItems) => {
  const fsItem = fsItems.find(i => Number(i.product_id) === Number(product.id));
  if (fsItem) {
    product.original_price = product.price;
    product.price = fsItem.discount_price;
  }
  return product;
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN: getRecommendations() — v4 Behavior-Aware
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Lấy danh sách sản phẩm gợi ý cho khách hàng.
 *
 * v4 Strategy (khi có behavior data — sessionId):
 *   1. Recently Viewed + Not Purchased → 2 SP (re-engagement)
 *   2. Collaborative Filtering → 2 SP (similar users bought)
 *   3. User Preference Profile → 2 SP (top category/brand from behavior)
 *   4. Trending Products → 2 SP
 *
 * Fallback Strategy (không có behavior data):
 *   1. categoryId/brandId specified → 4 top liên quan
 *   2. Top bán chạy toàn cửa hàng → fill remaining
 *   3. Sản phẩm mới nhất → fill remaining
 *
 * @param {string|null} _email - KHÔNG DÙNG. Giữ lại cho đúng chữ ký mà
 *        server/scripts/test-behavior-tracking.js đang gọi. Danh tính khách
 *        đến từ `customerId`, và routes/recommendation.js chỉ lấy nó TỪ TOKEN.
 *        Đừng tra khách theo tham số này: bản trước nhận email rồi không dùng,
 *        nên customerId luôn undefined và nhánh AI-Rec không bao giờ chạy.
 * @param {Object} opts
 * @param {string} [opts.categoryId] - Category ID
 * @param {string} [opts.brandId] - Brand ID
 * @param {string} [opts.sessionId] - Session ID (browser fingerprint)
 * @param {number} [opts.customerId] - B2CCustomer ID
 * @returns {Promise<Array>}
 */
async function getRecommendations(_email = null, { categoryId, brandId, sessionId, customerId } = {}) {
  await KC.ensureLoaded();
  const fsItems = await getActiveFlashSaleItems();

  // Optimized SELECT — không lấy description, variants, branch_ids
  const REC_SELECT = {
    id: true, name: true, price: true, original_price: true,
    image: true, rating: true, sold: true, category_id: true, brand_id: true,
    description: true, // cần cho PSC.getTopSpecs
  };

  // Deduplicate helper
  const seenIds = new Set();
  const results = [];
  const addUnique = (products) => {
    for (const p of products) {
      const pid = Number(p.id);
      if (seenIds.has(pid)) continue;
      seenIds.add(pid);

      const specs = PSC.getTopSpecs(p, 3);

      results.push(applyFlashSaleToProduct({
        id: pid,
        name: p.name,
        price: Number(p.price),
        original_price: Number(p.original_price || p.price),
        image: p.image,
        rating: p.rating ? Number(p.rating) : null,
        sold: Number(p.sold || 0),
        category_id: p.category_id,
        brand_id: p.brand_id,
        specs: specs,  // Top 3 specs
      }, fsItems));
    }
  };

  // Helper: lấy sản phẩm theo danh sách id, GIỮ ĐÚNG THỨ TỰ của `ids`.
  // findMany(... IN ...) không có ORDER BY nên Postgres trả theo thứ tự tuỳ ý (thường là
  // theo id): AI-Rec xếp hạng 8,7,…,1 mà trang hiển thị 1,…,8 — mất thứ hạng của model
  // (kiểm chứng 12/11/2026). Mọi nơi gọi hàm này đều truyền id theo thứ tự có ý nghĩa
  // (thứ hạng AI, mới xem gần nhất, trending) nên sắp lại theo vị trí trong `ids`.
  const fetchProductsByIds = async (ids) => {
    if (!ids || ids.length === 0) return [];
    const rows = await prisma.product.findMany({
      where: { id: { in: ids.map(BigInt) }, is_deleted: false, stock: { gt: 0 } },
      select: REC_SELECT,
    });
    const rank = new Map();
    ids.forEach((id, i) => { if (!rank.has(String(id))) rank.set(String(id), i); });
    return rows.sort((a, b) => (rank.get(String(a.id)) ?? Infinity) - (rank.get(String(b.id)) ?? Infinity));
  };

  // ═══════════════════════════════════════════════════════════════════════
  // v4 STRATEGY — Behavior-Aware (khi có sessionId)
  // ═══════════════════════════════════════════════════════════════════════
  if (sessionId) {
    try {
      // ── 1. Recently Viewed (re-engagement) ──────────────────────────
      const recentIds = await BS.getRecentlyViewed(sessionId, customerId, 4);
      if (recentIds.length > 0) {
        const recentProducts = await fetchProductsByIds(recentIds.slice(0, 2));
        addUnique(recentProducts);
      }

      // ── 2. Collaborative Filtering ─────────────────────────────────
      const collabIds = await BS.getCollaborativeRecommendations(sessionId, customerId, 4);
      if (collabIds.length > 0) {
        const collabProducts = await fetchProductsByIds(collabIds.slice(0, 2));
        addUnique(collabProducts);
      }

      // ── 3. User Preference Profile → category/brand aware ─────────
      const profile = await BS.getUserProfile(
        customerId || sessionId,
        customerId ? 'customer' : 'session'
      );

      if (profile && profile.categories.length > 0) {
        const prefCatId = profile.categories[0].id; // Top category
        const prefBrandId = profile.brands.length > 0 ? profile.brands[0].id : null;
        const prefWhere = { is_deleted: false, stock: { gt: 0 } };

        const expandedIds = KC.expandCategoryIds(prefCatId);
        prefWhere.category_id = expandedIds.length === 1 ? expandedIds[0] : { in: expandedIds };
        if (prefBrandId) prefWhere.brand_id = prefBrandId;

        // Price range filter from profile
        if (profile.priceRange.p25 > 0 && profile.priceRange.p75 > 0) {
          prefWhere.price = {
            gte: profile.priceRange.p25 * 0.5,
            lte: profile.priceRange.p75 * 2,
          };
        }

        const prefProducts = await prisma.product.findMany({
          where: prefWhere,
          orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
          take: 4,
          select: REC_SELECT,
        });
        addUnique(prefProducts);
      }

      // ── 4. Trending Products ────────────────────────────────────────
      if (results.length < 8) {
        const trendingItems = await BS.getTrendingProducts(24, 4);
        if (trendingItems.length > 0) {
          const trendingProducts = await fetchProductsByIds(
            trendingItems.map(t => t.product_id)
          );
          addUnique(trendingProducts);
        }
      }
    } catch (err) {
      console.error('[Recommendation v4] Behavior strategy error, fallback to v3:', err.message);
      // Fall through to v3 strategy below
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AI REC CONTAINER — Collaborative Filtering (Item-CF via HTTP)
  // Gọi AI container nếu có customerId và chưa đủ 8 kết quả.
  // 12/11/2026: gửi kèm món đã mua (POST realtime), lỗi thì GET cũ — fetchAIRecForCustomer
  // ═══════════════════════════════════════════════════════════════════════
  if (results.length < 8 && customerId && AI_REC_URL) {
    try {
      const cfProductIds = await fetchAIRecForCustomer(customerId, 8 - results.length);
      if (cfProductIds.length > 0) {
        const cfProducts = await fetchProductsByIds(
          cfProductIds.filter(id => !isNaN(id)).map(id => Number(id))
        );
        addUnique(cfProducts);
      }
    } catch (err) {
      console.warn('[Recommendation] AI Rec CF fallback:', err.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // v3 FALLBACK STRATEGY — Rule-based (Category/Brand/Bestseller)
  // ═══════════════════════════════════════════════════════════════════════

  // ── Strategy: Category + Brand recommendations ────────────────────────
  if (results.length < 8 && (categoryId || brandId)) {
    const contextWhere = { is_deleted: false, stock: { gt: 0 } };

    if (categoryId) {
      const expandedIds = KC.expandCategoryIds(categoryId);
      contextWhere.category_id = expandedIds.length === 1 ? expandedIds[0] : { in: expandedIds };
    }
    if (brandId) {
      contextWhere.brand_id = brandId;
    }

    // Top 4 sản phẩm liên quan
    const contextProducts = await prisma.product.findMany({
      where: contextWhere,
      orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
      take: 4,
      select: REC_SELECT,
    });
    addUnique(contextProducts);

    // Nếu brand filter quá chặt → bỏ brand, thử lại
    if (results.length < 4 && brandId && categoryId) {
      delete contextWhere.brand_id;
      const moreCat = await prisma.product.findMany({
        where: contextWhere,
        orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
        take: 4,
        select: REC_SELECT,
      });
      addUnique(moreCat);
    }
  }

  // ── Top bán chạy toàn cửa hàng (fill remaining) ──────────────────────
  if (results.length < 8) {
    const topSellers = await prisma.product.findMany({
      where: { is_deleted: false },
      orderBy: { sold: 'desc' },
      take: 8,
      select: REC_SELECT,
    });
    addUnique(topSellers);
  }

  // ── Nếu vẫn < 8 → thêm sản phẩm mới nhất ───────────────────────────
  if (results.length < 8) {
    const newest = await prisma.product.findMany({
      where: { is_deleted: false },
      orderBy: { id: 'desc' },
      take: 4,
      select: REC_SELECT,
    });
    addUnique(newest);
  }

  return results.slice(0, 8);
}

// ═════════════════════════════════════════════════════════════════════════════
// NEW: getRelatedProducts() — Sản phẩm tương tự (specs-aware similarity)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Tìm sản phẩm tương tự dựa trên: category + brand + price range + specs overlap.
 * 
 * @param {BigInt|number} productId - ID sản phẩm gốc
 * @returns {Promise<Array>} - Tối đa 8 SP tương tự
 */
async function getRelatedProducts(productId) {
  await KC.ensureLoaded();
  const fsItems = await getActiveFlashSaleItems();

  const source = await prisma.product.findUnique({
    where: { id: BigInt(productId) },
    select: {
      id: true, name: true, price: true, original_price: true,
      image: true, rating: true, sold: true,
      category_id: true, brand_id: true, description: true,
    },
  });
  if (!source) return [];

  const priceMin = Number(source.price) * 0.5;
  const priceMax = Number(source.price) * 1.5;

  // Cùng category + price range
  const candidates = await prisma.product.findMany({
    where: {
      id: { not: source.id },
      category_id: source.category_id,
      is_deleted: false,
      stock: { gt: 0 },
      price: { gte: priceMin, lte: priceMax },
    },
    orderBy: [{ sold: 'desc' }, { rating: 'desc' }],
    take: 30,
    select: {
      id: true, name: true, price: true, original_price: true,
      image: true, rating: true, sold: true,
      category_id: true, brand_id: true, description: true,
    },
  });

  // Similarity scoring
  candidates.forEach(p => {
    let score = 0;
    // Cùng brand
    if (p.brand_id === source.brand_id) score += 10;
    // Price proximity (đã filter range, càng gần giá càng tốt)
    const priceDiff = Math.abs(Number(p.price) - Number(source.price)) / Number(source.price);
    score += Math.max(0, 8 - priceDiff * 20);
    // Specs similarity
    score += PSC.getSpecsSimilarity(source, p);
    // Popularity
    score += Math.min(Number(p.sold || 0) / 500, 3);
    score += Math.min(Number(p.rating || 0) * 0.5, 2.5);
    p._score = score;
  });

  candidates.sort((a, b) => b._score - a._score);

  const results = candidates.slice(0, 8).map(p => {
    const specs = PSC.getTopSpecs(p, 3);
    return applyFlashSaleToProduct({
      id: Number(p.id),
      name: p.name,
      price: Number(p.price),
      original_price: Number(p.original_price || p.price),
      image: p.image,
      rating: p.rating ? Number(p.rating) : null,
      sold: Number(p.sold || 0),
      category_id: p.category_id,
      brand_id: p.brand_id,
      specs: specs,
    }, fsItems);
  });

  return results;
}

module.exports = {
  getRecommendations,
  getRelatedProducts,
  getActiveFlashSaleItems,
  applyFlashSaleToProduct,
};
