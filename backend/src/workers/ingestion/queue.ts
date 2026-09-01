import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../../config';
import { logger } from '../../utils/logger';

const redisConnection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    if (process.env.NODE_ENV === 'test' || times > 2) {
      return null;
    }
    return Math.min(times * 100, 2000);
  },
});

redisConnection.on('error', (err) => {
  if (process.env.NODE_ENV !== 'test') {
    logger.error({ err }, 'Redis connection error');
  }
});

export const INGESTION_QUEUE_NAME = 'document-ingestion-queue';

export interface IngestionJobPayload {
  documentId: string;
  documentVersionId: string;
  organizationId: string;
  knowledgeBaseId: string;
}

export const ingestionQueue = new Queue<IngestionJobPayload>(INGESTION_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

ingestionQueue.on('error', () => {
  // Silent error handler for offline Redis during tests
});

export function getRedisConnection() {
  return redisConnection;
}
