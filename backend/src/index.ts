import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import Redis from 'ioredis';
import { Server } from 'http';
import { config, validateConfig } from './config';
import { logger } from './utils/logger';
import { pool, runMigrations } from './db';
import { initTelemetry } from './telemetry/tracer';
import { correlationIdMiddleware } from './middleware/correlation';
import { standardizedErrorHandler, notFoundHandler } from './middleware/error_handler';
import { rateLimiter } from './middleware/rate_limiter';
import { authRouter } from './modules/auth/auth.router';
import { organizationRouter } from './modules/organization/organization.router';
import { apiKeyRouter } from './modules/apikey/apikey.router';
import { auditRouter } from './modules/audit/audit.router';
import { knowledgeBaseRouter } from './modules/knowledge-base/knowledge-base.router';
import { documentRouter } from './modules/document/document.router';
import { conversationRouter } from './modules/conversation/conversation.router';
import { agentRouter } from './modules/agent/agent.router';
import { analyticsRouter } from './modules/analytics/analytics.router';
import { healthRouter } from './modules/health/health.router';
import { getLLMProvider } from './providers/llm';
import { getEmbeddingProvider } from './providers/embedding';
import { createIngestionWorker } from './workers/ingestion/processor';
import { recoverStalledIngestions } from './workers/ingestion/dispatch';

export const app = express();

app.disable('x-powered-by');
if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);

// --- Security headers (the API serves JSON/SSE only, so a strict policy is safe) ---
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  if (config.isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// --- CORS: explicit allowlist in production; permissive only in development ---
app.use(
  cors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : !config.isProduction,
    credentials: false, // bearer tokens / API keys, no cookies
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After', 'X-Correlation-Id'],
  })
);

// Correlation ID first, so even body-parsing errors carry one.
app.use(correlationIdMiddleware);
app.use(express.json({ limit: '1mb' }));

// Request log (path only: query strings are not logged to avoid leaking tokens)
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info({ method: req.method, path: req.path, correlationId: req.correlationId }, 'Incoming HTTP request');
  next();
});

// --- Health (no auth, not rate limited) ---
app.use('/', healthRouter);

// --- API v1 ---
// Global safety net per client IP; stricter limits are applied on auth, upload and chat routes.
app.use('/api/v1', rateLimiter({ name: 'global', scope: 'ip', windowMs: 60_000, maxRequests: 600 }));
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/organizations', organizationRouter);
app.use('/api/v1/api-keys', apiKeyRouter);
app.use('/api/v1/audit-logs', auditRouter);
app.use('/api/v1/knowledge-bases', knowledgeBaseRouter);
app.use('/api/v1', documentRouter);
app.use('/api/v1', conversationRouter);
app.use('/api/v1', agentRouter);
app.use('/api/v1', analyticsRouter);

app.use(notFoundHandler);
app.use(standardizedErrorHandler);

export async function startServer(): Promise<Server> {
  validateConfig();
  initTelemetry();
  if (config.runMigrationsOnStart) {
    await runMigrations();
  }

  const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} [ENV=${config.nodeEnv}]`);
  });
  // SSE answers can take a while; keep sockets open long enough for slow generations.
  server.requestTimeout = 0;
  server.headersTimeout = 65_000;
  server.keepAliveTimeout = 61_000;

  const llm = getLLMProvider();
  const embedder = getEmbeddingProvider();
  logger.info({ llm: `${llm.name} (${llm.model})`, embeddings: embedder.name }, 'AI providers configured');
  if (llm.name === 'MockLLMProvider') {
    logger.warn('GROQ_API_KEY is not set: answers come from the mock LLM, not a real model.');
  }

  // Warm up the embedding model in the background so the first upload/question isn't slow.
  embedder.embedQuery('warm up').catch((err) => logger.error({ err: err.message }, 'Embedding model failed to load'));

  if (config.runIngestionWorker) {
    await startInProcessWorker();
  }

  // Re-dispatch documents left QUEUED/PROCESSING by a crash or restart.
  recoverStalledIngestions().catch((err) => logger.warn({ err: err.message }, 'Ingestion recovery skipped'));

  registerShutdown(server);
  return server;
}

// Runs the BullMQ ingestion worker inside the API process when Redis is reachable.
// Without Redis, uploads are processed in-process directly (see workers/ingestion/dispatch.ts).
async function startInProcessWorker() {
  const probe = new Redis(config.redisUrl, { lazyConnect: true, connectTimeout: 1500, maxRetriesPerRequest: 0, retryStrategy: () => null });
  probe.on('error', () => {});
  try {
    await probe.connect();
    await probe.ping();
    createIngestionWorker();
    logger.info('Ingestion worker started in API process (Redis queue)');
  } catch {
    logger.warn('Redis unreachable: ingestion worker not started; uploads will be processed in-process');
  } finally {
    probe.disconnect();
  }
}

function registerShutdown(server: Server) {
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down: no longer accepting connections');
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
    // Force exit if open SSE streams don't finish in time.
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error({ err: err.message }, 'Failed to start server');
    process.exit(1);
  });
}
