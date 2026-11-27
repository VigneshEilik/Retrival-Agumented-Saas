'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SaaSLayout } from '@/components/SaaSLayout';
import { apiFetch, apiJson, hasRealSession, isUuid, getOrCreateDefaultKnowledgeBase, KnowledgeBase } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Database, UploadCloud, Search, FileText, CheckCircle2, Clock, AlertTriangle, Trash2, Layers, RotateCw } from 'lucide-react';

interface DocumentItem {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  status: 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';
  errorMessage?: string | null;
  chunkCount: number;
  updatedAt: string;
}

const PROCESSING_STATES = ['QUEUED', 'PROCESSING'];

// Maps a backend document row (snake_case) to the UI model.
function toDocumentItem(row: any): DocumentItem {
  return {
    id: row.id,
    filename: row.title,
    fileSize: Number(row.file_size_bytes) || 0,
    mimeType: row.file_type || '',
    status: row.status,
    errorMessage: row.error_message,
    chunkCount: Number(row.chunk_count) || 0,
    updatedAt: row.updated_at || row.created_at,
  };
}

export default function DocumentManagementPage() {
  const params = useParams<{ id: string }>();
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'READY' | 'PROCESSING' | 'FAILED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDocuments = useCallback(async (kbId: string, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await apiJson<{ documents: any[] }>(`/api/v1/knowledge-bases/${kbId}/documents?limit=100`);
      setDocuments((data.documents || []).map(toDocumentItem));
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not load documents.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  // Resolve which knowledge base this page is for ("default-kb" -> the org's first KB, created if missing).
  useEffect(() => {
    if (!hasRealSession()) {
      setNeedsLogin(true);
      setIsLoading(false);
      return;
    }
    (async () => {
      try {
        const kb = isUuid(params.id)
          ? await apiJson<KnowledgeBase>(`/api/v1/knowledge-bases/${params.id}`)
          : await getOrCreateDefaultKnowledgeBase();
        setKnowledgeBase(kb);
        await fetchDocuments(kb.id);
      } catch (err: any) {
        if (err.status === 401) setNeedsLogin(true);
        else setErrorMsg(err.message || 'Could not load the knowledge base.');
        setIsLoading(false);
      }
    })();
  }, [params.id, fetchDocuments]);

  // While anything is still being ingested, poll so statuses update live.
  useEffect(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    if (knowledgeBase && documents.some((d) => PROCESSING_STATES.includes(d.status))) {
      pollTimer.current = setTimeout(() => fetchDocuments(knowledgeBase.id, true), 2500);
    }
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [documents, knowledgeBase, fetchDocuments]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !knowledgeBase) return;
    setIsUploading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await apiFetch(`/api/v1/knowledge-bases/${knowledgeBase.id}/documents`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || 'Upload failed.');
      }
      setIsUploadModalOpen(false);
      setUploadFile(null);
      await fetchDocuments(knowledgeBase.id, true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!knowledgeBase || !window.confirm(`Delete "${doc.filename}" and all of its indexed chunks?`)) return;
    try {
      await apiJson(`/api/v1/documents/${doc.id}`, { method: 'DELETE' });
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: any) {
      setErrorMsg(err.message || 'Delete failed.');
    }
  };

  const handleRetry = async (doc: DocumentItem) => {
    if (!knowledgeBase) return;
    try {
      await apiJson(`/api/v1/documents/${doc.id}/retry`, { method: 'POST' });
      await fetchDocuments(knowledgeBase.id, true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Retry failed.');
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'ALL') return matchesSearch;
    if (filter === 'READY') return matchesSearch && doc.status === 'READY';
    if (filter === 'PROCESSING') return matchesSearch && PROCESSING_STATES.includes(doc.status);
    if (filter === 'FAILED') return matchesSearch && doc.status === 'FAILED';
    return matchesSearch;
  });

  const getStatusBadge = (doc: DocumentItem) => {
    switch (doc.status) {
      case 'READY':
        return <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>READY</Badge>;
      case 'FAILED':
        return (
          <span title={doc.errorMessage || 'Ingestion failed'}>
            <Badge variant="danger" size="sm" icon={<AlertTriangle className="w-3 h-3" />}>FAILED</Badge>
          </span>
        );
      default:
        return <Badge variant="warning" size="sm" icon={<Clock className="w-3 h-3 animate-spin" />}>{doc.status}</Badge>;
    }
  };

  if (needsLogin) {
    return (
      <SaaSLayout>
        <div className="max-w-xl mx-auto pt-16">
          <EmptyState
            icon={<Database className="w-8 h-8" />}
            title="Sign in to manage documents"
            description="Please sign in to upload and index documents in your knowledge base."
            action={
              <Link href="/login">
                <Button>Go to sign in</Button>
              </Link>
            }
          />
        </div>
      </SaaSLayout>
    );
  }

  return (
    <SaaSLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <Link
          href="/knowledge-bases"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#2563EB] transition-colors"
        >
          ← All knowledge bases
        </Link>

        {/* Knowledge Base Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-[#2563EB]" />
              <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">{knowledgeBase?.name || 'Knowledge Base'}</h1>
              <Badge variant="indigo" size="sm">Hybrid search</Badge>
            </div>
            <p className="text-sm text-[#475569] mt-1">
              Uploaded files are parsed, chunked and embedded automatically, then become searchable in Chat.
            </p>
          </div>

          <Button
            disabled={!knowledgeBase}
            onClick={() => setIsUploadModalOpen(true)}
            leftIcon={<UploadCloud className="w-4 h-4" />}
            variant="primary"
            size="md"
          >
            Upload Document
          </Button>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-3 rounded-[8px] border border-slate-200 shadow-sm">
          
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {(['ALL', 'READY', 'PROCESSING', 'FAILED'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-[6px] transition-colors ${
                  filter === tab
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-72">
            <Input
              placeholder="Search documents by filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-[8px] border border-red-200 bg-red-50 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Document List Table */}
        {isLoading ? (
          <LoadingState message="Fetching knowledge base documents..." />
        ) : filteredDocs.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title="No Documents Found"
            description="Upload your first PDF, DOCX, TXT, or Markdown document to begin building your vector index."
            action={
              <Button onClick={() => setIsUploadModalOpen(true)} leftIcon={<UploadCloud className="w-4 h-4" />}>
                Upload First Document
              </Button>
            }
          />
        ) : (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Document</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Chunks</th>
                    <th className="py-3 px-4">Last Updated</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-[#2563EB] shrink-0" />
                        <span className="truncate max-w-xs">{doc.filename}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(doc)}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-slate-400" /> {doc.chunkCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {doc.status === 'FAILED' && (
                          <button
                            onClick={() => handleRetry(doc)}
                            title="Retry ingestion"
                            className="p-1.5 text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 rounded-[4px] transition-colors"
                          >
                            <RotateCw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(doc)}
                          title="Delete document"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-[4px] transition-colors"
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
        )}

        {/* Upload Document Modal */}
        <Modal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          title="Upload Document to Knowledge Base"
        >
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 hover:border-[#2563EB] rounded-[10px] p-6 text-center bg-slate-50/60 transition-colors">
              <UploadCloud className="w-8 h-8 text-[#2563EB] mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-900">Drag and drop file here, or click to browse</p>
              <p className="text-[11px] text-slate-500 mt-1">Supports PDF, DOCX, TXT, Markdown, and HTML (Max 25MB)</p>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md,.markdown,.html,.htm"
                className="hidden"
                id="file-upload"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              <label
                htmlFor="file-upload"
                className="inline-block mt-3 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-[6px] cursor-pointer transition-colors border border-slate-300 shadow-sm"
              >
                Choose File
              </label>
              {uploadFile && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-[#2563EB] font-medium">
                  Selected: {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsUploadModalOpen(false)} type="button">
                Cancel
              </Button>
              <Button variant="primary" size="sm" isLoading={isUploading} disabled={!uploadFile} type="submit">
                Start Ingestion Job
              </Button>
            </div>
          </form>
        </Modal>

      </div>
    </SaaSLayout>
  );
}
