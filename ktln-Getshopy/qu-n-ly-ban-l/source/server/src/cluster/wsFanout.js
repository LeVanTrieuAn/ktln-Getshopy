'use strict';
/**
 * Phát sự kiện WebSocket cho client của MỌI bản server — 18/11/2026, cân bằng tải.
 *
 * Mỗi kết nối WebSocket chỉ nằm trên MỘT bản (nginx chọn bản lúc bắt tay). Trước đây
 * STOCK_UPDATE (đơn mới, thanh toán, huỷ đơn) chỉ gửi cho client của bản đang xử lý request.
 * Giờ: broadcast() = gửi cho client của bản này + publish qua bus; mỗi bản khác nhận tin và
 * gửi cho client của nó. Bản phát bỏ qua tin vọng lại của chính mình (cluster/bus.js), nên mỗi
 * client nhận mỗi sự kiện đúng một lần.
 *
 * KHÔNG dùng cho KPI_UPDATE: bản nào cũng tự đẩy KPI 5 s/lần cho client của mình (index.js),
 * đi qua bus nữa là client nhận N lần.
 */
const TOPIC = 'ws-broadcast';

/**
 * @param {object} opts
 * @param {object} opts.bus                    cluster/bus.js
 * @param {() => Iterable<object>} opts.getClients  client WebSocket của bản này
 * @param {number} [opts.openState]            WebSocket.OPEN
 */
function createWsFanout({ bus, getClients, openState = 1, topic = TOPIC, logger = console }) {
  function sendLocal(data) {
    let sent = 0;
    for (const ws of getClients()) {
      if (ws.readyState !== openState) continue;
      try { ws.send(data); sent += 1; } catch (err) { logger.warn('[ws] gửi lỗi:', err.message); }
    }
    return sent;
  }

  bus.on(topic, (p) => {
    if (p && typeof p.data === 'string') sendLocal(p.data);
  });

  /** data: chuỗi JSON đã tuần tự hoá. Promise<boolean> của phần publish, không cần await. */
  function broadcast(data) {
    return bus.emit(topic, { data });
  }

  return { broadcast, sendLocal };
}

module.exports = { createWsFanout, TOPIC };
