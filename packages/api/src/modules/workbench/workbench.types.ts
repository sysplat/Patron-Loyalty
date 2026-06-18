import type { StationCapability } from '@queueplatform/shared';

export type WorkbenchTicketStatus = 'waiting' | 'called' | 'serving';

export type WorkItemAction =
  | 'call_next'
  | 'call_specific'
  | 'prioritize'
  | 'serve'
  | 'complete'
  | 'mark_ready'
  | 'no_show'
  | 'cancel';

export type WorkbenchWorkItem = {
  id: string;
  visitId: string | null;
  displayNumber: string;
  queueId: string;
  queueName: string;
  stepRole: string | null;
  status: string;
  readyAt: string | null;
  customerName: string | null;
  customerPhone: string | null;
  deskNumber: string | null;
  bookedAt: string;
  priority: number;
  urgency: number;
  externalRef: string | null;
  allowedActions: WorkItemAction[];
  visibilityOnly: boolean;
};

export type BranchServeStepContext = {
  stepIndex: number;
  deskNumber: string;
  queueId: string;
  queueName: string;
  stepRole: string;
};

export type BranchServeContext = {
  needsWorkbench: boolean;
  mode: 'multi_step' | 'single_queue';
  branchName: string;
  flowName: string | null;
  journeySummary: string | null;
  steps: BranchServeStepContext[];
  /** Branch queues that should only be worked in classic single-step Agent desk. */
  singleStepQueueIds: string[];
  /** Branch queues that should only be worked in multi-step Journey desk. */
  multiStepQueueIds: string[];
};

/** Branch row for Serve customers workspace pickers (surface-filtered). */
export type ServeBranchOption = {
  id: string;
  name: string;
  mode: 'multi_step' | 'single_queue';
  queueCount: number;
  flowName: string | null;
  journeySummary: string | null;
};

export type WorkbenchLane = {
  queueId: string;
  queueName: string;
  stepRole: string | null;
  callingPolicy: string;
  isPrimary: boolean;
  visibilityOnly: boolean;
  capabilities: StationCapability[];
  counts: {
    waiting: number;
    called: number;
    serving: number;
    awaitingReady: number;
  };
  suggestedNext: WorkbenchWorkItem | null;
  items: WorkbenchWorkItem[];
};

export type WorkbenchVisitStep = {
  stepIndex: number | null;
  queueId: string;
  queueName: string;
  ticketId: string;
  status: string;
  readyAt: string | null;
  allowedActions: WorkItemAction[];
};

export type WorkbenchVisit = {
  visitId: string;
  displayNumber: string;
  customerName: string | null;
  steps: WorkbenchVisitStep[];
};

/** Workbench complete action — includes next-step item for immediate UI merge. */
export type WorkbenchCompleteActionResult = {
  ticket: Record<string, unknown>;
  nextWorkbenchItem: WorkbenchWorkItem | null;
};

export type WorkbenchResponse = {
  generatedAt: string;
  warnings?: Array<{ code: string; message: string }>;
  session: {
    id: string | null;
    branchId: string;
    deskId: string | null;
    deskNumber: string | null;
    stationProfileId: string;
    stationProfileName: string;
    subscribedQueueIds: string[];
  };
  profile: {
    id: string;
    name: string;
    primaryQueueId: string | null;
    flowTemplateId: string | null;
  };
  lanes: WorkbenchLane[];
  visits: WorkbenchVisit[];
  activeTicket: Record<string, unknown> | null;
};
