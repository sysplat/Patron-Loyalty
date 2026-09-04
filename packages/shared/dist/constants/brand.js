"use strict";
/** Product display name and default contact addresses (override via env where noted). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LEGAL_EMAIL = exports.DEFAULT_SUPPORT_EMAIL = exports.PLATFORM_CONTACT_EMAIL = exports.DEFAULT_NOREPLY_EMAIL = exports.LOYALTY_PRODUCT_NAME = exports.PRODUCT_NAME = void 0;
exports.PRODUCT_NAME = 'Sysplat Patron Loyalty';
/** Public-facing name for the Patron Loyalty / LMS product. */
exports.LOYALTY_PRODUCT_NAME = 'Sysplat Patron Loyalty';
/** Default transactional from-address when EMAIL_FROM is unset. */
exports.DEFAULT_NOREPLY_EMAIL = 'no-reply@loyalty.sysplat.com';
/**
 * Canonical public contact inbox for Sysplat / QPlatform / Loyalty.
 * Cloudflare Email Routing forwards this to the ops mailbox.
 * Change this once; DEFAULT_SUPPORT_EMAIL and DEFAULT_LEGAL_EMAIL derive from it.
 */
exports.PLATFORM_CONTACT_EMAIL = 'support@sysplat.com';
/** Default inbox for tenant support requests when SUPPORT_CONTACT_EMAIL is unset. */
exports.DEFAULT_SUPPORT_EMAIL = exports.PLATFORM_CONTACT_EMAIL;
/** Public legal / privacy contact (shown on legal pages). */
exports.DEFAULT_LEGAL_EMAIL = exports.PLATFORM_CONTACT_EMAIL;
//# sourceMappingURL=brand.js.map