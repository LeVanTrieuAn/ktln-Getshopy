Phase 1: Cấu hình dbt Project
Task 1.1: Cập nhật dbt_project.yml


 Thêm transformation/ và warehouse/ vào model-paths

 Config materialization cho từng layer:
staging/ → +materialized: view
transformation/ → +materialized: view
warehouse/ → +materialized: incremental
Task 1.2: Tạo models/sources.yml


 Khai báo MinIO endpoint variables (minio_endpoint, minio_bucket)

 Thêm credentials từ .env
Phase 2: Staging Layer (ClickHouse s3() Views)
Task 2.1: Viết staging models


 models/staging/stg_orders.sql - View đọc parquet từ MinIO

 models/staging/stg_orders_detail.sql - View đọc parquet chi tiết đơn hàng

 models/staging/stg_customers.sql - View đọc parquet khách hàng (nếu có)
Task 2.2: Test staging


 Chạy dbt run --select stg_orders

 Verify trong ClickHouse: SELECT * FROM stg_orders LIMIT 10

 Kiểm tra data type và NULL values
Phase 3: Transformation Layer (Deduplication)
Task 3.1: Viết transformation models


 models/transformation/orders_dedup.sql - ROW_NUMBER() dedup

 models/transformation/orders_detail_clean.sql - Clean & enrich detail data

 models/transformation/customers_scd.sql - SCD Type 2 (nếu cần)
Task 3.2: Test transformation


 Chạy dbt run --select transformation

 Verify: SELECT * FROM orders_dedup WHERE rn > 1 → phải trả 0 rows
Phase 4: Warehouse Layer (MergeTree Tables)
Task 4.1: Viết warehouse models


 models/warehouse/dim_orders.sql - ReplacingMergeTree, incremental

 models/warehouse/fact_order_details.sql - SummingMergeTree (nếu cần aggregate)

 models/warehouse/dim_customers.sql - ReplacingMergeTree
Task 4.2: Test warehouse (Full Load)


 Chạy dbt run --select warehouse lần đầu (full load)

 Verify table tồn tại trong ClickHouse: SHOW TABLES FROM warehouse

 Verify row count: SELECT COUNT(*) FROM warehouse.dim_orders
Task 4.3: Test warehouse (Incremental Load)


 Thêm data mới vào MinIO (hoặc chờ CDC push thêm parquet)

 Chạy dbt run --select warehouse --vars '{is_incremental: true}'

 Verify: chỉ đẩy data mới, không duplicate
Phase 5: Integration & E2E Test
Task 5.1: End-to-end flow


 CDC push data mới từ PostgreSQL → Kafka → MinIO

 Staging views tự động thấy data mới (vì đọc từ S3)

 Transformation views tính toán dedup

 Warehouse incremental insert data mới

 Verify: SELECT * FROM warehouse.dim_orders ORDER BY updated_at DESC LIMIT 5
Task 5.2: Scheduling (optional)


 Tạo script run_dbt.sh để chạy định kỳ 15 phút

 Hoặc dùng cron/Task Scheduler trên Windows
Task 5.3: Monitoring


 Log dbt runs: dbt run --log-path ./logs/dbt.log

 Alert nếu dbt fail

 Verify ClickHouse table sizes growth
Phase 6: Documentation & Cleanup
Task 6.1: Cập nhật PROGRESS.MD


 Đánh dấu 1.7 = ✅ Done

 Đánh dấu 1.8 = ✅ Done
Task 6.2: Viết README cho dbt project


 Hướng dẫn chạy dbt

 Giải thích layer structure

 Troubleshooting common issues