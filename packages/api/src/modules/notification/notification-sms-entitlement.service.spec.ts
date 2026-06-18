import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { NotificationSmsEntitlementService } from './notification-sms-entitlement.service';

describe('NotificationSmsEntitlementService', () => {
  const mockPlanLimits = {
    requireFeature: vi.fn(),
    getSmsCreditsAllowance: vi.fn(),
  };
  const mockSmsUsage = {
    assertSmsCreditsAvailable: vi.fn(),
    syncUsageCacheFromDb: vi.fn(),
    getUsedCount: vi.fn(),
  };

  let service: NotificationSmsEntitlementService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPlanLimits.getSmsCreditsAllowance.mockResolvedValue({
      planBase: 100,
      purchasedBonus: 0,
      effectiveLimit: 100,
    });
    mockSmsUsage.getUsedCount.mockResolvedValue(90);
    mockSmsUsage.syncUsageCacheFromDb.mockResolvedValue(90);
    service = new NotificationSmsEntitlementService(mockPlanLimits as never, mockSmsUsage as never);
  });

  it('skips plan gate when requested', async () => {
    await service.assertCanSendSms('org-1', { skipPlanGate: true });
    expect(mockPlanLimits.requireFeature).not.toHaveBeenCalled();
  });

  it('enforces plan feature and credit availability for gated sends', async () => {
    await service.assertCanSendSms('org-1');
    expect(mockPlanLimits.requireFeature).toHaveBeenCalledWith(
      'org-1',
      'hasSmsNotifications',
      expect.any(String),
    );
    expect(mockSmsUsage.assertSmsCreditsAvailable).toHaveBeenCalledWith('org-1', 100);
  });

  it('propagates plan limit failures', async () => {
    mockPlanLimits.requireFeature.mockRejectedValue(new BadRequestException('upgrade required'));
    await expect(service.assertCanSendSms('org-1')).rejects.toThrow(/upgrade required/);
  });

  it('flags ninety-percent usage threshold after delivery', async () => {
    const snapshot = await service.snapshotUsageAfterDelivery('org-1');
    expect(snapshot.atNinetyPercentThreshold).toBe(true);
    expect(snapshot.effectiveLimit).toBe(100);
    expect(snapshot.used).toBe(90);
  });
});
