import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  constructor(private readonly catalog: LoyaltyCatalogService) {}

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
}
