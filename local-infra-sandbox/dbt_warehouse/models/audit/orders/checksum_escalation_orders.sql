{{ config(materialized='table', database='audit', tags=['audit']) }}

-- ============================================================
-- Escalation: Detect if pipeline is stuck
--
-- If checksum reports WAITING_DATA for 3 consecutive checks,
-- escalate to SLA_BREACH_PIPELINE_STUCK
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

WITH recent AS (
    SELECT
        window_start,
        window_end,
        status,
        checked_at,
        row_number() OVER (ORDER BY checked_at DESC) AS rn
    FROM {{ ref('checksum_hourly_orders') }}
    WHERE domain = 'orders'
),
consecutive_waiting AS (
    SELECT count() AS cnt
    FROM recent
    WHERE status = 'WAITING_DATA'
      AND rn <= 3
),
latest_check AS (
    SELECT status, window_start, window_end, checked_at
    FROM recent
    WHERE rn = 1
)
SELECT
    now()                                               AS checked_at,
    'orders'                                            AS domain,
    cnt,
    multiIf(
        cnt >= 3,      'SLA_BREACH_PIPELINE_STUCK',
        cnt >= 1,      'DEGRADED',
        'OK'
    )                                                   AS escalation_status,
    (SELECT window_start FROM latest_check)             AS last_window_start,
    (SELECT window_end   FROM latest_check)             AS last_window_end,
    (SELECT status       FROM latest_check)             AS last_status,
    multiIf(
        cnt >= 3, 'Pipeline has reported WAITING_DATA for 3 consecutive checks. Investigate: (1) Kafka Connect not writing to S3, (2) dbt not loading to staging, (3) CDC events not being generated.',
        cnt >= 1, 'Pipeline is delayed but not yet breached.',
        'Pipeline is healthy.'
    )                                                   AS note
FROM consecutive_waiting
