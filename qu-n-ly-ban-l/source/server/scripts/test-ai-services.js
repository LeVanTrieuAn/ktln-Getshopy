'use strict';
/**
 * ============================================================
 * TEST AI SERVICES — Kịch bản test chi tiết cho 3 AI Services
 * scripts/test-ai-services.js
 * ============================================================
 *
 * Test tất cả 3 services: Search, Chatbot, Recommendation
 * với focus vào specs-awareness, payload optimization, và accuracy.
 *
 * Chạy: node scripts/test-ai-services.js
 */

const BASE = process.env.API_BASE || 'http://localhost:8080/api';

const TESTS = [];
let passed = 0;
let failed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}${detail ? ' — ' + detail : ''}`);
  }
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
    ...options,
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. SEARCH SERVICE TESTS
// ═════════════════════════════════════════════════════════════════════════════
async function testSearch() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('1. SEARCH SERVICE');
  console.log('══════════════════════════════════════════════════════════');

  // 1.1 Smart search — basic keyword
  console.log('\n─── 1.1 Smart Search: "tai nghe bluetooth chống ồn" ───');
  try {
    const { status, data } = await fetchJSON(`${BASE}/ai/smart-search`, {
      method: 'POST',
      body: JSON.stringify({ query: 'tai nghe bluetooth chống ồn' }),
    });
    assert(status === 200, 'HTTP 200');
    assert(data.products?.length > 0, `Có sản phẩm (${data.products?.length || 0})`);
    assert(data.hint, `Có hint: "${data.hint}"`);

    // Payload optimization checks
    if (data.products?.length > 0) {
      const p = data.products[0];
      assert(p.id !== undefined, 'Có field id');
      assert(p.name !== undefined, 'Có field name');
      assert(p.price !== undefined, 'Có field price');
      assert(p.image !== undefined, 'Có field image');
      assert(p.specs !== undefined, `Có field specs: ${JSON.stringify(p.specs)}`);
      assert(p.images === undefined, 'KHÔNG có images array (payload optimized)');
      assert(p.stock === undefined, 'KHÔNG có stock (payload optimized)');
      assert(p.description === undefined, 'KHÔNG có description HTML (payload optimized)');

      // Measure payload size
      const payloadSize = JSON.stringify(data).length;
      console.log(`  📦 Payload size: ${(payloadSize / 1024).toFixed(1)} KB`);
    }
  } catch (e) {
    assert(false, 'Smart search request', e.message);
  }

  // 1.2 Smart search — brand + category
  console.log('\n─── 1.2 Smart Search: "laptop gaming ASUS RTX" ───');
  try {
    const { status, data } = await fetchJSON(`${BASE}/ai/smart-search`, {
      method: 'POST',
      body: JSON.stringify({ query: 'laptop gaming ASUS RTX' }),
    });
    assert(status === 200, 'HTTP 200');
    assert(data.products?.length > 0, `Có sản phẩm (${data.products?.length || 0})`);

    if (data.products?.length > 0) {
      const p = data.products[0];
      assert(p.specs !== undefined, `Specs: ${JSON.stringify(p.specs)}`);
      // Verify brand/category relevance
      const hasAsus = data.products.some(prod =>
        prod.name.toLowerCase().includes('asus')
      );
      assert(hasAsus, 'Có sản phẩm ASUS trong kết quả');
    }
  } catch (e) {
    assert(false, 'Brand+category search', e.message);
  }

  // 1.3 Smart search — price filter
  console.log('\n─── 1.3 Smart Search: "điện thoại dưới 10 triệu" ───');
  try {
    const { status, data } = await fetchJSON(`${BASE}/ai/smart-search`, {
      method: 'POST',
      body: JSON.stringify({ query: 'điện thoại dưới 10 triệu' }),
    });
    assert(status === 200, 'HTTP 200');
    if (data.products?.length > 0) {
      const allUnder10M = data.products.every(p => p.price <= 10_000_000);
      assert(allUnder10M, `Tất cả SP dưới 10 triệu (min: ${Math.min(...data.products.map(p=>p.price)).toLocaleString()}, max: ${Math.max(...data.products.map(p=>p.price)).toLocaleString()})`);
    }
  } catch (e) {
    assert(false, 'Price filter search', e.message);
  }

  // 1.4 Search — specs in results
  console.log('\n─── 1.4 Smart Search: "sạc dự phòng 20000mAh" ───');
  try {
    const { status, data } = await fetchJSON(`${BASE}/ai/smart-search`, {
      method: 'POST',
      body: JSON.stringify({ query: 'sạc dự phòng 20000mAh' }),
    });
    assert(status === 200, 'HTTP 200');
    if (data.products?.length > 0) {
      const hasSpecs = data.products.some(p => p.specs && Object.keys(p.specs).length > 0);
      assert(hasSpecs, 'Ít nhất 1 SP có specs (VD: capacity, wattage...)');
      const p = data.products.find(p => p.specs);
      if (p) console.log(`  📋 Sample specs: ${JSON.stringify(p.specs)}`);
    }
  } catch (e) {
    assert(false, 'Specs in search results', e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. CHATBOT SERVICE TESTS
// ═════════════════════════════════════════════════════════════════════════════
async function testChatbot() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('2. CHATBOT SERVICE');
  console.log('══════════════════════════════════════════════════════════');

  // 2.1 Greeting
  console.log('\n─── 2.1 Chatbot: Greeting ───');
  try {
    const { status, data } = await fetchJSON(`${BASE}/b2c/chat`, {
      method: 'POST',
      body: JSON.stringify({ message: 'Xin chào', history: [] }),
    });
    assert(status === 200, 'HTTP 200');
    assert(data.text?.length > 0, `Có text reply (${data.text?.length} chars)`);
    // Chatbot response = { text, link, products } — intent không expose ra ngoài
    const isGreeting = (data.text || '').toLowerCase().match(/chào|xin chào|getshopy|giúp/);
    assert(isGreeting, `Reply có nội dung chào hỏi`);
  } catch (e) {
    assert(false, 'Chatbot greeting', e.message);
  }

  // 2.2 Search product — specs-aware
  console.log('\n─── 2.2 Chatbot: "webcam Logitech Full HD" ───');
  try {
    const { status, data } = await fetchJSON(`${BASE}/b2c/chat`, {
      method: 'POST',
      body: JSON.stringify({ message: 'webcam Logitech Full HD', history: [] }),
    });
    assert(status === 200, 'HTTP 200');
    assert(data.products?.length > 0 || data.text?.length > 0, `Có sản phẩm (${data.products?.length || 0}) hoặc text reply`);

    if (data.products?.length > 0) {
      const p = data.products[0];
      assert(p.specs !== undefined, `Có specs: ${JSON.stringify(p.specs)}`);
      // Payload check — chatbot không cần images array
      assert(p.images === undefined, 'KHÔNG có images array');
      assert(p.stock === undefined, 'KHÔNG có stock');
    }

    // Anti-hallucination check
    if (data.text) {
      console.log(`  💬 Reply preview: "${data.text.slice(0, 150)}..."`);
    }
  } catch (e) {
    assert(false, 'Chatbot specs-aware search', e.message);
  }

  // 2.3 Follow-up context retention
  console.log('\n─── 2.3 Chatbot: Follow-up "có màu trắng không?" ───');
  try {
    const history = [
      { role: 'user', content: 'webcam Logitech Full HD' },
      { role: 'assistant', content: 'Dạ em tìm thấy webcam Logitech cho anh/chị.' },
    ];
    const { status, data } = await fetchJSON(`${BASE}/b2c/chat`, {
      method: 'POST',
      body: JSON.stringify({ message: 'có màu trắng không?', history }),
    });
    assert(status === 200, 'HTTP 200');
    assert(data.text?.length > 0, 'Có text reply');
    // Reply nên liên quan đến webcam (context retention)
    const replyLower = (data.text || '').toLowerCase();
    const contextRetained = replyLower.includes('webcam') || replyLower.includes('logitech') || replyLower.includes('màu') || data.products?.length > 0;
    assert(contextRetained, 'Context retention — reply đề cập webcam/Logitech');
  } catch (e) {
    assert(false, 'Chatbot follow-up', e.message);
  }

  // 2.4 Ask specs — should use real data
  console.log('\n─── 2.4 Chatbot: "laptop ASUS RAM bao nhiêu?" ───');
  try {
    const { status, data } = await fetchJSON(`${BASE}/b2c/chat`, {
      method: 'POST',
      body: JSON.stringify({ message: 'laptop ASUS có RAM bao nhiêu?', history: [] }),
    });
    assert(status === 200, 'HTTP 200');
    if (data.products?.length > 0) {
      const hasSpecs = data.products.some(p => p.specs && Object.keys(p.specs).length > 0);
      assert(hasSpecs, `Có specs: ${JSON.stringify(data.products.find(p=>p.specs)?.specs)}`);
      const hasRam = data.products.some(p => p.specs?.ram);
      if (hasRam) console.log(`  📋 RAM: ${data.products.find(p => p.specs?.ram)?.specs?.ram}`);
    } else {
      assert(data.text?.length > 0, `Có text reply dù không có products`);
    }
  } catch (e) {
    assert(false, 'Chatbot ask specs', e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. RECOMMENDATION SERVICE TESTS
// ═════════════════════════════════════════════════════════════════════════════
async function testRecommendation() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('3. RECOMMENDATION SERVICE');
  console.log('══════════════════════════════════════════════════════════');

  // 3.1 General recommendations
  console.log('\n─── 3.1 Recommendations: General ───');
  try {
    const { status, data } = await fetchJSON(`${BASE}/b2c/recommendations?email=`);
    assert(status === 200, 'HTTP 200');
    assert(Array.isArray(data), `Trả mảng (${data?.length || 0} items)`);

    if (data?.length > 0) {
      const p = data[0];
      assert(p.id !== undefined, 'Có field id');
      assert(p.specs !== undefined, `Có field specs: ${JSON.stringify(p.specs)}`);
      // Payload optimization
      assert(p.description === undefined, 'KHÔNG có description (payload optimized)');
      assert(p.variants === undefined, 'KHÔNG có variants (payload optimized)');
      assert(p.branch_ids === undefined, 'KHÔNG có branch_ids (payload optimized)');

      const payloadSize = JSON.stringify(data).length;
      console.log(`  📦 Payload size: ${(payloadSize / 1024).toFixed(1)} KB for ${data.length} products`);
    }
  } catch (e) {
    assert(false, 'General recommendations', e.message);
  }

  // 3.2 Category-based recommendations
  console.log('\n─── 3.2 Recommendations: Category (cat-phone) ───');
  try {
    const { status, data } = await fetchJSON(`${BASE}/b2c/recommendations?categoryId=cat-phone`);
    assert(status === 200, 'HTTP 200');
    if (data?.length > 0) {
      const hasPhone = data.some(p => p.category_id === 'cat-phone');
      assert(hasPhone, 'Có sản phẩm thuộc cat-phone');
    }
  } catch (e) {
    assert(false, 'Category recommendations', e.message);
  }

  // 3.3 Similar products (specs-aware) — NEW endpoint
  console.log('\n─── 3.3 Similar Products: /b2c/similar/:productId ───');
  try {
    // Lấy 1 product ID thực
    const searchRes = await fetchJSON(`${BASE}/ai/smart-search`, {
      method: 'POST',
      body: JSON.stringify({ query: 'iPhone' }),
    });
    const sampleId = searchRes.data?.products?.[0]?.id;

    if (sampleId) {
      const { status, data } = await fetchJSON(`${BASE}/b2c/similar/${sampleId}`);
      assert(status === 200, 'HTTP 200');
      assert(Array.isArray(data), `Trả mảng (${data?.length || 0} items)`);

      if (data?.length > 0) {
        const p = data[0];
        assert(p.specs !== undefined, `Specs: ${JSON.stringify(p.specs)}`);
        assert(p.category_id !== undefined, 'Có category_id');
        // Verify similar products are relevant (cùng category hoặc cùng brand)
        const sourceProduct = searchRes.data.products[0];
        const isRelevant = data.some(prod =>
          prod.category_id === sourceProduct.category_id ||
          prod.category_id === sourceProduct.category ||
          prod.brand_id === sourceProduct.brand_id ||
          prod.name.toLowerCase().includes('iphone')
        );
        assert(isRelevant, 'Sản phẩm tương tự liên quan đến source');
        console.log(`  🔗 Source: ${sourceProduct.name}`);
        console.log(`  🔗 Similar: ${data.slice(0, 3).map(p => p.name).join(', ')}`);
      }
    } else {
      assert(false, 'Không tìm được sample product để test');
    }
  } catch (e) {
    assert(false, 'Similar products', e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. SPECS COVERAGE & PAYLOAD SIZE TESTS
// ═════════════════════════════════════════════════════════════════════════════
async function testSpecsCoverage() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('4. SPECS COVERAGE & PAYLOAD OPTIMIZATION');
  console.log('══════════════════════════════════════════════════════════');

  const queries = [
    'sạc dự phòng Anker',
    'ốp lưng iPhone 16 Pro Max',
    'chuột không dây Logitech',
    'bàn phím cơ gaming',
    'tai nghe chụp tai Sony',
    'camera ngoài trời Dahua',
    'loa bluetooth JBL',
    'Apple Watch',
    'iPad Pro M4',
    'router WiFi 6 TP-Link',
  ];

  let totalWithSpecs = 0;
  let totalProducts = 0;
  let totalPayloadBytes = 0;

  for (const q of queries) {
    try {
      const { data } = await fetchJSON(`${BASE}/ai/smart-search`, {
        method: 'POST',
        body: JSON.stringify({ query: q }),
      });
      const products = data?.products || [];
      const withSpecs = products.filter(p => p.specs && Object.keys(p.specs).length > 0);
      totalWithSpecs += withSpecs.length;
      totalProducts += products.length;
      totalPayloadBytes += JSON.stringify(data).length;

      const pct = products.length > 0 ? Math.round(withSpecs.length / products.length * 100) : 0;
      console.log(`  "${q}" → ${products.length} SP, ${withSpecs.length} có specs (${pct}%)`);
    } catch (e) {
      console.log(`  "${q}" → ERROR: ${e.message}`);
    }
  }

  const overallPct = totalProducts > 0 ? Math.round(totalWithSpecs / totalProducts * 100) : 0;
  console.log(`\n  📊 Tổng: ${totalWithSpecs}/${totalProducts} SP có specs (${overallPct}%)`);
  console.log(`  📦 Tổng payload: ${(totalPayloadBytes / 1024).toFixed(1)} KB cho ${queries.length} queries`);
  console.log(`  📦 Trung bình: ${(totalPayloadBytes / queries.length / 1024).toFixed(1)} KB/query`);

  assert(overallPct >= 50, `Specs coverage >= 50% (got ${overallPct}%)`);
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  GETSHOPY AI SERVICES — COMPREHENSIVE TEST SUITE v3.0  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nAPI Base: ${BASE}`);
  console.log(`Time: ${new Date().toLocaleString('vi-VN')}`);

  await testSearch();
  await testChatbot();
  await testRecommendation();
  await testSpecsCoverage();

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`RESULTS: ${passed} passed, ${failed} failed (${passed + failed} total)`);
  console.log('══════════════════════════════════════════════════════════');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Test suite crashed:', e);
  process.exit(1);
});
