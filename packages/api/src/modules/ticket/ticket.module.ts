import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { BillingModule } from '../billing/billing.module';
import { DisplayModule } from '../display/display.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { BranchModule } from '../branch/branch.module';
import { TicketController } from './ticket.controller';
import { PublicQueueController } from './public-queue.controller';
import { VisitController } from './visit.controller';
import { TicketService } from './ticket.service';
import { TicketTrackSseService } from './ticket-track-sse.service';
import { VisitTrackSseService } from './visit-track-sse.service';
import { TicketStaffGuardService } from './ticket-staff-guard.service';
import { TicketJourneyFlowService } from './ticket-journey-flow.service';
import { TicketJourneyTransitionService } from './ticket-journey-transition.service';
import { TicketIssuanceService } from './ticket-issuance.service';
import { TicketPublicService } from './ticket-public.service';
import { TicketAnalyticsService } from './ticket-analytics.service';
import { TicketQueryService } from './ticket-query.service';
import { TicketComplianceService } from './ticket-compliance.service';
import { TicketActionSurfaceService } from './ticket-action-surface.service';
import { TicketTransitionService } from './ticket-transition.service';
import { TicketRealtimeService } from './ticket-realtime.service';
import { TicketStaffActionService } from './ticket-staff-action.service';
import { TicketQueueContextService } from './ticket-queue-context.service';
import { TicketStatsCacheService } from './ticket-stats-cache.service';
import { TicketCustomerConsentService } from './ticket-customer-consent.service';
import { TicketVisitStepService } from './ticket-visit-step.service';
import { TicketEstimatesService } from './ticket-estimates.service';
import { TicketIssuanceSideEffectsService } from './ticket-issuance-side-effects.service';
import { TicketIssuanceDepsBuilder } from './ticket-issuance-deps.builder';
import { TicketStaffActionDepsBuilder } from './ticket-staff-action-deps.builder';
import { TicketJourneyOrchestrationService } from './ticket-journey-orchestration.service';
import { OrgOwnerGuard } from '../../common/guards/org-owner.guard';
import { OrgOwnerOrAdminGuard } from '../../common/guards/org-owner-or-admin.guard';

@Module({
  imports: [NotificationModule, BillingModule, DisplayModule, WorkflowModule, BranchModule],
  controllers: [TicketController, PublicQueueController, VisitController],
  providers: [
    TicketService,
    TicketTrackSseService,
    VisitTrackSseService,
    TicketStaffGuardService,
    TicketJourneyFlowService,
    TicketJourneyTransitionService,
    TicketIssuanceService,
    TicketPublicService,
    TicketAnalyticsService,
    TicketQueryService,
    TicketComplianceService,
    TicketActionSurfaceService,
    TicketTransitionService,
    TicketRealtimeService,
    TicketStaffActionService,
    TicketQueueContextService,
    TicketStatsCacheService,
    TicketCustomerConsentService,
    TicketVisitStepService,
    TicketEstimatesService,
    TicketIssuanceSideEffectsService,
    TicketIssuanceDepsBuilder,
    TicketStaffActionDepsBuilder,
    TicketJourneyOrchestrationService,
    OrgOwnerGuard,
    OrgOwnerOrAdminGuard,
  ],
  exports: [TicketService],
})
export class TicketModule {}
