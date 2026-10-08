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

export function buildLoyaltyPublicBranding(
  input: LoyaltyPublicBrandingInput,
): LoyaltyPublicBranding {
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
export const LOYALTY_PATRON_DEFAULT_PRIMARY = '#10b981';
export const LOYALTY_PATRON_DEFAULT_ACCENT = '#38bdf8';
