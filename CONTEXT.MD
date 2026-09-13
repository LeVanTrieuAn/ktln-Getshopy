# Project Context: Modern Enterprise Data Platform (3-Layer Architecture)

## 1. Tổng Quan Dự Án
Tài liệu này cung cấp toàn bộ bối cảnh kiến trúc hệ thống, hạ tầng và luồng dữ liệu của dự án Nền tảng Dữ liệu doanh nghiệp (Data Platform). Hệ thống được thiết kế theo chuẩn **High Availability (HA)**, chịu lỗi cao, chạy trên cụm 5 Server vật lý kết hợp điều phối bằng Kubernetes (K8s).

## 2. Bài Toán Nghiệp Vụ & Quy Mô Dữ Liệu (Data Scale)
Hệ thống xử lý luồng dữ liệu lớn với các đặc thù tải sau:
* **Tần suất/Sản lượng:** 20.000.000 - 30.000.000 lượt (records) chèn mới (Insert) mỗi ngày.
* **Đặc thù cập nhật:** ~12.000.000 lượt cập nhật trạng thái (Update) mỗi ngày.
* **Tần suất Ingestion:** * Luồng Near Real-time: Đồng bộ qua **Kafka + CDC** định kỳ **15 phút một lần**.
  * Luồng Batch: Đồng bộ qua **Airbyte** định kỳ hàng ngày (**Daily Batch**).

## 3. Kiến Trúc Tổng Thể Thống Nhất (Conceptual View)
Hệ thống chốt thiết kế tinh gọn theo mô hình **3 Lớp (Thô ➔ Tinh ➔ Serving)** để tối ưu tài nguyên và xử lý hiệu năng cao:

┌──────────────────────────────────────────────────────────────────────────────────┐
│                                AUTH & SYSTEM METADATA                            │
│                  (Keycloak, PostgreSQL Metadata, Consul Cluster)                 │
└────────────────────────────────────────┬─────────────────────────────────────────┘
│ (Định danh & lưu cấu hình)
▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐      ┌───────────────┐
│  DATA INGESTION  │ ───► │  STORAGE LAYER   │ ───► │ PROCESSING LAYER │ ───► │ SERVING LAYER │
│ (Kafka & Airbyte)│      │    (Raw Lake Apacha Iceberg + Apache Parquet - MinIO)    │      │ (dbt-core Calc)  │      │  (OLAP Engine)│
└──────────────────┘      └──────────────────┘      └──────────────────┘      └───────────────┘
│
▼
[BI / UI Tools]


## 4. Vai Trò Logic Của Các Lớp (Logical View)
1. **Lớp 1: Raw Storage / Data Lake (Apache Iceberg + Parquet trên MinIO):** Nơi hạ cánh của dữ liệu thô bất biến (Immutable), tránh lỗi Small Files khi ghi micro-batch 15 phút nhờ Iceberg.
2. **Lớp 2: Processing Layer (dbt-core):** Chạy tính toán biến đổi dạng dịch chuyển tăng trưởng (**Incremental Transformation**). Đọc từ MinIO và ghi kết quả tính toán trực tiếp xuống tầng Serving (ClickHouse) qua connector.
3. **Lớp 3: Analytics Storage(ClickHouse):** Kho OLAP lưu trữ bảng Fact/Dim tinh chế. Sử dụng engine `ReplacingMergeTree` để tối ưu hóa việc gộp (merge) nền bất đồng bộ cho 12 triệu dòng Update/ngày. Phục vụ query báo cáo thời gian thực cho Metabase BI.
4. **Lớp 4: Serving Layer Metabase:** Display Query báo cáo

---
*Xem chi tiết hạ tầng vật lý tại `infrastructure.md` và luồng chi tiết tại `data_pipeline.md`.*