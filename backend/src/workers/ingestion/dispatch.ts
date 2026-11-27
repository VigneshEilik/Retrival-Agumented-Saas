import { ingestionQueue, IngestionJobPayload } from './queue';
import { processIngestionJob } from './processor';
import { pool, withTenantContext } from '../../db';
import { DocumentService } from '../../modules/document/document.service';
import { config } from '../../config';
import { logger } from '../../utils/logger';

const ENQUEUE_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Redis enqueue timed out')), ms)),
  ]);
}

/**
 * Hands a document version to the ingestion pipeline.
 *
 * Must be called AFTER the upload transaction commits, otherwise a fast worker
 * could pick the job up before the document rows are visible.
 *
 * - Redis reachable: job goes on the BullMQ queue (processed by the worker).
 * - Redis down: the job is processed in this process in the background, so
 *   uploads never get stuck in QUEUED during local development.
 */
export async function dispatchIngestionJob(payload: IngestionJobPayload): Promise<string | null> {
  try {
    const job = await withTimeout(ingestionQueue.add('process-document', payload), ENQUEUE_TIMEOUT_MS);

    await withTenantContext(payload.organizationId, (client) =>
      client.query(
        `INSERT INTO ingestion_jobs (organization_id, document_version_id, job_id, status)
         VALUES ($1, $2, $3, 'QUEUED')
         ON CONFLICT (job_id) DO UPDATE SET status = 'QUEUED'`,
        [payload.organizationId, payload.documentVersionId, job.id]
      )
    ).catch((err) => logger.warn({ err: err.message }, 'Could not record ingestion job row'));

    return job.id ?? null;
  } catch (error: any) {
    // In tests, ingestion is driven explicitly by calling processIngestionJob.
    if (config.nodeEnv === 'test') return null;

    logger.warn({ error: error.message, documentId: payload.documentId }, 'Queue unavailable; processing document in-process');
    setImmediate(() => {
      processIngestionJob(payload).catch(async (err: any) => {
        logger.error({ err: err.message, documentId: payload.documentId }, 'In-process ingestion failed');
        await DocumentService.updateVersionStatus(payload.organizationId, payload.documentVersionId, 'FAILED', err.message).catch(() => {});
      });
    });
    return null;
  }
}

/**
 * Re-dispatches document versions stuck in QUEUED/PROCESSING for longer than
 * `olderThanSeconds` (e.g. the process restarted mid-ingestion). Processing is
 * idempotent (chunks for a version are replaced), so re-running is safe.
 */
export async function recoverStalledIngestions(olderThanSeconds = 900): Promise<number> {
  const res = await pool.query(
    'SELECT organization_id, knowledge_base_id, document_id, document_version_id FROM list_stalled_ingestions($1, 100)',
    [olderThanSeconds]
  );
  for (const row of res.rows) {
    await dispatchIngestionJob({
      organizationId: row.organization_id,
      knowledgeBaseId: row.knowledge_base_id,
      documentId: row.document_id,
      documentVersionId: row.document_version_id,
    });
  }
  if (res.rows.length > 0) logger.info({ count: res.rows.length }, 'Re-dispatched stalled ingestion jobs');
  return res.rows.length;
}
