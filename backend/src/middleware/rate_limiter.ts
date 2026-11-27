import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import { config } from '../config';

let redisClient: Redis | null = null;
if (config.rateLimitEnabled) {
  redisClient = new Redis(config.redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 1000 });
  redisClient.on('error', () => {
    /* fall back to in-memory limiting while Redis is unavailable */
  });
}

export interface RateLimitOptions {
  name: string; // logical limiter name, part of the key
  windowMs?: number;
  maxRequests?: number;
  scope?: 'ip' | 'org' | 'principal';
}

// In-memory fixed-window fallback so limits still apply (per instance) when Redis is down.
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of memoryBuckets) if (bucket.resetAt <= now) memoryBuckets.delete(key);
}, 60_000).unref();

function memoryHit(key: string, windowMs: number): number {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  bucket.count += 1;
  return bucket.count;
}

async function redisHit(key: string, windowMs: number): Promise<number> {
  // Sliding window log: O(log n) per request with a sorted set, n bounded by maxRequests.
  const now = Date.now();
  const results = await redisClient!
    .multi()
    .zremrangebyscore(key, 0, now - windowMs)
    .zadd(key, now, `${now}-${Math.random()}`)
    .zcard(key)
    .pexpire(key, windowMs)
    .exec();
  return (results?.[2]?.[1] as number) || 1;
}

function identify(req: Request, scope: RateLimitOptions['scope']): string {
  if (scope === 'org' && req.user?.organizationId) return `org:${req.user.organizationId}`;
  if (scope === 'principal' && req.user) {
    // API keys are limited per key, users per user. Never put raw key material in Redis keys.
    if (req.user.apiKeyId) return `key:${req.user.apiKeyId}`;
    if (req.user.userId) return `user:${req.user.userId}`;
  }
  return `ip:${crypto.createHash('sha256').update(req.ip || 'unknown').digest('hex').slice(0, 16)}`;
}

/**
 * Rate limiter middleware. Uses Redis when available (shared across instances),
 * otherwise an in-memory window (per instance). Responds 429 with Retry-After.
 */
export function rateLimiter(options: RateLimitOptions) {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 60;
  const scope = options.scope ?? 'ip';

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!config.rateLimitEnabled) return next();

    const key = `ratelimit:${options.name}:${identify(req, scope)}`;
    let count: number;
    try {
      count = redisClient && redisClient.status === 'ready' ? await redisHit(key, windowMs) : memoryHit(key, windowMs);
    } catch (error) {
      logger.warn({ err: (error as Error).message }, 'Rate limiter Redis error; using in-memory window');
      count = memoryHit(key, windowMs);
    }

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));

    if (count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      logger.warn({ limiter: options.name, scope }, 'Rate limit exceeded');
      return res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: `Too many requests. Limit is ${maxRequests} per ${Math.round(windowMs / 1000)} seconds.`,
          correlationId: req.correlationId,
        },
      });
    }
    return next();
  };
}

/** Closes the limiter's Redis connection (used by tests and graceful shutdown). */
export async function closeRateLimiter() {
  if (redisClient) redisClient.disconnect();
}
