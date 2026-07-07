import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'destructive';
  /** React 19 ref forwarding */
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({ className = '', variant = 'default', ref, ...props }: ButtonProps) {
  let baseClass = 'inline-flex items-center justify-center font-semibold rounded-lg text-sm px-4 py-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  if (variant === 'primary') {
    baseClass += ' bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm';
  } else if (variant === 'destructive') {
    baseClass += ' bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500 shadow-sm';
  } else {
    baseClass += ' bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-500 shadow-sm';
  }

  return (
    <button
      ref={ref}
      className={`${baseClass} ${className}`.trim()}
      {...props}
    />
  );
}
