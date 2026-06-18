import { describe, expect, it } from 'vitest';
import { isBillableSmsProviderMessageId } from './sms-credits';
import { SMS_CREDIT_PACKS, smsPackUnitPriceUsd } from './sms-credit-packs';

describe('isBillableSmsProviderMessageId', () => {
  it('accepts Twilio SMS SIDs', () => {
    expect(isBillableSmsProviderMessageId('SMec73bf6b49d2ec2b2666061346442450')).toBe(true);
  });

  it('rejects dev/console and missing ids', () => {
    expect(isBillableSmsProviderMessageId('dev-123')).toBe(false);
    expect(isBillableSmsProviderMessageId('push-noop')).toBe(false);
    expect(isBillableSmsProviderMessageId(null)).toBe(false);
  });
});

describe('SMS_CREDIT_PACKS pricing', () => {
  it('keeps retail above wholesale on every tier', () => {
    for (const pack of SMS_CREDIT_PACKS) {
      const unit = smsPackUnitPriceUsd(pack);
      expect(unit).toBeGreaterThanOrEqual(0.025);
      expect(unit).toBeLessThanOrEqual(0.03);
    }
  });
});
