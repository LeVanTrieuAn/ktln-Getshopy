{{ config(materialized='table', tags=['audit', 'orders']) }}

WITH src AS (SELECT * FROM {{ ref('audit_checksum_orders_datasource') }}),
     stg AS (SELECT * FROM {{ ref('audit_checksum_orders_storage') }}),
     wh  AS (SELECT * FROM {{ ref('audit_checksum_orders_warehouse') }})

SELECT
    toTimezone(now(), 'Asia/Ho_Chi_Minh')   AS checked_at,
    'orders'                        AS domain,

    -- row count
    src.row_count                   AS src_row_count,
    stg.row_count                   AS stg_row_count,
    wh.row_count                    AS wh_row_count,
    stg.row_count - src.row_count   AS storage_row_diff,
    wh.row_count  - src.row_count   AS warehouse_row_diff,

    -- sum amount
    src.sum_amount                  AS src_sum_amount,
    stg.sum_amount                  AS stg_sum_amount,
    wh.sum_amount                   AS wh_sum_amount,
    stg.sum_amount - src.sum_amount AS storage_sum_diff,
    wh.sum_amount  - src.sum_amount AS warehouse_sum_diff,

    -- unique keys
    src.unique_keys                 AS src_unique_keys,
    stg.unique_keys                 AS stg_unique_keys,
    wh.unique_keys                  AS wh_unique_keys,

    -- null checks
    stg.null_amount_count           AS stg_null_amount,
    wh.null_amount_count            AS wh_null_amount,

    -- max timestamp lag
    src.max_updated_at              AS src_max_ts,
    stg.max_updated_at              AS stg_max_ts,
    wh.max_updated_at               AS wh_max_ts,
    dateDiff('minute', stg.max_updated_at, now()) AS stg_lag_minutes,
    dateDiff('minute', wh.max_updated_at,  now()) AS wh_lag_minutes,

    -- flags tổng hợp
    multiIf(
        abs(stg.row_count - src.row_count) > 0, 'STORAGE_ROW_MISMATCH',
        abs(wh.row_count  - src.row_count) > 0, 'WAREHOUSE_ROW_MISMATCH',
        abs(stg.sum_amount - src.sum_amount) > 0.01, 'STORAGE_SUM_MISMATCH',
        abs(wh.sum_amount  - src.sum_amount) > 0.01, 'WAREHOUSE_SUM_MISMATCH',
        wh.null_amount_count > 0, 'WAREHOUSE_HAS_NULLS',
        'OK'
    )                               AS status

FROM src, stg, wh