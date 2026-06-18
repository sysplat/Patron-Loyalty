"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const branch_hours_1 = require("./branch-hours");
(0, vitest_1.describe)('branch-hours', () => {
    (0, vitest_1.it)('maps ISO dates to schema day-of-week (Mon=0)', () => {
        (0, vitest_1.expect)((0, branch_hours_1.toSchemaDayOfWeekFromIsoDate)('2026-06-15')).toBe(0); // Monday
        (0, vitest_1.expect)((0, branch_hours_1.toSchemaDayOfWeekFromIsoDate)('2026-06-14')).toBe(6); // Sunday
    });
    (0, vitest_1.it)('evaluates open window for instant inside hours', () => {
        const at = (0, branch_hours_1.zonedDateTimeToUtc)('2026-06-15', '10:00', 'America/New_York');
        const result = (0, branch_hours_1.evaluateBranchAvailabilityAtInstant)(at, 'America/New_York', {
            openTime: '09:00',
            closeTime: '17:00',
            isClosed: false,
            breakStart: null,
            breakEnd: null,
        }, '2026-06-15');
        (0, vitest_1.expect)(result.isOpen).toBe(true);
        (0, vitest_1.expect)(result.reason).toBe('open');
    });
    (0, vitest_1.it)('evaluates break window', () => {
        const at = (0, branch_hours_1.zonedDateTimeToUtc)('2026-06-15', '12:30', 'America/New_York');
        const result = (0, branch_hours_1.evaluateBranchAvailabilityAtInstant)(at, 'America/New_York', {
            openTime: '09:00',
            closeTime: '17:00',
            isClosed: false,
            breakStart: '12:00',
            breakEnd: '13:00',
        }, '2026-06-15');
        (0, vitest_1.expect)(result.isOpen).toBe(false);
        (0, vitest_1.expect)(result.reason).toBe('break');
    });
    (0, vitest_1.it)('evaluates outside hours before open', () => {
        const at = (0, branch_hours_1.zonedDateTimeToUtc)('2026-06-15', '08:00', 'America/New_York');
        const result = (0, branch_hours_1.evaluateBranchAvailabilityAtInstant)(at, 'America/New_York', {
            openTime: '09:00',
            closeTime: '17:00',
            isClosed: false,
            breakStart: null,
            breakEnd: null,
        }, '2026-06-15');
        (0, vitest_1.expect)(result.isOpen).toBe(false);
        (0, vitest_1.expect)(result.reason).toBe('outside_hours');
    });
    (0, vitest_1.it)('rejects appointment slots overlapping break', () => {
        const start = (0, branch_hours_1.zonedDateTimeToUtc)('2026-06-15', '11:45', 'America/New_York');
        const reason = (0, branch_hours_1.evaluateAppointmentSlotAgainstWindow)(start, 30, 'America/New_York', {
            openTime: '09:00',
            closeTime: '17:00',
            isClosed: false,
            breakStart: '12:00',
            breakEnd: '13:00',
        }, '2026-06-15');
        (0, vitest_1.expect)(reason).toBe('break');
    });
    (0, vitest_1.it)('derives local date key from UTC instant', () => {
        const at = new Date('2026-06-15T03:30:00.000Z');
        (0, vitest_1.expect)((0, branch_hours_1.getDateKeyInTimeZone)(at, 'America/New_York')).toBe('2026-06-14');
    });
});
//# sourceMappingURL=branch-hours.spec.js.map