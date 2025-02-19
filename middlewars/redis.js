const Redis = require('ioredis');
require("dotenv").config();

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  // tls: {} // Uncomment if a secure TLS connection is required
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

const cacheMiddleware = async (req, res, next) => {
  const cacheKey = req.originalUrl || req.url; // Use the request URL as the cache key
  try {
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log('Cache hit');
      res.setHeader('Content-Type', 'application/json'); // Set content type for JSON response
      return res.send(cachedData); // Send cached JSON string directly
    } else {
      console.log('Cache miss');
      res.sendResponse = res.send;
      res.send = (body) => {
        const responseBody = typeof body === 'string' ? body : JSON.stringify(body);
        redis.set(cacheKey, responseBody); // Store JSON string without expiration
        res.setHeader('Content-Type', 'application/json'); // Set content type for JSON response
        res.sendResponse(responseBody);
      };
      next();
    }
  } catch (err) {
    console.error('Cache error:', err);
    next();
  }
};

module.exports = cacheMiddleware;
