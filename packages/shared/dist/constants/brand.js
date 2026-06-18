"use strict";
/** Product display name and default contact addresses (override via env where noted). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LEGAL_EMAIL = exports.DEFAULT_SUPPORT_EMAIL = exports.DEFAULT_NOREPLY_EMAIL = exports.LOYALTY_PRODUCT_NAME = exports.PRODUCT_NAME = void 0;
exports.PRODUCT_NAME = 'QlessQ';
/** Public-facing name for the Patron Loyalty / LMS product. */
exports.LOYALTY_PRODUCT_NAME = 'Patron Loyalty';
/** Default transactional from-address when EMAIL_FROM is unset. */
exports.DEFAULT_NOREPLY_EMAIL = 'noreply@queueplatform.com';
/** Default inbox for tenant support requests when SUPPORT_CONTACT_EMAIL is unset. */
exports.DEFAULT_SUPPORT_EMAIL = 'support@queueplatform.com';
/** Public legal / privacy contact (shown on legal pages). */
exports.DEFAULT_LEGAL_EMAIL = 'legal@queueplatform.com';
//# sourceMappingURL=brand.js.map