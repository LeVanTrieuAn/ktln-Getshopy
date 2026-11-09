const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Brands rỗng (0 sản phẩm)
  const rows = await prisma.$queryRaw`
    SELECT b.id, b.name, COUNT(p.id)::int AS cnt
    FROM "Brand" b
    LEFT JOIN "Product" p ON p.brand_id = b.id AND p.is_deleted = false
    WHERE b.is_deleted = false
    GROUP BY b.id, b.name
    ORDER BY cnt ASC, b.name
  `;
  const empty = rows.filter(r => r.cnt === 0);
  const nonEmpty = rows.filter(r => r.cnt > 0);

  console.log(`\n=== BRANDS CÓ SẢN PHẨM (${nonEmpty.length}) ===`);
  nonEmpty.forEach(r => console.log(`  [${r.id}] ${r.name.padEnd(24)} ${r.cnt}`));

  console.log(`\n=== BRANDS RỖNG (${empty.length}) ===`);
  empty.forEach(r => console.log(`  [${r.id}] ${r.name}`));

  // 80 SP đang là Khác để xem tên thực tế
  const khac = await prisma.brand.findFirst({ where: { name: { in: ['Khác', 'Other'] } } });
  if (khac) {
    const samples = await prisma.product.findMany({
      where: { brand_id: khac.id, is_deleted: false },
      select: { name: true },
      take: 80,
    });
    console.log(`\n=== MẪU SP "Khác" (${samples.length}) ===`);
    samples.forEach(p => console.log('  ' + p.name));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
