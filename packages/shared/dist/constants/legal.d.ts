/** Legal entity and document versions — bump versions when text changes materially. */
export declare const LEGAL_ENTITY_NAME = "QlessQ";
export declare const LEGAL_CONTACT_EMAIL = "legal@queueplatform.com";
/** ISO date identifying the published Terms of Service revision. */
export declare const CURRENT_TERMS_VERSION = "2026-06-04";
/** ISO date identifying the published Privacy Policy revision (tenant-facing). */
export declare const CURRENT_PRIVACY_VERSION = "2026-06-04";
/** ISO date identifying the published patron End-User Privacy Notice revision. */
export declare const CURRENT_PATRON_PRIVACY_VERSION = "2026-06-05";
/** ISO date identifying the published patron End-User Terms revision. */
export declare const CURRENT_PATRON_TERMS_VERSION = "2026-06-05";
/** ISO date — Patron Loyalty tenant Terms of Service. */
export declare const CURRENT_LOYALTY_TERMS_VERSION = "2026-06-17";
/** ISO date — Patron Loyalty tenant Privacy Policy. */
export declare const CURRENT_LOYALTY_PRIVACY_VERSION = "2026-06-17";
/** ISO date — Patron Loyalty end-user (patron portal) privacy notice. */
export declare const CURRENT_LOYALTY_PATRON_PRIVACY_VERSION = "2026-06-17";
/** ISO date — Patron Loyalty end-user (patron portal) terms. */
export declare const CURRENT_LOYALTY_PATRON_TERMS_VERSION = "2026-06-17";
/** Combined patron portal legal bundle — bump when patron Terms or Privacy change materially. */
export declare const CURRENT_LOYALTY_PATRON_LEGAL_CONSENT_VERSION = "2026-06-17/2026-06-17";
export declare const LEGAL_DOCUMENT_TYPES: {
    readonly TERMS_OF_SERVICE: "terms_of_service";
    readonly PRIVACY_POLICY: "privacy_policy";
    readonly PATRON_PRIVACY: "patron_privacy";
    readonly PATRON_TERMS: "patron_terms";
    readonly LOYALTY_TERMS_OF_SERVICE: "loyalty_terms_of_service";
    readonly LOYALTY_PRIVACY_POLICY: "loyalty_privacy_policy";
    readonly LOYALTY_PATRON_PRIVACY: "loyalty_patron_privacy";
    readonly LOYALTY_PATRON_TERMS: "loyalty_patron_terms";
    readonly DPA_OVERVIEW: "dpa_overview";
    readonly SUBPROCESSORS: "subprocessors";
};
export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[keyof typeof LEGAL_DOCUMENT_TYPES];
export declare const LEGAL_DOCUMENTS: {
    readonly termsOfService: {
        readonly type: "terms_of_service";
        readonly title: "Terms of Service";
        readonly path: "/terms";
        readonly version: "2026-06-04";
        readonly lastUpdated: "June 4, 2026";
    };
    readonly privacyPolicy: {
        readonly type: "privacy_policy";
        readonly title: "Privacy Policy";
        readonly path: "/privacy";
        readonly version: "2026-06-04";
        readonly lastUpdated: "June 4, 2026";
    };
    readonly patronPrivacy: {
        readonly type: "patron_privacy";
        readonly title: "End-User Privacy Notice";
        readonly path: "/patron-privacy";
        readonly version: "2026-06-05";
        readonly lastUpdated: "June 5, 2026";
    };
    readonly patronTerms: {
        readonly type: "patron_terms";
        readonly title: "End-User Terms of Service";
        readonly path: "/patron-terms";
        readonly version: "2026-06-05";
        readonly lastUpdated: "June 5, 2026";
    };
    readonly dpaOverview: {
        readonly type: "dpa_overview";
        readonly title: "Data Processing Addendum Overview";
        readonly path: "/dpa";
        readonly version: "2026-06-04";
        readonly lastUpdated: "June 4, 2026";
    };
    readonly subprocessors: {
        readonly type: "subprocessors";
        readonly title: "Subprocessor Register";
        readonly path: "/subprocessors";
        readonly version: "2026-06-04";
        readonly lastUpdated: "June 4, 2026";
    };
};
/** Legal pages published in `apps/loyalty` (Patron Loyalty / LMS product). */
export declare const LOYALTY_LEGAL_DOCUMENTS: {
    readonly loyaltyTermsOfService: {
        readonly type: "loyalty_terms_of_service";
        readonly title: "Patron Loyalty Terms of Service";
        readonly path: "/terms";
        readonly version: "2026-06-17";
        readonly lastUpdated: "June 17, 2026";
    };
    readonly loyaltyPrivacyPolicy: {
        readonly type: "loyalty_privacy_policy";
        readonly title: "Patron Loyalty Privacy Policy";
        readonly path: "/privacy";
        readonly version: "2026-06-17";
        readonly lastUpdated: "June 17, 2026";
    };
    readonly loyaltyPatronPrivacy: {
        readonly type: "loyalty_patron_privacy";
        readonly title: "Loyalty Program Privacy Notice";
        readonly path: "/patron-privacy";
        readonly version: "2026-06-17";
        readonly lastUpdated: "June 17, 2026";
    };
    readonly loyaltyPatronTerms: {
        readonly type: "loyalty_patron_terms";
        readonly title: "Loyalty Program Terms";
        readonly path: "/patron-terms";
        readonly version: "2026-06-17";
        readonly lastUpdated: "June 17, 2026";
    };
    readonly loyaltyDpaOverview: {
        readonly type: "dpa_overview";
        readonly title: "Data Processing Addendum Overview";
        readonly path: "/dpa";
        readonly version: "2026-06-17";
        readonly lastUpdated: "June 17, 2026";
    };
    readonly loyaltySubprocessors: {
        readonly type: "subprocessors";
        readonly title: "Subprocessor Register";
        readonly path: "/subprocessors";
        readonly version: "2026-06-17";
        readonly lastUpdated: "June 17, 2026";
    };
};
//# sourceMappingURL=legal.d.ts.map