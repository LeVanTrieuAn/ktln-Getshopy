{{ config(materialized='table', database='audit', tags=['audit']) }}

-- ============================================================
-- All-Time Checksum for Orders
-- Layers: src (PostgreSQL) → stg (S3 Parquet) → wh (dim_orders)
-- Check toàn bộ data (không filter theo window)
-- ============================================================

{{
    config(
        materialized = 'table',
        database = 'audit',
        tags = ['audit'],
        engine = 'ReplacingMergeTree(checked_at)',
        order_by = 'checked_at'
    )
}}

WITH
    now()                                                       AS checked_at_ts,

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
    ),

    -- WH: dim_orders (warehouse)
    wh AS (
        SELECT
            count()             AS wh_count,
            sum(total_amount)   AS wh_sum
        FROM {{ ref('dim_orders') }}
    )

SELECT
    generateUUIDv4()                                               AS log_id,
    checked_at_ts                                                  AS checked_at,
    'orders'                                                      AS domain,
    'ALL_TIME'                                                    AS checksum_type,

    -- Status determination
    multiIf(
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
    (SELECT src_watermark_max FROM src)                            AS source_watermark_max,

    -- Extra info
    0                                                              AS waiting_count,
    ''                                                             AS note

FROM src, stg, wh
