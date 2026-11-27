import path from 'path';
import { Worker, Job, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { INGESTION_QUEUE_NAME } from './queue';
import { withTenantContext, pool } from '../../db';
import { getStorageProvider } from '../../providers/storage';
import { getParserForFile } from '../../modules/ingestion/parser';
import { StructureAwareChunker } from '../../modules/ingestion/chunker/structure.chunker';
import { getEmbeddingProvider } from '../../providers/embedding';
import { DocumentService } from '../../modules/document/document.service';
import { logger } from '../../utils/logger';
import { validateConfig } from '../../config';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let dlqQueue: Queue | null = null;
try {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null, enableOfflineQueue: false });
  connection.on('error', () => {});
  dlqQueue = new Queue('ingestion-dlq', { connection });
  dlqQueue.on('error', () => {});
} catch (e) {
  dlqQueue = null;
}

export function isPermanentError(error: any): boolean {
  const msg = (error?.message || '').toLowerCase();
  return (
    msg.includes('unsupported document') ||
    msg.includes('corrupted payload') ||
    msg.includes('file not found') ||
    msg.includes('validation_error')
  );
}

export async function processIngestionJob(jobOrData: any): Promise<{ chunkCount: number }> {
  const data = jobOrData.data || jobOrData;
  const { jobId = `job_${Date.now()}`, documentId, documentVersionId, organizationId } = data;

  logger.info({ jobId, documentId, documentVersionId, organizationId }, 'Processing ingestion job');

  // Commit PROCESSING immediately so clients polling the status can see it; the work below
  // runs in its own transaction (rolled back as a whole on failure).
  await DocumentService.updateVersionStatus(organizationId, documentVersionId, 'PROCESSING').catch(() => {});

  return withTenantContext(organizationId, async (client) => {
    // 1. Fetch Version Details
    const versionRes = await client.query(
      `SELECT dv.id, dv.document_id, dv.file_key, dv.file_type, dv.status
       FROM document_versions dv
       WHERE dv.id = $1 AND dv.organization_id = $2`,
      [documentVersionId, organizationId]
    );

    if (versionRes.rows.length === 0) {
      throw new Error(`Document version '${documentVersionId}' not found or access denied`);
    }

    const version = versionRes.rows[0];

    // Update status to PROCESSING
    await client.query(`UPDATE document_versions SET status = 'PROCESSING', error_message = NULL WHERE id = $1`, [version.id]);

    // 2. Fetch File Content from Storage Provider
    const storage = getStorageProvider();
    const fileBuffer = await storage.getFile(version.file_key);

    // 3. Parse Document Content
    // file_type holds the uploaded MIME type; the real extension lives on the storage key (".../v1.pdf").
    const ext = (path.extname(version.file_key || '') || '.txt').toLowerCase();
    const mimeType = (version.file_type || 'application/octet-stream').toLowerCase();

    const parser = getParserForFile(mimeType, ext);
    const parsedDoc = await parser.parse(fileBuffer, version.file_key);

    // 4. Chunk Document Content
    const chunker = new StructureAwareChunker();
    const chunks = chunker.chunk(parsedDoc);

    // 5. Generate Vector Embeddings & Persist Idempotently
    const embeddingProvider = getEmbeddingProvider();
    let insertedCount = 0;

    // Delete pre-existing chunks for this version to ensure strict idempotency on re-runs
    await client.query(`DELETE FROM document_chunks WHERE document_version_id = $1 AND organization_id = $2`, [version.id, organizationId]);

    // Embed in small batches: much faster than one call per chunk with a local model.
    const EMBED_BATCH_SIZE = 16;
    const embeddings: number[][] = [];
    for (let start = 0; start < chunks.length; start += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(start, start + EMBED_BATCH_SIZE).map((c) => c.content);
      embeddings.push(...(await embeddingProvider.embedBatch(batch)));
    }

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const vectorStr = `[${embeddings[i].join(',')}]`;
      const tokenCount = Math.ceil(c.content.length / 4);

      await client.query(
        `INSERT INTO document_chunks (
           organization_id, knowledge_base_id, document_id, document_version_id,
           chunk_index, content, embedding, token_count, metadata
         )
         SELECT $1, d.knowledge_base_id, $2, $3, $4, $5, $6, $7, $8::jsonb
         FROM documents d WHERE d.id = $2`,
        [
          organizationId,
          documentId,
          version.id,
          i,
          c.content,
          vectorStr,
          tokenCount,
          JSON.stringify(c.metadata || {}),
        ]
      );
      insertedCount++;
    }

    // 6. Update Document Version Status to READY
    await client.query(
      `UPDATE document_versions SET status = 'READY', chunk_count = $1, error_message = NULL WHERE id = $2`,
      [insertedCount, version.id]
    );

    // Record Audit Event
    await client.query(
      `INSERT INTO audit_logs (organization_id, action, resource_type, resource_id)
       VALUES ($1, 'DOCUMENT_INDEXED', 'document', $2)`,
      [organizationId, documentId]
    );

    logger.info({ jobId, documentId, chunkCount: insertedCount }, 'Successfully completed ingestion job processing');
    return { chunkCount: insertedCount };
  });
}

export function createIngestionWorker(): Worker | null {
  try {
    const connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      connectTimeout: 1000,
    });

    connection.on('error', () => {
      /* connection problems are logged by the queue module */
    });

    // Must match the queue name the API publishes to (see queue.ts).
    const worker = new Worker(
      INGESTION_QUEUE_NAME,
      async (job: Job) => {
        try {
          return await processIngestionJob(job);
        } catch (error: any) {
          logger.error({ jobId: job.id, error: error.message }, 'Worker job processing failed');

          if (isPermanentError(error)) {
            logger.warn({ jobId: job.id, error: error.message }, 'Routing permanent failure to DLQ');
            await DocumentService.updateVersionStatus(job.data.organizationId, job.data.documentVersionId, 'FAILED', error.message);
            if (dlqQueue) {
              await dlqQueue.add('dead-letter-job', {
                originalJobData: job.data,
                failedAt: new Date().toISOString(),
                error: error.message,
                reason: 'PERMANENT_FAILURE',
              });
            }
            throw new Error(`PERMANENT_FAILURE: ${error.message}`);
          }

          throw error;
        }
      },
      {
        connection,
        concurrency: 5,
        limiter: {
          max: 50,
          duration: 1000,
        },
      }
    );

    worker.on('failed', async (job, err) => {
      if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        logger.error({ jobId: job.id, attempts: job.attemptsMade, error: err.message }, 'Job exhausted max retries; sending to DLQ');
        // Surface the failure in the UI instead of leaving the document stuck in QUEUED.
        await DocumentService.updateVersionStatus(job.data.organizationId, job.data.documentVersionId, 'FAILED', err.message).catch(() => {});
        if (dlqQueue) {
          await dlqQueue.add('dead-letter-job', {
            originalJobData: job.data,
            failedAt: new Date().toISOString(),
            error: err.message,
            reason: 'MAX_RETRIES_EXCEEDED',
          });
        }
      }
    });

    return worker;
  } catch (error) {
    logger.warn('Redis offline; worker initialization skipped');
    return null;
  }
}

// Standalone worker process (Dockerfile.worker / `npm run start:worker`).
if (require.main === module) {
  validateConfig();
  logger.info('Starting standalone Ingestion Worker process');
  const worker = createIngestionWorker();
  // Finish the in-flight job before exiting; BullMQ re-queues anything interrupted.
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Worker received shutdown signal. Gracefully stopping...');
    await worker?.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
