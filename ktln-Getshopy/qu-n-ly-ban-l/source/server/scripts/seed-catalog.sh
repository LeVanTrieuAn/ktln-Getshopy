#!/bin/sh
# Seed CATALOG: 600.000 sản phẩm + tồn kho — CHẠY TAY, tách khỏi `docker compose up`
# từ 04/10/2026 (lần `up` đầu trước đây chặn cả stack 10–20 phút):
#
#   docker compose --profile seed run --rm seed-catalog
#
# Mất 10–20 phút, mỗi máy chạy một lần. Idempotent: fill-600k chỉ THÊM cho tới đủ
# 600.000, sản phẩm có sẵn giữ nguyên — chạy lại không nhân bản.
set -eu
cd /app

# Schema + seed nền: dùng lại đúng entrypoint của server (migrate, seed nền nếu DB
# trống). `true` đứng chỗ lệnh khởi động server ở cuối entrypoint — xong thì thoát.
SEED_CATALOG_RUNNING=1 sh /app/docker-entrypoint.sh true

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  Seed catalog 600.000 sản phẩm"
echo "══════════════════════════════════════════════════════════"
echo "  [1/3] Sinh sản phẩm tới đủ 600.000 (vài phút)..."
node scripts/fill-600k.js
echo "  [2/3] Tồn kho cho mọi sản phẩm và biến thể (~1,2 triệu dòng)..."
node scripts/ensure-inventory.js
echo "  [3/3] Voucher, hạng thành viên, tài khoản test, flash sale..."
node scripts/seed-demo.js
echo ""
echo "  ✅ Catalog xong. Bộ dữ liệu demo (chỉ máy demo):"
echo "       docker compose --profile seed run --rm seed-data"
