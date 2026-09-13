{{ config(materialized='view') }}
SELECT 
    ifNull(tupleElement(after, 1), tupleElement(before, 1)) AS order_id,
    ifNull(tupleElement(after, 2), tupleElement(before, 2)) AS customer_id,
    ifNull(tupleElement(after, 3), tupleElement(before, 3)) AS total_amount,
    ifNull(tupleElement(after, 4), tupleElement(before, 4)) AS status,
    toDateTime64(toFloat64(ifNull(tupleElement(after, 5), tupleElement(before, 5))) / 1000000, 0, 'UTC') AS created_at,
    toDateTime64(toFloat64(ifNull(tupleElement(after, 6), tupleElement(before, 6))) / 1000000, 0, 'UTC') AS updated_at,
    toDateTime64(toFloat64(ts_ms) / 1000, 3, 'UTC') AS event_ts,
    if(op = 'd', 1, 0) AS is_deleted

FROM s3(
    'http://{{ var("minio_host") }}:{{ var("minio_port") }}/{{ var("minio_bucket") }}/topics/cdc_prod.public.orders/year=*/month=*/day=*/hour=*/*.parquet',
    '{{ env_var("MINIO_ACCESS_KEY") }}',
    '{{ env_var("MINIO_SECRET_KEY") }}',
    'Parquet'
)
WHERE COALESCE(tupleElement(after, 1), tupleElement(before, 1)) IS NOT NULL