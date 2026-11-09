/**
 * fix-brand-final.js
 * ─ Thêm brand mới phát hiện từ SP "Khác"
 * ─ Re-assign toàn bộ SP "Khác" theo keyword đầy đủ
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Brand mới cần tạo (chưa có trong DB)
const NEW_BRANDS = [
  { id: 'br-nothing',    name: 'Nothing' },
  { id: 'br-singpc',     name: 'SingPC' },
  { id: 'br-akko',       name: 'Akko' },
  { id: 'br-dareu',      name: 'Dareu' },
  { id: 'br-corsair',    name: 'Corsair' },
  { id: 'br-hyperwork',  name: 'HyperWork' },
  { id: 'br-insta360',   name: 'Insta360' },
  { id: 'br-boya',       name: 'Boya' },
  { id: 'br-wanbo',      name: 'Wanbo' },
  { id: 'br-adata',      name: 'ADATA' },
  { id: 'br-kioxia',     name: 'Kioxia' },
  { id: 'br-wacom',      name: 'Wacom' },
  { id: 'br-havit',      name: 'Havit' },
  { id: 'br-ulanzi',     name: 'Ulanzi' },
  { id: 'br-tomtoc',     name: 'Tomtoc' },
  { id: 'br-shokz',      name: 'Shokz' },
  { id: 'br-rapoo',      name: 'Rapoo' },
  { id: 'br-machenike',  name: 'Machenike' },
  { id: 'br-innostyle',  name: 'Innostyle' },
  { id: 'br-topo',       name: 'Topo Designs' },
  { id: 'br-tucano',     name: 'Tucano' },
  { id: 'br-hyperspace', name: 'Hyperspace' },
  { id: 'br-jcpal',      name: 'JCPAL' },
  { id: 'br-orico',      name: 'Orico' },
  { id: 'br-kidcare',    name: 'Kidcare' },
  { id: 'br-avap',       name: 'AVA+' },
  { id: 'br-hydrus',     name: 'Hydrus' },
  { id: 'br-tiandy',     name: 'Tiandy' },
  { id: 'br-philips',    name: 'Philips' },
  { id: 'br-eroc',       name: 'Eroc' },
  { id: 'br-hyundai',    name: 'Hyundai Audio' },
  { id: 'br-alphaworks', name: 'Alpha Works' },
  { id: 'br-thonet',     name: 'Thonet & Vander' },
];

// Keyword map đầy đủ (cho cả brand cũ rỗng + brand mới)
const KEYWORD_MAP = [
  // Brand mới
  { id: 'br-nothing',    kw: ['nothing phone', 'nothing phone ('] },
  { id: 'br-singpc',     kw: ['singpc'] },
  { id: 'br-akko',       kw: ['akko'] },
  { id: 'br-dareu',      kw: ['dareu'] },
  { id: 'br-corsair',    kw: ['corsair'] },
  { id: 'br-hyperwork',  kw: ['hyperwork'] },
  { id: 'br-insta360',   kw: ['insta360'] },
  { id: 'br-boya',       kw: ['boya'] },
  { id: 'br-wanbo',      kw: ['wanbo'] },
  { id: 'br-adata',      kw: ['adata'] },
  { id: 'br-kioxia',     kw: ['kioxia'] },
  { id: 'br-wacom',      kw: ['wacom'] },
  { id: 'br-havit',      kw: ['havit'] },
  { id: 'br-ulanzi',     kw: ['ulanzi'] },
  { id: 'br-tomtoc',     kw: ['tomtoc'] },
  { id: 'br-shokz',      kw: ['shokz', 'openfit', 'openrun'] },
  { id: 'br-rapoo',      kw: ['rapoo'] },
  { id: 'br-machenike',  kw: ['machenike'] },
  { id: 'br-innostyle',  kw: ['innostyle'] },
  { id: 'br-topo',       kw: ['topo designs'] },
  { id: 'br-tucano',     kw: ['tucano'] },
  { id: 'br-hyperspace', kw: ['hyperspace', 'hyperstand', 'hyperstuff'] },
  { id: 'br-jcpal',      kw: ['jcpal'] },
  { id: 'br-orico',      kw: ['orico'] },
  { id: 'br-kidcare',    kw: ['kidcare'] },
  { id: 'br-avap',       kw: ['ava+', ' ava+'] },
  { id: 'br-hydrus',     kw: ['hydrus'] },
  { id: 'br-tiandy',     kw: ['tiandy', 'tc-h'] },
  { id: 'br-philips',    kw: ['philips'] },
  { id: 'br-eroc',       kw: ['eroc'] },
  { id: 'br-hyundai',    kw: ['hyundai hd', 'hyundai karaoke'] },
  { id: 'br-alphaworks', kw: ['alpha works', 'alphaworks', 'aw-gen', 'aw-ikon', 'aw-w99'] },
  { id: 'br-thonet',     kw: ['thonet', 'thonet & vander', 'kurbis'] },

  // Brand cũ rỗng trong DB
  { id: 'br-bose',          kw: ['bose', 'quietcomfort', 'soundlink', 'soundbar'] },
  { id: 'br-sennheiser',    kw: ['sennheiser', 'momentum', 'cx plus', 'hd 450', 'hd 599'] },
  { id: 'br-jabra',         kw: ['jabra'] },
  { id: 'br-1more',         kw: ['1more'] },
  { id: 'br-edifier',       kw: ['edifier'] },
  { id: 'br-audio-technica',kw: ['audio-technica', 'audio technica'] },
  { id: 'br-shure',         kw: ['shure', 'sm7b', 'sm58', 'mv88', 'mv7', 'se215', 'se535'] },
  { id: 'br-skullcandy',    kw: ['skullcandy', 'hesh', 'crusher', 'indy', 'dime'] },
  { id: 'br-beats',         kw: ['beats studio', 'powerbeats', 'studio buds', 'studio pro', 'beatsx'] },
  { id: 'br-marshall',      kw: ['marshall', 'acton', 'stanmore', 'woburn', 'emberton', 'stockwell', 'major iv', 'minor iii', 'mode ii'] },
  { id: 'br-harman',        kw: ['harman kardon', 'harman/kardon', 'onyx studio', 'aura studio'] },
  { id: 'br-plantronics',   kw: ['plantronics', 'poly '] },
  { id: 'br-garmin',        kw: ['garmin', 'fenix', 'forerunner', 'vivoactive', 'instinct', 'epix', 'venu ', 'lily '] },
  { id: 'br-fitbit',        kw: ['fitbit', 'charge 6', 'charge 5', 'sense 2', 'versa 4', 'inspire 3'] },
  { id: 'br-polar',         kw: ['polar v', 'polar m', 'polar grit', 'polar ignite', 'polar pacer', 'polar vantage'] },
  { id: 'br-befit',         kw: ['befit'] },
  { id: 'br-nokia',         kw: ['nokia'] },
  { id: 'br-masstel',       kw: ['masstel'] },
  { id: 'br-mobell',        kw: ['mobell'] },
  { id: 'br-tecno',         kw: ['tecno'] },
  { id: 'br-infinix',       kw: ['infinix', 'hot 40', 'note 40', 'smart 8', 'zero 30'] },
  { id: 'br-itel',          kw: ['itel '] },
  { id: 'br-gigabyte',      kw: ['gigabyte', 'aorus'] },
  { id: 'br-lg',            kw: ['lg gram', 'lg 27', 'lg 32', 'lg oled', 'lg ultragear', 'lg 24'] },
  { id: 'br-aukey',         kw: ['aukey'] },
  { id: 'br-belkin',        kw: ['belkin', 'boostcharge', 'boost↑charge'] },
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
  { id: 'br-hikvision',     kw: ['hikvision', 'ds-2cd'] },
  { id: 'br-kbone',         kw: ['kbvision', 'kbone'] },
  { id: 'br-reolink',       kw: ['reolink'] },
  { id: 'br-annke',         kw: ['annke'] },
  { id: 'br-imilab',        kw: ['imilab'] },
  { id: 'br-vantech',       kw: ['vantech'] },
  { id: 'br-linksys',       kw: ['linksys', 'velop'] },
  { id: 'br-dlink',         kw: ['d-link', 'dlink'] },
  { id: 'br-netgear',       kw: ['netgear', 'nighthawk', 'orbi'] },
  { id: 'br-mercusys',      kw: ['mercusys'] },
  { id: 'br-wd',            kw: ['western digital', 'wd blue', 'wd red', 'wd green', 'wd purple', 'wd black', 'my passport', 'my cloud', 'elements hdd'] },
  { id: 'br-toshiba',       kw: ['toshiba'] },
  { id: 'br-lexar',         kw: ['lexar'] },
  { id: 'br-pny',           kw: ['pny '] },
  { id: 'br-transcend',     kw: ['transcend'] },
];

const FALLBACK_ID = 'brand-other';

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log(' Fix Brand Final Pass');
  console.log('══════════════════════════════════════════════');

  // ── 1. Tạo brand mới ─────────────────────────────────────────────────────
  console.log('\n[1] Tạo brand mới...');
  for (const b of NEW_BRANDS) {
    await prisma.brand.upsert({
      where: { id: b.id },
      update: {},
      create: { id: b.id, name: b.name },
    });
    process.stdout.write(`   ✓ ${b.name}\n`);
  }

  // ── 2. Load brand IDs hợp lệ ─────────────────────────────────────────────
  const allBrands = await prisma.brand.findMany({ where: { is_deleted: false } });
  const validIds = new Set(allBrands.map(b => b.id));

  // Lọc + build keyword list, dài trước
  const kwBrand = [];
  for (const m of KEYWORD_MAP) {
    if (!validIds.has(m.id)) { console.log(`   ⚠️  skip [${m.id}]`); continue; }
    for (const kw of m.kw) {
      kwBrand.push({ kw: kw.toLowerCase(), brandId: m.id });
    }
  }
  kwBrand.sort((a, b) => b.kw.length - a.kw.length);
  console.log(`\n[2] ${kwBrand.length} keyword sẵn sàng`);

  // ── 3. Re-scan SP "Khác" ──────────────────────────────────────────────────
  console.log('\n[3] Re-scan SP brand=Khác...');
  const PAGE = 500;
  let updated = 0;
  let stillKhac = 0;
  let offset = 0;

  while (true) {
    const products = await prisma.product.findMany({
      where: { brand_id: FALLBACK_ID, is_deleted: false },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
      skip: offset,
      take: PAGE,
    });
    if (products.length === 0) break;

    const groups = {};
    let matched_count = 0;
    for (const p of products) {
      const lower = p.name.toLowerCase();
      let matched = null;
      for (const { kw, brandId } of kwBrand) {
        if (lower.includes(kw)) { matched = brandId; break; }
      }
      if (matched) {
        if (!groups[matched]) groups[matched] = [];
        groups[matched].push(p.id);
        matched_count++;
      } else {
        stillKhac++;
      }
    }

    for (const [bid, ids] of Object.entries(groups)) {
      await prisma.product.updateMany({ where: { id: { in: ids } }, data: { brand_id: bid } });
      updated += ids.length;
    }

    // Nếu không update gì → tăng offset để không loop mãi
    if (matched_count === 0) {
      offset += PAGE;
    }

    const total_processed = updated + stillKhac;
    process.stdout.write(`\r   Cập nhật: ${updated} | còn Khác: ${stillKhac} | tổng: ${total_processed}`);
    if (products.length < PAGE && matched_count === 0) break;
  }

  console.log('\n');
  console.log('══════════════════════════════════════════════');
  console.log(` ✅ Hoàn thành!  Cập nhật: ${updated} | Còn Khác: ${stillKhac}`);
  console.log('══════════════════════════════════════════════');

  // Thống kê
  console.log('\n[4] Phân bổ brand (có sản phẩm):');
  const stats = await prisma.$queryRaw`
    SELECT b.name, COUNT(p.id)::int AS cnt
    FROM "Brand" b
    JOIN "Product" p ON p.brand_id = b.id AND p.is_deleted = false
    WHERE b.is_deleted = false
    GROUP BY b.id, b.name
    ORDER BY cnt DESC
  `;
  for (const r of stats) {
    const bar = '█'.repeat(Math.min(36, Math.ceil(r.cnt / 80)));
    console.log(`  ${r.name.padEnd(22)} ${String(r.cnt).padStart(6)}  ${bar}`);
  }

  // Brand vẫn rỗng
  const emptyBrands = await prisma.$queryRaw`
    SELECT b.id, b.name
    FROM "Brand" b
    WHERE b.is_deleted = false
      AND NOT EXISTS (SELECT 1 FROM "Product" p WHERE p.brand_id = b.id AND p.is_deleted = false)
    ORDER BY b.name
  `;
  console.log(`\n[5] Brand còn rỗng (${emptyBrands.length}):`);
  emptyBrands.forEach(b => console.log(`  [${b.id}] ${b.name}`));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
