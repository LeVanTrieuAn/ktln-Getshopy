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
  console.log('ℹ️  REDIS_URL not set — running without cache');
}

// Read-through cache: falls back to DB if Redis is absent or fails.
async function cached(key, ttlSeconds, fetchFn) {
  if (isConnected) {
    try {
      const hit = await redis.get(key);
      if (hit) return JSON.parse(hit);
    } catch (err) {
      console.warn(`Redis read failed for "${key}", falling back:`, err.message);
    }
  }

  const data = await fetchFn();

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
  if (!isConnected) return;
  try {
    await redis.del(keys);
  } catch (err) {
    console.warn(`Redis invalidate failed for [${keys.join(', ')}]:`, err.message);
  }
}

module.exports = { redis, isConnected: () => isConnected, cached, invalidate };
