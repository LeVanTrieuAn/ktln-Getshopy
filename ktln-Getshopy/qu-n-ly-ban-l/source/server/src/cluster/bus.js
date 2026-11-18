'use strict';
/**
 * Kênh sự kiện giữa các bản server (Redis Pub/Sub) — 18/11/2026, cân bằng tải nhiều bản.
 *
 * Vì sao cần: compose chạy N bản `server` sau nginx. Mỗi bản giữ vài thứ trong bộ nhớ tiến
 * trình (bộ đệm trạng thái khách, bộ đệm số đếm danh sách sản phẩm, bộ đệm L2 của redis.js)
 * và giữ kết nối WebSocket của riêng nó. Khi quản trị đổi dữ liệu trên bản A thì bản B, C
 * không biết; khi đơn hàng tạo trên bản A thì chỉ client WebSocket nối vào A được báo.
 * Bus này phát một thông điệp cho MỌI bản để mỗi bản tự xử lý phần của mình.
 *
 * Thiết kế:
 *   - MỘT kênh Redis (`getshopy:bus`), thông điệp JSON { o: bản phát, t: chủ đề, p: dữ liệu }.
 *   - emit(topic, p) = chạy handler cục bộ NGAY (kể cả khi không có Redis) + publish cho bản
 *     khác. Bản phát bỏ qua tin vọng lại của chính nó (so `o` với instanceId), nên mỗi bản xử
 *     lý mỗi sự kiện đúng MỘT lần — WebSocket không nhận tin trùng.
 *   - Pub/Sub của Redis là "bắn rồi quên": bản nào đang mất kết nối thì lỡ tin. Bù lại, mỗi
 *     lần kết nối subscriber nối lại, bus gọi các handler onResync() — các bộ đệm xoá sạch
 *     phần cục bộ (an toàn: chỉ tốn thêm một lượt đọc DB). Tin lỡ trong khoảng ngắn giữa lúc
 *     nối lại và lúc SUBSCRIBE xong thì bộ đệm vẫn tự hết hạn theo TTL của nó.
 *   - Subscriber phải là kết nối RIÊNG: kết nối ở chế độ subscribe không chạy lệnh khác được
 *     (https://redis.io/docs/latest/develop/interact/pubsub/).
 *   - publish() không bao giờ ném lỗi và không chờ khi Redis rớt (kiểm isReady trước): node-redis
 *     xếp hàng lệnh khi mất kết nối, chờ ở đây là treo request của khách.
 *
 * Không phụ thuộc thư viện nào (client Redis truyền vào) để kiểm thử bằng `node --test`.
 */

const DEFAULT_CHANNEL = 'getshopy:bus';
const WARN_EVERY_MS = 30_000;

/**
 * @param {object} opts
 * @param {object|null} opts.publisher        client node-redis đã connect (hoặc null = chỉ chạy cục bộ)
 * @param {(() => object)|null} opts.createSubscriber  tạo client riêng để SUBSCRIBE (thường redis.duplicate())
 * @param {string} opts.instanceId             định danh bản server này, duy nhất trong cụm
 * @param {string} [opts.channel]
 * @param {object} [opts.logger]
 */
function createBus({ publisher = null, createSubscriber = null, instanceId, channel = DEFAULT_CHANNEL, logger = console, now = Date.now } = {}) {
  if (!instanceId) throw new Error('createBus: thiếu instanceId');
  /** topic -> Set<handler> */
  const handlers = new Map();
  const resyncHandlers = new Set();
  let subscriber = null;
  let startPromise = null;
  let readyCount = 0;
  let stopped = false;
  const lastWarn = new Map();

  function warn(kind, msg) {
    const t = now();
    if (t - (lastWarn.get(kind) || 0) < WARN_EVERY_MS) return;
    lastWarn.set(kind, t);
    logger.warn(`[bus] ${msg}`);
  }

  function on(topic, fn) {
    if (typeof fn !== 'function') throw new TypeError('bus.on: handler phải là hàm');
    if (!handlers.has(topic)) handlers.set(topic, new Set());
    handlers.get(topic).add(fn);
    return () => handlers.get(topic)?.delete(fn);
  }

  function onResync(fn) {
    if (typeof fn !== 'function') throw new TypeError('bus.onResync: handler phải là hàm');
    resyncHandlers.add(fn);
    return () => resyncHandlers.delete(fn);
  }

  function dispatch(topic, payload, meta) {
    const set = handlers.get(topic);
    if (!set) return 0;
    let n = 0;
    for (const fn of set) {
      try { fn(payload, meta); n += 1; } catch (err) { logger.error(`[bus] handler "${topic}" lỗi:`, err.message); }
    }
    return n;
  }

  function resync(reason) {
    for (const fn of resyncHandlers) {
      try { fn(reason); } catch (err) { logger.error('[bus] handler resync lỗi:', err.message); }
    }
  }

  /** Thông điệp thô từ Redis. Bỏ tin hỏng và tin của chính bản này. */
  function handleMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return false; }
    if (!msg || typeof msg.t !== 'string' || msg.o === instanceId) return false;
    dispatch(msg.t, msg.p ?? null, { origin: msg.o, remote: true });
    return true;
  }

  const publisherReady = () => Boolean(publisher && publisher.isReady);

  /** Chỉ gửi cho bản khác. Promise<boolean>: true = Redis đã nhận. Không bao giờ reject. */
  function publish(topic, payload = null) {
    if (stopped || !publisherReady()) return Promise.resolve(false);
    let body;
    try {
      body = JSON.stringify({ o: instanceId, t: topic, p: payload });
    } catch (err) {
      logger.error(`[bus] không tuần tự hoá được "${topic}":`, err.message);
      return Promise.resolve(false);
    }
    return Promise.resolve()
      .then(() => publisher.publish(channel, body))
      .then(() => true, (err) => { warn('publish', `publish "${topic}" lỗi (bản khác sẽ chờ TTL): ${err.message}`); return false; });
  }

  /** Xử lý cục bộ ngay + gửi cho bản khác. Trả Promise của publish (không cần await). */
  function emit(topic, payload = null) {
    dispatch(topic, payload, { origin: instanceId, remote: false });
    return publish(topic, payload);
  }

  /**
   * Mở kết nối subscriber. KHÔNG await ở đường khởi động: node-redis v4 connect() tự thử lại
   * mãi khi Redis chưa lên, promise có thể chờ rất lâu. Gọi nhiều lần chỉ chạy một lần.
   */
  function start() {
    if (startPromise) return startPromise;
    if (typeof createSubscriber !== 'function') {
      startPromise = Promise.resolve(false);
      return startPromise;
    }
    startPromise = (async () => {
      try {
        subscriber = createSubscriber();
        subscriber.on('error', (err) => warn('sub-error', `subscriber lỗi: ${err.message}`));
        // 'ready' bắn sau lần nối đầu VÀ sau mỗi lần nối lại. Từ lần thứ hai: có thể đã lỡ tin.
        subscriber.on('ready', () => {
          readyCount += 1;
          if (readyCount > 1) {
            logger.warn('[bus] subscriber nối lại — xoá bộ đệm cục bộ phòng lỡ tin');
            resync('reconnect');
          }
        });
        await subscriber.connect();
        if (stopped) return false;
        await subscriber.subscribe(channel, handleMessage);
        logger.log(`[bus] đã nghe kênh ${channel} (bản ${instanceId})`);
        return true;
      } catch (err) {
        warn('start', `không mở được subscriber, chỉ chạy cục bộ: ${err.message}`);
        return false;
      }
    })();
    return startPromise;
  }

  async function stop() {
    stopped = true;
    const sub = subscriber;
    subscriber = null;
    if (!sub) return;
    // disconnect() chứ không quit(): quit() xếp hàng chờ khi Redis đang rớt. Subscriber không
    // có lệnh nào dở dang cần chờ trả lời.
    try { if (sub.isOpen) await sub.disconnect(); } catch { /* đã đóng */ }
  }

  return {
    on, onResync, emit, publish, start, stop,
    instanceId, channel,
    // Cho kiểm thử
    _handleMessage: handleMessage,
    _resync: resync,
  };
}

module.exports = { createBus, DEFAULT_CHANNEL };
