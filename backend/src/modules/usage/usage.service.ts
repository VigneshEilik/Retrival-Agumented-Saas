import { withTenantContext } from '../../db';
import { logger } from '../../utils/logger';

export type UsageMetric =
  | 'rag_query'
  | 'llm_prompt_tokens'
  | 'llm_completion_tokens'
  | 'document_ingested'
  | 'chunks_embedded'
  | 'storage_bytes';

/**
 * Append-only usage ledger (usage_ledger table). Feeds analytics today and
 * billing later. Recording is best-effort: a metering failure must never fail
 * the user's request, so errors are logged and swallowed.
 */
export class UsageService {
  static async record(
    organizationId: string,
    entries: Array<{ metric: UsageMetric; quantity: number; resourceId?: string }>
  ): Promise<void> {
    const rows = entries.filter((e) => Number.isFinite(e.quantity) && e.quantity > 0);
    if (rows.length === 0) return;
    try {
      await withTenantContext(organizationId, async (client) => {
        const values: any[] = [];
        const placeholders = rows.map((e, i) => {
          values.push(organizationId, e.metric, Math.round(e.quantity), e.resourceId ?? null);
          const b = i * 4;
          return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4})`;
        });
        await client.query(
          `INSERT INTO usage_ledger (organization_id, metric_type, quantity, resource_id) VALUES ${placeholders.join(', ')}`,
          values
        );
      });
    } catch (err) {
      logger.warn({ err: (err as Error).message, organizationId }, 'Failed to record usage');
    }
  }

  /** Totals per metric for the current calendar month. */
  static async monthToDate(organizationId: string): Promise<Record<string, number>> {
    return withTenantContext(organizationId, async (client) => {
      const res = await client.query(
        `SELECT metric_type, COALESCE(SUM(quantity), 0)::bigint AS total
           FROM usage_ledger
          WHERE organization_id = $1 AND "timestamp" >= date_trunc('month', NOW())
          GROUP BY metric_type`,
        [organizationId]
      );
      return Object.fromEntries(res.rows.map((r: any) => [r.metric_type, Number(r.total)]));
    });
  }
}
