'use client';

import React, { useState } from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { ShieldCheck, Search, Filter, Clock } from 'lucide-react';

export default function AuditLogPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const auditEvents = [
    { id: 'evt-101', timestamp: '2026-09-01 14:10:02', user: 'vignesh@acme.com', action: 'DOCUMENT_UPLOADED', resource: 'Enterprise_HR_Policy_Handbook.pdf', ip: '192.168.1.45' },
    { id: 'evt-102', timestamp: '2026-09-01 13:45:22', user: 'vignesh@acme.com', action: 'API_KEY_CREATED', resource: 'sk_live_a89f••••', ip: '192.168.1.45' },
    { id: 'evt-103', timestamp: '2026-09-01 12:15:00', user: 'sarah@acme.com', action: 'AGENT_UPDATED', resource: 'Enterprise Customer Assistant', ip: '10.0.4.12' },
    { id: 'evt-104', timestamp: '2026-09-01 10:00:11', user: 'system_worker', action: 'INGESTION_COMPLETED', resource: 'doc-1 (48 Chunks)', ip: '127.0.0.1' },
  ];

  const filteredEvents = auditEvents.filter((evt) => {
    const matchesSearch = evt.user.toLowerCase().includes(searchQuery.toLowerCase()) || evt.resource.toLowerCase().includes(searchQuery.toLowerCase());
    if (actionFilter === 'ALL') return matchesSearch;
    return matchesSearch && evt.action === actionFilter;
  });

  return (
    <SaaSLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Tenant Audit Log Center</h1>
              <Badge variant="indigo" size="sm">Immutable Ledger</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Complete audit trail of security events, document uploads, agent modifications, and access control changes.
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 ml-2" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="ALL">All Event Actions</option>
              <option value="DOCUMENT_UPLOADED">DOCUMENT_UPLOADED</option>
              <option value="API_KEY_CREATED">API_KEY_CREATED</option>
              <option value="AGENT_UPDATED">AGENT_UPDATED</option>
              <option value="INGESTION_COMPLETED">INGESTION_COMPLETED</option>
            </select>
          </div>

          <div className="w-full sm:w-72">
            <Input
              placeholder="Search by user email or resource..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Audit Log Table */}
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User / Actor</th>
                  <th className="py-3 px-4">Action Event</th>
                  <th className="py-3 px-4">Target Resource</th>
                  <th className="py-3 px-4 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-400">{evt.timestamp}</td>
                    <td className="py-3.5 px-4 font-medium text-white">{evt.user}</td>
                    <td className="py-3.5 px-4">
                      <Badge variant="indigo" size="sm">{evt.action}</Badge>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">{evt.resource}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400">{evt.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

      </div>
    </SaaSLayout>
  );
}
