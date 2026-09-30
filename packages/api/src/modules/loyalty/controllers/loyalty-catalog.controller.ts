import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LOYALTY_ACTIVITY_ACTIONS, LOYALTY_ACTIVITY_RESOURCE_TYPES } from '@queueplatform/shared';
import { AuditService } from '../../../common/audit/audit.service';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { LoyaltyCatalogService } from '../loyalty-catalog.service';
import {
  CreateLoyaltyCouponDto,
  CreateLoyaltyRewardDto,
  RedeemLoyaltyRewardDto,
  UpdateLoyaltyRewardDto,
  ValidateLoyaltyCouponDto,
} from '../dto/loyalty.dto';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyCatalogController {
  constructor(
    private readonly catalog: LoyaltyCatalogService,
    private readonly audit: AuditService,
  ) {}

  @Get('rewards')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listRewards(@CurrentUser() user: AuthenticatedUser, @Query('all') all?: string) {
    return this.catalog.listRewards(user.orgId, all !== 'true');
  }

  @Post('rewards')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async createReward(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoyaltyRewardDto) {
    const reward = await this.catalog.createReward(user.orgId, {
      ...body,
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
    });
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.REWARD_CREATED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_REWARD,
      resourceId: reward.id,
      metadata: { rewardId: reward.id, name: reward.name },
    });
    return reward;
  }

  @Patch('rewards/:id')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async updateReward(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateLoyaltyRewardDto,
  ) {
    const reward = await this.catalog.updateReward(user.orgId, id, body);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.REWARD_UPDATED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_REWARD,
      resourceId: id,
      metadata: { rewardId: id, name: reward.name },
    });
    return reward;
  }

  @Post('rewards/redeem')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async redeemReward(@CurrentUser() user: AuthenticatedUser, @Body() body: RedeemLoyaltyRewardDto) {
    const redemption = await this.catalog.redeemReward(user.orgId, body.customerId, body.rewardId);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.REWARD_REDEEMED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_REDEMPTION,
      resourceId: redemption.id,
      metadata: {
        customerId: body.customerId,
        rewardId: body.rewardId,
        points: redemption.pointsSpent,
        redemptionId: redemption.id,
      },
    });
    return redemption;
  }

  @Get('redemptions')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listRedemptions(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: string) {
    return this.catalog.listRedemptions(user.orgId, status);
  }

  @Post('redemptions/:id/fulfill')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async fulfillRedemption(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const result = await this.catalog.fulfillRedemption(user.orgId, id);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.REDEMPTION_FULFILLED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_REDEMPTION,
      resourceId: id,
      metadata: { redemptionId: id },
    });
    return result;
  }

  @Post('redemptions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async cancelRedemption(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const result = await this.catalog.cancelRedemption(user.orgId, id);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.REDEMPTION_CANCELLED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_REDEMPTION,
      resourceId: id,
      metadata: { redemptionId: id },
    });
    return result;
  }

  @Get('coupons')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listCoupons(@CurrentUser() user: AuthenticatedUser) {
    return this.catalog.listCoupons(user.orgId);
  }

  @Post('coupons')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async createCoupon(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateLoyaltyCouponDto) {
    const coupon = await this.catalog.createCoupon(user.orgId, {
      ...body,
      code: body.code.toUpperCase(),
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
    });
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.COUPON_CREATED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_COUPON,
      resourceId: coupon.id,
      metadata: { couponId: coupon.id, code: coupon.code },
    });
    return coupon;
  }

  @Post('coupons/validate')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  validateCoupon(@CurrentUser() user: AuthenticatedUser, @Body() body: ValidateLoyaltyCouponDto) {
    return this.catalog.validateCoupon(user.orgId, body.code, body.accountId);
  }

  @Delete('rewards/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async deleteReward(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.catalog.deleteReward(user.orgId, id);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.REWARD_DELETED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_REWARD,
      resourceId: id,
      metadata: { rewardId: id },
    });
  }

  @Delete('coupons/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async deleteCoupon(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.catalog.deleteCoupon(user.orgId, id);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.COUPON_DELETED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_COUPON,
      resourceId: id,
      metadata: { couponId: id },
    });
  }
}
