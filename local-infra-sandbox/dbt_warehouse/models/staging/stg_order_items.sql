{{ config(materialized='view', schema='staging') }}

SELECT
    ifNull(tupleElement(after,'id'),          tupleElement(before,'id'))          AS item_id,
    ifNull(tupleElement(after,'order_id'),    tupleElement(before,'order_id'))    AS order_id,
    ifNull(tupleElement(after,'product_id'),  tupleElement(before,'product_id'))  AS product_id,
    ifNull(tupleElement(after,'product_name'),tupleElement(before,'product_name'))AS product_name,
    ifNull(tupleElement(after,'category_id'), tupleElement(before,'category_id')) AS category_id,
    ifNull(tupleElement(after,'brand_id'),    tupleElement(before,'brand_id'))    AS brand_id,
    ifNull(tupleElement(after,'branch_id'),   tupleElement(before,'branch_id'))   AS branch_id,
    ifNull(tupleElement(after,'variant_id'),  tupleElement(before,'variant_id'))  AS variant_id,
    ifNull(tupleElement(after,'quantity'),    tupleElement(before,'quantity'))    AS quantity,
    ifNull(tupleElement(after,'unit_price'),  tupleElement(before,'unit_price'))  AS unit_price,
    ifNull(tupleElement(after,'discount'),    tupleElement(before,'discount'))    AS discount,
    ifNull(tupleElement(after,'net_amount'),  tupleElement(before,'net_amount'))  AS net_amount,
    toDateTime64(toFloat64(ts_ms)/1000, 3, 'UTC')                                 AS event_ts,
    if(op = 'd', 1, 0)                                                            AS is_deleted
FROM s3(
    'http://{{ env_var("MINIO_HOST", "minio") }}:{{ env_var("MINIO_PORT", "9000") }}/{{ env_var("MINIO_BUCKET", "data-lake") }}/topics/{{ var("cdc_prefix") }}.public.OrderItem/year=*/month=*/day=*/*.parquet',
    '{{ env_var("MINIO_ACCESS_KEY") }}',
    '{{ env_var("MINIO_SECRET_KEY") }}',
    'Parquet'
)
WHERE ifNull(tupleElement(after,'id'), tupleElement(before,'id')) IS NOT NULL
