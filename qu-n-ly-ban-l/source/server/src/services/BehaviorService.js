'use strict';
/**
 * ============================================================
 * BEHAVIOR SERVICE — Getshopy AI User Behavior Tracking v1.0
 * services/BehaviorService.js
 * ============================================================
 *
 * Thu thập & phân tích hành vi người dùng (implicit feedback)
 * phục vụ AI Recommendation cá nhân hóa.
 *
 * 3 tầng Implicit Feedback:
 *   Tầng 1 — Browse:  product_view, category_view, search_query
 *   Tầng 2 — Engage:  add_to_cart, add_to_wishlist, compare_view
 *   Tầng 3 — Convert: purchase, review_submit
 *
 * Chức năng chính:
 *   - trackEvents(): Batch insert events vào ClickHouse
 *   - getUserProfile(): Tổng hợp preference vector từ behavior
 *   - getRecentlyViewed(): Sản phẩm đã xem gần đây
 *   - getTrendingProducts(): Trending theo velocity
 *   - getSimilarUsers(): Collaborative filtering (user-user)
 *   - getPopularByBehavior(): Top sản phẩm theo hành vi, không chỉ sold
 *
 * @module BehaviorService
 */

const { createClient } = require('@clickhouse/client');

// ─────────────────────────────────────────────────────────────────────────────
// CLICKHOUSE CLIENT (shared instance, async_insert for high throughput)
// ─────────────────────────────────────────────────────────────────────────────
const ch = createClient({
  url: process.env.CLICKHOUSE_URL || process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  database: 'analytics',
  clickhouse_settings: {
    async_insert: 1,
    wait_for_async_insert: 0,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

const VALID_EVENT_TYPES = new Set([
  'product_view', 'category_view', 'search_query',
  'add_to_cart', 'remove_from_cart', 'add_to_wishlist',
  'compare_view', 'review_submit',
  'purchase', 'checkout_abandon',
]);

const VALID_DEVICE_TYPES = new Set(['mobile', 'desktop', 'tablet']);
const VALID_REFERRERS = new Set(['direct', 'search', 'chatbot', 'recommendation', 'category', 'flash_sale']);
const VALID_PAGE_SOURCES = new Set(['home', 'category', 'search', 'detail', 'cart', 'checkout', 'wishlist']);

// Trọng số cho mỗi loại event (phục vụ user profiling)
const EVENT_WEIGHTS = {
  product_view: 1,
  category_view: 0.5,
  search_query: 1.5,
  add_to_cart: 3,
  remove_from_cart: -1,
  add_to_wishlist: 2,
  compare_view: 1.5,
  review_submit: 4,
  purchase: 5,
  checkout_abandon: -0.5,
};

// ─────────────────────────────────────────────────────────────────────────────
// EVENT BUFFER — Batch insert (buffer 50 events hoặc flush mỗi 5s)
// ─────────────────────────────────────────────────────────────────────────────
const BUFFER_MAX = 50;
const BUFFER_FLUSH_MS = 5000;

let _eventBuffer = [];
let _flushTimer = null;

function _scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(_flushBuffer, BUFFER_FLUSH_MS);
}

async function _flushBuffer() {
  _flushTimer = null;
  if (_eventBuffer.length === 0) return;

  const batch = _eventBuffer.splice(0);
  try {
    await ch.insert({
      table: 'analytics.user_events',
      values: batch,
      format: 'JSONEachRow',
    });
  } catch (err) {
    console.error('[BehaviorService] ❌ ClickHouse insert failed:', err.message);
    // Dồn lại event vào buffer nếu insert thất bại (tối đa 200 events tránh leak)
    if (_eventBuffer.length < 200) {
      _eventBuffer.push(...batch);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATE & SANITIZE EVENT
// ─────────────────────────────────────────────────────────────────────────────

function _sanitizeEvent(raw) {
  if (!raw || !raw.event_type || !VALID_EVENT_TYPES.has(raw.event_type)) {
    return null;
  }

  return {
    event_type:       raw.event_type,
    session_id:       String(raw.session_id || 'unknown'),
    customer_id:      raw.customer_id ? Number(raw.customer_id) : null,

    // Product context
    product_id:       raw.product_id ? Number(raw.product_id) : null,
    category_id:      raw.category_id || null,
    brand_id:         raw.brand_id || null,
    price_at_event:   raw.price_at_event ? Number(raw.price_at_event) : null,

    // Engagement metrics
    dwell_time_ms:    raw.dwell_time_ms ? Math.min(Number(raw.dwell_time_ms), 600000) : null, // cap 10 min
    scroll_depth_pct: raw.scroll_depth_pct ? Math.min(Math.max(Number(raw.scroll_depth_pct), 0), 100) : null,
    quantity:         raw.quantity ? Math.min(Number(raw.quantity), 100) : null,
    rating:           raw.rating ? Math.min(Math.max(Number(raw.rating), 1), 5) : null,

    // Search context
    search_query:     raw.search_query ? String(raw.search_query).substring(0, 200) : null,
    result_count:     raw.result_count != null ? Number(raw.result_count) : null,

    // Multi-product events
    product_ids:      Array.isArray(raw.product_ids) ? raw.product_ids.map(Number).slice(0, 20) : [],

    // Hidden attributes
    device_type:      VALID_DEVICE_TYPES.has(raw.device_type) ? raw.device_type : 'desktop',
    referrer:         VALID_REFERRERS.has(raw.referrer) ? raw.referrer : 'direct',
    page_source:      VALID_PAGE_SOURCES.has(raw.page_source) ? raw.page_source : '',

    // Timestamp
    event_time:       raw.event_time || new Date().toISOString().replace('T', ' ').substring(0, 23),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Track batch of user events.
 * @param {Array<Object>} events - Mảng raw events từ client
 * @returns {{ accepted: number, rejected: number }}
 */
function trackEvents(events) {
  if (!Array.isArray(events)) return { accepted: 0, rejected: 0 };

  let accepted = 0;
  let rejected = 0;

  for (const raw of events.slice(0, 20)) { // Max 20 events/request
    const sanitized = _sanitizeEvent(raw);
    if (sanitized) {
      _eventBuffer.push(sanitized);
      accepted++;
    } else {
      rejected++;
    }
  }

  if (_eventBuffer.length >= BUFFER_MAX) {
    _flushBuffer();
  } else {
    _scheduleFlush();
  }

  return { accepted, rejected };
}

/**
 * Tổng hợp user preference profile từ behavior data.
 * Trả về: top categories, brands, price range, engagement scores.
 *
 * @param {string} identifier - customer_id hoặc session_id
 * @param {string} identifierType - 'customer' hoặc 'session'
 * @returns {Promise<Object>} User profile
 */
async function getUserProfile(identifier, identifierType = 'session') {
  const filterField = identifierType === 'customer' ? 'customer_id' : 'session_id';
  const filterValue = identifierType === 'customer' ? Number(identifier) : `'${identifier}'`;

  try {
    // ── Top categories bằng weighted events ─────────────────────
    const catRows = await _query(`
      SELECT category_id,
             SUM(CASE event_type
               WHEN 'purchase' THEN 5
               WHEN 'add_to_cart' THEN 3
               WHEN 'add_to_wishlist' THEN 2
               WHEN 'product_view' THEN 1
               ELSE 0.5
             END) AS score
      FROM analytics.user_events
      WHERE ${filterField} = ${filterValue}
        AND category_id IS NOT NULL
        AND event_time >= subtractDays(now(), 30)
      GROUP BY category_id
      ORDER BY score DESC
      LIMIT 5
    `);

    // ── Top brands ──────────────────────────────────────────────
    const brandRows = await _query(`
      SELECT brand_id,
             SUM(CASE event_type
               WHEN 'purchase' THEN 5
               WHEN 'add_to_cart' THEN 3
               WHEN 'add_to_wishlist' THEN 2
               WHEN 'product_view' THEN 1
               ELSE 0.5
             END) AS score
      FROM analytics.user_events
      WHERE ${filterField} = ${filterValue}
        AND brand_id IS NOT NULL
        AND event_time >= subtractDays(now(), 30)
      GROUP BY brand_id
      ORDER BY score DESC
      LIMIT 5
    `);

    // ── Price range preference ──────────────────────────────────
    const priceRows = await _query(`
      SELECT
        avg(price_at_event) AS avg_price,
        min(price_at_event) AS min_price,
        max(price_at_event) AS max_price,
        quantile(0.25)(price_at_event) AS p25,
        quantile(0.75)(price_at_event) AS p75
      FROM analytics.user_events
      WHERE ${filterField} = ${filterValue}
        AND price_at_event IS NOT NULL
        AND price_at_event > 0
        AND event_time >= subtractDays(now(), 30)
    `);

    // ── Top products by engagement score ────────────────────────
    const productRows = await _query(`
      SELECT product_id,
             SUM(CASE event_type
               WHEN 'purchase' THEN 5
               WHEN 'add_to_cart' THEN 3
               WHEN 'add_to_wishlist' THEN 2
               WHEN 'product_view' THEN 1 + (dwell_time_ms / 30000.0)
               ELSE 0.5
             END) AS score
      FROM analytics.user_events
      WHERE ${filterField} = ${filterValue}
        AND product_id IS NOT NULL
        AND event_time >= subtractDays(now(), 30)
      GROUP BY product_id
      ORDER BY score DESC
      LIMIT 20
    `);

    // ── Tổng event count ────────────────────────────────────────
    const countRows = await _query(`
      SELECT count() AS total,
             countIf(event_type = 'product_view') AS views,
             countIf(event_type = 'add_to_cart') AS carts,
             countIf(event_type = 'purchase') AS purchases
      FROM analytics.user_events
      WHERE ${filterField} = ${filterValue}
        AND event_time >= subtractDays(now(), 30)
    `);

    const pricePref = priceRows[0] || {};

    return {
      categories: catRows.map(r => ({ id: r.category_id, score: parseFloat(r.score) })),
      brands: brandRows.map(r => ({ id: r.brand_id, score: parseFloat(r.score) })),
      priceRange: {
        avg: parseFloat(pricePref.avg_price || 0),
        min: parseFloat(pricePref.min_price || 0),
        max: parseFloat(pricePref.max_price || 0),
        p25: parseFloat(pricePref.p25 || 0),
        p75: parseFloat(pricePref.p75 || 0),
      },
      topProducts: productRows.map(r => ({ id: Number(r.product_id), score: parseFloat(r.score) })),
      stats: {
        total: parseInt(countRows[0]?.total || 0),
        views: parseInt(countRows[0]?.views || 0),
        carts: parseInt(countRows[0]?.carts || 0),
        purchases: parseInt(countRows[0]?.purchases || 0),
      },
    };
  } catch (err) {
    console.error('[BehaviorService] getUserProfile error:', err.message);
    return null;
  }
}

/**
 * Sản phẩm đã xem gần đây.
 * @returns {Promise<Array<number>>} Mảng product_ids (mới nhất trước)
 */
async function getRecentlyViewed(sessionId, customerId = null, limit = 10) {
  try {
    const filter = customerId
      ? `(session_id = '${sessionId}' OR customer_id = ${Number(customerId)})`
      : `session_id = '${sessionId}'`;

    const rows = await _query(`
      SELECT DISTINCT product_id, max(event_time) AS last_seen
      FROM analytics.user_events
      WHERE ${filter}
        AND event_type = 'product_view'
        AND product_id IS NOT NULL
        AND event_time >= subtractDays(now(), 7)
      GROUP BY product_id
      ORDER BY last_seen DESC
      LIMIT ${limit}
    `);

    return rows.map(r => Number(r.product_id));
  } catch (err) {
    console.error('[BehaviorService] getRecentlyViewed error:', err.message);
    return [];
  }
}

/**
 * Trending products — dựa trên tốc độ tăng views trong N giờ gần đây.
 * Trending = sản phẩm có nhiều views gần đây nhất (weighted by recency).
 *
 * @param {number} hours - Khoảng thời gian tính trending (mặc định 24h)
 * @param {number} limit - Số lượng trả về
 * @returns {Promise<Array<{product_id: number, score: number}>>}
 */
async function getTrendingProducts(hours = 24, limit = 10) {
  try {
    const rows = await _query(`
      SELECT product_id,
             count() AS view_count,
             uniq(session_id) AS unique_viewers,
             countIf(event_type = 'add_to_cart') AS cart_count,
             -- Trending score: views × unique_viewers + cart_actions × 5
             (count() * uniq(session_id) + countIf(event_type = 'add_to_cart') * 5) AS trend_score
      FROM analytics.user_events
      WHERE event_type IN ('product_view', 'add_to_cart', 'add_to_wishlist')
        AND product_id IS NOT NULL
        AND event_time >= subtractHours(now(), ${hours})
      GROUP BY product_id
      HAVING view_count >= 2
      ORDER BY trend_score DESC
      LIMIT ${limit}
    `);

    return rows.map(r => ({
      product_id: Number(r.product_id),
      score: parseFloat(r.trend_score),
      views: parseInt(r.view_count),
      unique_viewers: parseInt(r.unique_viewers),
      carts: parseInt(r.cart_count),
    }));
  } catch (err) {
    console.error('[BehaviorService] getTrendingProducts error:', err.message);
    return [];
  }
}

/**
 * Collaborative Filtering: Tìm users có hành vi tương tự.
 * Logic: user A xem sản phẩm X, Y, Z → tìm user B cũng xem X, Y → gợi ý Z cho B.
 *
 * @param {string} sessionId
 * @param {number|null} customerId
 * @returns {Promise<Array<number>>} product_ids mà similar users đã tương tác nhưng user hiện tại chưa
 */
async function getCollaborativeRecommendations(sessionId, customerId = null, limit = 8) {
  try {
    const userFilter = customerId
      ? `(session_id = '${sessionId}' OR customer_id = ${Number(customerId)})`
      : `session_id = '${sessionId}'`;

    // Bước 1: Lấy product_ids user hiện tại đã tương tác
    const userProducts = await _query(`
      SELECT DISTINCT product_id
      FROM analytics.user_events
      WHERE ${userFilter}
        AND product_id IS NOT NULL
        AND event_type IN ('product_view', 'add_to_cart', 'purchase', 'add_to_wishlist')
        AND event_time >= subtractDays(now(), 30)
      LIMIT 50
    `);

    if (userProducts.length === 0) return [];

    const userProductIds = userProducts.map(r => Number(r.product_id));
    const productIdList = userProductIds.join(',');

    // Bước 2: Tìm sessions khác cũng xem cùng sản phẩm (similar users)
    const similarSessions = await _query(`
      SELECT session_id,
             count(DISTINCT product_id) AS overlap_count
      FROM analytics.user_events
      WHERE product_id IN (${productIdList})
        AND session_id != '${sessionId}'
        AND event_type IN ('product_view', 'add_to_cart', 'purchase')
        AND event_time >= subtractDays(now(), 14)
      GROUP BY session_id
      HAVING overlap_count >= 2
      ORDER BY overlap_count DESC
      LIMIT 20
    `);

    if (similarSessions.length === 0) return [];

    const sessionIds = similarSessions.map(r => `'${r.session_id}'`).join(',');

    // Bước 3: Lấy sản phẩm mà similar users đã xem/mua nhưng user hiện tại CHƯA
    const recRows = await _query(`
      SELECT product_id,
             SUM(CASE event_type
               WHEN 'purchase' THEN 5
               WHEN 'add_to_cart' THEN 3
               WHEN 'add_to_wishlist' THEN 2
               ELSE 1
             END) AS rec_score
      FROM analytics.user_events
      WHERE session_id IN (${sessionIds})
        AND product_id IS NOT NULL
        AND product_id NOT IN (${productIdList})
        AND event_type IN ('product_view', 'add_to_cart', 'purchase', 'add_to_wishlist')
        AND event_time >= subtractDays(now(), 14)
      GROUP BY product_id
      ORDER BY rec_score DESC
      LIMIT ${limit}
    `);

    return recRows.map(r => Number(r.product_id));
  } catch (err) {
    console.error('[BehaviorService] getCollaborativeRecommendations error:', err.message);
    return [];
  }
}

/**
 * Top sản phẩm phổ biến theo behavioral signals (không chỉ `sold`).
 * Dùng weighted score: purchase × 5 + cart × 3 + wishlist × 2 + view × 1
 */
async function getPopularByBehavior(categoryId = null, limit = 8) {
  try {
    const catFilter = categoryId ? `AND category_id = '${categoryId}'` : '';

    const rows = await _query(`
      SELECT product_id,
             SUM(CASE event_type
               WHEN 'purchase' THEN 5
               WHEN 'add_to_cart' THEN 3
               WHEN 'add_to_wishlist' THEN 2
               WHEN 'product_view' THEN 1
               ELSE 0.5
             END) AS popularity_score,
             uniq(session_id) AS unique_users,
             count() AS total_events
      FROM analytics.user_events
      WHERE product_id IS NOT NULL
        AND event_time >= subtractDays(now(), 7)
        ${catFilter}
      GROUP BY product_id
      ORDER BY popularity_score DESC
      LIMIT ${limit}
    `);

    return rows.map(r => ({
      product_id: Number(r.product_id),
      score: parseFloat(r.popularity_score),
      unique_users: parseInt(r.unique_users),
    }));
  } catch (err) {
    console.error('[BehaviorService] getPopularByBehavior error:', err.message);
    return [];
  }
}

/**
 * Kiểm tra ClickHouse connectivity & event count.
 */
async function getStats() {
  try {
    const rows = await _query(`
      SELECT
        count() AS total_events,
        uniq(session_id) AS unique_sessions,
        uniq(customer_id) AS unique_customers,
        min(event_time) AS earliest,
        max(event_time) AS latest
      FROM analytics.user_events
    `);
    return rows[0] || { total_events: 0 };
  } catch (err) {
    return { error: err.message, total_events: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function _query(sql) {
  const result = await ch.query({ query: sql, format: 'JSONEachRow' });
  return result.json();
}

/** Flush buffer trước khi process exit */
async function shutdown() {
  if (_flushTimer) clearTimeout(_flushTimer);
  await _flushBuffer();
}

module.exports = {
  trackEvents,
  getUserProfile,
  getRecentlyViewed,
  getTrendingProducts,
  getCollaborativeRecommendations,
  getPopularByBehavior,
  getStats,
  shutdown,
  // Expose for testing
  EVENT_WEIGHTS,
};
