import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LoyaltyAccountLifecycleService } from './loyalty-account-lifecycle.service';

const ORG_ID = 'org-1';
const CUSTOMER_ID = 'cust-1';

describe('LoyaltyAccountLifecycleService', () => {
  const patronCrmFeature = {
    isEnabled: vi.fn(),
    requireEnabled: vi.fn().mockResolvedValue(undefined),
  };
  const programService = {
    getOrCreateProgram: vi.fn().mockResolvedValue({}),
    generateUniqueReferralCode: vi.fn().mockResolvedValue('REF123'),
  };
  const prisma = { withTenant: vi.fn() };
  let service: LoyaltyAccountLifecycleService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyAccountLifecycleService(
      prisma as never,
      patronCrmFeature as never,
      programService as never,
    );
  });

  it('returns null when loyalty disabled', async () => {
    patronCrmFeature.isEnabled.mockResolvedValue(false);
    expect(await service.ensureAccount(ORG_ID, CUSTOMER_ID)).toBeNull();
  });

  it('returns existing account without creating', async () => {
    patronCrmFeature.isEnabled.mockResolvedValue(true);
    const existing = { id: 'acct-1', customerId: CUSTOMER_ID };
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          findUnique: vi.fn().mockResolvedValue(existing),
        },
      }),
    );
    expect(await service.ensureAccount(ORG_ID, CUSTOMER_ID)).toEqual(existing);
  });

  it('rejects invalid phone lookup', async () => {
    await expect(service.lookupPatronByPhone(ORG_ID, '123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns not found for unknown phone', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        customer: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );
    expect(await service.lookupPatronByPhone(ORG_ID, '+15551234567')).toEqual({ found: false });
  });

  it('throws when account missing for getAccountByCustomerId', async () => {
    patronCrmFeature.isEnabled.mockResolvedValue(false);
    await expect(service.getAccountByCustomerId(ORG_ID, CUSTOMER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
