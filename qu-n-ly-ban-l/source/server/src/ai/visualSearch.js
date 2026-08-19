/**
 * ============================================================
 * VISUAL SEARCH — Google Gemini 2.5 Flash Vision
 * visualSearch.js — Getshopy AI Visual Search Engine v5.0
 * ============================================================
 *
 * Pipeline:
 *   Google Gemini 2.5 Flash (gemini.googleapis.com — trực tiếp, không qua OpenRouter)
 *   Nhận ảnh base64 → phân tích → JSON { category, brand, color, keywords, description_vi }
 *
 * Lý do:
 *   - HuggingFace free tier không còn hỗ trợ vision model ổn định
 *   - Gemini free tier: 15 req/phút, 1500 req/ngày — đủ cho demo
 *
 * @module visualSearch
 * @version 5.0.0
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const GOOGLE_AI_KEY   = process.env.GOOGLE_AI_KEY;
const GEMINI_MODEL    = 'gemini-3.6-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/** Danh sách danh mục sản phẩm của cửa hàng */
const STORE_CATEGORIES = [
  'Điện thoại thông minh',
  'Máy tính xách tay',
  'Máy tính bảng',
  'Phụ kiện công nghệ',
  'Tivi & Thiết bị giải trí',
  'Máy ảnh & Quay phim',
  'Đồng hồ thông minh',
  'Gaming',
  'Thiết bị âm thanh',
  'Thiết bị văn phòng',
  'Linh kiện máy tính',
  'Nhà thông minh',
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chuyển data URL sang { mimeType, base64Data } cho Gemini API.
 * @param {string} dataUrl - "data:image/jpeg;base64,/9j/..."
 */
function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return { mimeType: 'image/jpeg', base64Data: dataUrl };
  return { mimeType: match[1], base64Data: match[2] };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: Phân tích ảnh bằng Gemini 2.5 Flash Vision
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} VisualAnalysis
 * @property {string|null} category     - Danh mục sản phẩm
 * @property {string|null} brand        - Thương hiệu
 * @property {string|null} color        - Màu sắc chính
 * @property {string[]}    keywords     - Từ khóa tìm kiếm
 * @property {string}      description_vi - Mô tả tiếng Việt
 */

/**
 * Phân tích ảnh sản phẩm bằng Gemini 2.5 Flash.
 *
 * @param {string} imageBase64 - Data URL "data:image/jpeg;base64,..."
 * @returns {Promise<{ caption: string|null, analysis: VisualAnalysis|null }>}
 */
async function analyzeProductImage(imageBase64) {
  if (!GOOGLE_AI_KEY) {
    console.warn('[VisualSearch] GOOGLE_AI_KEY chưa được cấu hình.');
    return { caption: null, analysis: null };
  }

  const prompt = `Bạn là AI phân tích sản phẩm điện tử cho cửa hàng Getshopy Việt Nam.
Nhìn vào ảnh và xác định thông tin sản phẩm điện tử.

Danh mục hợp lệ:
${STORE_CATEGORIES.map(c => `- ${c}`).join('\n')}

Xác định:
- caption: mô tả ngắn bằng tiếng Anh
- category: chọn từ danh mục trên hoặc null
- brand: Apple/Samsung/Sony/... hoặc null
- color: màu sắc chính hoặc null
- keywords: 3-5 từ khóa tiếng Anh/Việt để tìm trong DB
- description_vi: mô tả 1 câu tiếng Việt thân thiện

Nếu không phải sản phẩm điện tử: category=null, keywords=[].`;

  const { mimeType, base64Data } = parseDataUrl(imageBase64);

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64Data } },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  };

  const MAX_RETRIES = 2;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[VisualSearch] Gọi Gemini Vision (attempt ${attempt}/${MAX_RETRIES})...`);

      const response = await fetch(
        `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GOOGLE_AI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(30_000),
        }
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`[VisualSearch] Gemini HTTP ${response.status}:`, errText.slice(0, 200));
        if (attempt < MAX_RETRIES) { await sleep(2000); continue; }
        return { caption: null, analysis: null };
      }

      const data = await response.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!content) {
        console.warn('[VisualSearch] Gemini trả về nội dung rỗng.');
        if (attempt < MAX_RETRIES) { await sleep(2000); continue; }
        return { caption: null, analysis: null };
      }

      // Parse JSON — xử lý markdown fence và JSON bị cắt
      let rawJson = content;
      // Bóc markdown fence nếu có
      const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) rawJson = fenceMatch[1].trim();
      // Tìm block JSON đầu tiên
      const jsonStart = rawJson.indexOf('{');
      if (jsonStart === -1) {
        console.warn('[VisualSearch] Không tìm thấy JSON:', rawJson.slice(0, 100));
        if (attempt < MAX_RETRIES) { await sleep(1000); continue; }
        return { caption: null, analysis: null };
      }
      // Nếu JSON bị cắt — thêm đóng ngoặc để parse được
      let jsonStr = rawJson.slice(jsonStart);
      if (!jsonStr.trimEnd().endsWith('}')) {
        // Đóng các string mở và object
        jsonStr = jsonStr.replace(/,?\s*$/, '') + '}';
      }

      let result;
      try {
        result = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.warn('[VisualSearch] JSON parse lỗi, thử lại:', parseErr.message.slice(0, 60));
        if (attempt < MAX_RETRIES) { await sleep(1000); continue; }
        return { caption: null, analysis: null };
      }
      if (!Array.isArray(result.keywords)) result.keywords = [];

      const caption = result.caption || null;
      const analysis = {
        category:       result.category       || null,
        brand:          result.brand          || null,
        color:          result.color          || null,
        keywords:       result.keywords,
        description_vi: result.description_vi || (caption ? `Sản phẩm: ${caption}` : 'Sản phẩm từ ảnh'),
      };

      console.log('[VisualSearch] ✅ Gemini phân tích xong:', JSON.stringify({ caption, ...analysis }));
      return { caption, analysis };

    } catch (err) {
      const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
      console.error(`[VisualSearch] Attempt ${attempt} lỗi (${isTimeout ? 'timeout 30s' : err.message})`);
      if (attempt < MAX_RETRIES) await sleep(3000);
    }
  }

  return { caption: null, analysis: null };
}

module.exports = { analyzeProductImage };
