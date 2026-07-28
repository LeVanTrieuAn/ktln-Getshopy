# Tổng quan hệ thống — iStore Analytics Platform

---

## 🏪 App là gì?

**iStore Analytics** là nền tảng quản lý & phân tích cho **Đại lý Ủy quyền Apple (Apple Authorized Reseller — AAR)** hoạt động theo mô hình **bán lẻ đa kênh (Omnichannel)**: vừa có cửa hàng vật lý (offline) vừa bán hàng online.

Hệ thống phục vụ **2 nhóm người dùng chính**:

| Nhóm | Giao diện | Mục đích |
| :--- | :--- | :--- |
| **B2C** (Khách hàng cuối) | E-Commerce Web App | Mua sắm, đặt hàng, quản lý tài khoản, tích điểm |
| **B2B** (Nội bộ doanh nghiệp) | Analytics Dashboard | Giám sát doanh thu, phát hiện gian lận, quản lý sản phẩm/chi nhánh |

---

## 🗄️ Data Platform sử dụng gì?

Hệ thống tách biệt hoàn toàn **lớp vận hành (OLTP)** và **lớp phân tích (OLAP)** theo kiến trúc HTAP:

```
[B2C Checkout / POS]
        │
        ▼
[LowDB / JSON]          ← Master data (sản phẩm, khách hàng, chi nhánh)
        │  (sync realtime)
        ▼
[ClickHouse — OLAP]     ← Lưu mọi giao dịch, phân tích hàng triệu dòng
        │
        ▼
[Redis — Cache]         ← Cache kết quả query (TTL 30–600s)
        │
        ▼
[WebSocket]             ← Đẩy KPI realtime về Dashboard (mỗi 5 giây)
```

### Chi tiết từng lớp

| Thành phần | Vai trò | Lý do chọn |
| :--- | :--- | :--- |
| **LowDB (JSON file)** | Master data: sản phẩm, khách hàng, chi nhánh, voucher | Nhẹ, không cần cài đặt, đủ dùng cho data ít thay đổi |
| **ClickHouse** | OLAP: lưu toàn bộ đơn hàng, phiếu thu/chi, cảnh báo | Column-oriented → query `SUM/GROUP BY` trên 10M dòng < 100ms |
| **Redis** | Cache API response | Giảm tải ClickHouse, TTL 30s cho KPI realtime |
| **WebSocket** | Push realtime | CEO thấy doanh thu cập nhật mỗi 5 giây không cần F5 |

---

## 🎯 Data Platform phục vụ cho mục đích gì?

### 1. 📊 Financial Analytics Dashboard
> **Đối tượng**: CEO, CFO, Store Manager

- Doanh thu theo giờ/ngày/tháng, so sánh hôm nay vs hôm qua
- KPI: Revenue, Orders, Avg Order Value, Net Cash, Void Rate
- Ranking chi nhánh theo doanh thu
- Phân bổ doanh thu theo danh mục sản phẩm (iPhone, Mac, iPad...)
- **RBAC**: Manager chỉ thấy dữ liệu chi nhánh mình

### 2. 🚨 Fraud Detection Engine
> **Đối tượng**: Risk Management, Quản lý khu vực

Phát hiện bất thường **ngay thời điểm xảy ra** (không đợi cuối tháng):
- Tỷ lệ hủy đơn cao bất thường tại 1 chi nhánh (> 15%)
- Doanh thu hôm nay thấp hơn 3σ so với trung bình 90 ngày
- Hóa đơn chưa đối soát quá 30 ngày

### 3. 🔄 Invoice Reconciliation (Đối soát)
> **Đối tượng**: Kế toán

So khớp tự động từng đơn hàng với phiếu thu:
- **MATCHED**: Đơn hàng đã có phiếu thu khớp số tiền (sai lệch < 1,000đ)
- **PENDING**: Đơn hàng chưa có phiếu thu
- **MISMATCH**: Số tiền không khớp

### 4. 🚚 Supply Chain / SLA Fulfillment
> **Đối tượng**: Operations Team

Giám sát tốc độ xử lý đơn hàng:
- **ON_TIME**: Xuất kho trong vòng 24h kể từ khi đặt hàng
- **BREACHED**: Trễ SLA
- Tỷ lệ giao hàng đúng hạn, thời gian fulfillment trung bình

---

## ⚡ Kiến trúc "Full Stack" thực tế của prototype

Đây là **prototype học thuật** (cho khóa luận tốt nghiệp), đơn giản hóa stack so với production:

| Production (Mô tả trong tài liệu) | Prototype (Code hiện tại) |
| :--- | :--- |
| PostgreSQL (OLTP) | LowDB (JSON file) |
| Debezium CDC → Kafka | Direct insert từ Node.js API |
| Kafka Streams (Fraud) | Rule-based query trên ClickHouse |
| Schema Registry (Avro) | JSONEachRow insert thẳng |
| Kubernetes + HA | Docker Compose (dev) |

> [!IMPORTANT]
> Mục tiêu khóa luận là **chứng minh tính khả thi của kiến trúc CDC Kafka + ClickHouse** cho bài toán bán lẻ, không phải triển khai production đầy đủ. Prototype đủ để demo và benchmark.

---

## 📐 Luồng dữ liệu (Data Flow tóm tắt)

```
Khách đặt hàng (B2C Web)
    → Server Node.js API
        → [LowDB] Lưu đơn hàng (B2C history)
        → [ClickHouse] Sync sale_orders + input_vouchers (analytics)
        → [Redis] Flush cache
        → [WebSocket] Broadcast KPI mới cho Dashboard

Admin xem Dashboard (B2B)
    → API call → Redis (hit cache? trả về ngay)
                → miss? → ClickHouse query → cache lại → trả về
    → WebSocket nhận KPI_UPDATE mỗi 5 giây
```

---

## 🏷️ Từ khóa học thuật của đề tài

`HTAP` · `OLAP` · `CDC (Change Data Capture)` · `Event-Driven Architecture` · `Column-oriented Database` · `Omnichannel Retail` · `Real-time Analytics` · `Fraud Detection` · `Financial Reconciliation` · `Circuit Breaker` · `ReplacingMergeTree`
