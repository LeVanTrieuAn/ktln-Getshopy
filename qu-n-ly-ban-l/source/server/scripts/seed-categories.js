/**
 * seed-categories.js
 * ─────────────────────────────────────────────────────────────────
 * Tái cấu trúc toàn bộ Category thành hệ thống 2 cấp (cha → con)
 * theo layout Shopee-style từ ảnh thiết kế giao diện.
 *
 * Cấu trúc: 8 cha + 41 con = 49 categories
 *
 * Cách dùng:
 *   node scripts/seed-categories.js
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

// ══════════════════════════════════════════════════════════════════
// ĐỊNH NGHĨA DANH MỤC MỚI
// ══════════════════════════════════════════════════════════════════

const PARENT_CATEGORIES = [
  { id: 'cat-phone',      name: 'Điện thoại',                         icon: '📱', sort_order: 1 },
  { id: 'cat-laptop',     name: 'Laptop',                              icon: '💻', sort_order: 2 },
  { id: 'cat-tablet',     name: 'Tablet',                              icon: '📲', sort_order: 3 },
  { id: 'cat-watch',      name: 'Smartwatch',                          icon: '⌚', sort_order: 4 },
  { id: 'cat-mobile-acc', name: 'Phụ kiện di động',                   icon: '🔌', sort_order: 5 },
  { id: 'cat-laptop-acc', name: 'Phụ kiện laptop, PC',                icon: '🖱️', sort_order: 6 },
  { id: 'cat-av',         name: 'Thiết bị nghe nhìn, lưu trữ, thu âm', icon: '🎧', sort_order: 7 },
  { id: 'cat-camera',     name: 'Camera',                              icon: '📷', sort_order: 8 },
];

const CHILD_CATEGORIES = [
  // ── Phụ kiện di động ────────────────────────────────────────────
  { id: 'cat-mobile-acc-powerbank',    name: 'Sạc dự phòng',              parent_id: 'cat-mobile-acc', sort_order: 1  },
  { id: 'cat-mobile-acc-charger',      name: 'Sạc, cáp',                  parent_id: 'cat-mobile-acc', sort_order: 2  },
  { id: 'cat-mobile-acc-case-phone',   name: 'Ốp lưng điện thoại',        parent_id: 'cat-mobile-acc', sort_order: 3  },
  { id: 'cat-mobile-acc-case-tablet',  name: 'Ốp lưng máy tính bảng',     parent_id: 'cat-mobile-acc', sort_order: 4  },
  { id: 'cat-mobile-acc-screen',       name: 'Miếng dán',                 parent_id: 'cat-mobile-acc', sort_order: 5  },
  { id: 'cat-mobile-acc-cam-cover',    name: 'Miếng dán Camera',          parent_id: 'cat-mobile-acc', sort_order: 6  },
  { id: 'cat-mobile-acc-airpods-case', name: 'Túi đựng AirPods',          parent_id: 'cat-mobile-acc', sort_order: 7  },
  { id: 'cat-mobile-acc-fan',          name: 'Quạt mini',                 parent_id: 'cat-mobile-acc', sort_order: 8  },
  { id: 'cat-mobile-acc-pen',          name: 'Bút tablet',                parent_id: 'cat-mobile-acc', sort_order: 9  },
  { id: 'cat-mobile-acc-stand',        name: 'Giá đỡ điện thoại/laptop',  parent_id: 'cat-mobile-acc', sort_order: 10 },
  { id: 'cat-mobile-acc-strap',        name: 'Dây đeo điện thoại',        parent_id: 'cat-mobile-acc', sort_order: 11 },
  { id: 'cat-mobile-acc-lens',         name: 'Ống kính điện thoại',       parent_id: 'cat-mobile-acc', sort_order: 12 },

  // ── Phụ kiện laptop, PC ─────────────────────────────────────────
  { id: 'cat-laptop-acc-hub',            name: 'Hub, cáp chuyển đổi',   parent_id: 'cat-laptop-acc', sort_order: 1  },
  { id: 'cat-laptop-acc-mouse',          name: 'Chuột máy tính',        parent_id: 'cat-laptop-acc', sort_order: 2  },
  { id: 'cat-laptop-acc-keyboard',       name: 'Bàn phím',              parent_id: 'cat-laptop-acc', sort_order: 3  },
  { id: 'cat-laptop-acc-router',         name: 'Router & Thiết bị mạng', parent_id: 'cat-laptop-acc', sort_order: 4  },
  { id: 'cat-laptop-acc-bag',            name: 'Balo, túi chống sốc',   parent_id: 'cat-laptop-acc', sort_order: 5  },
  { id: 'cat-laptop-acc-pouch',          name: 'Túi đựng phụ kiện',     parent_id: 'cat-laptop-acc', sort_order: 6  },
  { id: 'cat-laptop-acc-keyboard-cover', name: 'Phủ phím laptop',       parent_id: 'cat-laptop-acc', sort_order: 7  },
  { id: 'cat-laptop-acc-software',       name: 'Phần mềm',              parent_id: 'cat-laptop-acc', sort_order: 8  },
  { id: 'cat-laptop-acc-monitor-stand',  name: 'Giá treo màn hình',     parent_id: 'cat-laptop-acc', sort_order: 9  },
  { id: 'cat-laptop-acc-mousepad',       name: 'Miếng lót chuột',       parent_id: 'cat-laptop-acc', sort_order: 10 },
  { id: 'cat-laptop-acc-drawing',        name: 'Bảng vẽ điện tử',       parent_id: 'cat-laptop-acc', sort_order: 11 },

  // ── Thiết bị nghe nhìn, lưu trữ, thu âm ────────────────────────
  { id: 'cat-av-bt-earphone',    name: 'Tai nghe Bluetooth',  parent_id: 'cat-av', sort_order: 1  },
  { id: 'cat-av-wire-earphone',  name: 'Tai nghe dây',        parent_id: 'cat-av', sort_order: 2  },
  { id: 'cat-av-headphone',      name: 'Tai nghe chụp tai',   parent_id: 'cat-av', sort_order: 3  },
  { id: 'cat-av-sport-earphone', name: 'Tai nghe thể thao',   parent_id: 'cat-av', sort_order: 4  },
  { id: 'cat-av-speaker',        name: 'Loa',                 parent_id: 'cat-av', sort_order: 5  },
  { id: 'cat-av-mic',            name: 'Micro',               parent_id: 'cat-av', sort_order: 6  },
  { id: 'cat-av-projector',      name: 'Máy chiếu',           parent_id: 'cat-av', sort_order: 7  },
  { id: 'cat-av-smartglass',     name: 'Kính thông minh',     parent_id: 'cat-av', sort_order: 8  },
  { id: 'cat-av-hdd',            name: 'Ổ cứng',              parent_id: 'cat-av', sort_order: 9  },
  { id: 'cat-av-sdcard',         name: 'Thẻ nhớ',             parent_id: 'cat-av', sort_order: 10 },
  { id: 'cat-av-usb',            name: 'USB',                 parent_id: 'cat-av', sort_order: 11 },

  // ── Camera ──────────────────────────────────────────────────────
  { id: 'cat-cam-security',  name: 'Camera Giám Sát',              parent_id: 'cat-camera', sort_order: 1 },
  { id: 'cat-cam-indoor',    name: 'Camera trong nhà',             parent_id: 'cat-camera', sort_order: 2 },
  { id: 'cat-cam-outdoor',   name: 'Camera ngoài trời',            parent_id: 'cat-camera', sort_order: 3 },
  { id: 'cat-cam-solar',     name: 'Camera Năng Lượng Mặt Trời',  parent_id: 'cat-camera', sort_order: 4 },
  { id: 'cat-cam-4g',        name: 'Camera 4G',                    parent_id: 'cat-camera', sort_order: 5 },
  { id: 'cat-cam-doorbell',  name: 'Chuông cửa Camera',            parent_id: 'cat-camera', sort_order: 6 },
  { id: 'cat-cam-webcam',    name: 'Webcam',                       parent_id: 'cat-camera', sort_order: 7 },
];

// ── Mapping: old category ID → new subcategory IDs (để reassign) ──
// Mỗi old cat được map sang 1-3 new subcats; products sẽ random chọn 1 trong số đó
const OLD_TO_NEW_MAP = {
  'c1':  ['cat-phone'],                                                             // Điện thoại thông minh
  'c2':  ['cat-laptop'],                                                            // Máy tính xách tay
  'c3':  ['cat-tablet'],                                                            // Máy tính bảng
  'c4':  ['cat-mobile-acc-charger', 'cat-mobile-acc-case-phone', 'cat-mobile-acc-powerbank',
           'cat-mobile-acc-screen', 'cat-laptop-acc-hub', 'cat-laptop-acc-mouse',
           'cat-laptop-acc-keyboard', 'cat-laptop-acc-bag'],                        // Phụ kiện công nghệ
  'c5':  ['cat-av-speaker', 'cat-av-projector', 'cat-av-smartglass'],              // Tivi & Thiết bị giải trí
  'c6':  ['cat-cam-security', 'cat-cam-indoor', 'cat-cam-outdoor', 'cat-cam-webcam'], // Máy ảnh & Quay phim
  'c7':  ['cat-watch'],                                                             // Đồng hồ thông minh
  'c8':  ['cat-av-bt-earphone', 'cat-av-wire-earphone', 'cat-av-headphone',
           'cat-av-speaker', 'cat-av-mic'],                                         // Thiết bị âm thanh
  'c9':  ['cat-laptop-acc-keyboard', 'cat-laptop-acc-mouse', 'cat-laptop-acc-monitor-stand'], // Gaming
  'c10': ['cat-cam-indoor', 'cat-cam-doorbell', 'cat-laptop-acc-router'],          // Nhà thông minh
  'c11': ['cat-laptop-acc-hub', 'cat-laptop-acc-keyboard', 'cat-laptop-acc-software',
           'cat-laptop-acc-monitor-stand'],                                          // Thiết bị văn phòng
  'c12': ['cat-av-hdd', 'cat-av-sdcard', 'cat-av-usb', 'cat-laptop-acc-drawing'], // Linh kiện máy tính
};

const ALL_NEW_CHILD_IDS = CHILD_CATEGORIES.map(c => c.id);
const { createRng } = require('./lib/rng');
const rng = createRng('seed-categories');
const randPick = (arr) => arr[Math.floor(rng() * arr.length)];

// ══════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n🏗️  SEED CATEGORIES — Tái cấu trúc 2 cấp');
  console.log('═'.repeat(55));

  // ── Step 1: Lấy danh sách category ID cũ ─────────────────────
  const oldCats = await prisma.category.findMany({ select: { id: true } });
  const oldIds = new Set(oldCats.map(c => c.id));
  console.log(`  📂 Category cũ cần xóa : ${oldIds.size}`);

  // ── Step 2: Xóa category cũ (cần reassign products trước) ─────
  // Tạm set products về null (hoặc 1 cat mới) để tránh FK error nếu có constraint
  // (trong schema này category_id trên Product không có @relation → xóa tự do)
  console.log('  🗑️  Xóa category cũ...');
  const deletedCats = await prisma.category.deleteMany({
    where: { id: { in: [...oldIds] } },
  });
  console.log(`  ✅ Đã xóa ${deletedCats.count} category cũ`);

  // ── Step 3: Insert category cha (cấp 1) ──────────────────────
  console.log('  📁 Insert 8 category cấp 1 (cha)...');
  const parentData = PARENT_CATEGORIES.map(({ id, name, icon, sort_order }) => ({
    id, name, icon, sort_order, parent_id: null,
  }));
  await prisma.category.createMany({ data: parentData, skipDuplicates: true });
  console.log(`  ✅ Đã insert ${parentData.length} category cha`);

  // ── Step 4: Insert category con (cấp 2) ──────────────────────
  console.log('  📂 Insert 41 category cấp 2 (con)...');
  await prisma.category.createMany({ data: CHILD_CATEGORIES, skipDuplicates: true });
  console.log(`  ✅ Đã insert ${CHILD_CATEGORIES.length} category con`);

  // ── Step 5: Reassign products ─────────────────────────────────
  console.log('\n  🔄 Reassign products sang category mới...');
  console.log('  (Đọc tất cả sản phẩm theo batch 5000 để update)');

  const BATCH_SIZE = 5000;
  let cursor = undefined;
  let totalUpdated = 0;
  let batchNum = 0;

  while (true) {
    const products = await prisma.product.findMany({
      select: { id: true, category_id: true },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });

    if (products.length === 0) break;

    // Group products by new category để dùng updateMany (hiệu quả hơn)
    const groupByNewCat = {};
    for (const p of products) {
      const catId = p.category_id;
      let newCatIds;
      if (catId && OLD_TO_NEW_MAP[catId]) {
        newCatIds = OLD_TO_NEW_MAP[catId];
      } else {
        // Cat ID không tồn tại trong map → random 1 trong all child cats
        newCatIds = ALL_NEW_CHILD_IDS;
      }
      const newCat = randPick(newCatIds);
      if (!groupByNewCat[newCat]) groupByNewCat[newCat] = [];
      groupByNewCat[newCat].push(p.id);
    }

    // Update từng nhóm
    for (const [newCatId, ids] of Object.entries(groupByNewCat)) {
      await prisma.product.updateMany({
        where: { id: { in: ids } },
        data: { category_id: newCatId },
      });
    }

    totalUpdated += products.length;
    cursor = products[products.length - 1].id;
    batchNum++;
    process.stdout.write(`\r  Progress: ${totalUpdated.toLocaleString()} sản phẩm (batch ${batchNum})  `);
  }

  // ── Step 6: Verify ────────────────────────────────────────────
  console.log('\n\n  🔍 Kiểm tra kết quả...');
  const finalCatCount = await prisma.category.count();
  const parentCount   = await prisma.category.count({ where: { parent_id: null } });
  const childCount    = await prisma.category.count({ where: { parent_id: { not: null } } });

  // Kiểm tra products có category_id không hợp lệ
  const validCatIds = [...PARENT_CATEGORIES.map(c => c.id), ...CHILD_CATEGORIES.map(c => c.id)];
  const invalidProds = await prisma.product.count({
    where: { category_id: { notIn: validCatIds } },
  });

  console.log('\n  ╔════════════════════════════════════════╗');
  console.log('  ║           KẾT QUẢ HOÀN THÀNH          ║');
  console.log('  ╠════════════════════════════════════════╣');
  console.log(`  ║  Tổng category      : ${String(finalCatCount).padStart(5)}              ║`);
  console.log(`  ║    Cấp 1 (cha)      : ${String(parentCount).padStart(5)}              ║`);
  console.log(`  ║    Cấp 2 (con)      : ${String(childCount).padStart(5)}              ║`);
  console.log(`  ║  Sản phẩm đã update : ${String(totalUpdated).padStart(8) }           ║`);
  console.log(`  ║  Sản phẩm lỗi cat   : ${String(invalidProds).padStart(5)}              ║`);
  console.log('  ╚════════════════════════════════════════╝\n');

  if (invalidProds > 0) {
    console.warn(`  ⚠️  Có ${invalidProds} sản phẩm còn trỏ vào category không hợp lệ!`);
  } else {
    console.log('  ✅ Tất cả sản phẩm đã được gán đúng category mới!\n');
  }
}

main()
  .catch((e) => {
    console.error('\n❌ Lỗi:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
