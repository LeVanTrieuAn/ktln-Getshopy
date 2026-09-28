#!/bin/sh
# Gộp phần thừa của mọi bảng ReplacingMergeTree.
#
# VÌ SAO TỰ TÌM CHỨ KHÔNG LIỆT KÊ CỨNG TÊN BẢNG:
# Mỗi lần thêm một model dbt dạng ReplacingMergeTree mà quên sửa job này thì
# bảng đó tích phần thừa vô hạn. Triệu chứng là mọi truy vấn FINAL chậm dần
# đều — không ai nghĩ tới việc thiếu một dòng trong file cấu hình scheduler.
#
# VÌ SAO CÓ ĐIỀU KIỆN so_part > 1:
# OPTIMIZE ... FINAL đọc và GHI LẠI toàn bộ bảng. Bảng đã gộp xong rồi mà vẫn
# chạy là tốn I/O không đổi lấy gì. ClickHouse tự gộp trong nền, nên phần lớn
# lượt chạy sẽ không có bảng nào cần làm.
set -eu

CH="clickhouse-client"

echo "── gộp ReplacingMergeTree $(date '+%Y-%m-%d %H:%M:%S') ──"

TABLES=$($CH --query "
  SELECT t.database || '.' || t.name
  FROM system.tables t
  INNER JOIN (
      SELECT database, table, count() AS n
      FROM system.parts WHERE active GROUP BY database, table
  ) p ON p.database = t.database AND p.table = t.name
  WHERE t.engine LIKE 'Replacing%'
    AND t.database NOT IN ('system')
    AND p.n > 1
")

if [ -z "$TABLES" ]; then
  echo "  không bảng nào cần gộp"
  exit 0
fi

for t in $TABLES; do
  before=$($CH --query "SELECT count() FROM system.parts WHERE active AND database||'.'||table = '$t'")
  # Lỗi ở một bảng không được làm hỏng các bảng còn lại.
  if $CH --query "OPTIMIZE TABLE $t FINAL" 2>/dev/null; then
    after=$($CH --query "SELECT count() FROM system.parts WHERE active AND database||'.'||table = '$t'")
    printf '  %-40s %s -> %s part\n' "$t" "$before" "$after"
  else
    printf '  %-40s BỎ QUA (không gộp được)\n' "$t"
  fi
done
