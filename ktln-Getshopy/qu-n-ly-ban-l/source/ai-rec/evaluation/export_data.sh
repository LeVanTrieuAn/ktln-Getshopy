#!/usr/bin/env bash
# Xuất dữ liệu cho evaluation/benchmark.py từ ClickHouse.
#
# Chạy trên máy đang chạy stack (cần quyền đọc warehouse — tài khoản ai_rec của
# service KHÔNG đọc được, cố ý). Không có tham số thì ghi vào evaluation/data/
# (đã gitignore: dữ liệu mua hàng theo khách không đưa lên git).
#
#   bash evaluation/export_data.sh [thư_mục_ra]
#
# order_lines.csv lọc ĐÚNG như serving.pairs_customer_product — tức cùng định
# nghĩa "một lần mua" với dữ liệu production đang train: đọc FINAL, bỏ bản ghi
# xoá, bỏ đơn huỷ, chỉ đơn đã thanh toán, sản phẩm còn bán. Sai lệch ở đây là
# benchmark đo một bài toán khác bài toán production.
set -euo pipefail

OUT="${1:-$(cd "$(dirname "$0")" && pwd)/data}"
CH_CONTAINER="${CH_CONTAINER:-kltn-clickhouse-1}"
mkdir -p "$OUT"

q() { docker exec -i "$CH_CONTAINER" clickhouse-client -q "$1"; }

q "
SELECT
    toString(f.customer_id)                                   AS CustomerID,
    toString(f.product_id)                                    AS ProductID,
    f.quantity                                                AS Quantity,
    f.order_id                                                AS OrderID,
    formatDateTime(f.order_date, '%Y-%m-%d %H:%i:%S', 'UTC')  AS OrderDate
FROM warehouse.fact_orders_detail AS f FINAL
INNER JOIN masterdata.dim_products AS p
        ON p.product_id = toString(f.product_id) AND p.is_deleted = 0
WHERE f._is_deleted = 0
  AND f.customer_id != 0
  AND f.product_id  != 0
  AND f.order_status  != 'CANCELLED'
  AND f.payment_status = 'PAID'
ORDER BY f.order_date, f.order_id, f.item_id
FORMAT CSVWithNames" > "$OUT/order_lines.csv"

q "SELECT ProductID, ParentCategory, Brand, PriceBand, CatalogSold
   FROM serving.catalog_features ORDER BY ProductID
   FORMAT CSVWithNames" > "$OUT/catalog_features.csv"

q "SELECT CustomerID, Dimension, Value, Polarity
   FROM serving.customer_preference_signals ORDER BY CustomerID, Dimension, Value
   FORMAT CSVWithNames" > "$OUT/preference_signals.csv"

for f in order_lines catalog_features preference_signals; do
  printf '  %-22s %8s dòng\n' "$f.csv" "$(($(wc -l < "$OUT/$f.csv") - 1))"
done
