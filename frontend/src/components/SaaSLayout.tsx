'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Database,
  MessageSquare,
  LayoutDashboard,
  Users,
  Key,
  ShieldCheck,
  Settings,
  Command,
  Menu,
  X,
  ChevronRight,
  Search,
  LogOut,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { LoadingState } from './ui/LoadingState';
import { useAuth, clearAuthSession, updateStoredOrganization } from '@/lib/auth';
import { apiJson, hasRealSession } from '@/lib/api';
import { useMe, isAdminRole } from '@/lib/session';

interface SaaSLayoutProps {
  children: React.ReactNode;
}

export function SaaSLayout({ children }: SaaSLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, organization, token, isLoading: isAuthLoading, logout } = useAuth();
  const { me, role, error: meError } = useMe();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Organization rename (OWNER/ADMIN) inside the settings modal.
  const [orgNameDraft, setOrgNameDraft] = useState('');
  const [orgNameError, setOrgNameError] = useState<string | null>(null);
  const [orgNameSaved, setOrgNameSaved] = useState(false);
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  const hasSession = !isAuthLoading && Boolean(token) && hasRealSession();

  // Unauthenticated visitors (or a non-JWT leftover session) are sent to the sign-in page.
  useEffect(() => {
    if (isAuthLoading) return;
    if (!hasRealSession()) router.replace('/login');
  }, [isAuthLoading, token, router]);

  // A 401 from /auth/me (after the automatic refresh attempt) means the session is dead.
  useEffect(() => {
    if (meError && (meError as any).status === 401) {
      clearAuthSession().finally(() => router.replace('/login'));
    }
  }, [meError, router]);

  const displayName = me?.profile?.fullName || user?.fullName || '';
  const displayEmail = me?.profile?.email || user?.email || '';
  const orgName = me?.profile?.organization?.name || organization?.name || '';
  const avatarInitial = (displayName || displayEmail || '?')[0].toUpperCase();

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await logout();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setIsSettingsOpen(false);
      setIsSigningOut(false);
      router.push('/login');
    }
  };

  const openSettings = () => {
    setOrgNameDraft(orgName);
    setOrgNameError(null);
    setOrgNameSaved(false);
    setIsSettingsOpen(true);
  };

  const handleOrgRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = orgNameDraft.trim();
    setOrgNameSaved(false);
    if (!name) {
      setOrgNameError('Organization name is required.');
      return;
    }
    if (name.length > 255) {
      setOrgNameError('Organization name must be at most 255 characters.');
      return;
    }
    setIsSavingOrg(true);
    setOrgNameError(null);
    try {
      const updated = await apiJson<{ name?: string }>('/api/v1/organizations', {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      updateStoredOrganization({ name: updated?.name || name });
      setOrgNameSaved(true);
    } catch (err: any) {
      setOrgNameError(err.message || 'Could not rename the organization.');
    } finally {
      setIsSavingOrg(false);
    }
  };

  const commandPaletteItems = [
    { title: 'Dashboard', category: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { title: 'Knowledge Bases', category: 'Knowledge', href: '/knowledge-bases', icon: Database },
    { title: 'Chat Assistant', category: 'RAG', href: '/chat', icon: MessageSquare },
    { title: 'Team & Roles', category: 'Workspace', href: '/team', icon: Users },
    { title: 'API Keys', category: 'Security', href: '/api-keys', icon: Key },
    { title: 'Audit Log', category: 'Security', href: '/audit', icon: ShieldCheck },
  ];

  // Global Ctrl/Cmd + K keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredCommands = commandPaletteItems.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const mainNavItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Knowledge Bases', href: '/knowledge-bases', icon: Database },
    { name: 'Chat Assistant', href: '/chat', icon: MessageSquare },
  ];

  const adminNavItems = [
    { name: 'Team & Roles', href: '/team', icon: Users },
    { name: 'API Keys', href: '/api-keys', icon: Key },
    { name: 'Audit Log', href: '/audit', icon: ShieldCheck },
  ];

  const getBreadcrumbName = (path: string) => {
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/knowledge-bases') return 'Knowledge Bases';
    if (path.startsWith('/knowledge-bases/')) return 'Documents';
    if (path === '/chat') return 'Chat Assistant';
    if (path === '/agent-builder' || path === '/agent') return 'Agents';
    if (path === '/team') return 'Team & Roles';
    if (path === '/api-keys') return 'API Keys';
    if (path === '/audit') return 'Audit Log';
    return 'Workspace';
  };

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <LoadingState message="Checking your session..." />
      </div>
    );
  }

  const renderNavLink = (item: { name: string; href: string; icon: React.ElementType }) => {
    const Icon = item.icon;
    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={() => setIsMobileMenuOpen(false)}
        className={`flex items-center gap-3 px-3 py-2 rounded-[6px] text-xs font-medium transition-colors ${
          isActive ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold' : 'text-[#475569] hover:text-[#0F172A] hover:bg-slate-100'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#2563EB]' : 'text-slate-400'}`} />
        <span>{item.name}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col md:flex-row font-sans">

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-[#E2E8F0] flex flex-col transition-transform duration-200 ease-in-out shrink-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-[6px] bg-[#2563EB] text-white flex items-center justify-center font-bold text-sm shadow-sm">
              R
            </div>
            <div>
              <div className="text-sm font-bold text-[#0F172A] tracking-tight">RAGOS</div>
              <div className="text-[11px] text-[#64748B] font-medium">Enterprise AI Platform</div>
            </div>
          </Link>
          <button
            className="md:hidden text-slate-400 hover:text-slate-700"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current organization (multi-org switching is not available in v1) */}
        <div className="p-3 border-b border-[#E2E8F0]">
          <div className="w-full p-2.5 bg-slate-50 rounded-[6px] border border-slate-200 text-xs">
            <div className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">Organization</div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <div className="text-[#0F172A] font-semibold truncate" title={orgName}>
                {orgName || '—'}
              </div>
              {role && <Badge variant="indigo" size="sm">{role}</Badge>}
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-6 overflow-y-auto" aria-label="Main navigation">
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Platform</div>
            {mainNavItems.map(renderNavLink)}
          </div>

          <div className="space-y-1 pt-2 border-t border-[#E2E8F0]">
            <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Workspace</div>
            {adminNavItems.map(renderNavLink)}
          </div>
        </nav>

        {/* User Profile & Settings Footer */}
        <div className="p-3 border-t border-[#E2E8F0] bg-slate-50/50 space-y-1.5">
          <button
            type="button"
            onClick={openSettings}
            aria-label="Open account settings"
            className="w-full flex items-center justify-between p-2 rounded-[6px] hover:bg-slate-100 transition-colors text-left group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-[6px] bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-xs text-[#2563EB] shrink-0">
                {avatarInitial}
              </div>
              <div className="truncate text-xs">
                <div className="font-semibold text-[#0F172A] truncate">{displayName || displayEmail}</div>
                <div className="text-[11px] text-[#64748B] truncate">{displayEmail}</div>
              </div>
            </div>
            <Settings className="w-4 h-4 text-slate-400 group-hover:text-slate-700 shrink-0" />
          </button>

          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-[6px] text-xs font-medium text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 border border-transparent hover:border-red-200 transition-all disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Header Bar */}
        <header className="h-16 border-b border-[#E2E8F0] bg-white/95 backdrop-blur-sm px-4 md:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden text-slate-500 hover:text-slate-800"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium min-w-0">
              <Link href="/dashboard" className="hover:text-slate-800 transition-colors">Workspace</Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[#0F172A] font-semibold truncate">{getBreadcrumbName(pathname)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSearchOpen(true)}
              aria-label="Open page search"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-[#E2E8F0] rounded-[6px] text-xs text-slate-500 transition-colors"
            >
              <Command className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Go to page...</span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-500">Ctrl K</kbd>
            </button>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</main>
      </div>

      {/* Command palette (Ctrl/Cmd + K): navigation to real pages only */}
      <Modal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} title="Go to page" maxWidth="lg">
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              autoFocus
              aria-label="Search pages"
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#CBD5E1] rounded-[6px] pl-9 pr-4 py-2 text-sm text-[#0F172A] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredCommands.length === 0 && <p className="text-xs text-slate-500 px-2.5 py-2">No matching pages.</p>}
            {filteredCommands.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.href}
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearchQuery('');
                    router.push(cmd.href);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-[6px] hover:bg-slate-50 text-left text-xs transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-[#2563EB] shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-800">{cmd.title}</div>
                      <div className="text-[11px] text-slate-500">{cmd.category}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Account settings: profile from /auth/me, org rename for OWNER/ADMIN, sign out */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Account settings" maxWidth="md">
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-[8px] flex items-center gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-[#2563EB] flex items-center justify-center font-bold text-base text-white shadow-sm shrink-0">
              {avatarInitial}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 text-sm truncate">{displayName || displayEmail}</div>
              <div className="text-slate-500 truncate">{displayEmail}</div>
              {role && (
                <div className="mt-1">
                  <Badge variant="indigo" size="sm">{role}</Badge>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-3">
            <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Organization</span>
              <span className="font-medium text-slate-800 truncate">{orgName || '—'}</span>
            </div>
            {me?.profile?.organization?.id && (
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Organization ID</span>
                <span className="font-mono text-[#2563EB] truncate" title={me.profile.organization.id}>
                  {me.profile.organization.id}
                </span>
              </div>
            )}
            {me?.profile?.createdAt && (
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Account created</span>
                <span className="text-slate-800">{new Date(me.profile.createdAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {isAdminRole(role) && (
            <form onSubmit={handleOrgRename} className="space-y-2 border-t border-slate-200 pt-3">
              <Input
                id="settings-org-name"
                label="Rename organization"
                value={orgNameDraft}
                maxLength={255}
                onChange={(e) => {
                  setOrgNameDraft(e.target.value);
                  setOrgNameSaved(false);
                }}
                error={orgNameError || undefined}
                helperText={orgNameSaved ? 'Organization name updated.' : undefined}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  isLoading={isSavingOrg}
                  disabled={!orgNameDraft.trim() || orgNameDraft.trim() === orgName}
                >
                  Save name
                </Button>
              </div>
            </form>
          )}

          <div className="pt-2 flex gap-3">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setIsSettingsOpen(false)}>
              Close
            </Button>
            <Button
              variant="danger"
              size="sm"
              className="w-full"
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
              onClick={handleSignOut}
              isLoading={isSigningOut}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
