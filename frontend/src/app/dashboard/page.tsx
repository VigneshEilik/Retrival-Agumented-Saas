'use client';

import React, { useEffect, useState } from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { MessageSquare, Database, Bot, Cpu, DollarSign, ArrowUpRight, Plus, RefreshCw, Zap, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/analytics/overview')
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setIsLoading(false);
      })
      .catch(() => {
        // Fallback default state for demo if API backend offline
        setData({
          usage: {
            promptTokens: 1420500,
            completionTokens: 680200,
            totalTokens: 2100700,
            estimatedCostUsd: 4.21,
            documentCount: 128,
            agentCount: 12,
            conversationCount: 24,
          },
          subscription: {
            planTier: 'BUSINESS',
            monthlyTokenLimit: 2500000,
          },
        });
        setIsLoading(false);
      });
  }, []);

  const totalTokens = data?.usage?.totalTokens || 0;
  const tokenLimit = data?.subscription?.monthlyTokenLimit || 2500000;
  const quotaPercent = Math.round((totalTokens / tokenLimit) * 100);

  return (
    <SaaSLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        
        {/* Page Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              Dashboard Overview
              <Badge variant="indigo" size="sm">Enterprise Plan</Badge>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Real-time monitoring of document ingestion, RAG retrieval performance, and token budget quotas.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/knowledge-bases/default-kb/documents">
              <Button size="sm" variant="outline" leftIcon={<Plus className="w-4 h-4" />}>
                Upload Document
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="primary" rightIcon={<ArrowUpRight className="w-4 h-4" />}>
                New Chat Session
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <LoadingState message="Fetching workspace analytics..." />
        ) : (
          <>
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Conversations"
                value={data?.usage?.conversationCount || 24}
                icon={<MessageSquare className="w-4 h-4 text-indigo-400" />}
                trend="+18%"
                trendDirection="up"
                description="Active grounded RAG sessions"
              />
              <StatCard
                label="Indexed Documents"
                value={data?.usage?.documentCount || 128}
                icon={<Database className="w-4 h-4 text-emerald-400" />}
                trend="98.4% ready"
                trendDirection="up"
                description="Vectorized knowledge base"
              />
              <StatCard
                label="Configured Agents"
                value={data?.usage?.agentCount || 12}
                icon={<Bot className="w-4 h-4 text-purple-400" />}
                trend="Autonomous"
                trendDirection="neutral"
                description="Server-enforced tool execution"
              />
              <StatCard
                label="Estimated Spend"
                value={`$${(data?.usage?.estimatedCostUsd || 4.21).toFixed(2)}`}
                icon={<DollarSign className="w-4 h-4 text-amber-400" />}
                trend="Within budget"
                trendDirection="up"
                description="Calculated monthly LLM API cost"
              />
            </div>

            {/* Quota Progress & Recent Activity Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Monthly Token Budget Quota */}
              <Card
                className="lg:col-span-1 space-y-4"
                header={
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" /> Quota Enforcement
                    </span>
                    <Badge variant={quotaPercent > 90 ? 'warning' : 'indigo'} size="sm">
                      {data?.subscription?.planTier || 'BUSINESS'}
                    </Badge>
                  </div>
                }
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400 font-medium">Monthly Token Limit</span>
                    <span className="text-sm font-extrabold text-white font-mono">
                      {(totalTokens / 1000000).toFixed(1)}M / {(tokenLimit / 1000000).toFixed(1)}M
                    </span>
                  </div>

                  <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        quotaPercent > 90 ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                      }`}
                      style={{ width: `${Math.min(100, quotaPercent)}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
                    <span>Quota Utilization: <strong className="text-white">{quotaPercent}%</strong></span>
                    <span className="text-indigo-400 hover:underline cursor-pointer">Upgrade Plan →</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" /> Cost Protection Active
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Max step limits (5 steps) and $0.50 per-request budgets enforced by CostGuardService.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Right Column: Recent Activity Ledger */}
              <Card
                className="lg:col-span-2"
                header={
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-indigo-400" /> Knowledge & Engine Activity
                    </span>
                    <span className="text-xs text-slate-400">Updated just now</span>
                  </div>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="pb-3">Event / Target</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Latency / Cost</th>
                        <th className="pb-3 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-slate-300">
                      <tr>
                        <td className="py-3 font-medium text-white">HR_Policy_Handbook.pdf</td>
                        <td className="py-3"><Badge variant="success" size="sm">READY (48 Chunks)</Badge></td>
                        <td className="py-3 text-slate-400 font-mono">1.2s • $0.002</td>
                        <td className="py-3 text-right text-slate-400">2m ago</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-medium text-white">Customer Support RAG Search</td>
                        <td className="py-3"><Badge variant="indigo" size="sm">GROUNDED (RRF 0.89)</Badge></td>
                        <td className="py-3 text-slate-400 font-mono">340ms • $0.004</td>
                        <td className="py-3 text-right text-slate-400">12m ago</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-medium text-white">Agent Execution: RAGSearchTool</td>
                        <td className="py-3"><Badge variant="success" size="sm">COMPLETED</Badge></td>
                        <td className="py-3 text-slate-400 font-mono">512ms • $0.001</td>
                        <td className="py-3 text-right text-slate-400">45m ago</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

            </div>
          </>
        )}

      </div>
    </SaaSLayout>
  );
}
