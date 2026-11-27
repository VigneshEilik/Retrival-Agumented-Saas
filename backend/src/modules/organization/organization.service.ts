import { pool, withTenantContext } from '../../db';

export class OrganizationService {
  static async getOrganization(organizationId: string) {
    return withTenantContext(organizationId, async (client) => {
      const orgRes = await client.query(
        `SELECT id, name, slug, created_at, updated_at FROM organizations WHERE id = $1`,
        [organizationId]
      );
      if (orgRes.rows.length === 0) {
        throw new Error('Organization not found');
      }

      const subRes = await client.query(
        `SELECT plan_tier, max_documents, max_storage_mb, max_monthly_tokens, max_monthly_requests, status
         FROM subscriptions WHERE organization_id = $1`,
        [organizationId]
      );

      return {
        organization: orgRes.rows[0],
        subscription: subRes.rows[0] || null,
      };
    });
  }

  static async updateOrganization(organizationId: string, name: string) {
    return withTenantContext(organizationId, async (client) => {
      const res = await client.query(
        `UPDATE organizations SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name, slug, updated_at`,
        [name, organizationId]
      );
      return res.rows[0];
    });
  }

  static async listMembers(organizationId: string) {
    return withTenantContext(organizationId, async (client) => {
      const res = await client.query(
        `SELECT om.id as membership_id, om.role, om.created_at, u.id as user_id, u.email, u.full_name
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.organization_id = $1
         ORDER BY om.created_at ASC`,
        [organizationId]
      );
      return res.rows;
    });
  }

  static async addMember(organizationId: string, email: string, role: 'ADMIN' | 'MEMBER' | 'VIEWER') {
    const userRes = await pool.query(`SELECT id, email, full_name FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
    if (userRes.rows.length === 0) {
      throw new Error('User with this email not found. Please ask them to register first.');
    }
    const user = userRes.rows[0];

    return withTenantContext(organizationId, async (client) => {
      const existing = await client.query(
        `SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, user.id]
      );
      if (existing.rows.length > 0) {
        throw new Error('User is already a member of this organization');
      }

      const memberRes = await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, $3)
         RETURNING id, role, created_at`,
        [organizationId, user.id, role]
      );

      await client.query(
        `INSERT INTO audit_logs (organization_id, action, resource_type, resource_id, details)
         VALUES ($1, 'MEMBER_ADDED', 'user', $2, $3)`,
        [organizationId, user.id, JSON.stringify({ email: user.email, role })]
      );

      return {
        membershipId: memberRes.rows[0].id,
        role: memberRes.rows[0].role,
        user,
      };
    });
  }

  static async updateMemberRole(organizationId: string, targetUserId: string, newRole: 'ADMIN' | 'MEMBER' | 'VIEWER') {
    return withTenantContext(organizationId, async (client) => {
      const current = await client.query(
        `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, targetUserId]
      );
      if (current.rows.length === 0) throw new Error('Member not found');
      if (current.rows[0].role === 'OWNER') throw new Error("The organization OWNER's role cannot be changed");

      const res = await client.query(
        `UPDATE organization_members SET role = $1 WHERE organization_id = $2 AND user_id = $3 RETURNING id, role`,
        [newRole, organizationId, targetUserId]
      );
      if (res.rows.length === 0) {
        throw new Error('Member membership record not found');
      }

      await client.query(
        `INSERT INTO audit_logs (organization_id, action, resource_type, resource_id, details)
         VALUES ($1, 'ROLE_CHANGED', 'user', $2, $3)`,
        [organizationId, targetUserId, JSON.stringify({ newRole })]
      );

      return res.rows[0];
    });
  }

  static async removeMember(organizationId: string, targetUserId: string) {
    return withTenantContext(organizationId, async (client) => {
      const ownerCheck = await client.query(
        `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, targetUserId]
      );
      if (ownerCheck.rows.length === 0) {
        throw new Error('Member not found');
      }
      if (ownerCheck.rows[0].role === 'OWNER') {
        throw new Error('Cannot remove the organization OWNER');
      }

      await client.query(
        `DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, targetUserId]
      );

      await client.query(
        `INSERT INTO audit_logs (organization_id, action, resource_type, resource_id)
         VALUES ($1, 'MEMBER_REMOVED', 'user', $2)`,
        [organizationId, targetUserId]
      );

      return { success: true };
    });
  }
}
