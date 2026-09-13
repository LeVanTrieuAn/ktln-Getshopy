{{
    config(
        materialized='incremental',
        incremental_strategy='append',
        engine='ReplacingMergeTree(_ingested_at)',
        order_by='detail_id',
        unique_key='detail_id'
    )
}}

SELECT 
    od.detail_id,
    od.order_id,
    o.customer_id,
    od.product_id,
    od.quantity,
    od.price,
    od.quantity * od.price as line_revenue,
    o.total_amount         as order_total,
    o.status               as order_status,
    o.created_at           as order_date,
    od._ingested_at
FROM {{ ref('orders_detail_dedup') }} od
LEFT JOIN {{ ref('orders_dedup') }} o 
    ON od.order_id = o.order_id

{% if is_incremental() %}
WHERE od._ingested_at > (SELECT max(_ingested_at) FROM {{ this }})
{% endif %}