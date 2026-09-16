# Tổng hợp kiến thức Recommendation System

## 1. Recommendation Accuracy (Độ chính xác của hệ thống gợi ý)

### Khái niệm
Recommendation Accuracy phản ánh mức độ mà hệ thống gợi ý đúng những sản phẩm khách hàng thực sự sẽ mua hoặc quan tâm. Khác với bài toán phân loại chỉ dự đoán một nhãn, Recommendation thường trả về danh sách Top-K sản phẩm.

### Ví dụ
Khách hàng thực tế mua:
- Milk
- Bread
- Coffee

AI gợi ý Top-5:
1. Coffee ✅
2. Tea ❌
3. Milk ✅
4. Cake ❌
5. Butter ❌

=> Gợi đúng 2/5 sản phẩm.

### Chỉ số đánh giá
- Precision@K
- Recall@K
- Hit Rate
- MAP
- NDCG

---

## 2. User Cold Start

### Khái niệm
Là tình huống khách hàng mới chưa có lịch sử mua hàng nên hệ thống không đủ dữ liệu để đưa ra gợi ý chính xác.

### Ví dụ
Khách hàng vừa tạo tài khoản:
- Không có lịch sử mua hàng
- Collaborative Filtering không thể tìm được người dùng tương tự.

### Mô hình
- Collaborative Filtering: Rất kém.
- Content-Based: Có thể tận dụng tuổi, giới tính, sở thích ban đầu.
- Hybrid: Khắc phục tốt hơn.

---

## 3. Item Cold Start

### Khái niệm
Là tình huống một sản phẩm mới chưa từng có giao dịch.

### Ví dụ
Cửa hàng vừa nhập "iPhone 18".
- Chưa ai mua.
- Collaborative Filtering không thể đề xuất.
- Content-Based vẫn có thể gợi ý dựa trên Brand=Apple, Category=Smartphone.

---

## 4. Sequential Behavior

### Khái niệm
Đánh giá khả năng mô hình học được thứ tự và ngữ cảnh của các lần mua hàng.

### Ví dụ
Chuỗi:
Phone → Case → Screen Protector

Mô hình tốt sẽ học rằng sau khi mua điện thoại thì khả năng mua ốp lưng và kính cường lực rất cao.

### Mô hình
- SASRec
- BERT4Rec
- Transformer
- LSTM
- GRU

---

## 5. Explainability

### Khái niệm
Khả năng giải thích lý do AI đưa ra gợi ý.

### Ví dụ
AI gợi ý Coffee vì:
- Bạn đã mua Coffee 12 lần.
- Bạn thường mua đồ uống vào cuối tuần.
- 80% khách hàng có hành vi giống bạn cũng mua Latte.

### Lợi ích
- Tăng độ tin cậy.
- Dễ phân tích.
- Dễ tối ưu mô hình.

---

## 6. Training Time

### Khái niệm
Thời gian cần để huấn luyện mô hình.

### Ví dụ
- Random Forest: 10 phút.
- Transformer: 5 giờ.

### Ý nghĩa
Quan trọng khi dữ liệu cập nhật thường xuyên hoặc cần retrain định kỳ.

---

## 7. Inference Speed

### Khái niệm
Thời gian mô hình đưa ra kết quả sau khi đã được huấn luyện.

### Ví dụ
Khách mở ứng dụng:
- AI trả Top-10 sản phẩm trong 50 ms là tốt.
- Nếu mất 5 giây thì trải nghiệm rất kém.

---

## 8. Scalability

### Khái niệm
Khả năng mở rộng khi số lượng người dùng, sản phẩm và giao dịch tăng mạnh.

### Ví dụ
Từ:
- 1.000 khách hàng
- 10.000 hóa đơn

tăng lên:
- 5 triệu khách hàng
- 300 triệu hóa đơn

Mô hình vẫn phải hoạt động hiệu quả.

---

## 9. Metadata Usage

### Khái niệm
Khả năng tận dụng dữ liệu bổ sung ngoài lịch sử mua hàng.

### Ví dụ Metadata

Khách hàng:
- Age
- Gender
- City
- Membership

Sản phẩm:
- Category
- Brand
- Price

Hóa đơn:
- Promotion
- Discount
- Weekend
- Holiday

### Ví dụ
Khách hàng:
- Nam
- 22 tuổi
- Thường mua sản phẩm Apple

AI có thể gợi ý AirPods dù khách chưa từng mua.

---

# Ví dụ tổng hợp

Khách hàng có lịch sử:

01/01: Sữa

03/01: Bánh mì

07/01: Trứng

15/01: Sữa

20/01: Cà phê

Đánh giá:

- Recommendation Accuracy: AI gợi đúng 4/5 sản phẩm tiếp theo.
- User Cold Start: Khách mới chưa từng mua gì.
- Item Cold Start: Sản phẩm mới vừa nhập kho.
- Sequential Behavior: AI học được sau khi mua sữa thường mua ngũ cốc.
- Explainability: AI giải thích vì sao gợi ý.
- Training Time: Mất bao lâu để huấn luyện.
- Inference Speed: Mất bao lâu để trả Top-K.
- Scalability: Có xử lý được hàng trăm triệu hóa đơn không.
- Metadata Usage: Có tận dụng tuổi, giới tính, danh mục, khuyến mãi hay không.

---

# So sánh và đánh giá từng mô hình

| Tiêu chí                | Collaborative Filtering | Matrix Factorization | Content-Based | NCF   | Hybrid | SASRec  | BERT4Rec |Choice |
| ----------------------- | ----------------------- | -------------------- | ------------- | ----- | ------ | ------- | -------- |------- |
| Recommendation Accuracy | ⭐⭐⭐                     | ⭐⭐⭐⭐                 | ⭐⭐⭐           | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐  | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐ | ✅ |
| User Cold Start         | ⭐                       | ⭐                    | ⭐⭐⭐           | ⭐⭐    | ⭐⭐⭐⭐   | ⭐⭐      | ⭐⭐       | ✅ |
| Item Cold Start         | ⭐                       | ⭐                    | ⭐⭐⭐⭐⭐         | ⭐⭐    | ⭐⭐⭐⭐   | ⭐⭐      | ⭐⭐       | ✅ |
| Sequential Behavior     | ⭐                       | ⭐                    | ⭐             | ⭐⭐    | ⭐⭐⭐    | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐    | ✅ |
| Explainability          | ⭐⭐⭐⭐                    | ⭐⭐                   | ⭐⭐⭐⭐⭐         | ⭐     | ⭐⭐⭐⭐   | ⭐       | ⭐        |  |
| Training Time           | ⭐⭐⭐⭐⭐                   | ⭐⭐⭐⭐                 | ⭐⭐⭐⭐          | ⭐⭐    | ⭐⭐     | ⭐       | ⭐        | ✅ |
| Inference Speed         | ⭐⭐⭐⭐                    | ⭐⭐⭐⭐⭐                | ⭐⭐⭐⭐          | ⭐⭐⭐   | ⭐⭐⭐    | ⭐⭐⭐     | ⭐⭐⭐      |  |
| Scalability             | ⭐⭐⭐                     | ⭐⭐⭐⭐                 | ⭐⭐⭐⭐          | ⭐⭐⭐⭐  | ⭐⭐⭐⭐   | ⭐⭐⭐⭐    | ⭐⭐⭐⭐     | ✅ |
| Metadata Usage          | ⭐                       | ⭐                    | ⭐⭐⭐⭐⭐         | ⭐⭐⭐⭐  | ⭐⭐⭐⭐⭐  | ⭐⭐      | ⭐⭐       | ✅ |
| Độ phức tạp triển khai  | Thấp                    | Trung bình           | Thấp          | Cao   | Cao    | Rất cao | Rất cao  |


# Tài liệu tham khảo chính

1. Ricci, F., Rokach, L., & Shapira, B. *Recommender Systems Handbook*. Springer.
2. Charu C. Aggarwal. *Recommender Systems: The Textbook*.
3. Herlocker et al. *Evaluating Collaborative Filtering Recommender Systems*. ACM TOIS.
4. Rendle et al. *Bayesian Personalized Ranking from Implicit Feedback (BPR)*.
5. He et al. *Neural Collaborative Filtering*. WWW 2017.
6. Kang & McAuley. *SASRec: Self-Attentive Sequential Recommendation*. ICDM 2018.
7. Sun et al. *BERT4Rec*. CIKM 2019.
8. Zhang et al. *Deep Learning based Recommender Systems: A Survey*.
