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
const { optionalAuthB2C } = require('../middleware/authB2C');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/b2c/recommendations
//
// DANH TÍNH LẤY TỪ TOKEN, KHÔNG TỪ QUERY STRING.
//
// Bản trước đọc `customerId` từ `req.query`, trong khi client chỉ gửi `email`
// (services/api.js) và `getRecommendations()` KHÔNG hề dùng tới email. Hệ quả:
// `customerId` luôn undefined, nên nhánh gọi container AI-Rec
// (`if (results.length < 8 && customerId && AI_REC_URL)`) KHÔNG BAO GIỜ chạy.
// Trang chủ rơi thẳng xuống fallback rule-based mà không có lỗi nào báo ra —
// API vẫn trả 200 kèm đủ 8 sản phẩm, nhìn từ ngoài y hệt như gợi ý AI đang chạy.
//
// Dùng optionalAuthB2C chứ không authB2C: đây là endpoint công khai, khách vãng
// lai phải xem được gợi ý. Bắt buộc đăng nhập thì khách chưa có token nhận 401,
// mà `request()` phía client xử lý 401 bằng localStorage.clear() +
// redirect '/' — tức là trang chủ tự tải lại vô hạn.
//
// Có token hợp lệ -> req.b2cUser.id -> đi đường Collaborative Filtering.
// Không có -> khách vãng lai, đi đường rule-based như cũ.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/b2c/recommendations', optionalAuthB2C, async (req, res) => {
  try {
    const { categoryId, brandId, sessionId } = req.query;
    const result = await RecommendationService.getRecommendations(
      null,
      {
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        sessionId: sessionId || undefined,
        // Chỉ tin token. Nhận id do client khai thì ai cũng xem được gợi ý
        // của người khác chỉ bằng cách đổi một tham số trên URL.
        customerId: req.b2cUser ? req.b2cUser.id : undefined,
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
