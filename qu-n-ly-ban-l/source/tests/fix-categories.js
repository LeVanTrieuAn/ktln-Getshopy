/**
 * fix-all-categories.js
 * Reassign ALL 600K products to correct leaf categories based on product name
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Complete mapping: name pattern → correct category_id
// Order matters — more specific patterns first
const RULES = [
  // ══════════ cat-phone (Điện thoại) ══════════
  { pattern: 'Điện thoại %',            cat: 'cat-phone' },
  { pattern: 'iPhone %',                cat: 'cat-phone' },

  // ══════════ cat-laptop (Laptop) ══════════
  { pattern: 'Laptop %',                cat: 'cat-laptop' },
  { pattern: 'MacBook %',               cat: 'cat-laptop' },
  { pattern: 'Microsoft Surface %',     cat: 'cat-laptop' },

  // ══════════ cat-tablet (Tablet) ══════════
  { pattern: 'iPad %',                  cat: 'cat-tablet' },
  { pattern: 'OPPO Pad %',              cat: 'cat-tablet' },
  { pattern: 'HONOR Pad %',             cat: 'cat-tablet' },
  { pattern: 'Lenovo Tab %',            cat: 'cat-tablet' },
  { pattern: 'Lenovo IdeaTab %',        cat: 'cat-tablet' },
  { pattern: 'Xiaomi Pad %',            cat: 'cat-tablet' },
  { pattern: 'Samsung Galaxy Tab %',    cat: 'cat-tablet' },
  { pattern: 'Máy tính bảng %',         cat: 'cat-tablet' },

  // ══════════ cat-watch (Smartwatch) ══════════
  { pattern: 'Apple Watch %',           cat: 'cat-watch' },
  { pattern: 'Đồng hồ %',              cat: 'cat-watch' },
  { pattern: 'Huawei Watch %',          cat: 'cat-watch' },
  { pattern: 'HONOR Watch %',           cat: 'cat-watch' },
  { pattern: 'HONOR Band %',            cat: 'cat-watch' },
  { pattern: 'Xiaomi Watch %',          cat: 'cat-watch' },
  { pattern: 'Redmi Watch %',           cat: 'cat-watch' },
  { pattern: 'Amazfit %',               cat: 'cat-watch' },
  { pattern: 'Garmin %',                cat: 'cat-watch' },
  { pattern: 'Polar Pacer %',           cat: 'cat-watch' },
  { pattern: 'Fitbit Charge %',         cat: 'cat-watch' },
  { pattern: 'Samsung Galaxy Watch %',  cat: 'cat-watch' },
  { pattern: 'Vòng đeo %',             cat: 'cat-watch' },

  // ══════════ Phụ kiện di động (cat-mobile-acc-*) ══════════
  // Sạc dự phòng
  { pattern: 'Pin dự %',                cat: 'cat-mobile-acc-powerbank' },
  { pattern: 'Xmobile CS %',            cat: 'cat-mobile-acc-powerbank' },

  // Sạc, cáp
  { pattern: 'Adapter sạc %',           cat: 'cat-mobile-acc-charger' },
  { pattern: 'Adapter USB-C %',         cat: 'cat-mobile-acc-charger' },
  { pattern: 'Adapter 2 %',             cat: 'cat-mobile-acc-charger' },
  { pattern: 'Bộ Adapter %',            cat: 'cat-mobile-acc-charger' },
  { pattern: 'Bộ sạc %',               cat: 'cat-mobile-acc-charger' },
  { pattern: 'Sạc %',                   cat: 'cat-mobile-acc-charger' },
  { pattern: 'Cáp %',                   cat: 'cat-mobile-acc-charger' },
  { pattern: 'Đế điện %',               cat: 'cat-mobile-acc-charger' },

  // Ốp lưng điện thoại
  { pattern: 'Ốp lưng điện thoại %',    cat: 'cat-mobile-acc-case-phone' },
  { pattern: 'Ốp lưng iPhone %',        cat: 'cat-mobile-acc-case-phone' },
  { pattern: 'Ốp lưng Samsung %',       cat: 'cat-mobile-acc-case-phone' },

  // Ốp lưng máy tính bảng
  { pattern: 'Ốp lưng iPad %',          cat: 'cat-mobile-acc-case-tablet' },
  { pattern: 'Ốp lưng máy tính bảng %', cat: 'cat-mobile-acc-case-tablet' },
  { pattern: 'Bao da %',                cat: 'cat-mobile-acc-case-tablet' },
  { pattern: 'Magic Keyboard %',        cat: 'cat-mobile-acc-case-tablet' },

  // Ốp lưng còn lại (generic → phone case)
  { pattern: 'Ốp lưng %',              cat: 'cat-mobile-acc-case-phone' },

  // Miếng dán (screen protector)
  { pattern: 'Miếng dán camera %',      cat: 'cat-mobile-acc-cam-cover' },
  { pattern: 'Miếng dán Camera %',      cat: 'cat-mobile-acc-cam-cover' },
  { pattern: 'Miếng dán %',             cat: 'cat-mobile-acc-screen' },

  // Túi đựng AirPods
  { pattern: 'Túi đựng AirPods %',      cat: 'cat-mobile-acc-airpods-case' },

  // Quạt mini
  { pattern: 'Quạt %',                  cat: 'cat-mobile-acc-fan' },

  // Bút tablet
  { pattern: 'Bút %',                   cat: 'cat-mobile-acc-pen' },

  // Giá đỡ điện thoại/laptop
  { pattern: 'Giá đỡ %',               cat: 'cat-mobile-acc-stand' },
  { pattern: 'Chân đế %',              cat: 'cat-mobile-acc-stand' },

  // Dây đeo điện thoại
  { pattern: 'Dây đeo %',              cat: 'cat-mobile-acc-strap' },

  // Ống kính điện thoại
  { pattern: 'Ống kính %',             cat: 'cat-mobile-acc-lens' },

  // ══════════ Phụ kiện laptop, PC (cat-laptop-acc-*) ══════════
  // Hub, cáp chuyển đổi
  { pattern: 'Hub %',                   cat: 'cat-laptop-acc-hub' },
  { pattern: 'Dock Thunderbolt %',      cat: 'cat-laptop-acc-hub' },
  { pattern: 'Docking Station %',       cat: 'cat-laptop-acc-hub' },

  // Chuột máy tính
  { pattern: 'Chuột %',                cat: 'cat-laptop-acc-mouse' },

  // Bàn phím
  { pattern: 'Bàn phím %',             cat: 'cat-laptop-acc-keyboard' },
  { pattern: 'Bộ bàn %',               cat: 'cat-laptop-acc-keyboard' },

  // Router & Thiết bị mạng
  { pattern: 'Router %',               cat: 'cat-laptop-acc-router' },
  { pattern: 'Bộ Phát %',              cat: 'cat-laptop-acc-router' },

  // Balo, túi chống sốc
  { pattern: 'Balo %',                 cat: 'cat-laptop-acc-bag' },

  // Túi đựng phụ kiện (generic túi)
  { pattern: 'Túi %',                  cat: 'cat-laptop-acc-pouch' },

  // Phủ phím laptop
  { pattern: 'Phủ phím %',             cat: 'cat-laptop-acc-keyboard-cover' },

  // Phần mềm
  { pattern: 'Phần mềm %',             cat: 'cat-laptop-acc-software' },

  // Giá treo màn hình
  { pattern: 'Giá treo %',             cat: 'cat-laptop-acc-monitor-stand' },
  { pattern: 'Cánh tay %',             cat: 'cat-laptop-acc-monitor-stand' },
  { pattern: 'Đế laptop %',            cat: 'cat-laptop-acc-monitor-stand' },

  // Miếng lót chuột
  { pattern: 'Miếng lót %',            cat: 'cat-laptop-acc-mousepad' },

  // Bảng vẽ điện tử
  { pattern: 'Bảng vẽ %',              cat: 'cat-laptop-acc-drawing' },

  // ══════════ Thiết bị nghe nhìn (cat-av-*) ══════════
  // Tai nghe Bluetooth
  { pattern: 'Tai nghe Bluetooth %',    cat: 'cat-av-bt-earphone' },
  { pattern: 'Tai nghe True Wireless %', cat: 'cat-av-bt-earphone' },
  { pattern: 'Tai nghe không dây %',    cat: 'cat-av-bt-earphone' },

  // Tai nghe dây
  { pattern: 'Tai nghe dây %',          cat: 'cat-av-wire-earphone' },
  { pattern: 'Tai nghe có dây %',       cat: 'cat-av-wire-earphone' },

  // Tai nghe chụp tai
  { pattern: 'Tai nghe chụp tai %',     cat: 'cat-av-headphone' },

  // Tai nghe thể thao
  { pattern: 'Tai nghe thể thao %',     cat: 'cat-av-sport-earphone' },

  // Tai nghe generic → Bluetooth by default
  { pattern: 'Tai nghe %',              cat: 'cat-av-bt-earphone' },

  // Loa
  { pattern: 'Loa %',                   cat: 'cat-av-speaker' },

  // Micro
  { pattern: 'Micro %',                 cat: 'cat-av-mic' },

  // Máy chiếu
  { pattern: 'Máy chiếu %',             cat: 'cat-av-projector' },

  // Kính thông minh
  { pattern: 'Kính %',                  cat: 'cat-av-smartglass' },

  // Ổ cứng
  { pattern: 'Ổ cứng %',               cat: 'cat-av-hdd' },
  { pattern: 'Box ổ %',                cat: 'cat-av-hdd' },

  // Thẻ nhớ
  { pattern: 'Thẻ nhớ %',              cat: 'cat-av-sdcard' },

  // USB
  { pattern: 'USB %',                   cat: 'cat-av-usb' },

  // ══════════ Camera (cat-cam-*) ══════════
  { pattern: 'Camera giám sát %',       cat: 'cat-cam-security' },
  { pattern: 'Camera trong nhà %',      cat: 'cat-cam-indoor' },
  { pattern: 'Camera ngoài trời %',     cat: 'cat-cam-outdoor' },
  { pattern: 'Camera năng lượng %',     cat: 'cat-cam-solar' },
  { pattern: 'Camera 4G %',             cat: 'cat-cam-4g' },
  { pattern: 'Camera IP %',             cat: 'cat-cam-indoor' },
  { pattern: 'Camera WiFi %',           cat: 'cat-cam-indoor' },
  { pattern: 'Camera an ninh %',        cat: 'cat-cam-security' },

  // Chuông cửa Camera
  { pattern: 'Chuông cửa %',           cat: 'cat-cam-doorbell' },
  { pattern: 'Chân Tripod %',          cat: 'cat-cam-outdoor' },

  // Webcam
  { pattern: 'Webcam %',               cat: 'cat-cam-webcam' },

  // Camera generic → security
  { pattern: 'Camera %',               cat: 'cat-cam-security' },
];

(async () => {
  console.log('🔧 Fixing ALL product category assignments...\n');

  let totalFixed = 0;

  for (const rule of RULES) {
    const result = await p.$executeRawUnsafe(
      `UPDATE "Product" SET category_id = $1 WHERE name ILIKE $2 AND category_id != $1`,
      rule.cat,
      rule.pattern
    );
    if (result > 0) {
      console.log(`  ✓ "${rule.pattern}" → ${rule.cat}: ${result} updated`);
    }
    totalFixed += result;
  }

  console.log(`\n📊 Total updated: ${totalFixed} products`);

  // ══════════ Verification ══════════
  console.log('\n=== Verification: All categories ===');
  const cats = await p.category.findMany({ orderBy: { sort_order: 'asc' } });
  const catMap = {};
  cats.forEach(c => { catMap[c.id] = c; });

  // Group by root
  const roots = cats.filter(c => !c.parent_id);
  for (const root of roots) {
    const children = cats.filter(c => c.parent_id === root.id);
    const rootCnt = await p.product.count({ where: { category_id: root.id, is_deleted: false } });
    let subtotal = rootCnt;

    console.log(`\n📁 ${root.name} (${root.id}): ${rootCnt}`);
    for (const child of children) {
      const cnt = await p.product.count({ where: { category_id: child.id, is_deleted: false } });
      subtotal += cnt;
      const status = cnt === 0 ? '⚠️' : '  ';
      console.log(`${status}  └ ${child.name} (${child.id}): ${cnt}`);
    }
    console.log(`   Subtotal: ${subtotal}`);
  }

  const total = await p.product.count({ where: { is_deleted: false } });
  console.log(`\n📊 Grand total: ${total}`);

  // Check unmatched
  const matched = await p.$queryRawUnsafe(`
    SELECT COUNT(*)::int as cnt FROM "Product" 
    WHERE is_deleted = false 
    AND category_id NOT IN (
      SELECT id FROM "Category"
    )
  `);
  console.log(`❓ Unmatched (no valid category): ${matched[0]?.cnt || 0}`);

  await p.$disconnect();
  console.log('\n✅ Done!');
})();
