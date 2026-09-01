import Link from 'next/link';
import { Database, ShieldCheck, Cpu, ArrowRight, Layers, Lock } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#090d16] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl text-center space-y-6 z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" /> Production RAG SaaS Architecture v2.0
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
          Commercial Multi-Tenant <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            RAG Chatbot SaaS Platform
          </span>
        </h1>

        <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto">
          Production-grade knowledge ingestion, PostgreSQL <code className="text-indigo-300">pgvector</code> search, Row-Level Security (RLS) tenant isolation, and asynchronous BullMQ processing.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/knowledge-bases/default-kb/documents"
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm"
          >
            Launch Document Ingestion UI <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Core Architecture Metrics Pill Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-12">
          <div className="glass-panel p-5 rounded-xl border border-gray-800 text-left">
            <Lock className="w-6 h-6 text-indigo-400 mb-2" />
            <h3 className="text-base font-semibold">PostgreSQL RLS</h3>
            <p className="text-xs text-gray-400 mt-1">Strict server-side Row-Level Security policies enforcing tenant isolation across all tables.</p>
          </div>
          <div className="glass-panel p-5 rounded-xl border border-gray-800 text-left">
            <Layers className="w-6 h-6 text-purple-400 mb-2" />
            <h3 className="text-base font-semibold">Structure-Aware Chunking</h3>
            <p className="text-xs text-gray-400 mt-1">Page and section boundary preservation with metadata annotation for accurate citations.</p>
          </div>
          <div className="glass-panel p-5 rounded-xl border border-gray-800 text-left">
            <Cpu className="w-6 h-6 text-emerald-400 mb-2" />
            <h3 className="text-base font-semibold">Idempotent Worker Queue</h3>
            <p className="text-xs text-gray-400 mt-1">Redis + BullMQ background jobs with exponential retries and deterministic vector deduplication.</p>
          </div>
        </div>

      </div>
    </main>
  );
}
