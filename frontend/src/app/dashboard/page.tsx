'use client';

import React from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { BarChart3, Database, MessageSquare, Bot, Cpu, Zap, ShieldCheck, ArrowUpRight, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  return (
    <SaaSLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-1">
              <BarChart3 className="w-4 h-4" /> SaaS Control Plane Analytics
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Usage & Metric Overview</h1>
            <p className="text-gray-400 text-sm mt-1">Real-time usage ledger, token consumption, and monthly cost tracking.</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3.5 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Active Plan: PRO Tier
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-5 rounded-xl border border-gray-800 space-y-2">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Conversations</span>
              <MessageSquare className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">12,482</div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +14.2% this month
            </div>
          </div>

          <div className="glass-panel p-5 rounded-xl border border-gray-800 space-y-2">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Indexed Documents</span>
              <Database className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">184 / 250</div>
            <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-1">
              <div className="bg-purple-500 h-full w-[73%]" />
            </div>
          </div>

          <div className="glass-panel p-5 rounded-xl border border-gray-800 space-y-2">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Agent Runs</span>
              <Bot className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">1,420 / 2,500</div>
            <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-1">
              <div className="bg-emerald-500 h-full w-[56%]" />
            </div>
          </div>

          <div className="glass-panel p-5 rounded-xl border border-gray-800 space-y-2">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Estimated Cost</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-white">$42.18</div>
            <div className="text-[11px] text-gray-400">Current billing cycle</div>
          </div>
        </div>

        {/* Token Consumption Breakdown */}
        <div className="glass-panel p-6 rounded-xl border border-gray-800 space-y-6">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" /> Token Consumption Breakdown
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-gray-900/80 rounded-lg border border-gray-800">
              <div className="text-xs text-gray-400 font-medium">Input / Prompt Tokens</div>
              <div className="text-xl font-bold text-white mt-1">8,420,150</div>
              <div className="text-[10px] text-gray-500 mt-1">Avg 120 tokens/request</div>
            </div>

            <div className="p-4 bg-gray-900/80 rounded-lg border border-gray-800">
              <div className="text-xs text-gray-400 font-medium">Output / Completion Tokens</div>
              <div className="text-xl font-bold text-white mt-1">2,710,480</div>
              <div className="text-[10px] text-gray-500 mt-1">Avg 350 tokens/response</div>
            </div>

            <div className="p-4 bg-gray-900/80 rounded-lg border border-gray-800">
              <div className="text-xs text-gray-400 font-medium">Total Usage Tokens</div>
              <div className="text-xl font-bold text-indigo-400 mt-1">11,130,630</div>
              <div className="text-[10px] text-gray-500 mt-1">2.5M max quota included</div>
            </div>
          </div>
        </div>

      </div>
    </SaaSLayout>
  );
}
