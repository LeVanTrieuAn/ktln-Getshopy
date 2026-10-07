# Service Flow — AI-Rec

> **Phiên bản:** 1.0
> **Ngày:** 2026-10-07
> **Phạm vi:** Mô tả chi tiết luồng hoạt động của service AI-Rec — từ khởi động, vòng đời model, train định kỳ, phục vụ gợi ý, đến xử lý lỗi.

---

## Mục lục

1. [Tổng quan kiến trúc service](#1-tổng-quan-kiến-trúc-service)
2. [Vòng đời khởi động](#2-vòng-đời-khởi-động)
3. [Vòng train định kỳ](#3-vòng-train-định-kỳ)
   - 3.1 [Chuỗi bước train](#31-chuỗi-bước-train)
   - 3.2 [Đổi bản nguyên tử](#32-đổi-bản-nguyên-tử)
   - 3.3 [Tính sẵn cache](#33-tính-sẵn-cache)
4. [Luồng phục vụ gợi ý](#4-luồng-phục-vụ-gợi-ý)
   - 4.1 [API endpoint](#41-api-endpoint)
   - 4.2 [Xử lý 1 request](#42-xử-lý-1-request)
   - 4.3 [Phân luồng theo loại khách](#43-phân-luồng-theo-loại-khách)
5. [Xử lý lỗi và dự phòng](#5-xử-lý-lỗi-và-dự-phòng)
6. [Endpoint Health](#6-endpoint-health)
7. [Tương tác với hệ thống khác](#7-tương-tác-với-hệ-thống-khác)
8. [Cấu hình runtime](#8-cấu-hình-runtime)

---

## 1. Tổng quan kiến trúc service

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         AI-REC SERVICE CONTAINER                              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                     FastAPI Application                              │     │
│  │                                                                      │     │
│  │   GET /health                          ┌─────────────────────────┐  │     │
│  │   GET /api/v1/recommend/customer/{id}  │   CFModelService        │  │     │
│  │                                         │   (singleton)          │  │     │
│  │                                         │                         │  │     │
│  │                                         │   ┌───────────────┐    │  │     │
│  │                                         │   │ ModelBundle   │    │  │     │
│  │                                         │   │ - model       │    │  │     │
│  │                                         │   │ - cache       │    │  │     │
│  │                                         │   │ - stats       │    │  │     │
│  │                                         │   └───────────────┘    │  │     │
│  │                                         │                         │  │     │
│  │                                         │   ┌───────────────┐    │  │     │
│  │                                         │   │ Background    │    │  │     │
│  │                                         │   │ Training Loop │    │  │     │
│  │                                         │   │ (asyncio)     │    │  │     │
│  │                                         │   └───────────────┘    │  │     │
│  │                                         └─────────────────────────┘  │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Các module chính:**

| Module | Vai trò |
|---|---|
| `api/main.py` | FastAPI app, lifespan management, định nghĩa endpoint |
| `api/service.py` | `CFModelService` — singleton giữ model, vòng train nền |
| `api/schemas.py` | Pydantic models cho request/response |
| `data_source/clickhouse.py` | Đọc dữ liệu từ ClickHouse qua HTTP |
| `models/cf_recommendation.py` | Item-based CF |
| `models/content_based.py` | Content-based filtering |
| `models/repeat.py` | Kênh mua lại |
| `models/behavior.py` | Tín hiệu hành vi phụ |
| `models/hybrid.py` | Hybrid recommender (trộn 3 kênh) |
| `config.py` | Đường dẫn, biến môi trường, truy vấn SQL |

---

## 2. Vòng đời khởi động

```
Docker khởi động container
         │
         ▼
main.py → FastAPI app
         │
         ▼
lifespan(app) ─────────────┐
         │                  │
         ▼                  │
service.initialize()        │  (đồng bộ, nhanh)
         │                  │
         ├── Đọc model từ   │
         │   đĩa (joblib)   │
         │                  │
         ▼                  │
ModelBundle {              │
  model: HybridRecommender │
  cache: {}                │
  source: "disk"           │
}                          │
         │                  │
         ▼                  │
start_background_training()│
         │                  │
         ▼                  │
asyncio.create_task(        │
  _training_loop()          │
)                          │
         │                  │
         ▼                  │
yield  ◄───────────────────┘
         │
         ▼
API sẵn sàng nhận request
```

**Chi tiết các bước:**

### 2.1 `service.initialize()`

```python
def initialize(self) -> None:
    if self._bundle is not None:
        return
    
    loaded = self._load_from_disk()
    if loaded is not None:
        self._version += 1
        self._bundle = ModelBundle(
            model=loaded,
            cache={},  # cache dựng lại ở lần train đầu
            source="disk",
            version=self._version,
            stats=loaded.summary(),
        )
```

**Logic `_load_from_disk()`:**

```
Đọc file HYBRID_MODEL_PATH (recommender.joblib)?
         │
    ┌────┴────┐
    │ Có      │ Không
    ▼         ▼
HybridRec.  Đọc MODEL_PATH
.load(path) (item_cf.joblib)?
    │            │
    ▼            │
Trả về ◄───────┴───► Trả về HybridRec(cf, None, params)
    │
    ▼
Nếu cả 2 lỗi → trả về None
         │
         ▼
service phục vụ rỗng cho tới lần train nền đầu tiên
```

**Tại sao không train ở `initialize()`?**
- Train đồng bộ sẽ chặn cổng API
- Healthcheck Docker có timeout → container bị kill giữa chừng
- Vòng train nền lo phần làm mới

### 2.2 `start_background_training()`

```python
async def start_background_training(self) -> None:
    self._task = asyncio.create_task(self._training_loop())

async def _training_loop(self) -> None:
    await asyncio.sleep(TRAIN_INITIAL_DELAY_SECONDS)  # 20s
    while True:
        try:
            await self.train_once()
        except Exception as exc:
            self._last_error = str(exc)
            logger.exception("Chu kỳ train thất bại")
        await asyncio.sleep(TRAIN_INTERVAL_SECONDS)  # 300s
```

**Đặc điểm:**
- **Không bao giờ chết**: lỗi 1 chu kỳ → log + giữ model cũ + chờ chu kỳ sau
- **Chặn chồng lấn**: nếu chu kỳ trước chưa xong, bỏ qua lượt này
- **Delay ban đầu**: 20s sau khi khởi động (chờ CDC + dbt chạy vòng đầu)

---

## 3. Vòng train định kỳ

### 3.1 Chuỗi bước train

```
_train_sync() được gọi bởi asyncio.to_thread()
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ BƯỚC 1: Tải dữ liệu train                                      │
│                                                                  │
│   _load_frame()                                                 │
│     ├── clickhouse.fetch_training_data()                        │
│     │     └── SELECT CustomerID, ProductID, Quantity,           │
│     │           dateDiff('day', LastPurchasedAt, now())         │
│     │         FROM serving.processed_data_for_AI_rec            │
│     │         WHERE Quantity > 0                                │
│     │                                                           │
│     └── Nếu warehouse lỗi → fallback CSV cục bộ                │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ BƯỚC 2: Tải tín hiệu hành vi (nếu bật)                        │
│                                                                  │
│   _load_behavior(behavior_cfg, errors)                          │
│     ├── Nếu CF_BEHAVIOR_MODE == "none" → return None           │
│     └── clickhouse.fetch_behavior()                             │
│           └── SELECT CustomerID, ProductID, Views,              │
│                 DwellSec, Carts, Wishlists, DaysSince            │
│               FROM serving.customer_product_events              │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ BƯỚC 3: Train Item-CF                                          │
│                                                                  │
│   cf = CollaborativeFiltering(model_path=MODEL_PATH)           │
│   cf.fit(df, behavior=behavior, behavior_cfg=behavior_cfg)      │
│     ├── Tạo ma trận mua (sparse CSR)                           │
│     ├── Áp time decay: w = Q × 0.5^(days/half_life)           │
│     ├── Áp thang log: w = log(1 + w)                           │
│     ├── Cộng tín hiệu hành vi (nếu có) → ma trận HỒ SƠ      │
│     ├── Chuẩn hóa L2 vector item                              │
│     └── Tính popular_items (fallback cold-start)               │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ BƯỚC 4: Tải đặc trưng nội dung + onboarding                    │
│                                                                  │
│   _load_content(errors)                                         │
│     ├── clickhouse.fetch_product_features()                     │
│     │     └── SELECT ProductID, ParentCategory, Brand,         │
│     │           PriceBand, UnitsSold, CatalogSold, CellRank    │
│     │         FROM serving.product_features                     │
│     │                                                           │
│     └── clickhouse.fetch_preference_signals()                   │
│           └── SELECT CustomerID, Dimension, Value, Polarity     │
│                 FROM serving.customer_preference_signals       │
│                                                                  │
│   _load_purchase_events(errors)                                  │
│     └── clickhouse.fetch_purchase_events()                      │
│           └── SELECT CustomerID, ProductID,                     │
│                 dateDiff('day', OrderedAt, now())               │
│               FROM serving.purchase_events_for_AI_rec          │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ BƯỚC 5: Dựng Hybrid Recommender                                │
│                                                                  │
│   model = build_recommender(                                    │
│       cf, features, signals, current_params(),                  │
│       onboarding_pseudo_count=CB_ONBOARDING_PSEUDO_COUNT,      │
│       purchase_events=events                                    │
│   )                                                             │
│     ├── ContentBasedModel.fit(...)  # nếu có features          │
│     │     ├── Hồ sơ khách từ CF + onboarding                   │
│     │     └── Tính điểm theo đặc trưng                         │
│     ├── RepeatModel.fit(...)        # nếu có events            │
│     │     └── Tần suất đơn đã decay                            │
│     └── HybridRecommender(cf, cb, params, repeat)              │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ BƯỚC 6: Tính sẵn cache (precompute)                            │
│                                                                  │
│   _precompute(model, PRECOMPUTE_TOP_K, PRECOMPUTE_BUDGET_SECONDS)│
│     ├── Lấy danh sách khách có tín hiệu (đã mua hoặc onboarding)│
│     ├── Với mỗi khách: model.recommend(cid, top_k=20)          │
│     ├── Dừng nếu vượt trần thời gian (60s)                    │
│     └── Trả về dict[customer_id] -> [(product_id, reason)]     │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ BƯỚC 7: Đổi bản nguyên tử + lưu đĩa                          │
│                                                                  │
│   self._bundle = new_bundle  # atomic (Python GIL)              │
│   self._persist(model)                                         │
│     └── model.save(HYBRID_MODEL_PATH)                           │
│           ├── Ghi file tạm .tmp                                │
│           └── os.replace() — atomic rename                     │
└─────────────────────────────────────────────────────────────────┘
```

**Thời gian ước tính cho mỗi chu kỳ:**

| Bước | Thời gian |
|---|---|
| Tải dữ liệu từ ClickHouse | 2–5s |
| Train Item-CF | 5–15s |
| Tải đặc trưng + onboarding | 1–3s |
| Dựng Content-Based + Repeat | 3–10s |
| Precompute cache | 30–60s (giới hạn budget) |
| Lưu model ra đĩa | 1–2s |
| **Tổng** | **~45–90s** |

---

### 3.2 Đổi bản nguyên tử

**Vấn đề:** Nếu model và cache là hai thuộc tính rời, sẽ có khoảnh khắc model đã là v2 còn cache vẫn của v1 — request rơi đúng lúc đó nhận gợi ý trỏ tới sản phẩm không còn trong catalog của model.

**Giải pháp: `ModelBundle`**

```python
@dataclass
class ModelBundle:
    """Một bản train hoàn chỉnh: model + cache gợi ý + số liệu kèm theo."""
    model: HybridRecommender
    cache: dict[str, list[tuple[str, str]]] = field(default_factory=dict)
    trained_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    source: str = "unknown"
    version: int = 0
    stats: dict[str, int] = field(default_factory=dict)
```

**Cơ chế đổi bản:**

```python
# Suốt thời gian train ở trên, bản cũ vẫn trả lời bình thường
previous = self._bundle
self._bundle = new_bundle  # ← ĐIỂM DUY NHẤT bản cũ ngừng phục vụ
del previous
```

Python GIL đảm bảo phép gán này là nguyên tử — không có request nào rơi vào trạng thái lai.

---

### 3.3 Tính sẵn cache

**Mục đích:** Tránh nhân ma trận real-time cho mỗi request.

**Vấn đề:** Ma trận điểm đầy đủ có kích thước (số khách × số sản phẩm). Với 600.000 sản phẩm thì chỉ 1.000 khách đã là 600 triệu ô — không chứa nổi trong bộ nhớ.

**Giải pháp:** Lặp từng khách, mỗi khách chỉ cần hai phép nhân thưa rồi lấy top-K.

```python
def _precompute(model, top_k, budget_s):
    cache = {}
    started = time.monotonic()
    customers = model.known_customers()  # khách đã mua hoặc đã onboarding
    
    for i, customer_id in enumerate(customers):
        if time.monotonic() - started > budget_s:
            break  # quá trần → dừng
        try:
            cache[customer_id] = [(pid, reason) for pid, _, reason 
                                  in model.recommend(customer_id, top_k=top_k)]
        except Exception:
            pass  # 1 khách lỗi không hỏng cả bản train
    
    return cache
```

**Đặc điểm:**
- **Cache là tối ưu, không phải điều kiện đúng đắn**: khách không có trong cache (vừa mua lần đầu) vẫn được tính tại chỗ
- **Có trần thời gian**: quá hạn thì dừng, phần còn lại rơi về tính tại chỗ

---

## 4. Luồng phục vụ gợi ý

### 4.1 API endpoint

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/` | Redirect → `/docs` |
| `GET` | `/health` | Trạng thái service + model |
| `GET` | `/api/v1/recommend/customer/{customer_id}?top_k=10` | Gợi ý top-K cho khách |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/redoc` | ReDoc UI |

**Request:** `GET /api/v1/recommend/customer/CUST_0001?top_k=10`

**Response:**
```json
{
  "customer_id": "CUST_0001",
  "recommendations": [
    {"product_id": "PROD_123", "reason": "cf"},
    {"product_id": "PROD_456", "reason": "content"},
    {"product_id": "PROD_789", "reason": "repeat"}
  ]
}
```

**`reason` values:**

| Giá trị | Giải thích |
|---|---|
| `cf` | Khách giống bạn cũng mua |
| `content` | Hợp danh mục/hãng/tầm giá bạn hay mua hoặc đã chọn |
| `repeat` | Bạn từng mua món này |
| `popular` | Không có tín hiệu riêng — món bán chạy |

---

### 4.2 Xử lý 1 request

```
Client → GET /api/v1/recommend/customer/CUST_0001?top_k=10
         │
         ▼
FastAPI route handler
         │
         ▼
service.recommend_for_customer(customer_id, top_k)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ BƯỚC 1: Chụp bundle hiện tại (atomic)                         │
│                                                                  │
│   bundle = self._bundle  # snapshot 1 lần                       │
│   if bundle is None:                                            │
│       return CustomerRecommendationResponse(                     │
│           customer_id=customer_id,                               │
│           recommendations=[]  # service chưa sẵn sàng           │
│       )                                                          │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ BƯỚC 2: Kiểm tra cache                                         │
│                                                                  │
│   cached = bundle.cache.get(customer_id)                        │
│   if cached is not None and len(cached) >= top_k:               │
│       items = cached[:top_k]                                    │
│   else:                                                          │
│       # Không có trong cache → tính tại chỗ                     │
│       items = [(pid, reason) for pid, _, reason                 │
│                in bundle.model.recommend(customer_id, top_k)]  │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ BƯỚC 3: Trả về response                                        │
│                                                                  │
│   return CustomerRecommendationResponse(                         │
│       customer_id=customer_id,                                  │
│       recommendations=[                                          │
│           RecommendationItem(product_id=p, reason=r)            │
│           for p, r in items                                      │
│       ]                                                          │
│   )                                                              │
└─────────────────────────────────────────────────────────────────┘
```

**Tại sao chụp bundle 1 lần?**
- Đọc `self._bundle` nhiều lần trong cùng request có thể rơi vào hai bản khác nhau nếu vòng train đổi bản ở giữa
- Lúc đó cache của bản này ghép với model của bản kia → lỗi

---

### 4.3 Phân luồng theo loại khách

```
HybridRecommender.recommend(customer_id, top_k)
         │
         ▼
components(customer_id)
         │
         ├── _cf_and_repeat(cid)
         │     ├── Lấy profile matrix của khách
         │     ├── Tính điểm CF: norm · norm[profile.indices] · profile.data
         │     ├── Lấy tập đã mua
         │     └── Lấy điểm repeat (nếu có RepeatModel)
         │
         ├── cb.score(cid) (nếu có ContentBasedModel)
         │     └── cb.X @ cb._profiles[user_pos]
         │
         └── cb.blocked_mask(cid) (nếu có)
               └── Lọc cứng "không quan tâm"
         │
         ▼
rank(components, params, top_k)
         │
         ├── alpha = n_items / (n_items + k)
         ├── final = alpha * cf + (1-alpha) * cb + gamma * repeat
         │
         ├── Lọc: blocked + (purchased nếu !allow_repeat)
         │
         ├── Sắp xếp: lexsort(-final, tiebreak)
         │
         └── Lấy top_k, gán reason theo kênh thắng
```

**Trường hợp đặc biệt:**

| Trường hợp | Xử lý |
|---|---|
| Khách mới (không có tín hiệu) | `profile_items` rỗng → return `popular_items.head(top_k)` |
| Khách mới có onboarding | `cf = 0`, `cb > 0` → dùng thuần content-based |
| Khách nhiều lịch sử | `alpha ≈ 1` → dùng thuần CF cho phần khám phá |
| Món đã mua (allow_repeat=False) | Bị loại khỏi kết quả |
| Món bị "không quan tâm" | Bị loại cứng (blocked mask) |

---

## 5. Xử lý lỗi và dự phòng

### 5.1 Nguyên tắc chung

**Một lỗi nhỏ không được làm hỏng cả hệ thống:**

| Tình huống | Hành vi |
|---|---|
| Warehouse ClickHouse chết | Vòng train lỗi → giữ model cũ → chu kỳ sau thử lại |
| Bảng `product_features` thiếu | Chạy thuần CF (không lọc "không quan tâm") → `/health` báo `content_based=false` |
| Bảng `purchase_events_for_AI_rec` thiếu | Kênh mua lại rơi về cách cũ (trọng số CF) → `/health` báo `repeat_model=false` |
| Bảng `customer_product_events` thiếu | Train thuần theo đơn → `/health` báo `behavior=false` |
| Khách lỗi khi precompute | Bỏ qua khách đó, log debug, tiếp tục |
| Request lỗi | Trả 500 + log, không crash service |

### 5.2 Đường dự phòng (fallback chain)

```
Đầy đủ nguồn:
  Item-CF + Content-Based + Repeat Model (order_freq)
         │
         ▼
Thiếu 1 nguồn:
  ┌──────────────────────────────────────────────────────────────┐
  │ Thiếu product_features → chạy thuần CF                      │
  │ Thiếu purchase_events → kênh mua lại = cf_weight (cũ)       │
  │ Thiếu preference_signals → CB chỉ dùng lịch sử mua         │
  │ Thiếu behavior (đang tắt mặc định) → train thuần theo đơn  │
  └──────────────────────────────────────────────────────────────┘
         │
         ▼
Thiếu warehouse:
  Dùng CSV cục bộ (data/raw/*.csv) — cho thí nghiệm
         │
         ▼
Mất hết:
  Service phục vụ rỗng (recommendations=[]) — /health báo lỗi
```

### 5.3 Vòng train không được chết

```python
async def _training_loop(self) -> None:
    await asyncio.sleep(TRAIN_INITIAL_DELAY_SECONDS)
    while True:
        try:
            await self.train_once()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            # Vòng lặp KHÔNG được chết.
            self._last_error = str(exc)
            logger.exception("Chu kỳ train thất bại, giữ nguyên model đang chạy.")
        await asyncio.sleep(TRAIN_INTERVAL_SECONDS)
```

**Nguyên tắc:** Warehouse sập một lúc thì model cũ vẫn phục vụ, chu kỳ sau thử lại.

### 5.4 Lưu model an toàn

```python
def _persist(self, model):
    try:
        model.save(HYBRID_MODEL_PATH)
    except Exception as exc:
        logger.warning("Không lưu được model ra đĩa: %s", exc)
```

**Tại sao dùng file tạm + rename?**
- `model.save()` trong `HybridRecommender`:

```python
def save(self, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    joblib.dump({...}, tmp, compress=3)
    os.replace(tmp, path)  # atomic rename
    return path
```

- Ghi thẳng đè lên file đang dùng mà tiến trình chết giữa chừng → file `.joblib` cụt
- `os.replace()` là nguyên tử trên cùng hệ thống tệp

---

## 6. Endpoint Health

**Request:** `GET /health`

**Response (khi OK):**
```json
{
  "status": "ok",
  "model_name": "Hybrid: Item-based CF + Content-based + Repeat",
  "model_loaded": true,
  "customers": 1234,
  "products": 78,
  "interactions": 5678,
  "version": "0.4.0",
  "model_version": 42,
  "trained_at": "2026-10-07T06:00:00+00:00",
  "data_source": "clickhouse",
  "cached_customers": 1200,
  "candidates": 6152,
  "onboarded_customers": 56,
  "content_based": true,
  "repeat_model": true,
  "behavior": false,
  "last_error": null
}
```

**Response (khi lỗi):**
```json
{
  "status": "ok",  // service vẫn chạy
  "model_loaded": true,
  ...
  "content_based": false,  // ← thiếu bảng đặc trưng
  "repeat_model": false,    // ← thiếu bảng purchase_events
  "last_error": "Không lấy được đặc trưng sản phẩm: ..."
}
```

**Các flag quan trọng cần monitor:**

| Flag | Ý nghĩa | Hành động nếu sai |
|---|---|---|
| `model_loaded` | Có model đang phục vụ không | Service khởi động chưa xong |
| `content_based` | Có lọc "không quan tâm" + hồ sơ onboarding | Kiểm tra bảng `product_features` |
| `repeat_model` | Kênh mua lại = order_freq | Kiểm tra bảng `purchase_events_for_AI_rec` |
| `behavior` | Ma trận hồ sơ có tín hiệu hành vi | Kiểm tra `CF_BEHAVIOR_MODE` + bảng `customer_product_events` |
| `last_error` | Lỗi gần nhất | Xem log để biết chi tiết |

---

## 7. Tương tác với hệ thống khác

### 7.1 Sơ đồ tổng thể

```
┌──────────────┐   CDC/Kafka    ┌──────────────┐
│   Postgres   │ ─────────────► │     MinIO    │
│   (Ecom)     │                │   (Parquet)  │
└──────────────┘                └──────┬───────┘
                                       │
                                       ▼
┌──────────────┐   HTTP        ┌──────────────┐    dbt    ┌──────────────┐
│  ClickHouse  │ ◄──────────── │  AI-Rec      │ ◄──────── │     dbt      │
│  (serving.*) │               │  (container) │           │  (transform) │
└──────────────┘               └──────┬───────┘           └──────────────┘
                                       │
                                       │ REST API
                                       ▼
                                ┌──────────────┐
                                │  Server Node │
                                │  (Ecom web)  │
                                └──────────────┘
```

### 7.2 Giao tiếp với ClickHouse

**Giao thức:** HTTP POST với body là SQL query

```python
response = httpx.post(
    f"{CLICKHOUSE_URL}/",
    content=sql.encode("utf-8"),
    headers={
        "X-ClickHouse-User": CLICKHOUSE_USER,
        "X-ClickHouse-Key": CLICKHOUSE_PASSWORD,
    },
    timeout=CLICKHOUSE_TIMEOUT_SECONDS,  # 120s
)
```

**Các truy vấn:**

| Query | Mục đích |
|---|---|
| `TRAINING_QUERY` | Lấy tập train cho CF |
| `PRODUCT_FEATURES_QUERY` | Lấy đặc trưng sản phẩm |
| `PURCHASE_EVENTS_QUERY` | Lấy lịch sử mua theo đơn |
| `PREFERENCE_SIGNALS_QUERY` | Lấy sở thích onboarding |
| `BEHAVIOR_QUERY` | Lấy tín hiệu hành vi (nếu bật) |

**Tài khoản `ai_rec`:** Chỉ có quyền `SELECT` trên database `serving`.

### 7.3 Giao tiếp với Server Node (Ecom)

**Giao thức:** REST API

**Request từ Server:**
```
GET /api/v1/recommend/customer/{customer_id}?top_k=10
Authorization: <token khách hàng>
```

**Response:**
```json
{
  "customer_id": "CUST_0001",
  "recommendations": [
    {"product_id": "PROD_123", "reason": "cf"},
    ...
  ]
}
```

**Server Node sử dụng:**
- Trang chủ: "Dành riêng cho bạn" (8 ô)
- Trang sản phẩm: "Khách hàng mua cùng cũng mua"
- Trang lịch sử đơn: "Có thể bạn muốn mua lại"

### 7.4 Dockerfile và triển khai

Service được triển khai qua Docker Compose trong repo gốc (`local-infra-sandbox` hoặc `ktln-Getshopy`).

**Cấu trúc container:**
- Base: Python 3.x
- Dependencies: từ `ai_recommendation_system.egg-info/requires.txt`
- Entrypoint: `uvicorn api.main:app --host 0.0.0.0 --port 8000`

---

## 8. Cấu hình runtime

### 8.1 Biến môi trường

| Biến | Mặc định | Mô tả |
|---|---|---|
| `CLICKHOUSE_URL` | `""` | URL HTTP của ClickHouse (vd: `http://clickhouse:8123`) |
| `CLICKHOUSE_USER` | `ai_rec` | Tài khoản đọc dữ liệu |
| `CLICKHOUSE_PASSWORD` | `""` | Mật khẩu (đặt trong `.env`, KHÔNG ghi vào code) |
| `RECENCY_HALF_LIFE_DAYS` | `7` | Half-life time decay; `0` = tắt |
| `CF_INPUT_SCALE` | `log` | `linear` \| `log` |
| `REPEAT_SCORE` | `order_freq` | `order_freq` \| `cf_weight` |
| `HYBRID_CF_SHRINK_K` | `0` | Trọng số co rút CF |
| `HYBRID_REPEAT_WEIGHT` | `1` | Trọng số kênh mua lại (γ) |
| `HYBRID_ALLOW_REPEAT` | `1` | Cho phép gợi ý món đã mua |
| `CF_BEHAVIOR_MODE` | `none` | `none` \| `count` \| `dwell` \| `dwell+cart` |
| `CF_BEHAVIOR_VIEW_WEIGHT` | `0.5` | Trọng số lượt xem |
| `CF_BEHAVIOR_CART_WEIGHT` | `1` | Trọng số thêm giỏ |
| `CF_BEHAVIOR_WISH_WEIGHT` | `0.5` | Trọng số yêu thích |
| `CB_ONBOARDING_PSEUDO_COUNT` | `1` | 1 lựa chọn onboarding = bấy nhiêu lần mua |
| `TRAIN_INTERVAL_SECONDS` | `300` | Chu kỳ train (5 phút) |
| `TRAIN_INITIAL_DELAY_SECONDS` | `20` | Delay trước lần train đầu |
| `CLICKHOUSE_TIMEOUT_SECONDS` | `120` | Timeout khi gọi ClickHouse |
| `PRECOMPUTE_ENABLED` | `1` | Có tính sẵn cache không |
| `PRECOMPUTE_TOP_K` | `20` | Số gợi ý tính sẵn mỗi khách |
| `PRECOMPUTE_BUDGET_SECONDS` | `60` | Trần thời gian tính sẵn |

### 8.2 Tham số tại thời điểm chạy

| Tham số | Giá trị hiện tại | Được chọn từ |
|---|---|---|
| `half_life` | 7 ngày | Validation (01/10/2026) |
| `input_scale` | log | Validation |
| `repeat` | order_freq | Validation |
| `k` (cf_shrink_k) | 0 | Validation |
| `γ` (repeat_weight) | 1.0 | Validation |
| `allow_repeat` | True | Quyết định sản phẩm |
| `behavior` | none | Tắt (chờ dữ liệu thật) |

### 8.3 Đổi tham số không cần train lại

Một số tham số trộn (`k`, `γ`, `allow_repeat`) đọc từ `config.py` lúc khởi động → đổi biến môi trường + restart là có hiệu lực:

```python
@staticmethod
def _load_from_disk() -> HybridRecommender | None:
    """Tham số trộn lấy theo config HIỆN TẠI chứ không theo file."""
    for path in (HYBRID_MODEL_PATH, MODEL_PATH):
        ...
        if path == HYBRID_MODEL_PATH:
            old = HybridRecommender.load(path)
            return HybridRecommender(old.cf, old.cb, current_params(),
                                     getattr(old, "repeat", None))
```

---

## Phụ lục

### A. Timeline một phiên sử dụng

```
T+0s:     Khách CUST_0001 truy cập trang chủ
T+0.1s:   Server Node gọi GET /api/v1/recommend/customer/CUST_0001?top_k=8
T+0.1s:   FastAPI nhận request → CFModelService.recommend_for_customer()
T+0.11s:  Tìm trong cache → CÓ (đã precompute ở train trước)
T+0.12s:  Trả về 8 recommendations
T+0.5s:   Server Node render UI "Dành riêng cho bạn"
T+5s:     Khách click vào 1 sản phẩm
T+5.1s:   Server ghi event "product_view" vào analytics.user_events
          (KHÔNG ảnh hưởng real-time — chờ dbt chạy + train cycle tiếp theo)
T+300s:   Vòng train tiếp theo → đọc event mới (nếu có) → train lại
```

### B. Timeline một chu kỳ train

```
T+0s:     Vòng train nền bắt đầu (sau 20s khởi động hoặc 5 phút chu kỳ trước)
T+0.5s:   asyncio.to_thread(self._train_sync) — chạy trong thread riêng
T+1s:     _load_frame() — HTTP GET ClickHouse → nhận 4M dòng
T+5s:     cf.fit() — tạo ma trận thưa, chuẩn hóa
T+10s:    _load_content() + _load_purchase_events() — 3 HTTP GET
T+15s:    build_recommender() — fit CB + Repeat
T+20s:    _precompute() — lặp từng khách, tính top-20
T+80s:    Precompute xong (hoặc hết budget)
T+81s:    self._bundle = new_bundle  ← atomic swap
T+82s:    model.save() — ghi file .joblib
T+83s:    Vòng train kết thúc → sleep 300s
```

### C. Tài liệu liên quan

- [`domain.md`](./domain.md) — Mô tả domain tổng thể
- [`../README.md`](../README.md) — README chính
- [`../evaluation/README.md`](../evaluation/README.md) — Giao thức đánh giá
- [`../../../local-infra-sandbox/docs/serving-schema.md`](../../../local-infra-sandbox/docs/serving-schema.md) — Schema `serving`
