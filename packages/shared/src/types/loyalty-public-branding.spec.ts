import { describe, expect, it } from 'vitest';
import { buildLoyaltyPublicBranding } from './loyalty-public-branding';

describe('buildLoyaltyPublicBranding', () => {
  it('falls back programName to orgName and defaults points currency', () => {
    expect(
      buildLoyaltyPublicBranding({
        orgName: 'Cafe',
        logoUrl: 'https://cdn.example/logo.png',
        brandPrimaryColor: '#112233',
      }),
    ).toEqual({
      orgName: 'Cafe',
      logoUrl: 'https://cdn.example/logo.png',
      primaryColor: '#112233',
      accentColor: null,
      programName: 'Cafe',
      pointsCurrencyName: 'Points',
    });
  });

  it('uses program display name when provided', () => {
    expect(
      buildLoyaltyPublicBranding({
        orgName: 'Cafe LLC',
        programDisplayName: 'Stars Club',
        pointsCurrencyName: 'Stars',
      }).programName,
    ).toBe('Stars Club');
  });
});
