import request from 'supertest';
import { app } from '../src/index';
import { pool, runMigrations, withTenantContext } from '../src/db';
import { AuthService } from '../src/modules/auth/auth.service';
import { KnowledgeBaseService } from '../src/modules/knowledge-base/knowledge-base.service';
import { DocumentService } from '../src/modules/document/document.service';
import { processIngestionJob } from '../src/workers/ingestion/processor';

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

describe('Phase 2 Knowledge Ingestion & Worker Pipeline', () => {
  let tenantA: any;
  let tenantB: any;
  let kbA: any;
  let kbB: any;
  let docA: any;

  beforeAll(async () => {
    tenantA = await AuthService.signup(`ingest_a_${Date.now()}@example.com`, 'Pass123456!', 'Tenant A Admin', 'Org A Ingest');
    tenantB = await AuthService.signup(`ingest_b_${Date.now()}@example.com`, 'Pass123456!', 'Tenant B Admin', 'Org B Ingest');

    kbA = await KnowledgeBaseService.createKnowledgeBase(tenantA.organization.id, 'Engineering KB', 'Technical docs');
    kbB = await KnowledgeBaseService.createKnowledgeBase(tenantB.organization.id, 'Finance KB', 'Financial docs');
  });

  it('should securely upload a document, compute checksum, and queue ingestion job', async () => {
    const fileContent = 'Section 1: Security Practices.\nAll services must enforce HTTPS and JWT session validation.\n\nSection 2: Database Storage.\nPostgreSQL pgvector stores tenant embeddings.';
    const buffer = Buffer.from(fileContent, 'utf8');

    const res = await request(app)
      .post(`/api/v1/knowledge-bases/${kbA.id}/documents`)
      .set('Authorization', `Bearer ${tenantA.tokens.accessToken}`)
      .attach('file', buffer, 'architecture.txt');

    expect(res.status).toBe(201);
    expect(res.body.data.document.title).toBe('architecture');
    expect(res.body.data.version.status).toBe('QUEUED');
    expect(res.body.data.version.file_key).toContain(`org/${tenantA.organization.id}/documents/`);

    docA = res.body.data;
  });

  it('should process ingestion job synchronously, parse, chunk, embed, and store in pgvector', async () => {
    const fakeJob: any = {
      id: docA.jobId || `job_${Date.now()}`,
      data: {
        documentId: docA.document.id,
        documentVersionId: docA.version.id,
        organizationId: tenantA.organization.id,
        knowledgeBaseId: kbA.id,
      },
    };

    await processIngestionJob(fakeJob);

    // Verify document version status updated to READY
    const docStatus = await DocumentService.getDocument(tenantA.organization.id, docA.document.id);
    expect(docStatus.status).toBe('READY');
    expect(docStatus.chunk_count).toBeGreaterThan(0);

    // Verify document_chunks rows exist under Tenant A RLS context
    const chunks = await withTenantContext(tenantA.organization.id, async (client) => {
      const res = await client.query(
        `SELECT id, chunk_index, content FROM document_chunks WHERE document_version_id = $1`,
        [docA.version.id]
      );
      return res.rows;
    });

    expect(chunks.length).toBe(docStatus.chunk_count);
    expect(chunks[0].content).toContain('Security Practices');
  });

  it('should enforce idempotency when re-processing the same document version twice', async () => {
    const fakeJob: any = {
      id: docA.jobId || `job_${Date.now()}`,
      data: {
        documentId: docA.document.id,
        documentVersionId: docA.version.id,
        organizationId: tenantA.organization.id,
        knowledgeBaseId: kbA.id,
      },
    };

    // Re-run worker on identical version
    await processIngestionJob(fakeJob);

    const docStatus = await DocumentService.getDocument(tenantA.organization.id, docA.document.id);
    const chunks = await withTenantContext(tenantA.organization.id, async (client) => {
      const res = await client.query(
        `SELECT id FROM document_chunks WHERE document_version_id = $1`,
        [docA.version.id]
      );
      return res.rows;
    });

    // Chunk count must NOT duplicate
    expect(chunks.length).toBe(docStatus.chunk_count);
  });

  it('should enforce tenant isolation preventing Tenant B from reading Tenant A documents or chunks', async () => {
    // Tenant B attempts to fetch Tenant A's document
    const res = await request(app)
      .get(`/api/v1/documents/${docA.document.id}`)
      .set('Authorization', `Bearer ${tenantB.tokens.accessToken}`);

    expect(res.status).toBe(404);

    // Tenant B SQL query under Tenant B RLS context attempting to read Tenant A chunks
    const tenantBChunks = await withTenantContext(tenantB.organization.id, async (client) => {
      const res = await client.query(`SELECT id FROM document_chunks WHERE document_id = $1`, [docA.document.id]);
      return res.rows;
    });

    expect(tenantBChunks).toHaveLength(0);
  });
});
