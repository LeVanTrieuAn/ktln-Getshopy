{{
    config(
        materialized='incremental',
        incremental_strategy='append',
        engine='ReplacingMergeTree(updated_at)',
        order_by='order_id',
    )
}}

SELECT 
    assumeNotNull(order_id) as order_id,
    customer_id,
    total_amount,
    status,
    created_at,
    assumeNotNull(updated_at) as updated_at
    
FROM {{ ref('stg_orders') }}
WHERE order_id IS NOT NULL

{% if is_incremental() %}
    AND updated_at > (SELECT max(updated_at) FROM {{ this }})
{% else %}
    -- full load lần đầu: dedup ngay tại đây
    ORDER BY updated_at DESC
    LIMIT 1 BY order_id
{% endif %}