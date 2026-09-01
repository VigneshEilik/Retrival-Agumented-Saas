import path from 'path';
import crypto from 'crypto';
import { pool, withTenantContext } from '../../db';
import { getStorageProvider } from '../../providers/storage';
import { ingestionQueue } from '../../workers/ingestion/queue';
import { logger } from '../../utils/logger';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.md', '.markdown', '.html', '.htm'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'text/html',
  'application/xhtml+xml',
];

export class DocumentService {
  static async uploadDocument(
    organizationId: string,
    knowledgeBaseId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    customTitle?: string
  ) {
    // 1. Security & File Validation
    if (!file || !file.buffer) {
      throw new Error('No document file uploaded');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size exceeds maximum threshold of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`);
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error(`File extension '${ext}' is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase()) && file.mimetype !== 'application/octet-stream') {
      throw new Error(`MIME type '${file.mimetype}' is not supported.`);
    }

    return withTenantContext(organizationId, async (client) => {
      // 2. Verify Knowledge Base Ownership
      const kbRes = await client.query(
        `SELECT id, name FROM knowledge_bases WHERE id = $1 AND organization_id = $2`,
        [knowledgeBaseId, organizationId]
      );
      if (kbRes.rows.length === 0) {
        throw new Error('Knowledge Base not found or access denied');
      }

      // 3. Create Document Record
      const title = customTitle || path.basename(file.originalname, ext);
      const docRes = await client.query(
        `INSERT INTO documents (organization_id, knowledge_base_id, title, current_version)
         VALUES ($1, $2, $3, 1)
         RETURNING id, title, current_version, created_at`,
        [organizationId, knowledgeBaseId, title]
      );
      const document = docRes.rows[0];

      // 4. Generate Storage Key & Store Original File
      const storageKey = `org/${organizationId}/documents/${document.id}/v1${ext}`;
      const storage = getStorageProvider();
      const storageResult = await storage.uploadFile(storageKey, file.buffer, file.mimetype);

      // 5. Create Document Version Record
      const versionRes = await client.query(
        `INSERT INTO document_versions 
          (organization_id, document_id, version, file_key, file_type, file_size_bytes, status, metadata)
         VALUES ($1, $2, 1, $3, $4, $5, 'QUEUED', $6)
         RETURNING id, version, file_key, status, created_at`,
        [
          organizationId,
          document.id,
          storageKey,
          file.mimetype,
          storageResult.sizeBytes,
          JSON.stringify({ checksum: storageResult.checksum, originalName: file.originalname }),
        ]
      );
      const documentVersion = versionRes.rows[0];

      // 6. Queue Background Ingestion Job
      let job: any = null;
      try {
        job = await ingestionQueue.add('process-document', {
          documentId: document.id,
          documentVersionId: documentVersion.id,
          organizationId,
          knowledgeBaseId,
        });

        await client.query(
          `INSERT INTO ingestion_jobs (organization_id, document_version_id, job_id, status)
           VALUES ($1, $2, $3, 'QUEUED')
           ON CONFLICT (job_id) DO UPDATE SET status = 'QUEUED'`,
          [organizationId, documentVersion.id, job.id]
        );
      } catch (e) {
        logger.warn('Redis queue offline or unavailable during upload; job recorded as QUEUED in database');
      }

      await client.query(
        `INSERT INTO audit_logs (organization_id, action, resource_type, resource_id, details)
         VALUES ($1, 'DOCUMENT_UPLOADED', 'document', $2, $3)`,
        [organizationId, document.id, JSON.stringify({ filename: file.originalname, size: storageResult.sizeBytes })]
      );

      return {
        document,
        version: documentVersion,
        jobId: job ? job.id : null,
      };
    });
  }

  static async listDocuments(organizationId: string, knowledgeBaseId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    return withTenantContext(organizationId, async (client) => {
      const docsRes = await client.query(
        `SELECT d.id, d.title, d.current_version, d.created_at, d.updated_at,
                dv.id as version_id, dv.file_type, dv.file_size_bytes, dv.status, dv.error_message, dv.chunk_count
         FROM documents d
         JOIN document_versions dv ON dv.document_id = d.id AND dv.version = d.current_version
         WHERE d.organization_id = $1 AND d.knowledge_base_id = $2
         ORDER BY d.created_at DESC
         LIMIT $3 OFFSET $4`,
        [organizationId, knowledgeBaseId, limit, offset]
      );

      const countRes = await client.query(
        `SELECT COUNT(*) as total FROM documents WHERE organization_id = $1 AND knowledge_base_id = $2`,
        [organizationId, knowledgeBaseId]
      );

      return {
        documents: docsRes.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countRes.rows[0].total, 10),
        },
      };
    });
  }

  static async getDocument(organizationId: string, documentId: string) {
    return withTenantContext(organizationId, async (client) => {
      const docRes = await client.query(
        `SELECT d.id, d.knowledge_base_id, d.title, d.current_version, d.created_at, d.updated_at,
                dv.id as version_id, dv.file_key, dv.file_type, dv.file_size_bytes, dv.status, dv.error_message, dv.chunk_count, dv.metadata
         FROM documents d
         JOIN document_versions dv ON dv.document_id = d.id AND dv.version = d.current_version
         WHERE d.id = $1 AND d.organization_id = $2`,
        [documentId, organizationId]
      );

      if (docRes.rows.length === 0) {
        throw new Error('Document not found or access denied');
      }

      return docRes.rows[0];
    });
  }

  static async retryIngestion(organizationId: string, documentId: string) {
    return withTenantContext(organizationId, async (client) => {
      const docRes = await client.query(
        `SELECT d.id, d.knowledge_base_id, dv.id as version_id, dv.status
         FROM documents d
         JOIN document_versions dv ON dv.document_id = d.id AND dv.version = d.current_version
         WHERE d.id = $1 AND d.organization_id = $2`,
        [documentId, organizationId]
      );

      if (docRes.rows.length === 0) {
        throw new Error('Document not found');
      }

      const doc = docRes.rows[0];

      // Update version status to QUEUED
      await client.query(`UPDATE document_versions SET status = 'QUEUED', error_message = NULL WHERE id = $1`, [doc.version_id]);

      const job = await ingestionQueue.add('process-document', {
        documentId: doc.id,
        documentVersionId: doc.version_id,
        organizationId,
        knowledgeBaseId: doc.knowledge_base_id,
      });

      await client.query(
        `INSERT INTO ingestion_jobs (organization_id, document_version_id, job_id, status)
         VALUES ($1, $2, $3, 'QUEUED')
         ON CONFLICT (job_id) DO UPDATE SET status = 'QUEUED'`,
        [organizationId, doc.version_id, job.id]
      );

      return { success: true, jobId: job.id };
    });
  }

  static async deleteDocument(organizationId: string, documentId: string) {
    return withTenantContext(organizationId, async (client) => {
      const docRes = await client.query(
        `SELECT dv.file_key FROM document_versions dv WHERE dv.document_id = $1 AND dv.organization_id = $2`,
        [documentId, organizationId]
      );

      if (docRes.rows.length === 0) {
        throw new Error('Document not found');
      }

      // Delete storage files
      const storage = getStorageProvider();
      for (const row of docRes.rows) {
        try {
          await storage.deleteFile(row.file_key);
        } catch (e) {
          logger.warn({ key: row.file_key }, 'Storage file delete failed or file missing');
        }
      }

      // Delete database record (Cascades to versions, jobs, chunks)
      await client.query(`DELETE FROM documents WHERE id = $1 AND organization_id = $2`, [documentId, organizationId]);

      await client.query(
        `INSERT INTO audit_logs (organization_id, action, resource_type, resource_id)
         VALUES ($1, 'DOCUMENT_DELETED', 'document', $2)`,
        [organizationId, documentId]
      );

      return { success: true };
    });
  }

  static async updateVersionStatus(documentId: string, status: string, errorMessage?: string) {
    await pool.query(
      `UPDATE document_versions SET status = $2, error_message = $3 WHERE document_id = $1`,
      [documentId, status, errorMessage || null]
    );
  }
}
