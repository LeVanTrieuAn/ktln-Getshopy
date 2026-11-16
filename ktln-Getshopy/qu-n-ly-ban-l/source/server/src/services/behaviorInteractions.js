'use strict';
/**
 * ============================================================
 * BEHAVIOR INTERACTIONS — gom hành vi gần đây thành body cho AI-Rec
 * services/behaviorInteractions.js
 * ============================================================
 *
 * Giai đoạn 2 của gợi ý realtime (16/11/2026). Giai đoạn 1 chỉ gửi món ĐÃ MUA lên
 * POST /api/v1/recommend/realtime; giai đoạn 2 gửi thêm hành vi xem / thêm giỏ / yêu
 * thích lên POST /api/v1/recommend/realtime-behavior (ai-rec/models/hybrid.py,
 * live_interactions). File này CHỈ có hàm thuần (không đọc DB, không gọi mạng) để kiểm
 * bằng node --test: tests/behaviorInteractions.test.js.
 *
 * Nguồn dữ liệu (RecommendationService.getRecentBehaviorRows):
 *   - product_view (kèm dwell_time_ms), add_to_cart: ClickHouse analytics.user_events —
 *     nơi duy nhất server ghi sự kiện tracking (BehaviorService.trackEvents). Postgres
 *     KHÔNG có bảng sự kiện, giỏ hàng nằm ở localStorage phía client.
 *   - add_to_wishlist: Postgres "Wishlist" — trạng thái HIỆN TẠI (bỏ yêu thích là xoá
 *     dòng), còn sự kiện add_to_wishlist trong ClickHouse không ghi lượt bỏ.
 *
 * @module behaviorInteractions
 */

// ─────────────────────────────────────────────────────────────────────────────
// Giới hạn phía AI-Rec (ai-rec/api/schemas.py, config.py) — vượt là 422 CẢ request
// ─────────────────────────────────────────────────────────────────────────────
const AI_REC_MAX_INTERACTIONS = 500;     // REALTIME_MAX_INTERACTIONS
const AI_REC_MAX_DWELL_SECONDS = 600;    // BehaviorInteractionItem.dwell_seconds le=600

// Loại sự kiện gửi đi. Dùng đúng tên của bảng tracking để lần ngược được; AI-Rec nhận cả
// tên dài lẫn ngắn (view/cart/wish). KHÔNG gửi 'purchase': món đã mua đã nằm trong
// purchased_product_ids (đọc từ đơn PAID ở Postgres) — gửi cả hai thì live_interactions
// cộng trọng số mua hai lần.
const EV_VIEW = 'product_view';
const EV_CART = 'add_to_cart';
const EV_WISH = 'add_to_wishlist';
const SENT_TYPES = new Set([EV_VIEW, EV_CART, EV_WISH]);

// Mặc định cho các biến môi trường (xem .env.example, mục "AI-Rec realtime giai đoạn 2").
// 72 h (16/11/2026, người dùng duyệt): 24 h thì khách quay lại sau 1–2 ngày mất hết hành vi —
// lượt train hằng ngày chạy CF_BEHAVIOR_MODE=none nên hành vi ngoài cửa sổ không được dùng ở đâu cả.
const DEFAULT_WINDOW_HOURS = 72;
const DEFAULT_MAX_EVENTS = 100;
const DEFAULT_MIN_DWELL_SECONDS = 5;

/** Số nguyên trong [lo, hi]; trống / không phải số -> def. */
function intFromEnv(raw, def, lo, hi) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return def;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : def;
}

/**
 * Đọc cấu hình từ biến môi trường (truyền `env` để test không phụ thuộc process.env).
 *
 * - windowHours: chỉ lấy hành vi trong N giờ gần nhất. Trần 2160 h = 90 ngày vì bảng
 *   user_events tự xoá dữ liệu cũ hơn 90 ngày (TTL trong clickhouse-init/01_schema.sql).
 * - maxEvents: số sự kiện thô mới nhất được xét; 0 = tắt giai đoạn 2 (quay về đúng giai
 *   đoạn 1). Trần 500 = REALTIME_MAX_INTERACTIONS của AI-Rec.
 * - minDwellSeconds: lượt xem cộng dồn dưới ngưỡng này bị bỏ (xem buildBehaviorInteractions).
 */
function readBehaviorConfig(env = process.env) {
  return {
    windowHours: intFromEnv(env.AI_REC_BEHAVIOR_WINDOW_HOURS, DEFAULT_WINDOW_HOURS, 1, 2160),
    maxEvents: intFromEnv(env.AI_REC_BEHAVIOR_MAX_EVENTS, DEFAULT_MAX_EVENTS, 0, AI_REC_MAX_INTERACTIONS),
    minDwellSeconds: intFromEnv(env.AI_REC_BEHAVIOR_MIN_DWELL_SECONDS, DEFAULT_MIN_DWELL_SECONDS, 1, AI_REC_MAX_DWELL_SECONDS),
  };
}

/**
 * Mã sản phẩm hợp lệ -> chuỗi; còn lại -> null.
 * Product.id là BigInt dương; AI-Rec so khớp mã dạng chuỗi (như lúc train, toString).
 * Nhận number | string | bigint vì ClickHouse trả Int64 dạng chuỗi còn Prisma trả BigInt.
 */
function normalizeProductId(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  // ≤ 19 chữ số: vừa Int64, và dưới max_length=64 của AI-Rec
  if (!/^[0-9]{1,19}$/.test(s)) return null;
  const t = s.replace(/^0+/, '');
  return t === '' ? null : t;
}

/**
 * Sự kiện thô -> danh sách `interactions` cho POST /api/v1/recommend/realtime-behavior.
 *
 * @param {Array<{product_id:any, event_type:string, dwell_time_ms?:any, referrer?:string, ts?:any}>} rows
 *   Gộp từ ClickHouse (product_view, add_to_cart) và Postgres Wishlist (add_to_wishlist).
 *   ts = mốc thời gian (ms) để chọn sự kiện MỚI NHẤT khi vượt maxEvents.
 * @param {Object} opts
 * @param {Iterable<string>} [opts.purchasedIds] - món đã mua (purchased_product_ids gửi kèm)
 * @param {number} [opts.maxEvents]       - số sự kiện thô tối đa được xét (mới nhất trước)
 * @param {number} [opts.minDwellSeconds] - ngưỡng bỏ lượt xem quá ngắn
 * @returns {Array<{product_id:string, event_type:string, dwell_seconds?:number}>}
 *   Mỗi (món, loại) đúng MỘT mục, món có sự kiện mới nhất đứng trước.
 *
 * Quy tắc và LÝ DO (16/11/2026):
 *  1. Bỏ món đã mua. Trọng số món mua mới đã do purchased_product_ids lo (log1p(1), như
 *     lượt train tối nay sẽ cho); cộng thêm view/giỏ của chính món đó làm nó nặng hơn mức
 *     bản train sẽ học khi CF_BEHAVIOR_MODE=none (đang chạy trên production — /health
 *     báo behavior=false). Món đã mua cũng bị AI-Rec loại khỏi kết quả nên không mất gì.
 *  2. Bỏ lượt xem do chính ô gợi ý dẫn tới (referrer = 'recommendation'), đúng như lúc
 *     train (ai-rec/models/behavior.py): cộng chúng vào hồ sơ là vòng tự củng cố.
 *  3. Chỉ xét `maxEvents` sự kiện MỚI NHẤT — chặn body và thời gian xử lý; hành vi mới
 *     nói lên ý định hiện tại rõ hơn hành vi cũ trong cửa sổ.
 *  4. Lượt xem: MỘT mục mỗi món, dwell = tổng dwell các lượt, kẹp vào [0, 600] giây.
 *     AI-Rec trả 422 cho CẢ request nếu một dwell_seconds > 600, nên phải kẹp ở đây.
 *     Gộp thay vì gửi từng lượt để món mở đi mở lại (hoặc tab để quên) không chiếm hết
 *     chỗ, và trọng số mỗi món có trần 0,25 × 10 phút.
 *  5. Bỏ lượt xem có tổng dwell < minDwellSeconds (mặc định 5 s), kể cả dwell trống/0.
 *     Lý do: (a) AI-Rec coi dwell trống HOẶC bằng 0 như lượt xem 60 s (models/hybrid.py,
 *     live_interactions) — gửi đi là thổi lượt "bấm nhầm" lên gấp nhiều lần; (b) trọng số
 *     nhỏ KHÔNG che được nhiễu: kênh CF được chuẩn hoá theo max (_unit_max) và với
 *     HYBRID_CF_SHRINK_K = 0, α = 1 ngay khi hồ sơ có 1 món — khách mới chưa có hồ sơ chỉ
 *     cần MỘT lượt liếc 2 giây là gợi ý CF đè hẳn content-based/onboarding. 5 s là ngưỡng
 *     kỹ thuật chưa tinh chỉnh trên dữ liệu (production mới có vài chục lượt xem), chỉnh
 *     qua AI_REC_BEHAVIOR_MIN_DWELL_SECONDS. Client đã tự bỏ lượt < 1 s (useTracking.js).
 *  6. Thêm giỏ / yêu thích: MỘT mục mỗi món, không đếm số lần. Trang chi tiết đang ghi
 *     add_to_cart và add_to_wishlist HAI lần cho một cú bấm (ProductDetail.jsx gọi
 *     trackAddToCart/trackAddToWishlist, CartContext/AppContext cũng gọi) — đếm số lần
 *     là nhân đôi trọng số. Thêm rồi bỏ giỏ vẫn tính, như bảng train (Carts chỉ đếm
 *     add_to_cart): đã cân nhắc món đó là tín hiệu quan tâm.
 */
function buildBehaviorInteractions(rows, opts = {}) {
  const maxEvents = intFromEnv(opts.maxEvents, DEFAULT_MAX_EVENTS, 0, AI_REC_MAX_INTERACTIONS);
  // Sàn 1 giây: dwell làm tròn về 0 sẽ rơi đúng vào lỗi "0 = 60 s" ở trên
  const minRaw = Number(opts.minDwellSeconds);
  const minDwellSeconds = Math.max(1, opts.minDwellSeconds != null && Number.isFinite(minRaw)
    ? minRaw : DEFAULT_MIN_DWELL_SECONDS);
  if (!Array.isArray(rows) || rows.length === 0 || maxEvents === 0) return [];

  const purchased = new Set();
  for (const p of opts.purchasedIds || []) {
    const id = normalizeProductId(p);
    if (id) purchased.add(id);
  }

  // Bước 1 — lọc: loại sự kiện, mã hợp lệ, món đã mua, lượt xem từ ô gợi ý
  const valid = [];
  rows.forEach((row, idx) => {
    if (!row) return;
    const type = String(row.event_type || '').trim();
    if (!SENT_TYPES.has(type)) return;
    const pid = normalizeProductId(row.product_id);
    if (!pid || purchased.has(pid)) return;
    if (type === EV_VIEW && row.referrer === 'recommendation') return;
    const ts = Number(row.ts);
    valid.push({ pid, type, dwellMs: row.dwell_time_ms, ts: Number.isFinite(ts) ? ts : 0, idx });
  });

  // Bước 2 — giữ maxEvents sự kiện mới nhất (cùng mốc: giữ thứ tự đầu vào)
  valid.sort((a, b) => (b.ts - a.ts) || (a.idx - b.idx));
  const recent = valid.slice(0, maxEvents);

  // Bước 3 — gộp theo (loại, món)
  const groups = new Map();
  for (const ev of recent) {
    const key = `${ev.type}|${ev.pid}`;
    let g = groups.get(key);
    if (!g) {
      g = { pid: ev.pid, type: ev.type, dwellMs: 0, lastTs: ev.ts, order: groups.size };
      groups.set(key, g);
    }
    if (ev.type === EV_VIEW) {
      const d = Number(ev.dwellMs);
      // Mỗi lượt đã bị server kẹp ≤ 600.000 ms lúc ghi (BehaviorService._sanitizeEvent);
      // kẹp lại ở đây cho chắc, giá trị âm/rác coi như 0
      if (Number.isFinite(d) && d > 0) g.dwellMs += Math.min(d, AI_REC_MAX_DWELL_SECONDS * 1000);
    }
    if (ev.ts > g.lastTs) g.lastTs = ev.ts;
  }

  // Bước 4 — xuất, bỏ lượt xem quá ngắn
  const out = [];
  for (const g of [...groups.values()].sort((a, b) => (b.lastTs - a.lastTs) || (a.order - b.order))) {
    if (g.type === EV_VIEW) {
      const sec = Math.min(g.dwellMs / 1000, AI_REC_MAX_DWELL_SECONDS);
      if (sec < minDwellSeconds) continue;
      out.push({ product_id: g.pid, event_type: EV_VIEW, dwell_seconds: Math.round(sec) });
    } else {
      out.push({ product_id: g.pid, event_type: g.type });
    }
  }
  return out.slice(0, AI_REC_MAX_INTERACTIONS);
}

/**
 * Gộp sự kiện CÒN TRONG BUFFER của server (chưa ghi ClickHouse) với kết quả truy vấn bảng.
 *
 * Server gom tối đa 5 s mới ghi (BehaviorService._flushBuffer), nên lượt xem vừa gửi lên
 * chưa có trong bảng. Buffer được chụp TRƯỚC khi truy vấn; sự kiện được flush đúng lúc
 * đang truy vấn có thể có ở CẢ HAI nơi -> lọc trùng theo (loại, món, mốc ms). Mốc khớp
 * tuyệt đối vì event_time ghi vào ClickHouse chính là chuỗi ISO trong buffer (kiểm
 * 16/11/2026: toUnixTimestamp64Milli(parseDateTime64BestEffort(iso)) = Date.parse(iso)).
 *
 * @param {Array} pending - sự kiện buffer theo thứ tự ghi (cũ trước), đã đổi sang dạng hàng
 * @param {Array} stored  - hàng từ ClickHouse, mới nhất trước
 * @param {number} limit
 * @returns {Array} mới nhất trước, tối đa `limit`
 */
function mergeBufferedEvents(pending, stored, limit) {
  const key = e => `${e.event_type}|${e.product_id}|${e.ts}`;
  const seen = new Set(stored.map(key));
  return pending.filter(e => !seen.has(key(e))).reverse().concat(stored).slice(0, limit);
}

module.exports = {
  buildBehaviorInteractions,
  mergeBufferedEvents,
  readBehaviorConfig,
  normalizeProductId,
  AI_REC_MAX_INTERACTIONS,
  AI_REC_MAX_DWELL_SECONDS,
  DEFAULT_WINDOW_HOURS,
  DEFAULT_MAX_EVENTS,
  DEFAULT_MIN_DWELL_SECONDS,
};
