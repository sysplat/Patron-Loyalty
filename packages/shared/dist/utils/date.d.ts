/**
 * Format minutes into a human-readable duration string.
 */
export declare function formatWaitTime(minutes: number): string;
/**
 * Parse a time string like "09:00" into hours and minutes.
 */
export declare function parseTimeString(time: string): {
    hours: number;
    minutes: number;
};
/**
 * Check if a given time falls within a schedule window.
 */
export declare function isWithinSchedule(currentTime: string, openTime: string, closeTime: string): boolean;
/**
 * Get the current day of week (0 = Monday ... 6 = Sunday).
 */
export declare function getCurrentDayOfWeek(timezone?: string): number;
/**
 * Format a date to ISO date string (YYYY-MM-DD).
 */
export declare function toISODate(date: Date): string;
/**
 * Validates and normalizes an IANA timezone identifier.
 *
 * Uses `Intl.DateTimeFormat` to confirm the timezone is recognized by the
 * runtime. Branch creation, appointment slot calculation, and working-hours
 * queries all rely on a valid IANA zone string; if an unrecognized value is
 * stored the entire slot-generation pipeline will throw at runtime.
 *
 * Accepts and preserves any valid IANA zone string (e.g. `America/Vancouver`,
 * `Europe/London`, `Asia/Tehran`). Falls back to `'UTC'` on invalid input.
 */
export declare function normalizeTimeZone(timeZone?: string | null): string;
//# sourceMappingURL=date.d.ts.map