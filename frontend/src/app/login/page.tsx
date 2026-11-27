'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  Loader2
} from 'lucide-react';
import { setAuthSession } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (password.length > 128) {
      setErrorMsg('Password must be at most 128 characters.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || 'Invalid email or password.');
      }

      if (json.data && json.data.tokens) {
        setAuthSession({
          user: json.data.user,
          organization: json.data.organization,
          tokens: json.data.tokens,
        });
        router.push('/dashboard');
      } else {
        throw new Error('Authentication response format invalid.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'Unable to connect to authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* Brand Header */}
      <div className="max-w-4xl mx-auto w-full mb-8 text-center">
        <Link href="/dashboard" className="inline-flex items-center gap-2.5 mb-2 focus:outline-none">
          <div className="w-8 h-8 rounded-[6px] bg-[#2563EB] text-white flex items-center justify-center font-bold text-base shadow-sm">
            R
          </div>
          <span className="text-2xl font-bold tracking-tight text-[#0F172A]">RAGOS</span>
        </Link>
        <p className="text-sm font-medium text-[#475569]">
          Enterprise Multi-Tenant AI Platform
        </p>
      </div>

      {/* Main Grid Container */}
      <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* Left Form Card (7 cols) */}
        <div className="md:col-span-7 bg-white border border-[#E2E8F0] rounded-[10px] p-6 sm:p-8 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-[#0F172A] tracking-tight">
              Sign in to your workspace
            </h1>
            <p className="text-sm text-[#475569] mt-1.5 leading-normal">
              Enter your credentials to access your tenant environment.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-[6px] flex items-start gap-2.5 text-xs text-[#DC2626]">
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Work Email */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-[#0F172A] mb-1.5">
                Work email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-[#CBD5E1] rounded-[6px] text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-[#0F172A] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 bg-white border border-[#CBD5E1] rounded-[6px] text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-1 text-[#64748B] hover:text-[#0F172A] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                id="login-submit"
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-[6px] bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

          </form>

          {/* Sign Up Link */}
          <div className="mt-6 pt-5 border-t border-[#E2E8F0] text-center text-sm text-[#475569]">
            Don&apos;t have a workspace?{' '}
            <Link href="/signup" className="text-[#2563EB] hover:text-[#1D4ED8] font-medium hover:underline">
              Create your workspace →
            </Link>
          </div>

        </div>

        {/* Right Info Card (5 cols) */}
        <div className="md:col-span-5 bg-white border border-[#E2E8F0] rounded-[10px] p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] space-y-6">
          
          <div>
            <h2 className="text-base font-semibold text-[#0F172A]">
              Enterprise RAG Platform
            </h2>
            <p className="text-sm text-[#475569] mt-1">
              Built for isolated, tenant-aware AI applications.
            </p>
          </div>

          {/* Feature Checklist */}
          <div className="space-y-3 pt-1">
            {[
              'Multi-tenant architecture',
              'Tenant-scoped knowledge bases',
              'Semantic document retrieval',
              'LLM-powered responses',
              'PostgreSQL-based data isolation',
              'API-first architecture',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5 text-sm text-[#334155]">
                <Check className="w-4 h-4 text-[#16A34A] shrink-0 stroke-[2.5]" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          {/* Technical Info Box */}
          <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] text-xs text-[#475569] space-y-1">
            <div className="font-medium text-[#0F172A] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Server-Enforced Row-Level Security</span>
            </div>
            <p className="text-[#64748B] leading-relaxed">
              Database queries enforce PostgreSQL Row-Level Security (RLS) per workspace ID, guaranteeing cross-tenant data isolation.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
