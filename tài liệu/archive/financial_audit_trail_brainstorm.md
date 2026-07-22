# BRAINSTORM — Financial Audit Trail & Revenue Attribution tầm Tập Đoàn
## "5 Tỷ/Ngày từ 30.000 Chi Nhánh — Không Được Mất Một Đồng Nào"

> **Bài toán cốt lõi bạn đặt ra:** Một chuỗi bán lẻ Apple có 30.000 điểm thu (chi nhánh, đại lý, online). Doanh thu 5 tỷ/ngày = 1.825 tỷ/năm. Hóa đơn từ 6 tháng trước phải tra cứu được ngay lập tức và CHÍNH XÁC TUYỆT ĐỐI. Kế toán phải đối soát được từng đồng.
>
> **Tại sao khó?** 30.000 nguồn dữ liệu × hàng chục giao dịch/ngày = hàng triệu events/ngày. Mỗi event phải được ghi nhận đúng chi nhánh, đúng thời điểm, đúng trạng thái — kể cả khi nó đến muộn 6 tháng.

---

## VẤN ĐỀ A: DOUBLE-ENTRY LEDGER — Nguyên lý kế toán 500 năm + Big Data

### 📒 Nguyên lý Leonardo da Vinci (Luca Pacioli, 1494)

Kế toán kép (Double-entry bookkeeping) ra đời năm 1494, nhưng đây chính là nền tảng không thể thay thế của mọi hệ thống tài chính hiện đại:

```
Quy tắc vàng: Mỗi giao dịch tài chính PHẢI được ghi vào ĐỦ 2 chiều
  DEBIT (Nợ) luôn = CREDIT (Có)
  
Ví dụ: Chi nhánh Hà Nội bán iPhone 15 Pro Max giá 33.990.000 VND

  DEBIT  (Tăng):  Cash Account (Tiền mặt HN)     +33.990.000
  CREDIT (Giảm):  Revenue Account (Doanh thu HN)  -33.990.000
  CREDIT (Giảm):  Inventory Account (Kho HN)      -25.000.000  (Giá vốn)
  DEBIT  (Tăng):  COGS Account (Giá vốn hàng bán) +25.000.000

Bất kỳ lúc nào: SUM(all DEBIT) == SUM(all CREDIT) == 0
→ Nếu số liệu không cân bằng → Có lỗi ở đâu đó!
```

**Áp dụng với CDC Kafka:**
```
Mỗi Transaction trong PostgreSQL sinh ra 2 CDC Events:
  Event 1: LEDGER_ENTRY {type: DEBIT,  account: "cash.HN001",     amount: 33990000}
  Event 2: LEDGER_ENTRY {type: CREDIT, account: "revenue.HN001",  amount: 33990000}

Kafka Consumer aggregate theo account:
  account "revenue.HN001" = SUM(CREDIT) - SUM(DEBIT)
  → Doanh thu chi nhánh HN001 real-time!

ClickHouse validation rule (chạy mỗi giờ):
  SELECT SUM(CASE WHEN type='DEBIT' THEN amount ELSE -amount END) as balance
  FROM ledger_events
  WHERE date = TODAY()
  HAVING ABS(balance) > 1000  -- Nếu mất cân bằng > 1000 VND → Alert!
```

**Giá trị học thuật:** Kế toán kép là ví dụ đầu tiên của "Immutable Append-Only Log" trong lịch sử loài người — 530 năm trước khi Kafka ra đời!

---

## VẤN ĐỀ B: REVENUE ATTRIBUTION — Gán đúng doanh thu cho đúng nguồn

### 🏪 Bài toán 30.000 nguồn thu

```
Cấu trúc cây phân cấp doanh thu:

Tập đoàn (National)
  ├── Vùng Bắc (Region HN)
  │     ├── Chi nhánh HN001 (Hoàn Kiếm)
  │     │     ├── Nhân viên Sale001 (Nguyễn Văn A)
  │     │     ├── Nhân viên Sale002 (Trần Thị B)
  │     │     └── Online Channel (QR Code HN001)
  │     └── Chi nhánh HN002 (Cầu Giấy)
  ├── Vùng Nam (Region HCM)
  │     └── ...
  └── Kênh Online (E-commerce)
        ├── Website
        ├── App
        └── Lazada/Shopee affiliate

Yêu cầu: CEO phải nhìn thấy NGAY doanh thu theo BẤT KỲ cấp nào:
  "Doanh thu Vùng Bắc hôm nay là bao nhiêu?"
  "Nhân viên Sale001 đã bán được bao nhiêu trong tháng này?"
  "Kênh Online chiếm bao nhiêu % tổng doanh thu?"
```

**Giải pháp — Hierarchical Aggregation trên ClickHouse:**
```sql
-- Mỗi event mang đầy đủ metadata phân cấp
INSERT INTO revenue_events VALUES (
  order_id       = 'ORD_20240315_001',
  amount         = 33990000,
  branch_id      = 'HN001',
  region_id      = 'NORTH',
  channel        = 'POS',
  salesperson_id = 'SALE001',
  event_time     = '2024-03-15T10:30:00Z',
  -- Materialized path (đường dẫn đầy đủ)
  hierarchy_path = 'NATIONAL/NORTH/HN001/POS/SALE001'
);

-- Query linh hoạt theo bất kỳ cấp nào:
-- Doanh thu Vùng Bắc:
SELECT SUM(amount) FROM revenue_events
WHERE startsWith(hierarchy_path, 'NATIONAL/NORTH/')
  AND event_time BETWEEN '2024-03-01' AND '2024-03-31';

-- Kết quả trong: 50ms dù có 500 triệu records
```

---

## VẤN ĐỀ C: LATE FINANCIAL ADJUSTMENT — Hóa đơn điều chỉnh từ 6 tháng trước

### ❗ Đây là vấn đề nguy hiểm nhất trong kế toán

**Kịch bản thực tế:**

```
Tháng 3/2024: Chi nhánh HN001 bán MacBook Pro 49.990.000 VND
  → Doanh thu tháng 3: 49.990.000 VND ✓

Tháng 9/2024 (6 tháng sau):
  → Khách hàng phát hiện máy bị lỗi batch sản xuất
  → Apple phát hành "Credit Note" (Phiếu hoàn tiền) cho toàn bộ batch
  → HN001 phải hoàn trả 5.000.000 VND cho khách

Vấn đề: Báo cáo tháng 3 đã được kế toán chốt sổ, đã nộp thuế!
  Option A: Điều chỉnh ngược tháng 3 → Vi phạm nguyên tắc kế toán!
  Option B: Ghi nhận vào tháng 9 nhưng phải reference về tháng 3 → Phức tạp
```

**Giải pháp — Adjusting Journal Entry (AJE) với Event Sourcing:**
```
Nguyên tắc: KHÔNG BAO GIỜ xóa/sửa records cũ.
Chỉ thêm "Adjusting Events" với reference đến original event.

Event mới trong Kafka:
{
  "type": "CREDIT_NOTE",
  "amount": -5000000,           -- Âm = giảm doanh thu
  "original_order_id": "ORD_20240315_001",  -- Reference về tháng 3
  "original_date": "2024-03-15",
  "adjustment_date": "2024-09-20",
  "adjustment_reason": "Apple Product Recall - Batch A2024",
  "branch_id": "HN001",
  -- Quan trọng: Ghi nhận TẠI THÁNG 9 cho báo cáo tháng 9
  -- NHƯNG vẫn có thể trace về tháng 3 gốc
  "accounting_period": "2024-09"
}

ClickHouse query linh hoạt:
  -- Báo cáo tháng 3 KHÔNG thay đổi (historical accuracy):
  SELECT SUM(amount) FROM ledger WHERE accounting_period = '2024-03'
  -- Kết quả: 49.990.000 VND (như lúc chốt sổ)
  
  -- Báo cáo ADJUSTED (có tính điều chỉnh):
  SELECT SUM(amount) FROM ledger WHERE original_order_id = 'ORD_20240315_001'
  -- Kết quả: 49.990.000 - 5.000.000 = 44.990.000 VND (số thực tế)
```

---

## VẤN ĐỀ D: INTERCOMPANY TRANSACTIONS — Giao dịch giữa các chi nhánh

**Bài toán:**
```
Chi nhánh HN001 (Hà Nội) hết hàng iPhone 15 Pro Max
Chi nhánh HCM001 (TP.HCM) còn 5 máy
→ HN001 yêu cầu chuyển 3 máy từ HCM001

Đây KHÔNG PHẢI là bán hàng — đây là giao dịch nội bộ (Intercompany)
Nhưng nó ảnh hưởng đến:
  - Kho của HCM001 (giảm 3)
  - Kho của HN001 (tăng 3)
  - Giá vốn phân bổ (Cost allocation)
  - Báo cáo tồn kho theo chi nhánh

Nếu tính sai → Doanh thu HCM001 bị tính hai lần (cả lúc chuyển và lúc HN001 bán)
```

**Giải pháp — Elimination Entries:**
```
Giao dịch nội bộ sinh 2 Events:

Event 1: INTERCOMPANY_TRANSFER_OUT
  {branch: "HCM001", qty: 3, product: "iPhone15PM", cost: 75000000}
  → Trừ kho HCM001

Event 2: INTERCOMPANY_TRANSFER_IN
  {branch: "HN001", qty: 3, product: "iPhone15PM", cost: 75000000}
  → Cộng kho HN001

Kafka Stream: Khi nhận cặp Events này:
  → Đánh dấu "intercompany" flag
  → Tạo "Elimination Entry" triệt tiêu 2 chiều

ClickHouse Consolidated Report:
  SELECT SUM(revenue) - SUM(intercompany_elimination) as net_revenue
  FROM revenue_events
  WHERE entity_level = 'NATIONAL'
  
→ Loại bỏ hoàn toàn doanh thu "nội bộ", chỉ tính doanh thu thực từ khách hàng
```

---

## VẤN ĐỀ E: MULTI-RATE TAX ATTRIBUTION — Phân bổ thuế đa tỷ lệ

**Bài toán:**
```
Apple Reseller bán nhiều loại hàng hóa có thuế VAT khác nhau:
  iPhone, MacBook: VAT 10%
  Phần mềm (Office 365): VAT 10% nhưng quy tắc khác
  Dịch vụ sửa chữa: VAT 10%
  Gói bảo hiểm (AppleCare+): VAT 10% nhưng hạch toán khác

Một đơn hàng combo:
  iPhone 15 Pro Max: 33.990.000
  AppleCare+ 2 năm:   5.900.000
  Ốp lưng:               790.000
  
→ Tổng: 40.680.000
→ VAT tổng: 40.680.000 × 10% = 4.068.000 ??? SAI!
→ Mỗi line item có quy tắc VAT riêng, phải tính riêng từng dòng!
```

**Giải pháp — Tax Engine tích hợp CDC Kafka:**
```
Mỗi line item trong order là 1 Event riêng biệt:
{
  "order_id": "ORD_001",
  "line_item_id": "LINE_001",
  "product_id": "IPHONE_15_PM",
  "product_category": "HARDWARE",
  "amount": 33990000,
  "tax_code": "VAT_10_GOODS",
  "tax_amount": 3399000,
  "tax_base": 30590909  -- Giá chưa VAT
}

Tax Code Engine (Rule-based):
  VAT_10_GOODS: rate=10%, reporting_form=01GTGT
  VAT_10_SERVICE: rate=10%, reporting_form=02GTGT (khác)
  VAT_EXEMPT: rate=0%, phải khai báo riêng

Kafka Stream aggregates by tax_code mỗi tháng:
  → Tự động sinh báo cáo thuế theo đúng từng mẫu của Tổng cục Thuế
  → Không cần kế toán manually tổng hợp → Giảm thiểu sai sót
```

---

## VẤN ĐỀ F: REVENUE RECOGNITION — Khi nào tiền mới được "công nhận"?

**Bài toán (IFRS 15 — Chuẩn mực kế toán quốc tế):**
```
Khách đặt mua iPhone qua website (Pre-order), trả tiền ngay:
  01/09: Khách trả 33.990.000 VND → Tiền vào tài khoản
  15/09: iPhone 16 ra mắt, hàng được giao cho khách

Câu hỏi: Doanh thu 33.990.000 ghi nhận vào ngày 01/09 hay 15/09?

Theo IFRS 15: Doanh thu chỉ được ghi nhận khi "Performance Obligation được hoàn thành"
→ Tức là khi hàng được GIAO, không phải khi tiền về!

01/09: DEBIT Cash: +33.990.000 | CREDIT Deferred Revenue (Doanh thu trả trước): +33.990.000
15/09: DEBIT Deferred Revenue: -33.990.000 | CREDIT Revenue (Doanh thu thực): +33.990.000

Nếu hạch toán sai → Doanh thu tháng 9 bị tính vào tháng 8 → Báo cáo sai kỳ
```

**Giải pháp — Revenue Recognition Engine:**
```
Event 1: ORDER_PREPAID (01/09)
  → Kafka → ClickHouse ghi vào bucket "deferred_revenue"
  → KHÔNG đưa vào "revenue" → Chưa được công nhận

Event 2: ORDER_DELIVERED (15/09)
  → Kafka Stream detect: order_id này có EVENT ORDER_PREPAID trước đó
  → Tự động generate REVENUE_RECOGNIZED event
  → Move từ "deferred_revenue" sang "revenue" trong ClickHouse

Dashboard CFO:
  Committed Revenue (Doanh thu thực):  Chỉ tính delivered orders
  Deferred Revenue (Tiền chờ giao):    Pre-orders đã thu tiền chưa giao
  Pipeline Revenue (Đơn tiềm năng):    Đơn đã đặt chưa thu tiền
```

---

## VẤN ĐỀ G: AUDIT TRAIL IMMUTABILITY — "Không ai có thể xóa số liệu cũ"

**Yêu cầu pháp lý nghiêm ngặt:**
```
Luật kế toán VN (Điều 41, Luật Kế toán 2015):
  → Lưu trữ chứng từ kế toán tối thiểu 10 năm
  
Nghị định 123/2020/NĐ-CP:
  → Hóa đơn điện tử lưu 10 năm, không được xóa, không được sửa
  
IFRS 15 (Chuẩn quốc tế):
  → Disclosure yêu cầu có thể truy vết nguồn gốc mọi số liệu trong báo cáo tài chính

Vấn đề thực tế:
  → Năm 2034 kiểm toán yêu cầu: "Cho tôi xem hóa đơn #HN001-2024-0001"
  → Hệ thống đã upgrade 4 lần, migrate DB 3 lần
  → File hóa đơn gốc có còn không? Schema còn compatible không?
```

**Giải pháp — Worm Storage + Cryptographic Seal:**
```
WORM Storage (Write Once, Read Many):
  → AWS S3 Object Lock (Compliance Mode): KHÔNG AI có thể xóa, kể cả Admin
  → Retention: 10 năm, lock cứng ở storage level
  → Mọi hóa đơn PDF + JSON raw data được lưu vào S3 WORM ngay khi tạo

Cryptographic Seal:
  → Mỗi hóa đơn được ký số (Digital Signature) với khóa bí mật của công ty
  → Hash của hóa đơn + timestamp được đưa lên Blockchain (Hoặc Immutable Log)
  → 10 năm sau: Verify chữ ký → Chứng minh hóa đơn chưa bị chỉnh sửa

Schema Evolution Archive:
  → Lưu kèm schema version mỗi lần migration
  → Apache Avro: backward compatible → Đọc được data từ 10 năm trước
```

---

## VẤN ĐỀ H: RECONCILIATION AT SCALE — Đối soát 5 tỷ/ngày từ 30.000 nguồn

**Bài toán đối soát 3 chiều:**
```
Nguồn 1: POS System (Hệ thống bán hàng)
  → Ghi nhận: Bán 150 máy × trung bình 25 triệu = 3.750.000.000 VND

Nguồn 2: Payment Gateway (Cổng thanh toán: VNPay, Momo, thẻ)
  → Nhận: 3.748.500.000 VND (Chênh 1.500.000 VND!)

Nguồn 3: Bank Statement (Sao kê ngân hàng)
  → Về: 3.746.000.000 VND (Chênh thêm 2.500.000 VND!)

Câu hỏi: Tiền đi đâu? Ai nợ ai?
  Chênh lệch 1: POS - Gateway = 1.500.000 → Có thể phí gateway?
  Chênh lệch 2: Gateway - Bank = 2.500.000 → Tiền đang float (in transit)?
```

**Giải pháp — 3-Way Reconciliation Engine:**
```
Kafka Topic 1: "pos_revenue_events"      ← Nguồn từ POS CDC
Kafka Topic 2: "payment_gateway_events"  ← Webhook từ VNPay/Momo
Kafka Topic 3: "bank_statement_events"   ← File MT940 từ ngân hàng

Kafka Stream JOIN 3 Topics:
  Match key: order_id (trường hợp lý tưởng)
  Fallback: amount + timestamp + branch_id (fuzzy matching)

ClickHouse lưu Reconciliation Status:
  "MATCHED_3WAY"  → Tất cả 3 nguồn khớp → OK
  "MATCHED_2WAY"  → POS + Gateway khớp, Bank chưa nhận → Float
  "UNMATCHED_POS" → Chỉ có trong POS, không có trong Gateway → Cần điều tra
  "UNMATCHED_GW"  → Payment gateway nhận tiền nhưng POS không có đơn → Nghiêm trọng!

Auto-alert khi:
  UNMATCHED_GW > 0     → Alert cấp 1 (Có thể fraud hoặc ghost transaction)
  Float > 10% revenue  → Alert cấp 2 (Có thể ngân hàng delay)
  3-way mismatch > 1%  → Alert cấp 3 (Kiểm tra ngay)
```

---

## VẤN ĐỀ I: CASH FLOAT TRACKING — Tiền đang "trôi nổi" trên đường đi

**Bài toán:**
```
Khách thanh toán qua VNPay lúc 14:30 ngày 15/03
→ VNPay xác nhận: 14:30:05 (ngay lập tức)
→ VNPay batch settle về TK ngân hàng công ty: 17:00 hàng ngày
→ Ngân hàng process và credit: T+1 (ngày làm việc tiếp theo)
→ Tiền thực sự vào tài khoản: 09:00 ngày 16/03

Trong khoảng 14:30 - 09:00 hôm sau:
  → Tiền "tồn tại" trong hệ thống VNPay (không phải trong ngân hàng)
  → Đây gọi là "Cash Float" hay "Payment in Transit"
  → Tổng Float của 30.000 chi nhánh trong 1 ngày: Có thể vài trăm tỷ!

CFO lo lắng: "Tiền của công ty đang ở đâu vào lúc 3h sáng?"
```

**Giải pháp — Real-time Float Dashboard:**
```
Mỗi payment event đi kèm "float_state":

AUTHORIZED    → VNPay đã xác nhận, tiền chưa về
SETTLED       → VNPay đã gửi về TK công ty
CREDITED      → Ngân hàng đã credit vào balance
RECONCILED    → Match với Bank statement ✓

ClickHouse SUM by float_state:
  SELECT float_state, SUM(amount), COUNT(*) as transactions
  FROM payment_events
  WHERE settlement_date = TODAY()
  GROUP BY float_state

→ CFO thấy real-time: "Đang có 45 tỷ AUTHORIZED (chưa về)"
→ Treasury team biết: Chiều nay sẽ về thêm 45 tỷ
→ Không cần phải "đi hỏi từng chi nhánh"
```

---

## VẤN ĐỀ J: BRANCH PERFORMANCE ANOMALY DETECTION

**Bài toán — Phát hiện gian lận tài chính cấp chi nhánh:**
```
30.000 chi nhánh, mỗi ngày có 150.000 giao dịch.
Làm sao tìm ra chi nhánh nào đang gian lận trong đống data đó?

Ví dụ gian lận thực tế:
  - Chi nhánh HN999: Tạo đơn hàng rồi hủy ngay (Void)
    → Tiền cash vào túi, không có record sale
  - Chi nhánh HCM999: Bán giá cao hơn niêm yết
    → Thu thêm tiền mặt chênh lệch, không nhập vào POS
  - Chi nhánh DN999: Khai tồn kho cao hơn thực tế
    → Che giấu hàng thất thoát
```

**Giải pháp — Statistical Anomaly Detection:**
```
Kafka Streams + ClickHouse:

Bước 1: Tính baseline bình thường của từng chi nhánh
  revenue_mean(HN001) = average doanh thu 90 ngày qua
  revenue_std(HN001)  = độ lệch chuẩn 90 ngày qua
  void_rate(HN001)    = tỷ lệ đơn hủy trung bình

Bước 2: Z-score Detection (Phát hiện giá trị bất thường)
  z_score = (today_revenue - revenue_mean) / revenue_std
  
  |z_score| > 3 → Doanh thu hôm nay bất thường (99.7% confidence)
  
Bước 3: Pattern Detection
  void_rate_today > void_rate_mean × 3  → Tỷ lệ hủy đơn tăng gấp 3 lần

Kết quả Alert:
  "Chi nhánh HN999: Void rate 35% (bình thường 2%) trong 2 giờ qua"
  "Chi nhánh HCM999: Revenue thấp hơn 3σ so với cùng ngày năm trước"
  → Manager khu vực nhận Alert → Gọi điện kiểm tra ngay
```

---

## KIẾN TRÚC TỔNG THỂ — Financial Data Platform

```
30.000 CHI NHÁNH (DATA SOURCES)
  POS Systems × 30.000
  Payment Gateways (VNPay, Momo, Thẻ)
  Bank Statement Files (MT940)
  E-commerce Orders (Website, App)
         │
         │ CDC via Debezium + Webhooks + SFTP
         ▼
┌─────────────────────────────────────────┐
│         KAFKA — FINANCIAL EVENT BUS     │
│                                         │
│  Topics:                                │
│  ├── pos.revenue_events       (30K src) │
│  ├── payment.gateway_events   (VNPay..) │
│  ├── bank.statement_events    (MT940)   │
│  ├── ledger.adjusting_entries (AJE)     │
│  └── tax.declaration_events   (monthly) │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
┌────────────────┐   ┌────────────────────┐
│   KAFKA STREAMS │   │   BATCH PROCESSOR  │
│                 │   │   (Apache Spark)   │
│ • 3-Way Recon  │   │ • Month-end close  │
│ • Float Track  │   │ • Tax declaration  │
│ • Anomaly Det  │   │ • Audit report     │
│ • Revenue Rec  │   │ • Annual closing   │
└────────┬────────┘   └────────┬───────────┘
         │                     │
         ▼                     ▼
┌─────────────────────────────────────────┐
│          CLICKHOUSE CLUSTER             │
│                                         │
│  Tables:                                │
│  ├── ledger_events          (immutable) │
│  ├── reconciliation_status  (real-time) │
│  ├── float_tracking         (live)      │
│  ├── branch_performance     (analytics) │
│  └── tax_summary            (monthly)  │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
┌────────────────┐   ┌────────────────────┐
│  WORM STORAGE  │   │   APPLICATIONS     │
│  (S3 Glacier)  │   │                    │
│                │   │ • CFO Dashboard    │
│ 10-year retain │   │ • Auditor Portal   │
│ Cryptographic  │   │ • Tax Tool         │
│ Seal (HMAC)    │   │ • Branch Manager   │
│                │   │ • Alert System     │
└────────────────┘   └────────────────────┘
```

---

## MA TRẬN VẤN ĐỀ TÀI CHÍNH — CẤP TẬP ĐOÀN

| Vấn đề | Hậu quả nếu bỏ qua | Giải pháp | Độ phức tạp |
|:---|:---|:---|:---:|
| **Double-Entry Ledger** | Số liệu mất cân bằng không phát hiện | Kafka CDC → ClickHouse | ★★★ |
| **Revenue Attribution 30K nguồn** | CEO không biết chi nhánh nào lãi | Hierarchical Path Materialization | ★★★★ |
| **Late Financial Adjustment** | Sửa số cũ = vi phạm kế toán | Adjusting Journal Entry Events | ★★★★ |
| **Intercompany Elimination** | Doanh thu bị double-count nội bộ | Elimination Entry Stream | ★★★★★ |
| **Multi-rate Tax** | Nộp thuế sai → Phạt thuế | Tax Engine per Line Item | ★★★ |
| **Revenue Recognition (IFRS15)** | Báo cáo tài chính sai kỳ | Deferred Revenue State Machine | ★★★★ |
| **Audit Trail Immutability** | Vi phạm luật kế toán 10 năm | WORM S3 + HMAC Seal | ★★★ |
| **3-Way Reconciliation** | Không biết tiền đi đâu | Multi-source Kafka Join | ★★★★★ |
| **Cash Float Tracking** | Dự báo dòng tiền sai | Float State Machine | ★★★ |
| **Branch Anomaly Detection** | Gian lận tài chính không phát hiện | Z-score + Pattern Kafka Streams | ★★★★ |

> [!IMPORTANT]
> **Giá trị khóa luận:** Đây chính là "Finance as a Data Product" — xu hướng hàng đầu của các CFO tại các tập đoàn bán lẻ châu Á 2024-2025. Việc xây dựng được ngay cả 2-3 trong số 10 vấn đề trên dưới dạng prototype demo được sẽ là một điểm cực kỳ nổi bật.
>
> **Demo ấn tượng nhất:** Tiêm một giao dịch "bất thường" (void rate tăng đột biến) vào chi nhánh HN999, và show rằng ClickHouse + Kafka Streams phát hiện ra trong vòng < 5 giây và gửi Alert. Một điều mà không một phần mềm kế toán truyền thống nào làm được.
