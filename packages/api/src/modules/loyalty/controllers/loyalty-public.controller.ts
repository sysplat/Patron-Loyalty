import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../../common/features/patron-crm-feature.service';
import { LoyaltyReferralService } from '../loyalty-referral.service';
import { LoyaltyPortalService } from '../loyalty-portal.service';
import { LoyaltyPublicReferralJoinDto } from '../dto/loyalty-referral.dto';
import {
  LoyaltyPortalProfileDto,
  LoyaltyPortalRedeemDto,
  LoyaltyPortalLegalConsentDto,
  LoyaltyPortalGamePlayDto,
} from '../dto/loyalty-integration.dto';

@ApiTags('Loyalty')
@Controller('loyalty')
export class LoyaltyPublicController {
  constructor(
    private readonly referrals: LoyaltyReferralService,
    private readonly portal: LoyaltyPortalService,
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
  @Post('public/portal/:referralCode/redeem')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Patron self-serve reward redemption' })
  publicRedeem(@Param('referralCode') referralCode: string, @Body() body: LoyaltyPortalRedeemDto) {
    return this.portal.redeemReward(referralCode, body.rewardId);
  }

  @Public()
  @Patch('public/portal/:referralCode/profile')
  @ApiOperation({ summary: 'Patron self-serve profile update' })
  publicUpdateProfile(
    @Param('referralCode') referralCode: string,
    @Body() body: LoyaltyPortalProfileDto,
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
  @Post('public/portal/:referralCode/play')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Patron spin wheel or scratch card game' })
  publicPlayGame(
    @Param('referralCode') referralCode: string,
    @Body() body: LoyaltyPortalGamePlayDto,
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
