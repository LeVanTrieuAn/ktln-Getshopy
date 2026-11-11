#!/usr/bin/env node
'use strict';
/**
 * remap-product-images.js — thay ảnh picsum.photos của catalog tổng hợp bằng ảnh
 * sản phẩm THẬT cùng loại (xem lib/real-image-pool.js cho thứ tự ưu tiên).
 * ─────────────────────────────────────────────────────────────────
 * Chỉ sửa 2 cột Product.image / Product.images, và CHỈ ở dòng còn ảnh picsum:
 * chạy lại không đụng gì thêm, sản phẩm đã có ảnh thật giữ nguyên.
 *
 * Không ảnh hưởng luồng BigData: Product không nằm trong CDC (chỉ Order,
 * OrderItem); dim_products của dbt không lấy cột ảnh.
 *
 * SAO LƯU TRƯỚC (từ thư mục gốc dự án; ./backups nằm ngoài git):
 *   docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\copy (SELECT id, image, images FROM \"Product\" WHERE image LIKE '"'"'https://picsum.photos/%'"'"') TO '"'"'/backups/product-images-picsum.csv'"'"' WITH CSV HEADER"'
 *
 * Chạy:
 *   docker compose exec server node scripts/remap-product-images.js [--dry-run]
 */

const { PrismaClient } = require('@prisma/client');
const { loadPools, poolFor } = require('./lib/real-image-pool');

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');
const BATCH_IDS = 50000;
const PICSUM = 'https://picsum.photos/%';

// Cùng công thức với pickImages(): ảnh thứ (id % n), ảnh phụ thứ (id + 1) % n.
const UPDATE_SQL = `
  UPDATE "Product" AS p
  SET image  = m.urls ->> ((p.id % m.n)::int),
      images = CASE WHEN m.n > 1
                    THEN jsonb_build_array(m.urls ->> ((p.id % m.n)::int),
                                           m.urls ->> (((p.id + 1) % m.n)::int))
                    ELSE jsonb_build_array(m.urls ->> 0) END
  FROM (SELECT key, value AS urls, jsonb_array_length(value) AS n
        FROM jsonb_each($1::jsonb)) AS m
  WHERE m.key = p.category_id || '|' || p.brand_id
    AND p.id BETWEEN $2 AND $3
    AND p.image LIKE '${PICSUM}'`;

async function main() {
  const pools = loadPools();
  const pairs = await prisma.$queryRawUnsafe(
    `SELECT category_id, brand_id, count(*)::int AS n, min(id) AS lo, max(id) AS hi
     FROM "Product" WHERE image LIKE $1 GROUP BY 1, 2`, PICSUM);
  if (pairs.length === 0) { console.log('Không còn ảnh picsum nào — không có gì để làm.'); return; }

  const mapping = {};
  const tally = { brand: 0, category: 0, crawl: 0, borrow: 0, none: 0 };
  const missing = {};
  let lo = null, hi = null;
  for (const r of pairs) {
    const pool = poolFor(pools, r.category_id, r.brand_id);
    if (!pool) {
      tally.none += r.n;
      missing[r.category_id] = (missing[r.category_id] || 0) + r.n;
      continue;
    }
    mapping[`${r.category_id}|${r.brand_id}`] = pool.urls;
    tally[pool.tier] += r.n;
    lo = lo === null || r.lo < lo ? r.lo : lo;
    hi = hi === null || r.hi > hi ? r.hi : hi;
  }
  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  const pct = (x) => `${x.toLocaleString('vi-VN')} (${((100 * x) / total).toFixed(1)}%)`;
  console.log(`Sản phẩm còn ảnh picsum: ${total.toLocaleString('vi-VN')}`);
  console.log(`  cùng danh mục + hãng : ${pct(tally.brand)}`);
  console.log(`  cùng danh mục        : ${pct(tally.category)}`);
  console.log(`  crawl bổ sung        : ${pct(tally.crawl)}`);
  console.log(`  mượn danh mục gần    : ${pct(tally.borrow)}`);
  console.log(`  không có ảnh (giữ)   : ${pct(tally.none)}`, Object.keys(missing).length ? missing : '');
  if (DRY || lo === null) { console.log(DRY ? '\n--dry-run: không ghi gì.' : ''); return; }

  const json = JSON.stringify(mapping);
  let done = 0;
  for (let from = BigInt(lo); from <= BigInt(hi); from += BigInt(BATCH_IDS)) {
    const to = from + BigInt(BATCH_IDS) - 1n;
    done += await prisma.$executeRawUnsafe(UPDATE_SQL, json, from, to);
    process.stdout.write(`\r  đã thay ${done.toLocaleString('vi-VN')} / ${(total - tally.none).toLocaleString('vi-VN')}`);
  }
  console.log('\nVACUUM ANALYZE "Product" (dọn bản ghi cũ sau khi sửa ~600k dòng)...');
  // PARALLEL 0: VACUUM song song xin bộ nhớ chia sẻ lớn hơn /dev/shm 64 MB mặc
  // định của container Docker -> lỗi "could not resize shared memory segment ...
  // No space left on device" (gặp thật 11/11/2026). Dữ liệu đã ghi xong từ trước.
  await prisma.$executeRawUnsafe('VACUUM (ANALYZE, PARALLEL 0) "Product"');
  console.log('Xong.');
}

main()
  .catch((e) => { console.error('\nLỗi:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
