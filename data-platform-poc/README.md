# Máy POS giả lập

Bắn đơn bán tại quầy vào Postgres của hệ Getshopy, để có dữ liệu chảy qua
đường ống CDC → Kafka → MinIO → dbt → ClickHouse → AI-Rec.

## Chạy

```bash
cd /path/to/src
set -a && . ./.env && set +a          # lấy mật khẩu Postgres từ .env ở gốc
pip install -r data-platform-poc/requirements.txt

# Một mẻ: 200 đơn của 20 khách, rải trong 7 ngày
python data-platform-poc/pos_simulator.py --orders 200 --customers 20 --days 7

# Liên tục, để xem độ trễ CDC bằng mắt
python data-platform-poc/pos_simulator.py --stream --rate 10
```

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `--orders` | 200 | số đơn sinh ra |
| `--customers` | 20 | số khách lấy từ `"B2CCustomer"` |
| `--catalog` | 80 | số mặt hàng bày quầy |
| `--groups` | 8 | số nhóm sở thích (xem bên dưới) |
| `--days` | 7 | rải đơn trong bao nhiêu ngày gần đây |
| `--seed` | 20260101 | cùng seed ra cùng bộ đơn |
| `--no-inventory` | tắt | không trừ tồn kho |
| `--stream` / `--rate` | — | bắn liên tục, N đơn/phút |

## Ghi thẳng DB, không gọi API

`/api/b2c/checkout` là đường của gian hàng **online**: giữ chỗ tồn kho, sinh mã
QR, chờ webhook ngân hàng. Máy POS tại quầy không có bước nào trong số đó —
khách trả tiền rồi cầm hàng đi, hoá đơn ghi nhận giao dịch **đã hoàn tất**.

Quan trọng hơn: POC này để chứng minh CDC bắt được thay đổi từ **một hệ thống
khác** ghi vào cùng database. Đi qua API của chính Getshopy thì không còn
chứng minh được điều đó.

## Ba ràng buộc bắt buộc

Đơn chỉ tới được `serving.processed_data_for_AI_rec` nếu qua đủ bộ lọc dbt:

1. `product_id` có thật trong `"Product"`, `is_deleted = false`
2. `customer_id` khác 0 và có thật trong `"B2CCustomer"`
3. `payment_status = 'PAID'` và `status != 'CANCELLED'`

Sai điều nào cũng **không có lỗi nào báo ra** — dòng chỉ lặng lẽ biến mất ở
bước `INNER JOIN dim_products`. Bản POC cũ (`legacy/`) bịa `product_id` trong
khoảng 101–602 nên không dòng nào sống sót.

Vì vậy script lấy hàng **từ bảng `"Inventory"`**, không phải từ `"Product"`:
tồn kho khoá theo bộ ba `(product_id, variant_id, branch_id)`, chọn sản phẩm
rồi đoán biến thể là cách chắc chắn bán phải thứ không có tồn.

## Vì sao có "nhóm sở thích"

Collaborative filtering học từ *"những người mua X cũng mua Y"*. Nếu mỗi khách
mua một rổ ngẫu nhiên độc lập thì **không có tín hiệu nào để học** — mô hình
chỉ trả về danh sách bán chạy, và demo nhìn như bị hỏng.

Script gán cho mỗi khách 1–2 nhóm hàng rồi rút chủ yếu từ đó, kèm 15% rút
ngoài nhóm làm cầu nối. Chồng lấn giữa các khách cùng gu chính là thứ CF cần.

## Sau khi chạy

```bash
# CDC đẩy sang Kafka trong vài giây, parquet sau ~15–20s
docker compose --profile dbt run --rm dbt run    # hoặc chờ lịch 5 phút
docker compose logs -f ai-rec                    # chờ "Bản train #N sẵn sàng"
```

Độ trễ toàn tuyến: tối đa ~10 phút (5 phút lịch dbt + 5 phút vòng train, hai
nhịp độc lập không đồng bộ).
