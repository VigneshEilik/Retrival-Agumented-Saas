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
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        {icon && <div className="p-2 rounded-[6px] bg-slate-100 text-slate-700 border border-slate-200">{icon}</div>}
      </div>

      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-bold text-[#0F172A] tracking-tight">{value}</div>
        {trend && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-[4px] border ${
              trendDirection === 'up'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : trendDirection === 'down'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {trend}
          </span>
        )}
      </div>

      {progressPercent !== undefined && (
        <div className="space-y-1.5 pt-1">
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progressPercent > 90 ? 'bg-amber-500' : 'bg-[#2563EB]'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
          {description && <div className="text-xs text-slate-500 flex justify-between">{description}</div>}
        </div>
      )}

      {description && progressPercent === undefined && <div className="text-xs text-slate-500">{description}</div>}
    </Card>
  );
};
