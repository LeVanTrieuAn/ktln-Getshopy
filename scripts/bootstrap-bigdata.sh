#!/usr/bin/env sh
#
# Khởi tạo hệ BigData sau khi compose up. Chạy trong service `bootstrap`.
#
# Bốn việc, tất cả đều IDEMPOTENT — chạy lại bao nhiêu lần cũng ra cùng kết quả:
#   1. Tạo bucket MinIO
#   2. Tạo user ClickHouse chỉ-đọc cho AI-Rec
#   3. Kéo masterdata từ Postgres lên ClickHouse
#   4. Đăng ký 2 connector (Debezium source + MinIO sink)
#
# Vì sao gom vào một chỗ thay vì để người dùng chạy tay: bốn bước này phải
# đúng thứ tự và phải chờ service khác sẵn sàng. Làm tay thì dễ sót bước 2
# hoặc chạy bước 4 trước khi Postgres có wal_level=logical, mà lỗi kiểu đó
# không hiện ra ngay — chỉ là dữ liệu không bao giờ chảy.
set -eu

CH="http://clickhouse:8123"
CONNECT="http://kafka-connect:8083"
MINIO="http://minio:9000"
PG_HOST="postgres:5432"

log()  { echo "  $*"; }
step() { echo ""; echo "── $* ──────────────────────────────────────"; }

# Chờ một endpoint HTTP trả về mã mong đợi
wait_http() {
  name="$1"; url="$2"; tries=0
  printf "  chờ %s" "$name"
  until curl -sf -o /dev/null "$url" 2>/dev/null; do
    tries=$((tries + 1))
    [ "$tries" -ge 60 ] && { echo " — QUÁ HẠN"; return 1; }
    printf "."; sleep 3
  done
  echo " sẵn sàng"
}

ch_query() { curl -sS "$CH" --data-binary "$1"; }

# Chạy một file .sql qua HTTP interface của ClickHouse.
#
# Phải BỎ COMMENT `--` TRƯỚC khi ép xuống dòng thành dấu cách. Ép trước thì cả
# câu lệnh nằm trên một dòng, và dấu `--` đầu tiên nuốt sạch phần còn lại —
# CREATE VIEW biến thành câu cụt, ClickHouse từ chối, mà vòng lặp vẫn đếm là
# thành công vì lỗi bị nuốt vào /dev/null. Bảng/view không bao giờ ra đời và
# không có dấu hiệu nào.
run_sql_file() {
  f="$1"; n=0; err=0
  # sed bỏ phần sau `--` trên TỪNG dòng, khi xuống dòng còn nguyên vẹn.
  stmts=$(sed 's/--.*$//' "$f" | awk 'BEGIN{RS=";"} NF {gsub(/\n/," "); print}')
  echo "$stmts" | while IFS= read -r stmt; do
    [ -z "$(echo "$stmt" | tr -d '[:space:]')" ] && continue
    if out=$(curl -sS --fail-with-body "$CH" --data-binary "$stmt" 2>&1); then
      n=$((n+1))
    else
      err=$((err+1))
      log "LỖI: $(echo "$out" | head -c 120)"
    fi
  done
  # Đếm lại ngoài subshell của pipe
  total=$(echo "$stmts" | grep -c '[^[:space:]]' || true)
  log "đã chạy $total câu lệnh từ $(basename "$f")"
}


echo "════════════════════════════════════════════════════════════"
echo "  Khởi tạo hệ BigData"
echo "════════════════════════════════════════════════════════════"

wait_http "ClickHouse"    "$CH/ping"
wait_http "Kafka Connect" "$CONNECT/"
wait_http "MinIO"         "$MINIO/minio/health/live"

# ── 0. Schema ClickHouse ────────────────────────────────────────────────
# /docker-entrypoint-initdb.d CHỈ chạy khi thư mục dữ liệu còn rỗng. Thêm bảng
# vào file schema sau lần khởi động đầu thì nó không bao giờ được áp dụng, và
# triệu chứng là endpoint trả 500 "Unknown table expression identifier" —
# không ai nghĩ tới việc schema chưa chạy.
# Ở đây áp lại mỗi lần bootstrap; toàn bộ câu lệnh đều IF NOT EXISTS nên an toàn.
step "0/5  Schema ClickHouse"
if [ -f /clickhouse-init/01_schema.sql ]; then
  run_sql_file /clickhouse-init/01_schema.sql
else
  log "bỏ qua — không thấy /clickhouse-init/01_schema.sql"
fi

# ── 1. Bucket MinIO ─────────────────────────────────────────────────────
step "1/5  Bucket MinIO"
mc alias set lake "$MINIO" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null 2>&1
if mc ls "lake/$MINIO_BUCKET" >/dev/null 2>&1; then
  log "bucket '$MINIO_BUCKET' đã có"
else
  mc mb "lake/$MINIO_BUCKET" >/dev/null && log "đã tạo bucket '$MINIO_BUCKET'"
fi

# ── 2. User ClickHouse cho AI-Rec ───────────────────────────────────────
step "2/5  User ClickHouse chỉ-đọc cho AI-Rec"
if [ -n "${AI_REC_CH_PASSWORD:-}" ]; then
  ch_query "CREATE DATABASE IF NOT EXISTS serving" >/dev/null
  ch_query "CREATE ROLE IF NOT EXISTS ai_rec_reader" >/dev/null
  ch_query "CREATE USER IF NOT EXISTS ${AI_REC_CH_USER:-ai_rec} IDENTIFIED BY '${AI_REC_CH_PASSWORD}'" >/dev/null
  ch_query "GRANT ai_rec_reader TO ${AI_REC_CH_USER:-ai_rec}" >/dev/null
  # Quyền cấp trên cả database: bảng processed_data_for_AI_rec do dbt tạo sau,
  # cấp trước theo từng bảng thì lệnh lỗi vì bảng chưa tồn tại.
  ch_query "GRANT SELECT ON serving.* TO ai_rec_reader" >/dev/null
  log "user '${AI_REC_CH_USER:-ai_rec}' chỉ đọc database 'serving'"
else
  log "bỏ qua — chưa đặt AI_REC_CH_PASSWORD"
fi

# ── 3. Masterdata ───────────────────────────────────────────────────────
# Kéo thẳng, không qua CDC: dữ liệu chiều thay đổi rất ít, không cần lịch sử.
step "3/5  Masterdata Postgres -> ClickHouse"
ch_query "CREATE DATABASE IF NOT EXISTS masterdata" >/dev/null

pg() { echo "postgresql('$PG_HOST','$POSTGRES_DB','$1','$POSTGRES_USER','$POSTGRES_PASSWORD')"; }

sync_dim() {
  tbl="$1"; src="$2"; ddl="$3"; cols="$4"
  ch_query "CREATE TABLE IF NOT EXISTS masterdata.$tbl ($ddl) ENGINE = MergeTree() ORDER BY $5" >/dev/null
  # TRUNCATE rồi INSERT: bản ghi không còn ở nguồn phải biến mất khỏi đích,
  # nếu không dữ liệu cũ nằm lại làm bẩn báo cáo.
  ch_query "TRUNCATE TABLE masterdata.$tbl" >/dev/null
  ch_query "INSERT INTO masterdata.$tbl SELECT $cols, now() FROM $(pg "$src") SETTINGS max_block_size = 100000" >/dev/null
  n=$(ch_query "SELECT count() FROM masterdata.$tbl" | tr -d '\n')
  printf "  %-16s %s dòng\n" "$tbl" "$n"
}

sync_dim dim_products Product \
  "product_id String, product_name String, category_id String, brand_id String, price Int64, original_price Int64, stock Int32, sold Int32, rating Float32, is_deleted UInt8, _synced_at DateTime" \
  "toString(id), name, category_id, brand_id, toInt64(price), toInt64(original_price), toInt32(stock), toInt32(sold), toFloat32(rating), if(is_deleted,1,0)" \
  "product_id"

sync_dim dim_brands Brand \
  "brand_id String, brand_name String, is_deleted UInt8, _synced_at DateTime" \
  "id, name, if(is_deleted,1,0)" "brand_id"

sync_dim dim_categories Category \
  "category_id String, category_name String, parent_id String, sort_order Int32, _synced_at DateTime" \
  "id, name, ifNull(parent_id,''), toInt32(sort_order)" "category_id"

sync_dim dim_branches Branch \
  "branch_id String, branch_name String, address String, is_deleted UInt8, _synced_at DateTime" \
  "id, name, address, if(is_deleted,1,0)" "branch_id"

sync_dim dim_customers B2CCustomer \
  "customer_id String, full_name String, email String, phone String, loyalty_points Int32, provider String, created_at DateTime, _synced_at DateTime" \
  "toString(id), full_name, email, ifNull(phone,''), toInt32(loyalty_points), provider, created_at" "customer_id"

# ── 3b. View tương thích cho dashboard ──────────────────────────────────
# 16 câu query của dashboard admin đọc analytics.sale_orders — bảng của thế hệ
# POC cũ, không còn ai ghi vào từ lúc gỡ dual-write. Không có view này thì mọi
# chỉ số trên dashboard bằng 0 hoặc đứng ở dữ liệu đọng: endpoint vẫn trả 200,
# biểu đồ vẫn vẽ, chỉ là số không liên quan gì tới đơn hàng thật.
#
# Áp lại mỗi lần bootstrap: script bắt đầu bằng DROP nên chạy lại vô hại, và
# view sẽ khớp lại nếu fact_orders_detail đổi cột.
step "3b/5  View tương thích (sale_orders, phiếu thu/xuất)"
for f in /etl/compat-sale-orders.sql /etl/compat-vouchers.sql; do
  if [ -f "$f" ]; then
    run_sql_file "$f"
  else
    log "bỏ qua — không thấy $f"
  fi
done

# ── 4. Connector CDC ────────────────────────────────────────────────────
step "4/5  Đăng ký connector"
register() {
  name="$1"; file="$2"
  if curl -sf -o /dev/null "$CONNECT/connectors/$name"; then
    log "$name đã đăng ký"
  else
    # envsubst thay ${env:VAR} trong file config — bí mật không nằm trong git
    sed 's/\${env:\([A-Z_]*\)}/\${\1}/g' "$file" | envsubst > /tmp/$name.json
    code=$(curl -s -o /tmp/$name.out -w '%{http_code}' -X POST "$CONNECT/connectors" \
             -H 'Content-Type: application/json' --data @/tmp/$name.json)
    if [ "$code" = "201" ] || [ "$code" = "409" ]; then
      log "$name đã tạo"
    else
      log "$name LỖI (HTTP $code): $(head -c 300 /tmp/$name.out)"
    fi
  fi
}
register postgres-source-connector /config-json/pg-source-connector.json
register minio-sink-connector      /config-json/minio-sink-connector.json

echo ""
echo "  trạng thái connector:"
curl -s "$CONNECT/connectors?expand=status" 2>/dev/null \
  | sed 's/,/,\n/g' | grep -E '"name"|"state"' | head -8 | sed 's/^/    /' || true

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Xong. Web: http://localhost:${CLIENT_PORT:-3000}"
echo "════════════════════════════════════════════════════════════"
