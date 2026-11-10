'use strict';
/**
 * ============================================================
 * SPEECH ROUTES — Nhập liệu bằng giọng nói
 * routes/speech.js
 * ============================================================
 *
 * Thin controller — kiểm tra đầu vào, gọi speechToText, trả { text }.
 *
 * Endpoint:
 *   POST /api/ai/transcribe  { audioBase64, mimeType }  ->  { text }
 *
 * Không lưu âm thanh. Không ghi nội dung âm thanh vào log.
 */

const express = require('express');
const router = express.Router();
const { transcribeAudio, normalizeMime } = require('../ai/speechToText');

/**
 * Giới hạn kích thước base64.
 * `server` đang dùng express.json() mặc định (100 KB cho cả body), nên giữ
 * thấp hơn mức đó: client ghi tối đa 15 giây ở 24 kbps (~45 KB, base64 ~60 KB).
 */
const MAX_AUDIO_B64_CHARS = Number(process.env.STT_MAX_B64_CHARS || 90_000);
/** Dưới ngưỡng này gần như chắc chắn không có lời nói (vài trăm byte đầu container). */
const MIN_AUDIO_B64_CHARS = 400;

/**
 * Giới hạn tần suất DÙNG CHUNG cho mọi người dùng (cửa sổ trượt 60 giây).
 *
 * Vì sao dùng chung chứ không theo IP: request đi qua `server` rồi mới tới
 * ai-bot, mà forwardToAiBot không chuyển IP gốc, nên req.ip ở đây luôn là IP
 * của container server. Mục đích chính là bảo vệ hạn mức Gemini.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = Number(process.env.STT_RATE_MAX || 20);
const hits = [];

function rateLimited() {
  const now = Date.now();
  while (hits.length && now - hits[0] > RATE_WINDOW_MS) hits.shift();
  if (hits.length >= RATE_MAX) return true;
  hits.push(now);
  return false;
}

router.post('/ai/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body || {};

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Thiếu dữ liệu âm thanh.' });
    }
    // Chấp nhận cả dạng data URL, tách phần base64.
    const b64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;

    if (!/^[A-Za-z0-9+/=]+$/.test(b64)) {
      return res.status(400).json({ error: 'Dữ liệu âm thanh không hợp lệ.' });
    }
    if (b64.length < MIN_AUDIO_B64_CHARS) {
      return res.json({ text: '', reason: 'too_short' });
    }
    if (b64.length > MAX_AUDIO_B64_CHARS) {
      return res.status(413).json({ error: 'Đoạn ghi âm quá dài, vui lòng nói ngắn hơn (tối đa 15 giây).' });
    }

    const mime = normalizeMime(mimeType);
    if (!mime) {
      return res.status(415).json({ error: 'Định dạng âm thanh chưa được hỗ trợ.' });
    }

    if (rateLimited()) {
      res.set('Retry-After', '30');
      return res.status(429).json({ error: 'Có quá nhiều yêu cầu giọng nói, vui lòng thử lại sau ít giây.' });
    }

    const { text, model, ms } = await transcribeAudio(b64, mime);
    res.json({ text, model, ms });
  } catch (err) {
    if (err && err.status) return res.status(err.status).json({ error: err.error });
    console.error('[Transcribe Error]', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Lỗi xử lý giọng nói.' });
  }
});

module.exports = router;
