#!/usr/bin/env bash
#
# Nạp biến môi trường để chạy dbt TỪ MÁY HOST (không qua container).
#
#   cd local-infra-sandbox/dbt_warehouse
#   source dbt-env.sh
#   dbt deps      # lần đầu
#   dbt build
#
# Khác với chạy trong container: ở đây các service được gọi qua localhost và
# cổng đã map ra host, thay vì tên service trong network của compose.
set -a

# Lấy mật khẩu từ .env ở gốc repo — không hardcode vào file nằm trong git
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ -f "$ROOT/.env" ]; then
  # shellcheck disable=SC1090
  . "$ROOT/.env"
else
  echo "Không thấy $ROOT/.env — hãy tạo từ .env.example trước." >&2
fi

# Ghi đè host: từ máy host thì gọi localhost, không phải tên service
CH_HOST=localhost
CH_PORT="${CLICKHOUSE_HTTP_PORT:-8123}"
CH_USER="${CLICKHOUSE_USER:-default}"
CH_PASSWORD="${CLICKHOUSE_PASSWORD:-}"
CH_DB=default

MINIO_HOST=localhost
MINIO_PORT="${MINIO_PORT:-9000}"

PG_SOURCE_HOST=localhost
PG_SOURCE_PORT="${POSTGRES_PORT:-5432}"
PG_SOURCE_DB="${POSTGRES_DB:-getshopy}"
PG_SOURCE_USER="${POSTGRES_USER:-getshopy}"
PG_SOURCE_PASSWORD="${POSTGRES_PASSWORD}"

DBT_PROFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set +a

echo "dbt env đã nạp:"
echo "  ClickHouse : $CH_HOST:$CH_PORT"
echo "  MinIO      : $MINIO_HOST:$MINIO_PORT/${MINIO_BUCKET:-data-lake}"
echo "  Postgres   : $PG_SOURCE_HOST:$PG_SOURCE_PORT/$PG_SOURCE_DB"
echo
echo "Chạy:  dbt deps && dbt build"
