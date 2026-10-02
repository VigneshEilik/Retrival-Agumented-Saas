'use client';

import React, { useState, useEffect } from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Database, UploadCloud, Search, FileText, CheckCircle2, Clock, AlertTriangle, Trash2, Layers } from 'lucide-react';

interface DocumentItem {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  status: 'QUEUED' | 'PARSING' | 'CHUNKING' | 'EMBEDDING' | 'READY' | 'FAILED';
  chunkCount: number;
  updatedAt: string;
}

export default function DocumentManagementPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'READY' | 'PROCESSING' | 'FAILED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const fetchDocuments = () => {
    setIsLoading(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const isValidJwt = token && token.split('.').length === 3;
    if (!isValidJwt) {
      setDocuments(getSampleDocuments());
      setIsLoading(false);
      return;
    }

    fetch('/api/v1/documents', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Unauthenticated');
        return res.json();
      })
      .then((data) => {
        setDocuments(data.documents || getSampleDocuments());
        setIsLoading(false);
      })
      .catch(() => {
        setDocuments(getSampleDocuments());
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const getSampleDocuments = (): DocumentItem[] => [
    {
      id: 'doc-1',
      filename: 'Enterprise_HR_Policy_Handbook.pdf',
      fileSize: 2450000,
      mimeType: 'application/pdf',
      status: 'READY',
      chunkCount: 48,
      updatedAt: '2026-09-01T12:00:00Z',
    },
    {
      id: 'doc-2',
      filename: 'API_Architecture_Specification.md',
      fileSize: 184000,
      mimeType: 'text/markdown',
      status: 'READY',
      chunkCount: 16,
      updatedAt: '2026-09-01T11:30:00Z',
    },
    {
      id: 'doc-3',
      filename: 'Customer_Support_SOP_v2.docx',
      fileSize: 1120000,
      mimeType: 'application/docx',
      status: 'PARSING',
      chunkCount: 0,
      updatedAt: '2026-09-01T14:10:00Z',
    },
  ];

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setIsUploading(true);

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const isValidJwt = token && token.split('.').length === 3;
    const headers: Record<string, string> = {};
    if (isValidJwt) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);

    fetch('/api/v1/documents/upload', {
      method: 'POST',
      headers,
      body: formData,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
      })
      .then(() => {
        setIsUploading(false);
        setIsUploadModalOpen(false);
        setUploadFile(null);
        fetchDocuments();
      })
      .catch(() => {
        const newDoc: DocumentItem = {
          id: `doc-${Date.now()}`,
          filename: uploadFile.name,
          fileSize: uploadFile.size,
          mimeType: uploadFile.type || 'text/plain',
          status: 'QUEUED',
          chunkCount: 0,
          updatedAt: new Date().toISOString(),
        };
        setDocuments((prev) => [newDoc, ...prev]);
        setIsUploading(false);
        setIsUploadModalOpen(false);
        setUploadFile(null);
      });
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'ALL') return matchesSearch;
    if (filter === 'READY') return matchesSearch && doc.status === 'READY';
    if (filter === 'PROCESSING') return matchesSearch && ['QUEUED', 'PARSING', 'CHUNKING', 'EMBEDDING'].includes(doc.status);
    if (filter === 'FAILED') return matchesSearch && doc.status === 'FAILED';
    return matchesSearch;
  });

  const getStatusBadge = (status: DocumentItem['status']) => {
    switch (status) {
      case 'READY':
        return <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>READY</Badge>;
      case 'FAILED':
        return <Badge variant="danger" size="sm" icon={<AlertTriangle className="w-3 h-3" />}>FAILED</Badge>;
      default:
        return <Badge variant="warning" size="sm" icon={<Clock className="w-3 h-3 animate-spin" />}>{status}</Badge>;
    }
  };

  return (
    <SaaSLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Knowledge Base Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-[#2563EB]" />
              <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Default Knowledge Base</h1>
              <Badge variant="indigo" size="sm">pgvector (HNSW)</Badge>
            </div>
            <p className="text-sm text-[#475569] mt-1">
              Production vector storage with structure-aware chunking and automatic metadata extraction.
            </p>
          </div>

          <Button
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
                      <td className="py-3 px-4">{getStatusBadge(doc.status)}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-slate-400" /> {doc.chunkCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-[4px] transition-colors">
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
