import { Body, Controller, Get, Param, Patch, Post, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LOYALTY_ACTIVITY_ACTIONS, LOYALTY_ACTIVITY_RESOURCE_TYPES } from '@queueplatform/shared';
import { AuditService } from '../../../common/audit/audit.service';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoyaltyAccountService } from '../loyalty-account.service';
import { LoyaltyGamificationService } from '../loyalty-gamification.service';
import {
  LoyaltyPointsAdjustDto,
  LoyaltyPointsEarnPurchaseDto,
  UpdateLoyaltyProfileDto,
} from '../dto/loyalty.dto';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyAccountsController {
  constructor(
    private readonly accounts: LoyaltyAccountService,
    private readonly gamification: LoyaltyGamificationService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
  getAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.accounts.getAccountWithLedger(user.orgId, customerId);
  }

  @Get('accounts/:customerId/dsar-export')
  @ApiOperation({ summary: 'DSAR subject-access export for patron loyalty data' })
  @RequirePermissions({ resource: 'customer', action: 'read' })
  exportPatronDsar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.accounts.exportPatronDsar(user.orgId, customerId);
  }

  @Patch('accounts/:customerId/profile')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
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
  async adjustPoints(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() body: LoyaltyPointsAdjustDto,
  ) {
    const result = await this.accounts.adjustPoints(
      user.orgId,
      customerId,
      body.points,
      body.description,
    );
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.POINTS_ADJUSTED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_ACCOUNT,
      resourceId: customerId,
      metadata: {
        customerId,
        points: body.points,
        description: body.description ?? null,
      },
    });
    return result;
  }

  @Post('accounts/:customerId/points/earn')
  @ApiOperation({
    summary: 'Staff: award points from a purchase amount using program earn rules',
  })
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async earnFromPurchase(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() body: LoyaltyPointsEarnPurchaseDto,
  ) {
    const result = await this.accounts.earnFromPurchase(
      user.orgId,
      customerId,
      body.purchaseAmountCents,
      body.description,
    );
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.POINTS_EARNED_PURCHASE,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_ACCOUNT,
      resourceId: customerId,
      metadata: {
        customerId,
        amountCents: body.purchaseAmountCents,
        points: result.pointsAwarded,
        description: body.description ?? null,
      },
    });
    return result;
  }

  @Get('accounts/:customerId/points/earn-preview')
  @ApiOperation({
    summary: 'Staff: preview points for a purchase amount (no ledger write)',
  })
  @RequirePermissions({ resource: 'customer', action: 'read' })
  previewEarnFromPurchase(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Query('purchaseAmountCents') purchaseAmountCentsRaw: string,
  ) {
    const purchaseAmountCents = Number(purchaseAmountCentsRaw);
    if (
      !Number.isInteger(purchaseAmountCents) ||
      purchaseAmountCents < 1 ||
      purchaseAmountCents > 100_000_000
    ) {
      return { pointsAwarded: 0, purchaseAmountCents: 0 };
    }
    return this.accounts.previewEarnFromPurchase(user.orgId, customerId, purchaseAmountCents);
  }
}
