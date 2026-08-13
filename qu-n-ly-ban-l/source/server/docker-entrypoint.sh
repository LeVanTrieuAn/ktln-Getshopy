#!/bin/sh
set -eu

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=getshopy}"
: "${POSTGRES_USER:=getshopy}"
: "${POSTGRES_PASSWORD:=getshopy_dev_password}"

# Docker Compose normally supplies these URLs. Building them here keeps the
# stack usable with only `docker compose up --build` as well.
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"
  export DATABASE_URL
fi

if [ -z "${DIRECT_URL:-}" ]; then
  DIRECT_URL="$DATABASE_URL"
  export DIRECT_URL
fi

echo "Synchronising PostgreSQL schema..."
attempt=0
until ./node_modules/.bin/prisma db push --skip-generate; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 15 ]; then
    echo "Unable to synchronise the PostgreSQL schema after $attempt attempts."
    exit 1
  fi
  echo "Schema synchronisation failed; retrying in 2 seconds ($attempt/15)..."
  sleep 2
done

echo "Seeding baseline application data..."
node src/seed.js

exec "$@"
