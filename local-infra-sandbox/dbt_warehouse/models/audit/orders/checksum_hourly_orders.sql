{{ config(materialized='table', database='audit', tags=['audit']) }}

-- ============================================================
-- Hourly Checksum for Orders
-- Layers: src (PostgreSQL) → stg (S3 Parquet) → wh (dim_orders)
-- Run frequency: every 15 minutes (via scheduler)
-- ============================================================

{{
    config(
        materialized = 'table',
        database = 'audit',
        tags = ['audit'],
        engine = 'ReplacingMergeTree(checked_at)',
        order_by = 'window_start'
    )
}}

WITH
    -- Window: previous hour (e.g. 14:00 to 15:00 if now is 15:19)
    toStartOfHour(now() - INTERVAL 1 HOUR)    AS w_start,
    toStartOfHour(now())                       AS w_end,

    -- SRC: PostgreSQL (business source)
    src AS (
        SELECT
            count()             AS src_count,
            sum(total_amount)   AS src_sum,
            max(updated_at)     AS src_watermark_max
        FROM postgresql(
            '{{ env_var("POSTGRES_SOURCE_HOST") }}:{{ env_var("POSTGRES_SOURCE_PORT") }}',
            '{{ env_var("POSTGRES_SOURCE_DB") }}',
            'orders',
            '{{ env_var("POSTGRES_SOURCE_USER") }}',
            '{{ env_var("POSTGRES_SOURCE_PASSWORD") }}',
            'public'
        )
        WHERE updated_at >= w_start
          AND updated_at <  w_end
    ),

    -- STG: S3 Parquet (storage layer / data lake)
    -- Note: Parquet uses position-based access (after.1, after.2, etc.)
    stg AS (
        SELECT
            count()                                                     AS stg_count,
            sum(tupleElement(after, 3))                               AS stg_sum
        FROM s3(
            'http://{{ var("minio_host") }}:{{ var("minio_port") }}/{{ var("minio_bucket") }}/topics/cdc_prod.public.orders/year=*/month=*/day=*/hour=*/*.parquet',
            '{{ env_var("MINIO_ACCESS_KEY") }}',
            '{{ env_var("MINIO_SECRET_KEY") }}',
            'Parquet'
        )
        WHERE toDateTime64(toFloat64(tupleElement(after, 6)) / 1000000, 0, 'UTC') >= w_start
          AND toDateTime64(toFloat64(tupleElement(after, 6)) / 1000000, 0, 'UTC') <  w_end
    ),

    -- WH: dim_orders (warehouse)
    wh AS (
        SELECT
            count()             AS wh_count,
            sum(total_amount)   AS wh_sum
        FROM {{ ref('dim_orders') }}
        WHERE updated_at >= w_start
          AND updated_at <  w_end
    ),

    -- Preflight: Check if dim_orders is ready
    preflight AS (
        SELECT
            preflight_status,
            watermark_max
        FROM {{ ref('checksum_watermark_preflight') }}
    )

SELECT
    generateUUIDv4()                                               AS log_id,
    w_start                                                       AS window_start,
    w_end                                                         AS window_end,
    now()                                                         AS checked_at,
    'orders'                                                      AS domain,

    -- Status determination (order matters: preflight first, then count, then sum)
    multiIf(
        (SELECT preflight_status FROM preflight) = 'WAITING_DATA',  'WAITING_DATA',
        src.src_count IS NULL,                                     'SOURCE_READ_ERROR',
        src.src_count != stg.stg_count,                            'STORAGE_MISMATCH',
        src.src_count != wh.wh_count,                              'WAREHOUSE_MISMATCH',
        abs(src.src_sum - stg.stg_sum) > 0.01,                    'STORAGE_SUM_MISMATCH',
        abs(src.src_sum - wh.wh_sum)  > 0.01,                      'WAREHOUSE_SUM_MISMATCH',
        'OK'
    )                                                              AS status,

    -- Counts
    src.src_count,
    stg.stg_count,
    wh.wh_count,

    -- Sums
    src.src_sum,
    stg.stg_sum,
    wh.wh_sum,

    -- Watermarks
    (SELECT watermark_max FROM preflight)                           AS watermark_max,
    (SELECT src_watermark_max FROM src)                            AS source_watermark_max,

    -- Extra info
    0                                                              AS waiting_count,
    ''                                                             AS note

FROM src, stg, wh
