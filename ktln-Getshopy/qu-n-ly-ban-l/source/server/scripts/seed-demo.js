/**
 * Dữ liệu demo để thử luồng mua hàng: voucher, hạng thành viên, tài khoản test.
 *
 * Tách khỏi seed.js vì đây là dữ liệu để DEMO/TEST, không phải dữ liệu nghiệp
 * vụ gốc. db.json có voucher_tiers nhưng seed.js không đọc tới, và không có
 * voucher nào — nên không thử được luồng giảm giá nếu chỉ chạy seed mặc định.
 *
 * Idempotent: upsert theo khoá tự nhiên, chạy lại không nhân bản.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { seedBaseDate } = require('./lib/rng');
const prisma = new PrismaClient();

// Mật khẩu demo — chỉ dùng cho môi trường dev.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || '123456';
const FLASH_SALE_TITLE = 'Flash Sale Demo — Giảm 30%';

const VOUCHERS = [
  { code: 'GIAM10',  type: 'percent', value: 10,     max_discount: 2_000_000, min_order_value:   500_000, max_uses: 1000, max_uses_per_customer: 5 },
  { code: 'GIAM50K', type: 'fixed',   value: 50_000, max_discount:    50_000, min_order_value:   300_000, max_uses: 1000, max_uses_per_customer: 3 },
  { code: 'SALE20',  type: 'percent', value: 20,     max_discount: 5_000_000, min_order_value: 2_000_000, max_uses:  500, max_uses_per_customer: 1 },
];

const TIERS = [
  { name: 'Thành viên', min_points_required:    0, min_lifetime_spend_vnd:          0n, discount_amount_vnd:         0 },
  { name: 'Bạc',        min_points_required:  500, min_lifetime_spend_vnd:  5_000_000n, discount_amount_vnd:   100_000 },
  { name: 'Vàng',       min_points_required: 2000, min_lifetime_spend_vnd: 20_000_000n, discount_amount_vnd:   500_000 },
];

async function main() {
  // ── Voucher ───────────────────────────────────────────────────────────
  for (const v of VOUCHERS) {
    await prisma.voucher.upsert({
      where:  { code: v.code },
      update: { ...v, is_deleted: false },   // cập nhật cấu hình, GIỮ used_count
      create: { ...v, used_count: 0 },
    });
  }
  console.log(`      ${VOUCHERS.length} voucher: ${VOUCHERS.map(v => v.code).join(', ')}`);

  // ── Hạng thành viên ───────────────────────────────────────────────────
  const tierCount = await prisma.voucherTier.count();
  if (tierCount === 0) {
    await prisma.voucherTier.createMany({ data: TIERS });
    console.log(`      ${TIERS.length} hạng thành viên`);
  }

  // ── Tài khoản khách để test ───────────────────────────────────────────
  // Các tài khoản trong db.json chỉ có password_hash, không ai biết mật khẩu
  // gốc — nên không đăng nhập được để thử luồng mua hàng.
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const customer = await prisma.b2CCustomer.upsert({
    where:  { email: 'test@getshopy.vn' },
    update: { password_hash: hash },
    create: {
      full_name: 'Khách Test',
      email: 'test@getshopy.vn',
      phone: '0900000000',
      password_hash: hash,
      loyalty_points: 5000,
    },
  });
  console.log(`      tài khoản test: test@getshopy.vn / ${DEMO_PASSWORD} (${customer.loyalty_points} điểm)`);

  // ── Flash sale ────────────────────────────────────────────────────────
  // GET /b2c/flash-sales trả null nếu THIẾU MỘT trong hai: đợt còn hạn, hoặc
  // có FlashSaleItem. Trước đây thiếu cả hai nên mục Flash Sale trên trang chủ
  // luôn trống — mà route trả 200 kèm null, không có lỗi nào để lần ra.
  const start = seedBaseDate();
  // Hai năm kể từ mốc gốc: vẫn tất định (cùng SEED_BASE_DATE ra cùng kết quả)
  // mà đủ dài để không hết hạn giữa kỳ làm khoá luận.
  const end = new Date(start.getTime() + 730 * 24 * 60 * 60 * 1000);

  let sale = await prisma.flashSale.findFirst({ where: { title: FLASH_SALE_TITLE } });
  if (!sale) {
    sale = await prisma.flashSale.create({
      data: { title: FLASH_SALE_TITLE, start_time: start, end_time: end, discount_percent: 30 },
    });
  } else if (sale.end_time <= new Date()) {
    // Đợt cũ đã hết hạn thì gia hạn, không tạo đợt mới — tránh mỗi lần khởi
    // động lại đẻ thêm một đợt.
    sale = await prisma.flashSale.update({
      where: { id: sale.id }, data: { start_time: start, end_time: end },
    });
  }

  const itemCount = await prisma.flashSaleItem.count({ where: { flash_sale_id: sale.id } });
  if (itemCount === 0) {
    // Lấy theo id tăng dần chứ không random: tất định, và không cần PRNG.
    const products = await prisma.product.findMany({
      where: { is_deleted: false, price: { gt: 0 } },
      orderBy: { id: 'asc' },
      take: 8,
      select: { id: true, price: true },
    });
    if (products.length > 0) {
      await prisma.flashSaleItem.createMany({
        data: products.map(p => ({
          flash_sale_id: sale.id,
          product_id: p.id,
          // Làm tròn tới nghìn: giá tiền Việt không có phần lẻ dưới 1.000đ.
          discount_price: Math.round((p.price * 0.7) / 1000) * 1000,
          limit: 100,
          sold: 0,
        })),
      });
    }
  }

  const finalCount = await prisma.flashSaleItem.count({ where: { flash_sale_id: sale.id } });
  console.log(`      flash sale: "${sale.title}" — ${finalCount} sản phẩm, hết hạn ${sale.end_time.toISOString().slice(0, 10)}`);
}

main()
  .catch(e => { console.error('      lỗi seed demo:', e.message); process.exitCode = 0; })
  .finally(() => prisma.$disconnect());
