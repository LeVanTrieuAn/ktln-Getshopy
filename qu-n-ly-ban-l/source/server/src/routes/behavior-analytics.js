'use strict';
/**
 * ============================================================
 * B2B BEHAVIOR ANALYTICS ROUTES — Admin Dashboard Data
 * routes/behavior-analytics.js
 * ============================================================
 *
 * Endpoints phục vụ trang Behavior Analytics trên Admin:
 *
 *   GET /api/b2b/analytics/behavior/overview     — KPIs tổng quan
 *   GET /api/b2b/analytics/behavior/funnel        — Funnel View→Cart→Purchase
 *   GET /api/b2b/analytics/behavior/top-products  — Top sản phẩm theo behavior
 *   GET /api/b2b/analytics/behavior/search        — Search analytics
 *   GET /api/b2b/analytics/behavior/devices       — Device breakdown
 *   GET /api/b2b/analytics/behavior/hourly        — Events theo giờ
 *   GET /api/b2b/analytics/behavior/referrers     — Referrer sources
 *   GET /api/b2b/analytics/behavior/ai-performance— AI Recommendation performance
 *
 * @module routes/behavior-analytics
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@clickhouse/client');
const { prisma } = require('../db');

const ch = createClient({
  url: process.env.CLICKHOUSE_URL || process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
  database: 'analytics',
});

async function query(sql) {
  try {
    const result = await ch.query({ query: sql, format: 'JSONEachRow' });
    return await result.json();
  } catch (err) {
    console.error('[BehaviorAnalytics] ClickHouse query error:', err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /overview — KPIs tổng quan
// ─────────────────────────────────────────────────────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    // Current period
    const current = await query(`
      SELECT
        count()                                          AS total_events,
        uniq(session_id)                                 AS unique_sessions,
        uniqIf(customer_id, customer_id IS NOT NULL)     AS unique_customers,
        countIf(event_type = 'product_view')             AS total_views,
        countIf(event_type = 'add_to_cart')              AS total_carts,
        countIf(event_type = 'purchase')                 AS total_purchases,
        countIf(event_type = 'search_query')             AS total_searches,
        countIf(event_type = 'add_to_wishlist')          AS total_wishlists,
        avgIf(dwell_time_ms, dwell_time_ms > 0) / 1000  AS avg_dwell_sec,
        avgIf(scroll_depth_pct, scroll_depth_pct > 0)    AS avg_scroll_pct
      FROM analytics.user_events
      WHERE event_time >= subtractDays(now(), ${Number(days)})
    `);

    // Previous period (for comparison)
    const previous = await query(`
      SELECT
        count()                              AS total_events,
        uniq(session_id)                     AS unique_sessions,
        countIf(event_type = 'product_view') AS total_views,
        countIf(event_type = 'purchase')     AS total_purchases
      FROM analytics.user_events
      WHERE event_time >= subtractDays(now(), ${Number(days) * 2})
        AND event_time < subtractDays(now(), ${Number(days)})
    `);

    const c = current[0] || {};
    const p = previous[0] || {};

    const pctChange = (curr, prev) => {
      const cVal = Number(curr || 0);
      const pVal = Number(prev || 0);
      if (pVal === 0) return cVal > 0 ? 100 : 0;
      return Math.round(((cVal - pVal) / pVal) * 100);
    };

    res.json({
      total_events:     Number(c.total_events || 0),
      unique_sessions:  Number(c.unique_sessions || 0),
      unique_customers: Number(c.unique_customers || 0),
      total_views:      Number(c.total_views || 0),
      total_carts:      Number(c.total_carts || 0),
      total_purchases:  Number(c.total_purchases || 0),
      total_searches:   Number(c.total_searches || 0),
      total_wishlists:  Number(c.total_wishlists || 0),
      avg_dwell_sec:    Math.round(Number(c.avg_dwell_sec || 0)),
      avg_scroll_pct:   Math.round(Number(c.avg_scroll_pct || 0)),
      // Conversion rates
      view_to_cart_rate:     Number(c.total_views) > 0 ? Math.round((Number(c.total_carts) / Number(c.total_views)) * 10000) / 100 : 0,
      cart_to_purchase_rate: Number(c.total_carts) > 0 ? Math.round((Number(c.total_purchases) / Number(c.total_carts)) * 10000) / 100 : 0,
      overall_conversion:    Number(c.total_views) > 0 ? Math.round((Number(c.total_purchases) / Number(c.total_views)) * 10000) / 100 : 0,
      // Changes
      events_change:    pctChange(c.total_events, p.total_events),
      sessions_change:  pctChange(c.unique_sessions, p.unique_sessions),
      views_change:     pctChange(c.total_views, p.total_views),
      purchases_change: pctChange(c.total_purchases, p.total_purchases),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /funnel — Funnel conversion data
// ─────────────────────────────────────────────────────────────────────────────
router.get('/funnel', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const rows = await query(`
      SELECT
        countIf(event_type = 'product_view')    AS views,
        countIf(event_type = 'add_to_cart')     AS carts,
        countIf(event_type = 'add_to_wishlist') AS wishlists,
        countIf(event_type = 'purchase')        AS purchases,
        uniqIf(session_id, event_type = 'product_view')    AS view_sessions,
        uniqIf(session_id, event_type = 'add_to_cart')     AS cart_sessions,
        uniqIf(session_id, event_type = 'purchase')        AS purchase_sessions
      FROM analytics.user_events
      WHERE event_time >= subtractDays(now(), ${Number(days)})
    `);
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /top-products — Top sản phẩm theo hành vi
// ─────────────────────────────────────────────────────────────────────────────
router.get('/top-products', async (req, res) => {
  try {
    const { days = 7, limit = 10, sort = 'views' } = req.query;

    const orderCol = sort === 'carts' ? 'cart_count'
                   : sort === 'purchases' ? 'purchase_count'
                   : sort === 'score' ? 'behavior_score'
                   : 'view_count';

    const rows = await query(`
      SELECT
        product_id,
        countIf(event_type = 'product_view')    AS view_count,
        countIf(event_type = 'add_to_cart')     AS cart_count,
        countIf(event_type = 'purchase')        AS purchase_count,
        countIf(event_type = 'add_to_wishlist') AS wishlist_count,
        uniq(session_id)                        AS unique_visitors,
        avgIf(dwell_time_ms, dwell_time_ms > 0) / 1000 AS avg_dwell_sec,
        avgIf(scroll_depth_pct, scroll_depth_pct > 0)   AS avg_scroll_pct,
        (countIf(event_type = 'purchase') * 5 +
         countIf(event_type = 'add_to_cart') * 3 +
         countIf(event_type = 'add_to_wishlist') * 2 +
         countIf(event_type = 'product_view') * 1) AS behavior_score
      FROM analytics.user_events
      WHERE product_id IS NOT NULL
        AND event_time >= subtractDays(now(), ${Number(days)})
      GROUP BY product_id
      ORDER BY ${orderCol} DESC
      LIMIT ${Math.min(Number(limit), 50)}
    `);

    // Enrich with product name
    if (rows.length > 0) {
      const productIds = rows.map(r => BigInt(r.product_id));
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, image: true, price: true, category_id: true },
      });
      const pMap = new Map(products.map(p => [Number(p.id), p]));

      const enriched = rows.map(r => {
        const p = pMap.get(Number(r.product_id));
        return {
          product_id: Number(r.product_id),
          name: p?.name || `Product #${r.product_id}`,
          image: p?.image || null,
          price: p ? Number(p.price) : 0,
          category_id: p?.category_id || null,
          view_count: Number(r.view_count),
          cart_count: Number(r.cart_count),
          purchase_count: Number(r.purchase_count),
          wishlist_count: Number(r.wishlist_count),
          unique_visitors: Number(r.unique_visitors),
          avg_dwell_sec: Math.round(Number(r.avg_dwell_sec || 0)),
          avg_scroll_pct: Math.round(Number(r.avg_scroll_pct || 0)),
          behavior_score: Number(r.behavior_score),
          view_to_cart: Number(r.view_count) > 0
            ? Math.round((Number(r.cart_count) / Number(r.view_count)) * 10000) / 100 : 0,
        };
      });
      return res.json(enriched);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /search — Search analytics (top queries, zero-results)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const topQueries = await query(`
      SELECT
        search_query,
        count() AS search_count,
        avgIf(result_count, result_count IS NOT NULL) AS avg_results,
        countIf(result_count = 0) AS zero_results
      FROM analytics.user_events
      WHERE event_type = 'search_query'
        AND search_query IS NOT NULL
        AND search_query != ''
        AND event_time >= subtractDays(now(), ${Number(days)})
      GROUP BY search_query
      ORDER BY search_count DESC
      LIMIT 20
    `);

    const zeroResultQueries = await query(`
      SELECT search_query, count() AS count
      FROM analytics.user_events
      WHERE event_type = 'search_query'
        AND result_count = 0
        AND search_query IS NOT NULL
        AND event_time >= subtractDays(now(), ${Number(days)})
      GROUP BY search_query
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({
      top_queries: topQueries.map(r => ({
        query: r.search_query,
        count: Number(r.search_count),
        avg_results: Math.round(Number(r.avg_results || 0)),
        zero_results: Number(r.zero_results),
      })),
      zero_result_queries: zeroResultQueries.map(r => ({
        query: r.search_query,
        count: Number(r.count),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /devices — Device type breakdown
// ─────────────────────────────────────────────────────────────────────────────
router.get('/devices', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const rows = await query(`
      SELECT
        device_type,
        count()            AS event_count,
        uniq(session_id)   AS sessions,
        countIf(event_type = 'purchase') AS purchases
      FROM analytics.user_events
      WHERE event_time >= subtractDays(now(), ${Number(days)})
      GROUP BY device_type
      ORDER BY event_count DESC
    `);
    res.json(rows.map(r => ({
      device: r.device_type || 'unknown',
      events: Number(r.event_count),
      sessions: Number(r.sessions),
      purchases: Number(r.purchases),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /hourly — Events theo giờ (24h)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/hourly', async (req, res) => {
  try {
    const { days = 1 } = req.query;
    const rows = await query(`
      SELECT
        toHour(event_time) AS hour,
        count()            AS events,
        countIf(event_type = 'product_view')    AS views,
        countIf(event_type = 'add_to_cart')     AS carts,
        countIf(event_type = 'purchase')        AS purchases,
        uniq(session_id)                        AS sessions
      FROM analytics.user_events
      WHERE event_time >= subtractDays(now(), ${Number(days)})
      GROUP BY hour
      ORDER BY hour
    `);
    res.json(rows.map(r => ({
      hour: Number(r.hour),
      events: Number(r.events),
      views: Number(r.views),
      carts: Number(r.carts),
      purchases: Number(r.purchases),
      sessions: Number(r.sessions),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /referrers — Traffic source breakdown
// ─────────────────────────────────────────────────────────────────────────────
router.get('/referrers', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const rows = await query(`
      SELECT
        referrer,
        count()            AS events,
        uniq(session_id)   AS sessions,
        countIf(event_type = 'purchase') AS purchases
      FROM analytics.user_events
      WHERE event_time >= subtractDays(now(), ${Number(days)})
      GROUP BY referrer
      ORDER BY events DESC
    `);
    res.json(rows.map(r => ({
      source: r.referrer || 'direct',
      events: Number(r.events),
      sessions: Number(r.sessions),
      purchases: Number(r.purchases),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /daily-trend — Events theo ngày (30 ngày)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/daily-trend', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const rows = await query(`
      SELECT
        toDate(event_time) AS date,
        count()            AS events,
        uniq(session_id)   AS sessions,
        countIf(event_type = 'product_view')    AS views,
        countIf(event_type = 'add_to_cart')     AS carts,
        countIf(event_type = 'purchase')        AS purchases
      FROM analytics.user_events
      WHERE event_time >= subtractDays(now(), ${Number(days)})
      GROUP BY date
      ORDER BY date
    `);
    res.json(rows.map(r => ({
      date: r.date,
      events: Number(r.events),
      sessions: Number(r.sessions),
      views: Number(r.views),
      carts: Number(r.carts),
      purchases: Number(r.purchases),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /ai-performance — AI Recommendation effectiveness
// ─────────────────────────────────────────────────────────────────────────────
router.get('/ai-performance', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    // Recommendation referrer CTR
    const recEvents = await query(`
      SELECT
        countIf(referrer = 'recommendation')             AS rec_events,
        countIf(referrer = 'recommendation' AND event_type = 'add_to_cart') AS rec_carts,
        countIf(referrer = 'recommendation' AND event_type = 'purchase')    AS rec_purchases,
        countIf(referrer = 'chatbot')                    AS chatbot_events,
        countIf(referrer = 'chatbot' AND event_type = 'add_to_cart')       AS chatbot_carts,
        count()                                          AS total_events
      FROM analytics.user_events
      WHERE event_time >= subtractDays(now(), ${Number(days)})
    `);

    // Behavior coverage: % sessions that have >= 5 events
    const coverage = await query(`
      SELECT
        uniq(session_id) AS total_sessions,
        uniqIf(session_id, cnt >= 5) AS sessions_with_data
      FROM (
        SELECT session_id, count() AS cnt
        FROM analytics.user_events
        WHERE event_time >= subtractDays(now(), ${Number(days)})
        GROUP BY session_id
      )
    `);

    const r = recEvents[0] || {};
    const cov = coverage[0] || {};

    res.json({
      recommendation: {
        events: Number(r.rec_events || 0),
        carts: Number(r.rec_carts || 0),
        purchases: Number(r.rec_purchases || 0),
        ctr: Number(r.rec_events) > 0
          ? Math.round((Number(r.rec_carts) / Number(r.rec_events)) * 10000) / 100 : 0,
      },
      chatbot: {
        events: Number(r.chatbot_events || 0),
        carts: Number(r.chatbot_carts || 0),
      },
      coverage: {
        total_sessions: Number(cov.total_sessions || 0),
        sessions_with_data: Number(cov.sessions_with_data || 0),
        pct: Number(cov.total_sessions) > 0
          ? Math.round((Number(cov.sessions_with_data) / Number(cov.total_sessions)) * 100) : 0,
      },
      total_events: Number(r.total_events || 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
