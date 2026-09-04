/** Product display name and default contact addresses (override via env where noted). */

export const PRODUCT_NAME = 'Sysplat Patron Loyalty';

/** Public-facing name for the Patron Loyalty / LMS product. */
export const LOYALTY_PRODUCT_NAME = 'Sysplat Patron Loyalty';

/** Default transactional from-address when EMAIL_FROM is unset. */
export const DEFAULT_NOREPLY_EMAIL = 'no-reply@loyalty.sysplat.com';

/**
 * Canonical public contact inbox for Sysplat / QPlatform / Loyalty.
 * Cloudflare Email Routing forwards this to the ops mailbox.
 * Change this once; DEFAULT_SUPPORT_EMAIL and DEFAULT_LEGAL_EMAIL derive from it.
 */
export const PLATFORM_CONTACT_EMAIL = 'support@sysplat.com';

/** Default inbox for tenant support requests when SUPPORT_CONTACT_EMAIL is unset. */
export const DEFAULT_SUPPORT_EMAIL = PLATFORM_CONTACT_EMAIL;

/** Public legal / privacy contact (shown on legal pages). */
export const DEFAULT_LEGAL_EMAIL = PLATFORM_CONTACT_EMAIL;
