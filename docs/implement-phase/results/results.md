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

Bản cũ `materialized='table'`: mỗi lần dbt chạy là DROP rồi CREATE lại. Với
chu kỳ 5 phút thì có một khoảng bảng không tồn tại hoặc rỗng — AI-Rec fetch
đúng lúc đó sẽ train trên bảng trống và **xoá sạch model đang tốt**.

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
