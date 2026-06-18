import { describe, expect, it } from 'vitest';
import {
  evaluateAppointmentSlotAgainstWindow,
  evaluateBranchAvailabilityAtInstant,
  getDateKeyInTimeZone,
  toSchemaDayOfWeekFromIsoDate,
  zonedDateTimeToUtc,
} from './branch-hours';

describe('branch-hours', () => {
  it('maps ISO dates to schema day-of-week (Mon=0)', () => {
    expect(toSchemaDayOfWeekFromIsoDate('2026-06-15')).toBe(0); // Monday
    expect(toSchemaDayOfWeekFromIsoDate('2026-06-14')).toBe(6); // Sunday
  });

  it('evaluates open window for instant inside hours', () => {
    const at = zonedDateTimeToUtc('2026-06-15', '10:00', 'America/New_York');
    const result = evaluateBranchAvailabilityAtInstant(
      at,
      'America/New_York',
      {
        openTime: '09:00',
        closeTime: '17:00',
        isClosed: false,
        breakStart: null,
        breakEnd: null,
      },
      '2026-06-15',
    );
    expect(result.isOpen).toBe(true);
    expect(result.reason).toBe('open');
  });

  it('evaluates break window', () => {
    const at = zonedDateTimeToUtc('2026-06-15', '12:30', 'America/New_York');
    const result = evaluateBranchAvailabilityAtInstant(
      at,
      'America/New_York',
      {
        openTime: '09:00',
        closeTime: '17:00',
        isClosed: false,
        breakStart: '12:00',
        breakEnd: '13:00',
      },
      '2026-06-15',
    );
    expect(result.isOpen).toBe(false);
    expect(result.reason).toBe('break');
  });

  it('evaluates outside hours before open', () => {
    const at = zonedDateTimeToUtc('2026-06-15', '08:00', 'America/New_York');
    const result = evaluateBranchAvailabilityAtInstant(
      at,
      'America/New_York',
      {
        openTime: '09:00',
        closeTime: '17:00',
        isClosed: false,
        breakStart: null,
        breakEnd: null,
      },
      '2026-06-15',
    );
    expect(result.isOpen).toBe(false);
    expect(result.reason).toBe('outside_hours');
  });

  it('rejects appointment slots overlapping break', () => {
    const start = zonedDateTimeToUtc('2026-06-15', '11:45', 'America/New_York');
    const reason = evaluateAppointmentSlotAgainstWindow(
      start,
      30,
      'America/New_York',
      {
        openTime: '09:00',
        closeTime: '17:00',
        isClosed: false,
        breakStart: '12:00',
        breakEnd: '13:00',
      },
      '2026-06-15',
    );
    expect(reason).toBe('break');
  });

  it('derives local date key from UTC instant', () => {
    const at = new Date('2026-06-15T03:30:00.000Z');
    expect(getDateKeyInTimeZone(at, 'America/New_York')).toBe('2026-06-14');
  });
});
