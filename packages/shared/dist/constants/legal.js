"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOYALTY_LEGAL_DOCUMENTS = exports.LEGAL_DOCUMENTS = exports.LEGAL_DOCUMENT_TYPES = exports.CURRENT_LOYALTY_PATRON_LEGAL_CONSENT_VERSION = exports.CURRENT_LOYALTY_PATRON_TERMS_VERSION = exports.CURRENT_LOYALTY_PATRON_PRIVACY_VERSION = exports.CURRENT_LOYALTY_PRIVACY_VERSION = exports.CURRENT_LOYALTY_TERMS_VERSION = exports.CURRENT_PATRON_TERMS_VERSION = exports.CURRENT_PATRON_PRIVACY_VERSION = exports.CURRENT_PRIVACY_VERSION = exports.CURRENT_TERMS_VERSION = exports.LEGAL_CONTACT_EMAIL = exports.LEGAL_ENTITY_NAME = void 0;
const brand_1 = require("./brand");
/** Legal entity and document versions — bump versions when text changes materially. */
exports.LEGAL_ENTITY_NAME = brand_1.PRODUCT_NAME;
exports.LEGAL_CONTACT_EMAIL = brand_1.DEFAULT_LEGAL_EMAIL;
/** ISO date identifying the published Terms of Service revision. */
exports.CURRENT_TERMS_VERSION = '2026-06-04';
/** ISO date identifying the published Privacy Policy revision (tenant-facing). */
exports.CURRENT_PRIVACY_VERSION = '2026-06-04';
/** ISO date identifying the published patron End-User Privacy Notice revision. */
exports.CURRENT_PATRON_PRIVACY_VERSION = '2026-06-05';
/** ISO date identifying the published patron End-User Terms revision. */
exports.CURRENT_PATRON_TERMS_VERSION = '2026-06-05';
/** ISO date — Patron Loyalty tenant Terms of Service. */
exports.CURRENT_LOYALTY_TERMS_VERSION = '2026-06-17';
/** ISO date — Patron Loyalty tenant Privacy Policy. */
exports.CURRENT_LOYALTY_PRIVACY_VERSION = '2026-06-17';
/** ISO date — Patron Loyalty end-user (patron portal) privacy notice. */
exports.CURRENT_LOYALTY_PATRON_PRIVACY_VERSION = '2026-06-17';
/** ISO date — Patron Loyalty end-user (patron portal) terms. */
exports.CURRENT_LOYALTY_PATRON_TERMS_VERSION = '2026-06-17';
/** Combined patron portal legal bundle — bump when patron Terms or Privacy change materially. */
exports.CURRENT_LOYALTY_PATRON_LEGAL_CONSENT_VERSION = `${exports.CURRENT_LOYALTY_PATRON_TERMS_VERSION}/${exports.CURRENT_LOYALTY_PATRON_PRIVACY_VERSION}`;
exports.LEGAL_DOCUMENT_TYPES = {
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
};
exports.LEGAL_DOCUMENTS = {
    termsOfService: {
        type: exports.LEGAL_DOCUMENT_TYPES.TERMS_OF_SERVICE,
        title: 'Terms of Service',
        path: '/terms',
        version: exports.CURRENT_TERMS_VERSION,
        lastUpdated: 'June 4, 2026',
    },
    privacyPolicy: {
        type: exports.LEGAL_DOCUMENT_TYPES.PRIVACY_POLICY,
        title: 'Privacy Policy',
        path: '/privacy',
        version: exports.CURRENT_PRIVACY_VERSION,
        lastUpdated: 'June 4, 2026',
    },
    patronPrivacy: {
        type: exports.LEGAL_DOCUMENT_TYPES.PATRON_PRIVACY,
        title: 'End-User Privacy Notice',
        path: '/patron-privacy',
        version: exports.CURRENT_PATRON_PRIVACY_VERSION,
        lastUpdated: 'June 5, 2026',
    },
    patronTerms: {
        type: exports.LEGAL_DOCUMENT_TYPES.PATRON_TERMS,
        title: 'End-User Terms of Service',
        path: '/patron-terms',
        version: exports.CURRENT_PATRON_TERMS_VERSION,
        lastUpdated: 'June 5, 2026',
    },
    dpaOverview: {
        type: exports.LEGAL_DOCUMENT_TYPES.DPA_OVERVIEW,
        title: 'Data Processing Addendum Overview',
        path: '/dpa',
        version: exports.CURRENT_PRIVACY_VERSION,
        lastUpdated: 'June 4, 2026',
    },
    subprocessors: {
        type: exports.LEGAL_DOCUMENT_TYPES.SUBPROCESSORS,
        title: 'Subprocessor Register',
        path: '/subprocessors',
        version: exports.CURRENT_PRIVACY_VERSION,
        lastUpdated: 'June 4, 2026',
    },
};
/** Legal pages published in `apps/loyalty` (Patron Loyalty / LMS product). */
exports.LOYALTY_LEGAL_DOCUMENTS = {
    loyaltyTermsOfService: {
        type: exports.LEGAL_DOCUMENT_TYPES.LOYALTY_TERMS_OF_SERVICE,
        title: 'Patron Loyalty Terms of Service',
        path: '/terms',
        version: exports.CURRENT_LOYALTY_TERMS_VERSION,
        lastUpdated: 'June 17, 2026',
    },
    loyaltyPrivacyPolicy: {
        type: exports.LEGAL_DOCUMENT_TYPES.LOYALTY_PRIVACY_POLICY,
        title: 'Patron Loyalty Privacy Policy',
        path: '/privacy',
        version: exports.CURRENT_LOYALTY_PRIVACY_VERSION,
        lastUpdated: 'June 17, 2026',
    },
    loyaltyPatronPrivacy: {
        type: exports.LEGAL_DOCUMENT_TYPES.LOYALTY_PATRON_PRIVACY,
        title: 'Loyalty Program Privacy Notice',
        path: '/patron-privacy',
        version: exports.CURRENT_LOYALTY_PATRON_PRIVACY_VERSION,
        lastUpdated: 'June 17, 2026',
    },
    loyaltyPatronTerms: {
        type: exports.LEGAL_DOCUMENT_TYPES.LOYALTY_PATRON_TERMS,
        title: 'Loyalty Program Terms',
        path: '/patron-terms',
        version: exports.CURRENT_LOYALTY_PATRON_TERMS_VERSION,
        lastUpdated: 'June 17, 2026',
    },
    loyaltyDpaOverview: {
        type: exports.LEGAL_DOCUMENT_TYPES.DPA_OVERVIEW,
        title: 'Data Processing Addendum Overview',
        path: '/dpa',
        version: exports.CURRENT_LOYALTY_PRIVACY_VERSION,
        lastUpdated: 'June 17, 2026',
    },
    loyaltySubprocessors: {
        type: exports.LEGAL_DOCUMENT_TYPES.SUBPROCESSORS,
        title: 'Subprocessor Register',
        path: '/subprocessors',
        version: exports.CURRENT_LOYALTY_PRIVACY_VERSION,
        lastUpdated: 'June 17, 2026',
    },
};
//# sourceMappingURL=legal.js.map