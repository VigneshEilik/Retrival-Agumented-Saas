import { withTenantContext } from '../../db';
import { PLAN_LIMITS, SubscriptionTier } from '../organization/subscription.types';

export interface BudgetCheckOptions {
  organizationId: string;
  estimatedPromptTokens?: number;
  estimatedCompletionTokens?: number;
  agentStepsCount?: number;
  maxCostPerRequestDollars?: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  code?: 'AGENT_STEP_LIMIT' | 'LLM_BUDGET_EXCEEDED' | 'QUOTA_EXCEEDED';
  reason?: string;
  estimatedCostDollars?: number;
}

export class CostGuardService {
  private static MAX_INPUT_TOKENS_PER_REQ = 50000;
  private static MAX_OUTPUT_TOKENS_PER_REQ = 8000;
  private static MAX_REQUEST_COST_DOLLARS = 0.50; // $0.50 max per request
  private static MAX_AGENT_STEPS = 5;

  public static async evaluateBudget(options: BudgetCheckOptions): Promise<BudgetCheckResult> {
    const { organizationId, estimatedPromptTokens = 0, estimatedCompletionTokens = 0, agentStepsCount = 0, maxCostPerRequestDollars = this.MAX_REQUEST_COST_DOLLARS } = options;

    // 1. Enforce agent step cap
    if (agentStepsCount > this.MAX_AGENT_STEPS) {
      return {
        allowed: false,
        code: 'AGENT_STEP_LIMIT',
        reason: `Agent step count (${agentStepsCount}) exceeded maximum limit of ${this.MAX_AGENT_STEPS} steps per run.`,
      };
    }

    // 2. Enforce request token limits
    if (estimatedPromptTokens > this.MAX_INPUT_TOKENS_PER_REQ) {
      return {
        allowed: false,
        code: 'LLM_BUDGET_EXCEEDED',
        reason: `Input token count (${estimatedPromptTokens}) exceeded maximum allowed ${this.MAX_INPUT_TOKENS_PER_REQ} per request.`,
      };
    }

    if (estimatedCompletionTokens > this.MAX_OUTPUT_TOKENS_PER_REQ) {
      return {
        allowed: false,
        code: 'LLM_BUDGET_EXCEEDED',
        reason: `Output token limit (${estimatedCompletionTokens}) exceeded maximum allowed ${this.MAX_OUTPUT_TOKENS_PER_REQ} per response.`,
      };
    }

    // 3. Calculate estimated request cost ($0.0005/1k prompt, $0.0015/1k completion)
    const estimatedCost = (estimatedPromptTokens / 1000) * 0.0005 + (estimatedCompletionTokens / 1000) * 0.0015;

    if (estimatedCost > maxCostPerRequestDollars) {
      return {
        allowed: false,
        code: 'LLM_BUDGET_EXCEEDED',
        reason: `Request cost ($${estimatedCost.toFixed(4)}) exceeds maximum allowed per-request budget ($${maxCostPerRequestDollars.toFixed(2)}).`,
        estimatedCostDollars: parseFloat(estimatedCost.toFixed(4)),
      };
    }

    // 4. Verify organization monthly budget cap in database
    return await withTenantContext(organizationId, async (client) => {
      const subRes = await client.query(`SELECT plan_tier FROM subscriptions WHERE organization_id = $1 AND status = 'ACTIVE'`, [organizationId]);
      const plan: SubscriptionTier = (subRes.rows[0]?.plan_tier as SubscriptionTier) || 'FREE';

      const usageRes = await client.query(
        `SELECT COALESCE(SUM(prompt_tokens), 0)::int as prompt_total, COALESCE(SUM(completion_tokens), 0)::int as completion_total
         FROM messages WHERE organization_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)`,
        [organizationId]
      );

      const promptTotal = usageRes.rows[0].prompt_total;
      const completionTotal = usageRes.rows[0].completion_total;
      const totalTokens = promptTotal + completionTotal;
      const maxAllowedTokens = PLAN_LIMITS[plan].maxTokensPerMonth;

      if (totalTokens >= maxAllowedTokens) {
        return {
          allowed: false,
          code: 'QUOTA_EXCEEDED',
          reason: `Monthly token budget reached for ${plan} plan (${maxAllowedTokens.toLocaleString()} tokens/mo max).`,
          estimatedCostDollars: parseFloat(estimatedCost.toFixed(4)),
        };
      }

      return {
        allowed: true,
        estimatedCostDollars: parseFloat(estimatedCost.toFixed(4)),
      };
    });
  }
}
