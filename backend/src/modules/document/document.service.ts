import path from 'path';
import crypto from 'crypto';
import { withTenantContext } from '../../db';
import { config } from '../../config';
import { getStorageProvider } from '../../providers/storage';
import { dispatchIngestionJob } from '../../workers/ingestion/dispatch';
import { logger } from '../../utils/logger';
import { AppError, badRequest, conflict, notFound } from '../../middleware/error_handler';

const MAX_FILE_SIZE_BYTES = config.maxUploadMb * 1024 * 1024;
// Only formats we have a parser for (.doc / legacy Word is intentionally NOT accepted).
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.markdown', '.html', '.htm'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'text/html',
  'application/xhtml+xml',
  'application/octet-stream', // browsers often send this for .md files
  '',
];

/**
 * Checks the file's actual bytes against its extension, so a renamed binary
 * (e.g. an .exe uploaded as .pdf) is rejected before it reaches a parser.
 */
function contentMatchesExtension(buffer: Buffer, ext: string): boolean {
  if (ext === '.pdf') return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
  if (ext === '.docx') return buffer[0] === 0x50 && buffer[1] === 0x4b; // ZIP container ("PK")
  // Text formats: reject binary content (NUL bytes in the first 8 KB).
  return !buffer.subarray(0, 8192).includes(0);
}

export class DocumentService {
  static async uploadDocument(
    organizationId: string,
    knowledgeBaseId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    customTitle?: string
  ) {
    // 1. Security & File Validation
    if (!file || !file.buffer || file.size === 0) {
      throw badRequest('A non-empty document file is required', 'NO_FILE');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new AppError(`File exceeds the ${config.maxUploadMb} MB limit`, 413, 'FILE_TOO_LARGE');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new AppError(
        `File type '${ext || 'unknown'}' is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
        415,
        'UNSUPPORTED_FILE_TYPE'
      );
    }
    if (!ALLOWED_MIME_TYPES.includes((file.mimetype || '').toLowerCase())) {
      throw new AppError(`MIME type '${file.mimetype}' is not supported`, 415, 'UNSUPPORTED_FILE_TYPE');
    }
    if (!contentMatchesExtension(file.buffer, ext)) {
      throw new AppError(`File content does not match the '${ext}' format`, 415, 'FILE_CONTENT_MISMATCH');
    }

    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
    let storedKey: string | null = null;

    const result = await withTenantContext(organizationId, async (client) => {
      // 2. Verify Knowledge Base Ownership (RLS also guarantees this)
      const kbRes = await client.query(
        `SELECT id, name FROM knowledge_bases WHERE id = $1 AND organization_id = $2`,
        [knowledgeBaseId, organizationId]
      );
      if (kbRes.rows.length === 0) {
        throw notFound('Knowledge base not found', 'KB_NOT_FOUND');
      }

      // 2b. Duplicate detection: identical bytes already in this knowledge base
      const dupRes = await client.query(
        `SELECT d.id, d.title FROM document_versions dv
           JOIN documents d ON d.id = dv.document_id
          WHERE dv.organization_id = $1 AND d.knowledge_base_id = $2 AND dv.checksum = $3
          LIMIT 1`,
        [organizationId, knowledgeBaseId, checksum]
      );
      if (dupRes.rows.length > 0) {
        throw conflict(`This file was already uploaded as "${dupRes.rows[0].title}"`, 'DUPLICATE_DOCUMENT', {
          documentId: dupRes.rows[0].id,
        });
      }

      // 3. Create Document Record
      const title = (customTitle || path.basename(file.originalname, ext)).slice(0, 255);
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
      storedKey = storageKey;

      // 5. Create Document Version Record
      const versionRes = await client.query(
        `INSERT INTO document_versions
          (organization_id, document_id, version, file_key, file_type, file_size_bytes, status, metadata, checksum)
         VALUES ($1, $2, 1, $3, $4, $5, 'QUEUED', $6, $7)
         RETURNING id, version, file_key, status, created_at`,
        [
          organizationId,
          document.id,
          storageKey,
          file.mimetype || 'application/octet-stream',
          storageResult.sizeBytes,
          JSON.stringify({ checksum, originalName: file.originalname }),
          checksum,
        ]
      );
      const documentVersion = versionRes.rows[0];

      await client.query(
        `INSERT INTO audit_logs (organization_id, action, resource_type, resource_id, details)
         VALUES ($1, 'DOCUMENT_UPLOADED', 'document', $2, $3)`,
        [organizationId, document.id, JSON.stringify({ filename: file.originalname, size: storageResult.sizeBytes })]
      );

      return {
        document,
        version: documentVersion,
        jobId: null as string | null,
      };
    }).catch(async (error) => {
      // The transaction rolled back: don't leave an orphaned file in storage.
      if (storedKey) await getStorageProvider().deleteFile(storedKey).catch(() => {});
      throw error;
    });

    // 6. Hand off to the ingestion pipeline only after the transaction has committed.
    result.jobId = await dispatchIngestionJob({
      documentId: result.document.id,
      documentVersionId: result.version.id,
      organizationId,
      knowledgeBaseId,
    });

    return result;
  }

  static async listDocuments(organizationId: string, knowledgeBaseId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    return withTenantContext(organizationId, async (client) => {
      const kb = await client.query(`SELECT 1 FROM knowledge_bases WHERE id = $1 AND organization_id = $2`, [knowledgeBaseId, organizationId]);
      if (kb.rows.length === 0) throw notFound('Knowledge base not found', 'KB_NOT_FOUND');

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
        throw notFound('Document not found', 'DOC_NOT_FOUND');
      }

      return docRes.rows[0];
    });
  }

  static async retryIngestion(organizationId: string, documentId: string) {
    const doc = await withTenantContext(organizationId, async (client) => {
      const docRes = await client.query(
        `SELECT d.id, d.knowledge_base_id, dv.id as version_id, dv.status
         FROM documents d
         JOIN document_versions dv ON dv.document_id = d.id AND dv.version = d.current_version
         WHERE d.id = $1 AND d.organization_id = $2`,
        [documentId, organizationId]
      );

      if (docRes.rows.length === 0) {
        throw notFound('Document not found', 'DOC_NOT_FOUND');
      }

      const doc = docRes.rows[0];
      // Only failed (or stuck queued) documents can be retried; avoids double-processing.
      if (!['FAILED', 'QUEUED'].includes(doc.status)) {
        throw conflict(`Document is ${doc.status}; only FAILED (or stuck QUEUED) documents can be retried`, 'RETRY_NOT_ALLOWED');
      }

      // Update version status to QUEUED
      await client.query(`UPDATE document_versions SET status = 'QUEUED', error_message = NULL WHERE id = $1`, [doc.version_id]);
      return doc;
    });

    const jobId = await dispatchIngestionJob({
      documentId: doc.id,
      documentVersionId: doc.version_id,
      organizationId,
      knowledgeBaseId: doc.knowledge_base_id,
    });

    return { success: true, jobId };
  }

  static async deleteDocument(organizationId: string, documentId: string) {
    const fileKeys: string[] = [];
    const result = await withTenantContext(organizationId, async (client) => {
      const docRes = await client.query(
        `SELECT dv.file_key FROM document_versions dv WHERE dv.document_id = $1 AND dv.organization_id = $2`,
        [documentId, organizationId]
      );

      if (docRes.rows.length === 0) {
        throw notFound('Document not found', 'DOC_NOT_FOUND');
      }
      fileKeys.push(...docRes.rows.map((r: any) => r.file_key));

      // Delete database record (cascades to versions, jobs and chunks, so the content is immediately unretrievable)
      await client.query(`DELETE FROM documents WHERE id = $1 AND organization_id = $2`, [documentId, organizationId]);

      await client.query(
        `INSERT INTO audit_logs (organization_id, action, resource_type, resource_id)
         VALUES ($1, 'DOCUMENT_DELETED', 'document', $2)`,
        [organizationId, documentId]
      );

      return { success: true };
    });

    // Remove stored files only after the database delete committed.
    const storage = getStorageProvider();
    for (const key of fileKeys) {
      await storage.deleteFile(key).catch(() => logger.warn({ key }, 'Stored file already missing during document deletion'));
    }
    return result;
  }

  /** Updates the status of one document version. Runs under tenant context so RLS applies. */
  static async updateVersionStatus(organizationId: string, documentVersionId: string, status: string, errorMessage?: string) {
    await withTenantContext(organizationId, (client) =>
      client.query(
        `UPDATE document_versions SET status = $2, error_message = $3 WHERE id = $1 AND organization_id = $4`,
        [documentVersionId, status, errorMessage ? errorMessage.slice(0, 2000) : null, organizationId]
      )
    );
  }
}
