#!/usr/bin/env bash
#
# Giả lập SePay bắn webhook cho đơn chuyển khoản mới nhất đang chờ thanh toán.
# Dùng khi chưa có tài khoản SePay thật, để test luồng end-to-end.
#
#   ./scripts/simulate-payment.sh              # đơn mới nhất
#   ./scripts/simulate-payment.sh ORD-123456   # đơn cụ thể
#   BASE=http://localhost:8080 ./scripts/simulate-payment.sh   # khi chạy native
#
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
ORDER_ID="${1:-}"

# Lấy bí mật từ server/.env — cùng nguồn server đang dùng.
# Server ƯU TIÊN HMAC khi có SEPAY_WEBHOOK_HMAC_SECRET, nên script phải ký
# giống hệt, nếu không webhook bị từ chối 401 mà nhìn như "SePay không bắn".
ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
  HMAC=$(grep -E '^SEPAY_WEBHOOK_HMAC_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
  KEY=$(grep -E '^SEPAY_WEBHOOK_API_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
fi
HMAC="${HMAC:-${SEPAY_WEBHOOK_HMAC_SECRET:-}}"
KEY="${KEY:-${SEPAY_WEBHOOK_API_KEY:-}}"
if [ -z "$HMAC" ] && [ -z "$KEY" ]; then
  echo "Thiếu SEPAY_WEBHOOK_HMAC_SECRET hoặc SEPAY_WEBHOOK_API_KEY" >&2
  exit 1
fi

QUERY="SELECT payment_ref || '|' || total FROM \"Order\"
        WHERE payment_status = 'PENDING' AND payment_ref IS NOT NULL"
[ -n "$ORDER_ID" ] && QUERY="$QUERY AND id = '$ORDER_ID'"
QUERY="$QUERY ORDER BY date DESC LIMIT 1;"

# Gọi container trực tiếp thay vì `docker compose exec`: compose phụ thuộc thư
# mục đang đứng, mà repo có nhiều file compose. Đặt PG_CONTAINER nếu tên khác.
PG_CONTAINER="${PG_CONTAINER:-kltn-postgres-1}"
if ! docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  echo "Không thấy container '$PG_CONTAINER'. Đặt PG_CONTAINER=<tên> rồi chạy lại." >&2
  docker ps --format '  {{.Names}}' | grep -i postgres >&2 || true
  exit 1
fi
ROW=$(docker exec -i "$PG_CONTAINER" psql -U getshopy -d getshopy -t -A -c "$QUERY" | tr -d '[:space:]')

if [ -z "$ROW" ]; then
  echo "Không có đơn nào đang chờ thanh toán${ORDER_ID:+ với id $ORDER_ID}."
  echo "Đặt một đơn với phương thức 'Chuyển khoản Ngân hàng / Quét mã QR' trước."
  exit 1
fi

REF="${ROW%%|*}"
TOTAL="${ROW##*|}"
TXN_ID=$(( RANDOM * 100000 + RANDOM ))
ACC=$(grep -E '^VIETQR_ACCOUNT_NO=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || echo "0123456789")

echo "Đơn : ref=$REF  số tiền=$TOTAL"
echo "Bắn : POST $BASE/api/payment/webhook/sepay"

# Nội dung chuyển khoản phải giống hệt thứ ngân hàng sẽ trả về, kể cả tiền tố
# bắt buộc của từng ngân hàng (VietinBank: SEVQR).
PREFIX=$(grep -E '^PAYMENT_CONTENT_PREFIX=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
CONTENT="CT tu 0987654321 ND ${PREFIX:+$PREFIX }$REF"

BODY="{\"gateway\":\"VietinBank\",\"transactionDate\":\"$(date '+%Y-%m-%d %H:%M:%S')\",\"accountNumber\":\"$ACC\",\"subAccount\":null,\"code\":null,\"content\":\"$CONTENT\",\"transferType\":\"in\",\"description\":\"\",\"transferAmount\":$TOTAL,\"referenceCode\":\"FT$TXN_ID\",\"accumulated\":0,\"id\":$TXN_ID}"

if [ -n "$HMAC" ]; then
  # SePay ký "{timestamp}.{raw_body}", chữ ký hex trong header X-SePay-Signature
  TS=$(date +%s)
  SIG=$(printf '%s' "$TS.$BODY" | openssl dgst -sha256 -hmac "$HMAC" -hex | sed 's/^.*= *//')
  echo "Ký : HMAC-SHA256"
  curl -sS -X POST "$BASE/api/payment/webhook/sepay" \
    -H "Content-Type: application/json" \
    -H "X-SePay-Timestamp: $TS" \
    -H "X-SePay-Signature: sha256=$SIG" \
    -d "$BODY"
else
  echo "Ký : API Key"
  curl -sS -X POST "$BASE/api/payment/webhook/sepay" \
    -H "Content-Type: application/json" \
    -H "Authorization: Apikey $KEY" \
    -d "$BODY"
fi

echo
echo "Popup trên trình duyệt sẽ tự chuyển sang 'Đã nhận được thanh toán' trong ~3 giây."
