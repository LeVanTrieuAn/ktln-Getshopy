'use strict';
/**
 * Chạy MỘT lệnh trong khi giữ advisory lock của Postgres — 18/11/2026, cân bằng tải.
 *
 *   node scripts/with-startup-lock.js <lệnh> [tham số...]
 *
 * Vì sao: compose chạy N bản server (deploy.replicas) và cả N khởi động cùng lúc. Phần chuẩn bị
 * DB trong docker-entrypoint.sh (migrate, ràng buộc tồn kho DROP/CREATE TRIGGER, seed nền khi
 * DB trống, ensure-inventory, seed-demo) không được chạy song song: hai bản cùng thấy "DB trống"
 * là seed hai lần; DROP/CREATE TRIGGER cùng lúc thì lỗi và `set -e` làm container thoát.
 * `prisma migrate deploy` tự có advisory lock nhưng chỉ cho phần migrate, và chỉ chờ 10 s
 * (https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production#advisory-locking).
 * Script này cho cả phần chuẩn bị chạy LẦN LƯỢT từng bản; bản sau thấy DB đã sẵn thì đi đường
 * "đã có dữ liệu" (các bước idempotent).
 *
 * Cách giữ khoá: pg_try_advisory_lock cấp PHIÊN, trên một PrismaClient chỉ có MỘT kết nối
 * (connection_limit=1) — lấy và nhả khoá chắc chắn cùng một phiên. Tiến trình này chết (OOM,
 * SIGKILL) thì kết nối đóng và Postgres tự nhả khoá — không kẹt cụm.
 * https://www.postgresql.org/docs/16/explicit-locking.html#ADVISORY-LOCKS
 *
 * Biến môi trường:
 *   STARTUP_LOCK=0               bỏ khoá, chạy lệnh ngay (chắc chắn chỉ có một bản)
 *   STARTUP_LOCK_MAX_WAIT_S=900  chờ khoá tối đa (giây) rồi thoát 1 — container khởi động lại
 */
const { spawn } = require('child_process');

// Khác 728311 (job đóng đơn quá hạn) và 72707369 (Prisma Migrate).
const LOCK_KEY = 728312;
const POLL_MS = 1000;
const LOG_EVERY_MS = 10_000;
const KEEPALIVE_MS = 30_000;
const CONNECT_TRIES = 30;
const CONNECT_RETRY_MS = 2000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`[startup-lock] ${msg}`);

/** Ép đúng một kết nối: khoá cấp phiên chỉ nhả được trên chính phiên đã lấy nó. */
function singleConnectionUrl(url) {
  if (!url) return url;
  const stripped = url.replace(/([?&])connection_limit=[^&]*(&|$)/, (_, lead, tail) => (tail ? lead : ''));
  return stripped + (stripped.includes('?') ? '&' : '?') + 'connection_limit=1';
}

function runChild(cmd, args, onSpawn) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    onSpawn(child);
    child.on('error', (err) => { console.error(`[startup-lock] không chạy được ${cmd}:`, err.message); resolve(127); });
    child.on('exit', (code, signal) => {
      if (signal) {
        const n = require('os').constants.signals[signal] || 15;
        resolve(128 + n);
      } else resolve(code ?? 1);
    });
  });
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) {
    console.error('Cách dùng: node scripts/with-startup-lock.js <lệnh> [tham số...]');
    process.exit(2);
  }

  let child = null;
  const forward = (sig) => { if (child && child.exitCode === null) child.kill(sig); };
  process.on('SIGTERM', () => { if (child) forward('SIGTERM'); else process.exit(143); });
  process.on('SIGINT', () => { if (child) forward('SIGINT'); else process.exit(130); });

  if (process.env.STARTUP_LOCK === '0') {
    log('STARTUP_LOCK=0 — bỏ khoá');
    process.exit(await runChild(cmd, args, (c) => { child = c; }));
  }

  const { PrismaClient } = require('@prisma/client');
  const url = singleConnectionUrl(process.env.DIRECT_URL || process.env.DATABASE_URL);
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  for (let i = 1; ; i++) {
    try { await prisma.$connect(); break; } catch (err) {
      if (i >= CONNECT_TRIES) {
        console.error(`[startup-lock] không kết nối được Postgres sau ${i} lần:`, err.message);
        process.exit(1);
      }
      log(`Postgres chưa sẵn sàng, thử lại (${i}/${CONNECT_TRIES})`);
      await sleep(CONNECT_RETRY_MS);
    }
  }

  const maxWaitMs = (Number(process.env.STARTUP_LOCK_MAX_WAIT_S) || 900) * 1000;
  const t0 = Date.now();
  let lastLog = 0;
  for (;;) {
    const [{ locked }] = await prisma.$queryRawUnsafe(`SELECT pg_try_advisory_lock(${LOCK_KEY}) AS locked`);
    if (locked) break;
    const waited = Date.now() - t0;
    if (waited > maxWaitMs) {
      console.error(`[startup-lock] chờ khoá quá ${Math.round(maxWaitMs / 1000)} s — thoát để container khởi động lại`);
      await prisma.$disconnect().catch(() => {});
      process.exit(1);
    }
    if (Date.now() - lastLog >= LOG_EVERY_MS) {
      lastLog = Date.now();
      log(`bản server khác đang chuẩn bị DB — chờ (${Math.round(waited / 1000)} s)`);
    }
    await sleep(POLL_MS);
  }
  log(`đã giữ khoá sau ${((Date.now() - t0) / 1000).toFixed(1)} s — chạy phần chuẩn bị DB`);

  // Giữ kết nối không rảnh: pool có thể đóng kết nối rảnh lâu, mà đóng là mất khoá.
  const keepalive = setInterval(() => { prisma.$queryRawUnsafe('SELECT 1').catch(() => {}); }, KEEPALIVE_MS);
  const code = await runChild(cmd, args, (c) => { child = c; });
  clearInterval(keepalive);

  try { await prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock(${LOCK_KEY})`); } catch { /* đóng kết nối cũng nhả */ }
  await prisma.$disconnect().catch(() => {});
  log(`xong (mã thoát ${code}) — nhả khoá`);
  process.exit(code);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[startup-lock] lỗi:', err.message);
    process.exit(1);
  });
}

module.exports = { singleConnectionUrl, LOCK_KEY };
