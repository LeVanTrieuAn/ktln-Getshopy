/**
 * benchmark_perf.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Đo benchmark toàn diện cho Getshopy:
 *   1. Supabase RTT        — ping TCP đến pooler (aws-0-ap-northeast-1)
 *   2. DB Query trực tiếp  — COUNT + SELECT toàn bộ Product (no limit)
 *   3. DB Insert batch     — insert 100 sản phẩm rồi xóa
 *   4. API Endpoint        — GET /api/b2c/products (no branch, no limit)
 *   5. Server startup      — thời gian Express ready
 *
 * Cách chạy:
 *   node benchmark_perf.js [--runs 5] [--api-host localhost] [--api-port 8080]
 *
 * Yêu cầu: server đang chạy trên --api-port (hoặc chạy embedded)
 */

'use strict';

const http = require('http');
const net  = require('net');
const { performance } = require('perf_hooks');
const path = require('path');
const fs   = require('fs');

// ── Parse CLI args ───────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const getArg  = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : def; };
const RUNS    = parseInt(getArg('--runs', '5'), 10);
const API_HOST = getArg('--api-host', 'localhost');
const API_PORT = parseInt(getArg('--api-port', '8080'), 10);

// ── Load .env từ server directory ────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=\s]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  });
  console.log('[env] Loaded from', envPath);
} else {
  console.warn('[env] .env not found at', envPath, '— using process.env');
}

// ── Extract Supabase host/port ────────────────────────────────────────────────
function parseSupabaseConn(url) {
  try {
    const u = new URL(url);
    return { host: u.hostname, port: parseInt(u.port || '5432', 10), user: u.username };
  } catch { return null; }
}

const SUPABASE_POOLER = parseSupabaseConn(process.env.DATABASE_URL || '');
const SUPABASE_DIRECT = parseSupabaseConn(process.env.DIRECT_URL || '');

// ── Prisma (direct connection for raw benchmarks) ────────────────────────────
let prisma;
try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } }
  });
} catch (e) {
  console.error('[prisma] Cannot load Prisma:', e.message);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Đo một hàm async N lần, trả về { avg, min, max, p95, runs } tính bằng ms */
async function measure(label, fn, n = RUNS) {
  const times = [];
  let lastResult;
  process.stdout.write(`  ${label.padEnd(42)}`);
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    lastResult = await fn();
    times.push(performance.now() - t0);
    process.stdout.write('.');
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / n;
  const p95 = times[Math.floor(n * 0.95)] ?? times[times.length - 1];
  const stats = { avg: +avg.toFixed(2), min: +times[0].toFixed(2), max: +times[n - 1].toFixed(2), p95: +p95.toFixed(2), runs: n };
  console.log(`  avg=${stats.avg}ms  min=${stats.min}ms  max=${stats.max}ms  p95=${stats.p95}ms`);
  return { stats, lastResult };
}

/** TCP ping (RTT) — connect + FIN, không send data */
function tcpRTT(host, port, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const sock = net.createConnection({ host, port }, () => {
      const ms = performance.now() - t0;
      sock.destroy();
      resolve(ms);
    });
    sock.setTimeout(timeoutMs, () => { sock.destroy(); reject(new Error('TCP timeout')); });
    sock.on('error', reject);
  });
}

/** HTTP GET — trả về { statusCode, bodyLength, ms } */
function httpGet(urlStr, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const t0  = performance.now();
    const req = http.request({
      hostname : url.hostname,
      port     : url.port || 80,
      path     : url.pathname + url.search,
      method   : 'GET',
      headers  : { 'Accept': 'application/json', ...extraHeaders },
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({
        statusCode : res.statusCode,
        bodyLength : body.length,
        ms         : performance.now() - t0,
        body,
      }));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(new Error('HTTP timeout 60s')); });
    req.end();
  });
}

/** Tính summary table cho in ra cuối */
function fmtRow(label, stats, extra = '') {
  return `| ${label.padEnd(44)} | ${String(stats.avg).padStart(8)} | ${String(stats.min).padStart(7)} | ${String(stats.max).padStart(7)} | ${String(stats.p95).padStart(7)} | ${String(stats.runs).padStart(5)} | ${extra} |`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

const results = {};

async function bench_supabase_rtt() {
  console.log('\n═══ 1. Supabase RTT (TCP ping) ═══════════════════════════════════════════════');

  if (!SUPABASE_POOLER) { console.log('  [skip] DATABASE_URL not set'); return; }

  const { stats: poolerStats } = await measure(
    `PgBouncer pooler  (${SUPABASE_POOLER.host}:${SUPABASE_POOLER.port})`,
    () => tcpRTT(SUPABASE_POOLER.host, SUPABASE_POOLER.port),
    RUNS
  );
  results.rtt_pooler = poolerStats;

  if (SUPABASE_DIRECT && SUPABASE_DIRECT.port !== SUPABASE_POOLER.port) {
    const { stats: directStats } = await measure(
      `Direct connection (${SUPABASE_DIRECT.host}:${SUPABASE_DIRECT.port})`,
      () => tcpRTT(SUPABASE_DIRECT.host, SUPABASE_DIRECT.port),
      RUNS
    );
    results.rtt_direct = directStats;
  }
}

async function bench_db_query() {
  console.log('\n═══ 2. DB Query trực tiếp (Prisma → Supabase) ════════════════════════════════');

  // 2a. COUNT(*)
  const { stats: countStats } = await measure(
    'COUNT(*) Product (no filter)',
    () => prisma.product.count({ where: { is_deleted: false } }),
    RUNS
  );
  results.db_count = countStats;

  // 2b. SELECT tất cả — chỉ lấy id, name, price (không dùng LIMIT)
  const { stats: selectAllStats, lastResult: allRows } = await measure(
    'SELECT id,name,price FROM Product (no LIMIT)',
    () => prisma.$queryRaw`
      SELECT id, name, price, stock, sold, rating
      FROM "Product"
      WHERE is_deleted = false
      ORDER BY id DESC
    `,
    RUNS
  );
  results.db_select_all = { ...selectAllStats, rows: Array.isArray(allRows) ? allRows.length : '?' };
  console.log(`     → rows returned: ${results.db_select_all.rows}`);

  // 2c. SELECT với LIMIT 15 (so sánh)
  const { stats: select15Stats } = await measure(
    'SELECT id,name,price FROM Product LIMIT 15',
    () => prisma.$queryRaw`
      SELECT id, name, price, stock, sold, rating
      FROM "Product"
      WHERE is_deleted = false
      ORDER BY id DESC
      LIMIT 15
    `,
    RUNS
  );
  results.db_select_limit15 = select15Stats;

  // 2d. COUNT + SELECT page-1 (mô phỏng endpoint thực tế)
  const { stats: paginatedStats } = await measure(
    'COUNT + SELECT page 1 (parallel, simulate endpoint)',
    () => Promise.all([
      prisma.product.count({ where: { is_deleted: false } }),
      prisma.product.findMany({
        where: { is_deleted: false },
        orderBy: { id: 'desc' },
        skip: 0, take: 15,
        select: { id: true, name: true, price: true, stock: true, sold: true, rating: true }
      })
    ]),
    RUNS
  );
  results.db_paginated = paginatedStats;
}

async function bench_db_insert() {
  console.log('\n═══ 3. DB Insert Batch (100 records) ═════════════════════════════════════════');

  const TAG = `__bench_${Date.now()}`;

  const { stats: insertStats } = await measure(
    'createMany 100 products',
    async () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        name           : `${TAG}_${i}`,
        price          : 1000000 + i * 1000,
        original_price : 1200000 + i * 1000,
        stock          : 10,
        category_id    : 'benchmark',
        brand_id       : 'benchmark',
        description    : 'Benchmark test product',
        images         : [],
        variants       : [],
        branch_ids     : [],
        is_deleted     : false,
      }));
      return prisma.product.createMany({ data });
    },
    Math.min(RUNS, 3) // insert nặng, chỉ 3 lần
  );
  results.db_insert_100 = insertStats;

  // Cleanup
  await prisma.product.deleteMany({ where: { name: { startsWith: TAG } } });
  console.log(`     → cleanup: deleted benchmark records`);

  // Single insert
  const { stats: singleInsertStats } = await measure(
    'create 1 product (single insert)',
    async () => {
      const p = await prisma.product.create({
        data: {
          name: `${TAG}_single`, price: 999000, original_price: 1200000, stock: 1,
          category_id: 'benchmark', brand_id: 'benchmark',
          description: 'single', images: [], variants: [], branch_ids: [], is_deleted: false,
        }
      });
      await prisma.product.delete({ where: { id: p.id } });
    },
    Math.min(RUNS, 3)
  );
  results.db_insert_single = singleInsertStats;
}

async function bench_api_endpoint() {
  console.log('\n═══ 4. API Endpoint — GET /api/b2c/products ══════════════════════════════════');
  console.log(`   Target: http://${API_HOST}:${API_PORT}`);

  // Health check trước
  try {
    const health = await httpGet(`http://${API_HOST}:${API_PORT}/api/health`);
    console.log(`   [health] status=${health.statusCode}`);
  } catch (e) {
    console.warn(`   [health] FAILED: ${e.message} — server có thể chưa chạy`);
  }

  // 4a. GET products no limit (trả toàn bộ trang 1 với limit rất lớn)
  const { stats: apiNoLimitStats, lastResult: noLimitRes } = await measure(
    'GET /products?limit=99999 (no branch, no filter)',
    () => httpGet(`http://${API_HOST}:${API_PORT}/api/b2c/products?limit=99999&sort=newest`),
    RUNS
  );
  let totalRows = '?';
  try { totalRows = JSON.parse(noLimitRes.body).total; } catch {}
  results.api_products_nolimit = { ...apiNoLimitStats, total_in_db: totalRows, response_bytes: noLimitRes.bodyLength };
  console.log(`     → HTTP ${noLimitRes.statusCode} | body ${(noLimitRes.bodyLength/1024).toFixed(1)} KB | total=${totalRows}`);

  // 4b. GET products page 1 limit 15 (baseline)
  const { stats: apiPage1Stats, lastResult: page1Res } = await measure(
    'GET /products?limit=15&page=1 (no branch)',
    () => httpGet(`http://${API_HOST}:${API_PORT}/api/b2c/products?limit=15&page=1&sort=newest`),
    RUNS
  );
  results.api_products_page1 = { ...apiPage1Stats, response_bytes: page1Res.bodyLength };
  console.log(`     → HTTP ${page1Res.statusCode} | body ${(page1Res.bodyLength/1024).toFixed(1)} KB`);

  // 4c. GET products với branch filter
  const { stats: apiBranchStats, lastResult: branchRes } = await measure(
    'GET /products?limit=15&branch_id=HCM001',
    () => httpGet(`http://${API_HOST}:${API_PORT}/api/b2c/products?limit=15&page=1&branch_id=HCM001&sort=newest`),
    RUNS
  );
  results.api_products_branch = { ...apiBranchStats, response_bytes: branchRes.bodyLength };
  console.log(`     → HTTP ${branchRes.statusCode} | body ${(branchRes.bodyLength/1024).toFixed(1)} KB`);

  // 4d. Flash sales
  const { stats: fsStats } = await measure(
    'GET /flash-sales',
    () => httpGet(`http://${API_HOST}:${API_PORT}/api/b2c/flash-sales`),
    RUNS
  );
  results.api_flash_sales = fsStats;

  // 4e. Categories (cached sau lần 1)
  const { stats: catStats } = await measure(
    'GET /categories (in-memory cache)',
    () => httpGet(`http://${API_HOST}:${API_PORT}/api/b2c/categories`),
    RUNS
  );
  results.api_categories = catStats;
}

async function bench_latency_breakdown() {
  console.log('\n═══ 5. Latency Breakdown (API vs DB vs Network) ══════════════════════════════');

  // Đo RTT network thuần (TCP ping đến server)
  const { stats: serverRTT } = await measure(
    `TCP RTT → localhost:${API_PORT}`,
    () => tcpRTT(API_HOST, API_PORT),
    RUNS
  );
  results.server_tcp_rtt = serverRTT;

  // Breakdown estimate
  const dbMs  = results.db_paginated?.avg || 0;
  const apiMs = results.api_products_page1?.avg || 0;
  const rttMs = results.rtt_pooler?.avg || 0;
  const netMs = results.server_tcp_rtt?.avg || 0;

  const express_overhead = Math.max(0, apiMs - dbMs - netMs).toFixed(1);
  const db_portion_pct   = dbMs > 0 && apiMs > 0 ? ((dbMs / apiMs) * 100).toFixed(1) : '?';

  console.log('\n  ┌─ Breakdown estimate (page 1, limit=15) ───────────────────┐');
  console.log(`  │  Total API latency            : ${apiMs.toFixed(1)} ms`);
  console.log(`  │  ├─ DB query (Prisma direct)  : ${dbMs.toFixed(1)} ms  (${db_portion_pct}% of total)`);
  console.log(`  │  ├─ Supabase RTT (TCP)        : ${rttMs.toFixed(1)} ms`);
  console.log(`  │  ├─ Server TCP overhead       : ${netMs.toFixed(1)} ms`);
  console.log(`  │  └─ Express/serialization est : ~${express_overhead} ms`);
  console.log('  └──────────────────────────────────────────────────────────────┘');

  results.breakdown = {
    api_total_ms       : +apiMs.toFixed(2),
    db_query_ms        : +dbMs.toFixed(2),
    db_portion_pct     : +db_portion_pct,
    supabase_rtt_ms    : +rttMs.toFixed(2),
    express_overhead_ms: +express_overhead,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL REPORT
// ─────────────────────────────────────────────────────────────────────────────

function printReport() {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║              GETSHOPY — PERFORMANCE BENCHMARK REPORT                       ║');
  console.log(`║  ${ts}  (${RUNS} runs each)                                          ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  const header = `| ${'Metric'.padEnd(44)} | ${'avg(ms)'.padStart(8)} | ${'min(ms)'.padStart(7)} | ${'max(ms)'.padStart(7)} | ${'p95(ms)'.padStart(7)} | ${'n'.padStart(5)} | note |`;
  const sep    = `|${'-'.repeat(46)}|${'-'.repeat(10)}|${'-'.repeat(9)}|${'-'.repeat(9)}|${'-'.repeat(9)}|${'-'.repeat(7)}|------|`;
  console.log(header);
  console.log(sep);

  const r = results;
  if (r.rtt_pooler)        console.log(fmtRow('RTT — Supabase PgBouncer (TCP)',   r.rtt_pooler,        'Network only'));
  if (r.rtt_direct)        console.log(fmtRow('RTT — Supabase Direct (TCP)',       r.rtt_direct,        'Network only'));
  if (r.server_tcp_rtt)    console.log(fmtRow('RTT — localhost Express (TCP)',      r.server_tcp_rtt,    ''));
  console.log(sep);
  if (r.db_count)          console.log(fmtRow('DB — COUNT(*) Product',             r.db_count,          ''));
  if (r.db_select_limit15) console.log(fmtRow('DB — SELECT LIMIT 15',              r.db_select_limit15, ''));
  if (r.db_select_all)     console.log(fmtRow('DB — SELECT ALL rows (no LIMIT)',   r.db_select_all,     `${r.db_select_all.rows} rows`));
  if (r.db_paginated)      console.log(fmtRow('DB — COUNT + SELECT p1 (parallel)', r.db_paginated,      'simulate endpoint'));
  console.log(sep);
  if (r.db_insert_single)  console.log(fmtRow('DB — INSERT 1 product',             r.db_insert_single,  ''));
  if (r.db_insert_100)     console.log(fmtRow('DB — INSERT 100 products (batch)',  r.db_insert_100,     'createMany'));
  console.log(sep);
  if (r.api_products_page1)  console.log(fmtRow('API — GET /products (p1,lim15)',    r.api_products_page1,  `${r.api_products_page1.response_bytes} B`));
  if (r.api_products_branch) console.log(fmtRow('API — GET /products (branch filter)',r.api_products_branch, `${r.api_products_branch.response_bytes} B`));
  if (r.api_products_nolimit)console.log(fmtRow('API — GET /products (no LIMIT)',    r.api_products_nolimit,`${r.api_products_nolimit.total_in_db} total rows`));
  if (r.api_flash_sales)     console.log(fmtRow('API — GET /flash-sales',            r.api_flash_sales,     ''));
  if (r.api_categories)      console.log(fmtRow('API — GET /categories (cached)',    r.api_categories,      'cache hit lần 2+'));

  if (r.breakdown) {
    console.log('\n  Latency Breakdown (API page 1 vs components):');
    console.log(`    API total     : ${r.breakdown.api_total_ms} ms`);
    console.log(`    DB query      : ${r.breakdown.db_query_ms} ms  (${r.breakdown.db_portion_pct}% of API time)`);
    console.log(`    Supabase RTT  : ${r.breakdown.supabase_rtt_ms} ms  (network to Japan)`);
    console.log(`    Express/JSON  : ~${r.breakdown.express_overhead_ms} ms  (estimated)`);
  }

  return results;
}

function saveJSON(data) {
  const outPath = path.join(__dirname, `benchmark_perf_${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`\n  Results saved: ${outPath}`);
  return outPath;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Getshopy — Full Performance Benchmark                     ║');
  console.log(`║   Runs per metric: ${RUNS}  |  Target: ${API_HOST}:${API_PORT}             ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  DB : ${(process.env.DATABASE_URL || '').replace(/:([^:@]+)@/, ':***@')}`);
  console.log(`  Supabase pooler: ${SUPABASE_POOLER ? SUPABASE_POOLER.host + ':' + SUPABASE_POOLER.port : 'N/A'}`);

  await bench_supabase_rtt();
  await bench_db_query();
  await bench_db_insert();
  await bench_api_endpoint();
  await bench_latency_breakdown();

  const data = printReport();
  const jsonPath = saveJSON({ ts: new Date().toISOString(), runs: RUNS, results: data });

  await prisma.$disconnect();
  return jsonPath;
}

main().catch(async e => {
  console.error('\n[FATAL]', e.message);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
