/**
 * ============================================================
 * BENCHMARK FRONTEND — Getshopy Performance Suite
 * File: source/benchmark_frontend.js
 * ============================================================
 *
 * Đo Core Web Vitals tự động bằng Lighthouse CLI cho 2 kịch bản:
 *   1. Trang Home (có 3D Banner — HeroBanner3D.jsx)
 *   2. Trang Shop (danh sách sản phẩm lớn)
 *
 * Metrics đo được:
 *   - FCP  (First Contentful Paint)
 *   - LCP  (Largest Contentful Paint)
 *   - TBT  (Total Blocking Time)
 *   - CLS  (Cumulative Layout Shift)
 *   - TTI  (Time to Interactive)
 *   - SI   (Speed Index)
 *   - Bundle size (Three.js + R3F chunk)
 *   - Performance Score (0-100)
 *
 * Cách chạy:
 *   # Cài Lighthouse nếu chưa có
 *   npm install -g lighthouse
 *
 *   # Chạy benchmark (cần dev server đang chạy)
 *   node benchmark_frontend.js
 *
 *   # Tùy chỉnh URL
 *   node benchmark_frontend.js --url http://localhost:5173 --runs 5
 *
 * Lưu ý: Cần Chrome/Chromium đã cài sẵn.
 */

'use strict';

const { execSync, spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ─── Parse CLI args ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag, def) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const BASE_URL  = getArg('--url', 'http://localhost:5173');
const NUM_RUNS  = parseInt(getArg('--runs', '3'), 10);
const OUT_DIR   = path.resolve(__dirname, 'source', 'client');
const REPORT_MD = path.resolve(__dirname, 'source', 'server', 'src', 'scripts', 'benchmark_frontend_report.md');

// ─── Lighthouse thresholds (khuyến nghị Google) ───────────────────────────────
const THRESHOLDS = {
  fcp_ms:   { good: 1800, needs: 3000 },  // ms
  lcp_ms:   { good: 2500, needs: 4000 },
  tbt_ms:   { good: 200,  needs: 600  },
  cls:      { good: 0.1,  needs: 0.25 },
  tti_ms:   { good: 3800, needs: 7300 },
  score:    { good: 90,   needs: 50   },  // 0-100
};

// ─── Pages to benchmark ───────────────────────────────────────────────────────
const PAGES = [
  {
    name: 'Home (3D Banner)',
    path: '/',
    description: 'Trang chủ với HeroBanner3D (5 GLB models, Three.js/R3F)',
  },
  {
    name: 'Product List (50k data)',
    path: '/shop',
    description: 'Danh sách sản phẩm — test với large dataset',
  },
  {
    name: 'Product Detail',
    path: '/product/1',
    description: 'Trang chi tiết sản phẩm với image carousel',
  },
];

// ─── Color helpers ────────────────────────────────────────────────────────────
const RED    = (s) => `\x1b[31m${s}\x1b[0m`;
const GREEN  = (s) => `\x1b[32m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const BOLD   = (s) => `\x1b[1m${s}\x1b[0m`;
const CYAN   = (s) => `\x1b[36m${s}\x1b[0m`;

function rateMetric(key, value) {
  const t = THRESHOLDS[key];
  if (!t) return value;
  if (value <= t.good) return GREEN(`${value}`);
  if (value <= t.needs) return YELLOW(`${value}`);
  return RED(`${value}`);
}

// ─── Check Lighthouse available ───────────────────────────────────────────────
function checkLighthouse() {
  try {
    execSync('lighthouse --version', { stdio: 'pipe' });
    const ver = execSync('lighthouse --version', { stdio: 'pipe' }).toString().trim();
    console.log(`✅ Lighthouse: v${ver}`);
    return true;
  } catch {
    console.error(RED('❌ Lighthouse chưa cài. Chạy: npm install -g lighthouse'));
    console.log('   Hoặc: npx lighthouse (không cần cài global)');
    return false;
  }
}

// ─── Run single Lighthouse audit ─────────────────────────────────────────────
function runLighthouse(url) {
  const tmpFile = path.join(require('os').tmpdir(), `lh_${Date.now()}.json`);
  const cmd = [
    'lighthouse',
    `"${url}"`,
    '--output=json',
    `--output-path="${tmpFile}"`,
    '--quiet',
    '--chrome-flags="--headless --no-sandbox --disable-dev-shm-usage"',
    '--only-categories=performance',
    '--throttling-method=simulate',   // Simulated throttling (consistent)
    '--preset=desktop',               // Desktop preset
    '--max-wait-for-load=45000',
  ].join(' ');

  const t0 = Date.now();
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 120_000 });
    const elapsed = Date.now() - t0;

    const raw = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    fs.unlinkSync(tmpFile);

    const audits = raw.audits;
    const cats   = raw.categories;

    return {
      score:   Math.round((cats.performance?.score || 0) * 100),
      fcp_ms:  Math.round(audits['first-contentful-paint']?.numericValue || 0),
      lcp_ms:  Math.round(audits['largest-contentful-paint']?.numericValue || 0),
      tbt_ms:  Math.round(audits['total-blocking-time']?.numericValue || 0),
      cls:     parseFloat((audits['cumulative-layout-shift']?.numericValue || 0).toFixed(3)),
      tti_ms:  Math.round(audits['interactive']?.numericValue || 0),
      si_ms:   Math.round(audits['speed-index']?.numericValue || 0),
      // Resource sizes
      js_kb:   Math.round((audits['total-byte-weight']?.details?.items || [])
                  .filter(i => i.url && i.url.includes('.js'))
                  .reduce((s, i) => s + (i.totalBytes || 0), 0) / 1024),
      // Network requests
      req_count: (audits['network-requests']?.details?.items || []).length,
      audit_ms:  elapsed,
      _raw: raw,
    };
  } catch (err) {
    console.error(RED(`  ❌ Lighthouse error: ${err.message?.slice(0, 80)}`));
    return null;
  }
}

// ─── Average results across runs ─────────────────────────────────────────────
function average(results) {
  const valid = results.filter(Boolean);
  if (!valid.length) return null;
  const keys  = ['score', 'fcp_ms', 'lcp_ms', 'tbt_ms', 'cls', 'tti_ms', 'si_ms', 'js_kb', 'req_count'];
  const avg   = {};
  for (const k of keys) {
    const vals = valid.map(r => r[k]).filter(v => v !== undefined);
    avg[k] = k === 'cls'
      ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3))
      : Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return avg;
}

// ─── Print results table ──────────────────────────────────────────────────────
function printTable(results) {
  console.log('\n' + '─'.repeat(70));
  console.log(BOLD('  Metric              │ Value    │ Rating'));
  console.log('─'.repeat(70));

  const rows = [
    ['Performance Score',    `${results.score}/100`,       rateMetric('score',   results.score)],
    ['FCP (ms)',             `${results.fcp_ms}ms`,         rateMetric('fcp_ms',  results.fcp_ms)],
    ['LCP (ms)',             `${results.lcp_ms}ms`,         rateMetric('lcp_ms',  results.lcp_ms)],
    ['TBT (ms)',             `${results.tbt_ms}ms`,         rateMetric('tbt_ms',  results.tbt_ms)],
    ['CLS',                  `${results.cls}`,              rateMetric('cls',     results.cls)],
    ['TTI (ms)',             `${results.tti_ms}ms`,         rateMetric('tti_ms',  results.tti_ms)],
    ['Speed Index (ms)',     `${results.si_ms}ms`,          ''],
    ['JS Total (KB)',        `${results.js_kb}KB`,           results.js_kb > 1000 ? YELLOW(`${results.js_kb}KB`) : GREEN(`${results.js_kb}KB`)],
    ['Network Requests',    `${results.req_count}`,         ''],
  ];

  for (const [label, value, rating] of rows) {
    console.log(`  ${label.padEnd(20)}│ ${value.padEnd(9)}│ ${rating}`);
  }
  console.log('─'.repeat(70));
}

// ─── Bundle size analysis ─────────────────────────────────────────────────────
async function analyzeBundleSize() {
  console.log('\n' + BOLD('📦 Bundle Size Analysis'));
  console.log('─'.repeat(50));

  const distDir = path.resolve(__dirname, 'source', 'client', 'dist', 'assets');
  if (!fs.existsSync(distDir)) {
    console.log(YELLOW('  ⚠️  dist/ chưa có. Chạy: npm run build trước'));
    console.log('  Ước tính từ node_modules:');

    const threeDir = path.resolve(__dirname, 'source', 'client', 'node_modules', 'three');
    if (fs.existsSync(threeDir)) {
      try {
        const threeSize = execSync(`du -sh "${threeDir}"`, { stdio: 'pipe' }).toString().split('\t')[0];
        console.log(`  three.js (source): ${threeSize}`);
      } catch {}
    }
    return;
  }

  const files = fs.readdirSync(distDir);
  const jsFiles = files.filter(f => f.endsWith('.js')).map(f => {
    const full = path.join(distDir, f);
    const size = fs.statSync(full).size;
    return { name: f, size_kb: Math.round(size / 1024) };
  }).sort((a, b) => b.size_kb - a.size_kb);

  let totalKB = 0;
  for (const { name, size_kb } of jsFiles) {
    const icon = name.includes('three') ? '🎮' :
                 name.includes('fiber') || name.includes('r3f') ? '🖼️' :
                 name.includes('vendor') ? '📦' : '📄';
    const color = size_kb > 500 ? RED : size_kb > 200 ? YELLOW : GREEN;
    console.log(`  ${icon} ${name.slice(0, 40).padEnd(40)} ${color(`${size_kb}KB`)}`);
    totalKB += size_kb;
  }
  console.log('─'.repeat(50));
  console.log(`  ${'TOTAL JS'.padEnd(40)} ${BOLD(`${totalKB}KB`)}`);
  console.log(`  ${'(gzip ≈ ~30% của trên)'.padEnd(40)} ~${Math.round(totalKB * 0.3)}KB`);
}

// ─── GLB file sizes ───────────────────────────────────────────────────────────
function analyzeGLBFiles() {
  console.log('\n' + BOLD('🎮 3D Model (GLB) File Sizes'));
  console.log('─'.repeat(50));

  const assetsDir = path.resolve(__dirname, 'source', 'client', 'src', 'assets');
  if (!fs.existsSync(assetsDir)) {
    console.log(YELLOW('  ⚠️  assets/ không tìm thấy'));
    return;
  }

  const glbFiles = fs.readdirSync(assetsDir)
    .filter(f => f.endsWith('.glb'))
    .map(f => {
      const full    = path.join(assetsDir, f);
      const size_kb = Math.round(fs.statSync(full).size / 1024);
      return { name: f, size_kb };
    });

  if (!glbFiles.length) {
    console.log(YELLOW('  ⚠️  Không tìm thấy file .glb'));
    return;
  }

  let totalKB = 0;
  for (const { name, size_kb } of glbFiles) {
    const color = size_kb > 10000 ? RED : size_kb > 5000 ? YELLOW : GREEN;
    console.log(`  🗿 ${name.slice(0, 45).padEnd(45)} ${color(`${size_kb}KB`)}`);
    totalKB += size_kb;
  }
  console.log('─'.repeat(50));
  console.log(`  ${'TOTAL GLB'.padEnd(45)} ${BOLD(`${totalKB}KB`)} (~${Math.round(totalKB/1024)}MB)`);
  console.log('  💡 Tip: Dùng draco compression để giảm ~40-60%');
}

// ─── Generate Markdown Report ─────────────────────────────────────────────────
function generateReport(allResults, timestamp) {
  const lines = [
    '# Benchmark Frontend Report — Getshopy',
    `\n**Ngày đo:** ${timestamp}`,
    `**Tool:** Lighthouse (Desktop, Simulated Throttling)`,
    `**Runs per page:** ${NUM_RUNS} lần (lấy trung bình)`,
    '\n---\n',
    '## Core Web Vitals theo trang\n',
    '| Trang | Score | FCP | LCP | TBT | CLS | TTI | JS (KB) |',
    '|-------|-------|-----|-----|-----|-----|-----|---------|',
  ];

  for (const { page, avg } of allResults) {
    if (!avg) continue;
    lines.push(
      `| ${page.name} | ${avg.score}/100 | ${avg.fcp_ms}ms | ${avg.lcp_ms}ms | ${avg.tbt_ms}ms | ${avg.cls} | ${avg.tti_ms}ms | ${avg.js_kb}KB |`
    );
  }

  lines.push('\n---\n');
  lines.push('## Giải thích Metrics\n');
  lines.push('| Metric | Mô tả | Tốt | Cần cải thiện |');
  lines.push('|--------|-------|-----|---------------|');
  lines.push('| FCP | First Contentful Paint — thời gian đến khi có nội dung đầu tiên | <1.8s | >3s |');
  lines.push('| LCP | Largest Contentful Paint — thời gian đến phần tử lớn nhất | <2.5s | >4s |');
  lines.push('| TBT | Total Blocking Time — tổng thời gian block main thread | <200ms | >600ms |');
  lines.push('| CLS | Cumulative Layout Shift — độ dịch chuyển layout không mong muốn | <0.1 | >0.25 |');
  lines.push('| TTI | Time to Interactive — thời gian đến khi trang tương tác được | <3.8s | >7.3s |');

  lines.push('\n---\n');
  lines.push('## Phân tích 3D Performance\n');
  lines.push('- **HeroBanner3D.jsx** dùng React Three Fiber + 5 GLB models');
  lines.push('- GLB được lazy-load qua `React.lazy()` → không block initial render');
  lines.push('- `frameloop="demand"` + `IntersectionObserver` giảm GPU usage khi không nhìn thấy');
  lines.push('- Draco decoder từ Google CDN (cached sau lần đầu)');
  lines.push('\n**Để xem FPS real-time:** Mở `http://localhost:5173/?benchmark=true`');

  lines.push('\n---\n');
  lines.push('## Phân tích 50k Data Load\n');
  lines.push('- Backend dùng **pagination** (12-15 records/page) → không load all 50k cùng lúc');
  lines.push('- `startTransition()` tránh block UI khi set state lớn');
  lines.push('- Sử dụng `Pagination` component của Ant Design');
  lines.push('- **Bottleneck chính**: API query time + số lượng DOM nodes per page');

  fs.writeFileSync(REPORT_MD, lines.join('\n'), 'utf-8');
  console.log(`\n📄 Báo cáo Markdown: ${REPORT_MD}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const timestamp = new Date().toLocaleString('vi-VN');
  console.log('═'.repeat(70));
  console.log(BOLD('🏎️  Getshopy — Frontend Performance Benchmark'));
  console.log('═'.repeat(70));
  console.log(`⏰ Bắt đầu: ${timestamp}`);
  console.log(`🌐 URL:     ${BASE_URL}`);
  console.log(`🔁 Runs:    ${NUM_RUNS} lần/trang (trung bình)`);
  console.log('');

  // Step 1: Static analysis (không cần server)
  analyzeGLBFiles();
  await analyzeBundleSize();

  // Step 2: Lighthouse audit (cần server)
  console.log('\n' + BOLD('🔦 Lighthouse Performance Audit'));

  const hasLh = checkLighthouse();
  if (!hasLh) {
    console.log(YELLOW('\n⚠️  Bỏ qua Lighthouse audit. Chỉ có static analysis.'));
    generateReport([], timestamp);
    return;
  }

  // Quick check if server is up
  try {
    const http = require('http');
    await new Promise((resolve, reject) => {
      const req = http.get(BASE_URL, (res) => { resolve(res); req.destroy(); });
      req.on('error', reject);
      req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
    });
    console.log(GREEN(`✅ Dev server tại ${BASE_URL} đang chạy`));
  } catch {
    console.log(RED(`\n❌ Dev server KHÔNG chạy tại ${BASE_URL}`));
    console.log('   Hãy chạy: cd source/client && npm run dev');
    console.log('   Sau đó chạy lại script này.\n');
    console.log('   📊 Static analysis đã hoàn thành ở trên.');
    generateReport([], timestamp);
    return;
  }

  const allResults = [];

  for (const page of PAGES) {
    const url = `${BASE_URL}${page.path}`;
    console.log(`\n📄 ${BOLD(page.name)}`);
    console.log(`   ${CYAN(page.description)}`);
    console.log(`   URL: ${url}`);

    const runResults = [];
    for (let run = 1; run <= NUM_RUNS; run++) {
      process.stdout.write(`   Run ${run}/${NUM_RUNS}... `);
      const result = runLighthouse(url);
      if (result) {
        process.stdout.write(GREEN(`Score=${result.score} FCP=${result.fcp_ms}ms TBT=${result.tbt_ms}ms\n`));
        runResults.push(result);
      } else {
        process.stdout.write(RED('FAILED\n'));
      }
      // Cool down giữa các run
      if (run < NUM_RUNS) await new Promise(r => setTimeout(r, 2000));
    }

    const avg = average(runResults);
    if (avg) {
      console.log(`\n   ${BOLD(`Trung bình (${runResults.length} runs):`)}`);
      printTable(avg);
    }

    allResults.push({ page, avg, runs: runResults });
  }

  // ── Tổng hợp tất cả trang ──────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log(BOLD('📊 TỔNG HỢP TẤT CẢ TRANG'));
  console.log('═'.repeat(70));
  console.log(`  ${'Trang'.padEnd(28)} │ Score │ FCP    │ LCP    │ TBT    │ CLS`);
  console.log('  ' + '─'.repeat(67));
  for (const { page, avg } of allResults) {
    if (!avg) continue;
    const score = avg.score >= 90 ? GREEN(`${avg.score}`) : avg.score >= 50 ? YELLOW(`${avg.score}`) : RED(`${avg.score}`);
    console.log(
      `  ${page.name.padEnd(28)} │ ${score.padEnd(5)} │ ${String(avg.fcp_ms+'ms').padEnd(7)}│ ${String(avg.lcp_ms+'ms').padEnd(7)}│ ${String(avg.tbt_ms+'ms').padEnd(7)}│ ${avg.cls}`
    );
  }

  console.log('\n📌 Hướng dẫn đọc kết quả:');
  console.log(`  ${GREEN('■')} Tốt (Good)        ${YELLOW('■')} Cần cải thiện    ${RED('■')} Kém (Poor)`);

  generateReport(allResults, timestamp);

  console.log('\n✅ Benchmark hoàn thành!');
  console.log(`\n💡 Xem FPS live: http://localhost:5173/?benchmark=true`);
  console.log(`💡 Để đo với 50k data: chạy seed_50k_products.py trước`);
}

main().catch(console.error);
