const redis = require('redis');

// Create Redis client
const client = redis.createClient({
  host: 'localhost',  // or Docker host IP
  port: 6379,         // default Redis port
});

// Handle connection events
client.on('connect', () => {
  console.log('Connected to Redis...');
});

client.on('error', (err) => {
  console.error('Redis error:', err);
});

// Example usage: set a key
client.set('key', 'value', (err, reply) => {
  if (err) console.error(err);
  console.log(reply); // Should print "OK"
});

// Example usage: get a key
client.get('key', (err, reply) => {
  if (err) console.error(err);
  console.log(reply); // Should print "value"
});

module.exports = client;
