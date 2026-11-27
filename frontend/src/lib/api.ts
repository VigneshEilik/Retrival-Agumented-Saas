'use client';

import { getStoredToken, getStoredRefreshToken } from './auth';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** True when a backend-issued JWT (three dot-separated parts) is stored. */
export function hasRealSession(): boolean {
  const token = getStoredToken();
  return Boolean(token && token.split('.').length === 3);
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const json = await res.json();
      const tokens = json?.data?.tokens;
      if (!tokens?.accessToken) return false;
      localStorage.setItem('token', tokens.accessToken);
      localStorage.setItem('accessToken', tokens.accessToken);
      if (tokens.refreshToken) localStorage.setItem('refreshToken', tokens.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshInFlight = null), 0);
    }
  })();
  return refreshInFlight;
}

/**
 * fetch() against the backend with the stored bearer token.
 * On a 401 it refreshes the access token once and retries.
 * Returns the raw Response so callers can stream (SSE) if needed.
 */
export async function apiFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getStoredToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && retry && (await refreshAccessToken())) {
    return apiFetch(path, init, false);
  }
  return res;
}

/** apiFetch + JSON parsing + `{ data }` unwrapping, throwing ApiError on failure. */
export async function apiJson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    throw new ApiError(json?.error?.message || `Request failed (${res.status})`, res.status, json?.error?.code);
  }
  return (json?.data ?? json) as T;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID_RE.test(value);

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  const data = await apiJson<{ knowledgeBases: KnowledgeBase[] }>('/api/v1/knowledge-bases');
  return data.knowledgeBases || [];
}

/** Returns the organisation's first knowledge base, creating a default one if none exist. */
export async function getOrCreateDefaultKnowledgeBase(): Promise<KnowledgeBase> {
  const existing = await listKnowledgeBases();
  if (existing.length > 0) return existing[0];
  return apiJson<KnowledgeBase>('/api/v1/knowledge-bases', {
    method: 'POST',
    body: JSON.stringify({ name: 'Default Knowledge Base', description: 'Created automatically' }),
  });
}
