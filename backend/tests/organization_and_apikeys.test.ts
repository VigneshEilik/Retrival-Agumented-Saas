import request from 'supertest';
import { app } from '../src/index';
import { pool, runMigrations } from '../src/db';
import { AuthService } from '../src/modules/auth/auth.service';

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

describe('Organization Management & API Keys API', () => {
  let ownerToken: string;
  let ownerOrgId: string;
  let memberUserEmail = `member_${Date.now()}@example.com`;

  beforeAll(async () => {
    const signupRes = await AuthService.signup(`owner_${Date.now()}@example.com`, 'SecurePass123!', 'Owner User', 'TechCorp');
    ownerToken = signupRes.tokens.accessToken;
    ownerOrgId = signupRes.organization.id;

    // Create a standalone user to add as member
    await AuthService.signup(memberUserEmail, 'SecurePass123!', 'Member User', 'MemberCorp');
  });

  it('should fetch organization details and active subscription plan', async () => {
    const res = await request(app)
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.organization.name).toBe('TechCorp');
    expect(res.body.data.subscription.plan_tier).toBe('FREE');
  });

  it('should list organization members', async () => {
    const res = await request(app)
      .get('/api/v1/organizations/members')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.members.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.members[0].role).toBe('OWNER');
  });

  it('should add a member to the organization', async () => {
    const res = await request(app)
      .post('/api/v1/organizations/members')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: memberUserEmail,
        role: 'MEMBER',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('MEMBER');
  });

  it('should create an API key and return rawKey once', async () => {
    const res = await request(app)
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Production Worker Key',
        expiresInDays: 30,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('rawKey');
    expect(res.body.data.rawKey).toMatch(/^sk_live_/);
    expect(res.body.data.apiKey.name).toBe('Production Worker Key');
  });

  it('should list created API keys without exposing raw keys', async () => {
    const res = await request(app)
      .get('/api/v1/api-keys')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.apiKeys.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.apiKeys[0]).not.toHaveProperty('rawKey');
    expect(res.body.data.apiKeys[0]).toHaveProperty('key_prefix');
  });

  it('should fetch audit logs for tenant operations', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.logs.length).toBeGreaterThanOrEqual(1);
  });
});
