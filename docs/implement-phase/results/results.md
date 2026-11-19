# Kết quả thực hiện — Mục 2: Payment VietQR

> Cập nhật: 16/09/2026 · Hệ Ecommerce (`ktln-Getshopy`)
> Kế hoạch: [implement-plan-Sep13.md](../implement-plan/implement-plan-Sep13.md)

---

## 1. Trạng thái tổng thể

| Bước | Nội dung | Trạng thái |
|---|---|---|
| P1 | Schema + migration (20 bảng) | ✅ |
| P2 | `authB2C` — customer_id từ token | ✅ |
| P3 | Server tính lại toàn bộ tiền | ✅ |
| P4 | Giữ chỗ tồn kho atomic | ✅ |
| P5 | Sinh `payment_ref` + QR động | ✅ |
| P6 | Webhook SePay + đối soát | ✅ |
| P7 | Popup QR + đếm ngược + polling | ✅ |
| P8 | Job hết hạn + huỷ đơn | ✅ |
| P9 | Admin queue đối soát | ❌ [spec](admin-payment-queue-Sep13.md) |

**Luồng end-to-end chạy được**: đặt đơn → QR quét được bằng app ngân hàng →
chuyển khoản → webhook → `PAID` → trừ kho thật + tích điểm.

---

## 2. Lỗ hổng đã đóng

Đây là phần đáng kể nhất — phần lớn **không nằm trong kế hoạch ban đầu**, chỉ lộ
ra khi test hoặc khi chạy thật.

### 2.1 Nhóm chặn (đã có từ trước, payment làm chúng thành nguy hiểm)

| # | Lỗ hổng | Hệ quả nếu không sửa |
|---|---|---|
| 1 | Server nhận `total` từ `req.body` | Sửa DevTools `total: 1000` → QR 1.000đ cho iPhone → `PAID` |
| 2 | `/api/b2c/checkout` không có auth | Ai cũng `curl` tạo đơn, `customer_info` tự khai |
| 3 | Điểm thưởng nằm ở `localStorage` | Sửa DevTools → điểm vô hạn → tổng tiền về 0 |
| 4 | Voucher không giới hạn lượt | Một mã dùng mãi mãi, mọi khách |
| 5 | Tiền kiểu `Float` | Lệch khi so sánh, lệch kiểu với ClickHouse |
| 6 | **`GET /b2c/orders/me` không auth** | Gọi không kèm email → **trả về toàn bộ đơn hàng của mọi khách** |

### 2.2 Phát hiện qua test

| # | Lỗ hổng | Cách phát hiện |
|---|---|---|
| 7 | Đơn `PAID` nhưng voucher/điểm kẹt `HELD`, **không tích điểm** | test e2e lần đầu |
| 8 | Đơn COD bị bom hàng làm hàng **biến mất khỏi tồn kho vĩnh viễn** | rà vòng đời COD |
| 9 | `Order.items` là Json nhưng trang "Đơn hàng của tôi" đọc `order.items` | đọc code khi gắn nút huỷ |

### 2.3 Rà soát bảo mật sau khi luồng chạy được (13/09, đợt 2)

Sáu lỗ hổng, bốn cái **khai thác được thật** và đã đo bằng script:

| # | Lỗ hổng | Bằng chứng | Cách sửa |
|---|---|---|---|
| A | **DoS tồn kho** — không giới hạn đơn chờ thanh toán | 12 request đồng thời → 11 đơn PENDING, khoá 50 món, 0 đồng | Tối đa 3 đơn PENDING/khách, kiểm **trong transaction** + `pg_advisory_xact_lock` |
| B | **Điểm thưởng lời qua huỷ đơn** | điểm thật 100 → tích 135 → tiêu sạch 235 → huỷ → về 0 thay vì −135. Lời 135.000đ/vòng, lặp vô hạn | Chỉ tích điểm khi **GIAO THÀNH CÔNG** (`markDelivered`), không tích lúc đặt |
| C | `GET /orders/:id/payment-status` không auth | `order_id` dạng `ORD-{timestamp}` → đoán được, đọc tổng tiền + mã đối soát đơn người khác | `authB2C` + trả **404** thay vì 403 (403 xác nhận đơn tồn tại) |
| D | Webhook không kiểm tài khoản nhận | Tiền vào tài khoản khác vẫn làm đơn `PAID` | So `accountNumber` với `VIETQR_ACCOUNT_NO` |
| E | `JWT_SECRET` fallback `'istore_secret'` | Ai đọc repo cũng ký token giả cho mọi tài khoản | Bỏ fallback, thiếu env thì server không khởi động |
| F | Không có trạng thái `REFUNDED` | Admin hoàn tiền xong không có chỗ ghi, hoàn 2 lần được | Thêm `refunded_at/amount/by/ref/note` + route admin |

**Bẫy khi sửa A:** bản đầu đếm đơn PENDING *ngoài* transaction rồi mới tạo —
đúng kiểu check-then-act đã sửa cho tồn kho. 12 request đồng thời cùng đọc
`count=0`, lọt 10 đơn. Phải đưa vào trong transaction kèm advisory lock.

**Bẫy thứ hai:** `pg_advisory_xact_lock(int4, int4)` — Prisma bind số JS thành
bigint nên Postgres báo "function does not exist" và **mọi** checkout fail.
Phải cast `42::int, ${n}::int`.

### 2.4 Phát hiện khi chạy thật

| # | Vấn đề | Nguyên nhân |
|---|---|---|
| 10 | Popup QR không hiện | Frontend gửi `'VNPAY'`, backend chỉ nhận `'BANK_TRANSFER'` → rơi vào nhánh COD, **không lỗi nào báo ra** |
| 11 | **VietinBank không quét được QR** | Tag `01` EMVCo đặt `11` (QR tĩnh) trong khi QR có sẵn số tiền → phải là `12` (động) |
| 12 | Đồng hồ đếm ngược reset về 5:00 mỗi 3 giây | Client tính `min(displayTtl, reservationTtl)` = `min(300, 478)` = luôn 300 |
| 13 | **Đã chuyển tiền nhưng không có giao dịch nào về SePay** | VietinBank yêu cầu nội dung CK **bắt đầu bằng `SEVQR`** |
| 14 | Chữ ký HMAC sẽ luôn sai | SePay ký `{timestamp}.{body}`, adapter ký mỗi `body` |
| 15 | Rebuild xong vẫn thấy giao diện cũ | `index.html` không có `Cache-Control` → browser giữ bản cũ |
| 16 | Script giả lập báo thành công nhưng đơn không `PAID` | Script gửi API Key trong khi server ưu tiên HMAC → 401 |

**Điểm chung của #10, #13, #14, #16:** không có lỗi nào hiện ra ở bất kỳ đâu.
Mọi khâu đều báo "thành công", chỉ là kết quả không xảy ra. Đây là lý do phải có
`configCheck` in cấu hình thanh toán mỗi lần khởi động.

---

## 3. Vòng đời đơn hàng

### Chuyển khoản (QR)

```
t=0     đặt đơn  -> giữ chỗ kho (reserved +n), sinh QR + payment_ref
t=5'    đồng hồ khách hết -> QR mờ, đơn VẪN SỐNG
t=8'    hết hạn giữ chỗ -> job đóng đơn, nhả kho/voucher/điểm
```

Khoảng 5→8 phút là cố ý: chuẩn EMVCo không có trường hết hạn, khách quét ở phút
4:50 mà ngân hàng xử lý xong lúc 5:15 vẫn phải được nhận.

**Tiền về sau khi đơn đã đóng:**
```
đơn EXPIRED -> thử giữ chỗ lại
   ├─ còn hàng  -> PAID + LATE_MATCHED     (khách vẫn được nhận hàng)
   └─ hết hàng  -> REFUND_REQUIRED         (hàng đợi admin)
```

### COD

| | Chuyển khoản | COD |
|---|---|---|
| Kho lúc đặt | giữ chỗ | **trừ thật ngay** |
| Hết hạn | 8 phút | **không có** |
| Điểm | tích khi `PAID` | tích ngay |

COD không có hết hạn nên phải có đường huỷ thủ công —
`POST /api/b2c/orders/:id/cancel`.

---

## 4. Kiểm chứng

### Race condition tồn kho
```
10 request đồng thời / kho 3 món  ->  đúng 3 đơn thành công
reserved = 3 (không phải 10)
```

### Webhook đối soát — 20/20 pass
provider retry · khách chuyển 2 lần · sai số tiền · nội dung nhiều mã ·
đơn hết hạn còn hàng (`LATE_MATCHED`) · đơn hết hạn hết hàng (`REFUND_REQUIRED`) ·
webhook đến trước khi đơn kịp tạo (job re-match cứu)

### Chống sửa giá
```
client khai total=1.000đ cho iPhone 25.990.000đ
-> server tính 26.010.000đ, QR mang số thật, ghi log price_mismatch
```

### Hết hạn tự động (đơn `GSD2JVETSPK`)
```
PENDING -> EXPIRED · PENDING_PAYMENT -> CANCELLED
kho: reserved 1 -> 0, khả dụng 110 -> 111
log: [expire-job] đã đóng 1 đơn quá hạn
```

### Huỷ đơn
```
COD + voucher:  kho 110→108→110 · điểm 5006→5016→5006 · voucher 1→2→1
CK đã PAID:     kho 110→109→110 · thu hồi 6 điểm
                đơn CANCELLED/REFUND_REQUIRED
                giao dịch REFUND_REQUIRED — "Huỷ đơn: Hết hàng"
huỷ lần 2:      already=true, kho không đổi
```

### Bảo mật
```
/b2c/orders/me không token  -> 401  (trước: trả toàn bộ đơn của mọi khách)
/b2c/checkout không token   -> 401
webhook sai key             -> 401, ghi log kèm IP
huỷ đơn người khác          -> 403
```

---

## 5. Module đã viết

| File | Vai trò |
|---|---|
| `services/payment/vietqr.js` | Sinh chuỗi EMVCo + CRC-16/CCITT |
| `services/payment/paymentRef.js` | Mã đối soát, normalize, dò mã |
| `services/payment/pricingService.js` | Tính lại toàn bộ tiền từ DB |
| `services/payment/inventoryService.js` | Giữ chỗ tồn kho atomic |
| `services/payment/checkoutService.js` | Tạo đơn + QR |
| `services/payment/webhookService.js` | Đối soát giao dịch |
| `services/payment/orderLifecycle.js` | commit / expire / cancel |
| `services/payment/expireScheduler.js` | Job quét đơn quá hạn |
| `services/payment/configCheck.js` | Kiểm cấu hình lúc khởi động |
| `services/payment/banks.js` | Bảng BIN → tên ngân hàng |
| `services/payment/providers/sepay.js` | Adapter SePay (HMAC + API Key) |
| `services/payment/providers/simulator.js` | Adapter mô phỏng |
| `middleware/authB2C.js` | Xác thực khách hàng |
| `routes/payment.js` | Webhook, trạng thái, huỷ đơn |
| `scripts/seed-products-inventory.js` | Seed 26.262 sản phẩm + tồn kho |
| `scripts/simulate-payment.sh` | Giả lập SePay |
| `components/b2c/PaymentQRModal.jsx` | Popup QR |

---

## 6. Luồng admin (13/09, đợt 2)

| Route | Vai trò |
|---|---|
| `GET /api/b2b/payments/queue` | Hàng đợi `REFUND_REQUIRED` / `UNMATCHED` / `DUPLICATE` |
| `POST /api/b2b/payments/:id/refund` | Ghi nhận đã hoàn tiền → `REFUNDED`, chặn hoàn 2 lần |
| `POST /api/b2b/orders/:id/delivered` | Đánh dấu đã giao → **tích điểm**, COD ghi nhận đã thu tiền |

Kiểm chứng:
```
hàng đợi        1 giao dịch REFUND_REQUIRED 610.000đ
hoàn tiền       -> đơn REFUNDED, giao dịch REFUNDED, ghi refund_ref + admin id
hoàn lần 2      -> "Giao dịch này đã được hoàn tiền"
token khách     -> 403
```

## 7. Còn lại

- ~~**Giao diện admin** cho hàng đợi đối soát~~ → xong, `components/admin/PaymentQueue.jsx`, gắn trong `Reconciliation.jsx` — [spec](admin-payment-queue-Sep13.md)
- **`local-infra-sandbox/.env`** chứa password thật, thư mục chưa có `.gitignore`
- **`wal_level=logical`** chưa bật trên Postgres → mục 3 chưa chạy CDC được
- **Phase 2.0** — gộp 37 script seed one-off
- **Giao dịch thật `GSA3G3SBC7Q` (100.000đ)** chuyển trước khi có `SEVQR`, SePay
  không ghi nhận nên không tự đối soát được — cần xác nhận tay khi có admin queue

---

## 8. Hạn chế đã biết — `province` không tới nhánh lạnh

Thêm cột `Order.province` (migration `add_order_province`) để báo cáo theo vùng.
Cột chảy tới nhánh nóng bình thường nhưng **không tới nhánh lạnh**.

Đã khoanh vùng:

| Tầng | Có `province`? |
|---|---|
| Postgres | ✅ |
| Kafka message | ✅ `'HCM'`, đủ 16 cột |
| **parquet trên MinIO** | ❌ chỉ 15 cột |
| ClickHouse staging | ❌ đọc ra rỗng |
| `realtime.orders_live` | ✅ (đọc thẳng Kafka) |

Đứt ở **S3 Sink connector**. Đã thử và đều không được: restart source connector,
xoá + tạo lại source, đổi `schema.compatibility` từ `NONE` sang `BACKWARD`,
restart sink task, `schema_inference_mode='union'` phía ClickHouse,
`SYSTEM DROP SCHEMA CACHE`, xoá + tạo lại sink kèm xoá consumer group.

**Bài học:** thêm một cột vào Postgres KHÔNG tự chảy hết đường ống. Nhánh
realtime nhận ngay vì đọc thẳng JSON; nhánh lakehouse thì không, vì parquet có
schema cố định tại thời điểm ghi. Và **không có lỗi nào báo ra** — cột chỉ rỗng.

Hướng chưa thử: chuyển từ JsonConverter sang **Avro + Schema Registry** — đó là
cách chuẩn để xử lý schema evolution trong CDC, nhưng thêm một service.

**Ảnh hưởng:** báo cáo theo vùng ở nhánh lạnh không dùng được. Nhánh nóng có đủ,
hoặc join `masterdata.dim_customers`. Không chặn luồng nào khác.

---

## 9. Giao diện (14/09)

Ba yêu cầu: sidebar trang khách tự ẩn, làm lại popup QR, và đưa dashboard về
tông trắng đen.

### 9.1 Sidebar tự ẩn — `components/b2c/StoreLayout.jsx`

Thêm dải cảm ứng `12px` sát mép trái; rê chuột vào thì sidebar trượt ra, rời
chuột thì thu lại.

Hai chỗ dễ sai, đều đã xử lý:

**Không đẩy nội dung khi tự mở.** Tách `contentOffset` khỏi `currentWidth`:
chiều rộng sidebar đổi theo hover, nhưng lề trái của nội dung chỉ theo trạng
thái ghim. Dùng chung một biến thì mỗi lần con trỏ lướt qua mép màn hình cả
trang bị giật ngang — sidebar nổi đè lên là đúng hơn.

**Nút "Thu gọn" nằm bên trong sidebar.** Bấm xong con trỏ vẫn trong vùng
sidebar nên `onMouseLeave` không chạy, `sidebarOpen = !collapsed || hovered`
vẫn ra `true` và sidebar đứng nguyên tại chỗ. Phải `setSidebarHovered(false)`
ngay trong `onClick`. Sau đó con trỏ không rời phần tử nên cũng không có
`mouseenter` mới — trạng thái giữ đúng là đã thu gọn.

### 9.2 Popup QR — `components/b2c/PaymentQRModal.jsx`

Viết lại phần hiển thị, **giữ nguyên** logic polling và đồng hồ theo giờ server.
Đồng hồ thành viên nhộng + thanh tiến trình, QR có 4 góc ngắm, khối tách giá và
khối thông tin chuyển khoản gọn lại, nút "Sao chép" đảo màu khi hover.

Mốc đầy của thanh tiến trình giữ trong `useRef`, không phải state — server trả
về số nhỏ dần thì thanh không bị "đầy lại" giữa chừng.

### 9.3 Tông đơn sắc cho khu admin

| File | Vai trò |
|---|---|
| `theme/monochrome.js` *(mới)* | Bảng màu + thang xám 7 bậc cho biểu đồ + token antd |
| `components/AppLayout.jsx` | `ConfigProvider` lồng, khung admin trắng/đen |
| `pages/Dashboard.jsx` | Thẻ KPI, 4 biểu đồ ECharts, bảng xếp hạng |

**Vì sao `ConfigProvider` lồng chứ không sửa `App.jsx`.** Token ở `App.jsx`
(`colorPrimary: '#10b981'`) dùng chung với gian hàng B2C. Đổi ở gốc thì toàn bộ
nút, link, badge phía khách cũng mất màu — ngoài phạm vi yêu cầu. `AppLayout`
bọc thêm một `ConfigProvider` nên chỉ `/admin` đổi tông. Các lớp dùng chung
(`.glass-panel`, `.ambient-glow` — đang gắn viền vàng và nền phát sáng xanh)
được ghi đè trong phạm vi `.admin-mono`, không sửa `App.css`.

**Nguyên tắc chuyển màu → xám.** Bỏ màu thì mọi tín hiệu ngữ nghĩa dựa vào sắc
độ đều mất, nên phải chuyển sang mã hoá khác:

| Trước | Sau | Lý do |
|---|---|---|
| Tăng xanh / giảm đỏ | Viên nhộng **đặc** / **rỗng** | Đỏ và xanh quy về cùng mức xám |
| Đồng hồ QR đỏ khi sắp hết | **Đảo nền** đen-trắng | Nhấn bằng tương phản, không bằng sắc độ |
| Cột xanh + đường vàng | Cột xám + đường **nét đứt** | Cùng thang xám thì hai chuỗi dính vào nhau |
| Top 3 chữ vàng | Huy hiệu đảo nền | Vàng tụt xuống gần bằng xám nhạt |
| Chi nhánh cùng một màu | **Bậc xám theo hạng** | Thứ hạng đọc được cả khi bỏ nhãn |

**Ngoại lệ có chủ ý:** giữ đỏ cho thao tác nguy hiểm (`colorError`) và dòng tiền
ròng âm. Bỏ hẳn tín hiệu đỏ thì nút xoá nhìn y hệt nút thường — đó là rủi ro
vận hành, không phải lựa chọn thẩm mỹ.

**Chưa làm:** `pages/Login.jsx` vẫn còn gradient xanh. Trang này render *ngoài*
`AppLayout` nên `ConfigProvider` lồng không với tới.

### 9.4 Lỗi cú pháp chặn toàn bộ bản build — `services/api.js`

Thiếu một dấu phẩy sau object `b2c`:

```js
    getWishlist: (customerId) => request(...),
  }          // ← thiếu dấu phẩy

  payments: { ... }
```

`npm run build` dừng ở `[vite:define] Expected "}" but found "payments"`.

Nghĩa là **khối `api.payments` chưa từng vào được bản production** — phần admin
đối soát ở §6 trước đó chỉ chạy qua dev server. Lỗi này không lộ ra khi test thủ
công vì dev server nạp module khác đường với bản build.

**Bài học:** test một tính năng qua dev server không chứng minh nó build được.
Việc chạy `docker compose build client` sau khi sửa là bước bắt buộc, không phải
tuỳ chọn.

---

## 10. Còn lại sau 14/09

- ~~`pages/Login.jsx` chưa đổi tông~~ → xong (§11.4)
- Tồn kho theo chi nhánh — đang mỗi sản phẩm một dòng tồn, chưa tách theo
  `branch_id` (đã thống nhất hoãn)
- `province` chưa tới nhánh lạnh (§8)

---

## 11. Đăng nhập B2C + Google OAuth (15/09)

### 11.1 🔴 Lỗ hổng chiếm tài khoản ở `/api/b2c/auth/social`

Bản cũ nhận `email` **thẳng từ `req.body`** rồi cấp JWT cho email đó, không xác
thực gì:

```js
const { provider, email, full_name, avatar } = req.body;   // `token` không hề được đọc
let user = await prisma.b2CCustomer.findUnique({ where: { email } });
const token = jwt.sign({ id: Number(user.id), role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
```

Khai thác chỉ cần một dòng:

```
POST /api/b2c/auth/social  {"provider":"google","email":"<email nạn nhân>"}
-> JWT hợp lệ 7 ngày với tư cách khách hàng đó
```

Chiếm được là đọc đơn hàng, địa chỉ, số điện thoại, tiêu điểm thưởng. Email chưa
tồn tại thì endpoint **tự tạo tài khoản mới**.

Hai nút Facebook / Apple ở `AuthModal` khai thác đúng đường này để demo: chúng
không gọi Facebook hay Apple, chỉ bịa `facebook_1234@example.com` gửi lên.

**Vì sao không ai phát hiện:** endpoint *trông như* đang xác thực — client có
gửi `token: tokenResponse.access_token`. Nhưng server destructure
`{ provider, email, full_name, avatar }`, không có `token`. Biến bị bỏ quên
lặng lẽ, không cảnh báo, không lỗi. Luồng Google thật vì thế cũng **chưa từng
chạy được**: `email` là `undefined` → `findUnique({where:{email: undefined}})`
→ Prisma ném lỗi → 500.

### 11.2 Bản vá — chỉ tin danh tính lấy từ token đã verify

Dùng `google-auth-library` (đã có sẵn trong `package.json`, `^11.0.2`):

| Bước | Chặn được gì |
|---|---|
| `verifyIdToken` kiểm chữ ký bằng khoá công khai Google | Token tự chế |
| `audience: GOOGLE_CLIENT_ID` | Token Google phát cho **app khác** — chữ ký vẫn đúng, chỉ là không dành cho ta |
| `payload.email_verified === true` | Tài khoản Google đăng ký email người khác nhưng chưa xác minh |
| Danh sách provider **cho phép** (chỉ `google`) | Mọi provider giả |

Email **luôn** lấy từ `ticket.getPayload()`, không bao giờ từ `req.body`.

Thiếu `GOOGLE_CLIENT_ID` thì trả 503 — **không** rơi về chế độ tin dữ liệu
client gửi lên. Một fallback "cho tiện lúc dev" ở đây chính là lỗ hổng cũ.

Kiểm chứng (đặt Client ID giả để ép chạy đường verify):

```
email trong body, không credential          -> 400 "Thiếu credential từ Google"
credential rác                              -> 401 "Token không hợp lệ"
JWT đúng định dạng, aud/iss/exp đúng,
email_verified=true, CHỮ KÝ GIẢ             -> 401 "Token không hợp lệ"   <- quan trọng nhất
provider=facebook                           -> 400 "Không được hỗ trợ"
đăng nhập email/mật khẩu thường             -> 200, JWT bình thường
```

Case thứ ba chứng minh chữ ký thật sự được kiểm, không phải chỉ kiểm trường.

### 11.3 Nối biến môi trường

`VITE_*` được Vite nhúng vào bundle **lúc build**, không đọc lúc chạy. Đường dẫn
phải liền mạch, đứt một mắt là biến ra chuỗi rỗng mà không có lỗi nào:

```
.env  ->  docker-compose.yml (build.args)  ->  client/Dockerfile (ARG+ENV)  ->  Vite
.env  ->  docker-compose.yml (env_file)    ->  server (process.env)
```

Trước đó `client/Dockerfile` chỉ khai `ARG VITE_API_URL` và `VITE_WS_URL`, nên
dù `.env` có Client ID thì bản build vẫn ra rỗng.

`VITE_GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_ID` là **cùng một giá trị**, lệch nhau
thì server từ chối mọi token vì `aud` không khớp.

Client ID **không phải secret** — nó nằm công khai trong bundle trình duyệt theo
đúng thiết kế OAuth. Client *secret* mới là bí mật, và luồng ID token không dùng
tới nó.

Chưa cấu hình thì `AuthModal` **ẩn** nút Google thay vì hiện nút bấm vào báo lỗi.

### 11.4 Giao diện

- `AuthModal.jsx` — thay `useGoogleLogin` bằng component `GoogleLogin` (trả
  `credential`), gỡ hai nút Facebook / Apple cùng nhánh xử lý provider giả.
- `pages/Login.jsx` — viết lại theo tông đơn sắc, dùng chung `theme/monochrome.js`
  và `ConfigProvider` lồng (trang này render *ngoài* `AppLayout` nên không thừa
  hưởng token). Tiện thể sửa nút đổi ngôn ngữ: bản cũ đặt cứng `color: '#fff'`
  nên ở nền sáng là chữ trắng trên nền trắng.

### 11.5 Ranh giới authen / author — client không phải chỗ để kiểm

Ghi lại vì đã hỏi trong lúc làm:

| Tầng | Làm gì | Có phải bảo mật? |
|---|---|---|
| Client | Ẩn/hiện UI, redirect, giữ token | **Không** — chỉ trải nghiệm |
| Server | Verify chữ ký JWT, lấy `customer_id` **từ token**, kiểm quyền mỗi request | **Có** |

Client là mã chạy trên máy người dùng; `localStorage` và React state đều sửa
được trong DevTools. `ProtectedRoute` chỉ quyết định *vẽ component nào*, không
chặn được `curl` gọi thẳng API.

Chính lỗ hổng §11.1 là minh hoạ: nút Google nằm ở client, nhưng kẻ tấn công
không cần bấm nút — họ gọi thẳng endpoint. Cùng một bài học với `/orders/me`
ở §2.3.

**Quy tắc:** client quyết định người dùng *thấy* gì, server quyết định họ
*lấy được* gì.

### 11.6 Việc người dùng phải tự làm

1. Google Cloud Console → APIs & Services → Credentials → Create credentials →
   OAuth client ID → **Web application**
2. Authorized JavaScript origins: `http://localhost:3000`
3. Điền **cùng một Client ID** vào `VITE_GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_ID`
   trong `.env`
4. `docker compose build client && docker compose up -d client server`
   — phải **build lại** client, không chỉ restart, vì Vite nhúng lúc build.

### 11.7 Dữ liệu rác còn lại

`B2CCustomer` còn một bản ghi `google_user_4224@example.com` (provider
`google`) do đường không xác thực cũ tạo ra lúc test. Không ảnh hưởng gì, nhưng
nên xoá cho sạch số liệu — chưa xoá vì đó là thao tác xoá dữ liệu.

---

## 12. Nối AI-Rec vào warehouse (16/09)

Trước hôm nay luồng đứt ở chặng cuối: warehouse đã mở đúng hợp đồng §4, nhưng
AI-Rec **không có dòng code nào gọi ClickHouse**. Ba biến `CLICKHOUSE_*` vẫn
được compose truyền vào container và bị bỏ qua hoàn toàn — dây nối sẵn, đầu kia
chưa cắm. Service chạy degraded, mọi gợi ý trả mảng rỗng.

### 12.1 Đổi `processed_data_for_AI_rec` sang append-only

Chuyển sang append-only + ReplacingMergeTree theo yêu cầu dedup theo `updated_at`.

> **Đính chính (28/09).** Bản trước của mục này ghi lý do là *"`table` DROP rồi
> CREATE lại, có khoảng bảng rỗng mà AI-Rec có thể đọc trúng"*. **Điều đó sai.**
> Kiểm `system.query_log` cho thấy dbt-clickhouse dựng bảng `table` theo bốn
> bước: `CREATE … __dbt_backup` → `INSERT` → **`EXCHANGE TABLES`** → `DROP` bản
> cũ. Trên database engine `Atomic` (mặc định của ClickHouse 24.8), `EXCHANGE`
> là thao tác nguyên tử — không có khoảnh khắc nào bảng rỗng.
>
> Lý do đúng để dùng incremental ở đây là **chi phí**: `table` dựng lại toàn bộ
> tập cặp (khách, sản phẩm) mỗi 5 phút, còn incremental chỉ tính lại các cặp
> vừa có đơn mới. Với bảng nhỏ như hiện tại thì chênh lệch không đáng kể.

Bản mới:

```
materialized         = 'incremental'
incremental_strategy = 'append'
engine               = 'ReplacingMergeTree(updated_at)'
order_by             = '(CustomerID, ProductID)'
```

Ba điểm thiết kế:

**Tính lại trên toàn bộ lịch sử của cặp bị đụng, không cộng dồn phần mới.**
Cộng dồn là sai: một dòng fact bị *sửa* (đơn chuyển sang huỷ, số lượng thay
đổi) sẽ bị tính hai lần. Cách làm là tìm các cặp có dòng fact nạp sau mốc
(`_loaded_at > max(updated_at)`), rồi `GROUP BY` lại trên **cả** lịch sử của
riêng chúng.

**`LEFT JOIN` chứ không phải `INNER`.** Một cặp vừa thay đổi có thể không còn
thoả điều kiện nữa. Lúc đó nhánh tính lại không sinh dòng nào, và nếu bỏ qua
thì dòng cũ nằm lại vĩnh viễn — model vẫn học một tương tác đã bị huỷ. Ghi
`Quantity = 0` làm bia mộ mềm, đúng quy ước "không có thông tin số lượng → xem
như 0" trong contract, và `fit()` lọc `Quantity > 0` nên dòng đó tự rụng.

**Đọc bắt buộc kèm `FINAL`.** Quên là một cặp hiện ra nhiều lần với số lượng
khác nhau — không có lỗi nào báo ra, chỉ là model train trên dữ liệu sai.

`OPTIMIZE ... FINAL` đặt ở job ofelia **hàng giờ** trên container ClickHouse,
không phải `post_hook` của dbt: dbt chạy mỗi 5 phút mà `OPTIMIZE FINAL` đọc và
ghi lại toàn bộ bảng.

### 12.2 AI-Rec: đọc warehouse + train nền + đổi bản

| File | Vai trò |
|---|---|
| `config.py` | Cấu hình ClickHouse, chu kỳ train, cache |
| `data_source/clickhouse.py` *(mới)* | Gọi HTTP interface, đọc `TabSeparatedWithNames` |
| `api/service.py` | `ModelBundle` + vòng train nền + đổi bản |

**Vì sao fetch toàn bộ chứ không lấy phần chênh.** Bảng nguồn là bảng tổng hợp
— grain một dòng cho mỗi cặp. Khách mua lại một sản phẩm thì dòng **cũ** bị đổi
số lượng, không phải thêm dòng mới. Lấy "các dòng mới hơn lần trước" bỏ sót
đúng những thay đổi đó, và sai im lặng.

**`ModelBundle` gói model + cache vào một đối tượng.** Nếu để rời thì có
khoảnh khắc model đã là v2 còn cache vẫn của v1 — request rơi đúng đó nhận gợi
ý trỏ tới sản phẩm không còn trong catalog. Đổi cả gói bằng **một phép gán**
thì không tồn tại trạng thái lai; phép gán atomic nhờ GIL.

Trong suốt lúc train v2, **v1 vẫn phục vụ bình thường**. Bản cũ chỉ được giải
phóng khi request cuối cùng đang cầm nó kết thúc — Python đếm tham chiếu, không
cần ép thu gom.

**`asyncio.to_thread` là bắt buộc.** Train và tính sẵn đều nặng CPU; chạy thẳng
trong vòng lặp sự kiện sẽ treo toàn bộ API cho tới khi xong.

**Tính sẵn có trần thời gian.** Quá hạn thì dừng, khách còn lại rơi về tính tại
chỗ. Cache là *tối ưu*, không phải điều kiện đúng đắn — thiếu đường dự phòng
thì khách vừa mua lần đầu không có gợi ý suốt cả chu kỳ.

**Lưu model:** ghi file tạm rồi `os.replace` — đổi tên là thao tác nguyên tử
trên cùng hệ thống tệp. Ghi đè thẳng mà tiến trình chết giữa chừng sẽ để lại
`.joblib` cụt, và lần khởi động sau nạp phải nó.

### 12.3 Kiểm chứng end-to-end

Chèn một đơn `PAID` mới (khách 5, hai sản phẩm 40800/40801, mỗi thứ 4 cái):

```
Postgres     -> đơn ORD-E2E-TEST-001
staging      -> 20 đơn, 15 dòng hàng   (parquet đã có)
fact FINAL   -> 14 dòng
serving thô  -> 8 dòng      <- append-only ghi thêm
serving FINAL-> 6 dòng      <- ReplacingMergeTree gộp lại
   trong đó 40768 có Quantity = 0  <- bia mộ mềm hoạt động

AI-Rec: v2 (2 tương tác) --[chu kỳ 5 phút, KHÔNG restart]--> v3 (5 tương tác)
```

Vòng train nền tự nhặt đơn mới. 5 tương tác chứ không phải 6 vì dòng
`Quantity = 0` bị lọc ở nguồn — đúng thiết kế.

Gợi ý:

```
khách 5      -> []                      <- đã mua HẾT 5 sản phẩm model biết
khách 99999  -> 5 sản phẩm phổ biến     <- cold-start
qua server   -> trả sản phẩm            <- đường FE đi
```

Kết quả rỗng của khách 5 **không phải lỗi**: catalog của model mới có 5 sản
phẩm (vì warehouse mới có 5 cặp), và khách đó đã mua cả 5. `recommend()` loại
sản phẩm đã mua, phần bù bằng `popular_items` cũng loại. Có thêm khách và đơn
là tự hết.

### 12.4 Hai lỗi đóng gói bắt được lúc chạy

- `Dockerfile` không `COPY data_source/` — image build thành công nhưng
  container chết ngay lúc import.
- Volume `ai_models` do root sở hữu còn tiến trình chạy bằng `appuser` →
  `Permission denied` khi ghi model. Không làm chết service (bản trong bộ nhớ
  vẫn chạy) nên rất dễ bỏ sót: nó chỉ lộ ra ở lần khởi động sau, khi không có
  gì để nạp lại. Docker chỉ sao chép quyền sở hữu từ image sang volume lúc
  volume còn **rỗng**, nên phải `mkdir` sẵn thư mục trong Dockerfile *trước*
  `chown`, và vá tay volume đã tồn tại.

### 12.5 Còn lại

- `fit()` train lại toàn bộ mỗi chu kỳ — CF item-based không tăng dần được.
  Hiện rẻ (mili-giây) vì `fit()` chỉ dựng ma trận thưa và chuẩn hoá, **không**
  nhân ma trận item×item. Cần đo lại khi số tương tác lên hàng triệu.
- Đỉnh bộ nhớ gấp đôi trong lúc đổi bản — chưa đo ở quy mô thật.

---

## 13. Sửa nạp tăng dần của `fact_orders_detail` (29/09)

### 13.1 Triệu chứng

Sửa snapshot hãng/danh mục của 335 dòng `OrderItem` (7 sản phẩm Apple bị gán
sai hãng). Bản ghi `op=u` đi đủ Kafka → parquet → `staging.stg_order_items`,
nhưng **fact vẫn giữ giá trị cũ**. Không có lỗi nào báo ra.

### 13.2 Nguyên nhân — hai lỗi cùng họ

**(1) Lọc hai nguồn riêng rẽ theo mốc.** Model cũ cắt cửa sổ `event_ts >= mốc`
cho `stg_orders` và `stg_order_items` *độc lập*, rồi `LEFT JOIN`. Thay đổi một
phía là mất:

| Thay đổi | Cửa sổ Order | Cửa sổ OrderItem | Kết quả |
|---|---|---|---|
| chỉ dòng hàng (sửa snapshot) | trống | có | JOIN hụt → `WHERE` loại → **mất** |
| chỉ đơn (PENDING → PAID) | có | trống | không có dòng nào để ghi → **mất** |

Chạy lại logic cũ trên đúng dữ liệu lake của bài thử 13.4: 1 đơn + 1 dòng hàng
trong cửa sổ → **0 dòng fact**.

**(2) Một mốc chung cho hai nguồn.** Mốc cũ = `max(greatest(ts dòng hàng, ts đơn))`.
Sink xả parquet của hai topic ở hai thời điểm khác nhau, nên nguồn đi trước kéo
mốc vượt qua bản ghi của nguồn đi sau chưa kịp xuống MinIO → bản ghi đó **không
bao giờ** được nạp. Không phải giả định: ngay sau full-refresh, mốc đơn là
`01:52 29/09`, mốc dòng hàng là `17:40 28/09` — lệch 8 giờ.

Comment cũ trong model ("lần chạy sau bắt được vì watermark chưa vượt qua nó")
sai vì cả hai lý do trên.

### 13.3 Bản sửa

- **Theo đơn:** gom `changed` = đơn có bản ghi mới ở *bất kỳ* nguồn nào; với các
  đơn đó lấy bản mới nhất của đơn và của **mọi** dòng hàng trên toàn bộ lịch sử.
- **Mốc riêng từng nguồn:** thêm 2 cột `_order_event_ts`, `_item_event_ts`.
  Mỗi topic có 1 partition, 1 task sink ghi theo thứ tự offset, và `ts_ms` của
  Debezium là giờ connector xử lý nên tăng theo offset → bản ghi chưa xuống lake
  luôn có `ts >=` mốc của chính nguồn đó.[^kafka-order]
- `_event_ts` (version của ReplacingMergeTree) giữ nguyên công thức.
- **Chặn bảng cũ:** bảng dựng trước bản sửa không có 2 cột mốc → model báo lỗi
  kèm lệnh cần chạy, thay vì lỗi ClickHouse khó đọc. Máy khác kéo code về mà còn
  volume cũ thì chạy **một lần**:
  `docker compose --profile dbt run --rm dbt run --full-refresh --select fact_orders_detail+`

[^kafka-order]: Kafka chỉ đảm bảo thứ tự *trong một partition* (Apache Kafka
Documentation, §Design). `ts_ms` ở envelope là thời điểm connector xử lý sự kiện
(Debezium PostgreSQL Connector Documentation, §Data change events).

### 13.4 Kiểm chứng

| Kiểm tra | Trước | Sau |
|---|---|---|
| Sản phẩm 1–7 trong fact `FINAL` | 6/7 sai hãng (anker, nokia, oppo, lg…) | 7/7 `br-apple`, đúng danh mục, khớp Postgres |
| Số dòng / số đơn / tổng `net_amount` | 6262 / 3509 | 6262 / 3509 / 154 649 475 200 — khớp Postgres |
| `audit.checksum_orders` | — | `KHỚP` cả 3 tầng |
| Chỉ dòng hàng đổi (`quantity = quantity`) | logic cũ: 0 dòng | cả đơn ghi lại, `_item_event_ts` mới |
| Chỉ đơn đổi (`status = status`) | logic cũ: 0 dòng | 3/3 dòng hàng ghi lại, `_order_event_ts` mới |
| `dbt build` | — | 36/36 PASS |

Bài thử dùng cập nhật không đổi giá trị (`SET x = x`) — Postgres vẫn ghi WAL
nên Debezium vẫn phát `op=u`, dữ liệu không bị đụng.

### 13.5 Đánh đổi và hạn chế

- **Chi phí:** glob `s3()` không cắt tỉa theo thời gian nên mỗi lần chạy vốn đã
  mở mọi file parquet; lọc theo `order_id` không tăng số file phải đọc (hiện 55
  file, model chạy ~0,2 s). Khi lake lớn, hướng đúng là tầng trung gian đã dedup
  (bảng ClickHouse) thay vì đọc lại parquet — chưa làm.
- Mốc dùng `>=` nên mỗi lượt ghi lại vài đơn nằm đúng mốc (đo được 13 dòng /
  lượt khi không có thay đổi). ReplacingMergeTree khử, job `ch-optimize` gộp.
- **Xoá lẻ một `OrderItem` không lan tới fact:** bảng để `REPLICA IDENTITY
  DEFAULT`, bản ghi xoá chỉ mang khoá chính, không có `order_id` để lần về đơn.
- **Xoá cả đơn chỉ lan khi đọc `FINAL`:** bản xoá không có `date` nên rơi vào
  partition `197001`, khác partition của bản gốc. `SELECT … FINAL` mặc định vẫn
  khử trùng *xuyên* partition (đã thử trên bảng tạm: 0 dòng), nhưng merge nền và
  `OPTIMIZE FINAL` chỉ gộp *trong* partition → bản gốc không bao giờ bị dọn vật
  lý, và bật `do_not_merge_across_partitions_select_final=1` thì đơn đã xoá hiện
  lại. Nghiệp vụ hiện chỉ huỷ đơn (đổi trạng thái), không xoá, nên chưa sửa.

---

## 14. Onboarding → content-based → benchmark trung thực (28–29/09)

### 14.1 Sinh lại catalog cân bằng — `server/scripts/fill-600k.js`

Catalog cũ không dùng được cho content-based:

| Vấn đề | Nguyên nhân |
|---|---|
| 600.000 món mà chỉ 6 món là điện thoại/laptop/tablet, 0 đồng hồ | Chỉ lấy danh mục có `parent_id`; 4 nhóm thiết bị không có con nên bị loại |
| `br-kamera` chiếm 41% | Hãng không có trong `BRAND_CAT_MAP` được coi là làm MỌI danh mục; 9 danh mục không hãng nào map |
| Ốp lưng 40 triệu, laptop 200 nghìn | Giá rải đều 150k–50tr cho mọi danh mục → đặc trưng "tầm giá" vô nghĩa |

Bản mới: thiết bị 40% (4 nhóm × 10%), phụ kiện/nghe nhìn/camera 60% (4 × 15%); trong
nhóm chia đều cho danh mục lá, trong danh mục chia đều cho hãng; trần 10% mỗi hãng;
giá log-uniform trong khoảng riêng từng danh mục (ƯỚC LƯỢNG cho dữ liệu tổng hợp,
ghi rõ trong code); thiếu cấu hình thì dừng thay vì lấy ngẫu nhiên; `--dry-run`.

Chỉ thay món CHƯA AI MUA: giữ 82 món có đơn (gồm 8 món flash sale), xoá 599.918 món +
1.200.010 dòng tồn kho trong một transaction có chốt kiểm (backup trước:
`backups/kltn-20260929-pre-catalog.dump`), sinh lại, `ensure-inventory.js`.
Kết quả: đúng tỉ trọng từng nhóm, hãng lớn nhất Xiaomi 5,8%, 0 món thiếu tồn kho.

- `analytics.user_events` (22.255 sự kiện, TẤT CẢ do `seed-behavior-data.js` sinh
  ngày 17/09) trỏ vào món bị xoá → seed lại; script chuyển sang RNG có hạt giống.
- `VACUUM` trên `Product` lỗi `No space left on device`: `/dev/shm` của container
  Postgres mặc định 64 MB, VACUUM song song cần 67 MB. Chạy `VACUUM (PARALLEL 0)`.
  Nên đặt `shm_size: 256mb` cho service postgres — chưa sửa compose.
- Onboarding hiển thị tới 14 hãng/nhóm, xếp theo số bán rồi số mặt hàng: catalog mới
  chia đều nên xếp theo số mặt hàng thì hoà gần hết và giấu mất hãng lớn.

### 14.2 Hợp đồng dữ liệu mới cho AI-Rec (dbt)

```
Postgres CustomerPreference ─postgresql()─▶ masterdata.dim_customer_preferences
                                                   │ làm sạch (bỏ skipped, trùng, mồ côi,
                                                   ▼  vừa thích vừa ghét → giữ ghét)
                                     serving.customer_preference_signals   (BẢNG)
masterdata.dim_products/categories/brands ─▶ serving.catalog_features (600k, định nghĩa PriceBand)
                                                   ▼ + doanh số, top 20/ô + mọi món đã bán
                                     serving.product_features (6.152 ứng viên)
```

- `customer_preference_signals` phải là **bảng**: view thường của ClickHouse kiểm
  quyền bảng gốc theo người gọi, `ai_rec` chỉ có quyền `serving` → Code 497. Cấp
  thêm `masterdata` là mở cả `dim_customers` cho một dịch vụ không cần.
- Tầm giá là var `price_bands` trong `dbt_project.yml`, phải khớp `PRICE_BANDS` của
  `routes/onboarding.js` (ghi chú chéo ở cả hai nơi).
- +15 test dbt (unique/not_null/accepted_values/relationships + test không mâu thuẫn); `dbt build` 55/55 PASS.

### 14.3 AI-Rec: hybrid có trọng số

`final = α·CF + (1−α)·CB + γ·mua_lại`, `α = n/(n+k)` — `models/hybrid.py`,
`models/content_based.py`, nguồn trích trong docstring.

- **Lọc cứng** danh mục/hãng "không quan tâm" trên MỌI kênh, kể cả CF và mua lại.
- Chỉ gợi ý món còn bán (tập ứng viên từ `product_features`); thiếu bảng đặc trưng thì
  chạy thuần CF và `/health` báo `content_based: false` + `last_error`.
- Response thêm `reason` (`cf | content | repeat | popular`), mặc định rỗng — server
  Node chỉ đọc `product_id` nên không phải sửa.
- Artifact mới `output/hybrid/recommender.joblib` (ghi file tạm + `os.replace`); lần
  đầu nâng cấp tự bọc `item_cf.joblib` cũ.
- `tests/test_api.py` cũ đã hỏng từ trước (gọi `service.model` không còn tồn tại) —
  viết lại; +10 test hybrid. 16/16 pass.

Kiểm chứng đầu-cuối qua API thật: `user0001` (khách 32) lưu onboarding "không quan
tâm `cat-mobile-acc`" bằng `PUT /api/b2c/me/preferences` → dbt → AI-Rec train lại →
top-10 từ **7/10** món `cat-mobile-acc` còn **0/10**. Đã xoá bản ghi thử sau đó.

### 14.4 Benchmark — `ai-rec/evaluation/`

Giao thức, bảng kết quả, hạn chế: `ai-rec/evaluation/README.md`. Tóm tắt (NDCG@10):

| | Most-Popular | Item-CF | Content-based | Đang chạy (k=0, γ=1) |
|---|---|---|---|---|
| Khám phá món mới | 0,141 | **0,350** | 0,123 | 0,258 |
| Tổng thể | 0,149¹ | 0,156 | 0,057 | **0,309** |
| Khách mới mô phỏng | 0,139 | — | **0,186**² | — |

¹ bản gợi ý cả món đã mua · ² onboarding giả lập từ lịch sử thật (cận trên)

Đọc đúng: CF học được cấu trúc đồng mua (gấp 2,5 lần Most-Popular). Content-based
không giúp khách đã có lịch sử — **do bộ sinh dữ liệu**: gu khách là lát `product_id`
liên tiếp, không theo danh mục/hãng/giá. 63,5% món ở test là món đã mua, nên chỉ số
tổng thể thưởng việc gợi ý lại đồ cũ; mức gợi ý lại (γ) là quyết định sản phẩm.

### 14.5 Chờ quyết định

- Chính sách gợi ý lại (γ, hoặc chia ô cố định) và k — bảng đánh đổi ở README đánh giá.
- Có sửa `pos_simulator.py` để khách mua theo sở thích danh mục/hãng/giá hay không —
  không có thì không đo được content-based trên dữ liệu này.
- `server/prisma/migrations/` đang bị gitignore: máy clone mới rơi về `db push`, lịch
  sử migration khác máy này. Có từ trước hôm nay.

## 15. AI-Rec: tinh chỉnh time-decay, kênh mua lại theo đơn, vá tracking (01/10)

### 15.1 Chẩn đoán lại dữ liệu

- **Cú đổi gu có thật, do chính cách sinh dữ liệu.** 3.490 đơn POS đến từ 5 lần chạy
  `pos_simulator.py` bằng tay (16–17/09), mỗi lần một `--seed` và một khoảng ngày riêng.
  Chạy lại `build_orders` với đúng tham số tái tạo 3.490/3.490 đơn. Tập món trước/sau 10/09
  của cùng khách: Jaccard trung vị 0,07. Bản 29/09 ghi "thời gian không mang thông tin" — sai,
  đã đính chính ở `evaluation/README.md` và `ai-rec/doc/result-sep30.md`.
- Gu có tương quan với HÃNG (id sinh theo từng hãng): tỉ trọng hãng nhiều nhất/khách trung vị
  0,57, ngẫu nhiên ~0,36.
- Ngày đơn POS lưu theo giờ máy (+07) nhưng pipeline coi là UTC; một phần đơn có ngày ở
  tương lai so với lúc chạy. AI-Rec kẹp `DaysSince ≥ 0`.

### 15.2 AI-Rec

- `CollaborativeFiltering(half_life_days, input_scale)`: thang `log` (Hu et al., 2008).
- Kênh mua lại mới `models/repeat.py`: tần suất ĐƠN đã giảm theo thời gian. Thiếu bảng thì
  rơi về cách cũ, `/health` báo `repeat_model: false` + `last_error`.
- Benchmark: lưới khai báo trước (half-life {7,10,14,30,60} — cận dưới 7 ngày là quyết định
  miền; thang; kênh mua lại; k; γ) = 1.920 bộ; luật chọn production = tối đa NDCG tổng thể
  với 2–3 món cũ/10 (quyết định sản phẩm 01/10); đối chứng mạnh EASE^R, iALS; kiểm độ bền trên
  2 cửa sổ trước validation; so ghép cặp mới/cũ.
- Mặc định mới trong `config.py` = cấu hình chọn trên validation: half-life 7, thang log,
  mua lại `order_freq`, k = 0, γ = 1.
- Test (đo một lần, NDCG@10, CI 95%): tổng thể 0,309 → 0,356 (+0,047 [+0,018; +0,074]);
  khám phá 0,258 → 0,267 (+0,008, không có ý nghĩa); mua lại 0,264 → 0,332 (+0,068
  [+0,029; +0,106]). Item-CF tinh chỉnh (0,377 khám phá) không thua EASE^R (0,359) / iALS
  (0,373). Chi tiết: `ai-rec/evaluation/README.md`.
- `tests/`: 31/31 pass (thêm 15 test).

### 15.3 dbt

- `serving.purchase_events_for_AI_rec` — BẢNG (quyền `ai_rec`), một dòng cho mỗi (khách, món,
  đơn), cùng điều kiện "một lần mua" với `pairs_customer_product`. `dbt build` 6/6 PASS;
  5.974 dòng · 234 khách · 78 món, khớp tuyệt đối với benchmark. Hợp đồng: §4.5
  `data-contract-warehouse.md`.
- AI-Rec đầu–cuối: chu kỳ train đầu (trước khi có bảng) rơi về kênh cũ và báo lỗi đúng; chu kỳ
  sau nạp 5.974 lượt mua, `repeat_model: true`, `last_error` xoá.

### 15.4 Ecom — tracking hành vi (tiền đề cho tín hiệu hành vi phụ)

Cùng một họ lỗi: tin dữ liệu do client khai.

| Chỗ | Trước | Sau |
|---|---|---|
| `POST /b2c/track` | `customer_id`, `event_time` lấy từ body | Khách từ token (`optionalAuthB2C`), giờ server |
| Giờ sự kiện | Chuỗi UTC không hậu tố, cột `Asia/Ho_Chi_Minh` → lệch 7 giờ | ISO có `Z` + `date_time_input_format = best_effort` |
| `GET /b2c/recently-viewed` | `customer_id` trên query → xem được lịch sử người khác; `session_id` nối thẳng vào SQL | Khách từ token; mọi chuỗi qua `query_params` |
| `BehaviorService` (5 hàm) | Nối chuỗi vào SQL, có chỗ nối lại `session_id` đọc từ bảng (injection bậc hai) | Tham số hoá; số qua `_int()` có chặn biên |
| `POST/GET /b2c/wishlist` | Đòi `customer_id` trong body/query → client thật luôn nhận 400, ai cũng sửa được wishlist người khác | `authB2C`, khách từ token |
| Client `useTracking` | `sendBeacon` (không gửi được token); dwell tính cả lúc tab ẩn; mất lượt xem cuối khi đóng tab | `fetch keepalive` + token; dwell chỉ khi hiển thị; `pagehide` |
| Ô "Dành riêng cho bạn" | Không ghi gì | `rec_impression` (món được hiển thị), `rec_click`; referrer `recommendation` qua router state |

Kiểm chứng qua `localhost:3000/api`: không token + body giả `customer_id=1` → lưu `NULL`; token
khách 5 + body giả `customer_id=1` → lưu `5`; `event_time` giả năm 2020 → giờ server, đúng giờ
VN; `session_id=x' OR 1=1 -- ` → 200 `[]`; wishlist không token → 401, có token thêm/đọc/bỏ
chạy. Hai event thử đã xoá.

### 15.5 Còn mở

- **`/api/b2b/*` không có middleware xác thực**: `routes/b2b.js`, `routes/aiAdmin`,
  `routes/behavior-analytics.js` mount ở `index.js:819–827` không kèm `authMiddleware`. Chưa sửa —
  đụng luồng trang admin, cần quyết định.
- Tunnel `cloudflared` không chạy lúc 01/10 — webhook SePay không về được cho tới khi dựng lại
  và khai URL mới bên SePay.
- Pha 3 (sửa bộ sinh) và pha 4 (tín hiệu hành vi phụ) chờ chốt cách làm với dữ liệu đang có.

## 16. Pha 3–4: bộ sinh v2 (offline) + tín hiệu hành vi phụ (01/10)

Chốt 01/10: sinh dữ liệu OFFLINE trước (CSV cho benchmark, không đụng DB), reset dữ liệu live để
sau; dbt đọc thẳng `analytics`; auth `/api/b2b/*` để sau.

### 16.1 Bộ sinh v2 — `data-platform-poc/taste_simulator.py`

- Gu ẩn cố định theo mã khách, xác định trên danh mục/hãng/tầm giá, cộng ái lực ẩn riêng
  (phần chỉ CF học được).
- Gu trôi DẦN theo thời gian (40% khách); mua lặp theo loại hàng.
- Ngày UTC, không có ngày ở tương lai; 25% khách đăng ký giữa cửa sổ.
- Hành vi sinh từ cùng gu: pha "xem trước khi mua", phiên duyệt, dwell theo mức hợp gu,
  giỏ/yêu thích.
- Onboarding có nhiễu (đúng 80%).
- Mặc định: 500 khách · 639 món (2/ô) · 180 ngày · 90 ngày hành vi → 5.676 đơn, 71.357 sự kiện.
  Chạy 3,4 giây. Tham số + đáp án gu: `sim_params.json`.

### 16.2 AI-Rec

- `models/behavior.py`: tín hiệu (xem / dwell / giỏ / yêu thích, giảm theo thời gian) chỉ vào
  ma trận HỒ SƠ của CF. Tập "đã mua" vẫn chỉ từ đơn — món đã xem mà chưa mua vẫn được gợi ý;
  khách chỉ có hành vi vẫn có gợi ý CF. Tắt thì kết quả giống hệt trước (có test).
- Đường production: `serving.customer_product_events` (dbt, BẢNG, đọc `analytics.user_events`;
  lượt xem từ ô gợi ý tách riêng) → `fetch_behavior()` → `CF_BEHAVIOR_MODE` (mặc định `none`).
  `dbt build` 4/4 PASS; `ai_rec` đọc được; fit bật hành vi trên dữ liệu warehouse chạy đúng.
- Benchmark tầng 2 (hành vi × half-life), baseline Viewed-only, khách mới "đã duyệt, chưa mua".
- **Sửa luật chọn sau quan sát:** thêm điều kiện trội và ablation có kiểm soát. Lý do: hành vi
  seed "thắng" chỉ nhờ lọt ranh giới dải món cũ (3,00 so với 3,01) — chi tiết ở README đánh giá.
- iALS giải theo dạng thưa: cùng nghiệm (sai khác 2·10⁻¹⁶), nhanh ~8 lần.
- `tests/`: 41/41 pass.

### 16.3 Kết quả (chi tiết: `ai-rec/evaluation/README.md`)

**Dữ liệu thật** (hành vi seed: 5/234 khách, 2/78 món trùng với dữ liệu đơn):
- validation không chọn hành vi; cấu hình đang chạy TRÙNG cấu hình được chọn;
- ablation có kiểm soát: hành vi làm giảm nhẹ (−0,002 đến −0,004 tổng thể).

**Dữ liệu mô phỏng** (cấu hình chọn trên validation, so với cấu hình cũ):

| Chỉ số (NDCG) | Cũ | Mới | Δ |
|---|---|---|---|
| Tổng thể | 0,197 | 0,357 | +0,160 [+0,142; +0,178] |
| Khám phá | 0,021 | 0,176 | +0,154 |

- Ablation hành vi: +0,086 đến +0,092 tổng thể, +0,138 đến +0,148 khám phá.
- Khách mới chỉ có hành vi duyệt: 0,400 so với 0,099 của Most-Popular.

**Giới hạn:** mô phỏng có tính vòng tròn — bộ sinh giả định "xem trước khi mua".

**Phát hiện cần xử lý tiếp:**
- Viewed-only thắng hybrid ở khám phá → thêm kênh "xem gần đây".
- iALS thắng Item-CF trên dữ liệu thưa.
- Half-life 7 hợp dữ liệu thật hiện tại nhưng kém trên dữ liệu trôi dần → phải chọn lại khi
  reset dữ liệu.

### 16.4 Còn mở

- Reset dữ liệu live bằng bộ sinh v2 (backup → xoá đơn + event → sinh → dựng lại CDC/warehouse)
  — cần duyệt; sau đó chạy lại benchmark và đổi `config.py` theo cấu hình được chọn.
- Kênh "xem gần đây" cho hybrid; đánh giá iALS cho production.
- `/api/b2b/*` chưa có xác thực (§15.5); tunnel `cloudflared` chưa dựng lại.

## 17. Gắn nốt tracking hành vi phía client + ghép phiên (04/10)

Rà lại 04/10: hook `useTracking` có 11 hàm, nhưng chỉ 6 loại sự kiện được gọi thật. Đã sửa:

| Sự kiện | Trước | Sau |
|---|---|---|
| `add_to_cart` | Chỉ 2 nút ở trang chi tiết; 5 đường khác (thẻ sản phẩm trang chủ/danh sách, so sánh, món liên quan) mất | Ghi trong `CartContext.addToCart` — mọi đường, đúng một lần; bỏ lời gọi riêng ở trang chi tiết (tránh đếm đôi) |
| `remove_from_cart` | Không ghi | `CartContext.removeFromCart` (ngăn giỏ); xoá giỏ sau khi đặt đơn KHÔNG tính |
| `add_to_wishlist` | Import mà không gọi | `AppContext.toggleWishlist` — mọi nút yêu thích |
| `checkout_abandon` | Không ghi | Rời `/checkout` (chuyển trang / đóng tab) khi còn hàng mà chưa đặt đơn; hoãn một nhịp để StrictMode không sinh sự kiện giả |
| `identify` (mới) | — | Gửi sau `b2cLogin` kèm token → ghép phiên. Đăng xuất đổi `session_id` |
| `page_source` | Cố định "detail" | Suy từ URL (`currentPageSource`); thêm giá trị `compare` phía server |

Lỗi có sẵn được sửa kèm: `ProductList` gọi `api.b2c.toggleWishlist(b2cUser.id, productId)` —
hàm chỉ nhận `product_id`, nên mã khách bị gửi làm mã món, bấm yêu thích ở trang danh sách bật/tắt
nhầm món khác; trang này còn giữ danh sách yêu thích riêng, lệch với các trang khác. Nay dùng
chung danh sách và hàm của `AppContext`.

dbt: view `warehouse.user_events_stitched` (ở `warehouse`, `ai_rec` không đọc — dữ liệu mức sự
kiện); `serving.customer_product_events` và `export_data.sh` đọc qua view này.

Kiểm chứng:
- `dbt build` 7/7 PASS; `vite build` trong image client qua.
- API: sự kiện ẩn danh + `identify` cùng phiên → được ghép cho khách 5 (`stitched = 1`); phiên có
  hai khách → không ghép.
- Trình duyệt thật (Playwright headless, Chrome for Testing): trang chủ → `/shop` yêu thích + thêm
  giỏ trên thẻ → bỏ giỏ trong ngăn giỏ → vào rồi rời `/checkout` → đăng nhập qua form. ClickHouse
  nhận đủ `rec_impression`, `add_to_cart`, `add_to_wishlist`, `remove_from_cart`,
  `checkout_abandon`, `identify`; năm sự kiện trước lúc đăng nhập được ghép cho khách; không có
  lỗi JavaScript trên trang; `session_id` giữ nguyên qua đăng nhập.
- Đăng xuất qua menu người dùng: `session_id` đổi, token bị xoá, không lỗi. (Request đọc sở thích
  được giả lập TRONG trình duyệt thử để tránh chuyển sang onboarding — không ghi gì vào Postgres.)
- Đã xoá 43 sự kiện thử (12 phiên); `customer_product_events` về lại 1.246 cặp / 20 khách.

Dữ liệu hành vi THẬT vẫn chưa có — cần người dùng thật hoặc bộ sinh v2 chế độ live (§16.4);
`CF_BEHAVIOR_MODE` vẫn tắt.

## 18. MinIO: build từ mã nguồn — image chính thức không còn kéo được (04/10)

Triệu chứng: `docker compose up` trên máy mới hỏng ở bước kéo MinIO. Máy chính không thấy lỗi vì
còn image cũ trong cache, nên lỗi chỉ lộ ra ở máy khác hoặc sau khi dọn image.

Nguyên nhân: MinIO ngừng phát hành bản cộng đồng dựng sẵn — README chính thức: "The MinIO
community edition is now distributed as source code only", repo archive từ 25/04/2026
(https://github.com/minio/minio). Kiểm ngày 04/10: `quay.io/minio/minio` và `quay.io/minio/mc`
trả `no such manifest`, Docker Hub trả `denied`, binary trên `dl.min.io` trả HTTP 410. Bootstrap
còn hỏng thêm một chỗ: `COPY --from=quay.io/minio/mc` khi build image.

Sửa (đã chọn giữa: build từ nguồn / ghim image cache / image bên thứ ba):
- `local-infra-sandbox/minio/Dockerfile`: build từ mã nguồn chính thức, ghim
  `RELEASE.2025-09-07T16-13-09Z` (kiểm commit `07c3a429…` sau khi clone) và go1.24.6 — đúng bản
  volume `minio_data` đang dùng. Compose chuyển `minio` sang `build:`; healthcheck đổi từ
  `mc ready local` sang `curl /minio/health/ready`.
- Bootstrap bỏ hẳn `mc`: kiểm/tạo bucket bằng S3 API, `curl --aws-sigv4` tự ký SigV4. Luồng giữ
  như cũ (sai khoá / mất kết nối thì dừng, tạo bucket hỏng thì đi tiếp) nhưng nay báo lý do.
- `.env.example` bỏ `MINIO_VERSION` (không còn tác dụng).

Kiểm chứng:
- `minio --version` của bản tự build trùng từng chữ với binary chính thức trong image cũ:
  `RELEASE.2025-09-07T16-13-09Z (commit-id=07c3a429bfed…)`, `Runtime: go1.24.6 linux/arm64`.
- Thử `curl --aws-sigv4` trên MinIO tạm: bucket chưa có 404, tạo 200, đã có 200, tạo lại 409,
  sai khoá 403.
- `docker compose up -d` cả hệ: không còn lỗi pull; MinIO healthy; bootstrap thoát 0 ("bucket
  'data-lake' đã có" — xác thực đúng bằng khoá thật); hai connector RUNNING.
- Volume giữ nguyên deployment (`format.json` cùng id); object 57 → 68 (sink ghi thêm parquet
  mới). ClickHouse đọc qua view `s3()`, tách theo nguồn file:
  - parquet CŨ trên volume (13/09 → 29/09): 3.521 bản ghi `Order` / 3.510 mã đơn — riêng phần
    cũ đã đủ cả 3.509 đơn đang có trong Postgres (+1 đơn ghi nhận phụ dưới đây);
  - parquet MỚI: 3.509 bản ghi — Debezium chụp lại toàn bộ bảng vì container Kafka được tạo lại
    (offset connector mất theo).
- Sau lake: `dbt build` PASS=68 / ERROR=0; `fact_orders_detail` 6.262 dòng / 3.509 đơn, khớp
  đúng Postgres (`OrderItem` 6.262 / `Order` 3.509) — bản chụp trùng được khử, không đếm đôi;
  `serving.customer_product_events` 1.246 cặp (như §17); AI-Rec `/health` ok; Kafka Connect
  0 dòng ERROR.

Đánh đổi / hạn chế:
- Lần build đầu mất ~20 phút (bước `go build`, Docker 10 CPU / 8 GB), mỗi máy một lần.
- Bản cộng đồng không còn bản vá bảo mật — chấp nhận cho môi trường dev của khoá luận; triển
  khai thật cần kho S3 còn được bảo trì.

Ghi nhận phụ (có từ trước, không do thay đổi này): lake còn đơn `ORD-1789311006027` (13/09,
PENDING_PAYMENT → CANCELLED) mà Postgres không còn, và CDC không có sự kiện xoá — nhiều khả năng
bị xoá lúc Debezium không chạy. Đơn đã huỷ nên không ảnh hưởng mart doanh thu.

## 19. Nhánh nóng mất sau khi tạo lại volume ClickHouse — khôi phục, đưa vào bootstrap (14/11)

Phát hiện 13/11/2026 khi soát `system.tables`: ClickHouse không còn database `realtime`, không bảng
Kafka engine, không Materialized View. Kafka chỉ còn consumer group `connect-minio-sink-connector`;
group `clickhouse-realtime` không còn offset nào. Volume `kltn_clickhouse_data` được tạo lại lúc
2026-10-23T15:06Z (ngày benchmark). Không có lỗi nào báo ra — chỉ là không còn số liệu trực tiếp.
Vì vậy dòng C7 trong `docs/06-MO-TA-DE-TAI-VA-KE-HOACH.md` và dòng `realtime.orders_live` ở §8
đúng lúc viết nhưng sai trong khoảng 23/10 → 14/11.

Nguyên nhân: DDL `scripts/etl/realtime-layer.sql` chỉ được chạy tay. File này không nằm trong
`clickhouse-init/` và bootstrap không gọi nó, nên volume mới thì nhánh nóng không được tạo lại.

Sửa:
- `realtime-layer.sql` chạy lặp lại được: dùng `CREATE ... IF NOT EXISTS` cho bảng Kafka và `orders_live`
  (bản cũ `DROP` rồi `CREATE`, chạy lại là xoá sạch), `ALTER ... ADD COLUMN IF NOT EXISTS` cho máy
  đã có bảng cũ, và tạo lại MV bằng `DROP` + `CREATE` (view có `TO` không giữ dữ liệu).
- `bootstrap-bigdata.sh` có thêm bước 0b. Bước này chạy file trên rồi kiểm đủ 3 đối tượng. Nếu bảng
  rỗng, nó chờ consumer nhận partition rồi nạp bù đơn 7 ngày gần nhất từ Postgres bằng `postgresql()`.
  Dòng nạp bù có `_event_ts` = epoch 0, nên sự kiện CDC nào của cùng đơn cũng thắng khi
  ReplacingMergeTree gộp. Bước này lỗi thì báo ngay tại chỗ, in lại ở cuối log và không dừng bootstrap.
- Theo yêu cầu cùng ngày, thêm 4 cột: `sub_total`, `shipping_fee`, `discount` và `paid_at`.
  `_arrived_at` đổi sang `DateTime64(3)`, vì kiểu cũ làm tròn xuống giây nên đo độ trễ sai tới 1 s.
  Thêm `kafka_max_block_size = 10000`, tức khoảng 47 MB mỗi khối với message cỡ 4,7 KB. Không đặt
  thì mặc định là 1.048.449 message.

Phát hiện khi làm:
- ClickHouse 24.8 **không có** setting cấp bảng `kafka_auto_offset_reset`. Image 24.8.14.39 trả
  `UNKNOWN_SETTING`. Mặc định là `earliest`, được đặt cứng trong `src/Storages/Kafka/KafkaConfigLoader.cpp`
  (nhánh 24.8). Muốn dùng `latest` thì phải khai trong config.d:
  `<kafka><auto_offset_reset>latest</auto_offset_reset></kafka>`. Đã thử trên container tạm: giá trị
  sai bị librdkafka từ chối (`Invalid value "bogus_value" for configuration property
  "auto.offset.reset"`), còn `latest` không báo lỗi. **Chưa mount vào compose** — việc này chờ quyết định.
- Đo ngày 14/11, topic `cdc_prod.public.Order` chỉ còn offset 3.000.000 → 3.000.027 (27 bản ghi), phần cũ
  đã hết hạn theo retention. Vì vậy, lần tạo lại này với `earliest` chỉ đọc 27 bản ghi. Rủi ro phải
  đọc lại hơn 3 triệu bản ghi chỉ xảy ra khi tạo lại nhánh nóng trong thời hạn retention ngay sau
  một đợt seed lớn.

Kiểm chứng trên ClickHouse 24.8.14.39 tạm (`--network none`), chạy đúng đoạn mã của bootstrap:
- Lần chạy đầu: 9 câu lệnh, 0 lỗi. Từ bảng giả lập có đúng kiểu cột mà `postgresql()` suy ra, bước
  này nạp bù 3 đơn và loại đơn đã cũ 10 ngày. Lần chạy thứ hai không lỗi và không nạp bù lại.
- Đưa 3 message CDC thật (offset 3.000.024–3.000.026, đã che trường `customer`) qua một MV có
  định nghĩa y hệt: số tiền, `order_date` và `_event_ts` đều khớp đến mili-giây. `FINAL` trả trạng
  thái của sự kiện CDC mới nhất, dòng nạp bù thua. `paid_at` dạng mili-giây chuyển đúng sang thời
  điểm tương ứng; đơn chưa trả có `paid_at` là NULL.
- Nâng cấp từ bản cũ (commit `9d01e21`): 4 cột được thêm tại chỗ, dòng đang có giữ nguyên.
- Chạy câu `SELECT` của nạp bù ở chế độ **chỉ đọc** trên Postgres thật qua ClickHouse production:
  ra 11 đơn, khớp `psql`. `read_rows` = 11, chứng tỏ điều kiện ngày đã được đẩy xuống Postgres;
  thời gian 62 ms. Mật khẩu hiện là `[HIDDEN]` trong `system.query_log`.

Hạn chế:
- Bảng `Order` dùng `REPLICA IDENTITY DEFAULT`, nên sự kiện xoá chỉ mang khoá chính. Kết quả là
  `order_date` = 1970: dòng xoá rơi vào partition khác và bị TTL loại ngay lúc ghi (đã thử trên
  container tạm bằng message xoá dựng từ message thật). Vì thế xoá cứng không phản ánh sang `orders_live`. Mã server hiện không xoá cứng
  `Order`. Lỗi này có từ trước và chưa sửa trong lần này.

Áp lên production (14/11/2026, 00:42 giờ VN, `build_prod` 7ae1a92, `docker compose -p kltn up --no-deps bootstrap`):
- Bước 0b chạy 9 câu, 0 lỗi; consumer nhận partition sau khoảng 6 s; nạp bù 11 đơn.
- `system.kafka_consumers`: partition 0, đọc 27 message (đúng phần topic còn giữ), không exception.
  `kafka-consumer-groups`: `clickhouse-realtime` có LAG = 0.
- `orders_live FINAL` khớp Postgres trên cửa sổ 7 ngày: 11 đơn, Σ `sub_total` = 28.583.640,
  Σ `total` = 28.803.640. Không còn dòng nạp bù nào thắng, vì 27 message CDC phủ hết 11 đơn
  với `_event_ts` mới hơn.
- RAM ClickHouse: 1,31 GiB trước khi áp, 1,23 GiB sau khi áp (`docker stats`, giới hạn 3 GiB).

Độ trễ, đo trên production cùng ngày. Phát sự kiện bằng `UPDATE "Order" SET status = status` trên đơn
thử ORD-1794416465641: không đổi dữ liệu nhưng Postgres vẫn ghi WAL nên Debezium phát sự kiện `u`.
Mốc đầu là `clock_timestamp()` của Postgres lúc chạy câu, mốc cuối là `_arrived_at` trong ClickHouse.
Hai container chạy trên cùng một máy nên dùng chung đồng hồ. Script:
`scripts/measure-hot-latency.sh` (6 lần, cách nhau 20 s).

| Lần | Commit → ClickHouse | Debezium (`ts_ms`) → ClickHouse |
|---|---|---|
| 1 | 6.439 ms | 5.894 ms |
| 2 | 1.587 ms | 1.153 ms |
| 3 | 1.881 ms | 1.430 ms |
| 4 | 2.149 ms | 1.691 ms |
| 5 | 1.600 ms | 1.449 ms |
| 6 | 1.773 ms | 1.711 ms |

- Lần 2–6: 1,6–2,1 s, trung vị 1,77 s. Lần 1 mất 6,4 s; đó là sự kiện đầu tiên sau khi consumer
  rảnh. Mã `KafkaSource.cpp` (24.8) chờ tới 10 lần poll rỗng × 500 ms rồi mới đẩy khối, nên
  khoảng này hợp lý; chưa tách được nguyên nhân chính xác.
- Chặng Postgres → Debezium chiếm 62–545 ms. Phần còn lại là Kafka → ClickHouse.
- Kết luận cho báo cáo: nhánh nóng có độ trễ khoảng 2 giây khi đang chạy đều, tối đa khoảng 6–7
  giây cho sự kiện đầu sau một quãng rảnh. Con số "~1 giây" trước đây chưa từng được đo và đã được
  thay trong `architecture.md`. Muốn nhanh hơn thì chỉnh `kafka_flush_interval_ms` hoặc
  `kafka_poll_timeout_ms`; chưa chỉnh.

## 20. KPI "hôm nay" của dashboard đọc nhánh nóng, dự phòng bằng kho (16/11)

Đến hết 15/11, các thẻ KPI của dashboard (kể cả gói WebSocket đẩy mỗi 5 s) đều đọc
`analytics.sale_orders` của nhánh lạnh, nên số "trực tiếp" thực ra trễ 5–8 phút. Thẻ "Đơn hôm nay"
cũng sai: view này có **một dòng cho mỗi `OrderItem`**, nên `COUNT(*)` đếm dòng hàng chứ không đếm
đơn. Phương án "A+" được người dùng duyệt ngày 16/11:

- Doanh thu hôm nay và hôm qua lấy `SUM(sub_total)` trên `realtime.orders_live FINAL`, giữ đúng quy
  tắc trạng thái hiện hành.
- Số đơn đếm theo đơn.
- Khi nhánh nóng không dùng được thì quay về kho, và trả kèm `source` để giao diện hiện nhãn nguồn.

Mã nằm ở `server/src/services/KpiTodayService.js`, được dùng trong `index.js` cho cả REST
`/api/dashboard/kpis` lẫn WebSocket. Phía giao diện là `Dashboard.jsx`. Không đổi DDL nào.

Mọi số dưới đây đo ngày 16/11/2026, từ 01:00 đến 01:25 giờ VN, trên production (`build_prod`
569ea61). Trên production chỉ chạy truy vấn **chỉ đọc**; kiểm thử có ghi dữ liệu chạy trên
ClickHouse tạm.

### 20.1 Cột chi nhánh: không có trong nguồn của nhánh nóng

- Bảng `Order` trong Postgres (`information_schema.columns`) gồm 16 cột: `id, customer, customer_id,
  province, total, discount, shippingFee, subTotal, status, date, payment_method, payment_status,
  payment_ref, paid_at, paid_amount, expires_at`. Không có cột chi nhánh, nên message CDC của
  `Order` (nguồn của `orders_live`) cũng không có.
- Chi nhánh chỉ có ở `OrderItem.branch_id`, mà cột này rỗng ở **6.795.760/6.795.760** dòng.
  `masterdata.dim_branches` có 4 chi nhánh.
- Vì vậy không thêm cột vào `orders_live`, không sửa `realtime-layer.sql` hay bootstrap. Khi có lọc
  chi nhánh, KPI đọc kho như trước. Kho cũng trả 0 cho mọi chi nhánh vì cột rỗng; đó là hành vi
  có từ trước.

### 20.2 Đối chiếu ngữ nghĩa trên toàn lịch sử, từng ngày

`orders_live` là bản sao CDC của `Order`, có đủ các cột `status`, `payment_status`, `subTotal` và
`date`. Vì vậy áp quy tắc của dashboard lên `Order` sẽ cho đúng con số mà câu SQL trên
`orders_live` trả về. Đem so con số đó với kho theo từng ngày giờ VN:

```sql
-- kho (ClickHouse)
SELECT toDate(order_date,'Asia/Ho_Chi_Minh') d, sumIf(net_amount, status='CONFIRMED'),
       uniqExactIf(order_id, status='CONFIRMED'), countIf(status='CONFIRMED')
FROM analytics.sale_orders GROUP BY d ORDER BY d;
-- nguồn (psql, chỉ đọc)
SELECT (date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
       sum("subTotal") FILTER (WHERE payment_status='PAID' OR status='CONFIRMED'),
       count(*)        FILTER (WHERE payment_status='PAID' OR status='CONFIRMED')
FROM "Order" GROUP BY 1 ORDER BY 1;
```

Kết quả so trên 370 ngày (23/10/2025 → 12/11/2026):

- **0 ngày lệch doanh thu, 0 ngày lệch số đơn.**
- Tổng doanh thu hai bên cùng là 68.499.919.241.040 đ, trên 2.816.534 đơn.
- Kho có 6.381.029 dòng tính doanh thu, tức **2,27 dòng mỗi đơn**. Theo từng ngày, tỉ lệ này từ
  1,00 đến 2,31.
- Ví dụ ngày 22/10/2026 có 7.618 đơn, nhưng thẻ cũ sẽ hiện 17.394.

### 20.3 Bảng so sánh 7 ngày gần nhất

Chạy đúng câu SQL do module sinh ra (`hotTodaySql`, `warehouseTodaySql`) với từng ngày. "Số dòng"
là con số thẻ cũ hiện, tức `COUNT(*) WHERE status='CONFIRMED'`.

| Ngày (giờ VN) | Kho: doanh thu | Kho: số dòng (thẻ cũ) | Kho: số đơn | Nóng: doanh thu | Nóng: số đơn | Doanh thu hôm qua (kho = nóng) | Khớp |
|---|---|---|---|---|---|---|---|
| 10/11 | 7.238.640 | 2 | 2 | 7.238.640 | 2 | 0 | ✅ |
| 11/11 | 875.000 | 5 | 5 | 875.000 | 5 | 7.238.640 | ✅ |
| 12/11 | 19.990.000 | 3 | 3 | 19.990.000 | 3 | 875.000 | ✅ |
| 13/11 | 0 | 0 | 0 | 0 | 0 | 19.990.000 | ✅ |
| 14/11 | 0 | 0 | 0 | 0 | 0 | 0 | ✅ |
| 15/11 | 0 | 0 | 0 | 0 | 0 | 0 | ✅ |
| 16/11 (hôm nay) | 0 | 0 | 0 | 0 | 0 | 0 | ✅ |

- Số đơn mọi trạng thái (mẫu số của tỷ lệ huỷ) ở hai nhánh đều là 2 / 5 / 4 / 0 / 0 / 0 / 0. Số đơn
  `VOIDED` ở cả hai nhánh đều là 0.
- Không ngày nào lệch vì kho chậm. Lượt dbt gần nhất có `max(_loaded_at)` = 15/11 18:01:07 UTC. Sự
  kiện CDC mới nhất trong kho có `max(_order_event_ts)` = 13/11 17:45:24.959 UTC, đúng sự kiện đo độ
  trễ ở §19. Như vậy mọi ngày trong bảng đều đã qua dbt.
- Bảy ngày này rất thưa: chỉ 11 đơn, đơn nào cũng chỉ một dòng hàng. Vì thế số dòng bằng số đơn,
  và lỗi đếm dòng chỉ lộ ra ở những ngày có đơn nhiều món (§20.2). Lúc đo, hôm nay chưa có đơn nào.
- Với từng ngày trên, câu kiểm tra sức khoẻ (`probeCountSql`) trả `missing_in_hot = 0`; số đơn hai
  nhánh của cửa sổ hôm qua + hôm nay bằng nhau: 2, 7, 9, 4, 0, 0, 0.

### 20.4 Kiểm thử trên ClickHouse tạm

Dùng image 24.8.14.39 chạy với `--network none`. DDL của `orders_live` trích nguyên từ
`realtime-layer.sql`. Bảng chạy `SYSTEM STOP MERGES` để `FINAL` phải tự gộp: 8 dòng thô còn 4 dòng
sau `FINAL`.

Dữ liệu thử gồm năm đơn:

| Đơn | Dữ liệu thử | Kỳ vọng |
|---|---|---|
| A | `CONFIRMED/UNPAID` rồi `SHIPPING/UNPAID` | Bản mới nhất thắng nên không tính |
| B | 00:30 giờ VN ngày 16/11 (17:30 UTC ngày 15/11), PAID | Rơi vào hôm nay |
| C | 23:59:59.999 giờ VN ngày 15/11, `CONFIRMED/UNPAID` | Rơi vào hôm qua |
| D | Bản cuối có `_is_deleted = 1` | Loại |
| E | Dòng nạp bù (epoch 0) UNPAID, sau đó sự kiện CDC PAID | Sự kiện CDC thắng |

Kết quả:

- Nhánh nóng: doanh thu hôm nay 6.000, hôm qua 10.000, 2 đơn, 3 đơn mọi trạng thái — đúng như tính
  tay.
- Kho dạng dòng hàng (B có 2 dòng, E có 3 dòng) ra cùng kết quả. Cách đếm cũ sẽ ra 5.
- Quy tắc `paid_only`: hôm nay 6.000, hôm qua 0.
- Thêm đơn F chỉ có ở kho thì `missing_in_hot` = 1, tức kiểm tra sức khoẻ bắt được.

Quy mô: nạp 1.000.000 đơn, mỗi đơn 2 phiên bản CDC (2 triệu dòng; merge nền gộp còn khoảng 1,89
triệu dòng ở 2 part). Với `max_threads = 4`, câu KPI nhánh nóng chạy 63–80 ms (trung bình 69 ms),
`read_rows` 1,94 triệu, đọc 138 MiB, bộ nhớ đỉnh 28,9 MiB. Container tạm không bị giới hạn RAM 3 GiB
như production, nên con số này chỉ cho thấy bậc độ lớn.

Ngoài ra có 13 kiểm thử đơn vị cho đường chọn nguồn và các nhánh dự phòng, chạy bằng
`node --test tests/kpi-today.test.js` (không cần dịch vụ nào): 13/13 đạt.

### 20.5 Chi phí truy vấn trên production

Số liệu lấy từ `system.query_log` (lọc theo `log_comment`) và `clickhouse-client --time`:

| Câu | Số lần chạy | TB (ms) | Max (ms) | `read_rows` | Bộ nhớ đỉnh |
|---|---|---|---|---|---|
| KPI nhánh nóng (`hotTodaySql`) | 7 | 4,1 | 6 | 11 | 72 KiB |
| KPI kho, dùng khi dự phòng (`warehouseTodaySql`) | 7 | 14,1 (trung vị 5) | 43 | 22 | 126 KiB |
| Kiểm tra 1 (`PROBE_META_SQL`) | 1 | 17 | 17 | 6 | 58 KiB |
| Kiểm tra 2 (`probeCountSql`) | 7 | 13,4 | 20 | 67 | 453 KiB |
| 5 câu KPI cũ, tính mỗi câu | 5 | 5 | 6 | 4 | 66 KiB |

- Nhịp chạy: một câu KPI nhánh nóng mỗi 5 s (WebSocket). Hai câu kiểm tra chạy tối đa mỗi 30 s một
  lần. Tất cả chỉ chạy khi dashboard đang mở: REST lúc tải trang, WebSocket khi trang vẫn mở. Hiện chỉ
  trang Dashboard mở WebSocket.
- Bảy ngày qua chỉ có 11 đơn nên mọi con số ở bảng này rất nhỏ. Chi phí khi có tải xem §20.4.
- Câu đơn chờ đối soát giữ như cũ, cache 5 phút. Một lần chạy câu đó, có thêm cột
  `uniqExact(order_id)` để so, mất 2,0 s.

### 20.6 Quy tắc trạng thái: số liệu cho câu hỏi còn mở

Khoá luận viết rằng doanh thu "chỉ tính đơn đã thu tiền". Mapping hiện hành
`if(payment_status='PAID','CONFIRMED',order_status)` lại tính cả đơn **chưa thu** đang ở trạng thái
`CONFIRMED`. Đơn COD chuyển sang `SHIPPING` mà chưa thu thì rơi ra, đến khi `DELIVERED` kèm `PAID`
mới được tính lại. Lần này chưa đổi quy tắc, chỉ gom về một chỗ là `REVENUE_RULES` / `REVENUE_RULE`.

So hai quy tắc trên nhánh nóng:

| Ngày (giờ VN) | Hiện hành: PAID hoặc CONFIRMED | Chỉ PAID |
|---|---|---|
| 16/11 (hôm nay) | 0 đ (0 đơn) | 0 đ (0 đơn) |
| 15/11 (hôm qua) | 0 đ (0 đơn) | 0 đ (0 đơn) |
| 12/11 | 19.990.000 đ (3 đơn) | 0 đ (0 đơn) |
| 11/11 | 875.000 đ (5 đơn) | 50.000 đ (1 đơn) |
| 10/11 | 7.238.640 đ (2 đơn) | 0 đ (0 đơn) |

- Trên toàn lịch sử (Postgres), hai quy tắc chênh nhau đúng ở 4.001 đơn `CONFIRMED/UNPAID/COD`,
  tổng 95.613.997.640 đ.
- 5.617 đơn `SHIPPING/UNPAID/COD` không được tính ở cả hai quy tắc.
- Muốn đổi sang "chỉ PAID": đặt `REVENUE_RULE = 'paid_only'`. Muốn các biểu đồ khác của dashboard
  đổi theo thì sửa thêm mapping trong `scripts/etl/compat-sale-orders.sql`; nếu không, thẻ KPI và
  biểu đồ sẽ lệch nhau.

### 20.7 Hạn chế và việc còn mở

- **Đơn chờ đối soát vẫn đếm dòng hàng.** Lúc đo, chỉ số này là 9.041 dòng, tương ứng 4.001 đơn,
  nhưng thẻ ghi đơn vị là "hóa đơn". Chưa sửa vì nằm ngoài phạm vi A+. Chỉ số này cũng không chuyển
  sang nhánh nóng được, vì nó đếm trên toàn lịch sử mà `orders_live` chỉ giữ 7 ngày.
- **Tiền đã thu vẫn đọc kho.** Phiếu thu tính theo ngày thanh toán, mà đơn đặt quá 7 ngày rồi mới
  trả đã bị TTL loại khỏi `orders_live`.
- **Tỷ lệ huỷ luôn bằng 0** ở cả hai nhánh: `Order.status` không có giá trị `VOIDED`, chỉ có
  CONFIRMED, SHIPPING, DELIVERED, COMPLETED và CANCELLED. Giữ nguyên nghĩa cũ.
- **Biểu đồ theo giờ của hôm nay vẫn đọc kho**, và đường "Đơn hàng" trên đó vẫn đếm dòng hàng. Vì
  vậy trong 5–8 phút đầu, tổng của biểu đồ có thể thấp hơn thẻ doanh thu.
- **Gói WebSocket không xác thực** (có từ trước): ai kết nối được cổng 8080 đều nhận số doanh thu.
- **Giao diện so ngày theo đồng hồ trình duyệt** (`dayjs()`), còn server theo `BUSINESS_TZ`. Trình
  duyệt ở múi giờ khác thì quanh nửa đêm gói WebSocket bị bỏ qua; số từ REST vẫn đúng.
- **Xoá cứng `Order` vẫn không phản ánh sang `orders_live`** (§19). Mã server không xoá cứng đơn.
- **Triển khai:** chỉ cần build lại image `server` và `client`, không cần chạy lại bootstrap.

## 21. Cân bằng tải 3 server, giám sát Prometheus/Grafana, cảnh báo + log tập trung, demo Kubernetes, CD (18–19/11)

Môi trường đo cho cả mục này: một máy Windows 11, 16 CPU logic, 15,7 GB RAM; Docker Desktop 4.47
(WSL2, máy ảo được cấp 8.940 MiB); toàn bộ stack `kltn` chạy trên máy đó. Bộ sinh tải k6
(`grafana/k6:1.8.2`, giới hạn 2 CPU / 1 GB) chạy **trên cùng máy**, trong mạng compose, gọi vào
`http://gateway`. Chỉ gọi các GET đọc (danh mục, danh sách, chi tiết sản phẩm, health). Mỗi số dưới
đây là **một lần chạy**, không lặp lại để lấy trung bình.

### 21.1 Chia tải trên Docker Compose — 1/2/3 bản server (18/11, 23:30–23:35)

`scripts/lb-demo.ps1`: k6 tốc độ cố định 200 req/s, pha đo 60 s sau 15 s khởi động. Gateway nginx
1.27.5, `upstream` có `least_conn` + `resolve` (`docs/load-balancing.md`). Số liệu gốc (JSON):
`scripts/loadtest/results/20261118-233007/` trên máy production (thư mục bị git bỏ qua).

| Số bản | req/s đạt | p95 (ms) | p99 (ms) | Lỗi | Lượt bị bỏ | Phân bố request theo bản |
|---|---|---|---|---|---|---|
| 1 | 198,4 | 15,1 | 289,3 | 0 % | 95 | 14.907 |
| 2 | 200 | 4,9 | 6,9 | 0 % | 0 | 7.507 / 7.495 |
| 3 | 200 | 4,1 | 5,9 | 0 % | 0 | 5.004 / 4.997 / 5.001 |

- "Lượt bị bỏ" (dropped iterations) > 0: k6 hết người dùng ảo vì server trả chậm, tức quá tải. Một
  bản đã chạm trần ở 200 req/s; từ 2 bản trở lên p99 giảm từ 289 ms xuống 6–7 ms.
- Phân bố đều: 3 bản lệch nhau dưới 0,1 %. Kiểm riêng bằng header `X-Served-By`: 30 request
  `/api/health` chia đúng 10 / 10 / 10.
- Giữa 2 và 3 bản chưa khác biệt vì 200 req/s chưa làm 2 bản quá tải.

### 21.2 Demo giám sát trực tiếp với Grafana (19/11, 02:23–02:35)

`scripts/grafana-demo.ps1 -Scenario all`: k6 tăng dần 0 → 150 req/s trong 30 s rồi giữ; Prometheus
v3.13.5 lấy số đo từng bản mỗi 5 s (`docs/monitoring.md`). Số liệu gốc:
`scripts/loadtest/results/grafana-20261119-022305/`.

| Kịch bản | Request | p95 (ms) | p99 (ms) | Response khác 200 | Lượt bị bỏ |
|---|---|---|---|---|---|
| Tải đều, 3 bản, 180 s | 29.249 | 5,1 | 7,3 | 0 | 0 |
| Scale 1 → 2 → 3 → 4 bản trong lúc giữ 150 req/s, 240 s | 37.872 | 7,6 | 21,7 | 0 | 378 |
| Giết 1 bản (kill -9) trong lúc giữ 150 req/s, 180 s | 29.249 | 5,3 | 6,9 | 0 | 0 |

- Lượt bị bỏ ở kịch bản scale rơi vào lúc chỉ còn 1 bản (khớp §21.1: một bản không theo kịp).
- Mỗi lần thêm bản, bản mới healthy sau 7–8 s (02:28:14 → 02:28:21; 02:29:18 → 02:29:26;
  02:30:15 → 02:30:23) và Prometheus tự thấy nó qua DNS của Docker.
- Trong pha tăng tải, Prometheus đo 21,8 / 22,4 / 23,0 req/s cho 3 bản (02:23:38).
- **Server chết tự sống lại, không cần Swarm hay Kubernetes:** kill -9 tiến trình chính của bản
  `0545ddc9702d` lúc 02:32:47 (giả lập crash: tiến trình bị giết từ không gian PID của máy ảo Docker,
  như khi bị OOM). Docker thấy container thoát bất thường và khởi động lại sau 0,8 s (script hỏi mỗi
  0,5 s; RestartCount 0 → 1, chính sách `restart: unless-stopped`); bản đó healthy lại lúc 02:32:54,
  tức vắng mặt 6,1 s. k6 không ghi nhận response lỗi nào trong cả kịch bản: gateway gửi lại GET đang
  dở sang bản khác khi lỗi kết nối (`proxy_next_upstream error timeout`).
- **Lặp lại lúc 03:21, khi đã bật cảnh báo** (`-Scenario failover`, số liệu gốc
  `scripts/loadtest/results/grafana-20261119-031943/`): kill -9 bản `5456e704421b` lúc 03:21:19;
  theo đồng hồ Docker container thoát rồi chạy lại sau 0,04 s (lần 02:32: 0,05 s; FinishedAt →
  StartedAt); healthy lại sau 5,4 s. k6: 29.250 request, p95 5,7 ms, p99 8,2 ms, 0 response khác 200,
  0 lượt bỏ. Không cảnh báo nào gửi email — các luật cần điều kiện đúng liên tục 1 phút (§21.5).
- Giới hạn: `docker kill` / `docker stop` bị Docker coi là tắt chủ động nên **không** tự khởi động
  lại; server **treo** (còn chạy nhưng không trả lời) cũng không được Docker khởi động lại, chỉ bị
  healthcheck đánh dấu `unhealthy` (xử lý ở cảnh báo — §21.5, `docs/monitoring.md`).

### 21.3 Demo Kubernetes — chỉ server, một node (19/11, 01:35–01:46)

Docker Desktop Kubernetes (kubeadm, v1.34.1, một node). Pod server gọi Postgres và ClickHouse của
stack `kltn` qua `host.docker.internal`, bỏ qua bước chuẩn bị DB của entrypoint, không dùng Redis.
Production vẫn chạy trên Compose, không bị ảnh hưởng. Script: `deploy/k8s-demo/demo.ps1`. Bản v1 và v2
là **cùng một image** (khác tag): thứ được đo là cơ chế phát hành, không phải khác biệt code.

| Bước | Thao tác | Kết quả đo |
|---|---|---|
| Chia tải | 20 request vào Service (2 pod) | 12 / 8, 0 lỗi |
| Tự phục hồi | xoá 1 pod lúc 01:40:23 | pod mới Running 01:40:25, Ready 01:40:30 (~7 s); 62 request, 0 lỗi |
| Rolling update v1 → v2 | `kubectl set image`, maxSurge 1, maxUnavailable 0 | ~27 s; 287 request, 0 lỗi; 01:41:12–01:41:25 cả hai bản cùng trả lời |
| Phát hành bản lỗi | bản không bao giờ Ready (PORT sai) | pod lỗi nhận 0 request; 459 request, 0 lỗi; `rollout undo` lúc 01:42:17 |
| Blue-green, lần 1 | smoke test qua cổng xem trước | `/api/b2c/products` quá 15 s trên pod green vừa Ready → **không chuyển**, xoá green; 366 request, 0 lỗi, 100 % ở blue |
| Blue-green, lần 2 | smoke test chờ 30 s + thử lại 1 lần | chuyển Service sang green một lần lúc 01:45:31; 350 request, 0 lỗi, không có lúc hai bản cùng trả lời |

- Lần 1 bị chặn vì pod demo không có Redis và cache trong pod còn trống: đo lại trên pod blue, truy
  vấn danh sách sản phẩm đầu tiên mất 1.596 ms, lần sau 19 ms (production có Redis: 85 ms). Cổng
  kiểm tra làm đúng việc của nó: bản mới chưa qua kiểm tra thì khách không bị chuyển sang.
- RAM máy ảo Docker (cột "used" của `free -m`): 4.370 MiB trước khi bật Kubernetes; 5.025 MiB khi
  cụm rỗng (+655); 5.159 MiB với 2 pod + metrics-server (+789); 5.006 MiB sau khi dọn demo (+636,
  tức phần điều khiển của k8s). `kubectl top`: namespace `kube-system` 478 MiB, mỗi namespace demo
  ~85 MiB (2 pod).

### 21.4 CD: `/rebuild` → build trên GitHub → máy production tự kéo image (19/11)

Mã và tài liệu: `deploy/cd/README.md`. Lần deploy CD đầu tiên (`sha-7b93198`): bắt đầu
01:01:41, kéo 4 image mất ~1,5 phút, `up --wait` server ×3 + ai-bot + ai-rec 69 s (01:03:19 →
01:04:28, gồm chờ healthy), client 12 s, health check qua gateway đạt sau 8 s. Lần đó GitHub gửi hai
yêu cầu cho cùng bản (job thứ hai không tạo lại container nhưng ghi đè "bản trước"); đã chặn ở cả
workflow, listener và script deploy. Lần sau (`sha-06279f2`, 01:25:42 → 01:30:12) chỉ một job.
Mọi container server do CD tạo chạy `DB_PREP=off`: không migrate, không seed, không sửa kho.

**Web gián đoạn khi Compose tạo lại cả 3 bản server** — đo lúc triển khai bản có log JSON và cảnh
báo (19/11, 03:16) bằng một vòng lặp gọi `GET /api/health` qua gateway (`http://127.0.0.1:18000`) mỗi
~0,11 s: 1.505 lượt trong 170 s. Số liệu gốc và script đo:
`scripts/loadtest/results/downtime-20261119-031551/`.

| Thao tác | Lượt hỏng đầu → cuối | Thời gian | Lượt hỏng | Mã |
|---|---|---|---|---|
| Tạo lại 3 bản server | 03:16:12,77 → 03:16:22,23 | ~9,5 s | 68 | 503 (trang bảo trì của gateway: không còn bản nào) |
| Tạo lại gateway | 03:16:42,17 → 03:16:43,42 | ~1,3 s | 12 | không kết nối được |

- Ngoài hai khoảng trên: 0 lượt hỏng. Lượt đạt theo header `X-Served-By`: 3 bản cũ 65 / 64 / 64,
  3 bản mới 429 / 402 / 401.
- Compose thay **cả 3 bản cùng lúc**, không cuốn chiếu như rolling update của Kubernetes (§21.3:
  0 lỗi). Script CD cũng dùng `docker compose up -d` nên mỗi lần deploy server dự kiến gián đoạn cỡ này
  — chưa đo riêng cho một lần deploy CD.

### 21.5 Server treo → cảnh báo qua email → khởi động lại bằng tay (19/11, 08:31–08:37)

`scripts/grafana-demo.ps1 -Scenario hang` trên production, k6 giữ 150 req/s như §21.2. Script gửi
SIGSTOP cho tiến trình chính của bản `5456e704421b` (tiến trình còn sống nhưng không trả lời — Docker
không tự xử lý trường hợp này), hỏi API cảnh báo của Grafana mỗi 3 s, chờ thêm 40 s cho email đi rồi
làm như người trực: `docker restart`. Số liệu gốc (log script, JSON k6):
`scripts/loadtest/results/grafana-20261119-083139/`. Luật cảnh báo:
`monitoring/grafana/provisioning/alerting/rules.yml`.

| Mốc | Giờ | Sau lúc treo |
|---|---|---|
| SIGSTOP — bản đó treo | 08:33:15 | 0 s |
| "Server treo" Pending | 08:33:24 | 9 s |
| "Server treo" Firing | 08:34:25 | 70 s |
| Grafana gửi email "Server treo" (SMTP 5,3 s, không lỗi) | 08:34:54 | 99 s |
| `docker restart` (lệnh mất 13,7 s) | 08:35:05 → 08:35:19 | 110 s |
| Grafana gửi email "Thiếu server" (còn 2/3 bản) | 08:35:06 | 111 s |
| Đủ 3 bản healthy | 08:35:27 | 132 s |
| "Server treo" về Normal | 08:35:45 | 150 s |
| Email `[ĐÃ HẾT]` (lượt gửi cuối, không lỗi) | 08:40:06 | — |

- Email tới hộp thư nhận; người dùng xác nhận đã thấy. 70 s tới lúc Firing = `for: 1m` + chu kỳ
  đánh giá 10 s + lượt probe 10 s; email đi sau thêm `group_wait` 30 s; `[ĐÃ HẾT]` gửi ở lượt kế
  (`group_interval` 5 phút). Giờ gửi lấy từ API trạng thái contact point của Grafana
  (`lastNotifyAttempt`).
- k6: 47.250 request, p95 7,5 ms, p99 19,9 ms, 0 lượt bỏ; 0 response lỗi trước lúc treo, **8 sau**.
  Log gateway: cả 8 đều rơi vào bản treo (upstream 172.19.0.14) — 5 request chờ 60 s rồi k6 bỏ (nginx
  ghi 499), 3 request nhận 503 lúc bản đó bị restart (đã chờ 20–30 s, quá `proxy_next_upstream_timeout`
  10 s nên không được gửi lại). Bản treo vẫn nhận kết nối TCP (nhân hệ điều hành bắt tay thay tiến
  trình) nên gateway không thấy lỗi kết nối; `least_conn` ngừng chọn bản đang giữ nhiều kết nối dở nên
  chỉ vài request đầu bị kẹt.
- Bản treo không phục vụ 132 s, phần lớn là chờ người trực (ở đây script chờ email rồi mới restart).
  `docker restart` mất 13,7 s vì tiến trình bị dừng không xử lý SIGTERM: Docker chờ hết
  `stop_grace_period` 12 s rồi SIGKILL.
- So với §21.2: bản **chết** được Docker tự khởi động lại trong < 0,1 s và không có email; bản **treo**
  cần cảnh báo và người xử lý. Tự động hoá phần này (autoheal, Docker Swarm, liveness probe của
  Kubernetes — §21.3) để ở hướng phát triển (`docs/monitoring.md`, mục hướng phát triển).

### 21.6 Log tập trung (Loki) trong cùng lần chạy

Grafana Alloy đọc log container qua Docker API rồi đẩy vào Loki 3.7.9 — chỉ log API (gateway,
server) và sự kiện container (`health-events`), `docs/monitoring.md`. Đo bằng LogQL qua Grafana trên
khung của §21.5 (08:31:43–08:37:14, 331 s):

- Loki nhận 47.305 dòng log gateway và 47.467 dòng log server (k6 gửi 47.250 request; phần dư là các
  probe sức khoẻ).
- Lọc `| json | status=~"4..|5.."`: gateway 19 dòng = 8 request lỗi ở §21.5 + 11 lượt GET đường webhook
  SePay của probe public (404 là kết quả đúng, AGENTS.MD).
- Luồng `health-events` ghi đủ lần khởi động lại bằng tay: `kill` tín hiệu 15 (08:35:05,7) → `kill`
  tín hiệu 9 (08:35:17,8 — sau 12 s) → `stop` → `die` mã thoát 137 (08:35:18,7) → `start`
  (08:35:19,4) → `health_status: healthy` (08:35:24,5).
- Trong 110 s bản đó treo **không** có sự kiện nào: healthcheck của server (`docker-compose.yml`:
  interval 10 s, timeout 5 s, retries 12) cần 12 lượt hỏng liên tiếp (~15 s mỗi lượt ≈ 3 phút) mới báo
  `unhealthy`. Vì vậy cảnh báo treo dựa vào probe của Prometheus, không dựa vào trạng thái health của
  Docker.

### 21.7 Hạn chế của các số đo trên

- k6 và hệ thống chạy chung một máy nên tranh CPU; số tuyệt đối chỉ đúng cho máy này.
- Mỗi kịch bản đo một lần (failover hai lần); chưa có khoảng tin cậy.
- p95 phía server (Prometheus) không tính thời gian request chờ trước khi Express nhận; số p95/p99 ở
  bảng §21.1–21.2 là số k6 đo từ phía client, đã gồm phần chờ đó.
- Demo Kubernetes chạy một node: không chứng minh được khả năng chịu lỗi khi cả máy hỏng.
- Gián đoạn khi deploy (§21.4) đo từ chính máy production qua loopback, không phải từ phía khách qua
  Internet; 132 s không phục vụ ở §21.5 phụ thuộc người trực, chỉ đúng cho lần chạy có script chờ
  email 40 s.
