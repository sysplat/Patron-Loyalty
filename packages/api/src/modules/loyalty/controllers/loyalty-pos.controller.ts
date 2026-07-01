import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { LOYALTY_POS_PROVIDERS, loyaltyPosProviderSchema } from '@queueplatform/shared';
import { LoyaltyApiKeyGuard } from '../guards/loyalty-api-key.guard';
import { LoyaltyOrgId } from '../decorators/loyalty-org.decorator';
import { LoyaltyPosConnectionService } from '../loyalty-pos-connection.service';
import { LoyaltyPosSquareService } from '../loyalty-pos-square.service';
import { LoyaltyPosCloverService } from '../loyalty-pos-clover.service';
import { LoyaltySquareConnectionDto, LoyaltyCloverConnectionDto } from '../dto/loyalty-pos.dto';

@ApiTags('Loyalty POS Integrations')
@Controller('loyalty/integrations/pos')
export class LoyaltyPosController {
  private readonly logger = new Logger(LoyaltyPosController.name);

  constructor(
    private readonly connections: LoyaltyPosConnectionService,
    private readonly square: LoyaltyPosSquareService,
    private readonly clover: LoyaltyPosCloverService,
  ) {}

  // ─── Staff CRUD (JWT-guarded via global guard) ────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List active POS connections for the org (credentials redacted)' })
  listConnections(@LoyaltyOrgId() _orgId: string) {
    // LoyaltyApiKeyGuard is not applied here — uses the global JwtAuthGuard from app module
    // orgId is resolved from JWT sub via the standard auth context
    return { message: 'Use the staff auth endpoints below' };
  }

  @Get('staff')
  @UseGuards(LoyaltyApiKeyGuard)
  @Public()
  @ApiHeader({ name: 'X-Loyalty-Api-Key', required: true })
  @ApiOperation({ summary: 'List active POS connections (API key auth)' })
  listConnectionsWithApiKey(@LoyaltyOrgId() orgId: string) {
    return this.connections.listConnections(orgId);
  }

  @Post('square')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LoyaltyApiKeyGuard)
  @Public()
  @ApiHeader({ name: 'X-Loyalty-Api-Key', required: true })
  @ApiOperation({ summary: 'Configure or update Square POS connection' })
  upsertSquare(
    @LoyaltyOrgId() orgId: string,
    @Body(new ZodValidationPipe(LoyaltySquareConnectionDto)) body: LoyaltySquareConnectionDto,
  ) {
    return this.connections.upsertSquare(orgId, body);
  }

  @Post('clover')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LoyaltyApiKeyGuard)
  @Public()
  @ApiHeader({ name: 'X-Loyalty-Api-Key', required: true })
  @ApiOperation({ summary: 'Configure or update Clover POS connection' })
  upsertClover(
    @LoyaltyOrgId() orgId: string,
    @Body(new ZodValidationPipe(LoyaltyCloverConnectionDto)) body: LoyaltyCloverConnectionDto,
  ) {
    return this.connections.upsertClover(orgId, body);
  }

  @Delete(':provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(LoyaltyApiKeyGuard)
  @Public()
  @ApiHeader({ name: 'X-Loyalty-Api-Key', required: true })
  @ApiOperation({ summary: 'Remove a POS connection' })
  deleteConnection(
    @LoyaltyOrgId() orgId: string,
    @Param('provider', new ZodValidationPipe(loyaltyPosProviderSchema)) provider: string,
  ) {
    return this.connections.deleteConnection(orgId, provider as any);
  }

  // ─── Square inbound webhook ───────────────────────────────────────────────

  /**
   * Square sends webhooks to a single URL per merchant.
   * Tenants register:
   *   https://api.example.com/api/v1/loyalty/integrations/pos/square/webhook?orgId=<uuid>
   * We resolve the org from the `orgId` query param and verify the signature.
   */
  @Post('square/webhook')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({
    summary: 'Square webhook receiver — do not call manually',
    description: 'Register this URL in Square Dashboard → Webhooks. Append ?orgId=<your-org-uuid>.',
  })
  async squareWebhook(@Req() req: RawBodyRequest<Request>): Promise<{ ok: boolean }> {
    const orgId = req.query['orgId'] as string;
    if (!orgId) {
      this.logger.warn('Square webhook received without orgId query param');
      // Return 200 to prevent Square from retrying indefinitely
      return { ok: true };
    }

    const connection = await this.connections.findConnectionByOrgAndProvider(
      orgId,
      LOYALTY_POS_PROVIDERS.SQUARE,
    );
    if (!connection) {
      this.logger.debug(`Square webhook orgId=${orgId} — no active connection`);
      return { ok: true };
    }

    const signature = (req.headers['x-square-hmacsha256-signature'] as string) ?? '';
    const rawBody = req.rawBody;

    if (
      !rawBody ||
      !this.connections.verifySquareSignature(rawBody, signature, connection.webhookSignatureKey)
    ) {
      this.logger.warn(`Square webhook signature invalid orgId=${orgId}`);
      throw new UnauthorizedException('Invalid Square webhook signature');
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    return this.square.processEvent(orgId, payload);
  }

  // ─── Clover inbound webhook ───────────────────────────────────────────────

  /**
   * Clover sends webhooks to a single URL per app installation.
   * Tenants register:
   *   https://api.example.com/api/v1/loyalty/integrations/pos/clover/webhook?orgId=<uuid>
   */
  @Post('clover/webhook')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({
    summary: 'Clover webhook receiver — do not call manually',
    description:
      'Register this URL in Clover Developer Dashboard → Webhooks. Append ?orgId=<your-org-uuid>.',
  })
  async cloverWebhook(@Req() req: RawBodyRequest<Request>): Promise<{ ok: boolean }> {
    const orgId = req.query['orgId'] as string;
    if (!orgId) {
      this.logger.warn('Clover webhook received without orgId query param');
      return { ok: true };
    }

    const connection = await this.connections.findConnectionByOrgAndProvider(
      orgId,
      LOYALTY_POS_PROVIDERS.CLOVER,
    );
    if (!connection) {
      this.logger.debug(`Clover webhook orgId=${orgId} — no active connection`);
      return { ok: true };
    }

    const signature = (req.headers['x-clover-signature'] as string) ?? '';
    const rawBody = req.rawBody;

    if (
      !rawBody ||
      !this.connections.verifyCloverSignature(rawBody, signature, connection.webhookSignatureKey)
    ) {
      this.logger.warn(`Clover webhook signature invalid orgId=${orgId}`);
      throw new UnauthorizedException('Invalid Clover webhook signature');
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    const cfg = connection.config as Record<string, string>;
    const accessToken = this.connections.decryptAccessToken(connection);

    return this.clover.processEvent(orgId, payload, accessToken, cfg.merchantId);
  }
}
