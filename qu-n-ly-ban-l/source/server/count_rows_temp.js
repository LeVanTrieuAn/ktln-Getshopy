const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const [phone, laptop, tablet, total] = await Promise.all([
    p.product.count({ where: { category_id: 'cat-phone',  is_deleted: false } }),
    p.product.count({ where: { category_id: 'cat-laptop', is_deleted: false } }),
    p.product.count({ where: { category_id: 'cat-tablet', is_deleted: false } }),
    p.product.count({ where: { is_deleted: false } }),
  ]);
  console.log('Điện thoại (cat-phone) :', phone.toLocaleString());
  console.log('Laptop     (cat-laptop):', laptop.toLocaleString());
  console.log('Tablet     (cat-tablet):', tablet.toLocaleString());
  console.log('Tổng cộng             :', total.toLocaleString());

  // Các category chính và số SP
  const cats = await p.$queryRaw`
    SELECT c.name, p.category_id, COUNT(*)::int as cnt
    FROM "Product" p
    JOIN "Category" c ON c.id = p.category_id
    WHERE p.is_deleted = false
    GROUP BY p.category_id, c.name
    ORDER BY cnt DESC
    LIMIT 15
  `;
  console.log('\nTop 15 category theo số sản phẩm:');
  for (const r of cats) console.log(`  ${r.category_id.padEnd(35)} ${r.cnt.toLocaleString().padStart(8)} SP  (${r.name})`);

  // Kiểm tra brand sai category
  const phoneWrong = await p.$queryRaw`
    SELECT brand_id, COUNT(*)::int as cnt
    FROM "Product"
    WHERE is_deleted = false AND category_id = 'cat-phone'
      AND brand_id NOT IN ('br-apple','br-samsung','br-oppo','br-xiaomi','br-vivo','br-realme','br-nokia','br-masstel','br-mobell','br-tecno','br-infinix','br-itel','br-honor','br-motorola')
    GROUP BY brand_id ORDER BY cnt DESC LIMIT 10
  `;
  const laptopWrong = await p.$queryRaw`
    SELECT brand_id, COUNT(*)::int as cnt
    FROM "Product"
    WHERE is_deleted = false AND category_id = 'cat-laptop'
      AND brand_id NOT IN ('br-apple','br-asus','br-hp','br-lenovo','br-acer','br-dell','br-msi','br-lg','br-microsoft','br-gigabyte','br-razer','br-masstel','br-infinix')
    GROUP BY brand_id ORDER BY cnt DESC LIMIT 10
  `;
  const tabletWrong = await p.$queryRaw`
    SELECT brand_id, COUNT(*)::int as cnt
    FROM "Product"
    WHERE is_deleted = false AND category_id = 'cat-tablet'
      AND brand_id NOT IN ('br-apple','br-samsung','br-lenovo','br-xiaomi','br-honor','br-masstel')
    GROUP BY brand_id ORDER BY cnt DESC LIMIT 10
  `;

  console.log('\nBrand SAI trong cat-phone:', phoneWrong.length > 0 ? '' : 'Không có!');
  for (const r of phoneWrong) console.log('  ', r.brand_id, ':', r.cnt.toLocaleString());
  console.log('Brand SAI trong cat-laptop:', laptopWrong.length > 0 ? '' : 'Không có!');
  for (const r of laptopWrong) console.log('  ', r.brand_id, ':', r.cnt.toLocaleString());
  console.log('Brand SAI trong cat-tablet:', tabletWrong.length > 0 ? '' : 'Không có!');
  for (const r of tabletWrong) console.log('  ', r.brand_id, ':', r.cnt.toLocaleString());
}

main().catch(console.error).finally(() => p.$disconnect());
