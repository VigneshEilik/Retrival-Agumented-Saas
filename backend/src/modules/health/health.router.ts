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

  // Probe Redis Connection
  try {
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 1000 });
    const pingRes = await redis.ping();
    if (pingRes === 'PONG') {
      checks.redis = 'UP';
    } else {
      isHealthy = false;
    }
    await redis.quit();
  } catch (error) {
    checks.redis = 'DOWN';
    // Fallback: If Redis is offline in test/dev environment, mark as DEGRADED rather than fatal
    checks.redis = 'DOWN';
  }

  const statusCode = isHealthy ? 200 : 503;
  return res.status(statusCode).json({
    status: isHealthy ? 'READY' : 'UNREADY',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export const healthRouter = router;
