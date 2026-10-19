# CHANGELOG - NHẬT KÝ PHÁT TRIỂN ỨNG DỤNG (iStore Analytics)

Tài liệu này dùng để theo dõi lịch sử các phiên bản (Versions), các tính năng mới (Features), các lỗi đã sửa (Bug Fixes) và những thay đổi về kiến trúc (Refactoring) của toàn bộ hệ thống.

---

## [v0.3.0] - 2026-10-19
**Giai đoạn: Củng cố AI-bot (chuỗi LLM, ngân sách) và ổn định ảnh sản phẩm lấy từ TGDĐ**

### Thêm Mới (Added)
- **`ai-bot/src/ai/llmClient.js`**: chuỗi nhà cung cấp LLM HuggingFace → Google Gemini → OpenRouter → rule-based, có ngắt tạm theo nhà cung cấp và log `[LLM][ALERT]` khi khóa hết credit/hạn mức/không hợp lệ.
- **`ai-bot/src/services/PriceParser.js`** + `tests/price-parser.test.js` (34 ca): đọc ngân sách tiếng Việt (dưới / không quá / tối đa / trên / từ…đến / tầm), dùng chung cho chatbot và smart-search.
- **`/api/health` (ai-bot)**: thêm `llm_providers` để biết khóa nào đang chết (không chứa khóa).
- **`source/scripts/mirror-product-images.js`**: tải ảnh sản phẩm từ `cdn.tgdd.vn` về bucket công khai `product-images` của MinIO (idempotent, không cần thư viện ngoài, ký AWS SigV4). Hiện mirror 110 URL, không có lỗi.
- **Nginx client**: `location /product-images/` proxy sang MinIO và `sub_filter` đổi `https://cdn.tgdd.vn/` thành `/product-images/` trong JSON của `/api/`.

### Thay Đổi (Changed)
- **Ngân sách là ràng buộc cứng**: không còn nới giá ×1.3 hay bỏ giá khi hết hàng. Khi không có sản phẩm trong ngân sách, bot nói rõ và gợi ý sản phẩm gần ngưỡng nhất (`budget.status` = `over | none | other_brand`). Câu thông báo dựng sẵn, không qua LLM.
- **`SearchService`**: luật giá luôn ưu tiên, LLM chỉ bổ sung; không còn trả sản phẩm sai danh mục.
- **`ai/llm.js`**: viết lại để dùng `generateText`, giữ nguyên system prompt.
- **`KnowledgeCache.detectCategory`**: khớp theo ranh giới từ.
- **Danh sách sản phẩm chatbot**: gộp theo tên (seed có dòng trùng tên).

### Đã Sửa (Fixed)
- "Điện thoại dưới 5 triệu" trả sản phẩm 7–8 triệu; "dưới 1 triệu" trả điện thoại 41 triệu; "ốp lưng iphone dưới 200k" trả điện thoại. Trước khi sửa: 16/40 ca test vượt ngân sách mà không báo; sau khi sửa không còn ca nào vượt mà không báo rõ (một lần chạy).
- Gemini 3 trả câu bị cắt cụt do "suy nghĩ" tiêu hết token (đặt `thinkingLevel: minimal`).
- Gemini trả HTTP 400 `API_KEY_INVALID` (không phải 401) cho khóa sai: trước đây không được nhận ra.
- Ảnh sản phẩm `cdn.tgdd.vn` bị 403 do chặn hotlink theo `Referer` (xem mục TGDĐ).

### Về dữ liệu crawl TGDĐ
- Dữ liệu sản phẩm là dữ liệu thử nghiệm lấy từ Thế Giới Di Động; **ảnh thuộc bản quyền của TGDĐ**, chỉ dùng cho mục đích học tập, không thương mại. Báo cáo cần ghi rõ nguồn.
- `cdn.tgdd.vn` trả 403 khi `Referer` là `localhost:3000` (200 khi không có Referer hoặc Referer là thegioididong.com). `cdnv2.tgdd.vn` không bị chặn (đo ngày 19/10/2026).
- DB có 600.000 sản phẩm nhưng chỉ 496 URL ảnh khác nhau; 110 URL thuộc `cdn.tgdd.vn` (222.308 sản phẩm) được mirror. **DB giữ nguyên URL gốc**, nên CDC, ClickHouse và ai-rec không bị ảnh hưởng. Ảnh `cdn.tgdd.vn` mới thêm sau này cần chạy lại script.
- Hạn chế: chỉ có tác dụng với bản chạy docker (qua Nginx, cổng 3000), không áp dụng cho dev native (vite); chưa kiểm tra luồng admin sửa sản phẩm rồi lưu (URL `/product-images/` có thể bị ghi ngược vào DB).

### Hạn chế & việc còn lại
- Tìm bằng ảnh và giọng nói chỉ dùng Gemini, chưa có đường dự phòng.
- Giọng nói mới thử với giọng tổng hợp, chưa thử micro thật hay Safari; tìm ảnh mới thử bằng ảnh sản phẩm lấy từ DB.
- Phân loại intent (`huggingface.js`) vẫn phụ thuộc HuggingFace (chỉ model đầu tiên).
- Catalog seed không có điện thoại dưới 6.440.000đ và laptop dưới 13.840.000đ (dữ liệu mô phỏng).
- `HF_API_KEY` hiện hết credit (HTTP 402); chuỗi vẫn chạy nhờ Gemini và OpenRouter.

---

## [v0.2.0] - 2026-08-17
**Giai đoạn: Tích hợp Hugging Face AI — Thay thế toàn bộ Pipeline NLP tự code**

### Thêm Mới (Added)
- **`src/ai/huggingface.js`**: Module NLP mới duy nhất, thay thế toàn bộ 17 files AI cũ. Gọi Hugging Face Inference API để phân loại Intent (48 loại) từ tin nhắn khách hàng.
- **48 Intent Labels**: Mở rộng danh sách Intent (từ ~20 lên 48) với đầy đủ các nhóm: tìm kiếm, tư vấn, kỹ thuật, chính sách, dịch vụ, so sánh, quản lý đơn.
- **Rule-based Pre-classifier**: Xử lý pattern đơn giản (chào hỏi, giao hàng, thanh toán) ngay lập tức mà không cần gọi API.
- **In-memory Cache Layer**: Cache kết quả phân loại (200 entries, TTL 10 phút) giảm thiểu API calls.
- **Biến môi trường mới**: `HF_API_KEY`, `HF_MODEL`, `HF_CONFIDENCE_THRESHOLD` trong `.env` và `.env.example`.
- **Dependency mới**: `@huggingface/inference` thay thế `natural`.

### Thay Đổi (Changed)
- **`src/routes/ai.js`**: Viết lại hoàn toàn phần NLP pipeline. Xóa toàn bộ imports cũ (13 dòng require). Pipeline mới: `classifyIntent()` → Secondary Correction → Handler dispatch.
- **Tài liệu `ai_algorithms_summary.md`**: Viết lại hoàn toàn, mô tả kiến trúc Hugging Face mới thay vì 8 thuật toán cũ.
- **Tài liệu `Chien_Luoc_AI_Recommendation_DataLake.md`**: Cập nhật section 2.1 và 2.2 phản ánh chiến lược AI mới.

### Đã Xóa (Removed)
- **`src/ai/` (17 files)**: Xóa toàn bộ pipeline AI tự code bao gồm NaiveBayes, LogisticRegression, LinearSVM, EnsembleClassifier, DecisionTree, FSM, NER, SpellCorrector, CosineSimilarity, CollaborativeFilter, TFIDFVectorizer, Tokenizer, langDetect, englishNLP, train.js, trainingData.js, ai_model_weights.json (~4MB).
- **Tính năng FSM** (Luồng đặt hàng có cấu trúc): Tạm gỡ bỏ — có thể khôi phục sau.
- **Tính năng DecisionTree** (Tư vấn chọn máy): Tạm gỡ bỏ — có thể khôi phục sau.
- **Tính năng CosineSimilarity** (Sản phẩm tương tự): Tạm gỡ bỏ.
- **Tính năng CollaborativeFilter** (Gợi ý bán chéo): Tạm gỡ bỏ.
- **Dependency `natural`**: Không còn dùng sau khi xóa `englishNLP.js`.

### Backup
- Toàn bộ code AI cũ được giữ nguyên tại **`src/AI (Not used)/`** — không có bất kỳ import nào trỏ vào. Hoạt động như "thùng chứa dữ liệu không có dây điện".

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
