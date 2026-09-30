import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LOYALTY_ACTIVITY_ACTIONS, LOYALTY_ACTIVITY_RESOURCE_TYPES } from '@queueplatform/shared';
import { AuditService } from '../../../common/audit/audit.service';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { LoyaltyWalletService } from '../loyalty-wallet.service';
import { CreateGiftCardDto, LoyaltyWalletAdjustDto } from '../dto/loyalty.dto';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
export class LoyaltyWalletController {
  constructor(
    private readonly wallet: LoyaltyWalletService,
    private readonly audit: AuditService,
  ) {}

  @Get('wallets/:customerId')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  getWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.wallet.getWallet(user.orgId, customerId);
  }

  @Post('wallets/:customerId/adjust')
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async adjustWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() body: LoyaltyWalletAdjustDto,
  ) {
    const result = await this.wallet.adjustWallet(
      user.orgId,
      customerId,
      body.type,
      body.amountCents,
      body.description,
    );
    const deltaCents = body.type === 'DEBIT' ? -body.amountCents : body.amountCents;
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.WALLET_ADJUSTED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_WALLET,
      resourceId: customerId,
      metadata: {
        customerId,
        deltaCents,
        type: body.type,
        description: body.description ?? null,
      },
    });
    return result;
  }

  @Get('gift-cards')
  @RequirePermissions({ resource: 'customer', action: 'read' })
  listGiftCards(@CurrentUser() user: AuthenticatedUser) {
    return this.wallet.listGiftCards(user.orgId);
  }

  @Post('gift-cards')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async createGiftCard(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateGiftCardDto) {
    const giftCard = await this.wallet.createGiftCard(user.orgId, {
      initialBalanceCents: body.initialBalanceCents,
      recipientEmail: body.recipientEmail,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.GIFT_CARD_ISSUED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_GIFT_CARD,
      resourceId: giftCard.id,
      metadata: {
        giftCardId: giftCard.id,
        amountCents: body.initialBalanceCents,
      },
    });
    return giftCard;
  }

  @Delete('gift-cards/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions({ resource: 'customer', action: 'update' })
  async deleteGiftCard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.wallet.deleteGiftCard(user.orgId, id);
    void this.audit.logActivity({
      orgId: user.orgId,
      userId: user.userId,
      action: LOYALTY_ACTIVITY_ACTIONS.GIFT_CARD_DELETED,
      resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.LOYALTY_GIFT_CARD,
      resourceId: id,
      metadata: { giftCardId: id },
    });
  }
}
