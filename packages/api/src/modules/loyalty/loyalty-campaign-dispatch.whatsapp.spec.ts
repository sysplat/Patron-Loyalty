import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_CAMPAIGN_CHANNELS } from '@queueplatform/shared';
import { LoyaltyCampaignDispatchService } from './loyalty-campaign-dispatch.service';

describe('LoyaltyCampaignDispatchService WhatsApp', () => {
  const prisma = {
    withTenant: vi.fn(),
  };
  const notifications = {
    send: vi.fn().mockResolvedValue(undefined),
  };

  let service: LoyaltyCampaignDispatchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyCampaignDispatchService(prisma as never, notifications as never);
  });

  it('dispatches WhatsApp campaigns via whatsapp notification channel', async () => {
    const dispatchOne = (
      service as unknown as {
        dispatchOne: (
          orgId: string,
          campaign: {
            id: string;
            channel: string;
            subject: string | null;
            body: string | null;
            name: string;
          },
          sendId: string,
          customer: {
            id: string;
            name: string;
            phone: string | null;
            email: string | null;
            marketingSmsConsent: string;
            marketingEmailConsent: string;
          },
        ) => Promise<'sent' | 'skipped'>;
      }
    ).dispatchOne.bind(service);

    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => Promise<void>) =>
      fn({
        loyaltyCampaignSend: {
          update: vi.fn().mockResolvedValue({}),
        },
      }),
    );

    const result = await dispatchOne(
      'org-1',
      {
        id: 'camp-1',
        channel: LOYALTY_CAMPAIGN_CHANNELS.WHATSAPP,
        subject: 'Hello',
        body: 'Your bonus is ready',
        name: 'Promo',
      },
      'send-1',
      {
        id: 'cust-1',
        name: 'Patron',
        phone: '+14155550100',
        email: null,
        marketingSmsConsent: 'GRANTED',
        marketingEmailConsent: 'REVOKED',
      },
    );

    expect(result).toBe('sent');
    expect(notifications.send).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        channel: 'whatsapp',
        to: '+14155550100',
        body: 'Your bonus is ready',
      }),
    );
  });
});
