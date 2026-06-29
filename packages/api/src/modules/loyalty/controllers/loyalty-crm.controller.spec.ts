import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyCrmController } from './loyalty-crm.controller';

const ORG_ID = '00000000-0000-0000-0000-000000000099';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000001';
const USER = { orgId: ORG_ID } as never;

describe('LoyaltyCrmController', () => {
  const crmTasks = {
    listOpen: vi.fn(),
    listForCustomer: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const crmExtended = {
    listSupportTickets: vi.fn(),
    createSupportTicket: vi.fn(),
    updateSupportTicket: vi.fn(),
    listSalesOpportunities: vi.fn(),
    createSalesOpportunity: vi.fn(),
    updateSalesOpportunity: vi.fn(),
  };
  let controller: LoyaltyCrmController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyCrmController(crmTasks as never, crmExtended as never);
  });

  it('lists open CRM tasks', async () => {
    crmTasks.listOpen.mockResolvedValue([]);
    await controller.listOpenTasks(USER);
    expect(crmTasks.listOpen).toHaveBeenCalledWith(ORG_ID);
  });

  it('creates task with parsed due date', async () => {
    crmTasks.create.mockResolvedValue({ id: 'task-1' });
    await controller.createTask(USER, {
      title: 'Follow up',
      customerId: CUSTOMER_ID,
      dueAt: '2026-07-01T12:00:00.000Z',
    } as never);
    expect(crmTasks.create).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({
        title: 'Follow up',
        dueAt: new Date('2026-07-01T12:00:00.000Z'),
      }),
    );
  });

  it('lists support tickets with optional customer filter', async () => {
    await controller.listSupportTickets(USER, CUSTOMER_ID);
    expect(crmExtended.listSupportTickets).toHaveBeenCalledWith(ORG_ID, CUSTOMER_ID);
  });

  it('creates support ticket', async () => {
    crmExtended.createSupportTicket.mockResolvedValue({ id: 'st-1' });
    await controller.createSupportTicket(USER, {
      customerId: CUSTOMER_ID,
      subject: 'Help',
      priority: 'HIGH',
    } as never);
    expect(crmExtended.createSupportTicket).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ customerId: CUSTOMER_ID, subject: 'Help', priority: 'HIGH' }),
    );
  });

  it('lists sales opportunities', async () => {
    await controller.listSalesOpportunities(USER);
    expect(crmExtended.listSalesOpportunities).toHaveBeenCalledWith(ORG_ID, undefined);
  });

  it('creates sales opportunity', async () => {
    crmExtended.createSalesOpportunity.mockResolvedValue({ id: 'opp-1' });
    await controller.createSalesOpportunity(USER, {
      customerId: CUSTOMER_ID,
      title: 'Upsell',
      stage: 'QUALIFIED',
      valueCents: 10000,
    } as never);
    expect(crmExtended.createSalesOpportunity).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ customerId: CUSTOMER_ID, title: 'Upsell', valueCents: 10000 }),
    );
  });
});
