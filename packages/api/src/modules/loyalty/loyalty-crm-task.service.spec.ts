import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { LoyaltyCrmTaskService } from './loyalty-crm-task.service';

const ORG_ID = 'org-1';
const CUSTOMER_ID = 'cust-1';
const TASK_ID = 'task-1';

describe('LoyaltyCrmTaskService', () => {
  const patronCrmFeature = {
    requireEnabled: vi.fn().mockResolvedValue(undefined),
  };
  const prisma = { withTenant: vi.fn() };
  let service: LoyaltyCrmTaskService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LoyaltyCrmTaskService(prisma as never, patronCrmFeature as never);
  });

  it('lists tasks for customer', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: TASK_ID }]);
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ crmTask: { findMany } }),
    );

    const rows = await service.listForCustomer(ORG_ID, CUSTOMER_ID);

    expect(rows).toEqual([{ id: TASK_ID }]);
    expect(patronCrmFeature.requireEnabled).toHaveBeenCalledWith(ORG_ID);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: ORG_ID, customerId: CUSTOMER_ID },
      }),
    );
  });

  it('lists open tasks', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ crmTask: { findMany } }),
    );

    await service.listOpen(ORG_ID);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: ORG_ID, status: { in: ['open', 'in_progress'] } },
        take: 100,
      }),
    );
  });

  it('creates task with org scope', async () => {
    const create = vi.fn().mockResolvedValue({ id: TASK_ID });
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({ crmTask: { create } }),
    );

    await service.create(ORG_ID, { title: 'Follow up', customerId: CUSTOMER_ID });

    expect(create).toHaveBeenCalledWith({
      data: { orgId: ORG_ID, title: 'Follow up', customerId: CUSTOMER_ID },
    });
  });

  it('updates existing task', async () => {
    const update = vi.fn().mockResolvedValue({ id: TASK_ID, status: 'done' });
    let callCount = 0;
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) => {
      callCount += 1;
      if (callCount === 1) {
        return fn({
          crmTask: {
            findFirst: vi.fn().mockResolvedValue({ id: TASK_ID, orgId: ORG_ID }),
          },
        });
      }
      return fn({ crmTask: { update } });
    });

    await service.update(ORG_ID, TASK_ID, { status: 'done' });

    expect(update).toHaveBeenCalledWith({
      where: { id: TASK_ID },
      data: { status: 'done' },
    });
  });

  it('throws when updating missing task', async () => {
    prisma.withTenant.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn({
        crmTask: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      }),
    );

    await expect(service.update(ORG_ID, TASK_ID, { status: 'done' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
