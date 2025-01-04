const Redis = require("ioredis");
const { REDIS_URL } = process.env;

const redisClient = new Redis(REDIS_URL || "redis://mukesh:An5Xn66nySDs.6y@redis-11184.c322.us-east-1-2.ec2.redns.redis-cloud.com:11184");

// Handle connection errors gracefully
redisClient.on("error", (err) => {
  console.error("Redis connection error:", err);
});

redisClient.on("connect", () => {
  console.log("Successfully connected to Redis");
});

module.exports = class RedisCacheHelper {
  constructor(db) {
    this.setDB(db);
  }

  setDB(db) {
    this.db = db;
  }

  getDB() {
    return this.db;
  }

  redis() {
    return redisClient;
  }

  async existCacheData(key) {
    try {
      const res = await this.redis().exists(key);
      return res;
    } catch (err) {
      console.error("Redis exists error:", err);
      return false; // Default to "not found" if Redis fails
    }
  }

  async delCacheData(key) {
    try {
      const res = await this.redis().del(key);
      return res;
    } catch (err) {
      console.error("Redis delete error:", err);
      return null;
    }
  }

  async setCacheData(key, data, type, time = 7200) {
    try {
      let res;
      if (type === "json") res = await this.redis().set(key, JSON.stringify(data));
      if (type === "buffer") res = await this.redis().setBuffer(key, data);
      await this.redis().expire(key, time);
      return res;
    } catch (err) {
      console.error("Redis set error:", err);
      return null;
    }
  }

  async getCacheData(key, type, fallbackQuery = null) {
    try {
      let res;
      if (type === "json") res = await this.redis().get(key);
      if (type === "buffer") res = await this.redis().getBuffer(key);

      // If data exists in Redis, return it
      if (res) {
        return type === "json" ? JSON.parse(res) : res;
      }

      // If Redis miss and fallbackQuery provided, fetch from DB
      if (fallbackQuery) {
        console.log("Fetching data from the database as a fallback...");
        const dbData = await fallbackQuery();
        // Optionally cache the data in Redis for future requests
        if (dbData) {
          await this.setCacheData(key, dbData, type);
        }
        return dbData;
      }

      return null; // No data in Redis and no fallback provided
    } catch (err) {
      console.error("Redis get error:", err);
      // Fallback to database if Redis fails
      if (fallbackQuery) {
        console.log("Redis failed, fetching data from the database...");
        return fallbackQuery();
      }
      return null;
    }
  }

  async _flush(pattern = "*") {
    try {
      const keys = await this.redis().keys(pattern);
      const pipeline = this.redis().pipeline();
      keys.forEach((key) => pipeline.del(key));
      return pipeline.exec();
    } catch (err) {
      console.error("Redis flush error:", err);
      return null;
    }
  }
};
