const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL;
const redis = REDIS_URL
  ? createClient({ url: REDIS_URL })
  : null;

let isConnected = false;

if (redis) {
  redis.on('error', err => console.warn('⚠️  Redis Client Error (cache disabled):', err.message));
  redis.connect()
    .then(() => { isConnected = true; console.log('📦 Redis connected'); })
    .catch(err => console.warn('⚠️  Redis unavailable, running without cache:', err.message));
} else {
  console.log('ℹ️  REDIS_URL not set — using in-memory cache fallback');
}

// ── In-memory cache (fallback khi không có Redis) ──────────────────
// Tránh hit DB mỗi request → API từ 2-3s xuống còn <10ms sau lần đầu
const memCache = new Map();

function memGet(key) {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    memCache.delete(key);
    return null;
  }
  return entry.value;
}

function memSet(key, value, ttlSeconds) {
  // Giới hạn cache size để tránh memory leak
  if (memCache.size > 500) {
    const firstKey = memCache.keys().next().value;
    memCache.delete(firstKey);
  }
  memCache.set(key, { value, expiry: Date.now() + ttlSeconds * 1000 });
}

// ── Read-through cache: Redis → in-memory → DB ────────────────────
async function cached(key, ttlSeconds, fetchFn) {
  // 1. Thử Redis trước (nếu có)
  if (isConnected) {
    try {
      const hit = await redis.get(key);
      if (hit) return JSON.parse(hit);
    } catch (err) {
      console.warn(`Redis read failed for "${key}", falling back:`, err.message);
    }
  }

  // 2. Thử in-memory cache (luôn có, ngay cả khi không có Redis)
  const memHit = memGet(key);
  if (memHit !== null) return memHit;

  // 3. Fetch từ DB
  const data = await fetchFn();

  // 4. Lưu vào in-memory cache
  memSet(key, data, ttlSeconds);

  // 5. Lưu vào Redis nếu có
  if (isConnected) {
    try {
      await redis.setEx(key, ttlSeconds, JSON.stringify(data));
    } catch (err) {
      console.warn(`Redis write failed for "${key}":`, err.message);
    }
  }

  return data;
}

async function invalidate(...keys) {
  // Xóa khỏi cả in-memory và Redis
  keys.forEach(k => memCache.delete(k));

  if (!isConnected) return;
  try {
    await redis.del(keys);
  } catch (err) {
    console.warn(`Redis invalidate failed for [${keys.join(', ')}]:`, err.message);
  }
}

module.exports = { redis, isConnected: () => isConnected, cached, invalidate };
