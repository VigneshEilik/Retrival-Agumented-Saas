import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { Redis } from 'ioredis';

const router = Router();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Liveness Probe: Checks if the API process is alive
router.get('/live', (req: Request, res: Response) => {
  return res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// General Health Check
router.get('/health', (req: Request, res: Response) => {
  return res.status(200).json({ status: 'HEALTHY', service: 'rag-saas-api' });
});

// Readiness Probe: Probes DB & Redis connectivity to verify system can serve requests
router.get('/ready', async (req: Request, res: Response) => {
  const checks: Record<string, 'UP' | 'DOWN'> = {
    database: 'DOWN',
    redis: 'DOWN',
  };

  let isHealthy = true;

  // Probe PostgreSQL Database
  try {
    const dbRes = await pool.query('SELECT 1 as ready');
    if (dbRes.rows[0]?.ready === 1) {
      checks.database = 'UP';
    } else {
      isHealthy = false;
    }
  } catch (error) {
    checks.database = 'DOWN';
    isHealthy = false;
  }

  // Probe Redis. Redis is NOT required to serve traffic (ingestion runs in-process and rate
  // limiting falls back to memory), so a Redis outage reports DEGRADED but stays ready.
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 0, connectTimeout: 1000, retryStrategy: () => null });
  redis.on('error', () => {});
  try {
    await redis.connect();
    checks.redis = (await redis.ping()) === 'PONG' ? 'UP' : 'DOWN';
  } catch {
    checks.redis = 'DOWN';
  } finally {
    redis.disconnect(); // always release the probe connection
  }

  const statusCode = isHealthy ? 200 : 503;
  return res.status(statusCode).json({
    status: !isHealthy ? 'UNREADY' : checks.redis === 'UP' ? 'READY' : 'DEGRADED',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export const healthRouter = router;
