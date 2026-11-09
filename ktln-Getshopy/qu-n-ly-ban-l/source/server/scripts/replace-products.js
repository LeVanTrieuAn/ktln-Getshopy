/**
 * replace-products.js
 * ─────────────────────────────────────────────────────────────────
 * 1. Xóa toàn bộ 600k sản phẩm cũ (sinh ngẫu nhiên)
 * 2. Import dữ liệu thực đã crawl từ TGDD
 * 3. Augment biến thể hợp lý (màu sắc / dung lượng thực tế)
 *    → Mỗi biến thể là 1 cấu hình THỰC SỰ KHÁC NHAU của sản phẩm gốc
 *    → Tên = tên gốc + thông tin biến thể (VD: "iPhone 16 Pro 256GB - Màu Titan Đen")
 *    → Ảnh: giữ nguyên ảnh gốc từ cdn.tgdd.vn
 *
 * Cách dùng:
 *   node scripts/replace-products.js
 *   node scripts/replace-products.js --dry-run
 *   node scripts/replace-products.js --skip-delete
 *   node scripts/replace-products.js --target 600000
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const fs   = require('fs');
const path = require('path');

const prisma = new PrismaClient({ log: [] });

// ── Cấu hình ─────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const DRY_RUN   = args.includes('--dry-run');
const SKIP_DEL  = args.includes('--skip-delete');
const TARGET    = parseInt(args.find(a => a.startsWith('--target='))?.split('=')[1] || '600000', 10);
const BATCH_SIZE = 2000;

const DATA_FILE = path.join(__dirname, 'data', 'tgdd-products.json');
const BRANCHES  = ['HCM001', 'HCM002', 'HN001'];

// ── Leaf categories (validation) ─────────────────────────────────
const LEAF_CATEGORIES = [
  'cat-phone','cat-laptop','cat-tablet','cat-watch',
  'cat-mobile-acc-powerbank','cat-mobile-acc-charger','cat-mobile-acc-case-phone',
  'cat-mobile-acc-case-tablet','cat-mobile-acc-screen','cat-mobile-acc-cam-cover',
  'cat-mobile-acc-airpods-case','cat-mobile-acc-fan','cat-mobile-acc-pen',
  'cat-mobile-acc-stand','cat-mobile-acc-strap','cat-mobile-acc-lens',
  'cat-laptop-acc-hub','cat-laptop-acc-mouse','cat-laptop-acc-keyboard',
  'cat-laptop-acc-router','cat-laptop-acc-bag','cat-laptop-acc-pouch',
  'cat-laptop-acc-keyboard-cover','cat-laptop-acc-software',
  'cat-laptop-acc-monitor-stand','cat-laptop-acc-mousepad','cat-laptop-acc-drawing',
  'cat-av-bt-earphone','cat-av-wire-earphone','cat-av-headphone',
  'cat-av-sport-earphone','cat-av-speaker','cat-av-mic',
  'cat-av-projector','cat-av-smartglass','cat-av-hdd','cat-av-sdcard','cat-av-usb',
  'cat-cam-security','cat-cam-indoor','cat-cam-outdoor','cat-cam-solar',
  'cat-cam-4g','cat-cam-doorbell','cat-cam-webcam',
];

// ══════════════════════════════════════════════════════════════════
// BIẾN THỂ HỢP LÝ THEO TỪNG CATEGORY
// Mỗi biến thể thêm thông tin thực tế vào tên sản phẩm
// ══════════════════════════════════════════════════════════════════

// Màu sắc thực tế theo category
const COLORS_BY_CAT = {
  'cat-phone':  ['Đen', 'Trắng', 'Tím', 'Xanh dương', 'Xanh lá', 'Hồng', 'Vàng', 'Bạc', 'Xám', 'Titan Đen', 'Titan Trắng', 'Titan Xanh', 'Xanh Cobalt', 'San Hô', 'Đỏ'],
  'cat-laptop': ['Bạc', 'Xám Không Gian', 'Vàng', 'Đen', 'Xanh Midnight', 'Trắng', 'Bạc Nhôm', 'Xanh Dương'],
  'cat-tablet': ['Bạc', 'Xanh Midnight', 'Đen', 'Vàng', 'Xám Không Gian', 'Tím', 'Xanh Dương', 'Trắng'],
  'cat-watch':  ['Đen', 'Trắng', 'Bạc', 'Vàng Hồng', 'Xanh Dương', 'Đỏ', 'Xanh Lá', 'Vàng', 'Titan', 'Đen Midnight'],
  'default':    ['Đen', 'Trắng', 'Bạc', 'Xanh dương', 'Đỏ', 'Xám', 'Xanh lá', 'Vàng', 'Hồng', 'Tím'],
};

// Dung lượng bộ nhớ theo category
const STORAGE_BY_CAT = {
  'cat-phone':  ['128GB', '256GB', '512GB', '1TB'],
  'cat-laptop': ['256GB SSD', '512GB SSD', '1TB SSD', '2TB SSD'],
  'cat-tablet': ['64GB', '128GB', '256GB', '512GB'],
  'cat-av-hdd': ['500GB', '1TB', '2TB', '4TB', '8TB'],
  'cat-av-sdcard': ['32GB', '64GB', '128GB', '256GB', '512GB'],
  'cat-av-usb':    ['32GB', '64GB', '128GB', '256GB'],
};

// RAM theo category
const RAM_BY_CAT = {
  'cat-phone':  ['6GB', '8GB', '12GB', '16GB'],
  'cat-laptop': ['8GB', '16GB', '32GB', '64GB'],
  'cat-tablet': ['4GB', '6GB', '8GB', '12GB'],
};

// ── Tạo danh sách biến thể cho 1 sản phẩm ───────────────────────
// Trả về mảng { nameSuffix, priceDelta, variantObj }
function getVariants(product) {
  const catId = product.category_id;
  const variants = [];

  const colors  = COLORS_BY_CAT[catId]  || COLORS_BY_CAT['default'];
  const storages = STORAGE_BY_CAT[catId] || null;
  const rams     = RAM_BY_CAT[catId]     || null;

  // Nhóm 1: Điện thoại, tablet — biến thể RAM + Storage + Màu
  if (['cat-phone', 'cat-tablet'].includes(catId) && storages && rams) {
    for (const ram of rams) {
      for (const storage of storages) {
        for (const color of colors.slice(0, 4)) { // 4 màu × 4 RAM × 4 Storage = 64 biến thể
          variants.push({
            nameSuffix: ` ${ram}/${storage} - ${color}`,
            priceDelta:  getStorageDelta(storage) + getRamDelta(ram),
            variantObj:  { color, ram, storage },
          });
        }
      }
    }
    return variants;
  }

  // Nhóm 2: Laptop — biến thể RAM + Storage + Màu
  if (catId === 'cat-laptop' && storages && rams) {
    for (const ram of rams) {
      for (const storage of storages) {
        for (const color of colors.slice(0, 3)) {
          variants.push({
            nameSuffix: ` RAM ${ram} ${storage} - ${color}`,
            priceDelta:  getStorageDelta(storage) + getRamDelta(ram),
            variantObj:  { color, ram, storage },
          });
        }
      }
    }
    return variants;
  }

  // Nhóm 3: Smartwatch — biến thể màu dây + vỏ
  if (catId === 'cat-watch') {
    for (const color of colors) {
      variants.push({
        nameSuffix: ` - Dây ${color}`,
        priceDelta:  Math.round((Math.random() * 200_000 - 100_000) / 1000) * 1000,
        variantObj:  { color },
      });
    }
    return variants;
  }

  // Nhóm 4: HDD, SSD, Thẻ nhớ, USB — biến thể dung lượng
  if (storages) {
    for (const storage of storages) {
      variants.push({
        nameSuffix: ` ${storage}`,
        priceDelta:  getStorageDelta(storage),
        variantObj:  { capacity: storage },
      });
    }
    return variants;
  }

  // Nhóm 5: Tai nghe, loa, phụ kiện — biến thể màu
  for (const color of colors.slice(0, 6)) {
    variants.push({
      nameSuffix: ` - Màu ${color}`,
      priceDelta:  0,
      variantObj:  { color },
    });
  }

  return variants;
}

// Delta giá theo dung lượng
function getStorageDelta(storage) {
  const map = {
    '64GB': 0, '128GB': 500_000, '256GB': 1_500_000, '512GB': 3_000_000,
    '1TB': 5_000_000, '2TB': 9_000_000, '4TB': 15_000_000, '8TB': 28_000_000,
    '256GB SSD': 0, '512GB SSD': 1_000_000, '1TB SSD': 2_500_000, '2TB SSD': 5_000_000,
    '32GB': 0, '64GB': 100_000, '500GB': 0,
  };
  return map[storage] || 0;
}

// Delta giá theo RAM
function getRamDelta(ram) {
  const map = { '4GB': 0, '6GB': 200_000, '8GB': 500_000, '12GB': 1_500_000, '16GB': 3_000_000, '32GB': 6_000_000, '64GB': 15_000_000 };
  return map[ram] || 0;
}

// ── Helpers ──────────────────────────────────────────────────────
const rand    = (a, b) => Math.random() * (b - a) + a;
const randInt = (a, b) => Math.floor(rand(a, b + 1));

function printBar(done, total, startMs, label) {
  const pct    = Math.min(done / total, 1);
  const filled = Math.round(pct * 40);
  const bar    = '█'.repeat(filled) + '░'.repeat(40 - filled);
  const elapsed = (Date.now() - startMs) / 1000;
  const rps    = done / Math.max(elapsed, 1);
  const eta    = rps > 0 ? Math.ceil((total - done) / rps) : 0;
  const etaStr = eta > 60 ? `${Math.floor(eta / 60)}m${eta % 60}s` : `${eta}s`;
  process.stdout.write(
    `\r  [${bar}] ${(pct * 100).toFixed(1)}%  ${done.toLocaleString()}/${total.toLocaleString()}` +
    `  ${Math.round(rps).toLocaleString()}/s  ETA:${etaStr}  ${label}    `
  );
}

async function insertBatch(rows) {
  await prisma.product.createMany({ data: rows, skipDuplicates: false });
}

// ── MAIN ─────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔄 REPLACE PRODUCTS — Xóa fake data, import TGDD thực + augment biến thể');
  console.log('═'.repeat(70));
  console.log(`  Target  : ${TARGET.toLocaleString()} sản phẩm`);
  console.log(`  Dry run : ${DRY_RUN}`);
  console.log(`  Data    : ${DATA_FILE}`);

  // 1. Đọc dữ liệu crawled
  if (!fs.existsSync(DATA_FILE)) {
    console.error('\n❌ Chưa có file data. Hãy chạy crawl-tgdd.js trước:');
    console.error('   node scripts/crawl-tgdd.js');
    process.exit(1);
  }

  let crawledProducts;
  try {
    crawledProducts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('\n❌ Không đọc được data file:', e.message);
    process.exit(1);
  }

  // Lọc sản phẩm hợp lệ
  const validProducts = crawledProducts.filter(p =>
    p.name && p.name.length >= 3 &&
    p.price > 0 &&
    LEAF_CATEGORIES.includes(p.category_id)
  );

  console.log(`\n  📦 Sản phẩm crawled   : ${crawledProducts.length.toLocaleString()}`);
  console.log(`  ✅ Sản phẩm hợp lệ   : ${validProducts.length.toLocaleString()}`);

  // Tính tổng biến thể có thể sinh ra
  let totalPossibleVariants = 0;
  for (const p of validProducts) {
    totalPossibleVariants += getVariants(p).length;
  }
  console.log(`  🔢 Tổng biến thể có thể sinh: ${totalPossibleVariants.toLocaleString()}`);

  // Phân bố theo category
  const catStats = {};
  for (const p of validProducts) catStats[p.category_id] = (catStats[p.category_id] || 0) + 1;
  console.log('\n  📊 Phân bố theo category:');
  Object.entries(catStats).sort((a, b) => b[1] - a[1]).forEach(([catId, count]) => {
    const variants = validProducts.filter(p => p.category_id === catId)
      .reduce((s, p) => s + getVariants(p).length, 0);
    console.log(`    ${catId.padEnd(38)}: ${String(count).padStart(5)} sp thực → ~${variants.toLocaleString()} biến thể`);
  });

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] Không thực hiện thay đổi DB.');
    return;
  }

  // 2. Xóa sản phẩm cũ
  if (!SKIP_DEL) {
    const currentCount = await prisma.product.count();
    console.log(`\n  🗑️  Xóa ${currentCount.toLocaleString()} sản phẩm cũ...`);
    let deleted = 0;
    const startDelMs = Date.now();
    while (true) {
      const ids = await prisma.product.findMany({ select: { id: true }, take: 5000 });
      if (ids.length === 0) break;
      const result = await prisma.product.deleteMany({ where: { id: { in: ids.map(r => r.id) } } });
      deleted += result.count;
      printBar(deleted, currentCount, startDelMs, 'Xóa');
    }
    console.log(`\n  ✅ Đã xóa ${deleted.toLocaleString()} sản phẩm`);
  }

  // 3. Insert sản phẩm thực + biến thể
  console.log('\n  📥 Bắt đầu import sản phẩm thực + biến thể...');
  const startMs = Date.now();
  let totalInserted = 0;
  let batch = [];

  // Xây dựng toàn bộ danh sách cần insert
  // Mỗi sản phẩm gốc sẽ sinh ra các biến thể, vòng lặp until TARGET
  const insertQueue = []; // { product, variantInfo }

  // Phase 1: mỗi sản phẩm gốc + TẤT CẢ biến thể của nó
  for (const base of validProducts) {
    const variants = getVariants(base);

    // Bản gốc (biến thể đầu tiên)
    insertQueue.push({ base, variant: variants[0] || null, isBase: true });

    // Các biến thể còn lại
    for (let i = 1; i < variants.length; i++) {
      insertQueue.push({ base, variant: variants[i], isBase: false });
      if (insertQueue.length >= TARGET) break;
    }
    if (insertQueue.length >= TARGET) break;
  }

  // Phase 2: nếu chưa đủ TARGET, lặp lại vòng 2 với combo khác
  if (insertQueue.length < TARGET) {
    let round = 2;
    outer: while (insertQueue.length < TARGET) {
      for (const base of validProducts) {
        // Thêm 1 bản với giá/stock biến tấu nhỏ khác nhau
        insertQueue.push({ base, variant: null, isBase: false, round });
        if (insertQueue.length >= TARGET) break outer;
      }
      round++;
    }
  }

  console.log(`\n  ✅ Queue build xong: ${insertQueue.length.toLocaleString()} records sẽ insert`);

  // Insert theo batch
  for (const item of insertQueue) {
    const { base, variant, isBase, round } = item;

    // Tên sản phẩm
    let name = base.name;
    if (variant && variant.nameSuffix) {
      name = base.name + variant.nameSuffix;
    } else if (!isBase && round) {
      // Vòng 2+: không thêm suffix (sản phẩm vẫn giống gốc, giá/stock khác)
      name = base.name;
    }

    // Giá (base + delta biến thể)
    const delta = variant ? (variant.priceDelta || 0) : 0;
    const noise = Math.round((Math.random() * 100_000 - 50_000) / 1000) * 1000; // ±50k ngẫu nhiên
    const price = Math.max(10_000, Math.round((base.price + delta + noise) / 1000) * 1000);
    const origPrice = Math.max(price, Math.round((base.original_price + delta) / 1000) * 1000);

    // Variants JSON
    const variantObj = variant ? variant.variantObj : {};
    const variantsJson = JSON.stringify(Object.keys(variantObj).length > 0 ? [variantObj] : []);

    // Branches
    const numBranches = randInt(1, BRANCHES.length);
    const branchIds = [...BRANCHES].sort(() => Math.random() - 0.5).slice(0, numBranches);

    batch.push({
      name,
      price,
      original_price: origPrice,
      category_id:    base.category_id,
      brand_id:       base.brand_id,
      image:          base.image   || null,
      images:         base.images  || JSON.stringify([]),
      description:    base.description || `${base.name} — Chính hãng tại Thế Giới Di Động.`,
      variants:       variantsJson,
      stock:          randInt(5, 999),
      rating:         Math.round(rand(4.0, 5.0) * 10) / 10,
      sold:           randInt(0, 2000),
      branch_ids:     branchIds,
      is_banner:      false,
      is_deleted:     false,
    });

    if (batch.length >= BATCH_SIZE) {
      await insertBatch(batch);
      totalInserted += batch.length;
      batch = [];
      printBar(totalInserted, TARGET, startMs, 'Import');
    }
  }

  // Flush batch còn lại
  if (batch.length > 0) {
    await insertBatch(batch);
    totalInserted += batch.length;
    batch = [];
  }

  // 4. Kiểm tra cuối
  const finalCount = await prisma.product.count();
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

  console.log('\n\n  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║         KẾT QUẢ HOÀN THÀNH                          ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log(`  ║  Sản phẩm thực crawled  : ${String(validProducts.length.toLocaleString()).padStart(10)}               ║`);
  console.log(`  ║  Tổng biến thể sinh ra  : ${String(totalPossibleVariants.toLocaleString()).padStart(10)}               ║`);
  console.log(`  ║  Tổng đã insert         : ${String(totalInserted.toLocaleString()).padStart(10)}               ║`);
  console.log(`  ║  Tổng trong DB          : ${String(finalCount.toLocaleString()).padStart(10)}               ║`);
  console.log(`  ║  Thời gian              : ${String(elapsed + 's').padStart(10)}               ║`);
  console.log(`  ║  Tốc độ TB              : ${String(Math.round(totalInserted / parseFloat(elapsed)).toLocaleString() + '/s').padStart(10)}               ║`);
  console.log('  ╚══════════════════════════════════════════════════════╝\n');
}

main()
  .catch(e => { console.error('\n❌ Lỗi:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
