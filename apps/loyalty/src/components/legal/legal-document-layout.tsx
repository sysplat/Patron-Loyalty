import Link from 'next/link';
import { LEGAL_CONTACT_EMAIL, LOYALTY_LEGAL_DOCUMENTS } from '@queueplatform/shared';
import type { LegalDocumentContent } from '@/content/legal/types';
import { QlessqBrand } from '@/components/brand';

interface LegalDocumentLayoutProps {
  documentKey: keyof typeof LOYALTY_LEGAL_DOCUMENTS;
  content: LegalDocumentContent;
}

export function LegalDocumentLayout({ documentKey, content }: LegalDocumentLayoutProps) {
  const doc = LOYALTY_LEGAL_DOCUMENTS[documentKey];
  const footerLinks = Object.values(LOYALTY_LEGAL_DOCUMENTS).filter(
    (entry) => entry.path !== doc.path,
  );

  return (
    <div className="bg-muted/30 min-h-screen">
      <header className="bg-card border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/login" className="text-primary text-sm font-medium hover:underline">
            ← Back to sign in
          </Link>
          <QlessqBrand href="/login" markSize={46} wordmarkHeight={28} priority />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight">{doc.title}</h1>
        <p className="text-muted-foreground mt-2 text-sm">Last updated: {doc.lastUpdated}</p>

        <p className="text-foreground/90 mt-8 text-base leading-relaxed">{content.intro}</p>

        <div className="mt-10 space-y-10">
          {content.sections.map((section) => (
            <section key={section.id} id={section.id}>
              <h2 className="text-foreground text-lg font-semibold">{section.title}</h2>
              <p className="text-muted-foreground mt-3 whitespace-pre-line text-sm leading-relaxed">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <section className="bg-card mt-12 rounded-lg border p-6">
          <h2 className="text-sm font-semibold">Contact</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            For questions about this document, email{' '}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-primary hover:underline">
              {LEGAL_CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <footer className="text-muted-foreground mt-10 flex flex-wrap gap-4 border-t pt-8 text-sm">
          {footerLinks.map((entry) => (
            <Link key={entry.path} href={entry.path} className="text-primary hover:underline">
              {entry.title}
            </Link>
          ))}
          <Link href="/signup" className="hover:text-foreground">
            Create account
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Sign in
          </Link>
        </footer>
      </main>
    </div>
  );
}
