import { describe, it, expect } from 'vitest';
import {
  buildOtpauthUrl,
  generateTotpSecret,
  generateBackupCodes,
  verifyTotp,
} from './two-factor.util';
import { authenticator } from 'otplib';

describe('two-factor.util', () => {
  it('verifies a generated TOTP code', () => {
    const secret = generateTotpSecret();
    const token = authenticator.generate(secret);
    expect(verifyTotp(secret, token)).toBe(true);
    expect(verifyTotp(secret, '000000')).toBe(false);
  });

  it('builds otpauth URL containing issuer and account', () => {
    const secret = generateTotpSecret();
    const url = buildOtpauthUrl('ops@example.com', secret);
    expect(url).toContain('otpauth://totp/');
    expect(url).toContain(encodeURIComponent('QlessQ'));
    expect(url).toContain(secret);
  });

  it('normalizes spaces in TOTP input', () => {
    const secret = generateTotpSecret();
    const token = authenticator.generate(secret);
    expect(verifyTotp(secret, `${token.slice(0, 3)} ${token.slice(3)}`)).toBe(true);
  });

  it('generates distinct backup codes', () => {
    const codes = generateBackupCodes(8);
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
  });
});
