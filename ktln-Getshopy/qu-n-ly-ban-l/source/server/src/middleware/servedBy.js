'use strict';
/**
 * Header X-Served-By — 17/11/2026, chỉ phục vụ demo Kubernetes (deploy/k8s-demo/).
 *
 * Vì sao: demo cân bằng tải cần thấy MỖI response do pod nào trả lời. Service của
 * Kubernetes chia kết nối giữa các pod; header mang tên pod (POD_NAME lấy từ downward API
 * trong Deployment, không có thì os.hostname() — trong container chính là tên pod / id
 * container) để demo.ps1 đếm phân bố request giữa các pod.
 *
 * MẶC ĐỊNH TẮT: chỉ bật khi SERVED_BY_HEADER=1 (đúng chuỗi "1").
 *
 * 18/11/2026 — cân bằng tải bằng Docker Compose (nhiều bản `server` sau nginx gateway):
 * docker-compose.yml đặt SERVED_BY_HEADER=${SERVED_BY_HEADER:-1} để scripts/lb-demo.ps1 đếm
 * phân bố request. Tên ở đây là hostname = id ngắn của container. Tên máy / container là thông
 * tin hạ tầng, khách không cần thấy: cổng PUBLIC 8090 của gateway gỡ header này
 * (proxy_hide_header trong gateway/nginx.conf); muốn tắt hẳn thì đặt SERVED_BY_HEADER=0 trong .env.
 *
 * Không phụ thuộc thư viện nào (env, hostname truyền vào được) để kiểm thử bằng `node --test`.
 */
const os = require('os');

/** Trả middleware Express, hoặc null khi tắt (bên gọi không gắn gì cả). */
function createServedBy(env = process.env, hostname = os.hostname) {
  if (env.SERVED_BY_HEADER !== '1') return null;
  const name = env.POD_NAME || hostname();
  return function servedBy(_req, res, next) {
    res.setHeader('X-Served-By', name);
    next();
  };
}

module.exports = { createServedBy };
