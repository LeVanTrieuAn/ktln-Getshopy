'use strict';
// Redis Pub/Sub giả cho kiểm thử cân bằng tải (18/11/2026): nhiều "client" dùng chung một
// broker trong bộ nhớ, giao tin bất đồng bộ (setImmediate) như Redis thật. Mô phỏng được
// rớt kết nối (drop) và nối lại (reconnect: bắn 'ready' lần nữa). Không cần Redis thật.

function createBroker() {
  const subs = new Set();   // { channel, listener, client }
  const published = [];

  function client({ ready = true } = {}) {
    const handlers = {};
    const c = {
      isReady: ready,
      isOpen: ready,
      on(ev, fn) { (handlers[ev] ||= []).push(fn); return c; },
      emit(ev, ...args) { (handlers[ev] || []).forEach((fn) => fn(...args)); },
      async connect() { c.isOpen = true; c.isReady = true; c.emit('ready'); },
      async subscribe(channel, listener) { subs.add({ channel, listener, client: c }); },
      async publish(channel, message) {
        if (!c.isReady) throw new Error('client đóng');
        published.push({ channel, message });
        let n = 0;
        for (const s of subs) {
          if (s.channel !== channel) continue;
          n += 1;
          setImmediate(() => { if (s.client.isReady) s.listener(message, channel); });
        }
        return n;
      },
      async disconnect() { c.isOpen = false; c.isReady = false; for (const s of [...subs]) if (s.client === c) subs.delete(s); },
      async quit() { return c.disconnect(); },
      duplicate() { return client({ ready: false }); },
      /** Mất kết nối: tin gửi lúc này không tới được client này. */
      drop() { c.isReady = false; },
      /** Nối lại: node-redis bắn 'ready' sau mỗi lần nối lại. */
      reconnect() { c.isReady = true; c.emit('ready'); },
    };
    return c;
  }

  return { client, published, subs };
}

/** Chờ các setImmediate của broker chạy xong. */
const flush = () => new Promise((r) => setImmediate(() => setImmediate(r)));

const silentLogger = { log() {}, warn() {}, error() {} };

module.exports = { createBroker, flush, silentLogger };
