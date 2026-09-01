import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { logger } from './utils/logger';
import { runMigrations } from './db';
import { initTelemetry } from './telemetry/tracer';
import { correlationIdMiddleware } from './middleware/correlation';
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

export const app = express();

app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info({
    method: req.method,
    url: req.url,
    correlationId: req.correlationId,
  }, 'Incoming HTTP request');
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  return res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString(), env: config.nodeEnv });
});

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/organizations', organizationRouter);
app.use('/api/v1/api-keys', apiKeyRouter);
app.use('/api/v1/audit-logs', auditRouter);
app.use('/api/v1/knowledge-bases', knowledgeBaseRouter);
app.use('/api/v1', documentRouter);
app.use('/api/v1', conversationRouter);
app.use('/', healthRouter);
app.use('/api/v1', authRouter);
app.use('/api/v1', organizationRouter);
app.use('/api/v1', agentRouter);
app.use('/api/v1', analyticsRouter);

// Centralized error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, correlationId: req.correlationId }, 'Unhandled server error');
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal server error occurred',
      correlationId: req.correlationId,
    },
  });
});

export async function startServer() {
  initTelemetry();
  await runMigrations();

  const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} [ENV=${config.nodeEnv}]`);
  });

  return server;
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  });
}
