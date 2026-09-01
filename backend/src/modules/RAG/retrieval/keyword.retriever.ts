import { Retriever, RetrievalParams, CandidateChunk } from './retrieval.interface';
import { withTenantContext } from '../../../db';

export class KeywordRetriever implements Retriever {
  name = 'KeywordRetriever';

  async retrieve(params: RetrievalParams): Promise<CandidateChunk[]> {
    const { organizationId, knowledgeBaseId, query, topK = 5 } = params;

    const keywords = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (keywords.length === 0) return [];

    const likeConditions = keywords.map((_, idx) => `content ILIKE $${idx + 3}`).join(' OR ');
    const limitParamIdx = keywords.length + 3;

    return withTenantContext(organizationId, async (client) => {
      const sql = `
        SELECT id, document_id, document_version_id, content, metadata
        FROM document_chunks
        WHERE organization_id = $1 AND knowledge_base_id = $2 AND (${likeConditions})
        LIMIT $${limitParamIdx};
      `;

      const paramsArr = [organizationId, knowledgeBaseId, ...keywords.map((k) => `%${k}%`), topK];
      const res = await client.query(sql, paramsArr);

      return res.rows.map((row, idx) => ({
        chunkId: row.id,
        documentId: row.document_id,
        documentVersionId: row.document_version_id,
        content: row.content,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
        score: 0.8 - idx * 0.05,
      }));
    });
  }
}
