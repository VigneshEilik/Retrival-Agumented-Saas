import { CandidateChunk } from '../retrieval/retrieval.interface';
import { withTenantContext } from '../../../db';

export interface GroundedCitation {
  citationId: number;
  documentId: string;
  documentTitle: string;
  chunkId: string;
  pageNumber?: number;
  sectionTitle?: string;
  snippet: string;
  relevanceScore: number;
}

export class CitationResolver {
  static async resolveCitations(
    organizationId: string,
    generatedText: string,
    usedChunks: CandidateChunk[]
  ): Promise<GroundedCitation[]> {
    if (usedChunks.length === 0) return [];

    // Map each used chunk to citation ID (1-based index)
    const documentIds = Array.from(new Set(usedChunks.map((c) => c.documentId)));

    // Fetch document titles under Tenant RLS context
    const docTitlesMap = new Map<string, string>();
    await withTenantContext(organizationId, async (client) => {
      const res = await client.query(
        `SELECT id, title FROM documents WHERE id = ANY($1::uuid[]) AND organization_id = $2`,
        [documentIds, organizationId]
      );
      res.rows.forEach((r) => docTitlesMap.set(r.id, r.title));
    });

    const citations: GroundedCitation[] = usedChunks.map((chunk, idx) => {
      const docTitle = docTitlesMap.get(chunk.documentId) || 'Document';
      return {
        citationId: idx + 1,
        documentId: chunk.documentId,
        documentTitle: docTitle,
        chunkId: chunk.chunkId,
        pageNumber: chunk.metadata.pageNumber,
        sectionTitle: chunk.metadata.sectionTitle,
        snippet: chunk.content.substring(0, 200).trim(),
        relevanceScore: chunk.score,
      };
    });

    return citations;
  }
}
