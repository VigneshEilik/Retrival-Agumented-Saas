'use client';

import React, { useState } from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Key, Plus, ShieldCheck, Copy, Check, Trash2, AlertTriangle } from 'lucide-react';

export default function ApiKeysPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [apiKeys, setApiKeys] = useState([
    { id: 'key-1', name: 'Production Backend Service', prefix: 'sk_live_a89f••••', created: '2026-08-10', lastUsed: '2 mins ago', status: 'ACTIVE' },
    { id: 'key-2', name: 'CI/CD Pipeline Integration', prefix: 'sk_live_32f1••••', created: '2026-08-22', lastUsed: '3 days ago', status: 'ACTIVE' },
  ]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawPrefix = Math.random().toString(36).substring(2, 6);
    const mockSecret = `sk_live_${rawPrefix}${Math.random().toString(36).substring(2)}`;
    setGeneratedKey(mockSecret);

    const newKeyItem = {
      id: `key-${Date.now()}`,
      name: keyName || 'New API Key',
      prefix: `sk_live_${rawPrefix}••••`,
      created: new Date().toISOString().split('T')[0],
      lastUsed: 'Just now',
      status: 'ACTIVE',
    };
    setApiKeys((prev) => [newKeyItem, ...prev]);
  };

  const handleDeleteKey = (id: string) => {
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const handleCopy = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <SaaSLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Production API Key Security Center</h1>
              <Badge variant="indigo" size="sm">HMAC SHA-256 Hashed</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Manage programmatic API access. Keys carry workspace permissions and are authenticated via server middleware.
            </p>
          </div>

          <Button
            onClick={() => {
              setGeneratedKey(null);
              setIsCreateModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
            variant="primary"
            size="md"
          >
            Create New API Key
          </Button>
        </div>

        {/* API Keys Table */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-950/40 text-xs font-bold text-white uppercase tracking-wider">
            Active Workspace API Keys
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Key Name</th>
                  <th className="py-3 px-4">Key Prefix</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Last Used</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white">{key.name}</td>
                    <td className="py-3.5 px-4 font-mono text-indigo-300">{key.prefix}</td>
                    <td className="py-3.5 px-4"><Badge variant="success" size="sm">ACTIVE</Badge></td>
                    <td className="py-3.5 px-4 text-slate-400">{key.created}</td>
                    <td className="py-3.5 px-4 text-slate-400">{key.lastUsed}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                        title="Revoke API Key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Create API Key Modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title={generatedKey ? 'API Key Generated Successfully' : 'Create New API Key'}
        >
          {generatedKey ? (
            <div className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Save your secret key now!
                </div>
                <p className="text-[11px] leading-normal text-amber-200/80">
                  This key will never be shown again. Copy it now and store it in a secure password manager.
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between font-mono text-xs text-white">
                <span className="truncate mr-2">{generatedKey}</span>
                <button onClick={handleCopy} className="p-1.5 text-slate-400 hover:text-white rounded bg-slate-900">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="pt-2">
                <Button variant="primary" size="sm" className="w-full" onClick={() => setIsCreateModalOpen(false)}>
                  Done & Close
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <Input
                label="Key Description Name"
                placeholder="e.g. Staging Server Webhook Integration"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                required
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={!keyName.trim()}>
                  Generate Secret Key
                </Button>
              </div>
            </form>
          )}
        </Modal>

      </div>
    </SaaSLayout>
  );
}
