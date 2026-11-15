// Chuỗi dự phòng nhánh AI-Rec của RecommendationService (giai đoạn 2, 16/11/2026):
//   /realtime-behavior -> /realtime -> GET, ngân sách 1,5 s dùng CHUNG cho hai bậc đầu.
// Không cần DB/ClickHouse/ai-rec thật: Postgres, ClickHouse được thay bằng module giả qua
// require.cache, ai-rec là một HTTP server giả trên 127.0.0.1.
//   node --test tests/aiRecRealtimeChain.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

const SRC = path.resolve(__dirname, '../src');
const stub = (rel, exports) => {
  const file = path.join(SRC, rel);
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};

// ── Postgres / ClickHouse giả ───────────────────────────────────────────────
const db = {
  purchased: [{ product_id: 900n }],
  purchasedError: null,
  wishlist: [],
  events: [],
  eventsError: null,
  eventsCalls: 0,
};
stub('db.js', {
  prisma: {
    $queryRaw: async () => { if (db.purchasedError) throw db.purchasedError; return db.purchased; },
    wishlist: { findMany: async () => db.wishlist },
  },
});
stub('services/BehaviorService.js', {
  getRecentProductEventsForCustomer: async () => {
    db.eventsCalls++;
    if (db.eventsError) throw db.eventsError;
    return db.events;
  },
});
stub('services/KnowledgeCache.js', {});
stub('services/ProductSpecsCache.js', {});

// ── ai-rec giả ──────────────────────────────────────────────────────────────
const plan = {};      // path -> { status, delayMs }
const hits = [];      // [{ path, body }]
const RESULT = {
  '/api/v1/recommend/realtime-behavior': ['B1', 'B2'],
  '/api/v1/recommend/realtime': ['R1', 'R2'],
  '/api/v1/recommend/customer/42': ['G1', 'G2'],
};
const server = http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  let raw = '';
  req.on('data', c => { raw += c; });
  req.on('end', () => {
    hits.push({ path: p, body: raw ? JSON.parse(raw) : null });
    const { status = 200, delayMs = 0 } = plan[p] || {};
    const timer = setTimeout(() => {
      if (res.destroyed) return;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status === 200
        ? { customer_id: '42', recommendations: (RESULT[p] || []).map(product_id => ({ product_id })) }
        : { detail: 'stub error' }));
    }, delayMs);
    res.on('close', () => clearTimeout(timer));
  });
});

let RS;
const loadService = (env = {}) => {
  for (const f of ['services/RecommendationService.js', 'services/behaviorInteractions.js']) {
    delete require.cache[path.join(SRC, f)];
  }
  const saved = {};
  for (const [k, v] of Object.entries(env)) { saved[k] = process.env[k]; process.env[k] = v; }
  try { return require(path.join(SRC, 'services/RecommendationService.js')); } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
};

test.before(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  process.env.AI_REC_URL = `http://127.0.0.1:${server.address().port}`;
  console.warn = () => {};   // cảnh báo rơi bậc là đúng kịch bản, không in ra
  RS = loadService();
});
test.after(() => server.close());
test.beforeEach(() => {
  hits.length = 0;
  for (const k of Object.keys(plan)) delete plan[k];
  Object.assign(db, {
    purchased: [{ product_id: 900n }], purchasedError: null, wishlist: [],
    events: [
      { product_id: '11', event_type: 'product_view', dwell_time_ms: 900000, referrer: 'direct', ts: 3 },
      { product_id: '900', event_type: 'add_to_cart', dwell_time_ms: null, referrer: 'direct', ts: 2 },
      { product_id: '12', event_type: 'product_view', dwell_time_ms: 1500, referrer: 'direct', ts: 1 },
    ],
    eventsError: null, eventsCalls: 0,
  });
});

const run = async () => {
  const t = Date.now();
  const ids = await RS._internal.fetchAIRecForCustomer(42, 8);
  return { ids, ms: Date.now() - t, paths: hits.map(h => h.path) };
};

test('có hành vi: gọi /realtime-behavior, body đã lọc (kẹp dwell, bỏ món đã mua, bỏ lượt xem ngắn)', async () => {
  const { ids, paths } = await run();
  assert.deepEqual(ids, ['B1', 'B2']);
  assert.deepEqual(paths, ['/api/v1/recommend/realtime-behavior']);
  assert.deepEqual(hits[0].body, {
    customer_id: '42',
    purchased_product_ids: ['900'],
    top_k: 8,
    interactions: [{ product_id: '11', event_type: 'product_view', dwell_seconds: 600 }],
  });
});

test('yêu thích (Postgres) cũng vào interactions', async () => {
  db.events = [];
  db.wishlist = [{ product_id: 77n, created_at: new Date() }];
  await run();
  assert.deepEqual(hits[0].body.interactions, [{ product_id: '77', event_type: 'add_to_wishlist' }]);
});

test('không có hành vi sau khi lọc: gọi thẳng /realtime như giai đoạn 1', async () => {
  db.events = [{ product_id: '12', event_type: 'product_view', dwell_time_ms: 1500, referrer: 'direct', ts: 1 }];
  const { ids, paths } = await run();
  assert.deepEqual(ids, ['R1', 'R2']);
  assert.deepEqual(paths, ['/api/v1/recommend/realtime']);
  assert.deepEqual(hits[0].body, { customer_id: '42', purchased_product_ids: ['900'], top_k: 8 });
});

for (const status of [404, 422, 500]) {
  test(`/realtime-behavior trả HTTP ${status}: rơi về /realtime`, async () => {
    plan['/api/v1/recommend/realtime-behavior'] = { status };
    const { ids, paths } = await run();
    assert.deepEqual(ids, ['R1', 'R2']);
    assert.deepEqual(paths, ['/api/v1/recommend/realtime-behavior', '/api/v1/recommend/realtime']);
  });
}

test('/realtime-behavior treo: hết 1,5 s thì xuống GET, KHÔNG gọi /realtime', async () => {
  plan['/api/v1/recommend/realtime-behavior'] = { delayMs: 5000 };
  const { ids, ms, paths } = await run();
  assert.deepEqual(ids, ['G1', 'G2']);
  assert.deepEqual(paths, ['/api/v1/recommend/realtime-behavior', '/api/v1/recommend/customer/42']);
  assert.ok(ms >= 1400 && ms < 2200, `tổng ${ms} ms`);
});

test('ngân sách chung: bậc 1 lỗi sau 1 s thì /realtime chỉ còn ~0,5 s, tổng không thành 2,5 s', async () => {
  plan['/api/v1/recommend/realtime-behavior'] = { status: 500, delayMs: 1000 };
  plan['/api/v1/recommend/realtime'] = { delayMs: 1000 };
  const { ids, ms, paths } = await run();
  assert.deepEqual(ids, ['G1', 'G2']);
  assert.deepEqual(paths, [
    '/api/v1/recommend/realtime-behavior', '/api/v1/recommend/realtime', '/api/v1/recommend/customer/42',
  ]);
  assert.ok(ms >= 1400 && ms < 2000, `tổng ${ms} ms`);
});

test('ClickHouse lỗi/quá hạn: bỏ hành vi, gọi /realtime như giai đoạn 1', async () => {
  db.eventsError = Object.assign(new Error('aborted'), { name: 'AbortError' });
  const { ids, paths } = await run();
  assert.deepEqual(ids, ['R1', 'R2']);
  assert.deepEqual(paths, ['/api/v1/recommend/realtime']);
});

test('đọc món đã mua lỗi: đi thẳng GET (như giai đoạn 1)', async () => {
  db.purchasedError = new Error('pg down');
  const { ids, paths } = await run();
  assert.deepEqual(ids, ['G1', 'G2']);
  assert.deepEqual(paths, ['/api/v1/recommend/customer/42']);
});

test('AI_REC_BEHAVIOR_MAX_EVENTS=0 tắt giai đoạn 2: không đọc ClickHouse, gọi /realtime', async () => {
  const saved = RS;
  RS = loadService({ AI_REC_BEHAVIOR_MAX_EVENTS: '0' });
  try {
    const { ids, paths } = await run();
    assert.deepEqual(ids, ['R1', 'R2']);
    assert.deepEqual(paths, ['/api/v1/recommend/realtime']);
    assert.equal(db.eventsCalls, 0);
  } finally {
    RS = saved;
  }
});
