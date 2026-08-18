/**
 * llm.js — Hugging Face Text-Generation Client
 *
 * Nhận context từ DB (sản phẩm, chính sách) + câu hỏi user
 * → Gọi HF Inference API để sinh câu trả lời tự nhiên bằng tiếng Việt.
 *
 * Hỗ trợ:
 *  - Retry khi model đang loading (503 + estimated_time)
 *  - Timeout dài (3 phút) để chờ model cold start
 *  - Fallback graceful khi API không khả dụng
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL   = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
const OPENROUTER_URL     = process.env.OPENROUTER_URL ? `${process.env.OPENROUTER_URL}/chat/completions` : 'https://openrouter.ai/api/v1/chat/completions';

const HF_API_KEY   = process.env.HF_API_KEY;
const HF_LLM_MODEL = process.env.HF_LLM_MODEL || 'mistralai/Mistral-7B-Instruct-v0.3';
const HF_LLM_URL   = `https://api-inference.huggingface.co/models/${HF_LLM_MODEL}/v1/chat/completions`;

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
// SLEEP HELPER
// ─────────────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE RESPONSE — gọi HF API với retry khi model loading
// ─────────────────────────────────────────────────────────────────────────────
async function generateChatResponse({ intent, context, message, history = [] }) {
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

  // ==========================================
  // 1. OPENROUTER API (Ưu tiên)
  // ==========================================
  if (OPENROUTER_API_KEY) {
    try {
      console.log(`[LLM] Calling OpenRouter → ${OPENROUTER_MODEL}`);
      const body = JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 400,
      });

      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://getshopy.com',
          'X-Title': 'Getshopy AI',
          'Content-Type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(60_000), // 60s
      });

      if (response.ok) {
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (content) {
          console.log(`[LLM] ✅ OpenRouter Generated ${content.length} chars, intent=${intent}`);
          return content;
        }
      } else {
        const errText = await response.text().catch(() => '');
        console.error(`[LLM] OpenRouter Error ${response.status}:`, errText.slice(0, 200));
      }
    } catch (err) {
      console.error(`[LLM] OpenRouter call failed: ${err.message}`);
    }
    console.warn('[LLM] OpenRouter failed — fallback to Hugging Face.');
  }

  // ==========================================
  // 2. HUGGING FACE INFERENCE API (Fallback)
  // ==========================================
  if (!HF_API_KEY) {
    console.warn('[LLM] HF_API_KEY chưa được cấu hình.');
    return null;
  }

  const body = JSON.stringify({
    model: HF_LLM_MODEL,
    messages,
    max_tokens:  400,
    temperature: 0.7,
    top_p:       0.9,
    stream:      false,
  });

  // Retry tối đa 3 lần — xử lý model loading (503)
  const MAX_RETRIES  = 3;
  const TIMEOUT_MS   = 180_000; // 3 phút — đủ cho cold start model

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[LLM] Attempt ${attempt}/${MAX_RETRIES} → ${HF_LLM_MODEL}`);

      const response = await fetch(HF_LLM_URL, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      // Model đang load — HF trả 503 kèm estimated_time
      if (response.status === 503) {
        const errData = await response.json().catch(() => ({}));
        const waitMs = Math.min((errData.estimated_time || 20) * 1000, 60_000);
        console.log(`[LLM] Model loading, chờ ${Math.round(waitMs/1000)}s...`);
        await sleep(waitMs);
        continue; // retry
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`[LLM] HTTP ${response.status}:`, errText.slice(0, 200));
        return null;
      }

      const data    = await response.json();
      const content = data?.choices?.[0]?.message?.content?.trim();

      if (!content) {
        console.warn('[LLM] Empty response');
        return null;
      }

      console.log(`[LLM] ✅ Generated ${content.length} chars, intent=${intent}`);
      return content;

    } catch (err) {
      const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
      console.error(`[LLM] Attempt ${attempt} failed (${isTimeout ? 'timeout' : err.message})`);
      if (attempt < MAX_RETRIES) {
        await sleep(3000 * attempt); // backoff: 3s, 6s
      }
    }
  }

  console.warn('[LLM] Tất cả retry đều thất bại — dùng fallback.');
  return null;
}

module.exports = { generateChatResponse };
