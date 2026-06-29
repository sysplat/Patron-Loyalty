import { describe, it, expect } from 'vitest';
import { generateReferralCode } from './loyalty-referral-code.util';

describe('generateReferralCode', () => {
  it('generates code of requested length', () => {
    const code = generateReferralCode(10);
    expect(code).toHaveLength(10);
    expect(code).toMatch(/^[A-Z2-9]+$/);
  });

  it('generates unique codes across calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateReferralCode(8)));
    expect(codes.size).toBeGreaterThan(1);
  });
});
