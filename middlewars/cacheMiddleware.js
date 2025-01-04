const RedisCacheHelper = require('../helpers/redis.helper');
const cache = new RedisCacheHelper();

module.exports = {
    cacheJson: async (req, res, next) => {
        const key = `gsmsaathi_api_route${req.originalUrl || req.url}`;
        try {
            if (await cache.existCacheData(key) === 1) {
                res.setHeader('content-type', 'application/json');
                console.log("Cache hit for key:", key);
                return res.send(await cache.getCacheData(key, 'json'));

            } else {
                const originalJson = res.json;
                res.json = async function (json) {
                    originalJson.call(this, json);
                    if (res.statusCode < 400) {
                        await cache.setCacheData(key, json, 'json');
                    }
                };
                next();
            }
        } catch (e) {
            console.error("Cache middleware error:", e);
            res.status(500).json({ msg: "Something went wrong!" });
        }
    }
};
