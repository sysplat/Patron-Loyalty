"use strict";
// ─── Date utilities ──────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatWaitTime = formatWaitTime;
exports.parseTimeString = parseTimeString;
exports.isWithinSchedule = isWithinSchedule;
exports.getCurrentDayOfWeek = getCurrentDayOfWeek;
exports.toISODate = toISODate;
exports.normalizeTimeZone = normalizeTimeZone;
/**
 * Format minutes into a human-readable duration string.
 */
function formatWaitTime(minutes) {
    if (minutes < 1)
        return 'Less than a minute';
    if (minutes < 60)
        return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const remaining = Math.round(minutes % 60);
    if (remaining === 0)
        return `${hours}h`;
    return `${hours}h ${remaining}m`;
}
/**
 * Parse a time string like "09:00" into hours and minutes.
 */
function parseTimeString(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return { hours: hours ?? 0, minutes: minutes ?? 0 };
}
/**
 * Check if a given time falls within a schedule window.
 */
function isWithinSchedule(currentTime, openTime, closeTime) {
    const current = parseTimeString(currentTime);
    const open = parseTimeString(openTime);
    const close = parseTimeString(closeTime);
    const currentMins = current.hours * 60 + current.minutes;
    const openMins = open.hours * 60 + open.minutes;
    const closeMins = close.hours * 60 + close.minutes;
    return currentMins >= openMins && currentMins < closeMins;
}
/**
 * Get the current day of week (0 = Monday ... 6 = Sunday).
 */
function getCurrentDayOfWeek(timezone) {
    const now = timezone
        ? new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
        : new Date();
    // JS getDay(): 0=Sun, convert to Mon=0
    const jsDay = now.getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
}
/**
 * Format a date to ISO date string (YYYY-MM-DD).
 */
function toISODate(date) {
    return date.toISOString().split('T')[0] ?? '';
}
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
function normalizeTimeZone(timeZone) {
    const normalized = timeZone?.trim();
    if (!normalized)
        return 'UTC';
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: normalized });
        return normalized;
    }
    catch {
        return 'UTC';
    }
}
//# sourceMappingURL=date.js.map