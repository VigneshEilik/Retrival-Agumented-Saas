'use client';

import { useState, useEffect, useCallback } from 'react';

export interface User {
  id: string;
  email: string;
  fullName: string;
  createdAt?: string;
}

export interface Organization {
  id: string;
  name: string;
  role?: string;
  slug?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSessionData {
  user: User;
  organization: Organization;
  tokens: AuthTokens;
}

const TOKEN_KEY = 'token';
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';
const ORG_KEY = 'organization';

const DEFAULT_USER: User = {
  id: 'usr-default-vignesh',
  email: 'vignesh@acme.com',
  fullName: 'Vignesh K.',
};

const DEFAULT_ORG: Organization = {
  id: '12d1ce11-a8a9-4d4a-99bc-0dc1b3d339aa',
  name: 'Acme Enterprise Corp',
  role: 'OWNER',
  slug: 'acme-enterprise-corp',
};

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredOrg(): Organization | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ORG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  const token = getStoredToken();
  return Boolean(token && token.trim().length > 10);
}

export function setAuthSession(data: AuthSessionData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, data.tokens.accessToken);
  localStorage.setItem(ACCESS_TOKEN_KEY, data.tokens.accessToken);
  if (data.tokens.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.tokens.refreshToken);
  }
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  localStorage.setItem(ORG_KEY, JSON.stringify(data.organization));

  // Also set cookie for SSR routing compatibility if desired
  document.cookie = `ragos_auth=true; path=/; max-age=604800; SameSite=Lax`;

  window.dispatchEvent(new Event('ragos-auth-changed'));
}

export async function clearAuthSession(): Promise<void> {
  if (typeof window === 'undefined') return;

  const refreshToken = getStoredRefreshToken();

  // Attempt backend logout (non-blocking if it fails)
  if (refreshToken) {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (err) {
      // Backend logout failed or unreachable, continue local purge
      console.warn('Logout endpoint notification failed:', err);
    }
  }

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ORG_KEY);

  // Clear cookie
  document.cookie = 'ragos_auth=; path=/; max-age=0; SameSite=Lax';

  window.dispatchEvent(new Event('ragos-auth-changed'));
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const syncAuth = useCallback(() => {
    const curToken = getStoredToken();
    const curUser = getStoredUser();
    const curOrg = getStoredOrg();

    setToken(curToken);
    setUser(curUser || (curToken ? DEFAULT_USER : null));
    setOrganization(curOrg || (curToken ? DEFAULT_ORG : null));
    setIsLoggedIn(Boolean(curToken));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    syncAuth();

    const handleAuthChange = () => {
      syncAuth();
    };

    window.addEventListener('ragos-auth-changed', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      window.removeEventListener('ragos-auth-changed', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, [syncAuth]);

  const logout = useCallback(async () => {
    await clearAuthSession();
    syncAuth();
  }, [syncAuth]);

  return {
    user: user || DEFAULT_USER,
    organization: organization || DEFAULT_ORG,
    token,
    isAuthenticated: isLoggedIn,
    isLoading,
    logout,
    syncAuth,
  };
}
