const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const TOTAL_PRODUCTS = 50000;
  const BATCH_SIZE = 5000;

  const categories = ['c1', 'c2', 'c3', 'c4'];
  const brands = ['br1', 'br2', 'br3'];
  const branches = ['HCM001', 'HCM002', 'HN001'];

  console.log(`Bắt đầu seed ${TOTAL_PRODUCTS} sản phẩm...`);

  for (let i = 0; i < TOTAL_PRODUCTS / BATCH_SIZE; i++) {
    const batch = [];
    for (let j = 0; j < BATCH_SIZE; j++) {
      const idx = i * BATCH_SIZE + j;
      const cat = categories[Math.floor(Math.random() * categories.length)];
      const brand = brands[Math.floor(Math.random() * brands.length)];
      const originalPrice = 1000000 + Math.floor(Math.random() * 20000000); // 1M to 21M
      const price = originalPrice * (1 - Math.floor(Math.random() * 20) / 100); // 0-20% discount
      
      batch.push({
        name: `Mock Product ${idx + 1} (${cat})`,
        price: price,
        original_price: originalPrice,
        category_id: cat,
        brand_id: brand,
        stock: 50 + Math.floor(Math.random() * 500),
        rating: 3 + Math.random() * 2,
        sold: Math.floor(Math.random() * 100),
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400&auto=format&fit=crop',
        images: JSON.stringify(['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400&auto=format&fit=crop']),
        description: 'Đây là mô tả sản phẩm mock sinh tự động để test tải và phân tích dữ liệu AI.',
        variants: JSON.stringify([]),
        branch_ids: JSON.stringify(branches),
        is_banner: false,
        is_deleted: false
      });
    }

    try {
      await prisma.product.createMany({ data: batch });
      console.log(`Đã seed batch ${i + 1}/${TOTAL_PRODUCTS / BATCH_SIZE} (${(i + 1) * BATCH_SIZE} products)`);
    } catch (e) {
      console.error(`Lỗi khi seed batch ${i + 1}:`, e);
      break;
    }
  }

  console.log('Seed hoàn tất!');
  await prisma.$disconnect();
}

main().catch(console.error);
