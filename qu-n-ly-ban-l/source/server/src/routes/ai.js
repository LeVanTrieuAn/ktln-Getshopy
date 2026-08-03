const express = require('express');
const { prisma } = require('../db');
const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_URL = process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1';

async function callOpenRouter(prompt, options = {}) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('Missing OPENROUTER_API_KEY in .env. Vui lòng cập nhật API Key vào file .env');
  }
  
  const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost:8080",
      "X-Title": "Getshopy Analytics",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "model": process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash:free",
      "response_format": options.response_format,
      "messages": [
        { "role": "user", "content": prompt }
      ]
    })
  });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API Error: ${errText}`);
  }
  
  const data = await response.json();
  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content;
  }
  throw new Error('Empty AI response');
}

// ==========================================
// 1. AI Recommendation System (B2C)
// ==========================================
router.get('/b2c/recommendations', async (req, res) => {
  try {
    const { email } = req.query;
    
    // Fallback products (top selling / random) in case AI fails or user has no history
    const allProducts = await prisma.product.findMany({
      where: { is_deleted: false, stock: { gt: 0 } },
      orderBy: { id: 'desc' },
      take: 20
    });
    const fallbackIds = allProducts.map(p => Number(p.id)).slice(0, 4);

    if (!email) {
      // Guest user -> Return top products
      const prods = await prisma.product.findMany({
        where: { id: { in: fallbackIds } }
      });
      return res.json(prods.map(p => ({ ...p, id: Number(p.id) })));
    }

    // 1. Fetch user order history
    const orders = await prisma.order.findMany({
      where: {
        customer: {
          path: ['email'],
          equals: email
        }
      },
      orderBy: { date: 'desc' },
      take: 10
    });

    let historyText = "";
    if (orders.length > 0) {
      const boughtItems = orders.flatMap(o => o.items).map(i => i.name).slice(0, 5);
      historyText = `Khách hàng này đã từng mua: ${boughtItems.join(', ')}.`;
    } else {
      historyText = `Khách hàng này chưa từng mua sản phẩm nào.`;
    }

    // 2. Prepare catalog for AI
    const catalogData = allProducts.map(p => ({
      id: Number(p.id),
      name: p.name,
      category: p.category_id,
      price: p.price
    }));

    // 3. Prompt AI
    const prompt = `
Bạn là một AI phân tích hành vi mua sắm.
${historyText}

Dưới đây là danh sách sản phẩm đang có sẵn trong kho:
${JSON.stringify(catalogData)}

Hãy chọn ra chính xác 4 sản phẩm phù hợp nhất với người dùng này (nếu chưa mua gì thì ưu tiên ngẫu nhiên/sản phẩm giá tốt).
Trả về KẾT QUẢ LÀ MỘT OBJECT JSON duy nhất có định dạng: {"recommendations": [1, 5, 2, 8]}
    `;

    let recommendedIds = fallbackIds;
    try {
      const aiResponseText = await callOpenRouter(prompt, { response_format: { type: "json_object" } });
      const parsed = JSON.parse(aiResponseText);
      if (parsed.recommendations && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
        recommendedIds = parsed.recommendations.map(id => Number(id));
      }
    } catch (aiError) {
      console.warn("AI Recommendation Failed, using fallback:", aiError.message);
    }

    // 4. Fetch recommended products
    const recommendedProducts = await prisma.product.findMany({
      where: { id: { in: recommendedIds } }
    });

    res.json(recommendedProducts.map(p => ({ ...p, id: Number(p.id) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. AI Campaign Suggestions (B2B Admin)
// ==========================================
router.get('/b2b/campaign-suggestions', async (req, res) => {
  try {
    // 1. Gather context for AI
    // - High stock products
    const highStockProducts = await prisma.product.findMany({
      where: { is_deleted: false, stock: { gt: 10 } },
      orderBy: { stock: 'desc' },
      take: 5
    });
    
    // - Past flash sales
    const pastSales = await prisma.flashSale.findMany({
      where: { is_deleted: false },
      orderBy: { id: 'desc' },
      take: 3
    });

    const contextData = {
      high_stock_products: highStockProducts.map(p => ({
        id: Number(p.id),
        name: p.name,
        stock: p.stock,
        price: p.price
      })),
      recent_campaigns: pastSales.map(fs => ({
        title: fs.title,
        discount_percent: fs.discount_percent
      }))
    };

    const prompt = `
Bạn là AI chuyên gia Marketing cho một sàn thương mại điện tử (bán đồ điện tử/thời trang).
Dữ liệu hiện tại của cửa hàng:
${JSON.stringify(contextData)}

Hãy dựa vào các sản phẩm tồn kho nhiều và các chiến dịch gần đây để đề xuất MỘT chiến dịch Flash Sale mới.
Trả về KẾT QUẢ DUY NHẤT LÀ MỘT OBJECT JSON THEO ĐỊNH DẠNG SAU, KHÔNG CÓ BẤT KỲ VĂN BẢN NÀO KHÁC:
{
  "title": "Tên chiến dịch hấp dẫn (VD: Xả kho cuối tháng, Back to School...)",
  "reason": "Lý do ngắn gọn tại sao nên chạy chiến dịch này",
  "discount_percent": 15,
  "product_id": (ID của sản phẩm tồn kho cao, là số)
}
    `;

    const aiResponseText = await callOpenRouter(prompt, { response_format: { type: "json_object" } });
    const suggestion = JSON.parse(aiResponseText);
    
    res.json({ success: true, suggestion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
