import { Module, forwardRef } from '@nestjs/common';
import { CustomerModule } from '../customer/customer.module';
import { NotificationModule } from '../notification/notification.module';
import { BillingModule } from '../billing/billing.module';
import { WebhookModule } from '../webhook/webhook.module';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyIntegrationController } from './loyalty-integration.controller';
import { LoyaltyProgramService } from './loyalty-program.service';
import { LoyaltyAccountService } from './loyalty-account.service';
import { LoyaltyCatalogService } from './loyalty-catalog.service';
import { LoyaltyWalletService } from './loyalty-wallet.service';
import { LoyaltyReferralService } from './loyalty-referral.service';
import { LoyaltyCampaignService } from './loyalty-campaign.service';
import { LoyaltyCampaignDispatchService } from './loyalty-campaign-dispatch.service';
import { LoyaltyDashboardService } from './loyalty-dashboard.service';
import { LoyaltyGamificationService } from './loyalty-gamification.service';
import { LoyaltyCrmTaskService } from './loyalty-crm-task.service';
import { LoyaltyListener } from './loyalty.listener';
import { LoyaltyActivationService } from './loyalty-activation.service';
import { LoyaltyApiKeyService } from './loyalty-api-key.service';
import { LoyaltyIntegrationService } from './loyalty-integration.service';
import { LoyaltyPointsExpiryService } from './loyalty-points-expiry.service';
import { LoyaltyCampaignAutomationService } from './loyalty-campaign-automation.service';
import { LoyaltyPortalService } from './loyalty-portal.service';
import { LoyaltyWebhookService } from './loyalty-webhook.service';
import { LoyaltyApiKeyGuard } from './guards/loyalty-api-key.guard';

@Module({
  imports: [CustomerModule, NotificationModule, WebhookModule, forwardRef(() => BillingModule)],
  controllers: [LoyaltyController, LoyaltyIntegrationController],
  providers: [
    LoyaltyProgramService,
    LoyaltyAccountService,
    LoyaltyCatalogService,
    LoyaltyWalletService,
    LoyaltyReferralService,
    LoyaltyCampaignService,
    LoyaltyCampaignDispatchService,
    LoyaltyDashboardService,
    LoyaltyGamificationService,
    LoyaltyCrmTaskService,
    LoyaltyListener,
    LoyaltyActivationService,
    LoyaltyApiKeyService,
    LoyaltyIntegrationService,
    LoyaltyPointsExpiryService,
    LoyaltyCampaignAutomationService,
    LoyaltyPortalService,
    LoyaltyWebhookService,
    LoyaltyApiKeyGuard,
  ],
  exports: [
    LoyaltyAccountService,
    LoyaltyProgramService,
    LoyaltyPointsExpiryService,
    LoyaltyCampaignAutomationService,
    LoyaltyCampaignService,
  ],
})
export class LoyaltyModule {}
