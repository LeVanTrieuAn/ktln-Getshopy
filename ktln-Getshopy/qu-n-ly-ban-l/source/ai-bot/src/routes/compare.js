'use strict';
/**
 * ============================================================
 * COMPARE ADVISORY ROUTES — AI So Sánh & Tư Vấn Chọn Thiết Bị
 * routes/compare.js
 * ============================================================
 *
 * Nhận 2 thiết bị và nhu cầu của khách hàng
 * -> Trích xuất thông số kỹ thuật thực từ ProductSpecsCache / DB
 * -> Gọi multi-provider LLM (HuggingFace -> Gemini -> OpenRouter)
 * -> Có Rule-based Heuristic Fallback khi toàn bộ LLM ngoại vi offline.
 *
 * @module routes/compare
 */

const express = require('express');
const router = express.Router();
const { prisma } = require('../db');
const { generateText } = require('../ai/llmClient');
const { getProductSpecs, formatSpecsForLLM } = require('../services/ProductSpecsCache');

const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + 'đ';

/**
 * Heuristic fallback so sánh thông số khi LLM offline hoặc rate-limited
 */
function generateRuleBasedAdvice(p1, p2, userNeeds = '') {
  const specs1 = getProductSpecs(p1) || {};
  const specs2 = getProductSpecs(p2) || {};

  const price1 = Number(p1.price) || 0;
  const price2 = Number(p2.price) || 0;

  // So sánh giá
  let priceDiffNote = '';
  if (price1 && price2) {
    if (Math.abs(price1 - price2) > 500_000) {
      const cheaper = price1 < price2 ? p1 : p2;
      const diff = Math.abs(price1 - price2);
      priceDiffNote = `${cheaper.name} tiết kiệm hơn khoảng ${fmt(diff)}.`;
    } else {
      priceDiffNote = `Cả hai có mức giá tương đương nhau trong phân khúc.`;
    }
  }

  // Tóm tắt cấu hình nổi bật
  const s1Text = formatSpecsForLLM(specs1) || 'Cấu hình tiêu chuẩn';
  const s2Text = formatSpecsForLLM(specs2) || 'Cấu hình tiêu chuẩn';

  const advice1 = `${p1.name} (${fmt(price1)}) phù hợp với người dùng cần ${specs1.ram ? specs1.ram + ' RAM, ' : ''}${specs1.chip ? 'chip ' + specs1.chip : 'thiết bị ổn định'}, đáp ứng tốt nhu cầu học tập, làm việc và giải trí hàng ngày.`;
  const advice2 = `${p2.name} (${fmt(price2)}) phù hợp với người dùng ưu tiên ${specs2.storage ? specs2.storage + ' bộ nhớ, ' : ''}${specs2.battery ? 'pin ' + specs2.battery : 'thiết kế hiện đại và độ bền'}.`;

  let verdict = '';
  if (userNeeds) {
    verdict = `Với nhu cầu "${userNeeds}": Hãy cân nhắc ${price1 <= price2 ? p1.name : p2.name} nếu cần tối ưu ngân sách, hoặc chọn thiết bị có thông số RAM/Chip cao hơn để tối đa trải nghiệm.`;
  } else {
    verdict = `Tổng kết: ${priceDiffNote} Hãy chọn ${p1.name} nếu bạn chuộng thiết kế và tính năng riêng của hãng, hoặc chọn ${p2.name} nếu thông số kỹ thuật của nó đáp ứng sát hơn thói quen sử dụng của bạn.`;
  }

  return {
    summary: `${p1.name} phù hợp với nhu cầu sử dụng cân bằng và kinh tế, trong khi ${p2.name} phù hợp với nhu cầu đòi hỏi cấu hình hoặc tính năng chuyên biệt hơn.`,
    advice: {
      device1: {
        id: p1.id,
        name: p1.name,
        suitableFor: advice1,
        specsHighlight: s1Text
      },
      device2: {
        id: p2.id,
        name: p2.name,
        suitableFor: advice2,
        specsHighlight: s2Text
      }
    },
    verdict,
    provider: 'rule-based-fallback',
    model: 'specs-heuristic-v1'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/b2c/compare-advice — AI tư vấn so sánh giữa 2 thiết bị
// ─────────────────────────────────────────────────────────────────────────────
router.post('/b2c/compare-advice', async (req, res) => {
  try {
    const { device1Id, device2Id, userNeeds, device1Data, device2Data } = req.body;

    if (!device1Id && !device1Data) {
      return res.status(400).json({ error: 'Thiếu thông tin thiết bị 1' });
    }
    if (!device2Id && !device2Data) {
      return res.status(400).json({ error: 'Thiếu thông tin thiết bị 2' });
    }

    // 1. Lấy thông tin thiết bị từ body hoặc DB
    let p1 = device1Data;
    let p2 = device2Data;

    if (!p1 && device1Id) {
      p1 = await prisma.product.findUnique({
        where: { id: device1Id },
        select: { id: true, name: true, price: true, description: true, rating: true, sold: true, category_id: true }
      });
    }

    if (!p2 && device2Id) {
      p2 = await prisma.product.findUnique({
        where: { id: device2Id },
        select: { id: true, name: true, price: true, description: true, rating: true, sold: true, category_id: true }
      });
    }

    if (!p1 || !p2) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm cần so sánh' });
    }

    // 2. Trích xuất thông số kỹ thuật chuẩn hóa
    const specs1 = getProductSpecs(p1) || {};
    const specs2 = getProductSpecs(p2) || {};
    const specs1Str = formatSpecsForLLM(specs1) || 'Thông số tiêu chuẩn';
    const specs2Str = formatSpecsForLLM(specs2) || 'Thông số tiêu chuẩn';

    // 3. Xây dựng System Prompt & User Message cho LLM
    const systemPrompt = `Bạn là chuyên gia tư vấn công nghệ và bán hàng thiết bị điện tử của Getshopy.
NHIỆM VỤ: So sánh khách quan 2 sản phẩm và đưa ra lời khuyên người mua nên chọn máy nào dựa trên nhu cầu cụ thể.
QUY TẮC BẮT BUỘC:
1. CHỈ TRẢ LỜI BẰNG TIẾNG VIỆT, xưng "em", gọi khách "anh/chị".
2. Bắt buộc có câu nhận định rõ ràng: "Sản phẩm [A] phù hợp với... nhu cầu là..., trong khi [B] phù hợp với... nhu cầu là...".
3. Dựa sát vào thông số kỹ thuật thực và giá niêm yết được cung cấp, không bịa đặt thông số không có.
4. Trả lời theo đúng định dạng JSON chuẩn (không bao quanh bởi markdown triple-backticks nếu không cần thiết):
{
  "summary": "Câu tóm tắt tổng quan nêu rõ sản phẩm nào phù hợp với nhu cầu gì",
  "device1Suitable": "Sản phẩm 1 phù hợp nhất với ai / nhu cầu gì",
  "device2Suitable": "Sản phẩm 2 phù hợp nhất với ai / nhu cầu gì",
  "verdict": "Lời khuyên kết luận chốt đơn nên chọn máy nào tùy theo ngân sách và nhu cầu"
}`;

    const userPrompt = `Hãy so sánh 2 thiết bị sau:
- THIẾT BỊ 1: ${p1.name}
  + Giá: ${fmt(p1.price)}
  + Thông số: ${specs1Str}
  ${p1.rating ? `+ Đánh giá: ${p1.rating}/5.0` : ''}

- THIẾT BỊ 2: ${p2.name}
  + Giá: ${fmt(p2.price)}
  + Thông số: ${specs2Str}
  ${p2.rating ? `+ Đánh giá: ${p2.rating}/5.0` : ''}

${userNeeds ? `NHU CẦU CỦA KHÁCH HÀNG: "${userNeeds}"` : 'NHU CẦU CỦA KHÁCH HÀNG: Người dùng cần tư vấn lựa chọn tối ưu giữa 2 máy.'}

Hãy xuất ra JSON theo đúng cấu trúc yêu cầu.`;

    // 4. Gọi LLM Client
    let aiResponse = null;
    try {
      aiResponse = await generateText({
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 450,
        temperature: 0.5,
        timeoutMs: 15_000,
        json: true
      });
    } catch (llmErr) {
      console.warn('[Compare AI] LLM error:', llmErr.message);
    }

    // 5. Parse kết quả hoặc Fallback
    if (aiResponse && aiResponse.text) {
      try {
        let cleanText = aiResponse.text.trim();
        // Xóa markdown backticks nếu LLM trả về ```json ... ```
        if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        }
        const parsed = JSON.parse(cleanText);

        return res.json({
          success: true,
          summary: parsed.summary || `${p1.name} phù hợp với nhu cầu của bạn, trong khi ${p2.name} mang lại sự lựa chọn khác biệt về tính năng.`,
          advice: {
            device1: {
              id: p1.id,
              name: p1.name,
              suitableFor: parsed.device1Suitable || `Phù hợp với người dùng yêu thích ${p1.name}`,
              specsHighlight: specs1Str
            },
            device2: {
              id: p2.id,
              name: p2.name,
              suitableFor: parsed.device2Suitable || `Phù hợp với người dùng chuộng ${p2.name}`,
              specsHighlight: specs2Str
            }
          },
          verdict: parsed.verdict || `Tùy vào nhu cầu thực tế và ngân sách, bạn hãy cân nhắc lựa chọn thiết bị ưng ý nhất.`,
          provider: aiResponse.provider,
          model: aiResponse.model
        });
      } catch (parseErr) {
        console.warn('[Compare AI] JSON parse failed, treating as raw text:', parseErr.message);
        return res.json({
          success: true,
          summary: aiResponse.text,
          advice: {
            device1: { id: p1.id, name: p1.name, suitableFor: `Xem chi tiết tư vấn bên dưới`, specsHighlight: specs1Str },
            device2: { id: p2.id, name: p2.name, suitableFor: `Xem chi tiết tư vấn bên dưới`, specsHighlight: specs2Str }
          },
          verdict: aiResponse.text,
          provider: aiResponse.provider,
          model: aiResponse.model
        });
      }
    }

    // 6. Nếu LLM trả về null (circuit breaker hoặc rate-limit), dùng rule-based fallback
    console.log('[Compare AI] Sử dụng Rule-based Specs Heuristic Fallback.');
    const fallbackData = generateRuleBasedAdvice(p1, p2, userNeeds);
    return res.json({ success: true, ...fallbackData });

  } catch (err) {
    console.error('[Compare AI Error]', err.stack || err.message);
    res.status(500).json({
      error: 'Lỗi xử lý so sánh AI',
      message: 'Hệ thống đang bận, vui lòng thử lại sau.'
    });
  }
});

module.exports = router;
