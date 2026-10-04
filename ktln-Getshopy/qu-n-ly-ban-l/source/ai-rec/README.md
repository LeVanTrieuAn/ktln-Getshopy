# AI-Rec — hệ gợi ý sản phẩm của GetShopy

Hybrid có trọng số gồm Item-based CF, content-based và kênh mua lại. Hỗ trợ thêm tín hiệu
hành vi phụ (tuỳ chọn). Dữ liệu đọc từ warehouse ClickHouse (schema `serving`); mô hình train
lại mỗi 5 phút và phục vụ qua FastAPI.

- Đánh giá (giao thức, kết quả, hạn chế): [`evaluation/README.md`](evaluation/README.md)
- Báo cáo hiện trạng: [`doc/result-sep30.md`](doc/result-sep30.md)
- Hợp đồng dữ liệu với warehouse: `docs/implement-phase/implement-plan/data-contract-warehouse.md` §4

> README bản trước (tới 13/09) mô tả CF thuần đọc `data/raw/*.csv`. Các con số trong đó
> (600.000 × 50.000, "~18 MB", "~7 ms") thuộc bộ CSV cũ — không dùng cho hệ hiện tại.

## Luồng dữ liệu

```
Postgres (Ecom) ──CDC Debezium/Kafka──▶ MinIO (parquet) ──▶ ClickHouse ──dbt──▶ serving.*
analytics.user_events (server Node ghi thẳng) ────────────────────────dbt──▶ serving.customer_product_events
                                                                                 │ HTTP, tài khoản ai_rec
                                                                                 ▼ (chỉ SELECT serving)
                     AI-Rec: fit CF → content-based → kênh mua lại → hybrid → tính sẵn top-20
                                                                                 │ GET /api/v1/recommend/…
                                                                                 ▼
                     Server Node (danh tính từ token) ──▶ trang chủ "Dành riêng cho bạn" (8 ô)
```

| Bảng `serving` | Dùng cho |
|---|---|
| `processed_data_for_AI_rec` (view) | Ma trận mua của CF — cặp (khách, món), tổng số lượng, lần mua cuối; món ≥ 3 người mua |
| `purchase_events_for_AI_rec` | Kênh mua lại — một dòng cho mỗi (khách, món, đơn) |
| `product_features` | Content-based — danh mục gốc, hãng, tầm giá của 6.152 ứng viên |
| `customer_preference_signals` | Onboarding — thích / "không quan tâm" (lọc cứng) |
| `customer_product_events` | Tín hiệu hành vi phụ (tắt mặc định) |

## Mô hình

```
final(u,i) = α_u · ĉf(u,i) + (1 − α_u) · ĉb(u,i) + γ · rêp(u,i),     α_u = n_u / (n_u + k)
```

| Thành phần | Chi tiết | Code |
|---|---|---|
| Item-CF (Sarwar et al., 2001) | Cosine trên ma trận hồ sơ, trọng số `Quantity · 0,5^(ngày/half-life)`, thang log (Hu et al., 2008) | `models/cf_recommendation.py` |
| Content-based (Pazzani & Billsus, 2007) | Hồ sơ phân phối trên danh mục/hãng/tầm giá từ lịch sử mua + onboarding | `models/content_based.py` |
| Kênh mua lại (Anderson et al., 2014; Bhagat et al., 2018) | Tần suất đơn đã giảm theo thời gian | `models/repeat.py` |
| Tín hiệu hành vi phụ (Gao et al., 2019; Yi et al., 2014) | Xem / dwell / giỏ / yêu thích cộng vào ma trận HỒ SƠ; tập "đã mua" vẫn chỉ từ đơn | `models/behavior.py` |
| Trộn (Burke, 2002) | Weighted hybrid; lọc cứng "không quan tâm" trên mọi kênh; mỗi gợi ý kèm `reason` | `models/hybrid.py` |

Tham số đang chạy được chọn trên validation (01/10/2026), không đặt tay: half-life 7 ngày,
thang log, kênh mua lại `order_freq`, k = 0, γ = 1 (2–3 món đã mua trong 10 gợi ý — quyết định
sản phẩm), hành vi phụ tắt. Lý do và số đo: `evaluation/README.md`.

## Cấu hình (biến môi trường)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD` | —, `ai_rec`, — | Nguồn dữ liệu. Mật khẩu đặt trong `.env` ở gốc repo, KHÔNG ghi vào code |
| `RECENCY_HALF_LIFE_DAYS` | `7` | Half-life (ngày); `0` = tắt giảm theo thời gian |
| `CF_INPUT_SCALE` | `log` | `linear` \| `log` |
| `REPEAT_SCORE` | `order_freq` | `order_freq` \| `cf_weight` (cách cũ) |
| `HYBRID_CF_SHRINK_K`, `HYBRID_REPEAT_WEIGHT`, `HYBRID_ALLOW_REPEAT` | `0`, `1`, `1` | k, γ, cho gợi ý lại món đã mua |
| `CF_BEHAVIOR_MODE` | `none` | `none` \| `count` \| `dwell` \| `dwell+cart`; trọng số: `CF_BEHAVIOR_VIEW_WEIGHT`, `_CART_WEIGHT`, `_WISH_WEIGHT` |
| `CB_ONBOARDING_PSEUDO_COUNT` | `1` | Một lựa chọn onboarding nặng bằng bấy nhiêu lần mua |
| `TRAIN_INTERVAL_SECONDS`, `PRECOMPUTE_TOP_K`, `PRECOMPUTE_BUDGET_SECONDS` | `300`, `20`, `60` | Chu kỳ train, số gợi ý tính sẵn, trần thời gian tính sẵn |

Thiếu nguồn nào (bảng đặc trưng, lịch sử theo đơn, hành vi) thì service tự rơi về đường dự
phòng và báo ở `/health` (`content_based`, `repeat_model`, `behavior`, `last_error`) — không
im lặng.

## API

| Phương thức | Endpoint | Trả về |
|---|---|---|
| `GET` | `/health` | Trạng thái, số khách/món, bản train, nguồn đang dùng, lỗi gần nhất |
| `GET` | `/api/v1/recommend/customer/{customer_id}?top_k=10` | `{customer_id, recommendations: [{product_id, reason}]}` — `reason ∈ cf, content, repeat, popular` |

## Chạy

```bash
# Cả hệ (từ gốc repo): service ai-rec nằm trong docker-compose.yml gốc
docker compose up -d --build ai-rec

# Test (từ thư mục ai-rec/, không cần cài gì trên máy host)
docker run --rm -v "$PWD":/app:ro -w /app -e PYTHONPATH=/app -e CLICKHOUSE_URL= \
  kltn-ai-rec python -m unittest discover tests

# Benchmark: xem evaluation/README.md
```

`main.py` là CLI cũ đọc `data/raw/*.csv` (thuần CF), giữ lại cho thí nghiệm cục bộ — service
không dùng.

## Cấu trúc thư mục

```text
api/            FastAPI: main.py, schemas.py, service.py (vòng train nền, cache, đổi bản nguyên tử)
data_source/    clickhouse.py — đọc các bảng serving qua HTTP
models/         cf_recommendation.py, content_based.py, repeat.py, behavior.py, hybrid.py
evaluation/     benchmark.py, strong_baselines.py (EASE^R, iALS), export_data.sh, results/
tests/          unittest cho model, benchmark, API
doc/            tài liệu nghiên cứu + báo cáo hiện trạng
config.py       mọi tham số và truy vấn (đọc từ biến môi trường)
```

## Tài liệu tham khảo

- Anderson, A., Kumar, R., Tomkins, A., & Vassilvitskii, S. (2014). The dynamics of repeat consumption. *WWW '14*.
- Bhagat, R., Muralidharan, S., Lobzhanidze, A., & Vishwanath, S. (2018). Buy It Again: Modeling repeat purchase recommendations. *KDD '18*.
- Burke, R. (2002). Hybrid recommender systems: Survey and experiments. *UMUAI*, 12(4).
- Gao, C., He, X., Gan, D., Chen, X., Feng, F., Li, Y., Chua, T.-S., & Jin, D. (2019). Neural multi-task recommendation from multi-behavior data. *ICDE '19*.
- Hu, Y., Koren, Y., & Volinsky, C. (2008). Collaborative filtering for implicit feedback datasets. *ICDM '08*.
- Pazzani, M. J., & Billsus, D. (2007). Content-based recommendation systems. *The Adaptive Web*, LNCS 4321.
- Sarwar, B., Karypis, G., Konstan, J., & Riedl, J. (2001). Item-based collaborative filtering recommendation algorithms. *WWW '01*.
- Yi, X., Hong, L., Zhong, E., Liu, N. N., & Rajan, S. (2014). Beyond clicks: Dwell time for personalization. *RecSys '14*.
