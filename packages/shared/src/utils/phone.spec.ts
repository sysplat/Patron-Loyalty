import { describe, it, expect } from 'vitest';
import { normalizeSmsRecipient } from './phone';

describe('normalizeSmsRecipient', () => {
  it('keeps valid E.164 numbers', () => {
    expect(normalizeSmsRecipient('+14155552671')).toBe('+14155552671');
  });

  it('removes common formatting from E.164 numbers', () => {
    expect(normalizeSmsRecipient('+1 (415) 555-2671')).toBe('+14155552671');
  });

  it('normalizes Canadian and US local numbers to +1', () => {
    expect(normalizeSmsRecipient('(415) 555-2671')).toBe('+14155552671');
    expect(normalizeSmsRecipient('14155552671')).toBe('+14155552671');
  });

  it('normalizes 00 international prefixes to E.164', () => {
    expect(normalizeSmsRecipient('00442079460000')).toBe('+442079460000');
  });

  it('rejects ambiguous or invalid numbers', () => {
    expect(normalizeSmsRecipient('604861')).toBeNull();
    expect(normalizeSmsRecipient('442079460000')).toBeNull();
    expect(normalizeSmsRecipient('')).toBeNull();
  });
});
