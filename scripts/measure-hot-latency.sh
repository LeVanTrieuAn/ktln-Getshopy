#!/usr/bin/env bash
# Đo độ trễ nhánh nóng (dùng cho results.md §19): commit Postgres -> dòng có trong realtime.orders_live.
# UPDATE không đổi giá trị (status = status) trên đơn thử -> Debezium vẫn phát
# sự kiện 'u'. Không tạo đơn mới, không đổi dữ liệu.
# Dùng: bash scripts/measure-hot-latency.sh [order_id] [số_lần] [giây_giữa_các_lần]
ORDER_ID="${1:-ORD-1794416465641}"
N="${2:-6}"
GAP="${3:-20}"
PSQL() { docker exec kltn-postgres-1 sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Atq -c \"$1\""; }
CHQ() { docker exec kltn-clickhouse-1 clickhouse-client -q "$1"; }

echo "i,commit_utc,arrived_utc,event_ts_utc,ms_commit_to_ch,ms_debezium_to_ch"
for i in $(seq 1 "$N"); do
  t0=$(PSQL "UPDATE \\\"Order\\\" SET status = status WHERE id = '$ORDER_ID' RETURNING to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS')" | head -1 | tr -d '\r')
  if [ -z "$t0" ]; then echo "UPDATE không trả giờ — dừng"; exit 1; fi
  found=""
  for _ in $(seq 1 120); do   # tối đa ~60 s
    row=$(CHQ "SELECT toString(_arrived_at), toString(_event_ts),
                      dateDiff('millisecond', toDateTime64('$t0',3,'UTC'), _arrived_at),
                      dateDiff('millisecond', _event_ts, _arrived_at)
               FROM realtime.orders_live
               WHERE order_id = '$ORDER_ID' AND _event_ts >= toDateTime64('$t0',3,'UTC')
               ORDER BY _arrived_at LIMIT 1 FORMAT CSV" | tr -d '"\r')
    if [ -n "$row" ]; then found="$row"; break; fi
    sleep 0.5
  done
  if [ -n "$found" ]; then
    IFS=, read -r arr ev ms1 ms2 <<< "$found"
    echo "$i,$t0,$arr,$ev,$ms1,$ms2"
  else
    echo "$i,$t0,TIMEOUT,,,"
  fi
  if [ "$i" -lt "$N" ]; then sleep "$GAP"; fi
done
