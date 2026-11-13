#!/usr/bin/env sh
#
# Khởi tạo hệ BigData sau khi compose up. Chạy trong service `bootstrap`.
#
# Bốn việc, tất cả đều IDEMPOTENT — chạy lại bao nhiêu lần cũng ra cùng kết quả:
#   0. (trước bốn việc) Schema ClickHouse + nhánh nóng realtime.orders_live
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
#
# Số câu lỗi để lại trong SQL_ERRORS cho bước nào cần xét (14/11/2026, bước 0b).
# Vòng while chạy trong subshell của pipe nên biến đếm bên trong mất khi ra
# ngoài — đếm qua một file tạm.
run_sql_file() {
  f="$1"; n=0; err=0; errf=$(mktemp)
  # sed bỏ phần sau `--` trên TỪNG dòng, khi xuống dòng còn nguyên vẹn.
  stmts=$(sed 's/--.*$//' "$f" | awk 'BEGIN{RS=";"} NF {gsub(/\n/," "); print}')
  echo "$stmts" | while IFS= read -r stmt; do
    [ -z "$(echo "$stmt" | tr -d '[:space:]')" ] && continue
    if out=$(curl -sS --fail-with-body "$CH" --data-binary "$stmt" 2>&1); then
      n=$((n+1))
    else
      err=$((err+1)); echo x >> "$errf"
      log "LỖI: $(echo "$out" | head -c 120)"
    fi
  done
  SQL_ERRORS=$(wc -l < "$errf" | tr -d ' '); rm -f "$errf"
  # Đếm lại ngoài subshell của pipe
  total=$(echo "$stmts" | grep -c '[^[:space:]]' || true)
  if [ "$SQL_ERRORS" = 0 ]; then
    log "đã chạy $total câu lệnh từ $(basename "$f")"
  else
    log "đã chạy $total câu lệnh từ $(basename "$f") — $SQL_ERRORS câu LỖI"
  fi
}

# Chuỗi hàm bảng postgresql(...) cho ClickHouse đọc thẳng Postgres. Mật khẩu
# lấy từ môi trường lúc chạy, không nằm trong git. ClickHouse tự che tham số
# mật khẩu của hàm này trong system.query_log.
pg() { echo "postgresql('$PG_HOST','$POSTGRES_DB','$1','$POSTGRES_USER','$POSTGRES_PASSWORD')"; }

# Che mật khẩu Postgres nếu nó lọt vào thông báo lỗi trước khi in ra log.
# Dùng index() thay vì sed: mật khẩu có ký tự đặc biệt của regex thì sed khớp sai.
mask() {
  awk '{ pw = ENVIRON["POSTGRES_PASSWORD"]
         if (pw != "") while ((i = index($0, pw)) > 0)
           $0 = substr($0, 1, i - 1) "***" substr($0, i + length(pw))
         print }'
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

# ── 0b. Nhánh nóng: Kafka engine -> MV -> realtime.orders_live ──────────
# Thêm 14/11/2026. Trước đó scripts/etl/realtime-layer.sql chỉ được chạy TAY,
# nên khi volume kltn_clickhouse_data bị tạo lại (23/10/2026) nhánh nóng mất
# hẳn — không bảng, không consumer group — mà không có lỗi nào: dashboard chỉ
# đơn giản là không có số trực tiếp. Phát hiện 13/11/2026. Đặt vào bootstrap
# thì volume mới nào cũng có lại nhánh nóng ngay lần `compose up` đầu tiên.
#
# Thứ tự có chủ đích:
#   a. đếm orders_live TRƯỚC khi chạy file — view vừa gắn là consumer bắt đầu
#      ghi, đếm sau thì không biết bảng rỗng thật hay vừa nhận vài message;
#   b. chạy file (idempotent, xem đầu file .sql);
#   c. bảng rỗng thì CHỜ consumer nhận partition rồi mới nạp bù 7 ngày từ
#      Postgres. Consumer đã đứng ở một offset thì mọi thay đổi sau đó đi qua
#      Kafka, mọi thay đổi trước đó đã nằm trong ảnh chụp Postgres — không có
#      khe hở. Nạp bù trước khi consumer đứng chỗ thì thay đổi rơi vào giữa hai
#      mốc bị mất (khi group bắt đầu từ cuối topic).
#
# Lỗi ở bước này KHÔNG dừng bootstrap — giống các bước 0, 3b, 4: connector CDC
# ở bước 4 quan trọng hơn và không phụ thuộc nhánh nóng. Nhưng lỗi được in
# NGAY tại đây và in LẠI ở cuối, để không chìm giữa log.
HOT_FAIL=""

# Nạp bù: đơn của 7 ngày gần nhất (khớp TTL của orders_live), đọc từ Postgres —
# nguồn chân lý — qua hàm bảng postgresql(), cùng cách bước 3 kéo masterdata.
#
# _event_ts của dòng nạp bù = 1970-01-01 00:00:00.000 (epoch 0), cố ý. Đây là
# cột phiên bản của ReplacingMergeTree: khi gộp, dòng có _event_ts lớn nhất
# thắng. Mọi sự kiện CDC thật có ts_ms > 0, nên BẤT KỲ sự kiện nào của cùng đơn
# tới sau (hoặc đã tới trước, khi Kafka được đọc lại) đều thắng dòng nạp bù —
# đúng ý: CDC phản ánh trạng thái mới hơn hoặc bằng ảnh chụp. Không dùng now():
# một sự kiện CDC có ts_ms nhỏ hơn lúc nạp nhưng tới sau sẽ thua ảnh chụp dù nó
# không cũ hơn. Không dùng order_date: Postgres không có updated_at nên không
# biết ảnh chụp thực sự "mới" tới đâu, và order_date do ứng dụng ghi. Epoch 0
# còn là dấu nhận biết: WHERE _event_ts = toDateTime64(0, 3, 'UTC') là dòng nạp
# bù, nên loại chúng ra khi đo độ trễ.
#
# Cột thời gian: Postgres lưu timestamp(3) KHÔNG múi giờ (Prisma ghi giờ UTC),
# Debezium coi giá trị đó là UTC. Đi qua toString() rồi đọc lại với 'UTC' để
# kết quả không phụ thuộc múi giờ máy chủ ClickHouse.
#
# Mốc 7 ngày được tính sẵn thành chuỗi hằng: so sánh cột với hằng thì ClickHouse
# đẩy điều kiện xuống Postgres (cột date có index Order_date_idx), thay vì kéo
# cả 3 triệu đơn về rồi mới lọc.
hot_backfill() {
  tries=0
  printf "  chờ consumer Kafka của ClickHouse nhận partition"
  until [ "$(ch_query "SELECT count() FROM system.kafka_consumers
                       WHERE database = 'realtime' AND table = 'kafka_orders'
                         AND length(assignments.partition_id) > 0" | tr -d '[:space:]')" -ge 1 ] 2>/dev/null; do
    tries=$((tries + 1))
    if [ "$tries" -ge 20 ]; then
      echo " — chưa nhận sau 60 s"
      log "CẢNH BÁO: Kafka chưa giao partition — vẫn nạp bù; nếu group bắt đầu từ cuối topic thì thay đổi giữa lúc nạp và lúc consumer đứng chỗ có thể thiếu"
      break
    fi
    printf "."; sleep 3
  done
  [ "$tries" -lt 20 ] && echo " xong"

  since=$(ch_query "SELECT toString(toDateTime(now() - INTERVAL 7 DAY, 'UTC'))" | tr -d '\n')
  sql="INSERT INTO realtime.orders_live
         (order_id, customer_id, total, sub_total, shipping_fee, discount,
          status, payment_method, payment_status, province,
          order_date, paid_at, _event_ts, _is_deleted, _arrived_at)
       SELECT id, ifNull(customer_id, 0), toInt64(total), toInt64(subTotal),
              toInt64(shippingFee), toInt64(discount),
              status, payment_method, payment_status, ifNull(province, ''),
              toDateTime64(toString(date), 3, 'UTC'),
              toDateTime64(toString(paid_at), 3, 'UTC'),
              toDateTime64(0, 3, 'UTC'), 0, now64(3)
       FROM $(pg Order)
       WHERE date >= '$since'
       SETTINGS max_block_size = 100000"
  if out=$(curl -sS --fail-with-body "$CH" --data-binary "$sql" 2>&1); then
    n=$(ch_query "SELECT count() FROM realtime.orders_live WHERE _event_ts = toDateTime64(0, 3, 'UTC')" | tr -d '\n')
    log "nạp bù $n đơn có date >= $since (UTC) từ Postgres"
  else
    log "LỖI nạp bù: $(echo "$out" | mask | head -c 300)"
    return 1
  fi
}

step "0b/5  Nhánh nóng ClickHouse (Kafka -> realtime.orders_live)"
if [ ! -f /etl/realtime-layer.sql ]; then
  HOT_FAIL="không thấy /etl/realtime-layer.sql"
else
  rows_before=$(ch_query "SELECT toUInt64(ifNull(sum(total_rows), 0)) FROM system.tables
                          WHERE database = 'realtime' AND name = 'orders_live'" | tr -d '[:space:]')
  run_sql_file /etl/realtime-layer.sql
  objs=$(ch_query "SELECT count() FROM system.tables WHERE database = 'realtime'
                   AND name IN ('kafka_orders', 'orders_live', 'mv_orders_live')" | tr -d '[:space:]')
  case "$rows_before" in ''|*[!0-9]*) rows_before="?" ;; esac
  if [ "$SQL_ERRORS" != 0 ] || [ "$objs" != 3 ]; then
    HOT_FAIL="$SQL_ERRORS câu lệnh lỗi, có $objs/3 đối tượng (kafka_orders, orders_live, mv_orders_live)"
  elif [ "$rows_before" = "?" ]; then
    HOT_FAIL="không đếm được orders_live trước khi tạo — bỏ qua nạp bù"
  elif [ "$rows_before" = 0 ]; then
    hot_backfill || HOT_FAIL="nạp bù từ Postgres lỗi (xem dòng LỖI ở trên)"
  else
    log "orders_live đã có $rows_before dòng — không nạp bù, consumer đọc tiếp từ offset đã commit"
  fi
  [ -z "$HOT_FAIL" ] && log "kafka_orders -> mv_orders_live -> orders_live: sẵn sàng"
fi
[ -n "$HOT_FAIL" ] && log "LỖI NHÁNH NÓNG: $HOT_FAIL"

# ── 1. Bucket MinIO ─────────────────────────────────────────────────────
step "1/5  Bucket MinIO"
# Gọi thẳng S3 API, curl tự ký AWS SigV4 (region mặc định của MinIO: us-east-1).
# Thay cho `mc` từ 04/10/2026 — image mc không còn kéo được (scripts/bootstrap/Dockerfile).
# HEAD bucket: 200 = đã có, 404 = chưa có. Mã khác (403 sai khoá, 000 không kết
# nối được) thì dừng, như `mc alias set` trước đây dưới `set -e` — nhưng có báo lý do.
s3() {
  curl -s -o /dev/null -w '%{http_code}' --aws-sigv4 "aws:amz:us-east-1:s3" \
       --user "$MINIO_ACCESS_KEY:$MINIO_SECRET_KEY" "$@" || true
}
code=$(s3 -I "$MINIO/$MINIO_BUCKET")
case "$code" in
  200) log "bucket '$MINIO_BUCKET' đã có" ;;
  404) code=$(s3 -X PUT "$MINIO/$MINIO_BUCKET")
       if [ "$code" = 200 ]; then log "đã tạo bucket '$MINIO_BUCKET'"
       else log "LỖI: tạo bucket '$MINIO_BUCKET' trả HTTP $code"; fi ;;
  403) log "LỖI: MinIO từ chối khoá (HTTP 403) — kiểm MINIO_ACCESS_KEY / MINIO_SECRET_KEY trong .env"; exit 1 ;;
  *)   log "LỖI: không kiểm được bucket '$MINIO_BUCKET' tại $MINIO (HTTP $code)"; exit 1 ;;
esac

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

# pg() định nghĩa ở đầu file (bước 0b cũng dùng).

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

# In lại lỗi nhánh nóng ở cuối (xem bước 0b): lỗi ở giữa log rất dễ bị lướt qua,
# mà nhánh nóng hỏng thì không có triệu chứng nào khác ngoài bảng trống.
if [ -n "$HOT_FAIL" ]; then
  echo ""
  echo "  !! NHÁNH NÓNG CHƯA CHẠY: $HOT_FAIL"
  echo "  !! realtime.orders_live sẽ trống — chạy lại: docker compose up --no-deps bootstrap"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Xong. Web: http://localhost:${CLIENT_PORT:-3000}"
echo "════════════════════════════════════════════════════════════"
