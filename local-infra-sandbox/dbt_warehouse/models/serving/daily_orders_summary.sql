{{ config(materialized='table', schema='serving') }}

SELECT
    order_year_month,
    status,
    count() AS total_orders,
    sum(total_amount) AS total_revenue,
    avg(total_amount) AS avg_order_value,
    countIf(is_completed = 1) AS completed_orders
FROM {{ ref('dim_orders') }}
GROUP BY order_year_month, status
ORDER BY order_year_month DESC