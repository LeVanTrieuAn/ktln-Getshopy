# Kết quả thực hiện — Mục 2: Payment VietQR

> Cập nhật: 13/09/2026 · Hệ Ecommerce (`ktln-Getshopy`)
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

- **Giao diện admin** cho hàng đợi đối soát (route đã có, chưa có UI) — [spec](admin-payment-queue-Sep13.md)
- **`local-infra-sandbox/.env`** chứa password thật, thư mục chưa có `.gitignore`
- **`wal_level=logical`** chưa bật trên Postgres → mục 3 chưa chạy CDC được
- **Phase 2.0** — gộp 37 script seed one-off
- **Giao dịch thật `GSA3G3SBC7Q` (100.000đ)** chuyển trước khi có `SEVQR`, SePay
  không ghi nhận nên không tự đối soát được — cần xác nhận tay khi có admin queue
