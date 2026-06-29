import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { LOYALTY_EARN_EVENT_TYPES, LOYALTY_POINT_LEDGER_TYPES } from '@queueplatform/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LoyaltyIntegrationService } from './loyalty-integration.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import { CustomerService } from '../customer/customer.service';
import { LoyaltyAccountService } from './loyalty-account.service';
import { LoyaltyCatalogService } from './loyalty-catalog.service';
import { LoyaltyProgramService } from './loyalty-program.service';
import { LoyaltyWalletService } from './loyalty-wallet.service';

const integrationDbUrl = process.env.INTEGRATION_DATABASE_URL ?? process.env.TEST_DATABASE_URL;

describe.skipIf(!integrationDbUrl)('LoyaltyIntegrationService (DB golden path)', () => {
  let prisma: PrismaService;
  let integration: LoyaltyIntegrationService;
  let accounts: {
    ensureAccount: ReturnType<typeof vi.fn>;
    earnIntegrationPoints: ReturnType<typeof vi.fn>;
    getAccountByCustomerId: ReturnType<typeof vi.fn>;
  };
  let orgId: string;
  let customerId: string;
  let accountId: string;
  let externalId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = integrationDbUrl!;

    const patronCrmFeature = {
      requireEnabled: vi.fn().mockResolvedValue(undefined),
      isEnabled: vi.fn().mockResolvedValue(true),
    };
    const programService = {
      resolveEarnPoints: vi.fn().mockResolvedValue(25),
    };
    accounts = {
      ensureAccount: vi.fn(),
      earnIntegrationPoints: vi.fn(),
      getAccountByCustomerId: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        PrismaService,
        LoyaltyIntegrationService,
        { provide: PatronCrmFeatureService, useValue: patronCrmFeature },
        { provide: CustomerService, useValue: { create: vi.fn() } },
        { provide: LoyaltyAccountService, useValue: accounts },
        { provide: LoyaltyCatalogService, useValue: {} },
        { provide: LoyaltyProgramService, useValue: programService },
        { provide: LoyaltyWalletService, useValue: {} },
      ],
    }).compile();

    prisma = module.get(PrismaService);
    integration = module.get(LoyaltyIntegrationService);
    await prisma.onModuleInit();

    const suffix = Date.now().toString();
    externalId = `qlessq-golden-${suffix}`;
    const org = await prisma.organization.create({
      data: {
        name: 'Integration Test Org',
        slug: `int-org-${suffix}`,
        patronCrmEnabled: true,
      },
    });
    orgId = org.id;

    const customer = (await prisma.withTenant(orgId, (tx) =>
      tx.customer.create({
        data: {
          orgId,
          name: 'Golden Path Patron',
          externalId,
          email: `golden+${suffix}@example.com`,
        },
      }),
    )) as { id: string };
    customerId = customer.id;

    const account = (await prisma.withTenant(orgId, (tx) =>
      tx.loyaltyAccount.create({
        data: {
          orgId,
          customerId,
          pointsBalance: 0,
          lifetimePointsEarned: 0,
          lifetimePointsBurned: 0,
          totalVisits: 0,
        },
      }),
    )) as { id: string };
    accountId = account.id;

    accounts.ensureAccount.mockResolvedValue({
      id: accountId,
      pointsBalance: 0,
      referralCode: 'REF-GOLDEN',
    });
  }, 60_000);

  afterAll(async () => {
    if (prisma) await prisma.onModuleDestroy();
  });

  it('returns idempotent earn when integration ledger row already exists', async () => {
    const externalTxnId = `txn-golden-${Date.now()}`;
    await prisma.withTenant(orgId, (tx) =>
      tx.loyaltyPointLedger.create({
        data: {
          orgId,
          accountId,
          type: LOYALTY_POINT_LEDGER_TYPES.EARN,
          points: 25,
          balanceAfter: 25,
          sourceType: 'integration',
          sourceId: externalTxnId,
        },
      }),
    );

    const result = await integration.earnPoints(orgId, {
      customerId,
      eventType: LOYALTY_EARN_EVENT_TYPES.MANUAL,
      externalTxnId,
      points: 25,
    });

    expect(result).toEqual({
      idempotent: true,
      accountId,
      points: 25,
    });
  });

  it('looks up patron by external_id column via integration service', async () => {
    const result = await integration.lookupCustomer(orgId, { externalId });

    expect(result).toMatchObject({
      customerId,
      name: 'Golden Path Patron',
      accountId,
      pointsBalance: 0,
      referralCode: 'REF-GOLDEN',
    });
  });
});
