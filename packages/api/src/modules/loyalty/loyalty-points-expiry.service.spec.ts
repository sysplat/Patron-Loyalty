import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyPointsExpiryService } from './loyalty-points-expiry.service';

const ORG_ID = 'org-1';

describe('LoyaltyPointsExpiryService', () => {
  const patronCrmFeature = { isEnabled: vi.fn() };
  const accounts = { expireInactivePoints: vi.fn() };
  const prisma = { withTenant: vi.fn() };
  let service: LoyaltyPointsExpiryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyPointsExpiryService(
      prisma as never,
      patronCrmFeature as never,
      accounts as never,
    );
  });

  it('returns 0 when loyalty is disabled', async () => {
    patronCrmFeature.isEnabled.mockResolvedValue(false);
    expect(await service.expireForOrg(ORG_ID)).toBe(0);
    expect(prisma.withTenant).not.toHaveBeenCalled();
  });

  it('returns 0 when program has no expiry days', async () => {
    patronCrmFeature.isEnabled.mockResolvedValue(true);
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyProgram: {
          findUnique: vi.fn().mockResolvedValue({ enabled: true, pointsExpiryDays: null }),
        },
      }),
    );
    expect(await service.expireForOrg(ORG_ID)).toBe(0);
  });

  it('expires inactive points when program configured', async () => {
    patronCrmFeature.isEnabled.mockResolvedValue(true);
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyProgram: {
          findUnique: vi.fn().mockResolvedValue({ enabled: true, pointsExpiryDays: 365 }),
        },
      }),
    );
    accounts.expireInactivePoints.mockResolvedValue(3);
    expect(await service.expireForOrg(ORG_ID)).toBe(3);
    expect(accounts.expireInactivePoints).toHaveBeenCalledWith(ORG_ID, 365);
  });
});
