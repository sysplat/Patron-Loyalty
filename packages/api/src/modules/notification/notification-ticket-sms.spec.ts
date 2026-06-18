import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from './notification.service';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  ticket: {
    findUnique: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
  notificationTemplate: {
    findFirst: vi.fn(),
  },
  branchFlowStep: {
    findMany: vi.fn(),
  },
  setting: {
    findFirst: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
  },
};

const mockQueue = {
  add: vi.fn(),
};

const mockSmsEntitlement = {
  assertCanSendSms: vi.fn(),
  snapshotUsageAfterDelivery: vi.fn(),
  syncUsageAfterFailedDelivery: vi.fn(),
};

const mockRequestContext = {
  getRequestId: vi.fn(() => 'req-1'),
};

const mockPlatformAudit = {
  log: vi.fn(),
};

const mockRedis = {
  incr: vi.fn(),
  set: vi.fn(),
};

describe('NotificationService ticket SMS policy', () => {
  let service: NotificationService;
  let sendSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantIsolationMocks(mockPrisma);
    mockSmsEntitlement.assertCanSendSms.mockResolvedValue(undefined);
    mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });
    mockQueue.add.mockResolvedValue(undefined);

    service = new NotificationService(
      mockPrisma as never,
      mockQueue as never,
      mockRequestContext as never,
      mockPlatformAudit as never,
      mockSmsEntitlement as never,
      mockRedis as never,
    );
    sendSpy = vi.spyOn(service, 'send').mockResolvedValue({ id: 'notif-1' } as never);
  });

  it('notifyTicketIssued skips SMS for visit journey tickets', async () => {
    mockPrisma.ticket.findUnique.mockResolvedValue({
      visitId: 'visit-1',
      stepIndex: 2,
      branchId: 'branch-1',
      queue: { name: 'Phone Demo · Pharmacy Pickup' },
    });

    await service.notifyTicketIssued('org-1', {
      ticketId: 'ticket-pharmacy',
      displayNumber: 'PD1015',
      customerPhone: '+16048618530',
      serviceName: 'Pharmacy',
    });

    expect(sendSpy).not.toHaveBeenCalled();
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('notifyTicketIssued sends SMS for single-ticket issuance (no visit)', async () => {
    mockPrisma.ticket.findUnique.mockResolvedValue({
      visitId: null,
      stepIndex: null,
      branchId: 'branch-1',
      queue: { name: 'Walk-in' },
    });
    mockPrisma.notificationTemplate.findFirst.mockResolvedValue(undefined);

    await service.notifyTicketIssued('org-1', {
      ticketId: 'ticket-solo',
      displayNumber: 'A1',
      customerPhone: '+16048618530',
      serviceName: 'Consultation',
      transactionalSmsAllowed: true,
    });

    expect(sendSpy).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        channel: 'sms',
        to: '+16048618530',
        body: expect.stringContaining('created'),
      }),
    );
  });

  it('notifyTicketReady does not send SMS', async () => {
    await service.notifyTicketReady('org-1', 'ticket-1', {
      displayNumber: 'PD1015',
      customerPhone: '+16048618530',
      queueName: 'Pharmacy',
    });

    expect(sendSpy).not.toHaveBeenCalled();
    expect(mockPrisma.ticket.findUnique).not.toHaveBeenCalled();
  });

  it('notifyTicketAlmostReady does not send SMS', async () => {
    await service.notifyTicketAlmostReady('org-1', 'ticket-1', 1, '+16048618530', {
      queueName: 'Lab',
    });

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('notifyTicketCalled still sends your-turn SMS', async () => {
    mockPrisma.notificationTemplate.findFirst.mockResolvedValue({ id: 'tpl-called' });

    await service.notifyTicketCalled('org-1', 'ticket-1', {
      displayNumber: 'PD1015',
      deskNumber: '2',
      customerPhone: '+16048618530',
      queueName: 'Phone Demo · Lab',
      transactionalSmsAllowed: true,
    });

    expect(sendSpy).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        channel: 'sms',
        templateId: 'tpl-called',
        body: expect.stringMatching(/Your turn!/i),
      }),
    );
  });
});
