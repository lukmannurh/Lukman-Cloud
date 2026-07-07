import * as React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  /** React 19 ref forwarding */
  ref?: React.Ref<HTMLDivElement>;
}

export function Card({ className = '', hoverable = false, ref, ...props }: CardProps) {
  return (
    <div
      ref={ref}
      className={`neo-card ${hoverable ? 'neo-card-hover' : ''} ${className}`.trim()}
      {...props}
    />
  );
}

export interface CardSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

export function CardHeader({ className = '', ref, ...props }: CardSectionProps) {
  return (
    <div
      ref={ref}
      className={`flex flex-col space-y-1.5 p-6 border-b-[3px] border-black ${className}`.trim()}
      {...props}
    />
  );
}

export function CardContent({ className = '', ref, ...props }: CardSectionProps) {
  return (
    <div ref={ref} className={`p-6 ${className}`.trim()} {...props} />
  );
}

export function CardFooter({ className = '', ref, ...props }: CardSectionProps) {
  return (
    <div
      ref={ref}
      className={`flex items-center p-6 pt-0 ${className}`.trim()}
      {...props}
    />
  );
}
