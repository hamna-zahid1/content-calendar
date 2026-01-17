const redis = require('../config/redis');

const RATE_LIMIT_WINDOW = 60; // 1 minute
const MAX_REQUESTS = 10;

async function checkRateLimit(userId) {
  const key = `rate_limit:${userId}`;
  
  try {
    const current = await redis.get(key);
    
    if (!current) {
      await redis.setex(key, RATE_LIMIT_WINDOW, 1);
      return { allowed: true, remaining: MAX_REQUESTS - 1 };
    }
    
    const count = parseInt(current);
    
    if (count >= MAX_REQUESTS) {
      const ttl = await redis.ttl(key);
      return { 
        allowed: false, 
        remaining: 0,
        retryAfter: ttl 
      };
    }
    
    await redis.incr(key);
    return { allowed: true, remaining: MAX_REQUESTS - count - 1 };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Allow request on error to not block users
    return { allowed: true, remaining: MAX_REQUESTS };
  }
}

module.exports = { checkRateLimit };