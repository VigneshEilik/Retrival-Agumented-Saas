export type SubscriptionTier = 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';

export interface PlanQuotaLimits {
  maxKnowledgeBases: number;
  maxDocuments: number;
  maxAgentRunsPerMonth: number;
  maxTokensPerMonth: number;
  maxMembers: number;
}

export const PLAN_LIMITS: Record<SubscriptionTier, PlanQuotaLimits> = {
  FREE: {
    maxKnowledgeBases: 2,
    maxDocuments: 20,
    maxAgentRunsPerMonth: 100,
    maxTokensPerMonth: 100000,
    maxMembers: 3,
  },
  PRO: {
    maxKnowledgeBases: 10,
    maxDocuments: 250,
    maxAgentRunsPerMonth: 2500,
    maxTokensPerMonth: 2500000,
    maxMembers: 10,
  },
  BUSINESS: {
    maxKnowledgeBases: 50,
    maxDocuments: 2000,
    maxAgentRunsPerMonth: 25000,
    maxTokensPerMonth: 25000000,
    maxMembers: 50,
  },
  ENTERPRISE: {
    maxKnowledgeBases: 1000,
    maxDocuments: 100000,
    maxAgentRunsPerMonth: 1000000,
    maxTokensPerMonth: 1000000000,
    maxMembers: 1000,
  },
};
