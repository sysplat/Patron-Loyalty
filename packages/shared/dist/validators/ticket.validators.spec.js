"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ticket_validators_1 = require("./ticket.validators");
(0, vitest_1.describe)('issueTicketSchema', () => {
    (0, vitest_1.it)('accepts a valid staff issue payload', () => {
        const result = ticket_validators_1.issueTicketSchema.safeParse({
            branchId: '550e8400-e29b-41d4-a716-446655440000',
            queueId: '550e8400-e29b-41d4-a716-446655440001',
            serviceId: '550e8400-e29b-41d4-a716-446655440002',
            customerName: 'Jane Doe',
            source: 'staff',
        });
        (0, vitest_1.expect)(result.success).toBe(true);
    });
    (0, vitest_1.it)('rejects invalid queue UUIDs', () => {
        const result = ticket_validators_1.issueTicketSchema.safeParse({
            branchId: '550e8400-e29b-41d4-a716-446655440000',
            queueId: 'not-a-uuid',
            serviceId: '550e8400-e29b-41d4-a716-446655440002',
        });
        (0, vitest_1.expect)(result.success).toBe(false);
    });
});
(0, vitest_1.describe)('publicJoinQueueSchema', () => {
    (0, vitest_1.it)('requires org, branch, queue, and service identifiers', () => {
        const result = ticket_validators_1.publicJoinQueueSchema.safeParse({
            orgId: '550e8400-e29b-41d4-a716-446655440000',
            branchId: '550e8400-e29b-41d4-a716-446655440001',
            queueId: '550e8400-e29b-41d4-a716-446655440002',
            serviceId: '550e8400-e29b-41d4-a716-446655440003',
            customerPhone: '+15550001234',
        });
        (0, vitest_1.expect)(result.success).toBe(true);
    });
    (0, vitest_1.it)('rejects malformed phone numbers', () => {
        const result = ticket_validators_1.publicJoinQueueSchema.safeParse({
            orgId: '550e8400-e29b-41d4-a716-446655440000',
            branchId: '550e8400-e29b-41d4-a716-446655440001',
            queueId: '550e8400-e29b-41d4-a716-446655440002',
            serviceId: '550e8400-e29b-41d4-a716-446655440003',
            customerPhone: 'abc',
        });
        (0, vitest_1.expect)(result.success).toBe(false);
    });
});
//# sourceMappingURL=ticket.validators.spec.js.map