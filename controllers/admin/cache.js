// controllers/cacheController.js
const NodeCache = require('node-cache');
const { redis, ENABLE_REDIS_CACHE } = require('../../config/redis'); // Import BOTH

const inMemoryCache = new NodeCache();

function clearRequireCache() {
    Object.keys(require.cache).forEach((key) => {
        delete require.cache[key];
    });
    console.log('✅ Require cache cleared!');
}

function flushInMemoryCache() {
    inMemoryCache.flushAll();
    console.log('✅ In-memory cache cleared!');
}

async function flushRedisCache() {
    try {
        // Wait for the Redis connection to be ready.
        await redis.ping(); // A simple way to check if the connection is alive.
        await redis.flushall();
        console.log('✅ Redis cache cleared!');
    } catch (error) {
        console.error('❌ Error flushing Redis cache:', error);
        throw new Error('Failed to clear Redis cache');
    }
}

exports.clearAllCaches = async (req, res) => {
    try {
        clearRequireCache();
        flushInMemoryCache();
        if (ENABLE_REDIS_CACHE) { // Only clear Redis if it's enabled
            await flushRedisCache();
        }
        res.status(200).json({ message: 'All caches cleared successfully!' });
    } catch (error) {
        console.error('❌ Error clearing caches:', error);
        res.status(500).json({ message: 'Failed to clear caches', error: error.message });
    }
};