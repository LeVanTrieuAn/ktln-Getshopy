/**
 * fix-brand-cleanup.js
 * ──────────────────────────────────────────────────────────────────────
 * 1. Merge brand trùng (b1→br-apple, b2→br-samsung, b3→br-asus, b4→br-sony-audio, b5→br-xiaomi)
 * 2. Merge brand sub-duplicate (br-samsung-st→br-samsung, br-asus-net→br-asus, etc)
 * 3. Hard-delete brand rỗng "ảo" (không có SP và tên trùng với brand đã có)
 * 4. Thêm keyword mới cho brand rỗng thật → re-scan toàn bộ SP "Khác"
 * ──────────────────────────────────────────────────────────────────────
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── Bước 1: Map brand trùng về brand chính ───────────────────────────────────
// { fromId: toId }
const MERGE_MAP = {
  'b1': 'br-apple',
  'b2': 'br-samsung',
  'b3': 'br-asus',
  'b4': 'br-sony-audio',
  'b5': 'br-xiaomi',
  'br-samsung-st':  'br-samsung',
  'br-asus-net':    'br-asus',
  'br-tplink-net':  'br-tp-link',
  'br-xiaomi-cam':  'br-xiaomi',
};

// ── Bước 2: Keyword map cho brand rỗng thật ──────────────────────────────────
// Sẽ chạy trên SP đang brand_id = 'brand-other'
// Format: { brandId: string (phải tồn tại trong DB), keywords: string[] }
const EMPTY_BRAND_KEYWORDS = [
  { id: 'br-bose',          kw: ['bose', 'quietcomfort', 'soundlink', 'soundbar 500', 'soundbar 300'] },
  { id: 'br-sennheiser',    kw: ['sennheiser', 'momentum', 'hd 450', 'hd 350', 'hd 599', 'cx plus'] },
  { id: 'br-jabra',         kw: ['jabra', 'evolve', 'talk 55'] },
  { id: 'br-1more',         kw: ['1more', '1 more'] },
  { id: 'br-edifier',       kw: ['edifier'] },
  { id: 'br-audio-technica',kw: ['audio-technica', 'audio technica', 'ath-m', 'ath-wp'] },
  { id: 'br-shure',         kw: ['shure', 'se215', 'se315', 'se535', 'mv88', 'mv7', 'sm7b', 'sm58'] },
  { id: 'br-skullcandy',    kw: ['skullcandy', 'hesh', 'crusher', 'indy', 'dime'] },
  { id: 'br-beats',         kw: ['beats', 'beatsstudio', 'powerbeats', 'studio buds', 'studio pro'] },
  { id: 'br-marshall',      kw: ['marshall', 'acton', 'stanmore', 'woburn', 'emberton', 'stockwell', 'major iv', 'minor iii', 'mode ii'] },
  { id: 'br-harman',        kw: ['harman kardon', 'harman/kardon', 'harman', 'onyx studio', 'aura studio'] },
  { id: 'br-plantronics',   kw: ['plantronics', 'poly '] },
  { id: 'br-logitech',      kw: ['logitech'] },

  { id: 'br-garmin',        kw: ['garmin', 'fenix', 'forerunner', 'vivoactive', 'instinct', 'epix', 'venu', 'lily'] },
  { id: 'br-fitbit',        kw: ['fitbit', 'charge 6', 'charge 5', 'sense 2', 'versa 4', 'inspire 3'] },
  { id: 'br-polar',         kw: ['polar ', 'polar v', 'polar m', 'polar grit', 'polar ignite', 'polar pacer'] },
  { id: 'br-befit',         kw: ['befit'] },

  { id: 'br-nokia',         kw: ['nokia'] },
  { id: 'br-masstel',       kw: ['masstel'] },
  { id: 'br-mobell',        kw: ['mobell'] },
  { id: 'br-tecno',         kw: ['tecno'] },
  { id: 'br-infinix',       kw: ['infinix', 'hot 40', 'note 40', 'smart 8', 'zero 30'] },
  { id: 'br-itel',          kw: ['itel '] },

  { id: 'br-gigabyte',      kw: ['gigabyte', 'aorus'] },
  { id: 'br-lg',            kw: ['lg gram', 'lg '] },

  { id: 'br-aukey',         kw: ['aukey'] },
  { id: 'br-belkin',        kw: ['belkin', 'boost↑charge', 'boostcharge'] },
  { id: 'br-ravpower',      kw: ['ravpower', 'rav power'] },
  { id: 'br-romoss',        kw: ['romoss'] },
  { id: 'br-pisen',         kw: ['pisen'] },
  { id: 'br-rock',          kw: ['rock '] },
  { id: 'br-energizer',     kw: ['energizer'] },
  { id: 'br-spigen',        kw: ['spigen'] },
  { id: 'br-esr',           kw: ['esr '] },
  { id: 'br-hydragel',      kw: ['hydragel', 'hydro gel'] },
  { id: 'br-capdase',       kw: ['capdase'] },
  { id: 'br-memumi',        kw: ['mẹ muội', 'me muoi', 'mẹmuội', 'memumi'] },
  { id: 'br-zagg',          kw: ['zagg', 'invisibleshield'] },
  { id: 'br-nillkin',       kw: ['nillkin'] },

  { id: 'br-hikvision',     kw: ['hikvision', 'hikam', 'ds-2cd'] },
  { id: 'br-dahua',         kw: ['dahua'] },
  { id: 'br-kbone',         kw: ['kbvision', 'kbone'] },
  { id: 'br-reolink',       kw: ['reolink'] },
  { id: 'br-imou',          kw: ['imou'] },
  { id: 'br-ezviz',         kw: ['ezviz'] },
  { id: 'br-annke',         kw: ['annke'] },
  { id: 'br-imilab',        kw: ['imilab'] },
  { id: 'br-vantech',       kw: ['vantech', 'v-tech', 'vtech'] },

  { id: 'br-linksys',       kw: ['linksys', 'velop'] },
  { id: 'br-dlink',         kw: ['d-link', 'dlink'] },
  { id: 'br-netgear',       kw: ['netgear', 'nighthawk', 'orbi'] },
  { id: 'br-mercusys',      kw: ['mercusys'] },

  { id: 'br-wd',            kw: ['western digital', 'wd ', 'wd_', 'my passport', 'my cloud', 'elements hdd', 'wd blue', 'wd red', 'wd green', 'wd purple', 'wd black'] },
  { id: 'br-toshiba',       kw: ['toshiba'] },
  { id: 'br-lexar',         kw: ['lexar'] },
  { id: 'br-pny',           kw: ['pny '] },
  { id: 'br-transcend',     kw: ['transcend'] },
];

const FALLBACK_ID = 'brand-other';

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log(' Brand Cleanup & Re-assign');
  console.log('══════════════════════════════════════════════');

  // ── Bước 1: Merge brand trùng ─────────────────────────────────────────────
  console.log('\n[1] Merge brand trùng...');
  let mergedTotal = 0;
  for (const [fromId, toId] of Object.entries(MERGE_MAP)) {
    // Kiểm tra fromId có tồn tại không
    const fromBrand = await prisma.brand.findUnique({ where: { id: fromId } });
    if (!fromBrand) { console.log(`   Skip [${fromId}] (không tồn tại)`); continue; }

    // Chuyển SP về brand mới
    const moved = await prisma.product.updateMany({
      where: { brand_id: fromId },
      data: { brand_id: toId },
    });

    // Xóa brand cũ
    await prisma.brand.delete({ where: { id: fromId } });
    mergedTotal += moved.count;
    console.log(`   [${fromId}] → [${toId}]: ${moved.count} SP, brand đã xóa`);
  }
  console.log(`   Tổng SP được merge: ${mergedTotal}`);

  // ── Bước 2: Load brand còn lại ────────────────────────────────────────────
  const allBrands = await prisma.brand.findMany({ where: { is_deleted: false } });
  const validIds = new Set(allBrands.map(b => b.id));

  // Lọc mapping chỉ giữ brand ID tồn tại trong DB
  const activeMappings = EMPTY_BRAND_KEYWORDS.filter(m => {
    if (!validIds.has(m.id)) {
      console.log(`   ⚠️  Brand [${m.id}] không tồn tại trong DB, bỏ qua`);
      return false;
    }
    return true;
  });

  // Build keyword list, sort dài trước
  const kwBrand = [];
  for (const m of activeMappings) {
    for (const kw of m.kw) {
      kwBrand.push({ kw: kw.toLowerCase(), brandId: m.id });
    }
  }
  kwBrand.sort((a, b) => b.kw.length - a.kw.length);

  console.log(`\n[2] ${activeMappings.length} brand sẽ được scan (${kwBrand.length} keyword)`);

  // ── Bước 3: Scan SP đang là "Khác" ───────────────────────────────────────
  console.log('\n[3] Scan SP brand=Khác và re-assign...');
  const PAGE = 500;
  let skip = 0;
  let updated = 0;
  let stillKhac = 0;

  while (true) {
    const products = await prisma.product.findMany({
      where: { brand_id: FALLBACK_ID, is_deleted: false },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
      skip,
      take: PAGE,
    });

    if (products.length === 0) break;

    const groups = {};
    for (const p of products) {
      const lower = p.name.toLowerCase();
      let matched = null;
      for (const { kw, brandId } of kwBrand) {
        if (lower.includes(kw)) { matched = brandId; break; }
      }
      if (matched) {
        if (!groups[matched]) groups[matched] = [];
        groups[matched].push(p.id);
      } else {
        stillKhac++;
      }
    }

    for (const [bid, ids] of Object.entries(groups)) {
      await prisma.product.updateMany({
        where: { id: { in: ids } },
        data: { brand_id: bid },
      });
      updated += ids.length;
    }

    const done = skip + products.length;
    process.stdout.write(`\r   Xử lý: ${done.toLocaleString()} | cập nhật: ${updated} | còn Khác: ${stillKhac}`);

    // Do WHERE brand_id=FALLBACK chứ không skip offset (rows bị update sẽ disappear)
    // Nếu không có gì update trong lần này → thoát
    if (Object.keys(groups).length === 0) {
      skip += PAGE;
    }
    if (products.length < PAGE) break;
  }

  console.log('\n');
  console.log('══════════════════════════════════════════════');
  console.log(' ✅ Hoàn thành!');
  console.log(`    Merged brand trùng: ${mergedTotal} SP`);
  console.log(`    Re-assign Khác→đúng brand: ${updated} SP`);
  console.log(`    Còn lại trong Khác: ${stillKhac} SP`);
  console.log('══════════════════════════════════════════════');

  // Kết quả cuối
  console.log('\n[4] Phân bổ brand (top 40 có SP):');
  const stats = await prisma.$queryRaw`
    SELECT b.name, COUNT(p.id)::int AS cnt
    FROM "Brand" b
    JOIN "Product" p ON p.brand_id = b.id AND p.is_deleted = false
    WHERE b.is_deleted = false
    GROUP BY b.id, b.name
    ORDER BY cnt DESC
    LIMIT 40
  `;
  for (const r of stats) {
    const bar = '█'.repeat(Math.min(36, Math.ceil(r.cnt / 80)));
    console.log(`  ${r.name.padEnd(22)} ${String(r.cnt).padStart(6)}  ${bar}`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
