import crypto from 'crypto';
import { withTenantContext } from '../../db';

export class ApiKeyService {
  static async createApiKey(organizationId: string, name: string, expiresInDays?: number) {
    const rawKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    const keyPrefix = rawKey.substring(0, 10);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    let expiresAt: Date | null = null;
    if (expiresInDays) {
      expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    }

    return withTenantContext(organizationId, async (client) => {
      const res = await client.query(
        `INSERT INTO api_keys (organization_id, name, key_hash, key_prefix, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, key_prefix, expires_at, created_at`,
        [organizationId, name, keyHash, keyPrefix, expiresAt]
      );

      await client.query(
        `INSERT INTO audit_logs (organization_id, action, resource_type, resource_id, details)
         VALUES ($1, 'API_KEY_CREATED', 'api_key', $2, $3)`,
        [organizationId, res.rows[0].id, JSON.stringify({ name, keyPrefix })]
      );

      return {
        apiKey: res.rows[0],
        rawKey, // Returned ONLY once upon creation!
      };
    });
  }

  static async listApiKeys(organizationId: string) {
    return withTenantContext(organizationId, async (client) => {
      const res = await client.query(
        `SELECT id, name, key_prefix, last_used_at, expires_at, revoked_at, created_at
         FROM api_keys
         WHERE organization_id = $1
         ORDER BY created_at DESC`,
        [organizationId]
      );
      return res.rows;
    });
  }

  static async revokeApiKey(organizationId: string, apiKeyId: string) {
    return withTenantContext(organizationId, async (client) => {
      const res = await client.query(
        `UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP
         WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL
         RETURNING id, name, key_prefix, revoked_at`,
        [organizationId, apiKeyId]
      );

      if (res.rows.length === 0) {
        throw new Error('API Key not found or already revoked');
      }

      await client.query(
        `INSERT INTO audit_logs (organization_id, action, resource_type, resource_id)
         VALUES ($1, 'API_KEY_REVOKED', 'api_key', $2)`,
        [organizationId, apiKeyId]
      );

      return res.rows[0];
    });
  }
}
