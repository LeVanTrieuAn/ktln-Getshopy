{{
    config(
        materialized='incremental',
        incremental_strategy='append',
        engine='ReplacingMergeTree(updated_at)',
        order_by='order_id',
        unique_key='order_id'
    )
}}

SELECT 
    order_id,
    customer_id,
    total_amount,
    status,
    updated_at,
    CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END as is_processing,
    CASE WHEN status = 'COMPLETED'  THEN 1 ELSE 0 END as is_completed,
    toYYYYMM(updated_at) as order_year_month
FROM {{ ref('orders_dedup') }}

{% if is_incremental() %}
WHERE updated_at > (SELECT max(updated_at) FROM {{ this }})
{% endif %}