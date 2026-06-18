import Link from 'next/link';
import { QlessqBrand } from '@/components/brand';

export function PublicHeader({ active }: { active?: 'pricing' }) {
  return (
    <header className="border-border/40 bg-background/60 supports-[backdrop-filter]:bg-background/40 sticky top-0 z-50 border-b backdrop-blur-xl">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-10">
            <QlessqBrand href="/" markSize={46} wordmarkHeight={28} priority />
            <nav className="hidden items-center gap-8 lg:flex">
              <a
                href="/#features"
                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-all"
              >
                Features
              </a>
              <a
                href="/#integration"
                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-all"
              >
                QlessQ
              </a>
              <Link
                href="/pricing"
                className={
                  active === 'pricing'
                    ? 'text-primary text-sm font-semibold underline decoration-2 underline-offset-8'
                    : 'text-muted-foreground hover:text-foreground text-sm font-medium transition-all'
                }
              >
                Pricing
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground hidden text-sm font-semibold transition-all md:block"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="bg-primary text-primary-foreground shadow-primary/10 hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-bold shadow-lg transition-all sm:px-6"
            >
              Start free
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
