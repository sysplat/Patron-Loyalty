import { Module, forwardRef } from '@nestjs/common';
import { OrgOwnerOrAdminGuard } from '../../common/guards/org-owner-or-admin.guard';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { BillingModule } from '../billing/billing.module';
import { WorkbenchModule } from '../workbench/workbench.module';
import { BranchModule } from '../branch/branch.module';
import { FlowTemplateController } from './flow-template.controller';
import { FlowTemplateService } from './flow-template.service';
import { GuidedSetupController } from './guided-setup.controller';
import { GuidedSetupService } from './guided-setup.service';
import { TicketModule } from '../ticket/ticket.module';

@Module({
  imports: [BillingModule, WorkbenchModule, BranchModule, forwardRef(() => TicketModule)],
  controllers: [QueueController, FlowTemplateController, GuidedSetupController],
  providers: [QueueService, FlowTemplateService, GuidedSetupService, OrgOwnerOrAdminGuard],
  exports: [QueueService],
})
export class QueueModule {}
