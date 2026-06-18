import { authenticator } from 'otplib';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';

authenticator.options = { window: 1 };

const DEFAULT_ISSUER = 'QlessQ';

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function buildOtpauthUrl(email: string, secret: string, issuer = DEFAULT_ISSUER): string {
  return authenticator.keyuri(email.trim(), issuer, secret);
}

export function verifyTotp(secret: string, token: string): boolean {
  const t = token.replace(/\s/g, '');
  if (!t || t.length < 6) return false;
  return authenticator.verify({ token: t, secret });
}

export function generateBackupCodes(count = 8): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(randomBytes(5).toString('hex').toUpperCase());
  }
  return out;
}

export function hashBackupCode(code: string): string {
  return createHash('sha256').update(code.toUpperCase().trim()).digest('hex');
}

export async function compareBackupCode(plain: string, hash: string): Promise<boolean> {
  const normalized = plain.toUpperCase().trim();
  if (hash.startsWith('$2')) {
    return bcrypt.compare(normalized, hash).catch(() => false);
  }
  const computed = hashBackupCode(normalized);
  return computed === hash;
}
