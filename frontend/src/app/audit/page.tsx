'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { apiJson, hasRealSession } from '@/lib/api';
import { ShieldCheck, AlertTriangle, Lock, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditLogRow {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: unknown;
  ip_address: string | null;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
}

interface AuditResponse {
  logs: AuditLogRow[];
  pagination: { page: number; limit: number; total: number };
}

const PAGE_SIZE = 50;

function actionVariant(action: string): 'success' | 'danger' | 'info' | 'indigo' | 'neutral' {
  if (/DELETED|REVOKED|REMOVED|FAILED/.test(action)) return 'danger';
  if (/CREATED|ADDED|UPLOADED|INDEXED|SIGNUP/.test(action)) return 'success';
  if (/CHANGED|UPDATED/.test(action)) return 'info';
  if (/LOGIN/.test(action)) return 'indigo';
  return 'neutral';
}

/** Compact one-line summary of the JSON `details` column. */
function summarizeDetails(details: unknown): string {
  if (details == null) return '';
  let value = details;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return value as string;
    }
  }
  if (typeof value !== 'object' || value === null) return String(value);
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [actionFilter, setActionFilter] = useState('ALL');

  const load = useCallback(async (targetPage: number) => {
    if (!hasRealSession()) return;
    setIsLoading(true);
    try {
      const res = await apiJson<AuditResponse>(`/api/v1/audit-logs?page=${targetPage}&limit=${PAGE_SIZE}`);
      setData(res);
      setLoadError(null);
      setForbidden(false);
    } catch (err: any) {
      if (err.status === 403) setForbidden(true);
      else setLoadError(err.message || 'Could not load the audit log.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setActionFilter('ALL');
    load(page);
  }, [page, load]);

  const logs = useMemo(() => data?.logs ?? [], [data]);
  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs]);
  const filtered = actionFilter === 'ALL' ? logs : logs.filter((l) => l.action === actionFilter);
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  if (forbidden) {
    return (
      <SaaSLayout>
        <div className="max-w-xl mx-auto pt-16">
          <EmptyState
            icon={<Lock className="w-8 h-8" />}
            title="Only owners and admins can view the audit log"
            description="Ask an owner or admin of your organization if you need to review account activity."
          />
        </div>
      </SaaSLayout>
    );
  }

  return (
    <SaaSLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#2563EB]" />
              <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Audit Log</h1>
            </div>
            <p className="text-sm text-[#475569] mt-1">
              Security-relevant activity in your organization, newest first.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => load(page)}
            disabled={isLoading}
            leftIcon={<RotateCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-[8px] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <label htmlFor="audit-action-filter" className="text-xs font-semibold text-slate-700">
              Action
            </label>
            <select
              id="audit-action-filter"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-[#CBD5E1] rounded-[6px] text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
            >
              <option value="ALL">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-500">(filters this page)</span>
          </div>
          <div className="text-xs text-slate-500">
            {total > 0 ? `Showing ${firstRow}–${lastRow} of ${total.toLocaleString()} events` : 'No events'}
          </div>
        </div>

        {isLoading ? (
          <LoadingState message="Loading audit events..." />
        ) : loadError ? (
          <EmptyState
            icon={<AlertTriangle className="w-8 h-8" />}
            title="Could not load the audit log"
            description={loadError}
            action={
              <Button variant="secondary" onClick={() => load(page)} leftIcon={<RotateCw className="w-4 h-4" />}>
                Try again
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="w-8 h-8" />}
            title={logs.length === 0 ? 'No audit events yet' : 'No events match this filter'}
            description={
              logs.length === 0
                ? 'Actions such as creating knowledge bases, uploading documents and managing members will appear here.'
                : 'Choose a different action or clear the filter.'
            }
          />
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Resource</th>
                    <th className="py-3 px-4">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {filtered.map((log) => {
                    const details = summarizeDetails(log.details);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors align-top">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="py-3 px-4">
                          {log.user_email ? (
                            <span className="text-slate-900 break-all">{log.user_email}</span>
                          ) : (
                            <span className="text-slate-400 italic">API key / system</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={actionVariant(log.action)} size="sm">
                            {log.action}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-700">
                            {log.resource_type || '—'}
                            {log.resource_id && (
                              <span className="ml-1.5 font-mono text-[11px] text-slate-400" title={log.resource_id}>
                                {log.resource_id.slice(0, 8)}
                              </span>
                            )}
                          </div>
                          {details && <div className="text-[11px] text-slate-500 break-all mt-0.5">{details}</div>}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{log.ip_address || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Previous
            </Button>
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </SaaSLayout>
  );
}
