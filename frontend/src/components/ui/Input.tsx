import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, leftIcon, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">{label}</label>}
        <div className="relative">
          {leftIcon && <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">{leftIcon}</div>}
          <input
            ref={ref}
            className={`w-full px-3.5 py-2 bg-slate-900 border rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors ${
              leftIcon ? 'pl-9' : ''
            } ${error ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-indigo-500'} ${className}`}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs text-rose-400">{error}</p>
        ) : (
          helperText && <p className="text-xs text-slate-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
