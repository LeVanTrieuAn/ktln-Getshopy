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
Webhook SePay bắn về một URL công khai do cloudflared tạo. URL này được KHAI
THỦ CÔNG trong dashboard SePay — không có cách nào tự đồng bộ.

SAU MỖI LẦN KHỞI ĐỘNG LẠI MÔI TRƯỜNG, AGENTS PHẢI TỰ KIỂM TRA TUNNEL VÀ NÓI TO
CHO USER BIẾT URL CÓ ĐỔI KHÔNG. KHÔNG ĐƯỢC IM LẶNG CHO QUA.

Lý do phải la: URL sai thì webhook không về, ĐƠN NẰM PENDING RỒI HẾT HẠN TRONG
KHI TIỀN KHÁCH ĐÃ VÀO TÀI KHOẢN. Không có lỗi nào hiện ra ở đâu cả.

KHI NÀO URL ĐỔI — PHẢI LA LÊN:
  - cloudflared bị kill / chết / chạy lại       -> subdomain ngẫu nhiên MỚI
  - máy sleep, mất mạng làm tunnel rớt          -> chạy lại là đổi
  - đổi cổng tunnel trỏ vào (3000 <-> 8080)     -> phải dựng tunnel mới

KHI NÀO KHÔNG ĐỔI — ĐỪNG BÁO ĐỘNG GIẢ:
  - docker compose up -d --build                -> tunnel không bị đụng
  - docker compose down && docker compose up -d -> cloudflared chạy NGOÀI docker
  - docker compose restart                      -> không liên quan
  - sửa .env rồi up -d                          -> không liên quan
  (đã kiểm chứng: rebuild toàn bộ stack, PID cloudflared không đổi, log 0 dòng
   ngắt kết nối, URL giữ nguyên)

LỆNH KIỂM TRA — AGENTS CHẠY CÁI NÀY RỒI MỚI BÁO CÁO:
  pgrep -f 'cloudflared tunnel' >/dev/null \
    && echo "tunnel sống, URL không đổi" \
    || echo "TUNNEL CHẾT — chạy lại và PHẢI cập nhật URL bên SePay"

CỔNG TUNNEL PHẢI KHỚP CÁCH ĐANG CHẠY:
  - chạy bằng docker compose -> cloudflared tunnel --url http://localhost:3000
    (server KHÔNG expose ra host; Nginx của client proxy /api/)
  - chạy native để dev       -> cloudflared tunnel --url http://localhost:8080
  Trỏ sai cổng thì tunnel trả 502 và SePay retry trong im lặng.

URL để khai bên SePay luôn có dạng:
  https://<subdomain>.trycloudflare.com/api/payment/webhook/sepay

MUỐN HẾT PHIỀN: dựng named tunnel với domain riêng (cloudflared tunnel create +
tunnel route dns) thì URL cố định vĩnh viễn. Quick tunnel chỉ hợp lúc dev.

AGENTS MUỐN PUSH CODE LÊN GIT, PHẢI BIẾT RẰNG ƯU TIÊN PUSH LÊN NHÁNH MỚI THAY VÌ PUSH THẲNG VÀO MAIN, PHẢI COMMIT TRƯỚC KHI XỬ LÝ CONFLICT, KHI XỬ LÝ CONFLICT LÀ PHẢI ĐỌC KỸ VÀ SOẠN BỘ CÂU HỎI ĐỂ NGƯỜI DÙNG CHỌN(BẠN ĐỀ XUẤT KHUYẾN NGHỊ)