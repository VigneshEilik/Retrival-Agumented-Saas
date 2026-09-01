'use client';

import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, Trash2, Search, ArrowRight, ShieldCheck, Database, Layers } from 'lucide-react';

interface DocumentItem {
  id: string;
  title: string;
  file_type: string;
  file_size_bytes: number;
  status: 'QUEUED' | 'PROCESSING' | 'PARSING' | 'CHUNKING' | 'EMBEDDING' | 'INDEXING' | 'READY' | 'FAILED';
  error_message?: string;
  chunk_count: number;
  updated_at: string;
}

export default function DocumentManagementPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([
    {
      id: 'doc-1',
      title: 'Enterprise Architecture Spec v2.pdf',
      file_type: 'application/pdf',
      file_size_bytes: 4200000,
      status: 'READY',
      chunk_count: 48,
      updated_at: '2026-09-01T10:30:00Z',
    },
    {
      id: 'doc-2',
      title: 'Security Compliance Matrix.docx',
      file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      file_size_bytes: 1800000,
      status: 'EMBEDDING',
      chunk_count: 0,
      updated_at: '2026-09-01T11:15:00Z',
    },
    {
      id: 'doc-3',
      title: 'Corrupted-Header-Legacy.pdf',
      file_type: 'application/pdf',
      file_size_bytes: 950000,
      status: 'FAILED',
      error_message: 'PDF parsing failed: Corrupted cross-reference trailer table',
      chunk_count: 0,
      updated_at: '2026-09-01T11:00:00Z',
    },
  ]);

  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleSimulatedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploading(true);

      setTimeout(() => {
        const newDoc: DocumentItem = {
          id: `doc-${Date.now()}`,
          title: file.name,
          file_type: file.type || 'text/plain',
          file_size_bytes: file.size,
          status: 'QUEUED',
          chunk_count: 0,
          updated_at: new Date().toISOString(),
        };
        setDocuments((prev) => [newDoc, ...prev]);
        setIsUploading(false);

        // Simulate async pipeline status transitions
        setTimeout(() => {
          setDocuments((prev) =>
            prev.map((d) => (d.id === newDoc.id ? { ...d, status: 'CHUNKING' } : d))
          );
          setTimeout(() => {
            setDocuments((prev) =>
              prev.map((d) => (d.id === newDoc.id ? { ...d, status: 'READY', chunk_count: 12 } : d))
            );
          }, 2000);
        }, 1500);
      }, 1000);
    }
  };

  const handleRetry = (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, status: 'QUEUED', error_message: undefined } : d))
    );
    setTimeout(() => {
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: 'READY', chunk_count: 8 } : d))
      );
    }, 2500);
  };

  const handleDelete = (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const filteredDocs = documents.filter((d) => {
    const matchesFilter = filter === 'ALL' || d.status === filter;
    const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-1">
              <Database className="w-4 h-4" /> Knowledge Base Management
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Engineering Documentation Base</h1>
            <p className="text-gray-400 text-sm mt-1">Upload, ingest, and process tenant documents into grounded vector embeddings.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-medium rounded-lg shadow-lg cursor-pointer text-sm">
              <Upload className="w-4 h-4" />
              {isUploading ? 'Uploading...' : 'Upload Document'}
              <input type="file" className="hidden" onChange={handleSimulatedUpload} accept=".pdf,.docx,.txt,.md,.html" />
            </label>
          </div>
        </div>

        {/* Upload Dropzone */}
        <div className="glass-panel p-8 rounded-xl border border-indigo-500/20 text-center hover:border-indigo-500/40 transition-all cursor-pointer relative overflow-hidden">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-white">Drag & drop files or click to upload</h3>
            <p className="text-xs text-gray-400">Supported formats: PDF, DOCX, TXT, Markdown, HTML. Maximum file size: 25 MB.</p>
            <div className="flex items-center justify-center gap-4 text-xs text-gray-500 pt-2">
              <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Tenant Isolated</span>
              <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-indigo-400" /> Structure-Aware Chunking</span>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            {['ALL', 'READY', 'PROCESSING', 'CHUNKING', 'EMBEDDING', 'FAILED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === status
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Documents Table */}
        <div className="glass-panel rounded-xl overflow-hidden border border-gray-800">
          {filteredDocs.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <h3 className="text-base font-medium text-gray-300">Your knowledge base is empty</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                Upload your first PDF, DOCX, Markdown, or TXT document to start asking grounded questions.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-900/60 border-b border-gray-800 text-gray-400 font-medium">
                <tr>
                  <th className="py-3.5 px-4">Document</th>
                  <th className="py-3.5 px-4">Size</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Chunks</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-4 px-4 font-medium text-white flex items-center gap-3">
                      <FileText className="w-5 h-5 text-indigo-400 shrink-0" />
                      <div>
                        <div>{doc.title}</div>
                        {doc.error_message && (
                          <div className="text-xs text-rose-400 mt-0.5 max-w-md">{doc.error_message}</div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-400">{formatBytes(doc.file_size_bytes)}</td>
                    <td className="py-4 px-4">
                      {doc.status === 'READY' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                        </span>
                      )}
                      {['QUEUED', 'PROCESSING', 'PARSING', 'CHUNKING', 'EMBEDDING', 'INDEXING'].includes(doc.status) && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {doc.status}
                        </span>
                      )}
                      {doc.status === 'FAILED' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <AlertCircle className="w-3.5 h-3.5" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-gray-300 font-mono">{doc.chunk_count}</td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {doc.status === 'FAILED' && (
                          <button
                            onClick={() => handleRetry(doc.id)}
                            className="p-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded transition-colors"
                            title="Retry Processing"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 text-xs text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                          title="Delete Document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
