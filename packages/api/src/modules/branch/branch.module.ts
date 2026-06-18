import { Module } from '@nestjs/common';
import { BranchController } from './branch.controller';
import { BranchService } from './branch.service';
import { BranchHoursService } from './branch-hours.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [BranchController],
  providers: [BranchService, BranchHoursService],
  exports: [BranchService, BranchHoursService],
})
export class BranchModule {}
