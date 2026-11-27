'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiJson, ApiError, hasRealSession } from './api';

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface MeResponse {
  user: { userId: string; organizationId: string; role: Role; authType: string };
  profile: {
    id: string;
    email: string;
    fullName: string;
    createdAt: string;
    organization: { id: string; name: string; slug: string; role: Role } | null;
  } | null;
}

// One shared /auth/me request per session; reset whenever the stored session changes.
let mePromise: Promise<MeResponse> | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('ragos-auth-changed', () => {
    mePromise = null;
  });
}

export function fetchMe(force = false): Promise<MeResponse> {
  if (force || !mePromise) {
    mePromise = apiJson<MeResponse>('/api/v1/auth/me');
    mePromise.catch(() => {
      mePromise = null;
    });
  }
  return mePromise;
}

export const isAdminRole = (role?: string | null) => role === 'OWNER' || role === 'ADMIN';

/** The signed-in user's profile and role as reported by the backend (/auth/me). */
export function useMe() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async (force = false) => {
    if (!hasRealSession()) {
      setMe(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setMe(await fetchMe(force));
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener('ragos-auth-changed', onChange);
    return () => window.removeEventListener('ragos-auth-changed', onChange);
  }, [load]);

  return {
    me,
    role: (me?.user.role ?? null) as Role | null,
    userId: me?.user.userId ?? null,
    error,
    isLoading,
    reload: () => load(true),
  };
}
