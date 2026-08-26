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
# L-08: Ch\u1ec9 seed n\u1ebfu ch\u01b0a c\u00f3 d\u1eef li\u1ec7u (ki\u1ec3m tra b\u1ea3ng User) \u2014 tr\u00e1nh duplicate v\u00e0 t\u0103ng t\u1ed1c restart
USER_COUNT=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.user.count().then(n => { console.log(n); p.\$disconnect(); }).catch(() => { console.log(0); p.\$disconnect(); });
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ]; then
  echo "No existing data found — running seed..."
  node src/seed.js
else
  echo "Data already seeded ($USER_COUNT users found) — skipping seed."
fi

exec "$@"
