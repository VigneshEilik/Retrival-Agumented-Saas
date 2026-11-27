'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { SaaSLayout } from '@/components/SaaSLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Send, Bot, User, FileText, RefreshCw, Copy, Check, Sparkles, BookOpen, X, ExternalLink, AlertTriangle, MessageSquare } from 'lucide-react';
import { apiFetch, apiJson, hasRealSession, getOrCreateDefaultKnowledgeBase, listKnowledgeBases, KnowledgeBase } from '@/lib/api';

interface Citation {
  citationId: number;
  chunkId: string;
  documentTitle: string;
  pageNumber?: number;
  sectionTitle?: string;
  snippet: string;
  similarityScore: number;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: string;
  isError?: boolean;
}

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Backend citation payload -> UI model.
function toCitation(c: any, idx: number): Citation {
  return {
    citationId: typeof c.citationId === 'number' ? c.citationId : idx + 1,
    chunkId: c.chunkId,
    documentTitle: c.documentTitle || 'Document',
    pageNumber: c.pageNumber,
    sectionTitle: c.sectionTitle,
    snippet: c.snippet || '',
    similarityScore: typeof c.relevanceScore === 'number' ? c.relevanceScore : 0,
  };
}

export default function GroundedChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string>('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load the organisation's knowledge bases (creating a default one on first use).
  useEffect(() => {
    if (!hasRealSession()) {
      setNeedsLogin(true);
      return;
    }
    (async () => {
      try {
        const defaultKb = await getOrCreateDefaultKnowledgeBase();
        const all = await listKnowledgeBases();
        setKnowledgeBases(all.length ? all : [defaultKb]);
        setSelectedKbId(defaultKb.id);
      } catch (err: any) {
        if (err.status === 401) setNeedsLogin(true);
        else setSetupError(err.message || 'Could not load knowledge bases.');
      }
    })();
  }, []);

  const resetSession = () => {
    setMessages([]);
    setConversationId(null);
    setActiveCitation(null);
  };

  const updateAssistant = (id: string, patch: Partial<Message> | ((m: Message) => Partial<Message>)) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m))
    );
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || isGenerating || !selectedKbId) return;

    const assistantId = `asst-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `usr-${Date.now()}`, sender: 'user', content: prompt, timestamp: now() },
      { id: assistantId, sender: 'assistant', content: '', timestamp: now() },
    ]);
    setInput('');
    setIsGenerating(true);

    try {
      // A conversation is created lazily on the first question.
      let convId = conversationId;
      if (!convId) {
        const conv = await apiJson<{ id: string }>('/api/v1/conversations', {
          method: 'POST',
          body: JSON.stringify({ knowledgeBaseId: selectedKbId, title: prompt.slice(0, 80) }),
        });
        convId = conv.id;
        setConversationId(convId);
      }

      const res = await apiFetch(`/api/v1/conversations/${convId}/messages/stream`, {
        method: 'POST',
        body: JSON.stringify({ prompt, knowledgeBaseId: selectedKbId }),
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || `Request failed (${res.status})`);
      }

      // Parse the Server-Sent Events stream: token | citations | done | error
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);

          let event = 'message';
          let data = '';
          for (const line of rawEvent.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data += line.slice(5).trim();
          }
          if (!data) continue;
          const payload = JSON.parse(data);

          if (event === 'token') {
            updateAssistant(assistantId, (m) => ({ content: m.content + (payload.text || '') }));
          } else if (event === 'citations') {
            updateAssistant(assistantId, { citations: (payload.citations || []).map(toCitation) });
          } else if (event === 'error') {
            throw new Error(payload.message || 'The assistant failed to answer.');
          }
        }
      }
    } catch (err: any) {
      updateAssistant(assistantId, (m) => ({
        content: m.content || `Sorry, something went wrong: ${err.message}`,
        isError: !m.content,
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  if (needsLogin) {
    return (
      <SaaSLayout>
        <div className="max-w-xl mx-auto pt-16">
          <EmptyState
            icon={<MessageSquare className="w-8 h-8" />}
            title="Sign in to chat with your documents"
            description="The assistant answers from your organisation's knowledge base. Please sign in to continue."
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

  const lastMessage = messages[messages.length - 1];
  const showThinking = isGenerating && lastMessage?.sender === 'assistant' && !lastMessage.content;

  return (
    <SaaSLayout>
      <div className="h-[calc(100vh-6.5rem)] flex flex-col md:flex-row gap-4 max-w-7xl mx-auto overflow-hidden">

        {/* Main Chat Interface */}
        <div className="flex-1 flex flex-col bg-white rounded-[10px] border border-slate-200 overflow-hidden shadow-sm">

          {/* Chat Window Header */}
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-[6px] bg-blue-50 text-[#2563EB] border border-blue-200">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
                  Grounded RAG Assistant
                  <Badge variant="success" size="sm">Hybrid search</Badge>
                </h2>
                <p className="text-[11px] text-slate-500">Answers only from the selected knowledge base, with sources.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedKbId}
                onChange={(e) => {
                  setSelectedKbId(e.target.value);
                  resetSession();
                }}
                disabled={isGenerating || knowledgeBases.length === 0}
                className="text-xs border border-slate-300 rounded-[6px] px-2 py-1.5 bg-white text-slate-700 max-w-[12rem]"
                aria-label="Knowledge base"
              >
                {knowledgeBases.map((kb) => (
                  <option key={kb.id} value={kb.id}>
                    {kb.name}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                onClick={resetSession}
                disabled={isGenerating}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Reset Session
              </Button>
            </div>
          </div>

          {/* Messages Stream View */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6 bg-[#F8FAFC]">
            {setupError && (
              <div className="flex items-start gap-2 p-3 rounded-[8px] border border-red-200 bg-red-50 text-xs text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{setupError}</span>
              </div>
            )}

            {messages.length === 0 && !setupError && (
              <div className="max-w-md mx-auto text-center pt-10 space-y-2">
                <Bot className="w-8 h-8 text-[#2563EB] mx-auto" />
                <p className="text-sm font-semibold text-slate-800">Ask a question about your documents</p>
                <p className="text-xs text-slate-500">
                  Upload files under{' '}
                  <Link href={selectedKbId ? `/knowledge-bases/${selectedKbId}/documents` : '/knowledge-bases'} className="text-[#2563EB] hover:underline">
                    Knowledge Bases
                  </Link>
                  , wait until they show READY, then ask away. Every answer links back to its sources.
                </p>
              </div>
            )}

            {messages.map((msg) => {
              if (msg.sender === 'assistant' && !msg.content) return null; // thinking indicator shown below
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-3xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-[6px] flex items-center justify-center font-bold text-xs shrink-0 ${
                      msg.sender === 'user'
                        ? 'bg-[#2563EB] text-white shadow-sm'
                        : 'bg-white text-[#2563EB] border border-slate-200 shadow-sm'
                    }`}
                  >
                    {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className={`space-y-2 group min-w-0 ${msg.sender === 'user' ? 'text-right' : ''}`}>
                    <div
                      className={`p-4 rounded-[8px] text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words text-left ${
                        msg.sender === 'user'
                          ? 'bg-[#2563EB] text-white rounded-tr-none shadow-sm'
                          : msg.isError
                          ? 'bg-red-50 border border-red-200 text-red-700 rounded-tl-none'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                      }`}
                    >
                      {msg.content}
                    </div>

                    {/* Inline Citation Chips */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-[#2563EB]" /> Sources:
                        </span>
                        {msg.citations.map((cite) => (
                          <button
                            key={cite.chunkId}
                            onClick={() => setActiveCitation(cite)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-blue-50 hover:bg-blue-100 text-[#2563EB] border border-blue-200 text-[11px] font-medium transition-colors"
                          >
                            <FileText className="w-3 h-3" />
                            <span>[{cite.citationId}] {cite.documentTitle}</span>
                            <span className="text-[10px] text-blue-600 font-mono">({Math.round(cite.similarityScore * 100)}%)</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Message Footer Controls */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1">
                      <span>{msg.timestamp}</span>
                      {msg.sender === 'assistant' && (
                        <button
                          onClick={() => copyToClipboard(msg.id, msg.content)}
                          className="hover:text-slate-700 flex items-center gap-1 transition-colors"
                        >
                          {copiedMsgId === msg.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedMsgId === msg.id ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {showThinking && (
              <div className="flex gap-3 max-w-3xl">
                <div className="w-8 h-8 rounded-[6px] bg-white border border-slate-200 text-[#2563EB] flex items-center justify-center shadow-sm">
                  <Bot className="w-4 h-4 animate-bounce" />
                </div>
                <div className="p-4 rounded-[8px] bg-white border border-slate-200 text-xs text-slate-600 flex items-center gap-2 shadow-sm">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
                  Searching your knowledge base...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Input Form */}
          <form onSubmit={handleSendMessage} className="p-3.5 border-t border-slate-200 bg-white flex items-center gap-3">
            <Input
              placeholder="Ask anything based on your knowledge base..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isGenerating || !selectedKbId}
            />
            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={isGenerating}
              disabled={!input.trim() || !selectedKbId}
              rightIcon={<Send className="w-4 h-4" />}
            >
              Send
            </Button>
          </form>
        </div>

        {/* Slide-Over Citation Drawer */}
        {activeCitation && (
          <div className="w-full md:w-80 bg-white border border-slate-200 rounded-[10px] p-5 shadow-lg flex flex-col space-y-4 shrink-0">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Source Citation Details</h3>
              </div>
              <button
                onClick={() => setActiveCitation(null)}
                aria-label="Close source panel"
                className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Document</label>
                <div className="text-xs font-semibold text-slate-900 mt-0.5">{activeCitation.documentTitle}</div>
              </div>

              {(activeCitation.pageNumber || activeCitation.sectionTitle) && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Location</label>
                  <div className="text-xs text-[#2563EB] font-mono mt-0.5">
                    {[activeCitation.pageNumber ? `Page ${activeCitation.pageNumber}` : '', activeCitation.sectionTitle ? `Section: ${activeCitation.sectionTitle}` : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Relevance</label>
                <div className="mt-1">
                  <Badge variant="indigo" size="sm">
                    {Math.round(activeCitation.similarityScore * 100)}% match
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Extracted Passage</label>
                <div className="mt-1.5 p-3 rounded-[6px] bg-slate-50 border border-slate-200 text-xs text-slate-700 font-mono leading-relaxed">
                  &ldquo;{activeCitation.snippet}&rdquo;
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <Link href={selectedKbId ? `/knowledge-bases/${selectedKbId}/documents` : '/knowledge-bases'}>
                <Button variant="secondary" size="sm" className="w-full" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                  View Documents
                </Button>
              </Link>
            </div>
          </div>
        )}

      </div>
    </SaaSLayout>
  );
}
