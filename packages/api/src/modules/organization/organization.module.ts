import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { OrganizationController } from './organization.controller';
import { OrganizationActivityController } from './organization-activity.controller';
import { OrganizationService } from './organization.service';

@Module({
  imports: [BillingModule],
  controllers: [OrganizationController, OrganizationActivityController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
