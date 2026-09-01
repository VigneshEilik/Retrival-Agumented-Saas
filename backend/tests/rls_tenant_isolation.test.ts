import { pool, runMigrations, withTenantContext } from '../src/db';
import { AuthService } from '../src/modules/auth/auth.service';

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

describe('PostgreSQL Row-Level Security (RLS) Tenant Isolation Test', () => {
  let tenantA: any;
  let tenantB: any;

  beforeAll(async () => {
    tenantA = await AuthService.signup(`orgA_${Date.now()}@example.com`, 'Pass123456!', 'Alice Tenant A', 'Org A');
    tenantB = await AuthService.signup(`orgB_${Date.now()}@example.com`, 'Pass123456!', 'Bob Tenant B', 'Org B');
  });

  it('should enforce PostgreSQL RLS preventing Tenant A session from reading Tenant B organization members', async () => {
    const orgAId = tenantA.organization.id;
    const orgBId = tenantB.organization.id;

    // Run query under Tenant A RLS context
    const membersUnderOrgAContext = await withTenantContext(orgAId, async (client) => {
      // Query attempts to read org_members across the entire table without explicit WHERE clause
      const res = await client.query(`SELECT organization_id, user_id, role FROM organization_members`);
      return res.rows;
    });

    // RLS Policy MUST automatically restrict rows to ONLY Org A members
    expect(membersUnderOrgAContext.length).toBeGreaterThan(0);
    const leakedOrgBMembers = membersUnderOrgAContext.filter((m) => m.organization_id === orgBId);
    expect(leakedOrgBMembers).toHaveLength(0);
  });

  it('should enforce PostgreSQL RLS preventing Tenant A session from reading Tenant B subscriptions', async () => {
    const orgAId = tenantA.organization.id;
    const orgBId = tenantB.organization.id;

    const subscriptionsUnderOrgAContext = await withTenantContext(orgAId, async (client) => {
      const res = await client.query(`SELECT organization_id, plan_tier FROM subscriptions`);
      return res.rows;
    });

    expect(subscriptionsUnderOrgAContext.length).toBe(1);
    expect(subscriptionsUnderOrgAContext[0].organization_id).toBe(orgAId);

    const leakedOrgBSub = subscriptionsUnderOrgAContext.find((s) => s.organization_id === orgBId);
    expect(leakedOrgBSub).toBeUndefined();
  });
});
