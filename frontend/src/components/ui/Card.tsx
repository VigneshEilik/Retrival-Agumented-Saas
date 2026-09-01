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
      className={`bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden ${
        hoverable ? 'hover:border-slate-700 transition-colors duration-150' : ''
      } ${className}`}
    >
      {header && <div className="p-4 md:p-5 border-b border-slate-800/80 bg-slate-900/40">{header}</div>}
      <div className="p-4 md:p-5">{children}</div>
      {footer && <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 text-xs text-slate-400">{footer}</div>}
    </div>
  );
};
