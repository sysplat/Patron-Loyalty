import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyWalletController } from './loyalty-wallet.controller';

const ORG_ID = '00000000-0000-0000-0000-000000000099';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000001';
const USER = { orgId: ORG_ID } as never;

describe('LoyaltyWalletController', () => {
  const wallet = {
    getWallet: vi.fn(),
    adjustWallet: vi.fn(),
    listGiftCards: vi.fn(),
    createGiftCard: vi.fn(),
  };
  let controller: LoyaltyWalletController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyWalletController(wallet as never);
  });

  it('gets wallet for customer', async () => {
    wallet.getWallet.mockResolvedValue({ balanceCents: 1000 });
    await expect(controller.getWallet(USER, CUSTOMER_ID)).resolves.toEqual({ balanceCents: 1000 });
    expect(wallet.getWallet).toHaveBeenCalledWith(ORG_ID, CUSTOMER_ID);
  });

  it('adjusts wallet balance', async () => {
    wallet.adjustWallet.mockResolvedValue({ balanceCents: 1500 });
    await controller.adjustWallet(USER, CUSTOMER_ID, {
      type: 'CREDIT',
      amountCents: 500,
      description: 'Promo',
    } as never);
    expect(wallet.adjustWallet).toHaveBeenCalledWith(ORG_ID, CUSTOMER_ID, 'CREDIT', 500, 'Promo');
  });

  it('lists gift cards for org', async () => {
    wallet.listGiftCards.mockResolvedValue([]);
    await controller.listGiftCards(USER);
    expect(wallet.listGiftCards).toHaveBeenCalledWith(ORG_ID);
  });

  it('creates gift card with optional expiry', async () => {
    wallet.createGiftCard.mockResolvedValue({ id: 'gc-1' });
    await controller.createGiftCard(USER, {
      initialBalanceCents: 5000,
      recipientEmail: 'gift@example.com',
      expiresAt: '2026-12-31T00:00:00.000Z',
    } as never);
    expect(wallet.createGiftCard).toHaveBeenCalledWith(ORG_ID, {
      initialBalanceCents: 5000,
      recipientEmail: 'gift@example.com',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    });
  });
});
