/**
 * ============================================================
 * useTracking — Client-side Behavior Tracking Hook
 * hooks/useTracking.js
 * ============================================================
 *
 * React hook để thu thập hành vi người dùng (implicit feedback).
 *
 * Chức năng:
 *   - Auto-generate session_id (UUID lưu localStorage)
 *   - Auto-detect device_type (mobile/desktop/tablet)
 *   - Buffer events và gửi batch mỗi 5 giây
 *   - Gửi remaining events khi rời trang (beforeunload)
 *   - Tích hợp sẵn dwell_time + scroll_depth tracking cho ProductDetail
 *
 * Usage:
 *   const { trackEvent, trackProductView, trackAddToCart, ... } = useTracking();
 *
 * @module useTracking
 */

import { useRef, useCallback, useEffect } from 'react';
import { api } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// SESSION ID — Persistent across page navigations (1 session = 1 browser tab)
// ─────────────────────────────────────────────────────────────────────────────
function getSessionId() {
  let sid = sessionStorage.getItem('gs_session_id');
  if (!sid) {
    sid = 'ses_' + crypto.randomUUID();
    sessionStorage.setItem('gs_session_id', sid);
  }
  return sid;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE DETECTION
// ─────────────────────────────────────────────────────────────────────────────
function getDeviceType() {
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|android|phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

// ─────────────────────────────────────────────────────────────────────────────
// GET CUSTOMER INFO from localStorage (if logged in)
// ─────────────────────────────────────────────────────────────────────────────
function getCustomerId() {
  try {
    const user = JSON.parse(localStorage.getItem('b2c_user') || 'null');
    return user?.id || null;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL EVENT BUFFER (shared across all hook instances)
// ─────────────────────────────────────────────────────────────────────────────
const FLUSH_INTERVAL_MS = 5000; // 5 giây
const MAX_BUFFER = 20;

let _buffer = [];
let _flushTimer = null;

async function _flushEvents() {
  if (_buffer.length === 0) return;
  const batch = _buffer.splice(0);
  try {
    await api.b2c.track(batch);
  } catch (err) {
    // Nếu gửi thất bại, dồn lại (tối đa 50 events)
    if (_buffer.length < 50) {
      _buffer.push(...batch);
    }
  }
}

function _scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => {
    _flushTimer = null;
    _flushEvents();
  }, FLUSH_INTERVAL_MS);
}

// Gửi events trước khi user rời trang
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (_buffer.length > 0) {
      // sendBeacon is fire-and-forget, survives page unload
      const BASE = import.meta.env.VITE_API_URL || '/api';
      navigator.sendBeacon(
        `${BASE}/b2c/track`,
        new Blob([JSON.stringify({ events: _buffer })], { type: 'application/json' })
      );
      _buffer = [];
    }
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// HOOK
// ═════════════════════════════════════════════════════════════════════════════

export function useTracking() {
  const sessionId = getSessionId();
  const deviceType = getDeviceType();

  // ── Base event builder ─────────────────────────────────────────────────
  const buildEvent = useCallback((eventType, data = {}) => {
    return {
      event_type: eventType,
      session_id: sessionId,
      customer_id: getCustomerId(),
      device_type: deviceType,
      event_time: new Date().toISOString().replace('T', ' ').substring(0, 23),
      ...data,
    };
  }, [sessionId, deviceType]);

  // ── Generic track ──────────────────────────────────────────────────────
  const trackEvent = useCallback((eventType, data = {}) => {
    const event = buildEvent(eventType, data);
    _buffer.push(event);
    if (_buffer.length >= MAX_BUFFER) {
      _flushEvents();
    } else {
      _scheduleFlush();
    }
  }, [buildEvent]);

  // ─── Convenience methods ───────────────────────────────────────────────

  const trackProductView = useCallback((product, opts = {}) => {
    trackEvent('product_view', {
      product_id: product.id,
      category_id: product.category_id,
      brand_id: product.brand_id,
      price_at_event: product.price,
      referrer: opts.referrer || 'direct',
      page_source: opts.pageSource || 'detail',
      dwell_time_ms: opts.dwellTimeMs || null,
      scroll_depth_pct: opts.scrollDepthPct || null,
    });
  }, [trackEvent]);

  const trackCategoryView = useCallback((categoryId, opts = {}) => {
    trackEvent('category_view', {
      category_id: categoryId,
      referrer: opts.referrer || 'direct',
      page_source: 'category',
    });
  }, [trackEvent]);

  const trackSearchQuery = useCallback((query, resultCount, opts = {}) => {
    trackEvent('search_query', {
      search_query: query,
      result_count: resultCount,
      referrer: opts.referrer || 'search',
      page_source: 'search',
    });
  }, [trackEvent]);

  const trackAddToCart = useCallback((product, quantity = 1, opts = {}) => {
    trackEvent('add_to_cart', {
      product_id: product.id,
      category_id: product.category_id,
      brand_id: product.brand_id,
      price_at_event: product.price,
      quantity,
      referrer: opts.referrer || 'direct',
      page_source: opts.pageSource || 'detail',
    });
  }, [trackEvent]);

  const trackRemoveFromCart = useCallback((product, opts = {}) => {
    trackEvent('remove_from_cart', {
      product_id: product.id,
      category_id: product.category_id,
      brand_id: product.brand_id,
      price_at_event: product.price,
      page_source: 'cart',
    });
  }, [trackEvent]);

  const trackAddToWishlist = useCallback((product, opts = {}) => {
    trackEvent('add_to_wishlist', {
      product_id: product.id,
      category_id: product.category_id,
      brand_id: product.brand_id,
      price_at_event: product.price,
      page_source: opts.pageSource || 'detail',
    });
  }, [trackEvent]);

  const trackCompareView = useCallback((productIds, opts = {}) => {
    trackEvent('compare_view', {
      product_ids: productIds,
      page_source: 'compare',
    });
  }, [trackEvent]);

  const trackPurchase = useCallback((items, opts = {}) => {
    for (const item of items) {
      trackEvent('purchase', {
        product_id: item.id,
        category_id: item.category_id,
        brand_id: item.brand_id,
        price_at_event: item.price,
        quantity: item.quantity || 1,
        page_source: 'checkout',
      });
    }
  }, [trackEvent]);

  const trackCheckoutAbandon = useCallback((items, step, opts = {}) => {
    trackEvent('checkout_abandon', {
      product_ids: items.map(i => i.id),
      page_source: 'checkout',
    });
  }, [trackEvent]);

  const trackReviewSubmit = useCallback((productId, rating, opts = {}) => {
    trackEvent('review_submit', {
      product_id: productId,
      rating,
      page_source: 'detail',
    });
  }, [trackEvent]);

  return {
    sessionId,
    trackEvent,
    trackProductView,
    trackCategoryView,
    trackSearchQuery,
    trackAddToCart,
    trackRemoveFromCart,
    trackAddToWishlist,
    trackCompareView,
    trackPurchase,
    trackCheckoutAbandon,
    trackReviewSubmit,
  };
}

/**
 * Hook chuyên dụng cho ProductDetail — tự động track dwell time + scroll depth.
 * Khi unmount (user rời trang), tự gửi product_view event với metrics.
 */
export function useProductViewTracker(product) {
  const { trackProductView } = useTracking();
  const startTime = useRef(Date.now());
  const maxScroll = useRef(0);

  useEffect(() => {
    if (!product?.id) return;

    startTime.current = Date.now();
    maxScroll.current = 0;

    const handleScroll = () => {
      const scrolled = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const pct = Math.round((scrolled / docHeight) * 100);
        if (pct > maxScroll.current) maxScroll.current = pct;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);

      // Send product_view với dwell time + scroll depth khi unmount
      const dwellMs = Date.now() - startTime.current;
      if (dwellMs > 1000) { // Chỉ track nếu xem > 1 giây (filter bots/accidental)
        trackProductView(product, {
          dwellTimeMs: dwellMs,
          scrollDepthPct: maxScroll.current,
          referrer: document.referrer.includes('/search') ? 'search'
                  : document.referrer.includes('/category') ? 'category'
                  : 'direct',
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);
}

export default useTracking;
