import { Module } from '@nestjs/common';
import { isLoyaltyOnlyApiDeploy, resolveApiDeployProfile } from '@queueplatform/shared';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { PlatformPulseController } from './platform-pulse.controller';
import { PlatformPulseService } from './platform-pulse.service';
import { PlatformTenantsController } from './platform-tenants.controller';
import { PlatformImpersonationController } from './platform-impersonation.controller';
import { PlatformAuditController } from './platform-audit.controller';
import { PlatformHealthController } from './platform-health.controller';
import { PlatformHealthService } from './platform-health.service';
import { PlatformDataController } from './platform-data.controller';
import { PlatformDataService } from './platform-data.service';
import { PlatformAnnouncementsController } from './platform-announcements.controller';
import { PlatformAdminsController } from './platform-admins.controller';
import { PlatformAdminTwoFactorController } from './platform-admin-two-factor.controller';
import { PlatformDeploymentController } from './platform-deployment.controller';
import { AnnouncementModule } from '../announcement/announcement.module';
import { SupportModule } from '../support/support.module';
import { PlatformSupportController } from './platform-support.controller';

const loyaltyOnlyApi = isLoyaltyOnlyApiDeploy(resolveApiDeployProfile());

@Module({
  imports: [
    AuthModule,
    BillingModule,
    SupportModule,
    ...(loyaltyOnlyApi ? [] : [AnnouncementModule]),
  ],
  controllers: [
    PlatformPulseController,
    PlatformDeploymentController,
    PlatformTenantsController,
    PlatformImpersonationController,
    PlatformAuditController,
    PlatformHealthController,
    PlatformDataController,
    ...(loyaltyOnlyApi ? [] : [PlatformAnnouncementsController]),
    PlatformAdminsController,
    PlatformAdminTwoFactorController,
    PlatformSupportController,
  ],
  providers: [PlatformPulseService, PlatformHealthService, PlatformDataService],
  exports: [PlatformHealthService],
})
export class PlatformAdminModule {}
