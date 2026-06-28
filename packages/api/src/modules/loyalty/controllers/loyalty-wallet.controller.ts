import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { LoyaltyWalletService } from '../loyalty-wallet.service';
import { CreateGiftCardDto, LoyaltyWalletAdjustDto } from '../dto/loyalty.dto';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyWalletController {
  constructor(private readonly wallet: LoyaltyWalletService) {}

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
}
