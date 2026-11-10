# Số liệu thô — benchmark tải 3 triệu đơn (23/10/2026)

Đi kèm [`../benchmark-tai-3tr-don-Oct23.md`](../benchmark-tai-3tr-don-Oct23.md). Không file nào chứa khoá hay mật khẩu: script đọc khoá MinIO từ `.env` lúc chạy và che khoá trong output.

**Múi giờ khác nhau giữa các file:** `stats.csv`, `vm*.csv` ghi theo **giờ máy (UTC+7)**; các file `.tsv` theo **UTC**.

| File | Nội dung | Cột |
|---|---|---|
| `stats.csv` | `docker stats` mỗi 30 s (RSS, không tính swap) | giờ máy, container, RAM `dùng / trần`, CPU |
| `vm.csv` | máy ảo + tiến độ, từ 22:20:56 giờ máy | giờ máy, RAM dùng (MiB), RAM khả dụng (MiB), swap dùng (MiB), D: trống (GB), số container dbt đang chạy, bộ nhớ ClickHouse, số đơn / dòng hàng Postgres, số file / byte của lake, số dòng `fact` — ba nhóm cuối chỉ có ở mẫu chẵn (mỗi 60 s) |
| `vm-0-10phut-thieu-cot-ram.csv` | 10 phút đầu (22:10–22:20 giờ máy). **Ba cột RAM máy ảo bị trống** do lỗi lệnh `wsl.exe` đã sửa sau đó, nên mọi cột còn lại lệch trái hai vị trí so với tiêu đề | như `vm.csv` |
| `memory-per-minute.tsv` | từ `system.asynchronous_metric_log`, mẫu 1 s gộp theo phút | phút UTC, RAM khả dụng thấp nhất của máy ảo (MiB), RSS cao nhất của ClickHouse (MiB) |
| `throughput.tsv` | đếm trên parquet, theo phút | phút UTC, bản ghi commit ở Postgres, bản ghi Debezium xử lý, bản ghi ghi xuống MinIO |
| `dbt-runs.tsv` | `system.query_log`, gộp theo lượt dbt và model | lượt (UTC), model, thời gian lâu nhất (s), RAM đỉnh (MiB), tổng số dòng đọc |
| `seed-data.log` | log của `seed-data`, gồm manifest JSON | |
| `ai-rec-train.log` | trích `docker logs kltn-ai-rec-1` (UTC), chỉ dòng train và tính sẵn: mỗi bản train tính sẵn được bao nhiêu khách trong trần 60 s | |
| `clickhouse-sap-16h32.log` | trích log ClickHouse và ofelia (UTC, khoá đã che): ClickHouse chết đột ngột lúc 16:32:39–44 khi đang chạy `checksum_orders`, ngoài cửa sổ quan sát (kết thúc 16:02) | |

Script đo (Git Bash; ghi kết quả vào `$OUT`, mặc định `./benchmark-out`):

| Script | Việc |
|---|---|
| `metrics.sh` | ghi `stats.csv` và `vm.csv` mỗi 30 s, chạy tới khi dừng tay |
| `events.sh` | in một dòng cho mỗi sự kiện: container OOM / chết với mã ≠ 0, lượt dbt bắt đầu / kết thúc, ai-rec train xong / lỗi, ClickHouse vượt trần RAM, OOM killer của kernel, RAM khả dụng < 500 MiB, swap > 3 GB, D: < 8 GB |
| `latency.sh` | sau khi nạp xong: số file và bản ghi của lake, độ trễ từng chặng, thông lượng theo phút |
| `summarize.js` | đỉnh RAM từng container, đỉnh tổng, RAM khả dụng thấp nhất, swap cao nhất |

`metrics.sh` và `events.sh` gọi `wsl.exe -d docker-desktop -e …` nên chỉ chạy được trên Docker Desktop của Windows. Tên container theo project compose `kltn` (`kltn-postgres-1`…).
