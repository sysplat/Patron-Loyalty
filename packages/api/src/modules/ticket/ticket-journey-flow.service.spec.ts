import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketJourneyFlowService } from './ticket-journey-flow.service';

describe('TicketJourneyFlowService — resolveQueueForFlowStep', () => {
  const orgId = 'org-1';
  const branchId = 'branch-1';
  const templateId = 'flow-1';

  const tx = {
    queue: { findFirst: vi.fn() },
    branchFlowStep: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };

  let service: TicketJourneyFlowService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TicketJourneyFlowService({} as never, {} as never);
  });

  it('returns the queue when the flow step queueId is valid', async () => {
    tx.queue.findFirst.mockResolvedValueOnce({
      id: 'q-lab',
      serviceId: 'svc-lab',
      branchId,
    });

    const result = await service.resolveQueueForFlowStep(tx as never, orgId, branchId, templateId, {
      stepIndex: 2,
      serviceId: 'svc-lab',
      queueId: 'q-lab',
    });

    expect(result?.id).toBe('q-lab');
    expect(tx.branchFlowStep.updateMany).not.toHaveBeenCalled();
  });

  it('falls back to an open queue for the service and repairs the flow step link', async () => {
    tx.queue.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'q-lab-live',
      serviceId: 'svc-lab',
      branchId,
    });

    const result = await service.resolveQueueForFlowStep(tx as never, orgId, branchId, templateId, {
      stepIndex: 2,
      serviceId: 'svc-lab',
      queueId: 'q-lab-deleted',
    });

    expect(result?.id).toBe('q-lab-live');
    expect(tx.branchFlowStep.updateMany).toHaveBeenCalledWith({
      where: { orgId, templateId, stepIndex: 2 },
      data: { queueId: 'q-lab-live', serviceId: 'svc-lab' },
    });
  });

  it('falls back to any branch queue when no open queue exists', async () => {
    tx.queue.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'q-lab-closed',
        serviceId: 'svc-lab',
        branchId,
      });

    const result = await service.resolveQueueForFlowStep(tx as never, orgId, branchId, templateId, {
      stepIndex: 2,
      serviceId: 'svc-lab',
      queueId: 'q-lab-deleted',
    });

    expect(result?.id).toBe('q-lab-closed');
  });
});

describe('TicketJourneyFlowService — resolveFlowTemplateId', () => {
  const orgId = 'org-1';
  const branchId = 'branch-1';

  let service: TicketJourneyFlowService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TicketJourneyFlowService({} as never, {} as never);
  });

  it('resolves using queue flowTemplateId first when queueId is provided', async () => {
    const db = {
      queue: {
        findUnique: vi.fn().mockResolvedValue({ flowTemplateId: 'template-queue-bound' }),
      },
      branchFlowTemplate: {
        findFirst: vi.fn().mockResolvedValue({ id: 'template-branch-active' }),
      },
    };

    const result = await service.resolveFlowTemplateId(db as never, orgId, branchId, 'q-1');

    expect(result).toBe('template-queue-bound');
    expect(db.queue.findUnique).toHaveBeenCalledWith({
      where: { id: 'q-1', orgId },
      select: { flowTemplateId: true },
    });
    // Should short-circuit and not call findFirst
    expect(db.branchFlowTemplate.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to active branch template when queue is provided but has no templateId', async () => {
    const db = {
      queue: {
        findUnique: vi.fn().mockResolvedValue({ flowTemplateId: null }),
      },
      branchFlowTemplate: {
        findFirst: vi.fn().mockResolvedValue({ id: 'template-branch-active' }),
      },
    };

    const result = await service.resolveFlowTemplateId(db as never, orgId, branchId, 'q-1');

    expect(result).toBe('template-branch-active');
  });

  it('falls back to active branch template when queueId is not provided', async () => {
    const db = {
      queue: {
        findUnique: vi.fn(),
      },
      branchFlowTemplate: {
        findFirst: vi.fn().mockResolvedValue({ id: 'template-branch-active' }),
      },
    };

    const result = await service.resolveFlowTemplateId(db as never, orgId, branchId);

    expect(result).toBe('template-branch-active');
    expect(db.queue.findUnique).not.toHaveBeenCalled();
  });
});
