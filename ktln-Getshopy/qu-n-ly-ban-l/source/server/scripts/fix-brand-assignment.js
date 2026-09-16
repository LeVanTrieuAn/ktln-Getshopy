/**
 * fix-brand-assignment.js  (v2)
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Xóa brand "aaa" và "bbb"
 * 2. Load TẤT CẢ brand thật từ DB → tự động build keyword map từ tên brand
 * 3. Với mỗi sản phẩm: scan tên để tìm brand khớp → cập nhật brand_id
 * ─────────────────────────────────────────────────────────────────────────────
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Extra aliases: khi tên brand trong DB không đủ để khớp keyword trong tên SP
// Format: { brandName (lowercase, khớp với brand.name.toLowerCase()) → extra keywords }
const EXTRA_KEYWORDS = {
  'apple':        ['iphone', 'ipad', 'macbook', 'mac pro', 'mac mini', 'imac', 'airpods', 'apple watch', 'homepod'],
  'samsung':      ['galaxy'],
  'asus':         ['rog', 'zenbook', 'vivobook', 'proart', 'tuf gaming', 'expertbook'],
  'hp':           ['hewlett', 'elitebook', 'probook', 'pavilion', 'envy', 'omen', 'spectre'],
  'lenovo':       ['thinkpad', 'thinkbook', 'ideapad', 'legion', 'yoga'],
  'acer':         ['nitro', 'predator', 'swift', 'spin', 'aspire', 'extensa', 'travelmate'],
  'dell':         ['xps', 'inspiron', 'vostro', 'latitude', 'alienware', 'g15', 'g16'],
  'msi':          ['modern 14', 'modern 15', 'prestige', 'stealth', 'raider', 'creator', 'summit', 'cyborg', 'katana', 'pulse', 'crosshair'],
  'microsoft':    ['surface'],
  'gigabyte':     ['aorus'],
  'razer':        ['blade 15', 'blade 18'],
  'oppo':         ['reno', 'find x', 'find n'],
  'xiaomi':       ['redmi', 'poco', 'mi '],
  'vivo':         ['iqoo'],
  'motorola':     ['moto g', 'moto e', 'edge+', 'razr'],
  'sony':         ['walkman', 'wh-1000', 'wf-1000', 'wh-ch', 'linkbuds'],
  'anker':        ['soundcore'],
  'western digital': ['wd ', 'wd_', 'my passport', 'my cloud', 'elements'],
  'garmin':       ['fenix', 'forerunner', 'vivoactive', 'instinct', 'epix'],
  'dji':          ['osmo', 'mavic', 'mini 3', 'mini 4', 'air 3'],
  'gopro':        ['hero12', 'hero13', 'hero 1', 'hero 2', 'max 360'],
  'amazfit':      ['bip', 'gts', 'gtr'],
  'nokia/hmd':    ['nokia'],
  'kbvision':     ['kbone', 'kbvision'],
};

// Thứ tự ưu tiên: brand nào khớp nhiều ký tự hơn sẽ thắng (xử lý sau)
// Brand "Khác" dùng khi không khớp gì
const FALLBACK_NAME = 'Khác';

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log(' Fix Brand Assignment  v2');
  console.log('══════════════════════════════════════════════');

  // ── 1. Xóa brand aaa và bbb ────────────────────────────────────────────────
  console.log('\n[1] Xóa brand có tên aaa / bbb...');
  const removed = await prisma.brand.deleteMany({
    where: { name: { in: ['aaa', 'bbb', 'AAA', 'BBB'] } }
  });
  console.log(`   Đã xóa: ${removed.count} brand`);

  // ── 2. Load brand ──────────────────────────────────────────────────────────
  const allBrands = await prisma.brand.findMany({ where: { is_deleted: false } });
  console.log(`\n[2] Brands trong DB: ${allBrands.length}`);

  // Tìm / tạo brand "Khác"
  let fallbackBrand = allBrands.find(b => b.name.toLowerCase() === 'khác' || b.name.toLowerCase() === 'other');
  if (!fallbackBrand) {
    fallbackBrand = await prisma.brand.create({ data: { id: 'brand-other', name: 'Khác' } });
    allBrands.push(fallbackBrand);
    console.log(`   Tạo mới brand "Khác" (id: brand-other)`);
  }

  // ── 3. Build keyword → brand_id map ───────────────────────────────────────
  // Mỗi phần tử: { keywords: string[], brandId: string, priority: number }
  // priority = độ dài keyword dài nhất (để từ cụ thể > chung)
  const mappings = [];

  for (const brand of allBrands) {
    if (brand.id === fallbackBrand.id) continue;
    const nameLower = brand.name.toLowerCase().trim();

    // Keyword chính = tên brand
    const kws = [nameLower];

    // Thêm alias
    for (const [alias, extras] of Object.entries(EXTRA_KEYWORDS)) {
      if (nameLower.includes(alias) || alias.includes(nameLower)) {
        kws.push(...extras);
      }
    }

    // Dedup
    const unique = [...new Set(kws)];
    mappings.push({ brandId: brand.id, brandName: brand.name, keywords: unique });
  }

  // Sắp xếp: keyword dài trước (greedy longest match)
  // Flatten thành (keyword, brandId)[]
  const kwBrand = [];
  for (const m of mappings) {
    for (const kw of m.keywords) {
      kwBrand.push({ kw, brandId: m.brandId, brandName: m.brandName });
    }
  }
  kwBrand.sort((a, b) => b.kw.length - a.kw.length);

  console.log(`   Tổng keyword: ${kwBrand.length}`);

  // ── 4. Scan và cập nhật sản phẩm ─────────────────────────────────────────
  console.log('\n[3] Scan + cập nhật...');
  const PAGE = 1000;
  let skip = 0;
  let totalUpdated = 0;
  let totalUnmatched = 0;
  let totalSkipped = 0;
  const brandStats = {};

  while (true) {
    const products = await prisma.product.findMany({
      where: { is_deleted: false },
      select: { id: true, name: true, brand_id: true },
      orderBy: { id: 'asc' },
      skip,
      take: PAGE,
    });

    if (products.length === 0) break;

    // Group by new brand_id
    const groups = {};

    for (const p of products) {
      const lowerName = p.name.toLowerCase();

      let matched = null;
      for (const { kw, brandId } of kwBrand) {
        if (lowerName.includes(kw)) {
          matched = brandId;
          break;
        }
      }

      const newBrandId = matched || fallbackBrand.id;
      brandStats[newBrandId] = (brandStats[newBrandId] || 0) + 1;

      if (newBrandId === p.brand_id) {
        totalSkipped++;
        continue;
      }

      if (!groups[newBrandId]) groups[newBrandId] = [];
      groups[newBrandId].push(p.id);

      if (!matched) totalUnmatched++;
    }

    // Batch update
    for (const [bid, ids] of Object.entries(groups)) {
      await prisma.product.updateMany({
        where: { id: { in: ids } },
        data: { brand_id: bid },
      });
      totalUpdated += ids.length;
    }

    const done = skip + products.length;
    process.stdout.write(`\r   Xử lý: ${done.toLocaleString()} SP | cập nhật: ${totalUpdated.toLocaleString()} | skip: ${totalSkipped.toLocaleString()}`);

    skip += PAGE;
    if (products.length < PAGE) break;
  }

  console.log('\n');
  console.log('══════════════════════════════════════════════');
  console.log(` ✅ Hoàn thành!`);
  console.log(`    Tổng cập nhật       : ${totalUpdated.toLocaleString()}`
  );
  console.log(`    → Không khớp (Khác) : ${totalUnmatched.toLocaleString()}`);
  console.log(`    Giữ nguyên (skip)   : ${totalSkipped.toLocaleString()}`);
  console.log('══════════════════════════════════════════════');

  // Thống kê cuối
  console.log('\n[4] Phân bổ brand:');
  const rows = await prisma.$queryRaw`
    SELECT b.name, COUNT(p.id)::int AS cnt
    FROM "Brand" b
    LEFT JOIN "Product" p ON p.brand_id = b.id AND p.is_deleted = false
    WHERE b.is_deleted = false
    GROUP BY b.id, b.name
    ORDER BY cnt DESC
    LIMIT 30
  `;
  for (const r of rows) {
    if (r.cnt === 0) continue;
    const bar = '█'.repeat(Math.min(40, Math.ceil(r.cnt / 50)));
    console.log(`   ${r.name.padEnd(22)} ${String(r.cnt).padStart(6)}  ${bar}`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
