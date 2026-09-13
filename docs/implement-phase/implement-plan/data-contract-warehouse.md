# Data Contract — Hệ BigData cung cấp gì cho hệ Ecommerce

> Ngày: 13/09/2026
> Liên quan: [implement-plan-muc3](implement-plan-muc3-Sep13.md) · checklist mục 3.4, mục 5

---

## 0. Ba bên tiêu thụ dữ liệu từ warehouse

```
                         ┌─────────────────────────────┐
   Postgres (Ecom)  CDC  │      HỆ BIGDATA             │
   Order/OrderItem ─────▶│  MinIO → ClickHouse → dbt   │
                         └──────────────┬──────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              ▼                         ▼                         ▼
     ┌────────────────┐      ┌────────────────────┐    ┌──────────────────┐
     │ Admin Dashboard│      │      AI-Rec        │    │  Client B2C      │
     │ mart_revenue   │      │ processed_data_    │    │ (gián tiếp, qua  │
     │                │      │   for_AI_rec       │    │  AI-Rec API)     │
     └────────────────┘      └────────────────────┘    └──────────────────┘
```

Client e-com **không đọc thẳng** warehouse. Nó gọi API của AI-Rec (gợi ý sản
phẩm) và API của server Ecom (dashboard). Warehouse chỉ nói chuyện với hai hệ.

---

## 1. Admin Dashboard cần gì

Bảng: **`mart_revenue`** (serving layer)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `revenue_date` | Date | |
| `category_id`, `brand_id` | String | |
| `payment_method` | String | COD / BANK_TRANSFER |
| `orders` | UInt32 | đếm distinct order_id |
| `units` | UInt32 | tổng số lượng |
| `gross_revenue` | Int64 | tổng `net_amount`, **mọi trạng thái** |
| `paid_revenue` | Int64 | chỉ đơn `payment_status = 'PAID'` |
| `cancelled_value` | Int64 | giá trị đơn đã huỷ |

⚠️ Dashboard phải đọc **`paid_revenue`**, không phải `gross_revenue`. Đơn
`PENDING_PAYMENT` và `CANCELLED` chưa phải tiền thật; lẫn vào là báo cáo doanh
thu thổi phồng.

Đơn vị tiền: **Int, đồng** (khớp Postgres). Bảng `analytics.sale_orders` cũ khai
`Decimal(18,2)` — bảng đó sẽ bỏ sau khi dashboard chuyển sang `mart_revenue`.

---

## 2. AI-Rec cần gì — phần quan trọng nhất

### 2.1 Đúng ba cột

Model là **item-based collaborative filtering**. Nó chỉ cần biết: *ai đã mua gì,
bao nhiêu*. Không cần giá, không cần thời gian, không cần địa chỉ.

Bảng: **`processed_data_for_AI_rec`**

| Cột | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `CustomerID` | String | ✅ | **phân biệt hoa thường** — code đọc đúng tên này |
| `ProductID` | String | ✅ | |
| `Quantity` | Int | ✅ | tổng số lượng khách đó đã mua sản phẩm đó |

Grain: **một dòng cho mỗi cặp (khách, sản phẩm)**. Khách mua cùng một sản phẩm ở
3 đơn khác nhau → gộp thành **một dòng**, `Quantity` cộng dồn.

Tên cột viết hoa kiểu `CamelCase` vì code AI-rec đọc thẳng:
```python
df.groupby(["CustomerID", "ProductID"], as_index=False)["Quantity"].sum()
```

### 2.2 Metadata tuỳ chọn

AI-rec đọc thêm nếu có (dùng để hiển thị, không dùng để train):

| File | Khoá | Dùng làm gì |
|---|---|---|
| `products.csv` | `ProductID` | tên, ảnh, giá để trả về trong kết quả gợi ý |
| `customers.csv` | `CustomerID` | thông tin khách |

Không có thì model vẫn train được.

---

## 3. Ranh giới tiền xử lý / hậu xử lý

Đây là chỗ dễ chồng lấn hoặc bỏ sót, nên ghi rõ.

### 3.1 WAREHOUSE làm (tiền xử lý)

Làm sạch dữ liệu ở mức **nghiệp vụ** — những thứ chỉ warehouse mới biết:

#### Quy tắc xử lý đơn hàng không rõ ràng (đã chốt)

| Trường hợp | Xử lý | Lý do |
|---|---|---|
| **Không có thông tin khách** (`customer_id IS NULL`) | **LOẠI BỎ dòng** | Không có định danh thì không gán tương tác cho ai được |
| **Không có thông tin sản phẩm** (`product_id IS NULL`) | **LOẠI BỎ dòng** | Không biết gợi ý cái gì |
| **Không có thông tin số lượng** (`quantity IS NULL`) | **Giữ dòng, `Quantity = 0`** | 0 = *người dùng chưa tương tác với sản phẩm*, không phải dữ liệu hỏng |

Khác biệt ở dòng thứ ba đáng chú ý: thiếu số lượng **không** loại bỏ bản ghi.
Trong ma trận user-item, ô mang giá trị 0 chính là "chưa tương tác" — giữ lại
để phân biệt với trường hợp cặp (khách, sản phẩm) đó không hề tồn tại trong dữ
liệu. Với sparse matrix thì hai thứ cho cùng kết quả khi train, nhưng giữ dòng
giúp truy vết được là *có đơn nhưng thiếu dữ liệu*, phục vụ checksum.

#### Quy tắc làm sạch theo nghiệp vụ

| # | Việc | Lý do |
|---|---|---|
| 1 | **Loại đơn `CANCELLED`** | Khách huỷ không phản ánh sở thích |
| 2 | **Loại đơn chưa thanh toán** (`payment_status ≠ 'PAID'`) | Đơn bom hàng, đơn hết hạn là nhiễu |
| 3 | **Loại sản phẩm KHÔNG CÒN BÁN** (`Product.is_deleted = true`) | **Bắt buộc, làm ở warehouse trước khi đưa sang AI.** Gợi ý hàng đã ngừng bán là lỗi nhìn thấy được với khách |
| 4 | **Gộp theo cặp (khách, sản phẩm)**, cộng `Quantity` | Mua nhiều lần = tín hiệu mạnh hơn |
| 5 | **Ép kiểu `String`** cho hai id | Tránh pandas đọc thành số rồi mất số 0 đầu |

Quy tắc 3 cần **masterdata `Product` trên ClickHouse** (checklist mục 3.3) để
join kiểm `is_deleted`. Đây là lý do bước kéo masterdata không thể bỏ qua.

Kết quả: một bảng sạch, mỗi dòng là một tương tác thật đã trả tiền, trên sản
phẩm còn đang bán.

### 3.2 AI-REC làm (hậu xử lý)

Những thứ thuộc về **mô hình**, warehouse không nên đụng vào:

| # | Việc | Lý do để ở AI-rec |
|---|---|---|
| 1 | **Encode id → chỉ số ma trận** | Chỉ số phụ thuộc tập dữ liệu tại thời điểm train |
| 2 | **Dựng sparse CSR user-item** | Cấu trúc dữ liệu của model |
| 3 | **L2-normalize** theo item (`sklearn.preprocessing.normalize`) | Bước chuẩn hoá của cosine similarity |
| 4 | **Tính cosine similarity giữa item** | Chính là thuật toán |
| 5 | **Lọc cold-start** (khách/sản phẩm quá ít tương tác) | Ngưỡng là **siêu tham số**, cần tinh chỉnh khi train — để warehouse cứng hoá là mỗi lần đổi ngưỡng phải chạy lại cả pipeline |
| 6 | **Loại sản phẩm khách đã mua** khỏi kết quả gợi ý | Logic lúc suy luận, không phải lúc chuẩn bị dữ liệu |

### 3.3 Vì sao chia như vậy

Nguyên tắc: **warehouse lo chất lượng dữ liệu, AI-rec lo mô hình.**

- Cái gì đúng/sai theo *nghiệp vụ* (đơn huỷ, chưa trả tiền) → warehouse. Nó có
  đủ ngữ cảnh; AI-rec không biết `payment_status` nghĩa là gì.
- Cái gì là *lựa chọn mô hình* (ngưỡng cold-start, cách chuẩn hoá) → AI-rec.
  Đổi siêu tham số là chuyện thường ngày khi train, không được kéo theo việc
  chạy lại dbt.

---

## 4. Giao tiếp với AI-Rec: API ClickHouse (đã chốt)

**Warehouse mở endpoint, AI-Rec tự gọi lấy theo job của họ.** Không xuất CSV,
không đẩy dữ liệu sang.

Lý do chọn cách này: ranh giới trách nhiệm rõ — warehouse chịu trách nhiệm dữ
liệu đúng và sẵn sàng, AI-Rec tự quyết khi nào train lại. Không có file trung
gian để lệch phiên bản, và không bên nào phải sửa code của bên kia.

### 4.1 Endpoint

ClickHouse có sẵn HTTP interface, không cần viết service riêng:

```
POST http://<clickhouse-host>:8123/
Header: X-ClickHouse-User / X-ClickHouse-Key
Body:   câu SQL
```

### 4.2 Tài khoản riêng cho AI-Rec — chỉ đọc

Không dùng chung tài khoản admin. Tạo user chỉ đọc đúng một bảng:

```sql
CREATE USER IF NOT EXISTS ai_rec IDENTIFIED BY '<đặt trong .env>';
CREATE ROLE IF NOT EXISTS ai_rec_reader;
GRANT SELECT ON serving.processed_data_for_AI_rec TO ai_rec_reader;
GRANT ai_rec_reader TO ai_rec;

-- Chặn truy vấn nặng làm ảnh hưởng dashboard
CREATE SETTINGS PROFILE IF NOT EXISTS ai_rec_profile SETTINGS
    max_execution_time = 60,
    max_memory_usage = 2000000000,
    readonly = 1;
ALTER USER ai_rec SETTINGS PROFILE ai_rec_profile;
```

### 4.3 Truy vấn AI-Rec dùng

Lấy toàn bộ tương tác để train:

```sql
SELECT CustomerID, ProductID, Quantity
FROM serving.processed_data_for_AI_rec
FORMAT CSVWithNames
```

`FORMAT CSVWithNames` trả về đúng định dạng `pd.read_csv` đang đọc, nên phía
AI-Rec chỉ cần đổi nguồn từ file sang HTTP, không phải sửa logic xử lý:

```python
resp = requests.post(CH_URL, data=QUERY,
                     headers={'X-ClickHouse-User': user, 'X-ClickHouse-Key': key})
df = pd.read_csv(io.StringIO(resp.text), dtype={'CustomerID':'string','ProductID':'string'})
```

Lấy tương tác của một khách (nếu cần suy luận trực tuyến):

```sql
SELECT ProductID, Quantity
FROM serving.processed_data_for_AI_rec
WHERE CustomerID = {customer_id:String}
FORMAT JSON
```

### 4.4 Kết quả AI-Rec trả cho client e-com

Định dạng đã chốt:

```json
{
  "customer_id": "string",
  "recommendations": [
    { "product_id": "string" }
  ]
}
```

Chỉ có `product_id` — client tự lấy tên, ảnh, giá từ API sản phẩm của Ecom.
Cách này tránh gợi ý mang theo giá cũ đã lỗi thời, và giữ AI-Rec khỏi phải biết
gì về hiển thị.

### 4.5 Việc của mỗi bên

| Bên | Trách nhiệm |
|---|---|
| **Warehouse** | Bảng `processed_data_for_AI_rec` sạch, đúng 3 cột; user `ai_rec` chỉ đọc; endpoint hoạt động |
| **AI-Rec** | Tự đặt lịch gọi lấy dữ liệu, tự train lại, tự phục vụ API gợi ý |
| **Client B2C** | Gọi API AI-Rec, tự lấy thông tin hiển thị sản phẩm từ Ecom |

## 5. Tần suất cập nhật

| Bảng | Ai dùng | Độ trễ chấp nhận được |
|---|---|---|
| `mart_revenue` | Admin dashboard | Phút (nếu dùng nhánh lakehouse) hoặc giây (nếu dựng nhánh Kafka→ClickHouse trực tiếp) |
| `processed_data_for_AI_rec` | AI-rec | Giờ — mô hình CF không cần dữ liệu tươi |
| `fact_orders_detail` | Nguồn của hai bảng trên | Theo chu kỳ dbt |

Nhắc lại quyết định đã chốt 13/09: kiến trúc **hai nhánh** — nhánh nóng
(Kafka→ClickHouse trực tiếp) cho dashboard near-realtime, nhánh lạnh
(Kafka→MinIO→dbt) cho báo cáo và AI-rec.

---

## 6. Checklist nghiệm thu

Trước khi coi là thông luồng:

- [ ] Đặt một đơn mới ở web → sau N phút thấy trong `fact_orders_detail`
- [ ] `mart_revenue.paid_revenue` khớp tổng `total` các đơn `PAID` trong Postgres
- [ ] `processed_data_for_AI_rec` có đúng 3 cột, đúng tên hoa thường
- [ ] Đơn `CANCELLED` và `PENDING_PAYMENT` **không** xuất hiện trong bảng AI-rec
- [ ] Khách vãng lai (`customer_id NULL`) **không** xuất hiện
- [ ] Một khách mua cùng sản phẩm ở 2 đơn → đúng **một** dòng, `Quantity` cộng dồn
- [ ] AI-rec train được với dữ liệu đó và trả về gợi ý
- [ ] Sản phẩm `is_deleted = true` **không** xuất hiện trong bảng AI-rec
- [ ] Dòng thiếu `quantity` được giữ với `Quantity = 0`, không bị loại
- [ ] User `ai_rec` query được bảng, **không** query được bảng khác
- [ ] AI-Rec trả về đúng định dạng `{customer_id, recommendations:[{product_id}]}`
- [ ] Checksum 3 tầng (Postgres / staging / warehouse) khớp số lượng và tổng tiền
