{{ config(materialized='table', database='masterdata', engine='MergeTree()', order_by='brand_id') }}

-- Kéo thẳng từ Postgres, không qua CDC (xem _masterdata.yml).
SELECT
    id AS brand_id, name AS brand_name, if(is_deleted,1,0) AS is_deleted,
    now() AS _synced_at
FROM postgresql(
    '{{ env_var("PG_SOURCE_HOST", "postgres") }}:{{ env_var("PG_SOURCE_PORT", "5432") }}',
    '{{ env_var("PG_SOURCE_DB", "getshopy") }}',
    'Brand',
    '{{ env_var("PG_SOURCE_USER") }}',
    '{{ env_var("PG_SOURCE_PASSWORD") }}'
)
