-- Tìm kiếm không dấu (GET /api/b2c/products): unaccent(name) ILIKE unaccent('%dien thoai%')
-- khớp được tên có dấu "Điện thoại". Trước 11/11/2026 server tự chạy lệnh này mỗi lần khởi
-- động (code của nhánh hotfix-3); chuyển về migration để thay đổi cấu trúc DB nằm trong lịch
-- sử _prisma_migrations như mọi thay đổi khác.
--
-- unaccent là extension "trusted" (PostgreSQL 13+): chủ DB cài được, không cần superuser.
-- https://www.postgresql.org/docs/16/unaccent.html
-- Chỉ thêm hàm, không đụng bảng/dữ liệu nào; không ảnh hưởng CDC (Debezium không bắt DDL).
CREATE EXTENSION IF NOT EXISTS unaccent;
