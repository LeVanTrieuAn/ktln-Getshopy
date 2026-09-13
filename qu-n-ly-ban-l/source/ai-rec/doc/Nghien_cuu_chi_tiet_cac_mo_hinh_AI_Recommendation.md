# Nghiên cứu chi tiết các mô hình AI Recommendation

> **Mục tiêu:** Tài liệu tổng hợp các mô hình Recommendation phổ biến
> phục vụ bài toán gợi ý sản phẩm từ dữ liệu hóa đơn bán lẻ.

# 1. Collaborative Filtering (CF)

## Khái niệm

Collaborative Filtering (lọc cộng tác) dựa trên giả định rằng **những
người dùng có hành vi giống nhau trong quá khứ sẽ có xu hướng thích các
sản phẩm giống nhau trong tương lai**.

Có hai hướng tiếp cận: - User-Based Collaborative Filtering - Item-Based
Collaborative Filtering

## Thuật toán

### User-Based CF

1.  Xây dựng ma trận User--Item.
2.  Tính độ tương đồng giữa các người dùng bằng Cosine Similarity,
    Pearson Correlation hoặc Jaccard.
3.  Chọn Top-N người dùng giống nhất.
4.  Gợi ý các sản phẩm mà nhóm người dùng này đã mua nhưng người dùng
    hiện tại chưa mua.

### Item-Based CF

1.  Tính độ tương đồng giữa các sản phẩm.
2.  Nếu khách đã mua một sản phẩm, hệ thống gợi ý các sản phẩm tương tự.

## Input

-   User ID
-   Item ID
-   Purchase History

## Output

Danh sách Top-K sản phẩm.

## Ưu điểm

-   Đơn giản.
-   Không cần metadata.
-   Hiệu quả khi dữ liệu lịch sử phong phú.

## Nhược điểm

-   User Cold Start.
-   Item Cold Start.
-   Ma trận rất thưa (Sparsity).
-   Không học được thứ tự mua hàng.

## Ví dụ Retail

Khách A mua: Milk, Bread, Coffee. Khách B mua: Milk, Bread. =\> Gợi ý
Coffee cho B.

------------------------------------------------------------------------

# 2. Matrix Factorization

## Ý tưởng

Phân rã ma trận User--Item thành hai ma trận: - User Embedding Matrix -
Item Embedding Matrix

Điểm dự đoán được tính bằng tích vô hướng giữa hai vector embedding.

## Thuật toán

-   SVD
-   ALS
-   Bayesian Personalized Ranking (BPR)

## Ưu điểm

-   Độ chính xác cao.
-   Mở rộng tốt.
-   Phù hợp dữ liệu lớn.

## Nhược điểm

-   Không xử lý tốt Cold Start.
-   Không khai thác metadata.
-   Không mô hình hóa chuỗi hành vi.

## Ví dụ

Khách hàng chưa mua Coffee nhưng vector embedding gần với Coffee nên AI
dự đoán xác suất mua cao.

------------------------------------------------------------------------

# 3. Content-Based Recommendation

## Ý tưởng

Hệ thống gợi ý dựa trên đặc điểm của sản phẩm thay vì hành vi của người
dùng khác.

## Thuật toán

-   TF-IDF
-   Cosine Similarity
-   Word2Vec Embedding
-   BERT Embedding

## Metadata thường dùng

-   Brand
-   Category
-   Price
-   Description
-   Tags

## Ưu điểm

-   Giải quyết tốt Item Cold Start.
-   Dễ giải thích.
-   Không phụ thuộc người dùng khác.

## Nhược điểm

-   Phụ thuộc metadata.
-   Thiếu tính đa dạng.

## Ví dụ

Khách thường mua cà phê Starbucks. =\> Gợi ý Latte, Cappuccino cùng
thương hiệu.

------------------------------------------------------------------------

# 4. Neural Collaborative Filtering (NCF)

## Ý tưởng

NCF thay thế phép nhân tuyến tính trong Matrix Factorization bằng mạng
nơ-ron nhiều lớp (MLP).

## Kiến trúc

User ID -\> Embedding Item ID -\> Embedding Concatenate MLP Prediction

## Loss Function

Binary Cross Entropy.

## Ưu điểm

-   Học quan hệ phi tuyến.
-   Accuracy cao hơn Matrix Factorization.

## Nhược điểm

-   Cần GPU.
-   Khó giải thích.

## Ví dụ

Khách hàng trẻ tuổi thường mua điện thoại và tai nghe. NCF học được mối
quan hệ này ngay cả khi không tuyến tính.

------------------------------------------------------------------------

# 5. Hybrid Recommendation

## Ý tưởng

Kết hợp nhiều mô hình: - Collaborative Filtering - Content-Based -
Popularity - Deep Learning

## Kiến trúc phổ biến

-   Weighted Hybrid
-   Switching Hybrid
-   Cascade Hybrid
-   Mixed Hybrid

## Ưu điểm

-   Độ chính xác cao.
-   Khắc phục Cold Start.
-   Linh hoạt.

## Nhược điểm

-   Triển khai phức tạp.
-   Khó tối ưu.

## Ví dụ

Khách mới -\> Content-Based. Khách cũ -\> Collaborative Filtering. Sau
đó kết hợp điểm để tạo danh sách cuối cùng.

------------------------------------------------------------------------

# 6. SASRec

## Ý tưởng

SASRec (Self-Attentive Sequential Recommendation) sử dụng Transformer
Encoder để học chuỗi hành vi mua hàng.

## Quy trình

Purchase Sequence -\> Embedding -\> Positional Encoding -\> Multi-head
Self Attention -\> Feed Forward Network -\> Next Item Prediction

## Ưu điểm

-   Học được thứ tự mua hàng.
-   Hiệu quả rất cao với Next Item Recommendation.

## Nhược điểm

-   Cần GPU.
-   Dữ liệu chuỗi phải đủ dài.

## Ví dụ

Milk -\> Bread -\> Butter =\> Jam.

------------------------------------------------------------------------

# 7. BERT4Rec

## Ý tưởng

Áp dụng BERT vào Recommendation bằng Masked Item Prediction.

Ví dụ: Milk, Bread, \[MASK\], Butter =\> dự đoán Coffee.

## Điểm khác SASRec

-   SASRec chỉ nhìn quá khứ.
-   BERT4Rec học ngữ cảnh hai chiều.

## Ưu điểm

-   Accuracy rất cao.
-   Học được quan hệ dài hạn.

## Nhược điểm

-   Huấn luyện lâu.
-   Tài nguyên lớn.

------------------------------------------------------------------------

# 8. Choice Model

## Khái niệm

Choice Model là nhóm mô hình kinh tế lượng mô tả xác suất khách hàng
chọn một sản phẩm trong nhiều lựa chọn.

## Các mô hình

-   Multinomial Logit (MNL)
-   Conditional Logit
-   Nested Logit
-   Mixed Logit

## Input

-   Giá
-   Khuyến mãi
-   Thương hiệu
-   Thu nhập
-   Thuộc tính sản phẩm

## Output

Xác suất lựa chọn từng sản phẩm.

## Ưu điểm

-   Dễ giải thích.
-   Phân tích ảnh hưởng của giá và khuyến mãi.

## Nhược điểm

-   Không mạnh với dữ liệu chuỗi.
-   Không phù hợp làm Recommendation hiện đại nếu dùng đơn lẻ.

# Tài liệu tham khảo

-   Recommender Systems Handbook (Ricci et al.)
-   Recommender Systems: The Textbook (Charu C. Aggarwal)
-   Neural Collaborative Filtering (WWW 2017)
-   SASRec (ICDM 2018)
-   BERT4Rec (CIKM 2019)
