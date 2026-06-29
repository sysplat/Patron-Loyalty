import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PRODUCT_SKUS } from '@queueplatform/shared';
import { LoyaltyActivationService } from './loyalty-activation.service';

const ORG_ID = 'org-1';

describe('LoyaltyActivationService', () => {
  const prisma = {
    organization: { findUniqueOrThrow: vi.fn() },
    withTenant: vi.fn(),
    plan: { findUnique: vi.fn() },
  };
  const patronCrmFeature = { invalidateCache: vi.fn() };
  const entitlements = { enableLoyalty: vi.fn() };
  const billing = { createLoyaltyAddonCheckoutSession: vi.fn() };
  const program = { getOrCreateProgram: vi.fn() };
  let service: LoyaltyActivationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyActivationService(
      prisma as never,
      patronCrmFeature as never,
      entitlements as never,
      billing as never,
      program as never,
    );
  });

  it('returns activation status for org without loyalty', async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      productSku: PRODUCT_SKUS.QUEUE,
      patronCrmEnabled: false,
      name: 'Cafe',
    });
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ setting: { findFirst: vi.fn().mockResolvedValue(null) } }),
    );
    prisma.plan.findUnique.mockResolvedValue({ id: 'plan-1', slug: 'loyalty-addon' });

    const status = await service.getStatus(ORG_ID);

    expect(status.hasLoyaltyProduct).toBe(false);
    expect(status.canActivateTrial).toBe(true);
  });

  it('rejects trial when loyalty already active', async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      productSku: PRODUCT_SKUS.LOYALTY,
      patronCrmEnabled: true,
      name: 'Cafe',
    });
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ setting: { findFirst: vi.fn().mockResolvedValue(null) } }),
    );
    prisma.plan.findUnique.mockResolvedValue(null);

    await expect(service.startTrial(ORG_ID)).rejects.toBeInstanceOf(BadRequestException);
  });
});
