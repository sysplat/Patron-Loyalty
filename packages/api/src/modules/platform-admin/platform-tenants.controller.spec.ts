import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformTenantsController } from './platform-tenants.controller';
import { PlatformOperatorGuard } from '../support/platform-operator.guard';
import { NotFoundException } from '@nestjs/common';

describe('PlatformTenantsController', () => {
  let controller: PlatformTenantsController;
  let mockPrisma: any;
  let mockAudit: any;
  let mockPlanLimits: any;
  let mockConfig: any;

  beforeEach(() => {
    mockPrisma = {
      organization: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      subscription: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      plan: {
        findUnique: vi.fn(),
      },
    };

    mockAudit = {
      log: vi.fn(),
    };

    mockPlanLimits = {
      invalidateLimitsCache: vi.fn(),
    };

    mockConfig = {
      get: vi.fn(),
    };

    const mockRedis = {
      del: vi.fn(),
    };

    const mockPatronCrmFeature = {
      isEnabled: vi.fn().mockResolvedValue(false),
      invalidateCache: vi.fn(),
    };

    controller = new PlatformTenantsController(
      mockPrisma,
      mockAudit,
      mockPlanLimits,
      mockPatronCrmFeature as any,
      mockConfig,
      mockRedis as any,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('RBAC Guard', () => {
    it('should use PlatformOperatorGuard', () => {
      const guards = Reflect.getMetadata('__guards__', PlatformTenantsController);
      expect(guards).toBeDefined();
      expect(guards[0]).toBe(PlatformOperatorGuard);
    });
  });

  describe('getTenantDetails', () => {
    it('should throw NotFoundException if org does not exist', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      await expect(controller.getTenantDetails('invalid-id')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'invalid-id' },
        include: expect.any(Object),
      });
    });

    it('should return org details if found', async () => {
      const mockOrg = { id: 'org-1', name: 'Test Org' };
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      const result = await controller.getTenantDetails('org-1');
      expect(result).toEqual({ success: true, data: mockOrg });
    });
  });
});
