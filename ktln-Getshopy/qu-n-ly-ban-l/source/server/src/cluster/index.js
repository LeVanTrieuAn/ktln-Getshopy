'use strict';
/**
 * Bus dùng chung cho cả tiến trình (xem ./bus.js) — 18/11/2026.
 *
 * require() file này KHÔNG mở kết nối nào: subscriber chỉ mở khi index.js gọi bus.start() lúc
 * server bắt đầu nghe cổng. Nhờ vậy các module đăng ký handler lúc nạp (authB2C, b2c, redis)
 * và kiểm thử nạp chúng không cần Redis.
 *
 * Chủ đề đang dùng:
 *   customer-status  { id }    middleware/authB2C.js — quản trị đổi trạng thái khách
 *   listing-cache    {}        routes/b2c.js        — quản trị thêm/sửa/xoá sản phẩm
 *   mem-cache        { keys }  redis.js (đăng ký ở đây) — invalidate() của bộ đệm L2
 *   ws-broadcast     { data }  cluster/wsFanout.js  — sự kiện WebSocket (STOCK_UPDATE)
 */
const os = require('os');
const crypto = require('crypto');
const redisModule = require('../redis');
const { createBus } = require('./bus');

// hostname = id container trong Docker / tên pod trong Kubernetes; pid + chuỗi ngẫu nhiên để
// hai tiến trình cùng máy (chạy native khi dev) không trùng nhau.
const instanceId = `${os.hostname()}:${process.pid}:${crypto.randomBytes(3).toString('hex')}`;

const { redis } = redisModule;
const bus = createBus({
  publisher: redis,
  createSubscriber: redis ? () => redis.duplicate() : null,
  instanceId,
  channel: process.env.CLUSTER_BUS_CHANNEL || undefined,
});

// Bộ đệm L2 trong tiến trình của redis.js: invalidate() ở bản A chỉ xoá được Map của A.
bus.on('mem-cache', (p) => {
  if (p && Array.isArray(p.keys)) redisModule.dropLocal(p.keys);
});
bus.onResync(() => redisModule.dropLocal());

module.exports = { bus, instanceId };
