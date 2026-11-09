#!/usr/bin/env node
'use strict';
/**
 * mirror-product-images.js
 * ------------------------------------------------------------
 * Tải ảnh sản phẩm từ cdn.tgdd.vn (bị chặn hotlink theo Referer -> HTTP 403 khi
 * trình duyệt gửi Referer localhost) về MinIO, bucket RIÊNG `product-images`.
 *
 * Không sửa DB. URL gốc giữ nguyên; lớp Nginx của client đổi
 *   https://cdn.tgdd.vn/<path>  ->  /product-images/<path>
 * trong phản hồi /api/ (xem client/nginx.conf).
 *
 * Không cần thư viện ngoài: ký AWS Signature V4 bằng crypto của Node.
 * Thông tin MinIO đọc từ .env gốc (MINIO_ACCESS_KEY, MINIO_SECRET_KEY). Không in khóa.
 *
 * Chạy (từ thư mục gốc dự án, MinIO đã chạy và mở cổng 9000):
 *   node ktln-Getshopy/qu-n-ly-ban-l/source/scripts/mirror-product-images.js
 * Chạy lại được (idempotent): ảnh đã có sẽ được bỏ qua.
 *
 * Tùy chọn: --endpoint=http://localhost:9000  --bucket=product-images  --dry-run
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const arg = (n, d) => (process.argv.find(a => a.startsWith(`--${n}=`)) || '').split('=')[1] || d;
const DRY = process.argv.includes('--dry-run');
const ENDPOINT = arg('endpoint', 'http://localhost:9000');
const BUCKET = arg('bucket', 'product-images');
const REGION = 'us-east-1';
const SRC_HOST = 'cdn.tgdd.vn';
const PG_CONTAINER = process.env.PG_CONTAINER || 'kltn-postgres-1';

function readEnv() {
  const file = path.resolve(process.cwd(), '.env');
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
const env = readEnv();
const AK = env.MINIO_ACCESS_KEY, SK = env.MINIO_SECRET_KEY;
if (!AK || !SK) { console.error('Thiếu MINIO_ACCESS_KEY / MINIO_SECRET_KEY trong .env (chạy từ thư mục gốc dự án).'); process.exit(1); }

// ── AWS Signature V4 (path-style, service s3) ───────────────────────────────
const sha256 = (d) => crypto.createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
// encodeURIComponent chừa lại ! ' ( ) * nhưng AWS SigV4 yêu cầu mã hóa chúng (tên ảnh có "(1)").
const encPath = (p) => p.split('/').map(s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())).join('/');

async function s3(method, key, { query = '', body = null, contentType } = {}) {
  const u = new URL(ENDPOINT);
  const uri = `/${BUCKET}${key ? '/' + encPath(key) : ''}`;
  const payload = body || Buffer.alloc(0);
  const payloadHash = sha256(payload);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const headers = { host: u.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  const names = Object.keys(headers).sort();
  const canonical = [
    method, uri, query,
    names.map(n => `${n}:${headers[n]}\n`).join(''),
    names.join(';'), payloadHash,
  ].join('\n');
  const scope = `${day}/${REGION}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n');
  const kSign = hmac(hmac(hmac(hmac('AWS4' + SK, day), REGION), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', kSign).update(toSign).digest('hex');
  const auth = `AWS4-HMAC-SHA256 Credential=${AK}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  const res = await fetch(`${ENDPOINT}${uri}${query ? '?' + query : ''}`, {
    method,
    headers: { 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, Authorization: auth, ...(contentType ? { 'Content-Type': contentType } : {}) },
    body: method === 'PUT' || method === 'POST' ? payload : undefined,
  });
  return res;
}

// ── Lấy URL cần mirror từ DB ────────────────────────────────────────────────
function collectUrls() {
  const sql = `
SELECT DISTINCT u FROM (
  SELECT image AS u FROM (SELECT DISTINCT image FROM "Product") a WHERE image LIKE 'https://${SRC_HOST}/%'
  UNION
  SELECT (regexp_matches(imgs, 'https://${SRC_HOST.replace(/\./g, '\\.')}/[^"\\s\\\\]+', 'g'))[1]
  FROM (SELECT DISTINCT images #>> '{}' AS imgs FROM "Product") b WHERE imgs IS NOT NULL
) t ORDER BY 1;`;
  const out = execSync(`docker exec -i ${PG_CONTAINER} psql -U ${env.POSTGRES_USER || 'getshopy'} -d ${env.POSTGRES_DB || 'getshopy'} -t -A`, { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.split(/\r?\n/).map(s => s.trim()).filter(s => s.startsWith('https://'));
}

(async () => {
  const urls = collectUrls();
  console.log(`URL ${SRC_HOST} cần mirror: ${urls.length}`);
  if (DRY) { urls.slice(0, 5).forEach(u => console.log('  ', u)); return; }

  // 1) Tạo bucket (200 = mới tạo; 409 = đã có)
  let r = await s3('PUT', '');
  if (![200, 409].includes(r.status)) { console.error('Tạo bucket thất bại HTTP', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  console.log(`Bucket ${BUCKET}: ${r.status === 200 ? 'đã tạo' : 'đã tồn tại'}`);

  // 2) Quyền đọc công khai CHỈ cho object (không cho liệt kê/ghi)
  const policy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [{ Effect: 'Allow', Principal: { AWS: ['*'] }, Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${BUCKET}/*`] }],
  });
  r = await s3('PUT', '', { query: 'policy=', body: Buffer.from(policy), contentType: 'application/json' });
  if (![200, 204].includes(r.status)) { console.error('Đặt policy thất bại HTTP', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  console.log('Policy: đọc công khai (GetObject)');

  // 3) Tải từng ảnh -> upload
  const stat = { uploaded: 0, skipped: 0, failed: [] };
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const url = urls[i++];
      const key = new URL(url).pathname.replace(/^\//, '');
      try {
        const head = await s3('HEAD', key);
        if (head.status === 200) { stat.skipped++; continue; }
        const src = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) }); // KHÔNG gửi Referer
        if (!src.ok) { stat.failed.push(`${src.status} ${url}`); continue; }
        const buf = Buffer.from(await src.arrayBuffer());
        const put = await s3('PUT', key, { body: buf, contentType: src.headers.get('content-type') || 'image/jpeg' });
        if (put.status === 200) stat.uploaded++; else stat.failed.push(`PUT ${put.status} ${url}`);
      } catch (e) { stat.failed.push(`${e.message} ${url}`); }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));

  console.log(`\nKết quả: tải mới ${stat.uploaded}, đã có ${stat.skipped}, thất bại ${stat.failed.length}`);
  stat.failed.slice(0, 20).forEach(f => console.log('  FAIL', f));
})();
