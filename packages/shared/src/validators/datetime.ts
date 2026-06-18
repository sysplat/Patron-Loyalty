import { z } from 'zod';

/** True when `Date.parse` accepts the value (ISO, datetime-local, date-only, etc.). */
export function isParseableDateTimeString(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !Number.isNaN(Date.parse(trimmed));
}

/**
 * Lenient date/time string for API inputs from browsers (`datetime-local`, date-only)
 * and full ISO-8601. Stricter than accepting any string, looser than `z.string().datetime()`.
 */
export const dateTimeString = z
  .string()
  .trim()
  .refine(isParseableDateTimeString, { message: 'Invalid date/time' });

export const optionalDateTimeString = dateTimeString.optional();

export const nullableOptionalDateTimeString = z.union([dateTimeString, z.null()]).optional();
