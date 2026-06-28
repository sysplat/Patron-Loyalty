import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { LoyaltyAccountService } from './loyalty-account.service';

describe('LoyaltyAccountService lookupPatronByPhone', () => {
  const patronCrmFeature = {
    requireEnabled: vi.fn().mockResolvedValue(undefined),
    isEnabled: vi.fn().mockResolvedValue(true),
  };
  const programService = {
    getOrCreateProgram: vi.fn(),
    generateUniqueReferralCode: vi.fn(),
  };
  const eventEmitter = { emit: vi.fn() };
  const loyaltyWebhook = { dispatch: vi.fn() };
  const prisma = { withTenant: vi.fn() };

  let service: LoyaltyAccountService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyAccountService(
      prisma as never,
      patronCrmFeature as never,
      programService as never,
      eventEmitter as never,
      loyaltyWebhook as never,
    );
  });

  it('rejects phone numbers with fewer than 10 digits', async () => {
    await expect(service.lookupPatronByPhone('org-1', '12345')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(patronCrmFeature.requireEnabled).toHaveBeenCalledWith('org-1');
  });

  it('returns found false when no customer matches', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        customer: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );

    const result = await service.lookupPatronByPhone('org-1', '+1 (555) 123-4567');
    expect(result).toEqual({ found: false });
  });
});
