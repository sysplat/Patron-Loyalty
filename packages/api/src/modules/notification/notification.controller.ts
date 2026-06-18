import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Headers,
  Header,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { NotificationService } from './notification.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CreateNotificationTemplateDto,
  SendNotificationDto,
  TestSmsDto,
  UpdateNotificationTemplateDto,
} from './dto/notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // ─── Templates ──────────────────────────────────

  @Get('templates')
  @ApiOperation({ summary: 'List notification templates' })
  @RequirePermissions({ resource: 'notification', action: 'read' })
  listTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.listTemplates(user.orgId);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get notification template' })
  @RequirePermissions({ resource: 'notification', action: 'read' })
  getTemplate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationService.getTemplate(user.orgId, id);
  }

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create notification template' })
  @RequirePermissions({ resource: 'notification', action: 'create' })
  createTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateNotificationTemplateDto,
  ) {
    return this.notificationService.createTemplate(user.orgId, body);
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Update notification template' })
  @RequirePermissions({ resource: 'notification', action: 'update' })
  updateTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateNotificationTemplateDto,
  ) {
    return this.notificationService.updateTemplate(user.orgId, id, body);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete notification template' })
  @RequirePermissions({ resource: 'notification', action: 'delete' })
  async deleteTemplate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.notificationService.deleteTemplate(user.orgId, id);
  }

  // ─── Send ───────────────────────────────────────

  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a notification' })
  @RequirePermissions({ resource: 'notification', action: 'create' })
  send(@CurrentUser() user: AuthenticatedUser, @Body() body: SendNotificationDto) {
    return this.notificationService.send(user.orgId, body);
  }

  @Post('test-sms')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a test SMS to verify provider configuration' })
  @RequirePermissions({ resource: 'notification', action: 'create' })
  testSms(@CurrentUser() user: AuthenticatedUser, @Body() body: TestSmsDto) {
    return this.notificationService.send(user.orgId, {
      channel: 'sms',
      to: body.to,
      body: 'QlessQ test SMS successful.',
      recipientConsent: {
        transactionalSmsAllowed: true,
      },
    });
  }

  // ─── Twilio Status Webhook (public) ─────────────────────

  /**
   * Receives Twilio delivery-status POST callbacks.
   * This endpoint is public (no JWT) but validates the X-Twilio-Signature
   * header using HMAC-SHA1 with the platform TWILIO_AUTH_TOKEN so that only
   * genuine Twilio callbacks can update notification status.
   *
   * Register this URL in Twilio as the status callback for the sending number:
   *   https://<api-host>/api/v1/notifications/webhook/twilio-status
   */
  @Public()
  @Post('webhook/twilio-status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Twilio delivery status callback (platform-internal)' })
  async twilioStatusWebhook(
    @Req() req: Request,
    @Headers('x-twilio-signature') twilioSignature: string,
    @Body() body: Record<string, any>,
  ) {
    this.validateTwilioSignature(req, twilioSignature, body);

    await this.notificationService.handleTwilioStatusCallback({
      messageSid: body['MessageSid'],
      messageStatus: body['MessageStatus'],
      errorCode: body['ErrorCode'],
      errorMessage: body['ErrorCode'] ? `Twilio error code ${body['ErrorCode']}` : undefined,
    });
  }

  // ─── Twilio Inbound Webhook (public) ─────────────────────

  /**
   * Receives inbound SMS from Twilio (e.g. for STOP/START keywords).
   * This endpoint is public (no JWT) but validates the X-Twilio-Signature.
   */
  @Public()
  @Post('webhook/twilio-inbound')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml')
  @ApiOperation({ summary: 'Twilio inbound SMS callback (platform-internal)' })
  async twilioInboundWebhook(
    @Req() req: Request,
    @Headers('x-twilio-signature') twilioSignature: string,
    @Body() body: any,
  ) {
    this.validateTwilioSignature(req, twilioSignature, body);

    const from = body['From'];
    const to = body['To'];
    const messageBody = body['Body'];

    const twiml = await this.notificationService.handleInboundSms(from, to, messageBody);
    return twiml;
  }

  // ─────────────────────────────────────────────────────────

  /**
   * Validates the X-Twilio-Signature header to ensure the callback
   * is genuine. Throws 401 if Twilio auth token is not configured or
   * signature does not match.
   *
   * Algorithm: HMAC-SHA1( authToken, url + sorted POST params )
   * Reference: https://www.twilio.com/docs/usage/webhooks/webhooks-security
   */
  private validateTwilioSignature(
    req: Request,
    signature: string,
    params: Record<string, string>,
  ): void {
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!authToken) {
      throw new UnauthorizedException(
        'Webhook signature verification is unavailable: TWILIO_AUTH_TOKEN is not configured',
      );
    }

    if (!signature) {
      throw new UnauthorizedException('Missing X-Twilio-Signature');
    }

    const protocol = req.headers['x-forwarded-proto'] ?? req.protocol;
    const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? '';
    const url = `${protocol}://${host}${req.originalUrl}`;

    // Sort POST params alphabetically and append key+value to url
    const sortedKeys = Object.keys(params).sort();
    const payload = sortedKeys.reduce((acc, key) => acc + key + (params[key] ?? ''), url);

    const expected = createHmac('sha1', authToken).update(payload, 'utf8').digest('base64');

    try {
      const expectedBuf = Buffer.from(expected, 'base64');
      const signatureBuf = Buffer.from(signature, 'base64');
      const valid =
        expectedBuf.length === signatureBuf.length && timingSafeEqual(expectedBuf, signatureBuf);
      if (!valid) throw new UnauthorizedException('Invalid Twilio signature');
    } catch {
      throw new UnauthorizedException('Invalid Twilio signature');
    }
  }

  // ─── Logs ───────────────────────────────────────

  @Get('logs')
  @ApiOperation({ summary: 'List notification logs' })
  @ApiQuery({ name: 'channel', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @RequirePermissions({ resource: 'notification', action: 'read' })
  listLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationService.listLogs(user.orgId, {
      channel,
      status,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }
}
