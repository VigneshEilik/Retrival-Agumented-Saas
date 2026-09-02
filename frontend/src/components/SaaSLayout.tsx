'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Database,
  Bot,
  MessageSquare,
  LayoutDashboard,
  Users,
  Key,
  ShieldCheck,
  Settings,
  ChevronDown,
  Command,
  Menu,
  X,
  Bell,
  User,
  Cpu,
  ChevronRight,
  Search,
  Check,
  LogOut,
  Building2,
  Lock,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

interface SaaSLayoutProps {
  children: React.ReactNode;
}

export function SaaSLayout({ children }: SaaSLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentOrg, setCurrentOrg] = useState('Acme Enterprise Corp');

  // Interactive Modal States
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const organizations = [
    { id: 'org-1', name: 'Acme Enterprise Corp', plan: 'BUSINESS', docs: 128 },
    { id: 'org-2', name: 'Staging Sandbox Org', plan: 'PRO', docs: 14 },
    { id: 'org-3', name: 'FinTech Global Corp', plan: 'ENTERPRISE', docs: 412 },
  ];

  const notifications = [
    { id: 'n-1', title: 'Document Ingestion Complete', desc: 'HR_Policy_Handbook.pdf parsed into 48 vector chunks.', time: '5m ago', type: 'success' },
    { id: 'n-2', title: 'Rate Limiter Alert', desc: 'Sliding window limit cap reached for test tenant.', time: '1h ago', type: 'warning' },
    { id: 'n-3', title: 'API Key Created', desc: 'New secret key generated for CI/CD deployment.', time: '3h ago', type: 'info' },
  ];

  const commandPaletteItems = [
    { title: 'Dashboard Overview', category: 'Platform', href: '/dashboard', icon: LayoutDashboard },
    { title: 'Knowledge Bases & Documents', category: 'Engine', href: '/knowledge-bases/default-kb/documents', icon: Database },
    { title: 'Grounded Chat Assistant', category: 'RAG', href: '/chat', icon: MessageSquare },
    { title: 'Autonomous Agent Builder', category: 'Agents', href: '/agent-builder', icon: Bot },
    { title: 'Agent Execution Observability', category: 'Observability', href: '/agent', icon: Cpu },
    { title: 'Team & RBAC Management', category: 'Security', href: '/team', icon: Users },
    { title: 'Production API Key Security', category: 'Security', href: '/api-keys', icon: Key },
    { title: 'Tenant Audit Log Center', category: 'Audit', href: '/audit', icon: ShieldCheck },
  ];

  // Global ⌘ K Keyboard Listener
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
    { name: 'Knowledge Bases', href: '/knowledge-bases/default-kb/documents', icon: Database },
    { name: 'Chat Assistant', href: '/chat', icon: MessageSquare },
    { name: 'Agent Builder', href: '/agent-builder', icon: Bot },
    { name: 'Agent Execution', href: '/agent', icon: Cpu },
  ];

  const adminNavItems = [
    { name: 'Team & RBAC', href: '/team', icon: Users },
    { name: 'API Keys', href: '/api-keys', icon: Key },
    { name: 'Audit Center', href: '/audit', icon: ShieldCheck },
  ];

  const getBreadcrumbName = (path: string) => {
    if (path === '/dashboard') return 'Dashboard';
    if (path.includes('/knowledge-bases')) return 'Knowledge Bases & Documents';
    if (path === '/chat') return 'Chat Assistant';
    if (path === '/agent-builder') return 'Agent Builder';
    if (path === '/agent') return 'Agent Execution Observability';
    if (path === '/team') return 'Team & RBAC Management';
    if (path === '/api-keys') return 'Production API Keys';
    if (path === '/audit') return 'Audit Log Center';
    return 'Workspace';
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col md:flex-row font-sans antialiased">
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-900/90 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out shrink-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-extrabold text-white shadow-lg shadow-indigo-600/30 group-hover:bg-indigo-500 transition-colors">
              R
            </div>
            <div>
              <div className="text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
                RAGOS <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono font-normal">v2.0</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">Enterprise AI Platform</div>
            </div>
          </Link>
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Switcher Button */}
        <div className="p-3 border-b border-slate-800/80">
          <button
            onClick={() => setIsOrgDropdownOpen(true)}
            className="w-full flex items-center justify-between p-2.5 bg-slate-950/60 hover:bg-slate-800/80 rounded-lg border border-slate-800 text-xs text-left transition-colors group"
          >
            <div className="truncate">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Current Workspace</div>
              <div className="text-slate-200 font-semibold truncate mt-0.5 group-hover:text-white">{currentOrg}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 p-3 space-y-6 overflow-y-auto">
          {/* Main Engine Nav */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Platform Engine</div>
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/agent'
                  ? pathname === '/agent'
                  : pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Security & Workspace Nav */}
          <div className="space-y-1 pt-2 border-t border-slate-800/60">
            <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Security & Workspace</div>
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* User Profile & Settings Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-400">
                V
              </div>
              <div className="truncate text-xs">
                <div className="font-semibold text-slate-200 truncate">Vignesh K.</div>
                <div className="text-[10px] text-slate-400 truncate">vignesh@acme.com</div>
              </div>
            </div>
            <Settings className="w-4 h-4 text-slate-400 hover:text-slate-200 shrink-0" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between sticky top-0 z-20">
          
          <div className="flex items-center gap-3">
            <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <Link href="/dashboard" className="hover:text-slate-200 transition-colors">Workspace</Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-slate-100 font-semibold">{getBreadcrumbName(pathname)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Global Command Palette Trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-400 transition-colors"
            >
              <Command className="w-3.5 h-3.5 text-indigo-400" />
              <span>Search workspace...</span>
              <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-400">⌘ K</kbd>
            </button>

            {/* Environment Badge */}
            <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Production RLS
            </span>

            {/* Notifications Bell Trigger */}
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors relative"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500" />
            </button>
          </div>

        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>

      </div>

      {/* ========================================================================= */}
      {/* INTERACTIVE MODALS & DRAWERS */}
      {/* ========================================================================= */}

      {/* 1. Global Command Palette Modal (⌘ K) */}
      <Modal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} title="Command Search Palette (⌘ K)" maxWidth="lg">
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              autoFocus
              placeholder="Search features, documents, agents, or settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredCommands.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.href}
                  onClick={() => {
                    setIsSearchOpen(false);
                    router.push(cmd.href);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-800 text-left text-xs transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-indigo-400 group-hover:text-white shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-200 group-hover:text-white">{cmd.title}</div>
                      <div className="text-[10px] text-slate-400">{cmd.category}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* 2. Workspace Switcher Modal */}
      <Modal isOpen={isOrgDropdownOpen} onClose={() => setIsOrgDropdownOpen(false)} title="Switch Tenant Workspace" maxWidth="md">
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Select an organization workspace. Database queries enforce PostgreSQL Row-Level Security (RLS) isolation per workspace ID.
          </p>
          <div className="space-y-2">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  setCurrentOrg(org.name);
                  setIsOrgDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-colors ${
                  currentOrg === org.name
                    ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Building2 className={`w-4 h-4 ${currentOrg === org.name ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <div>
                    <div className="font-bold">{org.name}</div>
                    <div className="text-[10px] text-slate-400">{org.docs} Indexed Documents</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={org.plan === 'ENTERPRISE' ? 'indigo' : 'neutral'} size="sm">{org.plan}</Badge>
                  {currentOrg === org.name && <Check className="w-4 h-4 text-indigo-400" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* 3. System Notifications Modal */}
      <Modal isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} title="System & Security Alerts" maxWidth="md">
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  {n.title}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">{n.time}</span>
              </div>
              <p className="text-slate-400 leading-normal">{n.desc}</p>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => setIsNotificationsOpen(false)}>
            Mark All as Read
          </Button>
        </div>
      </Modal>

      {/* 4. User Profile & Workspace Settings Modal */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="User Account & Security Settings" maxWidth="md">
        <div className="space-y-4 text-xs">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-extrabold text-base text-white">
              V
            </div>
            <div>
              <div className="font-bold text-white text-sm">Vignesh K.</div>
              <div className="text-slate-400">vignesh@acme.com</div>
              <div className="mt-1">
                <Badge variant="indigo" size="sm">OWNER ROLE</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-800 pt-3">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Workspace Tenant ID</span>
              <span className="font-mono text-indigo-300">12d1ce11-a8a9-4d4a-99bc-0dc1b3d339aa</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Session JWT Token</span>
              <span className="font-mono text-emerald-400">Active (15m expiry)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">PostgreSQL RLS Mode</span>
              <span className="font-mono text-slate-200">Server-enforced</span>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setIsSettingsOpen(false)}>
              Close Settings
            </Button>
            <Button variant="danger" size="sm" className="w-full" leftIcon={<LogOut className="w-3.5 h-3.5" />}>
              Sign Out
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
