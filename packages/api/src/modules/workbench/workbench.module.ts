import { Module } from '@nestjs/common';
import { TicketModule } from '../ticket/ticket.module';
import { WorkbenchController } from './workbench.controller';
import { StationProfileController } from './station-profile.controller';
import { AgentSessionController } from './agent-session.controller';
import { WorkbenchService } from './workbench.service';
import { StationProfileService } from './station-profile.service';
import { AgentSessionService } from './agent-session.service';
import { WorkbenchActionService } from './workbench-action.service';
import { JourneyDeskAssignmentGuard } from './journey-desk-assignment.guard';
import { WorkbenchBoardService } from './workbench-board.service';
import { WorkbenchCapabilityService } from './workbench-capability.service';
import { WorkbenchJourneySessionService } from './workbench-journey-session.service';
import { WorkbenchQueuePolicyService } from './workbench-queue-policy.service';
import { WorkbenchServeContextService } from './workbench-serve-context.service';
import { WorkbenchWorkItemService } from './workbench-work-item.service';

@Module({
  imports: [TicketModule],
  controllers: [WorkbenchController, StationProfileController, AgentSessionController],
  providers: [
    WorkbenchService,
    WorkbenchBoardService,
    WorkbenchCapabilityService,
    WorkbenchJourneySessionService,
    WorkbenchQueuePolicyService,
    WorkbenchServeContextService,
    WorkbenchWorkItemService,
    StationProfileService,
    AgentSessionService,
    WorkbenchActionService,
    JourneyDeskAssignmentGuard,
  ],
  exports: [
    WorkbenchService,
    WorkbenchBoardService,
    WorkbenchCapabilityService,
    WorkbenchJourneySessionService,
    WorkbenchQueuePolicyService,
    WorkbenchServeContextService,
    WorkbenchWorkItemService,
    StationProfileService,
    AgentSessionService,
    WorkbenchActionService,
    JourneyDeskAssignmentGuard,
  ],
})
export class WorkbenchModule {}
