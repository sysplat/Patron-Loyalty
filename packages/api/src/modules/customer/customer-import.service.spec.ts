import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  CUSTOMER_IMPORT_MAX_ROWS,
  customerImportRowSchema,
  parseCustomerImportConsent,
} from '@queueplatform/shared';
import { CustomerImportService } from './customer-import.service';
import { parseCsvText, csvRowsToObjects, mapCsvHeaderToField } from './customer-import-csv.util';

describe('customer-import-csv.util', () => {
  it('parses quoted commas and normalizes headers', () => {
    const text = 'name,email,phone\n"Doe, Jane",jane@ex.com,+15551234567\n';
    const matrix = parseCsvText(text);
    const { records } = csvRowsToObjects(matrix);
    expect(records).toHaveLength(1);
    expect(records[0]!.record.name).toBe('Doe, Jane');
    expect(records[0]!.rowNumber).toBe(2);
  });

  it('maps header aliases', () => {
    expect(mapCsvHeaderToField('External ID')).toBe('externalId');
    expect(mapCsvHeaderToField('opening points')).toBe('openingPoints');
    expect(mapCsvHeaderToField('ZIP')).toBe('postalCode');
  });
});

describe('parseCustomerImportConsent', () => {
  it('maps yes/granted to true and blank to undefined', () => {
    expect(parseCustomerImportConsent('yes')).toBe(true);
    expect(parseCustomerImportConsent('GRANTED')).toBe(true);
    expect(parseCustomerImportConsent('opted_in')).toBe(true);
    expect(parseCustomerImportConsent('no')).toBe(false);
    expect(parseCustomerImportConsent('')).toBeUndefined();
    expect(parseCustomerImportConsent(undefined)).toBeUndefined();
  });
});

describe('customerImportRowSchema', () => {
  it('requires name and email or phone', () => {
    expect(customerImportRowSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(customerImportRowSchema.safeParse({ name: 'A', email: 'a@ex.com' }).success).toBe(true);
  });

  it('normalizes phone and rejects invalid', () => {
    const ok = customerImportRowSchema.safeParse({
      name: 'A',
      phone: '+1 (555) 123-4567',
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.phone).toMatch(/^\+/);

    const bad = customerImportRowSchema.safeParse({ name: 'A', phone: 'not-a-phone' });
    expect(bad.success).toBe(false);
  });

  it('parses tags and opening points', () => {
    const ok = customerImportRowSchema.safeParse({
      name: 'A',
      email: 'a@ex.com',
      tags: 'vip; local',
      openingPoints: '100',
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.tags).toEqual(['vip', 'local']);
      expect(ok.data.openingPoints).toBe(100);
    }
  });
});

describe('CustomerImportService', () => {
  const orgId = 'org-1';
  let prisma: {
    withTenant: ReturnType<typeof vi.fn>;
  };
  let accounts: {
    ensureAccount: ReturnType<typeof vi.fn>;
    adjustPoints: ReturnType<typeof vi.fn>;
  };
  let patronCrm: { requireEnabled: ReturnType<typeof vi.fn> };
  let service: CustomerImportService;
  let customerStore: Array<Record<string, unknown>>;

  beforeEach(() => {
    customerStore = [];
    prisma = {
      withTenant: vi.fn(async (_org: string, fn: (tx: unknown) => unknown) => {
        const tx = {
          customer: {
            findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
              if (where.externalId) {
                return customerStore.find((c) => c.externalId === where.externalId) ?? null;
              }
              if (where.email) {
                return customerStore.find((c) => c.email === where.email) ?? null;
              }
              if (where.OR) {
                return (
                  customerStore.find((c) =>
                    (where.OR as Array<{ phone?: string }>).some(
                      (clause) => clause.phone && c.phone === clause.phone,
                    ),
                  ) ?? null
                );
              }
              return null;
            }),
            create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
              const row = { id: `cust-${customerStore.length + 1}`, ...data };
              customerStore.push(row);
              return { id: row.id };
            }),
            update: vi.fn(async ({ where, data }: { where: { id: string }; data: object }) => {
              const idx = customerStore.findIndex((c) => c.id === where.id);
              if (idx >= 0) {
                customerStore[idx] = { ...customerStore[idx], ...data };
              }
              return customerStore[idx];
            }),
          },
        };
        return fn(tx);
      }),
    };
    accounts = {
      ensureAccount: vi.fn().mockResolvedValue({ id: 'acct-1' }),
      adjustPoints: vi.fn().mockResolvedValue({ pointsBalance: 50 }),
    };
    patronCrm = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
    service = new CustomerImportService(prisma as any, patronCrm as any, accounts as any);
  });

  function csvFile(body: string) {
    const buffer = Buffer.from(body, 'utf8');
    return { buffer, size: buffer.byteLength, originalname: 'patrons.csv' };
  }

  it('creates patrons and credits opening points once', async () => {
    const result = await service.importCsv(
      orgId,
      csvFile(
        'name,email,phone,external_id,opening_points,marketing_sms_consent\n' +
          'Ada Lovelace,ada@ex.com,+15551110001,ext-1,50,yes\n',
      ),
    );
    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.errors).toBe(0);
    expect(accounts.ensureAccount).toHaveBeenCalledWith(orgId, 'cust-1');
    expect(accounts.adjustPoints).toHaveBeenCalledWith(
      orgId,
      'cust-1',
      50,
      'CSV import opening balance',
    );
    expect(customerStore[0]!.marketingSmsConsent).toBe('GRANTED');
    expect(customerStore[0]!.marketingConsentSource).toBe('csv_import');
  });

  it('upserts by external_id without re-crediting points', async () => {
    customerStore.push({
      id: 'cust-existing',
      orgId,
      externalId: 'ext-1',
      email: 'old@ex.com',
      phone: '+15551110001',
      metadata: {},
    });
    const result = await service.importCsv(
      orgId,
      csvFile(
        'name,email,phone,external_id,opening_points\n' +
          'Ada Updated,ada@ex.com,+15551110001,ext-1,99\n',
      ),
    );
    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
    expect(accounts.adjustPoints).not.toHaveBeenCalled();
    expect(customerStore[0]!.name).toBe('Ada Updated');
  });

  it('match order prefers external_id over email', async () => {
    customerStore.push({
      id: 'by-ext',
      orgId,
      externalId: 'ext-9',
      email: 'other@ex.com',
      metadata: {},
    });
    customerStore.push({
      id: 'by-email',
      orgId,
      email: 'ada@ex.com',
      metadata: {},
    });
    const result = await service.importCsv(
      orgId,
      csvFile('name,email,external_id\nAda,ada@ex.com,ext-9\n'),
    );
    expect(result.updated).toBe(1);
    expect(result.rows[0]!.customerId).toBe('by-ext');
  });

  it('flags duplicate identities inside the same file', async () => {
    const result = await service.importCsv(
      orgId,
      csvFile('name,email\n' + 'One,same@ex.com\n' + 'Two,same@ex.com\n'),
    );
    expect(result.created).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.rows[1]!.error).toMatch(/Duplicate identity/i);
  });

  it('rejects oversize row counts', async () => {
    const lines = ['name,email'];
    for (let i = 0; i < CUSTOMER_IMPORT_MAX_ROWS + 1; i++) {
      lines.push(`Person ${i},p${i}@ex.com`);
    }
    await expect(service.importCsv(orgId, csvFile(lines.join('\n')))).rejects.toThrow(/maximum is/);
  });
});
