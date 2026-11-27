import { withTenantContext } from '../../db';
import { config } from '../../config';
import { notFound } from '../../middleware/error_handler';
import { getStorageProvider } from '../../providers/storage';
import { logger } from '../../utils/logger';

export class KnowledgeBaseService {
  static async createKnowledgeBase(
    organizationId: string,
    name: string,
    description?: string,
    chunkSize = 1000,
    chunkOverlap = 150
  ) {
    return withTenantContext(organizationId, async (client) => {
      const res = await client.query(
        `INSERT INTO knowledge_bases (organization_id, name, description, chunk_size, chunk_overlap, embedding_model)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, description, chunk_size, chunk_overlap, created_at`,
        [organizationId, name, description, chunkSize, chunkOverlap, config.embeddingModel]
      );

      await client.query(
        `INSERT INTO audit_logs (organization_id, action, resource_type, resource_id, details)
         VALUES ($1, 'KNOWLEDGE_BASE_CREATED', 'knowledge_base', $2, $3)`,
        [organizationId, res.rows[0].id, JSON.stringify({ name })]
      );

      return res.rows[0];
    });
  }

  static async listKnowledgeBases(organizationId: string) {
    return withTenantContext(organizationId, async (client) => {
      const res = await client.query(
        `SELECT kb.id, kb.name, kb.description, kb.chunk_size, kb.chunk_overlap, kb.created_at, kb.updated_at,
                COUNT(d.id)::int as document_count
         FROM knowledge_bases kb
         LEFT JOIN documents d ON d.knowledge_base_id = kb.id
         WHERE kb.organization_id = $1
         GROUP BY kb.id
         ORDER BY kb.created_at DESC`,
        [organizationId]
      );
      return res.rows;
    });
  }

  static async getKnowledgeBase(organizationId: string, knowledgeBaseId: string) {
    return withTenantContext(organizationId, async (client) => {
      const res = await client.query(
        `SELECT id, name, description, chunk_size, chunk_overlap, embedding_model, created_at, updated_at
         FROM knowledge_bases
         WHERE id = $1 AND organization_id = $2`,
        [knowledgeBaseId, organizationId]
      );

      if (res.rows.length === 0) {
        throw notFound('Knowledge base not found', 'KB_NOT_FOUND');
      }

      return res.rows[0];
    });
  }

  static async deleteKnowledgeBase(organizationId: string, knowledgeBaseId: string) {
    const fileKeys: string[] = [];
    const result = await withTenantContext(organizationId, async (client) => {
      // Collect stored files first: documents, versions and chunks cascade-delete with the KB.
      const files = await client.query(
        `SELECT dv.file_key FROM document_versions dv
           JOIN documents d ON d.id = dv.document_id
          WHERE d.knowledge_base_id = $1 AND d.organization_id = $2`,
        [knowledgeBaseId, organizationId]
      );
      fileKeys.push(...files.rows.map((r: any) => r.file_key));

      const res = await client.query(
        `DELETE FROM knowledge_bases WHERE id = $1 AND organization_id = $2 RETURNING id`,
        [knowledgeBaseId, organizationId]
      );

      if (res.rows.length === 0) {
        throw notFound('Knowledge base not found', 'KB_NOT_FOUND');
      }

      await client.query(
        `INSERT INTO audit_logs (organization_id, action, resource_type, resource_id)
         VALUES ($1, 'KNOWLEDGE_BASE_DELETED', 'knowledge_base', $2)`,
        [organizationId, knowledgeBaseId]
      );

      return { success: true, deletedDocuments: fileKeys.length };
    });

    // Remove stored files only after the database transaction committed.
    const storage = getStorageProvider();
    for (const key of fileKeys) {
      await storage.deleteFile(key).catch(() => logger.warn({ key }, 'Stored file already missing during KB deletion'));
    }
    return result;
  }
}
