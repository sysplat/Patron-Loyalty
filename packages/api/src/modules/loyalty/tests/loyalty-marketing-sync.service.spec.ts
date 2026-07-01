import { LoyaltyMarketingSyncService } from '../loyalty-marketing-sync.service';
import { LOYALTY_MARKETING_PROVIDERS } from '@queueplatform/shared';
import { Logger } from '@nestjs/common';

describe('LoyaltyMarketingSyncService', () => {
  let service: LoyaltyMarketingSyncService;
  let prismaMock: any;
  let connectionMock: any;
  let klaviyoMock: any;
  let mailchimpMock: any;

  beforeEach(() => {
    prismaMock = {
      withTenant: async (orgId: string, fn: any) => fn(prismaMock),
      loyaltyAccount: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
    };
    connectionMock = {
      getActiveConnections: vi.fn().mockResolvedValue([]),
      decryptApiKey: vi.fn().mockReturnValue('decrypted-key'),
      touchSyncedAt: vi.fn().mockResolvedValue(true),
    };
    klaviyoMock = {
      upsertProfile: vi.fn().mockResolvedValue(true),
    };
    mailchimpMock = {
      upsertMember: vi.fn().mockResolvedValue(true),
    };

    service = new LoyaltyMarketingSyncService(
      prismaMock as any,
      connectionMock as any,
      klaviyoMock as any,
      mailchimpMock as any,
    );
    // Suppress logs in tests
    service['logger'] = { warn: vi.fn(), log: vi.fn(), error: console.error } as unknown as Logger;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('syncProfile', () => {
    it('should bail if no active connections', async () => {
      connectionMock.getActiveConnections.mockResolvedValue([]);
      prismaMock.loyaltyAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        customer: { email: 'test@test.com' },
      });

      await service.syncProfile('org-1', 'customer-1');
      expect(klaviyoMock.upsertProfile).not.toHaveBeenCalled();
    });

    it('should dispatch to all active providers', async () => {
      connectionMock.getActiveConnections.mockResolvedValue([
        { provider: LOYALTY_MARKETING_PROVIDERS.KLAVIYO, credentials: {}, config: {} },
        {
          provider: LOYALTY_MARKETING_PROVIDERS.MAILCHIMP,
          credentials: {},
          config: { listId: 'l1', serverPrefix: 'us1' },
        },
      ]);
      prismaMock.loyaltyAccount.findFirst.mockResolvedValue({
        id: 'acc-1',
        pointsBalance: 100,
        customer: { email: 'test@test.com', name: 'John Doe' },
      });

      await service.syncProfile('org-1', 'customer-1');

      expect(klaviyoMock.upsertProfile).toHaveBeenCalled();
      expect(mailchimpMock.upsertMember).toHaveBeenCalled();
    });
  });
});
