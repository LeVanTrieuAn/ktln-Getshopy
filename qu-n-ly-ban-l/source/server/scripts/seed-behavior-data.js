'use strict';
/**
 * ============================================================
 * SEED BEHAVIOR DATA — Generate demo behavioral events
 * scripts/seed-behavior-data.js
 * ============================================================
 *
 * Sinh ~50K user behavior events vào ClickHouse analytics.user_events
 * cho 100 user ảo, mô phỏng hành vi thực tế:
 *
 *   - Browse funnel: 80% product_view, 15% engage, 5% convert
 *   - Realistic dwell time: 3-120 giây (trung bình 30s)
 *   - Scroll depth: 10-100% (trung bình 60%)
 *   - Session-based: mỗi user có 5-20 sessions qua 30 ngày
 *   - Device mix: 60% mobile, 30% desktop, 10% tablet
 *
 * Usage:
 *   node scripts/seed-behavior-data.js
 */

const { createClient } = require('@clickhouse/client');
const { prisma } = require('../src/db');

const ch = createClient({
  url: process.env.CLICKHOUSE_URL || process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  database: 'analytics',
});

// ─── Config ──────────────────────────────────────────────────────
const NUM_USERS = 100;           // Số users ảo
const SESSIONS_PER_USER = [5, 20]; // Min/Max sessions per user
const EVENTS_PER_SESSION = [5, 30]; // Min/Max events per session
const DAYS_BACK = 30;            // Dữ liệu trong 30 ngày gần đây
const BATCH_SIZE = 500;          // Insert batch size

const DEVICE_TYPES = ['mobile', 'mobile', 'mobile', 'mobile', 'mobile', 'mobile', // 60%
                      'desktop', 'desktop', 'desktop',                               // 30%
                      'tablet'];                                                     // 10%

const REFERRERS = ['direct', 'direct', 'search', 'search', 'category', 'recommendation', 'chatbot'];
const PAGE_SOURCES = ['home', 'category', 'search', 'detail'];

const SEARCH_QUERIES = [
  'iphone 16', 'samsung galaxy s25', 'laptop gaming', 'macbook pro m4',
  'tai nghe bluetooth', 'airpods pro', 'chuột gaming', 'bàn phím cơ',
  'sạc nhanh 65w', 'camera giám sát', 'smartwatch', 'loa bluetooth',
  'ipad air', 'laptop dell', 'asus rog', 'ssd 1tb', 'router wifi 6',
  'balo laptop', 'ốp lưng iphone', 'miếng dán cường lực',
  'tai nghe sony', 'xiaomi redmi note', 'oppo reno', 'pixel 9',
];

// ─── Helpers ─────────────────────────────────────────────────────
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
function uuid() { return 'ses_' + Array.from({length: 32}, () => 'abcdef0123456789'[rnd(0,15)]).join(''); }

function randomDate(daysBack) {
  const now = Date.now();
  const offset = Math.random() * daysBack * 24 * 60 * 60 * 1000;
  return new Date(now - offset);
}

function formatDateTime(d) {
  return d.toISOString().replace('T', ' ').substring(0, 23);
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  console.log('🎲 Seed Behavior Data — Generating demo user events...\n');

  // Load random products from DB
  const products = await prisma.product.findMany({
    where: { is_deleted: false },
    select: { id: true, name: true, price: true, category_id: true, brand_id: true },
    take: 2000,
    orderBy: { sold: 'desc' },
  });

  if (products.length === 0) {
    console.error('❌ No products found in DB. Run seed first.');
    process.exit(1);
  }

  console.log(`📦 Loaded ${products.length} products from DB`);

  // Ensure user_events table exists
  try {
    await ch.command({
      query: `
        CREATE TABLE IF NOT EXISTS analytics.user_events (
          event_id String DEFAULT generateUUIDv4(),
          event_type LowCardinality(String),
          session_id String,
          customer_id Nullable(Int64),
          product_id Nullable(Int64),
          category_id Nullable(String),
          brand_id Nullable(String),
          price_at_event Nullable(Decimal(18, 2)),
          dwell_time_ms Nullable(Int32),
          scroll_depth_pct Nullable(Float32),
          quantity Nullable(Int32),
          rating Nullable(Int32),
          search_query Nullable(String),
          result_count Nullable(Int32),
          product_ids Array(Int64) DEFAULT [],
          device_type LowCardinality(String) DEFAULT 'desktop',
          referrer LowCardinality(String) DEFAULT 'direct',
          page_source LowCardinality(String) DEFAULT '',
          event_time DateTime64(3, 'Asia/Ho_Chi_Minh') DEFAULT now(),
          created_at DateTime64(3, 'Asia/Ho_Chi_Minh') DEFAULT now()
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(event_time)
        ORDER BY (event_type, session_id, event_time)
        TTL event_time + INTERVAL 90 DAY
        SETTINGS index_granularity = 8192
      `,
    });
  } catch (e) { /* table already exists */ }

  let totalEvents = 0;
  let buffer = [];

  async function flushBuffer() {
    if (buffer.length === 0) return;
    await ch.insert({
      table: 'analytics.user_events',
      values: buffer,
      format: 'JSONEachRow',
    });
    totalEvents += buffer.length;
    buffer = [];
  }

  // Generate events for each virtual user
  for (let u = 0; u < NUM_USERS; u++) {
    const customerId = u < 20 ? (u + 1) : null; // First 20 users are "logged in"
    const numSessions = rnd(...SESSIONS_PER_USER);
    const deviceType = pick(DEVICE_TYPES);

    // Each user has category/brand preferences (biased browsing)
    const prefCategory = pick(products).category_id;
    const prefBrand = pick(products).brand_id;
    const prefProducts = products.filter(
      p => p.category_id === prefCategory || p.brand_id === prefBrand
    );
    const userPool = prefProducts.length >= 10 ? prefProducts : products.slice(0, 100);

    for (let s = 0; s < numSessions; s++) {
      const sessionId = uuid();
      const numEvents = rnd(...EVENTS_PER_SESSION);
      const sessionStart = randomDate(DAYS_BACK);
      const referrer = pick(REFERRERS);

      let timeOffset = 0;
      const viewedProducts = [];

      for (let e = 0; e < numEvents; e++) {
        const product = pick(userPool);
        const eventTime = new Date(sessionStart.getTime() + timeOffset);

        // Decide event type based on funnel probability
        const roll = Math.random();
        let eventType, eventData;

        if (roll < 0.55) {
          // ── Product View (55% of events) ──────────────────────
          eventType = 'product_view';
          viewedProducts.push(product);
          eventData = {
            product_id: Number(product.id),
            category_id: product.category_id,
            brand_id: product.brand_id,
            price_at_event: product.price,
            dwell_time_ms: rnd(3000, 120000), // 3s - 2min
            scroll_depth_pct: rnd(10, 100),
            page_source: 'detail',
          };
          timeOffset += rnd(5000, 60000); // 5s - 1min between views
        } else if (roll < 0.70) {
          // ── Category View (15% of events) ─────────────────────
          eventType = 'category_view';
          eventData = {
            category_id: product.category_id,
            page_source: 'category',
          };
          timeOffset += rnd(2000, 15000);
        } else if (roll < 0.80) {
          // ── Search Query (10% of events) ──────────────────────
          eventType = 'search_query';
          eventData = {
            search_query: pick(SEARCH_QUERIES),
            result_count: rnd(0, 50),
            page_source: 'search',
          };
          timeOffset += rnd(3000, 20000);
        } else if (roll < 0.88) {
          // ── Add to Cart (8% of events) ────────────────────────
          eventType = 'add_to_cart';
          const p = viewedProducts.length > 0 ? pick(viewedProducts) : product;
          eventData = {
            product_id: Number(p.id),
            category_id: p.category_id,
            brand_id: p.brand_id,
            price_at_event: p.price,
            quantity: rnd(1, 3),
            page_source: 'detail',
          };
          timeOffset += rnd(1000, 5000);
        } else if (roll < 0.93) {
          // ── Add to Wishlist (5% of events) ────────────────────
          eventType = 'add_to_wishlist';
          const p = viewedProducts.length > 0 ? pick(viewedProducts) : product;
          eventData = {
            product_id: Number(p.id),
            category_id: p.category_id,
            brand_id: p.brand_id,
            price_at_event: p.price,
            page_source: 'detail',
          };
          timeOffset += rnd(1000, 3000);
        } else if (roll < 0.97) {
          // ── Purchase (4% of events) ───────────────────────────
          eventType = 'purchase';
          const p = viewedProducts.length > 0 ? pick(viewedProducts) : product;
          eventData = {
            product_id: Number(p.id),
            category_id: p.category_id,
            brand_id: p.brand_id,
            price_at_event: p.price,
            quantity: rnd(1, 2),
            page_source: 'checkout',
          };
          timeOffset += rnd(30000, 120000); // checkout takes longer
        } else {
          // ── Compare View (3% of events) ───────────────────────
          eventType = 'compare_view';
          const compareIds = viewedProducts.length >= 2
            ? viewedProducts.slice(-3).map(p => Number(p.id))
            : [Number(product.id), Number(pick(userPool).id)];
          eventData = {
            product_ids: compareIds,
            page_source: 'compare',
          };
          timeOffset += rnd(5000, 30000);
        }

        const event = {
          event_type: eventType,
          session_id: sessionId,
          customer_id: customerId,
          device_type: deviceType,
          referrer: referrer,
          event_time: formatDateTime(eventTime),
          ...eventData,
        };

        buffer.push(event);

        if (buffer.length >= BATCH_SIZE) {
          await flushBuffer();
          process.stdout.write(`\r  Users: ${u + 1}/${NUM_USERS} | Events: ${totalEvents.toLocaleString()}`);
        }
      }
    }
  }

  // Final flush
  await flushBuffer();

  console.log(`\n\n✅ Seeded ${totalEvents.toLocaleString()} behavior events for ${NUM_USERS} virtual users`);

  // Verify
  const result = await ch.query({
    query: `
      SELECT
        count() AS total,
        uniq(session_id) AS sessions,
        uniq(customer_id) AS customers,
        countIf(event_type = 'product_view') AS views,
        countIf(event_type = 'add_to_cart') AS carts,
        countIf(event_type = 'purchase') AS purchases
      FROM analytics.user_events
    `,
    format: 'JSONEachRow',
  });
  const stats = (await result.json())[0];
  console.log('\n📊 Verification:');
  console.log(`   Total events:   ${Number(stats.total).toLocaleString()}`);
  console.log(`   Sessions:       ${Number(stats.sessions).toLocaleString()}`);
  console.log(`   Customers:      ${Number(stats.customers).toLocaleString()}`);
  console.log(`   Product views:  ${Number(stats.views).toLocaleString()}`);
  console.log(`   Cart adds:      ${Number(stats.carts).toLocaleString()}`);
  console.log(`   Purchases:      ${Number(stats.purchases).toLocaleString()}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
