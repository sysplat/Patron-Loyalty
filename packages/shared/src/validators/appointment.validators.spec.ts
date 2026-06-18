import { describe, it, expect } from 'vitest';
import { bookAppointmentSchema, updateAppointmentSchema } from './appointment.validators';

describe('bookAppointmentSchema', () => {
  it('accepts a valid booking payload', () => {
    const result = bookAppointmentSchema.safeParse({
      branchId: '550e8400-e29b-41d4-a716-446655440000',
      serviceId: '550e8400-e29b-41d4-a716-446655440001',
      customerName: 'Alex Smith',
      scheduledAt: '2026-05-24T15:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing customer name', () => {
    const result = bookAppointmentSchema.safeParse({
      branchId: '550e8400-e29b-41d4-a716-446655440000',
      serviceId: '550e8400-e29b-41d4-a716-446655440001',
      scheduledAt: '2026-05-24T15:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateAppointmentSchema', () => {
  it('allows partial status updates', () => {
    const result = updateAppointmentSchema.safeParse({ status: 'confirmed' });
    expect(result.success).toBe(true);
  });
});
