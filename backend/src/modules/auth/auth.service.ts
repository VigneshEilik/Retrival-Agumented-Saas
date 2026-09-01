import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool, withTenantContext } from '../../db';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export interface UserDTO {
  id: string;
  email: string;
  fullName: string;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static async signup(email: string, password: string, fullName: string, orgName?: string) {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      throw new Error('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Create User
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, full_name) 
         VALUES ($1, $2, $3) 
         RETURNING id, email, full_name, created_at`,
        [email.toLowerCase().trim(), passwordHash, fullName]
      );
      const user = userRes.rows[0];

      // Set RLS session user context immediately for current transaction
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [user.id]);

      // 2. Create Default Organization
      const name = orgName || `${fullName.split(' ')[0]}'s Workspace`;
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');

      const orgRes = await client.query(
        `INSERT INTO organizations (name, slug) 
         VALUES ($1, $2) 
         RETURNING id, name, slug, created_at`,
        [name, slug]
      );
      const organization = orgRes.rows[0];

      // Set RLS session organization context
      await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [organization.id]);

      // 3. Set user as OWNER in Organization
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role) 
         VALUES ($1, $2, 'OWNER')`,
        [organization.id, user.id]
      );

      // 4. Initialize Free Subscription Plan
      await client.query(
        `INSERT INTO subscriptions (organization_id, plan_tier, max_documents, max_storage_mb, max_monthly_tokens, max_monthly_requests) 
         VALUES ($1, 'FREE', 20, 100, 1000000, 1000)`,
        [organization.id]
      );

      // 5. Create Audit Log
      await client.query(
        `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, 'USER_SIGNUP', 'user', $3, $4)`,
        [organization.id, user.id, user.id, JSON.stringify({ email: user.email, orgName: organization.name })]
      );

      await client.query('COMMIT');

      const tokens = await this.generateTokens(user.id, organization.id, 'OWNER');

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          createdAt: user.created_at,
        },
        organization,
        tokens,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async login(email: string, password: string) {
    const userRes = await pool.query(
      `SELECT id, email, password_hash, full_name, created_at FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (userRes.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = userRes.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new Error('Invalid email or password');
    }

    // Get primary organization membership with user RLS context
    const memberRows = await withTenantContext(null, async (client) => {
      const res = await client.query(
        `SELECT om.organization_id, om.role, o.name as org_name 
         FROM organization_members om
         JOIN organizations o ON o.id = om.organization_id
         WHERE om.user_id = $1 
         ORDER BY om.created_at ASC LIMIT 1`,
        [user.id]
      );
      return res.rows;
    }, user.id);

    if (memberRows.length === 0) {
      throw new Error('User does not belong to any organization');
    }

    const membership = memberRows[0];
    const tokens = await this.generateTokens(user.id, membership.organization_id, membership.role);

    // Record login audit log with tenant RLS context
    await withTenantContext(membership.organization_id, async (client) => {
      await client.query(
        `INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id)
         VALUES ($1, $2, 'USER_LOGIN', 'user', $3)`,
        [membership.organization_id, user.id, user.id]
      );
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        createdAt: user.created_at,
      },
      organization: {
        id: membership.organization_id,
        name: membership.org_name,
        role: membership.role,
      },
      tokens,
    };
  }

  static async refreshTokenRotation(refreshToken: string) {
    let payload: any;
    try {
      payload = jwt.verify(refreshToken, config.jwtRefreshSecret);
    } catch (e) {
      throw new Error('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);

    const tokenRes = await pool.query(
      `SELECT id, user_id, revoked FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash]
    );

    if (tokenRes.rows.length === 0 || tokenRes.rows[0].revoked) {
      throw new Error('Refresh token revoked or invalid');
    }

    const tokenRecord = tokenRes.rows[0];

    // Revoke old refresh token
    await pool.query(
      `UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1`,
      [tokenRecord.id]
    );

    // Fetch user & active organization membership
    const userRes = await pool.query(`SELECT id, email, full_name FROM users WHERE id = $1`, [payload.userId]);
    if (userRes.rows.length === 0) {
      throw new Error('User not found');
    }

    const memberRows = await withTenantContext(payload.organizationId, async (client) => {
      const res = await client.query(
        `SELECT organization_id, role FROM organization_members WHERE user_id = $1 AND organization_id = $2`,
        [payload.userId, payload.organizationId]
      );
      return res.rows;
    }, payload.userId);

    if (memberRows.length === 0) {
      throw new Error('Organization membership invalid');
    }

    const membership = memberRows[0];
    const newTokens = await this.generateTokens(payload.userId, membership.organization_id, membership.role);

    return newTokens;
  }

  static async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await pool.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [tokenHash]);
  }

  private static async generateTokens(userId: string, organizationId: string, role: string): Promise<AuthTokens> {
    const accessToken = jwt.sign(
      { userId, organizationId, role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    const refreshToken = jwt.sign(
      { userId, organizationId, jti: crypto.randomBytes(16).toString('hex') },
      config.jwtRefreshSecret,
      { expiresIn: config.jwtRefreshExpiresIn as any }
    );

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );

    return { accessToken, refreshToken };
  }
}
