/**
 * Mock Data Seeder
 * Generates realistic Apple Reseller data for demo purposes
 * Run: node src/seed.js
 */
const { createClient } = require('@clickhouse/client');

const client = createClient({
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  database: 'analytics',
});

const BRANCHES = [
  { id: 'HN001', name: 'Hà Nội - Hoàn Kiếm', region: 'NORTH' },
  { id: 'HN002', name: 'Hà Nội - Cầu Giấy', region: 'NORTH' },
  { id: 'HN003', name: 'Hà Nội - Đống Đa', region: 'NORTH' },
  { id: 'HCM001', name: 'HCM - Quận 1', region: 'SOUTH' },
  { id: 'HCM002', name: 'HCM - Bình Thạnh', region: 'SOUTH' },
  { id: 'HCM003', name: 'HCM - Gò Vấp', region: 'SOUTH' },
  { id: 'DN001', name: 'Đà Nẵng - Hải Châu', region: 'CENTRAL' },
];

const PRODUCTS = [
  { id: 'IP15PM', name: 'iPhone 15 Pro Max 256GB', category: 'iPhone', price: 33990000 },
  { id: 'IP15P', name: 'iPhone 15 Pro 128GB', category: 'iPhone', price: 27990000 },
  { id: 'IP15', name: 'iPhone 15 128GB', category: 'iPhone', price: 22990000 },
  { id: 'MBA13M3', name: 'MacBook Air M3 13"', category: 'Mac', price: 27990000 },
  { id: 'MBP14M3', name: 'MacBook Pro M3 Pro 14"', category: 'Mac', price: 49990000 },
  { id: 'IPADPRO11', name: 'iPad Pro 11" M4', category: 'iPad', price: 28990000 },
  { id: 'APPRO', name: 'AirPods Pro 2nd Gen', category: 'Accessories', price: 6190000 },
  { id: 'AW9PRO', name: 'Apple Watch Series 9', category: 'Watch', price: 11990000 },
];

const PAYMENT_METHODS = ['CASH', 'CARD', 'TRANSFER', 'MOMO', 'VNPAY'];
const STATUSES = ['CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'VOIDED']; // 80% confirmed

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysBack = 90) {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(0, daysBack));
  d.setHours(randomInt(8, 21), randomInt(0, 59), randomInt(0, 59));
  return d;
}

function formatCH(date) {
  return date.toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
}

async function seedSaleOrders(count = 5000) {
  console.log(`Seeding ${count} sale orders...`);
  const batch = [];

  for (let i = 1; i <= count; i++) {
    const branch = randomItem(BRANCHES);
    const product = randomItem(PRODUCTS);
    const status = randomItem(STATUSES);
    const discount = status === 'VOIDED' ? 0 : randomInt(0, 5) * 100000;
    const orderDate = randomDate(90);

    batch.push({
      order_id: `ORD${String(i).padStart(7, '0')}`,
      branch_id: branch.id,
      branch_name: branch.name,
      region: branch.region,
      salesperson_id: `EMP${randomInt(1, 20).toString().padStart(3, '0')}`,
      customer_id: `CUS${randomInt(1, 500).toString().padStart(5, '0')}`,
      product_id: product.id,
      product_name: product.name,
      product_category: product.category,
      quantity: 1,
      unit_price: product.price,
      total_amount: product.price,
      discount: discount,
      net_amount: product.price - discount,
      status: status,
      payment_method: randomItem(PAYMENT_METHODS),
      order_date: formatCH(orderDate),
      created_at: formatCH(orderDate),
      _cdc_op: 'c',
    });

    if (batch.length >= 500) {
      await client.insert({ table: 'analytics.sale_orders', values: batch, format: 'JSONEachRow' });
      console.log(`  ✅ Inserted ${i} orders...`);
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    await client.insert({ table: 'analytics.sale_orders', values: batch, format: 'JSONEachRow' });
  }
  console.log(`✅ Sale orders done.`);
}

async function seedInputVouchers(orderCount = 5000) {
  console.log(`Seeding input vouchers...`);
  const batch = [];
  // 90% of CONFIRMED orders have a receipt
  for (let i = 1; i <= Math.floor(orderCount * 0.88); i++) {
    const branch = randomItem(BRANCHES);
    const product = randomItem(PRODUCTS);
    const amount = product.price - randomInt(0, 3) * 100000;
    const d = randomDate(90);

    batch.push({
      voucher_id: `IV${String(i).padStart(7, '0')}`,
      order_id: `ORD${String(i).padStart(7, '0')}`,
      branch_id: branch.id,
      amount: amount,
      voucher_date: formatCH(d),
      payment_type: randomItem(PAYMENT_METHODS),
      note: '',
      created_at: formatCH(d),
    });

    if (batch.length >= 500) {
      await client.insert({ table: 'analytics.input_vouchers', values: batch, format: 'JSONEachRow' });
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    await client.insert({ table: 'analytics.input_vouchers', values: batch, format: 'JSONEachRow' });
  }
  console.log(`✅ Input vouchers done.`);
}

async function seedOutputVouchers(count = 800) {
  console.log(`Seeding output vouchers...`);
  const CATEGORIES = ['COGS', 'EXPENSE', 'SALARY', 'REFUND'];
  const batch = [];

  for (let i = 1; i <= count; i++) {
    const branch = randomItem(BRANCHES);
    const d = randomDate(90);
    batch.push({
      voucher_id: `OV${String(i).padStart(7, '0')}`,
      order_id: '',
      branch_id: branch.id,
      amount: randomInt(1, 50) * 1000000,
      voucher_date: formatCH(d),
      category: randomItem(CATEGORIES),
      note: '',
      created_at: formatCH(d),
    });
  }
  await client.insert({ table: 'analytics.output_vouchers', values: batch, format: 'JSONEachRow' });
  console.log(`✅ Output vouchers done.`);
}

async function seedAlerts() {
  console.log(`Seeding alerts...`);
  const alerts = [
    {
      alert_id: 'ALT001',
      rule_name: 'HIGH_VOID_RATE',
      branch_id: 'HN001',
      severity: 'HIGH',
      message: 'Chi nhánh HN001: Tỷ lệ hủy đơn 35% trong 1 giờ qua (bình thường 2%)',
      details: JSON.stringify({ void_rate: 0.35, normal_rate: 0.02, window: '1h' }),
      triggered_at: formatCH(new Date(Date.now() - 15 * 60000)),
      acknowledged: 0,
      acknowledged_by: '',
    },
    {
      alert_id: 'ALT002',
      rule_name: 'REVENUE_ANOMALY',
      branch_id: 'HCM002',
      severity: 'MEDIUM',
      message: 'Chi nhánh HCM002: Doanh thu hôm nay thấp hơn 3σ so với trung bình 90 ngày',
      details: JSON.stringify({ today: 45000000, avg_90d: 280000000, z_score: -3.2 }),
      triggered_at: formatCH(new Date(Date.now() - 45 * 60000)),
      acknowledged: 0,
      acknowledged_by: '',
    },
    {
      alert_id: 'ALT003',
      rule_name: 'RECON_OVERDUE',
      branch_id: 'ALL',
      severity: 'LOW',
      message: '12 hóa đơn chưa đối soát quá 30 ngày. Tổng giá trị: 87,000,000 VND',
      details: JSON.stringify({ count: 12, total_gap: 87000000 }),
      triggered_at: formatCH(new Date(Date.now() - 2 * 3600000)),
      acknowledged: 0,
      acknowledged_by: '',
    },
  ];
  await client.insert({ table: 'analytics.alert_events', values: alerts, format: 'JSONEachRow' });
  console.log(`✅ Alerts done.`);
}

async function main() {
  console.log('🌱 Starting seed...\n');
  try {
    await seedSaleOrders(5000);
    await seedInputVouchers(5000);
    await seedOutputVouchers(800);
    await seedAlerts();
    console.log('\n🎉 Seeding complete! Database is ready for demo.');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

main();
