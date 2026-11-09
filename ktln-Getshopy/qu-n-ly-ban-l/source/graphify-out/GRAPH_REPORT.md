# Graph Report - source  (2026-09-26)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1421 nodes · 2416 edges · 90 communities (78 shown, 12 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 222 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f079ec3a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- aiHandlers.js
- src/index.js
- BehaviorService.js
- HeroBanner3D.jsx
- SparseUserItemMatrix
- benchmark_perf.js
- chatbot-stress-test.js
- CFModelService
- client/package.json
- ai-bot/src/services/KnowledgeCache.js
- dependencies
- server/src/services/KnowledgeCache.js
- ThemedRouter.jsx
- App.jsx
- ProductDetail.jsx
- ref_express
- benchmark_frontend.js
- server/src/db.js
- service.py
- react
- server/package.json
- CollaborativeFiltering
- ai-bot/src/services/SearchService.js
- Dashboard.jsx
- benchmark_ai.py
- server/src/services/SearchService.js
- cf_recommendation.py
- train_mlops.py
- sepay.js
- ai-bot/src/services/ProductSpecsCache.js
- dependencies
- server/src/services/ProductSpecsCache.js
- ai-bot/package.json
- seed_50k_products.py
- checkoutService.js
- ai-bot/src/services/ChatbotService.js
- payment.js
- server/src/services/ChatbotService.js
- webhookService.js
- ProductList.jsx
- b2b.js
- RecommendationService.js
- orderLifecycle.js
- ModelBundle
- b2c.js
- Home.jsx
- seed-demo.js
- seed-categories.js
- ai-rec/main.py
- fix_categories.js
- inventoryService.js
- ai-bot/src/ai/huggingface.js
- RecommendationAPITests
- seed-products-inventory.js
- ref_prisma_client
- benchmark-products.js
- seed.js
- ai-bot/src/redis.js
- compress-glb.cjs
- compress-texture.cjs
- BehaviorAnalytics.jsx
- ChatbotManagement.jsx
- AppContext.jsx
- server/src/ai/huggingface.js
- pricingService.js
- dependencies
- ai-bot/src/ai/llm.js
- DataLakeDemo.jsx
- devDependencies
- .oxlintrc.json
- specsGenerator.js
- products.perf.test.js
- scripts
- rng.js
- generateChatResponse
- vietqr.js
- ai-bot/src/db.js
- ref_fs
- scripts
- ai-bot/docker-entrypoint.sh
- brandCatLabel
- makeId
- api/__init__.py
- tests/__init__.py
- compress-texture-wsl.sh
- server/docker-entrypoint.sh
- simulate-payment.sh
- ai-recommendation-system

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 48 edges
2. `CollaborativeFiltering` - 35 edges
3. `react` - 34 edges
4. `antd` - 29 edges
5. `CFModelService` - 25 edges
6. `api` - 24 edges
7. `@ant-design/icons` - 22 edges
8. `removeDiacritics()` - 21 edges
9. `pick()` - 20 edges
10. `removeDiacritics()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `CFModelService` --uses--> `CollaborativeFiltering`  [INFERRED]
  ai-rec/api/service.py → ai-rec/models/cf_recommendation.py
- `ModelBundle` --uses--> `CollaborativeFiltering`  [INFERRED]
  ai-rec/api/service.py → ai-rec/models/cf_recommendation.py
- `_precompute()` --uses--> `CollaborativeFiltering`  [INFERRED]
  ai-rec/api/service.py → ai-rec/models/cf_recommendation.py
- `RecommendationPipelineTests` --uses--> `CollaborativeFiltering`  [INFERRED]
  ai-rec/tests/test_recommender.py → ai-rec/models/cf_recommendation.py
- `RecommendationAPITests` --uses--> `CFModelService`  [INFERRED]
  ai-rec/tests/test_api.py → ai-rec/api/service.py

## Import Cycles
- None detected.

## Communities (90 total, 12 thin omitted)

### Community 0 - "aiHandlers.js"
Cohesion: 0.05
Nodes (70): ASK_DELIVERY_EXT, ASK_GIFT_EXT, ASK_PAYMENT_EXT, ASK_PROMO_EXT, ASK_RETURN_EXT, calcDiscount(), CANCEL_ORDER_EXT, CHANGE_PRODUCT_EXT (+62 more)

### Community 1 - "src/index.js"
Cohesion: 0.05
Nodes (38): aiAdminRouter, ANALYTICS_CACHE_PATTERNS, app, { authB2C }, b2bRouter, b2cRouter, bcrypt, behaviorAnalyticsRouter (+30 more)

### Community 2 - "BehaviorService.js"
Cohesion: 0.06
Nodes (38): @clickhouse/client, ch, { createClient }, DEVICE_TYPES, EVENTS_PER_SESSION, formatDateTime(), main(), PAGE_SOURCES (+30 more)

### Community 3 - "HeroBanner3D.jsx"
Cohesion: 0.06
Nodes (34): client_src_assets_hero_bg_light, client_src_assets_meshy_ai_create_a_clean_reali_0814034508_texture, client_src_assets_meshy_ai_create_a_highly_detai_0814020033_texture, client_src_assets_meshy_ai_create_a_highly_detai_0814022556_texture, client_src_assets_meshy_ai_create_a_highly_detai_0814023145_texture, client_src_assets_meshy_ai_create_a_highly_detai_0814024521_texture, DEFAULT_ROTATION, disposeObject() (+26 more)

### Community 4 - "SparseUserItemMatrix"
Cohesion: 0.07
Nodes (14): ItemSimilarityMatrix, _LocIndexer, Item cosine similarity matrix computed on-the-fly via normalized sparse…, Compute item scores: sum(w_p * sim(:, p)) across purchased items., Memory-efficient sparse user-item interaction matrix with DataFrame-like…, Return a list of ProductIDs that the customer has interacted with., Extract interaction weights (e.g. quantity) for specified products., _SimilarityColumnSelector (+6 more)

### Community 5 - "benchmark_perf.js"
Cohesion: 0.08
Nodes (33): ref_http, ref_net, ref_perf_hooks, API_HOST, API_PORT, args, bench_api_endpoint(), bench_db_insert() (+25 more)

### Community 6 - "chatbot-stress-test.js"
Cohesion: 0.06
Nodes (30): ALL_TEST_CASES, args, BASE_URL, BRAND_CAT_PAIRS, BRANDS, BUDGET_COMBOS, CATEGORIES, COMPARE_PAIRS (+22 more)

### Community 7 - "CFModelService"
Cohesion: 0.09
Nodes (25): healthcheck(), lifespan(), FastAPI Application for AI Ecommerce Recommendation Service., Nạp model đã lưu rồi bật vòng train nền. initialize() chỉ đọc file trên đĩa nên…, Redirect root path to interactive Swagger documentation., recommend_for_customer(), root_redirect(), CustomerRecommendationResponse (+17 more)

### Community 8 - "client/package.json"
Cohesion: 0.07
Nodes (26): name, private, type, version, Account, App(), homeIcon, OrderTrackingMap() (+18 more)

### Community 9 - "ai-bot/src/services/KnowledgeCache.js"
Cohesion: 0.08
Nodes (22): removeDiacritics(), BRAND_KEYWORD_ALIASES, _brandAliases, _brandMap, _brands, _categories, CATEGORY_KEYWORD_TO_ID, _categoryMap (+14 more)

### Community 10 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, @ant-design/icons, @ant-design/v5-patch-for-react-19, antd, dayjs, echarts, echarts-for-react, gsap (+24 more)

### Community 11 - "server/src/services/KnowledgeCache.js"
Cohesion: 0.08
Nodes (22): removeDiacritics(), BRAND_KEYWORD_ALIASES, _brandAliases, _brandMap, _brands, _categories, CATEGORY_KEYWORD_TO_ID, _categoryMap (+14 more)

### Community 12 - "ThemedRouter.jsx"
Cohesion: 0.09
Nodes (19): Alerts, Financial, Fulfillment, GeneralManagement, Alerts(), Financial(), Fulfillment(), cityOptions (+11 more)

### Community 13 - "App.jsx"
Cohesion: 0.16
Nodes (20): About, Compare, ProtectedRoute(), queryClient, styleCache, ThemeWrapper(), AIChatbot(), renderMarkdown() (+12 more)

### Community 14 - "ProductDetail.jsx"
Cohesion: 0.14
Nodes (23): ProductDetail, _buffer, _flushEvents(), getCustomerId(), getDeviceType(), getSessionId(), _scheduleFlush(), useProductViewTracker() (+15 more)

### Community 15 - "ref_express"
Cohesion: 0.08
Nodes (21): app, chatbotRouter, cors, express, morgan, searchRouter, ChatbotService, express (+13 more)

### Community 16 - "benchmark_frontend.js"
Cohesion: 0.15
Nodes (24): analyzeBundleSize(), analyzeGLBFiles(), args, average(), BASE_URL, BOLD(), checkLighthouse(), CYAN() (+16 more)

### Community 17 - "server/src/db.js"
Cohesion: 0.09
Nodes (16): prisma, { PrismaClient }, express, { prisma }, router, ch, { createClient }, express (+8 more)

### Community 18 - "service.py"
Cohesion: 0.11
Nodes (19): Vòng đời model Collaborative Filtering: train định kỳ, cache, phục vụ., Centralized paths and runtime defaults for the project., ClickHouseUnavailable, fetch_training_data(), is_configured(), DataFrame, Đọc dữ liệu train từ warehouse ClickHouse qua HTTP interface., Không lấy được dữ liệu từ warehouse ở lần thử này. (+11 more)

### Community 19 - "react"
Cohesion: 0.14
Nodes (16): Checkout, Reconciliation, Reviews, money(), PaymentQueue(), STATUS_META, PaymentQRModal(), DefaultIcon (+8 more)

### Community 20 - "server/package.json"
Cohesion: 0.08
Nodes (23): axios, cheerio, express-rate-limit, http-proxy-middleware, @huggingface/inference, lowdb, multer, opossum (+15 more)

### Community 21 - "CollaborativeFiltering"
Cohesion: 0.16
Nodes (5): CollaborativeFiltering, DataFrame, Recommend unseen products from item-item cosine similarity., Return whether a product exists in the model's training catalog., Path

### Community 22 - "ai-bot/src/services/SearchService.js"
Cohesion: 0.14
Nodes (18): analyzeProductImage(), GEMINI_MODELS, parseDataUrl(), sleep(), STORE_BRANDS, STORE_CATEGORIES, { analyzeProductImage }, buildCategoryFilter() (+10 more)

### Community 23 - "Dashboard.jsx"
Cohesion: 0.17
Nodes (16): AppLayout, Dashboard, Login, AppLayout(), NAV_ITEMS, cityOptions, Dashboard(), fmtVND() (+8 more)

### Community 24 - "benchmark_ai.py"
Cohesion: 0.12
Nodes (19): re, benchmark_intent(), benchmark_llm(), benchmark_vision(), http_post(), pre_classify(), ============================================================ BENCHMARK AI —…, POST JSON bằng urllib thuần, trả về (status_code, response_dict) (+11 more)

### Community 25 - "server/src/services/SearchService.js"
Cohesion: 0.15
Nodes (17): analyzeProductImage(), parseDataUrl(), sleep(), STORE_BRANDS, STORE_CATEGORIES, { analyzeProductImage }, buildCategoryFilter(), extractPriceFromQuery() (+9 more)

### Community 26 - "cf_recommendation.py"
Cohesion: 0.13
Nodes (13): Item-based collaborative filtering with reproducible model persistence and…, Recommendation Models Package, DataFrame, RecommendationPipelineTests, sample_transactions(), joblib, numpy, pathlib (+5 more)

### Community 27 - "train_mlops.py"
Cohesion: 0.12
Nodes (17): datasets, json, compute_metrics(), get_demo_dataset(), load_dataset_from_file(), push_to_hub(), ============================================================ MLOps Fine-tuning…, Tính accuracy và F1-score sau mỗi epoch (+9 more)

### Community 28 - "sepay.js"
Cohesion: 0.13
Nodes (13): ref_crypto, getProvider(), PROVIDERS, sepay, simulator, crypto, parse(), pick() (+5 more)

### Community 29 - "ai-bot/src/services/ProductSpecsCache.js"
Cohesion: 0.17
Nodes (15): _accessOrder, _cache, CATEGORY_SPEC_TEMPLATES, _evictIfNeeded(), formatSpecsForLLM(), generateSpecsFromName(), getMultipleSpecs(), getProductSpecs() (+7 more)

### Community 30 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, bcryptjs, @clickhouse/client, cors, express, express-rate-limit, google-auth-library, http-proxy-middleware (+10 more)

### Community 31 - "server/src/services/ProductSpecsCache.js"
Cohesion: 0.17
Nodes (15): _accessOrder, _cache, CATEGORY_SPEC_TEMPLATES, _evictIfNeeded(), formatSpecsForLLM(), generateSpecsFromName(), getMultipleSpecs(), getProductSpecs() (+7 more)

### Community 32 - "ai-bot/package.json"
Cohesion: 0.12
Nodes (16): description, devDependencies, nodemon, prisma, cors, express, jsonwebtoken, morgan (+8 more)

### Community 33 - "seed_50k_products.py"
Cohesion: 0.13
Nodes (15): datetime, random, benchmark_pagination(), cleanup_via_psycopg2(), generate_product(), ============================================================ SEED 50K PRODUCTS…, Seed dùng psycopg2 trực tiếp vào PostgreSQL, Xóa tất cả sản phẩm có tên bắt đầu bằng [BENCH] (+7 more)

### Community 34 - "checkoutService.js"
Cohesion: 0.16
Nodes (15): qrcode, bankNameByBin(), BANKS, { bankNameByBin }, buildQR(), buildTransferContent(), { buildVietQRPayload }, createOrder() (+7 more)

### Community 35 - "ai-bot/src/services/ChatbotService.js"
Cohesion: 0.18
Nodes (15): buildContext(), chat(), CHATBOT_SELECT, { classifyIntent, removeDiacritics }, extractKeywordsFromHistory(), fallbackResponse(), fmt(), FOLLOWUP_PATTERNS (+7 more)

### Community 36 - "payment.js"
Cohesion: 0.14
Nodes (12): ref_jsonwebtoken, authB2C(), jwt, { authB2C }, express, { getProvider }, lifecycle, prisma (+4 more)

### Community 37 - "server/src/services/ChatbotService.js"
Cohesion: 0.18
Nodes (15): buildContext(), chat(), CHATBOT_SELECT, { classifyIntent, removeDiacritics }, extractKeywordsFromHistory(), fallbackResponse(), fmt(), FOLLOWUP_PATTERNS (+7 more)

### Community 38 - "webhookService.js"
Cohesion: 0.23
Nodes (14): checksumChar(), crypto, extractPaymentRefs(), generatePaymentRef(), isValidPaymentRef(), normalizeContent(), applyPayment(), { extractPaymentRefs, normalizeContent } (+6 more)

### Community 39 - "ProductList.jsx"
Cohesion: 0.20
Nodes (10): ProductList, useCart(), Checkout(), CAT_ICON_MAP, FALLBACK_BY_CAT, getFallback(), getSafeImageUrl(), ProductCard() (+2 more)

### Community 40 - "b2b.js"
Cohesion: 0.18
Nodes (11): cached(), { createClient }, invalidate(), memCache, memGet(), memSet(), express, { invalidate } (+3 more)

### Community 41 - "RecommendationService.js"
Cohesion: 0.20
Nodes (12): express, RecommendationService, router, applyFlashSaleToProduct(), BS, fetchAIRecRecommendations(), getActiveFlashSaleItems(), getRecommendations() (+4 more)

### Community 42 - "orderLifecycle.js"
Cohesion: 0.21
Nodes (8): { expireOverdueOrders }, runOnce(), start(), cancelOrder(), expireOrder(), expireOverdueOrders(), inventory, { syncProductStock }

### Community 43 - "ModelBundle"
Cohesion: 0.17
Nodes (8): ModelBundle, _precompute(), DataFrame, Nạp nhanh model đã lưu trên đĩa để phục vụ được ngay. Không train ở đây: train…, Ưu tiên warehouse, rơi về CSV cục bộ nếu chưa cấu hình ClickHouse., Ghi model ra đĩa để lần khởi động sau phục vụ được ngay. Ghi ra file tạm rồi…, Một bản train hoàn chỉnh: model + cache gợi ý + số liệu kèm theo. Gói chung vào…, Tính sẵn top-K cho mọi khách đã có lịch sử mua. Vì sao lặp từng khách chứ không…

### Community 44 - "b2c.js"
Cohesion: 0.17
Nodes (9): google-auth-library, { authB2C }, bcrypt, { cached }, express, jwt, { OAuth2Client }, { prisma } (+1 more)

### Community 45 - "Home.jsx"
Cohesion: 0.18
Nodes (8): client_src_assets_computer, client_src_assets_ipad_pro_2024, client_src_assets_iphone13promax, client_src_assets_power_adapterr, client_src_assets_smartwatch, CATEGORY_CARDS, CATEGORY_FBX, Home()

### Community 46 - "seed-demo.js"
Cohesion: 0.20
Nodes (10): bcryptjs, seedBaseDate(), bcrypt, main(), prisma, { PrismaClient }, { seedBaseDate }, TIERS (+2 more)

### Community 47 - "seed-categories.js"
Cohesion: 0.22
Nodes (10): ALL_NEW_CHILD_IDS, CHILD_CATEGORIES, { createRng }, main(), OLD_TO_NEW_MAP, PARENT_CATEGORIES, prisma, { PrismaClient } (+2 more)

### Community 48 - "ai-rec/main.py"
Cohesion: 0.27
Nodes (9): display_customer_recommendations(), display_invoice_recommendations(), main(), print_header(), Command-line entry point for querying recommendations by customer ID…, Hiển thị gợi ý sản phẩm cho một Customer ID cụ thể kèm lịch sử mua hàng và tên…, Tra cứu đơn hàng và hiển thị thông tin kèm gợi ý sản phẩm từ mô hình AI., argparse (+1 more)

### Community 49 - "fix_categories.js"
Cohesion: 0.22
Nodes (6): e(), detectCategory(), main(), NAME_TO_CAT, p, { PrismaClient }

### Community 50 - "inventoryService.js"
Cohesion: 0.31
Nodes (6): commitReservations(), key(), OutOfStockError, reserveStock(), sortLines(), syncProductStock()

### Community 51 - "ai-bot/src/ai/huggingface.js"
Cohesion: 0.31
Nodes (8): _cache, cacheGet(), cacheSet(), CLASSIFICATION_MODELS, classifyIntent(), CONFIDENCE_THRESHOLD, INTENT_LABELS, preClassify()

### Community 52 - "RecommendationAPITests"
Cohesion: 0.22
Nodes (5): Test suite for verifying API endpoints and recommendation responses., Verify the health endpoint returns 200 and model metadata., Verify recommendations for an active customer with purchase history., Verify cold-start fallback generates popular items for unknown customers., RecommendationAPITests

### Community 53 - "seed-products-inventory.js"
Cohesion: 0.25
Nodes (8): ref_path, fs, main(), parseJson(), path, prisma, { PrismaClient }, SRC

### Community 54 - "ref_prisma_client"
Cohesion: 0.22
Nodes (6): ref_prisma_client, p, { PrismaClient }, NEW_BRANDS, prisma, { PrismaClient }

### Community 55 - "benchmark-products.js"
Cohesion: 0.36
Nodes (8): main(), newDbLevelPagination(), oldFetchAllThenSlice(), percentile(), prisma, { PrismaClient }, run(), summarize()

### Community 56 - "seed.js"
Cohesion: 0.22
Nodes (7): dbPath, defaultData, fs, path, prisma, { PrismaClient }, { seedBaseDate }

### Community 57 - "ai-bot/src/redis.js"
Cohesion: 0.32
Nodes (6): cached(), { createClient }, memCache, memGet(), memSet(), ref_redis

### Community 58 - "compress-glb.cjs"
Cohesion: 0.25
Nodes (6): ASSETS_DIR, { execSync }, fs, GLB_FILES, path, ref_child_process

### Community 59 - "compress-texture.cjs"
Cohesion: 0.25
Nodes (6): ASSETS_DIR, { execSync, spawnSync }, fs, GLB_FILES, gtCheck, path

### Community 60 - "BehaviorAnalytics.jsx"
Cohesion: 0.32
Nodes (6): BehaviorAnalytics, BehaviorAnalytics(), fmtNum(), FunnelStage(), BehaviorAnalytics, echarts-for-react

### Community 61 - "ChatbotManagement.jsx"
Cohesion: 0.32
Nodes (7): ChatbotManagement, ChatbotManagement(), getIntentColor(), INTENT_COLOR, INTENT_OPTIONS, ScoreBadge(), scoreToPercent()

### Community 62 - "AppContext.jsx"
Cohesion: 0.32
Nodes (5): AppContext, AppProvider(), translations, en, vi

### Community 63 - "server/src/ai/huggingface.js"
Cohesion: 0.36
Nodes (7): _cache, cacheGet(), cacheSet(), classifyIntent(), CONFIDENCE_THRESHOLD, INTENT_LABELS, preClassify()

### Community 64 - "pricingService.js"
Cohesion: 0.46
Nodes (6): calcShippingFee(), findVariant(), priceOrder(), PricingError, resolveUnitPrice(), SHIPPING_FEE

### Community 65 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, cors, express, jsonwebtoken, morgan, @prisma/client, redis

### Community 66 - "ai-bot/src/ai/llm.js"
Cohesion: 0.48
Nodes (6): buildSystemPrompt(), containsChinese(), fmt(), generateChatResponse(), LLM_MODELS, sleep()

### Community 67 - "DataLakeDemo.jsx"
Cohesion: 0.33
Nodes (6): DataLakeDemo, DataLakeDemo(), fetchOrders(), DataLakeDemo, @tanstack/react-query, @tanstack/react-virtual

### Community 68 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, axios, cheerio, nodemon, pg, prisma, puppeteer-core

### Community 69 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 70 - "specsGenerator.js"
Cohesion: 0.67
Nodes (5): brandOrigin(), generateSpecs(), pick(), rng(), seed()

### Community 71 - "products.perf.test.js"
Cohesion: 0.33
Nodes (4): ref_node_assert, ref_node_test, assert, test

### Community 72 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, dev, seed, seed:mock, test, test:perf

### Community 73 - "rng.js"
Cohesion: 0.53
Nodes (4): createRng(), mulberry32(), xmur3(), main()

### Community 74 - "generateChatResponse"
Cohesion: 0.60
Nodes (5): buildSystemPrompt(), containsChinese(), fmt(), generateChatResponse(), sleep()

### Community 75 - "vietqr.js"
Cohesion: 0.53
Nodes (4): buildVietQRPayload(), crc16(), tlv(), verifyPayload()

### Community 77 - "ref_fs"
Cohesion: 0.40
Nodes (5): generateReport(), main(), runBatch(), runTest(), ref_fs

### Community 78 - "scripts"
Cohesion: 0.67
Nodes (3): scripts, dev, start

## Knowledge Gaps
- **483 isolated node(s):** `ASK_DELIVERY_EXT`, `ASK_GIFT_EXT`, `ASK_PAYMENT_EXT`, `ASK_PROMO_EXT`, `ASK_RETURN_EXT` (+478 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 730 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `main()` connect `ref_fs` to `chatbot-stress-test.js`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `bcryptjs` connect `seed-demo.js` to `src/index.js`, `server/package.json`, `b2c.js`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `@clickhouse/client` connect `BehaviorService.js` to `src/index.js`, `server/package.json`, `server/src/db.js`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `CollaborativeFiltering` (e.g. with `CFModelService` and `ModelBundle`) actually correct?**
  _`CollaborativeFiltering` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `CFModelService` (e.g. with `healthcheck()` and `lifespan()`) actually correct?**
  _`CFModelService` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ASK_DELIVERY_EXT`, `ASK_GIFT_EXT`, `ASK_PAYMENT_EXT` to the rest of the system?**
  _483 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `aiHandlers.js` be split into smaller, more focused modules?**
  _Cohesion score 0.054746835443037975 - nodes in this community are weakly interconnected._