"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCustomerSegmentSchema = exports.createCustomerSchema = exports.updateCustomerSchema = exports.listCustomersQuerySchema = void 0;
const zod_1 = require("zod");
const customer_crm_1 = require("../constants/customer-crm");
const phone_1 = require("../utils/phone");
const query_validators_1 = require("./query.validators");
const query_validators_2 = require("./query.validators");
exports.listCustomersQuerySchema = query_validators_1.paginationQuerySchema.extend({
    branchId: query_validators_2.optionalUuidQuery,
    search: query_validators_2.optionalSearchQuery,
    segment: zod_1.z.preprocess((v) => (v === '' || v === undefined || v === null ? undefined : v), zod_1.z.enum(customer_crm_1.CUSTOMER_SEGMENT_PRESET_VALUES).optional()),
    savedSegmentId: query_validators_2.optionalUuidQuery,
});
exports.updateCustomerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim().optional(),
    tags: zod_1.z.array(zod_1.z.string().trim().min(1).max(50)).max(20).optional(),
    notes: zod_1.z.string().max(2000).optional(),
});
exports.createCustomerSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).max(100).trim(),
    email: zod_1.z.string().email().toLowerCase().trim().optional().or(zod_1.z.literal('')),
    phone: zod_1.z
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
        .optional(),
    marketingSmsConsent: zod_1.z.boolean().optional(),
    marketingEmailConsent: zod_1.z.boolean().optional(),
})
    .superRefine((data, ctx) => {
    if (!data.email && !data.phone) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Provide at least an email or phone number',
            path: ['email'],
        });
    }
});
exports.createCustomerSegmentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).trim(),
    filters: zod_1.z.object({
        preset: zod_1.z.enum(customer_crm_1.CUSTOMER_SEGMENT_PRESET_VALUES).optional(),
        branchId: zod_1.z.string().uuid().optional(),
        search: zod_1.z.string().trim().min(1).max(200).optional(),
    }),
});
//# sourceMappingURL=customer.validators.js.map