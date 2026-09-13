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
// ─────────────────────────────────────────────────────────────────────────────
router.post('/b2c/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const result = await ChatbotService.chat({ message, history, req });
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
