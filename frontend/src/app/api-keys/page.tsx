'use client';

import React, { useState } from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { Key, Plus, ShieldCheck, Copy, Check, Trash2, AlertCircle } from 'lucide-react';

interface ApiKeyItem {
  id: string;
  name: string;
  maskedKey: string;
  createdAt: string;
  lastUsedAt?: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([
    { id: 'key-1', name: 'Production Backend Service', maskedKey: 'sk_live_••••••••782a', createdAt: '2026-08-25', lastUsedAt: '2 min ago' },
    { id: 'key-2', name: 'Staging Integration Key', maskedKey: 'sk_live_••••••••910b', createdAt: '2026-08-30', lastUsedAt: '1 day ago' },
  ]);

  const [newKeyName, setNewKeyName] = useState('');
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const raw = `sk_live_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    const newKeyItem: ApiKeyItem = {
      id: `key-${Date.now()}`,
      name: newKeyName,
      maskedKey: `sk_live_••••••••${raw.slice(-4)}`,
      createdAt: new Date().toISOString().split('T')[0],
      lastUsedAt: 'Just now',
    };

    setKeys((prev) => [newKeyItem, ...prev]);
    setCreatedRawKey(raw);
  };

  const handleCopy = () => {
    if (createdRawKey) {
      navigator.clipboard.writeText(createdRawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevoke = (id: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const closeModal = () => {
    setShowModal(false);
    setCreatedRawKey(null);
    setNewKeyName('');
  };

  return (
    <SaaSLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-1">
              <Key className="w-4 h-4" /> Developer API Key Security
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Production API Keys</h1>
            <p className="text-gray-400 text-sm mt-1">Manage SHA-256 hashed API keys for external programmatic access.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-lg shadow-indigo-600/30 transition-all text-sm"
            >
              <Plus className="w-4 h-4" /> Create New API Key
            </button>
          </div>
        </div>

        {/* API Keys Table */}
        <div className="glass-panel rounded-xl overflow-hidden border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900/60 border-b border-gray-800 text-gray-400 font-medium">
              <tr>
                <th className="py-3.5 px-4">Name</th>
                <th className="py-3.5 px-4">API Key Token</th>
                <th className="py-3.5 px-4">Created Date</th>
                <th className="py-3.5 px-4">Last Used</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {keys.map((k) => (
                <tr key={k.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-4 px-4 font-medium text-white">{k.name}</td>
                  <td className="py-4 px-4 font-mono text-gray-400 text-xs">{k.maskedKey}</td>
                  <td className="py-4 px-4 text-gray-400 font-mono text-xs">{k.createdAt}</td>
                  <td className="py-4 px-4 text-gray-300 text-xs">{k.lastUsedAt || 'Never'}</td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={() => handleRevoke(k.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      title="Revoke Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Create API Key Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="glass-panel p-6 rounded-xl border border-gray-800 max-w-md w-full space-y-4">
              <h3 className="text-lg font-bold text-white">Create API Key</h3>

              {!createdRawKey ? (
                <form onSubmit={handleCreateKey} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Key Description Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mobile App Backend"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-900 rounded-lg border border-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium shadow-lg"
                    >
                      Generate Key
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    Copy this raw API key now. For security, it will NEVER be displayed again!
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-gray-900 border border-gray-800 rounded-lg font-mono text-xs text-white">
                    <input type="text" readOnly value={createdRawKey} className="bg-transparent flex-1 outline-none text-emerald-400 font-bold" />
                    <button onClick={handleCopy} className="p-1.5 text-gray-400 hover:text-white bg-gray-800 rounded">
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button onClick={closeModal} className="px-5 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium">
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </SaaSLayout>
  );
}
