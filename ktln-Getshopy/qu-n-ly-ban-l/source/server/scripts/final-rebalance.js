/**
 * final-rebalance-v2.js
 * ─────────────────────────────────────────────────────────────────
 * Dùng pure SQL UPDATE...WHERE IN (SELECT...LIMIT) để tránh timeout
 * - Không dùng prisma.product.count() / findMany()
 * - Mỗi query nhỏ ≤ 500 rows, hoàn thành nhanh
 * - Target: phone=100k, laptop=100k, tablet=100k, còn lại chia đều
 * ─────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });

const BRAND_POOL = {
  'cat-phone':   ['br-apple','br-samsung','br-oppo','br-xiaomi','br-vivo','br-realme','br-nokia','br-masstel','br-mobell','br-tecno','br-infinix','br-itel','br-honor','br-motorola'],
  'cat-laptop':  ['br-apple','br-asus','br-hp','br-lenovo','br-acer','br-dell','br-msi','br-lg','br-microsoft','br-gigabyte','br-razer'],
  'cat-tablet':  ['br-apple','br-samsung','br-lenovo','br-xiaomi','br-honor','br-masstel'],
  'cat-watch':   ['br-apple','br-samsung','br-garmin','br-xiaomi','br-huawei','br-amazfit','br-befit','br-fitbit','br-polar','br-honor'],
  'cat-mobile-acc-powerbank':    ['br-anker','br-baseus','br-energizer','br-ugreen','br-romoss','br-aukey','br-ravpower','br-xmobile','br-pisen'],
  'cat-mobile-acc-charger':      ['br-anker','br-baseus','br-apple','br-samsung','br-belkin','br-ugreen','br-ravpower','br-xmobile','br-pisen'],
  'cat-mobile-acc-case-phone':   ['br-spigen','br-esr','br-nillkin','br-rock','br-capdase','br-memumi','br-zagg','br-belkin','br-baseus'],
  'cat-mobile-acc-case-tablet':  ['br-spigen','br-esr','br-nillkin','br-capdase','br-zagg','br-baseus','br-belkin'],
  'cat-mobile-acc-screen':       ['br-hydragel','br-zagg','br-spigen','br-esr','br-nillkin','br-memumi','br-capdase'],
  'cat-mobile-acc-cam-cover':    ['br-hydragel','br-spigen','br-esr','br-nillkin','br-zagg'],
  'cat-mobile-acc-airpods-case': ['br-spigen','br-esr','br-capdase','br-nillkin','br-memumi'],
  'cat-mobile-acc-fan':          ['br-baseus','br-rock','br-ugreen','br-xmobile'],
  'cat-mobile-acc-pen':          ['br-apple','br-baseus','br-ugreen','br-xmobile','br-rock'],
  'cat-mobile-acc-stand':        ['br-baseus','br-ugreen','br-rock','br-belkin','br-anker'],
  'cat-mobile-acc-strap':        ['br-capdase','br-spigen','br-nillkin','br-rock','br-baseus'],
  'cat-mobile-acc-lens':         ['br-baseus','br-rock','br-ugreen','br-xmobile'],
  'cat-laptop-acc-hub':            ['br-anker','br-baseus','br-ugreen','br-belkin','br-rock','br-ravpower'],
  'cat-laptop-acc-mouse':          ['br-logitech','br-razer','br-microsoft','br-asus','br-dell','br-hp','br-baseus'],
  'cat-laptop-acc-keyboard':       ['br-logitech','br-razer','br-microsoft','br-asus','br-hp'],
  'cat-laptop-acc-router':         ['br-tp-link','br-tplink-net','br-asus-net','br-linksys','br-dlink','br-netgear','br-totolink','br-mercusys'],
  'cat-laptop-acc-bag':            ['br-capdase','br-belkin','br-spigen','br-nillkin','br-rock','br-baseus'],
  'cat-laptop-acc-pouch':          ['br-capdase','br-belkin','br-spigen','br-nillkin','br-rock'],
  'cat-laptop-acc-keyboard-cover': ['br-hydragel','br-zagg','br-spigen','br-nillkin','br-capdase'],
  'cat-laptop-acc-software':       ['br-microsoft','br-apple'],
  'cat-laptop-acc-monitor-stand':  ['br-logitech','br-asus','br-dell','br-hp','br-baseus','br-ugreen'],
  'cat-laptop-acc-mousepad':       ['br-logitech','br-razer','br-asus','br-rock','br-baseus'],
  'cat-laptop-acc-drawing':        ['br-logitech','br-razer','br-asus','br-microsoft','br-ugreen'],
  'cat-av-bt-earphone':    ['br-apple','br-samsung','br-sony-audio','br-jbl','br-bose','br-sennheiser','br-jabra','br-edifier','br-1more','br-skullcandy','br-beats','br-shure','br-audio-technica','br-plantronics'],
  'cat-av-wire-earphone':  ['br-sony-audio','br-jbl','br-sennheiser','br-audio-technica','br-shure','br-edifier','br-1more','br-skullcandy','br-jabra'],
  'cat-av-headphone':      ['br-sony-audio','br-bose','br-sennheiser','br-beats','br-marshall','br-harman','br-jabra','br-plantronics','br-audio-technica','br-shure'],
  'cat-av-sport-earphone': ['br-jbl','br-sony-audio','br-bose','br-beats','br-jabra','br-skullcandy','br-edifier','br-1more'],
  'cat-av-speaker':        ['br-jbl','br-sony-audio','br-bose','br-marshall','br-harman','br-edifier','br-skullcandy'],
  'cat-av-mic':            ['br-shure','br-audio-technica','br-sennheiser','br-jabra','br-plantronics','br-sony-audio'],
  'cat-av-projector':      ['br-sony-audio','br-jbl','br-bose','br-sennheiser','br-harman'],
  'cat-av-smartglass':     ['br-sony-audio','br-marshall','br-bose','br-jbl','br-edifier'],
  'cat-av-hdd':    ['br-seagate','br-wd','br-samsung-st','br-toshiba'],
  'cat-av-sdcard': ['br-sandisk','br-samsung-st','br-kingston','br-lexar','br-transcend','br-pny'],
  'cat-av-usb':    ['br-sandisk','br-kingston','br-lexar','br-transcend','br-pny','br-samsung-st'],
  'cat-cam-security': ['br-hikvision','br-dahua','br-kbone','br-reolink','br-vantech','br-annke'],
  'cat-cam-indoor':   ['br-imou','br-ezviz','br-tp-link','br-xiaomi-cam','br-imilab','br-reolink','br-hikvision'],
  'cat-cam-outdoor':  ['br-hikvision','br-dahua','br-reolink','br-ezviz','br-kbone','br-vantech','br-annke'],
  'cat-cam-solar':    ['br-reolink','br-ezviz','br-imilab','br-imou','br-annke'],
  'cat-cam-4g':       ['br-hikvision','br-dahua','br-reolink','br-ezviz','br-vantech'],
  'cat-cam-doorbell': ['br-ezviz','br-imou','br-reolink','br-tp-link','br-imilab','br-hikvision'],
  'cat-cam-webcam':   ['br-logitech','br-jabra','br-microsoft','br-hp'],
};

const ALL_CATS = Object.keys(BRAND_POOL);
const TOTAL = 600000;
const PRIORITY = { 'cat-phone': 100000, 'cat-laptop': 100000, 'cat-tablet': 100000 };
const OTHER_CATS = ALL_CATS.filter(c => !PRIORITY[c]);
const PER_OTHER = Math.floor((TOTAL - 300000) / OTHER_CATS.length);
const EXTRA = (TOTAL - 300000) - PER_OTHER * OTHER_CATS.length;

const TARGET = { ...PRIORITY };
OTHER_CATS.forEach((c, i) => { TARGET[c] = PER_OTHER + (i < EXTRA ? 1 : 0); });

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── Count per category dùng GROUP BY (1 query nhanh hơn N queries) ─
async function getCounts() {
  const rows = await prisma.$queryRaw`
    SELECT category_id, COUNT(*)::int AS cnt
    FROM "Product"
    WHERE is_deleted = false
    GROUP BY category_id
  `;
  const map = {};
  for (const r of rows) map[r.category_id] = r.cnt;
  return map;
}

// ── Move N sản phẩm từ fromCat → toCat dùng pure SQL ─────────────
async function moveProducts(fromCat, toCat, n, brandPool) {
  const BATCH = 300; // nhỏ để tránh timeout
  let moved = 0;
  while (moved < n) {
    const take = Math.min(BATCH, n - moved);
    const brand = pick(brandPool);
    // Dùng UPDATE...WHERE IN (SELECT...LIMIT) — 1 query duy nhất
    const affected = await prisma.$executeRawUnsafe(`
      UPDATE "Product"
      SET category_id = '${toCat}',
          brand_id    = '${brand}'
      WHERE id IN (
        SELECT id FROM "Product"
        WHERE category_id = '${fromCat}'
          AND is_deleted = false
        LIMIT ${take}
      )
    `);
    moved += affected;
    if (affected === 0) break; // hết SP trong fromCat
  }
  return moved;
}

async function main() {
  console.log('\n🎯 FINAL REBALANCE v2 — Pure SQL, không timeout');
  console.log('═'.repeat(60));
  console.log(`  phone=${TARGET['cat-phone'].toLocaleString()} | laptop=${TARGET['cat-laptop'].toLocaleString()} | tablet=${TARGET['cat-tablet'].toLocaleString()}`);
  console.log(`  ${OTHER_CATS.length} categories còn lại × ${PER_OTHER.toLocaleString()} SP`);
  console.log(`  Tổng: ${TOTAL.toLocaleString()} SP\n`);

  // Step 1: đọc current counts
  console.log('  [1] Đọc phân phối hiện tại...');
  const cur = await getCounts();
  let grandTotal = Object.values(cur).reduce((a, b) => a + b, 0);
  console.log(`  Tổng hiện tại: ${grandTotal.toLocaleString()} SP`);

  // Tính over/under
  const over  = ALL_CATS.filter(c => (cur[c] || 0) > TARGET[c])
                        .sort((a, b) => ((cur[b]||0) - TARGET[b]) - ((cur[a]||0) - TARGET[a]));
  const under = ALL_CATS.filter(c => (cur[c] || 0) < TARGET[c])
                        .sort((a, b) => (TARGET[b] - (cur[b]||0)) - (TARGET[a] - (cur[a]||0)));

  console.log(`  Category thừa: ${over.length} | Category thiếu: ${under.length}`);

  const startMs = Date.now();
  let totalMoved = 0;

  // Step 2: Di chuyển
  console.log('\n  [2] Đang di chuyển sản phẩm...');
  for (const toCat of under) {
    let needed = TARGET[toCat] - (cur[toCat] || 0);
    if (needed <= 0) continue;

    const brandPool = BRAND_POOL[toCat];
    if (!brandPool?.length) continue;

    for (const fromCat of over) {
      if (needed <= 0) break;
      const surplus = (cur[fromCat] || 0) - TARGET[fromCat];
      if (surplus <= 0) continue;

      const toMove = Math.min(needed, surplus);
      const moved  = await moveProducts(fromCat, toCat, toMove, brandPool);

      cur[fromCat] = (cur[fromCat] || 0) - moved;
      cur[toCat]   = (cur[toCat]   || 0) + moved;
      needed       -= moved;
      totalMoved   += moved;

      const elapsed = (Date.now() - startMs) / 1000;
      const rps = Math.round(totalMoved / Math.max(elapsed, 1));
      process.stdout.write(
        `\r  ✅ Moved ${totalMoved.toLocaleString()} SP  (${rps.toLocaleString()}/s)  [${fromCat.split('-').pop()} → ${toCat.split('-').pop()}]      `
      );
    }
  }

  // Step 3: Xác nhận kết quả
  console.log('\n\n  [3] Xác nhận kết quả cuối...');
  const final = await getCounts();
  const finalTotal = Object.values(final).reduce((a, b) => a + b, 0);

  console.log('\n  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║              HOÀN THÀNH                             ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log(`  ║  Tổng SP      : ${finalTotal.toLocaleString().padStart(10)}                     ║`);
  console.log(`  ║  SP di chuyển : ${totalMoved.toLocaleString().padStart(10)}                     ║`);
  console.log('  ╚══════════════════════════════════════════════════════╝\n');

  for (const cat of ['cat-phone','cat-laptop','cat-tablet','cat-watch']) {
    const cnt = final[cat] || 0;
    const tgt = TARGET[cat];
    const ok  = Math.abs(cnt - tgt) < 500 ? '✅' : '⚠️ ';
    console.log(`  ${ok} ${cat.padEnd(25)} : ${cnt.toLocaleString().padStart(8)} / ${tgt.toLocaleString()}`);
  }

  console.log('\n  Top 10 category:');
  const sorted = Object.entries(final).sort(([,a],[,b]) => b-a).slice(0, 10);
  for (const [cat, cnt] of sorted) {
    console.log(`    ${cat.padEnd(38)} ${cnt.toLocaleString().padStart(8)} SP`);
  }
}

main()
  .catch(e => { console.error('\n❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
