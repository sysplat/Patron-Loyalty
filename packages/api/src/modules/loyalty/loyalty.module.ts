import { Module, forwardRef } from '@nestjs/common';
import { CustomerModule } from '../customer/customer.module';
import { NotificationModule } from '../notification/notification.module';
import { BillingModule } from '../billing/billing.module';
import { WebhookModule } from '../webhook/webhook.module';
import { LoyaltyIntegrationController } from './loyalty-integration.controller';
import { LoyaltyActivationController } from './controllers/loyalty-activation.controller';
import { LoyaltyDashboardController } from './controllers/loyalty-dashboard.controller';
import { LoyaltyProgramController } from './controllers/loyalty-program.controller';
import { LoyaltyAccountsController } from './controllers/loyalty-accounts.controller';
import { LoyaltyCatalogController } from './controllers/loyalty-catalog.controller';
import { LoyaltyWalletController } from './controllers/loyalty-wallet.controller';
import { LoyaltyReferralsController } from './controllers/loyalty-referrals.controller';
import { LoyaltyCampaignsController } from './controllers/loyalty-campaigns.controller';
import { LoyaltyGamificationController } from './controllers/loyalty-gamification.controller';
import { LoyaltyCrmController } from './controllers/loyalty-crm.controller';
import { LoyaltyApiKeyController } from './controllers/loyalty-api-key.controller';
import { LoyaltyPublicController } from './controllers/loyalty-public.controller';
import { LoyaltyProgramService } from './loyalty-program.service';
import { LoyaltyAccountService } from './loyalty-account.service';
import { LoyaltyPointsService } from './loyalty-points.service';
import { LoyaltyCatalogService } from './loyalty-catalog.service';
import { LoyaltyWalletService } from './loyalty-wallet.service';
import { LoyaltyReferralService } from './loyalty-referral.service';
import { LoyaltyCampaignService } from './loyalty-campaign.service';
import { LoyaltyCampaignDispatchService } from './loyalty-campaign-dispatch.service';
import { LoyaltyDashboardService } from './loyalty-dashboard.service';
import { LoyaltyGamificationService } from './loyalty-gamification.service';
import { LoyaltyCrmTaskService } from './loyalty-crm-task.service';
import { LoyaltyCrmExtendedService } from './loyalty-crm-extended.service';
import { LoyaltyListener } from './loyalty.listener';
import { LoyaltyActivationService } from './loyalty-activation.service';
import { LoyaltyApiKeyService } from './loyalty-api-key.service';
import { LoyaltyIntegrationService } from './loyalty-integration.service';
import { LoyaltyPointsExpiryService } from './loyalty-points-expiry.service';
import { LoyaltyCampaignAutomationService } from './loyalty-campaign-automation.service';
import { LoyaltyPortalService } from './loyalty-portal.service';
import { LoyaltyWebhookService } from './loyalty-webhook.service';
import { LoyaltyApiKeyGuard } from './guards/loyalty-api-key.guard';
import { LoyaltyQueueEventsService } from './loyalty-queue-events.service';

@Module({
  imports: [CustomerModule, NotificationModule, WebhookModule, forwardRef(() => BillingModule)],
  controllers: [
    LoyaltyActivationController,
    LoyaltyDashboardController,
    LoyaltyProgramController,
    LoyaltyAccountsController,
    LoyaltyCatalogController,
    LoyaltyWalletController,
    LoyaltyReferralsController,
    LoyaltyCampaignsController,
    LoyaltyGamificationController,
    LoyaltyCrmController,
    LoyaltyApiKeyController,
    LoyaltyPublicController,
    LoyaltyIntegrationController,
  ],
  providers: [
    LoyaltyProgramService,
    LoyaltyPointsService,
    LoyaltyAccountService,
    LoyaltyCatalogService,
    LoyaltyWalletService,
    LoyaltyReferralService,
    LoyaltyCampaignService,
    LoyaltyCampaignDispatchService,
    LoyaltyDashboardService,
    LoyaltyGamificationService,
    LoyaltyCrmTaskService,
    LoyaltyCrmExtendedService,
    LoyaltyListener,
    LoyaltyActivationService,
    LoyaltyApiKeyService,
    LoyaltyIntegrationService,
    LoyaltyPointsExpiryService,
    LoyaltyCampaignAutomationService,
    LoyaltyPortalService,
    LoyaltyWebhookService,
    LoyaltyApiKeyGuard,
    LoyaltyQueueEventsService,
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
