/**
 * migrate-to-local.js
 * ─────────────────────────────────────────────────────────────────
 * Copy data từ Supabase → Local PostgreSQL
 * Dùng đúng schema local (prisma/schema.prisma)
 * ─────────────────────────────────────────────────────────────────
 * Brand   : id, name, is_deleted, created_at
 * Category: id, name, icon, parent_id, sort_order, created_at
 * Product : id, name, price, original_price, category_id, brand_id,
 *           stock, rating, sold, image, images, description,
 *           variants, branch_ids, is_banner, is_deleted, created_at
 * ─────────────────────────────────────────────────────────────────
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const getEnv = (key) => {
  const m = envContent.match(new RegExp(`${key}="?([^"\\n]+)"?`));
  return m ? m[1].trim() : '';
};

const SUPABASE_URL = getEnv('DIRECT_URL').replace('?pgbouncer=true', '');
const LOCAL_URL    = 'postgresql://getshopy:getshopy_dev_password@localhost:5432/getshopy';

console.log('📡 Supabase:', SUPABASE_URL.replace(/:([^:@]+)@/, ':***@'));
console.log('🏠 Local   :', LOCAL_URL);

const src = new Pool({ connectionString: SUPABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 });
const dst = new Pool({ connectionString: LOCAL_URL, max: 5 });

// ── 1. BRANDS ─────────────────────────────────────────────────────
async function migrateBrands() {
  console.log('\n[1/3] 🏷️  Migrating Brands...');
  const { rows } = await src.query('SELECT id, name, is_deleted, created_at FROM "Brand" ORDER BY created_at');
  console.log(`  Found: ${rows.length} brands`);

  await dst.query('TRUNCATE TABLE "Brand" CASCADE');
  for (const r of rows) {
    await dst.query(
      `INSERT INTO "Brand" (id, name, is_deleted, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      [r.id, r.name, r.is_deleted ?? false, r.created_at]
    );
  }
  console.log(`  ✅ ${rows.length} brands OK`);
}

// ── 2. CATEGORIES ──────────────────────────────────────────────────
async function migrateCategories() {
  console.log('\n[2/3] 📂 Migrating Categories...');
  const { rows } = await src.query('SELECT id, name, icon, parent_id, sort_order, created_at FROM "Category" ORDER BY created_at');
  console.log(`  Found: ${rows.length} categories`);

  await dst.query('TRUNCATE TABLE "Category" CASCADE');
  for (const r of rows) {
    await dst.query(
      `INSERT INTO "Category" (id, name, icon, parent_id, sort_order, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [r.id, r.name, r.icon ?? null, r.parent_id ?? null, r.sort_order ?? 0, r.created_at]
    );
  }
  console.log(`  ✅ ${rows.length} categories OK`);
}

// ── 3. PRODUCTS (cursor-based, không dùng OFFSET) ─────────────────
async function migrateProducts() {
  console.log('\n[3/3] 📦 Migrating Products (600,000 SP)...');

  const countRes = await src.query('SELECT COUNT(*)::int as cnt FROM "Product" WHERE is_deleted = false');
  const total = countRes.rows[0].cnt;
  console.log(`  Total: ${total.toLocaleString()} products`);

  await dst.query('TRUNCATE TABLE "Product" CASCADE');

  const BATCH = 1000;
  let lastId = 0;        // cursor — BigInt id
  let done = 0;
  const t0 = Date.now();

  while (true) {
    // Cursor-based: luôn O(1) bất kể vị trí
    const { rows } = await src.query(
      `SELECT id, name, price, original_price, category_id, brand_id,
              stock, rating, sold, image, images, description,
              variants, branch_ids, is_banner, is_deleted, created_at
       FROM "Product"
       WHERE is_deleted = false AND id > $1
       ORDER BY id
       LIMIT $2`,
      [lastId, BATCH]
    );
    if (!rows.length) break;

    // Bulk insert
    const vals = [];
    const ph = rows.map((r, i) => {
      const b = i * 17;
      vals.push(
        r.id, r.name, r.price, r.original_price,
        r.category_id, r.brand_id, r.stock ?? 0,
        r.rating ?? 5, r.sold ?? 0, r.image ?? null,
        JSON.stringify(r.images ?? []), r.description ?? null,
        JSON.stringify(r.variants ?? []), JSON.stringify(r.branch_ids ?? []),
        r.is_banner ?? false, r.is_deleted ?? false, r.created_at
      );
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14},$${b+15},$${b+16},$${b+17})`;
    });

    await dst.query(
      `INSERT INTO "Product"
       (id, name, price, original_price, category_id, brand_id,
        stock, rating, sold, image, images, description,
        variants, branch_ids, is_banner, is_deleted, created_at)
       VALUES ${ph.join(',')}
       ON CONFLICT (id) DO NOTHING`,
      vals
    );

    lastId = rows[rows.length - 1].id; // cập nhật cursor
    done += rows.length;

    const elapsed = (Date.now() - t0) / 1000;
    const rps = Math.round(done / Math.max(elapsed, 1));
    const eta = rps > 0 ? Math.ceil((total - done) / rps) : 0;
    const etaStr = eta > 60 ? `${Math.floor(eta/60)}m${eta%60}s` : `${eta}s`;
    const pct = ((done / total) * 100).toFixed(1);
    process.stdout.write(`\r  ${done.toLocaleString()}/${total.toLocaleString()} (${pct}%)  ${rps.toLocaleString()}/s  ETA:${etaStr}   `);
  }

  console.log(`\n  ✅ ${done.toLocaleString()} products OK`);
}


// ── MAIN ───────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 MIGRATE SUPABASE → LOCAL POSTGRESQL');
  console.log('═'.repeat(55));

  // Test local connection
  try {
    await dst.query('SELECT 1');
    console.log('✅ Local PostgreSQL OK');
  } catch (e) {
    console.error('❌ Không kết nối local DB:', e.message);
    console.error('   → Hãy chạy: docker-compose up postgres -d');
    process.exit(1);
  }

  const t0 = Date.now();
  await migrateBrands();
  await migrateCategories();
  await migrateProducts();
  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);

  // Verify
  console.log('\n\n📊 Xác nhận:');
  const [brands, cats, prods] = await Promise.all([
    dst.query('SELECT COUNT(*) as c FROM "Brand"'),
    dst.query('SELECT COUNT(*) as c FROM "Category"'),
    dst.query('SELECT COUNT(*) as c FROM "Product"'),
  ]);
  console.log(`  Brands    : ${brands.rows[0].c}`);
  console.log(`  Categories: ${cats.rows[0].c}`);
  console.log(`  Products  : ${Number(prods.rows[0].c).toLocaleString()}`);

  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║       MIGRATION HOÀN THÀNH! 🎉              ║');
  console.log(`  ║  Thời gian: ${elapsed.padStart(6)} phút                    ║`);
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('\n  👉 Bước tiếp theo: Cập nhật .env để dùng LOCAL_URL');
  console.log(`     DATABASE_URL="${LOCAL_URL}"`);
  console.log(`     DIRECT_URL="${LOCAL_URL}"`);
}

main()
  .catch(e => { console.error('\n❌', e.message); process.exit(1); })
  .finally(async () => { await src.end(); await dst.end(); });
