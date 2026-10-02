'use client';

import React, { useState } from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Bot, Save, CheckCircle2, ShieldCheck, Sliders, Wrench } from 'lucide-react';

export default function AgentBuilderPage() {
  const [agentName, setAgentName] = useState('Enterprise Customer Assistant');
  const [description, setDescription] = useState('Autonomous customer support agent with RAG search capabilities');
  const [model, setModel] = useState('gemini-1.5-pro');
  const [maxSteps, setMaxSteps] = useState(5);
  const [ragToolEnabled, setRagToolEnabled] = useState(true);
  const [calcToolEnabled, setCalcToolEnabled] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveAgent = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <SaaSLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#2563EB]" />
              <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Agent Builder</h1>
              <Badge variant="indigo" size="sm">Autonomous Agent v2.0</Badge>
            </div>
            <p className="text-sm text-[#475569] mt-1">
              Configure autonomous AI agents with server-enforced tool registries, RLS permissions, and cost guard caps.
            </p>
          </div>

          <Button
            onClick={handleSaveAgent}
            leftIcon={isSaved ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Save className="w-4 h-4" />}
            variant={isSaved ? 'secondary' : 'primary'}
            size="md"
          >
            {isSaved ? 'Agent Saved & Deployed' : 'Save & Deploy Agent'}
          </Button>
        </div>

        {/* Split Configuration Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left 2 Columns: Configuration Form */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Core Settings */}
            <Card
              header={
                <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  <Sliders className="w-4 h-4 text-[#2563EB]" /> Core Agent Parameters
                </div>
              }
              className="space-y-4"
            >
              <Input
                label="Agent Display Name"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
              />

              <Input
                label="Description & System Persona"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    LLM Engine Provider
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-[#CBD5E1] rounded-[6px] text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
                  >
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro (Recommended)</option>
                    <option value="gpt-4o">OpenAI GPT-4o</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Max Reasoning Steps Cap
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={maxSteps}
                    onChange={(e) => setMaxSteps(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-white border border-[#CBD5E1] rounded-[6px] text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Server-enforced hard cap (MAX_STEPS = 5)</p>
                </div>
              </div>
            </Card>

            {/* Permitted Tools Registry */}
            <Card
              header={
                <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  <Wrench className="w-4 h-4 text-emerald-600" /> Permitted Tool Integrations
                </div>
              }
              className="space-y-3"
            >
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-[8px] border border-slate-200">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={ragToolEnabled}
                    onChange={(e) => setRagToolEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#2563EB] rounded cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      RAGSearchTool <Badge variant="indigo" size="sm">INTERNAL</Badge>
                    </div>
                    <div className="text-[11px] text-slate-500">Perform hybrid vector search over tenant knowledge bases</div>
                  </div>
                </div>
                <Badge variant="success" size="sm">Risk Level: Low</Badge>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-[8px] border border-slate-200">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={calcToolEnabled}
                    onChange={(e) => setCalcToolEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#2563EB] rounded cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      CalculatorTool <Badge variant="neutral" size="sm">SYSTEM</Badge>
                    </div>
                    <div className="text-[11px] text-slate-500">Execute deterministic mathematical operations</div>
                  </div>
                </div>
                <Badge variant="success" size="sm">Risk Level: Safe</Badge>
              </div>
            </Card>

          </div>

          {/* Right Column: Configuration Summary Card */}
          <div className="lg:col-span-1">
            <Card
              header={
                <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-[#2563EB]" /> Runtime Security Contract
                </div>
              }
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agent Summary</label>
                <div className="text-xs font-semibold text-slate-900">{agentName}</div>
                <div className="text-xs text-slate-500 leading-normal">{description}</div>
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Selected LLM</span>
                  <span className="font-mono text-[#2563EB] font-semibold">{model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Max Step Limit</span>
                  <span className="font-mono text-slate-900">{maxSteps} Reasoning Loops</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Active Tools</span>
                  <span className="font-mono text-emerald-700 font-semibold">
                    {(ragToolEnabled ? 1 : 0) + (calcToolEnabled ? 1 : 0)} Enabled
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-[6px] bg-blue-50 border border-blue-200 text-xs space-y-1">
                <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#2563EB]" /> Multi-Tenant RLS Protected
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Tool execution cannot access cross-tenant data. PostgreSQL session parameters set on all queries.
                </p>
              </div>
            </Card>
          </div>

        </div>

      </div>
    </SaaSLayout>
  );
}
