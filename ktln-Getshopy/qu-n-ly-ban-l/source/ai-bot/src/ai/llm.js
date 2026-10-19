/**
 * llm.js — Sinh câu trả lời chatbot bằng LLM
 *
 * Nhận context từ DB (sản phẩm, chính sách) + câu hỏi user
 * → gọi chuỗi nhà cung cấp trong ./llmClient (HuggingFace → Gemini)
 *   để sinh câu trả lời tự nhiên bằng tiếng Việt.
 *   Trả null nếu mọi nhà cung cấp đều không dùng được → ChatbotService
 *   dùng câu trả lời dựng sẵn (rule-based).
 *
 * Danh sách model đọc từ env:
 *   HF_LLM_MODELS        (mặc định meta-llama/Llama-3.1-8B-Instruct)
 *   GEMINI_CHAT_MODELS   (mặc định gemini-3.5-flash,gemini-3-flash-preview)
 *
 * Lưu ý: OpenRouter keys được giữ trong .env để có thể dễ dàng
 *        chuyển lại bằng cách thay đổi cấu hình.
 */

'use strict';

const { generateText } = require('./llmClient');

const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

// ─────────────────────────────────────────────────────────────────────────────
// BUILD SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemPrompt(context = {}) {
  const { products = [], policy = null, budget = null } = context;

  let productSection = '';
  if (products.length > 0) {
    // Dùng ProductSpecsCache để format specs chi tiết cho LLM
    let PSC;
    try { PSC = require('../services/ProductSpecsCache'); } catch (_) {}

    if (PSC) {
      productSection = '\nSẢN PHẨM LIÊN QUAN:\n' + PSC.getSpecsSummaryForLLM(products) + '\n';
    } else {
      const lines = products.map(p =>
        `- ${p.name}: ${fmt(p.price)}` +
        (p.rating ? `, ⭐${Number(p.rating).toFixed(1)}` : '') +
        (p.sold ? `, bán ${p.sold}` : '')
      ).join('\n');
      productSection = `\nSẢN PHẨM LIÊN QUAN:\n${lines}\n`;
    }
  }

  const policySection = policy ? `\nTHÔNG TIN:\n${policy}\n` : '';
  const budgetSection = budget && budget.description
    ? `\nNGÂN SÁCH KHÁCH NÊU: ${budget.description}. Các sản phẩm ở trên đều nằm trong ngân sách này; TUYỆT ĐỐI KHÔNG gợi ý sản phẩm có giá vượt mức đó.\n`
    : '';

  return `Bạn là trợ lý AI mua sắm của Getshopy — cửa hàng điện tử tại TP.HCM với hơn 600.000 sản phẩm.
VAI TRÒ: Tư vấn mua sắm thông minh, thân thiện.

!!! NGÔN NGỮ BẮT BUỘC: CHỈ DÙNG TIẾNG VIỆT. TUYỆT ĐỐI KHÔNG dùng tiếng Trung, tiếng Anh hay bất kỳ ngôn ngữ nào khác. Xưng "em", gọi khách "anh/chị". !!!

33 THƯƠNG HIỆU: Apple, Samsung, OPPO, Xiaomi, Vivo, realme, HONOR, Motorola, Infinix, TECNO, Huawei, Acer, Asus, Dell, HP, Lenovo, Sony, JBL, Marshall, Baseus, Ugreen, Razer, Logitech, Dahua, EZVIZ, Imou, TP-Link, Kingston, SanDisk, Seagate, Amazfit, TOTOLINK, ESR.

8 DANH MỤC CHÍNH: Điện thoại, Laptop, Tablet, Smartwatch, Phụ kiện di động, Phụ kiện laptop/PC, Thiết bị nghe nhìn & lưu trữ, Camera.

PHONG CÁCH: Nhiệt tình, ngắn gọn (2–3 câu), dùng emoji vừa phải.
${productSection}${policySection}${budgetSection}
CHÍNH SÁCH:
- Giao hàng: Nội thành 2–4h, tỉnh thành 1–3 ngày. Miễn ship từ 500k.
- Bảo hành: 12 tháng chính hãng, đổi trả 7 ngày.
- Thanh toán: COD, MoMo, ZaloPay, VNPAY, trả góp 0%.

QUY TẮC BẮT BUỘC:
1. CHỈ gợi ý sản phẩm có trong danh sách "SẢN PHẨM LIÊN QUAN" ở trên.
2. Nêu tên + giá CHÍNH XÁC khi đề cập sản phẩm.
3. TUYỆT ĐỐI KHÔNG tự bổ sung thông số kỹ thuật (cảm biến, pin, RAM, ...) không có trong dữ liệu trên. Nếu khách hỏi thông số mà không có trong DB, hãy nói: "Dạ em chưa có thông tin chi tiết về điểm này, anh/chị có thể xem thêm trên trang sản phẩm ạ!"
4. Nếu câu hỏi là nối tiếp ("hiển thị", "xem ngay"...), hãy trả lời dựa vào ngữ cảnh hội thoại trước, đừng phủ nhận thông tin đã có trong lượt trước.
5. Cuối câu thêm câu hỏi để duy trì hội thoại. Trả lời TIẾNG VIỆT.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE RESPONSE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sinh câu trả lời qua chuỗi HuggingFace → Gemini.
 *
 * @param {{ intent: string, context: object, message: string, history: Array }} params
 * @returns {Promise<string|null>} - Nội dung câu trả lời hoặc null nếu mọi nhà cung cấp thất bại
 */
async function generateChatResponse({ intent, context, message, history = [] }) {
  const system = buildSystemPrompt({ ...context, intent });

  const historyMessages = history
    .slice(-6)
    .map(h => ({
      role: h.sender === 'user' ? 'user' : 'assistant',
      content: String(h.text || ''),
    }))
    .filter(m => m.content);

  const result = await generateText({
    system,
    messages: [...historyMessages, { role: 'user', content: context.effectiveMessage || message }],
    maxTokens: 150,
    temperature: 0.7,
    topP: 0.9,
    timeoutMs: 20_000,
  });

  if (!result) {
    console.warn('[LLM] Không nhà cung cấp nào khả dụng — dùng fallback handler.');
    return null;
  }
  console.log(`[LLM] ${result.provider}/${result.model} sinh ${result.text.length} ký tự, intent=${intent}`);
  return result.text;
}

module.exports = { generateChatResponse };
