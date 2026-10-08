'use client';

import type { ReactNode } from 'react';
import type { LoyaltyPublicBranding } from '@queueplatform/shared';
import { cn } from '@/lib/utils';
import { patronBrandStyle } from './patron-brand';

/**
 * Root wrapper for every public patron surface: dark brand atmosphere plus the
 * `--patron-primary` / `--patron-accent` variables the primitives read from.
 */
export function PatronShell({
  branding,
  banner,
  center = false,
  className,
  children,
}: {
  branding: LoyaltyPublicBranding;
  banner?: ReactNode;
  center?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'min-h-screen bg-slate-950 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white antialiased',
        center && 'flex flex-col items-center justify-center p-4 sm:p-6',
        className,
      )}
      style={patronBrandStyle(branding)}
    >
      {banner}
      {children}
    </div>
  );
}

export function PatronContainer({
  size = 'md',
  className,
  children,
}: {
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full space-y-5 px-4 py-8 sm:py-10',
        size === 'sm' ? 'max-w-md' : 'max-w-lg',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PatronBanner({
  tone = 'warning',
  children,
}: {
  tone?: 'warning' | 'info';
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        'border-b px-4 py-2 text-center text-sm',
        tone === 'warning'
          ? 'border-amber-500/40 bg-amber-950/90 text-amber-100'
          : 'border-sky-500/40 bg-sky-950/90 text-sky-100',
      )}
    >
      {children}
    </div>
  );
}
