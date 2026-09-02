/**
 * migrate-brands-67.js
 * ─────────────────────────────────────────────────────────────────
 * Tái cấu trúc Brand system thành đúng 67 thương hiệu + "Khác"
 * theo yêu cầu cụ thể của ứng dụng.
 *
 * Cách dùng:
 *   node scripts/migrate-brands-67.js
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

// ══════════════════════════════════════════════════════════════════
// 67 BRAND + "KHÁC" = 68 BRAND
// ══════════════════════════════════════════════════════════════════
const NEW_BRANDS = [
  { id: 'br-adata',          name: 'ADATA' },
  { id: 'br-avaplus',        name: 'AVA+' },
  { id: 'br-acer',           name: 'Acer' },
  { id: 'br-akko',           name: 'Akko' },
  { id: 'br-alpha-works',    name: 'Alpha Works' },
  { id: 'br-amazfit',        name: 'Amazfit' },
  { id: 'br-anker',          name: 'Anker' },
  { id: 'br-apple',          name: 'Apple' },
  { id: 'br-asus',           name: 'Asus' },
  { id: 'br-baseus',         name: 'Baseus' },
  { id: 'br-boya',           name: 'Boya' },
  { id: 'br-corsair',        name: 'Corsair' },
  { id: 'br-dahua',          name: 'Dahua' },
  { id: 'br-dareu',          name: 'Dareu' },
  { id: 'br-dell',           name: 'Dell' },
  { id: 'br-ezviz',          name: 'EZVIZ' },
  { id: 'br-eroc',           name: 'Eroc' },
  { id: 'br-honor',          name: 'HONOR' },
  { id: 'br-hp',             name: 'HP' },
  { id: 'br-havit',          name: 'Havit' },
  { id: 'br-huawei',         name: 'Huawei' },
  { id: 'br-hydrus',         name: 'Hydrus' },
  { id: 'br-hyperwork',      name: 'HyperWork' },
  { id: 'br-hyperspace',     name: 'Hyperspace' },
  { id: 'br-hyundai-audio',  name: 'Hyundai Audio' },
  { id: 'br-imou',           name: 'Imou' },
  { id: 'br-innostyle',      name: 'Innostyle' },
  { id: 'br-insta360',       name: 'Insta360' },
  { id: 'br-jbl',            name: 'JBL' },
  { id: 'br-jcpal',          name: 'JCPAL' },
  { id: 'br-kidcare',        name: 'Kidcare' },
  { id: 'br-kingston',       name: 'Kingston' },
  { id: 'br-kioxia',         name: 'Kioxia' },
  { id: 'br-lenovo',         name: 'Lenovo' },
  { id: 'br-logitech',       name: 'Logitech' },
  { id: 'br-msi',            name: 'MSI' },
  { id: 'br-machenike',      name: 'Machenike' },
  { id: 'br-marshall',       name: 'Marshall' },
  { id: 'br-microsoft',      name: 'Microsoft' },
  { id: 'br-motorola',       name: 'Motorola' },
  { id: 'br-oppo',           name: 'OPPO' },
  { id: 'br-orico',          name: 'Orico' },
  { id: 'br-philips',        name: 'Philips' },
  { id: 'br-rapoo',          name: 'Rapoo' },
  { id: 'br-razer',          name: 'Razer' },
  { id: 'br-samsung',        name: 'Samsung' },
  { id: 'br-sandisk',        name: 'SanDisk' },
  { id: 'br-seagate',        name: 'Seagate' },
  { id: 'br-shokz',          name: 'Shokz' },
  { id: 'br-singpc',         name: 'SingPC' },
  { id: 'br-sony',           name: 'Sony' },
  { id: 'br-totolink',       name: 'TOTOLINK' },
  { id: 'br-tplink',         name: 'TP-Link' },
  { id: 'br-thonet-vander',  name: 'Thonet & Vander' },
  { id: 'br-tiandy',         name: 'Tiandy' },
  { id: 'br-tomtoc',         name: 'Tomtoc' },
  { id: 'br-topo-designs',   name: 'Topo Designs' },
  { id: 'br-tucano',         name: 'Tucano' },
  { id: 'br-ugreen',         name: 'Ugreen' },
  { id: 'br-ulanzi',         name: 'Ulanzi' },
  { id: 'br-wacom',          name: 'Wacom' },
  { id: 'br-wanbo',          name: 'Wanbo' },
  { id: 'br-xiaomi',         name: 'Xiaomi' },
  { id: 'br-xmobile',        name: 'Xmobile' },
  { id: 'br-realme',         name: 'realme' },
  { id: 'br-vivo',           name: 'vivo' },
  { id: 'br-khac',           name: 'Khác' },
];

const NEW_BRAND_IDS = new Set(NEW_BRANDS.map(b => b.id));

// ── Mapping brand cũ → brand mới ────────────────────────────────
const OLD_TO_NEW_MAP = {
  // Giữ nguyên (ID khớp)
  'br-apple':      'br-apple',
  'br-samsung':    'br-samsung',
  'br-oppo':       'br-oppo',
  'br-xiaomi':     'br-xiaomi',
  'br-vivo':       'br-vivo',
  'br-realme':     'br-realme',
  'br-honor':      'br-honor',
  'br-motorola':   'br-motorola',
  'br-asus':       'br-asus',
  'br-hp':         'br-hp',
  'br-lenovo':     'br-lenovo',
  'br-acer':       'br-acer',
  'br-dell':       'br-dell',
  'br-msi':        'br-msi',
  'br-microsoft':  'br-microsoft',
  'br-razer':      'br-razer',
  'br-huawei':     'br-huawei',
  'br-amazfit':    'br-amazfit',
  'br-anker':      'br-anker',
  'br-baseus':     'br-baseus',
  'br-ugreen':     'br-ugreen',
  'br-xmobile':    'br-xmobile',
  'br-jbl':        'br-jbl',
  'br-logitech':   'br-logitech',
  'br-marshall':   'br-marshall',
  'br-dahua':      'br-dahua',
  'br-imou':       'br-imou',
  'br-ezviz':      'br-ezviz',
  'br-seagate':    'br-seagate',
  'br-sandisk':    'br-sandisk',
  'br-kingston':   'br-kingston',
  'br-totolink':   'br-totolink',

  // Map sang brand mới
  'br-nokia':      'br-khac',
  'br-masstel':    'br-khac',
  'br-mobell':     'br-khac',
  'br-tecno':      'br-khac',
  'br-infinix':    'br-khac',
  'br-itel':       'br-khac',
  'br-lg':         'br-khac',
  'br-gigabyte':   'br-khac',
  'br-garmin':     'br-khac',
  'br-befit':      'br-khac',
  'br-fitbit':     'br-khac',
  'br-polar':      'br-khac',
  'br-energizer':  'br-khac',
  'br-romoss':     'br-khac',
  'br-aukey':      'br-khac',
  'br-ravpower':   'br-khac',
  'br-belkin':     'br-khac',
  'br-pisen':      'br-khac',
  'br-spigen':     'br-khac',
  'br-esr':        'br-khac',
  'br-hydragel':   'br-hydrus',
  'br-capdase':    'br-khac',
  'br-memumi':     'br-khac',
  'br-zagg':       'br-jcpal',
  'br-nillkin':    'br-khac',
  'br-rock':       'br-khac',
  'br-sony-audio': 'br-sony',
  'br-bose':       'br-khac',
  'br-sennheiser': 'br-khac',
  'br-jabra':      'br-khac',
  'br-edifier':    'br-khac',
  'br-1more':      'br-khac',
  'br-skullcandy': 'br-khac',
  'br-beats':      'br-khac',
  'br-shure':      'br-khac',
  'br-audio-technica':'br-khac',
  'br-plantronics':'br-khac',
  'br-harman':     'br-khac',
  'br-hikvision':  'br-tiandy',
  'br-kbone':      'br-khac',
  'br-reolink':    'br-khac',
  'br-tp-link':    'br-tplink',
  'br-xiaomi-cam': 'br-xiaomi',
  'br-vantech':    'br-khac',
  'br-kamera':     'br-khac',
  'br-imilab':     'br-khac',
  'br-annke':      'br-khac',
  'br-wd':         'br-seagate',
  'br-samsung-st': 'br-samsung',
  'br-lexar':      'br-kioxia',
  'br-transcend':  'br-adata',
  'br-toshiba':    'br-kioxia',
  'br-pny':        'br-adata',
  'br-tplink-net': 'br-tplink',
  'br-asus-net':   'br-asus',
  'br-linksys':    'br-khac',
  'br-dlink':      'br-khac',
  'br-netgear':    'br-khac',
  'br-mercusys':   'br-tplink',
  'br-cam-webcam': 'br-logitech',
};

async function main() {
  console.log('\n🏷️  MIGRATE BRANDS → 67 Thương hiệu + Khác');
  console.log('═'.repeat(60));

  // 1. Lấy brand cũ
  const oldBrands = await prisma.brand.findMany({ select: { id: true, name: true } });
  console.log(`  📋 Brand cũ trong DB: ${oldBrands.length}`);

  // 2. Reassign products trước khi xóa brand cũ
  console.log('\n  🔄 Reassign brand_id cho sản phẩm hiện tại...');
  let totalReassigned = 0;

  for (const old of oldBrands) {
    if (NEW_BRAND_IDS.has(old.id)) continue; // brand cũ trùng ID với brand mới → giữ nguyên

    const newBrandId = OLD_TO_NEW_MAP[old.id] || 'br-khac';
    const result = await prisma.product.updateMany({
      where: { brand_id: old.id },
      data:  { brand_id: newBrandId },
    });
    if (result.count > 0) {
      console.log(`    ${old.id} (${old.name}) → ${newBrandId}: ${result.count} sản phẩm`);
      totalReassigned += result.count;
    }
  }
  console.log(`  ✅ Reassigned ${totalReassigned} sản phẩm`);

  // 3. Xóa brand cũ không nằm trong danh sách mới
  const brandsToDelete = oldBrands.filter(b => !NEW_BRAND_IDS.has(b.id)).map(b => b.id);
  if (brandsToDelete.length > 0) {
    console.log(`\n  🗑️  Xóa ${brandsToDelete.length} brand cũ...`);
    await prisma.brand.deleteMany({ where: { id: { in: brandsToDelete } } });
    console.log(`  ✅ Đã xóa`);
  }

  // 4. Upsert brand mới
  console.log(`\n  📥 Insert/Update 68 brand mới...`);
  for (const brand of NEW_BRANDS) {
    await prisma.brand.upsert({
      where: { id: brand.id },
      update: { name: brand.name, is_deleted: false },
      create: { id: brand.id, name: brand.name, is_deleted: false },
    });
  }
  console.log(`  ✅ Đã insert/update ${NEW_BRANDS.length} brand`);

  // 5. Verify
  console.log('\n  🔍 Kiểm tra kết quả...');
  const finalBrands = await prisma.brand.count();
  const invalidProds = await prisma.product.count({
    where: { brand_id: { notIn: NEW_BRANDS.map(b => b.id) } },
  });
  const totalProducts = await prisma.product.count();

  // Count per brand
  const brandCounts = await prisma.$queryRaw`
    SELECT brand_id as id, COUNT(*)::int as cnt 
    FROM "Product" WHERE is_deleted = false 
    GROUP BY brand_id ORDER BY cnt DESC
  `;

  console.log('\n  ╔═══════════════════════════════════════════╗');
  console.log('  ║       BRAND MIGRATION HOÀN THÀNH          ║');
  console.log('  ╠═══════════════════════════════════════════╣');
  console.log(`  ║  Tổng brand mới       : ${String(finalBrands).padStart(5)}            ║`);
  console.log(`  ║  Tổng sản phẩm        : ${String(totalProducts).padStart(8)}         ║`);
  console.log(`  ║  SP reassigned        : ${String(totalReassigned).padStart(8)}         ║`);
  console.log(`  ║  SP brand không hợp lệ: ${String(invalidProds).padStart(5)}            ║`);
  console.log('  ╚═══════════════════════════════════════════╝');

  if (invalidProds > 0) {
    console.warn(`\n  ⚠️  Còn ${invalidProds} SP có brand_id không hợp lệ!`);
  } else {
    console.log('\n  ✅ Tất cả sản phẩm đều có brand hợp lệ!');
  }

  console.log('\n  📊 Top 10 brand theo số sản phẩm:');
  for (const row of brandCounts.slice(0, 10)) {
    const brandName = NEW_BRANDS.find(b => b.id === row.id)?.name || row.id;
    console.log(`    ${brandName.padEnd(20)} : ${String(row.cnt).padStart(8)}`);
  }
}

main()
  .catch(e => { console.error('\n❌ Lỗi:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
