const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Tìm Nothing brand
  const nothing = await prisma.brand.findFirst({ where: { name: 'Nothing' } });
  if (!nothing) { console.log('Không tìm thấy brand Nothing'); return; }

  // Chuyển SP về brand-other (Khác)
  const moved = await prisma.product.updateMany({
    where: { brand_id: nothing.id },
    data: { brand_id: 'brand-other' }
  });
  console.log(`Đã chuyển ${moved.count} SP từ Nothing → Khác`);

  // Xóa brand Nothing
  await prisma.brand.delete({ where: { id: nothing.id } });
  console.log('Đã xóa brand Nothing');
}
main().catch(console.error).finally(() => prisma.$disconnect());
