'use client';

import React, { useState } from 'react';
import { SaaSLayout } from '@/components/SaaSLayout';
import { Bot, Save, Plus, ShieldCheck, Database, Calculator, Wrench, Sliders, CheckCircle2 } from 'lucide-react';

export default function AgentBuilderPage() {
  const [agentName, setAgentName] = useState('Enterprise HR Assistant');
  const [description, setDescription] = useState('Answers employee HR policy questions and performs leave calculations.');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [temperature, setTemperature] = useState(0.2);
  const [maxSteps, setMaxSteps] = useState(5);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [selectedTools, setSelectedTools] = useState({
    RAGSearchTool: true,
    CalculatorTool: true,
    WebSearchTool: false,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <SaaSLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-1">
              <Bot className="w-4 h-4" /> Agent Platform Builder
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Configure Customer AI Agent</h1>
            <p className="text-gray-400 text-sm mt-1">Configure custom agent tools, assigned knowledge bases, system prompts, and step limits.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-lg shadow-indigo-600/30 transition-all text-sm"
            >
              <Save className="w-4 h-4" /> Save Agent Configuration
            </button>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" /> Agent configuration successfully saved and deployed to tenant runtime!
          </div>
        )}

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="glass-panel p-6 rounded-xl border border-gray-800 space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Agent Name</label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">LLM Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast, Recommended)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (High Reasoning)</option>
                <option value="gpt-4o">OpenAI GPT-4o</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Tools Assignment */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-indigo-400" /> Permitted Agent Tools
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="p-4 bg-gray-900 rounded-lg border border-gray-800 flex items-start gap-3 cursor-pointer hover:border-indigo-500/50 transition-colors">
                <input
                  type="checkbox"
                  checked={selectedTools.RAGSearchTool}
                  onChange={(e) => setSelectedTools({ ...selectedTools, RAGSearchTool: e.target.checked })}
                  className="mt-1 accent-indigo-600"
                />
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-1"><Database className="w-3.5 h-3.5 text-indigo-400" /> RAG Search</div>
                  <div className="text-xs text-gray-400 mt-0.5">Ground answers in KB documents</div>
                </div>
              </label>

              <label className="p-4 bg-gray-900 rounded-lg border border-gray-800 flex items-start gap-3 cursor-pointer hover:border-indigo-500/50 transition-colors">
                <input
                  type="checkbox"
                  checked={selectedTools.CalculatorTool}
                  onChange={(e) => setSelectedTools({ ...selectedTools, CalculatorTool: e.target.checked })}
                  className="mt-1 accent-indigo-600"
                />
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-1"><Calculator className="w-3.5 h-3.5 text-purple-400" /> Calculator</div>
                  <div className="text-xs text-gray-400 mt-0.5">Perform math & formula evaluations</div>
                </div>
              </label>
            </div>
          </div>

          {/* Hyperparameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-gray-800/80">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Temperature</span>
                <span className="text-indigo-400 font-mono">{temperature}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Max Step Limit</span>
                <span className="text-indigo-400 font-mono">{maxSteps} steps</span>
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxSteps}
                onChange={(e) => setMaxSteps(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

        </form>

      </div>
    </SaaSLayout>
  );
}
