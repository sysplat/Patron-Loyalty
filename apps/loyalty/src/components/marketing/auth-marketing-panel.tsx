'use client';

import { LOYALTY_PRODUCT_NAME } from '@queueplatform/shared';
import { QlessqBrand } from '@/components/brand';

const HIGHLIGHTS = [
  { icon: '★', text: 'Points, tiers, and rewards catalog' },
  { icon: '🎯', text: 'Segments, campaigns, and win-back automation' },
  { icon: '🔗', text: 'Optional QlessQ visit sync or POS integration' },
] as const;

export function AuthMarketingPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 lg:flex lg:w-1/2">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <div className="relative z-10 flex flex-col justify-between p-12 text-white">
        <QlessqBrand
          href="/"
          markSize={54}
          wordmarkHeight={32}
          tone="onDark"
          className="text-white"
        />
        <div className="max-w-md space-y-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300/90">
            {LOYALTY_PRODUCT_NAME}
          </p>
          <h2 className="text-4xl font-bold leading-tight">
            Turn visits into
            <br />
            lasting relationships.
          </h2>
          <p className="text-lg leading-relaxed text-white/60">
            CRM, loyalty points, patron portal, and marketing — sold separately from queue
            management. Connect QlessQ when you need visit data.
          </p>
          <div className="space-y-3 pt-4">
            {HIGHLIGHTS.map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-white/80">
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-white/40">Powered by QlessQ platform infrastructure</p>
      </div>
    </div>
  );
}
