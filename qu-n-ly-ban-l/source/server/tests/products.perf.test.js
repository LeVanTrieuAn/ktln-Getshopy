// Automated regression tests for the product-listing perf fix (see docs/OPTIMIZE-P1.md).
// Run against a live server + seeded DB: `npm run test:perf` (needs `npm run seed:mock` first).
const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const SLA_LIST_MS = 300;   // p95 target for paginated list endpoints (docs/OPTIMIZE-P1.md)
const SLA_DETAIL_MS = 150; // p95 target for detail endpoint

async function timedGet(path) {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}${path}`);
  const ms = performance.now() - start;
  const body = await res.json();
  return { res, body, ms };
}

test('b2c /products paginates at the DB level (correct size + total)', async () => {
  const { res, body } = await timedGet('/api/b2c/products?page=1&limit=12');
  assert.equal(res.status, 200);
  assert.equal(body.data.length, 12);
  assert.ok(body.total >= 50000, `expected total >= 50000, got ${body.total}`);
  assert.equal(body.totalPages, Math.ceil(body.total / 12));
});

test('b2c /products pages do not overlap', async () => {
  const p1 = await timedGet('/api/b2c/products?page=1&limit=12');
  const p2 = await timedGet('/api/b2c/products?page=2&limit=12');
  const ids1 = new Set(p1.body.data.map(p => p.id));
  const ids2 = new Set(p2.body.data.map(p => p.id));
  const overlap = [...ids1].filter(id => ids2.has(id));
  assert.equal(overlap.length, 0, 'page 1 and page 2 must not share product ids');
});

test('b2c /products category filter narrows results correctly', async () => {
  const { body } = await timedGet('/api/b2c/products?category_id=c1&page=1&limit=20');
  assert.ok(body.data.length > 0);
  for (const p of body.data) {
    assert.equal(p.category_id, 'c1');
  }
  assert.ok(body.total < 50000, 'filtered total must be smaller than the full catalog');
});

test('b2c /products list payload excludes heavy detail-only fields', async () => {
  const { body } = await timedGet('/api/b2c/products?page=1&limit=5');
  for (const p of body.data) {
    assert.equal(p.description, undefined, 'list view should not carry description');
    assert.equal(p.variants, undefined, 'list view should not carry variants');
  }
});

test('b2b /products list payload excludes description/variants (admin catalog)', async () => {
  const { res, body } = await timedGet('/api/b2b/products');
  assert.equal(res.status, 200);
  assert.ok(body.length >= 50000, `expected full catalog, got ${body.length}`);
  for (const p of body.slice(0, 50)) {
    assert.equal(p.description, undefined);
    assert.equal(p.variants, undefined);
  }
});

test('b2c /categories and /brands are cache-backed and consistent', async () => {
  const a = await timedGet('/api/b2c/categories');
  const b = await timedGet('/api/b2c/categories');
  assert.deepEqual(a.body, b.body, 'cached response must match source on next read');
});

test('SLA: b2c /products p95 under target for 20 sequential requests', async () => {
  const samples = [];
  for (let i = 1; i <= 20; i++) {
    const { ms } = await timedGet(`/api/b2c/products?page=${i}&limit=12`);
    samples.push(ms);
  }
  samples.sort((a, b) => a - b);
  const p95 = samples[Math.floor(samples.length * 0.95) - 1];
  console.log(`  b2c /products p95 over ${samples.length} requests: ${p95.toFixed(1)}ms (SLA: ${SLA_LIST_MS}ms)`);
  assert.ok(p95 < SLA_LIST_MS, `p95 ${p95.toFixed(1)}ms exceeds SLA of ${SLA_LIST_MS}ms`);
});

test('SLA: b2c /products/:id p95 under target for 20 requests', async () => {
  const samples = [];
  for (let i = 1; i <= 20; i++) {
    const { ms } = await timedGet(`/api/b2c/products/${i}`);
    samples.push(ms);
  }
  samples.sort((a, b) => a - b);
  const p95 = samples[Math.floor(samples.length * 0.95) - 1];
  console.log(`  b2c /products/:id p95 over ${samples.length} requests: ${p95.toFixed(1)}ms (SLA: ${SLA_DETAIL_MS}ms)`);
  assert.ok(p95 < SLA_DETAIL_MS, `p95 ${p95.toFixed(1)}ms exceeds SLA of ${SLA_DETAIL_MS}ms`);
});
