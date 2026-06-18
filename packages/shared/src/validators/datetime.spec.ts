import { describe, it, expect } from 'vitest';
import { createAnnouncementSchema } from './announcement.validators';
import { bookAppointmentSchema } from './appointment.validators';

const uuid = '550e8400-e29b-41d4-a716-446655440000';
const uuid2 = '550e8400-e29b-41d4-a716-446655440001';

describe('flexible date/time validators', () => {
  it('accepts datetime-local and date-only announcement windows', () => {
    expect(
      createAnnouncementSchema.safeParse({
        message: 'Hello',
        activeFrom: '2024-05-25T09:30',
        activeUntil: '2026-04-30',
      }).success,
    ).toBe(true);
  });

  it('accepts full ISO announcement windows', () => {
    expect(
      createAnnouncementSchema.safeParse({
        message: 'Hello',
        activeFrom: '2024-05-25T09:30:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('rejects unparseable announcement dates', () => {
    const result = createAnnouncementSchema.safeParse({
      message: 'Hello',
      activeFrom: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('accepts kiosk-style scheduledAt strings for booking', () => {
    expect(
      bookAppointmentSchema.safeParse({
        branchId: uuid,
        serviceId: uuid2,
        customerName: 'Pat',
        scheduledAt: '2024-05-25T09:30',
      }).success,
    ).toBe(true);
  });
});
