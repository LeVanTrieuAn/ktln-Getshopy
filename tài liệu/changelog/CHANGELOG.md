# CHANGELOG - NHẬT KÝ PHÁT TRIỂN ỨNG DỤNG (iStore Analytics)

Tài liệu này dùng để theo dõi lịch sử các phiên bản (Versions), các tính năng mới (Features), các lỗi đã sửa (Bug Fixes) và những thay đổi về kiến trúc (Refactoring) của toàn bộ hệ thống.

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
