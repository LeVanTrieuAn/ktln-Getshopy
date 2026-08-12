// Before/after benchmark for the /products perf fix (docs/OPTIMIZE-P1.md).
// Runs the OLD query pattern (findMany-all + JS slice, as the code used to do)
// and the NEW pattern (DB-level skip/take + count) directly through Prisma,
// against the same seeded 50k-row local Postgres — isolates the DB/query-layer
// gain from network/HTTP overhead.
//
// Usage: node scripts/benchmark-products.js [iterations]
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ITERATIONS = parseInt(process.argv[2], 10) || 15;
const PAGE = 3;
const LIMIT = 12;
const SKIP = (PAGE - 1) * LIMIT;

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function summarize(label, samplesMs) {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  console.log(
    `${label.padEnd(28)} avg=${avg.toFixed(1)}ms  p50=${percentile(sorted, 50).toFixed(1)}ms  ` +
    `p95=${percentile(sorted, 95).toFixed(1)}ms  min=${sorted[0].toFixed(1)}ms  max=${sorted[sorted.length - 1].toFixed(1)}ms`
  );
  return { avg, p50: percentile(sorted, 50), p95: percentile(sorted, 95) };
}

// OLD behavior (before this fix): fetch every matching row, slice in JS.
async function oldFetchAllThenSlice() {
  const start = performance.now();
  const all = await prisma.product.findMany({ where: { is_deleted: false }, orderBy: { id: 'desc' } });
  const total = all.length;
  const page = all.slice(SKIP, SKIP + LIMIT).map(p => ({ ...p, id: Number(p.id) }));
  return { ms: performance.now() - start, total, returned: page.length };
}

// NEW behavior: DB-level pagination + a separate lightweight count, limited select.
async function newDbLevelPagination() {
  const start = performance.now();
  const listSelect = {
    id: true, name: true, price: true, original_price: true, image: true,
    stock: true, rating: true, sold: true, category_id: true, brand_id: true,
    branch_ids: true, is_banner: true, created_at: true
  };
  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where: { is_deleted: false }, orderBy: { id: 'desc' }, skip: SKIP, take: LIMIT, select: listSelect }),
    prisma.product.count({ where: { is_deleted: false } })
  ]);
  const page = rows.map(p => ({ ...p, id: Number(p.id) }));
  return { ms: performance.now() - start, total, returned: page.length };
}

async function run(fn, n) {
  const samples = [];
  let lastResult;
  for (let i = 0; i < n; i++) {
    const r = await fn();
    samples.push(r.ms);
    lastResult = r;
  }
  return { samples, lastResult };
}

async function main() {
  const count = await prisma.product.count();
  console.log(`Seeded products: ${count}`);
  console.log(`Query: page=${PAGE} limit=${LIMIT} (skip=${SKIP}), iterations=${ITERATIONS}\n`);

  const before = await run(oldFetchAllThenSlice, ITERATIONS);
  const beforeStats = summarize('BEFORE (fetch-all + slice)', before.samples);

  const after = await run(newDbLevelPagination, ITERATIONS);
  const afterStats = summarize('AFTER  (skip/take + count)', after.samples);

  const speedup = beforeStats.avg / afterStats.avg;
  console.log(`\nSpeedup (avg): ${speedup.toFixed(1)}x`);
  console.log(`Correctness check — total matches: ${before.lastResult.total === after.lastResult.total} ` +
    `(before=${before.lastResult.total}, after=${after.lastResult.total}), ` +
    `returned matches: ${before.lastResult.returned === after.lastResult.returned}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
