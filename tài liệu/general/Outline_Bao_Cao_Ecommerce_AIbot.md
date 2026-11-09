# Outline báo cáo — phần E-commerce và AI-bot

- **Dự án:** Hệ thống thương mại điện tử tích hợp xử lý dữ liệu lớn và AI trên nền Data Lake
- **GVHD:** ThS. Võ Văn Thành
- **Phạm vi file này:** hai hệ **E-commerce** và **AI-bot** (ký hiệu **[A]**). Hệ **BigData** (**[B]**) và **AI-Rec** (**[C]**) do người khác viết trong cùng một báo cáo; ở đây chỉ có tham chiếu chéo.
- **Cập nhật:** 11/10/2026
- **Nguồn:** [mo-ta-de-tai.md](../../mo-ta-de-tai.md), [README.md](../../README.md), mã nguồn `ktln-Getshopy/qu-n-ly-ban-l/source`, mẫu khoa [baocao.pdf](../../baocao.pdf).

---

## 0. Quy cách trình bày (theo mẫu khoa)

- Khổ giấy: A4 (đo từ baocao.pdf).
- Font: Times New Roman 13 pt; mục 14 pt đậm; tên chương 16 pt đậm.
- Giãn dòng 1,5; canh đều hai bên; thụt đầu dòng.
- Lề: trái 3,5 cm; phải 2 cm; trên 2 cm; dưới 2 cm.
  - Trái/phải đo từ mẫu.
  - **Trên/dưới là tạm thời**, chưa có quy định chính thức.
- Số trang: La Mã cho phần đầu; Ả Rập từ Chương 1.
- Đánh số: Chương 1, 1.1, 1.1.1; Hình 4.1; Bảng 4.2.
- Trích dẫn: **IEEE**, danh sách đánh số theo thứ tự xuất hiện (quyết định của nhóm).

> [!NOTE]
> baocao.pdf là báo cáo "Dự án CNTT" của nhóm khác, dùng làm khuôn. **Không sao chép nội dung**, không đưa tên hay mã số sinh viên trong đó vào báo cáo.

---

## 1. Phần đầu

- Bìa chính, bìa phụ (ghi tên GVHD).
- Lời cảm ơn, lời cam đoan.
- Tóm tắt (Việt), Abstract (Anh).
- Mục lục, danh mục hình, danh mục bảng.
- Danh mục chữ viết tắt: TMĐT, CSDL, API, CDC, LLM, STT, WER, NLI, RAG…

> [!WARNING]
> Lời cam đoan chỉ được ghi "số liệu có nguồn" khi **mọi con số** trong báo cáo đúng là đã đo hoặc có trích dẫn. Dữ liệu giả lập phải nói rõ là giả lập.

---

## 2. Chương 1. Mở đầu

- **1.1 Lý do chọn đề tài**
  - Bán lẻ công nghệ trực tuyến.
- **1.2 Mục tiêu**
  - Ứng dụng chạy mượt ở quy mô 600.000 sản phẩm.
  - Có trợ lý AI: chatbot, tìm kiếm thông minh, tìm bằng ảnh, nhập giọng nói.
- **1.3 Đối tượng và phạm vi**
  - 1.3.1 Đối tượng.
  - 1.3.2 Phạm vi: dữ liệu giả lập; thanh toán ở chế độ thử nghiệm; AI-Rec và BigData chỉ tham chiếu.
- **1.4 Phương pháp**
  - 1.4.1 Lý thuyết.
  - 1.4.2 Thực nghiệm.
- **1.5 Ý nghĩa nghiên cứu:** thực tiễn và học thuật.

---

## 3. Chương 2. Tổng quan

- **2.1 Khảo sát bán lẻ công nghệ trực tuyến**
  - 2.1.1 Tổng quan quy trình.
  - 2.1.2 Thách thức.
- **2.2 Giải pháp:** hệ thống tổng thể (viết chung).
- **2.3 Kế hoạch thực hiện:** bảng các giai đoạn.
- **2.4 Chức năng nghiệp vụ**
  - 2.4.1 Khách hàng (B2C, 8 trang).
  - 2.4.2 Quản trị viên (B2B, 11 trang).
  - 2.4.3 Yêu cầu hệ thống.
- **2.5 Kết quả đạt được:** chỉ nêu cái có bằng chứng.
- Danh sách trang lấy từ [QA_Test_Plan.md](../../ktln-Getshopy/qu-n-ly-ban-l/source/QA/QA_Test_Plan.md).

---

## 4. Chương 3. Tìm hiểu công nghệ (mục 3.1 của [A])

Mỗi công nghệ gồm: mô tả ngắn, lý do chọn, nguồn trích [n]. Tự viết, không chép.

- 3.1.1 Frontend: React 19, Vite, Ant Design 5, Leaflet, ECharts, Three.js.
- 3.1.2 Backend: Node.js, Express 5, Prisma 5.
- 3.1.3 CSDL và cache: PostgreSQL 16, Redis 7 (ClickHouse: tham chiếu sang [B]).
- 3.1.4 Dịch vụ AI: Gemini API (chat, thị giác, giọng nói); mô hình NLI mDeBERTa; LLM qua HuggingFace.
- 3.1.5 Thanh toán: SePay, webhook.
- 3.1.6 Hạ tầng: Docker, Docker Compose, Cloudflare Tunnel.
- Bảng 3.1: tổng hợp công nghệ.

---

## 5. Chương 4. Phân tích và thiết kế hệ thống

### 4.1 Phân tích

- 4.1.1 Cấu trúc hệ thống.
- 4.1.2 Yêu cầu chức năng: tài khoản; sản phẩm; giỏ hàng; thanh toán; đơn hàng; quản trị; chatbot; tìm kiếm thông minh; tìm bằng ảnh; nhập giọng nói.
- 4.1.3 Yêu cầu phi chức năng:
  - Hiệu năng ở quy mô lớn.
  - An toàn tồn kho khi cạnh tranh.
  - Bảo mật thanh toán (server tự tính lại tổng tiền, chống trùng webhook).
  - Quyền riêng tư với âm thanh.

### 4.2 Thiết kế

- 4.2.1 **Use case.** Sơ đồ tổng quát và theo phân hệ. Đặc tả bảng, sequence, activity cho các use case trọng yếu:
  - Checkout và giữ chỗ tồn kho.
  - Webhook thanh toán SePay (khớp, thiếu/dư tiền, trùng, trễ hạn).
  - Chat với chatbot.
  - Tìm kiếm bằng ảnh.
  - Nhập bằng giọng nói.
- 4.2.2 **ERD** (PostgreSQL): Product, Category, Brand, Order, Voucher, FlashSale, Review, Wishlist, ChatLog…
- 4.2.3 **Mô hình dữ liệu vật lý.**

### 4.3 Kiến trúc

- 4.3.1 Phân rã dịch vụ: client (Nginx) → server (Express) → PostgreSQL, Redis, ClickHouse, ai-bot, ai-rec.
- 4.3.2 Chi tiết từng dịch vụ.
- 4.4 Tích hợp ba hệ: viết chung với [B] và [C].

---

## 6. Chương 5. Thực thi hệ thống (mục 5.A của [A])

- **5.A.1 Người dùng và xác thực:** JWT, đăng nhập Google, phân quyền B2C và B2B.
- **5.A.2 Sản phẩm**
  - Danh sách phân trang (limit tối đa 100).
  - Lọc đa tiêu chí, chi tiết sản phẩm.
  - Cache Redis.
  - Circuit breaker cho ClickHouse.
- **5.A.3 Đơn hàng và thanh toán**
  - Giữ kho (`on_hand`/`reserved`), khóa tư vấn.
  - Giới hạn đơn chờ.
  - Mã đối soát `GS…`, QR động.
  - Webhook: idempotency, thiếu/dư tiền, trễ hạn.
  - Job hết hạn đơn (60 giây).
  - Hoàn tiền.
- **5.A.4 Tồn kho:** quản lý tồn, nhả giữ chỗ khi hủy hoặc hết hạn.
- **5.A.5 AI-bot** (bản nháp đầy đủ: `draft_5A5_aibot.md` trong thư mục artifact)
  - **5.A.5.1 Tổng quan kiến trúc**
    - Container Node.js, cổng 3001 nội bộ.
    - Đường đi: trình duyệt → Nginx → server → ai-bot.
    - Bảng endpoint.
    - Dùng chung `KnowledgeCache` và Prisma.
  - **5.A.5.2 Chatbot tư vấn**
    - Nhận diện ý định hai tầng (luật + NLI), khoảng 46 nhãn.
    - Điều chỉnh ý định theo thương hiệu và danh mục.
    - Dựng ngữ cảnh từ CSDL: giá, thương hiệu, danh mục, chuỗi nới lỏng 4 mức, câu nối tiếp.
    - Sinh câu trả lời bằng LLM với ràng buộc prompt.
    - Ghi `ChatLog`.
  - **5.A.5.3 Tìm kiếm thông minh**
    - LLM rút từ khóa/thương hiệu/danh mục/giá dạng JSON.
    - Rơi về luật khi LLM lỗi.
    - **Giá luôn trích bằng luật** (6 mẫu).
  - **5.A.5.4 Tìm kiếm bằng ảnh**
    - Gemini thị giác phân tích ảnh.
    - Kết hợp ảnh và chữ theo 4 trường hợp.
    - Chuỗi model `GEMINI_MODELS`.
  - **5.A.5.5 Nhập giọng nói**
    - MediaRecorder, tối đa 15 giây, 24 kbps.
    - `POST /api/ai/transcribe`; Gemini chép lại nguyên văn.
    - **Không tự gửi**: người dùng kiểm tra rồi bấm Enter.
    - Giới hạn kích thước, MIME, tần suất.
    - Không lưu âm thanh; có thông báo quyền riêng tư.
  - **5.A.5.6 Suy giảm êm:** mỗi chức năng có đường lui khi dịch vụ ngoài lỗi (câu trả lời dựng sẵn, luật, thử model kế).
  - **5.A.5.7 Hiệu quả và đánh giá:** intent, truy xuất, độ trễ, WER (**chưa đo**).

---

## 7. Chương 6. Triển khai hệ thống (mục của [A])

- 6.1 Tổng quan: [docker-compose.yml](../../docker-compose.yml) (14 service), viết chung.
- 6.2 Đóng gói và biến môi trường (`.env`, quản lý khóa).
- 6.3 Điều phối truy cập: Nginx proxy `/api/`, `server` chuyển tiếp sang `ai-bot`.
- 6.4 Truy cập Internet và webhook SePay bằng Cloudflare Tunnel; hạn chế của quick tunnel (URL đổi khi tunnel khởi động lại, phải cập nhật tay bên SePay).
- 6.5 Seed dữ liệu và sao lưu.

---

## 8. Chương 7. Demo hệ thống

- 7.1 Kịch bản: khách hàng, quản trị viên.
- 7.2 Ảnh chụp và mô tả từng trang:
  - B2C: trang chủ, danh sách, chi tiết, so sánh, giỏ hàng, checkout, tài khoản, onboarding.
  - B2B: dashboard, quản lý, fulfillment, đối soát.
  - Chatbot, tìm kiếm ảnh, nút micro và thông báo quyền riêng tư.

---

## 9. Chương 8. Kết luận (mục của [A])

- 8.1 Tổng quan kết quả.
- 8.2.1 **Đánh giá chi tiết E-commerce và AI-bot:**
  - Hiệu năng ở 600.000 sản phẩm (kèm số Supabase cũ làm "giai đoạn đầu", ghi rõ lỗi thời).
  - Nhận diện ý định.
  - Truy xuất sản phẩm.
  - Giọng nói: WER và độ trễ.
  - So sánh có/không LLM (nếu thực hiện).
- 8.3 Hạn chế: dữ liệu giả lập; độ chính xác ý định; phụ thuộc dịch vụ ngoài và model preview; quick tunnel; endpoint AI chưa xác thực.
- 8.4 Hướng phát triển: khôi phục và đánh giá LLM; cải thiện intent; tìm kiếm ngữ nghĩa; named tunnel; bảo mật; tách vi dịch vụ.
- 8.5 Kết luận.

---

## 10. Phần cuối

- **Tài liệu tham khảo:** IEEE, một danh sách chung cho cả báo cáo.
- **Phụ lục:**
  - ERD đầy đủ.
  - Danh sách API.
  - Danh sách 46 intent.
  - Bảng cấu hình biến môi trường **không kèm giá trị khóa**.
  - Kịch bản kiểm thử và kết quả chạy.

---

## 11. Hình và bảng cần chuẩn bị

- Sơ đồ: kiến trúc tổng thể; luồng request; luồng checkout và webhook; pipeline chatbot; luồng giọng nói.
- UML: use case, sequence, activity cho các use case trọng yếu.
- CSDL: ERD; mô hình vật lý.
- Ảnh chụp: từng trang B2C và B2B; chatbot; tìm kiếm ảnh; nút micro.
- Bảng: công nghệ; yêu cầu; use case; endpoint AI-bot; kết quả đo.

---

## 12. Tình trạng bằng chứng

- Điều kiện đo (máy, Docker, số bản ghi): **đã ghi** ngày 11/10/2026 — 600.000 sản phẩm, 3.000.005 đơn.
- Hiệu năng ở 600.000 sản phẩm: **chưa đo lại**.
- Intent, truy xuất: số cũ chưa đủ tin cậy; cần bộ có đáp án.
- Voice WER và độ trễ: **chưa đo** (mới thử một lần trên giọng tổng hợp).
- Nút micro trên giao diện: chưa thử với micro thật.
- LLM chat: đang không chạy (HuggingFace hết credit); chatbot dùng chế độ dự phòng.
- Số danh mục, hãng: DB có 34 và 33; tài liệu ghi 49 và 67 (đã sửa chuỗi "67" thành 33 trong mã; còn comment cũ).
- Số Supabase cũ (BENCHMARK.md): đo ngày 25/08/2026 trên 50.007 sản phẩm; **lỗi thời**.

---

## 13. Việc còn mở

1. Trả lời 5 câu hỏi cuối kế hoạch đo:
   - Có làm so sánh có/không LLM không.
   - Có cho phép tạm dừng `dbt-scheduler` khi đo không.
   - Gán nhãn khoảng 300 câu và thu âm giọng thật.
   - Đo ở 600.000 hay seed lên khoảng 1 triệu.
   - Ai đo phần ClickHouse so PostgreSQL (đề xuất: [B]).
2. Xin văn bản quy định của khoa về **lề trên và dưới**.
3. Tra và điền tài liệu tham khảo IEEE (một số nguồn chưa xác minh thông tin trích dẫn).
4. Thống nhất số liệu chung và thuật ngữ với người viết [B] và [C].
5. Thử nút micro với micro thật và thử tìm bằng ảnh sau khi đổi cách gửi khóa Gemini.

---

> [!WARNING]
> **Bảo mật:** `GOOGLE_AI_KEY`, `HF_API_KEY` và mật khẩu Postgres đang nằm thật trong `.env`. Hãy kiểm tra chúng không bị git theo dõi (`git ls-files .env`) và đổi khóa nếu từng đẩy lên remote. Khóa Gemini từng nằm trong URL nên có thể đã lọt log. Phụ lục cấu hình trong báo cáo **không được chứa giá trị khóa**.
