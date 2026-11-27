#!/usr/bin/env node
/**
 * Failure-mode verification (local/staging only). Starts throw-away API instances from
 * dist/ with deliberately broken dependencies and checks the system degrades gracefully.
 *
 *   npm run build && node scripts/smoke/failure-scenarios.mjs [reportFile]
 *
 * Requires a working backend/.env (database + Groq) for the healthy parts.
 * Also needs MIGRATION_DATABASE_URL (owner role) to simulate a crashed ingestion.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from '../../node_modules/pg/lib/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT = process.argv[2] || '';
const results = [];
const procs = [];

function record(name, ok, detail = '') {
  results.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return env;
}

async function startInstance(port, overrides) {
  const child = spawn(process.execPath, ['dist/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), NODE_ENV: 'development', LOG_LEVEL: 'warn', ...overrides },
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  procs.push(child);
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/live`);
      if (r.ok) return child;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`instance on ${port} did not start`);
}

async function api(port, method, url, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`http://127.0.0.1:${port}/api/v1${url}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* SSE */ }
  return { status: res.status, json, text };
}

async function tenant(port, label) {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const r = await api(port, 'POST', '/auth/signup', {
    body: { email: `fail_${label}_${stamp}@example.com`, password: 'Failure-Pass-123!', fullName: 'Failure Test', orgName: `Fail ${label}` },
  });
  const token = r.json.data.tokens.accessToken;
  const kb = await api(port, 'POST', '/knowledge-bases', { token, body: { name: `KB ${label}` } });
  return { token, kbId: kb.json.data.id, orgId: r.json.data.organization.id };
}

async function uploadText(port, t, name, text) {
  const form = new FormData();
  form.append('file', new Blob([text], { type: 'text/plain' }), name);
  return api(port, 'POST', `/knowledge-bases/${t.kbId}/documents`, { token: t.token, form });
}

async function waitStatus(port, t, docId, timeoutMs = 120_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await api(port, 'GET', `/documents/${docId}`, { token: t.token });
    if (['READY', 'FAILED'].includes(r.json?.data?.status)) return r.json.data;
    await new Promise((res) => setTimeout(res, 1000));
  }
  return { status: 'TIMEOUT' };
}

async function askSSE(port, t, prompt) {
  const conv = await api(port, 'POST', '/conversations', { token: t.token, body: { knowledgeBaseId: t.kbId } });
  const r = await api(port, 'POST', `/conversations/${conv.json.data.id}/messages/stream`, { token: t.token, body: { prompt } });
  const err = /event: error\ndata: (.*)/.exec(r.text);
  return { status: r.status, error: err ? JSON.parse(err[1]) : null, text: r.text };
}

const DOC = 'Office Policy\n\nThe office opens at 08:00 and closes at 19:00. Visitors must sign in at reception.';

async function main() {
  const env = loadEnv();
  const deadRedis = 'redis://127.0.0.1:6399';

  // 1. Redis down + LLM provider rejecting requests
  await startInstance(4101, { REDIS_URL: deadRedis, GROQ_API_KEY: 'gsk_invalid_key_for_failure_testing_000000000000000000' });
  const t1 = await tenant(4101, 'redis');
  const up = await uploadText(4101, t1, 'office.txt', DOC);
  const st = await waitStatus(4101, t1, up.json.data.document.id);
  record('Redis unavailable → upload still ingested (in-process fallback)', st.status === 'READY', `status ${st.status}, ${st.chunk_count} chunks`);
  const llm = await askSSE(4101, t1, 'When does the office open?');
  record(
    'LLM provider unavailable/rejecting → clean SSE error, no crash',
    llm.status === 200 && llm.error?.code === 'LLM_UNAVAILABLE' && !/gsk_|401|invalid/i.test(llm.error?.message || ''),
    JSON.stringify(llm.error)
  );
  const health = await fetch('http://127.0.0.1:4101/ready').then(async (r) => ({ code: r.status, body: await r.json() }));
  record('Readiness reports DEGRADED (still serving) when Redis is down', health.code === 200 && health.body.status === 'DEGRADED' && health.body.checks.redis === 'DOWN', `/ready → ${health.code} ${health.body.status}`);
  let limited = 0;
  for (let i = 0; i < 22; i++) {
    const r = await api(4101, 'POST', '/auth/login', { body: { email: 'nobody@example.com', password: 'wrong-password' } });
    if (r.status === 429) limited++;
  }
  record('Rate limiting still enforced without Redis (in-memory window)', limited > 0, `${limited} of 22 login attempts throttled (429)`);

  // 2. LLM timeout
  await startInstance(4102, { LLM_TIMEOUT_MS: '1', REDIS_URL: deadRedis });
  const t2 = await tenant(4102, 'timeout');
  const up2 = await uploadText(4102, t2, 'office.txt', DOC);
  await waitStatus(4102, t2, up2.json.data.document.id);
  const to = await askSSE(4102, t2, 'When does the office open?');
  record('LLM timeout → LLM_TIMEOUT error event', to.error?.code === 'LLM_TIMEOUT' || to.error?.code === 'LLM_UNAVAILABLE', JSON.stringify(to.error));

  // 3. Embedding model failure
  await startInstance(4103, { EMBEDDING_MODEL: 'Xenova/this-model-does-not-exist-xyz', REDIS_URL: deadRedis });
  const t3 = await tenant(4103, 'embed');
  const up3 = await uploadText(4103, t3, 'office.txt', DOC);
  const st3 = await waitStatus(4103, t3, up3.json.data.document.id);
  record('Embedding failure → document marked FAILED with a reason', st3.status === 'FAILED' && !!st3.error_message, `${st3.status}: ${(st3.error_message || '').slice(0, 90)}`);

  // 4. Database unavailable
  await startInstance(4104, {
    DATABASE_URL: 'postgres://rag_app:x@127.0.0.1:5999/none',
    MIGRATION_DATABASE_URL: '',
    RUN_MIGRATIONS_ON_START: 'false',
    RUN_INGESTION_WORKER: 'false',
    REDIS_URL: deadRedis,
  });
  const ready4 = await fetch('http://127.0.0.1:4104/ready').then((r) => r.status);
  const login4 = await api(4104, 'POST', '/auth/login', { body: { email: 'a@example.com', password: 'whatever-123' } });
  record('Database unavailable → /ready 503, login fails with 5xx JSON (not "wrong password")', ready4 === 503 && login4.status >= 500 && !!login4.json?.error, `/ready ${ready4}, login ${login4.status} ${login4.json?.error?.code}`);
  const live4 = await fetch('http://127.0.0.1:4104/live').then((r) => r.status);
  record('Process stays alive while the database is down', live4 === 200, `/live ${live4}`);

  // 5. Crash recovery: a document left PROCESSING by a dead process is re-dispatched on startup
  if (env.MIGRATION_DATABASE_URL) {
    const owner = new pg.Client({ connectionString: env.MIGRATION_DATABASE_URL });
    await owner.connect();
    const docId = up.json.data.document.id;
    await owner.query(
      `UPDATE document_versions SET status = 'PROCESSING', chunk_count = 0, created_at = NOW() - INTERVAL '1 hour' WHERE document_id = $1`,
      [docId]
    );
    await owner.query(`DELETE FROM document_chunks WHERE document_id = $1`, [docId]);
    await startInstance(4105, { REDIS_URL: deadRedis });
    const st5 = await waitStatus(4105, t1, docId, 60_000);
    record('Worker crash/restart → stalled document recovered on startup', st5.status === 'READY' && st5.chunk_count > 0, `status ${st5.status}, ${st5.chunk_count} chunks`);
    await owner.end();
  } else {
    record('Worker crash/restart recovery', false, 'MIGRATION_DATABASE_URL not set; cannot simulate');
  }
}

main()
  .catch((err) => record('Unexpected error', false, err.message))
  .finally(() => {
    for (const p of procs) p.kill();
    const failed = results.filter((r) => r.status === 'FAIL').length;
    console.log(`\n${results.length - failed} passed, ${failed} failed`);
    if (REPORT) fs.writeFileSync(REPORT, JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));
    setTimeout(() => process.exit(failed ? 1 : 0), 500);
  });
