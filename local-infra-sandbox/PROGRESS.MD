# Project Progress

## Legend
- `🟢 Done`
- `🟡 In Progress`
- `🔴 Not Started`

---

## Stage 1: Local Sandbox
| # | Item | Status |
|---|------|--------|
| 1.1 | `docker-compose.yml` khởi chạy toàn bộ stack ổn định | 🟡 In Progress |
| 1.2 | PostgreSQL + `init.sql` seed dữ liệu | 🟢 Done |
| 1.3 | Kafka + Zookeeper chạy, tạo topic | 🟢 Done |
| 1.4 | Kafka Connect Debezium source connector chạy | 🟢 Done |
| 1.5 | Kafka Connect MinIO sink connector chạy | 🟢 Done |
| 1.6 | MinIO nhận parquet files từ Kafka | 🟢 Done |
| 1.7 | ClickHouse Staging (s3() views đọc trực tiếp MinIO) | 🔴 Not Started |
| 1.8 | dbt-core chạy transformation → warehouse (MergeTree) | 🔴 Not Started |
| 1.9 | ClickHouse query + Metabase dashboard | 🔴 Not Started |
| 1.10 | `.env` + auto-generate connector configs | 🟡 In Progress |

---

## Stage 2: Single Node (1 VM)
| # | Item | Status |
|---|------|--------|
| 2.1 | Provision VM: OS, hardening, user, firewall | 🔴 Not Started |
| 2.2 | Cài Docker + cri-dockerd + networking | 🔴 Not Started |
| 2.3 | Clone repo + `.env` + secrets | 🔴 Not Started |
| 2.4 | Deploy stack lên VM bằng Compose | 🔴 Not Started |
| 2.5 | Backup/restore DB, volume, config | 🔴 Not Started |
| 2.6 | Logging + monitoring cơ bản | 🔴 Not Started |
| 2.7 | E2E run + smoke test | 🔴 Not Started |
| 2.8 | Rollback + runbook | 🔴 Not Started |

---

## Stage 3: Multi Node (Production)
| # | Item | Status |
|---|------|--------|
| 3.1 | Thiết kế cluster layout | 🔴 Not Started |
| 3.2 | Provision multi-VM / bare-metal | 🔴 Not Started |
| 3.3 | Cài đặt + bootstrap K8s cluster | 🔴 Not Started |
| 3.4 | Cài CNI + Ingress + StorageClass + CSI | 🔴 Not Started |
| 3.5 | Triển khai MinIO + Kafka + PostgreSQL/Patroni + ClickHouse | 🔴 Not Started |
| 3.6 | Triển khai Airbyte / Kafka Connect + connectors | 🔴 Not Started |
| 3.7 | Triển khai dbt-core + Keycloak + Metabase | 🔴 Not Started |
| 3.8 | CI/CD + IaC (Terraform/Ansible) | 🔴 Not Started |
| 3.9 | Observability, backup, DR drill | 🔴 Not Started |
