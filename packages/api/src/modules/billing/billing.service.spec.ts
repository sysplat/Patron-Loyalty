import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingService } from './billing.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';

// ─── Stripe mock (must be before the module is imported the first time) ──────
vi.mock('stripe', () => {
  const StripeClass = vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: vi
          .fn()
          .mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.com/test' }),
      },
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  }));
  return { default: StripeClass };
});

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  plan: { findMany: vi.fn(), findUnique: vi.fn() },
  organization: {
    findUnique: vi.fn().mockResolvedValue({ stripeCustomerId: null }),
    update: vi.fn().mockResolvedValue({}),
  },
  subscription: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  invoice: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
  paymentRecord: { create: vi.fn() },
  branch: { count: vi.fn().mockResolvedValue(0) },
  user: { count: vi.fn().mockResolvedValue(0) },
  ticket: { count: vi.fn().mockResolvedValue(0) },
};

const mockAudit = {
  logActivity: vi.fn().mockResolvedValue(undefined),
  logAudit: vi.fn().mockResolvedValue(undefined),
};

const mockConfig = {
  get: vi.fn((key: string): string | undefined => {
    if (key === 'app.stripe.secretKey') return 'sk_test_mock';
    if (key === 'app.stripe.webhookSecret') return 'whsec_mock';
    return undefined;
  }),
};

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(undefined),
};

const mockSmsCreditPurchases = {
  getSmsCreditsAllowance: vi
    .fn()
    .mockResolvedValue({ planBase: 300, purchasedBonus: 0, effectiveLimit: 300 }),
  resolvePackMessages: vi.fn((pack: { messages: number }) => pack.messages),
};

const mockSmsUsage = {
  getUsedCount: vi.fn().mockResolvedValue(0),
};

const mockProductEntitlements = {
  syncLoyaltyFromPlanLimits: vi.fn().mockResolvedValue(undefined),
  enableLoyalty: vi.fn().mockResolvedValue({ patronCrmEnabled: true, productSku: 'bundle' }),
};

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantIsolationMocks(mockPrisma);
    service = new BillingService(
      mockPrisma as any,
      mockAudit as any,
      mockConfig as any,
      mockRedis as any,
      mockSmsCreditPurchases as any,
      mockSmsUsage as any,
      mockProductEntitlements as any,
    );
  });

  // ── listPlans ─────────────────────────────────────────────────────────────

  describe('listPlans', () => {
    it('returns active plans sorted by price', async () => {
      const plans = [{ id: 'plan-1', priceMonthly: 0 }];
      mockPrisma.plan.findMany.mockResolvedValue(plans);

      const result = await service.listPlans();

      expect(result).toEqual(plans);
      expect(mockPrisma.plan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });
  });

  // ── getSubscription ───────────────────────────────────────────────────────

  describe('getSubscription', () => {
    it('throws NotFoundException when no active subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.getSubscription('org-1')).rejects.toThrow(NotFoundException);
    });

    it('returns subscription with usage stats', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        plan: {
          slug: 'professional',
          limits: { maxBranches: 5, maxUsers: 20, maxTicketsPerMonth: 1000 },
        },
      });
      mockPrisma.branch.count.mockResolvedValue(2);
      mockPrisma.user.count.mockResolvedValue(5);
      mockPrisma.ticket.count.mockResolvedValue(100);

      const result = await service.getSubscription('org-1');

      expect(result.usage.branches.current).toBe(2);
      expect(result.usage.users.limit).toBe(20);
    });
  });

  // ── cancelSubscription ────────────────────────────────────────────────────

  describe('cancelSubscription', () => {
    it('throws NotFoundException when no active subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.cancelSubscription('org-1')).rejects.toThrow(NotFoundException);
    });

    it('cancels an active subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({ id: 'sub-1' });
      mockPrisma.subscription.update.mockResolvedValue({ id: 'sub-1', status: 'cancelled' });

      const result = await service.cancelSubscription('org-1');

      expect(result.status).toBe('cancelled');
    });
  });

  // ── listInvoices ──────────────────────────────────────────────────────────

  describe('listInvoices', () => {
    it('returns paginated invoices', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([{ id: 'inv-1' }]);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await service.listInvoices('org-1', 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  // ── createCheckoutSession ─────────────────────────────────────────────────

  describe('createCheckoutSession', () => {
    it('throws NotFoundException when plan not found', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.createCheckoutSession('org-1', 'plan-x', 'http://success', 'http://cancel'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when Stripe secret key is not configured', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue({
        id: 'plan-1',
        name: 'Pro',
        priceMonthly: 49,
        stripePriceIdMonthly: null,
        stripePriceIdYearly: null,
      });
      mockConfig.get.mockReturnValueOnce(''); // secretKey = ''

      await expect(
        service.createCheckoutSession('org-1', 'plan-1', 'http://success', 'http://cancel'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── handleStripeWebhook ───────────────────────────────────────────────────

  describe('handleStripeWebhook', () => {
    it('throws BadRequestException when webhook secret not configured', async () => {
      mockConfig.get.mockImplementationOnce((key: string) => {
        if (key === 'app.stripe.secretKey') return 'sk_test_mock';
        if (key === 'app.stripe.webhookSecret') return ''; // not set
        return undefined;
      });

      await expect(service.handleStripeWebhook(Buffer.from('{}'), 'sig')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
