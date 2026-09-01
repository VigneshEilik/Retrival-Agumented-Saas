'use client';

import React, { useState } from 'react';
import { Cpu, Play, CheckCircle2, ShieldCheck, Layers, Terminal, Calculator, Database, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';

interface AgentStep {
  stepNumber: number;
  state: string;
  thought: string;
  actionType?: string;
}

interface ToolCall {
  toolName: string;
  arguments: any;
  status: 'COMPLETED' | 'FAILED' | 'PENDING';
  result?: any;
  latencyMs: number;
}

export default function AgentDashboardPage() {
  const [prompt, setPrompt] = useState('Find the enterprise tier license cost in the pricing sheet and calculate the total for 10 users.');
  const [isRunning, setIsRunning] = useState(false);
  const [activeSteps, setActiveSteps] = useState<AgentStep[]>([
    { stepNumber: 1, state: 'RECEIVED', thought: 'Objective received from tenant user' },
    { stepNumber: 2, state: 'THINKING', thought: 'Analyzing prompt: Requires RAG document search followed by calculation' },
    { stepNumber: 3, state: 'TOOL_SELECTION', thought: 'Selecting RAGSearchTool to find enterprise pricing', actionType: 'RAGSearchTool' },
    { stepNumber: 4, state: 'TOOL_EXECUTING', thought: 'Executing RAGSearchTool query: "enterprise tier license cost"', actionType: 'RAGSearchTool' },
    { stepNumber: 5, state: 'TOOL_RESULT', thought: 'Retrieved chunk: "Enterprise tier license cost is ₹4,500 per user per month."', actionType: 'RAGSearchTool' },
    { stepNumber: 6, state: 'TOOL_SELECTION', thought: 'Selecting CalculatorTool to calculate 4500 * 10', actionType: 'CalculatorTool' },
    { stepNumber: 7, state: 'TOOL_EXECUTING', thought: 'Executing CalculatorTool expression: "4500 * 10"', actionType: 'CalculatorTool' },
    { stepNumber: 8, state: 'TOOL_RESULT', thought: 'Calculation result: 45000', actionType: 'CalculatorTool' },
    { stepNumber: 9, state: 'FINAL_RESPONSE', thought: 'Grounded answer formulated with citations' },
  ]);

  const [toolCalls, setToolCalls] = useState<ToolCall[]>([
    {
      toolName: 'RAGSearchTool',
      arguments: { query: 'enterprise tier license cost', topK: 3 },
      status: 'COMPLETED',
      result: { chunkCount: 1, text: 'Enterprise tier license cost is ₹4,500 per user per month.' },
      latencyMs: 145,
    },
    {
      toolName: 'CalculatorTool',
      arguments: { expression: '4500 * 10' },
      status: 'COMPLETED',
      result: { expression: '4500 * 10', result: 45000 },
      latencyMs: 8,
    },
  ]);

  const [finalAnswer, setFinalAnswer] = useState(
    'Based on the tenant knowledge base pricing sheet, the Enterprise tier license cost is ₹4,500 per user per month. For 10 users, the total cost is ₹45,000 per month. [1]'
  );

  const handleSimulateRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isRunning) return;
    setIsRunning(true);
    setFinalAnswer('');

    setTimeout(() => {
      setIsRunning(false);
      setFinalAnswer(
        `Based on the tenant knowledge base pricing sheet, the Enterprise tier license cost is ₹4,500 per user per month. For 10 users, the total cost is ₹45,000 per month. [1]`
      );
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Navbar Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-1">
              <Cpu className="w-4 h-4" /> AI Agent Orchestrator & State Machine
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Multi-Step Agent Control Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">Autonomous tool calling with server-side RBAC permissions and step limits.</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Max Steps: 5 (Constrained Loop)
            </span>
          </div>
        </div>

        {/* Prompt Execution Bar */}
        <form onSubmit={handleSimulateRun} className="glass-panel p-6 rounded-xl border border-indigo-500/20 space-y-4">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Execute Agent Task</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Give the AI Agent an objective requiring multi-step tool execution..."
              className="flex-1 px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={isRunning}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-lg shadow-indigo-600/30 transition-all text-sm shrink-0 disabled:opacity-50"
            >
              {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isRunning ? 'Executing Agent...' : 'Run Agent Task'}
            </button>
          </div>
        </form>

        {/* Visualizer Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Step Execution State Machine */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-panel p-6 rounded-xl border border-gray-800">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" /> Agent Execution State Machine
              </h2>

              <div className="space-y-3">
                {activeSteps.map((step) => (
                  <div key={step.stepNumber} className="flex items-start gap-3 p-3 bg-gray-900/60 rounded-lg border border-gray-800/80">
                    <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {step.stepNumber}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-indigo-300 font-mono">{step.state}</span>
                        {step.actionType && (
                          <span className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded border border-purple-500/20 font-mono">
                            {step.actionType}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-300 mt-1">{step.thought}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Final Answer Panel */}
            {finalAnswer && (
              <div className="glass-panel p-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                <h3 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Final Grounded Agent Response
                </h3>
                <p className="text-sm text-gray-200 leading-relaxed font-sans">{finalAnswer}</p>
              </div>
            )}
          </div>

          {/* Registered Tools & Tool Calls Sidebar */}
          <div className="space-y-6">
            
            {/* Tool Execution Calls */}
            <div className="glass-panel p-6 rounded-xl border border-gray-800">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" /> Tool Calls Executed
              </h2>

              <div className="space-y-4">
                {toolCalls.map((tc, idx) => (
                  <div key={idx} className="p-3 bg-gray-900 rounded-lg border border-gray-800 text-xs space-y-2">
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-purple-300 font-bold">{tc.toolName}</span>
                      <span className="text-gray-500">{tc.latencyMs} ms</span>
                    </div>
                    <div className="text-gray-400 font-mono text-[11px]">
                      Args: {JSON.stringify(tc.arguments)}
                    </div>
                    <div className="text-emerald-400 font-mono text-[11px] pt-1 border-t border-gray-800/80">
                      Result: {JSON.stringify(tc.result)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Registered Tools Catalog */}
            <div className="glass-panel p-6 rounded-xl border border-gray-800">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" /> Tool Registry Catalog
              </h2>

              <div className="space-y-3">
                <div className="p-3 bg-gray-900 rounded-lg border border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-indigo-400" /> RAGSearchTool</span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded font-medium">LOW RISK</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Phase 3 RAG engine search with grounded citation attribution.</p>
                </div>

                <div className="p-3 bg-gray-900 rounded-lg border border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5"><Calculator className="w-3.5 h-3.5 text-purple-400" /> CalculatorTool</span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded font-medium">LOW RISK</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Deterministic arithmetic calculation evaluator.</p>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
