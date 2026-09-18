'use strict';
/**
 * ============================================================
 * CHATBOT ROUTES — AI Chatbot Hội Thoại
 * routes/chatbot.js
 * ============================================================
 *
 * Thin controller — chỉ nhận request, gọi ChatbotService, trả response.
 *
 * Endpoints:
 *   POST /api/b2c/chat  — Chatbot hội thoại B2C
 */

const express = require('express');
const router = express.Router();
const ChatbotService = require('../services/ChatbotService');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/b2c/chat — AI Chatbot
// Pipeline: classifyIntent → buildContext (DB) → generateChatResponse (LLM)
// Timeout guard: nếu toàn bộ pipeline > 25s → trả fallback ngay
// ─────────────────────────────────────────────────────────────────────────────
router.post('/b2c/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    // Race: pipeline thực vs timeout 25s
    const TIMEOUT_MS = 25_000;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('CHAT_TIMEOUT')), TIMEOUT_MS)
    );

    let result;
    try {
      result = await Promise.race([
        ChatbotService.chat({ message, history, req }),
        timeoutPromise,
      ]);
    } catch (raceErr) {
      if (raceErr.message === 'CHAT_TIMEOUT') {
        console.warn('[Chat] LLM timeout (>25s) — trả fallback tĩnh ngay');
        return res.json({
          text: 'Dạ AI đang hơi chậm hôm nay ạ! Em đã nhận được câu hỏi, anh/chị vui lòng thử lại sau vài giây nhé. Nếu cần gấp, anh/chị có thể tìm kiếm trực tiếp trên trang Shop ạ!',
          link: '/shop',
          products: [],
        });
      }
      throw raceErr;
    }

    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    console.error('[Chat Error]', err.stack || err.message || err);
    res.status(500).json({
      error: 'Internal Server Error',
      text: 'Dạ em đang gặp sự cố kỹ thuật nhỏ. Anh/chị vui lòng thử lại sau ít phút nhé ạ!',
      link: null,
    });
  }
});

module.exports = router;
