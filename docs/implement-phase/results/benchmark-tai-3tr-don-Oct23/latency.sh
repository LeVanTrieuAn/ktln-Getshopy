#!/usr/bin/env bash
# Độ trễ và thông lượng CDC đọc thẳng từ parquet trên MinIO + bảng fact.
#   source.ts_ms = lúc Postgres commit · ts_ms = lúc Debezium xử lý · _time = lúc file parquet ghi xong
SP="${OUT:-$PWD/benchmark-out}"; mkdir -p "$SP"   # thư mục ghi kết quả — đặt OUT=... để đổi
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)" || exit 1   # gốc repo, nơi có .env
env_get() { grep "^$1=" .env | head -1 | cut -d= -f2- | tr -d '\r'; }
MK=$(env_get MINIO_ACCESS_KEY); MS=$(env_get MINIO_SECRET_KEY)
ch() { curl -s --max-time 300 http://localhost:8123/ --data-binary "$1" | sed 's/'"$MK"'/***/g; s/'"$MS"'/***/g'; }
src() { echo "s3('http://minio:9000/data-lake/topics/cdc_prod.public.$1/year=*/month=*/day=*/*.parquet', '$MK', '$MS', 'Parquet')"; }

for t in Order OrderItem; do
  echo "== $t: số file, bản ghi, dung lượng"
  ch "SELECT count() AS files, sum(n) AS records, round(avg(n)) AS avg_per_file, countIf(n = 10000) AS files_du_10000, formatReadableSize(sum(sz)) AS size FROM (SELECT _path, count() AS n, any(_size) AS sz FROM $(src $t) GROUP BY _path) FORMAT PrettyCompactNoEscapes"
  echo "== $t: độ trễ từng chặng (giây) — p50 / p95 / p99 / max"
  ch "SELECT 'commit -> Debezium' AS chang, arrayMap(x -> round(x, 1), quantiles(0.5, 0.95, 0.99, 1)((ts_ms - tupleElement(source, 'ts_ms')) / 1000)) AS q FROM $(src $t)
      UNION ALL SELECT 'Debezium -> file MinIO', arrayMap(x -> round(x, 1), quantiles(0.5, 0.95, 0.99, 1)(toUnixTimestamp(_time) - ts_ms / 1000)) FROM $(src $t)
      UNION ALL SELECT 'commit -> file MinIO', arrayMap(x -> round(x, 1), quantiles(0.5, 0.95, 0.99, 1)(toUnixTimestamp(_time) - tupleElement(source, 'ts_ms') / 1000)) FROM $(src $t)
      FORMAT PrettyCompactNoEscapes"
done

echo "== Thông lượng theo phút (giờ UTC): commit ở Postgres vs Debezium xử lý vs file MinIO, đếm cả Order + OrderItem"
ch "WITH all_rows AS (
      SELECT tupleElement(source, 'ts_ms') AS c, ts_ms AS d, toUnixTimestamp(_time) AS f FROM $(src Order)
      UNION ALL SELECT tupleElement(source, 'ts_ms'), ts_ms, toUnixTimestamp(_time) FROM $(src OrderItem))
    SELECT m, sumIf(1, k = 'c') AS commit_per_phut, sumIf(1, k = 'd') AS debezium_per_phut, sumIf(1, k = 'f') AS minio_per_phut
    FROM (SELECT formatDateTime(toStartOfMinute(toDateTime(c / 1000)), '%H:%i') AS m, 'c' AS k FROM all_rows
          UNION ALL SELECT formatDateTime(toStartOfMinute(toDateTime(d / 1000)), '%H:%i'), 'd' FROM all_rows
          UNION ALL SELECT formatDateTime(toStartOfMinute(toDateTime(f)), '%H:%i'), 'f' FROM all_rows)
    GROUP BY m ORDER BY m FORMAT TSVWithNames" > "$SP/throughput.tsv"
cat "$SP/throughput.tsv"

echo "== Debezium -> warehouse (giây, theo _loaded_at của dbt) — p50 / p95 / p99 / max"
ch "SELECT arrayMap(x -> round(x), quantiles(0.5, 0.95, 0.99, 1)(dateDiff('millisecond', _item_event_ts, _loaded_at) / 1000)) AS q, count() AS rows FROM warehouse.fact_orders_detail FINAL WHERE _is_deleted = 0 FORMAT PrettyCompactNoEscapes"
