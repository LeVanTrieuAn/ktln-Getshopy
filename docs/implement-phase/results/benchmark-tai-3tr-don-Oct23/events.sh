#!/usr/bin/env bash
# Mỗi dòng stdout là một sự kiện cần xử lý. Im lặng = chưa có gì đáng báo.
SP="$(cd "$(dirname "$0")" && pwd)"

# 1) Container bị OOM, hoặc chết với mã khác 0 (137 = bị SIGKILL, thường là OOM killer)
docker events --filter type=container --filter event=oom --filter event=die \
  --format '{{.Action}} {{.Actor.Attributes.name}} image={{.Actor.Attributes.image}} exit={{.Actor.Attributes.exitCode}}' \
  | grep --line-buffered -vE 'exit=0$' | sed -u 's/^/[docker] /' &

# 2) Lượt dbt bắt đầu / kết thúc (phát hiện chồng lượt: hai Started liền nhau không có Finished)
docker logs -f --tail 0 kltn-dbt-scheduler-1 2>&1 \
  | grep --line-buffered -E 'dbt-build.*(Started|Finished)|▶ (ERROR|WARNING)' \
  | sed -u -E 's/\x1b\[[0-9;]*m//g; s/^/[ofelia] /' | sed -u -E "s/^(.{400}).*/\1/" &

# 3) ai-rec gặp lỗi (train hỏng, hết RAM, quá thời gian chờ ClickHouse)
docker logs -f --tail 0 kltn-ai-rec-1 2>&1 \
  | grep --line-buffered -E 'Bản train #|thất bại|Warehouse không sẵn sàng|Traceback|MemoryError|Killed|[Tt]imeout' \
  | sed -u 's/^/[ai-rec] /' | sed -u -E "s/^(.{300}).*/\1/" &

# 4) Thăm dò mỗi 20 s: ClickHouse vượt trần RAM, OOM killer của kernel, RAM máy ảo, ổ D:
ch() { curl -s --max-time 10 http://localhost:8123/ --data-binary "$1" 2>/dev/null; }
last_ch=""; last_oom=0; vm_state=ok; swap_state=ok; d_state=ok
while true; do
  cur=$(ch "SELECT name, value, toString(last_error_time), substring(replaceRegexpAll(last_error_message, '\\s+', ' '), 1, 300) FROM system.errors WHERE code IN (241, 173) ORDER BY code FORMAT TSV")
  if [ -n "$cur" ] && [ "$cur" != "$last_ch" ]; then echo "[clickhouse] $cur" | tr '\t' ' '; last_ch="$cur"; fi

  # wsl.exe -e: chạy thẳng lệnh, không qua shell ngoài — shell ngoài thay $3/$7 bằng rỗng.
  # Mọi phần lọc làm ở phía Git Bash.
  kmsg=$(wsl.exe -d docker-desktop -e dmesg 2>/dev/null | tr -d '\000\r')
  oom=$(printf '%s\n' "$kmsg" | grep -ciE 'out of memory|oom-kill')
  if [ -n "$oom" ] && [ "$oom" -gt "$last_oom" ] 2>/dev/null; then
    echo "[kernel] OOM killer: $(printf '%s\n' "$kmsg" | grep -iE 'Killed process|out of memory' | tail -2 | tr '\n' ' ' | cut -c1-400)"
    last_oom=$oom
  fi

  read -r avail swap <<<"$(wsl.exe -d docker-desktop -e free -m 2>/dev/null | tr -d '\000\r' | awk 'NR==2{a=$7} NR==3{s=$3} END{print a, s}')"
  if [ -n "$avail" ]; then
    if [ "$avail" -lt 500 ] && [ $vm_state = ok ]; then echo "[vm] RAM khả dụng còn ${avail} MB, swap đang dùng ${swap} MB"; vm_state=low
    elif [ "$avail" -ge 1000 ] && [ $vm_state = low ]; then echo "[vm] RAM hồi lại ${avail} MB"; vm_state=ok; fi
    if [ "$swap" -gt 3000 ] && [ $swap_state = ok ]; then echo "[vm] swap đã dùng ${swap} MB / 4096"; swap_state=high; fi
  fi

  dfree=$(df -BG /d | awk 'NR==2{gsub("G","",$4); print $4}')
  if [ "$dfree" -lt 5 ] && [ $d_state != stop ]; then echo "[disk] D: còn ${dfree} GB — DỪNG"; d_state=stop
  elif [ "$dfree" -lt 8 ] && [ $d_state = ok ]; then echo "[disk] D: còn ${dfree} GB"; d_state=warn; fi
  sleep 20
done
