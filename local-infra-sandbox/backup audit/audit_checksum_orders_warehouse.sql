{{ config(materialized='table', tags=['audit', 'orders']) }}

SELECT
    'orders'                        AS domain,
    'warehouse'                     AS layer,
    toTimezone(now(), 'Asia/Ho_Chi_Minh')   AS checked_at,
    COUNT(*)                        AS row_count,
    COUNT(DISTINCT order_id)        AS unique_keys,
    SUM(total_amount)               AS sum_amount,
    countIf(total_amount IS NULL)   AS null_amount_count,
    MAX(updated_at)                 AS max_updated_at
FROM {{ ref('dim_orders') }}