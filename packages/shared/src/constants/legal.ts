import { DEFAULT_LEGAL_EMAIL, PRODUCT_NAME } from './brand';

/** Legal entity and document versions — bump versions when text changes materially. */

export const LEGAL_ENTITY_NAME = PRODUCT_NAME;

export const LEGAL_CONTACT_EMAIL = DEFAULT_LEGAL_EMAIL;

/** ISO date identifying the published Terms of Service revision. */
export const CURRENT_TERMS_VERSION = '2026-06-04';

/** ISO date identifying the published Privacy Policy revision (tenant-facing). */
export const CURRENT_PRIVACY_VERSION = '2026-06-04';

/** ISO date identifying the published patron End-User Privacy Notice revision. */
export const CURRENT_PATRON_PRIVACY_VERSION = '2026-06-05';

/** ISO date identifying the published patron End-User Terms revision. */
export const CURRENT_PATRON_TERMS_VERSION = '2026-06-05';

/** ISO date — Patron Loyalty tenant Terms of Service. */
export const CURRENT_LOYALTY_TERMS_VERSION = '2026-06-17';

/** ISO date — Patron Loyalty tenant Privacy Policy. */
export const CURRENT_LOYALTY_PRIVACY_VERSION = '2026-06-17';

/** ISO date — Patron Loyalty end-user (patron portal) privacy notice. */
export const CURRENT_LOYALTY_PATRON_PRIVACY_VERSION = '2026-06-17';

/** ISO date — Patron Loyalty end-user (patron portal) terms. */
export const CURRENT_LOYALTY_PATRON_TERMS_VERSION = '2026-06-17';

/** Combined patron portal legal bundle — bump when patron Terms or Privacy change materially. */
export const CURRENT_LOYALTY_PATRON_LEGAL_CONSENT_VERSION = `${CURRENT_LOYALTY_PATRON_TERMS_VERSION}/${CURRENT_LOYALTY_PATRON_PRIVACY_VERSION}`;

export const LEGAL_DOCUMENT_TYPES = {
  TERMS_OF_SERVICE: 'terms_of_service',
  PRIVACY_POLICY: 'privacy_policy',
  PATRON_PRIVACY: 'patron_privacy',
  PATRON_TERMS: 'patron_terms',
  LOYALTY_TERMS_OF_SERVICE: 'loyalty_terms_of_service',
  LOYALTY_PRIVACY_POLICY: 'loyalty_privacy_policy',
  LOYALTY_PATRON_PRIVACY: 'loyalty_patron_privacy',
  LOYALTY_PATRON_TERMS: 'loyalty_patron_terms',
  DPA_OVERVIEW: 'dpa_overview',
  SUBPROCESSORS: 'subprocessors',
} as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[keyof typeof LEGAL_DOCUMENT_TYPES];

export const LEGAL_DOCUMENTS = {
  termsOfService: {
    type: LEGAL_DOCUMENT_TYPES.TERMS_OF_SERVICE,
    title: 'Terms of Service',
    path: '/terms',
    version: CURRENT_TERMS_VERSION,
    lastUpdated: 'June 4, 2026',
  },
  privacyPolicy: {
    type: LEGAL_DOCUMENT_TYPES.PRIVACY_POLICY,
    title: 'Privacy Policy',
    path: '/privacy',
    version: CURRENT_PRIVACY_VERSION,
    lastUpdated: 'June 4, 2026',
  },
  patronPrivacy: {
    type: LEGAL_DOCUMENT_TYPES.PATRON_PRIVACY,
    title: 'End-User Privacy Notice',
    path: '/patron-privacy',
    version: CURRENT_PATRON_PRIVACY_VERSION,
    lastUpdated: 'June 5, 2026',
  },
  patronTerms: {
    type: LEGAL_DOCUMENT_TYPES.PATRON_TERMS,
    title: 'End-User Terms of Service',
    path: '/patron-terms',
    version: CURRENT_PATRON_TERMS_VERSION,
    lastUpdated: 'June 5, 2026',
  },
  dpaOverview: {
    type: LEGAL_DOCUMENT_TYPES.DPA_OVERVIEW,
    title: 'Data Processing Addendum Overview',
    path: '/dpa',
    version: CURRENT_PRIVACY_VERSION,
    lastUpdated: 'June 4, 2026',
  },
  subprocessors: {
    type: LEGAL_DOCUMENT_TYPES.SUBPROCESSORS,
    title: 'Subprocessor Register',
    path: '/subprocessors',
    version: CURRENT_PRIVACY_VERSION,
    lastUpdated: 'June 4, 2026',
  },
} as const;

/** Legal pages published in `apps/loyalty` (Patron Loyalty / LMS product). */
export const LOYALTY_LEGAL_DOCUMENTS = {
  loyaltyTermsOfService: {
    type: LEGAL_DOCUMENT_TYPES.LOYALTY_TERMS_OF_SERVICE,
    title: 'Patron Loyalty Terms of Service',
    path: '/terms',
    version: CURRENT_LOYALTY_TERMS_VERSION,
    lastUpdated: 'June 17, 2026',
  },
  loyaltyPrivacyPolicy: {
    type: LEGAL_DOCUMENT_TYPES.LOYALTY_PRIVACY_POLICY,
    title: 'Patron Loyalty Privacy Policy',
    path: '/privacy',
    version: CURRENT_LOYALTY_PRIVACY_VERSION,
    lastUpdated: 'June 17, 2026',
  },
  loyaltyPatronPrivacy: {
    type: LEGAL_DOCUMENT_TYPES.LOYALTY_PATRON_PRIVACY,
    title: 'Loyalty Program Privacy Notice',
    path: '/patron-privacy',
    version: CURRENT_LOYALTY_PATRON_PRIVACY_VERSION,
    lastUpdated: 'June 17, 2026',
  },
  loyaltyPatronTerms: {
    type: LEGAL_DOCUMENT_TYPES.LOYALTY_PATRON_TERMS,
    title: 'Loyalty Program Terms',
    path: '/patron-terms',
    version: CURRENT_LOYALTY_PATRON_TERMS_VERSION,
    lastUpdated: 'June 17, 2026',
  },
  loyaltyDpaOverview: {
    type: LEGAL_DOCUMENT_TYPES.DPA_OVERVIEW,
    title: 'Data Processing Addendum Overview',
    path: '/dpa',
    version: CURRENT_LOYALTY_PRIVACY_VERSION,
    lastUpdated: 'June 17, 2026',
  },
  loyaltySubprocessors: {
    type: LEGAL_DOCUMENT_TYPES.SUBPROCESSORS,
    title: 'Subprocessor Register',
    path: '/subprocessors',
    version: CURRENT_LOYALTY_PRIVACY_VERSION,
    lastUpdated: 'June 17, 2026',
  },
} as const;
