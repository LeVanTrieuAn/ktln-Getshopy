'use strict';
/**
 * ============================================================
 * RECOMMENDATION SERVICE — Getshopy AI Product Recommendations v3.0
 * services/RecommendationService.js
 * ============================================================
 *
 * ĐẠI NÂNG CẤP v3:
 *   - Category-based recommendations (top sản phẩm cùng category)
 *   - Brand-based recommendations (top sản phẩm cùng brand)
 *   - Specs-based similarity scoring (ProductSpecsCache)
 *   - Mixed strategy: 4 cùng context + 4 bán chạy toàn cửa hàng
 *   - Flash sale price overlay
 *   - Optimized payload: bỏ description, variants, branch_ids
 *   - KnowledgeCache integration
 *
 * @module RecommendationService
 */

const { prisma } = require('../db');
const KC  = require('./KnowledgeCache');
const PSC = require('./ProductSpecsCache');

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
// MAIN: getRecommendations()
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Lấy danh sách sản phẩm gợi ý cho khách hàng.
 *
 * Strategies:
 *   1. categoryId specified → 4 top cùng category + 4 top toàn cửa hàng
 *   2. brandId specified → 4 top cùng brand + 4 top toàn cửa hàng
 *   3. Both specified → 4 category+brand + 4 top toàn cửa hàng
 *   4. None → 4 bán chạy + 4 mới nhất
 *
 * @param {string|null} email - Email khách hàng (cho personalization tương lai)
 * @param {Object} opts
 * @param {string} [opts.categoryId] - Category ID để gợi ý liên quan
 * @param {string} [opts.brandId] - Brand ID để gợi ý liên quan
 * @returns {Promise<Array>}
 */
async function getRecommendations(email = null, { categoryId, brandId } = {}) {
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

  // ── Strategy: Category + Brand recommendations ────────────────────────
  if (categoryId || brandId) {
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
