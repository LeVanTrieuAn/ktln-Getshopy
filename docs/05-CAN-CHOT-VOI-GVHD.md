# CÁC ĐIỂM CẦN CHỐT VỚI GVHD

Danh sách dùng cho buổi báo cáo. Mỗi mục gồm: vấn đề, phương án đề xuất, và hệ quả nếu chọn khác — để buổi họp ra được quyết định thay vì chỉ thảo luận.

---

## Nhóm 1 — Ba câu quyết định phạm vi (ưu tiên cao nhất)

### 1.1. Ranh giới "làm thật" và "thiết kế"
**Vấn đề:** nền tảng đã go-live ở doanh nghiệp trên cụm nhiều máy, nhưng phần lớn là cấu hình trực tiếp trên cụm. Cái gì được tính là kết quả của khoá luận?

**Đề xuất:** phạm vi nghiệm thu = sandbox một máy (đã thông luồng) + tái lập trên cụm VM beta được cấp + ứng dụng + AI + bộ thực nghiệm. Hệ thống production của doanh nghiệp chỉ được nêu như bối cảnh và cơ sở đối chiếu thiết kế, không dùng số liệu và không dùng dữ liệu thật.

**Cần GVHD xác nhận:** cách trình bày này có được chấp nhận về mặt liêm chính học thuật, và trong quyển nên diễn đạt quan hệ với hệ thống doanh nghiệp như thế nào.

### 1.2. Trọng tâm chấm điểm: nền tảng hay ứng dụng?
**Vấn đề:** mong muốn của người thực hiện là phần lõi nền tảng dữ liệu; yêu cầu của GVHD là phải có ứng dụng.

**Đề xuất tỉ lệ:** nền tảng dữ liệu 60% – ứng dụng GetShopy 15% – module AI 25%. Ứng dụng đóng vai trò kép (nguồn dữ liệu + nơi tiêu thụ), nghĩa là nó **là một phần của luận điểm** chứ không phải phần phụ ghép thêm.

**Cần GVHD xác nhận:** tỉ lệ này có phù hợp với tiêu chí đánh giá; ứng dụng cần đạt độ hoàn thiện đến mức nào (đủ luồng dữ liệu, hay cần hoàn thiện như một sản phẩm).

### 1.3. Số lượng module AI
**Đề xuất:** ba module bắt buộc (gợi ý sản phẩm, dự báo nhu cầu, tối ưu campaign/voucher) + một module tuỳ chọn (trợ lý hỏi đáp dữ liệu bằng LLM).

**Hệ quả nếu chọn khác:** giảm còn hai module thì dồn được thời gian cho thực nghiệm nền tảng; giữ cả bốn thì phải cắt hạng mục hạ tầng nâng cao ở giai đoạn cụm VM. Không nên giữ bốn module *và* đồng thời làm Kubernetes/Iceberg.

---

## Nhóm 2 — Nội dung học thuật

### 2.1. Tên đề tài
Phương án đề xuất: *"Xây dựng nền tảng dữ liệu (Data Platform) hiện đại theo kiến trúc Lakehouse phục vụ phân tích thời gian gần thực và ứng dụng AI cho hệ thống bán lẻ / thương mại điện tử"*.
Cần chốt: giữ nguyên, hay nhấn mạnh hơn vào phần đối soát – SLA dữ liệu (điểm nhấn kỹ thuật thật sự của đề tài), hay nhấn vào phần AI.

### 2.2. Điểm nhấn học thuật
**Đề xuất:** cơ chế **đối soát checksum xuyên tầng như một hợp đồng SLA dữ liệu** (đúng – đủ – kịp thời – sẵn sàng), hiện thực hoàn toàn bằng SQL trong dbt và giám sát bằng Prometheus/Grafana. Đây là phần khác biệt so với các khoá luận "dựng pipeline" thông thường và cũng là phần đã có mã nguồn thật.
**Cần xác nhận:** GVHD có coi đây là đóng góp đủ mạnh, hay muốn nhấn vào phần khác (ví dụ so sánh kiến trúc, hoặc hiệu năng OLAP).

### 2.3. Mức độ nghiên cứu của phần AI
**Đề xuất:** dùng các phương pháp đã công bố (ALS, Prophet, LightGBM, RFM + K-Means), không đề xuất thuật toán mới; đóng góp nằm ở kiến trúc tích hợp AI vào nền tảng dữ liệu.
**Cần xác nhận:** mức này có đủ, hay cần một phần so sánh/cải tiến mô hình sâu hơn.

### 2.4. Có cần chương so sánh giải pháp liên quan?
**Đề xuất:** có — so sánh với kho dữ liệu đám mây (Snowflake, BigQuery, Databricks) và với phương án ELT thuần trên CSDL quan hệ, theo các tiêu chí: chi phí, quyền kiểm soát dữ liệu, năng lực vận hành cần có, khả năng chạy tại chỗ (on-premise). Đây là lập luận cho việc chọn ngăn xếp tự vận hành.

---

## Nhóm 3 — Kỹ thuật

### 3.1. Apache Iceberg
Tài liệu kiến trúc ban đầu nêu tầng thô dùng Iceberg + Parquet, nhưng hiện tại là Parquet thuần.
**Đề xuất:** giữ Parquet, trình bày phân tích vấn đề tệp nhỏ và so sánh với Iceberg ở mức thiết kế, đưa vào hướng phát triển. Hiện thực Iceberg chỉ khi hoàn thành sớm các mốc M1–M4.

### 3.2. Điều phối pipeline
**Đề xuất:** bộ lịch đơn giản (cron trong container) cho phạm vi khoá luận; nêu Airflow/Dagster là hướng phát triển. Nếu GVHD coi việc điều phối là hạng mục bắt buộc thì cần bổ sung một tuần cho Dagster.

### 3.3. Các thành phần hạ tầng nâng cao
Keycloak SSO, Consul, PostgreSQL/Patroni, Kubernetes + MetalLB: **đề xuất chỉ trình bày thiết kế**; ở cụm VM beta tập trung vào sẵn sàng cao cho các thành phần dữ liệu trọng yếu (Kafka, MinIO, ClickHouse).

### 3.4. Quy mô thực nghiệm
Yêu cầu thiết kế là hàng chục triệu bản ghi mỗi ngày; phòng lab không đủ tài nguyên.
**Đề xuất:** đo ở nhiều mức quy mô (1M / 10M / 50M dòng; 100 → 5.000 giao dịch/phút), phân tích quan hệ giữa quy mô và hiệu năng, rồi ngoại suy có lập luận về khả năng đáp ứng quy mô thiết kế. Nêu rõ đây là ngoại suy, không phải đo trực tiếp.
**Cần xác nhận:** cách xử lý này có được chấp nhận trong chương thực nghiệm.

---

## Nhóm 4 — Dữ liệu

### 4.1. Lược đồ dữ liệu
**Đề xuất:** tham khảo mô hình nghiệp vụ thực tế nhưng **tinh giản** (bỏ các bảng và cột không phục vụ mục tiêu), không sao chép nguyên trạng, không dùng bất kỳ dữ liệu thật nào. Toàn bộ dữ liệu trong luận văn do bộ mô phỏng sinh ra.
**Cần xác nhận:** cách diễn đạt trong quyển về nguồn gốc lược đồ.

### 4.2. Dữ liệu mô phỏng có chủ đích
**Đề xuất:** bộ sinh dữ liệu cài đặt sẵn các quy luật (mùa vụ, phân khúc khách hàng, độ co giãn theo giá, hiệu ứng voucher, sản phẩm mua kèm) và **ghi lại tham số** để đối chiếu với kết quả mô hình.
**Điểm cần GVHD lưu ý:** đây vừa là điểm mạnh về phương pháp (có đáp án để đánh giá — điều dữ liệu thật không có) vừa là hạn chế cần nêu trung thực (mô hình học lại quy luật do chính mình cài). Cần thống nhất cách trình bày để không bị hội đồng phản biện coi là chứng minh vòng tròn.

---

## Nhóm 5 — Hành chính

| Nội dung | Cần chốt |
|---|---|
| Mẫu đề cương của trường | Có mẫu bắt buộc không? Số chương, giới hạn số trang, định dạng trích dẫn |
| Mốc nộp trung gian | Ngày báo cáo tiến độ giữa kỳ, ngày nộp đề cương bản cứng, có seminar không |
| Ngày bảo vệ chính thức | Hiện giả định tháng 01/2027 |
| Sản phẩm phải nộp | Quyển, slide, mã nguồn (có công khai trên GitHub được không, xét yếu tố thông tin doanh nghiệp), video demo, sổ tay vận hành |
| Hình thức làm việc | Cá nhân hay nhóm; nếu nhóm thì phân công và cách chấm điểm từng người |
| Nhịp báo cáo | Đề xuất hai tuần một lần, mỗi lần kèm bản demo chạy được |

---

## Ba câu hỏi khó nhất cần chuẩn bị sẵn câu trả lời

1. **"Làm sao chứng minh dữ liệu ở kho đúng với hệ thống nguồn?"**
   → Trình bày lớp `audit`: đối soát số bản ghi, tổng giá trị nghiệp vụ và watermark giữa ba tầng, ở ba cấp cửa sổ thời gian, chạy tự động, có phân loại trạng thái và thủ tục leo thang. Kèm kết quả thực nghiệm TN5 (tiêm lỗi rồi phục hồi).

2. **"Đề tài này khác gì với việc chỉ cài đặt vài công cụ có sẵn?"**
   → Ba điểm: (a) thiết kế cơ chế xử lý khối lượng cập nhật lớn trên OLAP và chứng minh bằng đo đạc có đối chứng, (b) thiết kế và hiện thực hợp đồng SLA dữ liệu — phần này không có sẵn trong công cụ nào, (c) bộ thực nghiệm định lượng có đường cơ sở đối chứng, không phải chỉ trình diễn.

3. **"Dữ liệu mô phỏng thì kết quả AI có ý nghĩa gì?"**
   → Nêu trung thực: dữ liệu mô phỏng không cho kết luận về thị trường thực. Nhưng vì các quy luật được cài đặt và ghi lại tham số, có thể **kiểm chứng được rằng luồng dữ liệu và mô hình phát hiện đúng quy luật** — đây là kiểm chứng tính đúng đắn của hệ thống, và đó mới là điều đề tài cần chứng minh.
