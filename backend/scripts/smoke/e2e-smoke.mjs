#!/usr/bin/env node
/**
 * End-to-end smoke test for a running deployment (no dependencies, Node 20+).
 *
 *   node scripts/smoke/e2e-smoke.mjs [baseUrl] [reportFile]
 *   e.g. node scripts/smoke/e2e-smoke.mjs https://app.example.com smoke-report.json
 *
 * baseUrl is the PUBLIC frontend origin (requests go through the same /api/v1 proxy
 * a browser uses). It creates two throw-away tenants, so run it against production
 * only if test sign-ups are acceptable there.
 *
 * Scenarios (release acceptance A–P):
 *  A register · B login · C create KB · D upload PDF · E wait for processing ·
 *  F verify indexing · G factual question · H answer correctness · I citations ·
 *  J out-of-scope question · K no hallucination · L upload DOCX · M multi-document
 *  retrieval · N delete document · O deleted content not retrievable · P cross-tenant access
 *  + API key access.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const REPORT = process.argv[3] || '';
const API = `${BASE}/api/v1`;
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const NO_INFO = /(not (available|contain|include|mention|found|provided)|no (information|mention|details)|couldn.?t find|can.?t answer|does not (contain|include|mention|specify|cover|provide))/i;

const results = [];
let failures = 0;

function record(id, name, ok, detail = '', ms = 0) {
  results.push({ id, name, status: ok ? 'PASS' : 'FAIL', detail, ms });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(3)} ${name}${detail ? `  — ${detail}` : ''}${ms ? `  (${ms} ms)` : ''}`);
}

async function call(method, url, { token, apiKey, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers['x-api-key'] = apiKey;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${url}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* SSE or empty */ }
  return { status: res.status, json, text };
}

function parseSSE(text) {
  const out = { text: '', citations: [], done: null, error: null };
  for (const block of text.split('\n\n')) {
    const event = /^event: (.*)$/m.exec(block)?.[1];
    const data = /^data: (.*)$/m.exec(block)?.[1];
    if (!event || !data) continue;
    const p = JSON.parse(data);
    if (event === 'token') out.text += p.text;
    if (event === 'citations') out.citations = p.citations;
    if (event === 'done') out.done = p;
    if (event === 'error') out.error = p;
  }
  return out;
}

async function ask(token, kbId, prompt) {
  const conv = await call('POST', '/conversations', { token, body: { knowledgeBaseId: kbId } });
  const t0 = Date.now();
  const res = await call('POST', `/conversations/${conv.json.data.id}/messages/stream`, { token, body: { prompt } });
  return { ...parseSSE(res.text), status: res.status, ms: Date.now() - t0, conversationId: conv.json.data.id };
}

function upload(token, kbId, file, contentType) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(path.join(FIXTURES, file))], { type: contentType }), file);
  return call('POST', `/knowledge-bases/${kbId}/documents`, { token, form });
}

async function waitReady(token, docId, timeoutMs = 240_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await call('GET', `/documents/${docId}`, { token });
    const s = r.json?.data?.status;
    if (s === 'READY' || s === 'FAILED') return { ...r.json.data, ms: Date.now() - t0 };
    await new Promise((res) => setTimeout(res, 1500));
  }
  return { status: 'TIMEOUT', ms: Date.now() - t0 };
}

async function main() {
  console.log(`E2E smoke test against ${BASE}\n`);
  const stamp = Date.now();
  const email = `smoke_${stamp}@example.com`;
  const password = `Smoke-${stamp}-Pw!`;

  // A. Register
  const reg = await call('POST', '/auth/signup', { body: { email, password, fullName: 'Smoke Tester', orgName: `Smoke Org ${stamp}` } });
  record('A', 'Register a new user', reg.status === 201, `status ${reg.status}`);
  if (reg.status !== 201) return;

  // B. Login
  const login = await call('POST', '/auth/login', { body: { email, password } });
  const token = login.json?.data?.tokens?.accessToken;
  record('B', 'Authenticate', login.status === 200 && !!token, `status ${login.status}`);
  if (!token) return;

  // C. Knowledge base
  const kb = await call('POST', '/knowledge-bases', { token, body: { name: 'Smoke Test KB', description: 'Created by e2e-smoke' } });
  const kbId = kb.json?.data?.id;
  record('C', 'Create knowledge base', kb.status === 201 && !!kbId, `status ${kb.status}`);
  if (!kbId) return;

  // D–F. PDF upload and indexing
  const pdf = await upload(token, kbId, 'employee-handbook.pdf', 'application/pdf');
  const pdfId = pdf.json?.data?.document?.id;
  record('D', 'Upload a PDF', pdf.status === 201 && !!pdfId, `status ${pdf.status}`);
  if (!pdfId) return;
  const pdfDoc = await waitReady(token, pdfId);
  record('E', 'Wait for processing', pdfDoc.status === 'READY', `final status ${pdfDoc.status}${pdfDoc.error_message ? `: ${pdfDoc.error_message}` : ''}`, pdfDoc.ms);
  record('F', 'Verify indexing', (pdfDoc.chunk_count || 0) > 0, `${pdfDoc.chunk_count || 0} chunks`);

  // G–I. Factual question
  const g = await ask(token, kbId, 'How many days of paid annual leave do full-time employees get?');
  record('G', 'Ask a factual question', g.status === 200 && !g.error && g.text.length > 0, g.error ? g.error.code : `${g.text.length} chars`, g.ms);
  record('H', 'Answer is correct (26 days)', /\b26\b/.test(g.text), JSON.stringify(g.text.slice(0, 160)));
  const pageCited = g.citations.some((c) => c.documentId === pdfId && c.pageNumber);
  record('I', 'Citations point to the PDF with a page number', pageCited, g.citations.map((c) => `${c.documentTitle} p.${c.pageNumber}`).join(', '));

  // J–K. Out-of-scope question
  const j = await ask(token, kbId, 'What is the company policy on parental leave?');
  record('J', 'Ask a question outside the knowledge base', j.status === 200 && !j.error, j.error ? j.error.code : '', j.ms);
  const noHallucination = NO_INFO.test(j.text) && !/\b\d+\s*(weeks|months)\b/i.test(j.text);
  record('K', 'No hallucinated answer', noHallucination, JSON.stringify(j.text.slice(0, 160)));

  // L–M. DOCX + multi-document retrieval
  const docx = await upload(token, kbId, 'it-security-standard.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const docxId = docx.json?.data?.document?.id;
  const docxDoc = docxId ? await waitReady(token, docxId) : { status: 'NOT_UPLOADED' };
  record('L', 'Upload and index a DOCX', docx.status === 201 && docxDoc.status === 'READY', `status ${docx.status} / ${docxDoc.status}, ${docxDoc.chunk_count || 0} chunks`, docxDoc.ms);
  const m = await ask(token, kbId, 'What is the minimum password length, and what is the annual learning budget per employee?');
  const docsCited = new Set(m.citations.map((c) => c.documentId));
  record(
    'M',
    'Multi-document retrieval (answer uses both documents)',
    /\b14\b/.test(m.text) && /1[,.]?200/.test(m.text) && docsCited.has(pdfId) && docsCited.has(docxId),
    `${JSON.stringify(m.text.slice(0, 160))} | sources: ${[...docsCited].length}`,
    m.ms
  );

  // N–O. Delete and verify
  const del = await call('DELETE', `/documents/${pdfId}`, { token });
  record('N', 'Delete a document', del.status === 200, `status ${del.status}`);
  const o = await ask(token, kbId, 'How many days of paid annual leave do full-time employees get?');
  const stillCited = o.citations.some((c) => c.documentId === pdfId);
  record('O', 'Deleted content is no longer retrievable', !stillCited && !/\b26\b/.test(o.text), JSON.stringify(o.text.slice(0, 160)));

  // P. Cross-tenant isolation
  const other = await call('POST', '/auth/signup', {
    body: { email: `smoke_b_${stamp}@example.com`, password, fullName: 'Other Tenant', orgName: `Other ${stamp}` },
  });
  const tokenB = other.json?.data?.tokens?.accessToken;
  const peekDoc = await call('GET', `/documents/${docxId}`, { token: tokenB });
  const peekKb = await call('GET', `/knowledge-bases/${kbId}`, { token: tokenB });
  const peekConv = await call('GET', `/conversations/${m.conversationId}/messages`, { token: tokenB });
  const listB = await call('GET', '/knowledge-bases', { token: tokenB });
  const isolated =
    peekDoc.status === 404 && peekKb.status === 404 && peekConv.status === 404 &&
    !(listB.json?.data?.knowledgeBases || []).some((k) => k.id === kbId);
  record('P', 'Another tenant cannot access the documents', isolated, `doc ${peekDoc.status}, kb ${peekKb.status}, conversation ${peekConv.status}`);

  // API key access
  const key = await call('POST', '/api-keys', { token, body: { name: 'smoke key' } });
  const rawKey = key.json?.data?.rawKey;
  const viaKey = await call('GET', '/knowledge-bases', { apiKey: rawKey });
  await call('DELETE', `/api-keys/${key.json?.data?.apiKey?.id}`, { token });
  const afterRevoke = await call('GET', '/knowledge-bases', { apiKey: rawKey });
  record('Q', 'API key works, and is rejected after revocation', viaKey.status === 200 && afterRevoke.status === 401, `${viaKey.status} → ${afterRevoke.status}`);
}

main()
  .catch((err) => record('X', 'Unexpected error', false, err.message))
  .finally(() => {
    const summary = { baseUrl: BASE, ranAt: new Date().toISOString(), passed: results.length - failures, failed: failures, results };
    console.log(`\n${summary.passed} passed, ${summary.failed} failed`);
    if (REPORT) fs.writeFileSync(REPORT, JSON.stringify(summary, null, 2));
    process.exit(failures === 0 ? 0 : 1);
  });
