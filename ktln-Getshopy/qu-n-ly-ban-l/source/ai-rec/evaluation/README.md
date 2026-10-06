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
và `.json` (đủ mọi K, cả lưới tinh chỉnh, khoảng tin cậy). Khoảng 6–7 phút: lưới 20 bộ dữ
liệu × 96 bộ tham số, đối chứng mạnh, kiểm độ bền.

## Các bản giao thức

**29/09** — so với bản đầu:

| Bản đầu | Vấn đề | Bản 29/09 |
|---|---|---|
| Để lại đơn cuối của từng khách | Model học cả đơn của người khác xảy ra SAU thời điểm dự đoán | Cắt theo thời gian toàn cục 70/15/15 |
| Query xuất không `FINAL`, không lọc đơn huỷ/chưa trả | Đếm trùng phiên bản CDC, đo trên tập khác tập train thật | `export_data.sh` lọc đúng như `pairs_customer_product` |
| Chỉ có CF | Không biết CF có hơn cách ngây thơ không | Random, Most-Popular (2 kiểu), Repeat-only |
| Gộp mọi món vào một con số | 63,5% món ở test là món đã mua — "gợi ý lại đồ cũ" trông rất giỏi | Tách discovery / repurchase |
| Coverage = 1,0 được hiểu là tốt | Mẫu số là 78 món CF biết | Báo cả mẫu số ứng viên (6.152) |
| Không có khoảng tin cậy | 176 khách — chênh 0,01 có thể chỉ là nhiễu | Bootstrap 95%, chênh lệch ghép cặp |

**01/10** — so với bản 29/09:

| Bản 29/09 | Vấn đề | Bản 01/10 |
|---|---|---|
| Half-life cố định 30 ngày | Chưa từng tinh chỉnh; dữ liệu có cú đổi gu (Hạn chế 3) | Lưới {7, 10, 14, 30, 60} — cận dưới 7 ngày chốt trước khi đo |
| Ma trận CF theo số lượng thô | Đơn sỉ làm lệch vector món | Thêm thang log (Hu et al., 2008) vào lưới |
| Kênh mua lại = trọng số ma trận CF (tổng số lượng × độ gần đây lần mua cuối) | Một đơn 5 cái nặng hơn ba lần mua gần đây | Thêm kênh tần suất đơn đã giảm theo thời gian (`models/repeat.py`) vào lưới |
| γ chọn theo NDCG tổng thể rồi đặt tay γ = 1 | Chọn trên validation cho γ = 10 (gần hết ô là món cũ) | Luật khai báo trước: tối đa NDCG tổng thể với 2–3 món cũ/10 |
| Đối chứng chỉ gồm baseline ngây thơ | Không biết Item-CF có kém mô hình mạnh hơn không | EASE^R, iALS tinh chỉnh trên validation (Dacrema et al., 2019) |
| Đo test một lần, không kiểm độ bền | Test chỉ ~9,7 giờ, một cửa sổ | Thêm 2 cửa sổ TRƯỚC validation; so ghép cặp mới/cũ |
| Chưa dùng hành vi duyệt | — | Tầng 2 (có `behavior_events.csv`): hành vi phụ × half-life, giữ thang + kênh mua lại của tầng 1; baseline Viewed-only; khách mới "đã duyệt, chưa mua" |
| *(sửa sau quan sát, 01/10)* Luật dải 2–3 món cũ xét riêng từng bộ | Bộ có hành vi lọt dải nhờ 3,00 món cũ trong khi bộ không hành vi cùng k có 3,01 — "thắng" mà không mang tín hiệu | **Điều kiện trội**: bộ có hành vi chỉ hợp lệ nếu thắng bộ không hành vi ở cùng half-life, k, γ; **ablation có kiểm soát** (giữ mọi tham số tầng 1) |

## Kết quả gần nhất — 01/10/2026

Dữ liệu như 29/09: 3.498 đơn, 176 khách ở test, catalog CF 73 món, 6.152 ứng viên. Bảng đầy
đủ: `results/benchmark_20260930_203039.md` (bản cuối, có tầng 2 hành vi phụ; số của cấu hình
đang chạy trùng bản `benchmark_20260930_185616.md` chưa có tầng 2).

**Cấu hình chọn trên validation** (1.920 bộ, 125 bộ nằm trong dải 2–3 món cũ): half-life
7 ngày · thang log · kênh mua lại theo tần suất đơn · k = 0 · γ = 1. Trên validation: NDCG@10
tổng thể 0,437 so với 0,325 của cấu hình cũ. Half-life rơi đúng CẬN DƯỚI của lưới — xem
Hạn chế 3 về lý do đặt cận dưới.

**Trước/sau trên test** (đo một lần sau khi chọn; NDCG@10, chênh lệch ghép cặp, CI 95%):

| Bài toán | Cũ (tới 30/09) | Mới | Δ |
|---|---|---|---|
| Tổng thể | 0,309 | 0,356 | **+0,047** [+0,018; +0,074] |
| Khám phá (món chưa mua) | 0,258 | 0,267 | +0,008 [−0,014; +0,032] |
| Mua lại (món đã mua) | 0,264 | 0,332 | **+0,068** [+0,029; +0,106] |

Số món đã mua trong top-10: 2,5 → 2,7. P@10 tổng thể 0,130 → 0,149; Hit@10 0,767 → 0,790.

**Độ bền** — hai cửa sổ trước validation (15/09 15:29 → 16/09 14:36, 302 khách gộp, không
đụng test): tổng thể +0,100 [+0,075; +0,126]; khám phá +0,013 [−0,007; +0,033].

**Đối chứng mạnh** — bài toán khám phá trên test, mỗi mô hình tinh chỉnh trên validation:

| Model | NDCG@10 | Δ so với Item-CF cũ |
|---|---|---|
| Most-Popular (bỏ món đã mua) | 0,148 | −0,203 [−0,271; −0,130] |
| Item-CF — cấu hình cũ | 0,350 | — |
| EASE^R (λ = 50) | 0,359 | +0,009 [−0,017; +0,036] |
| iALS (16 nhân tố, α = 10, λ = 10) | 0,373 | +0,022 [−0,014; +0,065] |
| **Item-CF (half-life 7, thang log)** | **0,377** | **+0,026** [+0,006; +0,048] |

→ Item-CF sau tinh chỉnh không thua hai đối chứng mạnh: lựa chọn Item-CF có cơ sở, và EASE/
iALS không đáng thêm độ phức tạp vận hành ở quy mô này.

**Khách mới mô phỏng**: content-based từ onboarding 0,190 so với Most-Popular 0,140
(+0,050 [+0,019; +0,079]) — vẫn là cận trên (onboarding giả lập từ lịch sử thật).

**Cách đọc**
- Mức tăng đến từ hai thay đổi: half-life ngắn hơn (dữ liệu có cú đổi gu — Hạn chế 3) và
  kênh mua lại theo tần suất đơn (phần mua lại +0,068).
- Khám phá của hybrid tăng không có ý nghĩa thống kê, dù CF thuần tăng +0,026: ở γ = 1 phần
  khám phá bị kênh mua lại (mạnh hơn trước) lấy bớt ô.
- Validation lạc quan hơn test (+0,112 so với +0,047): chọn bộ tốt nhất trong 1.920 bộ luôn
  thiên lạc quan; số báo cáo là số test.
- Độ phủ giảm nhẹ: 73 → 68 món trong catalog CF.

**Đánh đổi mua lại ↔ khám phá** (cấu hình mới, test — KHÔNG dùng để chọn tham số):

| γ | Món đã mua trong top-10 | NDCG tổng thể | NDCG discovery |
|---|---|---|---|
| 0 | 0 | 0,168 | 0,377 |
| 0,5 | 0,6 | 0,205 | 0,373 |
| 0,75 | 1,8 | 0,278 | 0,352 |
| **1 (đang chạy)** | 2,7 | 0,356 | 0,267 |
| 1,5 | 4,4 | 0,430 | 0,192 |
| 5 | 7,9 | 0,486 | 0,074 |

## Tín hiệu hành vi phụ trên dữ liệu thật — 01/10/2026

Sự kiện hành vi xuất từ `analytics.user_events`: 3.113 dòng — nhưng là dữ liệu SEED
(`seed-behavior-data.js`): 20 khách, chỉ 5 trong số đó có đơn (trên 234 khách có đơn); 956 món,
chỉ 2 trùng với 78 món từng được mua.

- Validation (luật đã sửa) **không chọn** hành vi phụ → cấu hình đang chạy giữ nguyên, trùng cấu
  hình chọn trên validation. 2.685 bộ có hành vi bị loại vì thua bộ không hành vi cùng tham số.
- Ablation có kiểm soát trên test (giữ half-life 7, log, `order_freq`, k = 0, γ = 1):

| Tín hiệu | NDCG tổng thể | Δ | NDCG khám phá | Δ |
|---|---|---|---|---|
| Không | 0,356 | — | 0,267 | — |
| Số lượt xem | 0,354 | −0,002 [−0,005; +0,000] | 0,264 | −0,003 [−0,007; +0,000] |
| Dwell | 0,353 | −0,003 [−0,007; −0,000] | 0,259 | −0,008 [−0,017; −0,001] |
| Dwell + giỏ/yêu thích | 0,353 | −0,004 [−0,008; −0,001] | 0,258 | −0,009 [−0,019; −0,001] |

→ Hành vi không liên quan tới khách/món mua chỉ thêm nhiễu — đúng như kỳ vọng. Đường
production cho hành vi (bảng `serving.customer_product_events`, `CF_BEHAVIOR_MODE`) đã sẵn sàng
và đã kiểm thử, để tắt cho tới khi có hành vi thật.

**Vì sao sửa luật chọn (minh bạch):** lượt chạy đầu với luật cũ chọn "dwell × 0,5, k = 0,5".
Kiểm lại lưới validation: ở MỌI k, bộ không hành vi đều cao hơn (k = 0,5: 0,4469 so với 0,4456),
nhưng bộ không hành vi cùng k có 3,01 món cũ/10 — vượt dải 2–3 — còn bộ có hành vi 3,00. Hành vi
khi đó chỉ đẩy một cấu hình qua ranh giới dải. Bản chạy đó giữ ở `results/superseded/`.

## Nghiên cứu mô phỏng — bộ sinh v2, 01/10/2026

Dữ liệu sinh bởi `data-platform-poc/taste_simulator.py` (seed 20261001; tham số và đáp án gu
trong `data/sim/sim_params.json`, tái tạo được bằng lệnh ở docstring). Bảng đầy đủ:
`results/sim/benchmark_20260930_202814.md`.

| Tính chất | Dữ liệu thật | Mô phỏng |
|---|---|---|
| Khách / món được mua / ứng viên | 234 / 78 / 6.152 | 500 / 569 / 639 |
| Mật độ ma trận | 17,7% | 2,2% |
| Cửa sổ validation / test | ~22 giờ / ~9,7 giờ | ~25 ngày / ~25 ngày |
| Món test đã mua trước | 63,5% | 44,3% |
| Khách mới ở test | 0 | 21 |
| Gu theo đặc trưng / thời gian | theo lát id (có tương quan hãng); đổi đột ngột | gu ẩn theo danh mục/hãng/giá; trôi dần |
| Hành vi | seed, không liên quan | cùng gu, "xem trước khi mua" |

**Cấu hình chọn trên validation** (cùng giao thức, cùng lưới): half-life **30** ngày · thang log
· mua lại `cf_weight` · hành vi phụ `count × 1` · **k = 1** · γ = 1,5. So với dữ liệu thật:
half-life dài hơn (gu trôi dần), content-based có đóng góp (k = 1 — gu theo đặc trưng), hành vi
được chọn.

**Trước/sau trên test** (NDCG@10, ghép cặp):

| Bài toán | Cấu hình cũ | Chọn trên validation | Δ |
|---|---|---|---|
| Tổng thể | 0,197 | 0,357 | **+0,160** [+0,142; +0,178] |
| Khám phá | 0,021 | 0,176 | **+0,154** [+0,131; +0,180] |
| Mua lại | 0,355 | 0,453 | +0,098 [+0,079; +0,116] |

Theo phân khúc (NDCG tổng thể): khách mới 0,051 → 0,299; 1–2 món 0,236 → 0,376; 6+ món
0,207 → 0,365. Độ phủ: 407 → 476 / 639 món.

**Ablation có kiểm soát** (giữ half-life 60, log, `cf_weight`, k = 0,5, γ = 1,25 của tầng 1):

| Tín hiệu | NDCG tổng thể | Δ | NDCG khám phá | Δ |
|---|---|---|---|---|
| Không | 0,259 | — | 0,029 | — |
| Số lượt xem (× 0,5) | 0,344 | +0,086 [+0,068; +0,104] | 0,170 | +0,141 [+0,120; +0,165] |
| Dwell (× 1) | 0,350 | +0,092 [+0,074; +0,110] | 0,177 | +0,148 [+0,126; +0,171] |
| Dwell + giỏ/yêu thích (× 1) | 0,343 | +0,084 [+0,067; +0,101] | 0,167 | +0,138 [+0,118; +0,160] |

**Khách mới mô phỏng** (NDCG@10): Most-Popular 0,099 · content-based từ onboarding (có nhiễu,
đúng 80%) 0,181 (+0,082 [+0,056; +0,108]) · hybrid từ hành vi duyệt, chưa có đơn, không
onboarding **0,400** (+0,301 [+0,270; +0,332]).

**Phát hiện — và giới hạn của từng phát hiện**
1. **Hành vi phụ giúp nhiều nhất ở khám phá và khách mới.** Nhưng bộ sinh GIẢ ĐỊNH khách xem
   món trước khi mua, nên giá trị dự báo của lượt xem có sẵn theo thiết kế. Số trên đo mức hệ
   TẬN DỤNG được tín hiệu, không chứng minh tín hiệu có giá trị trên khách thật.
2. **Viewed-only (ngây thơ) thắng hybrid ở khám phá**: 0,314 so với 0,281 (hybrid chỉ khám phá)
   và 0,176 (production, γ = 1,5). Cải tiến kế tiếp hợp lý: thêm kênh "xem gần đây" riêng vào
   hybrid (như kênh mua lại), trọng số chọn trên validation.
3. **Repeat-only ngang hybrid ở chỉ số tổng thể** (0,348 so với 0,357) — nhưng Repeat-only gần
   như không khám phá (0,016). Ràng buộc 2–3 món cũ/10 là thứ giữ phần khám phá.
4. **Trên dữ liệu thưa, iALS > EASE^R > Item-CF** ở khám phá (validation 0,084 / 0,069 / 0,054),
   ngược với dữ liệu thật. Một phần do bộ sinh dùng mô hình nhân tố ẩn — trùng giả định của
   iALS. Khi có dữ liệu thật đủ thưa, nên đánh giá lại iALS cho production.
5. **Cấu hình đang chạy (half-life 7) kém hơn cấu hình cũ trên dữ liệu mô phỏng** (tổng thể
   0,153 so với 0,197; độ bền −0,024 [−0,041; −0,007]). Half-life 7 chỉ đúng với cú đổi gu của
   dữ liệu thật hiện tại — chuyển sang dữ liệu khác (vd. reset bằng bộ sinh v2) thì PHẢI chạy
   lại benchmark và đổi config.

## Kết quả 29/09/2026 (bản trước, giữ để đối chiếu)

Bảng đầy đủ: `results/benchmark_20260929_031327.md`. Discovery NDCG@10: Most-Popular 0,141 ·
content-based 0,123 · Item-CF 0,350. Tổng thể: cấu hình chạy lúc đó (k = 0, γ = 1) 0,309.
Khách mới mô phỏng: 0,186 so với 0,139. Bản 01/10 tái tạo đúng từng chữ số các số này khi
chạy cấu hình cũ — hai bản đo trên cùng dữ liệu, cùng cách cắt.

## Hạn chế — phải nêu khi dùng số liệu

1. **Dữ liệu mua là dữ liệu tổng hợp** (`data-platform-poc/pos_simulator.py`). "Gu" của
   khách là 1–2 lát liên tiếp trong danh sách tồn kho còn hàng (sắp theo product_id), 85% món
   rút từ gu, 15% ngẫu nhiên. *Đính chính 01/10:* bản 29/09 viết lát id "không tương ứng
   danh mục/hãng/giá" — chưa đúng. Id sản phẩm được sinh theo từng hãng nên mỗi lát gần như
   thuần một hãng: tỉ trọng hãng mua nhiều nhất của mỗi khách có trung vị 0,57 (mua ngẫu nhiên
   trong 73 món: ~0,36). Danh mục bị phụ kiện di động áp đảo (56/78 món), tầm giá trộn lẫn.
   Content-based thua ở khách có lịch sử chủ yếu vì Hạn chế 4 và vì đặc trưng thô (mọi món
   cùng ô danh mục × hãng × tầm giá có cùng điểm).
2. **Lặp lại chiếm ưu thế** (63,5% món ở test đã mua trước) cũng là đặc tính của bộ sinh:
   khách rút có hoàn lại từ một rổ nhỏ cố định.
3. **Thời gian — đính chính 01/10.** Bản 29/09 viết "thời gian không mang thông tin" — SAI.
   Toàn bộ 3.490 đơn POS đến từ 5 lần chạy `pos_simulator.py` bằng tay trong 16–17/09, mỗi
   lần một `--seed` (gu của mọi khách bị rút lại) và một khoảng ngày riêng (3 ngày, 1 ngày,
   180 ngày, 14 ngày). Kiểm chứng: chạy lại `build_orders` với đúng tham số từng lần tái tạo
   3.490/3.490 đơn. Hệ quả:
   - **cú đổi gu đột ngột** quanh đầu tháng 9 — tập món trước/sau 10/09 của cùng khách có
     Jaccard trung vị 0,07; tỉ lệ mua lại tăng đều 10% → 62% (tháng 3 → 8) rồi rơi về ~30%;
   - **một đợt dồn 15–17/09** (53% số dòng) — validation và test đều nằm trong đợt này, test
     chỉ dài ~9,7 giờ.
   Vì vậy half-life ngắn thắng lớn trên validation (1–3 ngày còn tốt hơn 7). Đó là thích nghi
   với cú đổi của bộ sinh, không phải bằng chứng khách thật đổi gu theo ngày — nên cận dưới 7
   ngày được chốt TRƯỚC khi đo. Có dữ liệu thật thì phải chọn lại.
   Thêm: ngày đơn POS lưu theo giờ máy (+07) nhưng pipeline coi là UTC (lệch 7 giờ so với đơn
   web), và một phần đơn của hai lần chạy có ngày ở TƯƠNG LAI so với lúc chạy. AI-Rec kẹp
   DaysSince ≥ 0 nên không thổi trọng số, nhưng thứ tự thời gian trong ngày bị nhiễu.
4. **Đánh giá trên log chỉ thưởng món có trong log** (Marlin & Zemel, 2009): 6.074/6.152
   ứng viên chưa từng được ai mua, và cả 65 món được mua ở giai đoạn test đều đã bán ở
   train — dữ liệu không bao giờ chạm phần còn lại của catalog. Gợi ý món ngoài 78 món
   đó luôn bị tính là trượt dù khách có thể thích. Thiệt nhất là content-based.
5. **Onboarding**: chỉ 1 khách thật có câu trả lời. Mục khách mới dùng câu trả lời
   giả lập (lạc quan); `CB_ONBOARDING_PSEUDO_COUNT` chưa tinh chỉnh được.
6. `CatalogSold` (số "đã bán" trên cửa hàng) sinh ngẫu nhiên, chỉ dùng phá hoà.
7. **Nhiều phép so sánh trên validation**: 1.920 bộ tham số ở tầng 1, thêm 2.880 bộ ở tầng 2,
   và 350 bộ đối chứng. Bộ tốt nhất trên validation lạc quan so với ngoài mẫu; số báo cáo là số
   test đo một lần, và kiểm độ bền trên hai cửa sổ không dùng để chọn. Luật chọn được sửa MỘT
   lần sau khi quan sát (điều kiện trội, 01/10) — ghi ở §Các bản giao thức.
8. **Mô phỏng có tính vòng tròn**: bộ sinh v2 mã hoá sẵn những gì model tìm kiếm (gu theo đặc
   trưng, gu trôi dần, xem trước khi mua, nhân tố ẩn). Kết quả mô phỏng cho biết hệ HỌC được
   cấu trúc đó khi nó tồn tại và so sánh tương đối giữa các biến thể; không phải bằng chứng về
   hành vi khách thật (Ie et al., 2019).

Muốn đo đúng năng lực content-based và time-decay cần dữ liệu mua có tương quan với đặc
trưng và có xu hướng thời gian thật (bộ sinh theo gu ẩn danh mục/hãng/giá trôi dần, hoặc dữ
liệu thật), cùng câu trả lời onboarding thật.

## Định nghĩa chỉ số

Relevance nhị phân, trung bình trên khách có ground truth của bài toán đó.
- **Precision@K** = số món trúng / K · **Recall@K** = số món trúng / số món khách mua
- **HitRate@K** = tỉ lệ khách có ít nhất 1 món trúng
- **MAP@K** = trung bình AP@K, AP@K = Σ P@i·rel_i / min(|R|, K)
- **NDCG@K** = DCG/IDCG, DCG = Σ rel_i / log₂(i+1) (Järvelin & Kekäläinen, 2002)
- **Coverage@K** = số món khác nhau trong top-K của mọi khách / số ứng viên (và / catalog CF)
- **Món cũ/10** = trung bình số món khách ĐÃ mua trong top-10 — đại lượng của ràng buộc γ
