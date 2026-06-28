import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('loyalty auth-store persistence', () => {
  it('does not persist accessToken in localStorage (partialize user only)', () => {
    const source = readFileSync(path.join(__dirname, 'auth-store.ts'), 'utf8');
    expect(source).toContain('partialize: (state) => ({ user: state.user })');
    expect(source).toMatch(/partialize:\s*\(state\)\s*=>\s*\(\{\s*user:\s*state\.user\s*\}\)/);
  });

  it('uses qp-auth-v2-user persist name', () => {
    const source = readFileSync(path.join(__dirname, 'auth-store.ts'), 'utf8');
    expect(source).toContain("name: 'qp-auth-v2-user'");
  });
});

describe('loyalty middleware session cookies', () => {
  it('gates dashboard routes on WEB_SESSION_COOKIE and supports refresh', () => {
    const source = readFileSync(path.join(__dirname, '../middleware.ts'), 'utf8');
    expect(source).toContain('WEB_SESSION_COOKIE');
    expect(source).toContain('WEB_REFRESH_COOKIE');
    expect(source).toContain('/api/auth/refresh');
    expect(source).toContain("'/login'");
  });

  it('allows public portal prefixes without session', () => {
    const source = readFileSync(path.join(__dirname, '../middleware.ts'), 'utf8');
    expect(source).toContain("'/portal'");
    expect(source).toContain("'/refer'");
  });

  it('does not expose QMS-only public routes (kiosk, display, track, book)', () => {
    const source = readFileSync(path.join(__dirname, '../middleware.ts'), 'utf8');
    expect(source).not.toContain("'/kiosk'");
    expect(source).not.toContain("'/display'");
    expect(source).not.toContain("'/track'");
    expect(source).not.toContain("'/book'");
  });
});
