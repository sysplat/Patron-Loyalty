'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PatronBalance({
  label,
  value,
  meta,
  code,
  footnote,
}: {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  code?: string;
  footnote?: ReactNode;
}) {
  return (
    <div className="text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">{label}</p>
      <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight text-white">{value}</p>
      {meta ? <p className="mt-2 text-xs text-white/50">{meta}</p> : null}
      {code ? (
        <p className="mt-4 font-mono text-sm tracking-[0.2em] text-white/80">{code}</p>
      ) : null}
      {footnote ? <p className="mt-2 text-xs text-white/60">{footnote}</p> : null}
    </div>
  );
}

export function PatronRowList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-white/[0.07]">{children}</ul>;
}

export function PatronRow({
  primary,
  secondary,
  trailing,
  trailingMeta,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  trailingMeta?: ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm text-white/90">{primary}</p>
        {secondary ? <p className="text-xs text-white/50">{secondary}</p> : null}
      </div>
      {trailing || trailingMeta ? (
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-white/50">
          {trailing}
          {trailingMeta}
        </div>
      ) : null}
    </li>
  );
}

export function PatronProgress({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-white/10"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${pct}%`, backgroundColor: 'var(--patron-primary)' }}
      />
    </div>
  );
}

export function PatronStampGrid({ filled, target }: { filled: number; target: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: target }).map((_, index) => {
        const isFilled = index < filled;
        return (
          <span
            key={index}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-medium',
              isFilled ? 'text-white' : 'border-white/15 bg-white/5 text-white/40',
            )}
            style={
              isFilled
                ? {
                    borderColor: 'var(--patron-primary)',
                    backgroundColor: 'color-mix(in srgb, var(--patron-primary) 35%, transparent)',
                  }
                : undefined
            }
          >
            {isFilled ? '✓' : index + 1}
          </span>
        );
      })}
    </div>
  );
}

export function PatronEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="border-white/12 rounded-xl border border-dashed px-3 py-4 text-center text-xs text-white/45">
      {children}
    </p>
  );
}
