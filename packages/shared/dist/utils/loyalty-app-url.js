"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLoyaltyAppUrl = resolveLoyaltyAppUrl;
const DEFAULT_LOYALTY_APP_URL = 'http://localhost:3003';
/** Public Patron Loyalty staff/portal app base URL (no trailing slash). */
function resolveLoyaltyAppUrl(loyaltyUrl, nextPublicLoyaltyUrl) {
    const raw = loyaltyUrl ??
        nextPublicLoyaltyUrl ??
        (typeof process !== 'undefined' ? process.env.LOYALTY_URL : undefined) ??
        (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_LOYALTY_URL : undefined) ??
        DEFAULT_LOYALTY_APP_URL;
    return String(raw).replace(/\/$/, '');
}
//# sourceMappingURL=loyalty-app-url.js.map