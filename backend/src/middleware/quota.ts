import { Request, Response, NextFunction } from 'express';
import { withTenantContext } from '../db';
import { PLAN_LIMITS, SubscriptionTier } from '../modules/organization/subscription.types';

export function checkQuota(metric: 'knowledge_bases' | 'documents' | 'agent_runs' | 'members') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.organizationId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const organizationId = req.user.organizationId;

    try {
      await withTenantContext(organizationId, async (client) => {
        // Fetch subscription plan
        const subRes = await client.query(
          `SELECT plan_tier FROM subscriptions WHERE organization_id = $1 AND status = 'ACTIVE'`,
          [organizationId]
        );

        const plan: SubscriptionTier = (subRes.rows[0]?.plan_tier as SubscriptionTier) || 'FREE';
        const limits = PLAN_LIMITS[plan];

        if (metric === 'knowledge_bases') {
          const countRes = await client.query(`SELECT COUNT(*)::int as count FROM knowledge_bases WHERE organization_id = $1`, [organizationId]);
          if (countRes.rows[0].count >= limits.maxKnowledgeBases) {
            throw new Error(`Knowledge base limit reached for ${plan} plan (${limits.maxKnowledgeBases} max). Upgrade your plan to create more.`);
          }
        } else if (metric === 'documents') {
          const countRes = await client.query(`SELECT COUNT(*)::int as count FROM documents WHERE organization_id = $1`, [organizationId]);
          if (countRes.rows[0].count >= limits.maxDocuments) {
            throw new Error(`Document limit reached for ${plan} plan (${limits.maxDocuments} max). Upgrade your plan to upload more.`);
          }
        } else if (metric === 'members') {
          const countRes = await client.query(`SELECT COUNT(*)::int as count FROM organization_members WHERE organization_id = $1`, [organizationId]);
          if (countRes.rows[0].count >= limits.maxMembers) {
            throw new Error(`Team member limit reached for ${plan} plan (${limits.maxMembers} max). Upgrade your plan to invite more members.`);
          }
        } else if (metric === 'agent_runs') {
          const countRes = await client.query(
            `SELECT COUNT(*)::int as count FROM agent_runs 
             WHERE organization_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)`,
            [organizationId]
          );
          if (countRes.rows[0].count >= limits.maxAgentRunsPerMonth) {
            throw new Error(`Monthly agent run quota reached for ${plan} plan (${limits.maxAgentRunsPerMonth}/mo max). Upgrade your plan.`);
          }
        }
      });

      return next();
    } catch (error: any) {
      return res.status(403).json({ error: { code: 'QUOTA_EXCEEDED', message: error.message } });
    }
  };
}
