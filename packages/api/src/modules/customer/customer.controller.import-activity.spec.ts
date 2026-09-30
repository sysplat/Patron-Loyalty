import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LOYALTY_ACTIVITY_ACTIONS, LOYALTY_ACTIVITY_RESOURCE_TYPES } from '@queueplatform/shared';
import { CustomerController } from './customer.controller';

const ORG_ID = '00000000-0000-0000-0000-000000000099';
const USER = {
  userId: 'staff-1',
  orgId: ORG_ID,
  email: 'staff@example.com',
} as never;

describe('CustomerController CSV import activity logging', () => {
  const customerService = {};
  const customerImport = { importCsv: vi.fn() };
  const audit = { logActivity: vi.fn().mockResolvedValue(undefined) };
  let controller: CustomerController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new CustomerController(
      customerService as never,
      customerImport as never,
      audit as never,
    );
  });

  it('logs loyalty.patrons.csv_imported after successful import', async () => {
    customerImport.importCsv.mockResolvedValue({
      created: 2,
      updated: 1,
      errors: 0,
      rows: [],
    });
    await controller.importCsv(USER, {
      buffer: Buffer.from('x'),
      size: 1,
      originalname: 'patrons.csv',
    });
    expect(customerImport.importCsv).toHaveBeenCalled();
    expect(audit.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: ORG_ID,
        userId: 'staff-1',
        action: LOYALTY_ACTIVITY_ACTIONS.PATRONS_CSV_IMPORTED,
        resourceType: LOYALTY_ACTIVITY_RESOURCE_TYPES.CUSTOMER,
        metadata: expect.objectContaining({
          created: 2,
          updated: 1,
          errors: 0,
          filename: 'patrons.csv',
        }),
      }),
    );
  });
});
