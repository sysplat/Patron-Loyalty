import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { LoyaltyReferralService } from '../loyalty-referral.service';
import { CreateReferralDto } from '../dto/loyalty.dto';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyReferralsController {
  constructor(private readonly referrals: LoyaltyReferralService) {}

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
}
