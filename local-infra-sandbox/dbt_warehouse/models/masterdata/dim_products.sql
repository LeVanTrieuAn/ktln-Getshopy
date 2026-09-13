{{ config(materialized='table', schema='masterdata', engine='MergeTree()', order_by='product_id') }}

-- Kéo thẳng từ Postgres qua table function, không qua CDC (xem _masterdata.yml).
-- Full refresh mỗi lần build: 26k dòng, vài giây.
SELECT
    toString(id)            AS product_id,
    name                    AS product_name,
    category_id,
    brand_id,
    toInt64(price)          AS price,            -- VND, Int đồng
    toInt64(original_price) AS original_price,
    toInt32(stock)          AS stock,
    toInt32(sold)           AS sold,
    toFloat32(rating)       AS rating,
    -- Cờ này quyết định sản phẩm có được gợi ý hay không
    if(is_deleted, 1, 0)    AS is_deleted,
    now()                   AS _synced_at
FROM postgresql(
    '{{ env_var("PG_SOURCE_HOST", "postgres") }}:{{ env_var("PG_SOURCE_PORT", "5432") }}',
    '{{ env_var("PG_SOURCE_DB", "getshopy") }}',
    'Product',
    '{{ env_var("PG_SOURCE_USER") }}',
    '{{ env_var("PG_SOURCE_PASSWORD") }}'
)
