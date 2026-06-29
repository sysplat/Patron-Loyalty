import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { LoyaltyAccountDsarService } from './loyalty-account-dsar.service';

const ORG_ID = 'org-1';
const CUSTOMER_ID = 'cust-1';

describe('LoyaltyAccountDsarService', () => {
  const patronCrmFeature = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
  const prisma = { withTenant: vi.fn() };
  let service: LoyaltyAccountDsarService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyAccountDsarService(prisma as never, patronCrmFeature as never);
  });

  it('throws when customer not found', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        customer: { findFirst: vi.fn().mockResolvedValue(null) },
      }),
    );
    await expect(service.exportPatronDsar(ORG_ID, CUSTOMER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('exports DSAR package with loyalty and CRM data', async () => {
    let callCount = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      callCount += 1;
      if (callCount === 1) {
        return fn({
          customer: {
            findFirst: vi.fn().mockResolvedValue({ id: CUSTOMER_ID, name: 'Patron' }),
          },
        });
      }
      if (callCount === 2) {
        return fn({
          loyaltyAccount: {
            findUnique: vi.fn().mockResolvedValue({ id: 'acct-1', pointsBalance: 100 }),
          },
        });
      }
      return fn({
        loyaltyPointLedger: { findMany: vi.fn().mockResolvedValue([]) },
        loyaltyRedemption: { findMany: vi.fn().mockResolvedValue([]) },
        loyaltyReferral: { findMany: vi.fn().mockResolvedValue([]) },
        crmTask: { findMany: vi.fn().mockResolvedValue([]) },
        crmSupportTicket: { findMany: vi.fn().mockResolvedValue([]) },
        crmSalesOpportunity: { findMany: vi.fn().mockResolvedValue([]) },
        consentLedgerEntry: { findMany: vi.fn().mockResolvedValue([]) },
        loyaltyPatronGamePlay: { findMany: vi.fn().mockResolvedValue([]) },
      });
    });

    const pkg = await service.exportPatronDsar(ORG_ID, CUSTOMER_ID);

    expect(pkg.customer).toMatchObject({ id: CUSTOMER_ID });
    expect(pkg.loyaltyAccount).toMatchObject({ id: 'acct-1' });
    expect(pkg.exportedAt).toBeDefined();
  });
});
