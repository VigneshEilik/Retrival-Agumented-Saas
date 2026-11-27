import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, leftIcon, className = '', id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    return (
      <div className="space-y-1.5 w-full">
        {label && <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">{label}</label>}
        <div className="relative">
          {leftIcon && <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">{leftIcon}</div>}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            className={`w-full px-3.5 py-2 bg-white border rounded-[6px] text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none transition-all ${
              leftIcon ? 'pl-9' : ''
            } ${
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                : 'border-[#CBD5E1] focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]'
            } ${className}`}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs text-red-600 font-medium">{error}</p>
        ) : (
          helperText && <p className="text-xs text-slate-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
