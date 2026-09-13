{{ config(materialized='table', schema='serving') }}

SELECT
    product_id,
    order_status,
    count() AS total_orders,
    sum(quantity) AS total_quantity,
    sum(line_revenue) AS total_revenue,
    avg(price) AS avg_price
FROM {{ ref('fact_order_details') }}
GROUP BY product_id, order_status
ORDER BY total_revenue DESC