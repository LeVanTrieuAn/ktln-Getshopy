TỔNG LIÊN ĐOÀN LAO ĐỘNG VIỆT NAM

**TRƯỜNG ĐẠI HỌC TÔN ĐỨC THẮNG**

**KHOA CÔNG NGHỆ THÔNG TIN**

**LÊ VĂN TRIỀU AN \- 52300002**

**ĐINH QUỐC CƯỜNG \- 52300012**

**XÂY DỰNG NỀN TẢNG DỮ LIỆU THEO KIẾN TRÚC LAKEHOUSE PHỤC VỤ PHÂN TÍCH THỜI GIAN GẦN THỰC VÀ ỨNG DỤNG TRÍ TUỆ NHÂN TẠO TRONG THƯƠNG MẠI ĐIỆN TỬ**

**KHÓA LUẬN TỐT NGHIỆP**

**KỸ THUẬT PHẦN MỀM**

**THÀNH PHỐ HỒ CHÍ MINH, NĂM 2026**

TỔNG LIÊN ĐOÀN LAO ĐỘNG VIỆT NAM

**TRƯỜNG ĐẠI HỌC TÔN ĐỨC THẮNG**

**KHOA CÔNG NGHỆ THÔNG TIN**

**LÊ VĂN TRIỀU AN \- 52300002**

**ĐINH QUỐC CƯỜNG \- 52300012**

**XÂY DỰNG NỀN TẢNG DỮ LIỆU THEO KIẾN TRÚC LAKEHOUSE PHỤC VỤ PHÂN TÍCH THỜI GIAN GẦN THỰC VÀ ỨNG DỤNG TRÍ TUỆ NHÂN TẠO TRONG THƯƠNG MẠI ĐIỆN TỬ**

**KHÓA LUẬN TỐT NGHIỆP**

**KỸ THUẬT PHẦN MỀM**

Người hướng dẫn

**ThS. Võ Văn Thành**

**THÀNH PHỐ HỒ CHÍ MINH, NĂM 2026**

**LỜI CẢM ƠN**

Trong quá trình nghiên cứu và thực hiện khóa luận tốt nghiệp, người thực hiện đã nhận được sự hướng dẫn, hỗ trợ và những ý kiến đóng góp quý báu từ giảng viên, đồng nghiệp cùng các cá nhân có liên quan. Những hỗ trợ đó là cơ sở để định hình nội dung nghiên cứu, tổ chức quá trình thực nghiệm và hoàn thiện cách trình bày kết quả.

Trước hết, người thực hiện xin bày tỏ lòng biết ơn chân thành đến **Thầy Võ Văn Thành**, giảng viên hướng dẫn, đã dành thời gian định hướng phạm vi đề tài, trao đổi các vấn đề chuyên môn và góp ý trong quá trình xây dựng khóa luận. Người thực hiện cũng xin cảm ơn quý thầy cô đã trang bị nền tảng kiến thức về cơ sở dữ liệu, kỹ thuật phần mềm, hệ thống phân tán và trí tuệ nhân tạo, giúp hình thành khả năng tiếp cận và giải quyết bài toán nghiên cứu.

Người thực hiện trân trọng cảm ơn những người đã hỗ trợ về môi trường kỹ thuật, tài liệu tham khảo và điều kiện thử nghiệm, đồng thời cảm ơn gia đình và bạn bè đã động viên trong quá trình học tập. Mặc dù đã nỗ lực nghiên cứu và kiểm tra, khóa luận khó tránh khỏi những hạn chế nhất định về tài nguyên thực nghiệm và độ bao phủ các kịch bản. Người thực hiện kính mong nhận được ý kiến đóng góp để tiếp tục hoàn thiện kết quả trong tương lai.

**CÔNG TRÌNH ĐƯỢC HOÀN THÀNH TẠI TRƯỜNG ĐẠI HỌC TÔN ĐỨC THẮNG**

Cán bộ hướng dẫn khoa học: ThS. Võ Văn Thành ...........................................................

(Ghi rõ học hàm, học vị, họ tên và chữ ký)

Khóa luận/Đồ án tốt nghiệp được bảo vệ tại **Hội đồng đánh giá Khóa luận/Đồ án tốt nghiệp của Trường Đại học Tôn Đức Thắng** vào ngày … / … / ……

Xác nhận của Chủ tịch Hội đồng đánh giá Khóa luận/Đồ án tốt nghiệp và Trưởng khoa quản lý chuyên ngành sau khi nhận Khóa luận/Đồ án tốt nghiệp đã được sửa chữa (nếu có).

**CHỦ TỊCH HỘI ĐỒNG                                        TRƯỞNG KHOA**

…………………………………………….                                        ………………**………………………………**

**LỜI CAM ĐOAN DÀNH CHO BẬC ĐÀO TẠO ĐẠI HỌC**

Tôi xin cam đoan đây là công trình nghiên cứu của riêng tôi và được sự hướng dẫn khoa học của ThS. Võ Văn Thành. Các nội dung nghiên cứu, kết quả trong đề tài này là trung thực và chưa công bố dưới bất kỳ hình thức nào trước đây. Những số liệu trong các bảng biểu phục vụ cho việc phân tích, nhận xét, đánh giá được chính tác giả thu thập từ các nguồn khác nhau có ghi rõ trong phần tài liệu tham khảo.

Ngoài ra, trong luận văn còn sử dụng một số nhận xét, đánh giá cũng như số liệu của các tác giả khác, cơ quan tổ chức khác đều có trích dẫn và chú thích nguồn gốc.

**Nếu phát hiện có bất kỳ sự gian lận nào tôi xin hoàn toàn chịu trách nhiệm về nội dung luận văn của mình.** Trường Đại học Tôn Đức Thắng không liên quan đến những vi phạm tác quyền, bản quyền do tôi gây ra trong quá trình thực hiện (nếu có).

TP. Hồ Chí Minh, ngày … tháng … năm 2026

Tác giả

(ký tên và ghi rõ họ tên)

**TÓM TẮT**

Trong thương mại điện tử và bán lẻ đa kênh, dữ liệu phát sinh liên tục từ đặt hàng, thanh toán, tồn kho, khuyến mãi và tương tác khách hàng. Lập báo cáo trực tiếp trên cơ sở dữ liệu tác nghiệp gây tranh chấp tài nguyên với luồng bán hàng, trong khi hệ tác nghiệp chỉ giữ trạng thái hiện tại nên không cung cấp được lịch sử thay đổi cho phân tích và cho các mô hình gợi ý. Đề tài xây dựng một nền tảng dữ liệu theo hướng Lakehouse, tách tải phân tích và AI khỏi cơ sở dữ liệu tác nghiệp mà vẫn chứng minh được dữ liệu ở kho khớp với nguồn.

Thay đổi trên PostgreSQL được thu nhận bằng Change Data Capture (Debezium, Kafka, Kafka Connect) và ghi thành tệp Parquet bất biến trên MinIO, đóng vai trò hồ dữ liệu tập trung. dbt điều phối các phép biến đổi trên ClickHouse qua các tầng staging, warehouse, serving và audit. Cập nhật và xoá được biểu diễn bằng phiên bản trên ReplacingMergeTree; bảng sự kiện được nạp tăng dần theo tập đơn có biến động với mốc nạp riêng cho từng nguồn CDC; một mô hình đối soát so số dòng và tổng tiền ở ba điểm (nguồn, hồ, kho) sau mỗi lượt chạy.

Ứng dụng thương mại điện tử GetShopy vừa là nguồn dữ liệu vừa là nơi tiêu thụ dữ liệu đã tinh chế: dashboard quản trị đọc kho; dịch vụ gợi ý AI-Rec trộn lọc cộng tác theo sản phẩm, lọc theo nội dung và kênh mua lại; trợ lý hội thoại phân loại ý định bằng NLI zero-shot và sinh câu trả lời dựa trên dữ liệu truy xuất; thanh toán chuyển khoản VietQR được đối soát qua webhook có xác thực chữ ký và xử lý idempotent.

Trên bộ dữ liệu mô phỏng 40.000 khách và 3.000.000 đơn, toàn bộ đơn đi qua đủ đường CDC – hồ – kho và đối soát ba tầng khớp; chính cơ chế đối soát đã phát hiện một lỗi mất dữ liệu thật của logic nạp tăng dần cũ. Với đánh giá offline cắt theo thời gian, cấu hình hybrid chọn trên validation tăng NDCG@10 tổng thể từ 0,309 lên 0,356 (CI 95% của chênh lệch \[+0,018; \+0,074\]); ở bài toán khám phá, lọc cộng tác đạt 0,377 so với 0,148 của Most-Popular. Một lần nạp dồn 3.000.000 đơn trên một máy cho thông lượng thu nhận khoảng 1.900 đơn/giây, giới hạn ở Debezium, và độ trễ từ lúc cam kết tới kho p50 263 giây, p95 439 giây; độ trễ theo nhiều mức tải và phục hồi sau lỗi chưa được đo. Mọi kết quả đều trên dữ liệu mô phỏng.

**Từ khoá:** Lakehouse; Change Data Capture; Kafka; ClickHouse; dbt; đối soát dữ liệu; hệ gợi ý; thương mại điện tử.

**ABSTRACT**

**Building a Modern Lakehouse Data Platform for Near Real-time Analytics and AI Applications in Retail / E-commerce**

Retail and e-commerce systems continuously generate data from orders, payments, inventory, promotions and customer interactions. Running analytical queries directly on the operational database competes with online transactions, and an operational store keeps only current state, so it cannot supply the change history needed for analytics and recommendation models. This thesis builds a Lakehouse-oriented data platform that offloads analytical and AI workloads from the operational database while still proving that warehouse data matches the source.

Changes in PostgreSQL are captured with Debezium, Kafka and Kafka Connect and written as immutable Parquet files on MinIO, which serves as a centralized data lake. dbt orchestrates transformations on ClickHouse across staging, warehouse, serving and audit layers. Updates and deletes are represented as versions in ReplacingMergeTree; the fact table is loaded incrementally from the set of changed orders with a separate watermark per CDC source; an audit model reconciles row counts and monetary totals across source, lake and warehouse after every run.

The GetShopy e-commerce application is both a data producer and a consumer of refined data: the admin dashboard reads the warehouse; the AI-Rec service blends item-based collaborative filtering, content-based filtering and a repurchase channel; a conversational assistant uses zero-shot NLI intent classification and retrieval-grounded generation; bank-transfer payments are reconciled through signed, idempotent webhooks.

On a simulated dataset of 40,000 customers and 3,000,000 orders, every order flowed through CDC, lake and warehouse and the three-layer reconciliation matched; the reconciliation itself caught a real data-loss bug in the earlier incremental logic. Under a time-based offline protocol, the validation-tuned hybrid raised overall NDCG@10 from 0.309 to 0.356 (95% CI of the difference \[+0.018, \+0.074\]); on the discovery task, item-based CF reached 0.377 versus 0.148 for Most-Popular. A single bulk load of 3,000,000 orders on one machine sustained about 1,900 orders per second, bounded by Debezium, with commit-to-warehouse latency of 263 s at p50 and 439 s at p95; latency across load levels and failure recovery have not been measured. All results are on simulated data.

**Keywords:** Lakehouse; Change Data Capture; Kafka; ClickHouse; dbt; data reconciliation; recommender systems; e-commerce.

**MỤC LỤC**

**DANH MỤC HÌNH VẼ**

Hình 2.1. Quy trình mua hàng trực tuyến

Hình 4.1. Kiến trúc tổng thể ba phân hệ và các đường dữ liệu

Hình 4.2. Luồng từ hồ dữ liệu tập trung xuống kho

Hình 4.3. Vòng đời một bản huấn luyện của AI-Rec

Hình 4.4. Luồng xử lý của trợ lý hội thoại

Hình 4.5. Vòng đời đơn chuyển khoản (rút gọn)

Hình 5.1. Nạp tăng dần theo tập đơn có biến động

Hình 5.2. Vòng đời một bản huấn luyện của AI-Rec

Hình 5.3. Chuỗi đầu-cuối từ giao dịch B2C tới kho và AI

**DANH MỤC BẢNG BIỂU**

Bảng 1.1. Mục tiêu cụ thể và minh chứng nghiệm thu

Bảng 1.2. Phạm vi của đề tài

Bảng 2.1. Các thách thức nghiệp vụ

Bảng 2.2. Tác nhân của hệ thống

Bảng 2.3. Các ca sử dụng nghiệp vụ tiêu biểu

Bảng 2.4. Yêu cầu chức năng theo nhóm

Bảng 2.5. Yêu cầu phi chức năng và nơi kiểm chứng

Bảng 3.1. So sánh hệ thống OLTP và OLAP trong đề tài

Bảng 3.2. So sánh kho dữ liệu, hồ dữ liệu và Lakehouse

Bảng 3.3. Đối chiếu các phương án kiến trúc dữ liệu

Bảng 3.4. Công nghệ và phiên bản theo phân hệ

Bảng 4.1. Các đường dữ liệu giữa ba phân hệ

Bảng 4.2. Các thực thể của cơ sở dữ liệu tác nghiệp

Bảng 4.3. Tổ chức tầng dữ liệu (đối chiếu Bronze – Silver – Gold)

Bảng 4.4. Các bảng phục vụ AI-Rec

Bảng 4.5. Trạng thái đối soát đề xuất

Bảng 4.6. Tham số của mô hình gợi ý

Bảng 5.1. Các trang giao diện

Bảng 5.2. Trạng thái đối soát giao dịch

Bảng 5.3. Cấu hình đã kiểm định và cấu hình đang chạy

Bảng 6.1. Các dịch vụ trong docker-compose.yml

Bảng 6.2. Các bộ sinh dữ liệu

Bảng 6.3. Bộ nhớ của hai cách khử trùng phiên bản

Bảng 6.4. Đối soát sau khi sửa logic nạp tăng dần (29/09/2026)

Bảng 6.5. Cấu hình chọn trên validation so với cấu hình cũ — NDCG@10 trên test

Bảng 6.6. Bài toán khám phá — mỗi mô hình tinh chỉnh trên validation, NDCG@10 trên test

Bảng 6.7. Hiện trạng tìm kiếm trên catalog 600.000 sản phẩm (đo 10/10/2026)

Bảng 6.8. Các trường hợp kiểm thử tích hợp đầu-cuối

Bảng 6.9. Kết quả rà soát tĩnh xác thực API

Bảng 7.1. Mức đạt của các mục tiêu cụ thể

Bảng A.1. API xác thực và tài khoản

Bảng A.2. API danh mục và sản phẩm phía khách

Bảng A.3. API giỏ hàng, đặt hàng và thanh toán

Bảng A.4. API onboarding, theo dõi hành vi và gợi ý

Bảng A.5. API trợ lý và tìm kiếm

Bảng A.6. API báo cáo và vận hành cho quản trị

Bảng A.7. API quản trị dữ liệu bán hàng

Bảng A.8. API quản trị thanh toán và giao nhận

Bảng A.9. API quản trị dữ liệu hội thoại của trợ lý

Bảng A.10. API phân tích hành vi

Bảng A.11. API kiểm tra sức khoẻ và dịch vụ nội bộ

Bảng A.12. Tuyến quản trị chỉ kiểm chữ ký JWT (14 tuyến)

Bảng A.13. Tuyến không có xác thực mà không phải công khai theo thiết kế

**DANH MỤC CÁC CHỮ VIẾT TẮT**

| Chữ viết tắt | Tiếng Anh | Giải thích |
| :---- | :---- | :---- |
| ACID | Atomicity, Consistency, Isolation, Durability | Bốn tính chất của giao dịch cơ sở dữ liệu |
| AI | Artificial Intelligence | Trí tuệ nhân tạo |
| API | Application Programming Interface | Giao diện lập trình ứng dụng |
| BI | Business Intelligence | Phân tích và báo cáo hỗ trợ kinh doanh |
| BM25 | Best Matching 25 | Hàm xếp hạng độ liên quan trong tìm kiếm văn bản |
| CDC | Change Data Capture | Thu nhận dữ liệu thay đổi |
| CF | Collaborative Filtering | Lọc cộng tác |
| CI | Confidence Interval | Khoảng tin cậy |
| COD | Cash on Delivery | Trả tiền khi nhận hàng |
| CSR | Compressed Sparse Row | Lưu ma trận thưa theo hàng |
| DCG, NDCG | (Normalized) Discounted Cumulative Gain | Chỉ số chất lượng xếp hạng (có chuẩn hoá) |
| DDL | Data Definition Language | Câu lệnh định nghĩa lược đồ |
| dbt | data build tool | Công cụ biến đổi và kiểm thử dữ liệu bằng SQL |
| EASE^R | Embarrassingly Shallow Autoencoder | Mô hình gợi ý tự mã hoá tuyến tính |
| ELT / ETL | Extract, Load, Transform / Extract, Transform, Load | Nạp trước rồi biến đổi / biến đổi rồi nạp |
| HMAC | Hash-based Message Authentication Code | Mã xác thực thông điệp dùng hàm băm |
| HTTP | Hypertext Transfer Protocol | Giao thức truyền siêu văn bản |
| iALS | implicit Alternating Least Squares | Phân rã ma trận cho phản hồi ngầm |
| JSON | JavaScript Object Notation | Định dạng dữ liệu văn bản có cấu trúc |
| JWT | JSON Web Token | Mã thông báo xác thực |
| KPI | Key Performance Indicator | Chỉ số hiệu quả chính |
| MAP | Mean Average Precision | Độ chính xác trung bình theo thứ hạng |
| NLI | Natural Language Inference | Suy luận ngôn ngữ tự nhiên |
| OLAP | Online Analytical Processing | Xử lý phân tích trực tuyến |
| OLTP | Online Transaction Processing | Xử lý giao dịch trực tuyến |
| POS | Point of Sale | Điểm bán hàng |
| QR | Quick Response (code) | Mã phản hồi nhanh |
| RAG | Retrieval-Augmented Generation | Sinh câu trả lời có truy xuất |
| RFM | Recency, Frequency, Monetary | Độ gần, tần suất và giá trị mua |
| S3 | Simple Storage Service | Giao diện lưu trữ đối tượng (MinIO tương thích) |
| SLA / SLO | Service Level Agreement / Objective | Thoả thuận / mục tiêu mức dịch vụ |
| SQL | Structured Query Language | Ngôn ngữ truy vấn có cấu trúc |
| URL | Uniform Resource Locator | Địa chỉ tài nguyên |
| UTC | Coordinated Universal Time | Giờ phối hợp quốc tế |
| VND | Vietnamese Dong | Việt Nam Đồng |
| WAL | Write-Ahead Log | Nhật ký ghi trước |
| MT, RQ, TN, UC, NFR | — | Ký hiệu trong báo cáo: mục tiêu, câu hỏi nghiên cứu, thực nghiệm, ca sử dụng, yêu cầu phi chức năng |

# **Chương 1\. Mở đầu**

## **1.1. Lý do chọn đề tài**

Cách làm phổ biến ở các hệ thống bán lẻ là đặt cả nghiệp vụ lẫn báo cáo lên cùng một cơ sở dữ liệu tác nghiệp. Cách này bộc lộ ba hạn chế:

1. **Hiệu năng và tranh chấp tài nguyên.** Cơ sở dữ liệu tác nghiệp lưu theo dòng, tối ưu cho đọc, ghi từng bản ghi. Truy vấn tổng hợp trên hàng triệu dòng phải đọc cả những cột không cần và tranh tài nguyên với luồng ghi đơn hàng; kho lưu theo cột phù hợp với tải phân tích hơn (Abadi et al., 2008).  
2. **Phân mảnh nguồn dữ liệu.** Sản phẩm, đơn hàng, khuyến mãi, tồn kho nằm ở nhiều nơi; mỗi báo cáo phải ghép tay và khó tái lập.  
3. **Không có nền dữ liệu sạch có lịch sử.** Cơ sở dữ liệu tác nghiệp chỉ giữ trạng thái hiện tại. Không có vết thay đổi theo thời gian thì không dựng được dữ liệu huấn luyện đúng thời điểm cho hệ gợi ý, cũng không đối chiếu được báo cáo với nguồn.

Song song, mua sắm trực tuyến đòi hỏi tìm kiếm bằng ngôn ngữ tự nhiên, tìm bằng hình ảnh và gợi ý cá nhân hoá — các chức năng cần đúng loại dữ liệu mà hệ tác nghiệp không giữ.

Nhóm đã có một nền tảng dữ liệu theo hướng Lakehouse: hồ dữ liệu tập trung lưu dữ liệu thô dạng Parquet trên MinIO, từ đó dữ liệu được biến đổi bằng dbt và nạp xuống kho ClickHouse theo mô hình chiều (Kimball & Ross, 2013). Đề tài đặt vấn đề: **dựng một ứng dụng thương mại điện tử thật trên nền tảng đó** thì tách được tải phân tích và AI khỏi cơ sở dữ liệu tác nghiệp tới mức nào, mà vẫn bảo đảm dữ liệu đúng, đủ và kịp thời. Đề tài cũng là dịp nghiên cứu đồng thời các nội dung nền tảng của kỹ thuật dữ liệu: hệ thống phân tán, xử lý sự kiện thay đổi, lưu trữ theo cột, chất lượng dữ liệu và phục vụ mô hình AI.

## **1.2. Câu hỏi nghiên cứu**

* **RQ1 — thu nhận thay đổi:** Làm thế nào thu nhận an toàn các thay đổi liên tục từ nguồn giao dịch mà hạn chế ảnh hưởng tới OLTP, đồng thời phát lại được sau lỗi?  
* **RQ2 — bản ghi nhiều phiên bản:** Làm thế nào tổ chức bản ghi nhiều phiên bản trên kho dữ liệu dạng cột để luôn có trạng thái mới nhất đúng với nguồn, mà không phải ghi lại toàn bộ bảng?  
* **RQ3 — kiểm chứng tự động:** Làm thế nào kiểm chứng tự động tính đúng, đủ, kịp thời và sẵn sàng của dữ liệu từ nguồn đến kho, và xác định được nơi phát sinh sai lệch?  
* **RQ4 — giá trị cho AI:** Dữ liệu đã tinh chế từ nền tảng có giúp hệ gợi ý tốt hơn đường cơ sở không cá nhân hoá và cấu hình cũ, trên một giao thức đánh giá offline có kiểm soát hay không?

RQ1 được đánh giá qua thông lượng, độ trễ và khả năng phục hồi (thực nghiệm TN1, TN2, TN5); RQ2 qua độ chính xác của trạng thái cuối và chi phí cập nhật (§5.2.3, §6.6.1, TN4); RQ3 qua kết quả đối soát và khả năng phát hiện sai lệch (§6.6.1, TN5); RQ4 qua các chỉ số xếp hạng offline (§6.6.3). Các thực nghiệm TN1–TN5 được mô tả ở §6.6.6.

## **1.3. Mục tiêu đề tài**

### **1.3.1. Mục tiêu tổng quát**

Thiết kế, hiện thực và kiểm chứng một nền tảng dữ liệu theo hướng Lakehouse phục vụ hệ thống thương mại điện tử: tiếp nhận thay đổi từ nguồn giao dịch, giữ lịch sử thô, biến đổi thành dữ liệu phân tích, và đưa kết quả tới dashboard cũng như dịch vụ gợi ý sản phẩm. Nền tảng phải tự kiểm tra chất lượng xuyên tầng và được đánh giá bằng số đo, không chỉ bằng việc các dịch vụ khởi động thành công.

### **1.3.2. Mục tiêu cụ thể**

*Bảng 1.1. Mục tiêu cụ thể và minh chứng nghiệm thu*

| Mã | Mục tiêu cụ thể | Minh chứng nghiệm thu |
| :---- | :---- | :---- |
| MT1 | Thiết lập luồng CDC qua hồ dữ liệu tới kho | Nhật ký connector, offset, tệp Parquet, lượt dbt và đối soát sau nạp |
| MT2 | Hợp nhất chính xác các lần cập nhật và xoá | Bộ tình huống thêm, sửa, xoá; kết quả FINAL hoặc argMax so với PostgreSQL |
| MT3 | Tăng hiệu năng truy vấn phân tích | 8–10 truy vấn cùng ngữ nghĩa, đo trên PostgreSQL và ClickHouse ở nhiều quy mô dữ liệu |
| MT4 | Tự động kiểm tra chất lượng và cảnh báo SLA | Mô hình audit, kiểm thử dbt, trạng thái sự cố, lịch sử phục hồi |
| MT5 | Chứng minh GetShopy dùng dữ liệu đầu vào và đầu ra của nền tảng | Đơn trên ứng dụng tới kho, dashboard và dịch vụ gợi ý |
| MT6 | Đánh giá mô hình gợi ý; thiết kế các module AI mở rộng | NDCG@10 (chỉ số chính), Precision, Recall, MAP so với đường cơ sở; bằng chứng tích hợp; đặc tả dự báo và khuyến mãi |
| MT7 | Chuẩn bị khả năng tái lập ở cấp cụm | Sơ đồ triển khai, cấu hình, hướng dẫn vận hành, diễn tập theo điều kiện tài nguyên |

Đề cương còn đặt các ngưỡng: vận hành liên tục tối thiểu 8 giờ ở mức 1.000 giao dịch mỗi phút; 8–10 truy vấn có p95 dưới 1 giây trên ít nhất 10 triệu dòng; đo ở 1, 10 và 50 triệu dòng nếu tài nguyên cho phép. Đây là **chỉ tiêu dự kiến**, chưa phải kết quả; mức đạt của từng mục tiêu được tổng kết ở Bảng 7.1.

### **1.3.3. Định hướng đóng góp**

Đề tài không đề xuất thuật toán học máy mới. Đóng góp nằm ở việc tổ chức một vòng đời dữ liệu khép kín có thể kiểm chứng: kiến trúc tách tải tác nghiệp khỏi tải phân tích mà vẫn giữ lịch sử thay đổi; cơ chế xử lý cập nhật bằng phiên bản kèm đối soát đúng với trạng thái logic cuối; và một ứng dụng thương mại điện tử cùng dịch vụ gợi ý chạy thật trên nền tảng, được đánh giá bằng thực nghiệm có đối chứng (§7.3).

## **1.4. Đối tượng và phạm vi nghiên cứu**

### **1.4.1. Đối tượng nghiên cứu**

* Kiến trúc tách tải tác nghiệp và phân tích: CDC dựa trên nhật ký, hồ dữ liệu, kho lưu theo cột, mô hình chiều.  
* Cơ chế xử lý cập nhật và xoá trên kho phân tích vốn tối ưu cho ghi thêm.  
* Hệ gợi ý lai trên dữ liệu phản hồi ngầm và phương pháp đánh giá offline.  
* Ứng dụng mô hình ngôn ngữ và thị giác có sẵn vào tìm kiếm và tư vấn trong thương mại điện tử.

### **1.4.2. Phạm vi**

*Bảng 1.2. Phạm vi của đề tài*

| Trong phạm vi | Ngoài phạm vi |
| :---- | :---- |
| Ứng dụng B2C GetShopy và trang quản trị | Ứng dụng di động |
| Nền tảng Lakehouse một máy, dựng bằng Docker Compose | Cụm nhiều máy; vận hành hệ thống thật của doanh nghiệp |
| Dịch vụ gợi ý (lọc cộng tác, lọc theo nội dung, mua lại) và đánh giá offline | Đánh giá trực tuyến (A/B test) với người dùng thật |
| Trợ lý hội thoại, tìm theo mô tả, tìm theo ảnh dùng mô hình có sẵn | Huấn luyện mô hình ngôn ngữ hoặc thị giác riêng |
| Thanh toán chuyển khoản qua SePay ở quy mô thử nghiệm, kèm bộ giả lập webhook | Vận hành thanh toán thương mại |
| Dữ liệu mô phỏng có hạt giống cố định, tái lập được | Dữ liệu thật của doanh nghiệp |

* **Nghiệp vụ:** bốn nhóm dữ liệu — đơn hàng và dòng đơn; sản phẩm, chi nhánh, tồn kho; khách hàng và hành vi; khuyến mãi, voucher, thanh toán. Luồng đơn hàng – thanh toán – gợi ý được chọn làm trường hợp đầu-cuối tiêu biểu.  
* **Kỹ thuật:** các thành phần như Apache Iceberg, Airflow, Kubernetes, Prometheus và Grafana là hướng phát triển, không được mô tả như thành phần đang chạy.  
* **Dữ liệu:** catalog 600.000 sản phẩm; bộ dữ liệu demo 40.000 khách và 3.000.000 đơn đã nạp đủ vào hệ (§6.4). Không dùng dữ liệu khách hàng thật; kết quả thực nghiệm được trình bày cùng giới hạn của bộ sinh dữ liệu.  
* **Thời gian:** 08/2026 – 12/2026. Phiên bản phần mềm và số liệu trong báo cáo phản ánh mã nguồn tại thời điểm viết.

## **1.5. Phương pháp nghiên cứu**

* **Nghiên cứu tài liệu:** Lakehouse, mô hình chiều, CDC dựa trên nhật ký, cơ chế hợp nhất của ClickHouse, hệ gợi ý và phương pháp đánh giá, phân loại văn bản zero-shot.  
* **Phát triển tăng dần theo lát cắt dọc:** mỗi vòng hoàn thành một mạch đi xuyên nguồn → kho → giao diện, thay vì làm xong từng tầng rồi mới nối.  
* **Thực nghiệm có đối chứng:** mọi cải tiến được so với trạng thái trước hoặc đường cơ sở, trên cùng dữ liệu và cùng giao thức; số liệu kèm khoảng tin cậy khi có thể.  
* **Kiểm chứng chất lượng dữ liệu:** kiểm thử dbt, đối soát checksum xuyên tầng, kiểm thử đơn vị và tích hợp cho các dịch vụ.

## **1.6. Ý nghĩa của đề tài**

* **Thực tiễn:** một mô hình tham chiếu chạy được trọn vẹn — từ đơn hàng trên web tới gợi ý quay về giao diện — dựng bằng một lệnh, có kiểm chứng từng chặng.  
* **Khoa học:** cho thấy cách xử lý cập nhật và xoá trên kho chỉ-ghi-thêm mà vẫn đúng trạng thái mới nhất, cách đối soát dữ liệu tự động xuyên tầng, và cách đánh giá hệ gợi ý trung thực trên dữ liệu phản hồi ngầm.

## **1.7. Bố cục báo cáo**

Ngoài chương mở đầu, báo cáo gồm sáu chương. Chương 2 tổng quan bối cảnh, nghiệp vụ và yêu cầu. Chương 3 trình bày nền tảng lý thuyết và công nghệ. Chương 4 trình bày thiết kế hệ thống. Chương 5 mô tả phần cài đặt từng phân hệ. Chương 6 trình bày triển khai, kiểm thử và đánh giá. Chương 7 kết luận và nêu hướng phát triển. Cuối báo cáo là danh mục tài liệu tham khảo.

# **Chương 2\. Tổng quan về đề tài**

## **2.1. Bối cảnh**

Bán lẻ thiết bị công nghệ hiện vận hành song song cửa hàng và kênh trực tuyến. Hoạt động bán hàng không còn diễn ra ở một quầy thanh toán hay một website riêng lẻ, mà trải qua nhiều điểm tiếp xúc: tìm kiếm, xem thông tin, thêm vào giỏ, dùng mã ưu đãi, đặt hàng, thanh toán, giao nhận, bảo hành và quay lại mua. Mỗi điểm tiếp xúc là một sự kiện hoặc một lần đổi trạng thái cần được ghi nhận chính xác. Một đơn hàng không chỉ có sự kiện tạo mới mà còn nhiều lần cập nhật trạng thái thanh toán, giao hàng, huỷ hoặc hoàn tiền; nếu chỉ giữ ảnh chụp trạng thái cuối, doanh nghiệp mất thông tin lịch sử cần cho phân tích và kiểm chứng.

Hệ thống nghiệp vụ ưu tiên toàn vẹn giao dịch, xử lý đồng thời nhiều yêu cầu ngắn và truy xuất nhanh theo khoá; PostgreSQL phù hợp vai trò này nhờ giao dịch ACID, chỉ mục và kiểm soát đồng thời. Ngược lại, câu hỏi phân tích như doanh thu theo tháng và danh mục, giá trị đơn trung bình theo chi nhánh hay tỉ lệ dùng voucher đòi hỏi quét nhiều bản ghi và tổng hợp theo nhiều chiều. Đặt hai loại tải trên cùng một cơ sở dữ liệu gây tranh chấp I/O, bộ nhớ đệm và CPU, nhất là khi dữ liệu tích luỹ qua nhiều kỳ.

Nhu cầu mới không dừng ở báo cáo tĩnh. Trải nghiệm mua sắm trực tuyến đòi hỏi tìm kiếm bằng ngôn ngữ tự nhiên, tìm bằng hình ảnh và gợi ý cá nhân hoá — những chức năng cần chính loại dữ liệu mà cơ sở dữ liệu tác nghiệp không giữ: lịch sử mua, hành vi duyệt, đặc trưng sản phẩm đã chuẩn hoá.

## **2.2. Bài toán đặt ra**

Doanh nghiệp cần một đường đi dữ liệu tái lập được, từ nguồn giao dịch sang vùng lưu trữ thô, tới kho phân tích và cuối cùng là báo cáo và các dịch vụ AI, sao cho truy vấn thống kê phức tạp không chạy trên cơ sở dữ liệu phục vụ giao dịch.

Bên cạnh tốc độ, độ tin cậy của dữ liệu là rủi ro lớn. Một dashboard có thể phản hồi dưới một giây mà vẫn sai, nếu sự kiện cập nhật chưa đi hết pipeline, bản ghi cũ chưa được hợp nhất, giá trị tiền bị đổi kiểu thiếu chính xác hoặc một lô Parquet chưa ghi xong. Vấn đề của đề tài vì vậy không phải "dựng đủ các container" mà là chứng minh số liệu cuối cùng khớp với nghiệp vụ nguồn tại một mốc đã chốt, rồi dùng chính dữ liệu đó để phục vụ gợi ý và tìm kiếm trên một ứng dụng thương mại điện tử chạy thật.

## **2.3. Khảo sát nghiệp vụ bán lẻ công nghệ trực tuyến**

### **2.3.1. Quy trình mua hàng**

Quy trình mua hàng trực tuyến với sản phẩm công nghệ gồm sáu bước:

1. Tìm kiếm và duyệt danh mục sản phẩm.  
2. Xem chi tiết, so sánh thông số kỹ thuật và cấu hình.  
3. Quản lý giỏ hàng, áp dụng mã khuyến mãi hoặc voucher.  
4. Đặt hàng và giữ chỗ tồn kho.  
5. Thanh toán bằng chuyển khoản VietQR hoặc trả tiền khi nhận hàng (COD).  
6. Theo dõi trạng thái đơn và giao nhận.

*Hình 2.1. Quy trình mua hàng trực tuyến*

### **2.3.2. Thách thức nghiệp vụ**

*Bảng 2.1. Các thách thức nghiệp vụ*

| Thách thức | Biểu hiện |
| :---- | :---- |
| Truy xuất ở quy mô lớn | Catalog hàng trăm nghìn sản phẩm: lọc nhiều điều kiện, phân trang sâu, tìm theo chuỗi con đều có nguy cơ quét toàn bảng |
| Tranh chấp tồn kho | Nhiều khách đặt cùng một món trong đợt flash sale; kiểm tra và trừ kho không nguyên tử thì bán vượt tồn |
| Đối soát thanh toán chuyển khoản | Khách chuyển thiếu, chuyển dư, chuyển trễ, ghi sai nội dung; cổng thanh toán gửi lại webhook nhiều lần |
| Tìm theo nhu cầu tự nhiên | Khách gõ "điện thoại chụp ảnh đẹp dưới 10 triệu", gõ không dấu, hoặc chỉ có ảnh sản phẩm |
| Báo cáo và AI trên dữ liệu tác nghiệp | Tổng hợp trên OLTP làm chậm luồng bán hàng; OLTP không giữ lịch sử thay đổi |

## **2.4. Hạn chế của phương án truyền thống**

* **Đọc phân tích trực tiếp trên OLTP.** Truy vấn nhóm theo nhiều chiều, nối các bảng lớn và trả về dữ liệu lịch sử có đặc điểm truy cập khác hẳn giao dịch tra một đơn. Khi dữ liệu tăng, thêm chỉ mục đơn lẻ không giải quyết được việc tách tải.  
* **Đồng bộ định kỳ thiếu nhật ký thay đổi.** Chỉ lấy bản ghi có created\_at lớn hơn mốc thì bỏ sót bản ghi cũ vừa đổi trạng thái; dùng updated\_at mà không có khoá phiên bản thì có thể nạp trùng hoặc bỏ sót ở ranh giới chu kỳ; bản ghi bị xoá không để lại dấu vết.  
* **Không có vùng dữ liệu thô bất biến.** Khi một phép biến đổi sai, yêu cầu hệ tác nghiệp gửi lại toàn bộ dữ liệu vừa tốn tài nguyên vừa không chắc còn đủ lịch sử. Một hồ dữ liệu giữ sự kiện thô cho phép dựng lại kết quả sau khi sửa logic.  
* **Thiếu đối soát và đo độ tươi.** Đội vận hành không biết dữ liệu đang đúng tới đâu. Đếm số dòng là chưa đủ; cần kết hợp số thực thể logic, tổng tiền nghiệp vụ, mốc đồng bộ và trạng thái xử lý của từng tầng.

## **2.5. Các bên liên quan và ca sử dụng**

### **2.5.1. Tác nhân**

*Bảng 2.2. Tác nhân của hệ thống*

| Tác nhân | Vai trò | Phạm vi dữ liệu |
| :---- | :---- | :---- |
| Khách vãng lai | Duyệt, tìm, xem sản phẩm, trò chuyện với trợ lý | Sản phẩm công khai |
| Khách hàng | Thêm: đặt đơn, thanh toán, theo dõi đơn, yêu thích, onboarding, nhận gợi ý cá nhân hoá | Dữ liệu gắn với tài khoản của mình |
| Quản trị viên | Quản lý catalog, đơn, giao nhận, đối soát thanh toán, xem báo cáo | Dữ liệu tác nghiệp và báo cáo |
| Kỹ sư dữ liệu | Vận hành CDC, Kafka, hồ dữ liệu, dbt, kho; đối soát, phát lại, sao lưu | Toàn bộ nền tảng dữ liệu |
| Người phát triển AI | Định nghĩa đặc trưng, huấn luyện, đánh giá, công bố mô hình | Chỉ đọc lược đồ serving |
| SePay | Gửi webhook giao dịch ngân hàng | Không đọc dữ liệu hệ thống |

Quan hệ giữa các tác nhân giải thích vì sao hệ thống gồm nhiều phân hệ: ứng dụng quản lý trạng thái nghiệp vụ theo nguyên tắc giao dịch; nền tảng dữ liệu thu nhận và tái trình bày các thay đổi; dịch vụ AI đọc dữ liệu đã chuẩn bị để tạo gợi ý. Liên kết giữa các phân hệ phải lỏng: ClickHouse hoặc dịch vụ AI tạm ngừng thì việc đặt đơn và ghi nhận thanh toán trên PostgreSQL vẫn hoạt động; khi phân hệ phân tích phục hồi, dữ liệu được đọc lại từ Kafka hoặc hồ dữ liệu.

### **2.5.2. Ca sử dụng tiêu biểu**

*Bảng 2.3. Các ca sử dụng nghiệp vụ tiêu biểu*

| Mã | Tác nhân | Ca sử dụng | Dữ liệu phát sinh và đầu ra |
| :---- | :---- | :---- | :---- |
| UC01 | Khách hàng | Đăng nhập và xem danh mục | Token truy cập; đọc bảng sản phẩm; sự kiện xem |
| UC02 | Khách hàng | Tạo đơn và mã thanh toán QR | Order, OrderItem, mã đối soát, bản ghi giữ chỗ tồn kho |
| UC03 | SePay | Gửi webhook, đối soát và cập nhật đơn | PaymentTransaction; đơn đã thanh toán hoặc trạng thái cần xử lý |
| UC04 | Quản trị viên | Quản lý vòng đời đơn | Các sự kiện cập nhật trên cùng khoá đơn |
| UC05 | Quản trị viên | Xem báo cáo doanh thu | Dashboard đọc kho qua view tương thích; Metabase đọc serving.mart\_revenue |
| UC06 | Khách hàng | Nhận sản phẩm gợi ý | Top-K từ AI-Rec, bổ sung thông tin sản phẩm và tồn kho từ OLTP |
| UC07 | Kỹ sư dữ liệu | Kiểm tra lệch nguồn – hồ – kho | Kết quả audit.checksum\_orders mỗi lượt dbt |
| UC08 | Kỹ sư dữ liệu | Phát lại dữ liệu sau lỗi | Offset Kafka, tệp Parquet, chạy lại dbt, kết quả đối soát sau phục hồi |
| UC09 | Nhà phân tích | Khai thác dự báo, khuyến mãi | Kịch bản định hướng, chưa hiện thực (§3.6) |

## **2.6. Yêu cầu chức năng**

*Bảng 2.4. Yêu cầu chức năng theo nhóm*

| Nhóm | Yêu cầu |
| :---- | :---- |
| A. Thương mại điện tử | Duyệt danh sách sản phẩm quy mô lớn; lọc theo danh mục, hãng, giá; sắp xếp; tìm theo từ khoá; chi tiết sản phẩm, mô hình 3D, so sánh cấu hình; giỏ hàng, đặt đơn theo biến thể, voucher, flash sale; thanh toán COD và chuyển khoản VietQR; theo dõi đơn; đăng nhập email, Google; onboarding sở thích; trang quản trị. |
| B. Trợ lý, tìm kiếm, gợi ý | Trợ lý hội thoại về chính sách và sản phẩm; tìm theo mô tả, theo hình ảnh và nhập câu hỏi bằng giọng nói; thu thập lịch sử mua và hành vi duyệt; gợi ý cá nhân hoá, xử lý khách mới, chỉ gợi ý sản phẩm còn bán. |
| C. Nền tảng dữ liệu | Thu nhận thay đổi (thêm, sửa, xoá) từ OLTP về hồ dữ liệu; chuẩn hoá ở staging; quản lý phiên bản ở kho; phục vụ báo cáo và đặc trưng AI; đối soát xuyên tầng. |
| D. Báo cáo | Doanh thu, bán lẻ, hiệu quả chiến dịch đọc từ kho. |

Mỗi yêu cầu được nối với một cách kiểm thử. Ví dụ: một đơn đi từ chờ thanh toán sang đã thanh toán phải xuất hiện đúng ở nguồn, topic Kafka, hồ dữ liệu và trạng thái logic cuối trong ClickHouse; gợi ý phải trả kết quả cho khách đăng nhập, không làm vỡ trang chủ với khách vãng lai, và không gợi ý hàng đã hết.

## **2.7. Yêu cầu phi chức năng**

*Bảng 2.5. Yêu cầu phi chức năng và nơi kiểm chứng*

| Mã | Nhóm | Yêu cầu | Kiểm chứng |
| :---- | :---- | :---- | :---- |
| NFR01 | Tính đúng | Sau thời gian chờ hoà, trạng thái cuối và giá trị tiền ở kho khớp nguồn | §6.6.1 |
| NFR02 | Tính đủ | Không thiếu khoá đơn sau thời gian chờ hoà, chứng minh bằng đối soát số thực thể logic | §6.6.1 |
| NFR03 | Tính kịp thời | Đo p50, p95, p99 từng chặng và toàn chuỗi; mục tiêu phải phù hợp hai lịch 5 phút hiện tại | Đo một phần: một mức tải (§6.6.6) |
| NFR04 | Hiệu năng | Tải phân tích không chạy trên OLTP; 8–10 truy vấn đại diện so với PostgreSQL ở quy mô đủ lớn | Chưa đo (§6.6.6) |
| NFR05 | Chịu lỗi | Dừng, khởi động lại thành phần mà không mất hoặc nhân đôi trạng thái cuối | Chưa đo (§6.6.6) |
| NFR06 | Bảo mật | Phân quyền theo tầng; máy chủ tự tính lại tổng tiền; webhook xác thực chữ ký và xử lý idempotent; danh tính lấy từ token; luân chuyển bí mật | §4.8, §6.6.2; còn thiếu ở §7.4 |
| NFR07 | Quan sát | Có chỉ số Kafka lag, tệp ở hồ, thời gian dbt, ClickHouse, audit và AI | Chưa triển khai (§7.5) |
| NFR08 | Tái lập | Cấu hình có phiên bản, dữ liệu mô phỏng có hạt giống cố định, dựng toàn hệ bằng một lệnh | §6.1, §6.4 |
| NFR09 | Bảo trì | Quy ước đặt tên, chú thích mô hình dữ liệu, hợp đồng dữ liệu | §4.3 |
| NFR10 | Mở rộng | Định lượng thông lượng bão hoà và nêu phương án cụm thay vì khẳng định mở rộng vô hạn | Đo một phần: thông lượng bão hoà một nút (§6.6.6) |
| NFR11 | An toàn tồn kho | Không bán vượt tồn khi đặt đồng thời | §5.1.4, §6.6.2 |
| NFR12 | Suy giảm êm | Kho hoặc dịch vụ AI lỗi thì có đường dự phòng, không chặn luồng mua hàng | §5.1.7, §5.3.4 |

Bảng trên phân biệt **yêu cầu đề xuất** với **kết quả đã đạt**. Ví dụ, hai lịch 5 phút nối tiếp (dbt, rồi huấn luyện AI-Rec) làm thay đổi phản ánh vào gợi ý sau khoảng 10–11 phút theo cấu hình, nên không thể tuyên bố "gợi ý cập nhật ngay sau mỗi giao dịch". Tương tự, mục tiêu p95 dưới một giây dành cho truy vấn phân tích không đại diện cho độ trễ đồng bộ từ CDC tới AI.

## **2.8. Định hướng giải pháp**

Không một công nghệ riêng lẻ nào giải quyết được toàn bộ bài toán. Đề tài tổ chức giải pháp thành một chuỗi, mỗi khâu giải quyết một hạn chế ở §2.4:

* CDC đọc nhật ký giao dịch để thu nhận mọi thay đổi mà không thêm tải lên OLTP.  
* Kafka làm vùng đệm và nhật ký phát lại được.  
* Hồ dữ liệu giữ sự kiện thô bất biến, là nguồn sự thật của tầng phân tích.  
* ClickHouse và dbt chuẩn hoá, quản lý phiên bản, dựng kho theo mô hình chiều.  
* Đối soát ba tầng xác lập độ tin cậy của số liệu.  
* Ứng dụng GetShopy và các dịch vụ AI dùng dữ liệu đã tinh chế, kiểm chứng giá trị khai thác.

Chương 3 trình bày nền tảng lý thuyết và công nghệ của từng khâu; Chương 4 cụ thể hoá yêu cầu thành thiết kế kiến trúc, hợp đồng dữ liệu và tiêu chí kiểm chứng.

# **Chương 3\. Nền tảng công nghệ áp dụng**

Chương này trình bày các khái niệm và công nghệ mà thiết kế ở Chương 4 dựa vào: kiến trúc dữ liệu phân tích, thu nhận dữ liệu thay đổi, hệ gợi ý, tìm kiếm và hiểu ngôn ngữ tự nhiên, toàn vẹn giao dịch. Mỗi mục nêu khái niệm, giới hạn của nó và cách đề tài áp dụng; chi tiết hiện thực nằm ở Chương 5\.

## **3.1. Kiến trúc dữ liệu phân tích**

### **3.1.1. Hệ thống tác nghiệp và hệ thống phân tích**

Hệ thống xử lý giao dịch trực tuyến (OLTP) tối ưu cho nhiều yêu cầu đọc, ghi ngắn trên một hoặc vài bản ghi, đòi hỏi nhất quán ngay tại thời điểm xác nhận, cô lập giữa các giao dịch đồng thời và bảo toàn ràng buộc khoá. Trong đề tài, PostgreSQL là nơi quyết định trạng thái nghiệp vụ: Order, OrderItem, PaymentTransaction, Product được ghi hoặc cập nhật tại đây qua API.

Hệ thống xử lý phân tích trực tuyến (OLAP) tối ưu cho truy vấn quét, lọc và tổng hợp khối lượng lớn bản ghi theo thời gian và theo chiều phân tích. Hệ lưu theo cột chỉ đọc các cột được truy vấn, nén tốt vì dữ liệu cùng kiểu nằm liền nhau và xử lý theo lô vector, nên phù hợp với tải phân tích hơn hệ lưu theo dòng (Abadi et al., 2008). Điều này không có nghĩa PostgreSQL luôn chậm hơn ClickHouse: chênh lệch chỉ kết luận được khi đo trên cùng dữ liệu, cùng truy vấn và cùng phần cứng.

*Bảng 3.1. So sánh hệ thống OLTP và OLAP trong đề tài*

| Tiêu chí | OLTP – PostgreSQL | OLAP – ClickHouse |
| :---- | :---- | :---- |
| Mục tiêu | Độ trễ giao dịch ngắn, toàn vẹn khi cập nhật | Tổng hợp khối dữ liệu lớn, truy vấn đa chiều |
| Đơn vị thao tác | Một đơn, một khách, một giao dịch | Nhiều dòng trong một khoảng thời gian hoặc nhóm sản phẩm |
| Kiểu ghi | Thêm, sửa, xoá theo nghiệp vụ | Chủ yếu thêm theo lô; cập nhật biểu diễn bằng phiên bản |
| Tổ chức dữ liệu | Mô hình quan hệ chuẩn hoá | Bảng sự kiện, bảng chiều và bảng phục vụ |
| Nhất quán | Xác nhận ngay trong giao dịch | Nhất quán sau cùng, trong ngưỡng độ tươi |
| Vai trò trong đề tài | Nguồn sự thật nghiệp vụ | Phục vụ báo cáo và đặc trưng cho AI |

### **3.1.2. Data warehouse, data lake và Lakehouse**

Kho dữ liệu (data warehouse) tích hợp dữ liệu đã mô hình hoá, có lược đồ chặt, phục vụ báo cáo và phân tích lịch sử. Hồ dữ liệu (data lake) lưu dữ liệu thô ở định dạng mở như Parquet trên kho đối tượng giá rẻ, giữ được chi tiết để phát lại, nhưng tự nó không bảo đảm chất lượng: tính đúng phụ thuộc vào lược đồ, quy tắc đọc và quy trình biến đổi.

Kiến trúc phổ biến trước đây ghép hai hệ thành hai tầng: hồ giữ dữ liệu thô, một phần được ETL tiếp vào kho. Armbrust et al. (2021) chỉ ra nhược điểm của cách này: dữ liệu bị giữ hai bản, bản ở kho trễ so với hồ, và thêm một bước ETL dễ lỗi. Lakehouse đưa các tính năng quản trị của kho — giao dịch ACID, phiên bản dữ liệu, tối ưu truy vấn — xuống chạy trực tiếp trên tệp mở ở hồ, thường qua một định dạng bảng mở như Delta Lake (Armbrust et al., 2020\) hoặc Apache Iceberg.

*Bảng 3.2. So sánh kho dữ liệu, hồ dữ liệu và Lakehouse*

| Tiêu chí | Data warehouse | Data lake | Lakehouse |
| :---- | :---- | :---- | :---- |
| Dữ liệu | Đã mô hình hoá, lược đồ chặt | Thô, nhiều dạng, lược đồ khi đọc | Thô và đã tinh chế trên cùng nền lưu trữ |
| Lưu trữ | Định dạng riêng của hệ quản trị | Tệp mở trên kho đối tượng | Tệp mở kèm định dạng bảng có giao dịch |
| Điểm mạnh | Quản trị tốt, truy vấn phân tích nhanh | Rẻ, linh hoạt, giữ mọi dữ liệu thô | Một bản dữ liệu, có quản trị và phát lại |
| Điểm yếu | Đắt, kém linh hoạt với dữ liệu thô | Thiếu giao dịch và quản trị | Cần catalog, engine tương thích, chính sách gộp tệp |

**Định vị kiến trúc của đề tài.** Đề tài theo hướng Lakehouse, trong đó hồ dữ liệu là hồ tập trung: mọi thay đổi giao dịch đổ về hồ trước, sau đó mới được biến đổi và nạp xuống kho. Ba nguyên tắc:

1. Hồ dữ liệu là nguồn sự thật của tầng phân tích. Thay đổi từ OLTP được ghi xuống hồ ở dạng Parquet bất biến, nên phát lại được khi tầng sau hỏng.  
2. Biến đổi đọc thẳng từ hồ. Tầng staging là view đọc trực tiếp tệp Parquet qua hàm s3() của ClickHouse; giữa hồ và kho không có hệ ETL nào khác ngoài dbt.  
3. Kho là dữ liệu dẫn xuất. Bảng sự kiện dựng lại được hoàn toàn từ hồ; việc này đã được thực hiện khi full-refresh fact\_orders\_detail từ Parquet và cho kết quả khớp nguồn tới từng dòng (§6.6.1).

Đề tài **khác Lakehouse theo định nghĩa của Armbrust et al. (2021)** ở chỗ tầng tinh chế (warehouse, serving) nằm trong định dạng riêng của ClickHouse, chưa nằm trên định dạng bảng mở ở hồ. Lý do: MergeTree cho phép sắp xếp vật lý theo khoá, nén theo cột, và ReplacingMergeTree xử lý cập nhật bằng phiên bản (§3.2.6) — các tính năng cần để dashboard và AI-Rec đọc với độ trễ thấp. Đưa tầng tinh chế lên định dạng bảng mở là hướng phát triển (§7.5).

### **3.1.3. Phân tầng Bronze – Silver – Gold**

Cách phân tầng này chia trách nhiệm biến đổi thành ba lớp. **Bronze** giữ bản gốc từ hệ nguồn kèm siêu dữ liệu sự kiện (topic, thời điểm, khoá). **Silver** diễn giải thông điệp CDC, làm phẳng before/after, chuẩn hoá kiểu và múi giờ, khử trùng lặp và chọn phiên bản. **Gold** tổ chức các thực thể đã chuẩn hoá thành bảng sự kiện, bảng chiều và bảng tổng hợp theo bài toán kinh doanh.

Trong đề tài, Silver không phải một hệ lưu trữ riêng: staging là view đọc thẳng Parquet, warehouse là bảng ClickHouse. Phân tầng theo mục đích giúp khoanh vùng lỗi và tái xử lý: sai ở phép tính doanh thu thì sửa mô hình serving rồi chạy lại từ warehouse, không đụng dữ liệu gốc. Bảng 4.3 đối chiếu từng tầng với lược đồ cụ thể.

### **3.1.4. ETL, ELT và xử lý tăng dần**

Với ETL, dữ liệu được biến đổi trước khi nạp vào đích; với ELT, dữ liệu được nạp trước rồi biến đổi bằng năng lực xử lý tại đích. Đề tài theo ELT: thay đổi nghiệp vụ được ghi xuống hồ trước, dbt gửi SQL tới ClickHouse để đọc và biến đổi. Thời điểm nhận dữ liệu nhờ vậy tách khỏi thời điểm đổi quy tắc nghiệp vụ.

Xử lý tăng dần (incremental) tránh tính lại toàn bộ dữ liệu sau mỗi chu kỳ. Một mốc nạp (watermark) biểu diễn tiến độ xử lý, ví dụ thời điểm sự kiện lớn nhất đã nạp. Mốc nạp không nên chỉ là max(created\_at) khi bản ghi cũ còn được sửa, và không nên dùng điều kiện "lớn hơn" cứng ở biên khi dấu thời gian có thể trùng. Đề tài giữ mốc nạp riêng cho từng nguồn CDC, so sánh bằng "lớn hơn hoặc bằng" để đọc lại biên, và để ReplacingMergeTree hợp nhất các bản bị nạp lại, nên chạy lại cùng một khoảng dữ liệu vẫn cho cùng trạng thái cuối (§5.2.3).

### **3.1.5. Mô hình chiều và hạt dữ liệu**

Theo phương pháp mô hình chiều, bảng sự kiện (fact) chứa thước đo nghiệp vụ ở một hạt đã xác định, còn bảng chiều (dimension) cung cấp bối cảnh phân tích (Kimball & Ross, 2013). Với nghiệp vụ bán hàng, hạt tự nhiên là **một dòng hàng trong một đơn**, không phải mỗi đơn một dòng: tổng theo sản phẩm, danh mục hay hãng chỉ đúng khi thước đo nằm ở hạt dòng hàng.

Thiết kế phải định nghĩa rõ đơn vị doanh thu. Tổng tiền đặt khác tiền đã thanh toán; tiền đã thanh toán khác doanh thu sau hoàn tiền. Không được cộng tất cả phiên bản trạng thái của một đơn vì sẽ nhân giá trị lên nhiều lần. Hạt của bảng sự kiện, điều kiện hợp lệ của khoản tiền và ngày ghi nhận phải được ghi trong hợp đồng dữ liệu (§4.3).

### **3.1.6. So sánh các phương án kiến trúc**

*Bảng 3.3. Đối chiếu các phương án kiến trúc dữ liệu*

| Phương án | Ưu điểm | Giới hạn với bài toán | Vai trò trong đề tài |
| :---- | :---- | :---- | :---- |
| Báo cáo trực tiếp trên PostgreSQL | Dễ triển khai; dữ liệu luôn mới | Tranh chấp tài nguyên với luồng bán hàng; không giữ lịch sử thay đổi | Đường cơ sở đề xuất cho thực nghiệm TN3 |
| Kho OLAP nạp theo lô | Đơn giản; truy vấn phân tích nhanh | Độ trễ gắn với lịch nạp; cập nhật cần quy tắc riêng | Phương án đối chứng |
| CDC → Kafka → hồ → ClickHouse | Tách tải; có nhật ký; phát lại được | Nhiều thành phần; nhất quán sau cùng; cần đối soát | Phương án chính của đề tài |
| Kho dữ liệu dịch vụ đám mây | Giảm gánh vận hành | Chi phí theo mức dùng; phụ thuộc nhà cung cấp | Tham chiếu, không đo |
| Định dạng bảng mở (Iceberg, Delta) trên hồ | Snapshot, metadata, tiến hoá lược đồ | Cần catalog, engine tương thích, gộp tệp | Hướng phát triển |

Chọn hệ tự vận hành không có nghĩa chi phí luôn thấp hơn dịch vụ quản lý. Lý do chính trong khoá luận là khả năng nghiên cứu sâu từng khâu thu nhận, lưu trữ, đối soát và đo lường trong một môi trường tái lập được.

## **3.2. Thu nhận và xử lý dữ liệu thay đổi**

### **3.2.1. Change Data Capture dựa trên nhật ký**

Change Data Capture (CDC) nhận biết và truyền các thay đổi đã cam kết ở cơ sở dữ liệu nguồn. CDC dựa trên nhật ký đọc nhật ký giao dịch thay vì truy vấn bảng, nên không thêm tải đọc lên OLTP và bắt được mọi thay đổi, kể cả cập nhật và xoá, theo đúng thứ tự cam kết (Kleppmann, 2017). PostgreSQL ghi mọi thay đổi vào WAL (Write-Ahead Log); với wal\_level \= logical, cơ chế logical decoding trích ra được thay đổi ở mức dòng (PostgreSQL Global Development Group, n.d.). Debezium dùng cơ chế này: sau một lần chụp toàn bộ dữ liệu hiện có (snapshot), connector đọc tiếp WAL từ vị trí đã ghi nhớ trong replication slot (Debezium, n.d.).

Mỗi thông điệp CDC có phần before (trạng thái trước), after (trạng thái sau), op (loại thao tác: c tạo, u cập nhật, d xoá, r bản ghi snapshot) và ts\_ms. Cần phân biệt thời điểm phát sinh ở nguồn, thời điểm connector đọc, thời điểm Kafka nhận và thời điểm kho xử lý — mỗi mốc phục vụ một phép đo độ trễ khác nhau (§4.4.4).

Hai rủi ro vận hành: replication slot bị bỏ quên giữ WAL lại và có thể làm đầy đĩa nguồn; thay đổi lược đồ (DDL) không tự truyền qua luồng thay đổi dòng nên cần quy trình nâng cấp riêng.

### **3.2.2. Apache Kafka**

Kafka là nền tảng nhật ký sự kiện phân tán: dữ liệu được ghi vào topic, mỗi topic gồm các partition có thứ tự; consumer đọc theo offset và có thể đọc lại trong thời hạn lưu (Kreps et al., 2011; Apache Software Foundation, n.d.). Trong đề tài, mỗi bảng nguồn ứng với một topic (cdc\_prod.public.Order, cdc\_prod.public.OrderItem). Kafka chỉ bảo đảm thứ tự **trong một partition**; khi khoá thông điệp là khoá chính, các thay đổi của cùng một bản ghi đi vào cùng partition và giữ đúng thứ tự. Không được suy ra thứ tự giữa hai topic, hay giữa các bảng trong cùng một giao dịch, từ tính chất này.

Có Kafka không tự suy ra được pipeline "chính xác một lần" từ đầu đến cuối. Nếu consumer ghi tệp xuống kho đối tượng rồi gặp sự cố trước khi lưu offset, một số thông điệp sẽ được ghi lại lần nữa. Kết quả cuối đúng cần kết hợp khoá sự kiện ổn định, xử lý idempotent, quy tắc chọn phiên bản và đối soát.

### **3.2.3. Kafka Connect S3 Sink và định dạng Parquet**

S3 Sink Connector chuyển thông điệp trong topic thành tệp trên kho đối tượng tương thích S3 (Confluent, n.d.). Đề tài cấu hình connector ghi Parquet vào bucket data-lake trên MinIO, phân vùng theo ngày (year=/month=/day=, múi giờ UTC), đóng tệp khi đủ 1.000 bản ghi hoặc sau 15 giây theo đồng hồ hệ thống. Xoay tệp theo đồng hồ giúp đơn cuối cùng không nằm mãi trong bộ đệm khi ít giao dịch, nhưng làm việc chia tệp không còn tất định, nên connector không giữ được bảo đảm ghi chính xác một lần; trùng lặp vì vậy được xử lý ở tầng sau bằng phiên bản (§3.2.6).

Apache Parquet là định dạng theo cột: dữ liệu chia thành row group và column chunk, metadata cho phép trình đọc chỉ lấy các cột cần thiết (Apache Parquet, n.d.). Hiệu năng không chỉ phụ thuộc định dạng: chu kỳ xoay tệp quá ngắn khi tải thấp sinh nhiều tệp nhỏ, làm tăng chi phí liệt kê tệp và đọc metadata. Gộp tệp nhỏ (compaction) là việc cần làm khi dữ liệu lớn dần.

### **3.2.4. Tầng Bronze và nguyên tắc bất biến**

Dữ liệu Bronze phải đủ để diễn giải lại lịch sử và dựng lại trạng thái cuối. "Bất biến" ở đây là nguyên tắc chỉ ghi thêm sự kiện, không sửa bản ghi cũ — không có nghĩa tệp được bảo vệ tuyệt đối trước việc bị xoá. Nếu chỉ nạp phần after và bỏ thông điệp xoá, kết quả có thể giữ lại đơn đã bị xoá. Khi phân vùng theo thời điểm ghi, cần giữ thêm thời điểm nghiệp vụ của sự kiện, vì sự kiện phát sinh hôm trước có thể được ghi xuống hôm sau.

### **3.2.5. Staging, chuẩn hoá và xử lý cập nhật, xoá**

Ở staging, thông điệp CDC được diễn giải thành các cột thường dùng: khoá nguồn, loại thao tác, thời điểm nguồn và các trường nghiệp vụ. Kiểu dữ liệu phải ổn định giữa các thế hệ tệp; đề tài truy cập trường theo tên và đặt giá trị mặc định để view đọc được cả hai thế hệ Parquet có lược đồ khác nhau. Dù vậy, thiếu một trường quan trọng phải bị kiểm thử phát hiện, không được lặng lẽ biến thành 0 rồi làm sai doanh thu.

Một thực thể logic có thể ứng với nhiều sự kiện. Phép hợp nhất chọn bản có phiên bản lớn nhất theo khoá; thông điệp xoá phải được giữ tới bước chọn phiên bản, sau đó mới loại khỏi view nghiệp vụ. Loại thông điệp op \= 'd' trước khi hợp nhất thì bản ghi cũ có thể "sống lại".

### **3.2.6. ClickHouse và ReplacingMergeTree**

ClickHouse là hệ quản trị phân tích lưu theo cột. Họ engine MergeTree sắp xếp dữ liệu theo khoá, chia thành các part và hợp nhất bất đồng bộ. Với ReplacingMergeTree(version, is\_deleted), các dòng có cùng **khoá ORDER BY** được coi là các phiên bản của một thực thể; khi hợp nhất part, engine giữ phiên bản lớn nhất và bỏ thực thể có cờ xoá (ClickHouse, n.d.). Việc hợp nhất chạy nền, không có thời điểm bảo đảm, nên truy vấn cần kết quả đúng ngay phải đọc kèm FINAL để hợp nhất lúc đọc.

Hai điều kiện để cách làm này đúng: khoá ORDER BY phải ổn định suốt vòng đời thực thể, không chứa trường thay đổi như trạng thái đơn; và các phiên bản của cùng một khoá phải nằm cùng phân vùng, vì hợp nhất không diễn ra xuyên phân vùng.

Ví dụ: đơn A lần lượt có phiên bản 10 (PENDING), 11 (PAID), 12 (CANCELLED). Đếm trực tiếp trên bảng vật lý có thể ra ba dòng; SELECT … FINAL trả một trạng thái logic là CANCELLED. Phát lại phiên bản 11 thêm một lần nữa thì kết quả cuối vẫn không đổi.

### **3.2.7. dbt và kiểm thử dữ liệu**

dbt (data build tool) mô tả các phép biến đổi bằng SQL có quan hệ phụ thuộc, cấu hình cách vật liệu hoá (view, table, incremental), sinh tài liệu và chạy kiểm thử dữ liệu. Bốn phép kiểm thử dựng sẵn là unique, not\_null, accepted\_values và relationships (dbt Labs, n.d.). Với mô hình incremental, cơ chế thực thi phụ thuộc adapter và chiến lược (append, delete+insert…), nên phải kiểm chứng tính chạy lại được trên chính hệ đích. Đề tài dùng lệnh dbt build — chạy mô hình rồi chạy kiểm thử trong cùng một lượt — để phép đối soát ba tầng chạy mỗi chu kỳ.

### **3.2.8. Chất lượng dữ liệu**

Chất lượng dữ liệu được xét theo bốn chiều: **đúng** — giá trị sau biến đổi khớp ngữ nghĩa nguồn; **đủ** — mọi thực thể cần thiết có mặt sau thời gian đồng bộ cho phép; **kịp thời** — dữ liệu nằm trong giới hạn trễ đã thoả thuận; **sẵn sàng** — pipeline và truy vấn phục vụ hoàn thành được khi cần. Chất lượng dữ liệu khác tính sẵn sàng của hệ thống: một dịch vụ vẫn trả HTTP 200 trong khi dữ liệu đã cũ hoặc sai.

Đối soát ba điểm đo nghĩa là tính độc lập các chỉ số trên PostgreSQL, hồ và kho tại cùng một mốc logic. Phải phân biệt số **sự kiện CDC** ở hồ với số **thực thể logic** ở nguồn và kho: một đơn đổi bốn lần sinh nhiều sự kiện nhưng chỉ là một thực thể. Hồ vì vậy phải được đưa về trạng thái cuối theo từng khoá trước khi so (§4.4). Các phép tổng tiền phải dùng kiểu chính xác (số nguyên hoặc Decimal), không dùng số thực dấu phẩy động.

## **3.3. Hệ gợi ý**

### **3.3.1. Bài toán gợi ý trong thương mại điện tử**

Hệ gợi ý cá nhân hoá dự đoán tập sản phẩm phù hợp với từng khách dựa trên lịch sử mua hoặc tương tác. Ngoài độ chính xác, gợi ý phải là sản phẩm còn bán, không vi phạm điều kiện kinh doanh và không làm chậm trang. Kiến trúc gợi ý vì vậy gồm cả tầng dữ liệu, thuật toán và tầng phục vụ, không dừng ở một công thức tương đồng.

### **3.3.2. Phản hồi ngầm**

Phản hồi tường minh (chấm sao) cho biết khách thích hay không; phản hồi ngầm (mua, xem, thêm giỏ) chỉ cho biết mức tin cậy rằng khách quan tâm, và không cho biết khách không thích gì. Hu et al. (2008) đề xuất coi số lần tương tác là độ tin cậy và nén qua thang log để vài tương tác lớn không lấn át. Đề tài dùng lịch sử mua làm tín hiệu chính, áp thang log và giảm trọng số theo thời gian với half-life h — tương tác cũ được tính ít hơn tương tác gần đây (Ding & Li, 2005).

### **3.3.3. Lọc cộng tác theo sản phẩm**

Lọc cộng tác (collaborative filtering) khai thác hành vi của nhiều khách để tìm quan hệ giữa khách và sản phẩm. Lọc cộng tác theo sản phẩm (item-based) coi hai món là tương đồng khi được cùng những khách mua; điểm của món j với khách u là tổng độ tương đồng giữa j và các món u đã mua, có trọng số (Sarwar et al., 2001). Độ tương đồng giữa các món ổn định hơn giữa các khách và tính trước được, nên phương pháp mở rộng được tới danh mục lớn (Linden et al., 2003).

Với ma trận tương tác thưa R (khách × món), độ tương đồng cosine giữa hai món i và j:

sim(i, j) \= Σ\_u R(u, i) · R(u, j) / ( √Σ\_u R(u, i)² · √Σ\_u R(u, j)² )

Nhược điểm đã biết: món có quá ít người mua có thể nhận cosine cao ngẫu nhiên vì trùng đúng một khách. Đề tài chỉ đưa vào ma trận các món có ít nhất ba khách mua khác nhau (Bảng 4.6). Công thức cụ thể của trọng số tương tác và cách tính điểm ở §5.3.2.

### **3.3.4. Lọc theo nội dung**

Lọc theo nội dung (content-based filtering) dựng hồ sơ khách trên đặc trưng sản phẩm — danh mục, hãng, tầm giá — rồi chấm điểm món theo độ khớp với hồ sơ (Pazzani & Billsus, 2007; Lops et al., 2011). Vì chỉ cần đặc trưng của món, phương pháp phục vụ được khách mới từ câu trả lời onboarding và món mới chưa ai mua. Đổi lại, gợi ý dễ bó hẹp trong những gì khách đã biết.

### **3.3.5. Mua lặp lại**

Trong bán lẻ, một phần đáng kể lượt mua là mua lại món đã mua. Anderson et al. (2014) cho thấy độ gần đây và tần suất là hai tín hiệu mạnh nhất dự đoán việc tiêu dùng lặp lại. Với hàng công nghệ, nhu cầu mua lại khác nhau rõ theo danh mục (phụ kiện mua lại thường xuyên, điện thoại hiếm khi), nên đề tài cho mỗi danh mục một half-life riêng ở kênh mua lại (§5.3.2).

### **3.3.6. Hybrid có trọng số**

Hybrid có trọng số trộn điểm của nhiều bộ gợi ý theo trọng số (Burke, 2002). Đề tài trộn ba kênh: lọc cộng tác, lọc theo nội dung và mua lại. Trọng số giữa lọc cộng tác và lọc theo nội dung co rút theo lượng dữ liệu của từng khách, α\_u \= n\_u / (n\_u \+ k): khách mua càng nhiều thì càng tin lọc cộng tác; khách mới dựa vào hồ sơ nội dung. Trọng số γ của kênh mua lại điều chỉnh tỉ lệ giữa gợi ý món mới và nhắc lại món cũ (§4.5.2).

### **3.3.7. Mô hình đối chứng**

Để kết luận một mô hình tốt, phải so với đường cơ sở đơn giản và với mô hình mạnh đã công bố; nhiều mô hình phức tạp không vượt được đường cơ sở được tinh chỉnh kỹ (Dacrema et al., 2019). Đề tài dùng ba đối chứng:

* **Most-Popular:** gợi ý món bán chạy nhất, không cá nhân hoá — đường cơ sở tối thiểu (Cremonesi et al., 2010).  
* **EASE^R:** tự mã hoá tuyến tính một lớp, có nghiệm dạng đóng, rất mạnh trên dữ liệu thưa (Steck, 2019).  
* **iALS:** phân rã ma trận cho phản hồi ngầm bằng bình phương tối thiểu luân phiên (Hu et al., 2008).

### **3.3.8. Khởi đầu lạnh, độ thưa và thiên lệch phổ biến**

Khởi đầu lạnh xảy ra với khách chưa có lịch sử hoặc món mới vào danh mục; lọc cộng tác không tính được tương đồng có ý nghĩa khi quá ít tương tác. Đề tài xử lý bằng lọc theo nội dung từ onboarding và danh sách phổ biến làm đường dự phòng cuối. Một rủi ro khác là thiên lệch phổ biến: hệ gợi ý lặp lại một số món bán chạy, khách mua theo gợi ý, dữ liệu mới lại củng cố chính các món đó, làm giảm độ đa dạng (Chaney et al., 2018). Ngoài độ chính xác, cần theo dõi độ phủ danh mục và tỉ lệ món mới trong danh sách gợi ý.

### **3.3.9. Đánh giá offline**

Dữ liệu phải được cắt theo thời gian (huấn luyện trên quá khứ, kiểm tra trên tương lai) thay vì ngẫu nhiên, để không dùng giao dịch tương lai làm dữ liệu huấn luyện (Campos et al., 2014). Gọi T\_u là tập món khách u thực sự mua trong kỳ kiểm tra, P\_u^K là danh sách top-K gợi ý, rel\_r \= 1 nếu món ở vị trí r thuộc T\_u:

Precision@K \= \|P\_u^K ∩ T\_u\| / K,   Recall@K \= \|P\_u^K ∩ T\_u\| / \|T\_u\|

DCG@K \= Σ\_{r=1..K} rel\_r / log₂(r \+ 1),   NDCG@K \= DCG@K / IDCG@K

trong đó IDCG@K là DCG của thứ tự lý tưởng; các chỉ số được lấy trung bình trên các khách có ít nhất một lần mua trong kỳ kiểm tra. NDCG thưởng món đúng ở vị trí đầu nhiều hơn vị trí cuối (Järvelin & Kekäläinen, 2002).

Đề tài đo trên hai bài toán: **tổng thể** — mọi món khách mua trong kỳ kiểm tra; và **khám phá** — chỉ các món khách chưa từng mua. Tách như vậy vì một mô hình có thể đạt điểm tổng thể cao chỉ bằng cách nhắc lại món cũ. Tham số được chọn trên tập validation và chỉ đo một lần trên tập test; khoảng tin cậy 95% tính bằng bootstrap theo khách (Efron & Tibshirani, 1993).

Hai giới hạn cần nêu rõ: đánh giá trên log chỉ thưởng các món có trong log nên thiên về món phổ biến (Marlin & Zemel, 2009); và đánh giá offline đo khả năng dự đoán hành vi đã xảy ra, không đo tác động khi gợi ý thật sự hiển thị cho khách.

## **3.4. Tìm kiếm, hiểu ngôn ngữ tự nhiên và mô hình đa phương thức**

* **Tìm kiếm văn bản:** chỉ mục đảo (inverted index) tra từ → tài liệu thay vì quét bảng; xếp hạng theo độ liên quan bằng BM25 (Robertson & Zaragoza, 2009). PostgreSQL có pg\_trgm (chỉ mục trigram cho tìm chuỗi con và độ giống) và unaccent (bỏ dấu tiếng Việt) (PostgreSQL Global Development Group, n.d.). Đề tài chưa dùng các chỉ mục này; tìm kiếm hiện quét bảng và đây là hạn chế đã đo được (§6.6.4).  
* **Phân loại ý định zero-shot bằng NLI:** coi mỗi nhãn ý định là một giả thuyết và dùng mô hình suy luận ngôn ngữ để chấm mức kéo theo từ câu của khách sang nhãn đó, nhờ đó phân loại được mà không cần dữ liệu huấn luyện riêng (Yin et al., 2019). Đề tài dùng mDeBERTa-v3 (He et al., 2021\) đã tinh chỉnh trên MNLI và XNLI (Conneau et al., 2018; Laurer et al., 2024), hỗ trợ tiếng Việt, kết hợp tầng luật từ khoá ưu tiên (preClassify) với tập 49 mã nhãn ý định (ASK\_PRICE, SEARCH\_PRODUCT, INSTALLMENT\_INFO…) truyền vào pipeline zero-shot-classification ở ngưỡng tự tin 0,35.  
* **Sinh câu trả lời có căn cứ:** truy xuất dữ liệu liên quan rồi đưa vào ngữ cảnh của mô hình sinh, để câu trả lời bám dữ liệu thật thay vì mô hình tự bịa (Lewis et al., 2020). Mô hình sinh của đề tài là Llama-3.1-8B-Instruct (Grattafiori et al., 2024) gọi qua Hugging Face Inference; khi nhà cung cấp này lỗi hoặc hết hạn mức, hệ thống chuyển sang Gemini rồi OpenRouter (§5.4.1).  
* **Mô hình đa phương thức:** nhận ảnh đầu vào, trả mô tả có cấu trúc (Gemini Team, 2023); đề tài dùng để tìm sản phẩm theo ảnh.

## **3.5. Toàn vẹn giao dịch và chịu lỗi**

* **Giữ chỗ nguyên tử:** kiểm tra tồn và giữ chỗ trong **một** câu UPDATE có điều kiện; cơ sở dữ liệu khoá dòng trong lúc cập nhật, nên hai giao dịch đồng thời không thể cùng vượt qua điều kiện (PostgreSQL Global Development Group, n.d.). Ràng buộc CHECK ở bảng là lớp chặn thứ hai.  
* **Idempotency:** xử lý một thông điệp nhiều lần cho cùng kết quả như một lần — điều kiện bắt buộc khi bên gửi có cơ chế gửi lại, như webhook của cổng thanh toán hay Kafka khi phát lại (Kleppmann, 2017).  
* **Xác thực thông điệp:** webhook được ký bằng HMAC với khoá bí mật chung; máy chủ tính lại chữ ký và so sánh trước khi xử lý, nên bên thứ ba không giả được thông báo "đã thanh toán".  
* **Mã QR thanh toán:** VietQR theo chuẩn EMV QR (EMVCo, n.d.), mã hoá ngân hàng nhận, số tài khoản, số tiền và nội dung chuyển khoản; nội dung mang mã đối soát của đơn.  
* **Circuit breaker:** khi một phụ thuộc lỗi liên tục thì tạm ngắt lời gọi, tránh kéo cả hệ thống chờ theo (Nygard, 2018). Máy chủ áp dụng khi đọc ClickHouse: kho lỗi thì dashboard báo lỗi rõ ràng, luồng bán hàng không bị ảnh hưởng.

## **3.6. Định hướng AI mở rộng**

Hai bài toán sau được khảo sát ở mức lý thuyết, chưa hiện thực:

* **Dự báo nhu cầu:** ước lượng lượng bán theo sản phẩm – ngày ở các chân trời 7, 14, 30 ngày. Đường cơ sở là giá trị tuần trước hoặc trung bình trượt; mô hình chuyên biệt có thể dùng Prophet (Taylor & Letham, 2018\) hoặc LightGBM (Ke et al., 2017\) với biến mùa vụ, ngày lễ, giá, khuyến mãi và độ trễ. Đánh giá cần kiểm định trượt theo thời gian (walk-forward).  
* **Tối ưu khuyến mãi:** chênh lệch doanh thu giữa khách nhận và không nhận voucher chưa chứng minh voucher gây ra mức tăng đó, vì khách tự chọn dùng ưu đãi có thể khác khách còn lại. Ước lượng "uplift" từ dữ liệu quan sát phải nêu rõ giả định; suy luận nhân quả đáng tin hơn cần thử nghiệm A/B.

## **3.7. Công nghệ sử dụng**

*Bảng 3.4. Công nghệ và phiên bản theo phân hệ (theo package.json, Dockerfile và docker-compose.yml)*

| Phân hệ | Công nghệ | Vai trò |
| :---- | :---- | :---- |
| Giao diện | React 19, Vite 6, Ant Design 5, ECharts 5, Leaflet 1.9, Three.js \+ React Three Fiber 9 | Ứng dụng trang đơn cho khách và quản trị; biểu đồ; bản đồ cửa hàng; mô hình 3D |
| Máy chủ | Node.js 20, Express 5, Prisma 5 | API REST, nghiệp vụ, truy cập cơ sở dữ liệu có kiểu |
| Cơ sở dữ liệu tác nghiệp | PostgreSQL 16 (wal\_level \= logical) | Nguồn sự thật; nguồn CDC |
| Bộ đệm | Redis 7 | Đệm danh mục, hãng, KPI dashboard |
| Thu nhận | Confluent Platform 7.4.0 (Kafka, ZooKeeper, Kafka Connect), Debezium PostgreSQL 2.5.4, S3 Sink 10.5.13 | CDC từ WAL về hồ dữ liệu |
| Lưu trữ thô | MinIO RELEASE.2025-09-07 (build từ mã nguồn), Parquet | Hồ dữ liệu |
| Kho và biến đổi | ClickHouse 24.8, dbt-core 1.8.9 \+ dbt-clickhouse 1.8.5, ofelia | Kho cột; biến đổi có kiểm thử; lịch chạy 5 phút |
| BI | Metabase | Báo cáo trên tầng serving |
| Gợi ý | Python 3.11, FastAPI, NumPy, pandas, scikit-learn | Dịch vụ AI-Rec |
| Trợ lý, tìm kiếm | Node.js 20; mDeBERTa-v3-base-mnli-xnli, Llama-3.1-8B-Instruct (qua Hugging Face Inference), dự phòng Gemini và OpenRouter; Gemini (thị giác, giọng nói) | Phân loại ý định, sinh câu trả lời, đọc ảnh, chuyển giọng nói thành chữ |
| Thanh toán | SePay (webhook), VietQR | Chuyển khoản tự động đối soát |
| Hạ tầng | Docker Compose | 17 dịch vụ, dựng bằng một lệnh |

# **Chương 4\. Thiết kế hệ thống**

## **4.1. Kiến trúc tổng thể**

### **4.1.1. Kiến trúc khái niệm**

Hệ thống gồm ba phân hệ. **Phân hệ thương mại điện tử** (giao diện React, máy chủ Node.js, PostgreSQL) xử lý giao dịch. **Nền tảng dữ liệu theo hướng Lakehouse** (Debezium, Kafka, MinIO, ClickHouse, dbt) thu nhận, lưu trữ và tinh chế dữ liệu. **Phân hệ AI** gồm dịch vụ gợi ý AI-Rec và dịch vụ trợ lý, tìm kiếm ai-bot. Ứng dụng giữ vai trò kép: vừa là nguồn dữ liệu, vừa là nơi tiêu thụ dữ liệu đã tinh chế.

Sáu luồng chính:

1. Giao dịch của khách được ghi vào PostgreSQL.  
2. Debezium đọc nhật ký WAL và bắt thay đổi.  
3. Kafka làm vùng đệm và nhật ký phát lại được.  
4. S3 Sink ghi sự kiện thành tệp Parquet trên MinIO.  
5. ClickHouse đọc tệp Parquet, dbt dựng kho và tầng phục vụ.  
6. Dashboard, API và các dịch vụ AI đọc kết quả.

*Hình 4.1. Kiến trúc tổng thể ba phân hệ và các đường dữ liệu*

### **4.1.2. Kiến trúc logic theo tầng**

* **Tầng trình bày:** giao diện khách hàng và trang quản trị (React, Vite), trao đổi với máy chủ qua HTTP.  
* **Tầng dịch vụ nghiệp vụ:** Node.js và Express, dùng Prisma để truy vấn và thực hiện transaction trên PostgreSQL.  
* **Tầng nguồn:** các bảng giao dịch của PostgreSQL.  
* **Tầng thu nhận:** Debezium, Kafka, Kafka Connect và S3 Sink.  
* **Tầng Bronze:** bucket data-lake trên MinIO, chứa tệp Parquet bất biến.  
* **Tầng biến đổi:** các mô hình dbt chạy trên ClickHouse.  
* **Tầng phục vụ (Gold):** bảng sự kiện, bảng chiều, bảng tổng hợp và bảng đặc trưng cho AI.  
* **Tầng đối soát:** mô hình audit chạy mỗi lượt dbt.

### **4.1.3. Các đường dữ liệu**

*Bảng 4.1. Các đường dữ liệu giữa ba phân hệ*

| Đường dữ liệu | Cơ chế | Lý do chọn |
| :---- | :---- | :---- |
| Giao dịch → hồ dữ liệu | CDC đọc WAL của Order và OrderItem | Không thêm tải lên OLTP; bắt mọi thay đổi kể cả cập nhật, xoá; phát lại được |
| Dữ liệu chiều → kho | ClickHouse kéo thẳng từ PostgreSQL mỗi lượt dbt | Ít thay đổi; phân tích chỉ cần ảnh chụp mới nhất, không cần lịch sử |
| Hành vi → ClickHouse | Máy chủ ghi theo lô vào analytics.user\_events | Khối lượng lớn, chỉ ghi thêm, không thuộc giao dịch |
| Kho → AI-Rec | AI-Rec đọc qua HTTP của ClickHouse, tài khoản chỉ đọc lược đồ serving | Hợp đồng dữ liệu rõ; dịch vụ AI không chạm dữ liệu cá nhân |
| AI-Rec → giao diện | Máy chủ gọi API gợi ý theo mã khách lấy từ token | Gợi ý tính sẵn, trả từ bộ nhớ đệm |

### **4.1.4. Tách đường ghi và đường đọc**

Đường đặt hàng không chờ Kafka, MinIO, ClickHouse hay dịch vụ gợi ý. Khi khách đặt hàng, máy chủ mở transaction trên PostgreSQL và phản hồi theo kết quả tác nghiệp; CDC chỉ nhận thay đổi sau khi transaction đã cam kết. Báo cáo tổng hợp không quét bảng giao dịch mà đọc dữ liệu đã xử lý ở kho.

Ngoại lệ có chủ đích: luồng gợi ý đọc lại chi tiết sản phẩm từ PostgreSQL để áp trạng thái còn bán, tồn kho và giá hiện tại. Đây là tra cứu tác nghiệp theo danh sách mã, khác truy vấn phân tích, và giúp tránh gợi ý một sản phẩm không còn hợp lệ.

## **4.2. Thiết kế cơ sở dữ liệu tác nghiệp**

Lược đồ PostgreSQL gồm 21 thực thể, chia theo miền nghiệp vụ:

*Bảng 4.2. Các thực thể của cơ sở dữ liệu tác nghiệp*

| Miền | Thực thể |
| :---- | :---- |
| Danh tính | User (quản trị), B2CCustomer, CustomerPreference |
| Danh mục | Category, Brand, Product, Branch |
| Tồn kho | Inventory (on\_hand, reserved theo sản phẩm × biến thể × chi nhánh), StockReservation |
| Đơn hàng – thanh toán | Order, OrderItem, PaymentTransaction |
| Khuyến mãi | Voucher, VoucherTier, VoucherUsage, FlashSale, FlashSaleItem, LoyaltyTransaction |
| Tương tác | Review, Wishlist, ChatLog |

Các quyết định thiết kế chính:

* **OrderItem lưu snapshot** tên, giá, hãng, danh mục tại thời điểm mua. Doanh thu lịch sử vì vậy không đổi theo giá hiện tại của sản phẩm.  
* **Tồn kho tách on\_hand và reserved.** Đơn chuyển khoản giữ chỗ (tăng reserved), thanh toán xong thì trừ thật, huỷ hoặc hết hạn thì nhả. Ràng buộc CHECK ở cơ sở dữ liệu bảo đảm on\_hand và reserved không âm và reserved không vượt on\_hand, làm lớp chặn thứ hai sau câu lệnh giữ chỗ có điều kiện.  
* **Đơn có hai trường trạng thái tách biệt:** status cho vòng đời giao hàng (PENDING\_PAYMENT, CONFIRMED, SHIPPING, DELIVERED, CANCELLED) và payment\_status cho thanh toán (UNPAID, PENDING, PAID, EXPIRED, FAILED, CANCELLED, REFUND\_REQUIRED, REFUNDED), để không đồng nhất "đã trả tiền" với "đã giao hàng".  
* **Tiền lưu bằng số nguyên đồng (VND).** Đồng Việt Nam không có phần lẻ, nên số nguyên biểu diễn chính xác và cộng dồn không sai số; kho dùng Int64 cho các cột tiền.  
* **Chỉ mục trên Product:** category\_id, brand\_id, price, cặp is\_deleted và id. Chưa có chỉ mục phục vụ tìm kiếm văn bản (§6.6.4).

## **4.3. Thiết kế kho dữ liệu**

### **4.3.1. Tổ chức các tầng**

*Bảng 4.3. Tổ chức tầng dữ liệu (đối chiếu Bronze – Silver – Gold)*

| Tầng | Lược đồ / nơi lưu | Thành phần chính | Vật liệu hoá | Vai trò |
| :---- | :---- | :---- | :---- | :---- |
| Bronze | MinIO, Parquet | Tệp CDC của Order và OrderItem | Tệp bất biến | Nguồn sự thật của tầng phân tích; phát lại được |
| Silver | staging | stg\_orders, stg\_order\_items | View đọc thẳng Parquet | Giải envelope Debezium |
| Silver | warehouse | fact\_orders\_detail, user\_events\_stitched | Bảng ReplacingMergeTree; view | Bảng sự kiện một dòng mỗi dòng hàng; ghép phiên hành vi |
| Silver | masterdata | dim\_products, dim\_categories, dim\_brands, dim\_customers, dim\_branches, dim\_vouchers, dim\_customer\_preferences | Bảng | Ảnh chụp dữ liệu chiều |
| Gold | serving | mart\_revenue, cặp khách–món, lịch sử mua, đặc trưng sản phẩm, tín hiệu sở thích, hành vi | Bảng (một view) | Phục vụ dashboard và AI-Rec |
| Kiểm soát | audit | checksum\_orders | Bảng | Đối soát nguồn – hồ – kho |

*Hình 4.2. Luồng từ hồ dữ liệu tập trung xuống kho*

Biến đổi theo hướng ELT: dữ liệu được ghi xuống hồ trước, dbt gửi SQL tới ClickHouse để đọc và biến đổi. Nhờ vậy thời điểm nhận dữ liệu tách khỏi thời điểm đổi quy tắc nghiệp vụ: sửa một mô hình thì dựng lại từ hồ, không cần nguồn gửi lại dữ liệu.

### **4.3.2. Hợp đồng sự kiện CDC**

Mỗi sự kiện Debezium có dạng logic như sau (mẫu minh hoạ):

{ "before": { "id": 1001, "payment\_status": "PENDING" },

  "after":  { "id": 1001, "payment\_status": "PAID" },

  "op": "u", "ts\_ms": 1790000000000 }

Các bất biến của hợp đồng: khoá định danh không rỗng; loại thao tác thuộc {c, u, d, r}; thời điểm thống nhất múi giờ; thông điệp xoá phải được giữ tới bước chọn phiên bản cuối, nếu loại sớm thì bản ghi cũ có thể "sống lại"; thứ tự các phiên bản của cùng một thực thể phải xác định được. Với mỗi topic một partition, các thay đổi của cùng một khoá giữ đúng thứ tự cam kết.

### **4.3.3. Bảng sự kiện và bảng chiều**

* **Hạt:** một dòng của fact\_orders\_detail là một dòng hàng (OrderItem), ghép thông tin đơn tương ứng — không phải mỗi đơn một dòng.  
* **Khoá và phiên bản:** ORDER BY item\_id, ổn định suốt vòng đời dòng hàng; phiên bản \_event\_ts là thời điểm muộn hơn giữa bản ghi đơn và bản ghi dòng hàng, để đơn đổi trạng thái cũng kéo dòng hàng cập nhật theo; cờ \_is\_deleted cho bản ghi xoá.  
* **Phân vùng:** theo tháng của ngày đặt, cố định với mỗi dòng hàng nên các phiên bản của cùng một khoá nằm cùng phân vùng.  
* **Thước đo:** số lượng, đơn giá, giảm giá, thành tiền lấy từ snapshot trên dòng hàng; doanh thu tách doanh thu tổng và doanh thu đã thanh toán.  
* **Bảng chiều:** sản phẩm, danh mục, hãng, khách, chi nhánh, voucher và sở thích được dựng lại mỗi lượt dbt từ PostgreSQL.

### **4.3.4. Hợp đồng dữ liệu giữa kho và AI-Rec**

*Bảng 4.4. Các bảng phục vụ AI-Rec*

| Bảng (lược đồ serving) | Hạt | Dùng cho |
| :---- | :---- | :---- |
| processed\_data\_for\_AI\_rec | (khách, sản phẩm) | Ma trận khách × món của lọc cộng tác; độ phổ biến |
| purchase\_events\_for\_AI\_rec | (khách, sản phẩm, đơn) | Kênh mua lại theo tần suất đơn |
| product\_features | sản phẩm (đại diện mỗi ô \+ mọi món đã bán) | Ứng viên và hồ sơ lọc theo nội dung |
| catalog\_features | sản phẩm (toàn catalog) | Danh mục gốc của sản phẩm cho kênh mua lại |
| customer\_preference\_signals | (khách, chiều, giá trị) | Hồ sơ onboarding; lọc cứng "không quan tâm" |
| customer\_product\_events | (khách, sản phẩm) | Tín hiệu hành vi phụ (đang tắt) |

Định nghĩa "một lần mua" thống nhất cho mọi bảng: bản ghi không bị xoá, đơn không huỷ, đơn đã thanh toán, sản phẩm còn bán. Lệch định nghĩa giữa các bảng thì hai kênh của cùng một mô hình học trên hai tập đơn khác nhau.

## **4.4. Thiết kế đối soát và giám sát**

### **4.4.1. Phép đối soát hợp lệ**

Hồ dữ liệu chứa sự kiện thay đổi, còn nguồn và kho chứa trạng thái. Một đơn đổi bốn lần sinh nhiều sự kiện nhưng chỉ là một thực thể, nên không được so số sự kiện thô ở hồ với số đơn ở nguồn. Phép đối soát đúng phải đưa sự kiện ở hồ về trạng thái mới nhất theo từng khoá trước, rồi mới so số thực thể logic và tổng tiền hợp lệ giữa ba điểm. Ngoài ra, một thời điểm đo không có nghĩa mọi tầng đã nhận đủ sự kiện phát sinh trước đó; lệch trong thời gian dữ liệu còn đang vận chuyển là độ trễ bình thường, không phải mất dữ liệu.

### **4.4.2. Đối soát ba tầng**

Mô hình audit.checksum\_orders tính số dòng và tổng net\_amount ở ba điểm: PostgreSQL (đọc qua hàm postgresql()), hồ dữ liệu (đọc qua s3() và khử trùng phiên bản) và bảng sự kiện (đọc kèm FINAL). Lệch nghĩa là mất hoặc thừa bản ghi ở đâu đó trên đường đi — loại lỗi không tự báo, vì pipeline vẫn "chạy". Khi số dòng khớp mà tổng tiền lệch, nơi cần kiểm là phép lọc trạng thái, giảm giá và snapshot giá.

### **4.4.3. Mở rộng: các cấp kiểm tra và trạng thái đối soát**

Bản thiết kế đề xuất bốn cấp kiểm tra (kiểm tra trước biến đổi, đối chiếu theo cửa sổ ngắn, quét toàn lịch sử định kỳ, nâng mức cảnh báo khi lệch kéo dài qua thời gian chờ) và các trạng thái đối soát sau:

*Bảng 4.5. Trạng thái đối soát đề xuất*

| Trạng thái | Điều kiện | Hành động |
| :---- | :---- | :---- |
| OK | Các điểm đo cùng mốc và mọi bất biến đạt | Công bố mốc đã đối soát |
| PENDING\_SETTLE | Nguồn đi trước hồ hoặc kho nhưng chưa quá hạn | Chờ chu kỳ sau |
| SOURCE\_READ\_ERROR | Không đọc được nguồn | Kiểm tra quyền, mạng, kết nối |
| STORAGE\_MISMATCH | Trạng thái suy ra từ hồ khác nguồn | Kiểm tra connector, offset, tệp, lược đồ |
| WAREHOUSE\_MISMATCH | Kho khác nguồn hoặc hồ | Kiểm tra dbt, mốc nạp, phiên bản, bản ghi xoá |
| SUM\_MISMATCH | Số thực thể khớp nhưng tổng tiền lệch | Kiểm tra lọc trạng thái, giảm giá |
| STALE | Không có dữ liệu mới quá ngưỡng | Kiểm tra lịch sink và dbt |

### **4.4.4. Chỉ số giám sát**

L(e) \= t\_visible(e) − t\_committed(e)

F(t) \= t − max(t\_event của phiên bản đã xuất hiện ở tầng phục vụ)

Độ trễ đầu-cuối L của một sự kiện là khoảng từ lúc giao dịch cam kết tới lúc phiên bản tương ứng xuất hiện ở tầng phục vụ; độ tươi F đo dữ liệu mới nhất ở tầng phục vụ cũ bao nhiêu. Độ trễ phải báo theo phân vị p50, p95, p99 trên nhiều sự kiện, không dựa vào một lần đặt đơn. Lịch dbt năm phút làm phân phối độ trễ có dạng bậc thang. Histogram của Prometheus (Prometheus, n.d.) là cách phù hợp để thu các phân vị này khi triển khai giám sát.

## **4.5. Thiết kế dịch vụ gợi ý**

### **4.5.1. Lựa chọn mô hình**

* **Lọc cộng tác theo sản phẩm** làm kênh khám phá: giải thích được ("vì bạn đã mua…"), không cần huấn luyện lặp nên chạy lại mỗi 5 phút được, và trên dữ liệu hiện có không thua hai mô hình đối chứng mạnh là EASE^R và iALS (§6.6.3).  
* **Lọc theo nội dung** cho khách mới: hồ sơ dựng từ danh mục, hãng, tầm giá đã mua và câu trả lời onboarding, nên phục vụ được ngay khi khách chưa có lịch sử.  
* **Kênh mua lại** cho món khách hay mua lặp, đặc biệt là phụ kiện.  
* **Trộn có trọng số** cho phép mỗi kênh lo một nhu cầu và điều chỉnh tỉ lệ giữa gợi ý món mới với nhắc món cũ bằng một tham số.

### **4.5.2. Mô hình lai và tham số**

final(u, i) \= α\_u · cf(u, i) \+ (1 − α\_u) · cb(u, i) \+ γ · rep(u, i),   α\_u \= n\_u / (n\_u \+ k)

Mỗi kênh được chuẩn hoá về \[0, 1\] theo giá trị lớn nhất của chính khách; danh mục và hãng "không quan tâm" bị lọc cứng khỏi mọi kênh; mỗi gợi ý kèm lý do.

*Bảng 4.6. Tham số của mô hình gợi ý*

| Tham số | Ý nghĩa | Cách chọn |
| :---- | :---- | :---- |
| h | Half-life giảm trọng số theo thời gian | Chọn trên tập validation |
| Thang ma trận | Tuyến tính hoặc log | Chọn trên tập validation |
| Kênh mua lại | Trọng số ma trận hoặc tần suất đơn | Chọn trên tập validation |
| k | Hằng số co rút giữa lọc cộng tác và lọc theo nội dung | Chọn trên tập validation |
| γ | Trọng số kênh mua lại | Chọn trên validation theo ràng buộc 2–3 món đã mua trong 10 ô |
| c | Trọng lượng một lựa chọn onboarding so với một lần mua | Mặc định 1, chưa tinh chỉnh |
| Ngưỡng người mua | Số người mua tối thiểu để món vào lọc cộng tác | 3 (dbt) |
| Đại diện mỗi ô | Số ứng viên lọc theo nội dung mỗi ô danh mục × hãng × tầm giá | 20 (dbt) |

Ràng buộc 2–3 món đã mua trong 10 ô là quyết định sản phẩm, không phải kết quả tối ưu: nếu chỉ tối đa chỉ số tổng thể, mô hình sẽ lấp gần hết ô gợi ý bằng món cũ (§6.6.3).

### **4.5.3. Vòng đời huấn luyện và phục vụ**

*Hình 4.3. Vòng đời một bản huấn luyện của AI-Rec*

* Vòng huấn luyện chạy nền theo chu kỳ, đọc lại toàn bộ tập đặc trưng từ tầng phục vụ.  
* Mô hình và bộ nhớ đệm(cache in-memory trong server/container) gợi ý được đóng chung một đối tượng, thay bằng một phép gán: không bao giờ có lúc mô hình là bản mới mà bộ đệm còn của bản cũ.  
* Trong lúc huấn luyện bản mới, bản cũ vẫn phục vụ; huấn luyện lỗi thì giữ bản cũ.  
* Khách có tín hiệu riêng nhận gợi ý tính sẵn; khách khác được tính tại chỗ; khách không có tín hiệu nào nhận danh sách phổ biến.

## **4.6. Thiết kế phân hệ trợ lý và tìm kiếm**

*Hình 4.4. Luồng xử lý của trợ lý hội thoại*

Luồng xử lý một câu hỏi: phân loại ý định (luật từ khoá trước, phân loại zero-shot bằng NLI sau) → trích thực thể (giá bằng biểu thức chính quy, hãng, danh mục) → truy vấn cơ sở dữ liệu với ngân sách là ràng buộc cứng (nếu rỗng thì chuyển sang nhánh dự phòng theo ngân sách: gợi ý sản phẩm hãng khác trong cùng tầm giá hoặc sản phẩm gần ngưỡng ngân sách nhất kèm câu trả lời dựng sẵn) → mô hình ngôn ngữ sinh câu trả lời trên ngữ cảnh đã truy xuất → trả câu trả lời kèm danh sách sản phẩm. Ba nguyên tắc thiết kế:

* Phần chắc chắn làm bằng luật (ý định rõ ràng, khoảng giá), phần mơ hồ mới dùng mô hình, để kết quả ổn định và rẻ.  
* Câu trả lời bám dữ liệu thật trong cơ sở dữ liệu thay vì để mô hình tự sinh thông tin sản phẩm.  
* Mô hình ngoài lỗi thì có câu trả lời mẫu, không làm hỏng trải nghiệm mua hàng.

## **4.7. Thiết kế luồng thanh toán chuyển khoản**

*Hình 4.5. Vòng đời đơn chuyển khoản (rút gọn)*

* Đặt đơn: giữ chỗ tồn kho, sinh mã đối soát dạng GS…, đơn ở trạng thái chờ thanh toán.  
* Webhook khớp mã và đúng số tiền: đơn chuyển sang đã thanh toán và được xác nhận; tồn kho, voucher, điểm thưởng được chốt.  
* Khách huỷ hoặc quá hạn giữ chỗ: đơn bị huỷ, mọi thứ đang giữ được nhả.  
* Tiền về sau khi đơn hết hạn được xử lý riêng ở bước đối soát.

Thiết kế dựa trên ba nguyên tắc: máy chủ tự tính lại tổng tiền và không tin giá client gửi lên; xử lý webhook idempotent vì cổng thanh toán có cơ chế gửi lại (Kleppmann, 2017); không bao giờ im lặng bỏ qua tiền — mỗi giao dịch đều được gán một trạng thái đối soát (§5.1.5).

## **4.8. Thiết kế bảo mật và vận hành**

### **4.8.1. Phân quyền tối thiểu**

* Máy chủ API có quyền trên lược đồ tác nghiệp theo nghiệp vụ.  
* Debezium đọc WAL qua slot getshopy\_cdc\_slot (plugin pgoutput), chỉ theo dõi hai bảng Order và OrderItem.  
* Tài khoản ClickHouse của AI-Rec chỉ có quyền đọc lược đồ serving; tầng này chỉ mang mã khách, không mang dữ liệu cá nhân.  
* Công cụ BI chỉ đọc các lược đồ được cấp, không sửa được dữ liệu giao dịch.  
* Webhook thanh toán được xác thực chữ ký HMAC và xử lý idempotent.  
* Danh tính khách lấy từ token đã xác thực, không lấy từ tham số do client gửi.  
* Phạm vi bảo vệ hiện tại chưa phủ toàn bộ API: nhóm API khách hàng ở các luồng đặt hàng, thanh toán, đơn hàng, sở thích và danh sách yêu thích đều dựa trên token, trong khi nhóm /api/b2b và một số tuyến phụ trợ chưa có xác thực hoặc chỉ kiểm chữ ký JWT (§5.1.2, §6.6.7, §7.4 và Phụ lục A.13).

### **4.8.2. Quản lý bí mật**

Các khoá API dịch vụ ngoài, chữ ký webhook và khoá ký JWT nằm trong tệp .env không đưa lên kho mã; .env.example chỉ chứa tên biến và giá trị giả. Riêng mật khẩu cơ sở dữ liệu phát triển cục bộ trong docker-compose.yml đang dùng giá trị mặc định của môi trường thử nghiệm và được ghi nhận ở §7.5 để chuyển hoàn toàn sang biến môi trường khi triển khai. Không đưa thông tin xác thực, mã QR thanh toán thật, số tài khoản hay dữ liệu khách hàng vào báo cáo.

### **4.8.3. Sao lưu, phát lại và khôi phục**

Kế hoạch khôi phục tách ba tầng:

* **Nguồn:** PostgreSQL được sao lưu định kỳ và là nguồn sự thật cuối cùng.  
* **Kafka:** giữ sự kiện trong thời hạn lưu; lỗi ở MinIO hoặc S3 Sink được phục hồi bằng phát lại từ offset khi sự kiện còn trong thời hạn.  
* **Hồ và kho:** là dữ liệu dẫn xuất. Lỗi biến đổi được sửa bằng dựng lại từ Parquet; mất cả Kafka lẫn tệp Parquet thì phải chụp lại nguồn.

### **4.8.4. Ước tính dung lượng**

V\_raw \= N\_events × B\_avg

V\_kafka ≈ V\_raw × D\_retention × R

Ở đây N\_events gồm cả sự kiện tạo lẫn cập nhật (không chỉ số đơn mới), B\_avg là kích thước trung bình một sự kiện, D\_retention là số ngày Kafka giữ dữ liệu và R là hệ số nhân bản. Ví dụ minh hoạ thuần tính toán, không phải số liệu dự án: 10 triệu sự kiện mỗi ngày, mỗi sự kiện 1 KiB, tạo khoảng 9,54 GiB dữ liệu thô mỗi ngày; Kafka giữ 7 ngày với 3 bản sao thì riêng dữ liệu đã chiếm khoảng 200 GiB.

# **Chương 5\. Cài đặt hệ thống**

## **5.1. Phân hệ thương mại điện tử**

### **5.1.1. Giao diện người dùng**

Giao diện là ứng dụng trang đơn viết bằng React 19.2, Vite 6.3 và Ant Design 5.22, cùng ECharts cho biểu đồ, Leaflet cho bản đồ cửa hàng và Three.js với React Three Fiber cho mô hình 3D sản phẩm. Một bản build phục vụ cả khách hàng lẫn quản trị.

*Bảng 5.1. Các trang giao diện*

| Phân hệ | Trang |
| :---- | :---- |
| Khách hàng | Trang chủ, Danh sách sản phẩm, Chi tiết sản phẩm (mô hình 3D), So sánh, Thanh toán, Tài khoản, Giới thiệu; giỏ hàng dạng ngăn kéo; cửa sổ trợ lý (có nhập bằng giọng nói); cửa sổ onboarding (OnboardingModal) |
| Quản trị | Dashboard, Quản lý chung (sản phẩm, khách hàng, flash sale…), Tài chính, Đối soát thanh toán, Cảnh báo, Fulfillment, Đánh giá, Phân tích hành vi, Quản lý chatbot |
| Minh hoạ nền tảng | Trang Data Lake demo |

Các thành phần liên quan trực tiếp tới kịch bản đầu-cuối gồm Checkout.jsx, PaymentQRModal.jsx và Home.jsx. Checkout.jsx gửi giỏ hàng lên API; giá trong giỏ không được coi là giá thanh toán vì dữ liệu ở trình duyệt có thể bị sửa. PaymentQRModal.jsx hiển thị mã QR trong 300 giây và hỏi trạng thái đơn mỗi 3 giây; mốc hết hạn lấy từ máy chủ chứ không tự đếm ở trình duyệt. Home.jsx hiển thị tối đa 8 sản phẩm ở ô "Dành riêng cho bạn".

### **5.1.2. Máy chủ API, xác thực và phân quyền**

Máy chủ dùng Node.js 20, Express 5.2, Prisma 5.10 và jsonwebtoken. API chia theo nhóm tuyến: khách hàng (/api/b2c), quản trị (/api/b2b), thanh toán, gợi ý, onboarding, theo dõi hành vi, tìm kiếm và trợ lý; danh sách đầy đủ ở Phụ lục A. Mã nguồn tổ chức theo lớp route → service → Prisma; logic nghiệp vụ phức tạp nhất (thanh toán, tồn kho, voucher, điểm thưởng) được gom vào các service riêng trong services/payment.

* Khách đăng nhập bằng email và mật khẩu hoặc tài khoản Google. Với Google, máy chủ tự xác thực ID token chứ không tin email do client gửi lên — điểm này được sửa sau khi phát hiện lỗ hổng chiếm tài khoản ở bản đầu.  
* Phiên làm việc dùng JWT có thời hạn, không dùng refresh token.  
* Danh tính khách ở mọi API nhạy cảm (đơn hàng, yêu thích, sở thích, theo dõi hành vi) lấy từ token, không lấy từ tham số. Bản đầu có API nhận customer\_id từ client nên ai cũng đọc hoặc sửa được dữ liệu người khác; lỗi này đã được sửa.  
* API trạng thái đơn trả 404 thay vì 403 khi đơn không thuộc người hỏi, để không xác nhận sự tồn tại của mã đơn người khác.  
* Mọi tuyến /api có giới hạn tần suất, trừ tuyến webhook thanh toán; tuyến này được bảo vệ bằng chữ ký HMAC.

Về phía khách, các tuyến được phân làm ba loại: (1) yêu cầu token (authB2C, kiểm tra chữ ký JWT, yêu cầu role = customer, hạn 7 ngày): đặt hàng, đơn của tôi, trạng thái thanh toán, huỷ đơn, sở thích, bỏ qua onboarding, danh sách yêu thích và đặt mật khẩu; (2) nhận token tuỳ chọn (optionalAuthB2C): ghi sự kiện hành vi, sản phẩm xem gần đây và gợi ý "Dành riêng cho bạn"; (3) công khai hoàn toàn: danh mục, hãng, sản phẩm, flash sale, sản phẩm tương tự, xu hướng, lựa chọn onboarding, kiểm tra voucher, đăng ký, đăng nhập, gửi đánh giá và các tuyến trợ lý, tìm kiếm.

Về phía quản trị, các tuyến báo cáo dùng authMiddleware trong index.js: middleware này dùng chung khoá ký JWT\_SECRET nhưng chỉ kiểm tra chữ ký JWT mà chưa kiểm tra vai trò, nên token của khách cũng vượt qua được. Riêng ba tuyến thanh toán và giao nhận dành cho quản trị (/api/b2b/payments/\* và /api/b2b/orders/:id/delivered) dùng hàm requireAdmin trong routes/payment.js nên từ chối token có vai trò customer; các tuyến còn lại của /api/b2b chưa gắn middleware này (§6.6.7, §7.4).

### **5.1.3. Danh mục, lọc và phân trang**

* Catalog 600.000 sản phẩm được sinh lại cân bằng: thiết bị (điện thoại, laptop, máy tính bảng, đồng hồ) chiếm 40%, phụ kiện – nghe nhìn – máy ảnh chiếm 60%; không hãng nào vượt 10% catalog; giá nằm trong khoảng riêng của từng danh mục.  
* Lọc theo danh mục (mở rộng cả danh mục con), một hoặc nhiều hãng và khoảng giá; các cột lọc đều có chỉ mục (category\_id, brand\_id, price, cặp is\_deleted và id).  
* Phân trang theo offset. API danh sách sản phẩm phía khách chưa đặt trần cho tham số limit.  
* Redis đệm cây danh mục và danh sách hãng (300 giây), lựa chọn onboarding (86.400 giây, tức 24 giờ). Cache chỉ để tăng tốc đọc, không phải nguồn sự thật: giá và tồn kho luôn được kiểm lại khi đặt hàng.

### **5.1.4. Đặt hàng và giữ chỗ tồn kho**

Khi nhận yêu cầu đặt hàng, dịch vụ checkout tính lại đơn giá, mức giảm và tổng tiền từ cơ sở dữ liệu, kiểm tra và giữ chỗ tồn kho, sinh mã đối soát, rồi ghi Order và OrderItem trong cùng một transaction. Một bước thất bại thì toàn bộ transaction rollback, nên không có đơn được tạo mà tồn kho không được giữ hoặc ngược lại.

Giữ chỗ tồn kho dùng đúng một câu lệnh:

UPDATE "Inventory"

SET    reserved \= reserved \+ :qty

WHERE  product\_id \= :pid AND variant\_id \= :vid AND branch\_id \= :bid

  AND  on\_hand \- reserved \>= :qty;

Số dòng bị ảnh hưởng bằng 0 nghĩa là hết hàng. Kiểm tra và giữ chỗ nằm trong một thao tác nguyên tử ở cơ sở dữ liệu, nên không cần khoá ở tầng ứng dụng và hai khách đặt đồng thời không thể cùng vượt qua điều kiện. Đơn chuyển khoản giữ chỗ có thời hạn; đơn COD trừ kho ngay vì không chờ thanh toán. Mỗi khách giữ tối đa 3 đơn chờ thanh toán cùng lúc, để chặn việc giữ kho hàng loạt.

### **5.1.5. Thanh toán chuyển khoản và đối soát**

* Mỗi đơn có mã đối soát dạng GS…, nhúng vào nội dung chuyển khoản của mã VietQR động (EMVCo, n.d.). Với VietinBank, cổng SePay yêu cầu nội dung bắt đầu bằng tiền tố SEVQR; máy chủ kiểm tra cấu hình này khi khởi động.  
* Mã QR hiển thị 300 giây, tồn kho được giữ 480 giây. Khoảng giữ chỗ dài hơn khoảng hiển thị để giao dịch bắt đầu gần cuối thời gian hiển thị vẫn kịp được ghi nhận. Job quét hết hạn chạy mỗi 60 giây, huỷ đơn quá hạn và nhả giữ chỗ.  
* Webhook SePay được xác thực chữ ký HMAC; payload gốc được lưu lại để điều tra.  
* Lớp idempotency thứ nhất: khoá duy nhất provider\_txn\_id, nên webhook gửi lại trả về kết quả cũ thay vì xử lý lần hai.  
* Lớp idempotency thứ hai: đơn chuyển sang đã thanh toán bằng một câu UPDATE … WHERE payment\_status \= 'PENDING', nên hai giao dịch đồng thời không thể cùng xác nhận một đơn.  
* Khi đơn được xác nhận, hàm commitOrder chốt đồng thời ba thứ đang được giữ: tồn kho, lượt dùng voucher và điểm thưởng. Ba thứ này cùng chuyển từ trạng thái giữ sang chốt khi thanh toán, hoặc cùng được nhả khi hết hạn; chốt tồn kho mà quên trả voucher thì mã giảm giá của khách mất vĩnh viễn.

Nguyên tắc đối soát là không bao giờ im lặng bỏ qua tiền. Mỗi giao dịch được gán một trạng thái:

*Bảng 5.2. Trạng thái đối soát giao dịch*

| Trạng thái | Ý nghĩa |
| :---- | :---- |
| MATCHED | Khớp một đơn còn hiệu lực, đúng số tiền |
| LATE\_MATCHED | Đơn đã hết hạn nhưng giữ chỗ lại được, nên vẫn ghi nhận đã thanh toán |
| UNMATCHED | Chưa tìm ra đơn; chưa phải trạng thái cuối — job đối khớp lại sẽ quét sau (ví dụ webhook đến trước khi đơn kịp tạo) |
| REFUND\_REQUIRED | Tiền đã vào nhưng không gán được vào đơn còn hiệu lực (sai số tiền, hết hạn mà hết hàng); đưa vào hàng đợi hoàn tiền |
| DUPLICATE | Đơn đã thanh toán rồi; đây là tiền thừa |

Khi không có giao dịch ngân hàng thật, nhóm dùng bộ giả lập webhook (simulate-payment.sh) để kiểm thử.

### **5.1.6. Onboarding và thu thập hành vi**

* Onboarding là một cửa sổ (modal) hiện ở lần đăng nhập đầu và cho phép bỏ qua; khách có thể mở lại ở chế độ chỉnh sửa từ tab Sở thích cá nhân của trang Tài khoản. Khách chọn danh mục, hãng, tầm giá quan tâm, cùng các danh mục và hãng không quan tâm. Máy chủ kiểm tra hợp lệ: mã phải tồn tại, một giá trị không được vừa thích vừa không quan tâm.  
* Theo dõi hành vi: xem sản phẩm (kèm thời gian xem khi tab đang hiển thị), thêm và bỏ giỏ, yêu thích, bỏ dở thanh toán, món gợi ý được hiển thị và được nhấp.  
* Sự kiện gửi kèm token; thời điểm sự kiện do máy chủ gán. Máy chủ ghi vào ClickHouse theo lô (50 sự kiện hoặc mỗi 5 giây). Phiên duyệt ẩn danh được ghép với khách sau khi đăng nhập.

### **5.1.7. Dashboard quản trị**

Dashboard quản trị chạy 16 truy vấn trên view tương thích analytics.sale\_orders. View này ánh xạ từ bảng sự kiện warehouse.fact\_orders\_detail (đọc kèm FINAL), nên số liệu dashboard đến từ kho đã đối soát chứ không từ cơ sở dữ liệu tác nghiệp. Cột trạng thái của view lấy từ trạng thái thanh toán: chỉ đơn đã thu được tiền mới tính vào doanh thu, kể cả đơn COD sau khi quản trị xác nhận đã giao. Bảng serving.mart\_revenue tách doanh thu tổng (mọi đơn) và doanh thu đã thanh toán, phục vụ Metabase.

Các truy vấn dashboard đi qua cơ chế ngắt mạch (thư viện opossum): thời gian chờ 5 giây, ngắt khi trên 50% lời gọi lỗi, thử lại sau 10 giây (Nygard, 2018); kết quả được đệm trong Redis. Nhờ vậy kho quá tải hay gián đoạn không kéo sập trang quản trị.

## **5.2. Nền tảng Lakehouse**

### **5.2.1. Thu nhận thay đổi**

* PostgreSQL 16 chạy với wal\_level \= logical. Debezium 2.5.4 chạy trên Kafka Connect (nền Confluent 7.4.0) đọc WAL của hai bảng Order và OrderItem và ghi vào hai topic cdc\_prod.public.Order và cdc\_prod.public.OrderItem, mỗi topic một partition.  
* Confluent S3 Sink 10.5.13 gom sự kiện thành tệp Parquet trên bucket data-lake của MinIO, xả khi đủ 1.000 bản ghi hoặc sau mỗi 15 giây, theo đường dẫn topics/\<topic\>/year=…/month=…/day=…. Mốc thư mục lấy theo timestamp của bản ghi Kafka (lúc sự kiện được ghi vào Kafka, theo UTC), không phải ngày giao dịch, nên mọi xử lý thời gian dùng mốc trong bản ghi.  
* Dữ liệu chiều (sản phẩm, danh mục, hãng, khách, chi nhánh, voucher, sở thích) không đi qua CDC: ClickHouse kéo thẳng từ PostgreSQL bằng hàm postgresql() mỗi lượt dbt.  
* Sự kiện hành vi do máy chủ ghi thẳng vào ClickHouse (analytics.user\_events), vì đây là dữ liệu chỉ ghi thêm, không có cập nhật.

### **5.2.2. Tầng staging**

Hai view staging.stg\_orders và staging.stg\_order\_items đọc thẳng Parquet qua hàm s3() và giải envelope Debezium:

* Bản ghi xoá chỉ có trường before, nên mọi cột lấy bằng ifNull(after.x, before.x).  
* Cờ xoá is\_deleted bằng 1 khi op \= 'd'; thời điểm phiên bản event\_ts lấy từ ts\_ms.  
* Bản ghi không có khoá chính bị loại.  
* Tiến hoá lược đồ: Parquet sinh trước khi thêm cột province không có trường này. tupleElement(after, 'province', '') trả giá trị mặc định khi thiếu trường, nên một view đọc được cả hai thế hệ tệp.

### **5.2.3. Bảng sự kiện và nạp tăng dần**

Bảng warehouse.fact\_orders\_detail có hạt một dòng hàng, dùng ReplacingMergeTree(\_event\_ts, \_is\_deleted), ORDER BY item\_id và phân vùng theo tháng của ngày đặt. Bảng mang giá snapshot lúc mua; không join giá hiện tại của sản phẩm để tránh doanh thu lịch sử đổi theo giá hôm nay. Mọi truy vấn đọc bảng kèm FINAL và lọc \_is\_deleted \= 0\.

Nạp tăng dần một bảng ghép hai nguồn CDC gặp hai lỗi kinh điển, cả hai đều làm mất dữ liệu mà không báo lỗi và cả hai đã xảy ra thật trong đề tài:

1. **Thay đổi một phía.** Giữa hai lần chạy thường chỉ một phía đổi (đơn chuyển PAID mà dòng hàng giữ nguyên, hoặc ngược lại). Lọc từng nguồn theo mốc rồi JOIN thì phía không đổi rơi khỏi cửa sổ và thay đổi bị bỏ. Cách sửa: gom tập đơn có biến động ở bất kỳ nguồn nào, rồi lấy phiên bản mới nhất của đơn và của mọi dòng hàng thuộc đơn đó trên toàn bộ lịch sử.  
2. **Hai nguồn xả lệch thời điểm.** Parquet của hai topic được xả ở hai thời điểm khác nhau (đo được lệch tới 8 giờ). Một mốc chung có thể bị nguồn đi trước kéo vượt qua bản ghi chưa xuống hồ của nguồn đi sau, và bản ghi đó bị bỏ mãi mãi. Cách sửa: lưu mốc riêng cho từng nguồn (\_order\_event\_ts, \_item\_event\_ts). Mỗi topic có một partition và một task ghi theo thứ tự offset, nên bản ghi chưa xuống hồ luôn có thời điểm không nhỏ hơn mốc của chính nguồn đó.

*Hình 5.1. Nạp tăng dần theo tập đơn có biến động*

Phiên bản mới nhất được chọn bằng GROUP BY kết hợp argMax(tuple(...), event\_ts) thay cho hàm cửa sổ row\_number(): tuple bảo đảm mọi cột lấy từ cùng một bản ghi, và phép gom nhóm tràn đĩa được ở quy mô hàng triệu đơn (§6.4).

**Giới hạn còn lại.** Bảng nguồn dùng REPLICA IDENTITY DEFAULT nên bản ghi xoá chỉ mang khoá chính: xoá lẻ một dòng hàng không lần về được đơn và không lan tới bảng sự kiện; xoá cả đơn thì FINAL vẫn ẩn được đơn nhưng merge nền không dọn bản ghi.

### **5.2.4. Tầng phục vụ**

* **mart\_revenue:** doanh thu theo ngày × danh mục × hãng × phương thức thanh toán, tách doanh thu tổng và doanh thu đã thanh toán; gộp đơn chờ thanh toán và đơn huỷ vào doanh thu là báo cáo thổi phồng.  
* **pairs\_customer\_product và processed\_data\_for\_AI\_rec:** bảng cơ sở giữ mọi cặp khách–món (nạp tăng dần, tính lại trên toàn lịch sử của cặp bị đụng tới); view phía trên chỉ giữ sản phẩm có từ 3 người mua khác nhau. Ngưỡng đặt ở view vì không đặt được trong bảng nạp tăng dần: khi người thứ ba mua, chỉ cặp của người đó được ghi, hai cặp cũ thiếu vĩnh viễn.  
* **purchase\_events\_for\_AI\_rec:** lịch sử mua theo từng đơn cho kênh mua lại, cùng định nghĩa "một lần mua" với bảng cặp (đơn đã thanh toán, không huỷ, sản phẩm còn bán).  
* **catalog\_features và product\_features:** danh mục gốc, hãng, tầm giá (bốn khoảng: dưới 5 triệu, 5–15, 15–30, từ 30 triệu). Mọi món cùng ô danh mục × hãng × tầm giá có cùng điểm nội dung, nên mỗi ô chỉ giữ tối đa 20 đại diện, cộng mọi món đã có người mua — 6.152 ứng viên thay vì 600.000 món.  
* **customer\_preference\_signals:** sở thích onboarding ở dạng dài, qua bốn luật làm sạch: bỏ khách bỏ qua onboarding; bỏ trùng; giá trị vừa thích vừa không quan tâm thì giữ ở không quan tâm; bỏ mã mồ côi.  
* **customer\_product\_events:** tổng hợp hành vi theo cặp khách–món, chặn thời gian mỗi lượt xem ở 10 phút; lượt xem do chính ô gợi ý dẫn tới được tách riêng và không dùng để huấn luyện, tránh vòng tự củng cố (Chaney et al., 2018).

Các bảng phục vụ AI-Rec được vật liệu hoá thành bảng chứ không phải view. View thường của ClickHouse kiểm quyền trên bảng gốc theo người gọi, nên tài khoản ai\_rec (chỉ có quyền đọc serving) đọc view trỏ vào warehouse sẽ bị từ chối; cấp thêm quyền thì lại mở cả dữ liệu cá nhân của khách.

### **5.2.5. Đối soát, kiểm thử và lịch chạy**

* **Đối soát ba tầng (audit.checksum\_orders):** so số dòng và tổng net\_amount ở PostgreSQL, ở hồ dữ liệu (sau khử trùng phiên bản) và ở bảng sự kiện (sau FINAL) mỗi lượt dbt build.  
* **Kiểm thử dbt:** khoá duy nhất, không rỗng, giá trị hợp lệ, quan hệ khoá ngoại, không mâu thuẫn sở thích, duy nhất sau FINAL. Lần đo 04/10/2026: 68/68 PASS; lần chạy ngày 24/10/2026, khi kho chứa bộ demo 3 triệu đơn, vẫn đạt 68/68 PASS trong 136 giây.  
* **Lịch chạy:** ofelia gọi dbt build mỗi 5 phút; OPTIMIZE định kỳ cho các bảng nhiều phần dữ liệu.

## **5.3. Dịch vụ gợi ý AI-Rec**

### **5.3.1. Nguồn dữ liệu**

AI-Rec (Python 3.11, FastAPI, NumPy, SciPy, scikit-learn) đọc năm bảng của lược đồ serving qua HTTP của ClickHouse bằng tài khoản ai\_rec chỉ có quyền đọc lược đồ này: cặp khách–món, lịch sử mua theo đơn, đặc trưng sản phẩm, tín hiệu sở thích và tổng hợp hành vi. Mỗi lượt huấn luyện đọc lại toàn bộ tập đặc trưng: một lần mua mới có thể đổi trọng số của một cặp đã có, nên chỉ kéo dòng mới sẽ bỏ sót cập nhật.

### **5.3.2. Các kênh của mô hình**

**Lọc cộng tác theo sản phẩm.** Ma trận khách × món được lưu dạng thưa (CSR). Mỗi cặp có tổng số lượng Q và số ngày d kể từ lần mua cuối:

r(u, i) \= log(1 \+ Q(u, i) · 0,5^(d(u, i) / h))

Thang log làm một đơn sỉ không lấn át nhiều lần mua lẻ (Hu et al., 2008). Vector từng món được chuẩn hoá L2 để tính cosine; điểm của khách được tính bằng hai phép nhân ma trận thưa với vector, không bao giờ dựng ma trận món–món:

cf(u, j) \= Σ\_{i ∈ I(u)} r(u, i) · sim(i, j),   j chưa được u mua

Khách không có tín hiệu nào nhận danh sách phổ biến, tính bằng tổng số lượng đã giảm theo cùng half-life h.

**Lọc theo nội dung.** Hồ sơ khách ở mỗi nhóm đặc trưng g (danh mục gốc, hãng, tầm giá) là một phân phối, trong đó H là tổng trọng số mua có giá trị v, O bằng 1 nếu khách chọn "thích" v lúc onboarding và c là số lần mua giả của một lựa chọn onboarding (mặc định 1):

p\_u^g(v) \= (H\_u(v) \+ c · O\_u(v)) / Σ\_v' (H\_u(v') \+ c · O\_u(v'))

cb(u, i) \= trung bình theo g của p\_u^g(giá trị nhóm g của món i)

Đây là tích vô hướng giữa hồ sơ và vector one-hot của món (Pazzani & Billsus, 2007).

**Kênh mua lại.** Mỗi lần mua (mỗi đơn) được đếm và già đi riêng (Anderson et al., 2014), với h\_c là half-life của danh mục gốc của món:

rep(u, i) \= Σ\_{đơn o của u có món i} 0,5^(d(o) / h\_c(i))

**Tín hiệu hành vi phụ.** Lượt xem, thời gian xem, thêm giỏ và yêu thích có thể được cộng vào ma trận hồ sơ của lọc cộng tác. Đường dữ liệu đã có và đã kiểm thử, nhưng đang tắt vì hành vi hiện có là dữ liệu seed không liên quan tới việc mua (§6.6.3).

### **5.3.3. Trộn hybrid, lọc cứng và giải thích**

Mỗi kênh được chuẩn hoá về \[0, 1\] theo giá trị lớn nhất của chính khách đó, rồi trộn theo kiểu hybrid có trọng số (Burke, 2002), với n\_u là số món khác nhau khách đã mua:

final(u, i) \= α\_u · cf(u, i) \+ (1 − α\_u) · cb(u, i) \+ γ · rep(u, i),   α\_u \= n\_u / (n\_u \+ k)

* Với k \= 0, khách đã mua dùng lọc cộng tác cộng kênh mua lại; khách mới dùng thuần lọc theo nội dung từ onboarding.  
* Danh mục và hãng khách chọn "không quan tâm" bị lọc cứng khỏi mọi kênh, kể cả kết quả lọc cộng tác; trừ điểm thì món đó vẫn có thể lọt top khi các kênh khác đẩy đủ cao.  
* Chỉ gợi ý sản phẩm còn bán. Điểm bằng nhau được phá theo độ phổ biến, rồi số đã bán, rồi mã sản phẩm, nên kết quả luôn tất định.  
* Mỗi gợi ý kèm lý do (cf, content, repeat, popular) là kênh đóng góp lớn nhất, để giao diện giải thích được vì sao món đó xuất hiện.

### **5.3.4. Huấn luyện nền và phục vụ**

* Một vòng nền huấn luyện lại mỗi 300 giây (bắt đầu sau 20 giây). Bước huấn luyện chạy trong luồng riêng (asyncio.to\_thread) để không chặn API, và có khoá để không bao giờ có hai lượt chồng nhau.  
* Mô hình, bộ nhớ đệm gợi ý và thông tin phiên bản được đóng chung trong một ModelBundle, thay bằng một phép gán. Một request không bao giờ thấy mô hình mới đi với bộ đệm cũ; trong lúc huấn luyện bản mới, bản cũ vẫn phục vụ bình thường.  
* Sau mỗi lượt, hệ tính sẵn top-20 cho mọi khách có tín hiệu riêng trong ngân sách 60 giây; quá ngân sách thì phần còn lại được tính tại chỗ khi có request.  
* Bundle được ghi ra tệp tạm rồi đổi tên bằng os.replace (thao tác nguyên tử), nên dịch vụ khởi động lại vẫn có mô hình ngay.  
* Suy giảm có kiểm soát: ClickHouse ngừng hoặc dữ liệu rỗng thì giữ bản cũ; thiếu bảng lịch sử mua theo đơn thì kênh mua lại rơi về cách cũ; trạng thái suy giảm được báo ở endpoint /health.

*Hình 5.2. Vòng đời một bản huấn luyện của AI-Rec*

### **5.3.5. Tích hợp gợi ý vào trang chủ**

Giao diện gọi GET /api/b2c/recommendations. Tuyến này dùng xác thực tuỳ chọn: khách đăng nhập được lấy mã từ token, khách vãng lai vẫn nhận danh sách phổ biến mà không bị lỗi 401\. Máy chủ gọi AI-Rec tại GET /api/v1/recommend/customer/{id}?top\_k=N với thời gian chờ 3 giây, rồi dùng Prisma bổ sung thông tin sản phẩm hiện hành và lọc sản phẩm đã xoá hoặc hết hàng. Trang chủ hiển thị 8 sản phẩm; nếu thiếu, tầng API bù bằng sản phẩm bán chạy.

Một lỗi im lặng đã được phát hiện và sửa: bản cũ của tuyến này chờ customerId trong query string nhưng giao diện chỉ gửi email, nên điều kiện gọi AI không bao giờ thoả. API vẫn trả 200 kèm đủ 8 sản phẩm, nhìn từ ngoài y như gợi ý AI đang chạy. Sau khi sửa, một ca kiểm chứng ngày 17/09/2026 cho thấy 7/8 sản phẩm trên trang chủ trùng với danh sách gọi thẳng AI-Rec; sản phẩm còn lại bị loại vì hết hàng.

Hai hạn chế còn tồn tại: nhánh bù sản phẩm bán chạy chưa lọc tồn kho; giao diện chưa truyền mã phiên nên nhánh gợi ý theo hành vi phiên trên trang chủ chưa được dùng.

### **5.3.6. Cấu hình hiện hành**

*Bảng 5.3. Cấu hình đã kiểm định và cấu hình đang chạy*

| Tham số | Cấu hình cũ (tới 30/09) | Chọn trên validation (01/10) | Đang chạy trong mã (từ 08/10) |
| :---- | :---- | :---- | :---- |
| Half-life h | 30 ngày | 7 ngày | 37 ngày |
| Half-life kênh mua lại | dùng chung h | dùng chung h | Theo danh mục: phụ kiện di động 90, phụ kiện laptop 120, máy ảnh 180, điện thoại 975, AV 1.095, máy tính bảng 1.095, laptop 1.460 ngày |
| Thang ma trận | tuyến tính | log | log |
| Kênh mua lại | trọng số ma trận | tần suất đơn | tần suất đơn |
| Hành vi phụ | tắt | tắt | tắt |
| k / γ | 0 / 1 | 0 / 1 | 0 / 1 |

Mọi số liệu đánh giá ở §6.6.3 là của cột giữa. Cấu hình đang chạy được đổi ngày 08/10/2026 theo một quy tắc kinh nghiệm (half-life bằng một nửa trung vị khoảng cách giữa hai lần mua lại). Trên bộ demo 3 triệu đơn (38.024 khách ở tập test), cấu hình này đạt NDCG@10 0,143, Precision@10 0,110 và HitRate@10 0,650; lần đo chỉ chạy một cấu hình, chưa có đường cơ sở và khoảng tin cậy, trên dữ liệu khác bộ ở §6.6.3, nên không so trực tiếp với Bảng 6.5.

## **5.4. Phân hệ trợ lý và tìm kiếm**

ai-bot là dịch vụ Node.js riêng, lắng nghe cổng 3001 trong mạng nội bộ. Máy chủ chính chuyển tiếp năm tuyến AI (Bảng A.5) tới dịch vụ này bằng lời gọi HTTP có thời gian chờ tối đa 30 giây, nên trình duyệt không gọi thẳng ai-bot.

### **5.4.1. Trợ lý hội thoại**

1. **Phân loại ý định hai tầng:** tầng luật từ khoá bắt các mẫu rõ ràng; câu không khớp luật chuyển sang phân loại zero-shot bằng NLI với mDeBERTa-v3 (He et al., 2021\) trên 49 nhãn ý định, ví dụ chào hỏi, tìm sản phẩm, hỏi giá, hỏi cấu hình, hỏi đổi trả, hỏi giao hàng (Yin et al., 2019; Laurer et al., 2024).  
2. **Dựng ngữ cảnh:** trích giá, hãng, danh mục từ câu hỏi rồi truy vấn cơ sở dữ liệu. Ngân sách khách nêu là ràng buộc cứng, không được nới: nếu không có sản phẩm nào trong ngân sách thì trợ lý trả lời bằng câu dựng sẵn, nêu sản phẩm gần ngân sách nhất hoặc sản phẩm của hãng khác trong ngân sách, thay vì tự nới khoảng giá.  
3. **Sinh câu trả lời:** Llama-3.1-8B-Instruct (Grattafiori et al., 2024\) qua Hugging Face Inference nhận ngữ cảnh đã truy xuất — sinh câu trả lời có căn cứ theo tinh thần RAG (Lewis et al., 2020), truy xuất trên cơ sở dữ liệu quan hệ chứ không dùng vector. Lời gọi mô hình đi qua một chuỗi nhà cung cấp theo thứ tự Hugging Face → Gemini → OpenRouter; mỗi nhà cung cấp có bộ ngắt mạch tạm ngừng gọi khi gặp lỗi xác thực, hết hạn mức hoặc bị giới hạn tần suất, và trạng thái từng nhà cung cấp hiển thị ở /api/health.  
4. **Suy giảm êm:** cả chuỗi mô hình ngôn ngữ lỗi thì trả câu trả lời mẫu theo ý định.

Các câu hỏi chính sách (đổi trả, giao hàng, thanh toán) hiện trả lời bằng nội dung viết sẵn, chưa có kho tri thức chính sách; phương thức thanh toán trong câu trả lời đã được đối chiếu với hệ thống (COD và chuyển khoản VietQR), còn thời gian giao hàng, bảo hành, đổi trả là nội dung minh hoạ chưa gắn với quy trình vận hành thật (§7.4). Hội thoại được lưu vào bảng ChatLog.

### **5.4.2. Tìm kiếm theo mô tả và theo hình ảnh**

* **Theo mô tả:** mô hình ngôn ngữ trích ra cấu trúc JSON (từ khoá, hãng, danh mục, khoảng giá); lỗi thì rơi về bộ luật. Khoảng giá luôn trích bằng biểu thức chính quy ("dưới X triệu", "từ X đến Y", "tầm X", "Xtr", "Xk"…) để không phụ thuộc mô hình.  
* **Theo hình ảnh:** ảnh tải lên được gửi tới Gemini (Gemini Team, 2023); mô hình trả JSON gồm danh mục (ràng buộc trong đúng danh sách danh mục của cửa hàng), hãng, màu, từ khoá, mô tả; có thể kết hợp ảnh với từ khoá.  
* **Theo giọng nói:** nút micro ở ô chat và ô tìm kiếm ghi âm rồi gửi âm thanh dạng base64 tới /api/ai/transcribe; ai-bot nhờ Gemini chuyển thành văn bản (thử lần lượt hai mô hình, mỗi mô hình tối đa 12 giây) và trả văn bản về để điền vào ô nhập. Mỗi yêu cầu bị giới hạn 90.000 ký tự base64 và tối đa 20 yêu cầu mỗi phút. Độ chính xác nhận dạng và độ trễ chưa được đo có hệ thống.

### **5.4.3. Khâu truy xuất sản phẩm**

Cả trợ lý, tìm theo mô tả và tìm theo ảnh đều kết thúc bằng truy vấn ILIKE '%từ khoá%' trên tên sản phẩm. Đây là điểm nghẽn chung về cả tốc độ lẫn chất lượng (§6.6.4).

## **5.5. Tích hợp đầu-cuối**

### **5.5.1. Chuỗi sự kiện từ giao dịch tới gợi ý**

1. Khách đăng nhập và thêm sản phẩm vào giỏ.  
2. API tính lại tiền, giữ chỗ tồn kho, tạo Order và OrderItem ở trạng thái chờ thanh toán.  
3. Trình duyệt hiển thị QR và hỏi trạng thái đơn mỗi 3 giây.  
4. SePay gửi webhook về địa chỉ công khai của hệ thống.  
5. API xác thực HMAC, lưu giao dịch với khoá duy nhất, đối chiếu tài khoản, số tiền và mã đơn.  
6. Đơn chuyển sang đã thanh toán; tồn kho, voucher, điểm được chốt.  
7. PostgreSQL ghi WAL của transaction đã cam kết.  
8. Debezium đưa thay đổi vào topic Kafka.  
9. S3 Sink xả tệp Parquet lên MinIO.  
10. dbt đọc staging và nạp bảng sự kiện.  
11. Tầng phục vụ cập nhật doanh thu, cặp khách–món và lịch sử mua.  
12. Đối soát ba tầng kiểm tra số dòng và tổng tiền.  
13. AI-Rec nạp đặc trưng và huấn luyện bản kế tiếp.  
14. Trang chủ trả gợi ý mới cho khách.

*Hình 5.3. Chuỗi đầu-cuối từ giao dịch B2C tới kho và AI*

### **5.5.2. Phần đồng bộ và phần bất đồng bộ**

Bước 1–6 thuộc đường đồng bộ của ứng dụng: phản hồi cho khách không chờ Kafka, MinIO, ClickHouse hay AI-Rec. Bước 7–14 là đường bất đồng bộ: nếu tầng phân tích tạm ngừng, việc đặt đơn và thanh toán vẫn hoạt động, và dữ liệu được đọc lại khi tầng phân tích phục hồi. Vì vậy có ba loại thời gian khác nhau, không được gộp thành một con số:

* **Thời gian tác nghiệp:** xử lý request đặt hàng hoặc webhook ở máy chủ.  
* **Thời gian đồng bộ dữ liệu:** từ lúc giao dịch cam kết tới lúc tầng phục vụ có phiên bản mới; theo cấu hình gồm tối đa 15 giây xả tệp và một chu kỳ dbt 5 phút.  
* **Thời gian tới mô hình:** từ lúc cam kết tới lúc bản mô hình kế tiếp đã học được giao dịch; theo cấu hình thêm một chu kỳ huấn luyện 5 phút, tổng khoảng 10–11 phút.

Các con số trên suy ra từ cấu hình. Lần nạp dồn 3 triệu đơn ngày 23/10/2026 đo được thời gian từ lúc cam kết tới bảng sự kiện ở kho p50 263 giây, p95 439 giây, p99 450 giây; thời gian tới mô hình chưa được đo trực tiếp (§6.6.6).

# **Chương 6\. Triển khai hệ thống**

## **6.1. Môi trường triển khai**

Toàn bộ hệ thống được mô tả trong một tệp docker-compose.yml ở gốc kho mã nguồn, gồm 17 dịch vụ dùng chung một mạng nội bộ. Ba phân hệ (thương mại điện tử, nền tảng dữ liệu, AI) chạy chung một môi trường: PostgreSQL của ứng dụng là nguồn CDC trực tiếp, không có cơ sở dữ liệu mô phỏng riêng; ClickHouse là kho chung cho dbt và cho phân tích của ứng dụng. Gộp như vậy loại bỏ tình trạng hai bản ghi đơn hàng hoặc hai kho phân tích lệch nhau; đổi lại, phải phân quyền và giới hạn tài nguyên rõ để tác vụ thử nghiệm không ảnh hưởng chức năng phục vụ.

*Bảng 6.1. Các dịch vụ trong docker-compose.yml*

| Nhóm | Dịch vụ | Ghi chú |
| :---- | :---- | :---- |
| Ứng dụng | client, server, ai-bot, ai-rec | client gồm bản build React và Nginx |
| Dữ liệu tác nghiệp | postgres, redis | PostgreSQL 16, Redis 7 |
| Lakehouse | zookeeper, kafka, kafka-connect, minio, clickhouse, dbt, dbt-scheduler, bootstrap | bootstrap chạy một lần rồi thoát |
| BI | metabase | Đọc tầng serving |
| Nạp dữ liệu (chạy riêng) | seed-catalog, seed-data | Profile seed, không chạy khi khởi động thường |

* Toàn hệ được dựng bằng một lệnh docker compose up \-d \--build. Lần khởi động thường chỉ chạy migrate và nạp dữ liệu nền (tài khoản, chi nhánh, danh mục, hãng, voucher), mất vài giây.  
* Dịch vụ bootstrap tự khởi tạo bucket MinIO, tài khoản ClickHouse chỉ đọc cho AI-Rec, kéo dữ liệu chiều, tạo các view tương thích cho dashboard và đăng ký hai connector CDC.  
* MinIO bản cộng đồng chỉ còn phát hành dạng mã nguồn; image dựng sẵn không còn kéo được (MinIO, 2025). Đề tài build MinIO từ mã nguồn chính thức, ghim đúng phiên bản và gọi S3 API trực tiếp bằng chữ ký SigV4 thay cho công cụ mc. Hạn chế: bản cộng đồng không còn nhận bản vá bảo mật.

## **6.2. Cấu hình và quản lý bí mật**

* Biến môi trường tập trung trong tệp .env ở gốc kho mã, không đưa lên kho mã; tệp .env.example liệt kê đủ tên biến kèm giải thích và giá trị giả.  
* Thiếu .env thì Docker Compose dừng ngay và báo rõ biến bị thiếu, thay vì chạy tiếp với mật khẩu rỗng rồi hỏng ở chỗ không liên quan.  
* Mỗi dịch vụ chỉ nhận đúng các bí mật nó cần; tài khoản ClickHouse của AI-Rec chỉ có quyền đọc lược đồ serving.

## **6.3. Điều phối truy cập và webhook thanh toán**

* Nginx chạy trong container client: phục vụ tệp tĩnh và chuyển các yêu cầu /api/ tới server.  
* Server chuyển tiếp yêu cầu trợ lý và tìm kiếm tới ai-bot, gọi ai-rec qua mạng nội bộ Docker; trình duyệt không gọi thẳng hai dịch vụ này.  
* Chỉ client cần mở cổng ra ngoài.

SePay cần một URL công khai cố định để gửi webhook. Quick tunnel của Cloudflare đổi URL mỗi lần khởi động lại; mỗi lần đổi phải khai lại bên SePay, và nếu quên thì đơn nằm chờ rồi hết hạn dù tiền đã vào tài khoản. Mạng nơi làm việc của nhóm còn chặn cổng 7844 mà tunnel này cần. Từ 07/10/2026, webhook đi qua tên miền tĩnh miễn phí của ngrok (chạy qua cổng 443, URL không đổi); Cloudflare quick tunnel chỉ còn dùng để chia sẻ giao diện web. Khi không nhận được giao dịch ngân hàng thật, nhóm dùng bộ giả lập webhook (simulate-payment.sh).

## **6.4. Nạp dữ liệu mô phỏng**

Toàn bộ dữ liệu là dữ liệu mô phỏng có hạt giống cố định, tái lập được. Dữ liệu lớn được tách thành lệnh riêng (profile seed) để lần khởi động thường không phải chờ.

*Bảng 6.2. Các bộ sinh dữ liệu*

| Bộ sinh | Nội dung | Đường đi |
| :---- | :---- | :---- |
| Catalog | 600.000 sản phẩm cân bằng: thiết bị 40%, phụ kiện – nghe nhìn – camera 60%, không hãng nào quá 10%; khoảng 1,2 triệu dòng tồn kho | Ghi vào PostgreSQL |
| Mô phỏng POS | Đơn hàng theo "gu" khách | Ghi vào PostgreSQL rồi đi qua CDC |
| Bộ sinh v2 | Gu ẩn theo danh mục, hãng, tầm giá; gu trôi dần; hành vi "xem trước khi mua"; onboarding có nhiễu | Ghi thẳng CSV, chỉ dùng cho đánh giá AI |
| Bộ demo | 40.000 khách, 3.000.000 đơn, cùng mô hình gu của bộ sinh v2, thêm mua kèm phụ kiện | Ghi vào PostgreSQL, đi đúng đường CDC → hồ → dbt → AI-Rec |

Bộ demo 3.000.000 đơn đã được nạp đủ vào hệ. Nạp trước khi bật toàn bộ hệ giúp Debezium chụp ảnh bảng một lần, nhẹ hơn đẩy hàng triệu thay đổi qua replication slot. Khi kho đạt khoảng 2,77 triệu đơn (6.276.950 dòng hàng, đo ngày 08/10/2026), phép khử trùng phiên bản bằng hàm cửa sổ vượt trần bộ nhớ của ClickHouse; nhóm chuyển sang GROUP BY kết hợp argMax, vốn tràn đĩa được.

*Bảng 6.3. Bộ nhớ của hai cách khử trùng phiên bản*

| Truy vấn | Hàm cửa sổ (row\_number) | GROUP BY \+ argMax |
| :---- | :---- | :---- |
| Lượt nạp dồn bảng sự kiện | 6,44 GB | — |
| Dựng lại toàn bộ bảng sự kiện | Vượt trần 7,2 GB | 2,82 GB |
| Khử trùng tầng hồ trong đối soát | 4,74 GB | 1,88 GB, nhanh gần gấp đôi |

Hai cách được đối chiếu trên toàn bộ dữ liệu: khớp từng byte trên 6.276.950 dòng (cùng cityHash64 của mọi cột), nên phép thay thế không đổi kết quả.

## **6.5. Vận hành, sao lưu và khôi phục**

* dbt-scheduler (ofelia) chạy dbt build mỗi 5 phút; AI-Rec huấn luyện lại mỗi 5 phút; PostgreSQL được sao lưu mỗi 24 giờ vào thư mục backups.  
* Dữ liệu nằm trong các named volume nên build lại hay khởi động lại không mất dữ liệu. Lệnh docker compose down \-v bị cấm vì xoá sạch volume (catalog, kho, hồ dữ liệu).  
* Kafka không có volume: tạo lại container làm Debezium chụp lại toàn bộ bảng, đưa bản trùng vào hồ. dbt khử được bản trùng nên kho không đếm đôi, nhưng hồ phình ra và mỗi lượt dbt quét lâu hơn; vì vậy máy demo dùng stop/start thay cho down.  
* Hồ dữ liệu và kho là dữ liệu dẫn xuất: khi một phép biến đổi sai, sửa model rồi dựng lại từ Parquet (full-refresh) mà không cần nguồn gửi lại dữ liệu. Điều này đã được thực hiện thật khi sửa bảng sự kiện ngày 29/09/2026 (§6.6.1).

## **6.6. Kiểm thử và đánh giá**

Mọi số liệu trong mục này đo trên dữ liệu mô phỏng. Mục này chỉ báo cáo những gì đã có số đo; §6.6.6 tách riêng lần đo tải đã chạy và các thực nghiệm còn ở mức thiết kế.

### **6.6.1. Toàn vẹn dữ liệu xuyên tầng**

*Bảng 6.4. Đối soát sau khi sửa logic nạp tăng dần (29/09/2026)*

| Kiểm tra | Trước khi sửa | Sau khi sửa |
| :---- | :---- | :---- |
| 7 sản phẩm sửa snapshot hãng, danh mục (335 dòng hàng) | 6/7 sai hãng trong kho | 7/7 đúng, khớp PostgreSQL |
| Số dòng / số đơn / tổng net\_amount | — | 6.262 / 3.509 / 154.649.475.200, khớp PostgreSQL |
| Đối soát ba tầng | — | KHỚP |
| Chỉ dòng hàng thay đổi | Logic cũ ghi 0 dòng | Cả đơn được ghi lại |
| Chỉ đơn thay đổi | Logic cũ ghi 0 dòng | 3/3 dòng hàng được ghi lại |

* Kiểm thử dùng câu lệnh cập nhật không đổi giá trị (SET x \= x): PostgreSQL vẫn ghi WAL nên Debezium vẫn phát sự kiện, còn dữ liệu không bị thay đổi.  
* Sau khi chuyển MinIO sang bản build từ mã nguồn (04/10/2026), dbt build đạt 68/68 PASS. Debezium chụp lại toàn bộ bảng nên hồ chứa bản trùng, nhưng kho vẫn khớp tuyệt đối với nguồn.

### **6.6.2. Thanh toán và tồn kho**

* Webhook: 20/20 kịch bản đối soát đạt, gồm cổng gửi lại webhook, khách chuyển hai lần, sai số tiền, nội dung chứa nhiều mã, đơn hết hạn còn hàng (LATE\_MATCHED), đơn hết hạn hết hàng (REFUND\_REQUIRED), webhook đến trước khi đơn kịp tạo (job đối khớp lại xử lý).  
* Tồn kho: kịch bản đặt đồng thời cùng một món không gây bán vượt tồn.

### **6.6.3. Hệ gợi ý**

**Giao thức đánh giá.**

1. Cắt theo thời gian toàn cục: 70% đơn đầu để huấn luyện, 15% kế để validation, 15% cuối để test (Campos et al., 2014).  
2. Tập huấn luyện dựng y như dữ liệu production rồi chạy qua đúng mã đang phục vụ; tập ứng viên content-based chỉ lấy từ doanh số trong cửa sổ huấn luyện để không rò rỉ tương lai.  
3. Chọn tham số trên validation (1.920 bộ tham số, luật chọn khai báo trước: tối đa NDCG@10 tổng thể với 2–3 món đã mua trong 10 ô), đo một lần trên test.  
4. Tách hai bài toán: khám phá (món chưa từng mua) và mua lại. Gộp chung thì một mô hình chỉ gợi ý lại đồ cũ trông rất tốt mà không khám phá được gì.  
5. Đường cơ sở: Random, Most-Popular, Repeat-only; đối chứng mạnh EASE^R (Steck, 2019\) và iALS (Hu et al., 2008), đều tinh chỉnh trên validation (Dacrema et al., 2019).  
6. Khoảng tin cậy 95% bằng bootstrap theo khách (Efron & Tibshirani, 1993); chênh lệch giữa hai mô hình so ghép cặp trên cùng mẫu khách.  
7. Kiểm định chéo theo thời gian: hai cửa sổ trước validation, mỗi cửa sổ huấn luyện lại trên dữ liệu trước nó, không dùng để chọn tham số.

Dữ liệu đánh giá chính là các đơn trong hệ tới ngày 17/09/2026: 3.498 đơn, 176 khách ở tập test, 6.152 ứng viên. Kết quả đo ngày 01/10/2026.

*Bảng 6.5. Cấu hình chọn trên validation so với cấu hình cũ — NDCG@10 trên test*

| Bài toán | Cấu hình cũ | Cấu hình chọn | Chênh lệch \[CI 95%\] |
| :---- | :---- | :---- | :---- |
| Tổng thể (176 khách) | 0,309 | 0,356 | \+0,047 \[+0,018; \+0,074\] |
| Khám phá (126 khách) | 0,258 | 0,267 | \+0,008 \[−0,014; \+0,032\] |
| Mua lại (156 khách) | 0,264 | 0,332 | \+0,068 \[+0,029; \+0,106\] |

*Bảng 6.6. Bài toán khám phá — mỗi mô hình tinh chỉnh trên validation, NDCG@10 trên test*

| Mô hình | NDCG@10 | Chênh lệch so với Item-CF cũ \[CI 95%\] |
| :---- | :---- | :---- |
| Most-Popular | 0,148 | −0,203 \[−0,271; −0,130\] |
| Item-CF — cấu hình cũ (half-life 30, thang tuyến tính) | 0,350 | — |
| EASE^R (λ \= 50\) | 0,359 | \+0,009 \[−0,017; \+0,036\] |
| iALS (16 nhân tố) | 0,373 | \+0,022 \[−0,014; \+0,065\] |
| Item-CF tinh chỉnh (half-life 7, thang log) | 0,377 | \+0,026 \[+0,006; \+0,048\] |

* Item-CF sau tinh chỉnh không thua hai đối chứng mạnh và gấp khoảng 2,5 lần Most-Popular ở bài toán khám phá; ở quy mô hiện tại, EASE^R và iALS không đáng thêm độ phức tạp vận hành.  
* Mức tăng tổng thể đến từ half-life ngắn hơn và kênh mua lại theo tần suất đơn (phần mua lại \+0,068). Phần khám phá của hybrid không tăng có ý nghĩa thống kê vì kênh mua lại mạnh hơn lấy bớt ô.  
* Kiểm định chéo trên hai cửa sổ trước validation (302 khách) giữ nguyên chiều: hybrid tổng thể \+0,100 \[+0,075; \+0,126\], Item-CF khám phá \+0,043 \[+0,020; \+0,066\].  
* Khách mới mô phỏng (xoá lịch sử, giả lập onboarding): content-based từ onboarding đạt 0,190 so với 0,140 của Most-Popular (+0,050 \[+0,019; \+0,079\]). Đây là cận trên vì onboarding được giả lập đúng gu thật.  
* Đánh đổi khám phá – mua lại: tăng trọng số kênh mua lại γ làm NDCG tổng thể tăng gần đơn điệu nhưng NDCG khám phá giảm (γ \= 0: 0,168 và 0,377; γ \= 1: 0,356 và 0,267; γ \= 5: 0,486 và 0,074). Chọn γ vì vậy là quyết định sản phẩm, được chốt bằng ràng buộc 2–3 món cũ trong 10 ô.

Trên bộ sinh v2 (gu gắn với đặc trưng, gu trôi dần), cấu hình chọn trên validation tăng NDCG@10 tổng thể từ 0,197 lên 0,357 (+0,160 \[+0,142; \+0,178\]) và khám phá từ 0,021 lên 0,176; với khách mới chỉ có hành vi duyệt, hybrid đạt 0,400 so với 0,099 của Most-Popular. Bộ sinh này giả định khách xem món trước khi mua, nên kết quả chỉ cho thấy mô hình khai thác được cấu trúc khi cấu trúc đó tồn tại, không chứng minh hành vi khách thật có cấu trúc đó (Ie et al., 2019).

**Giới hạn của các kết quả.** Bộ dữ liệu đánh giá có cấu trúc giả của bộ sinh: 63,5% món ở test là món khách đã mua trước đó; toàn bộ đơn POS đến từ năm lần chạy bộ sinh bằng tay nên có một cú "đổi gu" đột ngột quanh 10/09; cửa sổ test chỉ dài khoảng 9,7 giờ. Đánh giá trên log chỉ thưởng các món có trong log (Marlin & Zemel, 2009): 6.074/6.152 ứng viên chưa từng được mua, nên content-based và độ phủ bị đánh giá thấp. Chi tiết lưới tham số và khoảng tin cậy nằm trong ai-rec/evaluation/README.md.

### **6.6.4. Tìm kiếm và duyệt sản phẩm**

*Bảng 6.7. Hiện trạng tìm kiếm trên catalog 600.000 sản phẩm (đo 10/10/2026)*

| Phép đo | Kết quả |
| :---- | :---- |
| Kế hoạch thực thi tìm hai từ (ILIKE '%tai nghe%' AND ILIKE '%sony%') | Quét tuần tự song song toàn bảng |
| Thời gian thực thi | Khoảng 140–200 ms khi cache nóng, khoảng 650 ms khi cache nguội |
| Gõ có dấu "điện thoại" | 89.974 kết quả |
| Gõ không dấu "dien thoai" | 0 kết quả |
| Gõ sai "samsng" | 0 kết quả |
| Xếp hạng | Theo mã, giá hoặc số đã bán; không theo độ liên quan |

Lọc theo danh mục, hãng và khoảng giá dùng chỉ mục nên không gặp vấn đề tương tự; điểm nghẽn là tìm theo từ khoá. Hướng cải tiến nằm ở §7.5.

### **6.6.5. Thiết kế kiểm thử tích hợp**

*Bảng 6.8. Các trường hợp kiểm thử tích hợp đầu-cuối*

| Mã | Bước thực hiện | Kết quả kỳ vọng |
| :---- | :---- | :---- |
| IT01 | Tạo đơn mới và xem QR | Order chờ thanh toán, giữ chỗ kho đúng, giá tính tại server |
| IT02 | Gửi webhook hợp lệ | PaymentTransaction được tạo, đơn chuyển PAID đúng một lần |
| IT03 | Gửi lại cùng webhook | Không tạo thanh toán hay chốt đơn lần hai |
| IT04 | Gửi giao dịch khác cho đơn đã PAID | Ghi nhận DUPLICATE, không chốt đơn lần hai |
| IT05 | Quan sát Kafka và MinIO | Sự kiện có khoá, Parquet xuất hiện sau chu kỳ xả |
| IT06 | Chờ dbt hoàn thành | Bảng sự kiện và doanh thu phản ánh đúng đơn |
| IT07 | Chạy đối soát | Checksum ba tầng khớp hoặc chỉ rõ nguyên nhân lệch |
| IT08 | Gọi gợi ý với token hợp lệ | AI-Rec được gọi thật, sản phẩm trả về đã lọc hợp lệ |
| IT09 | Gọi gợi ý không có token | Trả 200, danh sách phổ biến |
| IT10 | Dừng ClickHouse trong chu kỳ huấn luyện | AI-Rec tiếp tục phục vụ bản mô hình cũ |
| IT11 | Dừng AI-Rec | Trang chủ dùng danh sách dự phòng, không lỗi |
| IT12 | Một khách mua cùng sản phẩm hai lần | Đặc trưng cập nhật đúng, không nhân bản cặp khách–món |

Một ca IT08 đã được ghi nhận ngày 17/09/2026: với khách có mã 1, 7/8 sản phẩm trên trang chủ trùng với danh sách gọi thẳng AI-Rec; sản phẩm còn lại bị loại vì hết hàng và được thay bằng sản phẩm dự phòng. Ca này xác nhận đường gọi AI thật, không phải số đo chất lượng gợi ý.

### **6.6.6. Thực nghiệm hiệu năng**

Bản nộp thiết kế năm thực nghiệm hiệu năng. Ngày 23/10/2026 nhóm chạy một lần nạp dồn bộ demo 3.000.000 đơn (6.795.746 dòng hàng) khi toàn hệ đang chạy, CDC đi qua replication slot. Lần đo này đáp ứng một phần TN1, TN2, TN4 và TN5: thông lượng thu nhận khoảng 1.900 đơn/giây (khoảng 6.300 bản ghi CDC/giây), trần nằm ở Debezium; độ trễ từ cam kết tới kho p50 263 giây, p95 439 giây, p99 450 giây; đối soát ba tầng khớp, không mất hay nhân bản bản ghi. Lần đo chỉ chạy một lần, ở một mức tải vượt điểm bão hoà, trên máy ảo 9 GB RAM chưa đặt trần bộ nhớ cho ClickHouse, với flush.size 10.000 thay vì 1.000. TN3 và phần tiêm lỗi của TN5 chưa chạy; các ngưỡng trong đề cương vẫn là chỉ tiêu dự kiến.

* TN1 — độ trễ đầu-cuối theo mức tải 100, 500, 1.000 và 5.000 giao dịch/phút, báo cáo p50, p95, p99 từng chặng (commit → Kafka → MinIO → kho → bản mô hình mới).  
* TN2 — thông lượng thu nhận và điểm bão hoà, tăng tải tới khi consumer lag tăng liên tục.  
* TN3 — hiệu năng 10 truy vấn phân tích đại diện trên PostgreSQL và ClickHouse ở 1, 10 và 50 triệu dòng, sau khi đối chiếu kết quả hai bên khớp nhau.  
* TN4 — tính đúng và chi phí cập nhật: nạp tăng dần với ReplacingMergeTree, dựng lại toàn bảng, và mutation trực tiếp.  
* TN5 — đối soát dưới tiêm lỗi: dừng Kafka, ngắt MinIO, dừng ClickHouse, kill dbt giữa lô, lỗi lược đồ; đo thời gian phát hiện, phục hồi dịch vụ và phục hồi chất lượng dữ liệu.

### **6.6.7. Rà soát tĩnh xác thực API**

Nhóm đọc mã nguồn của các tệp route trong server/src và ai-bot/src, cùng tệp index.js, để ghi nhận middleware xác thực đang gắn trên từng tuyến. Đây là rà soát tĩnh trên mã nguồn, không phải kiểm thử xâm nhập; cách phân loại tham khảo OWASP API Security Top 10 (OWASP Foundation, 2023). Bảng 6.9 tóm tắt kết quả; danh sách chi tiết từng tuyến nằm ở Phụ lục A.13.

*Bảng 6.9. Kết quả rà soát tĩnh xác thực API*

| Nhóm phát hiện | Số tuyến | Mô tả | Phân loại OWASP 2023 |
| :---- | :---- | :---- | :---- |
| Tuyến quản trị không có xác thực | 33 | Toàn bộ /api/b2b ở b2b.js (19), aiAdmin.js (5), behavior-analytics.js (9): thêm/sửa/xoá sản phẩm, chi nhánh, hãng, flash sale; đọc danh sách khách hàng; kích hoạt huấn luyện lại; xuất nhật ký hội thoại | API5 (phân quyền ở mức chức năng), API2 |
| Tuyến quản trị chỉ kiểm chữ ký JWT, không kiểm vai trò | 14 | Dashboard, báo cáo doanh thu, đối soát, cảnh báo, giao nhận, tài chính, /api/auth/me và POST /api/admin/simulate-sale. Token khách hợp lệ vẫn vào được | API5 |
| Tuyến công khai có ghi dữ liệu nghiệp vụ | 1 | POST /api/b2c/products/:id/reviews: không cần đăng nhập, tên người đánh giá tự khai | API2, API6 |
| Tuyến công khai chỉ dùng để gỡ lỗi hoặc dữ liệu giả | 3 | GET /api/b2c/behavior/stats, GET /api/products (trả toàn bộ bảng sản phẩm), GET /api/analytics/orders (dữ liệu sinh tại chỗ) | API9 (quản lý tồn kho API), API4 |
| Tuyến AI công khai có gọi API mô hình bên ngoài | 5 | /api/b2c/chat, /api/ai/smart-search, /api/b2c/visual-search, /api/ai/smart-search-image và /api/ai/transcribe | API4 (tiêu thụ tài nguyên không giới hạn) |
| API client gọi nhưng máy chủ chưa có | 1 | Client gọi GET /api/b2b/campaign-suggestions nhưng máy chủ chưa có tuyến này | Lệch giữa client và server (khớp MT6 ở §7.1) |

Các tuyến đặt hàng, đơn của tôi, trạng thái thanh toán, huỷ đơn, sở thích, danh sách yêu thích và đặt mật khẩu phía khách đều đòi token khách và lấy customer\_id từ token; webhook thanh toán dùng chữ ký cổng. Đáng chú ý nhất, vì POST /api/admin/simulate-sale chỉ kiểm chữ ký JWT, một khách đã đăng ký tài khoản có thể ghi dòng mô phỏng vào analytics.sale\_orders và analytics.input\_vouchers trên ClickHouse mà đối soát ba tầng (§6.6.1) không phát hiện được (do hai bảng này phục vụ trực tiếp dashboard, nằm ngoài chuỗi CDC).

### **6.6.8. Kịch bản trình diễn**

**Khách hàng.**

1. Đăng nhập lần đầu và làm onboarding sở thích.  
2. Tìm theo mô tả ("tai nghe chống ồn dưới 5 triệu") và theo ảnh.  
3. Lọc, so sánh, hỏi trợ lý về cấu hình.  
4. Thêm vào giỏ, thanh toán bằng mã QR.  
5. Webhook khớp tiền, đơn chuyển sang đã thanh toán.  
6. Sau một chu kỳ dbt và AI-Rec, ô "Dành riêng cho bạn" thay đổi, kèm lý do gợi ý.

**Quản trị và nền tảng.** Theo dõi đơn mới, xử lý fulfillment, xem đối soát thanh toán, cảnh báo và biểu đồ doanh thu đọc từ kho; cho thấy đơn vừa đặt xuất hiện ở hồ dữ liệu rồi ở kho, và checksum ba tầng khớp. Khoảng chờ vài phút giữa lúc đặt đơn và lúc gợi ý thay đổi là đặc tính của micro-batch và lịch huấn luyện, không phải lỗi ứng dụng. Khi trình diễn trước hội đồng, nên chuẩn bị sẵn bộ giả lập webhook để không phụ thuộc giao dịch ngân hàng thật.

# **Chương 7\. Kết luận**

## **7.1. Kết quả đạt được**

Đề tài đã dựng được một chuỗi dữ liệu khép kín: từ đơn hàng phát sinh trên ứng dụng GetShopy, qua thu nhận thay đổi, hồ dữ liệu, kho phân tích, tới báo cáo quản trị và gợi ý cá nhân hoá quay về giao diện. Bảng 7.1 đối chiếu từng mục tiêu ở Bảng 1.1 với bằng chứng hiện có.

*Bảng 7.1. Mức đạt của các mục tiêu cụ thể*

| Mã | Mục tiêu | Mức đạt | Bằng chứng |
| :---- | :---- | :---- | :---- |
| MT1 | Luồng CDC qua hồ dữ liệu tới kho | Đạt | CDC hai bảng Order, OrderItem chạy liên tục; bộ dữ liệu demo 3.000.000 đơn đi qua đủ đường; đối soát ba tầng khớp (§6.6.1, §6.6.6) |
| MT2 | Hợp nhất chính xác cập nhật và xoá | Đạt, có giới hạn | Nạp tăng dần theo tập đơn có biến động và mốc riêng từng nguồn; xoá lẻ một dòng hàng chưa lan tới kho (§5.2.3) |
| MT3 | Tăng hiệu năng truy vấn phân tích | Chưa đủ bằng chứng | Chưa chạy bộ truy vấn so sánh PostgreSQL và ClickHouse (§6.6.6) |
| MT4 | Tự động kiểm tra chất lượng, cảnh báo SLA | Một phần | Kiểm thử dbt 68/68, kể cả khi kho chứa bộ demo 3 triệu đơn (24/10/2026), và đối soát ba tầng mỗi lượt; chưa có màn hình SLA và số liệu SLO dài hạn |
| MT5 | GetShopy dùng dữ liệu đầu vào và đầu ra | Đạt | Đơn từ web đi qua CDC tới kho; dashboard đọc kho; trang chủ gọi AI-Rec thật (§5.3.5) |
| MT6 | Đánh giá gợi ý; thiết kế module AI mở rộng | Đạt phần gợi ý | Hybrid vượt cấu hình cũ \+0,047 NDCG@10, CI 95% \[+0,018; \+0,074\]; dự báo nhu cầu và tối ưu khuyến mãi chưa có mã nguồn |
| MT7 | Tái lập ở cấp cụm | Một phần | Dựng toàn hệ trên một máy bằng một lệnh; chưa diễn tập cụm nhiều máy |

## **7.2. Trả lời câu hỏi nghiên cứu**

**RQ1 — thu nhận thay đổi.** Đề tài dùng CDC đọc WAL của PostgreSQL qua Debezium, Kafka và S3 Sink tới hồ dữ liệu, phát lại được theo offset trong thời hạn lưu của Kafka. Cách này không thêm tải đọc lên OLTP và bắt được cả cập nhật lẫn xoá. Một lần nạp dồn 3 triệu đơn cho thông lượng khoảng 1.900 đơn/giây, giới hạn ở Debezium, độ trễ từ cam kết tới kho p95 439 giây, và không mất hay nhân bản bản ghi; độ trễ theo các mức tải của đề cương và phục hồi sau lỗi chưa được đo (§6.6.6).

**RQ2 — bản ghi nhiều phiên bản.** Bảng sự kiện dùng ReplacingMergeTree(\_event\_ts, \_is\_deleted), mọi truy vấn đọc kèm FINAL. Nạp tăng dần theo tập đơn có biến động và mốc riêng từng nguồn đã được kiểm chứng đúng trên các tình huống chỉ đơn đổi và chỉ dòng hàng đổi. Chi phí so với dựng lại toàn bảng chưa đo.

**RQ3 — kiểm chứng tự động.** Mô hình audit.checksum\_orders so số dòng và tổng tiền ở ba điểm (PostgreSQL, hồ dữ liệu, kho) sau mỗi lượt dbt. Chính cơ chế này đã phát hiện lỗi mất dữ liệu thật của logic nạp tăng dần cũ. Số liệu SLO dài hạn và kịch bản tiêm lỗi chưa có.

**RQ4 — giá trị cho AI.** Có. Trên dữ liệu đơn trong hệ, hybrid đã tinh chỉnh tăng NDCG@10 tổng thể từ 0,309 lên 0,356; ở bài toán khám phá, Item-CF đạt 0,377 so với 0,148 của Most-Popular; với khách mới mô phỏng, content-based từ onboarding đạt 0,190 so với 0,140. Mọi số đo đều trên dữ liệu mô phỏng (§6.6.3).

## **7.3. Đóng góp**

Đóng góp của đề tài không nằm ở một thuật toán học máy mới, mà ở việc tổ chức một vòng đời dữ liệu khép kín có thể kiểm chứng:

* Kiến trúc tách tải tác nghiệp khỏi tải phân tích, giữ lại lịch sử thay đổi để tái xử lý.  
* Cơ chế nạp tăng dần đúng cho bảng sự kiện ghép từ hai nguồn CDC xả lệch thời điểm, kèm đối soát ba tầng tự động.  
* Hệ gợi ý lai giải thích được, đánh giá bằng giao thức có kiểm soát: cắt theo thời gian, tách bài toán con, đường cơ sở, đối chứng mạnh, khoảng tin cậy.  
* Một ứng dụng thương mại điện tử chạy thật trên nền tảng, cho thấy chất lượng gợi ý phụ thuộc cả việc dữ liệu được thu nhận đúng, đặc trưng đúng và đầu ra tuân thủ trạng thái kinh doanh hiện hành.

## **7.4. Hạn chế**

1. **Dữ liệu mô phỏng.** Mọi kết quả phụ thuộc giả định của bộ sinh; chưa có bằng chứng trên khách hàng thật.  
2. **Thực nghiệm hiệu năng mới chạy một phần.** Thông lượng và độ trễ đầu-cuối mới đo trong một lần nạp dồn, chưa lặp lại và chưa theo bốn mức tải của đề cương; p95 truy vấn ở 10 triệu dòng và phục hồi sau lỗi vẫn ở mức thiết kế phép đo.  
3. **Một máy.** Môi trường một nút không phản ánh khả năng chịu lỗi của cụm phân tán.  
4. **Tìm kiếm.** Truy vấn ILIKE quét toàn bảng; gõ không dấu hoặc gõ sai cho 0 kết quả (§6.6.4).  
5. **Bảo mật và độ chặt của API.** Rà soát tĩnh ở §6.6.7 cho thấy: (a) 33 tuyến thuộc nhóm /api/b2b chưa có xác thực, gồm cả thao tác ghi và đọc danh sách khách hàng; (b) 14 tuyến báo cáo của quản trị chỉ kiểm chữ ký JWT qua authMiddleware mà không kiểm vai trò, nên token của khách vẫn truy cập được, kể cả tuyến ghi dữ liệu mô phỏng bán hàng POST /api/admin/simulate-sale; (c) tuyến gửi đánh giá sản phẩm (không yêu cầu đăng nhập, tên người đánh giá tự khai, chưa giới hạn rating trong 1–5) và 5 tuyến trợ lý, tìm kiếm AI cho phép người chưa đăng nhập gọi; (d) các truy vấn KPI của dashboard ghép tham số branch\_id và date vào chuỗi SQL; (e) tuyến /api/b2c/products chưa đặt trần cho tham số limit; (f) ở phía khách, tuyến huỷ đơn trả 403 thay vì 404 khi đơn thuộc khách khác, đăng ký chưa chuẩn hoá chữ thường cho email như đăng nhập Google, và một số tuyến dùng BigInt trực tiếp trên tham số đường dẫn nên giá trị không phải số có thể gây lỗi 500 thay vì 400.  
6. **Gợi ý trên trang chủ.** Nhánh bù sản phẩm bán chạy chưa lọc tồn kho; giao diện chưa truyền mã phiên nên nhánh gợi ý theo hành vi phiên chưa được dùng.  
7. **Lan truyền xoá.** Xoá lẻ một dòng hàng không lan tới kho do REPLICA IDENTITY DEFAULT; nghiệp vụ hiện chỉ huỷ đơn, không xoá.  
8. **Tiến hoá lược đồ.** Thêm cột ở nguồn chưa tự chảy tới Parquet.  
9. **Độ trễ cập nhật gợi ý.** Hai chu kỳ năm phút nối tiếp (dbt và huấn luyện) làm thay đổi phản ánh vào gợi ý sau khoảng 10–11 phút theo cấu hình.  
10. **Phụ thuộc dịch vụ ngoài.** Trợ lý, tìm theo ảnh và nhập giọng nói dùng API mô hình bên ngoài ở gói miễn phí; chuỗi dự phòng giảm nhưng không loại bỏ rủi ro hết hạn mức.  
11. **Nội dung chính sách của trợ lý.** Thời gian giao hàng, bảo hành, đổi trả và thông tin liên hệ trong câu trả lời viết sẵn là nội dung minh hoạ của đề tài, chưa gắn với quy trình vận hành hay dữ liệu thật; chỉ phần phương thức thanh toán (COD, chuyển khoản VietQR) là đúng với hệ thống.  
12. **Quy trình huấn luyện lại ý định.** Nhóm API /api/b2b gán nhãn câu và xuất dữ liệu, nhưng workflow huấn luyện còn thiếu một số tệp lệnh và mô hình huấn luyện ra chưa được nạp lại vào ai-bot; đây mới là khung quy trình, chưa phải vòng lặp huấn luyện hoàn chỉnh.

## **7.5. Hướng phát triển**

**Hoàn thiện đo đạc.** Chạy và lưu đầy đủ các thực nghiệm hiệu năng ở §6.6.6, kèm cấu hình máy, phiên bản, hạt giống dữ liệu và nhật ký gốc; đo độ trễ đầu-cuối ở các mức tải của đề cương thay cho lần nạp dồn duy nhất, và đo trực tiếp thời gian từ lúc đặt đơn tới khi gợi ý thay đổi.

**Tìm kiếm.** Thêm unaccent và chỉ mục trigram (pg\_trgm) ngay trong PostgreSQL; khi tìm kiếm thành trọng tâm thì cân nhắc một search engine nhận dữ liệu qua chính đường CDC sẵn có, xếp hạng BM25 (Robertson & Zaragoza, 2009).

**Gợi ý.** Thêm kênh "xem gần đây" và gợi ý theo phiên; bổ sung đường cơ sở và khoảng tin cậy cho đánh giá trên bộ dữ liệu demo 3 triệu đơn; đánh giá trực tuyến bằng A/B test khi có người dùng thật.

**Module AI mở rộng.** Dự báo nhu cầu theo sản phẩm và ngày, với seasonal naive làm đường cơ sở, so với Prophet (Taylor & Letham, 2018\) và LightGBM (Ke et al., 2017), đánh giá walk-forward bằng MAE, RMSE, WAPE. Tối ưu khuyến mãi theo phân khúc RFM; kết luận về hiệu quả voucher từ dữ liệu quan sát phải được trình bày như ước lượng có giả định, vì khách tự chọn dùng ưu đãi khác nhóm còn lại.

**Nền tảng dữ liệu.** Đưa tầng tinh chế lên định dạng bảng mở như Apache Iceberg hoặc Delta Lake (Armbrust et al., 2020); dùng Avro và Schema Registry cho tiến hoá lược đồ; điều phối bằng Airflow hoặc Dagster; giám sát bằng Prometheus và Grafana; triển khai cụm có nhân bản Kafka, MinIO, ClickHouse và diễn tập hỏng nút.

**Bảo mật.** Gắn middleware kiểm vai trò quản trị (requireAdmin) cho toàn bộ /api/b2b và 14 tuyến báo cáo (đồng thời sửa nút xuất hội thoại ở trang quản lý chatbot đang mở bằng window.open để gửi kèm header xác thực); yêu cầu đăng nhập khi gửi đánh giá và lấy tên người đánh giá từ hồ sơ; gỡ hoặc bảo vệ các tuyến gỡ lỗi (/api/b2c/behavior/stats, /api/products); giới hạn tần suất riêng cho 5 tuyến AI công khai; tham số hoá toàn bộ truy vấn ClickHouse; chuyển mật khẩu cơ sở dữ liệu trong docker-compose.yml sang biến môi trường và luân chuyển các khoá đã từng nằm trong mã nguồn.

## **7.6. Kết luận chung**

Đề tài cho thấy một ứng dụng thương mại điện tử có thể vận hành trên nền tảng dữ liệu theo hướng Lakehouse mà không đặt tải phân tích và AI lên cơ sở dữ liệu tác nghiệp, đồng thời vẫn chứng minh được dữ liệu ở kho khớp với nguồn. Chuỗi nghiệp vụ, CDC, lưu trữ thô, biến đổi, đối soát và phản hồi vào ứng dụng minh chứng tính liên thông của kiến trúc. Mức độ hoàn thiện về hiệu năng phải được xác nhận thêm bằng thực nghiệm; các kết luận của báo cáo chỉ khẳng định những gì đã có số đo.

# **Tài liệu tham khảo**

Abadi, D. J., Madden, S. R., & Hachem, N. (2008). Column-stores vs. row-stores: How different are they really? Proceedings of ACM SIGMOD '08, 967–980.

Anderson, A., Kumar, R., Tomkins, A., & Vassilvitskii, S. (2014). The dynamics of repeat consumption. Proceedings of WWW '14, 419–430.

Apache Software Foundation. (n.d.). Apache Kafka documentation: Design. https\://kafka.apache.org/documentation/\#design

Apache Parquet. (n.d.). File format. https\://parquet.apache.org/docs/file-format/

Armbrust, M., Das, T., Sun, L., et al. (2020). Delta Lake: High-performance ACID table storage over cloud object stores. Proceedings of the VLDB Endowment, 13(12), 3411–3424.

Armbrust, M., Ghodsi, A., Xin, R., & Zaharia, M. (2021). Lakehouse: A new generation of open platforms that unify data warehousing and advanced analytics. CIDR '21.

Burke, R. (2002). Hybrid recommender systems: Survey and experiments. User Modeling and User-Adapted Interaction, 12(4), 331–370.

Campos, P. G., Díez, F., & Cantador, I. (2014). Time-aware recommender systems: A comprehensive survey and analysis of existing evaluation protocols. User Modeling and User-Adapted Interaction, 24(1–2), 67–119.

Chaney, A. J. B., Stewart, B. M., & Engelhardt, B. E. (2018). How algorithmic confounding in recommendation systems increases homogeneity and decreases utility. Proceedings of RecSys '18, 224–232.

ClickHouse. (n.d.). ReplacingMergeTree. https\://clickhouse.com/docs/en/engines/table-engines/mergetree-family/replacingmergetree

Confluent. (n.d.). Amazon S3 Sink connector for Confluent Platform. https\://docs.confluent.io/kafka-connectors/s3-sink/current/overview.html

Conneau, A., Rinott, R., Lample, G., Williams, A., Bowman, S., Schwenk, H., & Stoyanov, V. (2018). XNLI: Evaluating cross-lingual sentence representations. Proceedings of EMNLP 2018, 2475–2485.

Cremonesi, P., Koren, Y., & Turrin, R. (2010). Performance of recommender algorithms on top-N recommendation tasks. Proceedings of RecSys '10, 39–46.

Dacrema, M. F., Cremonesi, P., & Jannach, D. (2019). Are we really making much progress? A worrying analysis of recent neural recommendation approaches. Proceedings of RecSys '19, 101–109.

dbt Labs. (n.d.). Add data tests to your DAG; Configure incremental models. https\://docs.getdbt.com/docs/build/data-tests

Debezium. (n.d.). Debezium connector for PostgreSQL. https\://debezium.io/documentation/reference/stable/connectors/postgresql.html

Ding, Y., & Li, X. (2005). Time weight collaborative filtering. Proceedings of CIKM '05, 485–492.

Efron, B., & Tibshirani, R. J. (1993). An introduction to the bootstrap. Chapman & Hall.

EMVCo. (n.d.). EMV QR code specifications. https\://www\.emvco.com/emv-technologies/qr-codes/

Gemini Team, Google. (2023). Gemini: A family of highly capable multimodal models. arXiv:2312.11805.

Grattafiori, A., et al. (2024). The Llama 3 herd of models. arXiv:2407.21783.

He, P., Gao, J., & Chen, W. (2021). DeBERTaV3: Improving DeBERTa using ELECTRA-style pre-training with gradient-disentangled embedding sharing. arXiv:2111.09543.

Hu, Y., Koren, Y., & Volinsky, C. (2008). Collaborative filtering for implicit feedback datasets. Proceedings of ICDM '08, 263–272.

Ie, E., Hsu, C., Mladenov, M., Jain, V., Narvekar, S., Wang, J., Wu, R., & Boutilier, C. (2019). RecSim: A configurable simulation platform for recommender systems. arXiv:1909.04847.

Järvelin, K., & Kekäläinen, J. (2002). Cumulated gain-based evaluation of IR techniques. ACM Transactions on Information Systems, 20(4), 422–446.

Ke, G., Meng, Q., Finley, T., Wang, T., Chen, W., Ma, W., Ye, Q., & Liu, T.-Y. (2017). LightGBM: A highly efficient gradient boosting decision tree. Advances in Neural Information Processing Systems 30\.

Kimball, R., & Ross, M. (2013). The data warehouse toolkit: The definitive guide to dimensional modeling (3rd ed.). Wiley.

Kleppmann, M. (2017). Designing data-intensive applications. O'Reilly Media.

Kreps, J., Narkhede, N., & Rao, J. (2011). Kafka: A distributed messaging system for log processing. Proceedings of NetDB '11.

Laurer, M., van Atteveldt, W., Casas, A., & Welbers, K. (2024). Less annotating, more classifying: Addressing the data scarcity issue of supervised machine learning with deep transfer learning and BERT-NLI. Political Analysis, 32(1), 84–100.

Lewis, P., Perez, E., Piktus, A., et al. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. Advances in Neural Information Processing Systems 33, 9459–9474.

Linden, G., Smith, B., & York, J. (2003). Amazon.com recommendations: Item-to-item collaborative filtering. IEEE Internet Computing, 7(1), 76–80.

Lops, P., de Gemmis, M., & Semeraro, G. (2011). Content-based recommender systems: State of the art and trends. In Recommender Systems Handbook (pp. 73–105). Springer.

Marlin, B. M., & Zemel, R. S. (2009). Collaborative prediction and ranking with non-random missing data. Proceedings of RecSys '09, 5–12.

MinIO. (2025). MinIO community edition (README, kho mã nguồn). https\://github.com/minio/minio

Nygard, M. T. (2018). Release it\! Design and deploy production-ready software (2nd ed.). Pragmatic Bookshelf.

OWASP Foundation. (2023). OWASP API Security Top 10 – 2023. https\://owasp.org/API-Security/editions/2023/en/0x00-header/

Pazzani, M. J., & Billsus, D. (2007). Content-based recommendation systems. In The Adaptive Web (LNCS 4321, pp. 325–341). Springer.

PostgreSQL Global Development Group. (n.d.). PostgreSQL 16 documentation: Logical decoding; Concurrency control; pg\_trgm; unaccent. https\://www\.postgresql.org/docs/16/

Prometheus. (n.d.). Metric types. https\://prometheus.io/docs/concepts/metric\_types/


Robertson, S., & Zaragoza, H. (2009). The probabilistic relevance framework: BM25 and beyond. Foundations and Trends in Information Retrieval, 3(4), 333–389.

Sarwar, B., Karypis, G., Konstan, J., & Riedl, J. (2001). Item-based collaborative filtering recommendation algorithms. Proceedings of WWW '01, 285–295.

Steck, H. (2019). Embarrassingly shallow autoencoders for sparse data. Proceedings of WWW '19, 3251–3257.

Taylor, S. J., & Letham, B. (2018). Forecasting at scale. The American Statistician, 72(1), 37–45.

Yin, W., Hay, J., & Roth, D. (2019). Benchmarking zero-shot text classification: Datasets, evaluation and entailment approach. Proceedings of EMNLP-IJCNLP 2019, 3914–3923.

# **Phụ lục A. Tài liệu API**

Phụ lục liệt kê đủ 91 endpoint của ba dịch vụ, trích trực tiếp từ mã nguồn (các tệp route của server, ai-bot và ai-rec) tại nhánh tích hợp sync/main-into-main-trieu (commit 8bc4b9d, 02/11/2026), là kết quả gộp 89 endpoint của nhánh main (f2522c7, 29/10/2026) với 2 endpoint bổ sung từ nhánh main-trieu là POST /api/b2c/auth/set-password (Bảng A.1) và POST /api/ai/transcribe (Bảng A.5).

* **Cổng vào:** trình duyệt chỉ gọi tới Nginx của client; Nginx chuyển các yêu cầu /api/ sang máy chủ Node.js (cổng 8080). Dịch vụ ai-bot (cổng 3001\) và ai-rec (cổng 8000\) chỉ mở trong mạng nội bộ Docker: máy chủ chuyển tiếp năm tuyến trợ lý, tìm kiếm và giọng nói sang ai-bot, và tự gọi ai-rec khi lấy gợi ý.  
* **Giới hạn tần suất:** mọi tuyến /api đi qua bộ giới hạn tần suất, trừ tuyến webhook thanh toán.  
* **Dữ liệu:** yêu cầu và phản hồi dạng JSON; mã định danh kiểu BigInt được trả về dạng số.  
* **ai-rec** có tài liệu OpenAPI tự sinh tại /docs, chỉ truy cập được trong mạng nội bộ.

Cột "Xác thực" dùng các giá trị sau:

* **Không:** không kiểm tra token. Ở nhóm /api/b2b, giá trị này phản ánh hiện trạng chưa gắn middleware xác thực, không có nghĩa là công khai theo thiết kế.  
* **Khách:** bắt buộc header Authorization: Bearer với JWT của khách; mã khách lấy từ token, không lấy từ tham số.  
* **Khách, tuỳ chọn:** có token hợp lệ thì cá nhân hoá theo khách, không có token vẫn trả kết quả.  
* **JWT:** bắt buộc một JWT hợp lệ do máy chủ ký; middleware chỉ kiểm chữ ký, không kiểm vai trò, nên token của khách cũng được chấp nhận.  
* **Quản trị:** bắt buộc JWT hợp lệ và từ chối token có vai trò khách.  
* **Chữ ký cổng:** cổng thanh toán ký yêu cầu; máy chủ xác thực chữ ký trước khi xử lý.

## **A.1. Xác thực và tài khoản**

*Bảng A.1. API xác thực và tài khoản*

| Phương thức | Đường dẫn | Xác thực | Chức năng |
| :---- | :---- | :---- | :---- |
| POST | /api/auth/login | Không | Đăng nhập quản trị (bảng User), trả JWT hạn 1 ngày |
| GET | /api/auth/me | JWT | Thông tin tài khoản quản trị đang đăng nhập |
| POST | /api/b2c/auth/register | Không | Khách đăng ký bằng email và mật khẩu, trả JWT hạn 7 ngày |
| POST | /api/b2c/auth/login | Không | Khách đăng nhập bằng email và mật khẩu |
| POST | /api/b2c/auth/social | Không | Khách đăng nhập bằng Google; máy chủ tự xác thực ID token và lấy email từ token |
| POST | /api/b2c/auth/set-password | Khách | Đặt hoặc đổi mật khẩu cho tài khoản đang đăng nhập (new\_password); thêm local vào danh sách nhà cung cấp đăng nhập của tài khoản |

## **A.2. Danh mục và sản phẩm**

*Bảng A.2. API danh mục và sản phẩm phía khách*

| Phương thức | Đường dẫn | Xác thực | Chức năng |
| :---- | :---- | :---- | :---- |
| GET | /api/b2c/categories | Không | Toàn bộ danh mục (đệm Redis 5 phút) |
| GET | /api/b2c/categories/active | Không | Danh mục gốc có ít nhất một sản phẩm, lọc theo branch\_id (thanh tab trang chủ) |
| GET | /api/b2c/brands | Không | Danh sách hãng còn hoạt động (đệm Redis) |
| GET | /api/b2c/products | Không | Danh sách sản phẩm; lọc category\_id, brand\_ids, search, branch\_id, min\_price, max\_price; sắp xếp sort; phân trang page, limit (chưa có trần cho limit) |
| GET | /api/b2c/products/:id | Không | Chi tiết một sản phẩm |
| GET | /api/b2c/flash-sales | Không | Chương trình flash sale đang diễn ra |
| GET | /api/b2c/similar/:productId | Không | Sản phẩm tương tự theo thông số |
| POST | /api/b2c/products/:id/reviews | Không | Gửi đánh giá sản phẩm (rating, comment; reviewer do người gọi tự khai). Không yêu cầu đăng nhập, chưa giới hạn rating trong khoảng 1–5; sau khi lưu, rating của sản phẩm được tính lại bằng trung bình các đánh giá |
| GET | /api/products | Không | Tuyến cũ: trả toàn bộ bảng sản phẩm, không phân trang |

## **A.3. Giỏ hàng, đặt hàng và thanh toán**

*Bảng A.3. API giỏ hàng, đặt hàng và thanh toán*

| Phương thức | Đường dẫn | Xác thực | Chức năng |
| :---- | :---- | :---- | :---- |
| POST | /api/b2c/cart/apply-voucher | Không | Xem trước mức giảm của một mã (code, cart\_total). cart\_total do client gửi nên kết quả chỉ để hiển thị; mức giảm thật được tính lại ở bước đặt hàng |
| POST | /api/b2c/checkout | Khách | Đặt hàng: tính lại giá ở máy chủ, giữ chỗ tồn kho, tạo mã đối soát và QR (§5.1.4) |
| GET | /api/b2c/orders/me | Khách | Lịch sử đơn của khách, kèm dòng hàng |
| GET | /api/b2c/orders/:id/payment-status | Khách | Trạng thái thanh toán cho màn hình chờ; trả 404 nếu đơn không thuộc khách |
| POST | /api/b2c/orders/:id/cancel | Khách | Khách tự huỷ đơn của mình; các dòng hàng được trả lại tồn kho. Trả 404 nếu mã đơn không tồn tại, 403 nếu đơn tồn tại nhưng thuộc khách khác |
| POST | /api/payment/webhook/:provider | Chữ ký cổng | Nhận thông báo giao dịch từ cổng thanh toán (SePay); xử lý idempotent |

## **A.4. Onboarding, hành vi và gợi ý**

*Bảng A.4. API onboarding, theo dõi hành vi và gợi ý*

| Phương thức | Đường dẫn | Xác thực | Chức năng |
| :---- | :---- | :---- | :---- |
| GET | /api/b2c/onboarding/options | Không | Danh mục phân cấp và danh sách hãng cho màn hình onboarding (đệm 24 giờ) |
| GET | /api/b2c/me/preferences | Khách | Đọc sở thích đã khai |
| PUT | /api/b2c/me/preferences | Khách | Lưu sở thích: danh mục, hãng thích và không quan tâm, tầm giá |
| POST | /api/b2c/me/preferences/skip | Khách | Bỏ qua onboarding mà không xoá sở thích đã khai |
| POST | /api/b2c/track | Khách, tuỳ chọn | Ghi một lô sự kiện hành vi (xem, giỏ hàng, yêu thích…) |
| GET | /api/b2c/recently-viewed | Khách, tuỳ chọn | Sản phẩm xem gần đây theo session\_id hoặc theo khách |
| GET | /api/b2c/trending | Không | Sản phẩm tăng nhanh theo hành vi trong số giờ gần nhất |
| POST | /api/b2c/wishlist | Khách | Thêm hoặc bỏ một sản phẩm khỏi danh sách yêu thích |
| GET | /api/b2c/wishlist | Khách | Danh sách yêu thích của khách |
| GET | /api/b2c/behavior/stats | Không | Thống kê sự kiện hành vi; tuyến gỡ lỗi chưa có xác thực, không phải API dành cho khách |
| GET | /api/b2c/recommendations | Khách, tuỳ chọn | Ô "Dành riêng cho bạn": khách đăng nhập nhận gợi ý từ AI-Rec, khách vãng lai nhận danh sách phổ biến |

## **A.5. Trợ lý và tìm kiếm**

Năm tuyến dưới đây do máy chủ chuyển tiếp nguyên vẹn sang ai-bot.

*Bảng A.5. API trợ lý và tìm kiếm*

| Phương thức | Đường dẫn | Xác thực | Chức năng |
| :---- | :---- | :---- | :---- |
| POST | /api/b2c/chat | Không | Trợ lý hội thoại: phân loại ý định, truy xuất sản phẩm, sinh câu trả lời (message, history) |
| POST | /api/ai/smart-search | Không | Tìm sản phẩm theo mô tả ngôn ngữ tự nhiên (query) |
| POST | /api/b2c/visual-search | Không | Tìm sản phẩm theo ảnh (imageBase64) |
| POST | /api/ai/smart-search-image | Không | Tìm kết hợp mô tả và ảnh (query, imageBase64) |
| POST | /api/ai/transcribe | Không | Chuyển giọng nói thành chữ (audioBase64, mimeType); trả { text }, text rỗng nghĩa là không nghe rõ; tối đa 90.000 ký tự base64 mỗi yêu cầu, 20 yêu cầu mỗi phút |

## **A.6. Quản trị: báo cáo và vận hành**

Phần lớn các tuyến này đọc kho ClickHouse (§5.1.7).

*Bảng A.6. API báo cáo và vận hành cho quản trị*

| Phương thức | Đường dẫn | Xác thực | Chức năng |
| :---- | :---- | :---- | :---- |
| GET | /api/dashboard/kpis | JWT | KPI trong ngày theo chi nhánh |
| GET | /api/analytics/revenue/by-hour | JWT | Doanh thu theo giờ trong một ngày |
| GET | /api/analytics/revenue/by-branch | JWT | Doanh thu theo chi nhánh trong khoảng ngày |
| GET | /api/analytics/revenue/by-category | JWT | Doanh thu theo danh mục trong khoảng ngày |
| GET | /api/analytics/revenue/trend | JWT | Xu hướng doanh thu theo ngày (mặc định 30 ngày) |
| GET | /api/reconciliation/status | JWT | Trạng thái đối soát theo chi nhánh, có lọc và phân trang |
| GET | /api/analytics/orders | Không | Thử phân trang theo con trỏ (cursor, limit) trên dữ liệu giả sinh tại chỗ; không đọc cơ sở dữ liệu |
| GET | /api/alerts/active | JWT | Cảnh báo đang mở |
| GET | /api/alerts/history | JWT | Lịch sử cảnh báo |
| GET | /api/supply-chain/fulfillment | JWT | Tình hình giao nhận theo chi nhánh |
| GET | /api/supply-chain/sla-summary | JWT | Tổng hợp mức đáp ứng SLA giao nhận |
| GET | /api/financial/summary | JWT | Tổng hợp tài chính theo khoảng ngày |
| GET | /api/financial/vouchers | JWT | Thống kê sử dụng voucher |
| POST | /api/admin/simulate-sale | JWT | Mô phỏng nhập tay một giao dịch bán (chi nhánh, danh mục, số tiền) |

## **A.7. Quản trị: danh mục, khuyến mãi, đánh giá và khách hàng**

*Bảng A.7. API quản trị dữ liệu bán hàng*

| Phương thức | Đường dẫn | Xác thực | Chức năng |
| :---- | :---- | :---- | :---- |
| GET | /api/b2b/reviews | Không | Toàn bộ đánh giá |
| POST | /api/b2b/reviews/:id/reply | Không | Trả lời một đánh giá |
| GET | /api/b2b/branches | Không | Danh sách chi nhánh |
| POST | /api/b2b/branches | Không | Thêm chi nhánh |
| PUT | /api/b2b/branches/:id | Không | Sửa chi nhánh |
| DELETE | /api/b2b/branches/:id | Không | Xoá mềm chi nhánh |
| GET | /api/b2b/brands | Không | Danh sách hãng |
| POST | /api/b2b/brands | Không | Thêm hãng |
| PUT | /api/b2b/brands/:id | Không | Sửa hãng |
| DELETE | /api/b2b/brands/:id | Không | Xoá mềm hãng |
| GET | /api/b2b/products | Không | Sản phẩm cho trang quản trị: phân trang (tối đa 100 dòng), tìm theo tên, hoặc tra theo danh sách ids |
| POST | /api/b2b/products | Không | Thêm sản phẩm |
| PUT | /api/b2b/products/:id | Không | Sửa sản phẩm |
| DELETE | /api/b2b/products/:id | Không | Xoá mềm sản phẩm |
| GET | /api/b2b/flash-sales | Không | Danh sách flash sale |
| POST | /api/b2b/flash-sales | Không | Tạo flash sale theo sản phẩm hoặc danh mục |
| PUT | /api/b2b/flash-sales/:id | Không | Sửa flash sale |
| DELETE | /api/b2b/flash-sales/:id | Không | Xoá mềm flash sale |
| GET | /api/b2b/customers | Không | Danh sách khách hàng |

## **A.8. Quản trị: thanh toán và giao nhận**

*Bảng A.8. API quản trị thanh toán và giao nhận*

| Phương thức | Đường dẫn | Xác thực | Chức năng |
| :---- | :---- | :---- | :---- |
| GET | /api/b2b/payments/queue | Quản trị | Hàng đợi đối soát: giao dịch cần người xử lý (mặc định REFUND\_REQUIRED, UNMATCHED, DUPLICATE) |
| POST | /api/b2b/payments/:id/refund | Quản trị | Ghi nhận đã hoàn tiền cho khách (số tiền, mã giao dịch hoàn, ghi chú) |
| POST | /api/b2b/orders/:id/delivered | Quản trị | Đánh dấu đơn đã giao; lúc này mới cộng điểm thưởng |

## **A.9. Quản trị: trợ lý AI**

*Bảng A.9. API quản trị dữ liệu hội thoại của trợ lý*

| Phương thức | Đường dẫn | Xác thực | Chức năng |
| :---- | :---- | :---- | :---- |
| GET | /api/b2b/chat-logs | Không | Nhật ký hội thoại, phân trang, lọc theo ý định, câu chưa nhận diện hoặc chưa gán nhãn |
| GET | /api/b2b/chat-logs/stats | Không | Thống kê tổng quan về trợ lý |
| PUT | /api/b2b/chat-logs/:id/annotate | Không | Gán lại ý định đúng cho một câu bị phân loại sai |
| POST | /api/b2b/trigger-ai-train | Không | Xuất các câu đã gán nhãn (cần tối thiểu 10 câu) và, khi có cấu hình GitHub Actions, kích hoạt workflow huấn luyện; mô hình huấn luyện ra chưa được nạp lại vào ai-bot |
| GET | /api/b2b/chat-logs/export | Không | Xuất dữ liệu đã gán nhãn dạng JSON |

## **A.10. Quản trị: phân tích hành vi**

Các tuyến đều là GET dưới tiền tố /api/b2b/analytics/behavior, nhận tham số days.

*Bảng A.10. API phân tích hành vi*

| Phương thức | Đường dẫn | Xác thực | Chức năng |
| :---- | :---- | :---- | :---- |
| GET | …/overview | Không | KPI hành vi tổng quan so với kỳ trước |
| GET | …/funnel | Không | Phễu xem sản phẩm → thêm giỏ → mua, đếm theo sự kiện và theo phiên |
| GET | …/top-products | Không | Sản phẩm dẫn đầu theo lượt xem hoặc thêm giỏ |
| GET | …/search | Không | Từ khoá tìm nhiều nhất và tìm không có kết quả |
| GET | …/devices | Không | Phân bố loại thiết bị |
| GET | …/hourly | Không | Số sự kiện theo giờ |
| GET | …/referrers | Không | Nguồn truy cập |
| GET | …/daily-trend | Không | Số sự kiện theo ngày |
| GET | …/ai-performance | Không | Hiệu quả ô gợi ý: lượt hiển thị, lượt nhấp |

## **A.11. Kiểm tra sức khoẻ và dịch vụ nội bộ**

*Bảng A.11. API kiểm tra sức khoẻ và dịch vụ nội bộ*

| Dịch vụ | Phương thức và đường dẫn | Xác thực | Chức năng |
| :---- | :---- | :---- | :---- |
| server | GET /api/health | Không | Trạng thái máy chủ và kết nối ClickHouse |
| ai-bot | GET /api/health | Không | Trạng thái dịch vụ trợ lý, các tính năng đang bật và trạng thái từng nhà cung cấp mô hình ngôn ngữ (llm\_providers) |
| ai-rec | GET /health | Không (mạng nội bộ) | Trạng thái dịch vụ và tóm tắt mô hình đang phục vụ |
| ai-rec | GET /api/v1/recommend/customer/{customer\_id}?top\_k= | Không (mạng nội bộ) | Gợi ý top-K cho một khách; máy chủ gọi tuyến này với mã khách lấy từ token |

## **A.12. Ví dụ yêu cầu và phản hồi**

Mục này minh hoạ 15 endpoint thuộc các luồng chính của hệ thống. Cấu trúc yêu cầu, tên trường, mã trạng thái và thông báo lỗi được dựng từ mã nguồn tại commit 8bc4b9d của nhánh tích hợp. Các giá trị cụ thể (mã đơn, tên sản phẩm, số tiền, token) là giá trị minh hoạ, không phải dữ liệu chụp từ hệ thống đang chạy. Dòng "…" trong JSON đánh dấu phần đã lược bớt.

Quy ước dùng trong các lệnh:

* **BASE=http\://localhost:3000** — Nginx của client khi chạy bằng docker compose; mọi yêu cầu /api/ được chuyển tiếp tới máy chủ Node.js.  
* **\$TOKEN** là JWT của khách, lấy ở A.12.1; **\$ADMIN\_TOKEN** là JWT quản trị, lấy ở A.12.2.  
* Số tiền tính bằng đồng, kiểu số nguyên. Thời điểm theo chuẩn ISO 8601, múi giờ UTC.

### **A.12.1. Khách đăng nhập**

POST /api/b2c/auth/login, không cần xác thực. Token trả về mang vai trò customer, hạn 7 ngày. Trường password\_hash bị loại khỏi phản hồi.

**Yêu cầu:**

curl \-X POST "\$BASE/api/b2c/auth/login" \\

  \-H "Content-Type: application/json" \\

  \-d '{"email":"khach@example.com","password":"\*\*\*\*\*\*\*\*"}'

**Phản hồi 200:**

{

  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…",

  "user": {

    "id": 1024,

    "full\_name": "Nguyễn Văn An",

    "email": "khach@example.com",

    "phone": "09xxxxxxxx",

    "loyalty\_points": 120,

    "avatar": null,

    "provider": "local",

    "has\_password": true,

    "created\_at": "2026-09-14T03:12:45.000Z"

  }

}

**Lỗi thường gặp:** 401 {"error":"Email hoặc mật khẩu không chính xác"}; 400 khi tài khoản chưa có mật khẩu (đăng ký qua Google), kèm thông báo hướng dẫn đăng nhập bằng nhà cung cấp tương ứng qua /api/b2c/auth/social hoặc đặt mật khẩu bằng /api/b2c/auth/set-password sau khi đăng nhập.

### **A.12.2. Quản trị đăng nhập**

POST /api/auth/login, không cần xác thực. Máy chủ tra bảng User; token mang vai trò của tài khoản (mặc định admin), hạn 1 ngày.

**Yêu cầu:**

curl \-X POST "\$BASE/api/auth/login" \\

  \-H "Content-Type: application/json" \\

  \-d '{"email":"admin@example.com","password":"\*\*\*\*\*\*\*\*"}'

**Phản hồi 200:**

{

  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…",

  "user": { "id": 1, "full\_name": "Quản trị viên", "email": "admin@example.com", "role": "admin" }

}

**Lỗi thường gặp:** 401 {"error":"Invalid credentials"}.

### **A.12.3. Danh sách sản phẩm**

GET /api/b2c/products, công khai. Tham số: category\_id (tự mở rộng sang danh mục con), brand\_ids (nhiều hãng cách nhau dấu phẩy), search (mọi từ phải xuất hiện trong tên), branch\_id, min\_price, max\_price, sort (price\_asc, price\_desc, newest, và ba tên đồng nghĩa cho bán chạy là best\_selling, bestseller, sold\_desc; giá trị lạ được xem như newest), page (mặc định 1), limit (mặc định 12, chưa đặt trần). Sản phẩm đang flash sale có price là giá khuyến mãi và original\_price là giá trước khuyến mãi. branch\_ids rỗng nghĩa là sản phẩm bán ở mọi chi nhánh.

**Yêu cầu:**

curl "\$BASE/api/b2c/products?category\_id=cat-phone\&brand\_ids=br-apple\&sort=price\_desc\&page=1\&limit=2"

**Phản hồi 200:**

{

  "data": \[

    {

      "id": 51234,

      "name": "iPhone 16 Pro Max 256GB",

      "price": 30990000,

      "original\_price": 34990000,

      "image": "https\://…/iphone-16-pro-max.jpg",

      "stock": 42,

      "rating": 4.8,

      "sold": 1350,

      "category\_id": "cat-phone",

      "brand\_id": "br-apple",

      "branch\_ids": \[\],

      "is\_banner": false,

      "created\_at": "2026-08-02T08:00:00.000Z"

    },

    …

  \],

  "total": 87,

  "totalAll": 600000,

  "page": 1,

  "limit": 2,

  "totalPages": 44

}

### **A.12.4. Chi tiết sản phẩm**

GET /api/b2c/products/:id, công khai. Trả toàn bộ bản ghi sản phẩm kèm ảnh, thông số, biến thể và đánh giá.

**Yêu cầu:**

curl "\$BASE/api/b2c/products/51234"

**Phản hồi 200:**

{

  "id": 51234,

  "name": "iPhone 16 Pro Max 256GB",

  "price": 30990000,

  "original\_price": 34990000,

  "category\_id": "cat-phone",

  "brand\_id": "br-apple",

  "stock": 42,

  "images": \["https\://…/1.jpg", "https\://…/2.jpg"\],

  "specs": { "screen": "6.9 inch", "chip": "A18 Pro", "ram": "8GB" },

  "variants": \[

    { "id": "v1", "storage": "256GB", "color": "Titan Sa Mạc", "price": 30990000 },

    { "id": "v2", "storage": "512GB", "color": "Titan Sa Mạc", "price": 36990000 }

  \],

  "reviews": \[

    { "id": "rv-1", "product\_id": 51234, "reviewer": "Minh", "rating": 5,

      "comment": "Máy đẹp, giao nhanh", "date": "2026-10-02T10:20:00.000Z",

      "reply": null, "reply\_date": null }

  \],

  …

}

**Lỗi thường gặp:** 404 {"error":"Product not found"}.

### **A.12.5. Đặt hàng**

POST /api/b2c/checkout, bắt buộc token khách; mã khách lấy từ token. Máy chủ chỉ tin mã sản phẩm, số lượng, biến thể và tỉnh nhận hàng: giá, phí vận chuyển và giảm giá đều được tính lại từ cơ sở dữ liệu (§5.1.4). Các trường subTotal, shippingFee, discount, total do client gửi chỉ dùng để đối chiếu; lệch thì máy chủ ghi log và trả thêm trường price\_mismatch, không chặn đơn. Phí vận chuyển là 20.000 đ cho HCM và HN, 40.000 đ cho nơi khác. payment\_method nhận COD hoặc BANK\_TRANSFER.

**Yêu cầu:**

curl \-X POST "\$BASE/api/b2c/checkout" \\

  \-H "Authorization: Bearer \$TOKEN" \\

  \-H "Content-Type: application/json" \\

  \-d '{

    "items": \[{ "id": 51234, "quantity": 1, "variant\_id": "v1", "branch\_id": "HCM001" }\],

    "customer\_info": { "full\_name": "Nguyễn Văn An", "phone": "09xxxxxxxx",

                       "address": "…", "email": "khach@example.com", "province": "HCM" },

    "payment\_method": "BANK\_TRANSFER",

    "voucher": null,

    "pointsUsed": 0,

    "total": 31010000

  }'

**Phản hồi 200 (chuyển khoản):**

{

  "success": true,

  "order\_id": "ORD-1793239200000",

  "status": "PENDING\_PAYMENT",

  "payment\_method": "BANK\_TRANSFER",

  "payment\_status": "PENDING",

  "payment\_ref": "GS7K2M9QXAQ",

  "display\_ttl\_seconds": 300,

  "expires\_at": "2026-10-29T02:08:00.000Z",

  "pricing": {

    "subTotal": 30990000, "shippingFee": 20000,

    "voucherDiscount": 0, "pointsUsed": 0, "pointsDiscount": 0,

    "discount": 0, "total": 31010000, "pointsEarned": 310

  },

  "qr": {

    "payload": "000201010212…",

    "data\_url": "data:image/png;base64,iVBORw0KGgo…",

    "bank\_bin": "970415",

    "bank\_name": "VietinBank",

    "account\_no": "10xxxxxxxx",

    "account\_name": "GETSHOPY DEMO",

    "amount": 31010000,

    "content": "TT GS7K2M9QXAQ",

    "payment\_ref": "GS7K2M9QXAQ"

  }

}

Với đơn COD, status là CONFIRMED, payment\_status là UNPAID, còn payment\_ref, expires\_at, display\_ttl\_seconds và qr đều là null; tồn kho bị trừ ngay. Nội dung chuyển khoản dùng tiền tố cấu hình PAYMENT\_CONTENT\_PREFIX (VietinBank qua SePay yêu cầu tiền tố SEVQR); để trống thì nội dung là "TT \<mã đối soát\>". pointsEarned chỉ là số điểm dự kiến: điểm được cộng khi đơn giao thành công.

**Lỗi thường gặp:** 401 {"error":"Vui lòng đăng nhập để tiếp tục"}. 400 kèm trường code: OUT\_OF\_STOCK, NO\_PROVINCE, EMPTY\_CART, PRODUCT\_NOT\_FOUND, VARIANT\_NOT\_FOUND, BAD\_QUANTITY, các mã VOUCHER\_\*, và TOO\_MANY\_PENDING\_ORDERS (mặc định mỗi khách tối đa 3 đơn chờ thanh toán). Ví dụ:

{ "error": "Bạn đang có 3 đơn chờ thanh toán. Vui lòng hoàn tất hoặc huỷ bớt trước khi đặt thêm.",

  "code": "TOO\_MANY\_PENDING\_ORDERS" }

### **A.12.6. Màn chờ thanh toán**

GET /api/b2c/orders/:id/payment-status, bắt buộc token khách. Client gọi lặp lại endpoint này trong lúc hiện mã QR.

**Yêu cầu:**

curl "\$BASE/api/b2c/orders/ORD-1793239200000/payment-status" \\

  \-H "Authorization: Bearer \$TOKEN"

**Phản hồi 200 (60 giây sau khi đặt):**

{

  "order\_id": "ORD-1793239200000",

  "status": "PENDING\_PAYMENT",

  "payment\_status": "PENDING",

  "paid\_at": null,

  "total": 31010000,

  "seconds\_remaining": 420,

  "display\_seconds\_remaining": 240

}

seconds\_remaining là thời gian giữ hàng còn lại (mặc định 480 giây); display\_seconds\_remaining là đồng hồ hiển thị cho khách (mặc định 300 giây), tính ở máy chủ. Sau khi webhook ghi nhận đủ tiền, status chuyển thành CONFIRMED, payment\_status thành PAID và paid\_at có giá trị.

**Lỗi thường gặp:** đơn không tồn tại và đơn của khách khác đều trả 404 {"error":"Không tìm thấy đơn hàng"}, để không lộ việc một mã đơn có tồn tại hay không. Tuyến huỷ đơn POST /api/b2c/orders/:id/cancel không dùng cùng quy tắc che giấu này: khi đơn tồn tại nhưng không thuộc khách gọi, tuyến trả 403 kèm thông báo "Đơn hàng này không thuộc về bạn", còn khi không có đơn trả 404.

### **A.12.7. Webhook SePay**

POST /api/payment/webhook/sepay, do SePay gọi; tuyến này không đi qua bộ giới hạn tần suất. Máy chủ hỗ trợ hai cách xác thực. Cách thứ nhất là HMAC-SHA256, được ưu tiên khi có SEPAY\_WEBHOOK\_HMAC\_SECRET: header X-SePay-Signature mang "sha256=\<hex\>", header X-SePay-Timestamp mang thời điểm gửi, chuỗi được ký là "\<timestamp\>.\<thân yêu cầu thô\>", và yêu cầu lệch quá 300 giây bị từ chối. Cách thứ hai là API key trong header Authorization, có thể kèm danh sách IP được phép. Ví dụ dưới dùng API key; các trường payload theo tài liệu webhook của SePay (docs.sepay.vn/lap-trinh-webhooks.html).

**Yêu cầu:**

curl \-X POST "\$BASE/api/payment/webhook/sepay" \\

  \-H "Authorization: Apikey \$SEPAY\_WEBHOOK\_API\_KEY" \\

  \-H "Content-Type: application/json" \\

  \-d '{

    "id": 92704,

    "gateway": "VietinBank",

    "transactionDate": "2026-10-29 09:03:12",

    "accountNumber": "10xxxxxxxx",

    "subAccount": null,

    "code": null,

    "content": "TT GS7K2M9QXAQ",

    "transferType": "in",

    "transferAmount": 31010000,

    "accumulated": 31010000,

    "referenceCode": "FT26302xxxxxxx",

    "description": "TT GS7K2M9QXAQ"

  }'

**Phản hồi 200:**

{ "success": true }

Máy chủ trả 200 cho mọi giao dịch đã ghi nhận, kể cả giao dịch không gán được vào đơn (UNMATCHED) hoặc cần hoàn tiền (REFUND\_REQUIRED); các giao dịch này vào hàng đợi ở A.12.15. Giao dịch có id đã nhận trước đó không bị xử lý lại.

**Lỗi thường gặp:** 401 {"success":false,"message":"Xác thực thất bại"}; 400 khi payload không đọc được hoặc thiếu mã giao dịch; 500 khi lỗi cơ sở dữ liệu, để SePay gửi lại.

### **A.12.8. Lưu sở thích onboarding**

PUT /api/b2c/me/preferences, bắt buộc token khách. Mỗi mảng tối đa 100 mã; price\_band nhận lt5, 5to15, 15to30, gt30 hoặc null. Máy chủ kiểm từng mã danh mục và hãng có tồn tại, và từ chối một mục vừa được thích vừa bị đánh dấu không quan tâm.

**Yêu cầu:**

curl \-X PUT "\$BASE/api/b2c/me/preferences" \\

  \-H "Authorization: Bearer \$TOKEN" \\

  \-H "Content-Type: application/json" \\

  \-d '{"liked\_categories":\["cat-phone","cat-watch"\],"liked\_brands":\["br-apple"\],

       "disliked\_categories":\["cat-camera"\],"disliked\_brands":\[\],"price\_band":"15to30"}'

**Phản hồi 200:**

{

  "customer\_id": 1024,

  "status": "completed",

  "liked\_categories": \["cat-phone", "cat-watch"\],

  "liked\_brands": \["br-apple"\],

  "disliked\_categories": \["cat-camera"\],

  "disliked\_brands": \[\],

  "price\_band": "15to30",

  "created\_at": "2026-10-29T01:55:10.000Z",

  "updated\_at": "2026-10-29T01:55:10.000Z"

}

**Lỗi thường gặp:** 400 với một trong các thông báo "Một mục không thể vừa quan tâm vừa không quan tâm", "Tầm giá không hợp lệ", hoặc {"error":"Có danh mục hoặc hãng không tồn tại","invalid":\["cat-xyz"\]}.

### **A.12.9. Ghi sự kiện hành vi**

POST /api/b2c/track, token tuỳ chọn: có token thì customer\_id lấy từ token, không có thì sự kiện chỉ gắn với session\_id. Mỗi yêu cầu nhận tối đa 20 sự kiện; sự kiện có event\_type ngoài danh sách bị loại và tính vào rejected. Danh sách event\_type gồm product\_view, category\_view, search\_query, add\_to\_cart, remove\_from\_cart, add\_to\_wishlist, compare\_view, review\_submit, purchase, checkout\_abandon, rec\_impression, rec\_click và identify. Thời điểm sự kiện lấy theo giờ máy chủ, không nhận từ client. Sự kiện được gom đệm (đủ 50 sự kiện hoặc sau 5 giây) rồi ghi vào bảng analytics.user\_events trên ClickHouse.

**Yêu cầu:**

curl \-X POST "\$BASE/api/b2c/track" \\

  \-H "Authorization: Bearer \$TOKEN" \\

  \-H "Content-Type: application/json" \\

  \-d '{"events":\[

        {"event\_type":"product\_view","session\_id":"s\_8f3a…","product\_id":51234,

         "category\_id":"cat-phone","brand\_id":"br-apple","price\_at\_event":30990000,

         "dwell\_time\_ms":45000,"device\_type":"mobile","referrer":"recommendation",

         "page\_source":"detail"},

        {"event\_type":"add\_to\_cart","session\_id":"s\_8f3a…","product\_id":51234,

         "quantity":1,"page\_source":"detail"}

      \]}'

**Phản hồi 200:**

{ "success": true, "accepted": 2, "rejected": 0 }

**Lỗi thường gặp:** 400 {"error":"events array is required"}.

### **A.12.10. Gợi ý "Dành riêng cho bạn"**

GET /api/b2c/recommendations, token tuỳ chọn; trả tối đa 8 sản phẩm. Với khách có token, máy chủ gọi AI-Rec (A.12.11) trước. Nếu chưa đủ 8 món, máy chủ bù lần lượt bằng sản phẩm cùng danh mục hoặc hãng (khi có tham số categoryId, brandId), sản phẩm bán chạy, rồi sản phẩm mới nhất. Khách vãng lai chỉ nhận phần bù. Nếu yêu cầu có tham số sessionId, máy chủ chạy chiến lược theo hành vi trước (xem gần đây, đồng xuất hiện, hồ sơ sở thích, xu hướng); giao diện hiện tại không gửi tham số này.

**Yêu cầu:**

curl "\$BASE/api/b2c/recommendations" \-H "Authorization: Bearer \$TOKEN"

**Phản hồi 200:**

\[

  {

    "id": 49870,

    "name": "Samsung Galaxy S24 Ultra 256GB",

    "price": 25990000,

    "original\_price": 33990000,

    "image": "https\://…/s24-ultra.jpg",

    "rating": 4.7,

    "sold": 980,

    "category\_id": "cat-phone",

    "brand\_id": "br-samsung",

    "specs": { "screen": "6.8 inch", "chip": "Snapdragon 8 Gen 3", "ram": "12GB" }

  },

  …

\]

Phản hồi không cho biết món nào đến từ AI-Rec và món nào từ phần bù: máy chủ chỉ giữ product\_id và bỏ trường reason mà AI-Rec trả về.

### **A.12.11. AI-Rec (gọi nội bộ)**

GET /api/v1/recommend/customer/{customer\_id}?top\_k=, chỉ truy cập được trong mạng Docker nên lệnh dưới phải chạy từ một container cùng mạng. Máy chủ Node.js gọi endpoint này với thời gian chờ 3 giây; quá thời gian hoặc lỗi thì dùng phần bù. top\_k nhận giá trị từ 1 đến 50\.

**Yêu cầu:**

curl "http\://ai-rec:8000/api/v1/recommend/customer/1024?top\_k=4"

**Phản hồi 200:**

{

  "customer\_id": "1024",

  "recommendations": \[

    { "product\_id": "49870", "reason": "cf" },

    { "product\_id": "50177", "reason": "content" },

    { "product\_id": "50031", "reason": "repeat" },

    { "product\_id": "47210", "reason": "popular" }

  \]

}

reason là kênh đóng góp nhiều nhất vào điểm của món: cf là lọc cộng tác theo sản phẩm; content là đặc trưng danh mục, hãng, tầm giá; repeat là mua lại; popular là sản phẩm phổ biến, dùng cho khách chưa có tín hiệu.

**Lỗi thường gặp:** 422 khi top\_k ngoài khoảng cho phép (FastAPI tự kiểm tham số); 500 kèm detail khi mô hình lỗi.

### **A.12.12. Trợ lý hội thoại**

POST /api/b2c/chat, công khai. Máy chủ chỉ chuyển tiếp Content-Type và thân yêu cầu (không chuyển tiếp header Authorization) sang ai-bot với thời gian chờ tối đa 30 giây; bản thân ai-bot có ngưỡng cắt nội bộ 25 giây. history là các lượt trước dạng {sender, text}; chỉ 6 lượt gần nhất được đưa vào mô hình ngôn ngữ. Phản hồi gồm câu trả lời, đường dẫn trên web, tối đa 4 sản phẩm và đối tượng budget (khi câu hỏi có nêu mức giá).

**Yêu cầu:**

curl \-X POST "\$BASE/api/b2c/chat" \\

  \-H "Content-Type: application/json" \\

  \-d '{"message":"Có iPhone nào tầm 30 triệu không?",

       "history":\[{"sender":"user","text":"Chào shop"},

                  {"sender":"bot","text":"Dạ Getshopy xin chào ạ\! …"}\]}'

**Phản hồi 200:**

{

  "text": "Dạ trong tầm 30 triệu bên em có iPhone 16 Pro Max 256GB, đang giảm còn 30.990.000đ …",

  "link": "/product/51234",

  "products": \[

    { "id": 51234, "name": "iPhone 16 Pro Max 256GB", "price": 30990000,

      "original\_price": 34990000, "image": "https\://…/1.jpg", "rating": 4.8,

      "category\_id": "cat-phone", "brand\_id": "br-apple", "category": "Điện thoại",

      "specs": { "screen": "6.9 inch", "chip": "A18 Pro", "ram": "8GB" } }

  \],

  "budget": { "status": "ok", "description": "tầm 30.000.000đ" }

}

Khi mô hình ngôn ngữ lỗi, ai-bot vẫn trả 200 với câu trả lời dựng sẵn theo ý định đã phân loại.

**Lỗi thường gặp:** 400 {"error":"Message is required"}; 502 khi ai-bot không phản hồi: {"error":"AI Bot service unavailable","text":"Dạ hệ thống AI đang bảo trì, …"}; 504 {"error":"AI timeout"} khi quá 30 giây.

### **A.12.13. Tìm kiếm bằng mô tả**

POST /api/ai/smart-search, công khai; máy chủ chuyển yêu cầu sang ai-bot. Mô hình ngôn ngữ tách từ khoá, hãng, danh mục và khoảng giá từ câu mô tả; nếu không gọi được mô hình, ai-bot tách từ khoá bằng luật.

**Yêu cầu:**

curl \-X POST "\$BASE/api/ai/smart-search" \\

  \-H "Content-Type: application/json" \\

  \-d '{"query":"laptop gaming dưới 30 triệu"}'

**Phản hồi 200:**

{

  "products": \[

    { "id": 50412, "name": "…", "price": 28490000, "original\_price": 31990000,

      "image": "https\://…", "rating": 4.6, "sold": 210, "category": "Laptop",

      "specs": { … } },

    …

  \],

  "hint": "Laptop gaming dưới 30 triệu",

  "keywords": \["gaming"\],

  "budget": { "status": "ok", "description": "dưới 30.000.000đ" }

}

**Lỗi thường gặp:** 400 {"error":"query is required"}.

### **A.12.14. Báo cáo xu hướng doanh thu**

GET /api/analytics/revenue/trend, bắt buộc JWT. Endpoint đọc view analytics.sale\_orders (ánh xạ từ warehouse.fact\_orders\_detail) trên ClickHouse, lọc các dòng có status \= 'CONFIRMED', và đệm kết quả trong Redis 300 giây. Tham số: days (mặc định 30\) và branch\_id (mặc định mọi chi nhánh).

**Yêu cầu:**

curl "\$BASE/api/analytics/revenue/trend?days=7\&branch\_id=HCM001" \\

  \-H "Authorization: Bearer \$ADMIN\_TOKEN"

**Phản hồi 200:**

\[

  { "date": "2026-10-22", "revenue": 1520400000, "orders": 412 },

  { "date": "2026-10-23", "revenue": 1387950000, "orders": 389 },

  …

  { "date": "2026-10-29", "revenue": 642300000, "orders": 171 }

\]

Tuyến này dùng authMiddleware nên chỉ kiểm chữ ký JWT: token của khách cũng được chấp nhận (§7.4).

**Lỗi thường gặp:** 401 {"error":"No token"} hoặc {"error":"Invalid token"}. 500 với thông báo "Hệ thống dữ liệu đang quá tải, vui lòng xem dữ liệu cũ (cached) hoặc thử lại sau." khi bộ ngắt mạch ClickHouse đang mở (ngưỡng 50% lỗi, mỗi truy vấn chờ tối đa 5 giây).

### **A.12.15. Hàng đợi đối soát thanh toán**

GET /api/b2b/payments/queue, bắt buộc token quản trị: requireAdmin từ chối token có vai trò customer. Mặc định trả các giao dịch REFUND\_REQUIRED, UNMATCHED và DUPLICATE, mới nhất trước. Tham số status lọc theo danh sách khác (cách nhau dấu phẩy); limit mặc định 50, tối đa 200\. Bản ghi dưới đây minh hoạ trường hợp khách chuyển thiếu tiền so với đơn.

**Yêu cầu:**

curl "\$BASE/api/b2b/payments/queue?limit=20" \-H "Authorization: Bearer \$ADMIN\_TOKEN"

**Phản hồi 200:**

\[

  {

    "id": 318,

    "order\_id": "ORD-1793152800000",

    "provider": "sepay",

    "provider\_txn\_id": "92611",

    "amount": 15990000,

    "bank\_account": "10xxxxxxxx",

    "content": "TT GS4NB82TZ18",

    "content\_norm": "TTGS4NB82TZ18",

    "match\_status": "REFUND\_REQUIRED",

    "received\_at": "2026-10-28T02:14:51.000Z",

    "refunded\_at": null,

    "refunded\_amount": null,

    "refund\_ref": null

  },

  …

\]

**Lỗi thường gặp:** 401 {"error":"Chưa đăng nhập"}; 403 {"error":"Cần quyền quản trị"} khi gọi bằng token khách.

## **A.13. Tổng hợp rà soát xác thực**

Mục này tổng hợp kết quả rà soát tĩnh cơ chế xác thực trên mã nguồn. Cột "Ghi chú" nêu rõ tuyến nào là có chủ ý và tuyến nào là khoảng trống cần hoàn thiện (§6.6.7, §7.4).

*Bảng A.12. Tuyến quản trị chỉ kiểm chữ ký JWT (14 tuyến)*

| Phương thức | Đường dẫn | Hiện trạng | Ghi chú |
| :---- | :---- | :---- | :---- |
| GET | /api/auth/me | JWT, không kiểm vai trò | Truy vấn bảng User bằng id trong token; token khách có thể trùng id với một quản trị viên vì hai không gian id khác nhau (User.id và B2CCustomer.id) |
| GET | /api/dashboard/kpis | JWT, không kiểm vai trò | |
| GET | /api/analytics/revenue/by-hour | JWT, không kiểm vai trò | |
| GET | /api/analytics/revenue/by-branch | JWT, không kiểm vai trò | |
| GET | /api/analytics/revenue/by-category | JWT, không kiểm vai trò | |
| GET | /api/analytics/revenue/trend | JWT, không kiểm vai trò | |
| GET | /api/reconciliation/status | JWT, không kiểm vai trò | |
| GET | /api/alerts/active | JWT, không kiểm vai trò | |
| GET | /api/alerts/history | JWT, không kiểm vai trò | |
| GET | /api/supply-chain/fulfillment | JWT, không kiểm vai trò | |
| GET | /api/supply-chain/sla-summary | JWT, không kiểm vai trò | |
| GET | /api/financial/summary | JWT, không kiểm vai trò | |
| GET | /api/financial/vouchers | JWT, không kiểm vai trò | |
| POST | /api/admin/simulate-sale | JWT, không kiểm vai trò | Ghi vào ClickHouse; xem §6.6.7 |

*Bảng A.13. Tuyến không có xác thực mà không phải công khai theo thiết kế*

| Nhóm | Tuyến | Ghi chú |
| :---- | :---- | :---- |
| Quản trị dữ liệu bán hàng (19) | Toàn bộ Bảng A.7 | Gồm ghi và xoá mềm |
| Quản trị trợ lý AI (5) | Toàn bộ Bảng A.9 | trigger-ai-train có thể gọi GitHub Actions nếu cấu hình GITHUB\_TOKEN |
| Phân tích hành vi (9) | Toàn bộ Bảng A.10 | Chỉ đọc |
| Gỡ lỗi | GET /api/b2c/behavior/stats | Chỉ đọc |
| Tuyến cũ | GET /api/products | Trả toàn bộ bảng sản phẩm, không phân trang; với catalog 600.000 dòng có thể làm tràn bộ nhớ tiến trình |
| Ghi dữ liệu công khai | POST /api/b2c/products/:id/reviews | Không đăng nhập, tên người đánh giá do người gọi tự khai, chưa kiểm tra đã mua hàng |

**Tuyến công khai theo thiết kế:** duyệt danh mục và sản phẩm, flash sale, sản phẩm tương tự, xu hướng, lựa chọn onboarding, kiểm tra voucher (cart/apply-voucher, chỉ đọc), đăng ký, đăng nhập, đăng nhập Google, ghi sự kiện hành vi (/track, token tuỳ chọn, tối đa 20 sự kiện mỗi yêu cầu), GET /api/analytics/orders (dữ liệu giả, không đọc cơ sở dữ liệu) và các tuyến kiểm tra sức khoẻ.

**Tuyến client gọi nhưng máy chủ chưa có:** GET /api/b2b/campaign-suggestions (được gọi từ hàm getCampaignSuggestions trong client/src/services/api.js, dùng ở GeneralManagement.jsx) trả 404, phù hợp với ghi nhận tại §7.1 (MT6) rằng module tối ưu khuyến mãi mới ở mức thiết kế và chưa có mã nguồn.

