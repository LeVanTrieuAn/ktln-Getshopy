# API Latency Optimization — Getshopy Full-Stack
> **Mục tiêu chính**: Giảm latency từ ~3 000 ms → **< 400 ms** (AI chat) và giảm initial load time **60–90%** (data listing)  
> **Ràng buộc**: Server chạy Express (Docker local / Railway / Render), **không** thể deploy lên Supabase Edge Functions. Chỉ tối ưu **logic + storing layer**.

---

## ⚠️ Vấn đề nghiêm trọng nhất — B2B Products fetch ALL

```
GET /api/b2b/products
  → prisma.product.findMany({ where: { is_deleted: false } })
  → Trả về TOÀN BỘ 50,000 sản phẩm trong 1 response
  → Network payload: ~50MB JSON  
  → Browser parse time: 2–5 giây
  → RAM client: ~200–500MB
```

Đây là bottleneck **lớn nhất toàn hệ thống**, cần fix **ngay lập tức** trước mọi thứ khác.

---

## Tổng quan các luồng & điểm tắc nghẽn

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  DATA LOADING (Critical — xảy ra ngay khi mở trang)                         │
│  ─────────────────────────────────────────────────────────────────────────── │
│  B2B: GET /api/b2b/products      → fetch ALL 50k sản phẩm ⛔ ~5–8s          │
│  B2C: GET /api/b2c/products      → fetch all rồi slice ở JS ⚠️ ~1–3s        │
│  B2B: GET /api/b2b/reviews       → fetch ALL reviews ⚠️                     │
│  B2B: GeneralManagement loadData → 5 API calls parallel nhưng mỗi cái heavy │
│                                                                              │
│  AI PIPELINE (Hot path)                                                      │
│  ─────────────────────────────────────────────────────────────────────────── │
│  POST /api/b2c/chat              → NLP + Prisma queries ⚠️ ~3s              │
│  GET  /api/b2c/recommendations   → 2–3 Prisma queries tuần tự ⚠️           │
│  POST /api/b2c/checkout          → N×RTT inventory update ⚠️               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

---

## Phần 1 — Data Loading Optimization (Ưu tiên cao nhất)

### 1A. B2B Products — Fix "Fetch ALL 50,000" ⛔

**Vấn đề hiện tại** (`src/routes/b2b.js` line 158):
```javascript
// HIỆN TẠI — Fetch toàn bộ không giới hạn
router.get('/products', async (req, res) => {
  const products = await prisma.product.findMany({
    where: { is_deleted: false },
    orderBy: { id: 'desc' }
    // ← KHÔNG CÓ take/skip → load 50,000 rows!
  });
  res.json(products.map(p => ({ ...p, id: Number(p.id) })));
});
```

Phía client (`GeneralManagement.jsx` line 98): `api.b2b.getProducts()` → nhận 50k records → render tất cả trong một `<Table>` → **browser chết**.

**Fix Server — Thêm cursor-based pagination cho B2B Products:**

```javascript
// src/routes/b2b.js — thay router.get('/products')

router.get('/products', async (req, res) => {
  try {
    const {
      page     = 1,
      limit    = 30,       // 30 sản phẩm/trang × 6 cột = 180 visible tối đa
      search   = '',
      category_id,
      sort     = 'id_desc'
    } = req.query;

    const take = Math.min(parseInt(limit), 100); // Hard cap 100/request
    const skip = (parseInt(page) - 1) * take;

    const where = {
      is_deleted: false,
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
      ...(category_id && category_id !== 'ALL' && { category_id }),
    };

    const orderBy = sort === 'price_asc'  ? { price: 'asc' }
                  : sort === 'price_desc' ? { price: 'desc' }
                  : sort === 'stock_asc'  ? { stock: 'asc' }
                  :                         { id: 'desc' };

    // Parallel: data + count
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take,
        select: {
          id: true, name: true, price: true, stock: true,
          image: true, category_id: true, brand_id: true,
          is_banner: true, sold: true, branch_ids: true,
          // Bỏ: description, images (array nặng), variants (array nặng)
          // → Chỉ load khi mở detail/modal edit
        }
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      data: products.map(p => ({ ...p, id: Number(p.id) })),
      total,
      page:       parseInt(page),
      limit:      take,
      totalPages: Math.ceil(total / take),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// THÊM: Endpoint riêng để lấy detail (variants, images, description)
// Chỉ gọi khi mở modal edit
router.get('/products/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: BigInt(req.params.id) },
    });
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json({ ...product, id: Number(product.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Fix Client — `GeneralManagement.jsx`:**

```jsx
// src/pages/GeneralManagement.jsx

// THÊM state cho product pagination
const [productPage, setProductPage]   = useState(1);
const [productTotal, setProductTotal] = useState(0);
const [productSearch, setProductSearch] = useState('');
const PRODUCT_LIMIT = 30; // 6 cột × 5 hàng = 30/trang

// THAY loadData() — chỉ load products theo page
const loadProducts = useCallback(async (page = 1, search = '') => {
  setLoading(true);
  try {
    const res = await api.b2b.getProducts({ page, limit: PRODUCT_LIMIT, search });
    setProducts(res.data || res); // backward compat
    setProductTotal(res.total || 0);
  } catch (e) { message.error('Không thể tải sản phẩm'); }
  setLoading(false);
}, []);

// THAY Table sản phẩm — thêm pagination server-side
<Table
  dataSource={products}
  columns={productColumns}
  rowKey="id"
  loading={loading}
  pagination={{
    current:   productPage,
    total:     productTotal,
    pageSize:  PRODUCT_LIMIT,
    showTotal: (total) => `Tổng ${total} sản phẩm`,
    onChange:  (page) => { setProductPage(page); loadProducts(page, productSearch); },
  }}
  title={() => (
    <Input.Search
      placeholder="Tìm sản phẩm..."
      onSearch={(val) => { setProductSearch(val); setProductPage(1); loadProducts(1, val); }}
      style={{ width: 300 }}
    />
  )}
/>
```

**Cập nhật `api.js`:**
```javascript
// src/services/api.js
b2b: {
  // THAY:
  getProducts: (params = {}) => request('/b2b/products?' + new URLSearchParams(params)),
  getProductDetail: (id) => request(`/b2b/products/${id}`),
  // ...
}
```

> **Kết quả:** 50,000 rows → 30 rows per request. Network: 50MB → 50KB/request (**-99.9%**)

---

### 1B. B2C Products — Fix "Filter ở Client-side" ⚠️

**Vấn đề hiện tại** (`src/routes/b2c.js` line 68):
```javascript
// HIỆN TẠI — Fetch ALL matching products rồi slice ở server
let allProducts = await prisma.product.findMany({ where, orderBy });
// Sau đó filter branch_id trong JavaScript!
if (branch_id) {
  allProducts = allProducts.filter(p => { /* JSON parsing mỗi row */ });
}
const total = allProducts.length;
let products = allProducts.slice(skip, skip + limitNumber); // ← slice TRONG MEMORY
```

Nếu có 50,000 sản phẩm trong một category, server vẫn load **tất cả** rồi slice. Cực kỳ lãng phí memory và thời gian.

**Fix Server — True server-side pagination với Prisma skip/take:**

```javascript
// src/routes/b2c.js

router.get('/products', async (req, res) => {
  try {
    const {
      category_id, brand_id, search, sort,
      page  = 1,
      limit = 30,   // Tăng default từ 12 lên 30 (6 cột × 5 hàng)
    } = req.query;

    const take = Math.min(parseInt(limit), 60); // Hard cap
    const skip = (parseInt(page) - 1) * take;

    const where = {
      is_deleted: false,
      ...(category_id && category_id !== 'ALL' && { category_id }),
      ...(brand_id    && brand_id    !== 'ALL' && { brand_id }),
      ...(search      && { name: { contains: search, mode: 'insensitive' } }),
    };

    const orderBy = sort === 'price_asc'  ? { price: 'asc' }
                  : sort === 'price_desc' ? { price: 'desc' }
                  :                         { id: 'desc' };

    // branch_id filter: thay vì fetch all và filter JS,
    // dùng Prisma JSON filter (PostgreSQL hỗ trợ)
    // branch_ids stored as JSON array, filter nếu branch_id có trong mảng hoặc mảng rỗng
    if (branch_id) {
      where.OR = [
        { branch_ids: { equals: [] } },
        { branch_ids: { array_contains: branch_id } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, orderBy, skip, take,
        select: {
          id: true, name: true, price: true, original_price: true,
          image: true, rating: true, sold: true, stock: true,
          is_banner: true, category_id: true
          // Bỏ: description, images[], variants[] — không cần cho listing
        }
      }),
      prisma.product.count({ where }),
    ]);

    // Flash sale áp dụng chỉ cho page hiện tại (30 sản phẩm, không phải 50k)
    const fsItems = await getActiveFlashSaleItems();
    const enriched = products.map(p =>
      applyFlashSaleToProduct({ ...p, id: Number(p.id) }, fsItems)
    );

    res.json({
      data:       enriched,
      total,
      page:       parseInt(page),
      limit:      take,
      totalPages: Math.ceil(total / take),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Client `ProductList.jsx` — Thay filter client-side:**

```jsx
// THAY: các filter minPrice/maxPrice/brands/minRating → server-side params
useEffect(() => {
  async function load() {
    setLoading(true);
    try {
      const [prodData, catData, brandData] = await Promise.all([
        api.b2c.getProducts(
          categoryFilter, searchQuery, sort,
          selectedBranch?.id,
          currentPage,
          30,           // 30/trang thay vì 12
          // THÊM: price filter params
          appliedMinPrice, appliedMaxPrice,
          brands.join(','), minRating
        ),
        api.b2c.getCategories(),
        api.b2c.getBrands()
      ]);
      setProducts(prodData.data || []);
      setTotalProducts(prodData.total || 0);
    } catch (err) { console.error(err); }
    setLoading(false);
  }
  load();
}, [categoryFilter, searchQuery, sort, selectedBranch,
    appliedMinPrice, appliedMaxPrice, brands, minRating, currentPage]);
```

**Server nhận thêm params price/brand/rating:**
```javascript
// src/routes/b2c.js — bổ sung vào where clause
const {
  // ... existing params
  min_price, max_price, brand_ids, min_rating
} = req.query;

const where = {
  is_deleted: false,
  ...(min_price && { price: { gte: Number(min_price) } }),
  ...(max_price && { price: { lte: Number(max_price) } }),
  ...(brand_ids && { brand_id: { in: brand_ids.split(',') } }),
  ...(min_rating && { rating: { gte: Number(min_rating) } }),
  // ... existing filters
};
```

> **Kết quả:** Server không còn load toàn bộ 50k rows cho mỗi request filter. **Memory -95%, Response time -70%**

---

### 1C. B2B Reviews — Pagination ⚠️

**Vấn đề** (`src/routes/b2b.js` line 8):
```javascript
// HIỆN TẠI — Fetch ALL reviews không giới hạn
router.get('/reviews', async (req, res) => {
  const reviews = await prisma.review.findMany(); // ← No limit!
  res.json(reviews.map(...));
});
```

**Fix:**
```javascript
router.get('/reviews', async (req, res) => {
  try {
    const { page = 1, limit = 20, product_id } = req.query;
    const take = Math.min(parseInt(limit), 50);
    const skip = (parseInt(page) - 1) * take;

    const where = product_id
      ? { product_id: BigInt(product_id) }
      : {};

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take,
        select: {
          id: true, product_id: true, reviewer: true,
          rating: true, comment: true, reply: true, date: true
        }
      }),
      prisma.review.count({ where }),
    ]);

    res.json({
      data: reviews.map(r => ({ ...r, product_id: Number(r.product_id) })),
      total, page: parseInt(page), limit: take,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

### 1D. Home Page — Lazy Load Recommendations & Flash Sale

**Vấn đề** (`src/pages/b2c/Home.jsx`): Tất cả 3 calls trong `Promise.all()` cùng block render:
```javascript
const [prodData, catData, flashData] = await Promise.all([
  api.b2c.getProducts(...),    // ~500ms
  api.b2c.getCategories(),     // ~150ms
  api.b2c.getFlashSales()      // ~200ms
]);
// ← User thấy spinner 500ms trước khi thấy BẤT CỨ THỨ GÌ
```

**Fix — Progressive Loading (ưu tiên render nhanh):**

```jsx
// src/pages/b2c/Home.jsx

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [products,   setProducts]   = useState([]);
  const [flashSale,  setFlashSale]  = useState(null);

  // Phase 1: Load categories trước (nhẹ nhất, ~50ms)
  // → User thấy category bar ngay lập tức
  useEffect(() => {
    api.b2c.getCategories().then(setCategories).catch(console.error);
  }, []);

  // Phase 2: Load products (quan trọng nhất)
  useEffect(() => {
    api.b2c.getProducts('ALL', '', 'newest', selectedBranch?.id, currentPage, 30)
      .then(d => { setProducts(d.data || []); setTotalProducts(d.total || 0); })
      .catch(console.error);
  }, [selectedBranch, currentPage]);

  // Phase 3: Load flash sale (secondary, lazy)
  useEffect(() => {
    // Delay 300ms để không block render chính
    const timer = setTimeout(() => {
      api.b2c.getFlashSales().then(setFlashSale).catch(console.error);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Phase 4: AI Recommendations (lowest priority, thậm chí có thể defer sau 1s)
  useEffect(() => {
    if (!b2cUser?.email) return;
    const timer = setTimeout(() => {
      api.ai.getRecommendations(b2cUser.email)
        .then(setRecommendations)
        .catch(console.error);
    }, 1000); // Delay 1s — user đã nhìn thấy products rồi
    return () => clearTimeout(timer);
  }, [b2cUser]);
}
```

> **Kết quả:** FCP (First Contentful Paint) cải thiện từ **~600ms → ~100ms** (categories hiện ngay).  
> LCP (Largest Contentful Paint) — products hiện sau ~500ms thay vì chờ tất cả 3 APIs.

---

### 1E. GeneralManagement — Lazy Tab Loading

**Vấn đề**: `loadData()` luôn fetch 5 APIs cùng lúc kể cả tab chưa được mở.

```jsx
// HIỆN TẠI — Load tất cả cùng lúc (kể cả Sản phẩm 50k khi đang ở tab Chi nhánh)
const [br, pr, cat, fs, brds] = await Promise.all([
  api.b2b.getBranches(),    // ~100ms
  api.b2b.getProducts(),    // ~5000ms (50k rows!)
  api.b2c.getCategories(),  // ~100ms
  api.b2b.getFlashSales(),  // ~100ms
  api.b2b.getBrands()       // ~100ms
]);
```

**Fix — Load theo tab:**

```jsx
// src/pages/GeneralManagement.jsx

const [tabLoaded, setTabLoaded] = useState({ '1': false, '2': false, '3': false, '4': false });

// Load data nhẹ ngay từ đầu (branches, categories, brands, flash-sales)
const loadStaticData = useCallback(async () => {
  setLoading(true);
  try {
    const [br, cat, fs, brds] = await Promise.all([
      api.b2b.getBranches(),
      api.b2c.getCategories(),
      api.b2b.getFlashSales(),
      api.b2b.getBrands(),
    ]);
    setBranches(br); setCategories(cat);
    setFlashSales(fs); setBrands(brds);
    setTabLoaded(prev => ({ ...prev, '1': true, '3': true, '4': true }));
  } catch(e) { message.error('Không thể tải dữ liệu'); }
  setLoading(false);
}, []);

// Load products CHỈ KHI user mở tab "Sản phẩm"
const handleTabChange = async (key) => {
  setActiveTab(key);
  if (key === '2' && !tabLoaded['2']) {
    await loadProducts(1); // Paginated load
    setTabLoaded(prev => ({ ...prev, '2': true }));
  }
};

useEffect(() => { loadStaticData(); }, [loadStaticData]);

// <Tabs onChange={handleTabChange} ...>
```

> **Kết quả:** Initial load time từ **~5-8s → ~300ms** (không load 50k products khi mở tab khác).

---

### 1F. Chunk Strategy — 6×30 = 180 products

Theo đề xuất của bạn: **6 cột × 30 rows = 180 sản phẩm visible tối đa** per page.

```
Layout B2C (6 cột, responsive):
  Desktop:    6 cột × 5 hàng = 30 sản phẩm
  Tablet:     3 cột × 10 hàng = 30 sản phẩm  
  Mobile:     2 cột × 15 hàng = 30 sản phẩm

Layout B2B Table:
  30 rows/page (server paginates, Ant Design Table)

Chunk size lý do chọn 30:
  ✓ Đủ để "above the fold" không cảm thấy thiếu
  ✓ Response payload: 30 × ~2KB/product ≈ 60KB (nhanh)
  ✓ Prefetch page tiếp theo trong background khi scroll 70%
  ✓ Ant Design Pagination hỗ trợ sẵn showSizeChanger [10, 20, 30, 50]
```

**Infinite Scroll Option (thay Pagination cho B2C):**

```jsx
// Dùng Intersection Observer để prefetch khi gần cuối trang
// src/pages/b2c/ProductList.jsx

import { useRef, useCallback } from 'react';

const observerRef = useRef(null);
const [hasMore, setHasMore] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);

const lastProductRef = useCallback(node => {
  if (loading) return;
  if (observerRef.current) observerRef.current.disconnect();
  observerRef.current = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && hasMore && !loadingMore) {
      loadMore(); // Load page tiếp theo
    }
  });
  if (node) observerRef.current.observe(node);
}, [loading, hasMore, loadingMore]);

const loadMore = async () => {
  setLoadingMore(true);
  const nextPage = currentPage + 1;
  const data = await api.b2c.getProducts(
    categoryFilter, searchQuery, sort,
    selectedBranch?.id, nextPage, 30
  );
  setProducts(prev => [...prev, ...(data.data || [])]);
  setCurrentPage(nextPage);
  setHasMore(nextPage < data.totalPages);
  setLoadingMore(false);
};

// Gắn ref vào sản phẩm cuối cùng trong danh sách:
// {products.map((p, i) => (
//   <Col key={p.id} ref={i === products.length - 1 ? lastProductRef : null}>
```

---

## Phần 2 — AI API Optimization

## Luồng AI — `POST /api/b2c/chat` (AI Chatbot)

### Sơ đồ pipeline hiện tại

```
Request
  │
  ├─[0] FSM check         → O(1), in-memory              ← nhanh ✓
  ├─[1] DecisionTree check → O(1), in-memory             ← nhanh ✓
  │
  ├─[1] SpellCorrector     → O(n × dict_size)            ← CHẬM ⚠️
  │      Levenshtein trên dict ~2000 từ + product names
  │
  ├─[2] NER extract        → Regex scan                  ← ổn
  ├─[3] LangDetect         → Regex scan                  ← ổn
  │
  ├─[4B] EnsembleClassifier.predict()                    ← CHẬM ⚠️
  │       ├─ _getNBProbs()  → re-tokenize + loop qua ALL intents
  │       ├─ LR.predict()   → matrix multiply
  │       └─ SVM.predict()  → margin calculation
  │
  ├─[5] Secondary Intent Correction → Regex              ← ổn
  │
  └─[6] Intent Handler → Prisma query (Supabase)         ← CHẬM ⚠️
         Nhiều handler query DB KHÔNG có index tối ưu
         Network RTT đến Supabase ap-northeast-1 ≈ 80-150ms/query
```

### Bottleneck #1 — SpellCorrector (ước tính ~200-500ms)

**Vấn đề:**  
Mỗi request gọi `correctSentence()` → với dictionary ~2000 từ + product names thêm vào sau init, hàm `correctWord()` chạy `natural.LevenshteinDistance()` (O(m×n)) cho mỗi từ trong câu.  
Cache `_cache` có 500 entries nhưng **key là câu nguyên gốc** → tỷ lệ cache hit thấp (người dùng luôn hỏi câu mới).

**Giải pháp — Word-level cache thay vì sentence-level:**

```javascript
// src/ai/SpellCorrector.js

class SpellCorrector {
  constructor(customDictionary = []) {
    this.dictionary = [...new Set([...PRODUCT_DICTIONARY, ...customDictionary.map(w => w.toLowerCase())])];
    // THAY: sentence cache → word cache (hit rate cao hơn nhiều)
    this._wordCache = new Map();   // word → { corrected, distance, changed }
    this._maxCacheSize = 5000;     // từ đơn unique ít hơn câu nhiều
  }

  correctWord(word) {
    const lower = word.toLowerCase();
    // 1. Exact match trong dictionary → skip Levenshtein
    if (this.dictionary.includes(lower)) {
      return { corrected: word, distance: 0, changed: false };
    }
    // 2. Word cache hit
    if (this._wordCache.has(lower)) {
      return this._wordCache.get(lower);
    }
    // 3. Tính Levenshtein (giữ nguyên logic cũ)
    const threshold = this._getThreshold(lower.length);
    let bestWord = lower, bestDist = Infinity;
    for (const dictWord of this.dictionary) {
      if (Math.abs(dictWord.length - lower.length) > threshold) continue;
      const dist = natural.LevenshteinDistance(lower, dictWord);
      if (dist < bestDist) { bestDist = dist; bestWord = dictWord; }
      if (dist === 0) break;
    }
    const changed = bestDist > 0 && bestDist <= threshold;
    const result = { corrected: changed ? bestWord : word, distance: bestDist, changed };
    // Cache word
    if (this._wordCache.size > this._maxCacheSize) this._wordCache.clear();
    this._wordCache.set(lower, result);
    return result;
  }

  // XÓA sentence-level cache, giữ nguyên correctSentence() logic
}
```

**Tối ưu thêm — Dictionary là Set thay vì Array:**

```javascript
// TRƯỚC: this.dictionary.includes(lower) → O(n)
// SAU:   this._dictSet.has(lower)        → O(1)

constructor(customDictionary = []) {
  const arr = [...new Set([...PRODUCT_DICTIONARY, ...customDictionary.map(w => w.toLowerCase())])];
  this.dictionary = arr;           // Giữ để loop Levenshtein
  this._dictSet   = new Set(arr);  // Cho O(1) exact lookup
}

correctWord(word) {
  const lower = word.toLowerCase();
  if (this._dictSet.has(lower)) return { corrected: word, distance: 0, changed: false }; // O(1)
  // ...
}

addProductNames(productNames) {
  productNames.forEach(name => {
    name.toLowerCase().split(/\s+/).forEach(word => {
      if (word.length >= 3 && !this._dictSet.has(word)) {
        this.dictionary.push(word);
        this._dictSet.add(word);  // Đồng bộ Set
      }
    });
  });
  this._wordCache.clear();
}
```

---

### Bottleneck #2 — EnsembleClassifier._getNBProbs() (ước tính ~100-300ms)

**Vấn đề:**  
Mỗi lần `predict()`, `_getNBProbs()` phải:
1. Re-tokenize message (lặp lại sau khi NaiveBayes đã tokenize nội bộ)
2. Loop qua **tất cả intent classes** × **tất cả token** để tính log-probability
3. `new Tokenizer()` được khởi tạo bên trong hàm private mỗi lần gọi

**Giải pháp — Singleton Tokenizer + cached allProbs từ NaiveBayes:**

```javascript
// src/ai/NaiveBayes.js — Thêm method predictAllProbs()

predictAllProbs(text) {
  const tokens = this.tokenizer.tokenize(text);
  const scores = {};
  for (const intentClass in this.priorProbabilities) {
    let score = Math.log(this.priorProbabilities[intentClass]);
    for (const token of tokens) {
      let wordProb = this.conditionalProbabilities[intentClass][token];
      if (!wordProb) {
        wordProb = 1 / ((this.wordCountByClass[intentClass] || 0) + this.vocabulary.size);
      }
      score += Math.log(wordProb);
    }
    scores[intentClass] = score;
  }
  // Softmax inline
  const classes  = Object.keys(scores);
  const maxLogP  = Math.max(...classes.map(c => scores[c]));
  const exps     = classes.map(c => Math.exp(scores[c] - maxLogP));
  const sumExps  = exps.reduce((a, b) => a + b, 0);
  const probs    = {};
  classes.forEach((cls, i) => { probs[cls] = exps[i] / sumExps; });
  return probs;
}
```

```javascript
// src/ai/EnsembleClassifier.js — Đơn giản hóa _getNBProbs()

_getNBProbs(message) {
  // Dùng method mới thay vì re-implement logic bên trong Ensemble
  return this.naiveBayes?.predictAllProbs?.(message) ?? {};
}
```

**Loại bỏ `new Tokenizer()` bên trong `_getNBProbs()`** — tiết kiệm object allocation mỗi request.

---

### Bottleneck #3 — Prisma queries đến Supabase (ước tính ~80-400ms/query)

**Vấn đề:**  
- Database URL trỏ đến Supabase `ap-northeast-1` (Tokyo) — RTT từ Việt Nam ≈ 80-150ms
- Nhiều handler thực hiện **2-3 queries tuần tự** (waterfall)
- `findMany()` không luôn dùng index → full scan
- `redis.flushAll()` tại checkout xóa toàn bộ cache mỗi lần đặt hàng

#### 3a. Gộp parallel queries (thay waterfall bằng `Promise.all`)

```javascript
// TRƯỚC (waterfall ≈ 150+150ms = 300ms):
// src/routes/ai.js — handler SEARCH_PRODUCT
const foundProducts = await prisma.product.findMany({ where: {...} });
// Nếu không tìm thấy:
const category = await prisma.category.findFirst({ where: {...} });

// SAU (parallel nếu cả hai cần → ≈ max(150, 150) = 150ms):
const [foundProducts, categories] = await Promise.all([
  prisma.product.findMany({
    where: { name: { contains: entityKeywords, mode: 'insensitive' }, is_deleted: false },
    orderBy: { sold: 'desc' },
    take: 1,
    select: { id: true, name: true, price: true, description: true, rating: true, sold: true }
  }),
  entityKeywords
    ? prisma.category.findMany({
        where: { name: { contains: entityKeywords, mode: 'insensitive' } },
        take: 1,
        select: { id: true, name: true }
      })
    : Promise.resolve([])
]);
```

#### 3b. Dùng `select` để chỉ lấy fields cần thiết

```javascript
// TRƯỚC: prisma.product.findMany() → fetch toàn bộ row (~20 fields, description có thể rất dài)

// SAU: Chỉ lấy những gì handler cần
prisma.product.findMany({
  where: { ... },
  select: {
    id: true,
    name: true,
    price: true,
    stock: true,
    sold: true,
    rating: true,
    // description chỉ lấy khi handler ASK_SPECS cần
  },
  take: 3
})
```

#### 3c. Application-level cache cho các intent không thay đổi thường xuyên

```javascript
// src/routes/ai.js — Thêm in-memory TTL cache cho các intent tĩnh

const intentCache = new Map(); // { key: string → { data, expiry: number } }

function getCached(key) {
  const entry = intentCache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  return null;
}

function setCached(key, data, ttlMs = 30_000) { // 30s default
  intentCache.set(key, { data, expiry: Date.now() + ttlMs });
  // Giới hạn cache size để tránh memory leak
  if (intentCache.size > 200) {
    const firstKey = intentCache.keys().next().value;
    intentCache.delete(firstKey);
  }
}

// Ví dụ dùng cho ASK_PROMO (Flash sale không thay đổi từng giây):
else if (intent === 'ASK_PROMO') {
  const cacheKey = 'flash_sale_active';
  let activeSales = getCached(cacheKey);
  if (!activeSales) {
    activeSales = await prisma.flashSale.findMany({
      where: { is_deleted: false, is_active: true },
      select: { title: true, discount_percent: true },
      take: 1
    });
    setCached(cacheKey, activeSales, 60_000); // Cache 60s
  }
  // ...
}

// Tương tự cho: ASK_BEST_SELLER (TTL 120s), CHANGE_PRODUCT (TTL 30s),
// b2c/recommendations guest mode (TTL 60s)
```

#### 3d. Thay `redis.flushAll()` bằng targeted invalidation

```javascript
// TRƯỚC — checkout xóa toàn bộ Redis cache, kể cả chat cache không liên quan
await redis.flushAll();

// SAU — Chỉ xóa analytics cache, giữ lại chat/recommendation cache
await redis.del([
  `kpi:ALL:${today}`,
  `revHour:ALL:${today}`,
  // ...các key analytics liên quan
]);
// Hoặc dùng prefix pattern nếu Redis hỗ trợ:
// await redis.unlink(...(await redis.keys('kpi:*')));
```

---

### Bottleneck #4 — Khởi tạo `new Tokenizer()` lặp lại trong handlers

**Vấn đề:**  
Tại nhiều handler (CHECK_STOCK, COMPARE_PRODUCT, COMPARE_ACCESSORIES, SEARCH_PRODUCT), code thực hiện:
```javascript
const tokens = new (require('../ai/Tokenizer'))().tokenize(message);
```
Mỗi lần: `require()` → lookup module cache → `new Tokenizer()` → `tokenize()`.  
`require()` đã có cache, nhưng `new Tokenizer()` vẫn tạo object mới mỗi request.

**Giải pháp — Singleton Tokenizer ở top-level `ai.js`:**

```javascript
// src/routes/ai.js — Đầu file, sau các imports

// Singleton tokenizer — dùng chung toàn bộ route handlers
const { Tokenizer } = require('../ai/Tokenizer');
const _tokenizer = new Tokenizer();

// Trong handlers, thay:
// const tokens = new (require('../ai/Tokenizer'))().tokenize(message);
// Bằng:
const tokens = _tokenizer.tokenize(message);
```

> **Lưu ý:** Tokenizer phải **stateless** (không giữ state giữa các lần gọi). Kiểm tra `Tokenizer.js` — class hiện tại chỉ expose `tokenize()` không có side effects, an toàn để share.

---

## Luồng 2 — `GET /api/b2c/recommendations`

### Hiện trạng

```javascript
// Với guest user: 2 queries tuần tự
const allProducts = await prisma.product.findMany({...take: 20}); // Query 1
const prods = await prisma.product.findMany({ where: { id: { in: fallbackIds } } }); // Query 2 (redundant!)

// Với email user: 3 queries tuần tự
const orders = await prisma.order.findMany({...});    // Query 1
const recommendedProducts = await prisma.product.findMany({...}); // Query 2
// Nếu < 4 kết quả:
const fallback = await prisma.product.findMany({...}); // Query 3
```

### Tối ưu

```javascript
router.get('/b2c/recommendations', async (req, res) => {
  const { email } = req.query;

  // Guest path — 1 query duy nhất, cache 60s
  if (!email) {
    const cacheKey = 'rec:guest';
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const prods = await prisma.product.findMany({
      where: { is_deleted: false, stock: { gt: 0 } },
      select: { id: true, name: true, price: true, image: true, rating: true },
      orderBy: { sold: 'desc' }, // Dùng index trên cột `sold`
      take: 4,
    });
    const result = prods.map(p => ({ ...p, id: Number(p.id) }));
    setCached(cacheKey, result, 60_000);
    return res.json(result);
  }

  // Email path — parallel queries
  const [orders, fallbackProds] = await Promise.all([
    prisma.order.findMany({
      where: { customer: { path: ['email'], equals: email } },
      select: { items: true },           // Chỉ lấy items, không cần toàn bộ order
      orderBy: { date: 'desc' },
      take: 5,                           // Giảm từ 10 xuống 5 (đủ để extract categories)
    }),
    prisma.product.findMany({
      where: { is_deleted: false, stock: { gt: 0 } },
      select: { id: true, name: true, price: true, image: true, rating: true },
      orderBy: { sold: 'desc' },
      take: 4,
    }),
  ]);

  let result = fallbackProds;
  if (orders.length > 0) {
    const recentCategories = [...new Set(orders.flatMap(o => o.items).map(i => i.category_id))];
    if (recentCategories.length > 0) {
      const catProds = await prisma.product.findMany({
        where: { category_id: { in: recentCategories }, is_deleted: false, stock: { gt: 0 } },
        select: { id: true, name: true, price: true, image: true, rating: true },
        take: 4,
      });
      if (catProds.length >= 4) result = catProds;
    }
  }

  res.json(result.map(p => ({ ...p, id: Number(p.id) })));
});
```

---

## Luồng 3 — `POST /api/b2c/checkout`

### Vấn đề hiện tại

```javascript
for (const item of items) {
  // WATERFALL — N items = N × RTT_Supabase ≈ N × 150ms
  const product = await prisma.product.findUnique({ where: { id: BigInt(item.id) } });
  await prisma.product.update({ where: { id: BigInt(item.id) }, data: {...} });
}
```
Với giỏ hàng 3 sản phẩm → 6 queries tuần tự ≈ **900ms** chỉ riêng inventory deduction.

### Tối ưu — Batch update với `Promise.all`

```javascript
// Fetch tất cả products cần update trong 1 query
const itemIds = items.map(i => BigInt(i.id));
const products = await prisma.product.findMany({
  where: { id: { in: itemIds } },
  select: { id: true, stock: true, sold: true, variants: true }
});
const productMap = new Map(products.map(p => [String(p.id), p]));

// Parallel update (tất cả items cùng lúc)
await Promise.all(items.map(async item => {
  const product = productMap.get(String(item.id));
  if (!product) return;

  const stockToDeduct = Number(item.quantity);
  let updatedVariants = product.variants;
  if (item.selectedVariant && Array.isArray(updatedVariants)) {
    updatedVariants = updatedVariants.map(v =>
      v.id === item.selectedVariant.id
        ? { ...v, stock: Math.max(0, (v.stock || 0) - stockToDeduct) }
        : v
    );
  }

  return prisma.product.update({
    where: { id: BigInt(item.id) },
    data: {
      stock: Math.max(0, product.stock - stockToDeduct),
      variants: updatedVariants,
      sold: { increment: stockToDeduct }
    }
  });
}));
```
**Kết quả:** N × 150ms → max(150ms) = **150ms** (giảm ~83% với 3 items)

---

## Database Index Recommendations

> Các index này cần tạo trực tiếp trên Supabase PostgreSQL hoặc qua Prisma migration.

```sql
-- Tìm sản phẩm theo tên (SEARCH_PRODUCT, CHECK_STOCK)
CREATE INDEX IF NOT EXISTS idx_product_name_gin
  ON "Product" USING gin(to_tsvector('simple', name))
  WHERE is_deleted = false;

-- Sản phẩm bán chạy (recommendations, ASK_BEST_SELLER)  
CREATE INDEX IF NOT EXISTS idx_product_sold_desc
  ON "Product" (sold DESC)
  WHERE is_deleted = false AND stock > 0;

-- Tìm sản phẩm theo category + is_deleted + stock
CREATE INDEX IF NOT EXISTS idx_product_category_active
  ON "Product" (category_id, is_deleted, stock)
  WHERE is_deleted = false;

-- Tìm đơn hàng theo email khách
CREATE INDEX IF NOT EXISTS idx_order_customer_email
  ON "Order" ((customer->>'email'));

-- Flash sale active
CREATE INDEX IF NOT EXISTS idx_flashsale_active
  ON "FlashSale" (is_active, is_deleted)
  WHERE is_deleted = false;
```

> **Prisma schema** — thêm `@@index` vào `schema.prisma` để sync với migration:
> ```prisma
> model Product {
>   @@index([sold(sort: Desc)], name: "idx_product_sold_desc")
>   @@index([category_id, is_deleted, stock])
> }
> ```

---

## Tóm tắt tác động ước tính

### Data Loading (Initial Page Load)

| Bottleneck | Hiện tại | Sau tối ưu | Giảm |
|---|---|---|---|
| B2B Products load (50k rows) | ~5–8s, ~50MB | ~200ms, ~60KB | **-99.9% data** |
| B2B GeneralManagement init | ~5s (blocked by products) | ~300ms | **-94%** |
| B2C Products (JS-side filter+slice) | ~1–3s/filter | ~300ms | **-80%** |
| B2B Reviews (all) | ~500ms–2s | ~100ms | **-80%** |
| Home FCP (blocked by 3 parallel APIs) | ~600ms | ~100ms | **-83%** |

### AI Pipeline

| Bottleneck | Hiện tại | Sau tối ưu | Giảm |
|---|---|---|---|
| SpellCorrector (word cache + Set) | ~300ms | ~30ms | **-90%** |
| EnsembleClassifier._getNBProbs() | ~150ms | ~60ms | **-60%** |
| Prisma queries (select + parallel) | ~400ms | ~180ms | **-55%** |
| Intent cache (static responses) | ~150ms | ~5ms | **-97%** |
| Tokenizer re-instantiation | ~20ms | ~2ms | **-90%** |
| **Tổng `POST /api/b2c/chat`** | **~3 000ms** | **~350–500ms** | **~85%** |
| Checkout inventory (parallel) | ~450ms (3 items) | ~160ms | **-64%** |

---

## Thứ tự ưu tiên triển khai

| Priority | Thay đổi | File | Effort | Impact |
|---|---|---|---|---|
| 🔴 P0 | B2B products: thêm `skip/take` + `select` | `b2b.js` | 1h | **-99.9% data** |
| 🔴 P0 | GeneralManagement: lazy tab load + server pagination | `GeneralManagement.jsx` | 2h | **-94% init time** |
| 🔴 P0 | B2C products: true server-side pagination + filter | `b2c.js` | 2h | **-80% memory** |
| 🟠 P1 | Home: progressive load (categories first) | `Home.jsx` | 1h | **FCP -83%** |
| 🟠 P1 | Intent-level in-memory TTL cache | `ai.js` | 2h | **-97% static intents** |
| 🟠 P1 | SpellCorrector word-cache + `Set` lookup | `SpellCorrector.js` | 1h | **-90% spell time** |
| 🟠 P1 | Parallel Prisma queries ở checkout | `index.js` | 2h | **-64% checkout** |
| 🟡 P2 | B2B Reviews pagination | `b2b.js` | 30min | Medium |
| 🟡 P2 | NaiveBayes.predictAllProbs() | `NaiveBayes.js` | 1h | **-60% ensemble** |
| 🟡 P2 | `select` fields trong Prisma queries | `ai.js` | 3h | **-30% per query** |
| 🟢 P3 | Singleton `_tokenizer` trong ai.js | `ai.js` | 30min | Low |
| 🟢 P3 | Targeted Redis invalidation (thay flushAll) | `index.js` | 1h | Medium |
| 🟢 P3 | Database indexes (cần migration) | Supabase SQL | 2h | Medium–High |

---

## Ghi chú kiến trúc

```
Cái KHÔNG thể tối ưu (ràng buộc cứng):
  ✗ Network RTT đến Supabase Tokyo (~80-150ms/query) — cố định
  ✗ Thời gian inference NLP models — giới hạn bởi CPU
  ✗ pgBouncer pooling (đang dùng port 6543) — đã tốt

Cái CÓ THỂ tối ưu (mục tiêu doc này):
  ✓ Số lần round-trip DB (từ 5 xuống 1-2 per request)  
  ✓ CPU time trong NLP pipeline (word cache, singleton, select fields)
  ✓ Cache hit rate cho responses tĩnh (Flash sale, best-seller, etc.)
  ✓ Tránh tạo objects không cần thiết mỗi request (Tokenizer, Tokenizer, Intl.NumberFormat)
```

> **Intl.NumberFormat tái sử dụng:** Tạo một lần ở top-level thay vì mỗi lần format giá.
> ```javascript
> // src/routes/ai.js — top level
> const VND_FMT = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
> // Trong handlers: VND_FMT.format(price) thay vì new Intl.NumberFormat(...).format(price)
> ```
