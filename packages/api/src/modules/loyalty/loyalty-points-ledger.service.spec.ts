import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { LOYALTY_POINT_LEDGER_TYPES } from '@queueplatform/shared';
import { LoyaltyPointsLedgerService } from './loyalty-points-ledger.service';

const ORG_ID = 'org-1';
const ACCOUNT_ID = 'acct-1';

describe('LoyaltyPointsLedgerService', () => {
  const metrics = { resolveTierForPoints: vi.fn(), refreshHealthScore: vi.fn() };
  const prisma = { withTenant: vi.fn() };
  let service: LoyaltyPointsLedgerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyPointsLedgerService(prisma as never, metrics as never);
  });

  it('returns idempotent result when earn ledger already exists', async () => {
    const tx = {
      loyaltyPointLedger: {
        findFirst: vi.fn().mockResolvedValue({ points: 10 }),
      },
      loyaltyAccount: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: ACCOUNT_ID,
          tier: null,
          customer: { id: 'cust-1', name: 'Patron' },
        }),
      },
    };

    const result = await service.applyPointsInTransaction(
      tx as never,
      ORG_ID,
      ACCOUNT_ID,
      10,
      LOYALTY_POINT_LEDGER_TYPES.EARN,
      { sourceType: 'ticket', sourceId: 't-1' },
    );

    expect(result.idempotent).toBe(true);
    expect(result.delta).toBe(0);
  });

  it('throws when burn exceeds balance', async () => {
    const tx = {
      loyaltyPointLedger: { findFirst: vi.fn().mockResolvedValue(null) },
      loyaltyAccount: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    await expect(
      service.applyPointsInTransaction(
        tx as never,
        ORG_ID,
        ACCOUNT_ID,
        50,
        LOYALTY_POINT_LEDGER_TYPES.BURN,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
