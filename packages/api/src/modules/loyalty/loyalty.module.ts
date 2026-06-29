import { Module, forwardRef } from '@nestjs/common';
import { CustomerModule } from '../customer/customer.module';
import { NotificationModule } from '../notification/notification.module';
import { BillingModule } from '../billing/billing.module';
import { WebhookModule } from '../webhook/webhook.module';
import { RedisModule } from '../../redis/redis.module';
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
import { LoyaltyAccountLifecycleService } from './loyalty-account-lifecycle.service';
import { LoyaltyAccountEarnService } from './loyalty-account-earn.service';
import { LoyaltyAccountDsarService } from './loyalty-account-dsar.service';
import { LoyaltyPointsService } from './loyalty-points.service';
import { LoyaltyPointsLedgerService } from './loyalty-points-ledger.service';
import { LoyaltyPointsMetricsService } from './loyalty-points-metrics.service';
import { LoyaltyCatalogService } from './loyalty-catalog.service';
import { LoyaltyWalletService } from './loyalty-wallet.service';
import { LoyaltyReferralService } from './loyalty-referral.service';
import { LoyaltyCampaignService } from './loyalty-campaign.service';
import { LoyaltyCampaignDispatchService } from './loyalty-campaign-dispatch.service';
import { LoyaltyDashboardService } from './loyalty-dashboard.service';
import { LoyaltyDashboardKpisService } from './loyalty-dashboard-kpis.service';
import { LoyaltyDashboardReportsService } from './loyalty-dashboard-reports.service';
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
import { LoyaltyConnectorObservabilityService } from './loyalty-connector-observability.service';

@Module({
  imports: [
    CustomerModule,
    NotificationModule,
    WebhookModule,
    RedisModule,
    forwardRef(() => BillingModule),
  ],
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
    LoyaltyPointsMetricsService,
    LoyaltyPointsLedgerService,
    LoyaltyPointsService,
    LoyaltyAccountLifecycleService,
    LoyaltyAccountEarnService,
    LoyaltyAccountDsarService,
    LoyaltyAccountService,
    LoyaltyCatalogService,
    LoyaltyWalletService,
    LoyaltyReferralService,
    LoyaltyCampaignService,
    LoyaltyCampaignDispatchService,
    LoyaltyDashboardKpisService,
    LoyaltyDashboardReportsService,
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
    LoyaltyConnectorObservabilityService,
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
