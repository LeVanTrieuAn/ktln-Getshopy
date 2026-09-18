#!/bin/sh
set -eu

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=getshopy}"
: "${POSTGRES_USER:=getshopy}"
: "${POSTGRES_PASSWORD:=getshopy_dev_password}"

# Build DATABASE_URL nếu chưa có
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"
  export DATABASE_URL
fi

if [ -z "${DIRECT_URL:-}" ]; then
  DIRECT_URL="$DATABASE_URL"
  export DIRECT_URL
fi

# Chờ PostgreSQL sẵn sàng (không push schema — server container đã làm)
echo "Waiting for PostgreSQL to be ready..."
attempt=0
until ./node_modules/.bin/prisma db pull --force 2>/dev/null || [ "$attempt" -ge 10 ]; do
  attempt=$((attempt + 1))
  echo "PostgreSQL not ready yet, retrying in 2 seconds ($attempt/10)..."
  sleep 2
done

echo "✅ AI Bot starting..."
exec "$@"
