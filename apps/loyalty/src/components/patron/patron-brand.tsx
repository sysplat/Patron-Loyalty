'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { LoyaltyPublicBranding } from '@queueplatform/shared';
import {
  LOYALTY_PATRON_DEFAULT_ACCENT,
  LOYALTY_PATRON_DEFAULT_PRIMARY,
} from '@queueplatform/shared';
import { cn } from '@/lib/utils';

export function resolvePatronBranding(input: {
  orgName?: string;
  branding?: Partial<LoyaltyPublicBranding> | null;
  pointsCurrencyName?: string;
}): LoyaltyPublicBranding {
  const nested = input.branding ?? {};
  const orgName = (nested.orgName ?? input.orgName ?? 'Loyalty').trim() || 'Loyalty';
  return {
    orgName,
    logoUrl: nested.logoUrl?.trim() || null,
    primaryColor: nested.primaryColor?.trim() || null,
    accentColor: nested.accentColor?.trim() || null,
    programName: (nested.programName ?? orgName).trim() || orgName,
    pointsCurrencyName:
      (nested.pointsCurrencyName ?? input.pointsCurrencyName ?? 'Points').trim() || 'Points',
  };
}

export function patronBrandStyle(branding: LoyaltyPublicBranding): CSSProperties {
  return {
    ['--patron-primary' as string]: branding.primaryColor || LOYALTY_PATRON_DEFAULT_PRIMARY,
    ['--patron-accent' as string]: branding.accentColor || LOYALTY_PATRON_DEFAULT_ACCENT,
  };
}

export function PatronLogo({
  branding,
  size = 56,
  className,
}: {
  branding: LoyaltyPublicBranding;
  size?: number;
  className?: string;
}) {
  if (!branding.logoUrl) return null;
  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-2 shadow-sm',
        className,
      )}
      style={{ height: size, width: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tenant logos are data URLs or arbitrary CDN hosts */}
      <img
        src={branding.logoUrl}
        alt={`${branding.orgName} logo`}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}

export function PatronBrandHeader({
  branding,
  title,
  subtitle,
  align = 'center',
  className,
}: {
  branding: LoyaltyPublicBranding;
  title?: ReactNode;
  subtitle?: ReactNode;
  align?: 'center' | 'start';
  className?: string;
}) {
  const centered = align === 'center';
  return (
    <header
      className={cn(
        'flex flex-col gap-3',
        centered ? 'items-center text-center' : 'items-start text-left',
        className,
      )}
    >
      <PatronLogo branding={branding} />
      <div className={cn('space-y-1', centered ? 'text-center' : 'text-left')}>
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'color-mix(in srgb, var(--patron-accent) 72%, white)' }}
        >
          {branding.programName}
        </p>
        {branding.programName !== branding.orgName ? (
          <p className="text-[11px] text-white/45">{branding.orgName}</p>
        ) : null}
        {title ? (
          <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        ) : null}
        {subtitle ? <p className="text-sm text-white/65">{subtitle}</p> : null}
      </div>
    </header>
  );
}

export function PatronBrandPreviewStrip({ branding }: { branding: LoyaltyPublicBranding }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 text-white shadow-sm"
      style={patronBrandStyle(branding)}
    >
      <PatronBrandHeader branding={branding} title="Alex Patron" subtitle="Gold member" />
      <div
        className="mt-4 rounded-xl px-3 py-2 text-center text-sm font-semibold text-white"
        style={{ backgroundColor: 'var(--patron-primary)' }}
      >
        Redeem reward
      </div>
    </div>
  );
}
