{{
    config(
        materialized='incremental',
        incremental_strategy='append',
        engine='ReplacingMergeTree(_ingested_at)',
        order_by='detail_id',
    )
}}

SELECT
    assumeNotNull(detail_id) as detail_id,
    order_id,
    product_id,
    quantity,
    price,
    now() as _ingested_at
FROM {{ ref('stg_order_details') }}
WHERE detail_id IS NOT NULL


{% if is_incremental() %}
    AND _ingested_at > (SELECT max(_ingested_at) FROM {{ this }})
{% else %}
    ORDER BY _ingested_at DESC
    LIMIT 1 BY detail_id
{% endif %}