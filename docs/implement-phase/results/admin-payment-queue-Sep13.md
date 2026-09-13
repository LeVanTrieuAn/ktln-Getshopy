# Hàng đợi đối soát thanh toán cho Admin — spec chờ implement

> Ngày: 13/09/2026 · Trạng thái: **CHƯA LÀM** (P9 trong [implement-plan-Sep13.md](../implement-plan/implement-plan-Sep13.md) §A.8)
> Backend đã sinh sẵn dữ liệu cho màn này; chỉ thiếu lớp route + UI.

---

## Vì sao cần

Nguyên tắc xuyên suốt phần thanh toán: **không bao giờ im lặng bỏ qua tiền**.
Mọi giao dịch không gán được vào một đơn còn hiệu lực đều nằm lại trong bảng
`PaymentTransaction` chờ người thật xử lý. Không có màn hình này thì tiền của
khách rơi vào chỗ không ai nhìn thấy.

Bốn đường dẫn tới tình trạng đó, đều đã xảy ra được trong thực tế
(xem §A.3 của implement plan):

1. Khách chụp màn hình QR rồi quét lại sau nhiều giờ — chuẩn EMVCo không có
   trường hết hạn, chuỗi QR sống vĩnh viễn
2. Khách quét ở phút 4:50, ngân hàng xử lý xong lúc 5:15 — quá hạn giữ chỗ
3. Khách chuyển tay không quét QR, gõ sai nội dung hoặc sai số tiền
4. Khách chuyển 2 lần vì tưởng lần đầu thất bại

---

## Dữ liệu đã có sẵn

Bảng `PaymentTransaction` (đã migrate, đang chạy):

| Cột | Ý nghĩa |
|---|---|
| `provider` / `provider_txn_id` | nguồn + khoá chống trùng |
| `amount` | số tiền, Int đơn vị đồng |
| `content` / `content_norm` | nội dung CK thô và sau chuẩn hoá — để truy vì sao match/không match |
| `raw_payload` | payload gốc, ghi **trước** khi xử lý kể cả khi verify thất bại |
| `match_status` | trạng thái đối soát (bảng dưới) |
| `order_id` | đơn được gán, null nếu chưa gán được |
| `confirmed_by` / `confirmed_at` / `confirm_reason` | **audit — chưa có chỗ nào ghi vào, cần làm ở P9** |

### Các giá trị `match_status`

| Trạng thái | Nghĩa | Admin cần làm gì |
|---|---|---|
| `MATCHED` | khớp đơn còn hiệu lực | không cần |
| `LATE_MATCHED` | đơn đã hết hạn nhưng giữ chỗ lại được, vẫn cho PAID | không cần, nhưng nên xem để biết tần suất |
| `UNMATCHED` | chưa tìm ra đơn — **không phải trạng thái cuối**, job re-match còn quét lại | chờ; nếu tồn lâu thì xử lý tay |
| `REFUND_REQUIRED` | tiền đã vào nhưng không gán được vào đơn nào còn hiệu lực | **phải hoàn tiền** |
| `DUPLICATE` | đơn đã PAID rồi, đây là tiền thừa | **phải hoàn tiền** |

---

## Cần làm

### 1. Route

```
GET  /api/b2b/payments/queue?status=REFUND_REQUIRED&page=1
     -> danh sách giao dịch cần xử lý, mới nhất trước

GET  /api/b2b/payments/:id
     -> chi tiết một giao dịch + đơn liên quan (nếu có) + raw_payload

POST /api/b2b/payments/:id/assign
     body: { order_id, reason }
     -> gán tay một giao dịch vào đơn, chuyển đơn sang PAID

POST /api/b2b/payments/:id/mark-refunded
     body: { reason }
     -> đánh dấu đã hoàn tiền cho khách

POST /api/b2b/payments/rematch
     -> chạy tay webhookService.rematchPending()
```

Tất cả đều phải qua `authMiddleware` (admin), và ghi `confirmed_by` từ token.

### 2. Ràng buộc bắt buộc

- **Gán tay phải dùng lại đúng đường của webhook** — gọi
  `webhookService.applyPayment()` chứ không tự viết UPDATE riêng. Nếu không,
  nhánh tay sẽ bỏ sót phần commit voucher/điểm giống như bug đã gặp ngày 13/09
  (commit tồn kho nhưng quên voucher và không tích điểm).
- **Audit là bắt buộc**, không phải tuỳ chọn: `confirmed_by`, `confirmed_at`,
  `confirm_reason`. Đây là thao tác đụng tiền.
- **Không cho gán một giao dịch vào đơn đã PAID** — phải chặn ở tầng route,
  không dựa vào admin nhớ.
- Số tiền lệch thì vẫn cho gán tay, nhưng **bắt buộc nhập lý do**.

### 3. Màn hình

Một bảng là đủ, không cần dashboard:

```
[ Cần hoàn tiền (3) ] [ Chưa khớp (12) ] [ Đã xử lý ]

Thời gian        Số tiền        Nội dung CK              Trạng thái         Thao tác
13/09 15:20   24.110.000đ   CT tu 098... ND GSJR7...   REFUND_REQUIRED   [Gán đơn] [Đã hoàn]
13/09 14:02   25.990.000đ   khach quen ghi noi dung    UNMATCHED         [Gán đơn]
```

Bấm một dòng thì xổ ra `raw_payload` và `content_norm` — khi đối soát sai thì
đó là hai thứ duy nhất truy được nguyên nhân.

### 4. Cảnh báo nên có

- Số giao dịch `REFUND_REQUIRED` > 0 kéo dài quá 24h
- Số giao dịch `UNMATCHED` tăng đột biến — dấu hiệu `payment_ref` sinh sai hoặc
  ngân hàng đổi cách cắt nội dung chuyển khoản
- `reserved` của một sản phẩm > 0 liên tục nhiều giờ mà không có đơn PENDING nào
  — dấu hiệu job hết hạn chết, tồn khả dụng đang rò rỉ

---

## Phụ thuộc

Không phụ thuộc gì chưa có. Backend đã xong:
`webhookService.applyPayment()`, `webhookService.rematchPending()`,
`orderLifecycle.commitOrder()` đều đã có test.
