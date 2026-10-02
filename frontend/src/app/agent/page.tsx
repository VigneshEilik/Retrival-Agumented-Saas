'use client';

import React, { useState } from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Cpu, CheckCircle2, ArrowRight, ChevronDown, ChevronRight, Wrench, Terminal } from 'lucide-react';

export default function AgentObservabilityPage() {
  const [expandedRunId, setExpandedRunId] = useState<string | null>('run-101');

  const executionRuns = [
    {
      id: 'run-101',
      agentName: 'Enterprise Support Agent',
      query: 'Find PTO policy details and calculate 24 minus 5 carry-over days.',
      status: 'COMPLETED',
      totalSteps: 3,
      durationMs: 740,
      costUsd: 0.003,
      timestamp: '2026-09-01 14:22:10',
      steps: [
        {
          stepIndex: 1,
          type: 'THINKING',
          detail: 'Analyzing query intent. Decided to call RAGSearchTool to retrieve PTO document.',
          latencyMs: 120,
        },
        {
          stepIndex: 2,
          type: 'TOOL_EXECUTING',
          toolName: 'RAGSearchTool',
          input: { query: 'PTO policy carry over limit', topK: 3 },
          output: { matchCount: 2, topSimilarity: 0.92, source: 'Enterprise_HR_Policy_Handbook.pdf' },
          latencyMs: 340,
        },
        {
          stepIndex: 3,
          type: 'FINAL_RESPONSE',
          detail: 'Generated final grounded answer with citation chips [1].',
          latencyMs: 280,
        },
      ],
    },
  ];

  return (
    <SaaSLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#2563EB]" />
              <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Agent Execution Observability</h1>
              <Badge variant="indigo" size="sm">State Machine Visualizer</Badge>
            </div>
            <p className="text-sm text-[#475569] mt-1">
              Inspect step-by-step reasoning loops, tool call arguments, latency breakdowns, and cost metrics.
            </p>
          </div>
        </div>

        {/* State Machine Transition Timeline Card */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#2563EB]" /> Agent State Machine Loop Architecture
              </span>
              <Badge variant="success" size="sm">MAX_STEPS = 5</Badge>
            </div>
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2 p-4 bg-slate-50 rounded-[8px] border border-slate-200 text-xs">
            {['RECEIVED', 'THINKING', 'TOOL_SELECTION', 'TOOL_EXECUTING', 'TOOL_RESULT', 'FINAL_RESPONSE'].map((state, idx, arr) => (
              <React.Fragment key={state}>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-[6px] text-slate-800 font-mono font-semibold shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                  {state}
                </div>
                {idx < arr.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </Card>

        {/* Execution Runs Table */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 text-xs font-bold text-[#0F172A] uppercase tracking-wider">
            Recent Execution Traces
          </div>
          {executionRuns.map((run) => (
            <div key={run.id} className="border-b border-slate-200 last:border-0">
              
              {/* Row Banner */}
              <div
                onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {expandedRunId === run.id ? <ChevronDown className="w-4 h-4 text-[#2563EB]" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      {run.agentName}
                      <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>
                        {run.status}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">{run.query}</div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs text-slate-500 font-mono">
                  <span>{run.totalSteps} Steps</span>
                  <span>{run.durationMs}ms</span>
                  <span className="text-[#2563EB] font-bold">${run.costUsd}</span>
                  <span>{run.timestamp}</span>
                </div>
              </div>

              {/* Expanded Step Timeline */}
              {expandedRunId === run.id && (
                <div className="p-5 bg-slate-50/80 border-t border-slate-200 space-y-4">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Step Execution Trace</div>
                  <div className="space-y-3 pl-4 border-l-2 border-[#2563EB]">
                    {run.steps.map((step) => (
                      <div key={step.stepIndex} className="p-3.5 bg-white border border-slate-200 rounded-[8px] space-y-2 text-xs shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 font-mono flex items-center gap-2">
                            Step {step.stepIndex}: {step.type}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">{step.latencyMs}ms</span>
                        </div>

                        {step.detail && <p className="text-slate-600 leading-normal">{step.detail}</p>}

                        {step.toolName && (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="indigo" size="sm" icon={<Wrench className="w-3 h-3" />}>
                                {step.toolName}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                              <div className="p-2.5 bg-slate-50 rounded-[6px] border border-slate-200 text-slate-700">
                                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Tool Input</div>
                                {JSON.stringify(step.input, null, 2)}
                              </div>
                              <div className="p-2.5 bg-slate-50 rounded-[6px] border border-slate-200 text-emerald-700">
                                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Tool Output</div>
                                {JSON.stringify(step.output, null, 2)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ))}
        </Card>

      </div>
    </SaaSLayout>
  );
}
