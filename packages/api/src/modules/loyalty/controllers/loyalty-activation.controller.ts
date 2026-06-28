import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { LoyaltyActivationService } from '../loyalty-activation.service';
import { LoyaltyAddonCheckoutDto } from '../dto/loyalty-activation.dto';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyActivationController {
  constructor(private readonly activation: LoyaltyActivationService) {}

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
}
