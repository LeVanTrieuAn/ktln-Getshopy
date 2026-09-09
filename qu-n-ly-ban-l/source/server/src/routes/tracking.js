'use strict';
/**
 * ============================================================
 * TRACKING ROUTES — User Behavior Tracking API
 * routes/tracking.js
 * ============================================================
 *
 * Endpoints:
 *   POST /api/b2c/track              — Batch track user events
 *   GET  /api/b2c/recently-viewed    — Sản phẩm đã xem gần đây
 *   GET  /api/b2c/trending           — Sản phẩm trending
 *   POST /api/b2c/wishlist           — Thêm/xóa wishlist
 *   GET  /api/b2c/wishlist           — Lấy danh sách wishlist
 *   GET  /api/b2c/behavior/stats     — Stats (admin debug)
 *
 * @module routes/tracking
 */

const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const BehaviorService = require('../services/BehaviorService');
const PSC = require('../services/ProductSpecsCache');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/b2c/track — Batch track user events
// ─────────────────────────────────────────────────────────────────────────────
router.post('/track', async (req, res) => {
  try {
    const { events } = req.body;
    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const result = BehaviorService.trackEvents(events);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Tracking Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/b2c/recently-viewed — Sản phẩm đã xem gần đây (enriched)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/recently-viewed', async (req, res) => {
  try {
    const { session_id, customer_id, limit = 10 } = req.query;
    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const productIds = await BehaviorService.getRecentlyViewed(
      session_id,
      customer_id ? Number(customer_id) : null,
      Math.min(Number(limit), 20)
    );

    if (productIds.length === 0) return res.json([]);

    // Enrich with product data
    const products = await prisma.product.findMany({
      where: { id: { in: productIds.map(BigInt) }, is_deleted: false },
      select: {
        id: true, name: true, price: true, original_price: true,
        image: true, rating: true, sold: true,
        category_id: true, brand_id: true, description: true,
      },
    });

    // Preserve order from ClickHouse (most recent first)
    const productMap = new Map(products.map(p => [Number(p.id), p]));
    const ordered = productIds
      .map(pid => productMap.get(pid))
      .filter(Boolean)
      .map(p => ({
        id: Number(p.id),
        name: p.name,
        price: Number(p.price),
        original_price: Number(p.original_price || p.price),
        image: p.image,
        rating: p.rating ? Number(p.rating) : null,
        sold: Number(p.sold || 0),
        category_id: p.category_id,
        brand_id: p.brand_id,
        specs: PSC.getTopSpecs(p, 3),
      }));

    res.json(ordered);
  } catch (err) {
    console.error('[RecentlyViewed Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/b2c/trending — Sản phẩm trending (velocity-based)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/trending', async (req, res) => {
  try {
    const { hours = 24, limit = 10 } = req.query;

    const trending = await BehaviorService.getTrendingProducts(
      Math.min(Number(hours), 168), // max 1 week
      Math.min(Number(limit), 20)
    );

    if (trending.length === 0) return res.json([]);

    // Enrich with product data
    const productIds = trending.map(t => BigInt(t.product_id));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, is_deleted: false },
      select: {
        id: true, name: true, price: true, original_price: true,
        image: true, rating: true, sold: true,
        category_id: true, brand_id: true, description: true,
      },
    });

    const productMap = new Map(products.map(p => [Number(p.id), p]));

    const enriched = trending
      .map(t => {
        const p = productMap.get(t.product_id);
        if (!p) return null;
        return {
          id: Number(p.id),
          name: p.name,
          price: Number(p.price),
          original_price: Number(p.original_price || p.price),
          image: p.image,
          rating: p.rating ? Number(p.rating) : null,
          sold: Number(p.sold || 0),
          category_id: p.category_id,
          brand_id: p.brand_id,
          specs: PSC.getTopSpecs(p, 3),
          trend_score: t.score,
          views: t.views,
          unique_viewers: t.unique_viewers,
        };
      })
      .filter(Boolean);

    res.json(enriched);
  } catch (err) {
    console.error('[Trending Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/b2c/wishlist — Thêm/xóa sản phẩm khỏi wishlist (toggle)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/wishlist', async (req, res) => {
  try {
    const { customer_id, product_id } = req.body;
    if (!customer_id || !product_id) {
      return res.status(400).json({ error: 'customer_id and product_id are required' });
    }

    const cid = BigInt(customer_id);
    const pid = BigInt(product_id);

    // Toggle: nếu đã tồn tại → xóa, chưa → thêm
    const existing = await prisma.wishlist.findUnique({
      where: { customer_id_product_id: { customer_id: cid, product_id: pid } },
    });

    if (existing) {
      await prisma.wishlist.delete({ where: { id: existing.id } });
      res.json({ success: true, action: 'removed', product_id: Number(pid) });
    } else {
      await prisma.wishlist.create({
        data: { customer_id: cid, product_id: pid },
      });
      res.json({ success: true, action: 'added', product_id: Number(pid) });
    }
  } catch (err) {
    console.error('[Wishlist Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/b2c/wishlist — Lấy danh sách wishlist của user
// ─────────────────────────────────────────────────────────────────────────────
router.get('/wishlist', async (req, res) => {
  try {
    const { customer_id } = req.query;
    if (!customer_id) {
      return res.status(400).json({ error: 'customer_id is required' });
    }

    const wishlistItems = await prisma.wishlist.findMany({
      where: { customer_id: BigInt(customer_id) },
      orderBy: { created_at: 'desc' },
    });

    if (wishlistItems.length === 0) return res.json([]);

    const productIds = wishlistItems.map(w => w.product_id);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, is_deleted: false },
      select: {
        id: true, name: true, price: true, original_price: true,
        image: true, rating: true, sold: true, stock: true,
        category_id: true, brand_id: true, description: true,
      },
    });

    const productMap = new Map(products.map(p => [Number(p.id), p]));

    const enriched = wishlistItems
      .map(w => {
        const p = productMap.get(Number(w.product_id));
        if (!p) return null;
        return {
          id: Number(p.id),
          name: p.name,
          price: Number(p.price),
          original_price: Number(p.original_price || p.price),
          image: p.image,
          rating: p.rating ? Number(p.rating) : null,
          sold: Number(p.sold || 0),
          stock: Number(p.stock || 0),
          category_id: p.category_id,
          brand_id: p.brand_id,
          specs: PSC.getTopSpecs(p, 3),
          wishlisted_at: w.created_at,
        };
      })
      .filter(Boolean);

    res.json(enriched);
  } catch (err) {
    console.error('[Wishlist GET Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/b2c/behavior/stats — Debug: Thống kê behavior events
// ─────────────────────────────────────────────────────────────────────────────
router.get('/behavior/stats', async (req, res) => {
  try {
    const stats = await BehaviorService.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
