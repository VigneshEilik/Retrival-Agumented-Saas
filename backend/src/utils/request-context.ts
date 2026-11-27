import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request-scoped context (who is acting), propagated through async calls without
 * threading parameters through every service. withTenantContext() reads it to set
 * app.current_user_id, which audit_logs.user_id uses as its default (migration 006),
 * so every audit entry records the acting user automatically.
 */
export interface RequestContext {
  userId: string | null;
  apiKeyId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function currentUserId(): string | null {
  return requestContext.getStore()?.userId ?? null;
}
