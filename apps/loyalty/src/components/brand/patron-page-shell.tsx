import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PatronPageShellProps = {
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  mainClassName?: string;
};

/** Shared layout for customer-facing queue/book/track surfaces. */
export function PatronPageShell({
  header,
  children,
  className,
  mainClassName,
}: PatronPageShellProps) {
  return (
    <div
      className={cn(
        'from-primary/5 via-background flex min-h-screen flex-col bg-gradient-to-br to-violet-500/5',
        className,
      )}
    >
      {header ? (
        <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-2xl items-center px-4">{header}</div>
        </header>
      ) : null}
      <main className={cn('flex flex-1 flex-col', mainClassName)}>{children}</main>
    </div>
  );
}
