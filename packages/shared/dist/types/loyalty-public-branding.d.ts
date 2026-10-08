/**
 * Branding payload for unauthenticated loyalty patron surfaces (portal, card, refer).
 */
export type LoyaltyPublicBranding = {
    orgName: string;
    logoUrl: string | null;
    primaryColor: string | null;
    accentColor: string | null;
    programName: string;
    pointsCurrencyName: string;
};
export type LoyaltyPublicBrandingInput = {
    orgName: string;
    logoUrl?: string | null;
    brandPrimaryColor?: string | null;
    brandAccentColor?: string | null;
    programDisplayName?: string | null;
    pointsCurrencyName?: string | null;
};
export declare function buildLoyaltyPublicBranding(input: LoyaltyPublicBrandingInput): LoyaltyPublicBranding;
/** Default accents matching the historical slate/emerald patron theme. */
export declare const LOYALTY_PATRON_DEFAULT_PRIMARY = "#10b981";
export declare const LOYALTY_PATRON_DEFAULT_ACCENT = "#38bdf8";
//# sourceMappingURL=loyalty-public-branding.d.ts.map