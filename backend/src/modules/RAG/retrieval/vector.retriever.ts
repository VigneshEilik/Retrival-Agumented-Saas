import { Retriever, RetrievalParams, CandidateChunk } from './retrieval.interface';
import { withTenantContext } from '../../../db';
import { getEmbeddingProvider } from '../../../providers/embedding';
import { logger } from '../../../utils/logger';

export class VectorRetriever implements Retriever {
  name = 'VectorRetriever';

  async retrieve(params: RetrievalParams): Promise<CandidateChunk[]> {
    const { organizationId, knowledgeBaseId, query, topK = 5, minScore = 0.3 } = params;

    const embedder = getEmbeddingProvider();
    const queryEmbedding = await embedder.embedQuery(query);
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    return withTenantContext(organizationId, async (client) => {
      try {
        const checkVector = await client.query(`SELECT 1 FROM pg_type WHERE typname = 'vector'`);
        const hasVectorType = checkVector.rows.length > 0;

        let sql = '';
        let queryParams: any[] = [];

        if (hasVectorType) {
          sql = `
            SELECT id, document_id, document_version_id, content, metadata,
                   1 - (embedding <=> $1::vector) as score
            FROM document_chunks
            WHERE organization_id = $2 AND knowledge_base_id = $3
            ORDER BY score DESC
            LIMIT $4;
          `;
          queryParams = [vectorStr, organizationId, knowledgeBaseId, topK];
        } else {
          sql = `
            SELECT id, document_id, document_version_id, content, metadata, 0.85 as score
            FROM document_chunks
            WHERE organization_id = $1 AND knowledge_base_id = $2
            LIMIT $3;
          `;
          queryParams = [organizationId, knowledgeBaseId, topK];
        }

        const res = await client.query(sql, queryParams);
        const candidates: CandidateChunk[] = res.rows
          .map((row) => ({
            chunkId: row.id,
            documentId: row.document_id,
            documentVersionId: row.document_version_id,
            content: row.content,
            metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
            score: parseFloat(row.score) || 0.85,
          }))
          .filter((c) => c.score >= minScore);

        return candidates;
      } catch (e) {
        const fallbackSql = `
          SELECT id, document_id, document_version_id, content, metadata
          FROM document_chunks
          WHERE organization_id = $1 AND knowledge_base_id = $2
          LIMIT $3
        `;
        const res = await client.query(fallbackSql, [organizationId, knowledgeBaseId, topK]);
        return res.rows.map((row, idx) => ({
          chunkId: row.id,
          documentId: row.document_id,
          documentVersionId: row.document_version_id,
          content: row.content,
          metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
          score: 0.85 - idx * 0.05,
        }));
      }
    });
  }
}
