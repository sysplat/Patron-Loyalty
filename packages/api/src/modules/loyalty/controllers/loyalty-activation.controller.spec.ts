import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyActivationController } from './loyalty-activation.controller';

const ORG_ID = '00000000-0000-0000-0000-000000000099';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const USER = { orgId: ORG_ID, userId: USER_ID } as never;

describe('LoyaltyActivationController', () => {
  const activation = {
    getStatus: vi.fn(),
    startTrial: vi.fn(),
    createCheckoutSession: vi.fn(),
  };
  let controller: LoyaltyActivationController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyActivationController(activation as never);
  });

  it('returns activation status', async () => {
    activation.getStatus.mockResolvedValue({ active: true });
    await controller.getActivationStatus(USER);
    expect(activation.getStatus).toHaveBeenCalledWith(ORG_ID);
  });

  it('starts activation trial', async () => {
    activation.startTrial.mockResolvedValue({ trialEndsAt: '2026-07-12' });
    await controller.startActivationTrial(USER);
    expect(activation.startTrial).toHaveBeenCalledWith(ORG_ID, USER_ID);
  });

  it('creates checkout session with billing interval', async () => {
    activation.createCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.com' });
    await controller.createActivationCheckout(USER, {
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
      billingInterval: 'annual',
    } as never);
    expect(activation.createCheckoutSession).toHaveBeenCalledWith(
      ORG_ID,
      'https://app/success',
      'https://app/cancel',
      'annual',
      USER_ID,
    );
  });
});
