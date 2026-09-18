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

echo "Synchronising PostgreSQL schema..."
# migrate deploy chứ không phải db push: db push đồng bộ schema nhưng KHÔNG ghi
# vào _prisma_migrations, nên mất lịch sử và không biết bản nào đã áp dụng.
# Có migration thì dùng migrate; chưa có thì mới rơi về db push.
attempt=0
if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
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

echo "Seeding baseline application data..."
# Điều kiện seed kiểm CẢ User LẪN Product.
#
# Trước đây chỉ kiểm User: truncate Product để seed lại thì entrypoint vẫn thấy
# User còn đó nên bỏ qua toàn bộ seed, và hệ thống chạy với 0 sản phẩm mà không
# báo gì. Mỗi bước seed bên dưới đều idempotent nên chạy lại là an toàn.
USER_COUNT=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.user.count().then(n => { console.log(n); p.\$disconnect(); }).catch(() => { console.log(0); p.\$disconnect(); });
" 2>/dev/null || echo "0")

PRODUCT_COUNT=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.product.count().then(n => { console.log(n); p.\$disconnect(); }).catch(() => { console.log(0); p.\$disconnect(); });
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ] || [ "$PRODUCT_COUNT" = "0" ]; then
  echo "══════════════════════════════════════════════════════════"
  echo "  No existing data found — running FULL seed pipeline..."
  echo "══════════════════════════════════════════════════════════"

  # Step 1: Baseline seed (users, branches, basic categories/brands from db.json)
  echo ""
  echo "  [1/6] Seeding baseline data (users, branches)..."
  node src/seed.js

  # Step 2: Full 49 categories (8 parents + 41 children)
  echo ""
  echo "  [2/6] Seeding 49 categories (8 parents + 41 children)..."
  node scripts/seed-categories.js

  # Step 3: Full 67+ brands
  echo ""
  echo "  [3/6] Seeding 67+ brands..."
  node scripts/seed-brands.js

  # Step 4: Fill 600,000 products
  echo ""
  echo "  [4/6] Filling 600,000 products (this may take several minutes)..."
  node scripts/fill-600k.js

  # Step 5: Tồn kho
  # Product và Inventory phải khớp 1-1. Thiếu bước này thì mọi sản phẩm không
  # có bản ghi tồn kho, và MỌI đơn hàng báo hết hàng — lỗi chỉ lộ ra khi khách
  # bấm đặt hàng, không có cảnh báo nào lúc khởi động.
  echo ""
  echo "  [5/6] Khởi tạo tồn kho từ Product.stock..."
  node scripts/ensure-inventory.js

  echo ""
  echo "  [6/6] Dữ liệu demo (voucher, hạng thành viên, tài khoản test)..."
  node scripts/seed-demo.js

  echo ""
  echo "══════════════════════════════════════════════════════════"
  echo "  ✅ Full seed pipeline completed!"
  echo "══════════════════════════════════════════════════════════"
else
  echo "Data already seeded ($USER_COUNT users, $PRODUCT_COUNT products) — skipping seed."

  # Vá tồn kho còn thiếu. Cần thiết khi dữ liệu được seed bằng bản entrypoint
  # cũ (chưa có bước tồn kho), hoặc khi thêm sản phẩm bằng script rời.
  node scripts/ensure-inventory.js
  node scripts/seed-demo.js
fi

exec "$@"
