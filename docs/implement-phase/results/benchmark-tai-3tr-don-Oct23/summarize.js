// Tổng hợp stats.csv + vm.csv của metrics.sh: đỉnh RAM từng container, đỉnh tổng, tiến độ dữ liệu.
//   node summarize.js [số dòng vm.csv cuối muốn xem, mặc định 6]
const fs = require('fs');
const path = require('path');
const dir = process.env.OUT || __dirname;   // thư mục chứa stats.csv + vm.csv
const tail = Number(process.argv[2] || 6);

const toMiB = (s) => {
  const m = /([\d.]+)\s*([KMG]i?B|B)/.exec(s);
  if (!m) return NaN;
  const f = { B: 1 / 1048576, KiB: 1 / 1024, KB: 1 / 1024, MiB: 1, MB: 1, GiB: 1024, GB: 1024 }[m[2]];
  return Number(m[1]) * f;
};

const peak = new Map();      // container -> {mib, ts}
const totals = new Map();    // ts -> tổng MiB
const statsFile = path.join(dir, 'stats.csv');
if (fs.existsSync(statsFile)) {
  for (const line of fs.readFileSync(statsFile, 'utf8').split('\n')) {
    const [ts, name, mem] = line.split(',');
    if (!mem) continue;
    const mib = toMiB(mem.split('/')[0]);
    if (Number.isNaN(mib)) continue;
    const short = name.replace(/^kltn-/, '').replace(/-1$/, '');
    if (!peak.has(short) || mib > peak.get(short).mib) peak.set(short, { mib, ts });
    totals.set(ts, (totals.get(ts) || 0) + mib);
  }
}
const fmt = (mib) => (mib >= 1024 ? (mib / 1024).toFixed(2) + ' GiB' : mib.toFixed(0) + ' MiB');
console.log('Đỉnh RAM từng container:');
[...peak.entries()].sort((a, b) => b[1].mib - a[1].mib)
  .forEach(([n, p]) => console.log('  ' + n.padEnd(22) + fmt(p.mib).padStart(10) + '  lúc ' + p.ts));
let maxTs = null, maxTot = 0;
for (const [ts, t] of totals) if (t > maxTot) { maxTot = t; maxTs = ts; }
if (maxTs) console.log('Đỉnh tổng mọi container: ' + fmt(maxTot) + ' lúc ' + maxTs);

const vmFile = path.join(dir, 'vm.csv');
if (fs.existsSync(vmFile)) {
  const rows = fs.readFileSync(vmFile, 'utf8').trim().split('\n');
  console.log('\nvm.csv (' + (rows.length - 1) + ' mẫu), ' + tail + ' dòng cuối:');
  console.log('  ' + rows[0]);
  rows.slice(Math.max(1, rows.length - tail)).forEach((r) => console.log('  ' + r));
  const body = rows.slice(1).map((r) => r.split(','));
  const minAvail = body.reduce((m, r) => (Number(r[2]) < m.v ? { v: Number(r[2]), ts: r[0] } : m), { v: Infinity });
  const maxSwap = body.reduce((m, r) => (Number(r[3]) > m.v ? { v: Number(r[3]), ts: r[0] } : m), { v: -1 });
  const maxDbt = body.reduce((m, r) => Math.max(m, Number(r[5]) || 0), 0);
  console.log('RAM khả dụng thấp nhất: ' + minAvail.v + ' MB lúc ' + minAvail.ts +
    ' · swap cao nhất: ' + maxSwap.v + ' MB lúc ' + maxSwap.ts + ' · số lượt dbt chạy cùng lúc nhiều nhất: ' + maxDbt);
}
