import {
  CURRENT_LOYALTY_PATRON_PRIVACY_VERSION,
  CURRENT_LOYALTY_PATRON_TERMS_VERSION,
} from '@queueplatform/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export function patronConsentStorageKey(code: string) {
  return `loyalty-patron-legal-${CURRENT_LOYALTY_PATRON_TERMS_VERSION}-${CURRENT_LOYALTY_PATRON_PRIVACY_VERSION}-${code.toUpperCase()}`;
}

export function hasStoredPatronConsent(code: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(patronConsentStorageKey(code)) === '1';
}

export function storePatronConsent(code: string) {
  localStorage.setItem(patronConsentStorageKey(code), '1');
}

export async function recordPatronLegalConsentOnServer(code: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/loyalty/public/portal/${encodeURIComponent(code)}/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      termsVersion: CURRENT_LOYALTY_PATRON_TERMS_VERSION,
      privacyVersion: CURRENT_LOYALTY_PATRON_PRIVACY_VERSION,
    }),
  });
  if (!res.ok) return false;
  storePatronConsent(code);
  return true;
}
