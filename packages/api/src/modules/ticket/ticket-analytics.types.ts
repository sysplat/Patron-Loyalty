export type LiveOperationsTicket = {
  id: string;
  displayNumber: string | null;
  status: string;
  branchId: string;
  branchName: string;
  queueId: string;
  queueName: string;
  serviceName: string | null;
  deskNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  source: string | null;
  priority: number;
  bookedAt: Date;
  calledAt: Date | null;
  servedAt: Date | null;
  waitMinutes: number;
  activeMinutes: number | null;
  servedByName: string | null;
  /** Agent-set remaining service time (called/serving); drives customer-facing roadmap. */
  estimatedRemainingMins: number | null;
  isExceptional: boolean;
};

export type LiveOperationsResponse = {
  generatedAt: string;
  summary: {
    waiting: number;
    called: number;
    serving: number;
    active: number;
    longestWaitMinutes: number;
    branchCount: number;
  };
  tickets: LiveOperationsTicket[];
  branches: Array<{
    branchId: string;
    branchName: string;
    waiting: number;
    called: number;
    serving: number;
    active: number;
    longestWaitMinutes: number;
    tickets: LiveOperationsTicket[];
  }>;
};
