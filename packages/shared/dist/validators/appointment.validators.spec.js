"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const appointment_validators_1 = require("./appointment.validators");
(0, vitest_1.describe)('bookAppointmentSchema', () => {
    (0, vitest_1.it)('accepts a valid booking payload', () => {
        const result = appointment_validators_1.bookAppointmentSchema.safeParse({
            branchId: '550e8400-e29b-41d4-a716-446655440000',
            serviceId: '550e8400-e29b-41d4-a716-446655440001',
            customerName: 'Alex Smith',
            scheduledAt: '2026-05-24T15:00:00.000Z',
        });
        (0, vitest_1.expect)(result.success).toBe(true);
    });
    (0, vitest_1.it)('rejects missing customer name', () => {
        const result = appointment_validators_1.bookAppointmentSchema.safeParse({
            branchId: '550e8400-e29b-41d4-a716-446655440000',
            serviceId: '550e8400-e29b-41d4-a716-446655440001',
            scheduledAt: '2026-05-24T15:00:00.000Z',
        });
        (0, vitest_1.expect)(result.success).toBe(false);
    });
});
(0, vitest_1.describe)('updateAppointmentSchema', () => {
    (0, vitest_1.it)('allows partial status updates', () => {
        const result = appointment_validators_1.updateAppointmentSchema.safeParse({ status: 'confirmed' });
        (0, vitest_1.expect)(result.success).toBe(true);
    });
});
//# sourceMappingURL=appointment.validators.spec.js.map