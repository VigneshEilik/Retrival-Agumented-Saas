import React from 'react';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 md:p-12 border border-dashed border-slate-300 rounded-[10px] bg-slate-50/50 space-y-3">
      <div className="p-3.5 bg-white rounded-[8px] text-[#2563EB] border border-slate-200 shadow-sm">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[#0F172A] tracking-tight">{title}</h3>
      <p className="text-xs text-slate-600 max-w-sm leading-relaxed">{description}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
