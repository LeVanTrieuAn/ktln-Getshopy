'use strict';
/**
 * Tắt server êm (graceful shutdown) khi nhận SIGTERM / SIGINT — 18/11/2026, cân bằng tải.
 *
 * Vì sao: trước ngày này server không bắt tín hiệu nào. node chạy làm PID 1 trong container
 * (docker-entrypoint.sh `exec`), mà PID 1 không có xử lý mặc định cho SIGTERM — `docker stop`
 * chờ hết 10 s rồi SIGKILL (exit 137): request dở dang bị cắt ngang, buffer hành vi chưa đẩy
 * sang ClickHouse thì mất. Với nhiều bản sau nginx, thu nhỏ (--scale) hay cập nhật cuốn chiếu
 * là chuyện thường ngày, nên mỗi lần tắt một bản phải không làm rơi request nào.
 *
 * Trình tự (mốc cứng timeoutMs, mặc định 8 s — dưới stop_grace_period 12 s của compose):
 *   1. draining = true: /api/health trả 503 (Kubernetes readiness / healthcheck thôi gửi tới),
 *      mọi response kèm `Connection: close` để nginx không dùng lại kết nối keep-alive tới bản này.
 *   2. Dừng việc nền: timer KPI WebSocket, job đóng đơn quá hạn (chờ lượt đang chạy).
 *   3. (tuỳ chọn) chờ drainDelayMs — cho bộ cân bằng tải kịp gỡ bản này (Kubernetes); compose để 0.
 *   4. server.close(): thôi nhận kết nối mới (nginx gặp "connection refused" thì chuyển request
 *      sang bản khác — proxy_next_upstream error), đóng kết nối rảnh, chờ request dở dang xong.
 *      Đóng WebSocket bằng mã 1001 "Going Away" (RFC 6455 §7.4.1) để client tự nối lại — vào bản khác.
 *   5. Quá (timeoutMs - cleanupBudgetMs) mà còn request chưa xong: cắt hẳn, để dành thời gian dọn dẹp.
 *   6. Dọn dẹp tuần tự, mỗi bước có trần riêng: đẩy buffer hành vi, đóng bus/Redis, Prisma.
 *   7. exit(0) nếu mọi request đã xong; exit(1) nếu phải cắt request hoặc chạm mốc cứng.
 *
 * Không phụ thuộc thư viện nào (server, wss, exit truyền vào) để kiểm thử bằng `node --test`.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}: quá ${ms} ms`)), ms);
      // Mốc cứng (timer `hard` bên dưới, không unref) mới là thứ bảo đảm tiến trình thoát.
      if (timer.unref) timer.unref();
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * @param {object} opts
 * @param {import('http').Server} opts.server
 * @param {object} [opts.wss]                       ws.Server (dùng wss.clients)
 * @param {Array<{name:string, fn:Function}>} [opts.stopBackground]  chạy NGAY khi bắt đầu tắt
 * @param {Array<{name:string, fn:Function}>} [opts.cleanup]         chạy sau khi HTTP đã đóng
 * @param {number} [opts.timeoutMs]        mốc cứng cho cả quá trình
 * @param {number} [opts.cleanupBudgetMs]  phần dành riêng cho dọn dẹp
 * @param {number} [opts.stepTimeoutMs]    trần mỗi bước dọn dẹp
 * @param {number} [opts.drainDelayMs]
 * @param {number} [opts.wsCloseGraceMs]   chờ client WebSocket bắt tay đóng rồi mới terminate
 */
function createGracefulShutdown({
  server,
  wss = null,
  stopBackground = [],
  cleanup = [],
  timeoutMs = 8000,
  cleanupBudgetMs = 2500,
  stepTimeoutMs = 2000,
  drainDelayMs = 0,
  wsCloseGraceMs = 1000,
  logger = console,
  exit = (code) => process.exit(code),
} = {}) {
  if (!server) throw new Error('createGracefulShutdown: thiếu server');
  let draining = false;
  let promise = null;

  const isDraining = () => draining;

  /**
   * Gắn ĐẦU TIÊN: trong lúc tắt, mọi response bảo client đóng kết nối sau khi nhận xong.
   * Xét lúc GHI header chứ không phải lúc request tới: request đến TRƯỚC SIGTERM mà trả lời SAU
   * cũng phải kèm `Connection: close` — Node không tự thêm, kết nối keep-alive đó sẽ ở lại và
   * server.close() phải chờ tới keepAliveTimeout. (Express gọi writeHead qua res.end().)
   */
  function middleware(_req, res, next) {
    if (draining) {
      if (!res.headersSent) res.setHeader('Connection', 'close');
      return next();
    }
    const writeHead = res.writeHead;
    res.writeHead = function writeHeadDraining(...args) {
      if (draining && !this.headersSent) this.setHeader('Connection', 'close');
      return writeHead.apply(this, args);
    };
    next();
  }

  async function runSteps(steps, perStepMs) {
    for (const { name, fn } of steps) {
      try {
        await withTimeout(Promise.resolve().then(fn), perStepMs, name);
      } catch (err) {
        logger.error(`[shutdown] ${name} lỗi:`, err.message);
      }
    }
  }

  function closeWebSockets() {
    if (!wss || !wss.clients) return;
    for (const ws of wss.clients) {
      try { ws.close(1001, 'server shutting down'); } catch { /* đã đóng */ }
    }
    // Client không đáp bắt tay đóng thì cắt hẳn, để server.close() không chờ mãi.
    const t = setTimeout(() => {
      for (const ws of wss.clients) { try { ws.terminate(); } catch { /* đã đóng */ } }
    }, wsCloseGraceMs);
    if (t.unref) t.unref();
  }

  /** Promise<boolean>: true = mọi kết nối HTTP đã tự đóng trong hạn. */
  function closeHttp(limitMs) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok) => { if (!done) { done = true; clearTimeout(t); resolve(ok); } };
      const t = setTimeout(() => {
        logger.warn(`[shutdown] còn request chưa xong sau ${limitMs} ms — cắt kết nối`);
        try { if (typeof server.closeAllConnections === 'function') server.closeAllConnections(); } catch { /* bỏ qua */ }
        finish(false);
      }, limitMs);
      server.close((err) => {
        if (err && err.code !== 'ERR_SERVER_NOT_RUNNING') logger.warn('[shutdown] server.close:', err.message);
        finish(true);
      });
      // Node >= 18.2. Node >= 19 tự làm việc này trong close(); gọi thêm cho chắc.
      try { if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections(); } catch { /* bỏ qua */ }
      closeWebSockets();
    });
  }

  function shutdown(signal = 'manual') {
    if (promise) return promise;
    draining = true;
    const started = Date.now();
    logger.log(`[shutdown] nhận ${signal} — ngừng nhận request mới, chờ request dở dang (tối đa ${timeoutMs} ms)`);

    let hardTimer;
    const hard = new Promise((resolve) => { hardTimer = setTimeout(() => resolve('timeout'), timeoutMs); });

    const graceful = (async () => {
      await runSteps(stopBackground, stepTimeoutMs);
      if (drainDelayMs > 0) await sleep(drainDelayMs);
      const httpLimit = Math.max(0, timeoutMs - cleanupBudgetMs - (Date.now() - started));
      const clean = await closeHttp(httpLimit);
      await runSteps(cleanup, stepTimeoutMs);
      return clean ? 'ok' : 'cut';
    })();

    promise = Promise.race([graceful, hard]).then((result) => {
      clearTimeout(hardTimer);
      const ms = Date.now() - started;
      if (result === 'ok') {
        logger.log(`[shutdown] xong sau ${ms} ms — thoát 0`);
        exit(0);
        return 0;
      }
      if (result === 'timeout') {
        logger.warn(`[shutdown] chạm mốc cứng ${timeoutMs} ms — thoát 1`);
        try { if (typeof server.closeAllConnections === 'function') server.closeAllConnections(); } catch { /* bỏ qua */ }
      } else {
        logger.warn(`[shutdown] đã phải cắt request dở dang, dọn dẹp xong sau ${ms} ms — thoát 1`);
      }
      exit(1);
      return 1;
    });
    return promise;
  }

  /** Gắn vào process. SIGINT lần hai (Ctrl+C khi chạy tay) thì thoát ngay. */
  function install(proc = process) {
    proc.on('SIGTERM', () => { shutdown('SIGTERM'); });
    proc.on('SIGINT', () => {
      if (promise) {
        logger.warn('[shutdown] SIGINT lần hai — thoát ngay');
        exit(130);
        return;
      }
      shutdown('SIGINT');
    });
  }

  return { shutdown, isDraining, middleware, install };
}

module.exports = { createGracefulShutdown };
