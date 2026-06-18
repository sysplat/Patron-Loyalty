import { CURRENT_LOYALTY_PATRON_TERMS_VERSION } from '@queueplatform/shared';

export function patronConsentStorageKey(code: string) {
  return `loyalty-patron-legal-${CURRENT_LOYALTY_PATRON_TERMS_VERSION}-${code.toUpperCase()}`;
}

export function hasStoredPatronConsent(code: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(patronConsentStorageKey(code)) === '1';
}

export function storePatronConsent(code: string) {
  localStorage.setItem(patronConsentStorageKey(code), '1');
}
