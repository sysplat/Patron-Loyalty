import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyAccountsController } from './loyalty-accounts.controller';

const ORG_ID = '00000000-0000-0000-0000-000000000099';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000001';
const USER = { orgId: ORG_ID } as never;

describe('LoyaltyAccountsController', () => {
  const accounts = {
    lookupPatronByPhone: vi.fn(),
    getAccountWithLedger: vi.fn(),
    exportPatronDsar: vi.fn(),
    adjustPoints: vi.fn(),
  };
  const gamification = { getLeaderboard: vi.fn() };
  const customerUpdate = vi.fn();
  const prisma = {
    withTenant: vi.fn((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ customer: { update: customerUpdate } }),
    ),
  };
  let controller: LoyaltyAccountsController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyAccountsController(
      accounts as never,
      gamification as never,
      prisma as never,
    );
  });

  it('looks up patron by phone', async () => {
    accounts.lookupPatronByPhone.mockResolvedValue({ customerId: CUSTOMER_ID });
    await controller.lookupPatron(USER, '+15551234567');
    expect(accounts.lookupPatronByPhone).toHaveBeenCalledWith(ORG_ID, '+15551234567');
  });

  it('gets leaderboard with default limit', async () => {
    gamification.getLeaderboard.mockResolvedValue([]);
    await controller.getLeaderboard(USER);
    expect(gamification.getLeaderboard).toHaveBeenCalledWith(ORG_ID, 20);
  });

  it('gets leaderboard with custom limit', async () => {
    await controller.getLeaderboard(USER, '5');
    expect(gamification.getLeaderboard).toHaveBeenCalledWith(ORG_ID, 5);
  });

  it('gets account with ledger', async () => {
    accounts.getAccountWithLedger.mockResolvedValue({ pointsBalance: 100 });
    await controller.getAccount(USER, CUSTOMER_ID);
    expect(accounts.getAccountWithLedger).toHaveBeenCalledWith(ORG_ID, CUSTOMER_ID);
  });

  it('exports DSAR package', async () => {
    accounts.exportPatronDsar.mockResolvedValue({ customer: {} });
    await controller.exportPatronDsar(USER, CUSTOMER_ID);
    expect(accounts.exportPatronDsar).toHaveBeenCalledWith(ORG_ID, CUSTOMER_ID);
  });

  it('updates profile via tenant prisma', async () => {
    customerUpdate.mockResolvedValue({ id: CUSTOMER_ID });
    await controller.updateProfile(USER, CUSTOMER_ID, {
      name: 'Patron',
      birthday: '1990-01-15',
    } as never);
    expect(prisma.withTenant).toHaveBeenCalledWith(ORG_ID, expect.any(Function));
    expect(customerUpdate).toHaveBeenCalledWith({
      where: { id: CUSTOMER_ID },
      data: expect.objectContaining({
        name: 'Patron',
        birthday: new Date('1990-01-15'),
      }),
    });
  });

  it('adjusts points for customer', async () => {
    accounts.adjustPoints.mockResolvedValue({ pointsBalance: 150 });
    await controller.adjustPoints(USER, CUSTOMER_ID, {
      points: 50,
      description: 'Manual bonus',
    } as never);
    expect(accounts.adjustPoints).toHaveBeenCalledWith(ORG_ID, CUSTOMER_ID, 50, 'Manual bonus');
  });
});
