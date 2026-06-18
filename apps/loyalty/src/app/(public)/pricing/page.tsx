import Link from 'next/link';
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { LOYALTY_STARTER } from '@queueplatform/shared';
import { PublicFooter } from '@/components/marketing/public-footer';
import { PublicHeader } from '@/components/marketing/public-header';

const ADD_ONS = [
  {
    name: 'QlessQ Bundle',
    price: 'Contact us',
    period: 'queue + loyalty',
    description: 'Run walk-in queues and loyalty on the same patron identity.',
    features: [
      'Everything in Loyalty Starter',
      'QlessQ queue & kiosk (separate product)',
      'Automatic points on completed visits',
      'Unified patron record',
    ],
    cta: 'Contact sales',
    href: 'mailto:support@queueplatform.com?subject=Bundle%20pricing',
    external: true,
  },
] as const;

export default function PricingPage() {
  const plan = LOYALTY_STARTER;

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <PublicHeader active="pricing" />

      <main className="flex-1 pb-24">
        <div className="bg-background relative overflow-hidden pb-20 pt-16 text-center">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="border-primary/15 bg-primary/5 text-primary mx-auto mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold">
              <Sparkles className="h-4 w-4" />
              Simple loyalty pricing
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Grow retention without queue fees
            </h1>
            <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
              Patron Loyalty is priced for CRM and marketing teams — not per ticket issued.
            </p>
          </div>
        </div>

        <div className="container mx-auto -mt-8 max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="border-border/50 bg-card relative flex flex-col rounded-3xl border p-8 shadow-xl ring-2 ring-emerald-500/20">
              <p className="text-primary text-xs font-bold uppercase tracking-wider">Recommended</p>
              <h2 className="mt-2 text-2xl font-bold">{plan.name}</h2>
              <p className="text-muted-foreground mt-2 min-h-[40px] text-sm">{plan.description}</p>
              <div className="mt-6 flex items-baseline text-5xl font-extrabold">
                ${plan.priceMonthly}
                <span className="text-muted-foreground ml-1 text-base font-medium">/month</span>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                or ${plan.priceYearly}/year (save ~20%)
              </p>
              <Link
                href="/signup"
                className="bg-primary text-primary-foreground hover:bg-primary/90 mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full text-base font-semibold"
              >
                Start free trial <ArrowRight className="h-4 w-4" />
              </Link>
              <ul className="mt-8 space-y-3 text-sm">
                {[
                  'Patron directory & CRM tasks',
                  'Points, tiers, rewards, coupons',
                  'Campaigns & patron portal',
                  'Integration API & webhooks',
                  `${plan.limits.maxUsers} staff users`,
                  `${plan.limits.smsCreditsTotal} SMS credits / month`,
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {ADD_ONS.map((addon) => (
              <div
                key={addon.name}
                className="border-border/50 bg-card flex flex-col rounded-3xl border p-8 shadow-lg"
              >
                <h2 className="text-2xl font-bold">{addon.name}</h2>
                <p className="text-muted-foreground mt-2 text-sm">{addon.description}</p>
                <div className="mt-6 text-3xl font-extrabold">{addon.price}</div>
                <p className="text-muted-foreground text-sm">{addon.period}</p>
                <a
                  href={addon.href}
                  className="bg-background hover:bg-muted/70 mt-8 inline-flex h-12 items-center justify-center rounded-full border text-base font-semibold"
                >
                  {addon.cta}
                </a>
                <ul className="mt-8 space-y-3 text-sm">
                  {addon.features.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="bg-muted/50 mt-12 rounded-2xl border p-6 text-center">
            <ShieldCheck className="text-primary mx-auto h-8 w-8" />
            <h2 className="mt-3 text-lg font-bold">Own your patron data scope</h2>
            <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm">
              Loyalty signup accepts Patron Loyalty Terms and Privacy — separate from QlessQ queue
              check-in notices. Counsel review recommended before production launch.
            </p>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
