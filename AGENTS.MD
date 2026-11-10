LƯU Ý:
local-infra-sandbox: Thư mục chứa code của kiến trúc LakeHouse thuộc hệ BigData
ktln-Getshopy: hệ Ecommerce web + backend+ database
Mối quan hệ:
    Hệ Bigdata phục vụ cho việc tổng hợp dữ liệu lớn thành các báo cáo như fact_order_detail, mart_renevue và làm sạch data như processed_data cho service ai-rec trong Ecommerce(AI-rec có thể coi là 1 hệ riêng dù nó nằm trong source của Ecommerce). Từ database postgres của Ecom thì CDC Kafka sẽ thực hiện kéo và đóng gói thành file parquet lên MinIO, sau đó Clickhouse sẽ staging và transform nhờ dbt-core và các models của dbt để cho ra những bảng data tinh chế
AGENTS KHÔNG CÓ QUYỀN TỰ QUYẾT VỀ THAY ĐỔI KIẾN TRÚC, LUỒNG XỬ LÝ,... MÀ KHÔNG CÓ SỰ ĐỒNG Ý/CONFIRM CỦA USER BẰNG NHỮNG CÂU HỎI MÀ AGENTS SẼ HỎI TRƯỚC KHI IMPLEMENT
AGENTS PHẢI THỰC HIỆN PLAN ĐẦY ĐỦ CHI TIẾT BAO GỒM PHASES IMPLEMENT, REQUIREMENTS TỪ BÊN NGOÀI PHẠM VI CỦA AGENTS, TRADE-OFF KHI IMPLEMENT ẢNH HƯỞNG ĐẾN CẢ 2 HỆ HOẶC 1 HỆ
AGENTS PHẢI LƯU Ý CHO USER VỀ CÁC SECRET KEYS ĐANG ĐƯỢC LỘ PUBLIC TRONG CODE VÀ YÊU CẦU NGƯỜI DÙNG PHẢI HIDE NÓ ĐI
ĐÂY LÀ DỰ ÁN THUỘC VỀ KHOÁ LUẬN TỐT NGHIỆP, ĐÒI HỎI PHẢI CHÍNH XÁC VỀ MẶT HỌC THUẬT, AGENTS MUỐN DÙNG NHỮNG THỨ KHÔNG RÕ NGUỒN GỐC CẦN PHẢI ĐƯỢC XÁC NHẬN, PHẢI GHI NGUỒN RÕ RÀNG HOẶC TRỎ REFERENCES THÔI NHƯNG ĐỪNG DETAIL QUÁ, CHỈ CẦN CÓ NGUỒN.
─────────────────────────────────────────────────────────────────────────────
WEBHOOK THANH TOÁN — AGENTS PHẢI CHỦ ĐỘNG CẢNH BÁO
─────────────────────────────────────────────────────────────────────────────
Webhook SePay bắn về một URL công khai là TÊN MIỀN CỐ ĐỊNH của ngrok (gói miễn phí,
dạng <tên>.ngrok-free.app, chạy qua cổng 443). URL này được KHAI THỦ CÔNG trong
dashboard SePay MỘT LẦN. cloudflared quick tunnel chỉ còn dùng để chia sẻ giao diện web,
KHÔNG dùng cho webhook. (Nguồn: README.md, mục "Webhook SePay — ngrok, domain cố định";
ngrok free plan limits: https://ngrok.com/docs/pricing-limits/free-plan-limits)

SAU MỖI LẦN KHỞI ĐỘNG LẠI MÔI TRƯỜNG, AGENTS PHẢI TỰ KIỂM TRA NGROK VÀ NÓI TO
CHO USER BIẾT webhook có đang nhận được không. KHÔNG ĐƯỢC IM LẶNG CHO QUA.

Lý do phải la: ngrok tắt thì webhook không về, ĐƠN NẰM PENDING RỒI HẾT HẠN TRONG
KHI TIỀN KHÁCH ĐÃ VÀO TÀI KHOẢN. Không có lỗi nào hiện ra ở đâu cả.

URL KHÔNG ĐỔI giữa các lần chạy (domain cố định) — nhưng webhook vẫn MẤT khi:
  - ngrok bị kill / chết / chưa bật lại sau khi khởi động máy
  - máy sleep, mất mạng làm tunnel rớt          -> bật lại `ngrok http ...` là chạy, không phải sửa SePay
  - đổi cổng tunnel trỏ vào (3000 <-> 8080)     -> phải chạy lại ngrok với cổng đúng
  - đổi tài khoản/domain ngrok                  -> PHẢI khai lại URL mới bên SePay

KHI NÀO KHÔNG ẢNH HƯỞNG — ĐỪNG BÁO ĐỘNG GIẢ:
  - docker compose up -d --build                -> ngrok chạy NGOÀI docker, không bị đụng
  - docker compose down && docker compose up -d -> như trên
  - docker compose restart                      -> không liên quan
  - sửa .env rồi up -d                          -> không liên quan

LỆNH KIỂM TRA — AGENTS CHẠY CÁI NÀY RỒI MỚI BÁO CÁO:
  pgrep -f 'ngrok http' >/dev/null \
    && echo "ngrok đang chạy, URL cố định" \
    || echo "NGROK CHẾT — bật lại; URL không đổi nên không cần sửa SePay"
  (Windows/PowerShell: Get-Process ngrok -ErrorAction SilentlyContinue)
  Lưu ý: kiểm tiến trình CHỈ cho biết ngrok còn chạy. Chắc chắn hơn thì mở
  https://<tên>.ngrok-free.app/ (thấy trang cảnh báo ngrok rồi vào được web là thông)
  hoặc xem mục Endpoints trên dashboard ngrok.

CỔNG TUNNEL PHẢI KHỚP CÁCH ĐANG CHẠY:
  - chạy bằng docker compose -> ngrok http 3000 --url https://<tên>.ngrok-free.app
    (server KHÔNG expose ra host; Nginx của client proxy /api/)
  - chạy native để dev       -> ngrok http 8080 --url https://<tên>.ngrok-free.app
  Trỏ sai cổng thì tunnel trả 502 và SePay retry trong im lặng.

URL để khai bên SePay luôn có dạng:
  https://<tên>.ngrok-free.app/api/payment/webhook/sepay

BẢO MẬT: authtoken ngrok là BÍ MẬT (không commit, không gửi chat). Tunnel đưa CẢ trang
quản trị ra Internet; domain cố định nên dễ bị dò — xem cảnh báo ở README.md.

AGENTS MUỐN PUSH CODE LÊN GIT, PHẢI BIẾT RẰNG ƯU TIÊN PUSH LÊN NHÁNH MỚI THAY VÌ PUSH THẲNG VÀO MAIN, PHẢI COMMIT TRƯỚC KHI XỬ LÝ CONFLICT, KHI XỬ LÝ CONFLICT LÀ PHẢI ĐỌC KỸ VÀ SOẠN BỘ CÂU HỎI ĐỂ NGƯỜI DÙNG CHỌN(BẠN ĐỀ XUẤT KHUYẾN NGHỊ).