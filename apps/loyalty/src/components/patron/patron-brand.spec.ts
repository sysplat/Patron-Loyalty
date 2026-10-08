import { describe, expect, it } from 'vitest';
import {
  LOYALTY_PATRON_DEFAULT_ACCENT,
  LOYALTY_PATRON_DEFAULT_PRIMARY,
} from '@queueplatform/shared';
import { patronBrandStyle, resolvePatronBranding } from './patron-brand';

describe('resolvePatronBranding', () => {
  it('prefers the nested branding payload over legacy top-level fields', () => {
    const branding = resolvePatronBranding({
      orgName: 'Legacy Name',
      pointsCurrencyName: 'Legacy Points',
      branding: {
        orgName: 'Bean There',
        logoUrl: 'https://cdn.example.com/logo.png',
        primaryColor: '#ff0088',
        accentColor: '#00ccff',
        programName: 'Bean Club',
        pointsCurrencyName: 'Beans',
      },
    });

    expect(branding).toEqual({
      orgName: 'Bean There',
      logoUrl: 'https://cdn.example.com/logo.png',
      primaryColor: '#ff0088',
      accentColor: '#00ccff',
      programName: 'Bean Club',
      pointsCurrencyName: 'Beans',
    });
  });

  it('falls back to legacy fields, then to safe defaults', () => {
    const branding = resolvePatronBranding({ orgName: 'Corner Cafe' });

    expect(branding.orgName).toBe('Corner Cafe');
    expect(branding.programName).toBe('Corner Cafe');
    expect(branding.pointsCurrencyName).toBe('Points');
    expect(branding.logoUrl).toBeNull();
    expect(branding.primaryColor).toBeNull();
  });

  it('treats blank values as missing', () => {
    const branding = resolvePatronBranding({
      branding: { orgName: '   ', logoUrl: '  ', primaryColor: '', programName: ' ' },
    });

    expect(branding.orgName).toBe('Loyalty');
    expect(branding.programName).toBe('Loyalty');
    expect(branding.logoUrl).toBeNull();
    expect(branding.primaryColor).toBeNull();
  });
});

describe('patronBrandStyle', () => {
  it('exposes merchant colors as CSS variables', () => {
    const style = patronBrandStyle(
      resolvePatronBranding({
        branding: { orgName: 'Bean There', primaryColor: '#ff0088', accentColor: '#00ccff' },
      }),
    );

    expect(style).toMatchObject({ '--patron-primary': '#ff0088', '--patron-accent': '#00ccff' });
  });

  it('falls back to product defaults when the merchant has no colors', () => {
    const style = patronBrandStyle(resolvePatronBranding({ orgName: 'Corner Cafe' }));

    expect(style).toMatchObject({
      '--patron-primary': LOYALTY_PATRON_DEFAULT_PRIMARY,
      '--patron-accent': LOYALTY_PATRON_DEFAULT_ACCENT,
    });
  });
});
