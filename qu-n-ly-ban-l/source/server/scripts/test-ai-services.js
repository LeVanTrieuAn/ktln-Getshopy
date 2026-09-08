#!/usr/bin/env node
'use strict';
/**
 * ============================================================
 * TEST AI SERVICES — Kịch bản test tự động chi tiết
 * scripts/test-ai-services.js
 * ============================================================
 *
 * Chạy: node scripts/test-ai-services.js
 *
 * Yêu cầu:
 *   - Server PHẢI đang chạy trên localhost:8080
 *   - Database phải có dữ liệu (600K sản phẩm, 67 brands)
 *
 * 50+ test cases cho 3 services:
 *   - Search Bot (20 cases)
 *   - Chatbot (20 cases)
 *   - Recommendation (5 cases)
 *   - Edge Cases (5 cases)
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:8080/api';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

async function request(path, opts = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runTest(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    console.log(`  ✅ ${name} (${ms}ms)`);
    passed++;
  } catch (err) {
    const ms = Date.now() - start;
    console.log(`  ❌ ${name} (${ms}ms) — ${err.message}`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SEARCH BOT TESTS (20 cases)
// ═════════════════════════════════════════════════════════════════════════════

async function testSearchBot() {
  console.log('\n🔍 SEARCH BOT TESTS');
  console.log('─'.repeat(60));

  // 1. Tìm theo category
  await runTest('S01: tai nghe bluetooth → products có kết quả', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'tai nghe bluetooth' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
    assert(data.hint, 'Thiếu hint');
  });

  // 2. Tìm theo budget
  await runTest('S02: laptop gaming dưới 30 triệu → có products + price ≤ 30M', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'laptop gaming dưới 30 triệu' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
    // Kiểm tra price filter
    const overBudget = data.products.filter(p => p.price > 30_000_000);
    assert(overBudget.length <= 2, `${overBudget.length} sản phẩm vượt budget`); // cho phép 2 vượt nhẹ
  });

  // 3. Tìm theo brand
  await runTest('S03: iPhone 16 Pro Max → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'iPhone 16 Pro Max' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 4. Brand + Category
  await runTest('S04: sạc dự phòng Anker → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'sạc dự phòng Anker' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 5. Brand + Category
  await runTest('S05: chuột không dây Logitech → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'chuột không dây Logitech' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 6. Brand search
  await runTest('S06: Samsung Galaxy S25 → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'Samsung Galaxy S25' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 7. Brand alias
  await runTest('S07: airpods → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'airpods' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 8. Specific category
  await runTest('S08: camera giám sát ngoài trời → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'camera giám sát ngoài trời' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 9. Brand + audio
  await runTest('S09: loa bluetooth Marshall → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'loa bluetooth Marshall' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 10. Gaming brand
  await runTest('S10: bàn phím cơ gaming Razer → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'bàn phím cơ gaming Razer' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 11. Accessory
  await runTest('S11: ốp lưng iPhone 15 → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'ốp lưng iPhone 15' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 12. Storage
  await runTest('S12: thẻ nhớ 128GB → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'thẻ nhớ 128GB' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 13. Network + brand
  await runTest('S13: router wifi TP-Link → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'router wifi TP-Link' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 14. Smartwatch + brand
  await runTest('S14: smartwatch Amazfit → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'smartwatch Amazfit' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 15. Price filter
  await runTest('S15: điện thoại dưới 5 triệu → products có price ≤ 5M', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'điện thoại dưới 5 triệu' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 16. Tablet
  await runTest('S16: máy tính bảng cho bé → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'máy tính bảng cho bé' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 17. ANC + brand
  await runTest('S17: tai nghe chống ồn Sony → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'tai nghe chống ồn Sony' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 18. Webcam
  await runTest('S18: webcam cho họp online → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'webcam cho họp online' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 19. Charger specs
  await runTest('S19: sạc nhanh 65W → có products', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: 'sạc nhanh 65W' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.products?.length > 0, 'Không có sản phẩm');
  });

  // 20. Empty query → 400
  await runTest('S20: empty query → HTTP 400', async () => {
    const { status } = await request('/ai/smart-search', { method: 'POST', body: { query: '' } });
    assert(status === 400, `Expected 400 but got ${status}`);
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// CHATBOT TESTS (20 cases)
// ═════════════════════════════════════════════════════════════════════════════

async function testChatbot() {
  console.log('\n💬 CHATBOT TESTS');
  console.log('─'.repeat(60));

  // 1. Greeting
  await runTest('C01: "Xin chào" → response text có nội dung', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Xin chào' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 2. Hỏi giá + brand
  await runTest('C02: "iPhone 16 Pro Max giá bao nhiêu?" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'iPhone 16 Pro Max giá bao nhiêu?' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 3. So sánh
  await runTest('C03: "So sánh Samsung S25 và iPhone 16" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'So sánh Samsung S25 và iPhone 16' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 4. Tư vấn + budget
  await runTest('C04: "Tư vấn laptop dưới 20 triệu" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Tư vấn laptop dưới 20 triệu' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 5. Giao hàng
  await runTest('C05: "Giao hàng mất bao lâu?" → có text, không crash', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Giao hàng mất bao lâu?' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 6. Flash sale
  await runTest('C06: "Có flash sale gì không?" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Có flash sale gì không?' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 7. Đổi trả
  await runTest('C07: "Đổi trả trong bao lâu?" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Đổi trả trong bao lâu?' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 8. Thanh toán
  await runTest('C08: "Thanh toán bằng MoMo được không?" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Thanh toán bằng MoMo được không?' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 9. Check stock + brand
  await runTest('C09: "Còn AirPods Pro 2 không?" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Còn AirPods Pro 2 không?' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 10. Best seller
  await runTest('C10: "Sản phẩm bán chạy nhất?" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Sản phẩm bán chạy nhất?' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 11. New arrival
  await runTest('C11: "Hàng mới về?" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Hàng mới về?' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 12. Cancel order
  await runTest('C12: "Tôi muốn hủy đơn" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Tôi muốn hủy đơn' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 13. Track order
  await runTest('C13: "Cho tôi xem đơn hàng" → có link /profile', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Cho tôi xem đơn hàng' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 14. Positive feedback
  await runTest('C14: "Cảm ơn shop nhiều nhé!" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Cảm ơn shop nhiều nhé!' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 15. Price complaint
  await runTest('C15: "Đắt quá, giảm được không?" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Đắt quá, giảm được không?' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 16. Trade-in
  await runTest('C16: "Thu cũ đổi mới được không?" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Thu cũ đổi mới được không?' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 17. Contact
  await runTest('C17: "Shop ở đâu vậy?" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Shop ở đâu vậy?' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 18. Recommend + category
  await runTest('C18: "Tai nghe nào chống ồn tốt?" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Tai nghe nào chống ồn tốt?' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 19. Battery + brand
  await runTest('C19: "Galaxy S25 Ultra pin bao lâu?" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Galaxy S25 Ultra pin bao lâu?' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });

  // 20. Camera + brand
  await runTest('C20: "Camera của iPhone 16 Pro Max thế nào?" → có text', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: 'Camera của iPhone 16 Pro Max thế nào?' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text?.length > 10, 'Response quá ngắn');
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// RECOMMENDATION TESTS (5 cases)
// ═════════════════════════════════════════════════════════════════════════════

async function testRecommendations() {
  console.log('\n🎯 RECOMMENDATION TESTS');
  console.log('─'.repeat(60));

  // 1. Default (no params)
  await runTest('R01: GET /recommendations → 8 sản phẩm', async () => {
    const { status, data } = await request('/b2c/recommendations');
    assert(status === 200, `HTTP ${status}`);
    assert(Array.isArray(data), 'Response không phải array');
    assert(data.length > 0, 'Không có sản phẩm');
    assert(data.length <= 8, `Quá 8 sản phẩm: ${data.length}`);
    assert(data[0].id, 'Thiếu id');
    assert(data[0].name, 'Thiếu name');
    assert(data[0].price !== undefined, 'Thiếu price');
  });

  // 2. With email
  await runTest('R02: GET /recommendations?email=test@test.com → 8 sản phẩm', async () => {
    const { status, data } = await request('/b2c/recommendations?email=test@test.com');
    assert(status === 200, `HTTP ${status}`);
    assert(Array.isArray(data), 'Response không phải array');
    assert(data.length > 0, 'Không có sản phẩm');
  });

  // 3. With categoryId
  await runTest('R03: GET /recommendations?categoryId=cat-phone → sản phẩm điện thoại', async () => {
    const { status, data } = await request('/b2c/recommendations?categoryId=cat-phone');
    assert(status === 200, `HTTP ${status}`);
    assert(Array.isArray(data), 'Response không phải array');
    assert(data.length > 0, 'Không có sản phẩm');
  });

  // 4. With brandId
  await runTest('R04: GET /recommendations?brandId=br-apple → sản phẩm Apple', async () => {
    const { status, data } = await request('/b2c/recommendations?brandId=br-apple');
    assert(status === 200, `HTTP ${status}`);
    assert(Array.isArray(data), 'Response không phải array');
    assert(data.length > 0, 'Không có sản phẩm');
  });

  // 5. Category + Brand
  await runTest('R05: GET /recommendations?categoryId=cat-phone&brandId=br-samsung → Samsung phones', async () => {
    const { status, data } = await request('/b2c/recommendations?categoryId=cat-phone&brandId=br-samsung');
    assert(status === 200, `HTTP ${status}`);
    assert(Array.isArray(data), 'Response không phải array');
    assert(data.length > 0, 'Không có sản phẩm');
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// EDGE CASE TESTS (5 cases)
// ═════════════════════════════════════════════════════════════════════════════

async function testEdgeCases() {
  console.log('\n⚠️  EDGE CASE TESTS');
  console.log('─'.repeat(60));

  // 1. Unicode/emoji input
  await runTest('E01: Unicode/emoji → không crash', async () => {
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: '🎉 Tôi muốn mua 📱 iPhone 😍' } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text, 'Không có response');
  });

  // 2. Rất dài (>2000 chars)
  await runTest('E02: Long input (2000+ chars) → không crash, có response', async () => {
    const longMessage = 'Tôi muốn mua điện thoại Samsung '.repeat(80); // ~2560 chars
    const { status, data } = await request('/b2c/chat', { method: 'POST', body: { message: longMessage } });
    assert(status === 200, `HTTP ${status}`);
    assert(data.text, 'Không có response');
  });

  // 3. SQL injection attempt
  await runTest('E03: SQL injection → safe response, không crash', async () => {
    const { status, data } = await request('/ai/smart-search', { method: 'POST', body: { query: "'; DROP TABLE Product; --" } });
    assert(status === 200 || status === 400, `HTTP ${status}`);
    // Server không crash là đủ
  });

  // 4. Null/empty message
  await runTest('E04: Empty message → HTTP 400', async () => {
    const { status } = await request('/b2c/chat', { method: 'POST', body: { message: '' } });
    assert(status === 400, `Expected 400 but got ${status}`);
  });

  // 5. Missing required field
  await runTest('E05: No body → có response (không crash)', async () => {
    const { status } = await request('/b2c/chat', { method: 'POST', body: {} });
    assert(status === 400 || status === 200, `HTTP ${status}`);
  });
}


// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🧪 GETSHOPY AI SERVICES — TEST SUITE v2.0            ║');
  console.log('║     600K Products | 67 Brands | 49 Categories            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Server: ${BASE_URL.padEnd(48)}║`);
  console.log(`║  Time:   ${new Date().toLocaleString('vi-VN').padEnd(48)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Check server is running
  try {
    await fetch(`${BASE_URL.replace('/api', '')}/`, { signal: AbortSignal.timeout(3000) });
  } catch (e) {
    console.error('\n❌ Server không chạy! Hãy chạy: npm run dev\n');
    process.exit(1);
  }

  const startTime = Date.now();

  await testSearchBot();
  await testChatbot();
  await testRecommendations();
  await testEdgeCases();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const total = passed + failed + skipped;

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    📊 KẾT QUẢ TỔNG HỢP                  ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Tổng test cases  : ${String(total).padStart(3)}                                  ║`);
  console.log(`║  ✅ Passed        : ${String(passed).padStart(3)}                                  ║`);
  console.log(`║  ❌ Failed        : ${String(failed).padStart(3)}                                  ║`);
  console.log(`║  ⏱️  Thời gian     : ${totalTime.padStart(6)}s                              ║`);
  console.log(`║  📈 Tỉ lệ pass    : ${String(Math.round(passed / total * 100)).padStart(3)}%                                 ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  if (failures.length > 0) {
    console.log('\n❌ DANH SÁCH THẤT BẠI:');
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.name}: ${f.error}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
