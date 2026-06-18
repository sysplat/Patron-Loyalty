"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const announcement_validators_1 = require("./announcement.validators");
const appointment_validators_1 = require("./appointment.validators");
const uuid = '550e8400-e29b-41d4-a716-446655440000';
const uuid2 = '550e8400-e29b-41d4-a716-446655440001';
(0, vitest_1.describe)('flexible date/time validators', () => {
    (0, vitest_1.it)('accepts datetime-local and date-only announcement windows', () => {
        (0, vitest_1.expect)(announcement_validators_1.createAnnouncementSchema.safeParse({
            message: 'Hello',
            activeFrom: '2024-05-25T09:30',
            activeUntil: '2026-04-30',
        }).success).toBe(true);
    });
    (0, vitest_1.it)('accepts full ISO announcement windows', () => {
        (0, vitest_1.expect)(announcement_validators_1.createAnnouncementSchema.safeParse({
            message: 'Hello',
            activeFrom: '2024-05-25T09:30:00.000Z',
        }).success).toBe(true);
    });
    (0, vitest_1.it)('rejects unparseable announcement dates', () => {
        const result = announcement_validators_1.createAnnouncementSchema.safeParse({
            message: 'Hello',
            activeFrom: 'not-a-date',
        });
        (0, vitest_1.expect)(result.success).toBe(false);
    });
    (0, vitest_1.it)('accepts kiosk-style scheduledAt strings for booking', () => {
        (0, vitest_1.expect)(appointment_validators_1.bookAppointmentSchema.safeParse({
            branchId: uuid,
            serviceId: uuid2,
            customerName: 'Pat',
            scheduledAt: '2024-05-25T09:30',
        }).success).toBe(true);
    });
});
//# sourceMappingURL=datetime.spec.js.map