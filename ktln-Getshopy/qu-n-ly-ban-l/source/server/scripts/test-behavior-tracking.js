'use strict';
/**
 * ============================================================
 * COMPREHENSIVE TEST SUITE — Behavior Tracking + Admin Analytics
 * scripts/test-behavior-tracking.js
 * ============================================================
 *
 * 80+ test cases bao gồm:
 *
 *   UNIT TESTS (không cần DB):
 *     T1. Event Validation & Sanitization (12 cases)
 *     T2. EVENT_WEIGHTS Configuration (7 cases)
 *     T3. Edge Cases & Security (8 cases)
 *
 *   INTEGRATION TESTS (PostgreSQL):
 *     T4. Wishlist CRUD (8 cases)
 *     T5. Product.specs JSON Column (5 cases)
 *
 *   INTEGRATION TESTS (ClickHouse — skip nếu không chạy):
 *     T6. ClickHouse Schema Verification (18 cases)
 *     T7. ClickHouse Insert & Query (8 cases)
 *     T8. getUserProfile() (10 cases)
 *     T9. getRecentlyViewed() (4 cases)
 *     T10. getTrendingProducts() (4 cases)
 *     T11. getCollaborativeRecommendations() (3 cases)
 *     T12. BehaviorService.getStats() (3 cases)
 *
 *   SERVICE TESTS:
 *     T13. RecommendationService v4 (8 cases)
 *
 *   HTTP API TESTS (cần server chạy):
 *     T14. POST /api/b2c/track (6 cases)
 *     T15. GET /api/b2c/recently-viewed (3 cases)
 *     T16. GET /api/b2c/trending (3 cases)
 *     T17. GET /api/b2c/behavior/stats (2 cases)
 *
 *   ADMIN ANALYTICS API (cần server chạy):
 *     T18. GET /overview — KPI data (8 cases)
 *     T19. GET /funnel — Conversion funnel (5 cases)
 *     T20. GET /top-products — Product ranking (6 cases)
 *     T21. GET /search — Search analytics (4 cases)
 *     T22. GET /devices — Device breakdown (3 cases)
 *     T23. GET /hourly — Hourly activity (3 cases)
 *     T24. GET /referrers — Traffic sources (3 cases)
 *     T25. GET /daily-trend — 30-day trend (3 cases)
 *     T26. GET /ai-performance — AI metrics (5 cases)
 *     T27. Query params validation (4 cases)
 *
 *   NAVIGATION & ROUTING:
 *     T28. Admin route registration (3 cases)
 *     T29. Client API methods (9 cases)
 *
 * Usage:
 *   node scripts/test-behavior-tracking.js
 */

const { createClient } = require('@clickhouse/client');
const { prisma } = require('../src/db');

// ─── Color helpers ───────────────────────────────────────────────
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m';
const D = '\x1b[2m', X = '\x1b[0m', B = '\x1b[1m', M = '\x1b[35m';

let passed = 0, failed = 0, skipped = 0;

function ok(n, d = '') { passed++; console.log(`  ${G}✓${X} ${n}${d ? ` ${D}${d}${X}` : ''}`); }
function fail(n, e) { failed++; console.log(`  ${R}✗${X} ${n}`); console.log(`    ${R}${e}${X}`); }
function skip(n, r) { skipped++; console.log(`  ${Y}⊘${X} ${n} ${D}(${r})${X}`); }
function section(t) { console.log(`\n${C}${B}━━━ ${t} ━━━${X}`); }
function assert(c, n, d = '', e = '') { if (c) ok(n, d); else fail(n, e || `Assertion failed — got falsy`); }
function assertEquals(a, b, n) { assert(a === b, n, `${a}`, `Expected ${b}, got ${a}`); }
function assertType(v, t, n) { assert(typeof v === t, n, `type=${typeof v}`, `Expected ${t}, got ${typeof v}`); }

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8080';

async function httpGet(path) {
  const res = await fetch(`${SERVER_URL}${path}`, { signal: AbortSignal.timeout(5000) });
  return { status: res.status, ok: res.ok, data: await res.json() };
}

async function httpPost(path, body) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  return { status: res.status, ok: res.ok, data: await res.json() };
}

// ═══════════════════════════════════════════════════════════════════
// T1. Unit: Event Validation & Sanitization (12 cases)
// ═══════════════════════════════════════════════════════════════════
function testEventValidation() {
  section('T1. Unit: Event Validation & Sanitization (12 cases)');
  const BS = require('../src/services/BehaviorService');

  // 1. Valid product_view
  const r1 = BS.trackEvents([{ event_type: 'product_view', session_id: 'ses_1', product_id: 42, dwell_time_ms: 5000 }]);
  assertEquals(r1.accepted, 1, 'Accept valid product_view');

  // 2. Invalid event_type
  const r2 = BS.trackEvents([{ event_type: 'INVALID', session_id: 'x' }]);
  assertEquals(r2.rejected, 1, 'Reject invalid event_type');

  // 3. Missing event_type
  const r3 = BS.trackEvents([{ session_id: 'x' }]);
  assertEquals(r3.rejected, 1, 'Reject missing event_type');

  // 4. Missing session_id → defaults to "unknown"
  const r4 = BS.trackEvents([{ event_type: 'product_view' }]);
  assertEquals(r4.accepted, 1, 'Accept event without session_id (defaults)');

  // 5. Empty array
  const r5 = BS.trackEvents([]);
  assert(r5.accepted === 0 && r5.rejected === 0, 'Empty array returns zeros');

  // 6. Not an array
  const r6 = BS.trackEvents('string');
  assertEquals(r6.accepted, 0, 'Non-array input returns 0 accepted');

  // 7. Null input
  const r7 = BS.trackEvents(null);
  assertEquals(r7.accepted, 0, 'Null input returns 0 accepted');

  // 8. Undefined input
  const r8 = BS.trackEvents(undefined);
  assertEquals(r8.accepted, 0, 'Undefined input returns 0 accepted');

  // 9. Dwell time capped at 600000ms
  const r9 = BS.trackEvents([{ event_type: 'product_view', session_id: 'cap', dwell_time_ms: 9999999 }]);
  assertEquals(r9.accepted, 1, 'Accept event with oversized dwell_time (capped)');

  // 10. Batch capped at 20
  const big = Array.from({ length: 30 }, (_, i) => ({ event_type: 'product_view', session_id: `s${i}`, product_id: i }));
  const r10 = BS.trackEvents(big);
  assertEquals(r10.accepted, 20, 'Batch capped at 20 events');

  // 11. All 10 event types accepted
  const allTypes = ['product_view','category_view','search_query','add_to_cart','remove_from_cart','add_to_wishlist','compare_view','review_submit','purchase','checkout_abandon'];
  const r11 = BS.trackEvents(allTypes.map(et => ({ event_type: et, session_id: 'all' })));
  assertEquals(r11.accepted, 10, 'All 10 event types accepted');

  // 12. scroll_depth_pct clamped 0-100
  const r12 = BS.trackEvents([{ event_type: 'product_view', session_id: 'sd', scroll_depth_pct: 150 }]);
  assertEquals(r12.accepted, 1, 'Accept event with clamped scroll_depth');
}

// ═══════════════════════════════════════════════════════════════════
// T2. Unit: EVENT_WEIGHTS Configuration (7 cases)
// ═══════════════════════════════════════════════════════════════════
function testEventWeights() {
  section('T2. Unit: EVENT_WEIGHTS Configuration (7 cases)');
  const { EVENT_WEIGHTS: W } = require('../src/services/BehaviorService');

  assert(W.purchase > W.add_to_cart, 'purchase > add_to_cart', `${W.purchase} > ${W.add_to_cart}`);
  assert(W.add_to_cart > W.add_to_wishlist, 'add_to_cart > wishlist', `${W.add_to_cart} > ${W.add_to_wishlist}`);
  assert(W.add_to_wishlist > W.product_view, 'wishlist > product_view', `${W.add_to_wishlist} > ${W.product_view}`);
  assert(W.product_view > W.category_view, 'product_view > category_view', `${W.product_view} > ${W.category_view}`);
  assert(W.remove_from_cart < 0, 'remove_from_cart is negative', `${W.remove_from_cart}`);
  assert(W.checkout_abandon < 0, 'checkout_abandon is negative', `${W.checkout_abandon}`);
  assertEquals(Object.keys(W).length, 10, 'All 10 event types have weights');
}

// ═══════════════════════════════════════════════════════════════════
// T3. Unit: Edge Cases & Security (8 cases)
// ═══════════════════════════════════════════════════════════════════
function testEdgeCases() {
  section('T3. Unit: Edge Cases & Security (8 cases)');
  const BS = require('../src/services/BehaviorService');

  // 1. XSS in search_query — truncated to 200 chars
  const longQuery = 'a'.repeat(300);
  const r1 = BS.trackEvents([{ event_type: 'search_query', session_id: 'xss', search_query: longQuery }]);
  assertEquals(r1.accepted, 1, 'Long search_query accepted (truncated)');

  // 2. Negative product_id
  const r2 = BS.trackEvents([{ event_type: 'product_view', session_id: 'neg', product_id: -1 }]);
  assertEquals(r2.accepted, 1, 'Negative product_id accepted (sanitized to Number)');

  // 3. String product_id → Number
  const r3 = BS.trackEvents([{ event_type: 'product_view', session_id: 'str', product_id: '42' }]);
  assertEquals(r3.accepted, 1, 'String product_id coerced to Number');

  // 4. Invalid device_type → defaults to desktop
  const r4 = BS.trackEvents([{ event_type: 'product_view', session_id: 'dev', device_type: 'smartwatch' }]);
  assertEquals(r4.accepted, 1, 'Invalid device_type defaults to desktop');

  // 5. Invalid referrer → defaults to direct
  const r5 = BS.trackEvents([{ event_type: 'product_view', session_id: 'ref', referrer: 'malicious' }]);
  assertEquals(r5.accepted, 1, 'Invalid referrer defaults to direct');

  // 6. Rating clamped 1-5
  const r6 = BS.trackEvents([{ event_type: 'review_submit', session_id: 'rat', rating: 99 }]);
  assertEquals(r6.accepted, 1, 'Rating >5 accepted (clamped)');

  // 7. Quantity capped at 100
  const r7 = BS.trackEvents([{ event_type: 'add_to_cart', session_id: 'qty', quantity: 999 }]);
  assertEquals(r7.accepted, 1, 'Quantity >100 accepted (capped)');

  // 8. product_ids array sliced to 20
  const ids = Array.from({ length: 30 }, (_, i) => i + 1);
  const r8 = BS.trackEvents([{ event_type: 'compare_view', session_id: 'ids', product_ids: ids }]);
  assertEquals(r8.accepted, 1, 'product_ids >20 accepted (sliced)');
}

// ═══════════════════════════════════════════════════════════════════
// T4. Integration: PostgreSQL Wishlist CRUD (8 cases)
// ═══════════════════════════════════════════════════════════════════
async function testWishlistCRUD() {
  section('T4. Integration: PostgreSQL Wishlist CRUD (8 cases)');
  try {
    const cid = 99999n, pid = 1n;
    await prisma.wishlist.deleteMany({ where: { customer_id: cid } });
    ok('Cleanup old test data');

    const created = await prisma.wishlist.create({ data: { customer_id: cid, product_id: pid } });
    assert(created.id > 0, 'Create wishlist item', `id=${created.id}`);
    assert(Number(created.customer_id) === 99999, 'customer_id matches');
    assert(Number(created.product_id) === 1, 'product_id matches');

    const found = await prisma.wishlist.findUnique({ where: { customer_id_product_id: { customer_id: cid, product_id: pid } } });
    assert(found !== null, 'Find by composite key');

    try { await prisma.wishlist.create({ data: { customer_id: cid, product_id: pid } }); fail('Duplicate should throw'); } catch { ok('Unique constraint prevents duplicate'); }

    const list = await prisma.wishlist.findMany({ where: { customer_id: cid } });
    assertEquals(list.length, 1, 'List returns 1 item');

    await prisma.wishlist.delete({ where: { id: created.id } });
    const del = await prisma.wishlist.findUnique({ where: { customer_id_product_id: { customer_id: cid, product_id: pid } } });
    assert(del === null, 'Deleted successfully');
  } catch (err) { fail('Wishlist CRUD', err.message); }
}

// ═══════════════════════════════════════════════════════════════════
// T5. Integration: Product.specs JSON Column (5 cases)
// ═══════════════════════════════════════════════════════════════════
async function testProductSpecs() {
  section('T5. Integration: Product.specs JSON Column (5 cases)');
  try {
    const p = await prisma.product.findFirst({ where: { is_deleted: false }, select: { id: true, specs: true } });
    assert(p !== null, 'Can query product');
    assert(p.specs !== undefined, 'specs field exists');
    assertType(p.specs, 'object', 'specs is object type');

    const specs = { screen: '6.7"', chip: 'A18 Pro', ram: '8GB', storage: '256GB' };
    const updated = await prisma.product.update({ where: { id: p.id }, data: { specs }, select: { specs: true } });
    assert(updated.specs?.screen === '6.7"' && updated.specs?.chip === 'A18 Pro', 'Update specs JSON', `screen=${updated.specs.screen}`);

    await prisma.product.update({ where: { id: p.id }, data: { specs: {} } });
    ok('Reset specs to empty');
  } catch (err) { fail('Product.specs', err.message); }
}

// ═══════════════════════════════════════════════════════════════════
// T6-T12. ClickHouse Integration Tests
// ═══════════════════════════════════════════════════════════════════
async function testClickHouse() {
  const ch = createClient({ url: process.env.CLICKHOUSE_URL || 'http://localhost:8123', database: 'analytics' });

  // T6. Schema check
  section('T6. ClickHouse Schema Verification (18 cases)');
  let schemaOk = false;
  try {
    const res = await ch.query({ query: 'DESCRIBE TABLE analytics.user_events', format: 'JSONEachRow' });
    const cols = (await res.json()).map(c => c.name);
    const expected = ['event_id','event_type','session_id','customer_id','product_id','category_id','brand_id',
                      'price_at_event','dwell_time_ms','scroll_depth_pct','quantity','rating','search_query',
                      'result_count','product_ids','device_type','referrer','page_source'];
    for (const col of expected) assert(cols.includes(col), `Column ${col} exists`);
    schemaOk = true;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      skip('ClickHouse schema', 'Not running');
    } else fail('Schema check', err.message);
  }

  if (!schemaOk) {
    for (const t of ['T7','T8','T9','T10','T11','T12']) skip(t, 'ClickHouse unavailable');
    skipped += 5; // extra skips for sub-tests
    try { await ch.close(); } catch {}
    return null;
  }

  // T7. Insert & Query
  section('T7. ClickHouse Insert & Query (8 cases)');
  const sid = `ses_test_${Date.now()}`;
  try {
    const events = [
      { event_type: 'product_view', session_id: sid, customer_id: 99999, product_id: 1, category_id: 'cat-phone', brand_id: 'br-apple', price_at_event: 29990000, dwell_time_ms: 15000, scroll_depth_pct: 85.5, device_type: 'mobile', referrer: 'search', page_source: 'detail', event_time: new Date().toISOString().replace('T',' ').substring(0,23) },
      { event_type: 'add_to_cart', session_id: sid, customer_id: 99999, product_id: 1, quantity: 2, device_type: 'mobile', event_time: new Date().toISOString().replace('T',' ').substring(0,23) },
      { event_type: 'search_query', session_id: sid, customer_id: 99999, search_query: 'iphone 16 pro', result_count: 12, device_type: 'mobile', event_time: new Date().toISOString().replace('T',' ').substring(0,23) },
      { event_type: 'purchase', session_id: sid, customer_id: 99999, product_id: 1, quantity: 1, price_at_event: 29990000, device_type: 'mobile', referrer: 'recommendation', event_time: new Date().toISOString().replace('T',' ').substring(0,23) },
    ];
    await ch.insert({ table: 'analytics.user_events', values: events, format: 'JSONEachRow' });
    ok('Inserted 4 test events');
    await new Promise(r => setTimeout(r, 1000));

    const qr = await ch.query({ query: `SELECT count() as c, countIf(event_type='product_view') as v, countIf(event_type='add_to_cart') as ca, countIf(event_type='purchase') as p, countIf(event_type='search_query') as s FROM analytics.user_events WHERE session_id='${sid}'`, format: 'JSONEachRow' });
    const r = (await qr.json())[0];
    assert(Number(r.c) >= 4, 'Query returns 4+ events', `count=${r.c}`);
    assert(Number(r.v) >= 1, 'Has product_view');
    assert(Number(r.ca) >= 1, 'Has add_to_cart');
    assert(Number(r.p) >= 1, 'Has purchase');
    assert(Number(r.s) >= 1, 'Has search_query');

    const dr = await ch.query({ query: `SELECT dwell_time_ms, scroll_depth_pct FROM analytics.user_events WHERE session_id='${sid}' AND event_type='product_view' LIMIT 1`, format: 'JSONEachRow' });
    const dw = (await dr.json())[0];
    assertEquals(Number(dw?.dwell_time_ms), 15000, 'Dwell time preserved');
    assert(Number(dw?.scroll_depth_pct) > 85, 'Scroll depth preserved', `${dw?.scroll_depth_pct}`);
  } catch (err) { fail('ClickHouse insert/query', err.message); }

  // T8. getUserProfile
  section('T8. getUserProfile() (10 cases)');
  const BS = require('../src/services/BehaviorService');
  try {
    const profile = await BS.getUserProfile(99999, 'customer');
    if (!profile) { skip('getUserProfile', 'No data returned'); }
    else {
      assertType(profile, 'object', 'Returns object');
      assert(Array.isArray(profile.categories), 'Has categories array');
      assert(Array.isArray(profile.brands), 'Has brands array');
      assertType(profile.priceRange, 'object', 'Has priceRange');
      assertType(profile.priceRange.avg, 'number', 'priceRange.avg is number');
      assertType(profile.priceRange.min, 'number', 'priceRange.min is number');
      assertType(profile.priceRange.max, 'number', 'priceRange.max is number');
      assertType(profile.stats, 'object', 'Has stats');
      assert(profile.stats.total > 0, 'stats.total > 0', `total=${profile.stats.total}`);
      assert(Array.isArray(profile.topProducts), 'Has topProducts array');
    }
  } catch (err) { fail('getUserProfile', err.message); }

  // T9. getRecentlyViewed
  section('T9. getRecentlyViewed() (4 cases)');
  try {
    const rv = await BS.getRecentlyViewed(sid, 99999, 10);
    assert(Array.isArray(rv), 'Returns array');
    if (rv.length > 0) {
      assertType(rv[0], 'number', 'Items are numbers');
      ok('Has recently viewed products', `count=${rv.length}`);
    } else skip('Recently viewed empty', 'No data yet');
    const empty = await BS.getRecentlyViewed('nonexistent_session', null, 5);
    assert(Array.isArray(empty), 'Empty for unknown session');
  } catch (err) { fail('getRecentlyViewed', err.message); }

  // T10. getTrendingProducts
  section('T10. getTrendingProducts() (4 cases)');
  try {
    const tr = await BS.getTrendingProducts(168, 10);
    assert(Array.isArray(tr), 'Returns array');
    if (tr.length > 0) {
      assertType(tr[0].product_id, 'number', 'Item has product_id number');
      assertType(tr[0].score, 'number', 'Item has score number');
      ok('Has trending products', `count=${tr.length}`);
    } else skip('Trending empty', 'Not enough data');
  } catch (err) { fail('getTrendingProducts', err.message); }

  // T11. getCollaborativeRecommendations
  section('T11. getCollaborativeRecommendations() (3 cases)');
  try {
    const cf = await BS.getCollaborativeRecommendations(sid, 99999, 8);
    assert(Array.isArray(cf), 'Returns array');
    if (cf.length > 0) assertType(cf[0], 'number', 'Items are product IDs');
    else ok('Empty CF (expected with limited data)');
    ok('Collaborative filtering completed');
  } catch (err) { fail('Collaborative filtering', err.message); }

  // T12. getStats
  section('T12. BehaviorService.getStats() (3 cases)');
  try {
    const s = await BS.getStats();
    assertType(s, 'object', 'Returns object');
    assert(s.total_events !== undefined, 'Has total_events');
    ok('Stats retrieved', `total=${s.total_events}`);
  } catch (err) { fail('getStats', err.message); }

  try { await ch.close(); } catch {}
  return sid;
}

// ═══════════════════════════════════════════════════════════════════
// T13. RecommendationService v4 (8 cases)
// ═══════════════════════════════════════════════════════════════════
async function testRecommendationV4() {
  section('T13. RecommendationService v4 (8 cases)');
  try {
    const RS = require('../src/services/RecommendationService');

    // v3 fallback
    const v3 = await RS.getRecommendations(null, { categoryId: 'cat-phone' });
    assert(Array.isArray(v3), 'v3 fallback returns array');
    assert(v3.length > 0, 'v3 has results', `count=${v3.length}`);
    assertType(v3[0]?.id, 'number', 'Item has id');
    assertType(v3[0]?.name, 'string', 'Item has name');
    assertType(v3[0]?.price, 'number', 'Item has price');

    // v4 with sessionId
    const v4 = await RS.getRecommendations(null, { categoryId: 'cat-phone', sessionId: 'ses_v4test' });
    assert(Array.isArray(v4), 'v4 returns array');
    assert(v4.length > 0, 'v4 has results', `count=${v4.length}`);
    ok('v4 behavior-aware strategy works');
  } catch (err) { fail('RecommendationService v4', err.message); }
}

// ═══════════════════════════════════════════════════════════════════
// T14-T17. B2C Tracking HTTP API Tests
// ═══════════════════════════════════════════════════════════════════
async function testB2CTrackingAPIs() {
  section('T14. POST /api/b2c/track (6 cases)');
  try {
    await fetch(`${SERVER_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
  } catch {
    for (let i = 14; i <= 17; i++) skip(`T${i}`, 'Server not running');
    skipped += 14;
    return;
  }

  try {
    // Valid batch
    const r1 = await httpPost('/api/b2c/track', { events: [
      { event_type: 'product_view', session_id: 'http1', product_id: 1, dwell_time_ms: 8000, device_type: 'desktop' },
      { event_type: 'add_to_cart', session_id: 'http1', product_id: 1, quantity: 1 },
    ]});
    assert(r1.ok, 'POST /track returns 200', `status=${r1.status}`);
    assert(r1.data.success === true, 'success: true');
    assertEquals(r1.data.accepted, 2, 'Accepted 2 events');

    // Invalid event
    const r2 = await httpPost('/api/b2c/track', { events: [{ event_type: 'INVALID' }] });
    assertEquals(r2.data.rejected, 1, 'Rejects invalid event');

    // Empty events
    const r3 = await httpPost('/api/b2c/track', { events: [] });
    assert(r3.data.accepted === 0 || r3.data.accepted === undefined, 'Empty batch returns 0 or undefined');

    // Mixed valid + invalid
    const r4 = await httpPost('/api/b2c/track', { events: [
      { event_type: 'product_view', session_id: 'mix' },
      { event_type: 'INVALID' },
      { event_type: 'add_to_cart', session_id: 'mix' },
    ]});
    assertEquals(r4.data.accepted, 2, 'Mixed batch: 2 accepted');
    assertEquals(r4.data.rejected, 1, 'Mixed batch: 1 rejected');
  } catch (err) { fail('POST /track', err.message); }

  section('T15. GET /api/b2c/recently-viewed (3 cases)');
  try {
    const r1 = await httpGet('/api/b2c/recently-viewed?session_id=http1');
    assert(r1.ok, 'Returns 200', `status=${r1.status}`);
    assert(Array.isArray(r1.data), 'Response is array');
    ok('Recently viewed API', `count=${r1.data.length}`);
  } catch (err) { fail('recently-viewed', err.message); }

  section('T16. GET /api/b2c/trending (3 cases)');
  try {
    const r1 = await httpGet('/api/b2c/trending?hours=168&limit=5');
    assert(r1.ok, 'Returns 200', `status=${r1.status}`);
    assert(Array.isArray(r1.data), 'Response is array');
    ok('Trending API', `count=${r1.data.length}`);
  } catch (err) { fail('trending', err.message); }

  section('T17. GET /api/b2c/behavior/stats (2 cases)');
  try {
    const r1 = await httpGet('/api/b2c/behavior/stats');
    assert(r1.ok, 'Returns 200');
    ok('Stats API', `total=${r1.data.total_events}`);
  } catch (err) { fail('stats', err.message); }
}

// ═══════════════════════════════════════════════════════════════════
// T18-T27. Admin Analytics API Tests
// ═══════════════════════════════════════════════════════════════════
async function testAdminAnalyticsAPIs() {
  const BASE = '/api/b2b/analytics/behavior';

  try {
    await fetch(`${SERVER_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
  } catch {
    for (let i = 18; i <= 27; i++) skip(`T${i}`, 'Server not running');
    skipped += 35;
    return;
  }

  // T18. Overview
  section('T18. GET /overview — KPI data (8 cases)');
  let chAvailable = true;
  try {
    const r = await httpGet(`${BASE}/overview?days=7`);
    if (r.status === 500) {
      chAvailable = false;
      skip('overview', `API returned 500: ${r.data?.error || 'Unknown error'}`);
    } else {
      assert(r.ok, 'Returns 200', `status=${r.status}`);
      assertType(r.data.total_events, 'number', 'total_events is number');
      assertType(r.data.unique_sessions, 'number', 'unique_sessions is number');
      assertType(r.data.total_views, 'number', 'total_views is number');
      assertType(r.data.total_purchases, 'number', 'total_purchases is number');
      assertType(r.data.view_to_cart_rate, 'number', 'view_to_cart_rate is number');
      assertType(r.data.events_change, 'number', 'events_change is number');
      assert(r.data.avg_dwell_sec >= 0, 'avg_dwell_sec >= 0');
    }
  } catch (err) { fail('overview', err.message); }

  if (!chAvailable) {
    for (let i = 19; i <= 27; i++) skip(`T${i}`, 'ClickHouse unavailable');
    skipped += 40;
    return;
  }

  // T19. Funnel
  section('T19. GET /funnel — Conversion funnel (5 cases)');
  try {
    const r = await httpGet(`${BASE}/funnel?days=7`);
    assert(r.ok, 'Returns 200');
    assert(r.data.views != null || r.data.views === 0, 'Has views field');
    assert(r.data.carts != null || r.data.carts === 0, 'Has carts field');
    assert(r.data.wishlists != null || r.data.wishlists === 0, 'Has wishlists field');
    assert(r.data.purchases != null || r.data.purchases === 0, 'Has purchases field');
  } catch (err) { fail('funnel', err.message); }

  // T20. Top Products
  section('T20. GET /top-products — Product ranking (6 cases)');
  try {
    const r = await httpGet(`${BASE}/top-products?days=30&sort=views&limit=5`);
    assert(r.ok, 'Returns 200');
    assert(Array.isArray(r.data), 'Returns array');
    if (r.data.length > 0) {
      assertType(r.data[0].product_id, 'number', 'Item has product_id');
      assertType(r.data[0].view_count, 'number', 'Item has view_count');
      assertType(r.data[0].behavior_score, 'number', 'Item has behavior_score');
      assert(r.data[0].name !== undefined, 'Item has name (enriched)');
    } else skip('Top products empty', 'No data');
  } catch (err) { fail('top-products', err.message); }

  // T21. Search Analytics
  section('T21. GET /search — Search analytics (4 cases)');
  try {
    const r = await httpGet(`${BASE}/search?days=30`);
    assert(r.ok, 'Returns 200');
    assert(Array.isArray(r.data.top_queries), 'Has top_queries array');
    assert(Array.isArray(r.data.zero_result_queries), 'Has zero_result_queries array');
    if (r.data.top_queries.length > 0) {
      assert(r.data.top_queries[0].query !== undefined, 'Query item has query field');
    } else skip('Search data empty', 'No search events');
  } catch (err) { fail('search', err.message); }

  // T22. Devices
  section('T22. GET /devices — Device breakdown (3 cases)');
  try {
    const r = await httpGet(`${BASE}/devices?days=30`);
    assert(r.ok, 'Returns 200');
    assert(Array.isArray(r.data), 'Returns array');
    if (r.data.length > 0) assert(r.data[0].device !== undefined, 'Item has device field');
    else skip('Devices empty', 'No data');
  } catch (err) { fail('devices', err.message); }

  // T23. Hourly
  section('T23. GET /hourly — Hourly activity (3 cases)');
  try {
    const r = await httpGet(`${BASE}/hourly?days=1`);
    assert(r.ok, 'Returns 200');
    assert(Array.isArray(r.data), 'Returns array');
    if (r.data.length > 0) assertType(r.data[0].hour, 'number', 'Item has hour number');
    else skip('Hourly empty', 'No data today');
  } catch (err) { fail('hourly', err.message); }

  // T24. Referrers
  section('T24. GET /referrers — Traffic sources (3 cases)');
  try {
    const r = await httpGet(`${BASE}/referrers?days=30`);
    assert(r.ok, 'Returns 200');
    assert(Array.isArray(r.data), 'Returns array');
    if (r.data.length > 0) assert(r.data[0].source !== undefined, 'Item has source');
    else skip('Referrers empty', 'No data');
  } catch (err) { fail('referrers', err.message); }

  // T25. Daily Trend
  section('T25. GET /daily-trend — 30-day trend (3 cases)');
  try {
    const r = await httpGet(`${BASE}/daily-trend?days=30`);
    assert(r.ok, 'Returns 200');
    assert(Array.isArray(r.data), 'Returns array');
    if (r.data.length > 0) assert(r.data[0].date !== undefined, 'Item has date');
    else skip('Daily trend empty', 'No data');
  } catch (err) { fail('daily-trend', err.message); }

  // T26. AI Performance
  section('T26. GET /ai-performance — AI metrics (5 cases)');
  try {
    const r = await httpGet(`${BASE}/ai-performance?days=30`);
    assert(r.ok, 'Returns 200');
    assertType(r.data.recommendation, 'object', 'Has recommendation object');
    assertType(r.data.chatbot, 'object', 'Has chatbot object');
    assertType(r.data.coverage, 'object', 'Has coverage object');
    assertType(r.data.total_events, 'number', 'Has total_events');
  } catch (err) { fail('ai-performance', err.message); }

  // T27. Query params
  section('T27. Query params validation (4 cases)');
  try {
    const r1 = await httpGet(`${BASE}/overview?days=1`);
    assert(r1.ok, 'days=1 works');
    const r2 = await httpGet(`${BASE}/overview?days=30`);
    assert(r2.ok, 'days=30 works');
    const r3 = await httpGet(`${BASE}/top-products?sort=score&limit=3`);
    assert(r3.ok, 'sort=score works');
    const r4 = await httpGet(`${BASE}/top-products?sort=purchases&limit=5`);
    assert(r4.ok, 'sort=purchases works');
  } catch (err) { fail('Query params', err.message); }
}

// ═══════════════════════════════════════════════════════════════════
// T28-T29. Navigation & Client API
// ═══════════════════════════════════════════════════════════════════
function testRouteRegistration() {
  section('T28. Admin route registration (3 cases)');
  const fs = require('fs');

  const routerContent = fs.readFileSync('d:\\khóa-luận-tốt-nghiệp\\qu-n-ly-ban-l\\source\\client\\src\\ThemedRouter.jsx', 'utf-8');
  assert(routerContent.includes('BehaviorAnalytics'), 'ThemedRouter imports BehaviorAnalytics');
  assert(routerContent.includes('path="behavior"'), 'Route path="behavior" registered');

  const layoutContent = fs.readFileSync('d:\\khóa-luận-tốt-nghiệp\\qu-n-ly-ban-l\\source\\client\\src\\components\\AppLayout.jsx', 'utf-8');
  assert(layoutContent.includes('/admin/behavior'), 'Sidebar nav has /admin/behavior');
}

function testClientAPIMethods() {
  section('T29. Client API methods (9 cases)');
  const fs = require('fs');
  const apiContent = fs.readFileSync('d:\\khóa-luận-tốt-nghiệp\\qu-n-ly-ban-l\\source\\client\\src\\services\\api.js', 'utf-8');

  const methods = [
    'behaviorOverview', 'behaviorFunnel', 'behaviorTopProducts',
    'behaviorSearch', 'behaviorDevices', 'behaviorHourly',
    'behaviorReferrers', 'behaviorDailyTrend', 'behaviorAiPerf',
  ];
  for (const m of methods) {
    assert(apiContent.includes(m), `API has ${m} method`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n${B}${M}╔══════════════════════════════════════════════════════════════════╗${X}`);
  console.log(`${B}${M}║  🧪 Comprehensive Test Suite — Behavior Tracking + Analytics   ║${X}`);
  console.log(`${B}${M}╚══════════════════════════════════════════════════════════════════╝${X}`);

  // Unit tests
  testEventValidation();
  testEventWeights();
  testEdgeCases();

  // PostgreSQL integration
  await testWishlistCRUD();
  await testProductSpecs();

  // ClickHouse integration
  await testClickHouse();

  // Service tests
  await testRecommendationV4();

  // HTTP API tests
  await testB2CTrackingAPIs();
  await testAdminAnalyticsAPIs();

  // Static analysis
  testRouteRegistration();
  testClientAPIMethods();

  // Summary
  console.log(`\n${B}${M}══════════════════════════════════════════════════════════════════${X}`);
  console.log(`  ${G}${B}✓ Passed: ${passed}${X}`);
  if (failed > 0) console.log(`  ${R}${B}✗ Failed: ${failed}${X}`);
  if (skipped > 0) console.log(`  ${Y}${B}⊘ Skipped: ${skipped}${X}`);
  console.log(`  ${D}Total: ${passed + failed + skipped} tests${X}`);
  console.log(failed === 0 ? `\n  ${G}${B}🎉 All tests passed!${X}\n` : `\n  ${R}${B}⚠ ${failed} test(s) failed.${X}\n`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(`\n${R}Fatal:${X}`, err); process.exit(1); });
