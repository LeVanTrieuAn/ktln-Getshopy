# TÀI LIỆU 01: TỔNG QUAN VÀ KIẾN TRÚC HỆ THỐNG
**Hệ Sinh Thái Bán Lẻ Đa Kênh (Omnichannel Retail) Tích Hợp Big Data Pipeline**

---

## 1. TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW)

Hệ thống được thiết kế để phục vụ cho các Đại lý Ủy quyền của Apple (Apple Authorized Reseller - AAR) cấp doanh nghiệp, đòi hỏi khả năng vận hành ở quy mô lớn, tính sẵn sàng cao và khả năng phân tích dữ liệu thời gian thực.

Hệ sinh thái bao gồm 4 thành phần vận hành (Operational Layer):
1. **POS (Point of Sale) App**: Ứng dụng tại quầy dành cho nhân viên bán hàng (tối ưu cho màn hình cảm ứng).
2. **E-Commerce Web App**: Nền tảng mua sắm trực tuyến cho khách hàng (B2C).
3. **ERP / Backoffice System**: Hệ thống quản trị trung tâm dành cho Ban Giám đốc, Kế toán và Quản lý kho.
4. **CRM & Loyalty App**: Hệ thống quản lý quan hệ khách hàng và hạng thẻ.

---

## 2. KIẾN TRÚC TÍCH HỢP DỮ LIỆU LỚN (BIG DATA ARCHITECTURE)

Để giải quyết bài toán Data Silos và cung cấp cái nhìn toàn cảnh (Single Source of Truth), hệ thống áp dụng kiến trúc Event-Driven kết hợp với Data Pipeline thời gian thực.

### 2.1. Kiến Trúc "Eternal Ledger" (Sổ Cái Bất Biến)
- **Cơ chế CDC (Change Data Capture)**: Debezium đọc trực tiếp Transaction Log (WAL) từ cơ sở dữ liệu OLTP (PostgreSQL) mà không gây ảnh hưởng đến hiệu năng (Zero performance impact).
- **The Log is the Database**: Mọi thay đổi dữ liệu được đẩy vào Apache Kafka. Kafka được cấu hình `retention.ms = -1` (Lưu trữ vĩnh viễn), đóng vai trò là Immutable Distributed Log (Sổ cái phân tán bất biến).
- **Time-Travel & Analytics**: Dữ liệu từ Kafka được tiêu thụ (consume) và đưa vào ClickHouse (Column-oriented OLAP). Hỗ trợ truy vấn lịch sử tại bất kỳ thời điểm nào trong quá khứ.

### 2.2. Phân Tầng Lưu Trữ (Hot-Warm-Cold Data Tiering)
Nhằm tối ưu hóa chi phí cho hệ thống quy mô lớn lưu trữ dữ liệu 10 năm:
- **HOT Tier (Truy cập thường xuyên)**: Kafka (In-Memory + SSD) lưu 7 ngày gần nhất; ClickHouse (NVMe SSD) lưu 1 năm gần nhất với tốc độ truy vấn < 100ms.
- **WARM Tier (Truy cập thỉnh thoảng)**: ClickHouse (HDD Tiered Storage) lưu từ 1-5 năm.
- **COLD Tier (Hiếm khi truy cập)**: Dữ liệu được nén thành file Parquet, mã hóa AES-256 và đưa lên Object Storage (S3 Glacier) lưu trữ trên 5 năm với chi phí cực thấp.

### 2.3. Tách Biệt OLTP và OLAP (HTAP Architecture)
- Lớp **OLTP (PostgreSQL)** chỉ phục vụ các truy vấn vận hành (Operational), độ trễ < 10ms.
- Lớp **OLAP (ClickHouse)** chuyên xử lý các truy vấn phân tích khối lượng lớn (Analytical), đáp ứng độ trễ < 100ms.
- **Kết quả**: Giao dịch tại quầy không bao giờ bị nghẽn bởi các báo cáo tổng hợp của Giám đốc.

---

## 3. KIẾN TRÚC ĐỘ SẴN SÀNG CAO (HIGH AVAILABILITY - HA)

Triết lý cốt lõi: *"Everything fails all the time"* - Hệ thống được thiết kế để không có điểm chết duy nhất (Zero Single Point of Failure) và phục hồi trong vài giây.

### 3.1. Quorum & Consensus (Thuật toán Raft)
Hệ thống sử dụng số lượng Node lẻ (3, 5, 7) ở mọi layer để tránh hiện tượng Split Brain (Chẻ não):
- `Quorum = floor(N/2) + 1`
- Đảm bảo trong trường hợp đứt kết nối mạng (Network Partition), chỉ có một nhóm (phần lớn) tiếp tục hoạt động, duy trì tính nhất quán dữ liệu (Consistency).

### 3.2. HA Ở Các Tầng (Layers)
- **Tầng Database (PostgreSQL)**: 3 Nodes với Patroni + etcd. Khi Primary node chết, hệ thống tự động bầu Leader mới trong < 30s. Cấu hình Synchronous Replication đảm bảo **Zero Data Loss**.
- **Tầng Messaging (Kafka)**: 5 Brokers cấu hình KRaft. Replication Factor = 3, `acks=all`. Chịu được lỗi tối đa 2 Brokers cùng lúc mà không mất một Message nào.
- **Tầng Analytics (ClickHouse)**: Kiến trúc 2 Shards × 3 Replicas với ClickHouse Keeper. Truy vấn phân tán tự động chịu lỗi.
- **Tầng Application / API**: Các API Servers phía sau Load Balancer (Nginx/HAProxy) được thiết lập Health Probes (Startup, Liveness, Readiness) trên Kubernetes.

### 3.3. Các Pattern Bất Tử (Resilience Patterns)
- **Circuit Breaker**: Tự động ngắt kết nối đến các Service đang bị lỗi để tránh hiệu ứng Domino.
- **Bulkhead Pattern**: Chia nhỏ Thread Pool (Vách ngăn) để lỗi ở một Service không làm sập các Service khác.
- **Load Shedding**: Phân loại mức độ ưu tiên của Request. Khi quá tải, hệ thống chủ động từ chối các Request ưu tiên thấp (như tra cứu lịch sử) để đảm bảo các Request ưu tiên cao (thanh toán) vẫn hoạt động.
- **Graceful Degradation**: Tự động "xuống cấp nhẹ nhàng". Ví dụ: Khi ClickHouse đang bảo trì, hệ thống tự động switch Dashboard sang dùng PostgreSQL với hiệu năng chậm hơn nhưng không bị "sập" hoàn toàn.

---

## 4. TÓM TẮT DÒNG CHẢY DỮ LIỆU (DATA FLOW)

```text
[ỨNG DỤNG BÁN HÀNG (POS/ECOMMERCE)]
      │
      ▼ (Ghi dữ liệu)
[POSTGRESQL (OLTP)] ──▶ [DEBEZIUM CDC] ──▶ [APACHE KAFKA (BROKER)]
                                                   │
             ┌─────────────────────────────────────┤
             ▼                                     ▼
[CLICKHOUSE (OLAP ANALYTICS)]             [KAFKA STREAMS]
      │                                            │
      ▼ (Truy vấn)                                 ▼ (Real-time Rule Engine)
[DASHBOARD/BÁO CÁO TÀI CHÍNH]             [HỆ THỐNG CẢNH BÁO/TỰ ĐỘNG HÓA]
```
