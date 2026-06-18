import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationActivityController } from './organization-activity.controller';
import { OrganizationService } from './organization.service';

@Module({
  controllers: [OrganizationController, OrganizationActivityController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
