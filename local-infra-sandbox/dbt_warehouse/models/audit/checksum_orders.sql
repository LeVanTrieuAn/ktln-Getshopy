{{ config(materialized='table', schema='audit', engine='MergeTree()', order_by='checked_at', tags=['audit']) }}

-- =====================================================================
-- CHECKSUM 3 TẦNG — mục 3.5 của checklist.
--
-- Đếm và tổng tiền ở ba điểm trên đường đi. Lệch nghĩa là mất bản ghi ở đâu đó
-- giữa Postgres -> CDC -> MinIO -> warehouse, và đó là loại lỗi KHÔNG tự báo:
-- pipeline vẫn "chạy", chỉ là thiếu dữ liệu.
--
--   src : Postgres  (nguồn nghiệp vụ, sự thật gốc)
--   stg : parquet trên MinIO qua view s3()
--   wh  : fact_orders_detail sau khi ReplacingMergeTree khử trùng
-- =====================================================================
WITH
    src AS (
        SELECT count() AS c, sum(net_amount) AS s
        FROM postgresql(
            '{{ env_var("PG_SOURCE_HOST", "postgres") }}:{{ env_var("PG_SOURCE_PORT", "5432") }}',
            '{{ env_var("PG_SOURCE_DB", "getshopy") }}',
            'OrderItem',
            '{{ env_var("PG_SOURCE_USER") }}',
            '{{ env_var("PG_SOURCE_PASSWORD") }}')
    ),
    stg AS (
        -- Dedup trước khi đếm: CDC sinh nhiều bản ghi cho cùng một dòng
        SELECT count() AS c, sum(net_amount) AS s
        FROM (
            SELECT * EXCEPT rn FROM (
                SELECT *, row_number() OVER (PARTITION BY item_id ORDER BY event_ts DESC) AS rn
                FROM {{ ref('stg_order_items') }}
            ) WHERE rn = 1 AND is_deleted = 0
        )
    ),
    wh AS (
        SELECT count() AS c, sum(net_amount) AS s
        FROM {{ ref('fact_orders_detail') }} FINAL
        WHERE _is_deleted = 0
    )
SELECT
    now()                                   AS checked_at,
    src.c                                   AS src_rows,
    stg.c                                   AS stg_rows,
    wh.c                                    AS wh_rows,
    toInt64(ifNull(src.s, 0))               AS src_amount,
    toInt64(ifNull(stg.s, 0))               AS stg_amount,
    toInt64(ifNull(wh.s, 0))                AS wh_amount,
    -- Dữ liệu còn nằm trong buffer của sink chưa flush là chuyện bình thường,
    -- nên chênh lệch được ghi lại để theo dõi xu hướng, không phải báo động ngay.
    toInt64(src.c) - toInt64(stg.c)         AS lech_src_stg_rows,
    toInt64(stg.c) - toInt64(wh.c)          AS lech_stg_wh_rows,
    toInt64(ifNull(src.s,0)) - toInt64(ifNull(wh.s,0)) AS lech_src_wh_amount,
    if(src.c = wh.c AND ifNull(src.s,0) = ifNull(wh.s,0), 'KHỚP', 'LỆCH') AS ket_qua
FROM src, stg, wh
