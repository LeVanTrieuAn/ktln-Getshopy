const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // 1. Get ALL distinct name prefixes (first 3 words)
  console.log('=== All name prefixes (top 100) ===');
  const rows = await p.$queryRawUnsafe(`
    SELECT 
      CASE 
        WHEN name ILIKE 'Điện thoại %' THEN 'Điện thoại'
        WHEN name ILIKE 'Laptop %' THEN 'Laptop'
        WHEN name ILIKE 'MacBook %' THEN 'MacBook'
        WHEN name ILIKE 'iPad %' THEN 'iPad'
        WHEN name ILIKE 'Máy tính bảng %' THEN 'Máy tính bảng'
        WHEN name ILIKE 'Apple Watch %' THEN 'Apple Watch'
        WHEN name ILIKE 'Galaxy Watch %' THEN 'Galaxy Watch'
        WHEN name ILIKE 'Đồng hồ %' THEN 'Đồng hồ'
        WHEN name ILIKE 'Garmin %' THEN 'Garmin'
        WHEN name ILIKE 'Tai nghe %' THEN 'Tai nghe'
        WHEN name ILIKE 'Loa %' THEN 'Loa'
        WHEN name ILIKE 'Sạc %' THEN 'Sạc'
        WHEN name ILIKE 'Cáp %' THEN 'Cáp'
        WHEN name ILIKE 'Ốp lưng %' THEN 'Ốp lưng'
        WHEN name ILIKE 'Bàn phím %' THEN 'Bàn phím'
        WHEN name ILIKE 'Chuột %' THEN 'Chuột'
        WHEN name ILIKE 'Camera %' THEN 'Camera'
        WHEN name ILIKE 'Webcam %' THEN 'Webcam'
        WHEN name ILIKE 'Balo %' THEN 'Balo'
        WHEN name ILIKE 'Túi %' THEN 'Túi'
        WHEN name ILIKE 'USB %' THEN 'USB'
        WHEN name ILIKE 'Thẻ nhớ %' THEN 'Thẻ nhớ'
        WHEN name ILIKE 'Ổ cứng %' THEN 'Ổ cứng'
        WHEN name ILIKE 'Miếng dán %' THEN 'Miếng dán'
        WHEN name ILIKE 'Hub %' THEN 'Hub'
        WHEN name ILIKE 'Router %' THEN 'Router'
        WHEN name ILIKE 'Micro %' THEN 'Micro'
        WHEN name ILIKE 'Máy chiếu %' THEN 'Máy chiếu'
        WHEN name ILIKE 'Pin sạc %' THEN 'Pin sạc'
        WHEN name ILIKE 'Kính %' THEN 'Kính'
        WHEN name ILIKE 'Quạt %' THEN 'Quạt'
        WHEN name ILIKE 'Bút %' THEN 'Bút'
        WHEN name ILIKE 'Dây đeo %' THEN 'Dây đeo'
        WHEN name ILIKE 'Giá đỡ %' THEN 'Giá đỡ'
        WHEN name ILIKE 'Bảng vẽ %' THEN 'Bảng vẽ'
        WHEN name ILIKE 'Phủ phím %' THEN 'Phủ phím'
        WHEN name ILIKE 'Phần mềm %' THEN 'Phần mềm'
        WHEN name ILIKE 'Giá treo %' THEN 'Giá treo'
        WHEN name ILIKE 'Miếng lót %' THEN 'Miếng lót'
        WHEN name ILIKE 'Ống kính %' THEN 'Ống kính'
        WHEN name ILIKE 'Chuông cửa %' THEN 'Chuông cửa'
        ELSE split_part(name, ' ', 1) || ' ' || split_part(name, ' ', 2)
      END AS prefix,
      COUNT(*)::int AS cnt
    FROM "Product"
    WHERE is_deleted = false
    GROUP BY prefix
    ORDER BY cnt DESC
    LIMIT 100
  `);
  rows.forEach(r => console.log(`  ${r.prefix}: ${r.cnt}`));

  // 2. Check what categories are currently empty (sub-categories)
  console.log('\n=== Categories with 0 products ===');
  const cats = await p.category.findMany();
  for (const cat of cats) {
    const cnt = await p.product.count({ where: { category_id: cat.id, is_deleted: false } });
    if (cnt === 0) console.log(`  ${cat.id} (${cat.name}): 0`);
  }

  await p.$disconnect();
})();
