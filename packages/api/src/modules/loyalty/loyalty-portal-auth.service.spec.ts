import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { LoyaltyPortalAuthService, LOYALTY_PORTAL_TOKEN_TYP } from './loyalty-portal-auth.service';

describe('LoyaltyPortalAuthService', () => {
  const prisma = { withBypassRls: vi.fn() };
  const redis = {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn().mockResolvedValue(1),
  };
  const notifications = { send: vi.fn().mockResolvedValue(undefined) };
  const jwt = { sign: vi.fn().mockReturnValue('portal-jwt'), verify: vi.fn() };
  const patronCrmFeature = { isEnabled: vi.fn().mockResolvedValue(true) };

  let service: LoyaltyPortalAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyPortalAuthService(
      prisma as never,
      redis as never,
      notifications as never,
      jwt as never,
      patronCrmFeature as never,
    );
  });

  it('requestOtp sends SMS and stores hashed OTP', async () => {
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'acc-1',
            orgId: 'org-1',
            customer: { id: 'cust-1', phone: '+14155550123', transactionalSmsAllowed: true },
          }),
        },
      }),
    );

    const result = await service.requestOtp('ABC123');

    expect(result.phoneMasked).toBe('***0123');
    expect(redis.set).toHaveBeenCalledWith('loyalty:portal:otp:ABC123', expect.any(String), 600);
    expect(notifications.send).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        channel: 'sms',
        to: '+14155550123',
        messageCategory: 'transactional',
        skipSmsPlanGate: true,
      }),
    );
  });

  it('requestOtp rejects when phone missing', async () => {
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'acc-1',
            orgId: 'org-1',
            customer: { id: 'cust-1', phone: null, transactionalSmsAllowed: false },
          }),
        },
      }),
    );

    await expect(service.requestOtp('ABC123')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verifyOtp issues portal JWT when hash matches', async () => {
    const otp = '123456';
    const hash = (service as unknown as { hashOtp: (code: string) => string }).hashOtp(otp);
    redis.get.mockResolvedValue(hash);
    prisma.withBypassRls.mockImplementation((fn: (tx: unknown) => unknown) =>
      fn({
        loyaltyAccount: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'acc-1',
            orgId: 'org-1',
            customerId: 'cust-1',
            referralCode: 'ABC123',
          }),
        },
      }),
    );

    const result = await service.verifyOtp('ABC123', otp);

    expect(result.accessToken).toBe('portal-jwt');
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        typ: LOYALTY_PORTAL_TOKEN_TYP,
        aid: 'acc-1',
        code: 'ABC123',
      }),
      { expiresIn: 1800 },
    );
  });

  it('verifyPortalToken rejects wrong referral code', () => {
    jwt.verify.mockReturnValue({
      typ: LOYALTY_PORTAL_TOKEN_TYP,
      aid: 'acc-1',
      oid: 'org-1',
      cid: 'cust-1',
      code: 'OTHER',
    });

    expect(() => service.verifyPortalToken('tok', 'ABC123')).toThrow(UnauthorizedException);
  });
});
