/**
 * ============================================================
 * AI BOT SERVER — Getshopy AI Chatbot & Search Engine
 * ai-bot/src/ai-server.js
 * ============================================================
 *
 * Container riêng cho AI Chatbot + AI Searchbot.
 * Chạy trên port 3001 (Docker internal).
 *
 * Endpoints:
 *   POST /api/b2c/chat              — AI Chatbot
 *   POST /api/ai/smart-search       — Smart Search (text)
 *   POST /api/b2c/visual-search     — Visual Search (ảnh)
 *   POST /api/ai/smart-search-image — Search ảnh + text
 *   GET  /api/health                — Healthcheck
 */

'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('./db'); // Khởi tạo Prisma connect

// ─── GLOBAL ERROR HANDLERS ───────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('🔥 [AI Bot] UnhandledRejection:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('🔥 [AI Bot] UncaughtException:', err.message);
});

// ─── EXPRESS APP ─────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(morgan('dev'));
// Limit 50mb để hỗ trợ ảnh base64 cho visual search
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── HEALTHCHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ai-bot',
    features: ['chatbot', 'smart-search', 'visual-search'],
    timestamp: new Date(),
  });
});

// ─── AI ROUTES ───────────────────────────────────────────────────────────────
const searchRouter  = require('./routes/search');
const chatbotRouter = require('./routes/chatbot');

app.use('/api', searchRouter);
app.use('/api', chatbotRouter);

// ─── START ───────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🤖 AI Bot (Chatbot + Search) running on port ${PORT}`);
});
