const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TOTAL_PRODUCTS = 1_000_000;
const BATCH_SIZE = 5000;

const categories = ['c1', 'c2', 'c3', 'c4'];
const brands = ['br1', 'br2', 'br3'];
const branches = ['HCM001', 'HCM002', 'HN001'];

const realBrands = ['Apple', 'Samsung', 'Sony', 'Dell', 'Asus', 'Lenovo', 'HP', 'LG', 'Xiaomi', 'Oppo'];
const productTypes = ['Laptop', 'Smart TV', 'Smartphone', 'Tablet', 'Tai nghe', 'Đồng hồ thông minh', 'Màn hình', 'Loa Bluetooth'];
const series = ['Pro', 'Max', 'Ultra', 'Plus', 'Lite', 'Mini', 'Air', 'Series X', 'Edition', 'Gaming'];
const suffixes = ['256GB', '512GB', '1TB', '2024', '5G', 'OLED', '4K', '120Hz', 'Titanium'];

async function ensureLookups() {
  await prisma.category.createMany({
    data: categories.map((id) => ({ id, name: `Category ${id}` })),
    skipDuplicates: true,
  });
  await prisma.brand.createMany({
    data: brands.map((id) => ({ id, name: `Brand ${id}` })),
    skipDuplicates: true,
  });
  await prisma.branch.createMany({
    data: branches.map((id) => ({ id, name: `Branch ${id}`, address: `Address ${id}` })),
    skipDuplicates: true,
  });
}

function buildBatch(startIdx, size) {
  const batch = [];
  for (let j = 0; j < size; j++) {
    const idx = startIdx + j;
    const b = realBrands[idx % realBrands.length];
    const pt = productTypes[(idx >> 3) % productTypes.length];
    const sr = series[(idx >> 5) % series.length];
    const sf = suffixes[(idx >> 7) % suffixes.length];

    const name = `${b} ${pt} ${sr} ${sf} - Mẫu ${idx + 1}`;
    const cat = categories[idx % categories.length];
    const brand = brands[idx % brands.length];

    const originalPrice = 500000 + (idx % 40000) * 1000;
    const discountPct = idx % 30;
    const price = originalPrice * (1 - discountPct / 100);

    const imageId = (idx % 1000) + 1;
    const imageUrl = `https://picsum.photos/id/${imageId}/400/400`;
    const imageUrl2 = `https://picsum.photos/id/${((imageId % 1000) + 1)}/400/400`;

    batch.push({
      name,
      price,
      original_price: originalPrice,
      category_id: cat,
      brand_id: brand,
      stock: 50 + (idx % 500),
      rating: 3 + (idx % 20) / 10,
      sold: idx % 100,
      image: imageUrl,
      images: JSON.stringify([imageUrl, imageUrl2]),
      description: `Đây là sản phẩm mock [1M perf test]. Chiếc ${name} mang đến trải nghiệm tuyệt vời cho người dùng.`,
      variants: JSON.stringify([{ color: 'Black' }, { color: 'White' }]),
      branch_ids: JSON.stringify(branches),
      is_banner: false,
      is_deleted: false,
    });
  }
  return batch;
}

async function main() {
  console.log('Seeding lookup tables (categories/brands/branches)...');
  await ensureLookups();

  const existing = await prisma.product.count();
  console.log(`Products hiện có: ${existing}. Mục tiêu: ${TOTAL_PRODUCTS}.`);

  const totalBatches = Math.ceil(TOTAL_PRODUCTS / BATCH_SIZE);
  const start = Date.now();

  for (let i = 0; i < totalBatches; i++) {
    const startIdx = i * BATCH_SIZE;
    const size = Math.min(BATCH_SIZE, TOTAL_PRODUCTS - startIdx);
    const batch = buildBatch(startIdx, size);

    await prisma.product.createMany({ data: batch });

    if ((i + 1) % 10 === 0 || i === totalBatches - 1) {
      const done = (i + 1) * BATCH_SIZE;
      const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`Batch ${i + 1}/${totalBatches} — ${Math.min(done, TOTAL_PRODUCTS)} products — ${elapsedSec}s`);
    }
  }

  const total = await prisma.product.count();
  console.log(`Seed hoàn tất. Tổng số product trong DB: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
