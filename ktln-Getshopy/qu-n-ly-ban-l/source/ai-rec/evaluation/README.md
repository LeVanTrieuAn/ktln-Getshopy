# Đánh giá AI-Rec

Benchmark offline cho bộ gợi ý hybrid (Item-CF + content-based + kênh mua lại).
Giao thức đầy đủ và nguồn tham khảo nằm ở docstring đầu `benchmark.py`.

## Chạy

```bash
# 1. Xuất dữ liệu (trên máy đang chạy stack; ghi vào evaluation/data/, đã gitignore)
bash evaluation/export_data.sh

# 2. Chạy trong image ai-rec (máy host không cần cài numpy/pandas)
docker run --rm -v "$PWD":/app -w /app -e PYTHONPATH=/app -e CLICKHOUSE_URL= \
  kltn-ai-rec python -m evaluation.benchmark
```

Chạy từ thư mục `ai-rec/`. Kết quả: `evaluation/results/benchmark_<thời điểm>.md` (bảng)
và `.json` (đủ mọi K, lưới tinh chỉnh, khoảng tin cậy). Khoảng 15 giây.

## Khác gì bản cũ — và vì sao số cũ không dùng được

| Bản cũ | Vấn đề | Bản này |
|---|---|---|
| Để lại đơn cuối của từng khách | Model học cả đơn của người khác xảy ra SAU thời điểm dự đoán | Cắt theo thời gian toàn cục 70/15/15 |
| Query xuất không `FINAL`, không lọc đơn huỷ/chưa trả | Đếm trùng phiên bản CDC, đo trên tập khác tập train thật | `export_data.sh` lọc đúng như `pairs_customer_product` |
| Chỉ có CF | Không biết CF có hơn cách ngây thơ không | Random, Most-Popular (2 kiểu), Repeat-only |
| Gộp mọi món vào một con số | 63,5% món ở test là món đã mua — "gợi ý lại đồ cũ" trông rất giỏi | Tách discovery / repurchase |
| Coverage = 1,0 được hiểu là tốt | Mẫu số là 78 món CF biết; 20 ô × 200 khách thì phủ 78 món là hiển nhiên | Báo cả mẫu số ứng viên (6.152) |
| Không có khoảng tin cậy | 176 khách — chênh 0,01 có thể chỉ là nhiễu | Bootstrap 95%, chênh lệch ghép cặp |

## Kết quả gần nhất — 29/09/2026

Dữ liệu: 3.498 đơn, 176 khách ở test, catalog CF 73 món, 6.152 ứng viên.
Bảng đầy đủ: `results/benchmark_20260929_031327.md`. NDCG@10, trong ngoặc là CI 95%.

**Khám phá món mới** (ground truth = món khách chưa từng mua):

| Model | NDCG@10 | Recall@10 |
|---|---|---|
| Most-Popular (bỏ món đã mua) | 0,141 [0,106; 0,178] | 0,267 |
| Content-based | 0,123 [0,091; 0,155] | 0,232 |
| **Item-CF** | **0,350** [0,296; 0,405] | 0,505 |
| Hybrid, k chọn trên validation (k = 0) | 0,350 — trùng CF | 0,505 |

→ CF gấp 2,5 lần Most-Popular: model **có học được** cấu trúc đồng mua. Content-based
**thua** cả Most-Popular với khách đã có lịch sử, và validation chọn k = 0 (bỏ hẳn
content-based cho nhóm này) — xem §Hạn chế về lý do.

**Khách mới** (mô phỏng 5-fold, onboarding giả lập từ lịch sử thật đã xoá):

| Model | NDCG@10 | Hit@10 |
|---|---|---|
| Most-Popular | 0,139 [0,116; 0,164] | 0,557 |
| Content-based từ onboarding | 0,186 [0,160; 0,212] | 0,648 |

→ +0,046 [+0,016; +0,075]: onboarding có giá trị cho khách mới, **với giả định
khách khai đúng gu thật** — đây là cận trên, không phải con số kỳ vọng.

**Đánh đổi mua lại ↔ khám phá** (k = 0, đo trên test, không dùng để chọn tham số):

| γ | Món đã mua trong top-10 | NDCG tổng thể | NDCG discovery |
|---|---|---|---|
| 0 | 0 | 0,156 | 0,350 |
| **1 (đang chạy)** | 2,5 | 0,309 | 0,258 |
| 2 | 4,9 | 0,390 | 0,163 |
| 10 (tối ưu validation) | 9,2 | 0,436 | 0,031 |

→ Chọn điểm trên đường này là **quyết định sản phẩm**. Validation chọn γ = 10 vì
mục tiêu là NDCG tổng thể, nhưng khi đó ô gợi ý gần như chỉ là lịch sử mua hàng.

Đã thử chính sách **chia ô cố định** (R ô đầu là món đã mua, còn lại từ bộ khám phá):
R = 2 cho 0,301 tổng thể / 0,209 discovery — **thua γ = 1 ở cả hai** (0,309 / 0,258) với
số món cũ tương đương. Trộn điểm chỉ cho món cũ lên khi điểm của nó thắng món CF; chia
ô thì luôn đẩy món cũ lên đầu, món mới tụt hạng và mất điểm NDCG.

Tương tác giữa k và γ (validation): với γ = 1, k = 2 cho NDCG tổng thể 0,348 so với
0,325 ở k = 0, còn discovery gần như không đổi (0,3466 so với 0,3469). k càng lớn thì
hồ sơ nội dung (dựng từ chính lịch sử mua) càng kéo món cũ lên — có lợi cho tổng thể,
hại cho khám phá khi k ≥ 5.

## Hạn chế — phải nêu khi dùng số liệu

1. **Dữ liệu mua là dữ liệu tổng hợp** (`data-platform-poc/pos_simulator.py`). "Gu" của
   khách là 1–2 lát `product_id` liên tiếp trong 80 dòng tồn kho đầu tiên, 85% món
   rút từ gu, 15% ngẫu nhiên. Lát id liên tiếp **không** tương ứng danh mục/hãng/giá
   (catalog cũ gán ngẫu nhiên), nên content-based gần như không có tín hiệu để học.
   Kết quả content-based ở đây nói về bộ sinh dữ liệu, không nói về hành vi khách thật.
2. **Lặp lại chiếm ưu thế** (63,5% món ở test đã mua trước) cũng là đặc tính của bộ
   sinh: khách rút có hoàn lại từ một rổ nhỏ cố định.
3. **Thời gian không mang thông tin**: bộ sinh rải ngày đặt đơn ngẫu nhiên, 55% đơn
   nằm trong tuần cuối. Cắt theo thời gian vẫn tránh rò rỉ, nhưng không kiểm được
   khả năng theo kịp sở thích thay đổi.
4. **Đánh giá trên log chỉ thưởng món có trong log** (Marlin & Zemel, 2009): 6.074/6.152
   ứng viên chưa từng được ai mua, và cả 65 món được mua ở giai đoạn test đều đã bán ở
   train — dữ liệu không bao giờ chạm phần còn lại của catalog. Gợi ý món ngoài 78 món
   đó luôn bị tính là trượt dù khách có thể thích. Thiệt nhất là content-based.
5. **Onboarding**: chỉ 1 khách thật có câu trả lời. Mục khách mới dùng câu trả lời
   giả lập (lạc quan); `CB_ONBOARDING_PSEUDO_COUNT` chưa tinh chỉnh được.
6. `CatalogSold` (số "đã bán" trên cửa hàng) sinh ngẫu nhiên, chỉ dùng phá hoà.

Muốn đo đúng năng lực content-based cần một trong hai: dữ liệu mua có tương quan
với đặc trưng (bộ sinh theo sở thích danh mục/hãng/giá, hoặc dữ liệu thật), và
câu trả lời onboarding thật.

## Định nghĩa chỉ số

Relevance nhị phân, trung bình trên khách có ground truth của bài toán đó.
- **Precision@K** = số món trúng / K · **Recall@K** = số món trúng / số món khách mua
- **HitRate@K** = tỉ lệ khách có ít nhất 1 món trúng
- **MAP@K** = trung bình AP@K, AP@K = Σ P@i·rel_i / min(|R|, K)
- **NDCG@K** = DCG/IDCG, DCG = Σ rel_i / log₂(i+1) (Järvelin & Kekäläinen, 2002)
- **Coverage@K** = số món khác nhau trong top-K của mọi khách / số ứng viên (và / catalog CF)
