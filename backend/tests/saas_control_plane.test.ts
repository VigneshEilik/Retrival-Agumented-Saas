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

describe('Phase 5 SaaS Control Plane & Analytics Suite', () => {
  let tenant: any;

  beforeAll(async () => {
    tenant = await AuthService.signup(`control_${Date.now()}@example.com`, 'Pass123456!', 'SaaS Admin', 'Org Control Plane');
  });

  it('should fetch SaaS analytics overview and calculate token metrics', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${tenant.tokens.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.plan).toBe('FREE');
    expect(res.body.data.metrics).toBeDefined();
    expect(res.body.data.metrics.conversations).toBeGreaterThanOrEqual(0);
    expect(res.body.data.metrics.totalTokens).toBeGreaterThanOrEqual(0);
  });

  it('should enforce server-side knowledge base quota limits based on tenant subscription tier', async () => {
    // Create Knowledge Bases up to FREE plan limit (2 max)
    await KnowledgeBaseService.createKnowledgeBase(tenant.organization.id, 'KB 1');
    await KnowledgeBaseService.createKnowledgeBase(tenant.organization.id, 'KB 2');

    // Attempt to exceed FREE plan limit (3rd KB creation attempt should be blocked with 403 QUOTA_EXCEEDED)
    const res = await request(app)
      .post('/api/v1/knowledge-bases')
      .set('Authorization', `Bearer ${tenant.tokens.accessToken}`)
      .send({ name: 'KB 3 Exceeding Limit' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('QUOTA_EXCEEDED');
  });
});
