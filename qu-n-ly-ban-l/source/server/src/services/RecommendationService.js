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
 * @param {string|null} email - Email khách hàng
 * @param {Object} opts
 * @param {string} [opts.categoryId] - Category ID
 * @param {string} [opts.brandId] - Brand ID
 * @param {string} [opts.sessionId] - Session ID (browser fingerprint)
 * @param {number} [opts.customerId] - B2CCustomer ID
 * @returns {Promise<Array>}
 */
async function getRecommendations(email = null, { categoryId, brandId, sessionId, customerId } = {}) {
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

  // Helper: fetch products by IDs
  const fetchProductsByIds = async (ids) => {
    if (!ids || ids.length === 0) return [];
    return prisma.product.findMany({
      where: { id: { in: ids.map(BigInt) }, is_deleted: false, stock: { gt: 0 } },
      select: REC_SELECT,
    });
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
  // Gọi AI container nếu có customerId và chưa đủ 8 kết quả
  // ═══════════════════════════════════════════════════════════════════════
  if (results.length < 8 && customerId && AI_REC_URL) {
    try {
      const cfProductIds = await fetchAIRecRecommendations(String(customerId), 8 - results.length);
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
