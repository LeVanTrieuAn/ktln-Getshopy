Readme hướng dẫn chạy dự án

1. Link video demo: https://drive.google.com/file/d/10CG1LvH5hOHkfzXloidJxYwddRhRjzaX/view?usp=sharing

2. Công nghệ sử dụng
Backend: PHP 8.2 thuần (không framework), Apache 2.4, PDO MySQL
Database: MySQL 8.0
Frontend: HTML, CSS, Vanilla JS (ES6 modules), Bootstrap 5, Bootstrap Icons
Container: Docker + Docker Compose
Tích hợp: Gmail SMTP, OpenRouter AI, SePay Payment

3. Yêu cầu trước khi chạy
3.1 Docker (khuyến nghị): Docker Desktop + Git
3.2 Không Docker (XAMPP): PHP 8.2+, MySQL 8+, Apache 2.4+
4. Hướng dẫn tạo file .env
Copy mẫu: Copy-Item .env.example .env (PowerShell) hoặc cp .env.example .env (bash)
Điền giá trị dựa trên .env.example:
SMTP Gmail (bật 2FA + tạo App Password)
APP_BASE_URL=http://localhost:8080
OpenRouter AI (optional — để trống nếu không test AI Chatbot)
SePay (optional — để trống nếu không test QR payment)

5. Chạy trực tiếp trên web đã deploy
URL: https://posss.onrender.com/frontend/login.html
Không cần clone source, không cần cài Docker/XAMPP
Admin: admin / admin
Nhân viên demo: hiennguyen011973 / anthe123
Lưu ý: Render free tier có thể cold-start 30-60s lần đầu truy cập

6. Chạy bằng Docker (khuyến nghị nếu cài local)
cd qu-n-ly-ban-l
docker compose up -d --build
docker compose ps
Frontend: http://localhost:8080/frontend/login.html
Backend API: http://localhost:8080/backend/
phpMyAdmin: http://localhost:8081 (user root / pass root123)
MySQL (từ host): localhost:3308

7. Chạy bằng XAMPP (không Docker)
Copy toàn bộ project vào C:\xampp\htdocs\qu-n-ly-ban-l
Mở phpMyAdmin → import backend/database.sql
Chạy migration theo thứ tự: 001 → 002 → 003 → 004 → 005 trong backend/migrations/
Tạo .env ở root + copy sang backend/.env nếu cần
Truy cập http://localhost/qu-n-ly-ban-l/frontend/login.html

8. Quy ước dữ liệu SQL
File chính: backend/database.sql — schema + admin seed
Migrations bắt buộc: backend/migrations/ chạy theo thứ tự số
Patch: backend/database_patch.sql

9. Chính sách thanh toán
CASH: mặc định, thu tiền mặt tại quầy
SePay QR: optional, cần cấu hình SEPAY_* và chạy migration 004, 005

10. Tài khoản test mặc định
Trên web deploy https://posss.onrender.com:
Admin: admin / admin
Nhân viên demo: hiennguyen011973 / anthe123
Khi chạy local (database fresh):
Admin: admin / admin
Nhân viên mới tạo: mật khẩu tạm = MSSV trưởng nhóm (52300003) — phải vào qua link email 1 phút
Quy tắc login: username = phần trước @ trong email (VD admin@gmail.com → login admin)

11. Lệnh vận hành thường dùng

docker compose logs -f backend       # xem log
docker compose up -d --build         # rebuild
docker compose down                  # dừng
docker compose down -v               # dừng + xoá dữ liệu
docker exec -it phonestore_db mysql -u root -proot123 phonestore_pos   # vào MySQL CLI

12. Gợi ý xử lý lỗi nhanh
API lỗi do DB chưa sẵn: chờ 15-30s healthcheck
Email không gửi: kiểm tra Gmail App Password + 2FA
AI Chatbot trả JSON lỗi: OPENROUTER_MODEL phải là model free-tier (VD deepseek/deepseek-chat-v3-0324:free)
SePay QR không hiện: kiểm tra SEPAY_BANK_CODE, SEPAY_ACCOUNT_NUMBER
Port conflict: đổi ports trong docker-compose.yml (VD 8080:80 → 8090:80)


