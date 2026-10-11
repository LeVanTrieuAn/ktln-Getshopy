# Hướng phát triển: Tách Microservice cho phân hệ E-commerce

> Phạm vi: chỉ phân hệ E-commerce (`ktln-Getshopy`). Hệ BigData (LakeHouse) không bị ảnh hưởng trực tiếp (xem mục 8).
> Trạng thái: **định hướng tương lai, chưa triển khai**.

## 1. Hiện trạng

Server hiện là **Modular Monolith** (Node.js + Prisma + PostgreSQL duy nhất). Các module (order, inventory, voucher, loyalty, payment...) gọi nhau bằng lời gọi hàm trong cùng một process và dùng chung **một database transaction ACID**.

Ví dụ trong `server/src/services/payment/webhookService.js`, khi webhook SePay về:

1. `UPDATE "Order" SET payment_status='PAID' ... WHERE payment_status='PENDING'` (idempotency tầng 2).
2. `lifecycle.commitOrder(tx, orderId)` trong `prisma.$transaction`: chốt tồn kho, voucher, điểm, tích điểm.
3. Cập nhật `PaymentTransaction.match_status`.

Các dịch vụ AI (`ai-bot`, `ai-rec`) và Data Analytics đã là hệ tách rời. Phần còn lại của lõi thương mại là một khối.

**Vì sao chưa tách:** quy mô dự án (khoá luận) chưa cần; tách sớm đánh đổi tính nhất quán mạnh lấy độ phức tạp vận hành (xem [1], [2]).

## 2. Động lực tách `payment-service`

| Lý do | Giải thích |
|---|---|
| Cô lập lỗi | Provider (SePay) chậm/lỗi không kéo sập checkout, catalog |
| Scale độc lập | Webhook là luồng burst, khác đặc tính tải của catalog/đọc |
| Bảo mật / PCI-scope | Dữ liệu giao dịch, khoá API, chữ ký webhook gom một nơi, giảm bề mặt tấn công |
| Thay provider | Adapter (`providers/sepay.js`, `simulator.js`) đóng gói sau một API ổn định |
| Quyền sở hữu dữ liệu | `PaymentTransaction` thuộc về payment, không bị module khác ghi trực tiếp |

## 3. Ranh giới đề xuất

```
              ┌────────────────┐   events     ┌──────────────────┐
 Client ───►  │ core-service   │ ───────────► │ payment-service  │ ◄── SePay webhook
 (Nginx)      │ order,inventory│ ◄─────────── │ PaymentTransaction│
              │ voucher,loyalty│   events     │ reconciliation   │
              └───────┬────────┘              └────────┬─────────┘
                      │ DB riêng                       │ DB riêng
                      └──────────── Message Broker (Kafka) ────────┘
```

- **payment-service sở hữu:** `PaymentTransaction`, logic đối soát (`extractPaymentRefs`, so khớp số tiền, kiểm tra tài khoản nhận), adapter provider, job re-match, hàng đợi `REFUND_REQUIRED`.
- **core-service giữ:** `Order`, `OrderItem`, tồn kho, voucher, điểm.
- Mỗi service có **database riêng** (database-per-service); cấm JOIN/ghi chéo schema.

## 4. Danh sách vấn đề (issues) khi tách payment-service

### 4.1. Mất giao dịch ACID xuyên service
Hiện bước "đánh dấu PAID" + "commit tồn kho/voucher/điểm" cùng một transaction. Sau khi tách, `PaymentTransaction` nằm DB payment, `Order`/kho nằm DB core, **không còn transaction chung**. 2PC/XA không phù hợp (khoá kéo dài, coordinator là điểm lỗi đơn) → phải dùng **Saga + eventual consistency** [3].

### 4.2. Dual-write
Payment ghi DB rồi publish event là hai thao tác độc lập. Nếu crash giữa hai bước:
- Đã ghi `MATCHED` nhưng event không gửi → khách trả tiền mà đơn mãi `PENDING`, hết hạn (đúng kịch bản cảnh báo trong quy tắc dự án: tiền đã vào nhưng đơn không PAID).
- Event gửi nhưng DB rollback → đơn PAID mà không có bản ghi giao dịch.
**Giải pháp: Transactional Outbox** (mục 5) [4].

### 4.3. Data awareness: payment cần biết đơn hàng
`applyPayment` hiện đọc trực tiếp `Order` (qua `payment_ref`, so `amount !== order.total`). Sau khi tách, payment không được đọc DB core. Các phương án:

| Phương án | Ưu | Nhược |
|---|---|---|
| A. Gọi đồng bộ REST/gRPC sang core | Dữ liệu luôn mới | Coupling thời gian, webhook phụ thuộc core sống, thêm latency, retry phức tạp |
| B. **Bản sao đọc cục bộ (read model)** trong payment, cập nhật bằng event `OrderCreated/OrderExpired/OrderCancelled` | Webhook xử lý độc lập core | Dữ liệu có thể trễ; phải xử lý race (xem 4.4) |
| C. Core gửi kèm `payment_ref` + `total` khi tạo phiên thanh toán (command `CreatePaymentIntent`) | Payment tự đủ thông tin, mô hình rõ ràng | Thêm một bước giao tiếp khi checkout |

Khuyến nghị: **C + B** (payment-intent tạo khi checkout, read model cập nhật trạng thái đơn qua event). *Cần user xác nhận trước khi triển khai.*

### 4.4. Race: webhook đến trước event tạo đơn
Hiện đã có xử lý một phần: `UNMATCHED` + `rematchPending` vì "webhook có thể đến trước khi đơn kịp commit". Khi bất đồng bộ qua broker, cửa sổ race **rộng hơn** (độ trễ broker). Cần giữ job re-match và đảm bảo nó đọc **read model**, không đọc DB core.

### 4.5. Thứ tự và trùng lặp event
Broker thường đảm bảo **at-least-once**, không phải exactly-once. Yêu cầu:
- Consumer **idempotent** (lưu `event_id` đã xử lý – inbox table).
- Thứ tự theo khoá phân vùng `order_id` (partition key) để `OrderExpired` không đến trước `OrderCreated`.
- Idempotency hiện có (`provider_txn_id @unique`, cập nhật có điều kiện `WHERE payment_status='PENDING'`) vẫn phải giữ ở **ranh giới provider** và **ranh giới core**.

### 4.6. Saga bù trừ (compensation)
Luồng thanh toán thành công:
1. payment: ghi `PaymentTransaction`, outbox `PaymentConfirmed{orderId, amount, txnId}`.
2. core: consume → `PENDING→PAID` có điều kiện, `commitOrder` (kho, voucher, điểm).
3. core: outbox `OrderPaid` hoặc `OrderPaymentRejected`.

Các nhánh lỗi cần thiết kế:
- Đơn đã `EXPIRED` và **hết hàng** (hiện là `retryExpiredOrder` → `REFUND_REQUIRED`): core phát `OrderPaymentRejected`, payment chuyển `REFUND_REQUIRED`.
- Đơn đã `PAID` (tiền thừa): `DUPLICATE`.
- Sai số tiền/sai tài khoản: payment tự quyết, **không cần hỏi core** (nếu amount lưu trong payment-intent).
Hiện `retryExpiredOrder` đặt `reserveStock` + PAID trong cùng transaction; sau tách phải do core thực hiện hoàn toàn khi nhận `PaymentConfirmed`, payment không biết kho.

### 4.7. Hết hạn đơn (TTL) và đồng hồ
Việc hết hạn giữ chỗ nằm ở core. Payment cần nhận `OrderExpired` để biết trạng thái, nhưng vẫn phải **chấp nhận** tiền đến muộn (QR không có trường hết hạn). Quyết định cuối thuộc core.

### 4.8. Quan sát và truy vết
Một đơn đi qua nhiều service: cần `correlation_id`/trace (OpenTelemetry) [5], dashboard trạng thái saga, cảnh báo cho outbox lag và `REFUND_REQUIRED`.

### 4.9. Webhook và tunnel
Endpoint công khai `/api/payment/webhook/sepay` hiện được định tuyến qua Nginx của client. Sau tách phải route sang payment-service (Nginx/API Gateway). **URL khai trong SePay có thể đổi** nếu thay đổi cổng/tunnel (quick tunnel `trycloudflare.com`); nên dùng named tunnel / domain cố định, vì sai URL → webhook mất im lặng.

### 4.10. Vận hành
Thêm: broker, DB thứ hai, CI/CD, migration riêng, contract test giữa service, chi phí hạ tầng. Dự án khoá luận chạy bằng Docker Compose một máy → tăng RAM/độ phức tạp.

## 5. Transactional Outbox

**Ý tưởng:** ghi event vào bảng `outbox` **trong cùng transaction** với thay đổi nghiệp vụ; một relay tiến trình riêng đọc bảng này và publish lên broker [4].

```sql
CREATE TABLE outbox (
  id            UUID PRIMARY KEY,
  aggregate_id  TEXT NOT NULL,       -- order_id: dùng làm partition key
  event_type    TEXT NOT NULL,       -- PaymentConfirmed, PaymentRefundRequired...
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  published_at  TIMESTAMPTZ          -- NULL = chưa gửi
);
CREATE TABLE inbox (                 -- phía consumer, chống xử lý lặp
  event_id      UUID PRIMARY KEY,
  processed_at  TIMESTAMPTZ DEFAULT now()
);
```

Áp dụng vào code hiện tại, tại `applyPayment`:

```js
await prisma.$transaction(async tx => {
  await tx.paymentTransaction.update({ /* match_status: MATCHED */ });
  await tx.outbox.create({ data: { aggregate_id: orderId,
        event_type: 'PaymentConfirmed', payload: { orderId, amount, txnId } } });
});
// Relay (tiến trình riêng) đọc outbox WHERE published_at IS NULL -> publish -> đánh dấu
```

**Hai cách relay:**
| Cách | Ưu | Nhược |
|---|---|---|
| Polling publisher | Đơn giản, không phụ thuộc thêm | Độ trễ, tải truy vấn định kỳ |
| CDC (Debezium) đọc WAL | Độ trễ thấp, không polling | Cần Kafka Connect/Debezium |

Lưu ý liên hệ: dự án **đã có hạ tầng CDC Kafka** ở hệ BigData (Postgres → Kafka → MinIO). Có thể tái dùng ý tưởng nhưng **không được dùng chung pipeline** nếu chưa được user xác nhận (xem mục 8).

**Đảm bảo thu được:** at-least-once delivery + consumer idempotent ⇒ hiệu ứng "effectively-once". Không phải exactly-once tuyệt đối [4].

## 6. Lộ trình triển khai (phases)

| Phase | Nội dung | Rủi ro |
|---|---|---|
| 0 | Chuẩn bị: ghi lại hợp đồng sự kiện, thêm `correlation_id`, tách code payment thành module có interface rõ (đã gần đạt) | Thấp |
| 1 | Thêm bảng `outbox`/`inbox` **trong monolith**, publish event nội bộ; chưa tách DB | Thấp |
| 2 | Dựng broker (Kafka) + relay; core consume event của chính nó để kiểm chứng | Trung bình |
| 3 | Tách payment-service + DB riêng; dùng `CreatePaymentIntent` + read model | **Cao** |
| 4 | Chuyển webhook route sang payment-service, cập nhật URL SePay nếu đổi | Cao (mất tiền nếu sai) |
| 5 | Observability, test chaos (kill relay, trễ broker, trùng event) | Trung bình |

Mỗi phase phải rollback được (feature flag), và chỉ làm khi user xác nhận.

## 7. Yêu cầu ngoài phạm vi agent

- Quyết định hạ tầng broker (Kafka vs RabbitMQ) và tài nguyên máy.
- Cập nhật URL webhook trên dashboard SePay (thao tác thủ công).
- Quản lý secret (xem mục 9).
- Đồng ý phương án 4.3 (A/B/C).

## 8. Trade-off ảnh hưởng hai hệ

| Hệ | Ảnh hưởng |
|---|---|
| E-commerce | Từ ACID mạnh sang eventual consistency; vận hành phức tạp hơn |
| BigData | CDC kéo từ Postgres: DB tách ⇒ phải bổ sung nguồn CDC cho DB của payment-service; schema `PaymentTransaction`, `outbox` xuất hiện trong luồng, cần quyết định có đưa vào staging/dbt hay lọc bỏ. Bảng `outbox` không nên vào báo cáo |
| Chung | `fact_order_detail`, `mart_revenue` cần nối dữ liệu thanh toán từ hai DB, nên dựa vào event/CDC thay vì JOIN trực tiếp |

## 9. Cảnh báo bảo mật (nhắc user)

Cần rà soát và **ẩn khỏi mã nguồn công khai/commit** các secret như: `SEPAY_*` (API key/webhook secret), `VIETQR_ACCOUNT_NO`, `DATABASE_URL`, JWT secret, khoá email/AI. Chỉ giữ `.env.example` với giá trị giả; nếu đã lộ trong git history thì phải **xoay (rotate) khoá**.

## 10. Kết luận

Kiến trúc hiện tại (Modular Monolith) phù hợp quy mô khoá luận. Tách `payment-service` là bước hợp lý đầu tiên vì ranh giới rõ, nhưng phải đi kèm **Saga + Transactional Outbox + Inbox idempotent**, nếu không sẽ phát sinh mất đồng bộ giữa tiền và đơn hàng.

## Tài liệu tham khảo

1. M. Fowler, "MonolithFirst", martinfowler.com/bliki/MonolithFirst.html
2. S. Newman, *Building Microservices*, 2nd ed., O'Reilly, 2021.
3. H. Garcia-Molina, K. Salem, "Sagas", ACM SIGMOD, 1987.
4. C. Richardson, "Pattern: Transactional outbox", microservices.io/patterns/data/transactional-outbox.html; và *Microservices Patterns*, Manning, 2018.
5. OpenTelemetry, opentelemetry.io/docs
