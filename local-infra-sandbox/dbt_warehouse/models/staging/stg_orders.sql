{{ config(materialized='view', schema='staging') }}

-- Envelope Debezium: before / after / op / ts_ms
--   op = c(create) u(update) d(delete) r(snapshot)
-- Bản ghi xoá chỉ có `before`, nên phải ifNull(after, before).
SELECT
    ifNull(tupleElement(after,'id'),            tupleElement(before,'id'))            AS order_id,
    ifNull(tupleElement(after,'customer_id'),   tupleElement(before,'customer_id'))   AS customer_id,
    ifNull(tupleElement(after,'total'),         tupleElement(before,'total'))         AS total,
    ifNull(tupleElement(after,'subTotal'),      tupleElement(before,'subTotal'))      AS sub_total,
    ifNull(tupleElement(after,'discount'),      tupleElement(before,'discount'))      AS discount,
    ifNull(tupleElement(after,'shippingFee'),   tupleElement(before,'shippingFee'))   AS shipping_fee,
    ifNull(tupleElement(after,'status'),        tupleElement(before,'status'))        AS status,
    ifNull(tupleElement(after,'payment_method'),tupleElement(before,'payment_method'))AS payment_method,
    ifNull(tupleElement(after,'payment_status'),tupleElement(before,'payment_status'))AS payment_status,
    ifNull(tupleElement(after,'date'),          tupleElement(before,'date'))          AS order_date,
    ifNull(tupleElement(after,'paid_at'),       tupleElement(before,'paid_at'))       AS paid_at,
    -- SCHEMA EVOLUTION: parquet sinh TRƯỚC khi thêm cột province không có
    -- trường này, và ClickHouse ném NOT_FOUND_COLUMN_IN_BLOCK khi đọc lẫn file
    -- cũ với file mới. Tham số thứ ba của tupleElement là giá trị mặc định khi
    -- trường không tồn tại — nhờ nó một view đọc được cả hai thế hệ file.
    ifNull(tupleElement(after,  'province', ''),
           tupleElement(before, 'province', ''))                                      AS province,
    toDateTime64(toFloat64(ts_ms)/1000, 3, 'UTC')                                     AS event_ts,
    if(op = 'd', 1, 0)                                                                AS is_deleted
FROM s3(
    'http://{{ env_var("MINIO_HOST", "minio") }}:{{ env_var("MINIO_PORT", "9000") }}/{{ env_var("MINIO_BUCKET", "data-lake") }}/topics/{{ var("cdc_prefix") }}.public.Order/year=*/month=*/day=*/*.parquet',
    '{{ env_var("MINIO_ACCESS_KEY") }}',
    '{{ env_var("MINIO_SECRET_KEY") }}',
    'Parquet'
)
WHERE ifNull(tupleElement(after,'id'), tupleElement(before,'id')) IS NOT NULL
