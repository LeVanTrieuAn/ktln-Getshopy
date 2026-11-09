const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT name FROM "Product"
    WHERE brand_id = 'brand-other' AND is_deleted = false
    ORDER BY name
    LIMIT 300
  `;
  console.log(`\n=== ${rows.length} tên SP phân biệt đang là Khác ===\n`);
  rows.forEach(r => console.log(r.name));
}
main().catch(console.error).finally(() => prisma.$disconnect());
