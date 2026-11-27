'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { SaaSLayout } from '@/components/SaaSLayout';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { apiJson, hasRealSession } from '@/lib/api';
import { MessageSquare, Database, FileText, Layers, ArrowUpRight, Zap, AlertTriangle, RotateCw } from 'lucide-react';

interface AnalyticsOverview {
  plan: string;
  planLimits: {
    maxKnowledgeBases: number;
    maxDocuments: number;
    maxAgentRunsPerMonth: number;
    maxTokensPerMonth: number;
    maxMembers: number;
  };
  usageThisMonth: {
    rag_query?: number;
    llm_prompt_tokens?: number;
    llm_completion_tokens?: number;
  };
  metrics: {
    conversations: number;
    messages: number;
    documents: number;
    knowledgeBases: number;
    documentsReady: number;
    documentsFailed: number;
    documentsProcessing: number;
    indexedChunks: number;
    agentRuns: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostMonthly: number;
  };
}

const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString() : '0');
const pct = (used: number, limit: number) => (limit > 0 ? Math.round((used / limit) * 100) : 0);

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hasRealSession()) return; // SaaSLayout redirects to /login
    setIsLoading(true);
    setErrorMsg(null);
    try {
      setData(await apiJson<AnalyticsOverview>('/api/v1/analytics/overview'));
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not load workspace analytics.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const m = data?.metrics;
  const limits = data?.planLimits;
  const tokensThisMonth = (data?.usageThisMonth.llm_prompt_tokens || 0) + (data?.usageThisMonth.llm_completion_tokens || 0);
  const tokenLimit = limits?.maxTokensPerMonth || 0;
  const tokenPercent = pct(tokensThisMonth, tokenLimit);

  return (
    <SaaSLayout>
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2.5 flex-wrap">
              Dashboard
              {data?.plan && <Badge variant="indigo" size="sm">{data.plan} plan</Badge>}
            </h1>
            <p className="text-sm text-[#475569] mt-1">
              Knowledge bases, document ingestion and token usage for your organization.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/knowledge-bases">
              <Button size="sm" variant="secondary" leftIcon={<Database className="w-4 h-4" />}>
                Knowledge Bases
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" variant="primary" rightIcon={<ArrowUpRight className="w-4 h-4" />}>
                Open Chat
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <LoadingState message="Fetching workspace analytics..." />
        ) : errorMsg || !data || !m || !limits ? (
          <EmptyState
            icon={<AlertTriangle className="w-8 h-8" />}
            title="Could not load analytics"
            description={errorMsg || 'The analytics service returned no data.'}
            action={
              <Button variant="secondary" onClick={load} leftIcon={<RotateCw className="w-4 h-4" />}>
                Try again
              </Button>
            }
          />
        ) : (
          <>
            {m.documentsFailed > 0 && (
              <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-[8px] border border-red-200 bg-red-50 text-xs text-red-700">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {m.documentsFailed} {m.documentsFailed === 1 ? 'document' : 'documents'} failed to ingest. Open the knowledge base to retry or remove them.
                </span>
                <Link href="/knowledge-bases" className="font-semibold hover:underline shrink-0">
                  View knowledge bases →
                </Link>
              </div>
            )}

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Knowledge Bases"
                value={fmt(m.knowledgeBases)}
                icon={<Database className="w-4 h-4 text-[#2563EB]" />}
                progressPercent={pct(m.knowledgeBases, limits.maxKnowledgeBases)}
                description={`${fmt(m.knowledgeBases)} of ${fmt(limits.maxKnowledgeBases)} on your plan`}
              />
              <StatCard
                label="Documents"
                value={fmt(m.documents)}
                icon={<FileText className="w-4 h-4 text-emerald-600" />}
                progressPercent={pct(m.documents, limits.maxDocuments)}
                description={`${fmt(m.documents)} of ${fmt(limits.maxDocuments)} on your plan`}
              />
              <StatCard
                label="Indexed Chunks"
                value={fmt(m.indexedChunks)}
                icon={<Layers className="w-4 h-4 text-[#2563EB]" />}
                description="Searchable passages across all documents"
              />
              <StatCard
                label="Conversations"
                value={fmt(m.conversations)}
                icon={<MessageSquare className="w-4 h-4 text-[#2563EB]" />}
                description={`${fmt(m.messages)} messages in total`}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Monthly token usage vs plan limit */}
              <Card
                className="lg:col-span-1"
                header={
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" /> Tokens this month
                    </span>
                    <Badge variant={tokenPercent > 90 ? 'warning' : 'indigo'} size="sm">{data.plan}</Badge>
                  </div>
                }
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline gap-2 flex-wrap">
                    <span className="text-xs text-[#475569] font-medium">Used / monthly limit</span>
                    <span className="text-sm font-bold text-[#0F172A] font-mono">
                      {fmt(tokensThisMonth)} / {fmt(tokenLimit)}
                    </span>
                  </div>
                  <div
                    className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200"
                    role="progressbar"
                    aria-label="Monthly token usage"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, tokenPercent)}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${tokenPercent > 90 ? 'bg-amber-500' : 'bg-[#2563EB]'}`}
                      style={{ width: `${Math.min(100, tokenPercent)}%` }}
                    />
                  </div>
                  <div className="text-xs text-[#475569] pt-2 border-t border-slate-200 space-y-1">
                    <div>
                      Utilization: <strong className="text-[#0F172A]">{tokenPercent}%</strong>
                    </div>
                    <div>
                      Prompt {fmt(data.usageThisMonth.llm_prompt_tokens || 0)} · Completion{' '}
                      {fmt(data.usageThisMonth.llm_completion_tokens || 0)}
                    </div>
                    {typeof data.usageThisMonth.rag_query === 'number' && (
                      <div>RAG queries this month: {fmt(data.usageThisMonth.rag_query)}</div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Document ingestion status */}
              <Card
                className="lg:col-span-2"
                header={
                  <span className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#2563EB]" /> Document ingestion
                  </span>
                }
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-[8px] border border-emerald-200 bg-emerald-50/60">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Ready</div>
                    <div className="text-xl font-bold text-[#0F172A] mt-1">{fmt(m.documentsReady)}</div>
                  </div>
                  <div className="p-3 rounded-[8px] border border-amber-200 bg-amber-50/60">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Processing</div>
                    <div className="text-xl font-bold text-[#0F172A] mt-1">{fmt(m.documentsProcessing)}</div>
                  </div>
                  <div className="p-3 rounded-[8px] border border-red-200 bg-red-50/60">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-red-700">Failed</div>
                    <div className="text-xl font-bold text-[#0F172A] mt-1">{fmt(m.documentsFailed)}</div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-[#475569]">
                  <div className="flex justify-between gap-3">
                    <span>Plan</span>
                    <span className="font-semibold text-[#0F172A]">{data.plan}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Member limit</span>
                    <span className="font-semibold text-[#0F172A]">{fmt(limits.maxMembers)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>All-time tokens</span>
                    <span className="font-semibold text-[#0F172A]">{fmt(m.totalTokens)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Estimated LLM cost (all time)</span>
                    <span className="font-semibold text-[#0F172A]">${(m.estimatedCostMonthly || 0).toFixed(2)}</span>
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </SaaSLayout>
  );
}
