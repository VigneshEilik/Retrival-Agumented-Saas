import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading workspace data...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-3">
      <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin" />
      <span className="text-xs font-medium text-slate-500">{message}</span>
    </div>
  );
};

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => {
  return <div className={`animate-pulse bg-slate-200 rounded-[4px] ${className}`} />;
};
