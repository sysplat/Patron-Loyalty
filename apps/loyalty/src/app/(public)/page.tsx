import Link from 'next/link';
import { ArrowRight, Gift, Megaphone, Sparkles, Users } from 'lucide-react';
import { LOYALTY_PRODUCT_NAME } from '@queueplatform/shared';
import { PublicFooter } from '@/components/marketing/public-footer';
import { PublicHeader } from '@/components/marketing/public-header';

const FEATURES = [
  {
    icon: Users,
    title: 'Patron CRM',
    body: 'Profiles, segments, tasks, and health scores — richer than queue check-in alone.',
  },
  {
    icon: Gift,
    title: 'Points & rewards',
    body: 'Tiers, earn rules, catalog redemptions, wallet, and coupons.',
  },
  {
    icon: Megaphone,
    title: 'Campaigns',
    body: 'Welcome, birthday, win-back, and scheduled blasts across email and SMS.',
  },
  {
    icon: Sparkles,
    title: 'Patron portal',
    body: 'Self-serve balance, rewards, profile, and digital card by referral link.',
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col font-sans">
      <PublicHeader />

      <main className="flex-1">
        <section className="bg-background relative overflow-hidden pb-24 pt-16 md:pt-24">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10">
            <div className="from-primary/20 absolute -top-40 left-1/2 h-[32rem] w-[72rem] -translate-x-1/2 rounded-full bg-gradient-to-br via-emerald-400/10 to-teal-500/10 blur-3xl" />
          </div>
          <div className="container mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <div className="border-primary/15 bg-primary/5 text-primary mx-auto mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold">
              <Sparkles className="h-4 w-4" />
              {LOYALTY_PRODUCT_NAME} — standalone from queue
            </div>
            <h1 className="text-foreground mx-auto max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              Loyalty that grows
              <span className="from-primary block bg-gradient-to-r via-emerald-500 to-teal-600 bg-clip-text text-transparent">
                repeat revenue.
              </span>
            </h1>
            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg">
              Sell, retain, and re-engage patrons with points, tiers, campaigns, and a branded
              portal. Optional sync with QlessQ when you run queues too.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="bg-primary text-primary-foreground inline-flex h-12 items-center justify-center gap-2 rounded-full px-8 text-base font-semibold shadow-lg transition hover:scale-[1.02]"
              >
                Start free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="bg-background hover:bg-muted/50 inline-flex h-12 items-center justify-center rounded-full border px-8 text-base font-semibold shadow-sm transition"
              >
                View pricing
              </Link>
            </div>
          </div>
        </section>

        <section id="features" className="bg-muted/30 border-t py-20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-3xl font-bold">Everything for modern loyalty</h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-center text-sm">
              Built for marketing and front-desk teams — not bolted onto a kiosk flow.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="bg-card rounded-2xl border p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="bg-primary/10 text-primary mb-4 flex h-10 w-10 items-center justify-center rounded-xl">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="integration" className="py-20">
          <div className="container mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-bold">Works alone or with QlessQ</h2>
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              Loyalty-only businesses use imports, staff entry, and the Integration API. When you
              also run QlessQ, completed visits and appointments can earn points automatically —
              same patron identity, separate product terms.
            </p>
            <Link
              href="/signup"
              className="text-primary mt-6 inline-flex font-semibold hover:underline"
            >
              Create your loyalty workspace →
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
