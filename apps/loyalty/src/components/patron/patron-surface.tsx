'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PatronSurfaceTone = 'default' | 'brand' | 'warning' | 'info';

const TONE_CLASS: Record<PatronSurfaceTone, string> = {
  default: 'border-white/10 bg-white/[0.06]',
  brand: '',
  warning: 'border-amber-500/30 bg-amber-500/10',
  info: 'border-sky-500/30 bg-sky-500/10',
};

function toneStyle(tone: PatronSurfaceTone) {
  if (tone !== 'brand') return undefined;
  return {
    borderColor: 'color-mix(in srgb, var(--patron-primary) 40%, transparent)',
    backgroundColor: 'color-mix(in srgb, var(--patron-primary) 12%, transparent)',
  };
}

export function PatronCard({
  tone = 'default',
  className,
  children,
}: {
  tone?: PatronSurfaceTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-5 shadow-sm backdrop-blur-sm',
        TONE_CLASS[tone],
        className,
      )}
      style={toneStyle(tone)}
    >
      {children}
    </div>
  );
}

export function PatronSection({
  title,
  description,
  action,
  tone = 'default',
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: PatronSurfaceTone;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border p-5 shadow-sm backdrop-blur-sm',
        TONE_CLASS[tone],
        className,
      )}
      style={toneStyle(tone)}
    >
      {title || action ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {title ? (
              <h2 className="text-sm font-semibold tracking-tight text-white">{title}</h2>
            ) : null}
            {description ? (
              <p className="text-xs leading-relaxed text-white/55">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PatronChip({
  title,
  className,
  children,
}: {
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/85',
        className,
      )}
    >
      {children}
    </span>
  );
}
