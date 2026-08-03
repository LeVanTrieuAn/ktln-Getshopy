# CHIẾN LƯỢC TÍCH HỢP AI & XỬ LÝ DỮ LIỆU LỚN (RECOMMENDATION SYSTEM)

Tài liệu này đóng vai trò là "Kim chỉ nam" (Blueprint) kỹ thuật cho quá trình xây dựng, huấn luyện (Train) và triển khai (Deploy) hệ thống AI Recommendation (Hệ thống gợi ý) trên tập dữ liệu khổng lồ (hàng triệu dòng) của dự án GetShopy. 

---

## 1. TỔNG QUAN BÀI TOÁN AI TRONG HỆ THỐNG DATA LAKE

Theo *Project Brief*, dự án E-commerce của chúng ta có 1 triệu bản ghi sản phẩm/giao dịch. Dữ liệu thô nằm ở MinIO (Parquet) và được đưa vào Data Warehouse (ClickHouse) để truy vấn.
Vấn đề đặt ra cho hệ thống AI:
- Làm sao để mô hình AI có thể đọc hàng triệu dòng dữ liệu từ Data Lake để train mà không bị Crash RAM (Out of Memory - OOM)?
- Làm sao để kết quả gợi ý được trả về tức thời (Real-time hoặc Near real-time) khi user đang lướt Web?
- Làm sao để kết hợp linh hoạt giữa 2 thuật toán: Lọc cộng tác (Collaborative Filtering) và Lọc theo nội dung (Content-Based Filtering)?

- Làm sao để kết hợp linh hoạt giữa 2 thuật toán: Lọc cộng tác (Collaborative Filtering) và Lọc theo nội dung (Content-Based Filtering)?

---

## 2. PHÂN ĐỊNH RÕ RÀNG VAI TRÒ CỦA AI TRONG HỆ THỐNG (LLM vs ML)

Để tránh nhầm lẫn về mặt kiến trúc và tối ưu hóa chi phí cũng như hiệu năng, hệ thống GetShopy chia AI làm 2 mảng tách biệt hoàn toàn:

### 2.1. Generative AI (Sử dụng OpenRouter / OpenAI API)
- **Cấu hình:** Sử dụng các biến môi trường `OPENROUTER_API_KEY`, `OPENROUTER_URL`, `OPENROUTER_MODEL`.
- **Mục đích:** Xử lý ngôn ngữ tự nhiên (NLP). Dùng cho các tính năng "Trợ lý ảo (Chatbot) cho Admin", "Tóm tắt hàng ngàn lượt Review thành 1 đoạn văn bản ngắn", hoặc sinh nội dung tự động.
- **Tại sao không dùng cho Recommendation?** Các mô hình ngôn ngữ lớn (LLM) có giới hạn Token (Context Window). Việc đẩy hàng triệu dòng lịch sử mua hàng từ Database vào LLM qua API là bất khả thi, gây lỗi tràn bộ nhớ, tốc độ chờ hàng phút và tiêu tốn hàng nghìn USD chi phí API.

### 2.2. Traditional Machine Learning (Sử dụng Thuật toán Nội bộ)
- **Cấu hình:** Giao tiếp trực tiếp với Data Lake thông qua `CLICKHOUSE_URL`, `DATABASE_URL`.
- **Mục đích:** Đây chính là "Trái tim" của hệ thống Gợi ý (Recommendation System) cho 1 triệu bản ghi.
- **Kiến trúc:** Xây dựng một Microservice Python nội bộ (Local) kéo dữ liệu thô từ Database về, chuyển hóa thành ma trận số (Sparse Matrix) và tự huấn luyện mô hình (ALS/TF-IDF) ngay trên máy chủ của hệ thống. Quá trình này **miễn phí 100%**, siêu nhanh, bảo mật tuyệt đối (không đẩy dữ liệu ra bên ngoài) và hoàn toàn độc lập với OpenRouter.

---

## 3. KIẾN TRÚC TỔNG THỂ (AI DATA PIPELINE ARCHITECTURE)

Hệ thống AI sẽ không nằm chung với Node.js Backend. Để xử lý tính toán ma trận lớn, AI sẽ được tách ra thành một **Microservice độc lập viết bằng Python**.

### 2.1. Sơ đồ Luồng Dữ Liệu (Data Flow)

```text
[ Người Dùng B2C ] 
       | (Tương tác: Click, Xem, Mua)
       v
[ Node.js Backend (Kafka Producer) ] ---> Đẩy event vào Kafka
       |
       v
[ Kafka (Message Broker) ] ---> [ ClickHouse / MinIO ] (Data Lake lưu trữ toàn bộ lịch sử)
                                     |
                                     | (Batch Data Extraction)
                                     v
                           [ Python AI Microservice ]
                                - Train Model định kỳ (Hàng đêm)
                                - Lưu Model (Pickle / ONNX)
                                - Push kết quả pre-computed vào Redis
                                     |
       +-----------------------------+
       | (Real-time Inference)       | (Cached Retrieval)
       v                             v
[ Node.js Backend ] <---------- [ Redis ]
       |
       v
[ Trả về danh sách Gợi Ý trên Giao diện Web ]
```

---

## 4. LỰA CHỌN THUẬT TOÁN & PHƯƠNG PHÁP TRIỂN KHAI

### 3.1. Thuật toán Lọc Cộng Tác (Collaborative Filtering - CF)
Thuật toán này gợi ý sản phẩm dựa trên hành vi của những người dùng có sở thích tương đồng (User-based) hoặc các sản phẩm thường được mua cùng nhau (Item-based).
- **Công nghệ tối ưu cho 1 triệu dòng:** Thay vì dùng Ma trận tương quan thô sơ (Memory-based), chúng ta bắt buộc phải dùng **Model-based CF** cụ thể là thuật toán **ALS (Alternating Least Squares)** hoặc **SVD (Singular Value Decomposition)**.
- **Lý do:** ALS có khả năng song song hóa cực tốt, phân rã ma trận thưa thớt (sparse matrix) của hàng triệu giao dịch thành các vector ẩn (latent vectors) với số chiều nhỏ, tiết kiệm RAM đáng kể. Thư viện khuyến nghị: `Implicit` hoặc `Surprise` của Python.

### 3.2. Thuật toán Lọc Theo Nội Dung (Content-Based Filtering - CBF)
Gợi ý sản phẩm dựa trên thuộc tính của sản phẩm đó (Mô tả, Danh mục, Thương hiệu, Cấu hình).
- **Công nghệ:** Sử dụng **TF-IDF (Term Frequency-Inverse Document Frequency)** kết hợp **Cosine Similarity** trên các đoạn văn bản mô tả.
- **Nâng cao (Optional):** Sử dụng các mô hình Embedding (như Word2Vec hoặc Sentence-BERT) để mã hóa văn bản mô tả sản phẩm thành các vector nhúng, sau đó tìm hàng xóm gần nhất (K-Nearest Neighbors - KNN). Cực kỳ hữu dụng khi người dùng tìm kiếm sản phẩm mới chưa có lịch sử mua hàng (Cold Start problem).

### 3.3. Phương pháp Lai (Hybrid Recommendation)
Kết hợp cả CF và CBF.
- Trọng số: `Score = (0.7 * CF_Score) + (0.3 * CBF_Score)`
- Xử lý vấn đề Cold Start (Người dùng mới chưa mua gì): Sẽ dùng CBF 100% dựa trên sản phẩm họ vừa click xem. Khi họ đã mua nhiều, sẽ dần dịch chuyển tỷ trọng sang CF.

---

## 5. CHIẾN LƯỢC HUẤN LUYỆN (TRAINING) 1 TRIỆU BẢN GHI KHÔNG SẬP RAM

Đây là kỹ thuật cốt lõi giúp hệ thống sống sót khi train data:

### Bí kíp 1: Không Load toàn bộ DB vào RAM một lúc (Data Chunking/Streaming)
- Tuyệt đối **KHÔNG** dùng lệnh `SELECT * FROM orders` và ném thẳng vào thư viện Pandas `pd.read_sql()`. Nó sẽ nuốt trọn 10GB RAM và làm sập server ngay lập tức.
- **Giải pháp:** Sử dụng Generator của Python hoặc thư viện `Dask` thay cho `Pandas` (Dask xử lý Out-of-Core, tức là load từng phần data lên RAM, xử lý xong ghi ra đĩa rồi load tiếp).
- Đọc dữ liệu từ ClickHouse theo từng Batch (Ví dụ `LIMIT 50000 OFFSET X`) hoặc sử dụng file Parquet xuất từ MinIO vì Parquet là định dạng lưu trữ theo cột (Columnar format) ép nén cực mạnh, giúp Pandas/Dask đọc cực nhanh.

### Bí kíp 2: Mã hóa ID thành Index dạng số nguyên (Integer Mapping)
- Các ID sản phẩm có dạng `PROD-12345` (String) chiếm rất nhiều byte trong RAM.
- Cần có bước Data Preprocessing: Ánh xạ toàn bộ UUID/String thành Index số nguyên tự tăng `(0, 1, 2, ..., 1,000,000)`. Dùng kiểu dữ liệu `int32` thay vì `int64` để giảm 50% lượng RAM sử dụng cho ma trận.

### Bí kíp 3: Lưu ma trận ở dạng Thưa (Sparse Matrix)
- Ma trận User-Item cho 1 triệu giao dịch thường có tới 99% giá trị bằng 0 (vì một user chỉ mua vài sản phẩm trong số hàng ngàn sản phẩm).
- Bắt buộc phải chuyển đổi DataFrame sang định dạng **CSR Matrix** (Compressed Sparse Row) của `scipy.sparse` trước khi đưa vào mô hình học máy. Một ma trận 1GB có thể giảm xuống chỉ còn vài chục MB ở định dạng Sparse.

---

## 6. CHIẾN LƯỢC SUY LUẬN & TRẢ KẾT QUẢ REAL-TIME (INFERENCE)

Khi người dùng vào trang chủ, AI không thể bắt đầu chạy vòng lặp nhân ma trận để tính toán gợi ý (như vậy trang web sẽ load mất 5 phút). Quá trình này phải là **Instant (Tức thời, < 50ms)**.

### Mô hình Pre-computation & Caching (Batch Inference)
1. **Ban đêm (Off-peak hours):** CronJob gọi Python Server chạy quá trình Train mô hình.
2. **Dự đoán trước (Pre-predict):** Sau khi train xong, mô hình tiến hành dự đoán Top 20 sản phẩm gợi ý cho *toàn bộ User hiện có trong hệ thống*.
3. **Lưu trữ siêu tốc (Redis Cache):** Ghi toàn bộ kết quả vào Redis theo dạng Key-Value:
   `KEY: user:1234:recs` => `VALUE: [991, 203, 114, 550, ...]`
4. **Khi người dùng đăng nhập:** Node.js Backend chỉ việc chọc vào Redis lấy List ID ra (`O(1)` time complexity), sau đó query CSDL lấy thông tin chi tiết sản phẩm. Tốc độ sẽ nằm ở mức 2-5ms!

### Xử lý Real-time (Online Inference cho User mới)
- Nếu user vãng lai (Guest) click vào 1 sản phẩm `A`, Node.js gọi trực tiếp API của Python Server qua REST/gRPC: `GET /predict?item=A`.
- Python Server tải sẵn mô hình KNN trên bộ nhớ, dùng Item-to-Item Similarity để tính ra 10 sản phẩm giống `A` nhất và trả về ngay lập tức (Vì Item Similarity Matrix khá nhỏ, có thể fit vừa RAM).

---

## 7. LƯU Ý KHI CODE MODULE PYTHON (THỰC TIỄN BÁO CÁO)

1. **Chuẩn hóa thư mục AI:**
   Dự án nên có thư mục riêng `source/ai-service/`. File `app.py` dùng FastAPI để tạo API. Thư mục `models/` lưu các file `model.pkl`.
   
2. **Theo dõi độ chính xác (Evaluation Metrics):**
   Đừng chỉ train xong là để đó. Trong báo cáo khóa luận, hội đồng sẽ hỏi "Mô hình em hiệu quả bao nhiêu?". Cần phải code thêm phần đánh giá mô hình bằng các thang đo: **RMSE, Precision@K, Recall@K, MAP (Mean Average Precision)**.

3. **Log lại hành vi (Feedback Loop):**
   Nếu AI gợi ý sản phẩm X, và người dùng bấm vào X, Backend Node.js phải bắt được sự kiện (event) này và ghi nhận lại vào ClickHouse (`action = 'clicked_recommendation'`). Đây là minh chứng tuyệt vời cho thấy hệ thống của bạn có "Khả năng tự học" theo thời gian thực (được điểm RẤT CAO trong bảo vệ đồ án).

---

## 8. KẾT LUẬN & HÀNH ĐỘNG TIẾP THEO

- **Giai đoạn 1:** Fake (Giả lập) ma trận hành vi người dùng (User-Item ratings) bằng thuật toán ngẫu nhiên có phân phối chuẩn, lưu thành file CSV hoặc nạp vào ClickHouse.
- **Giai đoạn 2:** Dựng bộ khung Python + FastAPI + thư viện `implicit` hoặc `scikit-learn`.
- **Giai đoạn 3:** Viết script Pipeline để: Đọc data (Batch) -> Clean/Map Index -> Train ALS Model -> Export ra Redis.
- **Giai đoạn 4:** Sửa Node.js Backend để chèn kết quả từ Redis vào các Carousel (Thanh trượt) ở màn hình Home và Product Detail của người dùng.

*Tài liệu này được soạn thảo riêng làm kim chỉ nam thực thi cho nhánh AI Recommendation. Tuân thủ tuyệt đối các nguyên tắc Caching và Sparse Matrix để bảo vệ Server.*
