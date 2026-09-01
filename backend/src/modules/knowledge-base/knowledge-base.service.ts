import { withTenantContext } from '../../db';

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
        `INSERT INTO knowledge_bases (organization_id, name, description, chunk_size, chunk_overlap)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, description, chunk_size, chunk_overlap, created_at`,
        [organizationId, name, description, chunkSize, chunkOverlap]
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
        throw new Error('Knowledge Base not found');
      }

      return res.rows[0];
    });
  }

  static async deleteKnowledgeBase(organizationId: string, knowledgeBaseId: string) {
    return withTenantContext(organizationId, async (client) => {
      const res = await client.query(
        `DELETE FROM knowledge_bases WHERE id = $1 AND organization_id = $2 RETURNING id`,
        [knowledgeBaseId, organizationId]
      );

      if (res.rows.length === 0) {
        throw new Error('Knowledge Base not found');
      }

      await client.query(
        `INSERT INTO audit_logs (organization_id, action, resource_type, resource_id)
         VALUES ($1, 'KNOWLEDGE_BASE_DELETED', 'knowledge_base', $2)`,
        [organizationId, knowledgeBaseId]
      );

      return { success: true };
    });
  }
}
