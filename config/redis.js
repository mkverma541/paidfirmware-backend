const Redis = require("ioredis");

const redis = new Redis({
  host: "redis-18417.crce179.ap-south-1-1.ec2.redns.redis-cloud.com",
  port: 18417,
  username: "default",
  password: "MWhWQyGCn69Vz854ev5aDExRw28khnUM"
 
});

redis.on("connect", () => {
  console.log("Connected to Redis");
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

// Example: Set and get a value
redis
  .set("live", "key")
  .then(() => redis.get("key"))
  .then((result) => {
    console.log("Value:", result); // Should print 'value'
    redis.disconnect(); // Close the connection when done
  })
  .catch((err) => {
    console.error("Error:", err);
  });
