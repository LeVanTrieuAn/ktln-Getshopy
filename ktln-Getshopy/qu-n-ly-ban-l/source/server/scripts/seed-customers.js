/**
 * Seed khách hàng giả lập: user0001 … userNNNN, mật khẩu chung.
 *
 * VÌ SAO CẦN NHIỀU KHÁCH — KHÔNG PHẢI NHIỀU ĐƠN:
 * Collaborative filtering item-based tính cosine giữa các vector sản phẩm, mà
 * SỐ CHIỀU của vector đó chính là SỐ KHÁCH. Với 6 khách thì mỗi sản phẩm là
 * một vector 6 chiều; món chỉ một người mua, sau chuẩn hoá L2, thành vector
 * đơn vị trỏ trọn vào người đó — và nếu người đó tình cờ mua trùng nhiều thứ
 * với khách đang xét thì món đó vọt lên đầu bảng gợi ý dù chẳng ai khác mua.
 *
 * Thêm đơn KHÔNG sửa được chuyện này, vì ràng buộc nằm ở số chiều. Phải thêm
 * khách.
 *
 * Idempotent: upsert theo email, chạy lại không nhân bản.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const COUNT    = Number(process.env.SEED_CUSTOMER_COUNT || process.argv[2] || 200);
const PASSWORD = process.env.SEED_CUSTOMER_PASSWORD || '123456';
const DOMAIN   = process.env.SEED_CUSTOMER_DOMAIN || 'getshopy.vn';

// Họ tên ghép từ hai bảng cố định — tất định, và nhìn giống dữ liệu thật hơn
// là "Khách 0001". Không dùng faker: thêm một phụ thuộc cho việc này không đáng.
const HO  = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
             'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Tô', 'Mai', 'Trịnh'];
const TEN = ['An', 'Bình', 'Cường', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hạnh', 'Hùng', 'Khanh',
             'Lan', 'Linh', 'Long', 'Mai', 'Minh', 'Nam', 'Ngọc', 'Nhung', 'Phúc', 'Quân',
             'Quỳnh', 'Sơn', 'Thảo', 'Thành', 'Thu', 'Trang', 'Trung', 'Tuấn', 'Vy', 'Yến'];

async function main() {
  const pad = String(COUNT).length < 4 ? 4 : String(COUNT).length;

  // Hash MỘT lần rồi dùng chung. bcrypt cố tình chậm (~100ms/lần ở cost 10),
  // hash 200 lần là 20 giây đứng yên không đổi lấy gì — mọi tài khoản đều
  // chung một mật khẩu nên chung một hash là đúng.
  const hash = await bcrypt.hash(PASSWORD, 10);

  let created = 0, existed = 0;
  for (let i = 1; i <= COUNT; i++) {
    const code  = String(i).padStart(pad, '0');
    const email = `user${code}@${DOMAIN}`;
    // Chọn tên theo i chứ không ngẫu nhiên: cùng số lượng thì ra cùng danh sách.
    const name  = `${HO[i % HO.length]} ${TEN[(i * 7) % TEN.length]}`;

    const before = await prisma.b2CCustomer.findUnique({ where: { email }, select: { id: true } });
    await prisma.b2CCustomer.upsert({
      where:  { email },
      update: {},                       // đã có thì giữ nguyên, không ghi đè điểm/đơn
      create: {
        full_name: name,
        email,
        phone: `09${String(10000000 + i).slice(-8)}`,
        password_hash: hash,
        loyalty_points: 0,
        provider: 'local',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
      },
    });
    before ? existed++ : created++;

    if (i % 50 === 0) console.log(`      ${i}/${COUNT}…`);
  }

  const total = await prisma.b2CCustomer.count();
  console.log(`      tạo mới ${created}, đã có sẵn ${existed} — tổng ${total} khách`);
  console.log(`      đăng nhập: user0001@${DOMAIN} … user${String(COUNT).padStart(pad,'0')}@${DOMAIN} / ${PASSWORD}`);
}

main()
  .catch(e => { console.error('      lỗi seed khách:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
