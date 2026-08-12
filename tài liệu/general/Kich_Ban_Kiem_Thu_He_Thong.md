CH BẢN KIỂM THỬ HỆ THỐNG (TEST PLAN & TEST CASES)

**Dự án:** E-commerce Data Lake & AI Recommendation (Quy mô 1 triệu bản ghi)
**Dựa trên:** Project Brief, Chiến lược Hiển thị Dữ liệu lớn, Chiến lược AI Recommendation.

---

## 1. MỤC TIÊU KIỂM THỬ

Đảm bảo hệ thống đạt được 3 tiêu chí cốt lõi:

1. **Hiệu năng (Performance):** Tương tác mượt mà với CSDL chứa 1 triệu dòng, không bị tràn RAM (OOM) ở cả Frontend và Backend.
2. **Độ tin cậy (Reliability):** Cơ chế Circuit Breaker, Cache và Optimistic UI hoạt động đúng để chống đứt gãy hệ thống.
3. **AI Recommendation:** Hệ thống gọi ý trả kết quả tốc độ cao (<50ms) và xử lý tốt trường hợp dữ liệu lớn và người dùng mới (Cold Start).

---

## 2. NHÓM 1: KIỂM THỬ TỐI ƯU HIỂN THỊ DỮ LIỆU LỚN (BIG DATA RENDERING)

*(Dựa trên tài liệu: Chien_Luoc_Toi_Uu_Hien_Thi_Du_Lieu_Lon.md)*

### TC 1.1: Kiểm thử tràn RAM khi cuộn trang (Infinite Scroll Memory Limit)

- **Mô tả:** Đảm bảo React Query tự động dọn rác (Garbage Collection) khi cuộn quá nhiều trang.
- **Thực hiện:** Cuộn liên tục danh sách đơn hàng/sản phẩm xuống đến trang thứ 6.
- **Kỳ vọng:** Do thiết lập `maxPages: 5`, khi load trang 6, dữ liệu của trang 1 trong DOM phải bị gỡ bỏ để giải phóng RAM. Trình duyệt không bị giật lag hay treo sau khi cuộn 10.000 dòng nhờ `@tanstack/react-virtual`.

### TC 1.2: Kiểm thử tính chính xác của Cursor Pagination (Tie-Breaker)

- **Mô tả:** Tránh việc bị trùng lặp dữ liệu giữa 2 trang khi có 2 bản ghi trùng thời gian (`order_date`).
- **Thực hiện:** Cuộn qua phần phân trang tại thời điểm có nhiều đơn hàng cùng 1 timestamp.
- **Kỳ vọng:** Backend giải mã Base64 Cursor chính xác dựa trên tổ hợp `order_date` và `order_id` phụ trợ, không có bản ghi nào bị lặp lại 2 lần hoặc bị bỏ sót trên UI.

### TC 1.3: Kiểm thử tự vệ của Database (Circuit Breaker & Graceful Degradation)

- **Mô tả:** Đảm bảo Web không bị trắng trang khi Database ClickHouse quá tải.
- **Thực hiện:** Dùng công cụ (như JMeter) bắn 10,000 request cùng lúc vào Backend để ép ClickHouse nghẽn, hoặc ngắt mạng tạm thời tới ClickHouse. Sau đó F5 lại trang Web.
- **Kỳ vọng:** Backend ném ra lỗi `503_CIRCUIT_OPEN`. Frontend bắt lỗi này và lập tức hiển thị Banner cảnh báo: *"Dữ liệu hệ thống đang được tải chậm..."*, đồng thời render lại bản lưu tạm cũ thay vì Crash màn hình.

### TC 1.4: Kiểm thử Trải nghiệm Cập nhật (Optimistic UI)

- **Mô tả:** Trải nghiệm người dùng khi chèn dữ liệu mà Kafka bị trễ 5 giây.
- **Thực hiện:** Admin bấm nút "Tạo đơn hàng ảo" (Simulate Sale).
- **Kỳ vọng:** Danh sách trên UI hiển thị thẻ đơn hàng ngay lập tức (trạng thái làm mờ - Syncing). 5 giây sau (khi Kafka đã đồng bộ xong xuống ClickHouse), thẻ tự động sáng lên thành trạng thái hoàn thành.

---

## 3. NHÓM 2: KIỂM THỬ HỆ THỐNG GỢI Ý (AI RECOMMENDATION)

*(Dựa trên tài liệu: Chien_Luoc_AI_Recommendation_DataLake.md)*

### TC 2.1: Kiểm thử huấn luyện mô hình (Training OOM Test)

- **Mô tả:** Đảm bảo tiến trình Python không Crash RAM khi đọc 1 triệu bản ghi.
- **Thực hiện:** Kích hoạt CronJob chạy Train Data. Monitor lượng RAM sử dụng của container Python.
- **Kỳ vọng:** RAM không được vọt lên quá 1GB do đã sử dụng Chunking (Dask/Generator) và định dạng Ma trận thưa (Sparse Matrix / CSR).

### TC 2.2: Kiểm thử hiệu năng Inference (Redis Caching)

- **Mô tả:** Thời gian phản hồi API gợi ý sản phẩm cho user đã có lịch sử mua hàng.
- **Thực hiện:** Đăng nhập vào account B2C, mở trang chủ và theo dõi tab Network (F12).
- **Kỳ vọng:** Node.js truy xuất thẳng vào Redis qua Key `user:{id}:recs` và API trả về mảng dữ liệu trong thời gian dưới **50ms**.

### TC 2.3: Kiểm thử Cold Start (Người dùng mới - Hybrid Recommendation)

- **Mô tả:** Khách vãng lai (Guest) hoặc User chưa mua hàng bao giờ.
- **Thực hiện:** Dùng trình duyệt ẩn danh, chưa đăng nhập, truy cập chi tiết một sản phẩm A.
- **Kỳ vọng:** Thuật toán Collaborative Filtering không có tác dụng, hệ thống tự động chuyển sang Content-Based Filtering (CBF) để gợi ý các sản phẩm có thuộc tính, danh mục giống hệt sản phẩm A.

### TC 2.4: Phân biệt vai trò AI (Generative AI vs ML)

- **Mô tả:** Kiểm tra các API dùng OpenRouter.
- **Thực hiện:** Admin bấm "Gợi ý chiến dịch khuyến mãi".
- **Kỳ vọng:** Node.js gọi OpenRouter API thành công, trả về JSON với tiêu đề và mô tả lý do chạy Flash Sale bằng ngôn ngữ tự nhiên hợp lý (Tác vụ LLM NLP). Không dùng cho luồng Recommendation 1M bản ghi.

---

## 4. NHÓM 3: KIỂM THỬ TÍNH TOÀN VẸN VÀ LUỒNG XÓA

*(Dựa trên tài liệu Tổng quan & Hiển thị)*

### TC 3.1: Kiểm thử xóa bản ghi (Tombstone CDC)

- **Mô tả:** ClickHouse không xóa trực tiếp mà dùng cờ đánh dấu (Event Sourcing).
- **Thực hiện:** Xóa 1 đơn hàng ở hệ thống nguồn (PostgreSQL). CDC Kafka đồng bộ bản ghi có `_cdc_op = 'd'` xuống ClickHouse.
- **Kỳ vọng:** Hàm query SELECT phải lọc `WHERE _cdc_op != 'd'`, đơn hàng lập tức biến mất khỏi biểu đồ / danh sách của Admin.

### TC 3.2: Kiểm thử Idempotency (Chống Spam Click)

- **Mô tả:** Ngăn ngừa việc User bấm nút "Thanh toán" 5 lần liên tục do bực mình vì mạng chậm.
- **Thực hiện:** Dùng Postman bắn 5 request `POST /api/b2c/checkout` có cùng một `X-Idempotency-Key` trên Header vào cùng 1 giây.
- **Kỳ vọng:** Request đầu tiên được xử lý. 4 request còn lại bị Redis chặn đứng ngay lập tức và trả về `409 Conflict` hoặc trả về kết quả của request đầu. DB không bị tạo 5 đơn hàng trùng lặp.

### TC 3.3: Invalidation Cache an toàn

- **Mô tả:** Chắc chắn rằng `/api/b2c/checkout` không xóa lầm Cache của hệ thống Recommendation.
- **Thực hiện:** Tạo 1 đơn hàng mới.
- **Kỳ vọng:** Code chỉ dùng `SCAN` & `DEL` để xóa các khóa Cache thống kê như `kpi:*`, tuyệt đối không dùng cờ `FLUSHALL`. Các kết quả Recommendation đã pre-computed trong Redis vẫn còn nguyên vẹn.
