# CHANGELOG - NHẬT KÝ PHÁT TRIỂN ỨNG DỤNG (iStore Analytics)

Tài liệu này dùng để theo dõi lịch sử các phiên bản (Versions), các tính năng mới (Features), các lỗi đã sửa (Bug Fixes) và những thay đổi về kiến trúc (Refactoring) của toàn bộ hệ thống.

---

## [v0.1.0] - 2026-08-03
**Giai đoạn: Hoàn thiện Kiến trúc Nền tảng & Prototype Backend**

### Thêm Mới (Added)
- **Tài liệu chiến lược**: Hoàn thành toàn bộ Blueprint kỹ thuật cho hệ thống (Kiến trúc phân tán, Xử lý dữ liệu lớn, Chiến lược AI Recommendation, Kịch bản Kiểm thử).
- **Environment Management**: Bổ sung hệ thống quản lý biến môi trường (`.env` và `.env.example`) cho cả `client` và `server` để chuẩn bị cho môi trường làm việc nhóm (Team Collaboration). Tích hợp các key quan trọng như `DATABASE_URL`, `CLICKHOUSE_URL`, `OPENROUTER_URL`.

### Thay Đổi (Changed)
- **Kiến trúc Hiển thị Dữ liệu**: Cập nhật logic phân trang tại Frontend và Backend từ Offset Pagination truyền thống sang **Cursor-based Pagination** để xử lý 1 triệu bản ghi mà không làm sập Database.
- **Tối ưu RAM Frontend**: Áp dụng `@tanstack/react-virtual` để kết xuất (render) danh sách dữ liệu theo cơ chế "cuộn ảo", chống tràn RAM trình duyệt.
- **Bảo vệ Hệ thống (Circuit Breaker)**: Thay đổi phản hồi lỗi thành chuẩn HTTP 503 (`503_CIRCUIT_OPEN`) để kích hoạt cơ chế UI dự phòng (Graceful Degradation).

### Đã Sửa (Fixed)
- **Hardcode Security**: Loại bỏ toàn bộ URL cứng (`hardcode URL`) trong file `src/routes/ai.js`. Thay thế bằng biến môi trường `process.env.OPENROUTER_URL`.
- **Cache Invalidation**: Ngăn chặn lỗi dùng cờ `flushAll()` trên Redis, chuyển sang dùng quét mẫu (`SCAN` và `DEL`) để bảo vệ dữ liệu AI Recommendation không bị xóa nhầm khi khách hàng thanh toán.

### Đã Xóa (Removed)
- Dọn dẹp mã nguồn thừa thãi: Xóa `seed-mock.js` và `generate-1m.js` (sau khi xác nhận không còn ref) để tránh rủi ro phá hủy Database.
- Xóa file `readme.txt` tạm thời và tái cấu trúc toàn bộ tài liệu về dạng thư mục phẳng (Flat Structure) dễ tra cứu.
