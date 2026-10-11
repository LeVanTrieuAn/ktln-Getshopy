const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu quy trình Seed 3 Triệu Orders vào Postgres...');
  const startTime = Date.now();

  try {
    const res = await prisma.$executeRawUnsafe(`
      INSERT INTO "Order" (
        id, customer, customer_id, province, total, discount, "shippingFee", "subTotal", status, date, payment_method, payment_status
      )
      SELECT 
        'SEED_ORD_' || generate_series(1, 3000000), 
        '{}'::jsonb, 
        1, 
        'HCM', 
        150000, 
        0, 
        30000, 
        120000, 
        'DELIVERED', 
        now() - (random() * interval '365 days'), 
        'COD', 
        'PAID'
      ON CONFLICT DO NOTHING;
    `);
    
    console.log(`Đã Insert/Bỏ qua: ${res} bản ghi Order gốc!`);
    
    console.log('Đang Seed OrderItem tương ứng...');
    const resItems = await prisma.$executeRawUnsafe(`
      INSERT INTO "OrderItem" (
        order_id, product_id, product_name, quantity, unit_price, discount, net_amount
      )
      SELECT 
        'SEED_ORD_' || generate_series(1, 3000000), 
        1, 
        'Sản phẩm Seed Mock', 
        1, 
        120000, 
        0, 
        120000
      ON CONFLICT DO NOTHING;
    `);
    
    console.log(`Đã Insert/Bỏ qua: ${resItems} bản ghi OrderItem!`);

  } catch (error) {
    console.error('Lỗi khi Seed:', error);
  } finally {
    console.log(`Hoàn tất trong ${(Date.now() - startTime) / 1000}s`);
    await prisma.$disconnect();
  }
}

main();
