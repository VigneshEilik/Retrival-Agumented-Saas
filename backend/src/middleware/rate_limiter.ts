import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient: Redis | null = null;

try {
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 500,
  });
  redisClient.on('error', () => {
    // Graceful silent fallback if Redis is unavailable locally
  });
} catch (e) {
  redisClient = null;
}

export interface RateLimitOptions {
  windowMs?: number; // Time window in ms (default 60000 = 1 min)
  maxRequests?: number; // Max requests allowed per window
  scope?: 'ip' | 'user' | 'org' | 'api_key' | 'endpoint';
}

export function rateLimiter(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs || 60000;
  const maxRequests = options.maxRequests || 60;
  const scope = options.scope || 'ip';

  return async (req: Request, res: Response, next: NextFunction) => {
    // Generate key identifier based on scope
    let identifier = req.ip || '127.0.0.1';
    if (scope === 'user' && req.user) {
      identifier = `user:${req.user.userId}`;
    } else if (scope === 'org' && req.user) {
      identifier = `org:${req.user.organizationId}`;
    } else if (scope === 'api_key' && req.headers['x-api-key']) {
      identifier = `apikey:${req.headers['x-api-key']}`;
    } else if (scope === 'endpoint') {
      identifier = `endpoint:${req.path}:${req.user?.organizationId || req.ip}`;
    }

    const key = `ratelimit:${scope}:${identifier}`;

    try {
      if (redisClient && redisClient.status === 'ready') {
        const now = Date.now();
        const clearBefore = now - windowMs;

        const multi = redisClient.multi();
        multi.zremrangebyscore(key, 0, clearBefore);
        multi.zadd(key, now, `${now}-${Math.random()}`);
        multi.zcard(key);
        multi.pexpire(key, windowMs);

        const results = await multi.exec();
        const requestCount = (results?.[2]?.[1] as number) || 1;
        const remaining = Math.max(0, maxRequests - requestCount);

        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));

        if (requestCount > maxRequests) {
          logger.warn({ key, requestCount, maxRequests }, 'Rate limit threshold exceeded');
          return res.status(429).json({
            error: {
              code: 'RATE_LIMITED',
              message: `Too many requests. Limit is ${maxRequests} requests per minute.`,
              scope,
            },
          });
        }
      } else {
        // Fallback header set if Redis offline
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      }
    } catch (error) {
      logger.error({ error }, 'Rate limiter Redis execution warning');
    }

    return next();
  };
}
