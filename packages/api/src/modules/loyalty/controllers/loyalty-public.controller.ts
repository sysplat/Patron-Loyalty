import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../../common/features/patron-crm-feature.service';
import { LoyaltyReferralService } from '../loyalty-referral.service';
import { LoyaltyPortalService } from '../loyalty-portal.service';
import { LoyaltyPortalAuthService } from '../loyalty-portal-auth.service';
import { LoyaltyPortalSessionGuard, PortalSession } from '../guards/loyalty-portal-session.guard';
import type { LoyaltyPortalTokenPayload } from '../loyalty-portal-auth.service';
import { LoyaltyPublicReferralJoinDto } from '../dto/loyalty-referral.dto';
import {
  LoyaltyPortalProfileDto,
  LoyaltyPortalRedeemDto,
  LoyaltyPortalLegalConsentDto,
  LoyaltyPortalGamePlayDto,
  LoyaltyPortalOtpVerifyDto,
} from '../dto/loyalty-integration.dto';

const PORTAL_OTP_THROTTLE = { medium: { limit: 5, ttl: 60_000 } };

@ApiTags('Loyalty')
@Controller('loyalty')
export class LoyaltyPublicController {
  constructor(
    private readonly referrals: LoyaltyReferralService,
    private readonly portal: LoyaltyPortalService,
    private readonly portalAuth: LoyaltyPortalAuthService,
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
  ) {}

  @Public()
  @Get('public/refer/:referralCode')
  @ApiOperation({ summary: 'Public referral invite landing metadata' })
  getPublicReferralLanding(@Param('referralCode') referralCode: string) {
    return this.referrals.getPublicReferralLanding(referralCode);
  }

  @Public()
  @Post('public/refer/:referralCode/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join loyalty program via referral invite link' })
  joinViaPublicReferral(
    @Param('referralCode') referralCode: string,
    @Body() body: LoyaltyPublicReferralJoinDto,
  ) {
    return this.referrals.joinViaPublicReferral(referralCode, body);
  }

  @Public()
  @Get('public/portal/:referralCode')
  @ApiOperation({ summary: 'Public patron loyalty portal (rewards, badges, activity)' })
  getPublicPortal(@Param('referralCode') referralCode: string) {
    return this.portal.getPortalByReferralCode(referralCode);
  }

  @Public()
  @Throttle(PORTAL_OTP_THROTTLE)
  @Post('public/portal/:referralCode/otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send SMS OTP to unlock patron portal mutations' })
  requestPortalOtp(@Param('referralCode') referralCode: string) {
    return this.portalAuth.requestOtp(referralCode);
  }

  @Public()
  @Throttle(PORTAL_OTP_THROTTLE)
  @Post('public/portal/:referralCode/otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify SMS OTP and issue short-lived portal session token' })
  verifyPortalOtp(
    @Param('referralCode') referralCode: string,
    @Body() body: LoyaltyPortalOtpVerifyDto,
  ) {
    return this.portalAuth.verifyOtp(referralCode, body.otp);
  }

  @Public()
  @UseGuards(LoyaltyPortalSessionGuard)
  @Post('public/portal/:referralCode/redeem')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Patron self-serve reward redemption (requires portal OTP session)' })
  publicRedeem(
    @Param('referralCode') referralCode: string,
    @Body() body: LoyaltyPortalRedeemDto,
    @PortalSession() _session: LoyaltyPortalTokenPayload,
  ) {
    return this.portal.redeemReward(referralCode, body.rewardId);
  }

  @Public()
  @UseGuards(LoyaltyPortalSessionGuard)
  @Patch('public/portal/:referralCode/profile')
  @ApiOperation({ summary: 'Patron self-serve profile update (requires portal OTP session)' })
  publicUpdateProfile(
    @Param('referralCode') referralCode: string,
    @Body() body: LoyaltyPortalProfileDto,
    @PortalSession() _session: LoyaltyPortalTokenPayload,
  ) {
    return this.portal.updateProfile(referralCode, body);
  }

  @Public()
  @Post('public/portal/:referralCode/consent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record patron portal legal consent (server-side audit)' })
  recordPublicLegalConsent(
    @Param('referralCode') referralCode: string,
    @Body() body: LoyaltyPortalLegalConsentDto,
  ) {
    return this.portal.recordPatronLegalConsent(referralCode, body);
  }

  @Public()
  @UseGuards(LoyaltyPortalSessionGuard)
  @Post('public/portal/:referralCode/play')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Patron spin wheel or scratch card game (requires portal OTP session)' })
  publicPlayGame(
    @Param('referralCode') referralCode: string,
    @Body() body: LoyaltyPortalGamePlayDto,
    @PortalSession() _session: LoyaltyPortalTokenPayload,
  ) {
    return this.portal.playPatronGame(referralCode, body.gameType);
  }

  @Public()
  @Get('public/branches/:orgSlug')
  @ApiOperation({ summary: 'Public store locator for patron portal' })
  getPublicBranches(@Param('orgSlug') orgSlug: string) {
    return this.portal.getPublicBranches(orgSlug);
  }

  @Public()
  @Get('public/card/:referralCode')
  @ApiOperation({ summary: 'Public digital loyalty card by referral code' })
  async getPublicCard(@Param('referralCode') referralCode: string) {
    const account = await this.prisma.withBypassRls((tx) =>
      tx.loyaltyAccount.findFirst({
        where: { referralCode: referralCode.toUpperCase() },
        include: {
          tier: true,
          customer: { select: { name: true } },
          organization: { select: { name: true, slug: true } },
        },
      }),
    );
    if (!account) return { found: false };

    const enabled = await this.patronCrmFeature.isEnabled(account.orgId);
    if (!enabled) return { found: false };

    return {
      found: true,
      patronName: account.customer.name,
      orgName: account.organization.name,
      pointsBalance: account.pointsBalance,
      tier: account.tier,
      referralCode: account.referralCode,
    };
  }
}
