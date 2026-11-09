const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Xóa hết brand rỗng (không có SP) trừ brand-other
  const result = await prisma.$executeRaw`
    DELETE FROM "Brand"
    WHERE is_deleted = false
      AND id != 'brand-other'
      AND NOT EXISTS (
        SELECT 1 FROM "Product" p WHERE p.brand_id = "Brand".id AND p.is_deleted = false
      )
  `;
  console.log(`Đã xóa ${result} brand rỗng`);

  // Đếm brand còn lại có SP
  const remaining = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT b.id)::int AS cnt FROM "Brand" b
    JOIN "Product" p ON p.brand_id = b.id AND p.is_deleted = false
    WHERE b.is_deleted = false
  `;
  console.log(`Brand còn lại có SP: ${remaining[0].cnt}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
