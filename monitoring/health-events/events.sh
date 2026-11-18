#!/bin/sh
# =============================================================================
# health-events — sự kiện vòng đời / health của các bản server và gateway (19/11/2026)
#
# In MỖI sự kiện thành MỘT dòng JSON trên stdout; Grafana Alloy đẩy về Loki (service
# "health-events"). Tài liệu: docs/monitoring.md, mục "Log tập trung".
#
#   {"ts":"<unix ns>","action":"die","service":"server","container":"kltn-server-2",
#    "replica":"<12 ký tự id = hostname = X-Served-By>","exit_code":"137","signal":""}
#
# Sự kiện: start, restart, die (kèm exit_code), kill (kèm signal), oom, stop, destroy,
# health_status (action = "health_status: healthy|unhealthy|starting"). Không lấy exec_* (mỗi lượt
# healthcheck sinh 3 sự kiện exec — chỉ là nhiễu).
#
# Bộ lọc của `docker events` (đã thử 19/11/2026, Docker 28.4.0):
#   - nhiều --filter label=... là AND (một container phải có ĐỦ các nhãn) -> không OR được
#     service=server với service=gateway bằng nhãn; lọc service trong --format bên dưới.
#   - nhiều --filter event=... là OR; có health_status thì Docker so khớp theo tiền tố
#     ("health_status" khớp "health_status: healthy").
#   - label=com.docker.compose.project=<tên> so khớp CHÍNH XÁC giá trị -> project khác (kể cả
#     tên bắt đầu bằng "kltn") không lọt vào.
#
# Cần /var/run/docker.sock. Gắn ":ro" KHÔNG làm API thành chỉ đọc (socket vẫn gửi được mọi lệnh)
# — script này chỉ chạy `docker events`.
# =============================================================================
set -eu
PROJECT="${COMPOSE_PROJECT:-kltn}"

# Template Go của docker CLI. Sự kiện của service khác -> chuỗi rỗng -> awk bỏ dòng trống.
FORMAT='{{if or (eq (index .Actor.Attributes "com.docker.compose.service") "server") (eq (index .Actor.Attributes "com.docker.compose.service") "gateway")}}{"ts":"{{.TimeNano}}","action":{{json .Action}},"service":{{json (index .Actor.Attributes "com.docker.compose.service")}},"container":{{json (index .Actor.Attributes "name")}},"replica":{{json (slice .Actor.ID 0 12)}},"exit_code":{{json (index .Actor.Attributes "exitCode")}},"signal":{{json (index .Actor.Attributes "signal")}}}{{end}}'

# Docker daemon khởi động lại -> luồng sự kiện đóng -> script thoát -> restart: unless-stopped
# dựng lại container. fflush(): ghi ngay từng dòng (stdout là pipe, không có thì awk gom bộ đệm).
docker events \
  --filter type=container \
  --filter "label=com.docker.compose.project=${PROJECT}" \
  --filter event=start --filter event=restart --filter event=die --filter event=kill \
  --filter event=oom --filter event=stop --filter event=destroy --filter event=health_status \
  --format "$FORMAT" \
  | awk 'NF { print; fflush() }'
