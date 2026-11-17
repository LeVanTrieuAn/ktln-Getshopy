'use strict';
/**
 * Header X-Served-By — 17/11/2026, chỉ phục vụ demo Kubernetes (deploy/k8s-demo/).
 *
 * Vì sao: demo cân bằng tải cần thấy MỖI response do pod nào trả lời. Service của
 * Kubernetes chia kết nối giữa các pod; header mang tên pod (POD_NAME lấy từ downward API
 * trong Deployment, không có thì os.hostname() — trong container chính là tên pod / id
 * container) để demo.ps1 đếm phân bố request giữa các pod.
 *
 * MẶC ĐỊNH TẮT: chỉ bật khi SERVED_BY_HEADER=1 (đúng chuỗi "1"). Production chạy bằng
 * Docker Compose không đặt biến này nên không đổi gì — và cũng không nên bật ở production:
 * tên máy / container là thông tin hạ tầng, khách không cần thấy.
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
