import { Retriever, RetrievalParams, CandidateChunk } from './retrieval.interface';
import { withTenantContext } from '../../../db';

// Common words that would otherwise match almost every chunk.
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had', 'her', 'was', 'one', 'our',
  'out', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'see', 'who', 'did', 'does', 'what', 'when',
  'where', 'which', 'why', 'with', 'this', 'that', 'there', 'their', 'them', 'they', 'from', 'have', 'into',
  'about', 'would', 'could', 'should', 'will', 'your', 'yours', 'been', 'were', 'than', 'then', 'also',
  'tell', 'give', 'explain', 'please', 'some', 'more', 'most', 'such', 'only', 'very', 'just', 'like',
]);

export class KeywordRetriever implements Retriever {
  name = 'KeywordRetriever';

  async retrieve(params: RetrievalParams): Promise<CandidateChunk[]> {
    const { organizationId, knowledgeBaseId, query, topK = 5 } = params;

    const keywords = Array.from(
      new Set(
        query
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      )
    );

    if (keywords.length === 0) return [];

    // Rank by how many distinct keywords each chunk contains, not just "contains any".
    const likeConditions = keywords.map((_, idx) => `content ILIKE $${idx + 3}`);
    const matchCount = likeConditions.map((c) => `(CASE WHEN ${c} THEN 1 ELSE 0 END)`).join(' + ');
    const limitParamIdx = keywords.length + 3;

    return withTenantContext(organizationId, async (client) => {
      const sql = `
        SELECT id, document_id, document_version_id, content, metadata, (${matchCount}) AS matches
        FROM document_chunks
        WHERE organization_id = $1 AND knowledge_base_id = $2 AND (${likeConditions.join(' OR ')})
        ORDER BY matches DESC
        LIMIT $${limitParamIdx};
      `;

      const paramsArr = [organizationId, knowledgeBaseId, ...keywords.map((k) => `%${k}%`), topK];
      const res = await client.query(sql, paramsArr);

      return res.rows.map((row) => ({
        chunkId: row.id,
        documentId: row.document_id,
        documentVersionId: row.document_version_id,
        content: row.content,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
        // Fraction of query keywords present in the chunk.
        score: parseFloat((Number(row.matches) / keywords.length).toFixed(4)),
      }));
    });
  }
}
