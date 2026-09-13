# Infrastructure Topology & Component Allocation

## 1. Loại Bỏ HAProxy & Giải Pháp Mạng (Ingress Logic)
Hệ thống **KHÔNG** sử dụng HAProxy ngoài. Toàn bộ hạ tầng mạng, cân bằng tải và định tuyến cho tầng ứng dụng được tích hợp trực tiếp vào cụm **Kubernetes (K8s)** bằng giải pháp:
* **Kube-VIP / MetalLB (Layer 2):** Cấp và duy trì một Virtual IP (VIP) động đại diện cho toàn cụm K8s.
* **K8s Ingress Controller (Nginx Ingress):** Chạy dưới dạng DaemonSet trên các node được chỉ định để hứng traffic từ VIP và định tuyến thông minh đến các dịch vụ (Keycloak, Metabase, Airbyte UI) dựa trên Domain/Host.

## 2. Ma Trận Phân Bổ Vật Lý Trên 5 Server (Physical View)

Hệ thống được cô lập tài nguyên vật lý nghiêm ngặt nhằm tránh thắt nút cổ chai I/O đĩa và RAM.

| SERVER | Vai Trò K8s | Thành Phần Dữ Liệu Nghiệp Vụ (Data Pipeline) | Thành Phần Metadata & Đồng Thuận |
| :--- | :--- | :--- | :--- |
| **SERVER 1** | **K8s Master 1** *(Chạy động Keycloak/Metabase)* | Airbyte 1 (Master Controller), dbt-core 1, Kafka Broker 1, MinIO Node 1 | Consul Node 1 |
| **SERVER 2** | **K8s Master 2** *(Chạy động Keycloak/Metabase)* | dbt-core 2, Kafka Broker 2, MinIO Node 2, **ClickHouse Replica 1**, ClickHouse Keeper 1 | Consul Node 2 |
| **SERVER 3** | **K8s Worker 1** | Airbyte 2 (Worker 1), dbt-core 3, Kafka Broker 3, MinIO Node 3, **ClickHouse Replica 2**, ClickHouse Keeper 2 | Consul Node 3, PostgreSQL Node 3 (Standby 2) |
| **SERVER 4** | **K8s Worker 2** *(Chạy động Keycloak/Metabase)* | dbt-core 4, Kafka Broker 4, MinIO Node 4, **ClickHouse Replica 3**, ClickHouse Keeper 3 | Consul Node 4, PostgreSQL Node 2 (Standby 1) |
| **SERVER 5** | **K8s Worker 3** | Airbyte 3 (Worker 2), dbt-core 5, Kafka Broker 5, MinIO Node 5 | Consul Node 5, **PostgreSQL Node 1 (Primary Master)** |

## 3. Sơ Đồ Topo Thiết Bị Vật Lý (Physical Hardware Mesh)

```text
 ┌────────────────────────────────────────────────────────┐   ┌────────────────────────────────────────────────────────┐
 │ SERVER 1 (Control Plane)                               │   │ SERVER 2 (Control Plane)                               │
 ├────────────────────────────────────────────────────────┤   ├────────────────────────────────────────────────────────┤
 │  - K8s Master 1 (Ingress, Keycloak/Metabase Pods)      │   │  - K8s Master 2 (Ingress, Keycloak/Metabase Pods)      │
 │  - Airbyte 1 (Controller), dbt-core 1, Kafka 1, MinIO 1│   │  - dbt-core 2, Kafka 2, MinIO 2, ClickHouse 1, Keeper 1│
 │  - Consul Node 1                                       │   │  - Consul Node 2                                       │
 └────────────────────────────────────────────────────────┘   └────────────────────────────────────────────────────────┘
                                            ▲               ▲
                                            │               │ (Mạng Nội Bộ 10Gbps NVMe Mesh)
                                            ▼               ▼
 ┌────────────────────────────────────────────────────────┐   ┌────────────────────────────────────────────────────────┐   ┌────────────────────────────────────────────────────────┐
 │ SERVER 3 (Worker Node)                                 │   │ SERVER 4 (Worker Node)                                 │   │ SERVER 5 (Worker Node)                                 │
 ├────────────────────────────────────────────────────────┤   ├────────────────────────────────────────────────────────┤   ├────────────────────────────────────────────────────────┤
 │  - K8s Worker 1                                        │   │  - K8s Worker 2 (Ingress, Keycloak/Metabase Pods)      │   │  - K8s Worker 3                                        │
 │  - Airbyte 2 (Worker 1), dbt-core 3, Kafka 3, MinIO 3  │   │  - dbt-core 4, Kafka 4, MinIO 4, ClickHouse 3, Keeper 3│   │  - Airbyte 3 (Worker 2), dbt-core 5, Kafka 5, MinIO 5  │
 │  - ClickHouse 2, Keeper 2                              │   │  - Postgres Node 2 (Standby 1)                         │   │  - Postgres Node 1 (Patroni Primary Master)            │
 │  - Postgres Node 3 (Standby 2), Consul Node 3          │   │  - Consul Node 4                                       │   │  - Consul Node 5                                       │
 └────────────────────────────────────────────────────────┘   └────────────────────────────────────────────────────────┘   └────────────────────────────────────────────────────────┘