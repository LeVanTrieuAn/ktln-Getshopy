const { createClient } = require('redis');

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.on('error', err => console.error('Redis Client Error', err));
redis.connect().then(() => console.log('📦 Redis connected')).catch(console.error);

// Read-through cache: serves stale-free data straight from source if Redis is
// unavailable, so a cache outage never turns into a 500 for the caller.
async function cached(key, ttlSeconds, fetchFn) {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit);
  } catch (err) {
    console.error(`Redis read failed for "${key}", falling back to source:`, err.message);
  }

  const data = await fetchFn();

  try {
    await redis.setEx(key, ttlSeconds, JSON.stringify(data));
  } catch (err) {
    console.error(`Redis write failed for "${key}":`, err.message);
  }

  return data;
}

async function invalidate(...keys) {
  try {
    await redis.del(keys);
  } catch (err) {
    console.error(`Redis invalidate failed for [${keys.join(', ')}]:`, err.message);
  }
}

module.exports = { redis, cached, invalidate };
