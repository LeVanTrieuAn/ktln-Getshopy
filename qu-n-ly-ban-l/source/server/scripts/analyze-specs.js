const { prisma } = require('../src/db');

async function analyze() {
  // 1. Coverage by category
  const rows = await prisma.$queryRawUnsafe(`
    SELECT category_id,
           COUNT(*)::int as total,
           COUNT(CASE WHEN description LIKE '%<table>%' THEN 1 END)::int as with_table
    FROM "Product"
    WHERE is_deleted = false
    GROUP BY category_id
    ORDER BY total DESC
    LIMIT 30
  `);
  console.log('=== SPECS COVERAGE BY CATEGORY ===');
  rows.forEach(r => {
    const pct = r.total > 0 ? Math.round(r.with_table / r.total * 100) : 0;
    console.log(`${r.category_id.padEnd(30)} total:${String(r.total).padStart(6)}  with_specs:${String(r.with_table).padStart(6)}  (${pct}%)`);
  });

  // 2. Sample descriptions from categories WITHOUT specs tables
  const noSpecCats = rows.filter(r => r.with_table === 0 && r.total > 100).slice(0, 5);
  for (const cat of noSpecCats) {
    console.log(`\n=== SAMPLE: ${cat.category_id} (${cat.total} products, 0 specs) ===`);
    const samples = await prisma.product.findMany({
      where: { category_id: cat.category_id, is_deleted: false, description: { not: null } },
      take: 2,
      select: { name: true, description: true },
    });
    samples.forEach(s => {
      console.log(`  Name: ${s.name}`);
      console.log(`  Desc: ${(s.description || '').slice(0, 200)}`);
      console.log();
    });
  }

  // 3. Check how many products have no description at all
  const noDesc = await prisma.product.count({ where: { is_deleted: false, description: null } });
  const emptyDesc = await prisma.product.count({ where: { is_deleted: false, description: '' } });
  console.log(`\n=== MISSING DESCRIPTIONS ===`);
  console.log(`NULL description: ${noDesc}`);
  console.log(`Empty description: ${emptyDesc}`);

  process.exit(0);
}

analyze().catch(e => { console.error(e); process.exit(1); });
