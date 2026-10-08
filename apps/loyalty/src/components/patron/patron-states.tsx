'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PatronLoadingScreen({ message = 'Loading…' }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-white"
    >
      <Loader2 className="h-5 w-5 animate-spin text-white/60" aria-hidden />
      <p className="text-sm text-white/65">{message}</p>
    </div>
  );
}

export function PatronErrorScreen({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-white">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      {description ? <p className="max-w-sm text-sm text-white/65">{description}</p> : null}
      {action}
    </div>
  );
}

export function PatronFooterLinks({
  links,
  className,
}: {
  links: { href: string; label: string }[];
  className?: string;
}) {
  return (
    <p className={cn('pt-2 text-center text-xs text-white/40', className)}>
      {links.map((link, index) => (
        <span key={link.href}>
          {index > 0 ? <span aria-hidden> · </span> : null}
          <Link
            href={link.href}
            className="rounded underline underline-offset-2 transition-colors hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {link.label}
          </Link>
        </span>
      ))}
    </p>
  );
}
