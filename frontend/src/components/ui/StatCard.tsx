import React from 'react';
import { Card } from './Card';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  description?: string;
  progressPercent?: number;
  accentColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  trendDirection = 'neutral',
  description,
  progressPercent,
}) => {
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        {icon && <div className="p-2 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700/50">{icon}</div>}
      </div>

      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-extrabold text-white tracking-tight">{value}</div>
        {trend && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              trendDirection === 'up'
                ? 'bg-emerald-500/10 text-emerald-400'
                : trendDirection === 'down'
                ? 'bg-rose-500/10 text-rose-400'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {trend}
          </span>
        )}
      </div>

      {progressPercent !== undefined && (
        <div className="space-y-1.5 pt-1">
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progressPercent > 90 ? 'bg-amber-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
          {description && <div className="text-[11px] text-slate-400 flex justify-between">{description}</div>}
        </div>
      )}

      {description && progressPercent === undefined && <div className="text-[11px] text-slate-400">{description}</div>}
    </Card>
  );
};
