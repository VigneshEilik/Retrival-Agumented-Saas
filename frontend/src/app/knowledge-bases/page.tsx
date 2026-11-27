'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { SaaSLayout } from '@/components/SaaSLayout';
import { apiJson, hasRealSession } from '@/lib/api';
import { useMe, isAdminRole } from '@/lib/session';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Database, Plus, Trash2, AlertTriangle, FileText, ArrowRight, RotateCw } from 'lucide-react';

interface KnowledgeBaseRow {
  id: string;
  name: string;
  description: string | null;
  chunk_size: number;
  chunk_overlap: number;
  created_at: string;
  updated_at: string;
  document_count: number | string;
}

const NAME_MAX = 120;
const DESCRIPTION_MAX = 1000;

export default function KnowledgeBasesPage() {
  const { role } = useMe();
  const canDelete = isAdminRole(role);
  const canCreate = role !== 'VIEWER';

  const [kbs, setKbs] = useState<KnowledgeBaseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<KnowledgeBaseRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadKnowledgeBases = useCallback(async () => {
    if (!hasRealSession()) return;
    setIsLoading(true);
    try {
      const data = await apiJson<{ knowledgeBases: KnowledgeBaseRow[] }>('/api/v1/knowledge-bases');
      setKbs(data.knowledgeBases || []);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err.message || 'Could not load knowledge bases.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKnowledgeBases();
  }, [loadKnowledgeBases]);

  const openCreate = () => {
    setName('');
    setDescription('');
    setNameError(null);
    setDescriptionError(null);
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    let valid = true;
    if (!trimmedName) {
      setNameError('Name is required.');
      valid = false;
    } else if (trimmedName.length > NAME_MAX) {
      setNameError(`Name must be at most ${NAME_MAX} characters.`);
      valid = false;
    } else {
      setNameError(null);
    }
    if (trimmedDescription.length > DESCRIPTION_MAX) {
      setDescriptionError(`Description must be at most ${DESCRIPTION_MAX} characters.`);
      valid = false;
    } else {
      setDescriptionError(null);
    }
    if (!valid) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      await apiJson('/api/v1/knowledge-bases', {
        method: 'POST',
        body: JSON.stringify({ name: trimmedName, description: trimmedDescription || undefined }),
      });
      setIsCreateOpen(false);
      await loadKnowledgeBases();
    } catch (err: any) {
      if (err.code === 'QUOTA_EXCEEDED') {
        setCreateError(`${err.message} Delete an existing knowledge base or upgrade your plan to add more.`);
      } else if (err.status === 403) {
        setCreateError('Your role does not allow creating knowledge bases.');
      } else {
        setCreateError(err.message || 'Could not create the knowledge base.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await apiJson(`/api/v1/knowledge-bases/${pendingDelete.id}`, { method: 'DELETE' });
      setKbs((prev) => prev.filter((kb) => kb.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err: any) {
      setActionError(
        err.status === 403 ? 'Only owners and admins can delete knowledge bases.' : err.message || 'Delete failed.'
      );
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SaaSLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-[#2563EB]" />
              <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Knowledge Bases</h1>
            </div>
            <p className="text-sm text-[#475569] mt-1">
              Each knowledge base holds its own documents and search index. Chat answers are grounded in one knowledge base at a time.
            </p>
          </div>
          {canCreate && (
            <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
              New Knowledge Base
            </Button>
          )}
        </div>

        {actionError && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-[8px] border border-red-200 bg-red-50 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {isLoading ? (
          <LoadingState message="Loading knowledge bases..." />
        ) : loadError ? (
          <EmptyState
            icon={<AlertTriangle className="w-8 h-8" />}
            title="Could not load knowledge bases"
            description={loadError}
            action={
              <Button variant="secondary" onClick={loadKnowledgeBases} leftIcon={<RotateCw className="w-4 h-4" />}>
                Try again
              </Button>
            }
          />
        ) : kbs.length === 0 ? (
          <EmptyState
            icon={<Database className="w-8 h-8" />}
            title="No knowledge bases yet"
            description="Create a knowledge base, then upload documents to it to start asking grounded questions in Chat."
            action={
              canCreate ? (
                <Button onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
                  Create Knowledge Base
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {kbs.map((kb) => {
              const docCount = Number(kb.document_count) || 0;
              return (
                <Card key={kb.id} hoverable className="flex flex-col">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/knowledge-bases/${kb.id}/documents`}
                        className="text-base font-semibold text-[#0F172A] hover:text-[#2563EB] transition-colors break-words min-w-0"
                      >
                        {kb.name}
                      </Link>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setPendingDelete(kb)}
                          aria-label={`Delete knowledge base ${kb.name}`}
                          title="Delete knowledge base"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-[4px] transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 min-h-[1rem]">
                      {kb.description || <span className="text-slate-400">No description</span>}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        {docCount} {docCount === 1 ? 'document' : 'documents'}
                      </span>
                      <span>Created {new Date(kb.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-100">
                      <Link
                        href={`/knowledge-bases/${kb.id}/documents`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
                      >
                        Manage documents <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create modal */}
        <Modal isOpen={isCreateOpen} onClose={() => !isCreating && setIsCreateOpen(false)} title="New knowledge base">
          <form onSubmit={handleCreate} className="space-y-4" noValidate>
            {createError && (
              <div role="alert" className="flex items-start gap-2 p-3 rounded-[8px] border border-red-200 bg-red-50 text-xs text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}
            <Input
              id="kb-name"
              label="Name"
              autoFocus
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Product documentation"
              error={nameError || undefined}
              helperText={`${name.trim().length}/${NAME_MAX} characters`}
            />
            <div className="space-y-1.5">
              <label htmlFor="kb-description" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Description (optional)
              </label>
              <textarea
                id="kb-description"
                rows={3}
                value={description}
                maxLength={DESCRIPTION_MAX}
                onChange={(e) => setDescription(e.target.value)}
                aria-invalid={descriptionError ? true : undefined}
                className={`w-full px-3.5 py-2 bg-white border rounded-[6px] text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none transition-all ${
                  descriptionError
                    ? 'border-red-500 focus:ring-2 focus:ring-red-100'
                    : 'border-[#CBD5E1] focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]'
                }`}
              />
              {descriptionError ? (
                <p className="text-xs text-red-600 font-medium">{descriptionError}</p>
              ) : (
                <p className="text-xs text-slate-500">{description.trim().length}/{DESCRIPTION_MAX} characters</p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isCreating} disabled={!name.trim()}>
                Create
              </Button>
            </div>
          </form>
        </Modal>

        {/* Delete confirmation */}
        <Modal
          isOpen={pendingDelete !== null}
          onClose={() => !isDeleting && setPendingDelete(null)}
          title="Delete knowledge base?"
          maxWidth="sm"
        >
          <div className="space-y-4 text-sm">
            <p className="text-slate-700">
              <strong className="text-slate-900">{pendingDelete?.name}</strong> and all{' '}
              {Number(pendingDelete?.document_count) || 0} of its documents and indexed chunks will be permanently deleted.
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setPendingDelete(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button type="button" variant="danger" size="sm" onClick={handleDelete} isLoading={isDeleting}>
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </SaaSLayout>
  );
}
