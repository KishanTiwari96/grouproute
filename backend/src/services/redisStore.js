import Redis from 'ioredis';

let redisClient = null;
let isRedisConnected = false;

// High-performance In-Memory Redis Emulator Fallback
const memoryStore = new Map();
const memoryHashes = new Map();
const memoryExpirations = new Map();

export async function initRedis() {
  if (process.env.REDIS_URL) {
    try {
      redisClient = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        retryStrategy: () => null // don't loop forever if down
      });

      redisClient.on('error', (err) => {
        if (!isRedisConnected) {
          console.warn('[Redis] External Redis not reachable. Using in-memory high-speed cache.');
        }
      });

      await redisClient.connect();
      isRedisConnected = true;
      console.log('[Redis] Connected to external Redis instance.');
      return;
    } catch (err) {
      console.warn('[Redis] Connection failed. Using in-memory high-speed cache.');
      isRedisConnected = false;
    }
  } else {
    console.log('[Redis] No REDIS_URL provided. Using in-memory high-speed cache.');
  }
}

export const redisStore = {
  // Hash Set (Key, Field, Value)
  async hset(key, field, value) {
    const stringVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (isRedisConnected && redisClient) {
      return redisClient.hset(key, field, stringVal);
    }
    if (!memoryHashes.has(key)) {
      memoryHashes.set(key, new Map());
    }
    memoryHashes.get(key).set(field, stringVal);
    return 1;
  },

  // Hash Get
  async hget(key, field) {
    if (isRedisConnected && redisClient) {
      const res = await redisClient.hget(key, field);
      return res;
    }
    if (!memoryHashes.has(key)) return null;
    return memoryHashes.get(key).get(field) || null;
  },

  // Hash Get All
  async hgetall(key) {
    if (isRedisConnected && redisClient) {
      const res = await redisClient.hgetall(key);
      const parsed = {};
      for (const [k, v] of Object.entries(res)) {
        try {
          parsed[k] = JSON.parse(v);
        } catch {
          parsed[k] = v;
        }
      }
      return parsed;
    }
    if (!memoryHashes.has(key)) return {};
    const hash = memoryHashes.get(key);
    const result = {};
    for (const [k, v] of hash.entries()) {
      try {
        result[k] = JSON.parse(v);
      } catch {
        result[k] = v;
      }
    }
    return result;
  },

  // Hash Delete Field
  async hdel(key, field) {
    if (isRedisConnected && redisClient) {
      return redisClient.hdel(key, field);
    }
    if (!memoryHashes.has(key)) return 0;
    return memoryHashes.get(key).delete(field) ? 1 : 0;
  },

  // Set with optional TTL
  async set(key, value, expireSeconds = null) {
    const stringVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (isRedisConnected && redisClient) {
      if (expireSeconds) {
        return redisClient.set(key, stringVal, 'EX', expireSeconds);
      }
      return redisClient.set(key, stringVal);
    }
    memoryStore.set(key, stringVal);
    if (expireSeconds) {
      const expiry = Date.now() + expireSeconds * 1000;
      memoryExpirations.set(key, expiry);
    }
    return 'OK';
  },

  // Get
  async get(key) {
    if (isRedisConnected && redisClient) {
      const val = await redisClient.get(key);
      if (!val) return null;
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    if (memoryExpirations.has(key)) {
      if (Date.now() > memoryExpirations.get(key)) {
        memoryStore.delete(key);
        memoryExpirations.delete(key);
        return null;
      }
    }
    const val = memoryStore.get(key);
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  },

  // Delete
  async del(key) {
    if (isRedisConnected && redisClient) {
      return redisClient.del(key);
    }
    memoryHashes.delete(key);
    memoryExpirations.delete(key);
    return memoryStore.delete(key) ? 1 : 0;
  },

  // Clear specific trip data
  async clearTrip(tripId) {
    await this.del(`trip:${tripId}:locations`);
    await this.del(`trip:${tripId}:state`);
  }
};

export default redisStore;
