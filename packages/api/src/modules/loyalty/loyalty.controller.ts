import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { LoyaltyProgramService } from './loyalty-program.service';
import { LoyaltyAccountService } from './loyalty-account.service';
import { LoyaltyCatalogService } from './loyalty-catalog.service';
import { LoyaltyWalletService } from './loyalty-wallet.service';
import { LoyaltyReferralService } from './loyalty-referral.service';
import { LoyaltyCampaignService } from './loyalty-campaign.service';
import { LoyaltyDashboardService } from './loyalty-dashboard.service';
import { LoyaltyGamificationService } from './loyalty-gamification.service';
import { LoyaltyCrmTaskService } from './loyalty-crm-task.service';
import { LoyaltyCrmExtendedService } from './loyalty-crm-extended.service';
import { LoyaltyActivationService } from './loyalty-activation.service';
import { LoyaltyApiKeyService } from './loyalty-api-key.service';
import { LoyaltyPortalService } from './loyalty-portal.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PatronCrmFeatureService } from '../../common/features/patron-crm-feature.service';
import {
  CreateCrmTaskDto,
  CreateCrmSupportTicketDto,
  CreateCrmSalesOpportunityDto,
  CreateGiftCardDto,
  CreateLoyaltyBadgeDto,
  CreateLoyaltyCampaignDto,
  CreateLoyaltyChallengeDto,
  CreateLoyaltyCouponDto,
  CreateLoyaltyEarnRuleDto,
  CreateLoyaltyRewardDto,
  CreateLoyaltyTierDto,
  CreateReferralDto,
  LoyaltyPointsAdjustDto,
  LoyaltyWalletAdjustDto,
  RedeemLoyaltyRewardDto,
  UpdateCrmTaskDto,
  UpdateCrmSupportTicketDto,
  UpdateCrmSalesOpportunityDto,
  UpdateLoyaltyEarnRuleDto,
  UpdateLoyaltyCampaignDto,
  UpdateLoyaltyProfileDto,
  UpdateLoyaltyProgramDto,
  UpdateLoyaltyRewardDto,
  ValidateLoyaltyCouponDto,
} from './dto/loyalty.dto';
import { LoyaltyAddonCheckoutDto } from './dto/loyalty-activation.dto';
import {
  LoyaltyPortalProfileDto,
  LoyaltyPortalRedeemDto,
  LoyaltyPortalLegalConsentDto,
  LoyaltyPortalGamePlayDto,
} from './dto/loyalty-integration.dto';
import { rowsToCsv } from '../../common/utils/csv-response';
import { LoyaltyPublicReferralJoinDto } from './dto/loyalty-referral.dto';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyController {
  constructor(
    private readonly program: LoyaltyProgramService,
    private readonly accounts: LoyaltyAccountService,
    private readonly catalog: LoyaltyCatalogService,
    private readonly wallet: LoyaltyWalletService,
    private readonly referrals: LoyaltyReferralService,
    private readonly campaigns: LoyaltyCampaignService,
    private readonly dashboard: LoyaltyDashboardService,
    private readonly gamification: LoyaltyGamificationService,
    private readonly crmTasks: LoyaltyCrmTaskService,
    private readonly crmExtended: LoyaltyCrmExtendedService,
    private readonly prisma: PrismaService,
    private readonly patronCrmFeature: PatronCrmFeatureService,
    private readonly activation: LoyaltyActivationService,
    private readonly apiKeys: LoyaltyApiKeyService,
    private readonly portal: LoyaltyPortalService,
  ) {}

  @Get('activation/status')
  @ApiOperation({ summary: 'Patron Loyalty self-serve activation status' })
  @RequirePermissions({ resource: 'billing', action: 'read' })
  getActivationStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.activation.getStatus(user.orgId);
  }

  @Post('activation/trial')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a 14-day Patron Loyalty trial (QMS add-on)' })
  @RequirePermissions({ resource: 'billing', action: 'update' })
  startActivationTrial(@CurrentUser() user: AuthenticatedUser) {
    return this.activation.startTrial(user.orgId, user.userId);
  }

  @Post('activation/checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe checkout for Patron Loyalty add-on' })
  @RequirePermissions({ resource: 'billing', action: 'update' })
  createActivationCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: LoyaltyAddonCheckoutDto,
  ) {
    return this.activation.createCheckoutSession(
      user.orgId,
      body.successUrl,
      body.cancelUrl,
      body.billingInterval ?? 'monthly',
      user.userId,
    );
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Loyalty executive dashboard KPIs' })
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getExecutiveDashboard(user.orgId);
  }

  @Get('reports/points')
  @ApiOperation({ summary: 'Points ledger report by type' })
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getPointsReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getPointsReport(user.orgId);
  }

  @Get('program')
  @ApiOperation({ summary: 'Get or bootstrap loyalty program config' })
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getProgram(@CurrentUser() user: AuthenticatedUser) {
    return this.program.getOrCreateProgram(user.orgId);
  }

  @Patch('program')
  @ApiOperation({ summary: 'Update loyalty program settings' })
  @RequirePermissions({ resource: 'customer', action: 'update' })
  updateProgram(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateLoyaltyProgramDto) {
    return this.program.updateProgram(user.orgId, body);
  }

  @Post('program/tiers')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createTier(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoyaltyTierDto) {
    return this.program.createTier(user.orgId, body);
  }

  @Post('program/earn-rules')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createEarnRule(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoyaltyEarnRuleDto) {
    return this.program.createEarnRule(user.orgId, body);
  }

  @Patch('program/earn-rules/:id')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  updateEarnRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateLoyaltyEarnRuleDto,
  ) {
    return this.program.updateEarnRule(user.orgId, id, body);
  }

  @Get('reports/campaigns')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getCampaignReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getCampaignReport(user.orgId);
  }

  @Get('reports/churn')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getChurnReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getChurnReport(user.orgId);
  }

  @Get('reports/referrals')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getReferralReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getReferralReport(user.orgId);
  }

  @Get('reports/growth')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getGrowthReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getGrowthReport(user.orgId);
  }

  @Get('reports/redemptions')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getRedemptionReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getRedemptionReport(user.orgId);
  }

  @Get('reports/vip')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getVipReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getVipReport(user.orgId);
  }

  @Get('reports/branches')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getBranchReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getBranchPerformanceReport(user.orgId);
  }

  @Get('reports/campaign-roi')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getCampaignRoiReport(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getCampaignRoiReport(user.orgId);
  }

  @Get('reports/sales-dashboard')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getSalesDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getSalesDashboard(user.orgId);
  }

  @Get('reports/points/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="loyalty-points-report.csv"')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  async exportPointsReport(@CurrentUser() user: AuthenticatedUser) {
    const report = await this.dashboard.getPointsReport(user.orgId);
    return rowsToCsv(
      ['type', 'total_points', 'entry_count'],
      report.byType.map((row) => [row.type, row._sum.points ?? 0, row._count._all]),
    );
  }

  @Get('reports/referrals/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="loyalty-referrals-report.csv"')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  async exportReferralsReport(@CurrentUser() user: AuthenticatedUser) {
    const report = await this.dashboard.getReferralReport(user.orgId);
    return rowsToCsv(
      ['patron_name', 'completed_count'],
      report.topReferrers.map((r) => [r.patronName, r.completedCount]),
    );
  }

  @Get('lookup/patron')
  @ApiOperation({ summary: 'Staff quick lookup by phone number' })
  @RequirePermissions({ resource: 'customer', action: 'read' })
  lookupPatron(@CurrentUser() user: AuthenticatedUser, @Query('phone') phone: string) {
    return this.accounts.lookupPatronByPhone(user.orgId, phone);
  }

  @Get('leaderboard')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getLeaderboard(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.gamification.getLeaderboard(user.orgId, limit ? Number(limit) : 20);
  }

  @Get('accounts/:customerId')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getAccount(@CurrentUser() user: AuthenticatedUser, @Param('customerId') customerId: string) {
    return this.accounts.getAccountWithLedger(user.orgId, customerId);
  }

  @Get('accounts/:customerId/dsar-export')
  @ApiOperation({ summary: 'DSAR subject-access export for patron loyalty data' })
  @RequirePermissions({ resource: 'customer', action: 'read' })
  exportPatronDsar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
  ) {
    return this.accounts.exportPatronDsar(user.orgId, customerId);
  }

  @Patch('accounts/:customerId/profile')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Body() body: UpdateLoyaltyProfileDto,
  ) {
    return this.prisma.withTenant(user.orgId, (tx) =>
      tx.customer.update({
        where: { id: customerId },
        data: {
          ...body,
          birthday: body.birthday ? new Date(body.birthday) : body.birthday,
        },
      }),
    );
  }

  @Post('accounts/:customerId/points/adjust')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  adjustPoints(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Body() body: LoyaltyPointsAdjustDto,
  ) {
    return this.accounts.adjustPoints(user.orgId, customerId, body.points, body.description);
  }

  @Get('rewards')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listRewards(@CurrentUser() user: AuthenticatedUser, @Query('all') all?: string) {
    return this.catalog.listRewards(user.orgId, all !== 'true');
  }

  @Post('rewards')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createReward(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoyaltyRewardDto) {
    return this.catalog.createReward(user.orgId, {
      ...body,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
    });
  }

  @Patch('rewards/:id')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  updateReward(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateLoyaltyRewardDto,
  ) {
    return this.catalog.updateReward(user.orgId, id, body);
  }

  @Post('rewards/redeem')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  redeemReward(@CurrentUser() user: AuthenticatedUser, @Body() body: RedeemLoyaltyRewardDto) {
    return this.catalog.redeemReward(user.orgId, body.customerId, body.rewardId);
  }

  @Get('coupons')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listCoupons(@CurrentUser() user: AuthenticatedUser) {
    return this.catalog.listCoupons(user.orgId);
  }

  @Post('coupons')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createCoupon(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoyaltyCouponDto) {
    return this.catalog.createCoupon(user.orgId, {
      ...body,
      code: body.code.toUpperCase(),
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
    });
  }

  @Post('coupons/validate')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  validateCoupon(@CurrentUser() user: AuthenticatedUser, @Body() body: ValidateLoyaltyCouponDto) {
    return this.catalog.validateCoupon(user.orgId, body.code, body.accountId);
  }

  @Get('wallets/:customerId')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getWallet(@CurrentUser() user: AuthenticatedUser, @Param('customerId') customerId: string) {
    return this.wallet.getWallet(user.orgId, customerId);
  }

  @Post('wallets/:customerId/adjust')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  adjustWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Body() body: LoyaltyWalletAdjustDto,
  ) {
    return this.wallet.adjustWallet(
      user.orgId,
      customerId,
      body.type,
      body.amountCents,
      body.description,
    );
  }

  @Get('gift-cards')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listGiftCards(@CurrentUser() user: AuthenticatedUser) {
    return this.wallet.listGiftCards(user.orgId);
  }

  @Post('gift-cards')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createGiftCard(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateGiftCardDto) {
    return this.wallet.createGiftCard(user.orgId, {
      initialBalanceCents: body.initialBalanceCents,
      recipientEmail: body.recipientEmail,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });
  }

  @Post('referrals/apply')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  applyReferral(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateReferralDto) {
    return this.referrals.applyReferral(user.orgId, body.referralCode, body.customerId);
  }

  @Get('referrals')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listReferrals(@CurrentUser() user: AuthenticatedUser) {
    return this.referrals.listReferrals(user.orgId);
  }

  @Get('referrals/stats')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  referralStats(@CurrentUser() user: AuthenticatedUser) {
    return this.referrals.getReferralStats(user.orgId);
  }

  @Get('campaigns')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listCampaigns(@CurrentUser() user: AuthenticatedUser) {
    return this.campaigns.list(user.orgId);
  }

  @Post('campaigns')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createCampaign(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoyaltyCampaignDto) {
    return this.campaigns.create(user.orgId, {
      ...body,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    });
  }

  @Patch('campaigns/:id')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  updateCampaign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateLoyaltyCampaignDto,
  ) {
    return this.campaigns.update(user.orgId, id, body);
  }

  @Post('campaigns/:id/launch')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  launchCampaign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.campaigns.launch(user.orgId, id);
  }

  @Get('badges')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listBadges(@CurrentUser() user: AuthenticatedUser) {
    return this.gamification.listBadges(user.orgId);
  }

  @Post('badges')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createBadge(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoyaltyBadgeDto) {
    return this.gamification.createBadge(user.orgId, body);
  }

  @Get('challenges')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listChallenges(@CurrentUser() user: AuthenticatedUser) {
    return this.gamification.listChallenges(user.orgId);
  }

  @Post('challenges')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createChallenge(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoyaltyChallengeDto) {
    return this.gamification.createChallenge(user.orgId, {
      ...body,
      startAt: body.startAt ? new Date(body.startAt) : null,
      endAt: body.endAt ? new Date(body.endAt) : null,
    });
  }

  @Get('tasks')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listOpenTasks(@CurrentUser() user: AuthenticatedUser) {
    return this.crmTasks.listOpen(user.orgId);
  }

  @Get('tasks/customer/:customerId')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listCustomerTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
  ) {
    return this.crmTasks.listForCustomer(user.orgId, customerId);
  }

  @Post('tasks')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createTask(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateCrmTaskDto) {
    return this.crmTasks.create(user.orgId, {
      ...body,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
    });
  }

  @Patch('tasks/:id')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  updateTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateCrmTaskDto,
  ) {
    return this.crmTasks.update(user.orgId, id, {
      ...body,
      dueAt: body.dueAt ? new Date(body.dueAt) : body.dueAt,
    });
  }

  @Get('crm/support-tickets')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listSupportTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Query('customerId') customerId?: string,
  ) {
    return this.crmExtended.listSupportTickets(user.orgId, customerId);
  }

  @Post('crm/support-tickets')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createSupportTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmSupportTicketDto,
  ) {
    return this.crmExtended.createSupportTicket(user.orgId, {
      customerId: body.customerId,
      subject: body.subject,
      description: body.description ?? undefined,
      priority: body.priority,
      assigneeId: body.assigneeId ?? undefined,
    });
  }

  @Patch('crm/support-tickets/:id')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  updateSupportTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateCrmSupportTicketDto,
  ) {
    return this.crmExtended.updateSupportTicket(user.orgId, id, body);
  }

  @Get('crm/sales-opportunities')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listSalesOpportunities(
    @CurrentUser() user: AuthenticatedUser,
    @Query('customerId') customerId?: string,
  ) {
    return this.crmExtended.listSalesOpportunities(user.orgId, customerId);
  }

  @Post('crm/sales-opportunities')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  createSalesOpportunity(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmSalesOpportunityDto,
  ) {
    return this.crmExtended.createSalesOpportunity(user.orgId, {
      customerId: body.customerId,
      title: body.title,
      stage: body.stage,
      valueCents: body.valueCents,
      expectedCloseDate: body.expectedCloseDate ?? undefined,
      notes: body.notes ?? undefined,
      assigneeId: body.assigneeId ?? undefined,
    });
  }

  @Patch('crm/sales-opportunities/:id')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  updateSalesOpportunity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateCrmSalesOpportunityDto,
  ) {
    return this.crmExtended.updateSalesOpportunity(user.orgId, id, body);
  }

  @Get('integrations/api-key')
  @ApiOperation({ summary: 'LMS integration API key status' })
  @RequirePermissions({ resource: 'customer', action: 'update' })
  getIntegrationApiKeyStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.apiKeys.getStatus(user.orgId);
  }

  @Post('integrations/api-key/rotate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a new LMS integration API key (shown once)' })
  @RequirePermissions({ resource: 'customer', action: 'update' })
  rotateIntegrationApiKey(@CurrentUser() user: AuthenticatedUser) {
    return this.apiKeys.rotateKey(user.orgId);
  }

  @Post('integrations/api-key/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke LMS integration API key' })
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async revokeIntegrationApiKey(@CurrentUser() user: AuthenticatedUser) {
    await this.apiKeys.revokeKey(user.orgId);
  }

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
