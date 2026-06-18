"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAppointmentSchema = exports.bookAppointmentSchema = exports.bookAppointmentBaseSchema = void 0;
const zod_1 = require("zod");
const datetime_1 = require("./datetime");
const phone_1 = require("../utils/phone");
const optionalPhone = zod_1.z
    .string()
    .transform((val, ctx) => {
    if (!val || val.trim() === '')
        return undefined;
    const normalized = (0, phone_1.normalizeSmsRecipient)(val);
    if (normalized === null) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Invalid phone number — use international format e.g. +15550001234',
        });
        return zod_1.z.NEVER;
    }
    return normalized;
})
    .optional();
exports.bookAppointmentBaseSchema = zod_1.z.object({
    branchId: zod_1.z.string().uuid(),
    serviceId: zod_1.z.string().uuid(),
    subServiceId: zod_1.z.string().uuid().optional(),
    customerName: zod_1.z.string().min(1).max(100),
    customerEmail: zod_1.z.string().email().optional(),
    customerPhone: optionalPhone,
    scheduledAt: datetime_1.dateTimeString,
    notes: zod_1.z.string().max(500).optional(),
    transactionalSmsAllowed: zod_1.z.boolean().optional(),
    marketingSmsConsent: zod_1.z.boolean().optional(),
    marketingEmailConsent: zod_1.z.boolean().optional(),
});
exports.bookAppointmentSchema = exports.bookAppointmentBaseSchema.superRefine((data, ctx) => {
    if (data.transactionalSmsAllowed && !data.customerPhone) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Phone number is required when SMS notifications are enabled',
            path: ['customerPhone'],
        });
    }
});
exports.updateAppointmentSchema = zod_1.z.object({
    status: zod_1.z.string().max(50).optional(),
    assignedUserId: zod_1.z.string().uuid().optional(),
    notes: zod_1.z.string().max(2000).optional(),
});
//# sourceMappingURL=appointment.validators.js.map