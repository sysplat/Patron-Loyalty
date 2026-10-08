"use strict";
/**
 * Branding payload for unauthenticated loyalty patron surfaces (portal, card, refer).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOYALTY_PATRON_DEFAULT_ACCENT = exports.LOYALTY_PATRON_DEFAULT_PRIMARY = void 0;
exports.buildLoyaltyPublicBranding = buildLoyaltyPublicBranding;
function buildLoyaltyPublicBranding(input) {
    const orgName = input.orgName.trim() || 'Loyalty';
    const programName = input.programDisplayName?.trim() || orgName;
    return {
        orgName,
        logoUrl: input.logoUrl?.trim() || null,
        primaryColor: input.brandPrimaryColor?.trim() || null,
        accentColor: input.brandAccentColor?.trim() || null,
        programName,
        pointsCurrencyName: input.pointsCurrencyName?.trim() || 'Points',
    };
}
/** Default accents matching the historical slate/emerald patron theme. */
exports.LOYALTY_PATRON_DEFAULT_PRIMARY = '#10b981';
exports.LOYALTY_PATRON_DEFAULT_ACCENT = '#38bdf8';
//# sourceMappingURL=loyalty-public-branding.js.map