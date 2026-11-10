'use strict';
/**
 * ============================================================
 * LLM CLIENT — Sinh văn bản với chuỗi nhà cung cấp
 * ai/llmClient.js
 * ============================================================
 *
 * Thứ tự (quyết định của chủ dự án, 19/10/2026):
 *     1) HuggingFace (featherless-ai)   — HF_API_KEY, HF_LLM_MODELS
 *     2) Google Gemini                  — GOOGLE_AI_KEY, GEMINI_CHAT_MODELS
 *     3) OpenRouter                     — OPENROUTER_API_KEY, OPENROUTER_URL, OPENROUTER_MODEL
 *     4) null  -> nơi gọi tự dùng rule-based / câu trả lời dựng sẵn
 *
 * Ngắt tạm (circuit breaker) theo nhà cung cấp: khi gặp lỗi mà thử lại vô ích
 * (hết credit 402, khóa sai 401/403, hết hạn mức 429) thì bỏ qua nhà cung cấp đó
 * một lúc, thay vì mất thêm ~1 giây ở MỌI request để nhận lại đúng lỗi cũ.
 * Mỗi lần chuyển trạng thái đều ghi log mức ALERT để người vận hành đổi khóa.
 *
 * Gemini 3: mặc định mô hình "suy nghĩ" và tiêu hết ngân sách token, khiến câu
 * trả lời bị cắt cụt (đã gặp: "Dạ anh/chị, dưới 4"). Vì vậy đặt
 * thinkingLevel='minimal'. Nguồn: https://ai.google.dev/gemini-api/docs/thinking
 * Khóa Gemini gửi qua header x-goog-api-key, không đưa vào URL.
 *
 * @module llmClient
 */

const HF_LLM_URL = 'https://router.huggingface.co/featherless-ai/v1/chat/completions';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const list = (v, def) => (v || def).split(',').map(s => s.trim()).filter(Boolean);
const HF_MODELS = () => list(process.env.HF_LLM_MODELS, 'meta-llama/Llama-3.1-8B-Instruct');
const GEMINI_CHAT_MODELS = () => list(process.env.GEMINI_CHAT_MODELS, 'gemini-3.5-flash,gemini-3-flash-preview');
const OPENROUTER_MODELS = () => list(process.env.OPENROUTER_MODEL, 'google/gemini-2.5-flash');
const OPENROUTER_BASE = () => (process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');

const MIN = 60_000;
const state = {
  hf:     { until: 0, reason: null, since: null },
  gemini: { until: 0, reason: null, since: null },
  openrouter: { until: 0, reason: null, since: null },
};
const isUp = (p) => Date.now() >= state[p].until;

function markDown(provider, reason, ms, advice) {
  const s = state[provider];
  const wasUp = isUp(provider);
  s.until = Date.now() + ms; s.reason = reason; s.since = new Date().toISOString();
  if (wasUp) console.error(`[LLM][ALERT] ${provider.toUpperCase()} tạm ngưng ${Math.round(ms / MIN)} phút — ${reason}. ${advice || ''}`);
}
function markUp(provider) {
  const s = state[provider];
  if (!isUp(provider) || s.reason) console.log(`[LLM] ${provider.toUpperCase()} hoạt động trở lại.`);
  s.until = 0; s.reason = null; s.since = null;
}

/** Trạng thái hiển thị ở /api/health — để biết khóa nào đang chết. */
function getProviderStatus() {
  const view = (p, configured) => ({
    configured,
    status: !configured ? 'not_configured' : isUp(p) ? 'ok' : state[p].reason,
    ...(isUp(p) ? {} : { retry_at: new Date(state[p].until).toISOString() }),
  });
  return {
    huggingface: view('hf', !!process.env.HF_API_KEY),
    gemini: view('gemini', !!process.env.GOOGLE_AI_KEY),
    openrouter: view('openrouter', !!process.env.OPENROUTER_API_KEY),
  };
}

/** Phát hiện tiếng Trung (một số LLM mặc định trả lời tiếng Trung). */
const containsChinese = (t) => /[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}]/u.test(t);

// ─────────────────────────────────────────────────────────────────────────────
// HuggingFace
// ─────────────────────────────────────────────────────────────────────────────
async function callHuggingFace({ system, messages, maxTokens, temperature, topP, timeoutMs }) {
  const key = process.env.HF_API_KEY;
  if (!key || !isUp('hf')) return null;

  const chat = [{ role: 'system', content: system }, ...messages];
  for (const model of HF_MODELS()) {
    try {
      const r = await fetch(HF_LLM_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: chat, temperature, max_tokens: maxTokens, top_p: topP, stream: false }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (r.status === 402) {
        markDown('hf', 'hết credit (HTTP 402)', 30 * MIN, 'Cần nạp credit hoặc đổi HF_API_KEY trong .env rồi chạy: docker compose up -d --force-recreate ai-bot');
        return null;                       // cùng một tài khoản: các model còn lại cũng sẽ 402
      }
      if (r.status === 401 || r.status === 403) {
        markDown('hf', `khóa không hợp lệ (HTTP ${r.status})`, 60 * MIN, 'Kiểm tra HF_API_KEY trong .env');
        return null;
      }
      if (r.status === 429) { markDown('hf', 'bị giới hạn tần suất (HTTP 429)', MIN); return null; }
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        console.warn(`[LLM] HF ${model} HTTP ${r.status}: ${t.slice(0, 100)}`);
        continue;                          // 400/404/410/503... -> thử model kế
      }

      const data = await r.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) { console.warn(`[LLM] HF ${model} trả rỗng.`); continue; }
      if (containsChinese(text)) { console.warn(`[LLM] HF ${model} trả tiếng Trung — bỏ.`); continue; }
      markUp('hf');
      return { text, provider: 'huggingface', model };
    } catch (err) {
      const timeout = err.name === 'TimeoutError' || err.name === 'AbortError';
      console.warn(`[LLM] HF ${model} ${timeout ? 'timeout' : err.message}`);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini
// ─────────────────────────────────────────────────────────────────────────────

/** Gộp các lượt liên tiếp cùng vai và bỏ các lượt 'model' đứng đầu (Gemini cần bắt đầu bằng 'user'). */
function toGeminiContents(messages) {
  const out = [];
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (!out.length && role === 'model') continue;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].parts[0].text += '\n' + m.content;
    else out.push({ role, parts: [{ text: m.content }] });
  }
  return out;
}

async function callGemini({ system, messages, maxTokens, temperature, topP, timeoutMs, json }) {
  const key = process.env.GOOGLE_AI_KEY;
  if (!key || !isUp('gemini')) return null;

  const contents = toGeminiContents(messages);
  if (!contents.length) return null;

  const mkBody = (withThinking) => JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      temperature, topP,
      // Dư địa cho câu trả lời; không chỉ dựa vào maxTokens của HF (150).
      maxOutputTokens: Math.max(maxTokens * 3, 400),
      ...(withThinking ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}),
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  });

  let rateLimited = 0;
  const models = GEMINI_CHAT_MODELS();
  for (const model of models) {
    for (const withThinking of [true, false]) {
      try {
        const r = await fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: mkBody(withThinking),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (r.status === 429) { rateLimited++; break; }
        if (r.status === 401 || r.status === 403) {
          markDown('gemini', `khóa không hợp lệ hoặc bị khóa (HTTP ${r.status})`, 30 * MIN, 'Kiểm tra GOOGLE_AI_KEY trong .env (khóa bị lộ có thể bị Google vô hiệu hóa).');
          return null;
        }
        if (r.status === 400) {
          // Google trả 400 (không phải 401) cho khóa sai: "API key not valid" / reason API_KEY_INVALID.
          const body400 = await r.text().catch(() => '');
          if (/API key not valid|API_KEY_INVALID/i.test(body400)) {
            markDown('gemini', 'khóa không hợp lệ (HTTP 400 API_KEY_INVALID)', 30 * MIN, 'Kiểm tra GOOGLE_AI_KEY trong .env.');
            return null;
          }
          if (withThinking) continue;                        // model không nhận thinkingConfig -> thử lại không có
          console.warn(`[LLM] Gemini ${model} HTTP 400: ${body400.slice(0, 100)}`);
          break;
        }
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          console.warn(`[LLM] Gemini ${model} HTTP ${r.status}: ${t.slice(0, 100)}`);
          break;                                           // thử model kế
        }

        const data = await r.json();
        const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
        if (!text) { console.warn(`[LLM] Gemini ${model} trả rỗng (finish=${data?.candidates?.[0]?.finishReason}).`); break; }
        markUp('gemini');
        return { text, provider: 'gemini', model };
      } catch (err) {
        const timeout = err.name === 'TimeoutError' || err.name === 'AbortError';
        console.warn(`[LLM] Gemini ${model} ${timeout ? 'timeout' : err.message}`);
        break;
      }
    }
  }
  if (rateLimited >= models.length) {
    markDown('gemini', 'hết hạn mức hoặc bị giới hạn tần suất (HTTP 429)', 5 * MIN, 'Chờ hoặc đổi GOOGLE_AI_KEY.');
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenRouter (API tương thích OpenAI: POST {OPENROUTER_URL}/chat/completions)
// ─────────────────────────────────────────────────────────────────────────────
async function callOpenRouter({ system, messages, maxTokens, temperature, topP, timeoutMs, json }) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || !isUp('openrouter')) return null;

  const chat = [{ role: 'system', content: system }, ...messages];
  const models = OPENROUTER_MODELS();
  let rateLimited = 0;
  for (const model of models) {
    // Lần 1: tắt "suy nghĩ" + JSON mode nếu cần; lần 2: bỏ các tùy chọn nếu model không nhận (HTTP 400).
    for (const lean of [false, true]) {
      try {
        const body = {
          model, messages: chat, temperature, top_p: topP, stream: false,
          max_tokens: Math.max(maxTokens * 3, 400),
          ...(lean ? {} : { reasoning: { enabled: false } }),
          ...(!lean && json ? { response_format: { type: 'json_object' } } : {}),
        };
        const r = await fetch(`${OPENROUTER_BASE()}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (r.status === 402) {
          markDown('openrouter', 'hết credit (HTTP 402)', 30 * MIN, 'Cần nạp credit hoặc đổi OPENROUTER_API_KEY trong .env rồi chạy: docker compose up -d --force-recreate ai-bot');
          return null;
        }
        if (r.status === 401 || r.status === 403) {
          markDown('openrouter', `khóa không hợp lệ (HTTP ${r.status})`, 60 * MIN, 'Kiểm tra OPENROUTER_API_KEY trong .env');
          return null;
        }
        if (r.status === 429) { rateLimited++; break; }
        if (r.status === 400 && !lean) continue;
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          console.warn(`[LLM] OpenRouter ${model} HTTP ${r.status}: ${t.slice(0, 100)}`);
          break;
        }

        const data = await r.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (!text) { console.warn(`[LLM] OpenRouter ${model} trả rỗng (finish=${data?.choices?.[0]?.finish_reason}).`); break; }
        if (containsChinese(text)) { console.warn(`[LLM] OpenRouter ${model} trả tiếng Trung — bỏ.`); break; }
        markUp('openrouter');
        return { text, provider: 'openrouter', model };
      } catch (err) {
        const timeout = err.name === 'TimeoutError' || err.name === 'AbortError';
        console.warn(`[LLM] OpenRouter ${model} ${timeout ? 'timeout' : err.message}`);
        break;
      }
    }
  }
  if (rateLimited >= models.length) {
    markDown('openrouter', 'bị giới hạn tần suất (HTTP 429)', 2 * MIN, 'Chờ hoặc đổi OPENROUTER_API_KEY.');
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{ system: string, messages: Array<{role:'user'|'assistant', content:string}>,
 *           maxTokens?: number, temperature?: number, topP?: number, timeoutMs?: number,
 *           json?: boolean }} p
 * @returns {Promise<{ text: string, provider: string, model: string } | null>}
 *          null = mọi nhà cung cấp đều không dùng được -> nơi gọi dùng đường lui.
 */
async function generateText(p) {
  const args = { maxTokens: 150, temperature: 0.7, topP: 0.9, timeoutMs: 20_000, json: false, ...p };
  const viaHf = await callHuggingFace(args);
  if (viaHf) return viaHf;
  const viaGemini = await callGemini(args);
  if (viaGemini) {
    console.log(`[LLM] Gemini ${viaGemini.model} trả lời (HuggingFace không dùng được).`);
    return viaGemini;
  }
  const viaOpenRouter = await callOpenRouter(args);
  if (viaOpenRouter) {
    console.log(`[LLM] OpenRouter ${viaOpenRouter.model} trả lời (HuggingFace và Gemini không dùng được).`);
    return viaOpenRouter;
  }
  return null;
}

module.exports = { generateText, getProviderStatus, toGeminiContents };
