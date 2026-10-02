import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'indigo';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  className = '',
}) => {
  const baseStyles = 'inline-flex items-center font-medium rounded-[4px] border transition-colors';

  const variants = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    indigo: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px] gap-1 font-medium',
    md: 'px-2.5 py-1 text-xs gap-1.5 font-medium',
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
      {icon}
      {children}
    </span>
  );
};
