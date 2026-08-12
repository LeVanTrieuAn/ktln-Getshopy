const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Đang xóa 50.000 dữ liệu mock cũ...");
  await prisma.product.deleteMany({
    where: { description: { contains: 'mock' } }
  });
  console.log("Xóa dữ liệu cũ thành công. Bắt đầu seed 50.000 sản phẩm với tên và hình ảnh riêng biệt...");

  const TOTAL_PRODUCTS = 50000;
  const BATCH_SIZE = 5000;

  const categories = ['c1', 'c2', 'c3', 'c4'];
  const brands = ['br1', 'br2', 'br3'];
  const branches = ['HCM001', 'HCM002', 'HN001'];

  const realBrands = ['Apple', 'Samsung', 'Sony', 'Dell', 'Asus', 'Lenovo', 'HP', 'LG', 'Xiaomi', 'Oppo'];
  const productTypes = ['Laptop', 'Smart TV', 'Smartphone', 'Tablet', 'Tai nghe', 'Đồng hồ thông minh', 'Màn hình', 'Loa Bluetooth'];
  const series = ['Pro', 'Max', 'Ultra', 'Plus', 'Lite', 'Mini', 'Air', 'Series X', 'Edition', 'Gaming'];
  const suffixes = ['256GB', '512GB', '1TB', '2024', '5G', 'OLED', '4K', '120Hz', 'Titanium'];

  for (let i = 0; i < TOTAL_PRODUCTS / BATCH_SIZE; i++) {
    const batch = [];
    for (let j = 0; j < BATCH_SIZE; j++) {
      const idx = i * BATCH_SIZE + j;
      const b = realBrands[Math.floor(Math.random() * realBrands.length)];
      const pt = productTypes[Math.floor(Math.random() * productTypes.length)];
      const sr = series[Math.floor(Math.random() * series.length)];
      const sf = suffixes[Math.floor(Math.random() * suffixes.length)];
      
      const name = `${b} ${pt} ${sr} ${sf} - Mẫu ${idx + 1}`;
      const cat = categories[Math.floor(Math.random() * categories.length)];
      const brand = brands[Math.floor(Math.random() * brands.length)];
      
      const originalPrice = 500000 + Math.floor(Math.random() * 40000000); // 500k to 40M
      const price = originalPrice * (1 - Math.floor(Math.random() * 30) / 100); // 0-30% discount
      
      // Use picsum.photos with unique ID (1 to 1000)
      const imageId = (idx % 1000) + 1; 
      const imageUrl = `https://picsum.photos/id/${imageId}/400/400`;
      const imageUrl2 = `https://picsum.photos/id/${(imageId % 1000) + 1}/400/400`;
      
      batch.push({
        name: name,
        price: price,
        original_price: originalPrice,
        category_id: cat,
        brand_id: brand,
        stock: 50 + Math.floor(Math.random() * 500),
        rating: 3 + Math.random() * 2,
        sold: Math.floor(Math.random() * 100),
        image: imageUrl,
        images: JSON.stringify([imageUrl, imageUrl2]),
        description: `Đây là sản phẩm mock [v2]. Chiếc ${name} mang đến trải nghiệm tuyệt vời cho người dùng.`,
        variants: JSON.stringify([{color: 'Black'}, {color: 'White'}]),
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
