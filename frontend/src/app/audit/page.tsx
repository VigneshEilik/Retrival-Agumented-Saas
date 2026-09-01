'use client';

import React, { useState } from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { ShieldCheck, Search, Filter, Clock, User, FileText, Key, Database } from 'lucide-react';

interface AuditItem {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: string;
}

export default function AuditCenterPage() {
  const [logs] = useState<AuditItem[]>([
    {
      id: 'log-1',
      timestamp: '2026-09-01 12:04:15',
      user: 'vignesh@acme.com',
      action: 'API_KEY_CREATED',
      resourceType: 'api_key',
      resourceId: 'key-101',
      details: 'Created API key "Production Service"',
    },
    {
      id: 'log-2',
      timestamp: '2026-09-01 11:52:30',
      user: 'priya@acme.com',
      action: 'DOCUMENT_UPLOADED',
      resourceType: 'document',
      resourceId: 'doc-402',
      details: 'Uploaded "HR Policy Manual.pdf" (4.2 MB)',
    },
    {
      id: 'log-3',
      timestamp: '2026-09-01 11:41:00',
      user: 'arun@acme.com',
      action: 'KNOWLEDGE_BASE_CREATED',
      resourceType: 'knowledge_base',
      resourceId: 'kb-201',
      details: 'Created Knowledge Base "Engineering Docs"',
    },
  ]);

  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = logs.filter((l) => {
    const matchesFilter = filter === 'ALL' || l.action === filter;
    const matchesSearch =
      l.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.details && l.details.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <SaaSLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-1">
              <ShieldCheck className="w-4 h-4" /> Enterprise Security & Compliance
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Tenant Audit Log Center</h1>
            <p className="text-gray-400 text-sm mt-1">Immutable, tenant-scoped audit records for regulatory compliance and security tracing.</p>
          </div>
        </div>

        {/* Search & Action Filters */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            {['ALL', 'DOCUMENT_UPLOADED', 'API_KEY_CREATED', 'KNOWLEDGE_BASE_CREATED'].map((act) => (
              <button
                key={act}
                onClick={() => setFilter(act)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === act
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {act}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search audit logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="glass-panel rounded-xl overflow-hidden border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900/60 border-b border-gray-800 text-gray-400 font-medium">
              <tr>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Resource</th>
                <th className="py-3.5 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filteredLogs.map((l) => (
                <tr key={l.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-4 px-4 text-gray-400 font-mono text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" /> {l.timestamp}
                  </td>
                  <td className="py-4 px-4 font-medium text-white">{l.user}</td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {l.action}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-gray-400 font-mono text-xs">{l.resourceType}:{l.resourceId}</td>
                  <td className="py-4 px-4 text-gray-300 text-xs">{l.details || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </SaaSLayout>
  );
}
