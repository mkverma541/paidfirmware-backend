require("dotenv").config();
const Redis = require("ioredis");

// Only enable Redis caching if explicitly set to "true"
const ENABLE_REDIS_CACHE = process.env.ENABLE_REDIS_CACHE === "true";

// Create a single Redis client instance
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  username: process.env.REDIS_USERNAME || undefined, // Avoid sending undefined values
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => Math.min(times * 50, 2000), // Retry with exponential backoff
});

// Handle Redis events
redis.on("connect", () => console.log("✅ Connected to Redis"));
redis.on("error", (err) => console.error("❌ Redis connection error:", err));

module.exports = { redis, ENABLE_REDIS_CACHE };
