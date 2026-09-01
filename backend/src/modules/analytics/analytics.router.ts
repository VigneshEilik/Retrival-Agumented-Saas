import { Router, Request, Response } from 'express';
import { withTenantContext } from '../../db';
import { authenticate } from '../../middleware/auth';
import { PLAN_LIMITS, SubscriptionTier } from '../organization/subscription.types';
import { logger } from '../../utils/logger';

const router = Router();
router.use(authenticate);

router.get('/analytics/overview', async (req: Request, res: Response) => {
  try {
    const organizationId = req.user!.organizationId;

    const data = await withTenantContext(organizationId, async (client) => {
      const convRes = await client.query(`SELECT COUNT(*)::int as total FROM conversations WHERE organization_id = $1`, [organizationId]);
      const msgRes = await client.query(`SELECT COUNT(*)::int as total, COALESCE(SUM(prompt_tokens), 0)::int as prompt_tokens, COALESCE(SUM(completion_tokens), 0)::int as completion_tokens FROM messages WHERE organization_id = $1`, [organizationId]);
      const docRes = await client.query(`SELECT COUNT(*)::int as total FROM documents WHERE organization_id = $1`, [organizationId]);
      const agentRes = await client.query(`SELECT COUNT(*)::int as total FROM agent_runs WHERE organization_id = $1`, [organizationId]);
      const subRes = await client.query(`SELECT plan_tier FROM subscriptions WHERE organization_id = $1 AND status = 'ACTIVE'`, [organizationId]);

      const plan: SubscriptionTier = (subRes.rows[0]?.plan_tier as SubscriptionTier) || 'FREE';
      const promptTokens = msgRes.rows[0].prompt_tokens;
      const completionTokens = msgRes.rows[0].completion_tokens;
      const totalTokens = promptTokens + completionTokens;

      const estimatedCost = (promptTokens / 1000) * 0.0005 + (completionTokens / 1000) * 0.0015;

      return {
        plan,
        planLimits: PLAN_LIMITS[plan],
        metrics: {
          conversations: convRes.rows[0].total,
          messages: msgRes.rows[0].total,
          documents: docRes.rows[0].total,
          agentRuns: agentRes.rows[0].total,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostMonthly: parseFloat(estimatedCost.toFixed(4)),
        },
      };
    });

    return res.status(200).json({ data });
  } catch (error: any) {
    logger.error({ error }, 'Analytics fetch failed');
    return res.status(500).json({ error: { code: 'ANALYTICS_FAILED', message: error.message } });
  }
});

export const analyticsRouter = router;
