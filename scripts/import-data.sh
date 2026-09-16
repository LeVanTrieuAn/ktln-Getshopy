#!/usr/bin/env sh
# Khôi phục dữ liệu trên máy mới. Chạy TRƯỚC khi start các service còn lại.
#
# THỨ TỰ QUAN TRỌNG. docker-entrypoint.sh của server tự seed 600.000 sản phẩm
# khi thấy bảng Product rỗng. Start cả stack rồi mới restore thì hai bên ghi
# chồng lên nhau: seed đang chạy dở, restore chèn vào giữa, kết quả là dữ
# liệu lai không ai biết đúng sai. Vì vậy script này chỉ dựng postgres.
set -eu

DIR="${1:-}"
[ -n "$DIR" ] && [ -f "$DIR/postgres.dump" ] || {
  echo "Dùng: sh scripts/import-data.sh <thư-mục-export>"
  echo "Ví dụ: sh scripts/import-data.sh ./data-export/kltn-20260916-101500"
  exit 1
}

[ -f "$DIR/MANIFEST.txt" ] && { echo "── Nguồn ──"; cat "$DIR/MANIFEST.txt"; echo; }

echo "→ Chỉ dựng postgres (chưa start server, để nó không kịp seed)..."
docker compose up -d postgres
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-getshopy}" >/dev/null 2>&1; do
  echo "   chờ postgres..."; sleep 2
done

PG=$(docker compose ps -q postgres)
DB="${POSTGRES_DB:-getshopy}"
USER="${POSTGRES_USER:-getshopy}"

echo "→ Xoá schema public rồi tạo lại..."
docker exec -i "$PG" psql -U "$USER" -d "$DB" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

echo "→ Khôi phục..."
# --no-owner: giữ quyền sở hữu theo user hiện tại, không đòi role của máy cũ.
# Bỏ qua mã thoát khác 0 vì pg_restore hay cảnh báo về extension/comment
# không tồn tại — cảnh báo, không phải lỗi. Số liệu kiểm bên dưới mới là bằng chứng.
docker exec -i "$PG" pg_restore -U "$USER" -d "$DB" --no-owner --no-acl < "$DIR/postgres.dump" || true

echo "→ Đối chiếu số liệu:"
docker exec "$PG" psql -U "$USER" -d "$DB" -t -c \
  "SELECT 'products', count(*) FROM \"Product\"
   UNION ALL SELECT 'orders', count(*) FROM \"Order\"
   UNION ALL SELECT 'customers', count(*) FROM \"B2CCustomer\"
   UNION ALL SELECT 'inventory', count(*) FROM \"Inventory\";"

if [ -f "$DIR/ai_models.tgz" ]; then
  echo "→ Khôi phục model AI-Rec..."
  docker run --rm -v kltn_ai_models:/d -v "$(cd "$DIR" && pwd):/in" \
    alpine sh -c 'rm -rf /d/* && tar xzf /in/ai_models.tgz -C /d'
fi

echo
echo "So số liệu trên với MANIFEST.txt. Khớp thì chạy tiếp:"
echo "   docker compose --profile bigdata up -d"
echo
echo "ClickHouse và parquet trong MinIO KHÔNG có trong gói này — chúng là dữ"
echo "liệu dẫn xuất. bootstrap sẽ kéo masterdata và đăng ký connector; Debezium"
echo "snapshot lại bảng Order/OrderItem; sau đó chạy dbt run để dựng lại"
echo "staging/fact/serving."
