import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationSmsEntitlementService } from './notification-sms-entitlement.service';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationLogService } from './notification-log.service';
import { NotificationTwilioWebhookService } from './notification-twilio-webhook.service';
import { BillingModule } from '../billing/billing.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'notifications' }), BillingModule, CommonModule],
  controllers: [NotificationController],
  providers: [
    NotificationSmsEntitlementService,
    NotificationTemplateService,
    NotificationLogService,
    NotificationTwilioWebhookService,
    NotificationService,
  ],
  exports: [
    NotificationSmsEntitlementService,
    NotificationTemplateService,
    NotificationLogService,
    NotificationTwilioWebhookService,
    NotificationService,
  ],
})
export class NotificationModule {}
