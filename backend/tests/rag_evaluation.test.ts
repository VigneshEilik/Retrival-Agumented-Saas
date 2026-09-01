import { pool, runMigrations, withTenantContext } from '../src/db';
import { AuthService } from '../src/modules/auth/auth.service';
import { KnowledgeBaseService } from '../src/modules/knowledge-base/knowledge-base.service';
import { RAGEvaluator } from '../src/evaluation/rag.evaluator';
import evalDataset from '../src/evaluation/basic-rag-eval.json';

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

describe('Phase 3 Automated RAG Evaluation Benchmark Suite', () => {
  let tenant: any;
  let kb: any;

  beforeAll(async () => {
    tenant = await AuthService.signup(`eval_${Date.now()}@example.com`, 'Pass123456!', 'Eval Admin', 'Org Eval');
    kb = await KnowledgeBaseService.createKnowledgeBase(tenant.organization.id, 'Benchmark Knowledge Base');

    // Seed evaluation dataset chunks into PostgreSQL under tenant RLS context
    await withTenantContext(tenant.organization.id, async (client) => {
      const docRes1 = await client.query(
        `INSERT INTO documents (organization_id, knowledge_base_id, title) VALUES ($1, $2, 'HR Policy Manual.pdf') RETURNING id`,
        [tenant.organization.id, kb.id]
      );
      const ver1 = await client.query(
        `INSERT INTO document_versions (organization_id, document_id, version, file_key, file_type, file_size_bytes, status)
         VALUES ($1, $2, 1, 'k1', 'application/pdf', 100, 'READY') RETURNING id`,
        [tenant.organization.id, docRes1.rows[0].id]
      );
      await client.query(
        `INSERT INTO document_chunks (organization_id, knowledge_base_id, document_id, document_version_id, chunk_index, content, metadata)
         VALUES ($1, $2, $3, $4, 0, 'Full time employees receive 20 days of annual leave per year subject to manager approval.', '{"pageNumber": 10}')`,
        [tenant.organization.id, kb.id, docRes1.rows[0].id, ver1.rows[0].id]
      );

      const docRes2 = await client.query(
        `INSERT INTO documents (organization_id, knowledge_base_id, title) VALUES ($1, $2, 'Architecture Spec.pdf') RETURNING id`,
        [tenant.organization.id, kb.id]
      );
      const ver2 = await client.query(
        `INSERT INTO document_versions (organization_id, document_id, version, file_key, file_type, file_size_bytes, status)
         VALUES ($1, $2, 1, 'k2', 'application/pdf', 100, 'READY') RETURNING id`,
        [tenant.organization.id, docRes2.rows[0].id]
      );
      await client.query(
        `INSERT INTO document_chunks (organization_id, knowledge_base_id, document_id, document_version_id, chunk_index, content, metadata)
         VALUES ($1, $2, $3, $4, 0, 'Database connections require HTTPS TLS encryption, PostgreSQL 16 pgvector, and mandatory Row-Level Security.', '{"pageNumber": 5}')`,
        [tenant.organization.id, kb.id, docRes2.rows[0].id, ver2.rows[0].id]
      );
    });
  });

  it('should run automated RAG benchmark evaluation and meet high precision thresholds', async () => {
    const evaluator = new RAGEvaluator();
    const metrics = await evaluator.evaluateDataset(tenant.organization.id, kb.id, evalDataset);

    expect(metrics.retrievalRecall).toBeGreaterThanOrEqual(0.8);
    expect(metrics.contextRelevance).toBeGreaterThanOrEqual(0.5);
    expect(metrics.answerFaithfulness).toBeGreaterThanOrEqual(0.5);
    expect(metrics.citationAccuracy).toBeGreaterThanOrEqual(0.8);
    expect(metrics.averageLatencyMs).toBeLessThan(5000);
  });
});
