'use client';

import { useEffect, useRef } from 'react';
import {
  QrCode,
  MonitorPlay,
  Zap,
  BarChart3,
  Clock,
  LineChart,
  CalendarCheck2,
  type LucideIcon,
} from 'lucide-react';

interface Feature {
  title: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

const features: Feature[] = [
  {
    title: 'QR Code Check-in',
    desc: 'Customers scan a poster at your door to join the queue. Zero hardware needed, maximum convenience.',
    icon: QrCode,
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    title: 'Live Wait Estimates',
    desc: 'Our engine calculates rolling averages to tell customers exactly when to head back. No more guessing.',
    icon: Clock,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
  },
  {
    title: 'Smart Agent Console',
    desc: 'Staff see exactly who is next and why they are visiting. Call, transfer, or complete tickets with one click.',
    icon: Zap,
    color: 'text-indigo-600',
    bg: 'bg-indigo-100',
  },
  {
    title: 'Real-time Analytics',
    desc: 'Track peak hours, average service times, and staff performance to optimize your daily operations.',
    icon: BarChart3,
    color: 'text-blue-500',
    bg: 'bg-blue-100',
  },
  {
    title: 'TV Display Screens',
    desc: 'Turn any smart TV into a professional digital signage board showing Now Serving numbers and announcements.',
    icon: MonitorPlay,
    color: 'text-sky-600',
    bg: 'bg-sky-100',
  },
  {
    title: 'Multi-Branch Ready',
    desc: 'Manage infinite locations, services, and queues from a single dashboard with granular role permissions.',
    icon: LineChart,
    color: 'text-indigo-500',
    bg: 'bg-indigo-100',
  },
  {
    title: 'Online Appointments',
    desc: 'Let customers self-serve and book appointments 24/7 from a branded page — no calls, no forms, just a link.',
    icon: CalendarCheck2,
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
];

function AnimatedCard({ feature, index }: { feature: Feature; index: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
          }, index * 80);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  const Icon = feature.icon;

  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: 'translateY(20px)',
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
      }}
      className="bg-card/90 hover:border-primary/20 hover:shadow-primary/5 hover:ring-primary/10 group relative rounded-2xl border p-8 shadow-sm ring-1 ring-transparent transition-shadow duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <div
        className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl ${feature.bg} transition-transform group-hover:scale-110`}
      >
        <Icon className={`h-7 w-7 ${feature.color}`} />
      </div>
      <h3 className="mb-3 text-xl font-bold">{feature.title}</h3>
      <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
    </div>
  );
}

/**
 * Feature cards grid with staggered scroll-triggered entrance animations.
 * Extracted as a client component so IntersectionObserver can be used without
 * marking the parent landing page as 'use client'.
 */
export function FeatureCards(): React.ReactElement {
  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
      {features.map((feature, i) => (
        <AnimatedCard key={feature.title} feature={feature} index={i} />
      ))}
    </div>
  );
}
