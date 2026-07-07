import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  /** React 19 ref forwarding */
  ref?: React.Ref<HTMLInputElement>;
}

export function Input({ className = '', error, ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      className={`neo-input ${className}`.trim()}
      aria-invalid={error ? "true" : undefined}
      {...props}
    />
  );
}
