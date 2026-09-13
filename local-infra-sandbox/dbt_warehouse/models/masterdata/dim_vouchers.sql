{{ config(materialized='table', schema='masterdata', engine='MergeTree()', order_by='voucher_id') }}

-- Kéo thẳng từ Postgres, không qua CDC (xem _masterdata.yml).
SELECT
    toString(id) AS voucher_id, code, type, toInt64(value) AS value, toInt64(min_order_value) AS min_order_value, toInt64(max_discount) AS max_discount, toInt32(used_count) AS used_count, if(is_deleted,1,0) AS is_deleted,
    now() AS _synced_at
FROM postgresql(
    '{{ env_var("PG_SOURCE_HOST", "postgres") }}:{{ env_var("PG_SOURCE_PORT", "5432") }}',
    '{{ env_var("PG_SOURCE_DB", "getshopy") }}',
    'Voucher',
    '{{ env_var("PG_SOURCE_USER") }}',
    '{{ env_var("PG_SOURCE_PASSWORD") }}'
)
