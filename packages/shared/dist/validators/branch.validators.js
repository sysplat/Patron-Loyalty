"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertDateOverrideSchema = exports.setWorkingHoursSchema = exports.updateBranchCustomerNoticeSchema = exports.updateBranchSchema = exports.createBranchSchema = void 0;
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
exports.createBranchSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Branch name is required').max(100).trim(),
    address: zod_1.z.string().max(500).optional(),
    lat: zod_1.z.number().min(-90).max(90).optional(),
    lng: zod_1.z.number().min(-180).max(180).optional(),
    timezone: zod_1.z.string().min(1, 'Timezone is required'),
    phone: optionalPhone,
    email: zod_1.z.string().email('Invalid email').optional(),
    defaultJourneyMode: common_validators_1.journeyModeSchema.optional(),
    initialDesksCount: zod_1.z.number().int().min(0).max(100).optional(),
});
exports.updateBranchSchema = exports.createBranchSchema.partial().extend({
    status: zod_1.z.enum(['active', 'inactive', 'temporarily_closed']).optional(),
    exceptionalCustomerNotice: zod_1.z.boolean().optional(),
    exceptionalCustomerNoticeMinutes: zod_1.z.number().int().min(0).nullable().optional(),
    defaultJourneyMode: common_validators_1.journeyModeSchema.optional(),
});
/** Serve-page notice buffer — staff may update via queue:update (not full branch:update). */
exports.updateBranchCustomerNoticeSchema = zod_1.z
    .object({
    /** Optional branch context for branch-scoped RBAC (ignored when persisting). */
    branchId: zod_1.z.string().uuid().optional(),
    exceptionalCustomerNotice: zod_1.z.boolean().optional(),
    exceptionalCustomerNoticeMinutes: zod_1.z.number().int().min(0).nullable().optional(),
})
    .refine((body) => body.exceptionalCustomerNotice !== undefined ||
    body.exceptionalCustomerNoticeMinutes !== undefined, { message: 'At least one notice field is required' });
const workingHourEntrySchema = zod_1.z.object({
    dayOfWeek: zod_1.z.number().int().min(0).max(6),
    openTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/, 'Time format must be HH:MM'),
    closeTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/, 'Time format must be HH:MM'),
    isClosed: zod_1.z.boolean(),
    breakStart: zod_1.z
        .string()
        .regex(/^\d{2}:\d{2}$/, 'Time format must be HH:MM')
        .optional(),
    breakEnd: zod_1.z
        .string()
        .regex(/^\d{2}:\d{2}$/, 'Time format must be HH:MM')
        .optional(),
});
exports.setWorkingHoursSchema = zod_1.z.object({
    hours: zod_1.z.array(workingHourEntrySchema),
});
exports.upsertDateOverrideSchema = zod_1.z.object({
    date: zod_1.z.string().min(1),
    openTime: zod_1.z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
    closeTime: zod_1.z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
    isClosed: zod_1.z.boolean(),
    breakStart: zod_1.z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
    breakEnd: zod_1.z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
    note: zod_1.z.string().max(255).optional(),
});
//# sourceMappingURL=branch.validators.js.map