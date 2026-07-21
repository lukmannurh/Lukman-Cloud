import React from 'react';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[#1e1e5a]/60 ${className || ''}`}
      {...props}
    />
  );
}
