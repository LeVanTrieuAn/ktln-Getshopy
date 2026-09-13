{{ config(materialized='table', database='masterdata', engine='MergeTree()', order_by='category_id') }}

-- Kéo thẳng từ Postgres, không qua CDC (xem _masterdata.yml).
SELECT
    id AS category_id, name AS category_name, ifNull(parent_id,'') AS parent_id, toInt32(sort_order) AS sort_order,
    now() AS _synced_at
FROM postgresql(
    '{{ env_var("PG_SOURCE_HOST", "postgres") }}:{{ env_var("PG_SOURCE_PORT", "5432") }}',
    '{{ env_var("PG_SOURCE_DB", "getshopy") }}',
    'Category',
    '{{ env_var("PG_SOURCE_USER") }}',
    '{{ env_var("PG_SOURCE_PASSWORD") }}'
)
