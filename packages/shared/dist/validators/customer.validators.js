"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerImportRowSchema = exports.CUSTOMER_IMPORT_ROW_STATUSES = exports.CUSTOMER_IMPORT_TEMPLATE_HEADERS = exports.CUSTOMER_IMPORT_MAX_BYTES = exports.CUSTOMER_IMPORT_MAX_ROWS = exports.createCustomerSegmentSchema = exports.createCustomerSchema = exports.updateCustomerSchema = exports.listCustomersQuerySchema = void 0;
exports.parseCustomerImportConsent = parseCustomerImportConsent;
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
/** Max data rows accepted by POST /customers/import (excludes header). */
exports.CUSTOMER_IMPORT_MAX_ROWS = 2000;
/** Max upload size for patron CSV import (~2MB). */
exports.CUSTOMER_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
exports.CUSTOMER_IMPORT_TEMPLATE_HEADERS = [
    'name',
    'email',
    'phone',
    'external_id',
    'tags',
    'notes',
    'birthday',
    'gender',
    'address_line1',
    'city',
    'region',
    'postal_code',
    'country',
    'marketing_sms_consent',
    'marketing_email_consent',
    'opening_points',
];
exports.CUSTOMER_IMPORT_ROW_STATUSES = ['created', 'updated', 'error'];
/** Parse CSV consent cell → GRANTED, false → REVOKED, blank → undefined (leave unchanged). */
function parseCustomerImportConsent(raw) {
    if (raw === undefined)
        return undefined;
    const v = raw.trim().toLowerCase();
    if (!v)
        return undefined;
    if (['1', 'true', 'yes', 'y', 'granted', 'opted_in', 'optedin', 'opt-in'].includes(v)) {
        return true;
    }
    if (['0', 'false', 'no', 'n', 'revoked', 'opted_out', 'optedout', 'opt-out'].includes(v)) {
        return false;
    }
    return undefined;
}
function emptyToUndefined(v) {
    if (v === null || v === undefined)
        return undefined;
    if (typeof v === 'string' && v.trim() === '')
        return undefined;
    return v;
}
function parseTagsCell(raw) {
    if (raw === null || raw === undefined)
        return undefined;
    const s = String(raw).trim();
    if (!s)
        return undefined;
    const tags = s
        .split(/[;|]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20);
    return tags.length > 0 ? tags : undefined;
}
const optionalPhoneImport = zod_1.z.preprocess(emptyToUndefined, zod_1.z
    .string()
    .transform((val, ctx) => {
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
    .optional());
const optionalEmailImport = zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().email().toLowerCase().trim().optional());
exports.customerImportRowSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).max(100).trim(),
    email: optionalEmailImport,
    phone: optionalPhoneImport,
    externalId: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().min(1).max(100).optional()),
    tags: zod_1.z.preprocess(parseTagsCell, zod_1.z.array(zod_1.z.string().trim().min(1).max(50)).max(20).optional()),
    notes: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().max(2000).optional()),
    birthday: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().date().optional()),
    gender: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().max(20).optional()),
    addressLine1: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().max(255).optional()),
    city: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().max(100).optional()),
    region: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().max(100).optional()),
    postalCode: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().max(20).optional()),
    country: zod_1.z.preprocess(emptyToUndefined, zod_1.z.string().trim().length(2).toUpperCase().optional()),
    marketingSmsConsent: zod_1.z.boolean().optional(),
    marketingEmailConsent: zod_1.z.boolean().optional(),
    openingPoints: zod_1.z.preprocess((v) => {
        const cleared = emptyToUndefined(v);
        if (cleared === undefined)
            return undefined;
        if (typeof cleared === 'number')
            return cleared;
        const n = Number(String(cleared).trim());
        return Number.isFinite(n) ? n : cleared;
    }, zod_1.z.number().int().min(0).max(10_000_000).optional()),
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
//# sourceMappingURL=customer.validators.js.map