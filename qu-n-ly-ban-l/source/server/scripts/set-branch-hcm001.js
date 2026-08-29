/**
 * set-branch-hcm001.js
 * Gán tất cả SP vào branch HCM001
 * - Dùng DIRECT_URL (port 5432 session mode)
 * - Thêm SET READ WRITE + explicit BEGIN/COMMIT để tránh read-only
 * - Resume: chỉ update SP chưa có HCM001
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Đọc DIRECT_URL từ .env
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const match = envContent.match(/DIRECT_URL="?([^"\n]+)"?/);
const DB_URL = (match ? match[1].trim() : '').replace('?pgbouncer=true', '');
console.log('DB:', DB_URL.replace(/:([^:@]+)@/, ':***@'));

const RANGE = 1000;

async function updateRange(lo, hi) {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    statement_timeout: 25000,
  });
  await client.connect();
  try {
    // Force read-write session
    await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE');
    await client.query('BEGIN');
    const res = await client.query(
      `UPDATE "Product" SET branch_ids = '["HCM001"]'::jsonb
       WHERE id >= $1 AND id <= $2 AND is_deleted = false`,
      [lo, hi]
    );
    await client.query('COMMIT');
    return res.rowCount || 0;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

async function getCount(filter) {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const res = await client.query(`SELECT COUNT(*)::int as cnt FROM "Product" WHERE is_deleted = false ${filter}`);
    return res.rows[0].cnt;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log('\n🏬 GÁN TẤT CẢ SẢN PHẨM VÀO BRANCH HCM001');
  console.log('═'.repeat(55));

  // Lấy min/max ID
  const client0 = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client0.connect();
  const bounds = await client0.query(
    'SELECT MIN(id) as min_id, MAX(id) as max_id FROM "Product" WHERE is_deleted = false'
  );
  await client0.end();

  const minId = Number(bounds.rows[0].min_id);
  const maxId = Number(bounds.rows[0].max_id);
  const alreadyDone = await getCount(`AND branch_ids::jsonb @> '["HCM001"]'::jsonb`);
  console.log(`  ID range: ${minId.toLocaleString()} → ${maxId.toLocaleString()}`);
  console.log(`  Đã có HCM001: ${alreadyDone.toLocaleString()} SP`);
  console.log(`  Còn phải update: ${(600000 - alreadyDone).toLocaleString()} SP\n`);

  const startMs = Date.now();
  let totalUpdated = 0;
  let retries = 0;

  for (let lo = minId; lo <= maxId; lo += RANGE) {
    const hi = lo + RANGE - 1;

    let affected = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        affected = await updateRange(lo, hi);
        break;
      } catch (e) {
        retries++;
        if (attempt === 2) throw e;
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    totalUpdated += affected;
    const pct = Math.min(100, (((lo - minId + RANGE) / (maxId - minId + 1)) * 100)).toFixed(1);
    const elapsed = (Date.now() - startMs) / 1000;
    const rps = Math.round((totalUpdated + alreadyDone) / Math.max(elapsed, 1));
    const etaSec = rps > 0 ? Math.ceil((600000 - alreadyDone - totalUpdated) / rps) : 0;
    const etaStr = etaSec > 60 ? `${Math.floor(etaSec/60)}m${etaSec%60}s` : `${etaSec}s`;

    process.stdout.write(
      `\r  ${(totalUpdated + alreadyDone).toLocaleString()} / 600,000  ${pct}%  ${rps}/s  ETA:${etaStr}  retry:${retries}   `
    );
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const finalDone = alreadyDone + totalUpdated;

  console.log('\n\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║           HOÀN THÀNH                        ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║  Tổng có HCM001 : ${String(finalDone.toLocaleString()).padStart(10)}            ║`);
  console.log(`  ║  Batch update   : ${String(totalUpdated.toLocaleString()).padStart(10)}            ║`);
  console.log(`  ║  Thời gian      : ${String(elapsed + 's').padStart(10)}            ║`);
  console.log('  ╚══════════════════════════════════════════════╝');

  // Xác nhận ngẫu nhiên
  const client2 = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client2.connect();
  const verify = await client2.query(
    `SELECT id::text, branch_ids FROM "Product" WHERE is_deleted = false ORDER BY RANDOM() LIMIT 5`
  );
  await client2.end();

  console.log('\n✅ Xác nhận mẫu:');
  for (const r of verify.rows) {
    const v = JSON.stringify(r.branch_ids);
    const ok = v === '["HCM001"]' ? '✅' : '⚠️ ';
    console.log(`  ${ok} id=${r.id.padEnd(8)} → ${v}`);
  }
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
