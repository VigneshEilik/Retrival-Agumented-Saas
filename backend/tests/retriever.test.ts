import { pool, runMigrations, withTenantContext } from '../src/db';
import { AuthService } from '../src/modules/auth/auth.service';
import { KnowledgeBaseService } from '../src/modules/knowledge-base/knowledge-base.service';
import { VectorRetriever } from '../src/modules/RAG/retrieval/vector.retriever';
import { KeywordRetriever } from '../src/modules/RAG/retrieval/keyword.retriever';
import { HybridRetriever } from '../src/modules/RAG/retrieval/hybrid.retriever';
import { GroundingValidator } from '../src/modules/RAG/orchestration/grounding.validator';
import { getEmbeddingProvider } from '../src/providers/embedding';

const CHUNK_PASSWORD = 'Password policy requires at least 12 characters and multi-factor authentication.';
const CHUNK_RETENTION = 'Data retention policy dictates keeping database audit logs for 90 days.';

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

describe('Phase 3 RAG Retrieval & Hybrid Search Suite', () => {
  let tenant: any;
  let kb: any;
  let docId: string;
  let versionId: string;

  beforeAll(async () => {
    tenant = await AuthService.signup(`retrieval_${Date.now()}@example.com`, 'Pass123456!', 'Tenant RAG Admin', 'Org RAG');
    kb = await KnowledgeBaseService.createKnowledgeBase(tenant.organization.id, 'Engineering Manuals', 'System docs');

    await withTenantContext(tenant.organization.id, async (client) => {
      const docRes = await client.query(
        `INSERT INTO documents (organization_id, knowledge_base_id, title) VALUES ($1, $2, 'Security Policy') RETURNING id`,
        [tenant.organization.id, kb.id]
      );
      docId = docRes.rows[0].id;

      const verRes = await client.query(
        `INSERT INTO document_versions (organization_id, document_id, version, file_key, file_type, file_size_bytes, status)
         VALUES ($1, $2, 1, 'key', 'text/plain', 100, 'READY') RETURNING id`,
        [tenant.organization.id, docId]
      );
      versionId = verRes.rows[0].id;

      // Seed chunks WITH stored embeddings, exactly as the ingestion worker does
      const embedder = getEmbeddingProvider();
      const [e0, e1] = await embedder.embedBatch([CHUNK_PASSWORD, CHUNK_RETENTION]);
      await client.query(
        `INSERT INTO document_chunks (organization_id, knowledge_base_id, document_id, document_version_id, chunk_index, content, metadata, embedding)
         VALUES ($1, $2, $3, $4, 0, $5, '{"pageNumber": 1}', $7),
                ($1, $2, $3, $4, 1, $6, '{"pageNumber": 2}', $8)`,
        [tenant.organization.id, kb.id, docId, versionId, CHUNK_PASSWORD, CHUNK_RETENTION, `[${e0.join(',')}]`, `[${e1.join(',')}]`]
      );
    });
  });

  it('should retrieve relevant chunks using VectorRetriever scoped by tenant RLS', async () => {
    // Tests use the deterministic mock embedder, so an identical text has cosine similarity 1.
    // (Semantic quality with the real model is verified in the end-to-end release checks.)
    const retriever = new VectorRetriever();
    const results = await retriever.retrieve({
      organizationId: tenant.organization.id,
      knowledgeBaseId: kb.id,
      query: CHUNK_PASSWORD,
      topK: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].documentId).toBe(docId);
    expect(results[0].content).toBe(CHUNK_PASSWORD);
    expect(results[0].score).toBeCloseTo(1, 5);

    // Another tenant sees nothing from this knowledge base
    const other = await AuthService.signup(`retrieval_other_${Date.now()}@example.com`, 'Pass123456!', 'Other', 'Other Org');
    const leaked = await retriever.retrieve({ organizationId: other.organization.id, knowledgeBaseId: kb.id, query: CHUNK_PASSWORD });
    expect(leaked).toHaveLength(0);
  });

  it('should retrieve relevant chunks using KeywordRetriever', async () => {
    const retriever = new KeywordRetriever();
    const results = await retriever.retrieve({
      organizationId: tenant.organization.id,
      knowledgeBaseId: kb.id,
      query: 'Password policy multi-factor',
      topK: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('Password policy');
  });

  it('should merge candidates using HybridRetriever RRF scoring', async () => {
    const hybrid = new HybridRetriever();
    const results = await hybrid.retrieve({
      organizationId: tenant.organization.id,
      knowledgeBaseId: kb.id,
      query: 'audit logs retention policy',
      topK: 2,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('should detect context insufficiency via GroundingValidator', () => {
    const emptyCheck = GroundingValidator.validateContextSufficiency('Unrelated prompt', []);
    expect(emptyCheck.isGrounded).toBe(false);

    const validCheck = GroundingValidator.validateContextSufficiency('Password policy', [
      { chunkId: 'c1', documentId: 'd1', documentVersionId: 'v1', content: 'test', metadata: {}, score: 0.8 },
    ]);
    expect(validCheck.isGrounded).toBe(true);
  });
});
