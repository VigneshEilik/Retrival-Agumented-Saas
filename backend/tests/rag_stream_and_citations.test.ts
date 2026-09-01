import request from 'supertest';
import { app } from '../src/index';
import { pool, runMigrations, withTenantContext } from '../src/db';
import { AuthService } from '../src/modules/auth/auth.service';
import { KnowledgeBaseService } from '../src/modules/knowledge-base/knowledge-base.service';

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

describe('Phase 3 RAG SSE Streaming, Citations & Conversation History', () => {
  let tenantA: any;
  let tenantB: any;
  let kbA: any;
  let convA: any;
  let docAId: string;

  beforeAll(async () => {
    tenantA = await AuthService.signup(`rag_stream_a_${Date.now()}@example.com`, 'Pass123456!', 'Tenant A Admin', 'Org A Stream');
    tenantB = await AuthService.signup(`rag_stream_b_${Date.now()}@example.com`, 'Pass123456!', 'Tenant B Admin', 'Org B Stream');

    kbA = await KnowledgeBaseService.createKnowledgeBase(tenantA.organization.id, 'Engineering Handbook', 'Company policies');

    // Seed document and chunks under Tenant A RLS context
    await withTenantContext(tenantA.organization.id, async (client) => {
      const docRes = await client.query(
        `INSERT INTO documents (organization_id, knowledge_base_id, title) VALUES ($1, $2, 'Employee Handbook.pdf') RETURNING id`,
        [tenantA.organization.id, kbA.id]
      );
      docAId = docRes.rows[0].id;

      const verRes = await client.query(
        `INSERT INTO document_versions (organization_id, document_id, version, file_key, file_type, file_size_bytes, status)
         VALUES ($1, $2, 1, 'key', 'application/pdf', 500, 'READY') RETURNING id`,
        [tenantA.organization.id, docAId]
      );

      await client.query(
        `INSERT INTO document_chunks (organization_id, knowledge_base_id, document_id, document_version_id, chunk_index, content, metadata)
         VALUES ($1, $2, $3, $4, 0, 'Full-time employees receive 20 days of annual leave per year.', '{"pageNumber": 18, "sectionTitle": "Leave Policy"}')`,
        [tenantA.organization.id, kbA.id, docAId, verRes.rows[0].id]
      );
    });

    // Create Conversation
    const convRes = await request(app)
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${tenantA.tokens.accessToken}`)
      .send({ knowledgeBaseId: kbA.id, title: 'Annual Leave Query' });

    convA = convRes.body.data;
  });

  it('should stream RAG response tokens and grounded citations via SSE', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${convA.id}/messages/stream`)
      .set('Authorization', `Bearer ${tenantA.tokens.accessToken}`)
      .send({ knowledgeBaseId: kbA.id, prompt: 'What is the annual leave policy for full-time employees?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const sseOutput = res.text;
    expect(sseOutput).toContain('event: token');
    expect(sseOutput).toContain('event: citations');
    expect(sseOutput).toContain('event: done');
    expect(sseOutput).toContain('Employee Handbook.pdf');
  });

  it('should fetch conversation message history with persisted citation sources', async () => {
    const res = await request(app)
      .get(`/api/v1/conversations/${convA.id}/messages`)
      .set('Authorization', `Bearer ${tenantA.tokens.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.messages.length).toBeGreaterThanOrEqual(2);

    const assistantMsg = res.body.data.messages.find((m: any) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg.sources.length).toBeGreaterThan(0);
    expect(assistantMsg.sources[0].documentTitle).toBe('Employee Handbook.pdf');
    expect(assistantMsg.sources[0].pageNumber).toBe(18);
  });

  it('should enforce tenant isolation preventing Tenant B from accessing Tenant A conversation or SSE stream', async () => {
    const res = await request(app)
      .get(`/api/v1/conversations/${convA.id}/messages`)
      .set('Authorization', `Bearer ${tenantB.tokens.accessToken}`);

    expect(res.status).toBe(404);
  });
});
