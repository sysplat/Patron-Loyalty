import { describe, it, expect } from 'vitest';
import { createBranchSchema, updateBranchCustomerNoticeSchema } from './branch.validators';

describe('createBranchSchema', () => {
  it('accepts a valid branch payload', () => {
    const result = createBranchSchema.safeParse({
      name: 'Downtown',
      timezone: 'America/New_York',
      phone: '+15550001234',
    });
    expect(result.success).toBe(true);
  });

  it('requires timezone', () => {
    const result = createBranchSchema.safeParse({
      name: 'Downtown',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email addresses', () => {
    const result = createBranchSchema.safeParse({
      name: 'Downtown',
      timezone: 'UTC',
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateBranchCustomerNoticeSchema', () => {
  it('accepts notice toggle and minutes', () => {
    const result = updateBranchCustomerNoticeSchema.safeParse({
      exceptionalCustomerNotice: true,
      exceptionalCustomerNoticeMinutes: 15,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty body', () => {
    const result = updateBranchCustomerNoticeSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
