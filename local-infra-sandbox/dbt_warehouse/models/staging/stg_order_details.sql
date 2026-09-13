{{ config(materialized='view') }}
SELECT 
    after.1 as detail_id,
    after.2 as order_id,
    after.3 as product_id,
    after.4 as quantity,
    after.5 as price,
    now() as _ingested_at 
FROM s3(
    'http://{{ var("minio_host") }}:{{ var("minio_port") }}/{{ var("minio_bucket") }}/topics/cdc_prod.public.orders_detail/year=*/month=*/day=*/hour=*/*.parquet',
    '{{ env_var("MINIO_ACCESS_KEY") }}',
    '{{ env_var("MINIO_SECRET_KEY") }}',
    'Parquet'
)
WHERE detail_id IS NOT NULL