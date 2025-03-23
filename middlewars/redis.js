const { redis, ENABLE_REDIS_CACHE } = require("../config/redis");

const cacheMiddleware = async (req, res, next) => {
  if (!ENABLE_REDIS_CACHE) {
    console.log("🛑 Redis cache is disabled");
    return next();
  }

  const cacheKey = req.originalUrl || req.url; // Unique cache key based on URL

  try {
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      console.log("✅ Cache hit:", cacheKey);
      res.setHeader("Content-Type", "application/json");
      return res.send(cachedData); // Return cached response
    }

    console.log("❌ Cache miss:", cacheKey);

    // Store response in cache before sending
    res.sendResponse = res.send;
    res.send = (body) => {
      const responseBody = typeof body === "string" ? body : JSON.stringify(body);
      redis.setex(cacheKey, 600, responseBody); // Cache for 10 minutes (600 sec)
      res.setHeader("Content-Type", "application/json");
      res.sendResponse(responseBody);
    };

    next();
  } catch (err) {
    console.error("⚠️ Redis cache error:", err);
    next();
  }
};

module.exports = cacheMiddleware;
