import { describe, expect, it } from 'vitest';
import { resolveTenantWebUrl } from './tenant-web-url';

describe('resolveTenantWebUrl', () => {
  it('prefers explicit webUrl', () => {
    expect(resolveTenantWebUrl('https://loyalty.example.com/')).toBe('https://loyalty.example.com');
  });

  it('maps production loyalty admin host when env is missing', () => {
    expect(resolveTenantWebUrl(undefined, 'loyalty-admin.sysplat.com')).toBe(
      'https://loyalty.sysplat.com',
    );
  });

  it('falls back to localhost loyalty port for unknown hosts', () => {
    expect(resolveTenantWebUrl(undefined, 'unknown.example')).toBe('http://localhost:3003');
  });
});
