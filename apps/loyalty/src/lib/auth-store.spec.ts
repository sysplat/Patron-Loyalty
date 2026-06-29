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

describe('loyalty BFF session hardening', () => {
  it('does not expose accessToken from GET /api/auth/session', () => {
    const source = readFileSync(path.join(__dirname, '../app/api/auth/session/route.ts'), 'utf8');
    expect(source).toContain('{ authenticated: true }');
    expect(source).not.toMatch(/data:\s*\{\s*accessToken/);
  });

  it('sets HttpOnly session cookies with SameSite=lax in server-auth-bff', () => {
    const source = readFileSync(path.join(__dirname, 'server-auth-bff.ts'), 'utf8');
    expect(source).toContain('httpOnly: true');
    expect(source).toContain("sameSite: 'lax'");
  });

  it('strips tokens from login BFF JSON while setting cookies', () => {
    const source = readFileSync(path.join(__dirname, 'server-auth-bff.ts'), 'utf8');
    expect(source).toContain('stripTokensFromLoginPayload');
    expect(source).toContain('delete nextData.tokens');
  });

  it('strips tokens from refresh BFF JSON while setting cookies', () => {
    const source = readFileSync(path.join(__dirname, 'server-auth-bff.ts'), 'utf8');
    expect(source).toContain('stripTokensFromRefreshPayload');
    expect(source).toContain('delete nextData.accessToken');
    expect(source).toContain('refreshSuccessBody');
  });

  it('syncs in-memory token via GET /api/auth/token (not login/session)', () => {
    const source = readFileSync(path.join(__dirname, '../app/api/auth/token/route.ts'), 'utf8');
    expect(source).toContain('WEB_SESSION_COOKIE');
    expect(source).toContain('{ accessToken }');
  });

  it('applies shared security headers via next.config', () => {
    const source = readFileSync(path.join(__dirname, '../../next.config.js'), 'utf8');
    expect(source).toContain('securityHeaders');
    expect(source).toContain("source: '/(.*)'");
  });
});
