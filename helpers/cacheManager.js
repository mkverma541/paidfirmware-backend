const RedisCacheHelper = require('./redis.helper');

class CacheManager extends RedisCacheHelper {
    constructor() {
        super();
        this.keys = {
            resume: 'resumod_resume:',
            authUser: 'resumod_auth_user:',
            website: 'resumod_html_route',
        };
    }

    createKey(name, suffix) {
        if (!this.keys[name]) {
            throw new Error("Key not found.");
        }
        suffix = suffix.toString();
        if (typeof suffix !== "string") {
            throw new Error("Suffix must be string.");
        }

        return this.keys[name] + suffix;
    }

    async cacheResume(cachedData, id) {
        const cacheKey = this.createKey("resume", id);
        await this.setCacheData(cacheKey, cachedData, 'json', 600);
        return true;
    }

    async getCachedResume(id) {
        try {
            const cacheKey = this.createKey("resume", id);
            const prevResumeData = await this.existCacheData(cacheKey) === 1;
            if (prevResumeData) {
                const cachedData = await this.getCacheData(cacheKey, 'json');
                return JSON.parse(cachedData || {});
            }
            return null;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    async deleteCachedResume(id) {
        const cacheKey = this.createKey("resume", id);
        const prevResumeData = await this.existCacheData(cacheKey) === 1;
        if (prevResumeData) {
            await this.delCacheData(cacheKey);
        }
        return true;
    }

    flushCache() {
        return this._flush();
    }
}

module.exports = new CacheManager();
