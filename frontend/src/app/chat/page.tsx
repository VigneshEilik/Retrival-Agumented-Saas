'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, FileText, Database, ShieldCheck, Sparkles, X, ChevronRight, RefreshCw, MessageSquare } from 'lucide-react';

interface Citation {
  citationId: number;
  documentId: string;
  documentTitle: string;
  chunkId: string;
  pageNumber?: number;
  sectionTitle?: string;
  snippet: string;
  relevanceScore: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-1',
      role: 'assistant',
      content: 'Hello! I am your tenant-isolated RAG Assistant. Ask me anything grounded in your uploaded knowledge base documents.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSendPrompt = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPrompt.trim() || isGenerating) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentQuery = inputPrompt;
    setInputPrompt('');
    setIsGenerating(true);

    const assistantMessageId = `asst-${Date.now()}`;
    const initialAssistantMsg: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      citations: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, initialAssistantMsg]);

    // Simulate progressive SSE token streaming & citations
    setTimeout(() => {
      let accumulatedText = 'According to the company documentation, employees receive ';
      const tokens = ['20 ', 'days ', 'of ', 'annual ', 'leave ', 'per ', 'year ', 'subject ', 'to ', 'manager ', 'approval. ', '[1]'];

      let tokenIdx = 0;
      const interval = setInterval(() => {
        if (tokenIdx < tokens.length) {
          accumulatedText += tokens[tokenIdx];
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMessageId ? { ...m, content: accumulatedText } : m))
          );
          tokenIdx++;
        } else {
          clearInterval(interval);
          const mockCitations: Citation[] = [
            {
              citationId: 1,
              documentId: 'doc-101',
              documentTitle: 'HR Policy Manual.pdf',
              chunkId: 'chunk-50',
              pageNumber: 10,
              sectionTitle: 'Annual Leave & PTO',
              snippet: 'Full time employees receive 20 days of annual leave per year subject to manager approval.',
              relevanceScore: 0.92,
            },
          ];

          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMessageId ? { ...m, citations: mockCitations } : m))
          );
          setIsGenerating(false);
        }
      }, 80);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-gray-100 flex flex-col">
      
      {/* Top Navbar */}
      <header className="h-16 border-b border-gray-800 bg-[#0d1322] px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              Production RAG Chatbot <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal">Grounded SSE Stream</span>
            </h1>
            <p className="text-xs text-gray-400">Knowledge Base: Engineering Documentation Base</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20">
            <ShieldCheck className="w-3.5 h-3.5" /> PostgreSQL RLS Isolated
          </span>
        </div>
      </header>

      {/* Main Chat Interface */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Chat Stream Window */}
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 md:p-6 overflow-hidden">
          
          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-md">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-2xl space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none shadow-lg'
                        : 'glass-panel text-gray-100 rounded-bl-none border border-gray-800'
                    }`}
                  >
                    <div>{msg.content || (isGenerating && <span className="animate-pulse">Thinking...</span>)}</div>

                    {/* Grounded Citation Chips */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-800/80 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                          <Database className="w-3 h-3 text-indigo-400" /> Sources:
                        </span>
                        {msg.citations.map((cit) => (
                          <button
                            key={cit.citationId}
                            onClick={() => setActiveCitation(cit)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition-colors"
                          >
                            <FileText className="w-3 h-3" />
                            [{cit.citationId}] {cit.documentTitle}
                            {cit.pageNumber && <span className="text-gray-400">P.{cit.pageNumber}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 px-1">{msg.timestamp}</div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-gray-800 text-gray-300 flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Input Form */}
          <form onSubmit={handleSendPrompt} className="mt-4 relative">
            <input
              type="text"
              placeholder="Ask a question about your knowledge base documents..."
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              disabled={isGenerating}
              className="w-full pl-5 pr-14 py-3.5 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 shadow-xl disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputPrompt.trim() || isGenerating}
              className="absolute right-2.5 top-2.5 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 text-white rounded-lg transition-colors"
            >
              {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>

        </div>

        {/* Slide-over Grounded Citation Context Drawer */}
        {activeCitation && (
          <div className="w-80 border-l border-gray-800 bg-[#0d1322] p-6 space-y-6 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold">
                <FileText className="w-4 h-4" /> Citation Context [{activeCitation.citationId}]
              </div>
              <button
                onClick={() => setActiveCitation(null)}
                className="p-1 text-gray-400 hover:text-white rounded-md hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-gray-500 font-medium uppercase tracking-wider text-[10px]">Document Title</label>
                <div className="text-white font-medium text-sm mt-0.5">{activeCitation.documentTitle}</div>
              </div>

              {activeCitation.pageNumber && (
                <div>
                  <label className="text-gray-500 font-medium uppercase tracking-wider text-[10px]">Page Number</label>
                  <div className="text-indigo-300 font-medium mt-0.5">Page {activeCitation.pageNumber}</div>
                </div>
              )}

              {activeCitation.sectionTitle && (
                <div>
                  <label className="text-gray-500 font-medium uppercase tracking-wider text-[10px]">Section Title</label>
                  <div className="text-gray-200 font-medium mt-0.5">{activeCitation.sectionTitle}</div>
                </div>
              )}

              <div>
                <label className="text-gray-500 font-medium uppercase tracking-wider text-[10px]">Relevance Score</label>
                <div className="text-emerald-400 font-mono font-medium mt-0.5">{(activeCitation.relevanceScore * 100).toFixed(1)}% Match</div>
              </div>

              <div>
                <label className="text-gray-500 font-medium uppercase tracking-wider text-[10px]">Retrieved Chunk Snippet</label>
                <div className="p-3 bg-gray-900 rounded-lg border border-gray-800 text-gray-300 font-mono leading-relaxed mt-1">
                  "{activeCitation.snippet}"
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
