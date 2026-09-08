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
 *   GET /api/b2c/recommendations  — Gợi ý sản phẩm cho khách hàng
 */

const express = require('express');
const router = express.Router();
const RecommendationService = require('../services/RecommendationService');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/b2c/recommendations
// ─────────────────────────────────────────────────────────────────────────────
router.get('/b2c/recommendations', async (req, res) => {
  try {
    const { email, categoryId, brandId } = req.query;
    const result = await RecommendationService.getRecommendations(
      email || null,
      { categoryId: categoryId || undefined, brandId: brandId || undefined }
    );
    res.json(result);
  } catch (err) {
    console.error('[Recommendation Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
