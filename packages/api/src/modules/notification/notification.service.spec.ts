import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { attachTenantIsolationMocks } from '../../test/mock-prisma-tenant';

const mockPrisma = {
  withBypassRls: vi.fn(async (cb) => cb(mockPrisma)),
  withTenant: vi.fn(async (orgId, cb) => cb(mockPrisma)),
  notification: {
    create: vi.fn(),
  },
  universalSuppression: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  setting: {
    findFirst: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
  },
  customer: {
    updateMany: vi.fn(),
  },
  ticket: {
    updateMany: vi.fn(),
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
  getRequestId: vi.fn(() => 'req-test-1'),
};

const mockRedis = {
  incr: vi.fn(),
  set: vi.fn(),
};

const mockPlatformAudit = {
  log: vi.fn(),
};

describe('NotificationService.send', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENCRYPTION_KEY = 'test-pepper-key-1234567890';
    attachTenantIsolationMocks(mockPrisma);
    mockSmsEntitlement.assertCanSendSms.mockResolvedValue(undefined);
    mockPrisma.notification.create.mockResolvedValue({
      id: 'notif-1',
      orgId: 'org-1',
      channel: 'sms',
      status: 'pending',
    });
    mockPrisma.universalSuppression.findFirst.mockResolvedValue(null);
    mockPrisma.universalSuppression.create.mockResolvedValue({ id: 'supp-1' });
    mockPrisma.universalSuppression.update.mockResolvedValue({ id: 'supp-1' });
    mockPrisma.universalSuppression.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.customer.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.ticket.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.setting.findFirst.mockResolvedValue(null);
    mockPrisma.organization.findUnique.mockResolvedValue({
      name: 'Acme Health',
      website: 'https://example.com',
      country: 'CA',
      industry: 'Technology',
    });
    mockQueue.add.mockResolvedValue(undefined);
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue(undefined);

    service = new NotificationService(
      mockPrisma as never,
      mockQueue as never,
      mockRequestContext as never,
      mockPlatformAudit as never,
      mockSmsEntitlement as never,
      mockRedis as never,
    );
  });

  it('enqueues transactional SMS with normalized phone and skipSmsPlanGate', async () => {
    const result = await service.send('org-1', {
      channel: 'sms',
      to: '(415) 555-2671',
      body: 'Your ticket is ready',
      skipSmsPlanGate: true,
      recipientConsent: { transactionalSmsAllowed: true },
    });

    expect(result.id).toBe('notif-1');
    expect(mockSmsEntitlement.assertCanSendSms).toHaveBeenCalledWith('org-1', {
      skipPlanGate: true,
    });
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            to: '+14155552671',
          }),
        }),
      }),
    );
    expect(mockQueue.add).toHaveBeenCalledWith(
      'send-notification',
      expect.objectContaining({
        to: '+14155552671',
        channel: 'sms',
        requestId: 'req-test-1',
        body: expect.stringContaining('Reply STOP to cancel'),
      }),
      expect.any(Object),
    );
  });

  it('does not append compliance footer when body already contains STOP disclosure', async () => {
    await service.send('org-1', {
      channel: 'sms',
      to: '+14155552671',
      body: 'Queue update. Reply STOP to opt out.',
      skipSmsPlanGate: true,
      recipientConsent: { transactionalSmsAllowed: true },
    });

    expect(mockQueue.add).toHaveBeenCalledWith(
      'send-notification',
      expect.objectContaining({
        body: 'Queue update. Reply STOP to opt out.',
      }),
      expect.any(Object),
    );
  });

  it('requires plan SMS feature for non-transactional-gated dashboard sends', async () => {
    mockSmsEntitlement.assertCanSendSms.mockRejectedValue(
      new BadRequestException('SMS notifications require a Professional or Enterprise plan.'),
    );

    await expect(
      service.send('org-1', {
        channel: 'sms',
        to: '+14155552671',
        body: 'Marketing',
        recipientConsent: { transactionalSmsAllowed: true },
      }),
    ).rejects.toThrow(/Professional or Enterprise/);

    expect(mockSmsEntitlement.assertCanSendSms).toHaveBeenCalledWith('org-1', {
      skipPlanGate: undefined,
    });
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('rejects transactional SMS when customer opted out', async () => {
    await expect(
      service.send('org-1', {
        channel: 'sms',
        to: '+14155552671',
        body: 'Your turn',
        recipientConsent: { transactionalSmsAllowed: false },
        skipSmsPlanGate: true,
      }),
    ).rejects.toThrow(/explicit customer consent/i);

    expect(mockSmsEntitlement.assertCanSendSms).not.toHaveBeenCalled();
  });

  it('rejects transactional SMS when consent is not explicitly granted', async () => {
    await expect(
      service.send('org-1', {
        channel: 'sms',
        to: '+14155552671',
        body: 'Your turn',
        skipSmsPlanGate: true,
      }),
    ).rejects.toThrow(/explicit customer consent/i);

    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it('rejects invalid SMS recipient after passing consent checks', async () => {
    await expect(
      service.send('org-1', {
        channel: 'sms',
        to: '604861',
        body: 'hi',
        skipSmsPlanGate: true,
        recipientConsent: { transactionalSmsAllowed: true },
      }),
    ).rejects.toThrow(/E\.164/i);

    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it('rejects SMS when organization is missing website, country, or industry', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      website: '',
      country: 'CA',
      industry: 'Technology',
    });

    await expect(
      service.send('org-1', {
        channel: 'sms',
        to: '+14155552671',
        body: 'hi',
        skipSmsPlanGate: true,
      }),
    ).rejects.toThrow(/Compliance Required/i);

    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it('blocks US SMS when A2P status is suspended', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      name: 'Acme Health',
      website: 'https://example.com',
      country: 'US',
      industry: 'Technology',
    });
    mockPrisma.setting.findFirst.mockResolvedValue({ value: 'SUSPENDED' });

    await expect(
      service.send('org-1', {
        channel: 'sms',
        to: '+14155552671',
        body: 'Your turn',
        skipSmsPlanGate: true,
        recipientConsent: { transactionalSmsAllowed: true },
      }),
    ).rejects.toThrow(/A2P registration status is SUSPENDED/i);
  });

  it('throttles US SMS at 1 message per second for unregistered A2P orgs', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      name: 'Acme Health',
      website: 'https://example.com',
      country: 'US',
      industry: 'Technology',
    });
    mockPrisma.setting.findFirst.mockResolvedValue({ value: 'UNREGISTERED' });
    mockRedis.incr.mockResolvedValueOnce(2);

    await expect(
      service.send('org-1', {
        channel: 'sms',
        to: '+14155552671',
        body: 'Your turn',
        skipSmsPlanGate: true,
        recipientConsent: { transactionalSmsAllowed: true },
      }),
    ).rejects.toThrow(/temporarily throttled/i);
  });

  it('caps transactional ticket SMS at three sends per ticket window', async () => {
    mockRedis.incr.mockResolvedValueOnce(4);

    await expect(
      service.send('org-1', {
        channel: 'sms',
        to: '+14155552671',
        body: 'Your turn',
        skipSmsPlanGate: true,
        messageCategory: 'transactional',
        metadata: { ticketId: 'ticket-123' },
        recipientConsent: { transactionalSmsAllowed: true },
      }),
    ).rejects.toThrow(/cap reached for ticket ticket-123/i);
  });

  it('returns HELP guidance for inbound HELP without changing suppression state', async () => {
    const response = await service.handleInboundSms('+14155552671', '+15005550006', 'help');

    expect(response).toMatch(/reply STOP/i);
    expect(mockPrisma.universalSuppression.create).not.toHaveBeenCalled();
    expect(mockPrisma.universalSuppression.deleteMany).not.toHaveBeenCalled();
  });
});
