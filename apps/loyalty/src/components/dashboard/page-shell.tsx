import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageShell({
  children,
  narrow = false,
  className,
}: {
  children: ReactNode;
  /** Counter-style ops layout: max-w-2xl centered */
  narrow?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-5 pb-10', narrow && 'mx-auto max-w-2xl', className)}>
      {children}
    </div>
  );
}
