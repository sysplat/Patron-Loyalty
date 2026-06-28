import { describe, expect, it } from 'vitest';
import {
  decorateTransactionalSmsBody,
  hasLegacySmsComplianceSuffix,
  stripLegacySmsComplianceSuffix,
} from '@queueplatform/shared';

describe('decorateTransactionalSmsBody', () => {
  it('appends footer when disclosure is missing', () => {
    const body = decorateTransactionalSmsBody('Your turn now.', 'Acme Health');

    expect(body).toBe('Your turn now. Reply STOP to cancel.');
  });

  it('does not append when STOP disclosure already exists', () => {
    const body = decorateTransactionalSmsBody('Your turn. Reply STOP to opt out.', 'Acme Health');

    expect(body).toBe('Your turn. Reply STOP to opt out.');
  });
});

describe('stripLegacySmsComplianceSuffix', () => {
  it('detects legacy seeded template footer', () => {
    const body =
      'Your turn! Ticket {{displayNumber}} — please proceed to Desk {{counterNumber}}. QlessQ alerts. Msg&data rates may apply. Reply STOP to opt out, HELP for help.';

    expect(hasLegacySmsComplianceSuffix(body)).toBe(true);
    expect(stripLegacySmsComplianceSuffix(body)).toBe(
      'Your turn! Ticket {{displayNumber}} — please proceed to Desk {{counterNumber}}.',
    );
  });

  it('leaves message-only templates unchanged', () => {
    const body = 'Your turn! Ticket {{displayNumber}} — please proceed to Desk {{counterNumber}}.';

    expect(hasLegacySmsComplianceSuffix(body)).toBe(false);
    expect(stripLegacySmsComplianceSuffix(body)).toBe(body);
  });
});
