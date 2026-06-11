import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
let redisClient = null;
let isRedisConnected = false;

// Fallback in-memory storage
const sessionMap = new Map();
const routeCacheMap = new Map();
const subscribersMap = new Map();

try {
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        console.warn(`Redis connection failed after ${times} retries. Degrading to in-memory fallback.`);
        return null; // Stop retrying and fail gracefully
      }
      return Math.min(times * 100, 2000);
    }
  });

  redisClient.on("connect", () => {
    console.log("Redis connected successfully.");
    isRedisConnected = true;
  });

  redisClient.on("error", (err) => {
    console.warn("Redis connection error. Using in-memory fallback:", err.message);
    isRedisConnected = false;
  });
} catch (error) {
  console.warn("Could not initialize Redis client. Using in-memory fallback:", error.message);
  redisClient = null;
}

export { redisClient };

export async function getSession(userId) {
  const key = `session:${userId}`;
  if (isRedisConnected && redisClient) {
    try {
      const val = await redisClient.get(key);
      return val ? JSON.parse(val) : null;
    } catch (err) {
      console.warn("Redis getSession error, falling back to memory:", err.message);
    }
  }
  return sessionMap.get(userId) || null;
}

export async function setSession(userId, data) {
  const key = `session:${userId}`;
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(data));
      return;
    } catch (err) {
      console.warn("Redis setSession error, falling back to memory:", err.message);
    }
  }
  sessionMap.set(userId, data);
}

export async function deleteSession(userId) {
  const key = `session:${userId}`;
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.del(key);
      return;
    } catch (err) {
      console.warn("Redis deleteSession error, falling back to memory:", err.message);
    }
  }
  sessionMap.delete(userId);
}

export async function cacheRoute(key, data, ttlSeconds = 600) {
  const cacheKey = `route:${key}`;
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.setex(cacheKey, ttlSeconds, JSON.stringify(data));
      return;
    } catch (err) {
      console.warn("Redis cacheRoute error, falling back to memory:", err.message);
    }
  }
  routeCacheMap.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function getCachedRoute(key) {
  const cacheKey = `route:${key}`;
  if (isRedisConnected && redisClient) {
    try {
      const val = await redisClient.get(cacheKey);
      return val ? JSON.parse(val) : null;
    } catch (err) {
      console.warn("Redis getCachedRoute error, falling back to memory:", err.message);
    }
  }
  const cached = routeCacheMap.get(key);
  if (cached) {
    if (Date.now() < cached.expiresAt) {
      return cached.data;
    }
    routeCacheMap.delete(key);
  }
  return null;
}

export async function publishEvent(channel, payload) {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.publish(channel, JSON.stringify(payload));
      return;
    } catch (err) {
      console.warn("Redis publishEvent error:", err.message);
    }
  }
  // Local subscriber dispatch for in-memory fallback
  const handlers = subscribersMap.get(channel) || [];
  handlers.forEach(cb => cb(payload));
}

export async function subscribeToChannel(channel, cb) {
  if (isRedisConnected && redisClient) {
    try {
      const subClient = new Redis(redisUrl);
      subClient.on("message", (chan, msg) => {
        if (chan === channel) {
          cb(JSON.parse(msg));
        }
      });
      await subClient.subscribe(channel);
      return subClient;
    } catch (err) {
      console.warn("Redis subscribeToChannel error, falling back to memory:", err.message);
    }
  }
  if (!subscribersMap.has(channel)) {
    subscribersMap.set(channel, []);
  }
  subscribersMap.get(channel).push(cb);
  return {
    unsubscribe: () => {
      const handlers = subscribersMap.get(channel) || [];
      const idx = handlers.indexOf(cb);
      if (idx !== -1) {
        handlers.splice(idx, 1);
      }
    }
  };
}
