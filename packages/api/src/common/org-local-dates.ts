import { DateTime } from 'luxon';

/** Normalize stored org timezone; invalid IANA values fall back to UTC. */
export function normalizeOrgIanaZone(raw: string | null | undefined): string {
  const candidate = (raw ?? 'UTC').trim() || 'UTC';
  return DateTime.now().setZone(candidate).isValid ? candidate : 'UTC';
}

/** Start of the current org-local calendar day, as a UTC Date (for DB comparisons). */
export function orgLocalStartOfTodayUtc(zoneInput: string): Date {
  const zone = normalizeOrgIanaZone(zoneInput);
  return DateTime.now().setZone(zone).startOf('day').toUTC().toJSDate();
}

/** Start of org-local calendar day N days before today (N=0 → today), as UTC Date. */
export function orgLocalStartOfDayMinusDaysUtc(zoneInput: string, daysBeforeToday: number): Date {
  const zone = normalizeOrgIanaZone(zoneInput);
  return DateTime.now()
    .setZone(zone)
    .minus({ days: daysBeforeToday })
    .startOf('day')
    .toUTC()
    .toJSDate();
}

/**
 * Inclusive org-local yyyy-mm-dd range as UTC half-open interval [start, endExclusive),
 * suitable for Prisma `gte` / `lt` on timestamptz columns.
 */
export function orgLocalInclusiveRangeExclusiveEndUtc(
  zoneInput: string,
  dateFromYmd: string,
  dateToYmd: string,
): { start: Date; endExclusive: Date } {
  const zone = normalizeOrgIanaZone(zoneInput);
  const from = dateFromYmd.trim();
  const to = dateToYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error('INVALID_YMD');
  }
  const start = DateTime.fromISO(`${from}T00:00:00`, { zone }).toUTC();
  const endExclusive = DateTime.fromISO(`${to}T00:00:00`, { zone })
    .plus({ days: 1 })
    .startOf('day')
    .toUTC();
  if (!start.isValid || !endExclusive.isValid) {
    throw new Error('INVALID_YMD');
  }
  if (start >= endExclusive) {
    throw new Error('FROM_AFTER_TO');
  }
  return { start: start.toJSDate(), endExclusive: endExclusive.toJSDate() };
}

export function zonedYmdFromUtcInstant(zoneInput: string, instant: Date): string {
  const zone = normalizeOrgIanaZone(zoneInput);
  return DateTime.fromJSDate(instant, { zone: 'utc' }).setZone(zone).toISODate()!;
}

export function hourInOrgZone(zoneInput: string, instant: Date): number {
  const zone = normalizeOrgIanaZone(zoneInput);
  return DateTime.fromJSDate(instant, { zone: 'utc' }).setZone(zone).hour;
}

export function cacheTokenForZone(zoneInput: string): string {
  return normalizeOrgIanaZone(zoneInput).replace(/\//g, '~');
}
