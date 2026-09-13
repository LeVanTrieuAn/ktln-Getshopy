#!/usr/bin/env bash
#
# Kéo masterdata từ Postgres (Ecom) lên ClickHouse.
#
# Masterdata KHÔNG đi qua CDC/Kafka/MinIO: đây là dữ liệu chiều, thay đổi rất
# ít, không cần lịch sử thay đổi. Dựng cả một đường CDC cho chúng là thừa.
# Chỉ Order/OrderItem mới cần CDC.
#
# Quy trình: CREATE IF NOT EXISTS -> TRUNCATE -> INSERT SELECT -> đối chiếu số dòng.
#
# Vì sao TRUNCATE chứ không DROP + CREATE AS SELECT:
#   - Schema giữ nguyên, không phụ thuộc vào kiểu dữ liệu mà SELECT suy ra.
#     Nguồn đổi kiểu một cột là bảng đích im lặng đổi theo, mọi thứ phía sau lệch.
#   - DROP làm gãy mọi view / dbt model đang trỏ vào bảng.
#   - TRUNCATE xoá sạch dữ liệu cũ — cần thiết khi nguồn vừa được thay hoàn toàn
#     (ví dụ merge bộ dữ liệu 600k sản phẩm mới): bản ghi cũ không còn trong
#     nguồn sẽ biến mất khỏi đích, thay vì nằm lại làm bẩn báo cáo.
#
# Chạy lại bất cứ lúc nào — mỗi lần là một ảnh chụp mới, an toàn khi lặp.
#
#   ./scripts/sync-masterdata.sh
#   CH_CONTAINER=clickhouse_local ./scripts/sync-masterdata.sh
#
set -euo pipefail

CH_CONTAINER="${CH_CONTAINER:-getshopy-clickhouse-1}"
PG_HOST="${PG_SOURCE_HOST:-postgres}:${PG_SOURCE_PORT:-5432}"
PG_DB="${PG_SOURCE_DB:-getshopy}"
PG_USER="${PG_SOURCE_USER:-getshopy}"
PG_PASS="${PG_SOURCE_PASSWORD:-}"
if [ -z "$PG_PASS" ]; then
  echo "Thiếu PG_SOURCE_PASSWORD." >&2
  echo "  export PG_SOURCE_PASSWORD=<mật khẩu Postgres>" >&2
  exit 1
fi

ch()  { docker exec -i "$CH_CONTAINER" clickhouse-client "$@"; }
chq() { docker exec -i "$CH_CONTAINER" clickhouse-client --query "$1"; }
pg()  { echo "postgresql('$PG_HOST','$PG_DB','$1','$PG_USER','$PG_PASS')"; }

echo "Nguồn : $PG_HOST/$PG_DB"
echo "Đích  : container $CH_CONTAINER, database 'masterdata'"
echo

chq "CREATE DATABASE IF NOT EXISTS masterdata"

# ── 1. Schema tường minh — KHÔNG suy ra từ SELECT ────────────────────────
ch --multiquery <<'SQL'
CREATE TABLE IF NOT EXISTS masterdata.dim_products (
    product_id     String,
    product_name   String,
    category_id    String,
    brand_id       String,
    price          Int64,          -- VND, đơn vị đồng
    original_price Int64,
    stock          Int32,
    sold           Int32,
    rating         Float32,
    is_deleted     UInt8,          -- 1 = ngừng bán, phải lọc trước khi sang AI-Rec
    _synced_at     DateTime
) ENGINE = MergeTree() ORDER BY product_id;

CREATE TABLE IF NOT EXISTS masterdata.dim_brands (
    brand_id String, brand_name String, is_deleted UInt8, _synced_at DateTime
) ENGINE = MergeTree() ORDER BY brand_id;

CREATE TABLE IF NOT EXISTS masterdata.dim_categories (
    category_id String, category_name String, parent_id String,
    sort_order Int32, _synced_at DateTime
) ENGINE = MergeTree() ORDER BY category_id;

CREATE TABLE IF NOT EXISTS masterdata.dim_branches (
    branch_id String, branch_name String, address String,
    is_deleted UInt8, _synced_at DateTime
) ENGINE = MergeTree() ORDER BY branch_id;

CREATE TABLE IF NOT EXISTS masterdata.dim_customers (
    customer_id String, full_name String, email String, phone String,
    loyalty_points Int32, provider String, created_at DateTime, _synced_at DateTime
) ENGINE = MergeTree() ORDER BY customer_id;

CREATE TABLE IF NOT EXISTS masterdata.dim_vouchers (
    voucher_id String, code String, type String, value Int64,
    min_order_value Int64, max_discount Int64, used_count Int32,
    is_deleted UInt8, _synced_at DateTime
) ENGINE = MergeTree() ORDER BY voucher_id;
SQL

# ── 2. TRUNCATE rồi INSERT, từng bảng một ───────────────────────────────
sync() {
  local tbl="$1" src="$2" cols="$3"
  local before after
  before=$(chq "SELECT count() FROM masterdata.$tbl")
  chq "TRUNCATE TABLE masterdata.$tbl"
  # max_block_size: nạp theo lô để không dồn cả bảng vào bộ nhớ khi nguồn lớn
  chq "INSERT INTO masterdata.$tbl SELECT $cols, now() FROM $(pg "$src") SETTINGS max_block_size = 100000"
  after=$(chq "SELECT count() FROM masterdata.$tbl")
  local src_n
  src_n=$(chq "SELECT count() FROM $(pg "$src")")
  if [ "$after" = "$src_n" ]; then
    printf "  %-16s %8s -> %-8s  (nguồn %s)  OK\n" "$tbl" "$before" "$after" "$src_n"
  else
    printf "  %-16s %8s -> %-8s  (nguồn %s)  ✖ LỆCH\n" "$tbl" "$before" "$after" "$src_n"
    return 1
  fi
}

echo "Bảng             trước ->  sau       đối chiếu nguồn"
echo "-------------------------------------------------------"
sync dim_products   Product     "toString(id), name, category_id, brand_id, toInt64(price), toInt64(original_price), toInt32(stock), toInt32(sold), toFloat32(rating), if(is_deleted,1,0)"
sync dim_brands     Brand       "id, name, if(is_deleted,1,0)"
sync dim_categories Category    "id, name, ifNull(parent_id,''), toInt32(sort_order)"
sync dim_branches   Branch      "id, name, address, if(is_deleted,1,0)"
sync dim_customers  B2CCustomer "toString(id), full_name, email, ifNull(phone,''), toInt32(loyalty_points), provider, created_at"
sync dim_vouchers   Voucher     "toString(id), code, type, toInt64(value), toInt64(min_order_value), toInt64(max_discount), toInt32(used_count), if(is_deleted,1,0)"

echo
echo "Toàn vẹn khoá ngoại:"
chq "SELECT
  countIf(c.category_id = '') AS sp_mo_coi_danh_muc,
  countIf(b.brand_id = '')    AS sp_mo_coi_thuong_hieu,
  countIf(p.is_deleted = 1)   AS sp_ngung_ban
FROM masterdata.dim_products p
LEFT JOIN masterdata.dim_categories c ON c.category_id = p.category_id
LEFT JOIN masterdata.dim_brands b ON b.brand_id = p.brand_id
FORMAT Vertical"
