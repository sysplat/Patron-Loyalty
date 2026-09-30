import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOYALTY_ACTIVITY_ACTIONS, LOYALTY_ACTIVITY_RESOURCE_TYPES } from '@queueplatform/shared';
import { LoyaltyWalletController } from './loyalty-wallet.controller';

const ORG_ID = '00000000-0000-0000-0000-000000000099';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000001';
const USER = { userId: 'staff-1', orgId: ORG_ID } as never;

describe('LoyaltyWalletController', () => {
  const wallet = {
    getWallet: vi.fn(),
    adjustWallet: vi.fn(),
    listGiftCards: vi.fn(),
    createGiftCard: vi.fn(),
    deleteGiftCard: vi.fn(),
  };
  const audit = { logActivity: vi.fn().mockResolvedValue(undefined) };
  let controller: LoyaltyWalletController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyWalletController(wallet as never, audit as never);
  });

  it('gets wallet for customer', async () => {
    wallet.getWallet.mockResolvedValue({ balanceCents: 1000 });
    await expect(controller.getWallet(USER, CUSTOMER_ID)).resolves.toEqual({ balanceCents: 1000 });
    expect(wallet.getWallet).toHaveBeenCalledWith(ORG_ID, CUSTOMER_ID);
  });

  it('adjusts wallet balance and logs activity', async () => {
    wallet.adjustWallet.mockResolvedValue({ balanceCents: 1500 });
    await controller.adjustWallet(USER, CUSTOMER_ID, {
      type: 'CREDIT',
      amountCents: 500,
      description: 'Promo',
    } as never);
    expect(wallet.adjustWallet).toHaveBeenCalledWith(ORG_ID, CUSTOMER_ID, 'CREDIT', 500, 'Promo');
    expect(audit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: LOYALTY_ACTIVITY_ACTIONS.WALLET_ADJUSTED,
        metadata: expect.objectContaining({ customerId: CUSTOMER_ID, deltaCents: 500 }),
      }),
    );
  });

  it('lists gift cards for org', async () => {
    wallet.listGiftCards.mockResolvedValue([]);
    await controller.listGiftCards(USER);
    expect(wallet.listGiftCards).toHaveBeenCalledWith(ORG_ID);
  });

  it('creates gift card with optional expiry and logs activity', async () => {
    wallet.createGiftCard.mockResolvedValue({ id: '00000000-0000-0000-0000-0000000000bb' });
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
    expect(audit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: LOYALTY_ACTIVITY_ACTIONS.GIFT_CARD_ISSUED,
        resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_GIFT_CARD,
      }),
    );
  });

  it('deletes gift card by id and logs activity', async () => {
    const id = '00000000-0000-0000-0000-0000000000aa';
    wallet.deleteGiftCard.mockResolvedValue({ deleted: true });
    await controller.deleteGiftCard(USER, id);
    expect(wallet.deleteGiftCard).toHaveBeenCalledWith(ORG_ID, id);
    expect(audit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: LOYALTY_ACTIVITY_ACTIONS.GIFT_CARD_DELETED,
        resourceId: id,
        metadata: { giftCardId: id },
      }),
    );
  });
});
