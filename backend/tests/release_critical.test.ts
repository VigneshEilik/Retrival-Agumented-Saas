/**
 * Release-critical regression suite (v1.0.0).
 * Covers the production paths added/hardened for the first release: API-key access,
 * upload validation, duplicate detection, deletion, no-answer behaviour, provider
 * failure, conversation ownership, token-rotation races and migration idempotency.
 */
import request from 'supertest';
import { app } from '../src/index';
import { pool, runMigrations } from '../src/db';
import { AuthService } from '../src/modules/auth/auth.service';
import { processIngestionJob } from '../src/workers/ingestion/processor';
import { HybridRetriever } from '../src/modules/RAG/retrieval/hybrid.retriever';
import { NO_ANSWER_MESSAGE } from '../src/modules/RAG/orchestration/rag.orchestrator';
import { getLLMProvider, setLLMProvider, LLMProvider } from '../src/providers/llm';

const POLICY_TEXT = [
  '# Northwind Travel Policy',
  '',
  '## Hotels',
  'Hotel bookings are capped at 180 euros per night in major cities.',
  '',
  '## Flights',
  'Economy class is required for flights under 6 hours.',
].join('\n');

/** Parses an SSE body into { tokens, citations, done, error }. */
function parseSSE(body: string) {
  const out: { text: string; citations: any[]; done: any; error: any } = { text: '', citations: [], done: null, error: null };
  for (const block of body.split('\n\n')) {
    const event = /^event: (.*)$/m.exec(block)?.[1];
    const data = /^data: (.*)$/m.exec(block)?.[1];
    if (!event || !data) continue;
    const payload = JSON.parse(data);
    if (event === 'token') out.text += payload.text;
    if (event === 'citations') out.citations = payload.citations;
    if (event === 'done') out.done = payload;
    if (event === 'error') out.error = payload;
  }
  return out;
}

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

describe('Release-critical regression suite', () => {
  let owner: any;
  let auth: string;
  let kbId: string;
  let apiKey: string;

  beforeAll(async () => {
    owner = await AuthService.signup(`release_${Date.now()}@example.com`, 'Pass123456!', 'Release Owner', 'Release Org');
    auth = `Bearer ${owner.tokens.accessToken}`;
  });

  // ---------------------------------------------------------------- API keys
  it('creates an API key once, never returns it again, and the key can drive the API', async () => {
    const created = await request(app).post('/api/v1/api-keys').set('Authorization', auth).send({ name: 'CI integration' });
    expect(created.status).toBe(201);
    apiKey = created.body.data.rawKey;
    expect(apiKey).toMatch(/^sk_live_[0-9a-f]{48}$/);

    const list = await request(app).get('/api/v1/api-keys').set('Authorization', auth);
    expect(JSON.stringify(list.body)).not.toContain(apiKey);
    expect(JSON.stringify(list.body)).not.toContain('key_hash');

    const kb = await request(app).post('/api/v1/knowledge-bases').set('x-api-key', apiKey).send({ name: 'Policies' });
    expect(kb.status).toBe(201);
    kbId = kb.body.data.id;

    const lastUsed = await request(app).get('/api/v1/api-keys').set('Authorization', auth);
    expect(lastUsed.body.data.apiKeys[0].last_used_at).not.toBeNull();
  });

  it('rejects malformed API keys with 401', async () => {
    const res = await request(app).get('/api/v1/knowledge-bases').set('x-api-key', 'sk_live_short');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_API_KEY');
  });

  // ------------------------------------------------------------ Validation
  it('returns structured validation errors, JSON parse errors, bad UUIDs and unknown routes', async () => {
    const v = await request(app).post('/api/v1/auth/signup').send({ email: 'not-an-email', password: 'x', fullName: '' });
    expect(v.status).toBe(400);
    expect(v.body.error.code).toBe('VALIDATION_ERROR');
    expect(v.body.error.details.map((d: any) => d.path)).toEqual(expect.arrayContaining(['email', 'password', 'fullName']));

    const bad = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('MALFORMED_JSON');

    const uuid = await request(app).get('/api/v1/documents/not-a-uuid').set('Authorization', auth);
    expect(uuid.status).toBe(400);

    const missing = await request(app).get('/api/v1/does-not-exist').set('Authorization', auth);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('does not reveal whether an email exists on failed login', async () => {
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: 'whatever1' });
    const wrong = await request(app).post('/api/v1/auth/login').send({ email: owner.user.email, password: 'wrong-password' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  // ---------------------------------------------------------------- Uploads
  let docId: string;

  it('ingests an uploaded document end-to-end (upload → parse → chunk → embed → READY)', async () => {
    const up = await request(app)
      .post(`/api/v1/knowledge-bases/${kbId}/documents`)
      .set('x-api-key', apiKey)
      .attach('file', Buffer.from(POLICY_TEXT), { filename: 'travel-policy.md', contentType: 'text/markdown' });
    expect(up.status).toBe(201);
    docId = up.body.data.document.id;

    // Tests drive ingestion explicitly (no background worker in the test environment).
    const result = await processIngestionJob({
      documentId: docId,
      documentVersionId: up.body.data.version.id,
      organizationId: owner.organization.id,
      knowledgeBaseId: kbId,
    });
    expect(result.chunkCount).toBeGreaterThan(0);

    const doc = await request(app).get(`/api/v1/documents/${docId}`).set('Authorization', auth);
    expect(doc.body.data.status).toBe('READY');
    expect(doc.body.data.chunk_count).toBe(result.chunkCount);
  });

  it('rejects duplicate uploads of identical content with 409', async () => {
    const dup = await request(app)
      .post(`/api/v1/knowledge-bases/${kbId}/documents`)
      .set('Authorization', auth)
      .attach('file', Buffer.from(POLICY_TEXT), { filename: 'copy.md', contentType: 'text/markdown' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE_DOCUMENT');
    expect(dup.body.error.details.documentId).toBe(docId);
  });

  it('rejects unsupported types, spoofed content and oversized files', async () => {
    const exe = await request(app)
      .post(`/api/v1/knowledge-bases/${kbId}/documents`)
      .set('Authorization', auth)
      .attach('file', Buffer.from('MZ binary'), { filename: 'tool.exe', contentType: 'application/octet-stream' });
    expect(exe.status).toBe(415);
    expect(exe.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');

    const spoofed = await request(app)
      .post(`/api/v1/knowledge-bases/${kbId}/documents`)
      .set('Authorization', auth)
      .attach('file', Buffer.from('not really a pdf'), { filename: 'report.pdf', contentType: 'application/pdf' });
    expect(spoofed.status).toBe(415);
    expect(spoofed.body.error.code).toBe('FILE_CONTENT_MISMATCH');

    const big = Buffer.alloc(26 * 1024 * 1024, 'a');
    const oversized = await request(app)
      .post(`/api/v1/knowledge-bases/${kbId}/documents`)
      .set('Authorization', auth)
      .attach('file', big, { filename: 'huge.txt', contentType: 'text/plain' });
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe('FILE_TOO_LARGE');

    const none = await request(app).post(`/api/v1/knowledge-bases/${kbId}/documents`).set('Authorization', auth);
    expect(none.status).toBe(400);
  });

  it('only allows retrying FAILED documents', async () => {
    const retry = await request(app).post(`/api/v1/documents/${docId}/retry`).set('Authorization', auth);
    expect(retry.status).toBe(409);
    expect(retry.body.error.code).toBe('RETRY_NOT_ALLOWED');
  });

  // ------------------------------------------------------------- RAG answers
  it('answers from the knowledge base with citations, and refuses when nothing is relevant', async () => {
    const conv = await request(app).post('/api/v1/conversations').set('Authorization', auth).send({ knowledgeBaseId: kbId });
    expect(conv.status).toBe(201);

    const answer = await request(app)
      .post(`/api/v1/conversations/${conv.body.data.id}/messages/stream`)
      .set('Authorization', auth)
      .send({ prompt: 'What is the hotel cap per night?' });
    expect(answer.status).toBe(200);
    expect(answer.headers['content-type']).toMatch(/text\/event-stream/);
    const parsed = parseSSE(answer.text);
    expect(parsed.error).toBeNull();
    expect(parsed.done.grounded).toBe(true);
    expect(parsed.citations.length).toBeGreaterThan(0);
    expect(parsed.citations[0].documentId).toBe(docId);

    // An empty knowledge base yields the explicit no-answer message without calling the LLM.
    const emptyKb = await request(app).post('/api/v1/knowledge-bases').set('Authorization', auth).send({ name: 'Empty' });
    const conv2 = await request(app).post('/api/v1/conversations').set('Authorization', auth).send({ knowledgeBaseId: emptyKb.body.data.id });
    const none = await request(app)
      .post(`/api/v1/conversations/${conv2.body.data.id}/messages/stream`)
      .set('Authorization', auth)
      .send({ prompt: 'What is the parental leave policy?' });
    const parsedNone = parseSSE(none.text);
    expect(parsedNone.text).toBe(NO_ANSWER_MESSAGE);
    expect(parsedNone.citations).toEqual([]);
    expect(parsedNone.done.grounded).toBe(false);

    // History persists both turns with the answer's sources
    const history = await request(app).get(`/api/v1/conversations/${conv.body.data.id}/messages`).set('Authorization', auth);
    expect(history.body.data.messages.map((m: any) => m.role)).toEqual(['user', 'assistant']);
    expect(history.body.data.messages[1].sources.length).toBeGreaterThan(0);
  });

  it('reports an LLM outage as a clean SSE error instead of crashing', async () => {
    const failing: LLMProvider = {
      name: 'Failing',
      model: 'down',
      generateText: async () => {
        throw new Error('Groq API error (503): upstream unavailable');
      },
      generateStream: async () => {
        throw new Error('Groq API error (503): upstream unavailable');
      },
    };
    const original = getLLMProvider();
    setLLMProvider(failing);
    try {
      const conv = await request(app).post('/api/v1/conversations').set('Authorization', auth).send({ knowledgeBaseId: kbId });
      const res = await request(app)
        .post(`/api/v1/conversations/${conv.body.data.id}/messages/stream`)
        .set('Authorization', auth)
        .send({ prompt: 'What is the hotel cap per night?' });
      const parsed = parseSSE(res.text);
      expect(parsed.error.code).toBe('LLM_UNAVAILABLE');
      expect(parsed.error.message).not.toContain('503'); // provider internals are not leaked
    } finally {
      setLLMProvider(original);
    }
  });

  it('prevents other tenants from using or reading a conversation', async () => {
    const other = await AuthService.signup(`release_other_${Date.now()}@example.com`, 'Pass123456!', 'Other', 'Other Org');
    const conv = await request(app).post('/api/v1/conversations').set('Authorization', auth).send({ knowledgeBaseId: kbId });

    const stream = await request(app)
      .post(`/api/v1/conversations/${conv.body.data.id}/messages/stream`)
      .set('Authorization', `Bearer ${other.tokens.accessToken}`)
      .send({ prompt: 'hotel cap', knowledgeBaseId: kbId });
    expect(stream.status).toBe(404);

    const read = await request(app)
      .get(`/api/v1/conversations/${conv.body.data.id}/messages`)
      .set('Authorization', `Bearer ${other.tokens.accessToken}`);
    expect(read.status).toBe(404);
  });

  // ---------------------------------------------------------------- Deletion
  it('makes deleted document content immediately unretrievable', async () => {
    const retriever = new HybridRetriever();
    const before = await retriever.retrieve({ organizationId: owner.organization.id, knowledgeBaseId: kbId, query: 'hotel cap per night' });
    expect(before.some((c) => c.documentId === docId)).toBe(true);

    const del = await request(app).delete(`/api/v1/documents/${docId}`).set('Authorization', auth);
    expect(del.status).toBe(200);

    const after = await retriever.retrieve({ organizationId: owner.organization.id, knowledgeBaseId: kbId, query: 'hotel cap per night' });
    expect(after.some((c) => c.documentId === docId)).toBe(false);

    const gone = await request(app).get(`/api/v1/documents/${docId}`).set('Authorization', auth);
    expect(gone.status).toBe(404);
  });

  // ------------------------------------------------------------ Auth tokens
  it('allows exactly one of two concurrent refreshes with the same token', async () => {
    const login = await AuthService.login(owner.user.email, 'Pass123456!');
    const token = login.tokens.refreshToken;
    const [a, b] = await Promise.all([
      request(app).post('/api/v1/auth/refresh').send({ refreshToken: token }),
      request(app).post('/api/v1/auth/refresh').send({ refreshToken: token }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 401]);
  });

  // ------------------------------------------------------------- Database
  it('enforces RLS for the application connection (no tenant context → no rows)', async () => {
    const role = await pool.query(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`);
    if (role.rows[0].rolsuper || role.rows[0].rolbypassrls) {
      // Running as a privileged role (e.g. CI service container): RLS is bypassed by design of PostgreSQL.
      console.warn('RLS check skipped: tests are connected as a superuser/BYPASSRLS role');
      return;
    }
    const res = await pool.query('SELECT COUNT(*)::int AS n FROM documents');
    expect(res.rows[0].n).toBe(0);
  });

  it('runs migrations idempotently', async () => {
    const applied = await runMigrations();
    expect(applied).toEqual([]);
  });
});
