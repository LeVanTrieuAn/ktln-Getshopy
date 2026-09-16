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

/** Danh sách danh mục sản phẩm THỰC TẾ của cửa hàng (8 cha + 41 con) */
const STORE_CATEGORIES = [
  // Cấp 1 (cha)
  'Điện thoại', 'Laptop', 'Tablet', 'Smartwatch',
  'Phụ kiện di động', 'Phụ kiện laptop, PC',
  'Thiết bị nghe nhìn, lưu trữ, thu âm', 'Camera',
  // Cấp 2 (con) — Phụ kiện di động
  'Sạc dự phòng', 'Sạc, cáp', 'Ốp lưng điện thoại', 'Ốp lưng máy tính bảng',
  'Miếng dán', 'Miếng dán Camera', 'Túi đựng AirPods', 'Quạt mini',
  'Bút tablet', 'Giá đỡ điện thoại/laptop', 'Dây đeo điện thoại', 'Ống kính điện thoại',
  // Cấp 2 (con) — Phụ kiện laptop, PC
  'Hub, cáp chuyển đổi', 'Chuột máy tính', 'Bàn phím', 'Router & Thiết bị mạng',
  'Balo, túi chống sốc', 'Túi đựng phụ kiện', 'Phủ phím laptop', 'Phần mềm',
  'Giá treo màn hình', 'Miếng lót chuột', 'Bảng vẽ điện tử',
  // Cấp 2 (con) — Thiết bị nghe nhìn
  'Tai nghe Bluetooth', 'Tai nghe dây', 'Tai nghe chụp tai', 'Tai nghe thể thao',
  'Loa', 'Micro', 'Máy chiếu', 'Kính thông minh',
  'Ổ cứng', 'Thẻ nhớ', 'USB',
  // Cấp 2 (con) — Camera
  'Camera Giám Sát', 'Camera trong nhà', 'Camera ngoài trời',
  'Camera Năng Lượng Mặt Trời', 'Camera 4G', 'Chuông cửa Camera', 'Webcam',
];

/** 67 thương hiệu thực tế */
const STORE_BRANDS = [
  'Apple', 'Samsung', 'OPPO', 'Xiaomi', 'vivo', 'realme', 'HONOR', 'Motorola', 'Huawei',
  'Acer', 'Asus', 'Dell', 'HP', 'Lenovo', 'MSI', 'Microsoft', 'Machenike', 'SingPC',
  'Amazfit', 'Sony', 'JBL', 'Marshall', 'Shokz', 'Havit', 'Boya', 'Hyundai Audio',
  'Anker', 'Baseus', 'Ugreen', 'Xmobile', 'Innostyle', 'Orico', 'Tomtoc', 'Tucano',
  'Razer', 'Corsair', 'Logitech', 'Akko', 'Dareu', 'Rapoo', 'HyperWork',
  'Dahua', 'EZVIZ', 'Imou', 'Tiandy', 'Insta360',
  'Kingston', 'SanDisk', 'Seagate', 'Kioxia', 'ADATA',
  'TP-Link', 'TOTOLINK',
  'Philips', 'Wacom', 'Wanbo', 'Ulanzi', 'JCPAL', 'Kidcare',
  'AVA+', 'Alpha Works', 'Eroc', 'Hydrus', 'Hyperspace', 'Thonet & Vander', 'Topo Designs',
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
// MAIN: Phân tích ảnh bằng Gemini Vision
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
 * Phân tích ảnh sản phẩm bằng Gemini Vision.
 *
 * @param {string} imageBase64 - Data URL "data:image/jpeg;base64,..."
 * @returns {Promise<{ caption: string|null, analysis: VisualAnalysis|null }>}
 */
async function analyzeProductImage(imageBase64) {
  if (!GOOGLE_AI_KEY) {
    console.warn('[VisualSearch] GOOGLE_AI_KEY chưa được cấu hình.');
    return { caption: null, analysis: null };
  }

  const prompt = `Bạn là AI phân tích sản phẩm cho cửa hàng điện tử Getshopy Việt Nam (600.000+ sản phẩm, 67 thương hiệu).
Nhìn vào ảnh và xác định thông tin sản phẩm điện tử.

DANH MỤC HỢP LỆ (chọn chính xác 1):
Cấp 1: ${STORE_CATEGORIES.slice(0, 8).join(' | ')}
Cấp 2: ${STORE_CATEGORIES.slice(8).join(', ')}

THƯƠNG HIỆU HỢP LỆ: ${STORE_BRANDS.join(', ')}

Trả về JSON:
- caption: mô tả ngắn tiếng Anh
- category: chọn danh mục cụ thể nhất (ưu tiên cấp 2) hoặc null
- brand: chọn từ danh sách trên hoặc null
- color: màu sắc chính hoặc null
- keywords: 3-5 từ khóa tiếng Việt/Anh để tìm trong DB sản phẩm
- description_vi: mô tả 1 câu tiếng Việt

Nếu không phải sản phẩm điện tử/công nghệ: category=null, keywords=[].
Chỉ trả về JSON.`;

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
