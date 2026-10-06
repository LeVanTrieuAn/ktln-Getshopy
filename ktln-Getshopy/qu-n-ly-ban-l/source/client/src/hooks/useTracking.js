/**
 * ============================================================
 * useTracking — Client-side Behavior Tracking Hook
 * hooks/useTracking.js
 * ============================================================
 *
 * React hook để thu thập hành vi người dùng (implicit feedback).
 *
 * Chức năng:
 *   - Auto-generate session_id (UUID lưu sessionStorage — 1 phiên = 1 tab)
 *   - Auto-detect device_type (mobile/desktop/tablet)
 *   - Buffer events và gửi batch mỗi 5 giây
 *   - Gửi remaining events khi rời trang (pagehide / tab ẩn, fetch keepalive kèm token)
 *   - Tích hợp sẵn dwell_time + scroll_depth tracking cho ProductDetail
 *
 * Nơi ghi từng loại sự kiện (01/10–04/10/2026):
 *   product_view      useProductViewTracker — trang chi tiết
 *   add_to_cart       CartContext.addToCart — MỌI đường thêm giỏ (thẻ sản phẩm, chi tiết, so sánh)
 *   remove_from_cart  CartContext.removeFromCart — ngăn giỏ hàng
 *   add_to_wishlist   AppContext.toggleWishlist — mọi nút yêu thích
 *   category_view, search_query   ProductList
 *   purchase, checkout_abandon    Checkout
 *   review_submit     trang chi tiết
 *   rec_impression, rec_click     ô "Dành riêng cho bạn" (Home)
 *   identify          AppContext.b2cLogin — ghép phiên ẩn danh vào khách (dbt user_events_stitched)
 *   Đặt ở context dùng chung thay vì từng trang: mỗi hành động ghi ĐÚNG MỘT lần, kể cả khi
 *   sau này thêm nút mới.
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

/**
 * Đăng xuất: mở phiên mới. Phiên cũ đã gắn với khách vừa đăng xuất (qua sự kiện
 * identify) — giữ nguyên thì người dùng KẾ TIẾP trên cùng tab bị dbt gán nhầm hành vi
 * sang khách đó. Gửi nốt buffer TRƯỚC khi đổi để sự kiện cũ đi kèm token cũ.
 */
export function resetSession() {
  flushOnExit();
  sessionStorage.removeItem('gs_session_id');
}

/**
 * Nguồn trang suy từ URL — cho sự kiện phát từ chỗ dùng chung (giỏ hàng, yêu thích),
 * nơi không biết trang nào gọi. Giá trị khớp VALID_PAGE_SOURCES phía server.
 */
export function currentPageSource() {
  const { pathname, search } = window.location;
  if (pathname === '/' || pathname === '') return 'home';
  if (pathname.startsWith('/product/')) return 'detail';
  if (pathname.startsWith('/checkout')) return 'checkout';
  if (pathname.startsWith('/compare')) return 'compare';
  if (pathname.startsWith('/account')) return 'wishlist';
  if (pathname.startsWith('/shop') || pathname.startsWith('/products')) {
    return new URLSearchParams(search).get('search') ? 'search' : 'category';
  }
  return '';
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

// Gửi nốt buffer khi trang bị ẩn hoặc đóng.
//
// fetch keepalive thay cho sendBeacon: sendBeacon KHÔNG gửi được header
// Authorization, nên mọi event cuối phiên của khách đã đăng nhập bị server ghi
// thành khách vãng lai (server chỉ tin danh tính trong token). keepalive giữ
// request sống sau khi trang đóng; giới hạn 64 KB, mỗi lô 20 event chỉ vài KB.
//
// pagehide + visibilitychange thay cho beforeunload: beforeunload không bắn khi
// trình duyệt di động huỷ tab nền, và chặn bfcache.
export function flushOnExit() {
  const BASE = import.meta.env.VITE_API_URL || '/api';
  const token = localStorage.getItem('b2c_token');
  while (_buffer.length > 0) {
    const body = JSON.stringify({ events: _buffer.splice(0, MAX_BUFFER) });
    try {
      fetch(`${BASE}/b2c/track`, {
        method: 'POST',
        keepalive: true,
        body,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }).catch(() => {});
    } catch { /* trang đang đóng — bỏ qua */ }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushOnExit);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnExit();
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// HOOK
// ═════════════════════════════════════════════════════════════════════════════

export function useTracking() {
  const sessionId = getSessionId();
  const deviceType = getDeviceType();

  // ── Base event builder ─────────────────────────────────────────────────
  // Không gửi customer_id và event_time: server lấy khách từ token và dùng
  // giờ của server (client tự khai được cả hai).
  const buildEvent = useCallback((eventType, data = {}) => {
    return {
      event_type: eventType,
      session_id: sessionId,
      device_type: deviceType,
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
 * Gửi MỘT product_view khi rời sản phẩm: lúc unmount, hoặc lúc đóng/tải lại tab
 * (React không unmount khi trang bị đóng — thiếu pagehide thì mất lượt xem cuối).
 *
 * Dwell chỉ cộng thời gian trang THỰC SỰ hiển thị: tab để nền không phải là đang
 * xem, trước đây vẫn bị tính (tới trần 10 phút phía server).
 *
 * @param {Object} product
 * @param {{referrer?: string}} opts - nơi dẫn tới trang, vd. 'recommendation'
 *   (truyền qua router state). SPA không đổi document.referrer khi chuyển trang,
 *   nên đoán theo document.referrer chỉ đúng với lượt vào trang đầu tiên.
 */
export function useProductViewTracker(product, opts = {}) {
  const { trackProductView } = useTracking();
  const referrerRef = useRef(opts.referrer);
  referrerRef.current = opts.referrer;

  useEffect(() => {
    if (!product?.id) return;

    let activeMs = 0;
    let visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
    let maxScroll = 0;
    let sent = false;

    const handleScroll = () => {
      const scrolled = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const pct = Math.round((scrolled / docHeight) * 100);
        if (pct > maxScroll) maxScroll = pct;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (visibleSince != null) { activeMs += Date.now() - visibleSince; visibleSince = null; }
      } else if (visibleSince == null) {
        visibleSince = Date.now();
      }
    };

    const emit = () => {
      if (sent) return;
      sent = true;
      const dwellMs = activeMs + (visibleSince != null ? Date.now() - visibleSince : 0);
      if (dwellMs > 1000) { // < 1 giây: bấm nhầm / bot
        trackProductView(product, {
          dwellTimeMs: dwellMs,
          scrollDepthPct: maxScroll,
          referrer: referrerRef.current
            || (document.referrer.includes('/search') ? 'search'
              : document.referrer.includes('/category') ? 'category'
              : 'direct'),
        });
      }
    };

    // Trang sắp đóng: ghi lượt xem rồi gửi ngay, không chờ hẹn giờ 5 giây.
    const handlePageHide = () => { emit(); flushOnExit(); };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      emit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);
}

export default useTracking;
