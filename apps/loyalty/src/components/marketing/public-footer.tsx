import Link from 'next/link';
import { QlessqBrand } from '@/components/brand';

export function PublicFooter() {
  return (
    <footer className="bg-card border-t py-12">
      <div className="container mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row lg:px-8">
        <div className="flex items-center gap-2">
          <QlessqBrand href="/" markSize={32} wordmarkHeight={22} />
          <span className="text-muted-foreground ml-4 text-sm">© {new Date().getFullYear()}</span>
        </div>
        <nav className="text-muted-foreground flex flex-wrap justify-center gap-6 text-sm font-medium">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/patron-privacy" className="hover:text-foreground">
            Patron privacy
          </Link>
          <Link href="/patron-terms" className="hover:text-foreground">
            Patron terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
