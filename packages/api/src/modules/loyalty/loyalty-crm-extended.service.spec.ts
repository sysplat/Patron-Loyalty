import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CRM_SUPPORT_TICKET_STATUSES } from '@queueplatform/shared';
import { LoyaltyCrmExtendedService } from './loyalty-crm-extended.service';

describe('LoyaltyCrmExtendedService', () => {
  const patronCrmFeature = {
    requireEnabled: vi.fn().mockResolvedValue(undefined),
  };
  const prisma = { withTenant: vi.fn() };
  let service: LoyaltyCrmExtendedService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyCrmExtendedService(prisma as never, patronCrmFeature as never);
  });

  it('creates support ticket with open status', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        crmSupportTicket: {
          create: vi.fn().mockResolvedValue({ id: 't-1', status: 'open' }),
        },
      }),
    );

    const row = await service.createSupportTicket('org-1', {
      customerId: 'cust-1',
      subject: 'Help',
    });

    expect(row).toMatchObject({ id: 't-1', status: 'open' });
    expect(patronCrmFeature.requireEnabled).toHaveBeenCalledWith('org-1');
  });

  it('sets resolvedAt when ticket status becomes resolved', async () => {
    const updateMock = vi.fn().mockResolvedValue({ id: 't-1', status: 'resolved' });
    let callCount = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      callCount += 1;
      if (callCount === 1) {
        return fn({
          crmSupportTicket: {
            findFirst: vi.fn().mockResolvedValue({ id: 't-1', status: 'open' }),
          },
        });
      }
      return fn({ crmSupportTicket: { update: updateMock } });
    });

    await service.updateSupportTicket('org-1', 't-1', {
      status: CRM_SUPPORT_TICKET_STATUSES.RESOLVED,
    });

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: expect.objectContaining({
        status: CRM_SUPPORT_TICKET_STATUSES.RESOLVED,
        resolvedAt: expect.any(Date),
      }),
    });
  });
});
