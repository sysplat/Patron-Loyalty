import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
  Req,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  BillingPortalDto,
  ChangePlanDto,
  SmsCreditCheckoutDto,
  SubscriptionCheckoutDto,
} from './dto/billing.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'List available plans' })
  async listPlans() {
    const data = await this.billingService.listPlans();
    return { success: true, data };
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Get current subscription with usage' })
  @RequirePermissions({ resource: 'billing', action: 'read' })
  async getSubscription(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.billingService.getSubscription(user.orgId);
    return { success: true, data };
  }

  @Post('subscription/change')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change subscription plan' })
  @RequirePermissions({ resource: 'billing', action: 'update' })
  async changePlan(@CurrentUser() user: AuthenticatedUser, @Body() body: ChangePlanDto) {
    const data = await this.billingService.changePlan(
      user.orgId,
      body.planId,
      user.userId ?? user.id,
    );
    return { success: true, data };
  }

  @Post('subscription/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel subscription' })
  @RequirePermissions({ resource: 'billing', action: 'update' })
  async cancel(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.billingService.cancelSubscription(user.orgId, user.userId ?? user.id);
    return { success: true, data };
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List invoices' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @RequirePermissions({ resource: 'billing', action: 'read' })
  async listInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.billingService.listInvoices(
      user.orgId,
      page ? +page : 1,
      limit ? +limit : 20,
    );
    return { success: true, data };
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice' })
  @RequirePermissions({ resource: 'billing', action: 'read' })
  async getInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const data = await this.billingService.getInvoice(user.orgId, id);
    return { success: true, data };
  }

  // ─── Stripe ─────────────────────────────────────────────────────────────────

  @Get('sms-packs')
  @ApiOperation({ summary: 'List purchasable SMS message packs' })
  @RequirePermissions({ resource: 'billing', action: 'read' })
  async listSmsPacks() {
    const packs = this.billingService.listSmsPacks();
    return {
      success: true,
      data: packs,
      meta: { checkoutEnabled: packs[0]?.checkoutEnabled ?? false },
    };
  }

  @Post('sms-checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Stripe checkout for SMS message pack (one-time)' })
  @RequirePermissions({ resource: 'billing', action: 'update' })
  async createSmsCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SmsCreditCheckoutDto,
  ) {
    const data = await this.billingService.createSmsCheckoutSession(
      user.orgId,
      body.packSlug,
      body.successUrl,
      body.cancelUrl,
      user.userId ?? user.id,
    );
    return { success: true, data };
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Stripe checkout session' })
  @RequirePermissions({ resource: 'billing', action: 'update' })
  async createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SubscriptionCheckoutDto,
  ) {
    const data = await this.billingService.createCheckoutSession(
      user.orgId,
      body.planId,
      body.successUrl,
      body.cancelUrl,
      body.billingInterval ?? 'monthly',
      user.userId ?? user.id,
    );
    return { success: true, data };
  }

  @Post('portal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Stripe Customer Portal session' })
  @RequirePermissions({ resource: 'billing', action: 'update' })
  async createPortal(@CurrentUser() user: AuthenticatedUser, @Body() body: BillingPortalDto) {
    const data = await this.billingService.createPortalSession(user.orgId, body.returnUrl);
    return { success: true, data };
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook handler (raw body required)' })
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') sig: string) {
    return this.billingService.handleStripeWebhook(req.rawBody!, sig);
  }
}
