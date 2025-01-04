const Redis = require('ioredis');
const { REDIS_URL } = process.env;

const  redis = new Redis(REDIS_URL || "redis://127.0.0.1:6379");

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
        const res = await this.redis().exists(key);
        return res;
    }

    async delCacheData(key) {
        const res = await this.redis().del(key);
        return res;
    }

    async setCacheData(key, data, type, time = 7200) {
        let res;
        if (type === 'json') res = await this.redis().set(key, JSON.stringify(data));
        if (type === 'buffer') res = await this.redis().setBuffer(key, data);
        await this.redis().expire(key, time);
        return res;
    }

    async getCacheData(key, type) {
        let res;
        if (type === 'json') res = await this.redis().get(key);
        if (type === 'buffer') res = await this.redis().getBuffer(key);
        return res;
    }

    async _flush(pattern = "*") {
        return this.redis().keys(pattern).then(keys => {
            const pipeline = this.redis().pipeline();
            keys.forEach(key => pipeline.del(key));
            return pipeline.exec();
        });
    }
};
