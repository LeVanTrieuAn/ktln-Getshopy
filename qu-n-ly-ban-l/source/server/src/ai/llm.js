/**
 * llm.js — HuggingFace Text-Generation Client (Qwen2.5-72B-Instruct)
 *
 * Nhận context từ DB (sản phẩm, chính sách) + câu hỏi user
 * → Gọi HuggingFace Inference API (Qwen2.5-72B) để sinh câu trả lời
 *   tự nhiên bằng tiếng Việt.
 *
 * Model: Qwen/Qwen2.5-72B-Instruct
 *   - Hỗ trợ 29 ngôn ngữ, đặc biệt xuất sắc tiếng Việt và tiếng Anh
 *   - Top multilingual benchmark (MMLU, C-Eval, ViMMRC...)
 *   - Endpoint tương thích OpenAI Chat Completions format
 *
 * Lưu ý: OpenRouter keys được giữ trong .env để có thể dễ dàng
 *        chuyển lại bằng cách thay đổi cấu hình.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION — HuggingFace Inference API (Chat Completions)
// ─────────────────────────────────────────────────────────────────────────────

const HF_API_KEY   = process.env.HF_API_KEY;
// Qwen2.5-7B-Instruct — hoạt động miễn phí qua featherless-ai provider
const HF_LLM_MODEL = process.env.HF_LLM_MODEL || 'Qwen/Qwen2.5-7B-Instruct';

/**
 * HuggingFace Inference Router — featherless-ai provider.
 * api-inference.huggingface.co đã bị deprecated (cuối 2025).
 * Endpoint mới: router.huggingface.co/<provider>/v1/chat/completions
 */
const HF_LLM_URL = 'https://router.huggingface.co/featherless-ai/v1/chat/completions';

const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

// ─────────────────────────────────────────────────────────────────────────────
// BUILD SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemPrompt(context = {}) {
  const { products = [], policy = null } = context;

  let productSection = '';
  if (products.length > 0) {
    const lines = products.map(p =>
      `- ${p.name}: ${fmt(p.price)}` +
      (p.stock !== undefined ? `, tồn ${p.stock}` : '') +
      (p.rating ? `, ⭐${Number(p.rating).toFixed(1)}` : '') +
      (p.sold ? `, bán ${p.sold}` : '') +
      (p.description ? `, ${String(p.description).slice(0, 60)}` : '')
    ).join('\n');
    productSection = `\nSẢN PHẨM LIÊN QUAN:\n${lines}\n`;
  }

  const policySection = policy ? `\nTHÔNG TIN:\n${policy}\n` : '';

  return `Bạn là trợ lý AI mua sắm của Getshopy — cửa hàng điện tử tại TP.HCM.
VAI TRÒ: Tư vấn mua sắm thông minh, thân thiện.
NGÔN NGỮ: Tiếng Việt. Xưng "em", gọi khách "anh/chị".
PHONG CÁCH: Nhiệt tình, ngắn gọn (3–4 câu), dùng emoji vừa phải.
${productSection}${policySection}
CHÍNH SÁCH:
- Giao hàng: Nội thành 2–4h, tỉnh thành 1–3 ngày. Miễn ship từ 500k.
- Bảo hành: 12 tháng chính hãng, đổi trả 7 ngày.
- Thanh toán: COD, MoMo, ZaloPay, VNPAY, trả góp 0%.

QUY TẮC: Chỉ gợi ý sản phẩm có trong danh sách trên. Cuối câu hỏi thêm để duy trì hội thoại.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLEEP HELPER — dùng cho retry khi model cold start
// ─────────────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE RESPONSE — gọi HuggingFace Inference API (Qwen2.5-72B)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sinh câu trả lời bằng model Qwen2.5-72B-Instruct qua HuggingFace Inference API.
 *
 * @param {{ intent: string, context: object, message: string, history: Array }} params
 * @returns {Promise<string|null>} - Nội dung câu trả lời hoặc null nếu thất bại
 */
async function generateChatResponse({ intent, context, message, history = [] }) {
  if (!HF_API_KEY) {
    console.warn('[LLM] HF_API_KEY chưa được cấu hình.');
    return null;
  }

  const systemPrompt = buildSystemPrompt({ ...context, intent });

  const historyMessages = history
    .slice(-6)
    .map(h => ({
      role: h.sender === 'user' ? 'user' : 'assistant',
      content: String(h.text || ''),
    }))
    .filter(m => m.content);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user',   content: message },
  ];

  // Retry tối đa 2 lần — xử lý model cold start (503)
  const MAX_RETRIES = 2;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[LLM] Calling HF ${HF_LLM_MODEL} (attempt ${attempt}/${MAX_RETRIES})...`);

      const response = await fetch(HF_LLM_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model:       HF_LLM_MODEL,
          messages,
          temperature: 0.7,
          max_tokens:  400,
          top_p:       0.9,
          stream:      false,
        }),
        signal: AbortSignal.timeout(60_000), // 60s — đủ cho cold start
      });

      // Model đang warm-up (503) — chờ và retry
      if (response.status === 503) {
        const errData = await response.json().catch(() => ({}));
        const waitMs  = Math.min((errData.estimated_time || 20) * 1000, 40_000);
        console.log(`[LLM] Model đang load, chờ ${Math.round(waitMs / 1000)}s...`);
        if (attempt < MAX_RETRIES) {
          await sleep(waitMs);
          continue;
        }
        return null;
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`[LLM] HF Error ${response.status}:`, errText.slice(0, 200));
        return null;
      }

      const data    = await response.json();
      const content = data?.choices?.[0]?.message?.content?.trim();

      if (!content) {
        console.warn('[LLM] HF trả về nội dung rỗng.');
        return null;
      }

      console.log(`[LLM] ✅ HF Qwen generated ${content.length} chars, intent=${intent}`);
      return content;

    } catch (err) {
      const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
      console.error(`[LLM] Attempt ${attempt} thất bại (${isTimeout ? 'timeout' : err.message})`);
      if (attempt < MAX_RETRIES) await sleep(4000 * attempt);
    }
  }

  console.warn('[LLM] Tất cả retry thất bại — dùng fallback handler.');
  return null;
}

module.exports = { generateChatResponse };
