'use strict';
/**
 * Store cho express-rate-limit: Redis khi Redis sẵn sàng, bộ nhớ tiến trình khi không — 18/11/2026.
 *
 * Vì sao: compose chạy N bản server sau nginx (least_conn). MemoryStore mặc định đếm RIÊNG từng
 * bản, nên hạn mức thật là N x max: AI_RATE_LIMIT_PER_MIN = 20 thành 60 lượt LLM tính tiền mỗi
 * phút với 3 bản. Đếm trong Redis (rate-limit-redis — store chính thức của express-rate-limit,
 * https://github.com/express-rate-limit/rate-limit-redis) thì mọi bản dùng chung một bộ đếm.
 *
 * Redis là phụ thuộc mới trên MỌI request /api, nên không được để nó làm chết hay treo server:
 *   - Redis chưa sẵn sàng (client.isReady = false) -> đếm bằng MemoryStore ngay, không gửi lệnh.
 *     node-redis xếp hàng lệnh khi mất kết nối; gửi vào lúc đó là treo request tới khi Redis về.
 *   - Lệnh Redis lỗi hoặc quá timeoutMs -> cũng rơi về MemoryStore cho request đó.
 *   Lúc rơi về bộ nhớ, hạn mức lại thành theo-từng-bản (N x max) — xuống cấp có chủ đích: thà
 *   nới hạn mức vài phút còn hơn chặn hoặc treo cả cửa hàng. Đổi chế độ thì ghi log MỘT lần.
 *
 * Cửa sổ cố định (fixed window) ở cả hai store — giống MemoryStore trước đây, nên số liệu và
 * header RateLimit-* không đổi ý nghĩa.
 */
const { MemoryStore } = require('express-rate-limit');

const DEFAULT_TIMEOUT_MS = 250;

function withTimeout(promise, ms) {
  let timer;
  // Không unref(): timer sống tối đa `ms` và bị huỷ ngay khi Redis trả lời. unref() thì lúc
  // không còn gì khác giữ event loop (kiểm thử trên Node 20) promise treo bị bỏ dở.
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`quá ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

class FailoverStore {
  /**
   * @param {object} opts
   * @param {() => object} [opts.createPrimary]  tạo store chính (Redis) — gọi muộn, lần đầu cần
   * @param {() => boolean} [opts.isPrimaryReady]
   * @param {object} [opts.fallback]             store dự phòng (mặc định MemoryStore)
   * @param {string} [opts.prefix]               tiền tố khoá — phải khác nhau giữa các limiter
   * @param {number} [opts.timeoutMs]
   * @param {object} [opts.logger]
   */
  constructor({ createPrimary = null, isPrimaryReady = () => false, fallback, prefix = 'rl:', timeoutMs = DEFAULT_TIMEOUT_MS, logger = console } = {}) {
    this.createPrimary = createPrimary;
    this.isPrimaryReady = isPrimaryReady;
    this.fallback = fallback || new MemoryStore();
    this.prefix = prefix;
    this.timeoutMs = timeoutMs;
    this.logger = logger;
    // Bộ đếm có thể nằm ở Redis (dùng chung) — express-rate-limit dùng cờ này + prefix trong
    // kiểm tra "một request đếm hai lần".
    this.localKeys = false;
    this.primary = null;
    this.options = null;
    this.mode = null;          // 'redis' | 'memory' — chế độ của lượt gần nhất, để log khi đổi
  }

  init(options) {
    this.options = options;
    if (typeof this.fallback.init === 'function') this.fallback.init(options);
    if (this.primary && typeof this.primary.init === 'function') this.primary.init(options);
  }

  _getPrimary() {
    if (!this.primary) {
      this.primary = this.createPrimary();
      if (this.options && typeof this.primary.init === 'function') this.primary.init(this.options);
    }
    return this.primary;
  }

  _setMode(mode, err) {
    if (this.mode === mode) return;
    const first = this.mode === null;
    this.mode = mode;
    if (first && mode === 'redis') return;   // khởi động bình thường, khỏi ồn
    if (mode === 'memory') {
      this.logger.warn(`[rate-limit ${this.prefix}] Redis không dùng được (${err ? err.message : 'chưa sẵn sàng'}) — tạm đếm trong bộ nhớ từng bản server`);
    } else {
      this.logger.log(`[rate-limit ${this.prefix}] Redis đã trở lại — đếm chung cho mọi bản server`);
    }
  }

  async _run(method, key) {
    if (this.createPrimary && this.isPrimaryReady()) {
      try {
        const result = await withTimeout(Promise.resolve().then(() => this._getPrimary()[method](key)), this.timeoutMs);
        this._setMode('redis');
        return result;
      } catch (err) {
        this._setMode('memory', err);
      }
    } else {
      this._setMode('memory');
    }
    return this.fallback[method](key);
  }

  increment(key) { return this._run('increment', key); }
  decrement(key) { return this._run('decrement', key); }
  resetKey(key) { return this._run('resetKey', key); }
  get(key) { return this._run('get', key); }

  async resetAll() {
    if (typeof this.fallback.resetAll === 'function') await this.fallback.resetAll();
  }

  shutdown() {
    if (typeof this.fallback.shutdown === 'function') this.fallback.shutdown();
  }
}

/**
 * Store cho một limiter, dùng client node-redis có sẵn (src/redis.js). client null (không đặt
 * REDIS_URL, chạy native khi dev) -> chỉ MemoryStore, như trước 18/11/2026.
 */
function createRateLimitStore({ client, prefix, timeoutMs = Number(process.env.RATE_LIMIT_REDIS_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS, logger } = {}) {
  return new FailoverStore({
    prefix,
    timeoutMs,
    logger,
    isPrimaryReady: () => Boolean(client && client.isReady),
    createPrimary: client
      ? () => {
          const { RedisStore } = require('rate-limit-redis');
          return new RedisStore({ prefix, sendCommand: (...args) => client.sendCommand(args) });
        }
      : null,
  });
}

module.exports = { FailoverStore, createRateLimitStore, withTimeout, DEFAULT_TIMEOUT_MS };
