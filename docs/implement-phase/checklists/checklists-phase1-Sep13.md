 KLTN + Dự án CNTT
update: 13/09/2026

  1. Merged code from these branches: ai-rec, then improve-ui by Tú.
2. Thông luồng order ở eCommerce: hoàn thiện phần payment với VietQR
3. Task thông luồng Ecommerce với BigData:
    1. Kafka CDC phải connect được vào Database Postgres để nhận đơn và đóng gói thành .parquet( phần chuyển đổi thành file parquet đã được hệ auto thông luồng).
    2. 
    3. Kéo lên Clickhouse các bảng masterdata để phục vụ các câu query join cross check: users, products, brands, category,…
    4. Sau khi lên được MinIO, việc cần làm tiếp theo là viết models dbt để hệ transform ra data cần thiết(tinh chế data) — fact_orders_detail(bảng tổng hợp), mart_renevue(doanh thu),processed_data_for_AI_rec(QUAN TRỌNG — đọc xem hệ AI Rec họ cần những data gì thì model này là customize viết riêng cho họ, tất nhiên là vẫn phải đảm bảo các quy tắc tiền xử lý dữ liệu cho mô hình như làm sạch, fillin,…)
    5. Checksums: Có thể làm ra các models test trong dbt để kiểm số lượng, có bị null hay mismatch dữ liệu gì không
4. Test lại lên order xem đã thông luồng qua tới bảng fact và các bảng kia chưa + admin dashboard đã sync được từ bảng doanh thu chưa
5. Check xem data ra bảng processed rồi bên hệ AI rec có hoạt động với data đó không
