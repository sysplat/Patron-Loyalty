import { describe, it, expect } from 'vitest';
import { issueTicketSchema, publicJoinQueueSchema } from './ticket.validators';

describe('issueTicketSchema', () => {
  it('accepts a valid staff issue payload', () => {
    const result = issueTicketSchema.safeParse({
      branchId: '550e8400-e29b-41d4-a716-446655440000',
      queueId: '550e8400-e29b-41d4-a716-446655440001',
      serviceId: '550e8400-e29b-41d4-a716-446655440002',
      customerName: 'Jane Doe',
      source: 'staff',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid queue UUIDs', () => {
    const result = issueTicketSchema.safeParse({
      branchId: '550e8400-e29b-41d4-a716-446655440000',
      queueId: 'not-a-uuid',
      serviceId: '550e8400-e29b-41d4-a716-446655440002',
    });
    expect(result.success).toBe(false);
  });
});

describe('publicJoinQueueSchema', () => {
  it('requires org, branch, queue, and service identifiers', () => {
    const result = publicJoinQueueSchema.safeParse({
      orgId: '550e8400-e29b-41d4-a716-446655440000',
      branchId: '550e8400-e29b-41d4-a716-446655440001',
      queueId: '550e8400-e29b-41d4-a716-446655440002',
      serviceId: '550e8400-e29b-41d4-a716-446655440003',
      customerPhone: '+15550001234',
    });
    expect(result.success).toBe(true);
  });

  it('rejects malformed phone numbers', () => {
    const result = publicJoinQueueSchema.safeParse({
      orgId: '550e8400-e29b-41d4-a716-446655440000',
      branchId: '550e8400-e29b-41d4-a716-446655440001',
      queueId: '550e8400-e29b-41d4-a716-446655440002',
      serviceId: '550e8400-e29b-41d4-a716-446655440003',
      customerPhone: 'abc',
    });
    expect(result.success).toBe(false);
  });
});
