import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_CAMPAIGN_CHANNELS } from '@queueplatform/shared';
import { LoyaltyCampaignDispatchService } from './loyalty-campaign-dispatch.service';

const ORG_ID = 'org-1';
const CAMPAIGN_ID = 'camp-1';
const ACCOUNT_ID = 'acct-1';

describe('LoyaltyCampaignDispatchService', () => {
  const notifications = { send: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  let service: LoyaltyCampaignDispatchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyCampaignDispatchService(prisma as never, notifications as never);
  });

  it('returns zeros when campaign not found', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyCampaign: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );

    const result = await service.dispatchCampaign(ORG_ID, CAMPAIGN_ID);
    expect(result).toEqual({ sent: 0, skipped: 0, failed: 0 });
  });

  it('skips sendToAccount when campaign inactive', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyCampaign: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );

    expect(await service.sendToAccount(ORG_ID, CAMPAIGN_ID, ACCOUNT_ID)).toBe('skipped');
  });

  it('dispatches queued sends and marks campaign completed', async () => {
    const update = vi.fn().mockResolvedValue({});
    let callCount = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      callCount += 1;
      if (callCount === 1) {
        return fn({
          loyaltyCampaign: {
            findFirst: vi.fn().mockResolvedValue({
              id: CAMPAIGN_ID,
              channel: 'sms',
              body: 'Hello',
              subject: null,
              name: 'Promo',
            }),
          },
        });
      }
      if (callCount === 2) {
        return fn({
          loyaltyCampaignSend: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        });
      }
      if (callCount === 3) {
        return fn({
          loyaltyCampaignSend: { count: vi.fn().mockResolvedValue(0) },
        });
      }
      return fn({ loyaltyCampaign: { update } });
    });

    const result = await service.dispatchCampaign(ORG_ID, CAMPAIGN_ID);
    expect(result).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(update).toHaveBeenCalled();
  });

  it('sendToAccount marks IN_APP channel as sent', async () => {
    const sendUpdate = vi.fn().mockResolvedValue({});
    const sendUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const campaignUpdate = vi.fn().mockResolvedValue({});
    let callCount = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      callCount += 1;
      if (callCount === 1) {
        return fn({
          loyaltyCampaign: {
            findFirst: vi.fn().mockResolvedValue({
              id: CAMPAIGN_ID,
              channel: LOYALTY_CAMPAIGN_CHANNELS.IN_APP,
              body: 'Hello',
              subject: null,
              name: 'In-app',
            }),
          },
        });
      }
      if (callCount === 2) {
        return fn({
          loyaltyAccount: {
            findFirst: vi.fn().mockResolvedValue({
              id: ACCOUNT_ID,
              customer: {
                id: 'cust-1',
                name: 'Patron',
                phone: null,
                email: null,
                marketingSmsConsent: 'REVOKED',
                marketingEmailConsent: 'REVOKED',
              },
            }),
          },
        });
      }
      if (callCount === 3) {
        return fn({
          loyaltyCampaignSend: {
            create: vi.fn().mockResolvedValue({ id: 'send-1' }),
          },
        });
      }
      if (callCount === 4) {
        return fn({ loyaltyCampaignSend: { updateMany: sendUpdateMany } });
      }
      if (callCount === 5) {
        return fn({ loyaltyCampaignSend: { update: sendUpdate } });
      }
      return fn({ loyaltyCampaign: { update: campaignUpdate } });
    });

    expect(await service.sendToAccount(ORG_ID, CAMPAIGN_ID, ACCOUNT_ID)).toBe('sent');
    expect(notifications.send).not.toHaveBeenCalled();
    expect(campaignUpdate).toHaveBeenCalled();
  });

  it('sendToAccount skips SMS when marketing consent missing', async () => {
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
        ) => Promise<'sent' | 'skipped' | 'queued'>;
      }
    ).dispatchOne.bind(service);

    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyCampaignSend: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: vi.fn().mockResolvedValue({}),
        },
      }),
    );

    const result = await dispatchOne(
      ORG_ID,
      {
        id: CAMPAIGN_ID,
        channel: LOYALTY_CAMPAIGN_CHANNELS.SMS,
        subject: 'Promo',
        body: 'Save today',
        name: 'SMS',
      },
      'send-1',
      {
        id: 'cust-1',
        name: 'Patron',
        phone: '+14155550100',
        email: null,
        marketingSmsConsent: 'REVOKED',
        marketingEmailConsent: 'REVOKED',
      },
    );

    expect(result).toBe('skipped');
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('sendToAccount queues SMS without marking sent on enqueue', async () => {
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
        ) => Promise<'sent' | 'skipped' | 'queued'>;
      }
    ).dispatchOne.bind(service);

    const sendUpdate = vi.fn();
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyCampaignSend: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: sendUpdate,
        },
      }),
    );

    const result = await dispatchOne(
      ORG_ID,
      {
        id: CAMPAIGN_ID,
        channel: LOYALTY_CAMPAIGN_CHANNELS.SMS,
        subject: 'Promo',
        body: 'Save today',
        name: 'SMS',
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

    expect(result).toBe('queued');
    expect(notifications.send).toHaveBeenCalledOnce();
    expect(sendUpdate).not.toHaveBeenCalled();
  });

  it('dispatchOne skips push as not configured', async () => {
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
        ) => Promise<'sent' | 'skipped' | 'queued'>;
      }
    ).dispatchOne.bind(service);

    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyCampaignSend: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: vi.fn().mockResolvedValue({}),
        },
      }),
    );

    const result = await dispatchOne(
      ORG_ID,
      {
        id: CAMPAIGN_ID,
        channel: LOYALTY_CAMPAIGN_CHANNELS.PUSH,
        subject: null,
        body: 'Hi',
        name: 'Push',
      },
      'send-1',
      {
        id: 'cust-1',
        name: 'Patron',
        phone: null,
        email: null,
        marketingSmsConsent: 'GRANTED',
        marketingEmailConsent: 'GRANTED',
      },
    );

    expect(result).toBe('skipped');
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('dispatchCampaign processes queued IN_APP send', async () => {
    const sendUpdate = vi.fn().mockResolvedValue({});
    const sendUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    let callCount = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      callCount += 1;
      if (callCount === 1) {
        return fn({
          loyaltyCampaign: {
            findFirst: vi.fn().mockResolvedValue({
              id: CAMPAIGN_ID,
              channel: LOYALTY_CAMPAIGN_CHANNELS.IN_APP,
              body: 'Hi',
              subject: null,
              name: 'Promo',
            }),
          },
        });
      }
      if (callCount === 2) {
        return fn({
          loyaltyCampaignSend: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: 'send-1',
                account: {
                  customer: {
                    id: 'cust-1',
                    name: 'Patron',
                    phone: null,
                    email: null,
                    marketingSmsConsent: 'REVOKED',
                    marketingEmailConsent: 'REVOKED',
                    transactionalSmsAllowed: true,
                  },
                },
              },
            ]),
          },
        });
      }
      if (callCount === 3) {
        return fn({ loyaltyCampaignSend: { updateMany: sendUpdateMany } });
      }
      if (callCount === 4) {
        return fn({ loyaltyCampaignSend: { update: sendUpdate } });
      }
      if (callCount === 5) {
        return fn({
          loyaltyCampaignSend: { count: vi.fn().mockResolvedValue(0) },
        });
      }
      return fn({
        loyaltyCampaign: { update: vi.fn().mockResolvedValue({}) },
      });
    });

    const result = await service.dispatchCampaign(ORG_ID, CAMPAIGN_ID);
    expect(result).toEqual({ sent: 1, skipped: 0, failed: 0 });
  });
});
