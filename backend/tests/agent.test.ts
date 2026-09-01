import request from 'supertest';
import { app } from '../src/index';
import { pool, runMigrations, withTenantContext } from '../src/db';
import { AuthService } from '../src/modules/auth/auth.service';
import { KnowledgeBaseService } from '../src/modules/knowledge-base/knowledge-base.service';
import { ToolRegistry } from '../src/modules/agent/tools/tool.registry';
import { RAGSearchTool } from '../src/modules/agent/tools/rag_search.tool';
import { CalculatorTool } from '../src/modules/agent/tools/calculator.tool';
import { AgentOrchestrator } from '../src/modules/agent/orchestrator/agent.orchestrator';

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

describe('Phase 4 Production Agent & Tool Calling Suite', () => {
  let tenantA: any;
  let tenantB: any;
  let kbA: any;

  beforeAll(async () => {
    tenantA = await AuthService.signup(`agent_a_${Date.now()}@example.com`, 'Pass123456!', 'Tenant Agent Admin', 'Org Agent A');
    tenantB = await AuthService.signup(`agent_b_${Date.now()}@example.com`, 'Pass123456!', 'Tenant B Admin', 'Org Agent B');

    kbA = await KnowledgeBaseService.createKnowledgeBase(tenantA.organization.id, 'Agent Knowledge Base');

    // Seed document for RAG tool search under Tenant A RLS context
    await withTenantContext(tenantA.organization.id, async (client) => {
      const docRes = await client.query(
        `INSERT INTO documents (organization_id, knowledge_base_id, title) VALUES ($1, $2, 'Pricing Sheet.pdf') RETURNING id`,
        [tenantA.organization.id, kbA.id]
      );
      const verRes = await client.query(
        `INSERT INTO document_versions (organization_id, document_id, version, file_key, file_type, file_size_bytes, status)
         VALUES ($1, $2, 1, 'key', 'application/pdf', 100, 'READY') RETURNING id`,
        [tenantA.organization.id, docRes.rows[0].id]
      );
      await client.query(
        `INSERT INTO document_chunks (organization_id, knowledge_base_id, document_id, document_version_id, chunk_index, content, metadata)
         VALUES ($1, $2, $3, $4, 0, 'Enterprise tier license cost is ₹4,500 per user per month.', '{"pageNumber": 1}')`,
        [tenantA.organization.id, kbA.id, docRes.rows[0].id, verRes.rows[0].id]
      );
    });
  });

  it('should enforce server-side tool permission checks in ToolRegistry', () => {
    const registry = new ToolRegistry();
    registry.registerTool(new RAGSearchTool());
    registry.registerTool(new CalculatorTool());

    const allowedForViewer = registry.listAllowedTools('VIEWER');
    expect(allowedForViewer.length).toBeGreaterThan(0);

    expect(() =>
      registry.executeTool('NonExistentTool', { organizationId: 'o', userId: 'u', userRole: 'MEMBER' }, {})
    ).rejects.toThrow('is not registered');
  });

  it('should execute multi-step agent run calling tools and recording steps in database', async () => {
    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.run({
      organizationId: tenantA.organization.id,
      userId: tenantA.user.id,
      userRole: tenantA.user.role,
      knowledgeBaseId: kbA.id,
      prompt: 'Find the enterprise tier license cost and calculate the total for 10 users.',
      maxSteps: 5,
    });

    expect(result.runId).toBeDefined();
    expect(result.status).toBe('FINAL_RESPONSE');
    expect(result.steps.length).toBeGreaterThan(0);

    // Verify database record under tenant RLS context
    const dbSteps = await withTenantContext(tenantA.organization.id, async (client) => {
      const res = await client.query(`SELECT id, state FROM agent_steps WHERE agent_run_id = $1`, [result.runId]);
      return res.rows;
    });

    expect(dbSteps.length).toBe(result.steps.length);
  });

  it('should list allowed tools via GET /api/v1/agent/tools endpoint', async () => {
    const res = await request(app)
      .get('/api/v1/agent/tools')
      .set('Authorization', `Bearer ${tenantA.tokens.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tools.length).toBeGreaterThan(0);
    expect(res.body.data.tools[0].name).toBe('RAGSearchTool');
  });

  it('should enforce tenant isolation preventing Tenant B from accessing Tenant A agent run details', async () => {
    const orchestrator = new AgentOrchestrator();
    const run = await orchestrator.run({
      organizationId: tenantA.organization.id,
      userId: tenantA.user.id,
      userRole: tenantA.user.role,
      knowledgeBaseId: kbA.id,
      prompt: 'Calculate 100 * 5',
    });

    const res = await request(app)
      .get(`/api/v1/agent/runs/${run.runId}`)
      .set('Authorization', `Bearer ${tenantB.tokens.accessToken}`);

    expect(res.status).toBe(404);
  });
});
