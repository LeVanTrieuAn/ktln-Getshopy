#!/usr/bin/env sh
# Xuất dữ liệu để mang sang máy khác.
#
# VÌ SAO KHÔNG XUẤT VOLUME THÔ:
# Thư mục dữ liệu của PostgreSQL gắn chặt với kiến trúc CPU và phiên bản
# server đã ghi ra nó. Máy này chạy arm64 (Apple Silicon), máy Windows gần
# như chắc chắn là amd64 — copy thẳng data dir qua là trò may rủi, và
# PostgreSQL không hỗ trợ. pg_dump xuất ra SQL nên chạy đâu cũng được.
#
# Kèm theo đó: volume postgres_data nặng 1.5GB, bản dump nén chỉ 45MB. Phần
# chênh là index, bloat, WAL — máy kia tự dựng lại hết.
#
# KHÔNG XUẤT ClickHouse, MinIO, Redis: toàn bộ là dữ liệu DẪN XUẤT. Máy mới
# chạy lại pipeline (bootstrap + CDC + dbt) là có đủ. Xuất chúng ra chỉ làm
# gói nặng thêm, mà còn rủi ro lệch phiên bản.
set -eu

OUT="${1:-./data-export}"
STAMP=$(date +%Y%m%d-%H%M%S)
DIR="$OUT/kltn-$STAMP"
mkdir -p "$DIR"

PG=$(docker compose ps -q postgres)
[ -n "$PG" ] || { echo "Postgres chưa chạy. Chạy: docker compose up -d postgres"; exit 1; }

echo "→ Xuất PostgreSQL (nguồn sự thật)..."
# -Fc = định dạng custom: nén sẵn, và pg_restore chọn được bảng nào cần khôi
# phục thay vì phải chạy cả file.
# --no-owner --no-acl: máy kia có thể dùng tên role khác, giữ owner vào là
# lỗi "role does not exist" lúc restore.
docker exec "$PG" pg_dump -U "${POSTGRES_USER:-getshopy}" -d "${POSTGRES_DB:-getshopy}" \
  -Fc --no-owner --no-acl > "$DIR/postgres.dump"

echo "→ Xuất model AI-Rec (nếu đã train)..."
if docker run --rm -v kltn_ai_models:/d alpine sh -c '[ -n "$(ls -A /d 2>/dev/null)" ]'; then
  docker run --rm -v kltn_ai_models:/d -v "$(cd "$DIR" && pwd):/out" \
    alpine tar czf /out/ai_models.tgz -C /d .
else
  echo "   (chưa có model, bỏ qua)"
fi

# Ghi lại môi trường đã tạo ra bản dump. Restore lỗi thì đây là chỗ đầu tiên
# cần nhìn — lệch major version của Postgres là pg_restore báo lỗi khó hiểu.
{
  echo "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "source_arch=$(docker version --format '{{.Server.Arch}}')"
  echo "pg_version=$(docker exec "$PG" postgres --version)"
  echo "products=$(docker exec "$PG" psql -U "${POSTGRES_USER:-getshopy}" -d "${POSTGRES_DB:-getshopy}" -tAc 'SELECT count(*) FROM "Product"')"
  echo "orders=$(docker exec "$PG" psql -U "${POSTGRES_USER:-getshopy}" -d "${POSTGRES_DB:-getshopy}" -tAc 'SELECT count(*) FROM "Order"')"
  echo "customers=$(docker exec "$PG" psql -U "${POSTGRES_USER:-getshopy}" -d "${POSTGRES_DB:-getshopy}" -tAc 'SELECT count(*) FROM "B2CCustomer"')"
} > "$DIR/MANIFEST.txt"

echo
echo "Xong: $DIR"
du -sh "$DIR"/* | sed 's/^/  /'
echo
echo "Mang cả thư mục này sang máy kia, kèm .env (KHÔNG commit .env lên git)."
