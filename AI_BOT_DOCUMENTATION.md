# Tài liệu Kỹ thuật — Getshopy AI Bot

> **Phiên bản:** v3.0 · **Cập nhật:** 09/2025  
> **Phạm vi:** Module `ai-bot` trong hệ thống Ecommerce Getshopy (KLTN)

---

## 1. Tổng quan

AI Bot là một **microservice Node.js độc lập**, tách khỏi server chính, cung cấp ba năng lực AI cho nền tảng thương mại điện tử Getshopy:

| Tính năng | Mô tả |
|-----------|-------|
| **AI Chatbot hội thoại** | Trả lời câu hỏi mua sắm tiếng Việt, tư vấn sản phẩm, tra cứu chính sách |
| **Smart Search** | Tìm kiếm ngữ nghĩa bằng văn bản (không cần từ khóa chính xác) |
| **Visual Search** | Phân tích ảnh sản phẩm → tìm kiếm trong DB |

**Vị trí trong kiến trúc hệ thống:**

```
Browser / Mobile
     │
     ▼
[Client — Next.js / port 3000]
     │  proxy /api/ → Nginx
     ▼
[Server — Express / port 8080]
     │  gọi nội bộ Docker network
     ▼
[AI Bot — Express / port 3001]   ← module này
     │
     ├── PostgreSQL (via Prisma ORM)
     ├── HuggingFace Inference API  (classification + LLM)
     └── Google AI Studio API       (visual search)
```

---

## 2. Cấu trúc thư mục

```
source/ai-bot/
├── src/
│   ├── ai-server.js          # Entry point, Express app, route mounting
│   ├── db.js                 # Prisma client singleton
│   ├── redis.js              # Redis client (optional cache layer)
│   ├── ai/
│   │   ├── huggingface.js    # NLP: intent classification (zero-shot)
│   │   ├── llm.js            # LLM: text generation (chat response)
│   │   └── visualSearch.js   # Vision: ảnh → sản phẩm (Gemini)
│   ├── services/
│   │   ├── ChatbotService.js     # Pipeline chatbot hội thoại
│   │   ├── SearchService.js      # Smart Search + Visual Search logic
│   │   ├── KnowledgeCache.js     # Cache categories + brands từ DB
│   │   └── ProductSpecsCache.js  # Cache + parse thông số kỹ thuật SP
│   └── routes/
│       ├── chatbot.js        # Route POST /api/b2c/chat
│       └── search.js         # Routes smart-search + visual-search
├── tests/
│   ├── chatbot-stress-test.js    # Stress test 1000+ testcases
│   └── results-brand-v3.json    # Kết quả test
└── package.json
```

---

## 3. API Endpoints

Tất cả endpoints được mount dưới prefix `/api/` trên port **3001** (Docker internal). Client truy cập qua Nginx proxy của server port 3000.

### 3.1 `POST /api/b2c/chat`
**Chatbot hội thoại**

**Request:**
```json
{
  "message": "Tìm iPhone 15 Pro Max giá rẻ nhất",
  "history": [
    { "sender": "user", "text": "..." },
    { "sender": "bot",  "text": "..." }
  ]
}
```

**Response:**
```json
{
  "text": "Dạ bên em đang có iPhone 15 Pro Max 256GB giá 29.990.000đ...",
  "link": "/shop?category=cat-phone",
  "products": [
    {
      "id": 12345,
      "name": "Apple iPhone 15 Pro Max 256GB",
      "price": 29990000,
      "original_price": 34990000,
      "image": "https://...",
      "rating": 4.8,
      "category_id": "cat-phone",
      "brand_id": "br-apple",
      "specs": { "screen": "6.7 inch Super Retina XDR", "chip": "A17 Pro", "storage": "256GB" }
    }
  ]
}
```

**Timeout guard:** Nếu toàn bộ pipeline > 25 giây → trả fallback tĩnh ngay, không để user chờ.

---

### 3.2 `POST /api/ai/smart-search`
**Tìm kiếm thông minh bằng text**

**Request:** `{ "query": "tai nghe chống ồn dưới 2 triệu" }`

**Response:**
```json
{
  "products": [...],   // tối đa 8 sản phẩm
  "hint": "Đã tìm thấy tai nghe ANC phù hợp ngân sách của bạn",
  "filters": { "categoryId": "cat-av-bt-earphone", "maxPrice": 2000000 }
}
```

---

### 3.3 `POST /api/b2c/visual-search`
**Tìm kiếm bằng ảnh**

**Request:** `{ "imageBase64": "data:image/jpeg;base64,/9j/..." }`

**Response:**
```json
{
  "caption": "Pacific Blue iPhone 12 Pro held in hand",
  "analysis": {
    "category": "Điện thoại",
    "brand": "Apple",
    "color": "Blue",
    "keywords": ["iPhone 12 Pro", "điện thoại Apple"],
    "description_vi": "Điện thoại iPhone 12 Pro màu xanh Pacific Blue..."
  },
  "products": [...],
  "text": "Dạ em thấy trong ảnh là iPhone 12 Pro màu Pacific Blue..."
}
```

---

### 3.4 `POST /api/ai/smart-search-image`
**Kết hợp ảnh + text**

**Request:** `{ "query": "tai nghe tương tự nhưng màu đen", "imageBase64": "..." }`

Pipeline xử lý 4 trường hợp:
- Chỉ ảnh → visual search
- Chỉ text → smart search  
- Cả hai → vision phân tích ảnh + text bổ sung → merge kết quả
- Không có → trả top sản phẩm

---

### 3.5 `GET /api/health`
```json
{ "status": "ok", "service": "ai-bot", "features": ["chatbot", "smart-search", "visual-search"] }
```

---

## 4. Pipeline xử lý Chatbot

```
user message
    │
    ▼
[BƯỚC 1] classifyIntent()  ─ huggingface.js
    │   ├── Rule-based pre-classifier (regex, zero-latency)
    │   │   └── GREETING / COMPARE_PRODUCT / SEARCH_PRODUCT / ASK_BEST_SELLER...
    │   └── HuggingFace zero-shot classification
    │       └── Model chain: mDeBERTa → xlm-roberta → DeBERTa-fever → bart
    │
    ▼
[OVERRIDE] Brand/Category-Intent Override  ─ ChatbotService.js
    │   Nếu intent = GREETING|UNKNOWN|GENERAL_INFO VÀ có brand/category → SEARCH_PRODUCT
    │
    ▼
[BƯỚC 2] buildContext(intent, message, history)  ─ ChatbotService.js
    │   ├── Detect brand (KnowledgeCache, 33 brands + aliases)
    │   ├── Detect category (KnowledgeCache, 34 categories)
    │   ├── Extract price range (regex: "dưới 5 triệu" → {lte: 5000000})
    │   ├── Query PostgreSQL (Prisma ORM)
    │   ├── Scoring: đếm keyword match → sort
    │   └── Fallback cascade: brand chặt → bỏ brand → nới giá → top bán chạy
    │
    ▼
[BƯỚC 3] generateChatResponse(intent, context, message, history)  ─ llm.js
    │   ├── Build system prompt (vai trò + sản phẩm + chính sách)
    │   ├── Gọi HuggingFace featherless-ai (OpenAI-compatible format)
    │   ├── Language guard: phát hiện tiếng Trung → retry/skip
    │   └── Model chain: Llama-3.1-8B → Qwen2.5-7B → Qwen2.5-3B
    │
    ▼
[BƯỚC 4] Fallback response (nếu LLM fail)
    │   Static fallback per intent: template text + products
    │
    ▼
[LOG] saveChatLog() → ChatLog DB table (async, non-blocking)
    │
    ▼
Response JSON { text, link, products }
```

---

## 5. Module AI: `huggingface.js`

### 5.1 Chức năng
Phân loại **intent** (ý định) từ tin nhắn của người dùng tiếng Việt.

### 5.2 Cơ chế phân loại hai tầng

**Tầng 1 — Rule-based pre-classifier:**
- Xử lý trước khi gọi API → phản hồi tức thì, 0ms latency
- Pattern regex cụ thể cho các intent rõ ràng:

```
/^(xin chào|hello|hi|chào|alo)/ → GREETING
/\bhay\b.*\bvà\b/ hoặc /\bvs\.?\b/ → COMPARE_PRODUCT
/^(tìm|search|cho xem|hiển thị)/ → SEARCH_PRODUCT
/bán chạy|hot nhất|top.*bán/ → ASK_BEST_SELLER
...
```

**Tầng 2 — HuggingFace Zero-Shot Classification:**
- Gọi API khi rule-based không match
- Mô hình NLI (Natural Language Inference) phân loại câu vào 48 nhãn
- Confidence threshold: `0.35` (dưới ngưỡng → UNKNOWN)

### 5.3 Danh sách 48 Intents

| Nhóm | Intents |
|------|---------|
| **Chào hỏi / Chung** | `GREETING`, `HELP`, `SMALLTALK`, `UNKNOWN` |
| **Tìm kiếm** | `SEARCH_PRODUCT`, `SEARCH_CATEGORY` |
| **Hỏi sản phẩm** | `ASK_PRICE`, `ASK_SPECS`, `ASK_ACCESSORIES`, `ASK_REVIEW` |
| **Tư vấn** | `ASK_RECOMMEND`, `ASK_BEST_SELLER`, `ASK_NEW_ARRIVAL`, `ASK_GIFT` |
| **Tính năng SP** | `ASK_CAMERA`, `ASK_BATTERY`, `ASK_DISPLAY`, `ASK_STORAGE`, `ASK_CONNECTIVITY`, `ASK_GAMING`, `ASK_WATERPROOF`, `ASK_OS`, `ASK_DESIGN`, `ASK_COMPATIBILITY` |
| **So sánh** | `COMPARE_PRODUCT`, `COMPARE_SPECS`, `COMPARE_ACCESSORIES` |
| **Đơn hàng** | `TRACK_ORDER`, `CANCEL_ORDER`, `CHANGE_PRODUCT`, `CHECK_STOCK` |
| **Chính sách** | `ASK_DELIVERY`, `ASK_RETURN`, `ASK_PAYMENT`, `ASK_PROMO` |
| **Dịch vụ** | `ASK_REPAIR`, `ASK_TRADE_IN`, `ASK_SECOND_HAND`, `ASK_AUTHENTIC`, `ASK_INVOICE`, `ASK_LOYALTY` |
| **Đặc biệt** | `ASK_PREORDER`, `ASK_GIFT_WRAP`, `BULK_ORDER`, `URGENT_NEED`, `PRICE_COMPLAINT`, `COMPLAINT`, `FEEDBACK_POSITIVE`, `CONTACT`, `ASK_TRADE_IN` |

### 5.4 Model Fallback Chain (env-driven)

```
CLASSIFICATION_MODELS = env.HF_CLASSIFICATION_MODELS.split(',')

Thứ tự thử:
  [1] primary         → (configured in .env)   — multilingual, test 09/2025: SEARCH_PRODUCT 0.581
  [2] fallback 1      → (configured in .env)   — multilingual, test 09/2025: SEARCH_PRODUCT 0.793
  [3] fallback 2      → (configured in .env)   — test 09/2025: SEARCH_PRODUCT 0.479
  [4] fallback 3      → (configured in .env)   — English-only, last resort

Skip điều kiện: HTTP 404/410 (deprecated), HTTP 503 (overloaded), timeout, response rỗng
```

### 5.5 In-memory Cache

- Key: `removeDiacritics(message).toLowerCase().trim()`
- TTL: 5 phút
- Max entries: không giới hạn (xem xét thêm LRU nếu cần)
- Mục đích: tránh gọi API lặp lại cho cùng một câu hỏi

---

## 6. Module AI: `llm.js`

### 6.1 Chức năng
Sinh câu trả lời tự nhiên tiếng Việt bằng Large Language Model.

### 6.2 System Prompt

Prompt được cấu trúc gồm:
1. **Vai trò:** "Trợ lý AI mua sắm Getshopy"
2. **Sản phẩm liên quan** (từ DB, đã format bằng ProductSpecsCache)
3. **Thông tin chính sách** (delivery, return, payment...)
4. **Ràng buộc ngôn ngữ:** CHỈ tiếng Việt, xưng "em", gọi khách "anh/chị"
5. **Quy tắc:** Chỉ nêu sản phẩm có trong danh sách, không bịa specs

### 6.3 Cấu hình gọi API

```
Endpoint: HuggingFace Router (featherless-ai provider)
Format: OpenAI-compatible Chat Completions
max_tokens: 150  (2-3 câu, tránh chờ lâu)
temperature: 0.7
top_p: 0.9
timeout: 20 giây per attempt
MAX_RETRIES: 1 (failfast)
```

### 6.4 Language Guard

Phát hiện tiếng Trung (CJK Unicode block `\u4e00-\u9fff`) trong response → retry hoặc skip model.
Lý do: Một số LLM mặc định trả lời tiếng Trung dù hướng dẫn tiếng Việt.

### 6.5 Model Fallback Chain

```
LLM_MODELS = env.HF_LLM_MODELS.split(',')

Thứ tự thử:
  [1] primary   → (configured in .env)  — test 09/2025: WORKING ✅
  [2] fallback1 → (configured in .env)  — timeout 09/2025, monitor
  [3] fallback2 → (configured in .env)  — nhẹ hơn, last resort

Timeout → skip sang model tiếp (không retry model đang timeout)
HTTP 400/404/410 → skip sang model tiếp
HTTP 503 → retry trong model hiện tại rồi mới skip
```

### 6.6 Cơ chế hội thoại

- Giữ tối đa **6 lượt gần nhất** từ history (3 user + 3 bot)
- Follow-up detection: câu ngắn + pattern ("xem thêm", "mua ngay"...) → ghép keyword từ history trước khi buildContext

---

## 7. Module AI: `visualSearch.js`

### 7.1 Chức năng
Phân tích ảnh sản phẩm → trả về metadata (category, brand, keywords) → SearchService dùng để tìm sản phẩm.

### 7.2 Input/Output

**Input:** Data URL `"data:image/jpeg;base64,..."`  
**Output:**
```json
{
  "caption": "Pacific Blue iPhone 12 Pro held in hand",
  "analysis": {
    "category": "Điện thoại",
    "brand": "Apple",
    "color": "Blue",
    "keywords": ["iPhone 12 Pro", "điện thoại Apple", "iPhone màu xanh"],
    "description_vi": "Điện thoại iPhone 12 Pro màu xanh Pacific Blue..."
  }
}
```

### 7.3 Prompt Engineering

Prompt yêu cầu model:
- Nhận diện sản phẩm trong ảnh
- Chọn **đúng 1** danh mục từ danh sách 49 categories
- Chọn brand từ danh sách hợp lệ
- Trả về JSON thuần, không có markdown fence
- Xử lý ảnh không phải sản phẩm điện tử: `category=null, keywords=[]`

### 7.4 Xử lý JSON robustness
- Bóc markdown fence ` ```json ... ``` ` nếu model vô tình thêm
- Tự hoàn chỉnh JSON bị cắt (thêm `}` đóng)
- Parse lỗi → retry hoặc skip model

### 7.5 Gemini Model Fallback Chain

```
GEMINI_MODELS = env.GEMINI_MODELS.split(',')

Thứ tự thử:
  [1] primary   → (configured in .env)  — test 09/2025: WORKING ✅
  [2] fallback1 → (configured in .env)  — có trong model list, may timeout
  [3] fallback2 → (configured in .env)  — test 09/2025: WORKING ✅

HTTP 404/410 → deprecated, skip
HTTP 503 → high demand, retry rồi skip
Timeout 30s → skip sang model tiếp

API: Google AI Studio (generativelanguage.googleapis.com/v1beta)
responseMimeType: 'application/json'
maxOutputTokens: 1024
temperature: 0.1 (low for deterministic JSON)
```

---

## 8. Service: `KnowledgeCache.js`

### 8.1 Mục đích
Cache tập trung cho **33 brands** và **34 categories** từ DB. Tất cả AI services dùng chung, tránh query DB mỗi request.

### 8.2 Cấu trúc dữ liệu

```
_categories[]       : Array<{id, name, parent_id, sort_order}>
_categoryMap{}      : { categoryId → categoryName }
_parentCats[]       : [{ id, name, children: [{id, name}] }]
_childToParent{}    : { childId → parentId }
_parentToChildren{} : { parentId → [childId...] }

_brands[]           : Array<{id, name}>
_brandMap{}         : { brandId → brandName }
_brandAliases{}     : { normalizedAlias → brandId }
```

### 8.3 Taxonomy

**8 categories cấp 1 (cha):**
- `cat-phone` — Điện thoại
- `cat-laptop` — Laptop
- `cat-tablet` — Tablet
- `cat-watch` — Smartwatch
- `cat-mobile-acc` — Phụ kiện di động (7 sub)
- `cat-laptop-acc` — Phụ kiện laptop, PC (6 sub)
- `cat-av` — Thiết bị nghe nhìn, lưu trữ (10 sub)
- `cat-camera` — Camera (3 sub)

**33 Brands:** Apple, Samsung, OPPO, Xiaomi, vivo, realme, HONOR, Motorola, Acer, Asus, Dell, HP, Lenovo, Amazfit, Sony, JBL, Marshall, Baseus, Ugreen, Razer, Logitech, Dahua, EZVIZ, Imou, TP-Link, Kingston, SanDisk, Seagate, Huawei, ESR, Anker, MSI, TOTOLINK

### 8.4 Brand Detection

Hai cơ chế kết hợp:
1. **Static alias map** — 120+ alias keyword → brand_id (iphone → br-apple, galaxy → br-samsung, thinkpad → br-lenovo...)
2. **DB brand names** — build thêm alias từ tên chính thức trong DB

Thuật toán: scan từ dài → ngắn (greedy longest match), tránh nhầm "apple watch" → apple.

### 8.5 Category Detection

Keyword map: ~80 từ khóa → category_id

Đặc biệt: `may tinh` → `cat-laptop`, `smartwatch/watch/dong ho` → `cat-watch`

`expandCategoryIds(catId)`: nếu là parent → trả về `[parentId, child1, child2,...]`

### 8.6 Cache Lifecycle

```
CACHE_TTL: 5 phút
Load: _loadFromDB() → Promise.all([categories, brands])
Refresh: ensureLoaded() kiểm tra TTL trước mỗi request
Singleton Promise: tránh race condition khi nhiều request đồng thời
```

---

## 9. Service: `ProductSpecsCache.js`

### 9.1 Mục đích
Trích xuất và cache **thông số kỹ thuật** từ 600K+ sản phẩm để LLM và FE hiển thị.

### 9.2 Hai nguồn dữ liệu

**Nguồn 1 — Parse HTML description:**
```html
<table>
  <tr><td>Màn hình</td><td>6.7 inch Super Retina XDR</td></tr>
  <tr><td>Chip</td><td>A17 Pro</td></tr>
</table>
```
→ `{ screen: "6.7 inch Super Retina XDR", chip: "A17 Pro" }`

**Nguồn 2 — Suy luận từ tên sản phẩm (category-aware regex):**
```
"Adapter sạc nhanh Type C IQ3 45W Anker"
→ { wattage: "45W", ports: "Type C", protocol: "IQ3" }
```

### 9.3 Template coverage

Có template cho **30+ loại sản phẩm**: Điện thoại, Laptop, Tablet, Smartwatch, Sạc, Cáp, Ốp lưng, Miếng dán, Quạt mini, Bút tablet, Giá đỡ, Hub, Chuột, Bàn phím, Router, Balo, Bảng vẽ, Tai nghe BT/dây/chụp tai/thể thao, Loa, Micro, Máy chiếu, Ổ cứng, Thẻ nhớ, USB, Camera, Webcam...

### 9.4 Cache Layer (LRU)

```
CACHE_MAX: 10,000 entries
CACHE_TTL: 10 phút
Storage: Map<productId, {specs, timestamp}>
Eviction: LRU (FIFO order tracking)
```

### 9.5 Public API

| Method | Mô tả |
|--------|-------|
| `getTopSpecs(product, n=3)` | Top N specs theo priority của category |
| `getSpecsSummaryForLLM(products)` | Format specs cho LLM prompt |
| `specsMatchKeyword(product, kw)` | Filter specs theo keyword |
| `getSpecsSimilarity(p1, p2)` | Scoring tương đồng giữa 2 sản phẩm |

---

## 10. Service: `ChatbotService.js`

### 10.1 Xử lý theo intent

| Intent | DB Query | Logic |
|--------|----------|-------|
| `SEARCH_PRODUCT`, `ASK_PRICE`, `ASK_SPECS` | findMany + filters | brand + category + price + keyword scoring |
| `ASK_RECOMMEND` | findMany rating desc | optional budget + category filter |
| `COMPARE_PRODUCT` | findFirst × 2 | split by "vs/hay/và" → query 2 sản phẩm |
| `CHECK_STOCK` | findFirst | filter stock field |
| `ASK_BEST_SELLER` | findMany sold desc | category + brand filter |
| `ASK_NEW_ARRIVAL` | findMany id desc | latest products |
| `ASK_CAMERA` | findMany cat-phone | brand filter |
| `ASK_BATTERY` | findMany cat-mobile-acc-charger | |
| `ASK_PROMO` | flashSale findMany | active flash sales |
| `PRICE_COMPLAINT` | findMany price lte | budget-based |
| `ASK_DELIVERY/RETURN/PAYMENT/...` | — | Static policy text |
| `TRACK_ORDER/CANCEL_ORDER` | — | Policy + link /profile |

### 10.2 Fallback cascade cho SEARCH_PRODUCT

```
1. Tìm với brand + category + keywords + price
2. Nếu 0 kết quả → bỏ keywords, giữ brand + category + price
3. Nếu 0 → bỏ brand, giữ category + price
4. Nếu 0 → nới price ±30%
5. Nếu 0 → top bán chạy trong category
6. Nếu 0 → top bán chạy toàn hệ thống
```

### 10.3 Serialization

Chỉ gửi FE các fields cần thiết (bỏ: full images array, stock, variants, description HTML):
```json
{ id, name, price, original_price, image, rating, category_id, brand_id, category, specs }
```
Tối đa **4 sản phẩm** per response chatbot.

### 10.4 Chat Log

Lưu async (fire-and-forget) sau mỗi response:
```
ChatLog { session_id, customer_id?, message, response, intent, score, source }
```
`customer_id` được decode từ JWT Bearer token nếu user đã đăng nhập.

---

## 11. Service: `SearchService.js`

### 11.1 Smart Search (text)

```
query
  │
  ├── extractPriceFromQuery()  → { min, max }
  │   Hỗ trợ: "dưới 5 triệu", "từ 3 đến 7 tr", "tầm 10tr", "1.5 củ"...
  │
  ├── KC.detectBrand()         → brandId
  ├── KC.detectCategory()      → categoryId + expand children
  │
  ├── Tokenize (bỏ stopwords + brand/cat words)
  │
  └── DB Query: WHERE brand + category + price + OR(name contains token...)
      → Score: count keyword matches → sort desc
      → Fallback: brand → category → top all
```

Trả tối đa **8 sản phẩm**.

### 11.2 Visual Search

```
imageBase64
  │
  ▼
analyzeProductImage()  ─ visualSearch.js (Gemini)
  │   → { category, brand, keywords, color, description_vi }
  │
  ▼
buildSearchQuery(analysis)
  │   Merge: keywords + brand + category từ analysis
  │   + LLM-generated hint (optional)
  │
  ▼
DB Query (tương tự smart search)
  │
  ▼
Response { products, caption, analysis, text }
```

### 11.3 Smart Search Image (kết hợp)

4 trường hợp:
```
imageBase64=yes, query=yes → Vision phân tích ảnh + merge với text query
imageBase64=yes, query=no  → Pure visual search
imageBase64=no,  query=yes → Pure smart search
imageBase64=no,  query=no  → Top sản phẩm bán chạy
```

---

## 12. Cấu hình Môi trường (`.env`)

> ⚠️ File `.env` không được commit lên git (đã có trong `.gitignore`).

### 12.1 Biến môi trường AI Bot

| Biến | Mô tả |
|------|-------|
| `HF_API_KEY` | HuggingFace API key, lấy từ huggingface.co/settings/tokens |
| `HF_CLASSIFICATION_MODELS` | Chuỗi model chain phân loại intent, cách nhau bằng dấu phẩy |
| `HF_CONFIDENCE_THRESHOLD` | Ngưỡng confidence (mặc định: 0.35) |
| `HF_LLM_MODELS` | Chuỗi model chain sinh text, cách nhau bằng dấu phẩy |
| `GOOGLE_AI_KEY` | Google AI Studio API key |
| `GEMINI_MODELS` | Chuỗi Gemini model chain, cách nhau bằng dấu phẩy |

### 12.2 Thiết kế env-driven model chain

**Thêm/đổi model không cần sửa code:**
```bash
# Ví dụ khi model A bị khai tử:
HF_CLASSIFICATION_MODELS=model-B,model-C,model-D

# Rebuild Docker:
docker compose up --no-deps -d --build ai-bot
```

Code chỉ làm:
```js
const CLASSIFICATION_MODELS = (process.env.HF_CLASSIFICATION_MODELS || 'default')
  .split(',').map(s => s.trim()).filter(Boolean);
```

---

## 13. Triển khai Docker

### 13.1 Service definition (docker-compose.yml)

```yaml
ai-bot:
  image: kltn-ai-bot:latest
  build:
    context: ./source/ai-bot
  container_name: kltn-ai-bot-1
  env_file: [.env]          # đọc từ ROOT .env
  environment:
    PORT: 3001
    DATABASE_URL: "postgresql://..."
  networks: [getshopy-net]
  depends_on: [postgres]
```

> **Lưu ý quan trọng:** Container đọc từ ROOT `.env` (`d:\khóa-luận-tốt-nghiệp\.env`), **không phải** `source/server/.env`. Các AI keys phải được khai báo trong ROOT `.env`.

### 13.2 Build commands

```bash
# Rebuild chỉ ai-bot (không rebuild các service khác):
docker compose up --no-deps -d --build ai-bot

# Xem logs:
docker logs kltn-ai-bot-1 --tail 50 -f

# Health check:
curl http://localhost:3001/api/health
```

### 13.3 Dockerfile

```dockerfile
FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y openssl
COPY package*.json ./
RUN npm ci
COPY . .
RUN ./node_modules/.bin/prisma generate
EXPOSE 3001
CMD ["node", "src/ai-server.js"]
```

---

## 14. Luồng dữ liệu tổng thể

```
User nhập câu hỏi
        │
        ▼
Client (Next.js) → fetch POST /api/b2c/chat
        │
        ▼
Server (Express) → proxy → http://ai-bot:3001/api/b2c/chat
        │
        ▼
AI Bot routes/chatbot.js → ChatbotService.chat()
        │
        ├── KnowledgeCache.ensureLoaded()
        │     └── PostgreSQL: SELECT categories, brands
        │
        ├── huggingface.classifyIntent()
        │     ├── Rule-based (sync)
        │     └── HuggingFace API (async, 1-5s)
        │           └── Fallback chain: model[0] → model[1] → ...
        │
        ├── Intent Override (brand/category detection)
        │
        ├── buildContext()
        │     ├── KnowledgeCache.detectBrand/detectCategory()
        │     ├── Price extraction (regex)
        │     └── PostgreSQL: findMany products
        │
        ├── generateChatResponse()
        │     ├── ProductSpecsCache.getSpecsSummaryForLLM()
        │     ├── buildSystemPrompt()
        │     └── HuggingFace featherless-ai API (async, 3-15s)
        │           └── Fallback chain: model[0] → model[1] → ...
        │
        └── saveChatLog() (async, non-blocking)
        │
        ▼
Response JSON → Client render
```

---

## 15. Hiệu năng và Giới hạn

| Thông số | Giá trị |
|----------|---------|
| Timeout tổng chat pipeline | 25 giây |
| Timeout HF API mỗi lần gọi | 8 giây (classification), 20 giây (LLM) |
| Timeout Gemini | 30 giây |
| Max products per response | 4 (chatbot), 8 (smart-search) |
| Max history giữ lại | 6 lượt (3 user + 3 bot) |
| KnowledgeCache TTL | 5 phút |
| ProductSpecsCache TTL | 10 phút, max 10,000 entries |
| Request size limit | 50 MB (để hỗ trợ ảnh base64) |

### Bottleneck chính

1. **LLM latency:** 3–15 giây (phụ thuộc model warmup và tải server)
2. **HF Classification warmup:** Lần gọi đầu sau cold start ~5 giây, sau đó ~1 giây
3. **Gemini Vision:** ~5–15 giây tùy ảnh

### Chiến lược giảm latency

- **Rule-based pre-classifier:** bypass HF API cho ~40% queries (GREETING, SEARCH, COMPARE rõ ràng)
- **KnowledgeCache:** tránh query DB categories/brands mỗi request
- **ProductSpecsCache LRU:** tránh parse HTML nhiều lần
- **Failfast:** `MAX_RETRIES=1`, timeout ngắn → fallback tĩnh

---

## 16. Kiểm thử

### 16.1 Stress test (`tests/chatbot-stress-test.js`)

- **1000+ testcases:** 33 brands × 34 categories + cross-queries + price range + specs
- Kết quả 09/2025: **93.8% pass rate** (360/384 core tests)
- Chạy: `node tests/chatbot-stress-test.js`

### 16.2 Các case quan trọng đã verify

```
✅ "tìm Samsung bán chạy nhất"   → 4 sản phẩm Samsung, sort sold desc
✅ "tìm smartwatch dưới 5 triệu" → cat-watch + price <= 5M
✅ "máy tính gaming tầm 20 triệu" → cat-laptop + price 14M-26M
✅ "tai nghe JBL chống ồn ANC"   → brand JBL + cat-av-bt-earphone
✅ "So sánh iPhone 15 và Galaxy S24" → 2 products, COMPARE_PRODUCT
✅ "chính sách đổi trả"           → ASK_RETURN, policy text, no products
✅ Visual search: ảnh iPhone 12 Pro → category=Điện thoại, brand=Apple
```

---

## 17. Hướng phát triển

1. **Fine-tuned intent classifier:** Train model riêng trên dữ liệu ChatLog của Getshopy → thay thế zero-shot, tăng accuracy và giảm latency
2. **Named tunnel cho Webhook:** Cloudflared named tunnel (domain cố định) thay vì quick tunnel
3. **Streaming LLM response:** Server-Sent Events để user thấy text xuất hiện dần
4. **Redis semantic cache:** Cache response theo vector similarity thay vì exact string match
5. **RAG (Retrieval-Augmented Generation):** Embed product catalog → tìm sản phẩm liên quan bằng vector search

---

*Tài liệu này được tổng hợp từ source code thực tế trong hệ thống KLTN Getshopy. Không chứa credentials hay secret keys.*
