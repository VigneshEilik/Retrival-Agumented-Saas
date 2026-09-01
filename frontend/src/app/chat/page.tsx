'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { MessageSquare, Send, Bot, User, FileText, ChevronRight, RefreshCw, Copy, Check, Sparkles, BookOpen, X, ExternalLink } from 'lucide-react';

interface Citation {
  chunkId: string;
  documentTitle: string;
  pageNumber?: number;
  snippet: string;
  similarityScore: number;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: string;
}

export default function GroundedChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-1',
      sender: 'user',
      content: 'What is the company paid time off (PTO) policy and carry-over limit?',
      timestamp: '10:14 AM',
    },
    {
      id: 'msg-2',
      sender: 'assistant',
      content:
        'According to the Enterprise HR Policy Handbook, full-time employees receive 24 paid annual leave days. Unused PTO up to a maximum of 5 days can be carried over into the following calendar year, provided carry-over requests are submitted prior to December 15th.',
      citations: [
        {
          chunkId: 'chunk-101',
          documentTitle: 'Enterprise_HR_Policy_Handbook.pdf',
          pageNumber: 14,
          snippet: 'Section 4.2: Paid Time Off (PTO). Full-time employees accrue 24 annual leave days. Maximum carry-over is capped at 5 unused days into the next calendar year.',
          similarityScore: 0.92,
        },
      ],
      timestamp: '10:14 AM',
    },
  ]);

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    // Simulate SSE token streaming for demonstration
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        content:
          'Based on the indexed document API_Architecture_Specification.md, Row-Level Security (RLS) policies are enforced at the PostgreSQL database layer for strict tenant data isolation.',
        citations: [
          {
            chunkId: 'chunk-202',
            documentTitle: 'API_Architecture_Specification.md',
            pageNumber: 3,
            snippet: 'Database security architecture relies on PostgreSQL Row-Level Security (RLS) with session parameters set on every connection pool query.',
            similarityScore: 0.89,
          },
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsGenerating(false);
    }, 1200);
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  return (
    <SaaSLayout>
      <div className="h-[calc(100vh-6.5rem)] flex flex-col md:flex-row gap-4 max-w-7xl mx-auto overflow-hidden">
        
        {/* Main Chat Interface */}
        <div className="flex-1 flex flex-col bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden shadow-panel">
          
          {/* Chat Window Header */}
          <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  Grounded RAG Assistant
                  <Badge variant="success" size="sm">RRF Hybrid 0.85</Badge>
                </h2>
                <p className="text-[11px] text-slate-400">Strictly grounded in your organization's knowledge base.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Reset Session
            </Button>
          </div>

          {/* Messages Stream View */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-indigo-400 border border-slate-700'
                  }`}
                >
                  {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className={`space-y-2 group ${msg.sender === 'user' ? 'text-right' : ''}`}>
                  
                  <div
                    className={`p-4 rounded-xl text-xs md:text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-950/80 border border-slate-800 text-slate-200 rounded-tl-none'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Inline Citation Chips */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-indigo-400" /> Grounded Source:
                      </span>
                      {msg.citations.map((cite, idx) => (
                        <button
                          key={cite.chunkId}
                          onClick={() => setActiveCitation(cite)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-medium transition-colors"
                        >
                          <FileText className="w-3 h-3" />
                          <span>[{idx + 1}] {cite.documentTitle}</span>
                          <span className="text-[10px] text-indigo-400 font-mono">({Math.round(cite.similarityScore * 100)}%)</span>
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
                        className="hover:text-slate-200 flex items-center gap-1 transition-colors"
                      >
                        {copiedMsgId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedMsgId === msg.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>

                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex gap-3 max-w-3xl">
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-indigo-400 flex items-center justify-center">
                  <Bot className="w-4 h-4 animate-bounce" />
                </div>
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  Generating grounded answer from knowledge base...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Input Form */}
          <form onSubmit={handleSendMessage} className="p-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center gap-3">
            <Input
              placeholder="Ask anything based on your knowledge base..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isGenerating}
            />
            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={isGenerating}
              disabled={!input.trim()}
              rightIcon={<Send className="w-4 h-4" />}
            >
              Send
            </Button>
          </form>

        </div>

        {/* Slide-Over Citation Drawer */}
        {activeCitation && (
          <div className="w-full md:w-80 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col space-y-4 shrink-0">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Source Citation Details</h3>
              </div>
              <button
                onClick={() => setActiveCitation(null)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Document</label>
                <div className="text-xs font-semibold text-white mt-0.5">{activeCitation.documentTitle}</div>
              </div>

              {activeCitation.pageNumber && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</label>
                  <div className="text-xs text-indigo-400 font-mono mt-0.5">Page {activeCitation.pageNumber}</div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Similarity Relevance</label>
                <div className="mt-1">
                  <Badge variant="indigo" size="sm">
                    {Math.round(activeCitation.similarityScore * 100)}% Hybrid Match
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Extracted Passage</label>
                <div className="mt-1.5 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono leading-relaxed">
                  "{activeCitation.snippet}"
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <Button variant="outline" size="sm" className="w-full" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                Open Full Document
              </Button>
            </div>
          </div>
        )}

      </div>
    </SaaSLayout>
  );
}
