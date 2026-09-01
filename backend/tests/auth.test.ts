import request from 'supertest';
import { app } from '../src/index';
import { pool, runMigrations } from '../src/db';

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

describe('Authentication & Session Security API', () => {
  const testEmail = `user_${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123!';
  const testName = 'Test Engineer';

  let accessToken: string;
  let refreshToken: string;

  it('should register a new user and create default organization', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: testEmail,
        password: testPassword,
        fullName: testName,
        orgName: 'Acme Test Corp',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('user');
    expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
    expect(res.body.data).toHaveProperty('tokens');
    expect(res.body.data.tokens).toHaveProperty('accessToken');
    expect(res.body.data.tokens).toHaveProperty('refreshToken');

    accessToken = res.body.data.tokens.accessToken;
    refreshToken = res.body.data.tokens.refreshToken;
  });

  it('should reject signup with duplicate email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: testEmail,
        password: testPassword,
        fullName: testName,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SIGNUP_FAILED');
  });

  it('should authenticate user and return valid tokens on login', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
    expect(res.body.data.organization.name).toBe('Acme Test Corp');
    expect(res.body.data.organization.role).toBe('OWNER');
  });

  it('should perform refresh token rotation', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.tokens).toHaveProperty('accessToken');
    expect(res.body.data.tokens).toHaveProperty('refreshToken');

    // Attempting to reuse revoked refresh token should fail
    const reuseRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.code).toBe('REFRESH_FAILED');
  });

  it('should fetch user context on authenticated GET /me', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user).toHaveProperty('userId');
    expect(res.body.data.user.role).toBe('OWNER');
  });
});
