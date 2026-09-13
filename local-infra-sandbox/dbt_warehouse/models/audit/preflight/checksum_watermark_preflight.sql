{{ config(materialized='view', database='audit', tags=['audit']) }}

-- ============================================================
-- Preflight Check: Is dim_orders ready for the previous hour?
--
-- Logic:
--   - Check if dim_orders has any data with updated_at >= window_end
--     (i.e., data that arrived AFTER the window closed)
--   - If max(updated_at) >= window_end → data has arrived → READY
--   - Otherwise → data not yet loaded → WAITING_DATA
--
-- Note: We check against window_end (e.g. 15:00), not window_start (14:00)
--       because CDC events may arrive with timestamps within the window
--       but get loaded slightly after the window closes.
-- ============================================================

WITH
    toStartOfHour(now() - INTERVAL 1 HOUR)    AS w_start,
    toStartOfHour(now())                       AS w_end,

    -- Get max updated_at from dim_orders for the window
    window_data AS (
        SELECT max(updated_at) AS max_ts
        FROM {{ ref('dim_orders') }}
        WHERE updated_at >= w_start
          AND updated_at <  w_end
    ),

    -- Get global max updated_at (safety check for late-arriving data)
    global_max AS (
        SELECT max(updated_at) AS max_ts
        FROM {{ ref('dim_orders') }}
    )

SELECT
    w_start,
    w_end,
    -- Use COALESCE to handle NULL (no data in window)
    coalesce(
        (SELECT max_ts FROM window_data),
        toDateTime('1970-01-01 00:00:00', 'UTC')
    )                                               AS watermark_max,
    coalesce(
        (SELECT max_ts FROM global_max),
        toDateTime('1970-01-01 00:00:00', 'UTC')
    )                                               AS global_watermark_max,
    multiIf(
        (SELECT max_ts FROM window_data) IS NULL,
            -- No data at all in the window → definitely waiting
            'WAITING_DATA',
        (SELECT max_ts FROM window_data) >= w_end,
            -- Data exists and max >= window_end → ready
            'READY',
        (SELECT max_ts FROM window_data) >= w_start,
            -- Data exists but max < window_end → partially loaded, might still arrive
            'PARTIAL_DATA',
        'WAITING_DATA'
    )                                               AS preflight_status
FROM system.one
