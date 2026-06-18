"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTicketPreferencesSchema = exports.transferTicketSchema = exports.callTicketSchema = exports.changeDeskTicketSchema = exports.transferTicketBodySchema = exports.cancelTicketSchema = exports.completeTicketBodySchema = exports.updateTicketEstimatesSchema = exports.anonymizeCustomerSchema = exports.ticketIdsBodySchema = exports.ticketIdBodySchema = exports.callWaitingTicketSchema = exports.callNextTicketSchema = exports.bookTicketSchema = exports.createVisitStepSchema = exports.publicJoinQueueSchema = exports.issueTicketStaffSchema = exports.issueTicketSchema = void 0;
const zod_1 = require("zod");
const phone_1 = require("../utils/phone");
const common_validators_1 = require("./common.validators");
const optionalPhone = zod_1.z
    .string()
    .transform((val, ctx) => {
    if (!val || val.trim() === '')
        return undefined;
    const n = (0, phone_1.normalizeSmsRecipient)(val);
    if (n === null) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Invalid phone number — use international format e.g. +15550001234',
        });
        return zod_1.z.NEVER;
    }
    return n;
})
    .optional();
const issueTicketFields = {
    queueId: common_validators_1.uuidSchema,
    branchId: common_validators_1.uuidSchema,
    serviceId: common_validators_1.uuidSchema,
    deskNumber: common_validators_1.deskNumberSchema.optional(),
    customerId: common_validators_1.uuidSchema.optional(),
    customerName: zod_1.z.string().max(100).trim().optional(),
    customerPhone: optionalPhone,
    customerEmail: zod_1.z.string().email('Invalid email').optional(),
    source: common_validators_1.ticketSourceSchema.optional(),
    priority: zod_1.z.number().int().min(0).max(10).optional(),
    language: zod_1.z.string().max(10).optional(),
    note: zod_1.z.string().max(500).optional(),
    transactionalSmsAllowed: zod_1.z.boolean().optional(),
    marketingSmsConsent: zod_1.z.boolean().optional(),
    marketingEmailConsent: zod_1.z.boolean().optional(),
};
const ticketSuperRefine = (data, ctx) => {
    if (data.transactionalSmsAllowed && !data.customerPhone) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Phone number is required when SMS notifications are enabled',
            path: ['customerPhone'],
        });
    }
};
exports.issueTicketSchema = zod_1.z
    .object({
    orgId: common_validators_1.uuidSchema.optional(),
    ...issueTicketFields,
})
    .superRefine(ticketSuperRefine);
exports.issueTicketStaffSchema = zod_1.z.object({
    ...issueTicketFields,
});
exports.publicJoinQueueSchema = zod_1.z
    .object({
    orgId: common_validators_1.uuidSchema,
    branchId: common_validators_1.uuidSchema,
    queueId: common_validators_1.uuidSchema,
    serviceId: common_validators_1.uuidSchema,
    customerName: zod_1.z.string().max(100).trim().optional(),
    customerPhone: optionalPhone,
    language: zod_1.z.string().max(10).optional(),
    transactionalSmsAllowed: zod_1.z.boolean().optional(),
    marketingSmsConsent: zod_1.z.boolean().optional(),
    marketingEmailConsent: zod_1.z.boolean().optional(),
})
    .superRefine(ticketSuperRefine);
exports.createVisitStepSchema = zod_1.z
    .object({
    queueId: common_validators_1.uuidSchema,
    serviceId: common_validators_1.uuidSchema,
    deskNumber: common_validators_1.deskNumberSchema.optional(),
    customerName: zod_1.z.string().max(100).trim().optional(),
    customerPhone: optionalPhone,
    language: zod_1.z.string().max(10).optional(),
    note: zod_1.z.string().max(500).optional(),
    source: common_validators_1.ticketSourceSchema.optional(),
    priority: zod_1.z.number().int().min(0).max(10).optional(),
    transactionalSmsAllowed: zod_1.z.boolean().optional(),
    marketingSmsConsent: zod_1.z.boolean().optional(),
    marketingEmailConsent: zod_1.z.boolean().optional(),
})
    .superRefine(ticketSuperRefine);
exports.bookTicketSchema = zod_1.z.object({
    queueId: common_validators_1.uuidSchema,
    customerName: zod_1.z.string().max(100).trim().optional(),
    customerPhone: optionalPhone,
    customerEmail: zod_1.z.string().email('Invalid email').optional(),
    source: common_validators_1.ticketSourceSchema.optional().default('online'),
    priority: zod_1.z.number().int().min(0).max(10).optional().default(0),
});
exports.callNextTicketSchema = zod_1.z.object({
    queueId: common_validators_1.uuidSchema,
    deskNumber: common_validators_1.deskNumberSchema,
    deskFilterActive: zod_1.z.boolean().optional(),
});
/** Classic single-step: call a specific waiting ticket (manual / ready-then-manual policies). */
exports.callWaitingTicketSchema = zod_1.z.object({
    ticketId: common_validators_1.uuidSchema,
    deskNumber: common_validators_1.deskNumberSchema,
});
exports.ticketIdBodySchema = zod_1.z.object({
    ticketId: common_validators_1.uuidSchema,
});
exports.ticketIdsBodySchema = zod_1.z.object({
    ticketIds: zod_1.z.array(common_validators_1.uuidSchema).min(1),
});
exports.anonymizeCustomerSchema = zod_1.z.object({
    customerId: common_validators_1.uuidSchema.optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    dryRun: zod_1.z.boolean().optional(),
});
exports.updateTicketEstimatesSchema = zod_1.z.object({
    estimatedRemainingMins: zod_1.z.number().int().min(0).nullable().optional(),
});
exports.completeTicketBodySchema = zod_1.z.object({
    externalRef: zod_1.z.string().max(100).optional(),
});
exports.cancelTicketSchema = zod_1.z.object({
    reason: zod_1.z.string().max(500).optional(),
});
exports.transferTicketBodySchema = zod_1.z.object({
    targetQueueId: common_validators_1.uuidSchema.optional(),
    targetDeskNumber: common_validators_1.deskNumberSchema.optional(),
    externalRef: zod_1.z.string().max(100).optional(),
});
exports.changeDeskTicketSchema = zod_1.z.object({
    targetDeskNumber: common_validators_1.deskNumberSchema,
});
/** @deprecated Legacy shape; prefer callWaitingTicketSchema for agent console row calls. */
exports.callTicketSchema = zod_1.z.object({
    queueId: common_validators_1.uuidSchema,
    deskNumber: common_validators_1.deskNumberSchema.optional(),
    staffUserId: common_validators_1.uuidSchema,
});
exports.transferTicketSchema = zod_1.z.object({
    targetQueueId: common_validators_1.uuidSchema,
    targetDeskNumber: common_validators_1.deskNumberSchema.optional(),
});
exports.updateTicketPreferencesSchema = zod_1.z.object({
    transactionalSmsAllowed: zod_1.z.boolean(),
});
//# sourceMappingURL=ticket.validators.js.map