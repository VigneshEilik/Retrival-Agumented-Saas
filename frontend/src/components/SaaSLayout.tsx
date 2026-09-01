'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, Bot, MessageSquare, LayoutDashboard, Users, Key, ShieldCheck, Settings, ChevronDown, Command, Menu, X, Bell, User, Cpu, ChevronRight, HelpCircle } from 'lucide-react';

interface SaaSLayoutProps {
  children: React.ReactNode;
}

export function SaaSLayout({ children }: SaaSLayoutProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentOrg, setCurrentOrg] = useState('Acme Enterprise Corp');

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

  // Helper to format breadcrumb from pathname
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
      
      {/* Desktop & Mobile Sidebar Overlay */}
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
        {/* Brand & Application Title */}
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

        {/* Workspace Switcher */}
        <div className="p-3 border-b border-slate-800/80">
          <button className="w-full flex items-center justify-between p-2.5 bg-slate-950/60 hover:bg-slate-800/80 rounded-lg border border-slate-800 text-xs text-left transition-colors group">
            <div className="truncate">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Current Workspace</div>
              <div className="text-slate-200 font-semibold truncate mt-0.5 group-hover:text-white">{currentOrg}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 p-3 space-y-6 overflow-y-auto">
          {/* Main Navigation */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Platform Engine</div>
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
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

          {/* Admin & Security Section */}
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

        {/* User Profile Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400">
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
            {/* Global Search / Command Palette Hint */}
            <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-400 transition-colors">
              <Command className="w-3.5 h-3.5 text-indigo-400" />
              <span>Search workspace...</span>
              <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-400">⌘ K</kbd>
            </button>

            {/* Environment Badge */}
            <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Production RLS
            </span>

            {/* Notifications Pill */}
            <button className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500" />
            </button>
          </div>

        </header>

        {/* Page Main Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>

      </div>

    </div>
  );
}
