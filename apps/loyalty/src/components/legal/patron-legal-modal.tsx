'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { loyaltyPatronTermsContent } from '@/content/legal/loyalty-patron-terms';
import { loyaltyPatronPrivacyContent } from '@/content/legal/loyalty-patron-privacy';
import { PatronPoweredBy } from '@/components/brand';

type PatronLegalModalProps = {
  type: 'terms' | 'privacy';
  onClose: () => void;
};

export function PatronLegalModal({ type, onClose }: PatronLegalModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const content = type === 'terms' ? loyaltyPatronTermsContent : loyaltyPatronPrivacyContent;
  const title = type === 'terms' ? 'Loyalty Program Terms' : 'Loyalty Program Privacy Notice';

  if (!mounted) return null;

  return createPortal(
    <div
      className="animate-in fade-in fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 backdrop-blur-md duration-300 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loyalty-patron-legal-modal-title"
      onClick={onClose}
    >
      <div className="flex min-h-full items-start justify-center">
        <div
          className="mb-4 mt-4 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/20 bg-slate-900 text-left text-white shadow-xl sm:mt-12"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="relative flex shrink-0 items-start justify-between border-b border-white/10 px-6 pb-4 pt-6 sm:px-8">
            <h2
              id="loyalty-patron-legal-modal-title"
              className="pr-4 text-xl font-bold tracking-tight"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>

          <div className="max-h-[60vh] space-y-6 overflow-y-auto px-6 py-4 text-sm leading-relaxed text-white/80 sm:px-8">
            <p className="font-medium text-white/95">{content.intro}</p>
            {content.sections.map((section) => (
              <div key={section.id} className="space-y-2">
                <h3 className="text-base font-semibold text-white">{section.title}</h3>
                <p>{section.body}</p>
              </div>
            ))}
            <p className="text-xs text-white/50">
              Full text also available at{' '}
              <Link
                href={type === 'terms' ? '/patron-terms' : '/patron-privacy'}
                className="underline"
                onClick={onClose}
              >
                {type === 'terms' ? '/patron-terms' : '/patron-privacy'}
              </Link>
              .
            </p>
          </div>

          <div className="space-y-4 border-t border-white/10 p-6 sm:p-8">
            <PatronPoweredBy className="justify-center border-none pl-0" compact />
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
