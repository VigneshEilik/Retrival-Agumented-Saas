'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, Bot, MessageSquare, LayoutDashboard, Users, Key, ShieldCheck, BarChart3, Settings, ChevronDown, Command, Menu, X } from 'lucide-react';

interface SaaSLayoutProps {
  children: React.ReactNode;
}

export function SaaSLayout({ children }: SaaSLayoutProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentOrg, setCurrentOrg] = useState('Acme Enterprise Corp');

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Documents', href: '/knowledge-bases/default-kb/documents', icon: Database },
    { name: 'Chat Assistant', href: '/chat', icon: MessageSquare },
    { name: 'Agent Builder', href: '/agent-builder', icon: Bot },
    { name: 'Agent Execution', href: '/agent', icon: Settings },
    { name: 'Team & RBAC', href: '/team', icon: Users },
    { name: 'API Keys', href: '/api-keys', icon: Key },
    { name: 'Audit Center', href: '/audit', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-[#090d16] text-gray-100 flex flex-col md:flex-row">
      
      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-[#0d1322] border-r border-gray-800 flex flex-col transition-transform duration-200 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand & Workspace Switcher */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
              R
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight">RAG SaaS Engine</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Pro Plan
              </div>
            </div>
          </div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Organization / Workspace Selector */}
        <div className="p-3 border-b border-gray-800/80">
          <button className="w-full flex items-center justify-between p-2.5 bg-gray-900/80 hover:bg-gray-800/80 rounded-lg border border-gray-800 text-xs text-left transition-colors">
            <div className="truncate">
              <div className="text-[10px] text-gray-500 font-semibold uppercase">Current Workspace</div>
              <div className="text-gray-200 font-medium truncate mt-0.5">{currentOrg}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Global Command Palette Hint */}
        <div className="p-4 border-t border-gray-800 text-xs text-gray-500 flex items-center justify-between">
          <span className="flex items-center gap-1"><Command className="w-3.5 h-3.5 text-indigo-400" /> Quick Search</span>
          <kbd className="px-2 py-0.5 bg-gray-900 border border-gray-800 rounded text-[10px] font-mono text-gray-400">⌘ K</kbd>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Mobile Header Bar */}
        <header className="md:hidden h-14 border-b border-gray-800 bg-[#0d1322] px-4 flex items-center justify-between">
          <button className="text-gray-400 hover:text-white" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="text-sm font-bold text-white">RAG SaaS Engine</div>
          <div className="w-6" />
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>

    </div>
  );
}
