import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { SmsUsageService } from './sms-usage.service';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  notification: {
    count: vi.fn(),
  },
};

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
};

describe('SmsUsageService', () => {
  let service: SmsUsageService;

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantIsolationMocks(mockPrisma);
    service = new SmsUsageService(mockPrisma as any, mockRedis as any);
  });

  describe('getUsedCount', () => {
    it('returns DB count and seeds redis when cache is empty', async () => {
      mockPrisma.notification.count.mockResolvedValueOnce(42);
      mockRedis.get.mockResolvedValue(null);

      const used = await service.getUsedCount('org-1');

      expect(used).toBe(42);
      expect(mockRedis.set).toHaveBeenCalledWith('sms:credits:used:lifetime:org-1', '42');
    });

    it('returns cache value without querying DB when cache is populated', async () => {
      mockRedis.get.mockResolvedValue('359');

      const used = await service.getUsedCount('org-1');

      expect(used).toBe(359);
      expect(mockPrisma.notification.count).not.toHaveBeenCalled();
    });
  });

  describe('assertSmsCreditsAvailable', () => {
    it('throws when used plus pending meets the limit', async () => {
      mockRedis.get.mockResolvedValue('300'); // used
      mockPrisma.notification.count.mockResolvedValueOnce(0); // pending

      await expect(service.assertSmsCreditsAvailable('org-1', 300)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when pending messages would exceed the limit', async () => {
      mockRedis.get.mockResolvedValue('295'); // used
      mockPrisma.notification.count.mockResolvedValueOnce(5); // pending

      await expect(service.assertSmsCreditsAvailable('org-1', 300)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows send when headroom remains', async () => {
      mockRedis.get.mockResolvedValue('100'); // used
      mockPrisma.notification.count.mockResolvedValueOnce(2); // pending

      await expect(service.assertSmsCreditsAvailable('org-1', 300)).resolves.toEqual({
        used: 100,
        pending: 2,
      });
    });
  });
});
