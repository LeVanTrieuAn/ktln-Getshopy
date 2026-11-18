#!/bin/sh
set -eu

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=getshopy}"
: "${POSTGRES_USER:=getshopy}"
: "${POSTGRES_PASSWORD:=getshopy_dev_password}"

# Docker Compose normally supplies these URLs. Building them here keeps the
# stack usable with only `docker compose up --build` as well.
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"
  export DATABASE_URL
fi

if [ -z "${DIRECT_URL:-}" ]; then
  DIRECT_URL="$DATABASE_URL"
  export DIRECT_URL
fi

# ── DB_PREP (19/11/2026) ─────────────────────────────────────────────────────
# off  = KHÔNG ĐỤNG DB: bỏ qua toàn bộ phần dưới (migrate, ràng buộc tồn kho, seed nền,
#        ensure-inventory, seed-demo) và khoá khởi động — chỉ chạy server. Deploy (CD,
#        deploy/cd/pull-deploy.ps1) LUÔN đặt off: deploy chỉ thay code. Thay đổi DB
#        (migration) là bước làm tay riêng — CD chặn deploy nếu còn migration chưa áp.
# auto = như trước: máy mới dựng lần đầu tự migrate + seed nền (mặc định của compose).
if [ "${DB_PREP:-auto}" = "off" ]; then
  echo "DB_PREP=off — không chạy migrate/seed, không đụng DB; chỉ khởi động server."
  exec "$@"
fi

# ── Khoá khởi động (18/11/2026, cân bằng tải) ───────────────────────────────
# compose chạy N bản server (deploy.replicas) và cả N cùng khởi động. Phần chuẩn bị DB bên
# dưới — migrate, ràng buộc tồn kho (DROP/CREATE TRIGGER), seed nền khi DB trống,
# ensure-inventory, seed-demo — không chịu được chạy song song: hai bản cùng thấy "DB trống"
# là seed hai lần, DROP/CREATE TRIGGER cùng lúc thì lỗi và `set -e` làm container thoát.
# Chạy lại CHÍNH script này dưới advisory lock của Postgres (scripts/with-startup-lock.js),
# lần lượt từng bản, rồi mới khởi động server. seed-catalog gọi script này cũng xếp hàng chung.
# STARTUP_LOCK=0 để bỏ khoá (chắc chắn chỉ chạy một bản).
if [ -z "${GETSHOPY_STARTUP_LOCK_HELD:-}" ] && [ "${STARTUP_LOCK:-1}" != "0" ]; then
  GETSHOPY_STARTUP_LOCK_HELD=1 node scripts/with-startup-lock.js sh "$0" true
  exec "$@"
fi

echo "Synchronising PostgreSQL schema..."
# migrate deploy chứ không phải db push: db push đồng bộ schema nhưng KHÔNG ghi
# vào _prisma_migrations, nên mất lịch sử và không biết bản nào đã áp dụng.
# Có migration thì dùng migrate; chưa có thì mới rơi về db push.
attempt=0
if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  # Baseline (08/10/2026): prisma/migrations/ trước đây bị .gitignore nên máy clone đồng
  # bộ schema bằng `db push` — DB có bảng nhưng không có _prisma_migrations. migrate deploy
  # trên DB như vậy dừng ở lỗi P3005 và server không lên. Gặp trường hợp đó thì db push
  # MỘT lần cho khớp schema.prisma mới nhất (như máy đó vẫn làm), rồi đánh dấu mọi
  # migration là đã áp — quy trình baselining của Prisma:
  # https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining
  # Từ lần khởi động sau, máy đó đi đường migrate deploy như mọi máy.
  DB_STATE=$(node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.\$queryRawUnsafe('SELECT to_regclass(\'public.\"_prisma_migrations\"\') IS NOT NULL AS h, to_regclass(\'public.\"User\"\') IS NOT NULL AS t')
      .then(r => console.log(r[0].h ? 'history' : (r[0].t ? 'pushed' : 'fresh')))
      .catch(() => console.log('unknown'))
      .finally(() => p.\$disconnect());
  " 2>/dev/null || echo "unknown")
  if [ "$DB_STATE" = "pushed" ]; then
    echo "DB dựng bằng db push, chưa có lịch sử migration — baseline một lần..."
    ./node_modules/.bin/prisma db push --skip-generate
    for m in prisma/migrations/*/; do
      ./node_modules/.bin/prisma migrate resolve --applied "$(basename "$m")"
    done
  fi
  until ./node_modules/.bin/prisma migrate deploy; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 15 ]; then
      echo "Unable to apply migrations after $attempt attempts."
      exit 1
    fi
    echo "Migration failed; retrying in 2 seconds ($attempt/15)..."
    sleep 2
  done
else
until ./node_modules/.bin/prisma db push --skip-generate; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 15 ]; then
    echo "Unable to synchronise the PostgreSQL schema after $attempt attempts."
    exit 1
  fi
  echo "Schema synchronisation failed; retrying in 2 seconds ($attempt/15)..."
  sleep 2
done
fi

# Ràng buộc tồn kho (CHECK + trigger giữ Product.stock = tổng tồn biến thể). Idempotent,
# chạy mỗi lần khởi động — nằm ngoài migrations/ để đúng cả máy vẫn đi đường db push.
# Áp không được thì báo to nhưng KHÔNG chặn server khởi động.
echo "Ràng buộc tồn kho (prisma/sql/inventory_constraints.sql)..."
./node_modules/.bin/prisma db execute --file prisma/sql/inventory_constraints.sql --schema prisma/schema.prisma \
  || echo "!! Không áp được ràng buộc tồn kho — server vẫn chạy, xem lỗi ở trên"

echo "Seeding baseline application data..."
# Từ 04/10/2026 `up` CHỈ seed NỀN (vài giây): tài khoản, chi nhánh, danh mục, hãng,
# tồn kho, voucher, tài khoản test — đủ để đăng nhập và đi hết luồng mua hàng.
# Catalog 600k (10–20 phút) và bộ dữ liệu demo tách thành lệnh riêng, chạy khi cần:
#   docker compose --profile seed run --rm seed-catalog
#   docker compose --profile seed run --rm seed-data
# Lý do tách: lần `up` đầu trước đây chặn cả stack 10–20 phút (client chờ server healthy).
#
# Điều kiện seed nền: DB TRỐNG THẬT — chưa có tài khoản nào VÀ chưa có sản phẩm nào.
# seed-categories/seed-brands XOÁ rồi tạo lại danh mục/hãng và gán lại cho mọi sản phẩm
# đang có — chạy trên DB đã có catalog là xáo trộn toàn bộ catalog. Các bước còn lại
# idempotent.
# Đếm lỗi (Postgres hết kết nối, chập chờn...) thì DỪNG container, KHÔNG coi là 0: bản
# trước in "0" khi lỗi -> một lần đếm hỏng là seed nền chạy trên DB thật (19/11/2026).
count_of() {
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.$1.count().then(n => { console.log(n); p.\$disconnect(); }).catch(() => { console.log('ERR'); p.\$disconnect(); });
  " 2>/dev/null || echo "ERR"
}
USER_COUNT=$(count_of user)
PRODUCT_COUNT_BEFORE=$(count_of product)
case "$USER_COUNT $PRODUCT_COUNT_BEFORE" in
  *ERR*)
    echo "!! Không đếm được User/Product trong Postgres — DỪNG, không seed (tránh seed nhầm lên DB có dữ liệu)."
    exit 1
    ;;
esac

if [ "$USER_COUNT" = "0" ] && [ "$PRODUCT_COUNT_BEFORE" = "0" ]; then
  echo "══════════════════════════════════════════════════════════"
  echo "  DB trống — seed NỀN (nhẹ, vài giây)"
  echo "══════════════════════════════════════════════════════════"
  echo "  [1/5] Tài khoản, chi nhánh, dữ liệu gốc (db.json)..."
  node src/seed.js
  echo "  [2/5] 49 danh mục (8 cha + 41 con)..."
  node scripts/seed-categories.js
  echo "  [3/5] Hãng theo phân khúc..."
  node scripts/seed-brands.js
  # Product và Inventory phải khớp 1-1. Thiếu bản ghi tồn kho thì mặt hàng đó không
  # đặt được, và lỗi chỉ lộ ra khi khách bấm đặt hàng.
  echo "  [4/5] Tồn kho cho sản phẩm hiện có..."
  node scripts/ensure-inventory.js
  echo "  [5/5] Voucher, hạng thành viên, tài khoản test, flash sale..."
  node scripts/seed-demo.js
else
  echo "Đã có dữ liệu ($USER_COUNT tài khoản, $PRODUCT_COUNT_BEFORE sản phẩm) — bỏ qua seed nền."
  # Vá tồn kho còn thiếu (dữ liệu seed bằng bản cũ, hoặc thêm sản phẩm bằng script rời).
  node scripts/ensure-inventory.js
  node scripts/seed-demo.js
fi

# Catalog trống thì BÁO TO thay vì chạy im lặng với vài sản phẩm — đúng loại lỗi
# "không có gì báo ra" mà điều kiện seed cũ từng gặp. seed-catalog tự gọi entrypoint
# này nên đặt SEED_CATALOG_RUNNING để khỏi nhắc chính nó.
PRODUCT_COUNT=$(count_of product)
if [ -z "${SEED_CATALOG_RUNNING:-}" ] && [ "$PRODUCT_COUNT" -lt 1000 ] 2>/dev/null; then
  echo "══════════════════════════════════════════════════════════"
  echo "  !! Catalog mới có $PRODUCT_COUNT sản phẩm — cửa hàng gần như trống."
  echo "     Seed 600.000 sản phẩm (10–20 phút, mỗi máy một lần):"
  echo "       docker compose --profile seed run --rm seed-catalog"
  echo "══════════════════════════════════════════════════════════"
fi

exec "$@"
