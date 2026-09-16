'use strict';
/**
 * ============================================================
 * RECOMMENDATION ROUTES — AI Product Recommendations
 * routes/recommendation.js
 * ============================================================
 *
 * Thin controller — chỉ nhận request, gọi RecommendationService, trả response.
 *
 * Endpoints:
 *   GET /api/b2c/recommendations          — Gợi ý sản phẩm cho khách hàng
 *   GET /api/b2c/similar/:productId       — Sản phẩm tương tự (specs-aware)
 */

const express = require('express');
const router = express.Router();
const RecommendationService = require('../services/RecommendationService');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/b2c/recommendations
// ─────────────────────────────────────────────────────────────────────────────
router.get('/b2c/recommendations', async (req, res) => {
  try {
    const { email, categoryId, brandId, sessionId, customerId } = req.query;
    const result = await RecommendationService.getRecommendations(
      email || null,
      {
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        sessionId: sessionId || undefined,
        customerId: customerId ? Number(customerId) : undefined,
      }
    );
    res.json(result);
  } catch (err) {
    console.error('[Recommendation Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/b2c/similar/:productId — Sản phẩm tương tự (specs similarity)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/b2c/similar/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId || isNaN(productId)) {
      return res.status(400).json({ error: 'productId phải là số hợp lệ' });
    }
    const result = await RecommendationService.getRelatedProducts(productId);
    res.json(result);
  } catch (err) {
    console.error('[Similar Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

