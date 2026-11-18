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
Webhook SePay bắn về TAILSCALE FUNNEL, CỔNG 8443. Trên cổng này Funnel chỉ mở ĐÚNG MỘT path:
  https://msi.taild22ef7.ts.net:8443/api/payment/webhook/sepay
    -> http://127.0.0.1:18000/api/payment/webhook/sepay  (cổng 80 của gateway, publish ra
       loopback, GATEWAY_SERVE_PORT) -> upstream nginx chia cho các bản server.
URL này được KHAI THỦ CÔNG trong dashboard SePay MỘT LẦN.
KHÔNG CÒN DÙNG NGROK (đã chuyển sang Funnel; người dùng xác nhận 18/11/2026) — đừng kiểm tra
hay báo động về ngrok nữa. Cổng 443 của Funnel phục vụ web (-> 127.0.0.1:18090) và /hooks
(CD, xem deploy/cd/README.md); trên 443 path webhook cũng chỉ nhận POST (gateway/nginx.conf,
`location = /api/payment/webhook/sepay`).
(Nguồn: Tailscale Funnel — https://tailscale.com/kb/1223/funnel)

SAU MỖI LẦN KHỞI ĐỘNG LẠI MÔI TRƯỜNG, AGENTS PHẢI TỰ KIỂM TRA ĐƯỜNG WEBHOOK VÀ NÓI TO
CHO USER BIẾT webhook có đang nhận được không. KHÔNG ĐƯỢC IM LẶNG CHO QUA.

Lý do phải la: đường webhook đứt thì webhook không về, ĐƠN NẰM PENDING RỒI HẾT HẠN TRONG
KHI TIỀN KHÁCH ĐÃ VÀO TÀI KHOẢN. Không có lỗi nào hiện ra ở đâu cả.

URL KHÔNG ĐỔI giữa các lần chạy — nhưng webhook vẫn MẤT khi:
  - Tailscale tắt / đăng xuất, máy sleep, mất mạng -> bật lại Tailscale; cấu hình Funnel chạy
                                                     --bg được lưu lại, không phải sửa SePay
  - cấu hình Funnel cổng 8443 bị xoá / ghi đè (vd. `tailscale serve reset`) -> mở lại:
      tailscale funnel --bg --https=8443 --set-path=/api/payment/webhook/sepay http://127.0.0.1:18000/api/payment/webhook/sepay
  - đổi GATEWAY_SERVE_PORT (mặc định 18000) mà không sửa Funnel
                                                  -> Funnel trả 502, SePay retry trong im lặng
  - gateway hoặc mọi bản server chết              -> 502 / 503
  - đổi tên máy / tailnet (đổi tên miền *.ts.net) -> PHẢI khai lại URL mới bên SePay

KHI NÀO KHÔNG ẢNH HƯỞNG — ĐỪNG BÁO ĐỘNG GIẢ:
  - docker compose up -d --build / down && up -d / restart / sửa .env rồi up -d
      -> Funnel chạy NGOÀI docker, không bị đụng; chỉ hụt vài giây lúc gateway/server
         được tạo lại (SePay tự gửi lại)
  - deploy qua CD (comment /rebuild)              -> như trên

LỆNH KIỂM TRA — AGENTS CHẠY CÁI NÀY RỒI MỚI BÁO CÁO (PowerShell):
  & "C:\Program Files\Tailscale\tailscale.exe" funnel status
    -> phải có "https://msi.taild22ef7.ts.net:8443 (Funnel on)" kèm dòng
       |-- /api/payment/webhook/sepay proxy http://127.0.0.1:18000/api/payment/webhook/sepay
  Invoke-WebRequest https://msi.taild22ef7.ts.net:8443/api/payment/webhook/sepay -UseBasicParsing
    -> 404 do server trả (route chỉ nhận POST; có header X-Served-By khi SERVED_BY_HEADER=1)
       = ĐƯỜNG THÔNG
    -> 502 / 503          = Funnel tới được máy nhưng gateway / server không trả lời
    -> không kết nối được = Tailscale / Funnel đang tắt
  KHÔNG gửi POST giả lập webhook lên production (adapter /webhook/simulator chỉ bật khi
  NODE_ENV khác production).

BẢO MẬT: Funnel đưa CẢ web (kể cả trang quản trị) ra Internet; cổng 8443 chỉ mở đúng path
webhook, xác thực bằng chữ ký HMAC / API key ở server. Khoá / API key SePay là BÍ MẬT
(không commit, không gửi chat).

AGENTS MUỐN PUSH CODE LÊN GIT, PHẢI BIẾT RẰNG ƯU TIÊN PUSH LÊN NHÁNH MỚI THAY VÌ PUSH THẲNG VÀO MAIN, PHẢI COMMIT TRƯỚC KHI XỬ LÝ CONFLICT, KHI XỬ LÝ CONFLICT LÀ PHẢI ĐỌC KỸ VÀ SOẠN BỘ CÂU HỎI ĐỂ NGƯỜI DÙNG CHỌN(BẠN ĐỀ XUẤT KHUYẾN NGHỊ).