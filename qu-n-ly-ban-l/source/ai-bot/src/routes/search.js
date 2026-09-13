'use strict';
/**
 * ============================================================
 * SEARCH ROUTES — AI Smart Search & Visual Search
 * routes/search.js
 * ============================================================
 *
 * Thin controller — chỉ nhận request, gọi SearchService, trả response.
 *
 * Endpoints:
 *   POST /api/ai/smart-search        — Tìm kiếm text thông minh
 *   POST /api/b2c/visual-search      — Tìm kiếm bằng ảnh
 *   POST /api/ai/smart-search-image  — Tìm kiếm kết hợp ảnh + text
 */

const express = require('express');
const router = express.Router();
const SearchService = require('../services/SearchService');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/smart-search
// ─────────────────────────────────────────────────────────────────────────────
router.post('/ai/smart-search', async (req, res) => {
  try {
    const result = await SearchService.smartSearch(req.body.query);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    console.error('[SmartSearch Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/b2c/visual-search
// ─────────────────────────────────────────────────────────────────────────────
router.post('/b2c/visual-search', async (req, res) => {
  try {
    const result = await SearchService.visualSearch(req.body.imageBase64);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    console.error('[VisualSearch Error]', err.message);
    res.status(500).json({
      text: 'Da em dang gap su co khi phan tich anh. Anh/chi vui long thu lai sau it phut nhe a!',
      products: [],
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/smart-search-image
// ─────────────────────────────────────────────────────────────────────────────
router.post('/ai/smart-search-image', async (req, res) => {
  try {
    const { query, imageBase64 } = req.body;
    const result = await SearchService.smartSearchWithImage(query, imageBase64);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    console.error('[SmartSearchImage Error]', err.message);
    res.status(500).json({ error: err.message, products: [], hint: '' });
  }
});

module.exports = router;
