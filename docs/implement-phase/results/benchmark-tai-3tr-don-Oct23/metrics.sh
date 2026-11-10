#!/usr/bin/env bash
# Ghi số liệu thí nghiệm mỗi 30 s. Không in gì ra stdout — chỉ ghi file.
#   stats.csv : ts,container,mem "dùng / trần",cpu
#   vm.csv    : ts,vm_used_mb,vm_avail_mb,swap_used_mb,d_free_gb,dbt_running,ch_mem,pg_orders,pg_items,lake_files,lake_bytes,fact_rows
SP="${OUT:-$PWD/benchmark-out}"; mkdir -p "$SP"   # thư mục ghi kết quả — đặt OUT=... để đổi
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)" || exit 1   # gốc repo, nơi có .env
env_get() { grep "^$1=" .env | head -1 | cut -d= -f2- | tr -d '\r'; }
MK=$(env_get MINIO_ACCESS_KEY); MS=$(env_get MINIO_SECRET_KEY)
PGU=$(env_get POSTGRES_USER); PGD=$(env_get POSTGRES_DB)
# Lỗi của ClickHouse ghi thành ERR: thông báo lỗi của s3() có thể lặp lại khoá MinIO
ch() {
  local out
  out=$(curl -s --max-time 20 http://localhost:8123/ --data-binary "$1" 2>/dev/null | tr '\t\n' ', ' | sed 's/, *$//')
  case "$out" in Code:*|"") echo "ERR" ;; *) echo "$out" ;; esac
}

[ -f "$SP/vm.csv" ] || echo "ts,vm_used_mb,vm_avail_mb,swap_used_mb,d_free_gb,dbt_running,ch_mem,pg_orders,pg_items,lake_files,lake_bytes,fact_rows" > "$SP/vm.csv"
i=0
while true; do
  ts=$(date '+%H:%M:%S')
  docker stats --no-stream --format "$ts,{{.Name}},{{.MemUsage}},{{.CPUPerc}}" >> "$SP/stats.csv" 2>/dev/null
  # wsl.exe -e: chạy thẳng `free`, không qua shell ngoài (shell ngoài thay $3/$7 bằng rỗng)
  vm=$(wsl.exe -d docker-desktop -e free -m 2>/dev/null | tr -d '\000\r' | awk 'NR==2{a=$3; b=$7} NR==3{c=$3} END{print a "," b "," c}')
  dfree=$(df -BG /d | awk 'NR==2{gsub("G","",$4); print $4}')
  ndbt=$(docker ps -q --filter ancestor=kltn-dbt:latest | wc -l)
  chmem=$(ch "SELECT formatReadableSize(value) FROM system.metrics WHERE metric='MemoryTracking'")
  pg=","; lake=","; fact=""
  if (( i % 2 == 0 )); then   # mỗi 60 s
    pg=$(docker exec kltn-postgres-1 psql -U "$PGU" -d "$PGD" -tAc 'SELECT (SELECT count(*) FROM "Order"), (SELECT count(*) FROM "OrderItem")' 2>/dev/null | tr '|' ',')
    lake=$(ch "SELECT count(), sum(_size) FROM s3('http://minio:9000/data-lake/topics/*/year=*/month=*/day=*/*.parquet', '$MK', '$MS', 'One')")
    fact=$(ch "SELECT sum(rows) FROM system.parts WHERE database='warehouse' AND table='fact_orders_detail' AND active")
  fi
  echo "$ts,$vm,$dfree,$ndbt,$chmem,$pg,$lake,$fact" >> "$SP/vm.csv"
  i=$((i + 1))
  sleep 30
done
