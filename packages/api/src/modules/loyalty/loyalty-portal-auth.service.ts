import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { NotificationService } from '../notification/notification.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';

const OTP_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 30 * 60;
export const LOYALTY_PORTAL_TOKEN_TYP = 'loyalty_portal';

export type LoyaltyPortalTokenPayload = {
  typ: typeof LOYALTY_PORTAL_TOKEN_TYP;
  aid: string;
  oid: string;
  cid: string;
  code: string;
};

@Injectable()
export class LoyaltyPortalAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationService,
    private readonly jwt: JwtService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
  ) {}

  private otpKey(referralCode: string): string {
    return `loyalty:portal:otp:${referralCode.toUpperCase()}`;
  }

  private hashOtp(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '****';
    return `***${digits.slice(-4)}`;
  }

  async requestOtp(referralCode: string): Promise<{ ok: true; phoneMasked: string }> {
    const account = await this.prisma.withBypassRls((tx) =>
      tx.loyaltyAccount.findFirst({
        where: { referralCode: referralCode.toUpperCase() },
        select: {
          id: true,
          orgId: true,
          customer: { select: { id: true, phone: true, transactionalSmsAllowed: true } },
        },
      }),
    );
    if (!account) throw new NotFoundException('Loyalty account not found');

    const enabled = await this.patronCrmFeature.isEnabled(account.orgId);
    if (!enabled) throw new NotFoundException('Loyalty account not found');

    const phone = account.customer.phone?.trim();
    if (!phone) {
      throw new BadRequestException(
        'No phone on file. Ask staff to add your phone number before unlocking portal actions.',
      );
    }

    const otp = String(randomInt(100_000, 1_000_000));
    await this.redis.set(this.otpKey(referralCode), this.hashOtp(otp), OTP_TTL_SECONDS);

    await this.notifications.send(account.orgId, {
      channel: 'sms',
      to: phone,
      body: `Your loyalty portal code is ${otp}. It expires in 10 minutes.`,
      messageCategory: 'transactional',
      recipientConsent: { transactionalSmsAllowed: true },
      skipSmsPlanGate: true,
      metadata: {
        type: 'loyalty_portal_otp',
        customerId: account.customer.id,
        accountId: account.id,
      },
    });

    return { ok: true, phoneMasked: this.maskPhone(phone) };
  }

  async verifyOtp(
    referralCode: string,
    otp: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const normalized = otp.trim();
    if (!/^\d{6}$/.test(normalized)) {
      throw new BadRequestException('Enter the 6-digit code from your SMS');
    }

    const storedHash = await this.redis.get(this.otpKey(referralCode));
    if (!storedHash) {
      throw new UnauthorizedException('Code expired. Request a new one.');
    }

    const providedHash = this.hashOtp(normalized);
    const a = Buffer.from(storedHash);
    const b = Buffer.from(providedHash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid code');
    }

    await this.redis.del(this.otpKey(referralCode)).catch(() => undefined);

    const account = await this.prisma.withBypassRls((tx) =>
      tx.loyaltyAccount.findFirst({
        where: { referralCode: referralCode.toUpperCase() },
        select: { id: true, orgId: true, customerId: true, referralCode: true },
      }),
    );
    if (!account) throw new NotFoundException('Loyalty account not found');

    const payload: LoyaltyPortalTokenPayload = {
      typ: LOYALTY_PORTAL_TOKEN_TYP,
      aid: account.id,
      oid: account.orgId,
      cid: account.customerId,
      code: account.referralCode,
    };

    const accessToken = this.jwt.sign(payload, { expiresIn: SESSION_TTL_SECONDS });
    return { accessToken, expiresIn: SESSION_TTL_SECONDS };
  }

  verifyPortalToken(token: string, expectedReferralCode: string): LoyaltyPortalTokenPayload {
    let payload: LoyaltyPortalTokenPayload;
    try {
      payload = this.jwt.verify<LoyaltyPortalTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Portal session expired. Verify again.');
    }
    if (payload.typ !== LOYALTY_PORTAL_TOKEN_TYP) {
      throw new UnauthorizedException('Invalid portal session');
    }
    if (payload.code.toUpperCase() !== expectedReferralCode.toUpperCase()) {
      throw new UnauthorizedException('Portal session does not match this account');
    }
    return payload;
  }
}
