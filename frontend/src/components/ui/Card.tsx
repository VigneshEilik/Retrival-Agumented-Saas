import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  header,
  footer,
  hoverable = false,
}) => {
  return (
    <div
      className={`bg-white rounded-[10px] border border-[#E2E8F0] shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden ${
        hoverable ? 'hover:border-slate-300 transition-colors duration-150' : ''
      } ${className}`}
    >
      {header && <div className="p-4 md:p-5 border-b border-[#E2E8F0] bg-slate-50/50 font-semibold text-slate-900">{header}</div>}
      <div className="p-4 md:p-5">{children}</div>
      {footer && <div className="p-4 border-t border-[#E2E8F0] bg-slate-50/50 text-xs text-slate-500">{footer}</div>}
    </div>
  );
};
