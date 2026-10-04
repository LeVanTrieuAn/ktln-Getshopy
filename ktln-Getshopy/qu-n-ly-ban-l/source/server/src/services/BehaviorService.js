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
  // Ô "Dành riêng cho bạn": món nào ĐƯỢC HIỂN THỊ và món nào ĐƯỢC BẤM. Thiếu hai
  // loại này thì không đo được CTR online, và không tách được lượt xem do chính
  // hệ gợi ý gây ra — train lại trên các lượt xem đó là vòng tự củng cố.
  'rec_impression', 'rec_click',
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
  rec_impression: 0,   // được hiển thị ≠ quan tâm
  rec_click: 1,
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
      // event_time gửi dạng ISO có hậu tố 'Z'. Không có best_effort, ClickHouse
      // đọc chuỗi ngày giờ theo múi của CỘT (Asia/Ho_Chi_Minh) nên giờ UTC bị
      // hiểu thành giờ Việt Nam — lệch 7 tiếng.
      clickhouse_settings: { date_time_input_format: 'best_effort' },
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

/**
 * @param {Object} raw        - event do client gửi
 * @param {number|null} customerId - LẤY TỪ TOKEN ở tầng route. customer_id trong
 *   body bị bỏ qua: client tự khai thì ai cũng ghi được hành vi dưới tên khách
 *   khác, và đó là dữ liệu AI-Rec sẽ train (đầu độc dữ liệu).
 */
function _sanitizeEvent(raw, customerId = null) {
  if (!raw || !raw.event_type || !VALID_EVENT_TYPES.has(raw.event_type)) {
    return null;
  }

  return {
    event_type:       raw.event_type,
    session_id:       String(raw.session_id || 'unknown').substring(0, 64),
    customer_id:      customerId ? Number(customerId) : null,

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

    // Giờ server lúc nhận, KHÔNG dùng giờ client: client đặt được giờ tuỳ ý (lùi
    // ngày để lách time-decay), và đồng hồ máy khách có thể lệch. Client gom tối
    // đa 5 giây mới gửi nên sai số chỉ vài giây.
    event_time:       new Date().toISOString(),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Track batch of user events.
 * @param {Array<Object>} events - Mảng raw events từ client
 * @param {{customerId?: number|null}} identity - danh tính lấy từ token (route)
 * @returns {{ accepted: number, rejected: number }}
 */
function trackEvents(events, { customerId = null } = {}) {
  if (!Array.isArray(events)) return { accepted: 0, rejected: 0 };

  let accepted = 0;
  let rejected = 0;

  for (const raw of events.slice(0, 20)) { // Max 20 events/request
    const sanitized = _sanitizeEvent(raw, customerId);
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
  const isCustomer = identifierType === 'customer';
  const where = isCustomer ? 'customer_id = {id:Int64}' : 'session_id = {id:String}';
  const params = { id: isCustomer ? _int(identifier, 0, Number.MAX_SAFE_INTEGER, 0) : String(identifier) };
  const q = (sql) => _query(sql, params);

  try {
    // ── Top categories bằng weighted events ─────────────────────
    const catRows = await q(`
      SELECT category_id,
             SUM(CASE event_type
               WHEN 'purchase' THEN 5
               WHEN 'add_to_cart' THEN 3
               WHEN 'add_to_wishlist' THEN 2
               WHEN 'product_view' THEN 1
               ELSE 0.5
             END) AS score
      FROM analytics.user_events
      WHERE ${where}
        AND category_id IS NOT NULL
        AND event_time >= subtractDays(now(), 30)
      GROUP BY category_id
      ORDER BY score DESC
      LIMIT 5
    `);

    // ── Top brands ──────────────────────────────────────────────
    const brandRows = await q(`
      SELECT brand_id,
             SUM(CASE event_type
               WHEN 'purchase' THEN 5
               WHEN 'add_to_cart' THEN 3
               WHEN 'add_to_wishlist' THEN 2
               WHEN 'product_view' THEN 1
               ELSE 0.5
             END) AS score
      FROM analytics.user_events
      WHERE ${where}
        AND brand_id IS NOT NULL
        AND event_time >= subtractDays(now(), 30)
      GROUP BY brand_id
      ORDER BY score DESC
      LIMIT 5
    `);

    // ── Price range preference ──────────────────────────────────
    const priceRows = await q(`
      SELECT
        avg(price_at_event) AS avg_price,
        min(price_at_event) AS min_price,
        max(price_at_event) AS max_price,
        quantile(0.25)(price_at_event) AS p25,
        quantile(0.75)(price_at_event) AS p75
      FROM analytics.user_events
      WHERE ${where}
        AND price_at_event IS NOT NULL
        AND price_at_event > 0
        AND event_time >= subtractDays(now(), 30)
    `);

    // ── Top products by engagement score ────────────────────────
    const productRows = await q(`
      SELECT product_id,
             SUM(CASE event_type
               WHEN 'purchase' THEN 5
               WHEN 'add_to_cart' THEN 3
               WHEN 'add_to_wishlist' THEN 2
               WHEN 'product_view' THEN 1 + (dwell_time_ms / 30000.0)
               ELSE 0.5
             END) AS score
      FROM analytics.user_events
      WHERE ${where}
        AND product_id IS NOT NULL
        AND event_time >= subtractDays(now(), 30)
      GROUP BY product_id
      ORDER BY score DESC
      LIMIT 20
    `);

    // ── Tổng event count ────────────────────────────────────────
    const countRows = await q(`
      SELECT count() AS total,
             countIf(event_type = 'product_view') AS views,
             countIf(event_type = 'add_to_cart') AS carts,
             countIf(event_type = 'purchase') AS purchases
      FROM analytics.user_events
      WHERE ${where}
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
      ? '(session_id = {sid:String} OR customer_id = {cid:Int64})'
      : 'session_id = {sid:String}';
    const params = { sid: String(sessionId), cid: _int(customerId, 0, Number.MAX_SAFE_INTEGER, 0) };

    const rows = await _query(`
      SELECT DISTINCT product_id, max(event_time) AS last_seen
      FROM analytics.user_events
      WHERE ${filter}
        AND event_type = 'product_view'
        AND product_id IS NOT NULL
        AND event_time >= subtractDays(now(), 7)
      GROUP BY product_id
      ORDER BY last_seen DESC
      LIMIT ${_int(limit, 1, 50, 10)}
    `, params);

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
        AND event_time >= subtractHours(now(), ${_int(hours, 1, 168, 24)})
      GROUP BY product_id
      HAVING view_count >= 2
      ORDER BY trend_score DESC
      LIMIT ${_int(limit, 1, 50, 10)}
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
      ? '(session_id = {sid:String} OR customer_id = {cid:Int64})'
      : 'session_id = {sid:String}';
    const sid = String(sessionId);
    const cid = _int(customerId, 0, Number.MAX_SAFE_INTEGER, 0);

    // Bước 1: Lấy product_ids user hiện tại đã tương tác
    const userProducts = await _query(`
      SELECT DISTINCT product_id
      FROM analytics.user_events
      WHERE ${userFilter}
        AND product_id IS NOT NULL
        AND event_type IN ('product_view', 'add_to_cart', 'purchase', 'add_to_wishlist')
        AND event_time >= subtractDays(now(), 30)
      LIMIT 50
    `, { sid, cid });

    if (userProducts.length === 0) return [];

    const pids = userProducts.map(r => Number(r.product_id));

    // Bước 2: Tìm sessions khác cũng xem cùng sản phẩm (similar users)
    const similarSessions = await _query(`
      SELECT session_id,
             count(DISTINCT product_id) AS overlap_count
      FROM analytics.user_events
      WHERE has({pids:Array(Int64)}, product_id)
        AND session_id != {sid:String}
        AND event_type IN ('product_view', 'add_to_cart', 'purchase')
        AND event_time >= subtractDays(now(), 14)
      GROUP BY session_id
      HAVING overlap_count >= 2
      ORDER BY overlap_count DESC
      LIMIT 20
    `, { pids, sid });

    if (similarSessions.length === 0) return [];

    // session_id đọc từ bảng cũng do client ghi vào -> vẫn phải đi qua tham số,
    // nối chuỗi ở đây là SQL injection bậc hai.
    const sids = similarSessions.map(r => String(r.session_id));

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
      WHERE has({sids:Array(String)}, session_id)
        AND product_id IS NOT NULL
        AND NOT has({pids:Array(Int64)}, product_id)
        AND event_type IN ('product_view', 'add_to_cart', 'purchase', 'add_to_wishlist')
        AND event_time >= subtractDays(now(), 14)
      GROUP BY product_id
      ORDER BY rec_score DESC
      LIMIT ${_int(limit, 1, 50, 8)}
    `, { sids, pids });

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
    const catFilter = categoryId ? 'AND category_id = {cat:String}' : '';

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
      LIMIT ${_int(limit, 1, 50, 8)}
    `, { cat: String(categoryId || '') });

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

/**
 * Mọi giá trị do người dùng đưa vào PHẢI đi qua `params` ({name:Type} trong SQL):
 * ClickHouse tự thoát ký tự. Nối chuỗi vào SQL là SQL injection — trước 01/10
 * session_id ở /recently-viewed đi thẳng vào câu truy vấn.
 */
async function _query(sql, params = {}) {
  const result = await ch.query({ query: sql, format: 'JSONEachRow', query_params: params });
  return result.json();
}

/** Số nguyên trong [lo, hi]; không hợp lệ -> def. Chỉ số đã qua đây mới được chèn thẳng vào SQL. */
function _int(value, lo, hi, def) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : def;
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
