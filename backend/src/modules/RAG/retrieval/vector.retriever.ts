import { PoolClient } from 'pg';
import { Retriever, RetrievalParams, CandidateChunk } from './retrieval.interface';
import { withTenantContext } from '../../../db';
import { getEmbeddingProvider } from '../../../providers/embedding';

// Cached per process: is document_chunks.embedding a pgvector column, or the text fallback?
let embeddingColumnIsVector: boolean | null = null;

async function detectVectorColumn(client: PoolClient): Promise<boolean> {
  if (embeddingColumnIsVector === null) {
    const res = await client.query(
      `SELECT udt_name FROM information_schema.columns
       WHERE table_name = 'document_chunks' AND column_name = 'embedding'
       LIMIT 1`
    );
    embeddingColumnIsVector = res.rows[0]?.udt_name === 'vector';
  }
  return embeddingColumnIsVector;
}

function parseStoredEmbedding(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw as number[];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function toCandidate(row: any, score: number): CandidateChunk {
  return {
    chunkId: row.id,
    documentId: row.document_id,
    documentVersionId: row.document_version_id,
    content: row.content,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
    score,
  };
}

export class VectorRetriever implements Retriever {
  name = 'VectorRetriever';

  async retrieve(params: RetrievalParams): Promise<CandidateChunk[]> {
    const { organizationId, knowledgeBaseId, query, topK = 5, minScore = 0.2 } = params;

    const embedder = getEmbeddingProvider();
    const queryEmbedding = await embedder.embedQuery(query);

    return withTenantContext(organizationId, async (client) => {
      if (await detectVectorColumn(client)) {
        // pgvector available: let Postgres do nearest-neighbour search.
        const res = await client.query(
          `SELECT id, document_id, document_version_id, content, metadata,
                  1 - (embedding <=> $1::vector) AS score
           FROM document_chunks
           WHERE organization_id = $2 AND knowledge_base_id = $3 AND embedding IS NOT NULL
           -- Order by the distance operator itself so the HNSW index (migration 003) can be used.
           ORDER BY embedding <=> $1::vector
           LIMIT $4`,
          [`[${queryEmbedding.join(',')}]`, organizationId, knowledgeBaseId, topK]
        );
        return res.rows
          .map((row) => toCandidate(row, parseFloat(row.score)))
          .filter((c) => c.score >= minScore);
      }

      // No pgvector: embeddings are stored as JSON text, so score them here with exact cosine similarity.
      // Fine for small/medium knowledge bases; install pgvector for large ones.
      const res = await client.query(
        `SELECT id, document_id, document_version_id, content, metadata, embedding
         FROM document_chunks
         WHERE organization_id = $1 AND knowledge_base_id = $2 AND embedding IS NOT NULL`,
        [organizationId, knowledgeBaseId]
      );

      return res.rows
        .map((row) => {
          const stored = parseStoredEmbedding(row.embedding);
          return toCandidate(row, stored ? cosineSimilarity(queryEmbedding, stored) : 0);
        })
        .filter((c) => c.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    });
  }
}
