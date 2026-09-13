# Project Progress

> Cập nhật 29/07/2026 theo thực tế: luồng đã thông tới **Stage 2 (single-node VM)**, sau đó nhảy thẳng
> lên cấu hình cụm production tại doanh nghiệp. Các mục dưới đây được đánh lại cho khớp; những mục còn
> `❓` cần tự xác nhận lại khi rà môi trường ở Tuần 1 của [KE-HOACH-THUC-HIEN.md](KE-HOACH-THUC-HIEN.md).

## Legend
- `🟢 Done`
- `🟡 In Progress`
- `🔴 Not Started`
- `⚪ Out of scope` (nằm ngoài phạm vi nghiệm thu khoá luận)
- `❓` cần xác nhận lại

---

## Stage 1: Local Sandbox
| # | Item | Status |
|---|------|--------|
| 1.1 | `docker-compose.yml` khởi chạy toàn bộ stack ổn định | 🟢 Done |
| 1.2 | PostgreSQL + `init.sql` seed dữ liệu | 🟢 Done |
| 1.3 | Kafka + Zookeeper chạy, tạo topic | 🟢 Done |
| 1.4 | Kafka Connect Debezium source connector chạy | 🟢 Done |
| 1.5 | Kafka Connect MinIO sink connector chạy | 🟢 Done |
| 1.6 | MinIO nhận parquet files từ Kafka | 🟢 Done |
| 1.7 | Đọc MinIO → ClickHouse staging (dùng ClickHouse `s3()` table function thay cho Python bridge) | 🟢 Done |
| 1.8 | dbt-core chạy staging → transformation → warehouse → serving | 🟢 Done |
| 1.9 | Lớp `audit`: checksum xuyên tầng src → storage → warehouse | 🟢 Done |
| 1.10 | ClickHouse query + Metabase dashboard | 🟡 In Progress ❓ |
| 1.11 | `.env` + auto-generate connector configs (còn secret hardcode trong `config/vars.yml`) | 🟡 In Progress |
| 1.12 | Prometheus + Grafana monitoring | 🟡 In Progress ❓ |

---

## Stage 2: Single Node (1 VM)
| # | Item | Status |
|---|------|--------|
| 2.1 | Provision VM: OS, hardening, user, firewall | 🟢 Done |
| 2.2 | Cài Docker + networking | 🟢 Done |
| 2.3 | Clone repo + `.env` + secrets | 🟢 Done |
| 2.4 | Deploy stack lên VM bằng Compose | 🟢 Done |
| 2.5 | Backup/restore DB, volume, config | 🟡 In Progress ❓ |
| 2.6 | Logging + monitoring cơ bản | 🟡 In Progress ❓ |
| 2.7 | E2E run + smoke test | 🟢 Done |
| 2.8 | Rollback + runbook | 🔴 Not Started |

---

## Stage 3: Multi Node — cụm production doanh nghiệp
| # | Item | Status |
|---|------|--------|
| 3.1 | Thiết kế cluster layout | 🟢 Done |
| 3.2 | Provision multi-VM / bare-metal | ⚪ Out of scope (đã go-live tại doanh nghiệp) |
| 3.3 | Cài đặt + bootstrap K8s cluster | ⚪ Out of scope |
| 3.4 | CNI + Ingress + StorageClass + CSI | ⚪ Out of scope |
| 3.5 | MinIO + Kafka + PostgreSQL/Patroni + ClickHouse | ⚪ Out of scope |
| 3.6 | Airbyte / Kafka Connect + connectors | ⚪ Out of scope |
| 3.7 | dbt-core + Keycloak + Metabase | ⚪ Out of scope |
| 3.8 | CI/CD + IaC | ⚪ Out of scope |
| 3.9 | Observability, backup, DR drill | ⚪ Out of scope |

Phần lớn công việc ở cụm production là cấu hình trực tiếp trên hệ thống doanh nghiệp → **không dùng làm
kết quả nghiệm thu của khoá luận**, chỉ làm cơ sở đối chiếu thiết kế (xem
[docs/05-CAN-CHOT-VOI-GVHD.md](docs/05-CAN-CHOT-VOI-GVHD.md) mục 1.1).

---

## Stage 4: Phạm vi còn lại của khoá luận
Chi tiết theo tuần: [KE-HOACH-THUC-HIEN.md](KE-HOACH-THUC-HIEN.md)

| # | Item | Mốc | Status |
|---|------|-----|--------|
| 4.1 | Chốt đề cương với GVHD + rà lại môi trường sandbox | M0 – 09/08 | 🟡 In Progress |
| 4.2 | Mở rộng 4 data domain (bán hàng, sản phẩm/tồn kho, khách hàng, campaign/voucher) + luồng batch | M1 – 30/08 | 🔴 Not Started |
| 4.3 | Mở rộng lớp `audit` sang toàn bộ domain + đặc tả SLA + thủ tục replay | M1 – 30/08 | 🔴 Not Started |
| 4.4 | Monitoring + alerting + scheduling pipeline | M1 – 30/08 | 🔴 Not Started |
| 4.5 | GetShopy: chuyển `db.json` → PostgreSQL OLTP, bật CDC, thu event hành vi | M2 – 20/09 | 🔴 Not Started |
| 4.6 | Tầng `serving` + dashboard quản trị đọc từ ClickHouse | M2 – 20/09 | 🔴 Not Started |
| 4.7 | Bộ sinh dữ liệu có chủ đích (12–24 tháng lịch sử) | M2 – 20/09 | 🔴 Not Started |
| 4.8 | AI-1 Recommendation | M3 – 11/10 | 🔴 Not Started |
| 4.9 | AI-2 Forecasting | M3 – 11/10 | 🔴 Not Started |
| 4.10 | AI-3 Campaign/Voucher optimization | M3 – 11/10 | 🔴 Not Started |
| 4.11 | AI-4 Trợ lý dữ liệu LLM → SQL (tuỳ chọn) | M3 – 11/10 | 🔴 Not Started |
| 4.12 | Thực nghiệm TN1–TN6 | M4 – 25/10 | 🔴 Not Started |
| 4.13 | Tái lập cụm trên VM beta + IaC + HA + DR drill + runbook | M5 – 08/11 | 🔴 Not Started |
| 4.14 | Viết quyển, slide, video demo | M6 – 20/12 | 🔴 Not Started |

---

## Ghi chú kỹ thuật
```bash
# Kiểm tra lag của consumer group sink MinIO
docker exec -it sandbox_kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 --describe --group connect-minio-sink-connector
```
