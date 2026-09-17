#!/usr/bin/env node
'use strict';
/**
 * ============================================================
 * AI TEST RUNNER — Getshopy AI Feature Tests
 * tests/ai-test.js
 * ============================================================
 *
 * Chạy: node tests/ai-test.js
 * Yêu cầu: Docker containers đang chạy (localhost:3000)
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

// ── Helpers ──────────────────────────────────────────────────────────────────

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
  yellow:(s) => `\x1b[33m${s}\x1b[0m`,
  cyan:  (s) => `\x1b[36m${s}\x1b[0m`,
  dim:   (s) => `\x1b[2m${s}\x1b[0m`,
  bold:  (s) => `\x1b[1m${s}\x1b[0m`,
};

let passed = 0, failed = 0, skipped = 0;
const failures = [];

async function post(path, body, timeoutMs = 30_000) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, ok: res.ok };
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function test(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    console.log(`  ${colors.green('✓')} ${name} ${colors.dim(`(${ms}ms)`)}`);
    passed++;
  } catch (err) {
    const ms = Date.now() - start;
    console.log(`  ${colors.red('✗')} ${name} ${colors.dim(`(${ms}ms)`)}`);
    console.log(`    ${colors.red(err.message)}`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

function skip(name, reason) {
  console.log(`  ${colors.yellow('○')} ${name} ${colors.dim(`(skipped: ${reason})`)}`);
  skipped++;
}

function section(title) {
  console.log(`\n${colors.bold(colors.cyan(`━━━ ${title} ━━━`))}`);
}

// ── 1. CHATBOT TEXT TESTS ────────────────────────────────────────────────────

async function chatbotTextTests() {
  section('1. AI CHATBOT — Text (POST /api/b2c/chat)');

  // 1.1 Tìm sản phẩm
  await test('1.1.1 Tìm iPhone 16 Pro Max', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Tìm iPhone 16 Pro Max', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
    assert(data.text.length > 10, `Text too short: "${data.text}"`);
  });

  await test('1.1.2 Laptop gaming dưới 30 triệu', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Laptop gaming dưới 30 triệu', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
    if (data.products?.length > 0) {
      const allUnder30M = data.products.every(p => p.price <= 30_000_000);
      // Soft check — LLM/DB might not have exact match
      if (!allUnder30M) console.log(`    ${colors.yellow('⚠')} Some products > 30M`);
    }
  });

  await test('1.1.3 Tai nghe chống ồn Sony', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Tai nghe chống ồn Sony', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  await test('1.1.4 Sạc dự phòng Anker', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Sạc dự phòng Anker 20000mAh', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  await test('1.1.5 Chuột không dây Logitech', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Chuột không dây Logitech', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  // 1.2 Hỏi giá
  await test('1.2.1 Samsung S24 Ultra giá bao nhiêu?', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Samsung Galaxy S24 Ultra giá bao nhiêu?', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  // 1.3 So sánh
  await test('1.4.1 So sánh iPhone vs Samsung', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'So sánh iPhone 16 vs Samsung S24', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  // 1.4 Gợi ý / Tư vấn
  await test('1.5.1 Tư vấn điện thoại tầm 10 triệu', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Tư vấn điện thoại tầm 10 triệu', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  await test('1.5.2 Laptop nào tốt cho sinh viên', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Mua laptop nào tốt cho sinh viên?', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  // 1.5 Kiểm tra tồn kho
  await test('1.6.1 Còn hàng iPhone 16 không?', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Còn hàng iPhone 16 không?', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  // 1.6 Bán chạy / Mới nhất
  await test('1.7.1 Điện thoại bán chạy nhất', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Điện thoại bán chạy nhất', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  await test('1.7.2 Laptop mới nhất', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Laptop mới nhất', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  // 1.7 Chính sách
  await test('1.8.1 Chính sách đổi trả', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Chính sách đổi trả?', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
    const txt = data.text.toLowerCase();
    assert(txt.includes('đổi') || txt.includes('trả') || txt.includes('bảo hành') || txt.includes('hàng'),
      `Text doesn't mention return policy: "${data.text.slice(0, 100)}"`);
  });

  await test('1.8.2 Giao hàng mất mấy ngày', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Giao hàng mất mấy ngày?', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  await test('1.8.3 Thanh toán bằng cách nào', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Thanh toán bằng cách nào?', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  await test('1.8.4 Theo dõi đơn hàng', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Theo dõi đơn hàng', history: [] });
    assert(ok, 'Response not OK');
    assert(data.link === '/profile' || data.text.includes('đơn hàng'),
      `Expected link=/profile or text mentions order: link=${data.link}`);
  });

  // 1.8 Khuyến mãi & Giá
  await test('1.9.1 Có khuyến mãi gì không?', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Có khuyến mãi gì không?', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  await test('1.9.2 Mắc quá, giảm giá không?', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Mắc quá, có giảm giá không?', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  // 1.9 Camera & Pin
  await test('1.10.1 Camera iPhone 16 Pro Max', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Camera iPhone 16 Pro Max chụp đẹp không?', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  await test('1.10.4 Sạc dự phòng nào tốt?', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Sạc dự phòng nào tốt?', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  // 1.10 Greeting
  await test('1.11.1 Xin chào', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Xin chào', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
    assert(data.text.length > 5, `Greeting too short: "${data.text}"`);
  });

  // 1.11 Follow-up
  await test('1.12.1 Follow-up: "Cho xem đi" sau "Tìm iPhone"', async () => {
    const history = [
      { sender: 'user', text: 'Tìm iPhone 16' },
      { sender: 'bot', text: 'Dạ bên em có iPhone 16...' },
    ];
    const { data, ok } = await post('/api/b2c/chat', { message: 'Cho xem đi', history });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  // 1.12 Edge Cases
  await test('1.13.1 Empty message → 400', async () => {
    const { status } = await post('/api/b2c/chat', { message: '', history: [] });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test('1.13.2 Spaces only → 400', async () => {
    const { status } = await post('/api/b2c/chat', { message: '   ', history: [] });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test('1.13.3 Nonsense input → fallback', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'asdfghjkl zxcvbnm qwerty', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });

  await test('1.13.4 SP không tồn tại → fallback', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Tìm Nokia 1100 chính hãng', history: [] });
    assert(ok, 'Response not OK');
    assert(data.text, 'No text response');
  });
}

// ── 2. SMART SEARCH TEXT TESTS ───────────────────────────────────────────────

async function smartSearchTextTests() {
  section('2. AI SMART SEARCH — Text (POST /api/ai/smart-search)');

  // 2.1 Basic search
  await test('3.1.1 iPhone 16 Pro Max', async () => {
    const { data, ok } = await post('/api/ai/smart-search', { query: 'iPhone 16 Pro Max' });
    assert(ok, 'Response not OK');
    assert(Array.isArray(data.products), 'products is not array');
    assert(data.products.length > 0, 'No products returned');
    assert(data.hint, 'No hint');
  });

  await test('3.1.2 Laptop Asus', async () => {
    const { data, ok } = await post('/api/ai/smart-search', { query: 'Laptop Asus' });
    assert(ok, 'Response not OK');
    assert(data.products?.length > 0, 'No products');
  });

  await test('3.1.3 Tai nghe Bluetooth', async () => {
    const { data, ok } = await post('/api/ai/smart-search', { query: 'Tai nghe Bluetooth' });
    assert(ok, 'Response not OK');
    assert(data.products?.length > 0, 'No products');
  });

  await test('3.1.4 Camera giám sát Dahua', async () => {
    const { data, ok } = await post('/api/ai/smart-search', { query: 'Camera giám sát Dahua' });
    assert(ok, 'Response not OK');
    assert(data.products?.length > 0, 'No products');
  });

  await test('3.1.5 Ốp lưng iPhone 15', async () => {
    const { data, ok } = await post('/api/ai/smart-search', { query: 'Ốp lưng iPhone 15' });
    assert(ok, 'Response not OK');
    assert(data.products?.length > 0, 'No products');
  });

  // 2.2 Price filter
  await test('3.2.1 Điện thoại dưới 10 triệu', async () => {
    const { data, ok } = await post('/api/ai/smart-search', { query: 'Điện thoại dưới 10 triệu' });
    assert(ok, 'Response not OK');
    if (data.products?.length > 0) {
      const overBudget = data.products.filter(p => p.price > 10_000_000);
      if (overBudget.length > 0) {
        console.log(`    ${colors.yellow('⚠')} ${overBudget.length}/${data.products.length} products > 10M`);
      }
    }
  });

  await test('3.2.2 Laptop trên 20 triệu', async () => {
    const { data, ok } = await post('/api/ai/smart-search', { query: 'Laptop trên 20 triệu' });
    assert(ok, 'Response not OK');
    assert(data.products?.length > 0, 'No products');
  });

  await test('3.2.3 Tai nghe tầm 3 triệu', async () => {
    const { data, ok } = await post('/api/ai/smart-search', { query: 'Tai nghe tầm 3 triệu' });
    assert(ok, 'Response not OK');
    assert(data.products?.length > 0, 'No products');
  });

  await test('3.2.5 Sạc dự phòng dưới 500k', async () => {
    const { data, ok } = await post('/api/ai/smart-search', { query: 'Sạc dự phòng dưới 500k' });
    assert(ok, 'Response not OK');
  });

  await test('3.2.6 Điện thoại giá rẻ', async () => {
    const { data, ok } = await post('/api/ai/smart-search', { query: 'Điện thoại giá rẻ' });
    assert(ok, 'Response not OK');
    assert(data.products?.length > 0, 'No products');
  });

  await test('3.2.7 Laptop cao cấp', async () => {
    const { data, ok } = await post('/api/ai/smart-search', { query: 'Laptop cao cấp' });
    assert(ok, 'Response not OK');
    assert(data.products?.length > 0, 'No products');
  });

  // 2.3 Brand + Category combo
  await test('3.3.1 Sạc Anker 20000mAh', async () => {
    const { data, ok } = await post('/api/ai/smart-search', { query: 'Sạc Anker 20000mAh' });
    assert(ok, 'Response not OK');
  });

  await test('3.3.2 Chuột Logitech không dây', async () => {
    const { data, ok } = await post('/api/ai/smart-search', { query: 'Chuột Logitech không dây' });
    assert(ok, 'Response not OK');
  });

  // 2.4 Edge cases
  await test('3.4.1 Empty query → 400', async () => {
    const { status } = await post('/api/ai/smart-search', { query: '' });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test('3.4.2 Nonsense query → fallback', async () => {
    const { data, ok } = await post('/api/ai/smart-search', { query: 'sdfghj xyzabc' });
    assert(ok, 'Response not OK');
    assert(data.products?.length > 0, 'Fallback should return products');
  });
}

// ── 3. VISUAL SEARCH TESTS ──────────────────────────────────────────────────

async function visualSearchTests() {
  section('3. AI VISUAL SEARCH — Image (POST /api/b2c/visual-search)');

  // 3.1 Validation
  await test('4.4.1 null imageBase64 → 400', async () => {
    const { status } = await post('/api/b2c/visual-search', { imageBase64: null });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test('4.4.2 Invalid format → 400', async () => {
    const { status } = await post('/api/b2c/visual-search', { imageBase64: 'abc123' });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  // 3.2 Minimal valid image (1x1 red pixel JPEG)
  // This tests the pipeline works even with tiny images
  const TINY_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=';

  await test('4.1 Minimal JPEG → pipeline runs (Gemini may not recognize)', async () => {
    const { data, ok } = await post('/api/b2c/visual-search', { imageBase64: TINY_JPEG }, 35_000);
    assert(ok || data, 'No response');
    // Gemini may not recognize a 1x1 pixel, but the pipeline should not crash
    if (data) {
      assert(typeof data.text === 'string', 'text should be string');
    }
  });
}

// ── 4. SMART SEARCH IMAGE TESTS ──────────────────────────────────────────────

async function smartSearchImageTests() {
  section('4. AI SMART SEARCH IMAGE — Image+Text (POST /api/ai/smart-search-image)');

  // 4.1 Validation
  await test('5.5.1 null imageBase64 → 400', async () => {
    const { status } = await post('/api/ai/smart-search-image', { query: 'iPhone', imageBase64: null });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test('5.5.2 Invalid image format → 400', async () => {
    const { status } = await post('/api/ai/smart-search-image', { query: 'test', imageBase64: 'not-an-image' });
    assert(status === 400, `Expected 400, got ${status}`);
  });
}

// ── 5. DATA QUALITY TESTS ────────────────────────────────────────────────────

async function dataQualityTests() {
  section('5. DATA QUALITY CHECKS');

  await test('6.3.1 Products no BigInt (JSON safe)', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Điện thoại bán chạy', history: [] });
    assert(ok, 'Response not OK');
    // If response can be JSON serialized, no BigInt issues
    const json = JSON.stringify(data);
    assert(json, 'JSON.stringify failed');
    if (data.products?.length > 0) {
      data.products.forEach(p => {
        assert(typeof p.id === 'number', `id should be number, got ${typeof p.id}`);
        assert(typeof p.price === 'number', `price should be number, got ${typeof p.price}`);
      });
    }
  });

  await test('6.3.2 Products image format valid', async () => {
    const { data, ok } = await post('/api/ai/smart-search', { query: 'Laptop' });
    assert(ok, 'Response not OK');
    if (data.products?.length > 0) {
      data.products.forEach(p => {
        if (p.image) {
          assert(!p.image.startsWith('['), `image should not be JSON array: ${p.image.slice(0, 50)}`);
        }
      });
    }
  });

  await test('6.3.4 Text response is Vietnamese', async () => {
    const { data, ok } = await post('/api/b2c/chat', { message: 'Xin chào', history: [] });
    assert(ok, 'Response not OK');
    // Check for Vietnamese characters
    const hasVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(data.text);
    assert(hasVietnamese, `Text doesn't seem Vietnamese: "${data.text.slice(0, 80)}"`);
  });
}

// ── 6. PERFORMANCE TESTS ─────────────────────────────────────────────────────

async function performanceTests() {
  section('6. PERFORMANCE');

  await test('6.1.1 Chatbot response < 15s', async () => {
    const start = Date.now();
    const { ok } = await post('/api/b2c/chat', { message: 'Tìm điện thoại Samsung', history: [] }, 15_000);
    const ms = Date.now() - start;
    assert(ok, `Response failed or timed out after ${ms}ms`);
    console.log(`    ${colors.dim(`Actual: ${ms}ms`)}`);
  });

  await test('6.1.2 Smart search response < 20s', async () => {
    const start = Date.now();
    const { ok } = await post('/api/ai/smart-search', { query: 'Tai nghe Bluetooth Sony' }, 20_000);
    const ms = Date.now() - start;
    assert(ok, `Response failed or timed out after ${ms}ms`);
    console.log(`    ${colors.dim(`Actual: ${ms}ms`)}`);
  });
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(colors.bold(`\n🧪 Getshopy AI Test Runner`));
  console.log(colors.dim(`   Target: ${BASE_URL}`));
  console.log(colors.dim(`   Time:   ${new Date().toLocaleString('vi-VN')}\n`));

  // Health check
  try {
    const res = await fetch(`${BASE_URL}/api/b2c/categories`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log(colors.green('✓ Server is healthy\n'));
  } catch (err) {
    console.log(colors.red(`✗ Server unreachable: ${err.message}`));
    console.log(colors.dim('  Ensure Docker containers are running: docker compose up -d'));
    process.exit(1);
  }

  await chatbotTextTests();
  await smartSearchTextTests();
  await visualSearchTests();
  await smartSearchImageTests();
  await dataQualityTests();
  await performanceTests();

  // Summary
  console.log(`\n${colors.bold('━━━ SUMMARY ━━━')}`);
  console.log(`  ${colors.green(`✓ Passed:  ${passed}`)}`);
  if (failed > 0) console.log(`  ${colors.red(`✗ Failed:  ${failed}`)}`);
  if (skipped > 0) console.log(`  ${colors.yellow(`○ Skipped: ${skipped}`)}`);
  console.log(`  Total:   ${passed + failed + skipped}`);

  if (failures.length > 0) {
    console.log(`\n${colors.bold(colors.red('Failed Tests:'))}`);
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.name}`);
      console.log(`     ${colors.red(f.error)}`);
    });
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(colors.red(`\nFatal error: ${err.message}`));
  process.exit(1);
});
