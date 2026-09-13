{{ config(materialized='table', schema='masterdata', engine='MergeTree()', order_by='customer_id') }}

-- Kéo thẳng từ Postgres, không qua CDC (xem _masterdata.yml).
SELECT
    toString(id) AS customer_id, full_name, email, ifNull(phone,'') AS phone, toInt32(loyalty_points) AS loyalty_points, provider, created_at,
    now() AS _synced_at
FROM postgresql(
    '{{ env_var("PG_SOURCE_HOST", "postgres") }}:{{ env_var("PG_SOURCE_PORT", "5432") }}',
    '{{ env_var("PG_SOURCE_DB", "getshopy") }}',
    'B2CCustomer',
    '{{ env_var("PG_SOURCE_USER") }}',
    '{{ env_var("PG_SOURCE_PASSWORD") }}'
)
