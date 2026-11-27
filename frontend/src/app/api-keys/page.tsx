'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { apiJson, hasRealSession } from '@/lib/api';
import { Key, Plus, Copy, Check, Trash2, AlertTriangle, Lock, RotateCw, Terminal } from 'lucide-react';

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

type KeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

function keyStatus(key: ApiKeyRow): KeyStatus {
  if (key.revoked_at) return 'REVOKED';
  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) return 'EXPIRED';
  return 'ACTIVE';
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : null);

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [expiryError, setExpiryError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const [pendingRevoke, setPendingRevoke] = useState<ApiKeyRow | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const [origin, setOrigin] = useState('http://localhost:3000');
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const loadKeys = useCallback(async () => {
    if (!hasRealSession()) return;
    setIsLoading(true);
    try {
      const data = await apiJson<{ apiKeys: ApiKeyRow[] }>('/api/v1/api-keys');
      setKeys(data.apiKeys || []);
      setLoadError(null);
      setForbidden(false);
    } catch (err: any) {
      if (err.status === 403) setForbidden(true);
      else setLoadError(err.message || 'Could not load API keys.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const openCreate = () => {
    setKeyName('');
    setExpiresInDays('');
    setNameError(null);
    setExpiryError(null);
    setCreateError(null);
    setRawKey(null);
    setCopied(false);
    setCopyFailed(false);
    setIsCreateOpen(true);
  };

  const closeCreate = () => {
    if (isCreating) return;
    setIsCreateOpen(false);
    setRawKey(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = keyName.trim();
    let valid = true;
    if (!name) {
      setNameError('Name is required.');
      valid = false;
    } else if (name.length > 100) {
      setNameError('Name must be at most 100 characters.');
      valid = false;
    } else {
      setNameError(null);
    }
    let days: number | undefined;
    if (expiresInDays.trim()) {
      days = Number(expiresInDays);
      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        setExpiryError('Expiry must be a whole number of days between 1 and 3650.');
        valid = false;
      } else {
        setExpiryError(null);
      }
    } else {
      setExpiryError(null);
    }
    if (!valid) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const data = await apiJson<{ apiKey: ApiKeyRow; rawKey: string }>('/api/v1/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name, ...(days ? { expiresInDays: days } : {}) }),
      });
      setRawKey(data.rawKey);
      await loadKeys();
    } catch (err: any) {
      setCreateError(err.status === 403 ? 'Only owners and admins can create API keys.' : err.message || 'Could not create the API key.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyKey = async () => {
    if (!rawKey) return;
    const ok = await copyText(rawKey);
    setCopied(ok);
    setCopyFailed(!ok);
    if (ok) setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!pendingRevoke) return;
    setIsRevoking(true);
    setActionError(null);
    try {
      await apiJson(`/api/v1/api-keys/${pendingRevoke.id}`, { method: 'DELETE' });
      await loadKeys();
    } catch (err: any) {
      setActionError(err.message || 'Could not revoke the API key.');
    } finally {
      setIsRevoking(false);
      setPendingRevoke(null);
    }
  };

  const curlSnippet = `curl -H "x-api-key: sk_live_..." ${origin}/api/v1/knowledge-bases`;

  const statusBadge = (status: KeyStatus) => {
    if (status === 'ACTIVE') return <Badge variant="success" size="sm">Active</Badge>;
    if (status === 'EXPIRED') return <Badge variant="warning" size="sm">Expired</Badge>;
    return <Badge variant="neutral" size="sm">Revoked</Badge>;
  };

  if (forbidden) {
    return (
      <SaaSLayout>
        <div className="max-w-xl mx-auto pt-16">
          <EmptyState
            icon={<Lock className="w-8 h-8" />}
            title="Only owners and admins can manage API keys"
            description="Ask an owner or admin of your organization if you need an API key for an integration."
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
              <Key className="w-5 h-5 text-[#2563EB]" />
              <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">API Keys</h1>
            </div>
            <p className="text-sm text-[#475569] mt-1">
              Keys let servers and scripts call the API on behalf of your organization. Only a hash is stored; the full key is shown once.
            </p>
          </div>
          <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
            Create API Key
          </Button>
        </div>

        {actionError && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-[8px] border border-red-200 bg-red-50 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {isLoading ? (
          <LoadingState message="Loading API keys..." />
        ) : loadError ? (
          <EmptyState
            icon={<AlertTriangle className="w-8 h-8" />}
            title="Could not load API keys"
            description={loadError}
            action={
              <Button variant="secondary" onClick={loadKeys} leftIcon={<RotateCw className="w-4 h-4" />}>
                Try again
              </Button>
            }
          />
        ) : keys.length === 0 ? (
          <EmptyState
            icon={<Key className="w-8 h-8" />}
            title="No API keys yet"
            description="Create a key to access knowledge bases, documents and chat from your own backend."
            action={
              <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
                Create API Key
              </Button>
            }
          />
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Key</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4">Last used</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {keys.map((key) => {
                    const status = keyStatus(key);
                    return (
                      <tr key={key.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-900">{key.name}</td>
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{key.key_prefix}…</td>
                        <td className="py-3 px-4">{statusBadge(status)}</td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{new Date(key.created_at).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{fmtDate(key.last_used_at) || 'Never'}</td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {key.expires_at ? new Date(key.expires_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {status === 'ACTIVE' ? (
                            <button
                              type="button"
                              onClick={() => setPendingRevoke(key)}
                              aria-label={`Revoke API key ${key.name}`}
                              title="Revoke key"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-[4px] transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Usage snippet */}
        <Card
          header={
            <span className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#2563EB]" /> Using a key
            </span>
          }
        >
          <div className="space-y-2 text-xs text-slate-600">
            <p>
              Send the key in the <code className="font-mono text-slate-800">x-api-key</code> header (or as{' '}
              <code className="font-mono text-slate-800">Authorization: Bearer &lt;key&gt;</code>):
            </p>
            <pre className="p-3 rounded-[6px] bg-[#0F172A] text-slate-100 font-mono text-[11px] overflow-x-auto whitespace-pre">
              {curlSnippet}
            </pre>
          </div>
        </Card>

        {/* Create modal (form, then one-time key reveal) */}
        <Modal isOpen={isCreateOpen} onClose={closeCreate} title={rawKey ? 'Your new API key' : 'Create API key'} maxWidth="lg">
          {rawKey ? (
            <div className="space-y-4">
              <div role="alert" className="flex items-start gap-2 p-3 rounded-[8px] border border-amber-200 bg-amber-50 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Copy this key now and store it somewhere safe. <strong>You won&apos;t be able to see it again.</strong>
                </span>
              </div>
              <div className="flex items-stretch gap-2">
                <code
                  className="flex-1 min-w-0 p-2.5 rounded-[6px] bg-slate-50 border border-slate-200 font-mono text-xs text-slate-900 break-all select-all"
                  aria-label="New API key"
                >
                  {rawKey}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyKey}
                  leftIcon={copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              {copyFailed && (
                <p className="text-xs text-red-600">Could not copy automatically. Select the key above and copy it manually.</p>
              )}
              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={closeCreate}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4" noValidate>
              {createError && (
                <div role="alert" className="flex items-start gap-2 p-3 rounded-[8px] border border-red-200 bg-red-50 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}
              <Input
                id="api-key-name"
                label="Key name"
                autoFocus
                placeholder="e.g. Production backend"
                value={keyName}
                maxLength={100}
                onChange={(e) => setKeyName(e.target.value)}
                error={nameError || undefined}
              />
              <Input
                id="api-key-expiry"
                label="Expires in (days, optional)"
                type="number"
                inputMode="numeric"
                min={1}
                max={3650}
                step={1}
                placeholder="Never expires"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                error={expiryError || undefined}
                helperText="Between 1 and 3650 days. Leave empty for a key that does not expire."
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={closeCreate} disabled={isCreating}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isCreating} disabled={!keyName.trim()}>
                  Create key
                </Button>
              </div>
            </form>
          )}
        </Modal>

        {/* Revoke confirmation */}
        <Modal
          isOpen={pendingRevoke !== null}
          onClose={() => !isRevoking && setPendingRevoke(null)}
          title="Revoke API key?"
          maxWidth="sm"
        >
          <div className="space-y-4 text-sm">
            <p className="text-slate-700">
              Requests using <strong className="text-slate-900">{pendingRevoke?.name}</strong> (
              <span className="font-mono text-xs">{pendingRevoke?.key_prefix}…</span>) will be rejected immediately. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setPendingRevoke(null)} disabled={isRevoking}>
                Cancel
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={handleRevoke} isLoading={isRevoking}>
                Revoke
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </SaaSLayout>
  );
}
