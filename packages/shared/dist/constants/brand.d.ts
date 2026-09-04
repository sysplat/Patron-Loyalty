/** Product display name and default contact addresses (override via env where noted). */
export declare const PRODUCT_NAME = "Sysplat Patron Loyalty";
/** Public-facing name for the Patron Loyalty / LMS product. */
export declare const LOYALTY_PRODUCT_NAME = "Sysplat Patron Loyalty";
/** Default transactional from-address when EMAIL_FROM is unset. */
export declare const DEFAULT_NOREPLY_EMAIL = "no-reply@loyalty.sysplat.com";
/**
 * Canonical public contact inbox for Sysplat / QPlatform / Loyalty.
 * Cloudflare Email Routing forwards this to the ops mailbox.
 * Change this once; DEFAULT_SUPPORT_EMAIL and DEFAULT_LEGAL_EMAIL derive from it.
 */
export declare const PLATFORM_CONTACT_EMAIL = "support@sysplat.com";
/** Default inbox for tenant support requests when SUPPORT_CONTACT_EMAIL is unset. */
export declare const DEFAULT_SUPPORT_EMAIL = "support@sysplat.com";
/** Public legal / privacy contact (shown on legal pages). */
export declare const DEFAULT_LEGAL_EMAIL = "support@sysplat.com";
//# sourceMappingURL=brand.d.ts.map