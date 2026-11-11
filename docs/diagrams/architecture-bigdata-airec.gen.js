// Sinh sơ đồ kiến trúc tổng thể (SVG) — làm nổi bật hệ BigData và AI-Rec.
// Dùng: node gen-arch.js <đường dẫn .svg đầu ra>
const fs = require('fs');

const W = 1680, H = 1100;
const FONT = "'Segoe UI', Arial, sans-serif";
const MONO = "'Cascadia Mono', Consolas, monospace";

const K = {
  bd: { fill: '#d3f9d8', stroke: '#2f9e44', title: '#1b4d2a', text: '#2f5d3a', sw: 2 },
  ai: { fill: '#ffe8cc', stroke: '#e8590c', title: '#6b2400', text: '#8a3b0c', sw: 2 },
  ec: { fill: '#f8f9fa', stroke: '#ced4da', title: '#868e96', text: '#a5adb5', sw: 1.2 },
  note: { fill: '#ffffff', stroke: '#69db7c', title: '#2b8a3e', text: '#2f5d3a', sw: 1.2, dash: '5 4' },
};
const GREEN = '#2f9e44', ORANGE = '#e8590c', GRAY = '#adb5bd';

const out = [];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function rect(x, y, w, h, { fill = 'none', stroke = 'none', sw = 1, dash, rx = 10 } = {}) {
  out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
}

function text(x, y, s, { size = 12, weight = 400, color = '#212529', anchor = 'start', halo, mono = false } = {}) {
  const h = halo ? ` paint-order="stroke" stroke="${halo}" stroke-width="5" stroke-linejoin="round"` : '';
  out.push(`<text x="${x}" y="${y}" font-family="${mono ? MONO : FONT}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}"${h}>${esc(s)}</text>`);
}

// Dòng đầu là tiêu đề (đậm). Dòng bắt đầu bằng '`' vẽ bằng font mono.
function lines(cx, cy, arr, k) {
  const LH = 16.5;
  let y = cy - (arr.length * LH) / 2 + 12;
  arr.forEach((s, i) => {
    const mono = s.startsWith('`');
    const t = mono ? s.slice(1) : s;
    text(cx, y, t, {
      anchor: 'middle',
      size: i === 0 ? 12.5 : mono ? 11 : 11.5,
      weight: i === 0 ? 600 : 400,
      color: i === 0 ? k.title : k.text,
      mono,
    });
    y += LH;
  });
}

function node(x, y, w, h, kind, arr) {
  const k = K[kind];
  rect(x, y, w, h, { fill: k.fill, stroke: k.stroke, sw: k.sw, dash: k.dash, rx: 8 });
  lines(x + w / 2, y + h / 2, arr, k);
}

function cylinder(x, y, w, h, kind, arr) {
  const k = K[kind], ry = 9;
  out.push(`<path d="M${x},${y + ry} A${w / 2},${ry} 0 0 0 ${x + w},${y + ry} L${x + w},${y + h - ry} A${w / 2},${ry} 0 0 1 ${x},${y + h - ry} Z" fill="${k.fill}" stroke="${k.stroke}" stroke-width="${k.sw}"/>`);
  out.push(`<ellipse cx="${x + w / 2}" cy="${y + ry}" rx="${w / 2}" ry="${ry}" fill="${k.fill}" stroke="${k.stroke}" stroke-width="${k.sw}"/>`);
  lines(x + w / 2, y + h / 2 + ry / 2, arr, k);
}

function edge(pts, color, { w = 2, dash } = {}) {
  const id = color === GREEN ? 'g' : color === ORANGE ? 'o' : 'x';
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''} marker-end="url(#a${id})"/>`);
}

// ── Tiêu đề ─────────────────────────────────────────────────────────
text(24, 42, 'Kiến trúc tổng thể hệ thống GetShopy', { size: 24, weight: 700 });
text(24, 68, 'Làm nổi bật hai hệ: BigData (xanh lá) và AI-Rec (cam). Hệ Ecommerce chỉ đóng vai nguồn dữ liệu và nơi tiêu thụ kết quả (xám).', { size: 14, color: '#495057' });

// ── Khung các hệ ────────────────────────────────────────────────────
rect(20, 92, 272, 960, { fill: '#ffffff', stroke: '#ced4da', sw: 1.5, dash: '6 4', rx: 14 });
text(36, 118, 'HỆ ECOMMERCE', { size: 13, weight: 700, color: '#868e96' });
text(36, 136, 'nguồn dữ liệu & nơi tiêu thụ', { size: 12, color: '#adb5bd' });

rect(340, 92, 1316, 198, { fill: '#fff4e6', stroke: ORANGE, sw: 4, rx: 14 });
out.push(`<text x="358" y="122" font-family="${FONT}" fill="#d9480f"><tspan font-size="17" font-weight="700">★ HỆ AI-REC</tspan><tspan font-size="13" dx="8">FastAPI · scikit-learn · scipy — train lại mỗi 300 s, phục vụ gợi ý từ cache tính sẵn</tspan></text>`);

rect(340, 310, 1316, 742, { fill: '#ebfbee', stroke: GREEN, sw: 4, rx: 14 });
out.push(`<text x="358" y="340" font-family="${FONT}" fill="#2b8a3e"><tspan font-size="17" font-weight="700">★ HỆ BIGDATA</tspan><tspan font-size="13" dx="8">Lakehouse · CDC — local-infra-sandbox (docker compose --profile bigdata)</tspan></text>`);

rect(600, 360, 1045, 482, { fill: '#f8fdf9', stroke: '#8ce99a', sw: 1.5, rx: 10 });
text(614, 381, '③ KHO DỮ LIỆU — ClickHouse 24.8 · dbt-core · ofelia chạy dbt build (run + test) mỗi 5 phút', { size: 12.5, weight: 700, color: '#2b8a3e' });

rect(360, 862, 815, 170, { fill: '#f8fdf9', stroke: '#8ce99a', sw: 1.5, rx: 10 });
text(374, 883, '① THU NHẬN — CDC streaming', { size: 12.5, weight: 700, color: '#2b8a3e' });

text(380, 610, 'KHAI THÁC', { size: 12, weight: 700, color: '#2b8a3e' });

// ── Ecommerce ──────────────────────────────────────────────────────
node(40, 150, 232, 72, 'ec', ['Client · React 19 · :3000', 'B2C: Checkout · Home', 'Admin Dashboard']);
node(40, 250, 232, 90, 'ec', ['Server · Node.js · Express 5', 'cổng 8080', 'checkout · tracking', 'RecommendationService']);
node(40, 372, 120, 40, 'ec', ['Redis 7 · cache']);
cylinder(40, 885, 232, 130, 'ec', ['PostgreSQL 16 · OLTP', 'wal_level = logical', 'Order · OrderItem', 'Product · Customer']);

// ── AI-Rec (luồng chạy từ phải sang trái) ───────────────────────────
node(410, 150, 270, 96, 'ai', ['FastAPI · cổng 8000', '`GET /api/v1/recommend/customer/{id}', '`GET /health', 'trả top-K từ bản đang phục vụ']);
node(712, 150, 220, 96, 'ai', ['ModelBundle', 'model + cache tính sẵn', 'đổi bản nguyên tử', 'lưu recommender.joblib']);
node(964, 150, 168, 96, 'ai', ['_precompute()', 'top-20 mỗi khách', 'trần 60 s']);
node(1164, 150, 204, 96, 'ai', ['Vòng train nền · 300 s', 'Item-CF', '+ Content-based + Repeat', '→ HybridRecommender']);
node(1400, 150, 230, 96, 'ai', ['data_source/clickhouse.py', 'HTTP · user ai_rec', 'chỉ đọc serving.*']);

// ── BigData ────────────────────────────────────────────────────────
node(1400, 410, 230, 170, 'bd', ['serving.* — cho AI-Rec', '`processed_data_for_AI_rec', '`purchase_events_for_AI_rec', '`product_features', '`customer_preference_signals', '`customer_product_events']);
node(1400, 620, 230, 80, 'bd', ['warehouse.fact_orders_detail', 'Gold · ReplacingMergeTree', '(_event_ts, _is_deleted)']);
node(1400, 740, 230, 70, 'bd', ['staging.* — Silver', 'VIEW đọc Parquet qua s3()']);
cylinder(1400, 872, 230, 140, 'bd', ['② DATA LAKE — Bronze', 'MinIO · bucket data-lake', 'Parquet bất biến', 'chỉ ghi thêm']);

node(1130, 410, 230, 70, 'bd', ['analytics.user_events', '→ user_events_stitched', 'xem · giỏ hàng · yêu thích']);
node(1130, 510, 230, 70, 'bd', ['masterdata.dim_*', 'sản phẩm · khách · danh mục …', 'TRUNCATE + INSERT']);
node(1130, 620, 230, 80, 'bd', ['serving.mart_revenue', 'paid_revenue', '→ Admin Dashboard']);
node(1130, 740, 230, 70, 'bd', ['audit.checksum_orders', 'đối soát src ↔ stg ↔ wh']);
node(640, 740, 240, 70, 'bd', ['realtime.orders_live', 'Kafka engine + Materialized View', 'trễ ~1 s · TTL 7 ngày']);

node(380, 620, 200, 80, 'bd', ['Metabase', 'BI tự phục vụ']);
node(380, 740, 200, 70, 'note', ['Độ trễ end-to-end', 'nhánh lạnh ≈ 5–6 phút', 'nhánh nóng ≈ 1 s']);

node(385, 905, 200, 90, 'bd', ['Debezium 2.5.4', 'đọc WAL · pgoutput', 'slot getshopy_cdc_slot']);
node(640, 905, 240, 90, 'bd', ['Kafka · Confluent 7.4.0','`cdc_prod.public.*', 'key = PK ⇒ đúng thứ tự']);
node(935, 905, 220, 90, 'bd', ['S3 Sink 10.5.13', 'Parquet · flush 10k', 'xoay tệp mỗi 15 s']);

// ── Cạnh trong Ecommerce (mờ) ──────────────────────────────────────
edge([[156, 222], [156, 250]], GRAY, { w: 1.5 });
edge([[90, 340], [90, 372]], GRAY, { w: 1.5, dash: '4 3' });
edge([[210, 340], [210, 885]], GRAY, { w: 1.5 });
text(202, 620, 'ghi đơn hàng', { size: 11, color: '#adb5bd', anchor: 'end' });

// ── Cạnh nối giữa các hệ ───────────────────────────────────────────
edge([[272, 262], [306, 262], [306, 198], [410, 198]], ORANGE, { w: 3 });
text(375, 189, 'REST', { size: 11, weight: 600, color: ORANGE, anchor: 'middle', halo: '#fff4e6' });
text(375, 215, 'timeout 3 s', { size: 11, color: ORANGE, anchor: 'middle', halo: '#fff4e6' });

edge([[1515, 410], [1515, 246]], ORANGE, { w: 4 });
text(1505, 278, 'đọc serving.* mỗi 300 s', { size: 11.5, weight: 600, color: ORANGE, anchor: 'end', halo: '#fff4e6' });

edge([[272, 950], [385, 950]], GREEN, { w: 4 });
text(312, 942, 'WAL', { size: 11, weight: 700, color: GREEN, anchor: 'middle', halo: '#ffffff' });

edge([[272, 315], [318, 315], [318, 445], [1130, 445]], GREEN, { w: 2 });
text(865, 437, 'sự kiện hành vi (tracking) — server ghi thẳng vào ClickHouse', { size: 11.5, color: '#2b8a3e', anchor: 'middle', halo: '#f8fdf9' });

edge([[272, 915], [328, 915], [328, 545], [1130, 545]], GREEN, { w: 2, dash: '6 4' });
text(865, 537, 'masterdata — đường tắt postgresql(), không qua CDC', { size: 11.5, color: '#2b8a3e', anchor: 'middle', halo: '#f8fdf9' });

// ── Cạnh trong BigData ─────────────────────────────────────────────
edge([[585, 950], [640, 950]], GREEN);
edge([[880, 950], [935, 950]], GREEN);
edge([[1155, 950], [1400, 950]], GREEN);
edge([[760, 905], [760, 810]], GREEN);
text(770, 857, 'nhánh nóng', { size: 11.5, weight: 600, color: '#2b8a3e', halo: '#ebfbee' });
edge([[1515, 872], [1515, 810]], GREEN);
text(1525, 857, 's3()', { size: 11.5, weight: 600, color: '#2b8a3e', halo: '#ebfbee', mono: true });
edge([[1515, 740], [1515, 700]], GREEN);
edge([[1515, 620], [1515, 580]], GREEN);
edge([[1360, 445], [1400, 445]], GREEN);
edge([[1360, 545], [1400, 545]], GREEN);
edge([[1400, 660], [1360, 660]], GREEN);
edge([[1400, 775], [1360, 775]], GREEN, { dash: '4 3' });
edge([[1130, 660], [580, 660]], GREEN);

// ── Cạnh trong AI-Rec ──────────────────────────────────────────────
edge([[1400, 198], [1368, 198]], ORANGE);
edge([[1164, 198], [1132, 198]], ORANGE);
edge([[964, 198], [932, 198]], ORANGE);
edge([[712, 198], [680, 198]], ORANGE);

// ── Chú thích ──────────────────────────────────────────────────────
let lx = 24;
const ly = 1078;
function legendBox(fill, stroke, sw, dash, label) {
  rect(lx, ly - 11, 24, 14, { fill, stroke, sw, dash, rx: 3 });
  text(lx + 32, ly, label, { size: 12, color: '#495057' });
  lx += 32 + label.length * 6.4 + 28;
}
function legendLine(color, w, dash, label) {
  edge([[lx, ly - 4], [lx + 34, ly - 4]], color, { w, dash });
  text(lx + 44, ly, label, { size: 12, color: '#495057' });
  lx += 44 + label.length * 6.4 + 28;
}
legendBox('#ebfbee', GREEN, 2.5, null, 'Hệ BigData');
legendBox('#fff4e6', ORANGE, 2.5, null, 'Hệ AI-Rec');
legendBox('#ffffff', '#ced4da', 1.2, '4 3', 'Hệ Ecommerce (ngữ cảnh)');
legendLine(GREEN, 2, null, 'luồng dữ liệu');
legendLine(GREEN, 2, '6 4', 'đường phụ (masterdata, đối soát)');
legendLine(ORANGE, 3, null, 'luồng gợi ý');

const marker = (id, color) =>
  `<marker id="a${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>${marker('g', GREEN)}${marker('o', ORANGE)}${marker('x', GRAY)}</defs>
<rect width="${W}" height="${H}" fill="#ffffff"/>
${out.join('\n')}
</svg>
`;
fs.writeFileSync(process.argv[2], svg, 'utf8');
